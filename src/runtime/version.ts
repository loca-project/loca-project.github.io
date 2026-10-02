/**
 * 新しい版の公開に気づき、開いたままの古いタブに再読み込みを促す（T56・ADR 0022）。
 *
 * 本番はルールを先に反映してからコードを公開するので、公開前に開いたタブは新しいルールに書き込みを拒否されうる。
 * ビルドが書く version.json（入口の JS のファイル名）と、このタブが読み込んだ入口を比べ、違えば帯で知らせる。
 * 比べるのは、一定の間隔・タブに戻ったとき・書き込みが権限で拒否されたとき。
 */

import { setHealth } from './health';

/** 定期的に比べる間隔。GitHub Pages の index.html のキャッシュ（10 分）と同じにする */
const INTERVAL_MS = 10 * 60 * 1000;
/** タブに戻るたびに取りにいかないよう、前回から空ける時間 */
const MIN_GAP_MS = 60 * 1000;

let lastChecked = 0;
let started = false;

/** このタブが読み込んだ入口の JS の URL。開発サーバー（/src/main.tsx）と、ブラウザの外（アダプタのテスト）では null */
function loadedEntry(): string | null {
  if (typeof document === 'undefined') return null;
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]');
  for (const s of scripts) {
    if (/\/assets\/[^/]+\.js$/.test(new URL(s.src, document.baseURI).pathname)) return s.src;
  }
  return null;
}

/** 公開中の版と比べ、新しければ帯を出す。取れなかったときは何もしない（次の機会に比べ直す）。 */
export async function checkForUpdate(): Promise<void> {
  const loaded = loadedEntry();
  if (!loaded) return;
  lastChecked = Date.now();
  try {
    // 応答しないときは次の機会に比べ直す（上限が無いと確認が終わらない。T103）
    const res = await fetch(new URL('version.json', document.baseURI), { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn(`[loca] version.json が ${res.status} を返しました`);
      return;
    }
    const { entry } = (await res.json()) as { entry?: string };
    if (entry && !new URL(loaded).pathname.endsWith(`/${entry}`)) setHealth({ updateAvailable: true });
  } catch (e) {
    console.warn('[loca] 公開中の版を確かめられませんでした', e);
  }
}

/** 定期的な確認と、タブに戻ったときの確認を始める。二度呼んでも 1 つだけ動く。 */
export function startVersionWatch(): void {
  if (started || !loadedEntry()) return;
  started = true;
  window.setInterval(() => void checkForUpdate(), INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastChecked >= MIN_GAP_MS) void checkForUpdate();
  });
}
