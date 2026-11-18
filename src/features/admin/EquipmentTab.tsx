/**
 * 機器のタブ（T28・ADR 0025）。分類を選び、その中のメーカー・シリーズ・モデルを字下げの文章で直して保存する。
 * 分類そのものはコードで決める（ルールの validEquipment と同じ一覧）。
 * 保存先は equipmentMaster/{分類}。フォームが読む equipment.json には 3 時間ごとの機器の同期で入る（購読はしない）。
 * 「既定に戻す」は置かない（ADR 0025）。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { EquipmentDef } from '@/core/types';
import type { EditedEquipment } from '@/ports';
import { EQUIPMENT_CATEGORY_KEYS, equipmentCategoryLabel } from '@/core/constants/equipment';
import { countMakers, makersToText, textToMakers } from '@/core/logic/equipmentText';
import { formatDateTime, interpolate } from '@/core/logic/format';
import { useAdminI18n } from './useAdminI18n';
import { useServices } from '@/shared/hooks/useServices';
import { useToast } from '@/shared/components/Toast';

interface EquipmentTabProps {
  /** 公開中の機器マスタ（equipment.json）。直していない分類の中身に使う */
  equipment: EquipmentDef[];
}

export default function EquipmentTab({ equipment }: EquipmentTabProps) {
  const { adminStore } = useServices();
  const { t, lang } = useAdminI18n();
  const et = t.admin.equipment;
  const toast = useToast();
  const [edited, setEdited] = useState<Record<string, EditedEquipment> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(EQUIPMENT_CATEGORY_KEYS[0]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!adminStore) return;
    adminStore
      .editedEquipment()
      .then(setEdited)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [adminStore]);
  useEffect(load, [load]);

  const saved = useMemo(() => {
    const own = edited?.[category];
    return own ? own.makers : equipment.find((d) => d.category === category)?.makers ?? [];
  }, [edited, category, equipment]);
  // 分類を変えた・読み直したときは、保存済みの中身に戻す
  useEffect(() => setText(makersToText(saved)), [saved]);

  const parsed = useMemo(() => textToMakers(text), [text]);
  const counts = countMakers(parsed.makers);
  const dirty = text !== makersToText(saved);

  const run = async (task: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await task();
      toast.success(done);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!adminStore || parsed.problems.length) return;
    if (!window.confirm(interpolate(et.confirmSave, { category: equipmentCategoryLabel(category, lang), ...counts }))) return;
    void run(() => adminStore.saveEquipment(category, parsed.makers), et.saved);
  };

  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!edited) return <p className="text-xs text-gray-500">{t.details.loading}</p>;

  const own = edited[category];
  return (
    <div className="space-y-3 text-xs">
      <p className="text-gray-500">{et.note}</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={et.category}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1"
        >
          {EQUIPMENT_CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>
              {equipmentCategoryLabel(key, lang)}
              {edited[key] ? ` ${et.editedMark}` : ''}
            </option>
          ))}
        </select>
        <span className="text-gray-500">
          {own ? interpolate(et.editedAt, { at: formatDateTime(own.updatedAt) }) : et.fromDefault}
        </span>
      </div>
      <p className="text-gray-500">{et.format}</p>
      <textarea
        aria-label={et.text}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        rows={16}
        className="w-full rounded border border-gray-300 p-2 font-mono text-xs"
      />
      {parsed.problems.length > 0 ? (
        <ul className="space-y-0.5 text-red-600" role="alert">
          {parsed.problems.map((p) => (
            <li key={`${p.line}-${p.kind}`}>
              {interpolate(et.problems[p.kind], { line: p.line, name: p.name })}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">{interpolate(et.counts, counts)}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty || parsed.problems.length > 0}
          className="rounded bg-indigo-600 px-3 py-1.5 font-bold text-white disabled:opacity-40"
        >
          {et.save}
        </button>
        <button
          type="button"
          onClick={() => setText(makersToText(saved))}
          disabled={busy || !dirty}
          className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-40"
        >
          {et.discard}
        </button>
      </div>
    </div>
  );
}
