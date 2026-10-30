/**
 * 自分の投稿の一覧（src/core/logic/myPosts.ts。T53）。
 * TypeScript と @/ の別名は Vite の ssrLoadModule で解決する。実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let myMarkers;
let myRequestSpots;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  ({ myMarkers, myRequestSpots } = await vite.ssrLoadModule('/src/core/logic/myPosts.ts'));
});
after(async () => { await vite.close(); });

const marker = (id, ownerUid, createdAt, extra = {}) => ({ id, ownerUid, createdAt, createdBy: '同じ名前', deleted: false, ...extra });
const spot = (id, entries) => ({ id, lat: 35, lng: 135, totalHeat: 0, requestCount: entries?.length ?? 0, updatedAt: 0, entries });

describe('myMarkers', () => {
  it('本人の uid のマーカーだけを、新しく登録した順に返す（同じニックネームの他人は含めない）', () => {
    const rows = myMarkers([marker('a', 'alice', 1), marker('b', 'bob', 3), marker('c', 'alice', 2)], 'alice');
    assert.deepEqual(rows.map((m) => m.id), ['c', 'a']);
  });

  it('論理削除済みは含めない', () => {
    assert.deepEqual(myMarkers([marker('a', 'alice', 1, { deleted: true })], 'alice'), []);
  });
});

describe('myRequestSpots', () => {
  it('自分のリクエストがある地点だけを、自分の熱量・件数と一緒に新しい順で返す', () => {
    const rows = myRequestSpots([
      spot('s1', [{ id: 'r1', heat: 2, ownerUid: 'alice', createdAt: 10 }, { id: 'r2', heat: 5, ownerUid: 'bob', createdAt: 30 }]),
      spot('s2', [{ id: 'r3', heat: 1, ownerUid: 'bob', createdAt: 5 }]),
      spot('s3', [{ id: 'r4', heat: 1, ownerUid: 'alice', createdAt: 20 }, { id: 'r5', heat: 2, ownerUid: 'alice', createdAt: 25 }]),
    ], 'alice');
    assert.deepEqual(rows.map((r) => [r.spot.id, r.heat, r.count, r.latestAt]), [['s3', 3, 2, 25], ['s1', 2, 1, 10]]);
  });

  it('内訳の無い（古い形式の）地点は含めない', () => {
    assert.deepEqual(myRequestSpots([spot('s1', undefined)], 'alice'), []);
  });
});
