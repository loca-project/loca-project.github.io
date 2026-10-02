# 公開手順（GitHub Pages）

## 初回だけ必要な作業

### 1. GitHub リポジトリを作る

**Public** で作る。Private だと GitHub Pages の無料枠が使えない。

### 2. ローカルを git リポジトリにして紐づける

**`project/` の直下**で実行する。ワークスペースのルート（`Loca/`）ではない。

```
cd project
git init -b main
git remote add origin https://github.com/<owner>/<repo>.git
```

**なぜ `project/` なのか**: GitHub はワークフローを
**リポジトリルート直下の `.github/workflows/`** でしか読まない。`.github/` は
`project/.github/` にあるため、リポジトリのルートも `project/` でなければ
デプロイも Firestore からの同期も動かない。

この構成の副次的な利点として、ワークスペース側の `.claude/`・`CLAUDE.md`・
`.mcp.json`・`tmp/` はリポジトリの外になり、**公開リポジトリに載らない**。

`npm run deploy` は実行時にルートが `project/` であることを確認し、
違っていれば理由を示して止まる。

### 3. GitHub Pages を有効にする

リポジトリの **Settings → Pages → Build and deployment → Source** を
**GitHub Actions** にする。（「Deploy from a branch」ではない）

### 4. Actions の権限は既定のままでよい

各ワークフローが必要な権限（同期の push に要る `contents: write` など）を自分で宣言している。
リポジトリの既定の権限は「読み取り」にしてある（2026-09-24。**Settings → Actions → General → Workflow permissions**）。
main には強制 push とブランチ削除を禁じるルールを付けてある（**Settings → Rules**）。

## 公開データについて

`public/data/markers.json` と `requests.json` が公開される地図データそのもの。
**初期状態は空**で、利用者の投稿（Firestore）が毎晩の同期で入る。投稿した直後は差分の購読でその場に出る（ADR 0013）。

| コマンド | 用途 |
|---|---|
| `npm run seed` | ローカル確認用のサンプル 20 件を入れる。**実在しない動画なので公開してはいけない** |
| `npm run data:clear` | 空に戻す。公開前に実行する |
| `npm run data:reset` | **サービス開始前だけ**。本番の Firestore の試験データの件数を出す。消すのは `project/` で `node scripts/reset-data.mjs --yes`、そのあと同期（手順は `/reset-data`） |

`npm run verify` が `seed` で始まる ID を検出すると落ちるので、
サンプルを入れたまま公開することはできない（`npm run deploy` も途中で止まる）。

マーカーが 0 件のあいだは、地図の上に「まだ登録がありません」という案内が出る。

- 1 件でも登録されれば自動的に消える
- 閲覧しかしない人のために、**× または「地図を見る」で閉じられる**
- 閉じたことは localStorage に残るので、再読み込みしても出てこない
  （端末・ブラウザ単位。記録を消せばまた出る）

## 毎回の公開

**ルールの反映や同期まで含めて一続きで行うなら `npm run release`**（2026-09-24 追加）。
`firestore.rules` が origin と違えば先に反映し（テスト → 反映 → probe）、push、公開の待機、smoke まで行う。
`npm run release -- --sync` で、同期ワークフローの実行と公開データの件数確認も行う（試験データを消したあとなど）。
途中で失敗したら、止まった段と終わった段を出して止まる。

サイトだけを出すなら、次の **1 コマンド**。`project/` でも、ワークスペースのルート（委譲される）でも実行できる。

```
npm run deploy
```

`project/scripts/deploy.mjs` が順に実行する。

1. origin より先のコミットがあるかを確かめる（無ければ止まる）
2. コミット済みの HEAD で `npm run check`（型・ビルド・検証・テスト）。ルール・Firebase のアダプタ・そのテストを変えたコミットなら `npm run test:rules` も
3. `git push`

**2 でエラーが出たら push しない。** 壊れたものを公開しないため。

**deploy はコミットしない**（2026-09-25 から。T68）。以前は `git add -A` で作業ツリーをすべてコミットしていたが、
複数のチャットが同じ作業ツリーを編集していると、他人の書きかけまで公開してしまう。
先に自分の変更をコミットしてから実行する。作業ツリーに未コミットの変更があれば、HEAD を `tmp/head-*` に取り出して検証する
（`scripts/lib/head-snapshot.mjs`。検証だけなら `npm run check:head`）。

push すると `.github/workflows/deploy.yml` が走り、数分で Pages に反映される。
進捗はリポジトリの **Actions** タブで見られる。

## Firestore のルールの反映

ルールの本体は `project/rules/*.rules` で、`npm run rules:build` が反映する形の `project/firestore.rules` を作る（方式は ADR 0012・0020）。サイトの公開（`npm run deploy`）とは**別の操作**で、
Actions も反映しない。`firestore.rules` を変えたら、次の手順で本番の `loca-d3792` に反映する。

1. Firebase CLI にログインする（初回と、トークンが切れたとき）。`loca-d3792` のオーナーのアカウントを選ぶ。

   ```powershell
   npx --prefix project firebase login --reauth
   ```

