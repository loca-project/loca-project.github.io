/** 統計分析（要件 5.2.1）。投稿日で期間を絞り、タグと機器の内訳を出す。 */

import React, { useMemo, useState } from 'react';
import type { MarkerData } from '@/core/types';
import { computeStatistics, withinRegisteredRange } from '@/core/logic/statistics';
import { TAG_FIELDS, equipmentCategoryLabel, tagLabel } from '@/core/constants';
import { Field, TextInput } from '@/shared/components/Controls';
import { useAdminI18n } from './useAdminI18n';
import BarList from '@/shared/components/BarList';

export default function StatisticsTab({ markers }: { markers: MarkerData[] }) {
  const { t, lang } = useAdminI18n();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const stats = useMemo(
    () => computeStatistics(withinRegisteredRange(markers, from || undefined, to || undefined)),
    [markers, from, to],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Field label={t.admin.periodFrom}>
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
        </div>
        <div className="w-40">
          <Field label={t.admin.periodTo}>
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <p className="pb-2 text-[11px] text-gray-500">
          {t.admin.total}: <span className="font-mono font-bold text-gray-800">{stats.total}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {TAG_FIELDS.map((field) => (
          <BarList
            key={field}
            title={t.tags[field]}
            rows={stats.tags[field].map((r) => ({ ...r, label: tagLabel(r.label, lang) }))}
          />
        ))}
        <BarList
          title={t.form.category}
          rows={stats.equipmentCategory.map((r) => ({ ...r, label: equipmentCategoryLabel(r.label, lang) }))}
        />
        <BarList title={t.form.maker} rows={stats.manufacturer} />
        <BarList title={t.form.series} rows={stats.series} />
        <BarList title={t.form.model} rows={stats.model} />
        <BarList title={t.filters.prefecture} rows={stats.prefecture} />
        <BarList title={t.results.channel} rows={stats.channel} />
      </div>
    </div>
  );
}
