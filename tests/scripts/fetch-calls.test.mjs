/**
 * fetch の待ち時間の上限の検査（scripts/lib/fetch-calls.mjs。verify の 1d。T103）。
 * 実行: npm run test:scripts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchCalls, fetchCallsWithoutSignal } from '../../scripts/lib/fetch-calls.mjs';

describe('fetchCallsWithoutSignal', () => {
  it('signal の無い fetch を行番号で返す（陽性）', () => {
    const src = ['const a = 1;', 'const res = await fetch(url);', 'await fetch(build(id), { cache: "no-cache" });'].join('\n');
    assert.deepEqual(fetchCallsWithoutSignal(src), [2, 3]);
  });

  it('signal を渡した fetch は通す。入れ子の括弧と複数行の引数も読む（陰性）', () => {
    const src = [
      'await fetch(new URL("a.json", base), { signal: AbortSignal.timeout(10_000) });',
      'await fetch(url, {',
      '  headers: { Accept: "application/json" },',
      '  signal: AbortSignal.timeout(ms),',
      '});',
    ].join('\n');
    assert.deepEqual(fetchCallsWithoutSignal(src), []);
    assert.equal(fetchCalls(src).length, 2);
  });

  it('コメントの中・別名の関数（prefetch・obj.fetch）は数えない', () => {
    const src = ['// fetch(url) は上限を付ける', ' * fetch(url) の説明', 'prefetch(x);', 'store.fetch(y);'].join('\n');
    assert.equal(fetchCalls(src).length, 0);
  });
});
