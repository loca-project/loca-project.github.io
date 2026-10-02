/**
 * 最近のアクティビティ（T80・ADR 0034）。新しい順の一覧で、行を押すと地図がその場所へ寄って情報を開く。
 * いいねは出さず（ADR 0024）、撮影リクエストは依頼した人を出さない。
 */

import React from 'react';
import { elapsed, type ActivityItem } from '@/core/logic/activity';
import { interpolate } from '@/core/logic/format';
import { useI18n } from '@/shared/hooks/useI18n';

interface ActivityPanelProps {
  items: ActivityItem[];
  /** 「いつ」の基準の時刻（epoch ms） */
  now: number;
  onSelect: (item: ActivityItem) => void;
}

export default function ActivityPanel({ items, now, onSelect }: ActivityPanelProps) {
  const { t } = useI18n();
  const at = t.activity;

  if (items.length === 0) return <p className="text-xs text-gray-500">{at.empty}</p>;

  const when = (time: number) => {
    const e = elapsed(time, now);
    return e.unit === 'now' ? at.now : interpolate(at[e.unit], { n: e.n });
  };

  return (
    <ul className="flex flex-col gap-1" aria-label={at.title}>
      {items.map((item) => (
        <li key={`${item.kind}-${item.kind === 'video' ? item.markerId : item.spotId}-${item.at}`}>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-gray-50"
          >
            <i
              aria-hidden
              className={`fa-solid mt-0.5 w-4 shrink-0 text-center text-xs ${
                item.kind === 'video' ? 'fa-video text-loca-600' : 'fa-fire text-orange-500'
              }`}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-bold text-gray-800">
                {item.kind === 'video' ? item.title || item.place || at.noPlace : item.place || at.noPlace}
              </span>
              <span className="truncate text-[11px] text-gray-500">
                {item.kind === 'video'
                  ? interpolate(at.video, { poster: item.poster })
                  : interpolate(at.request, { heat: item.heat })}
              </span>
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-gray-400">{when(item.at)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
