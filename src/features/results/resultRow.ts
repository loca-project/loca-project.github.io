/**
 * 共通結果パネルが扱う行の形。
 * マーカー検索・各ランキング・リクエスト一覧をこの 1 形式に正規化して渡す。
 */

import type {
  GroupRankingRow,
  LatLng,
  MarkerData,
  RequestMarkerData,
} from '@/core/types';
import { formatCount, formatDate, interpolate } from '@/core/logic/format';

export interface ResultRow {
  id: string;
  title: string;
  subtitle?: string;
  /** 右端に出す指標（件数・登録日・熱量など） */
  metric: string;
  /** 共有できるマーカーの ID（行の「共有」で、このマーカーを開く URL をコピーする） */
  markerId?: string;
  position?: LatLng;
  thumbnailUrl?: string;
  /** ユーザーの行（T93）。押すと公開プロフィールを開く。地図へ・共有のボタンは出さない */
  poster?: { uid: string; name: string };
}

export function rowsFromMarkers(markers: MarkerData[]): ResultRow[] {
  return markers.map((m) => ({
    id: m.id,
    title: m.title ?? m.youtubeUrl,
    subtitle: [m.channelTitle, m.prefecture, m.city].filter(Boolean).join(' / '),
    metric: formatDate(m.createdAt),
    markerId: m.id,
    position: { lat: m.lat, lng: m.lng },
    thumbnailUrl: m.thumbnailUrl,
  }));
}

/** 地域別・機器別ランキング（登録件数で競う。ADR 0038）。countLabel は辞書の文言（`{count}` を置き換える） */
export function rowsFromGroups(groups: GroupRankingRow[], countLabel: string): ResultRow[] {
  return groups.map((g) => ({
    id: g.label,
    title: g.label,
    subtitle: formatDate(g.latestAt),
    metric: interpolate(countLabel, { count: formatCount(g.count) }),
    position: { lat: g.lat, lng: g.lng },
  }));
}

export function rowsFromRequestMarkers(markers: RequestMarkerData[], countLabel: string): ResultRow[] {
  return markers.map((m) => ({
    id: m.id,
    title: [m.prefecture, m.city].filter(Boolean).join(' ') || `${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}`,
    subtitle: interpolate(countLabel, { count: formatCount(m.requestCount) }),
    metric: `🔥 ${formatCount(m.totalHeat)}`,
    position: { lat: m.lat, lng: m.lng },
  }));
}
