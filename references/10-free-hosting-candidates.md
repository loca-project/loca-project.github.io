# 無料クラウドサービス候補の調査（2026-09-22 時点）

## 調査の前提

- **Google API / Firebase の固有機能を必須条件にしない。** 使ってもよいが、それが無いと
  成立しない設計にはしない。
- 公開に必要な機能をすべて**無料枠**でまかなえる組み合わせを探す。
- Loca は純粋な静的 SPA なので、**ブラウザから直接叩ける**バックエンドかどうかで難易度が変わる。

> 無料枠は変動が激しい。本書は調査日時点の情報であり、採用前に各社の料金ページを再確認すること。

## Loca が必要とするもの（ポート別）

| 層 | 必要なこと | ブラウザから直接叩けるか |
|---|---|---|
| 静的ホスティング | `dist/` を配る。SPA フォールバック | — |
| `DataPort` | マーカー等の CRUD ＋ 購読。行レベルの権限制御 | **直接叩けると実装が楽**。叩けない場合はサーバー層を書く |
| `AuthPort` | サインイン。Google 以外の手段でもよい | 同上 |
| `MapPort` | 地図タイルの配信 | 直接 |
| `VideoMetaPort` | YouTube のタイトル・再生数 | 直接（oEmbed）／サーバー側（Data API） |
| `GeocodePort` | 座標 ⇄ 地名 | 直接 |
| バッチ | 日次で `markers.json` を再生成 | サーバー／CI |

**`DataPort.subscribe()` はリアルタイム必須ではない。** ポーリング実装でも
インターフェースを満たせるので、リアルタイム機能の有無は候補を落とす理由にしない。

---

## 1. 静的ホスティング

| サービス | 無料枠 | 評価 |
|---|---|---|
| **Cloudflare Pages** | **帯域無制限**、ビルド 500 回/月、1 サイト 20,000 ファイル（1 ファイル 25MB まで）、同時ビルド 1 | ◎ 本命 |
| Netlify | 帯域 100GB/月、ビルド 300 分/月 | ○ |
| Vercel (Hobby) | 帯域 100GB/月。商用利用は規約上グレー | △ |
| **GitHub Pages** | **帯域 100GB/月（ソフト上限）**、サイト 1GB、1 ファイル 100MB、ビルド 10 回/時。サーバー機能なし | ○ **予備系に最適**。ただし §9 の制約に注意 |

**推奨: Cloudflare Pages を本番、GitHub Pages を予備。**
Loca は `base: './'` の相対パス構成なので、**同じ `dist/` を両方に置けばそのまま動く**。
片方が落ちてももう片方で見せられる ＝ 追加コストゼロの冗長化。

---

## 2. データ ＋ 認証（ここが最大の分かれ道）

### 2-A. Supabase（本命）

| 項目 | 無料枠 |
|---|---|
| DB | Postgres 500MB |
| ファイル | 1GB |
| 転送 | 5GB/月 |
| 認証 | 50,000 MAU |
| プロジェクト数 | 2 |
| **注意** | **7 日間アクセスが無いとプロジェクトが一時停止**（手動復帰が必要） |

- **ブラウザから直接叩ける**（RLS ＋ anon key）。`DataPort` / `AuthPort` にほぼ 1:1 で対応する。
- リアルタイム購読あり。現行の `subscribe()` をそのまま活かせる。
- **Postgres なので出口がある**。`pg_dump` で Neon・自前 Postgres・Supabase セルフホストへ移せる。
  Firestore と違いデータ形式のロックインが無い。
- 認証は Google だけでなく GitHub・メールマジックリンク等を選べる。
- 7 日停止は**日次バッチが叩くこと自体で回避できる**（すでに `data:build` がある）。

### 2-B. PocketBase セルフホスト（ロックインゼロ）

- 15MB のシングルバイナリに SQLite ＋ 認証 ＋ リアルタイム(SSE) ＋ ファイル保存が入る。
- **データは SQLite ファイル 1 個**。バックアップも移設もファイルコピーで済む。
- 常時起動のホストが要る。無料で狙うなら **Oracle Cloud Always Free**（ARM VM が恒久無料）。
  ただし運用（OS・TLS・バックアップ）は自分持ち。アイドル VM の回収ポリシーにも注意。
- 100k MAU 程度までインスタンス 1 台で足りるとされる。

### 2-C. Cloudflare 一式（Pages + Workers + D1 + R2）

| 項目 | 無料枠 |
|---|---|
| Workers | 100,000 リクエスト/日、CPU 10ms/回 |
| D1 | 5GB、読み 500 万行/日、書き 10 万行/日（**2026-09 から上限超過は即エラー**） |
| R2 | 10GB、書き 100 万/月、読み 1,000 万/月、**エグレス無料** |

- 停止期間が無く、帯域も無料。**長期の安定運用では最も安い。**
- ただし **D1 はブラウザから直接叩けない**。Workers に API を書く必要がある。
  認証も自前か外部サービスとの接続が要る。**追加実装が一番多い。**

