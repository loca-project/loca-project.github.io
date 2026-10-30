# 0017. YouTube Data API と Firestore への書き込みは Actions から、鍵ファイルなしで行う

- 状態: 採用
- 日付: 2026-09-24
- 関連: [0006](0006-ランキング基準をLoca内の指標に変える.md)、[0010](0010-書き込みと認証にFirebase無料プランを使う.md)、[0014](0014-タグを人にしか書けない情報に絞る.md)

## 背景

再生数・動画の投稿日・再生時間は YouTube oEmbed では取れず、YouTube Data API v3 でしか取れない（ADR 0006）。
消えた動画の論理削除（T24）と合成メディア申告の除外（T44。2026-09-25 取り下げ。ADR 0014 の追記）には、日次で Firestore に書く経路も要る。

制約は 2 つある。

- 支払い方法（請求先アカウント）を前提にしない（ADR 0010）。
- 秘密の値をブラウザに配らない。サービスアカウントの鍵ファイルも作らない（漏れたときに取り消すまで使われ続けるため）。

## 決定

1. **YouTube Data API は GitHub Actions からだけ呼ぶ。** API キーは YouTube Data API だけに制限し、GitHub Secrets（`YOUTUBE_API_KEY`）に置く。
   `src/` からの呼び出しは `npm run verify` が禁止する。
   （例外: 地域の調査のスクリプトは、この PC から専用のキーで呼ぶ。2026-10-24 の追記。T130）
2. **Actions から Firestore への書き込みは Workload Identity 連携で行う。** GitHub の OIDC トークンを、
   このリポジトリの Actions に限ってサービスアカウント `loca-actions` に交換する。鍵ファイルは作らない。
   サービスアカウントの権限は `roles/datastore.user`（Firestore の読み書き）だけ。
3. 設定は `scripts/setup-google.mjs` が作る（何度流しても同じ結果になる）。Firebase CLI のオーナーのログインで動く。
4. 届くかどうかは手動のワークフロー `probe-google.yml` で確かめる。入力 `video` で調べる動画を変えられる（`-f video=<ID>`）。

### 作ったもの（loca-d3792）

| 種類 | 名前 | 置き場所・権限 |
|---|---|---|
| 有効化した API | youtube・iam・iamcredentials・sts・apikeys・cloudresourcemanager | — |
| API キー | `loca-youtube`（YouTube Data API だけ） | GitHub Secrets `YOUTUBE_API_KEY` |
| サービスアカウント | `loca-actions@loca-d3792.iam.gserviceaccount.com` | プロジェクトに `roles/datastore.user` |
| Workload Identity プール | `github`、プロバイダ `loca-repo`（条件: `assertion.repository == 'loca-project/loca-project.github.io'`） | サービスアカウントに `roles/iam.workloadIdentityUser` |
| GitHub Variables | `GCP_WORKLOAD_IDENTITY_PROVIDER`、`GCP_SERVICE_ACCOUNT` | 公開してよい識別子だけ |

請求先が無効のまま、上の API をすべて有効化できた（2026-09-24 に確認）。
YouTube Data API の既定の割り当ては 1 日 10,000 ユニット（公式の Quota ガイド）。`videos.list` は 1 回 1 ユニットで、
50 本ずつまとめて取れるので、マーカー 1 万件でも 1 日 200 ユニットで済む。

### 消し方（戻す手順）

1. GitHub: `gh secret delete YOUTUBE_API_KEY` と `gh variable delete GCP_WORKLOAD_IDENTITY_PROVIDER` `GCP_SERVICE_ACCOUNT`（`-R loca-project/loca-project.github.io`）
2. Google Cloud コンソール（loca-d3792）: 「API とサービス → 認証情報」で `loca-youtube` を削除、
   「IAM → Workload Identity 連携」でプール `github` を削除、「IAM → サービスアカウント」で `loca-actions` を削除
3. 必要なら「API とサービス」で有効化した API を無効に戻す

## 検討した代替案