2. 反映する。エミュレータのテスト（`npm run test:rules`。JDK 11 以上が要る）が通ったときだけ反映される。

   ```powershell
   npm --prefix project run deploy:rules
   ```

3. `deploy:rules` の最後に `npm run rules:diff` が走り、本番に反映中のルールが手元の `firestore.rules` と一致することを確かめる
   （単独でも実行できる。食い違えば終了コード 1）。

戻すときは、コンソールの **ルール** の履歴から前の版を選んで公開する。

索引（`firestore.indexes.json`）も同じ `deploy:rules` で反映する。複合索引が要る問い合わせは、本番では索引が無いと
「The query requires an index」で拒否される。エミュレータは索引を見ないので、テストでは分からない。
索引を足したら、本番に同じ問い合わせを投げて確かめる（作成には数分かかる）。2026-09-25 時点で複合索引を要る問い合わせは無い。

### 管理者を足す・外す

最初の管理者は、ルールでは誰も作れない（ADR 0012）。Firebase CLI にログイン中のオーナーの権限で、スクリプトが直接書く
（セキュリティルールではなく IAM で判定される経路）。相手は一度サイトにログインしている必要がある。

| 操作 | コマンド |
|---|---|
| 一覧 | `npm run admin:list` |
| 利用者の一覧（最後のログイン・管理者・ブラックリスト。メールは伏せる） | `npm run admin:accounts` |
| 追加 | `npm run admin:add -- <メールアドレスか uid>` |
| 削除 | `npm run admin:remove -- <メールアドレスか uid>` |

CLI のログインが切れていたら、上の手順 1（または `/firebase-rules` の手順 2）でログインし直す。
ルールは `admins/{uid}` の有無だけを見るので、中身（`note`・`addedAt`）は記録用。

## ワークフローの構成

5 本に分かれている。分けているのは GitHub の仕様上の制約による。

| ファイル | いつ動くか | 何をするか |
|---|---|---|
| `publish.yml` | 他から呼ばれたときだけ | ビルド → 検証 → Pages へ公開 |
| `deploy.yml` | `main` に push したとき | `publish.yml` を呼ぶ |
| `sync-firestore.yml` | 毎日 0:00（日本時間）と手動 | YouTube の情報を更新 → Firestore から `markers.json`・`requests.json` を作り直す → 変更があれば commit/push → `publish.yml` を呼ぶ → 30 日たった行を物理削除 |
| `probe-google.yml` | 手動だけ | Actions から YouTube Data API と Firestore に届くかを確かめる（T23。公開物には触れない） |
| `sync-equipment.yml` | 3 時間ごと（日本時間 0:45 から）と手動 | Firestore の `equipmentMaster` とコードの既定から `equipment.json` を作り直す → 変更があれば commit/push → `publish.yml` を呼ぶ（ADR 0025） |
| `sync-firestore.yml`（毎時） | 毎時 15 分（0:00 の回を除く） | 未取得のマーカーだけ YouTube の情報を取る → 何か書いたときだけ同期と公開（T57。ADR 0017 の追記） |

### 名前・実行名・ジョブ概要の決まり（T31）

`gh run list` の 1 行で、種類と契機と結果の件数にたどり着けるようにする。

| 項目 | 決まり | 例 |
|---|---|---|
| ワークフローの名前（`name`） | 日本語で「種類（補足）」 | `公開（push）`・`同期（Firestore → 公開データ）`・`公開の共通処理`・`疎通確認（Google）` |
| 実行名（`run-name`） | 「種類・契機」。手動なら実行した人を括弧で足す。push はコミットの題名のまま（付けない） | `同期・毎晩`・`同期・手動（loca-project）` |
| ジョブの ID | 英小文字の動詞。変えない（`scripts/release.mjs` が job 名で結果を読む） | `refresh`・`sync`・`purge`・`publish` |
| ジョブ概要 | 件数を出すスクリプトは `scripts/lib/summary.mjs` の `writeSummary` で表を書く（Actions の外では何もしない） | 同期: Firestore の件数・公開データの件数の変化。機器マスタ: 画面で直した分類と NG |

**なぜ同期側から直接 publish を呼ぶのか**: GitHub には
「`GITHUB_TOKEN` による push は他のワークフローを起動しない」という再帰防止の仕様がある。
同期が push しても `deploy.yml` は動かないため、同期側が自分で公開まで面倒を見る。

**Firestore からの同期**（要件 1.3・1.4）: `markers` と `requests` はルールで誰でも読めるので、API キー（Variables の公開値）だけで読む。
秘密情報は使わない。論理削除・取り下げ済みの行は除く。`markers.json` の `syncedAt` が
「読み始めた時刻」で、アプリはそれより後の変更だけを onSnapshot で購読する。
機器マスタ（`equipmentMaster`）も同じく API キーだけで読み、3 時間ごとに `equipment.json` を作り直す（購読はしない。ADR 0025）。

