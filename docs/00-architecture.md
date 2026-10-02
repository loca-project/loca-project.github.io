# Loca アーキテクチャ

## 決定済みの構成

| 層 | 採用 |
|---|---|
| ホスティング | GitHub Pages |
| 地図描画 | MapLibre GL JS |
| 地図タイル | OpenStreetMap の標準タイル（APIキー・請求先不要。OSM 財団の利用規約を守る。ADR 0032） |
| 地名 | OpenStreetMap の Nominatim（地名検索・逆ジオコーディング。APIキー不要。全利用者で 1 秒 1 回まで。ADR 0032） |
| 動画情報 | YouTube oEmbed（APIキー不要） |
| 定期処理 | GitHub Actions |
| データベース | Firebase Firestore（Spark・請求先なし）。書き込みはすべてここ。閲覧の土台は毎晩作り直す JSON |
| 認証 | Firebase Auth の Google ログイン（ポップアップ方式） |
| 動画本体 | 保存しない（YouTube 埋め込み） |

支払い方法を前提にしない（ADR 0010）。Google Maps・Geocoding API・Cloud Functions は請求先が必須なので使わない。
`npm run verify` が Google Maps Platform の混入と、`src/adapters/firebase/` 以外からの Firebase の import を検出する。

## 一言でいうと

**サーバーを 1 台も持たない。** 閲覧の土台は GitHub Pages が配る静的 JSON、書き込みは Firestore（権限はセキュリティルール）、
毎晩の反映と定期処理は GitHub Actions が受け持つ。

```text
閲覧:  ブラウザ ──> GitHub Pages ──> dist/data/*.json ＋ Firestore の差分（onSnapshot。updatedAt > syncedAt）
投稿:  ブラウザ ──> Firebase Auth ──> Firestore（投稿・撮影リクエスト・通報・いいね。権限・重複・上限はルール）
反映:  Actions（毎日 0:00）──> Firestore を読んで markers.json / requests.json を再生成（equipment.json は 3 時間ごとの機器の同期） ──> ビルド（feed.xml も作る）──> Pages に反映
```

同期より後の変更は、すべて updatedAt を進める書き込みで表す（論理削除）。だから差分の購読で取りこぼさない（ADR 0013）。

## ディレクトリ

```
Loca/                               ワークスペース（git の外）
├─ .claude/ CLAUDE.md package.json  Claude 設定と委譲コマンド
├─ tmp/                             一時ファイル
└─ project/                         ←← git リポジトリのルート
   ├─ .github/
   │  ├─ workflows/deploy.yml         push → ビルド → Pages
   │  ├─ workflows/sync-firestore.yml 毎日 Firestore → JSON 再生成 → Pages
   │  ├─ workflows/sync-equipment.yml 3 時間ごと equipmentMaster → equipment.json → Pages
   │  └─ workflows/publish.yml        ビルドと公開の共通部分
   ├─ index.html / package.json / vite.config.ts
   ├─ firestore.rules                セキュリティルール（生成物。rules/*.rules をつなぐ。ADR 0020）
   ├─ rules/                         セキュリティルールの部品（tests/ がエミュレータで検査）
   ├─ public/data/*.json             公開データ（Firestore から毎晩作り直す閲覧の土台。equipment.json は 3 時間ごと。
   │                                 semantic-tags.json は Edge AI のタグの埋め込みで npm run semantic:vectors で作る。ADR 0033）
   ├─ scripts/                       検証・同期・公開・管理
   ├─ src/
   │  ├─ core/       依存ゼロ。型・定数・純粋ロジック
   │  ├─ ports/      インターフェース定義
   │  ├─ adapters/   実装。外部 SDK を import してよいのはここだけ
   │  ├─ runtime/    設定とサービス解決
   │  ├─ features/   画面
   │  ├─ shared/     共通 UI とフック
   │  ├─ i18n/       日英の辞書
   │  ├─ styles/     全体の CSS
   │  ├─ assets/     書体（サイト名の 4 文字だけ。ADR 0026）
   │  └─ app/        画面の組み立てと状態
   └─ context/ docs/ decisions/ references/   資料
```

**git リポジトリのルートは `project/` 自身。** GitHub はワークフローを
リポジトリルート直下の `.github/` でしか読まないため、この位置しかありえない。
結果として、ワークスペース側の設定は公開リポジトリに含まれない。

## ポート一覧