- **ブラウザから YouTube Data API を呼ぶ**: キーを配ることになり、割り当てを他人に使い切られる。却下。
- **サービスアカウントの鍵ファイルを Secrets に置く**: 漏れたら取り消すまで使われる。Google も非推奨。却下。
- **Cloud Functions で定期実行**: Blaze（請求先）が要る。却下（ADR 0010）。

## 結果

- T24（再生数などの日次更新・消えた動画の論理削除）が、この経路で書ける。
  T44（合成メディア申告の除外）は、API キーでは申告を読めず取り下げた（ADR 0014 の追記）。
- 再生数などを使う機能を戻せる（T25。ADR 0006 の見直し）。

## 確かめ方

`gh workflow run probe-google.yml -R loca-project/loca-project.github.io` が成功し、ログに `6 / 6 件 OK` が出る。

## 追記（2026-09-25 毎時の取得。T57）

登録した当日のマーカーは、毎晩の更新まで投稿日・長さ・再生数が無い（再生数 0・投稿日は登録日で代わりに数える）。
利用者の判断で、毎時、未取得のマーカーだけを取るようにした。

- 同じワークフロー（`sync-firestore.yml`）に毎時 15 分の予定を足す（UTC 15 時台の毎晩の回は除く）。同時実行の制御がそのまま効く。
- `refresh-youtube.mjs --missing-only` は、登録から 48 時間以内のマーカーだけを Firestore から読み（`createdAt` の範囲の問い合わせ）、
  `youtube` の無いものだけを YouTube Data API に問い合わせる。対象が無ければ API は呼ばない。記録は `jobs/youtube-refresh-hourly`。
- 何か書いたときだけ同期して公開する。書き込みは updatedAt を進めない（ADR 0013 はそのまま。利用者の判断）。
  そのため、取った値が画面に出るのは公開のあと（登録から最大で 1 時間強）。
- 手動でも `gh workflow run sync-firestore.yml -f hourly=true` で同じ経路を試せる。

注意: 毎時の同期は Firestore の markers と requests を全件読む。登録が毎時続くと 1 日に最大 23 回になるので、
マーカーが 1000 件を超えたら、Spark の読み取りの上限（1 日 5 万件）に対して見直す。

## 追記（2026-10-24 地域の調査はこの PC から専用のキーで呼ぶ。T130）

地域の調査（T128）は、公式チャンネルの全動画の一覧を取り直しながら照合するので、Actions に push して流すと 1 回ごとに承認と数分の待ちが要る。
利用者の判断で、**調べもののスクリプトに限り、この PC から YouTube Data API を呼ぶ**。背景の制約（キーをブラウザに配らない・鍵ファイルを作らない）には触れない。

| 項目 | 内容 |
|---|---|
| キー | `loca-survey`（表示名「Loca Survey - YouTube Data API」）。YouTube Data API だけに制限。Actions の `loca-youtube` とは別 |
| 置き場所 | `project/.env.local` の `YOUTUBE_SURVEY_API_KEY`（git の外）。`VITE_` で始めない（Vite がブラウザに配るため） |
| 作り方 | `npm run survey:key`（`scripts/setup-survey-key.mjs`。何度流しても同じ結果） |
| 割り当て | 1 日 10,000 ユニットを Actions と共有する（プロジェクト単位）。Actions はマーカー 1 万件でも毎晩 200 ユニット（決定の節）、毎時の未取得分はわずか |
| 漏れたとき | 割り当てを使われるだけで、請求は無い（請求先が無い）。このキーだけを消せば止まる |
| 消し方 | コンソールの「API とサービス → 認証情報」で「Loca Survey - YouTube Data API」（キー ID `loca-survey`）を削除し、`.env.local` の行を消す |

- `src/` から YouTube Data API を呼ばない決まり（決定 1 の後半と `npm run verify` の検査）はそのまま。
- 確かめたこと（2026-10-24）: このキーで `videos.list` が 200、制限の外の Identity Toolkit（`accounts:createAuthUri`）が 403 `API_KEY_SERVICE_BLOCKED`。
  同じ窓口がブラウザ用のキーでは 200 になることを先に確かめた（陽性の対照）。`accounts:query` はキーより先にログインを求めて 401 になり、試験に使えなかった。