### 2-D. その他

| サービス | 無料枠 | Loca での評価 |
|---|---|---|
| Turso | 5GB、読み 5 億行/月、書き 1,000 万行/月、DB 100 個 | 読み書き枠は潤沢だがサーバー層が要る |
| Neon | 0.5GB/プロジェクト（100 プロジェクトまで）、scale-to-zero、Neon Auth 60k MAU | Postgres。サーバー層が要る |
| Appwrite Cloud | Firebase 相当の一式。セルフホストと同一 API | Supabase の対抗馬。SDK 依存はやや強い |

### 判定

| 優先するもの | 選ぶもの |
|---|---|
| **実装量の少なさ・すぐ公開** | **Supabase** |
| **ロックインゼロ・データ主権** | PocketBase セルフホスト（Oracle Cloud Always Free 等） |
| **長期の安定と最安** | Cloudflare 一式（ただし Workers API を書く） |

---

## 3. 地図タイル（**現状に問題あり・要対応**）

現在の既定は `tile.openstreetmap.org` のラスタタイル。
**OSM 公式タイルサーバーは「広くサイトに埋め込む用途」を禁じている。**
> **2026-09-26 追記**: 今の規約（operations.osmfoundation.org/policies/tiles/）に埋め込みを禁じる文は無い。認める例は「人が操作し、いま見ている範囲だけを読む閲覧」で、禁止は先読み・まとめての取得・オフライン用の保存。Loca は ADR 0032 で公式タイルを採用した（この節の結論は当時のもの）。
ローカル確認には問題ないが、**公開前に必ず差し替えること。**

| 候補 | 無料枠 | 評価 |
|---|---|---|
| **OpenFreeMap** | **APIキー不要・リクエスト数無制限・商用可・MIT** | ◎ 差し替え先の第一候補。ベクタタイル 5 スタイル（Positron / Bright / Liberty / Dark / Fiord3D）。MapLibre 互換 |
| **Protomaps (PMTiles)** | タイルを **1 ファイル**として自前配信 | ◎ 冗長化・自前運用の本命。**Cloudflare R2 はエグレス無料**なので日本域の抽出なら実質ゼロ円 |
| MapTiler | 約 10 万ロード/月（要 APIキー） | ○ |
| OSM 公式ラスタ | — | ✗ **公開用途では使わない** |

**推奨: OpenFreeMap を既定、Protomaps PMTiles on R2 を予備。**
`VITE_MAP_TILE_URLS` は複数指定できるので、両方書けばそのまま冗長化になる。

> OpenFreeMap はスポンサー寄付で運営されている。無料サービスの持続性リスクは
> Protomaps 自身も指摘しており、**自前 PMTiles を用意しておくのが保険**になる。

---

## 4. ジオコーディング

マーカー登録時にしか呼ばないので、必要量は 1 日数百件程度。無料枠で十分足りる。

| 候補 | 無料枠 | 評価 |
|---|---|---|
| **LocationIQ** | 5,000 req/日（超過分も 100% までソフト許容） | ◎ 量が一番多い |
| OpenCage | 2,500 req/日 | ○ タイムゾーン等の付加情報あり |
| Geoapify | 欧州データに強い。GDPR 準拠 | ○ |
| Photon (komoot 公開インスタンス) | **キー不要**。ただし推奨 1 req/秒、過剰利用は遮断。可用性保証なし | △ 予備向け。自前インスタンスも可 |
| Nominatim 公開インスタンス | 1 req/秒。利用規約に厳しい制約 | △ 同上 |

**推奨: LocationIQ を既定、Photon を予備、`offline`（現行実装）を最終フォールバック。**
3 段のフォールバックはすでに `container.ts` の仕組みで実現できる。

---

## 5. 動画メタデータ

| 手段 | キー | 取れるもの |
|---|---|---|
| **YouTube oEmbed**（現行の既定） | **不要** | タイトル・チャンネル・サムネイル |
| YouTube Data API v3 | Google Cloud のキー（無料枠 10,000 ユニット/日） | ＋ 再生数・高評価数・投稿日・再生時間 |

動画そのものが YouTube である以上、YouTube への依存は製品の前提であり、
Firebase のようなロックインとは性質が違う。

**推奨の設計変更**: 再生数が要るなら、**Data API のキーをブラウザに置かず、日次バッチ側に置く**。
`scripts/build-markers-json.mjs` が統計値を補完して `markers.json` に焼き込めば、

- クライアントのバンドルにキーが乗らない（現行より安全）
- クライアントからの API 呼び出しが減る（要件 1.2 の「APIコールはサーバー側で」に沿う）
- ランキングは日次更新が前提（要件 4.1）なので、鮮度要件も満たす

Invidious / Piped などキー不要の第三者 API もあるが、インスタンスの安定性が低く推奨しない。

---

## 6. 定時バッチ（markers.json の再生成）

