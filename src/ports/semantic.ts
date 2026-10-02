import type { TagPickRule } from '@/core/logic/semanticSearch';

/** AI 検索に使う埋め込みモデルの素性（ADR 0033）。前もって計算したタグの埋め込みとの照合に使う。 */
export interface EmbeddingModelInfo {
  /** 設定の名前（例: 'embeddinggemma-300m-q4'）。public/data/semantic-tags.json の model と照合する */
  id: string;
  /** 初回に読み込む大きさの目安（MB。文書用。画面には出さない。T101） */
  sizeMb: number;
  /** このモデルで採点して決めた、タグの採り方 */
  rule: TagPickRule;
}

/** 読み込みの進み具合（0〜1）。分からないときは null */
export type LoadProgress = (ratio: number | null) => void;

/** 文を埋め込み（意味のベクトル）に変えるポート。モデルを差し替えても画面と検索の組み立ては変えない。 */
export interface SemanticPort {
  readonly model: EmbeddingModelInfo;
  /** モデルを読み込む（2 回目以降はすぐ返る）。失敗は UpstreamError。signal を止めると取得も止める（T104） */
  load(onProgress?: LoadProgress, signal?: AbortSignal): Promise<void>;
  /** 検索語の埋め込み（正規化済み） */
  embedQuery(text: string): Promise<number[]>;
  /** 検索される側の文（タグの説明文）の埋め込み（正規化済み） */
  embedDocuments(texts: string[]): Promise<number[][]>;
}
