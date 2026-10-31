/** 表示整形。ロケール差で壊れないよう用途を限定して持つ。 */

/** リンクの表示に使う宛先の名前。読めない URL は空文字（画面を落とさない）。 */
export function hostOf(url: string): string {
  return URL.canParse(url) ? new URL(url).host : '';
}

export function formatCount(n?: number): string {
  if (n == null) return '-';
  return n.toLocaleString('ja-JP');
}

export function formatDate(value?: string | number): string {
  if (!value) return '-';
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateTime(value?: string | number): string {
  if (!value) return '-';
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${formatDate(d.getTime())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 秒を 4:13 や 1:02:03 の形にする。 */
export function formatDuration(sec?: number): string {
  if (sec == null) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** テンプレート中の {key} を置換する。i18n の簡易差し込み用。 */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}