| ポート | 責務 | 実装 |
|---|---|---|
| `CatalogPort` | 公開データの読み取り | `static`（public/data/*.json） |
| `MapPort` | 地図の描画・ピン・情報ウィンドウ・矩形描画 | `maplibre` |
| `VideoMetaPort` | 動画メタデータの取得 | `oembed` |
| `GeocodePort` | 座標 ⇄ 地名 | `nominatim`（OpenStreetMap） |
| `SemanticPort` | 文の埋め込み（Edge AI で検索語をタグに読み替える） | `transformers`（ブラウザで EmbeddingGemma。起動画面の間に `src/runtime/edgeAi.ts` が準備する（データセーバーがオンなら準備しない。T105）。モデルは `models.ts` で差し替え。ADR 0033・T101） |
| `AuthPort` | Google ログイン・ログアウト・状態の購読 | `firebase-auth`（ポップアップ方式） |
| `MarkerStorePort` | マーカーの作成・本人の更新・論理削除・差分の購読 | `firestore`（レートリミットの印・動画の索引と同じバッチで書く。ADR 0012） |
| `RequestStorePort` | 撮影リクエストの作成・取り下げ（論理削除）・届いた動画の受け取り（ADR 0028）・炎の読み取り（動画ごと・投稿者の合計。T82）・差分の購読 | `firestore-requests`（熱量の印と同じバッチで書く。受け取りは炎の集計とトランザクションで書く） |
| `ReportStorePort` | 通報（1 人 1 マーカー 1 件） | `firestore-reports` |
| `ProfileStorePort` | プロフィール（ニックネーム・同意）と公開プロフィールの YouTube チャンネル（`publicProfiles`。T55）の読み書き・アカウント削除 | `firestore-profiles`（ADR 0019・0021） |
| `AdminStorePort` | 管理者モードの読み書き（利用者・投稿の論理削除・撮影リクエストの取り下げ・定期処理の記録・機器マスタ） | `firestore-admin`（T27・ADR 0025） |
| `LikeStorePort` | いいねの付け外し・件数・自分の投稿が受け取った件数・投稿者の合計（公開プロフィール。T82）（1 人 1 マーカー 1 件） | `firestore-likes`（件数の文書とトランザクションで書く。ADR 0024） |

`AuthPort` と書き込みのポートは Firebase の設定値がそろったときだけ作られ、無ければ `null`（閲覧だけで動く）。
Firebase SDK は `src/adapters/firebase/index.ts` から遅延 import し、初期読み込みには含めない（`npm run verify` が検査する）。

利用者の書き込みの主なポートは `MarkerStorePort`・`RequestStorePort`・`ReportStorePort`・`LikeStorePort`。GitHub Issue 経由の投稿は 2026-09-24 に廃止した。

## データの形

`project/public/data/markers.json`

```json
{
  "generatedAt": 1758500000000,
  "syncedAt": 1758499990000,
  "markers": [
    {
      "id": "ozgGSNaaWI6TcMIgtqHC",
      "youtubeUrl": "https://www.youtube.com/watch?v=<11 文字>",
      "videoId": "<11 文字>",
      "lat": 35.69, "lng": 139.69,
      "tags": { "action": "...", "atmosphere": "...", "emotion": "..." },
      "equipment": { "manufacturer": "DJI", "series": "Mavic", "model": "Mavic 3 Pro" },
      "title": "...", "channelTitle": "...", "thumbnailUrl": "...",
      "prefecture": "東京都", "city": "台東区",
      "ownerUid": "<Firebase の uid>", "createdBy": "user-xxxxxx",
      "createdAt": 1758400000000, "updatedAt": 1758400000000,
      "answers": ["<撮影リクエストの ID>"],
      "likes": 3
    }
  ]
}
```

`requests.json` も同じ形で、撮影リクエストの地点と、その内訳（`entries`: `id`・熱量・季節・時間帯・撮り方・機器・`ownerUid`。季節・時間帯・撮り方は動画のタグと同じキー）を持つ。
`answers` は撮影リクエストに応えた動画だけが持つ（応えたリクエストの `id`。ADR 0028）。
`likes` は Loca のいいねの件数で、同期が `likeCounts` から入れる（1 件以上の動画だけ。購読では届かないので最大 1 日遅れ。画面は手元の値を引き継ぐ。T92）。
`syncedAt` は「同期で Firestore を読み始めた時刻」で、画面はそれより後に `updatedAt` が変わった行だけを購読する。

## ランキングの基準

基準は要件どおり再生数（`src/core/logic/ranking.ts`）。
再生数・動画の投稿日・長さは、毎晩 Actions が YouTube Data API で取って markers.json に入れる（ADR 0017）。
ブラウザは YouTube Data API を呼ばない（登録時の題名などは oEmbed。API キーは Actions の Secrets だけ）。

| 項目 | 現在 |
|---|---|
| 地域別・機器別 | 都道府県・機器の組み合わせごとに再生数を合算し、多い順（同じなら件数、さらに新しい順） |
| ユーザー（ADR 0031） | 条件に当たる動画で投稿者ごとに投稿数・再生数・いいね（`likes`）・応えた撮影リクエスト（`answers`）を数え、選んだ値の多い順（既定は投稿数。同じなら投稿数・再生数、さらに新しい順。`src/core/logic/people.ts`） |
| 動画投稿日フィルタ・季節フィルタ | 動画の投稿日で絞る |
| 動画の長さフィルタ | 4 分未満・4〜20 分・20 分以上 |
| まだ取っていないマーカー（登録した当日） | 再生数 0、投稿日は登録日で代わりに数える。長さで絞ったときは当たらない |

2026-09-22〜24 は再生数を取らず、登録件数で並べていた（経緯は 40-requirements-ranking の「Loca での扱い」）。

## 可用性

サーバーが無いので「落ちる」対象が少ない。残る依存は 5 つだけ。

| 依存 | 落ちたとき |
|---|---|
| GitHub Pages | サイト全体が見られない（代替なし）。公開データは 30 秒で諦め、読めた分で描画する（T103） |
| YouTube oEmbed | 動画の登録だけ止まる。窓口（youtube.com・noembed.com）ごとに 8 秒で諦め、「応答しない」を「URL の誤り」と分けて伝える（T103）。閲覧は続く |
| OpenStreetMap のタイル | 地図が灰色になる。ピンと閲覧は続く。画面上部の帯で知らせる |
| Nominatim | 地名の取得と地名検索が使えない。10 秒で諦めて理由を出す。登録は地名なしで続行（予備なし・ADR 0032） |
| Hugging Face（AI 検索のモデル） | Edge AI だけ使えない。起動は諦めて続け、語の一致の結果だけを出す（理由はコンソール。ADR 0033・T101） |

不調は画面上部の帯（`HealthNotice`）で知らせる。黙って劣化させない。Firestore が使えないときは閲覧だけで動く。
新しい版が公開されたときも、同じ帯で開いたままのタブに再読み込みを促す（`version.json`。ADR 0022）。

## 検証

```
npm run typecheck   # 型
npm run build       # ビルド
npm run verify      # 設計上の約束を 26 項目チェック（2026-10-02）
npm run check       # 上記 3 つとテスト（test:scripts・test:core）をまとめて
```

`npm run verify` が見ているもの（出力の各行が 1 項目）:

- 廃止した依存が無い（src と package.json）。Firebase SDK の import は `src/adapters/firebase/` だけ。AI 検索の部品（transformers.js・onnxruntime-web）の import は `src/adapters/semantic/` だけ（ADR 0033）
- src の `fetch` がすべて待ち時間の上限（`signal`）を持つ（`scripts/lib/fetch-calls.mjs`。T96・T103）
- scripts の子プロセスに `shell: true` が無い（T65）
- `features/` と `core/` に地図 SDK の直接 import が無い。`import.meta.env` を読むのは `runtime/config.ts` だけ
- ソースに API キーが直書きされていない。`.env.example` 以外の `.env*` が git に無く、`.env.example` に値が無い
- すべてのソースが 400 行以内（CP-2）
- 公開データが読め、サンプルデータが混ざっていない
- 都道府県リストと撮影リクエストの地点のしきい値が、scripts と src で一致
- ワークフローが決まりどおり（日本語の名前・runner の版の固定・Node.js 24 対応の Actions・if で比べる cron が on.schedule にある。`scripts/lib/workflow-lint.mjs`）
- `dist/` が静的ファイルのみ。初期読み込みの JS に Firebase SDK が無く、260 kB 以内
- `version.json` の版が `index.html` の入口と一致（ADR 0022）。`feed.xml`（新着マーカーの RSS。T47）が RSS 2.0 で、公開データの新着 50 件までを載せている
- `firestore.rules` が `rules/` の部品と一致（ADR 0020）。ルールのコレクションがすべて `reset-data` の消す・残すに入っている
- 機器の分類が src・ルール（2 か所）・マスタ・同期で一致（ADR 0018・0025）
- 地図と地名の使い方が OpenStreetMap の規約どおり（タイルの URL・出典・Referer を止めていない・国土地理院の API を呼ぶコードが無い。ADR 0032）
