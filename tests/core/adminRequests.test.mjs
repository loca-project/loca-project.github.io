/**
 * 管理者画面の撮影リクエストの絞り込み（src/core/logic/adminRequests.ts。要件 5.2.5）。
 * 実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let lib;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  lib = await vite.ssrLoadModule('/src/core/logic/adminRequests.ts');
});
after(async () => { await vite.close(); });

const e = (id, ownerUid, heat, createdAt) => ({ id, ownerUid, heat, createdAt });
const spots = [
  { id: 's1', lat: 35, lng: 139, totalHeat: 5, requestCount: 2, updatedAt: 0, entries: [e('r1', 'alice', 3, 10), e('r2', 'bob', 2, 20)] },
  { id: 's2', lat: 34, lng: 135, totalHeat: 1, requestCount: 1, updatedAt: 0, entries: [e('r3', 'alice', 1, 30)] },
  { id: 's3', lat: 33, lng: 130, totalHeat: 4, requestCount: 1, updatedAt: 0, entries: [{ id: 'old', heat: 4 }] },
];
const names = { alice: 'Alice', bob: 'Bobby' };
const nameOf = (uid) => names[uid] ?? uid;

describe('requestPosters', () => {
  it('持ち主ごとの件数を、多い順に返す（持ち主の無い古い行は数えない）', () => {
    assert.deepEqual(lib.requestPosters(spots, nameOf, ''), [
      { ownerUid: 'alice', name: 'Alice', count: 2 },
      { ownerUid: 'bob', name: 'Bobby', count: 1 },
    ]);
  });

  it('名前の一部で、大文字小文字を区別せずに絞る', () => {
    assert.deepEqual(lib.requestPosters(spots, nameOf, 'BOB').map((p) => p.ownerUid), ['bob']);
  });
});

describe('requestSpotsOf', () => {
  it('対象の人のリクエストがある地点だけを、その人の分の熱量と一緒に新しい順で返す', () => {
    const rows = lib.requestSpotsOf(spots, new Set(['alice']));
    assert.deepEqual(rows.map((r) => [r.spot.id, r.heat, r.entries.map((x) => x.id)]), [
      ['s2', 1, ['r3']],
      ['s1', 3, ['r1']],
    ]);
  });

  it('複数の人を対象にすると、同じ地点の両方のリクエストを含む', () => {
    const rows = lib.requestSpotsOf(spots, new Set(['alice', 'bob']));
    assert.deepEqual(rows.find((r) => r.spot.id === 's1').entries.map((x) => x.id), ['r1', 'r2']);
  });
});
