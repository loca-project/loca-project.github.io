/**
 * 検索・ランキングのフィルタ条件。
 *
 * 動画の投稿日・長さは、毎晩 Actions が YouTube Data API で取る（ADR 0017）。
 * まだ取っていないマーカー（投稿した当日）は、投稿日は登録日で代わりに数える。
 */

import type { TagField } from '@/core/constants/tags';
import type { Equipment } from './marker';

/**
 * タグの絞り込み。項目の中は OR、項目の間は AND（要件 4.2・ADR 0015）。
 * 未定義・空配列の項目では絞らない。値はタグのキー。
 */
export type TagSelection = Partial<Record<TagField, string[]>>;

/**
 * 画面下の地図フィルタ（ADR 0015）。地図に出すマーカーと、範囲指定検索の結果に効く。
 * タグの規則はランキングと同じ（項目の中は OR、間は AND）。撮影リクエストには季節・時間帯・撮り方だけが効く。
 */
export interface MapFilter {
  videos: boolean;
  requests: boolean;
  tags: TagSelection;
  /** 機器の分類のキー（複数選択は OR。動画だけに効く。ADR 0018） */
  equipmentCategories: string[];
}

export const DEFAULT_MAP_FILTER: MapFilter = { videos: true, requests: true, tags: {}, equipmentCategories: [] };

/** 動画の投稿日を基準にした期間フィルタ（要件 4.2）。 */
export type PeriodFilter = 'all' | '1y' | '6m' | '3m' | '1m' | '2w' | 'today';
export type SeasonFilter = '1-3' | '4-6' | '7-9' | '10-12';
export type ResultLimit = 30 | 20 | 10;
/** 動画の長さ（要件 4.2）: 4 分未満・4 分以上 20 分未満・20 分以上 */
export type LengthFilter = 'all' | 'short' | 'medium' | 'long';

export interface RankingFilter {
  /** 動画の投稿日の範囲 */
  period: PeriodFilter;
  /** 動画の長さ。長さをまだ取っていないマーカーは、絞ると当たらない */
  length: LengthFilter;
  limit: ResultLimit;

  prefecture?: string;
  /** 動画の投稿月を四半期で絞る（要件 4.3 の地域別） */
  season?: SeasonFilter;

  /** 機器（分類 → メーカー → シリーズ → モデル）。空の段では絞らない */
  equipment?: Equipment;

  /** タグ（複数選択可）。撮影リクエストランキングは季節・時間帯・撮り方だけを使う */
  tags: TagSelection;
}

export const DEFAULT_RANKING_FILTER: RankingFilter = {
  period: 'all',
  length: 'all',
  limit: 30,
  tags: {},
};

/** 1 画面に載せる上限。これを超える分はフィルタで絞ってもらう。 */
export const RANKING_BASE_LIMIT = 100;

/** 地域別・機器別ランキングの 1 行（登録件数で競い、同じなら新しい順。ADR 0038）。 */
export interface GroupRankingRow {
  label: string;
  count: number;
  latestAt: number;
  sampleMarkerId: string;
  lat: number;
  lng: number;
}
