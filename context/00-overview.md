# プロジェクト概要

## 何を作るか

**Loca** — 地図上に YouTube 動画を紐づけて共有するコミュニティマップ。
Google AI Studio で作った「Chronos MAP」を移植し、サイト名を Loca に変更したもの。

## なぜ作るか

元の Chronos MAP は Firebase と Google Maps に密結合しており、
**公開先を変えるとコードごと書き直し**になる状態だった。
本プロジェクトは、機能の中核を保ったまま**外部サービスへの依存を最小化**して作り直す。

## 決定済みの構成

| 層 | 採用 | 状態 |
|---|---|---|
| ホスティング | GitHub Pages | 決定 |
| 地図描画 | MapLibre GL JS | 決定 |
| 地図タイル | OpenStreetMap の標準タイル（tile.openstreetmap.org） | 決定（ADR 0032。地理院タイルから変更） |
| 地名 | OpenStreetMap の Nominatim（地名検索・逆ジオコーディング。日本語・英語） | 決定（ADR 0032。国土地理院から変更） |
| 動画情報 | YouTube oEmbed（登録時）＋ YouTube Data API（毎晩・Actions だけ。ADR 0017） | 決定・実装済み |
| 定期処理 | GitHub Actions | 決定 |
| 動画本体 | 保存しない | 決定 |
| データベース | Firebase Firestore（Spark・請求先なし） | 決定・実装済み（ADR 0010） |
| 認証 | Firebase Auth の Google ログイン | 決定・実装済み（ADR 0010） |

**支払い方法を前提にしない。** Google Maps・Geocoding API・Cloud Functions は請求先が必須なので使わない。
`npm run verify` が Google Maps Platform の混入と、`src/adapters/firebase/` 以外からの Firebase の import を検出する。

## スコープ

現時点（2026-09-26）の範囲。右列は残タスク（`/tasks`）で実装する。

| 含む | まだ無い（タスク） |
|---|---|
| 地図・マーカー閲覧・検索・範囲指定検索、画面下の「フィルター」（ADR 0015）、密集地のクラスタ（ADR 0023）、条件と選んだマーカー・撮影リクエストの共有 URL（T42・T84）、サイドメニューを開いたときのサイト名（ADR 0026・0027） | 最近のアクティビティ（T80） |
| タグ（映っているもの・雰囲気が必須。ADR 0014）、雰囲気 6 色のマーカー | |
| 撮影機器 4 段（分類 → メーカー → シリーズ → モデル。ADR 0018）、機器マスタの管理者画面での編集（3 時間ごとの機器の同期で反映。ADR 0025） | |
| 再生数・投稿日・長さ（毎晩 Actions が YouTube Data API で更新、登録直後の分は毎時。ADR 0017）と、それを使うランキング・フィルタ。AI の動画は埋め込みプレーヤーの YouTube のラベルで見分ける（申告での除外は API で読めず取り下げ。ADR 0014 の追記） | |
| 消えた動画の毎晩の論理削除、30 日後の物理削除（ADR 0021）、プロフィール（ニックネームは重複不可・変えると投稿者名も追従。ADR 0019）、アカウント削除、公開プロフィールの YouTube チャンネルへのリンク（ADR 0029） | |
| Google ログイン、マーカーの投稿・編集・削除（即時反映）、自分の投稿（統計・投稿動画・撮影リクエスト。一括の削除と書き出し）、新しい版の案内（ADR 0022） | |
| いいね（投稿者への「ありがとう」。件数は誰でも見られ、付けた人は公開しない。自分の投稿で受け取った件数。ADR 0024） | |
| 撮影リクエスト（内訳・取り下げで熱量が戻る）、動画で応える・依頼者が受け取ると熱量が戻り動画に炎が貯まる（ADR 0028）、投稿者の公開プロフィール（投稿者名から開く。投稿数・受け取ったいいね・炎。T82） | |
| ユーザーのタブ（名前・タグ・撮影機器で絞り、投稿数・再生数・いいね・撮影リクエストの順。チャンネル別ランキングを置き換え。ADR 0031・T88・T93） | |
| Edge AI（AI 検索。検索語をタグに読み替え、マーカー検索では語の一致の後ろに足し、地図検索では地名が見つからないときだけ出す。起動のときにブラウザで EmbeddingGemma を準備し、初回に約 240 MB（データセーバーがオンの端末では準備しない）。日本語・英語。ADR 0033・T30・T101・T105） | |
| 通報（1 人 1 件で人数を数える。表示は続く）、新着マーカーの RSS（`feed.xml`。T47）、ブラウザ用の API キーのリファラー制限（App Check は使わない。ADR 0030） | |
| 管理者モード（統計・ユーザー管理とブラックリスト（区画ごとの検索。T74。管理者への昇格と一般への戻し。T75）・投稿動画・撮影リクエスト・機器・定期処理・通報・ログ。書き出しは投稿動画と撮影リクエストで）、日本語・英語（英語の辞書は英語のときだけ読む） | |

## 技術スタック

| 分類 | 採用 |
|---|---|
| 言語 | TypeScript 5.7（strict） |
| フレームワーク | React 18 + Vite 6 |
| パッケージマネージャ | npm |
| スタイル | Tailwind CSS 3（CDN ではなくビルドに含める）。書体は Inter（@fontsource）、サイト名だけ Fraunces の 4 文字（ADR 0026） |
| 地図 | MapLibre GL JS + OpenStreetMap のタイル |
| データ | `project/public/data/*.json`（GitHub リポジトリ上） |
| テスト | `npm run check`（型・ビルド・設計検証・テスト） |

## 構成

サイトの実体は **`project/` 配下にすべて**ある。**git リポジトリのルートも `project/` 自身**で、
`.github/` はその直下（GitHub がリポジトリルートでしかワークフローを読まないため）。
ワークスペース側の `.claude/` や `CLAUDE.md` はリポジトリの外なので公開されない。
公開は 1 コマンド（`npm run deploy`）。

詳しくは [project/docs/00-architecture.md](../docs/00-architecture.md)。

## 動かし方

```
npm run setup   # 依存のインストール
npm run seed    # サンプルデータ（初回のみ）
npm run dev     # http://localhost:5173（127.0.0.1 だと Firebase のログインが拒否される）
npm run deploy  # 検証して GitHub Pages へ公開
```

## 関連ドキュメント

- アーキテクチャ: `project/docs/00-architecture.md`
- 公開手順: `project/docs/70-publish.md`
- 要件定義（5 分冊）: `project/docs/10〜50-requirements-*.md`
- 移植対応表: `project/docs/60-migration-map.md`
- 設計判断の記録: `project/decisions/`
