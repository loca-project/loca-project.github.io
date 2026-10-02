/**
 * 最近のアクティビティ（T80・ADR 0034）。新しい保存先は作らず、画面が持っている動画と撮影リクエストの登録日時から作る。
 * いいねは出さない（ADR 0024）。撮影リクエストは依頼した人を持たせない（画面にも出していない）。
 */

import type { MarkerData } from '@/core/types/marker';
import type { RequestMarkerData } from '@/core/types/request';

export const ACTIVITY_LIMIT = 20;

export type ActivityItem =
  | { kind: 'video'; at: number; markerId: string; title: string; poster: string; place: string; lat: number; lng: number }
  | { kind: 'request'; at: number; spotId: string; heat: number; place: string; lat: number; lng: number };

const placeOf = (p: { prefecture?: string; city?: string }) => [p.prefecture, p.city].filter(Boolean).join(' ');

/** 新しい順に limit 件。論理削除した動画と、時刻の無いリクエストの内訳は飛ばす */
export function recentActivity(
  markers: MarkerData[],
  spots: RequestMarkerData[],
  limit = ACTIVITY_LIMIT,
): ActivityItem[] {
  const videos: ActivityItem[] = markers
    .filter((m) => !m.deleted && Number.isFinite(m.createdAt))
    .map((m) => ({
      kind: 'video',
      at: m.createdAt,
      markerId: m.id,
      title: m.title ?? '',
      poster: m.createdBy,
      place: placeOf(m),
      lat: m.lat,
      lng: m.lng,
    }));
  const requests: ActivityItem[] = spots.flatMap((s) =>
    (s.entries ?? [])
      .filter((e) => typeof e.createdAt === 'number' && Number.isFinite(e.createdAt))
      .map((e) => ({
        kind: 'request' as const,
        at: e.createdAt as number,
        spotId: s.id,
        heat: e.heat,
        place: placeOf(s),
        lat: s.lat,
        lng: s.lng,
      })),
  );
  return [...videos, ...requests].sort((a, b) => b.at - a.at).slice(0, limit);
}

/** 「いつ」の表示の単位。now から見た経過で選ぶ（未来の時刻は「たった今」） */
export function elapsed(at: number, now: number): { unit: 'now' | 'minute' | 'hour' | 'day'; n: number } {
  const min = Math.floor((now - at) / 60_000);
  if (min < 1) return { unit: 'now', n: 0 };
  if (min < 60) return { unit: 'minute', n: min };
  const hour = Math.floor(min / 60);
  if (hour < 24) return { unit: 'hour', n: hour };
  return { unit: 'day', n: Math.floor(hour / 24) };
}
