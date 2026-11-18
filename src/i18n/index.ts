/**
 * 言語の決定とリソースのマージ。
 * 要件 2.2: 既定は日本語。ブラウザの言語が英語なら英語にする。
 */

import type { LanguageCode } from '@/core/types';
import { ja, type Dictionary } from './ja';
import { merge } from './merge';

const STORAGE_KEY = 'loca.lang';

function detectLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ja' || saved === 'en') return saved;
  } catch {
    // localStorage が使えない環境ではブラウザ設定だけで判断する
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'ja';
  return nav.toLowerCase().startsWith('en') ? 'en' : 'ja';
}

/**
 * 日本語は同梱し、英語は使うときだけ読み込む（初期読み込みの JS を減らすため。T62）。
 * 読み込めるまでは日本語のまま動く。
 */
const dictionaries: Partial<Record<LanguageCode, Dictionary>> = { ja };

async function loadDictionary(lang: LanguageCode): Promise<void> {
  if (dictionaries[lang]) return;
  const { en } = await import('./en');
  dictionaries.en = merge(ja, en);
}

const initialLanguage = detectLanguage();
let currentLanguage: LanguageCode = 'ja';
/** 最後に頼まれた言語。読み込みの途中で別の言語が選ばれたら、古い方は反映しない。 */
let requestedLanguage: LanguageCode = 'ja';

/** 起動時の言語の辞書を読み込む。描画の前に待つ。読み込めなければ日本語で始める。 */
export async function prepareLanguage(): Promise<void> {
  if (initialLanguage === 'ja') return;
  try {
    await loadDictionary(initialLanguage);
    currentLanguage = initialLanguage;
    requestedLanguage = initialLanguage;
  } catch (error) {
    console.error(`[i18n] ${initialLanguage} の辞書を読み込めませんでした。日本語で表示します。`, error);
  }
}

/** 言語の変更を待つ部品。変えたら全員に知らせ、開いている画面をまとめて描き直させる。 */
const listeners = new Set<() => void>();

export function getLanguage(): LanguageCode {
  return currentLanguage;
}

/** 言語の変更を購読する（useSyncExternalStore 用）。解除する関数を返す。 */
export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLanguage(lang: LanguageCode): void {
  requestedLanguage = lang;
  if (lang === currentLanguage) return;
  loadDictionary(lang).then(
    () => {
      if (requestedLanguage === lang) applyLanguage(lang);
    },
    (error: unknown) => {
      console.error(`[i18n] ${lang} の辞書を読み込めませんでした。言語は切り替えません。`, error);
    },
  );
}

function applyLanguage(lang: LanguageCode): void {
  if (lang === currentLanguage) return;
  currentLanguage = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // 保存できなくても当該セッションでは切り替わる
  }
  listeners.forEach((l) => l());
}

export function t(): Dictionary {
  // currentLanguage は読み込み済みの言語にしか変わらない
  return dictionaries[currentLanguage] ?? ja;
}

export type { Dictionary };
