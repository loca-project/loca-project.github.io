/**
 * 管理者画面の投稿動画・撮影リクエストの左の列: ニックネームで探し、投稿者を選ぶ（ADR 0019。メールは保存していない）。
 * 先頭の「すべての投稿者」は、探した名前に合う人の全員を対象にする（owner は null）。
 */

import React from 'react';
import type { PosterRow } from '@/core/logic/adminMarkers';
import { TextInput } from '@/shared/components/Controls';
import { useAdminI18n } from './useAdminI18n';

interface PosterPickerProps {
  query: string;
  posters: PosterRow[];
  owner: string | null;
  onQueryChange: (q: string) => void;
  onPick: (owner: string | null) => void;
}

export default function PosterPicker({ query, posters, owner, onQueryChange, onPick }: PosterPickerProps) {
  const { t } = useAdminI18n();
  const total = posters.reduce((sum, p) => sum + p.count, 0);
  const item = (key: string | null, name: string, count: number) => (
    <li key={key ?? '*'}>
      <button
        type="button"
        onClick={() => onPick(key)}
        className={`flex w-full justify-between rounded px-2 py-1.5 text-left text-xs ${
          owner === key ? 'bg-loca-50 font-bold text-loca-700' : 'hover:bg-gray-50'
        }`}
      >
        <span className="truncate">{name}</span>
        <span className="shrink-0 text-gray-400">{count}</span>
      </button>
    </li>
  );

  return (
    <section className="flex min-h-0 flex-col">
      <TextInput
        value={query}
        placeholder={t.admin.search}
        aria-label={t.admin.search}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      <ul className="mt-2 md:min-h-0 md:grow md:overflow-y-auto">
        {item(null, t.admin.allPosters, total)}
        {posters.slice(0, 30).map((p) => item(p.ownerUid, p.name, p.count))}
      </ul>
    </section>
  );
}
