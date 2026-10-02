/**
 * サイドメニューのアイコン列（要件 2.3 / 2.4）。
 * 開閉アイコンもタブアイコンと同じサイズにして、視覚的な一貫性を保つ。
 */

import React from 'react';
import { TabMode } from '@/core/types';
import { useI18n } from '@/shared/hooks/useI18n';

type TabLabelKey = 'map' | 'people' | 'post' | 'request' | 'region' | 'gear' | 'activity';

export const TAB_ICONS: { mode: TabMode; icon: string; labelKey: TabLabelKey }[] = [
  // 並びは動線の順: 最近（ほかの人の動き。T80・ADR 0034） → 投稿 → 検索 → ユーザー → ランキング（リクエスト・地域・機器）。ユーザーはチャンネル別の代わり（T88・ADR 0031）
  { mode: TabMode.ACTIVITY, icon: 'fa-clock-rotate-left', labelKey: 'activity' },
  { mode: TabMode.POST, icon: 'fa-circle-plus', labelKey: 'post' },
  { mode: TabMode.MAP, icon: 'fa-magnifying-glass', labelKey: 'map' },
  { mode: TabMode.PEOPLE, icon: 'fa-user', labelKey: 'people' },
  { mode: TabMode.RANKING_REQUEST, icon: 'fa-fire', labelKey: 'request' },
  { mode: TabMode.RANKING_REGION, icon: 'fa-map', labelKey: 'region' },
  { mode: TabMode.RANKING_EQUIPMENT, icon: 'fa-camera', labelKey: 'gear' },
];

interface TabRailProps {
  current: TabMode;
  expanded: boolean;
  onSelect: (tab: TabMode) => void;
  onToggle: () => void;
}

const ICON_BUTTON = 'flex h-11 w-11 items-center justify-center rounded-lg text-lg transition';

export default function TabRail({ current, expanded, onSelect, onToggle }: TabRailProps) {
  const { t } = useI18n();
  const label = (key: TabLabelKey) => (key === 'activity' ? t.activity.tab : t.sidebar[key]);

  return (
    <nav
      className="z-40 flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3 shadow-sm"
      aria-label={t.sidebar.map}
    >
      <button
        type="button"
        onClick={onToggle}
        title={expanded ? t.sidebar.collapse : t.sidebar.expand}
        aria-label={expanded ? t.sidebar.collapse : t.sidebar.expand}
        className={`${ICON_BUTTON} mb-1 text-gray-500 hover:bg-gray-100`}
      >
        <i className={`fa-solid ${expanded ? 'fa-angles-left' : 'fa-bars'}`} />
      </button>

      {TAB_ICONS.map((tab) => {
        const active = current === tab.mode;
        return (
          <button
            key={tab.mode}
            type="button"
            onClick={() => onSelect(tab.mode)}
            title={label(tab.labelKey)}
            aria-label={label(tab.labelKey)}
            aria-current={active}
            className={`${ICON_BUTTON} ${
              active ? 'bg-loca-50 text-loca-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
          >
            <i className={`fa-solid ${tab.icon}`} />
          </button>
        );
      })}
    </nav>
  );
}
