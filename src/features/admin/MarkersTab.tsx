/**
 * 管理者画面の「投稿動画」タブ（要件 5.2.5・T60）。左でニックネームから投稿者を探し、右は「自分の投稿」と同じ形の一覧
 * （行ごとに地図へ・削除、チェックで選んで一括削除・書き出し）。削除は論理削除だけ（ADR 0021）。
 * 書き出しは旧「データエクスポート」タブの代わり（「すべての投稿者」で全件を選べば全件を書き出せる）。
 * 消したマーカーは shared/localChanges.ts の知らせですぐ一覧から外す（ほかの人の画面には差分の購読で届く。ADR 0013）。
 */

import React, { useMemo, useState } from 'react';
import type { MarkerData } from '@/core/types';
import { markersOfOwner, postersMatching } from '@/core/logic/adminMarkers';
import { formatDate, interpolate } from '@/core/logic/format';
import { tagLabel } from '@/core/constants';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useAdminI18n } from './useAdminI18n';
import { useServices } from '@/shared/hooks/useServices';
import { useToast } from '@/shared/components/Toast';
import { publishLocalChange } from '@/shared/localChanges';
import PostsToolbar, { useSelection } from '@/features/profile/PostsToolbar';
import PostRow from '@/features/profile/PostRow';
import { MARKER_COLUMNS, markerExportRows, saveExport } from './exportData';
import PosterPicker from './PosterPicker';

interface MarkersTabProps {
  markers: MarkerData[];
  onJump: (marker: MarkerData) => void;
}

export default function MarkersTab({ markers, onJump }: MarkersTabProps) {
  const { adminStore } = useServices();
  const { t, lang } = useAdminI18n();
  const mt = t.admin.markers;
  const toast = useToast();
  const { loading, exclusive } = useExclusive();
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState<string | null>(null);

  const posters = useMemo(() => postersMatching(markers, query), [markers, query]);
  // 「すべての投稿者」は、探した名前に合う人の全員（名前が空なら全件）
  const list = useMemo(() => {
    const uids = owner ? [owner] : posters.map((p) => p.ownerUid);
    return uids.flatMap((uid) => markersOfOwner(markers, uid)).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [markers, owner, posters]);
  const ids = useMemo(() => list.map((m) => m.id), [list]);
  const selection = useSelection(ids);
  const place = (m: MarkerData) => [m.prefecture, m.city].filter(Boolean).join(' ') || '-';

  const remove = (targets: string[]) => {
    if (!adminStore || targets.length === 0) return;
    if (!window.confirm(interpolate(mt.confirmDelete, { count: targets.length }))) return;
    void exclusive(async () => {
      try {
        const count = await adminStore.softDeleteMarkers(targets);
        publishLocalChange({ kind: 'markers', ids: targets });
        toast.success(interpolate(mt.deleted, { count }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const exportSelected = (format: 'csv' | 'json') => {
    const picked = list.filter((m) => selection.selected.includes(m.id));
    saveExport('loca-markers', format, MARKER_COLUMNS, markerExportRows(picked));
  };

  return (
    <div className="grid gap-4 md:h-full md:grid-cols-[16rem_1fr] md:grid-rows-[minmax(0,1fr)]">
      <PosterPicker query={query} posters={posters} owner={owner} onQueryChange={setQuery} onPick={setOwner} />
      <section className="flex min-h-0 min-w-0 flex-col">
        <PostsToolbar
          total={list.length}
          selectedCount={selection.selected.length}
          busy={loading}
          deleteLabel={mt.deleteSelected}
          onSelectAll={selection.setAll}
          onDelete={() => remove(selection.selected)}
          onExport={exportSelected}
        />
        <p className="mb-1 text-[11px] text-gray-500">{mt.note}</p>
        {list.length === 0 ? (
          <p className="mt-6 text-center text-xs text-gray-500">{mt.empty}</p>
        ) : (
          <ul className="md:min-h-0 md:grow md:overflow-y-auto">
            {list.map((m) => (
              <PostRow
                key={m.id}
                title={m.title ?? m.youtubeUrl}
                sub={`${m.createdBy} ・ ${place(m)} ・ ${tagLabel(m.tags?.mood, lang) || '-'} ・ ${formatDate(m.updatedAt)}`}
                checked={selection.isPicked(m.id)}
                busy={loading}
                deleteLabel={mt.delete}
                onToggle={() => selection.toggle(m.id)}
                onJump={() => onJump(m)}
                onDelete={() => remove([m.id])}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
