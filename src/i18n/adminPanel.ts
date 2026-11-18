/**
 * 管理画面の辞書（T170）。管理画面（React.lazy の AdminDashboard）からだけ import し、初期読み込みに入れない。
 * 管理画面の外でも使う文言は ja.ts / en.ts の admin にあり、ここで足し合わせる。
 */

import type { LanguageCode } from '@/core/types';
import { adminJa } from './admin.ja';
import { adminEn } from './admin.en';
import { merge } from './merge';

export type AdminPanelDictionary = typeof adminJa;

const panels: Record<LanguageCode, AdminPanelDictionary> = { ja: adminJa, en: merge(adminJa, adminEn) };

export function adminPanel(lang: LanguageCode): AdminPanelDictionary {
  return panels[lang];
}
