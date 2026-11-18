/**
 * 管理画面の useI18n（T170）。t.admin に管理画面の文言を足して返す。
 * 管理画面の辞書は初期読み込みに入れず、このフックを使う部品（遅延読み込みの管理画面）と一緒に読む。
 */

import { useMemo } from 'react';
import { adminPanel } from '@/i18n/adminPanel';
import { useI18n } from '@/shared/hooks/useI18n';

export function useAdminI18n() {
  const i18n = useI18n();
  const { t, lang } = i18n;
  const full = useMemo(() => ({ ...t, admin: { ...t.admin, ...adminPanel(lang) } }), [t, lang]);
  return { ...i18n, t: full };
}
