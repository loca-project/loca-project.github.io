/**
 * ユーザーのタブ（T88・T93・ADR 0031）。名前・ソート順・タグ・撮影機器で条件を選び、「検索」で共通結果パネルに出す。
 * 部品と並びはランキングの絞り込み（RankingFilters）とそろえる。変えただけでは集計しない。
 */

import React from 'react';
import type { EquipmentDef } from '@/core/types';
import { TAG_CATEGORIES, type TagField } from '@/core/constants';
import { EMPTY_EQUIPMENT } from '@/core/logic/equipment';
import type { PeopleFilter, PosterOrder } from '@/core/logic/people';
import { Button, CheckboxGroup, Field, Select, TextInput } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';
import { chipOptions } from '@/features/tags/tagChips';
import EquipmentSelects from '@/features/equipment/EquipmentSelects';

/** ユーザーのタブで使うタグ（映っているもの・雰囲気・季節） */
const PEOPLE_TAG_FIELDS: TagField[] = ['subject', 'mood', 'season'];

interface PeoplePanelProps {
  filter: PeopleFilter;
  equipment: EquipmentDef[];
  loading: boolean;
  onChange: (patch: Partial<PeopleFilter>) => void;
  onSearch: () => void;
}

export default function PeoplePanel({ filter, equipment, loading, onChange, onSearch }: PeoplePanelProps) {
  const { t, lang } = useI18n();
  const pt = t.people;
  const orders: PosterOrder[] = ['posts', 'likes', 'requests'];

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
    >
      <Field label={pt.name}>
        <TextInput
          type="search"
          value={filter.name}
          placeholder={pt.placeholder}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>

      <Field label={pt.order}>
        <Select
          value={filter.order}
          options={orders.map((o) => ({ value: o, label: pt.orders[o] }))}
          onChange={(e) => onChange({ order: e.target.value as PosterOrder })}
        />
      </Field>

      <div className="flex flex-col gap-2 rounded border border-gray-100 bg-gray-50 p-2">
        <span className="text-[11px] font-bold text-gray-500">{t.filters.tags}</span>
        {TAG_CATEGORIES.filter((c) => PEOPLE_TAG_FIELDS.includes(c.field)).map((c) => (
          <div key={c.field}>
            <p className="mb-1 text-[10px] text-gray-400">{t.tags[c.field]}</p>
            <CheckboxGroup
              options={chipOptions(c, lang)}
              values={filter.tags[c.field] ?? []}
              onChange={(next) => onChange({ tags: { ...filter.tags, [c.field]: next } })}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded border border-loca-100 bg-loca-50 p-2">
        <span className="text-[11px] font-bold text-loca-700">{t.filters.equipmentFilter}</span>
        <EquipmentSelects
          defs={equipment}
          value={{ ...EMPTY_EQUIPMENT, ...filter.equipment }}
          mode="filter"
          onChange={(next) => onChange({ equipment: next })}
        />
      </div>

      <Button type="submit" disabled={loading}>
        <i className="fa-solid fa-magnifying-glass mr-1.5" />
        {pt.search}
      </Button>
      <p className="text-[10px] leading-relaxed text-gray-400">{pt.note}</p>
    </form>
  );
}
