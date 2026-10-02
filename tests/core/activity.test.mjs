/**
 * 最近のアクティビティ（src/core/logic/activity.ts。T80・ADR 0034）。
 * 実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let recentActivity;
let elapsed;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  ({ recentActivity, elapsed } = await vite.ssrLoadModule('/src/core/logic/activity.ts'));
});
after(async () => { await vite.close(); });

const marker = (id, createdAt, extra = {}) => ({
  id, createdAt, lat: 35, lng: 139, title: `題${id}`, createdBy: `人${id}`, prefecture: '東京都', city: '台東区', ...extra,
});
const spot = (id, entries) => ({ id, lat: 34, lng: 135, totalHeat: 0, requestCount: entries.length, updatedAt: 0,
  prefecture: '京都府', city: '京都市', entries });

describe('recentActivity', () => {
  it('動画と撮影リクエストを混ぜて新しい順に並べる', () => {
    const list = recentActivity(
      [marker('a', 100), marker('b', 300)],
      [spot('s1', [{ id: 'r1', heat: 3, ownerUid: 'u1', createdAt: 200 }])],
    );
    assert.deepEqual(list.map((x) => x.at), [300, 200, 100]);
    assert.deepEqual(list.map((x) => x.kind), ['video', 'request', 'video']);
  });
  it('論理削除した動画と、時刻の無いリクエストの内訳は出さない', () => {
    const list = recentActivity(
      [marker('a', 100, { deleted: true }), marker('b', 300)],
      [spot('s1', [{ id: 'r1', heat: 2 }, { id: 'r2', heat: 1, createdAt: 50 }])],
    );
    assert.deepEqual(list.map((x) => x.at), [300, 50]);
  });
  it('撮影リクエストの行は依頼した人を持たない（ADR 0034）', () => {
    const [item] = recentActivity([], [spot('s1', [{ id: 'r1', heat: 4, ownerUid: 'u1', createdAt: 10 }])]);
    assert.equal(JSON.stringify(item).includes('u1'), false);
    assert.equal(item.heat, 4);
    assert.equal(item.place, '京都府 京都市');
  });
  it('既定で 20 件まで', () => {
    const many = Array.from({ length: 30 }, (_, i) => marker(`m${i}`, i));
    const list = recentActivity(many, []);
    assert.equal(list.length, 20);
    assert.equal(list[0].at, 29);
  });
});

describe('elapsed', () => {
  const now = 10 * 86_400_000;
  it('1 分未満・分・時間・日に分ける', () => {
    assert.deepEqual(elapsed(now - 30_000, now), { unit: 'now', n: 0 });
    assert.deepEqual(elapsed(now - 5 * 60_000, now), { unit: 'minute', n: 5 });
    assert.deepEqual(elapsed(now - 3 * 3_600_000, now), { unit: 'hour', n: 3 });
    assert.deepEqual(elapsed(now - 2 * 86_400_000, now), { unit: 'day', n: 2 });
  });
  it('未来の時刻（端末の時計のずれ）は「たった今」', () => {
    assert.deepEqual(elapsed(now + 60_000, now), { unit: 'now', n: 0 });
  });
});
