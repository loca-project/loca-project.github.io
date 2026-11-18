/** 未定義キーを日本語で埋めながら深くマージする（index.ts の辞書と adminPanel.ts の管理者の辞書で使う。T170）。 */
export function merge<T>(base: T, override: unknown): T {
  if (override == null || typeof override !== 'object') return base;
  const result = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    const current = result[key];
    if (current && typeof current === 'object' && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = merge(current, value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}
