/**
 * ランキング集計。検索とは別プログラムとして維持する（要件 1.2 / 4.1）。
 *
 * 基準は Loca の登録件数。YouTube API の再生数は合計しない（規約 III.E.2・III.E.4.h。ADR 0038）。公式の紹介は数えない。
 * 投稿日をまだ取っていないマーカーは、登録日で代わりに数える。
 */

import type {
  GroupRankingRow,
  MarkerData,
  LengthFilter,
  PeriodFilter,
  RankingFilter,
  SeasonFilter,
} from '@/core/types';
import { RANKING_BASE_LIMIT } from '@/core/types';
import { hasTagSelection, matchesTags } from './tags';

const DAY = 24 * 60 * 60 * 1000;

const PERIOD_MS: Record<Exclude<PeriodFilter, 'all'>, number> = {
  '1y': 365 * DAY,
  '6m': 182 * DAY,
  '3m': 91 * DAY,
  '1m': 30 * DAY,
  '2w': 14 * DAY,
  today: 1 * DAY,
};

/** 動画の投稿日。まだ取っていなければ登録日（投稿は必ず登録より前なので、新しい側に寄るだけで済む）。 */
export const publishedAtOf = (m: MarkerData): number => m.youtube?.publishedAt ?? m.createdAt;

/** 動画の投稿日で絞る。 */
export function matchesPeriod(m: MarkerData, period: PeriodFilter, now = Date.now()): boolean {
  if (period === 'all') return true;
  return now - publishedAtOf(m) <= PERIOD_MS[period];
}

/** 動画の長さで絞る。長さをまだ取っていないマーカーは当たらない。 */
export function matchesLength(m: MarkerData, length: LengthFilter): boolean {
  if (length === 'all') return true;
  const sec = m.youtube?.durationSec;
  if (sec === undefined) return false;
  if (length === 'short') return sec < 240;
  if (length === 'medium') return sec >= 240 && sec < 1200;
  return sec >= 1200;
}

/** 動画の投稿月を四半期で絞る。 */
export function matchesSeason(m: MarkerData, season?: SeasonFilter): boolean {
  if (!season) return true;
  const month = new Date(publishedAtOf(m)).getMonth() + 1;
  const [from, to] = season.split('-').map(Number);
  return month >= from && month <= to;
}


/** 未選択（空文字）の項目はフィルタ対象外として扱う（要件 4.3）。 */
export function matchesEquipment(m: MarkerData, eq?: RankingFilter['equipment']): boolean {
  if (!eq) return true;
  if (eq.category && m.equipment?.category !== eq.category) return false;
  if (eq.manufacturer && m.equipment?.manufacturer !== eq.manufacturer) return false;
  if (eq.series && m.equipment?.series !== eq.series) return false;
  if (eq.model && m.equipment?.model !== eq.model) return false;
  return true;
}

/** 全共通フィルタを適用する（並び替え・件数制限はしない）。 */
export function applyFilters(markers: MarkerData[], f: RankingFilter, now = Date.now()): MarkerData[] {
  return markers.filter(
    (m) =>
      !m.deleted &&
      !m.official &&
      matchesPeriod(m, f.period, now) &&
      matchesLength(m, f.length ?? 'all') &&
      matchesTags(m, f.tags) &&
      matchesEquipment(m, f.equipment) &&
      matchesSeason(m, f.season) &&
      (!f.prefecture || m.prefecture === f.prefecture),
  );
}

export function byNewest(a: MarkerData, b: MarkerData): number {
  return b.createdAt - a.createdAt;
}

/** 登録が新しい順に limit 件。 */
export function rankMarkers(markers: MarkerData[], f: RankingFilter, now = Date.now()): MarkerData[] {
  return applyFilters(markers, f, now)
    .sort(byNewest)
    .slice(0, Math.min(f.limit, RANKING_BASE_LIMIT));
}

/** キーごとに登録件数を数え、多い順（同じなら新しい順）に並べる共通処理。 */
function groupBy(
  markers: MarkerData[],
  keyOf: (m: MarkerData) => string | undefined,
  limit: number,
): GroupRankingRow[] {
  const buckets = new Map<string, GroupRankingRow>();

  for (const m of markers) {
    const label = keyOf(m);
    if (!label) continue;
    const row = buckets.get(label);
    if (row) {
      row.count += 1;
      if (m.createdAt > row.latestAt) {
        row.latestAt = m.createdAt;
        row.sampleMarkerId = m.id;
        row.lat = m.lat;
        row.lng = m.lng;
      }
    } else {
      buckets.set(label, {
        label,
        count: 1,
        latestAt: m.createdAt,
        sampleMarkerId: m.id,
        lat: m.lat,
        lng: m.lng,
      });
    }
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count || b.latestAt - a.latestAt)
    .slice(0, Math.min(limit, RANKING_BASE_LIMIT));
}

/** 地域別ランキング: 都道府県ごとの登録件数（ADR 0038）。 */
export function rankPrefectures(markers: MarkerData[], f: RankingFilter, now = Date.now()) {
  return groupBy(applyFilters(markers, f, now), (m) => m.prefecture, f.limit);
}

/** 機器別ランキング: メーカー/シリーズ/モデルの組み合わせごとの登録件数（ADR 0038）。 */
export function rankEquipment(markers: MarkerData[], f: RankingFilter, now = Date.now()) {
  return groupBy(
    applyFilters(markers, f, now),
    (m) => [m.equipment?.manufacturer, m.equipment?.series, m.equipment?.model].filter(Boolean).join(' / '),
    f.limit,
  );
}

/** フィルタ適用中に件数制限の注記を出すべきか（要件 4.1）。 */
export function isLimitedByFilter(f: RankingFilter): boolean {
  return (
    f.period !== 'all' ||
    (f.length ?? 'all') !== 'all' ||
    hasTagSelection(f.tags) ||
    Boolean(f.prefecture) ||
    Boolean(f.season) ||
    Boolean(f.equipment?.category || f.equipment?.manufacturer)
  );
}
