/**
 * ログ一覧のタブ（要件 5.2.3・T60）。マーカーの登録・更新を、更新の新しい順に表で出す。
 * 元は地図の一覧（公開データ＋差分の購読）。論理削除したマーカーは一覧に無いので出ない。
 */

import React, { useMemo, useState } from 'react';
import type { MarkerData } from '@/core/types';
import { logRows } from '@/core/logic/adminMarkers';
import { formatDateTime, interpolate } from '@/core/logic/format';
import { TextInput } from '@/shared/components/Controls';
import { useAdminI18n } from './useAdminI18n';

const LIMIT = 200;

export default function LogsTab({ markers }: { markers: MarkerData[] }) {
  const { t } = useAdminI18n();
  const lt = t.admin.logs;
  const [query, setQuery] = useState('');
  const { rows, total } = useMemo(() => logRows(markers, query, LIMIT), [markers, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <div className="w-64">
          <TextInput value={query} placeholder={lt.search} aria-label={lt.search} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <p className="text-[11px] text-gray-500">{interpolate(lt.count, { shown: rows.length, total })}</p>
      </div>
      <div className="min-h-0 grow overflow-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-white text-gray-500">
            <tr>
              <th className="py-1 pr-3">{lt.updatedAt}</th>
              <th className="py-1 pr-3">{lt.createdAt}</th>
              <th className="py-1 pr-3">{lt.title}</th>
              <th className="py-1 pr-3">{lt.poster}</th>
              <th className="py-1 pr-3">{lt.markerId}</th>
              <th className="py-1">uid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-gray-50 text-gray-700">
                <td className="whitespace-nowrap py-1 pr-3">{formatDateTime(m.updatedAt)}</td>
                <td className="whitespace-nowrap py-1 pr-3">{formatDateTime(m.createdAt)}</td>
                <td className="max-w-[16rem] truncate py-1 pr-3">{m.title ?? '-'}</td>
                <td className="whitespace-nowrap py-1 pr-3">{m.createdBy}</td>
                <td className="py-1 pr-3 font-mono text-[10px] text-gray-400">{m.id}</td>
                <td className="py-1 font-mono text-[10px] text-gray-400">{m.ownerUid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