| 操作 | コマンド |
|---|---|
| 手元で件数だけ確かめる | `npm run data:sync:check` |
| 本番で今すぐ同期する | `gh workflow run sync-firestore.yml` → `gh run watch` |
| 毎時の経路を手動で試す | `gh workflow run sync-firestore.yml -f hourly=true` |
| 機器マスタを手元で確かめる | `npm run data:sync-equipment -- --check` |
| 機器マスタを今すぐ反映する | `gh workflow run sync-equipment.yml` → `gh run watch` |

## 公開 URL

| リポジトリ名 | URL |
|---|---|
| `<owner>.github.io` | `https://<owner>.github.io/` |
| それ以外（例 `loca`） | `https://<owner>.github.io/loca/` |

`vite.config.ts` の `base` は `'./'`（相対）なので、どちらでもそのまま動く。

## 投稿が地図に載るまで

```text
利用者: 右上からログイン → 左の「投稿」タブ → 地図で場所を選ぶ → 入力して「登録する」
          ↓
       Firestore に保存（権限・重複・レートリミットはセキュリティルールが検査）
          ↓
       その場で地図に出る。他の人の画面にも差分の購読で届く（再読み込み不要）
          ↓
毎晩 0:00: sync-firestore.yml が Firestore から markers.json / requests.json を作り直す（equipment.json は 3 時間ごと） → 公開
```

取り下げ・削除は論理削除なので、同期より前に作られた行でも購読で全員の画面に届く（ADR 0013）。
管理者やスクリプトが物理削除したときだけ、同期を手動で実行する（`gh workflow run sync-firestore.yml`）。

## 動作確認

**公開前に必ず実行する。**

```
npm run preview   # 別のターミナルで
npm run smoke
```

`smoke` は実ブラウザを起動し、**地図タイルが実際に取得されたか**を数えて判定する。
DOM の文字列やピンの数だけを見ていると、地図が真っ白でも通ってしまう
（マーカーは HTML 要素なので地図が壊れていても描画される）。実際にこれで一度見逃した。

スクリーンショットが `tmp/smoke.png` に出るので、**目視でも確認すること。**

公開済みの URL に対しても実行できる。

```
npm run smoke -- https://<owner>.github.io/<repo>/
```

公開後、実際の URL で次を確認する。

| 確認項目 | 期待 |
|---|---|
| 地図が表示される | OpenStreetMap の地図が出る。右下に「© OpenStreetMap contributors」の出典 |
| ピンが出る | ピンと、重なったものをまとめた白い円の数字の合計が markers.json と requests.json の件数ぶん（ADR 0023） |
| ピンをクリック | サイドメニューがマーカー情報になる |
| ランキングタブ → 適用 | 結果パネルに件数順で並ぶ |
| 地図をクリック | サイドメニューが閉じる（投稿タブの間は閉じず、場所が入る。T108） |
| 地図を回して右下のコンパスを押す | 北が真上に戻る（T107） |
| 投稿タブ → 登録する（要ログイン） | すぐ地図に出る |
| 画面上部の帯 | 何も出ない（公開データや地図タイルを読めないとき、新しい版があるときだけ出る。ログイン中で撮影リクエストに動画が届いたときは、そのお知らせも出る） |

## 困ったとき

| 症状 | 原因と対処 |
|---|---|
| `Permission to <owner>/<repo>.git denied to <別名>` / 403 | Windows に**別の GitHub アカウント**の資格情報がキャッシュされている。下記参照 |
| 404 になる | Settings → Pages の Source が「GitHub Actions」か確認 |
| 地図が灰色のまま | 画面上部に地図タイルの帯が出ていれば OpenStreetMap のタイルに到達できていない。帯が無ければ地図の表示位置がおかしい可能性（`maxBounds` の罠。[ADR 0007](../decisions/0007-maxBoundsを使わない.md) 参照）|
| ピンが出ない | `project/public/data/markers.json` が空。`npm run seed` で復旧できる |
| ログインが出ない・投稿タブが「受け付けていません」 | Firebase の設定値が空。本番はリポジトリの Variables、ローカルは `.env.local` の `VITE_FIREBASE_*` を確認する |
| ログインに失敗する（identitytoolkit が 403 `API_KEY_HTTP_REFERRER_BLOCKED` を返す） | 開いている URL が API キーのリファラーの許可に無い（別のポート・`127.0.0.1`・独自ドメイン）。許可の一覧は [ADR 0030](../decisions/0030-ブラウザ用APIキーはリファラーで絞りApp-Checkは使わない.md) |
| 公開データに消したはずの行が残る | 物理削除は購読に届かない。`gh workflow run sync-firestore.yml` で作り直す |
| 管理者モードが出ない | 別のアカウントでログインしていることが多い。`npm run admin:accounts` で最後にログインしたアカウントを確かめる |
| push が `Internal Server Error` で拒否される | GitHub 側の一時的な失敗。`npm run deploy` は未 push のコミットを 1 件ずつ push し直す（2026-09-24 に 2 件まとめてが 3 回失敗し、1 件ずつなら通った） |
