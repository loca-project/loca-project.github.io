/**
 * 管理者画面の「撮影リクエスト」タブ（要件 5.2.5）。左でニックネームから持ち主を探し、右は「自分の投稿」と同じ形の一覧
 * （1 行が 1 地点。行ごとに地図へ・取り下げ、チェックで選んで一括取り下げ・書き出し）。
 * 取り下げは論理削除で、持ち主の熱量はその分戻る（ルールが印の減算と一致を見る）。
 * リクエストはニックネームを持たないので、プロフィール（users）とマーカーの投稿者名から uid で引く。
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { MarkerData, RequestMarkerData } from '@/core/types';
import { requestPosters, requestSpotsOf, type AdminRequestSpot } from '@/core/logic/adminRequests';
import { formatDate, interpolate } from '@/core/logic/format';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useAdminI18n } from './useAdminI18n';
import { useServices } from '@/shared/hooks/useServices';
import { useToast } from '@/shared/components/Toast';
import { publishLocalChange } from '@/shared/localChanges';
import PostsToolbar, { useSelection } from '@/features/profile/PostsToolbar';
import PostRow from '@/features/profile/PostRow';
import { REQUEST_COLUMNS, requestExportRows, saveExport } from './exportData';
import PosterPicker from './PosterPicker';

interface RequestsTabProps {
  markers: MarkerData[];
  requestMarkers: RequestMarkerData[];
  onJump: (spot: RequestMarkerData) => void;
}

export default function RequestsTab({ markers, requestMarkers, onJump }: RequestsTabProps) {
  const { adminStore } = useServices();
  const { t } = useAdminI18n();
  const rt = t.admin.requests;
  const toast = useToast();
  const { loading, exclusive } = useExclusive();
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState<string | null>(null);
  const nameOf = useNicknames(markers, t.admin.unknownPoster);

  const posters = useMemo(() => requestPosters(requestMarkers, nameOf, query), [requestMarkers, nameOf, query]);
  const rows = useMemo(
    () => requestSpotsOf(requestMarkers, new Set(owner ? [owner] : posters.map((p) => p.ownerUid))),
    [requestMarkers, owner, posters],
  );
  const ids = useMemo(() => rows.map((r) => r.spot.id), [rows]);
  const selection = useSelection(ids);
  const picked = () => rows.filter((r) => selection.selected.includes(r.spot.id));
  const place = (s: RequestMarkerData) => [s.prefecture, s.city].filter(Boolean).join(' ') || '-';
  const owners = (r: AdminRequestSpot) => [...new Set(r.entries.map((e) => nameOf(e.ownerUid)))].join('・');

  /** 地点ごとの対象のリクエストを順に取り下げる（持ち主の熱量の印は 1 件ずつしか動かせない） */
  const withdraw = (targets: AdminRequestSpot[]) => {
    const entries = targets.flatMap((r) => r.entries);
    if (!adminStore || entries.length === 0) return;
    if (!window.confirm(interpolate(rt.confirmWithdraw, { count: targets.length, entries: entries.length }))) return;
    void exclusive(async () => {
      const done: string[] = [];
      try {
        for (const e of entries) {
          await adminStore.withdrawRequest({ id: e.id, heat: e.heat, ownerUid: e.ownerUid });
          done.push(e.id);
        }
        toast.success(interpolate(rt.withdrawn, { count: done.length }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        // 途中で止まっても、取り下げた分は購読を待たずに地図と一覧から外す
        publishLocalChange({ kind: 'requestEntries', ids: done });
      }
    });
  };

  const exportSelected = (format: 'csv' | 'json') => {
    const targets = new Set(owner ? [owner] : posters.map((p) => p.ownerUid));
    const spots = picked().map((r) => r.spot);
    saveExport('loca-requests', format, REQUEST_COLUMNS, requestExportRows(spots, (uid) => targets.has(uid)));
  };

  return (
    <div className="grid gap-4 md:h-full md:grid-cols-[16rem_1fr] md:grid-rows-[minmax(0,1fr)]">
      <PosterPicker query={query} posters={posters} owner={owner} onQueryChange={setQuery} onPick={setOwner} />
      <section className="flex min-h-0 min-w-0 flex-col">
        <PostsToolbar
          total={rows.length}
          selectedCount={selection.selected.length}
          busy={loading}
          deleteLabel={rt.withdrawSelected}
          onSelectAll={selection.setAll}
          onDelete={() => withdraw(picked())}
          onExport={exportSelected}
        />
        <p className="mb-1 text-[11px] text-gray-500">{rt.note}</p>
        {rows.length === 0 ? (
          <p className="mt-6 text-center text-xs text-gray-500">{rt.empty}</p>
        ) : (
          <ul className="md:min-h-0 md:grow md:overflow-y-auto">
            {rows.map((r) => (
              <PostRow
                key={r.spot.id}
                title={place(r.spot)}
                sub={`${owners(r)} ・ ${interpolate(rt.row, { heat: r.heat, count: r.entries.length })} ・ ${formatDate(r.latestAt)}`}
                checked={selection.isPicked(r.spot.id)}
                busy={loading}
                deleteLabel={rt.withdraw}
                onToggle={() => selection.toggle(r.spot.id)}
                onJump={() => onJump(r.spot)}
                onDelete={() => withdraw([r])}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * uid → ニックネーム。マーカーの投稿者名（いつもいまのニックネーム。ADR 0019）を先に使い、
 * 動画を出していない人はプロフィール（管理者だけが読める users）から引く。どちらにも無ければ unknown。
 */
function useNicknames(markers: MarkerData[], unknown: string): (uid: string) => string {
  const { adminStore } = useServices();
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!adminStore) return undefined;
    let cancelled = false;
    adminStore
      .users()
      .then((lists) => {
        if (cancelled) return;
        const rows = [...lists.admins, ...lists.users, ...lists.blacklist];
        setProfiles(new Map(rows.filter((r) => r.nickname).map((r) => [r.uid, r.nickname as string])));
      })
      .catch((e: unknown) => console.warn('[loca] ニックネームを読めませんでした', e));
    return () => {
      cancelled = true;
    };
  }, [adminStore]);

  return useMemo(() => {
    const fromMarkers = new Map(markers.filter((m) => m.ownerUid).map((m) => [m.ownerUid as string, m.createdBy]));
    return (uid: string) => fromMarkers.get(uid) ?? profiles.get(uid) ?? `${unknown} ${uid.slice(0, 6)}`;
  }, [markers, profiles, unknown]);
}
