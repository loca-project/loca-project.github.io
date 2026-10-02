# Loca

**地図に残す、あの場所の記録。**

自分で撮影した動画を、撮った場所とともに地図にピン留めして共有するコミュニティマップです。

🗺️ **https://loca-project.github.io/**

---

## どんなサイトか

日本地図の上に、誰かが「ここで撮った」動画のマーカーが並びます。
マーカーには撮影地の地名、そのとき感じたこと（感情タグ）、使った撮影機器が紐づいています。

- **地図から探す** — ピンをクリックすると動画とその場所の情報が出ます
- **絞り込む** — 地名やキーワードでの検索（Edge AI が意味の近い動画も探す。起動のときに準備し、初回に約 240 MB。データセーバーがオンの端末では準備せず語の一致だけ）、地図上をドラッグしての範囲指定検索
- **ランキング** — 地域別・機器別・撮影リクエストの熱量順で見られます
- **ユーザー** — 投稿者を名前・タグ・撮影機器で絞り、投稿数・再生数・いいね・撮影リクエストの順で見られます
- **撮影リクエスト** — まだ動画が無い場所に「ここを撮ってほしい」を投じられます
- **最近** — 新しい動画と撮影リクエストを新しい順に見られます

## 投稿するには

**Google アカウントでログインすれば、誰でも投稿できます。**

1. 画面右上の「ログイン」から Google アカウントでログインする
2. 左の「投稿」タブを開き、地図をクリックして撮影した場所を選ぶ
3. YouTube の URL とタグ（撮影リクエストなら熱量と条件）を入力して「登録する」
4. すぐに地図に表示されます。自分の投稿はあとから編集・削除できます
### 投稿していただくときのお願い

登録する YouTube URL は、**ご自身が制作し正当な権利を保有するコンテンツ**に限ります。
第三者が制作した動画の登録はご遠慮ください。

不適切なマーカーを見つけたら、サイト上の「通報」ボタンからお知らせください。

## プライバシー

- **閲覧に個人情報は要りません。** ログインは投稿・撮影リクエスト・通報・いいねのときだけです
- **公開データに出るのは、投稿者の識別子（Firebase の uid）と、そこから作る仮の投稿者名（`user-xxxxxx`）だけ**です。
  プロフィールで登録した YouTube チャンネルは、あなたの公開プロフィールのリンクとして公開されます（ADR 0029）。
  Google アカウントのメールアドレス・名前・写真は、認証を担う Firebase Authentication の中にだけあり、公開データには出しません
- **動画そのものは保存しません。** YouTube の埋め込みで再生します
- 通報の内容は管理者と通報した本人しか読めません
- 誰がいいねを付けたかは、管理者と付けた本人しか読めません（件数は誰でも見られます）

## 仕組み

```text
閲覧:  ブラウザ ──> GitHub Pages ──> data/*.json（毎晩作り直す）＋ 直近の変更（Firestore）
投稿:  ブラウザ ──> Google ログイン ──> Firestore（権限はセキュリティルール）
反映:  GitHub Actions（毎日）──> Firestore から data/*.json を作り直す ──> Pages
```

自前のサーバーは 1 台も持ちません。どれも無料の範囲で動いていて、支払い方法の登録もしていません。

| 層 | 使っているもの |
|---|---|
| ホスティング | GitHub Pages |
| 地図 | MapLibre GL JS + [OpenStreetMap](https://www.openstreetmap.org/copyright) のタイル |
| 動画情報 | YouTube oEmbed |
| 地名 | OpenStreetMap の Nominatim（地名検索・逆ジオコーディング） |
| Edge AI（AI 検索） | ブラウザで動く埋め込みモデル（EmbeddingGemma。Hugging Face から読む） |
| ログインと書き込み | Firebase Authentication・Cloud Firestore（無料の Spark プラン） |
| 閲覧の土台と定期処理 | このリポジトリの JSON と GitHub Actions |

## 開発

```
npm ci
npm run data:seed   # ローカル確認用のサンプルデータ
npm run dev         # http://127.0.0.1:5173
```

| コマンド | 内容 |
|---|---|
| `npm run check` | 型チェック＋ビルド＋設計上の約束の検査 |
| `npm run smoke` | 実ブラウザで地図が描画されるかを確認 |
| `npm run data:clear` | 公開データを空に戻す |
| `npm run deploy` | 検証して GitHub Pages へ公開 |

- アーキテクチャ: [docs/00-architecture.md](docs/00-architecture.md)
- 公開手順: [docs/70-publish.md](docs/70-publish.md)
- 要件定義: [docs/](docs/)
- 設計判断の記録: [decisions/](decisions/)

## クレジット

地図: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
地名: OpenStreetMap の Nominatim（© OpenStreetMap contributors）
