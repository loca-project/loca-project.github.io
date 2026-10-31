# 「GitHub Pages ＋ タイルサービス不要」は成立するか（実測）

[10-free-hosting-candidates.md](10-free-hosting-candidates.md) の 9 節を分けたもの。

タイルを外部サービスに頼らず、**自前の静的ファイルとして持つ**構成が組めるかを検証した。

### 結論

**部分的に成立する。ただし標準手法である PMTiles は GitHub Pages では今日時点で動かない。**

### 実測: GitHub Pages は `.pmtiles` を gzip 化して Range を壊す

PMTiles は HTTP Range リクエストでファイルの一部だけを読む。
GitHub Pages で実際にホストされている `.pmtiles` に対して測定した（2026-09-22）。

```
# Accept-Encoding なし
Content-Range: bytes 0-15/6601156
先頭16バイト: 504d54696c6573...   → "PMTiles" マジックナンバー。正常

# Accept-Encoding: gzip（ブラウザは必ずこれを送る）
Content-Encoding: gzip
Content-Range: bytes 0-15/6602554   ← 全長が変わっている
先頭16バイト: 1f8b0800...          → gzip ストリームの断片
```

- GitHub Pages は `application/octet-stream` でも gzip を適用する。
- Range は**圧縮後のバイト列**に対して切られるため、クライアントが計算した
  オフセットと一致しない。しかも 16 バイトの gzip 断片は展開できない。
- これが Protomaps に報告されている未解決の不具合
  （Chrome: `content-length exceeding request` / Firefox: `Decoding failed`）の正体。
- **GitHub Pages にはヘッダを制御する手段がない**（`_headers` 等は使えない）ため回避できない。

「GitHub Pages で PMTiles が使える」と書いた記事も複数あるが、
上記のとおり**ブラウザから使う経路では失敗する**。

### 成立する 3 つの方法

| 方法 | Range を使うか | 規模の目安（日本・推定） | 品質 |
|---|---|---|---|
| **A. タイルをファイル分割して置く**（`{z}/{x}/{y}.pbf`） | 使わない | z0–10: 約 8,000 ファイル / 数十 MB<br>z0–12: 約 12 万ファイル → **現実的でない** | z10 上限だと主要道路のみ |
| **B. PMTiles を一括ダウンロードしてメモリから供給** | 使わない | z0–10: 数十 MB（初回のみ転送） | A と同じ。ファイル 1 個で済む |
| **C. 基盤地図を持たない**（海岸線・県境の GeoJSON のみ同梱） | 使わない | 1〜3 MB | 街路・地名なし |

- **A** は Range を使わない素の GET なので gzip 問題の影響を受けない。最も確実。
  ただし Git リポジトリに数千〜数万ファイルが入る。
- **B** は `pmtiles` の `Source` インターフェースを自前実装（30 行程度）し、
  `fetch` で全体を取得して `ArrayBuffer` から読む。Cache Storage に入れれば 2 回目以降は即時。
  **ファイル 1 個で済み、GitHub Pages の 100MB/ファイル制限内なら成立する。**
- **C** は完全に依存ゼロだが、ズーム 15（要件 3.6 の地図ジャンプ）で周囲が分からない。
  Loca の用途では基盤地図の代わりにはならない。

### サイズの見積もりと測り方

Protomaps の公開データは planet 全体（z0–15）で約 120GB、
**ズームを 1 段上げるごとにおよそ倍**になる。日本のみの抽出は推定で

| maxzoom | 推定サイズ | GitHub Pages 適合 |
|---|---|---|
| z0–10 | 数十 MB | ○ |
| z0–12 | 100〜300 MB | △（1 ファイル 100MB 超・要分割） |
| z0–15 | 1〜2 GB | ✗（サイト上限 1GB 超） |

**推定なので、採用前に実測すること。** planet 全体を落とさずに抽出できる。

```
pmtiles extract https://build.protomaps.com/<日付>.pmtiles japan.pmtiles \
  --bbox=122.9,24.0,146.0,45.8 --maxzoom=12
```

### 推奨

**タイルの実体だけ Cloudflare R2 に置き、アプリは GitHub Pages のままにする。**

- R2 は gzip 改変をせず Range が正しく動き、**エグレス無料**、10GB まで無料。
- 「タイルサービス」ではなく**自分が持つ 1 個の静的ファイル**なので、
  外部サービス依存を避けたいという目的は満たせる。ズーム 15 まで品質も落ちない。
- ホストが 2 つになるのが唯一の難点。それを避けたいなら **方法 B（z0–10 / 数十 MB）**。

どうしても 1 ホストで完結させたい場合の優先順位は **B → A → C**。