| 候補 | 無料枠 | 評価 |
|---|---|---|
| **GitHub Actions `schedule`** | パブリックリポジトリは無料。**実行が中央値 22 分ほど遅れる** | ◎ 日次なら遅延は無害 |
| Cloudflare Workers Cron Triggers | 無料枠内。UTC 固定 | ○ 時刻精度が要るならこちら |

**推奨: GitHub Actions。** 要件 1.3 の「00:00 JST・失敗時 15 分間隔で 3 回リトライ」は
ワークフロー側で表現できる。Supabase を使う場合、**このジョブが 7 日停止の回避も兼ねる。**

---

## 7. 推奨スタック 3 案（すべて月額 0 円）

### 案 A: すぐ公開できる（推奨）

| 層 | 採用 |
|---|---|
| ホスティング | Cloudflare Pages（＋ GitHub Pages ミラー） |
| データ・認証 | Supabase（Postgres / Auth / Realtime / RLS） |
| 地図 | OpenFreeMap（予備: Protomaps on R2） |
| ジオコーディング | LocationIQ（予備: Photon → offline） |
| 動画情報 | oEmbed（統計はバッチで Data API） |
| バッチ | GitHub Actions |

**必要な実装**: `supabase` データアダプタ ＋ 認証アダプタ（既存の `firebase` 実装とほぼ同じ形）。
ポートは変更不要。

**弱点**: 7 日無アクセスで停止（バッチで回避）。DB 500MB・転送 5GB/月。

### 案 B: ロックインを完全に避ける

| 層 | 採用 |
|---|---|
| ホスティング | Cloudflare Pages |
| データ・認証 | PocketBase（Oracle Cloud Always Free 等に自前配置） |
| 地図 | Protomaps PMTiles を自前配信 |
| その他 | 案 A と同じ |

**弱点**: サーバー運用が自分持ち。無料 VM の回収ポリシーに注意。

### 案 C: 長期に一番安く、止まらない

| 層 | 採用 |
|---|---|
| すべて | Cloudflare（Pages + Workers + D1 + R2） |
| 認証 | Logto Cloud（50k MAU 無料）等を接続 |

**弱点**: Workers に API を書く必要があり、**実装量が一番多い。**

---

## 8. 公開前に必ず直すこと

1. **地図タイルの差し替え**（`VITE_MAP_TILE_URLS`）。OSM 公式ラスタのままでは規約違反。（2026-09-26 追記: 今の規約では違反にならない。ADR 0032 で採用）
   → OpenFreeMap（キー不要）に変えるだけ。コード変更は不要。
2. **ジオコーディングの既定**。`offline` は都道府県までしか返さないので、
   要件 3.4（市町村の取得）を満たすには LocationIQ か Photon を有効にする。
3. **IP 単位のアクセス制限**（要件 1.3）。静的配信では実装できないため、
   Cloudflare の WAF / Rate Limiting Rules（無料枠あり）に台帳を反映する運用を決める。

## 9. 「GitHub Pages ＋ タイルサービス不要」は成立するか

[11-github-pages-tiles.md](11-github-pages-tiles.md) に分けた。

## 出典

- Supabase 無料枠: https://uibakery.io/blog/supabase-pricing , https://www.cloudzero.com/blog/supabase-pricing/
- Neon / Turso / D1 比較: https://freetier.co/articles/cloudflare-d1-free-tier-limits-pricing-and-alternatives , https://gautamkhorana.com/serverless-databases/compare/turso-vs-cloudflare-d1/
- Cloudflare Workers / R2: https://www.cloudflare.com/plans/developer-platform/ , https://developers.cloudflare.com/workers/platform/limits/index.md
- 静的ホスティング比較: https://guptadeepak.com/tools/top-5-static-site-hosting-jamstack-platforms-2026/ , https://pressless.io/blog/host-website-free-2026
- OpenFreeMap: https://openfreemap.org/
- Protomaps（無料枠の持続性）: https://protomaps.com/blog/free-tier-maps/
- ジオコーディング比較: https://www.bitoff.org/geocoding-apis-comparison/ , https://publicapis.io/blog/free-geocoding-apis
- Photon 利用方針: https://photon.komoot.io/ , https://github.com/komoot/photon
- 認証サービス比較: https://blog.hyperknot.com/p/comparing-auth-providers , https://merginit.com/blog/13062026-free-auth-identity-providers-comparison
- PocketBase / Appwrite: https://www.devtoolreviews.com/reviews/supabase-vs-firebase-vs-appwrite-vs-pocketbase-2026
- Cron: https://www.smplkit.com/blog/11-best-cron-job-services-2026
- GitHub Pages の制限: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- PMTiles on GitHub Pages の不具合: https://github.com/protomaps/PMTiles/issues/584 , https://github.com/protomaps/PMTiles/discussions/582
- Protomaps ダウンロードと extract: https://docs.protomaps.com/basemaps/downloads , https://docs.protomaps.com/pmtiles/cli
- PMTiles を静的配信する例: https://thomasgauvin.com/writing/static-protomaps-on-cloudflare/ , https://til.simonwillison.net/gis/pmtiles
