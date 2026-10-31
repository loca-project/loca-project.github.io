/** 切り替えの部品。呼び出し元は Controls から import する。 */

import React from 'react';
import { CONTROL, PILL } from './controlStyles';

/**
 * 地図の上に浮かせる切り替えチップ（地図フィルタ。ADR 0015）。
 * color はマーカーと同じ色の印（凡例を兼ねる）、badge は有効な条件の数。
 */
export function ToggleChip({
  active,
  label,
  color,
  icon,
  badge,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active: boolean;
  label: string;
  color?: string;
  icon?: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...rest}
      className={`inline-flex ${PILL} shrink-0 items-center gap-1.5 whitespace-nowrap border px-3 text-xs shadow-sm transition ${
        active ? 'border-loca-500 bg-loca-50 font-bold text-loca-700' : 'border-gray-200 bg-white/95 text-gray-600 hover:border-gray-400'
      } ${className}`}
    >
      {icon && <i aria-hidden className={icon} />}
      {color && <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
      {label}
      {badge ? <span className="rounded-full bg-loca-500 px-1.5 text-[10px] text-white">{badge}</span> : null}
    </button>
  );
}

/** 2〜3 択の切り替え（地図／マーカー、投稿／リクエストなど）。 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" className={`grid ${CONTROL} overflow-hidden border border-gray-300 text-xs`} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`font-bold transition disabled:text-gray-300 ${
            value === o.value ? 'bg-loca-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
