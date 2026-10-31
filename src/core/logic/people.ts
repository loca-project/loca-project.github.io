/**
 * ユーザーのタブ（T88・T93・ADR 0031）。地図の一覧（公開データ＋差分の購読）から投稿者ごとに集計する。
 * Firestore は読まない。探せるのは動画を投稿している人だけ（利用者の判断）。本人の判定は ownerUid（ADR 0019 決定 9）。
 * 絞り込み（名前・タグ・撮影機器）に当たる動画だけで数え、ソート順の多い順に並べる。
 */

import type { Equipment, MarkerData, TagSelection } from '@/core/types';
import { RANKING_BASE_LIMIT } from '@/core/types';
import { matchesEquipment, viewsOf } from './ranking';
import { matchesTags } from './tags';

/** 投稿者 1 人ぶん。 */
export interface PosterSummary {
  uid: string;
  /** 投稿者名。いちばん新しく登録したマーカーの createdBy（ニックネームに追従する。ADR 0019） */
  name: string;
  /** 当たった動画の本数（論理削除したものは数えない） */
  posts: number;
  /** その動画の再生数の合計（まだ取っていない動画は 0） */
  views: number;
  /** その動画が受け取った Loca のいいねの合計（毎晩の同期の値。T92） */
  likes: number;
  /** その動画で応えた撮影リクエストの件数（answers。ADR 0028） */
  requests: number;
  /** いちばん新しく登録した日時（epoch ms） */
  latestAt: number;
}

export type PosterOrder = 'posts' | 'views' | 'likes' | 'requests';

/** ユーザーのタブの条件。タグは映っているもの・雰囲気・季節だけを使う。 */
export interface PeopleFilter {
  /** 投稿者名の一部（空なら絞らない） */
  name: string;
  order: PosterOrder;
  tags: TagSelection;
  /** 空の段では絞らない */
  equipment?: Equipment;
}

export const DEFAULT_PEOPLE_FILTER: PeopleFilter = { name: '', order: 'posts', tags: {} };

/** 投稿者ごとにまとめる。ownerUid の無いマーカー（見本など）・論理削除・公式の紹介（ADR 0036）は入れない。 */
export function summarizePosters(markers: MarkerData[]): PosterSummary[] {
  const byUid = new Map<string, PosterSummary>();
  for (const m of markers) {
    if (!m.ownerUid || m.deleted || m.official) continue;
    const row = byUid.get(m.ownerUid) ?? {
      uid: m.ownerUid, name: m.createdBy, posts: 0, views: 0, likes: 0, requests: 0, latestAt: m.createdAt,
    };
    row.posts += 1;
    row.views += viewsOf(m);
    row.likes += m.likes ?? 0;
    row.requests += m.answers?.length ?? 0;
    if (m.createdAt >= row.latestAt) {
      row.latestAt = m.createdAt;
      row.name = m.createdBy;
    }
    byUid.set(m.ownerUid, row);
  }
  return [...byUid.values()];
}

/** 大文字と小文字、全角と半角、空白を区別しない形にそろえる。 */
export function normalizeName(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

/** 選んだ値の多い順。同じなら投稿数・再生数、さらに新しい順。 */
function compare(order: PosterOrder) {
  return (a: PosterSummary, b: PosterSummary) =>
    b[order] - a[order] || b.posts - a.posts || b.views - a.views || b.latestAt - a.latestAt;
}

/** 条件に当たる動画だけで投稿者ごとに数え、ソート順に RANKING_BASE_LIMIT 人まで。 */
export function rankPeople(markers: MarkerData[], f: PeopleFilter): PosterSummary[] {
  const hits = markers.filter((m) => matchesTags(m, f.tags) && matchesEquipment(m, f.equipment));
  const name = normalizeName(f.name);
  return summarizePosters(hits)
    .filter((p) => !name || normalizeName(p.name).includes(name))
    .sort(compare(f.order))
    .slice(0, RANKING_BASE_LIMIT);
}
