/**
 * 撮影リクエストへの回答（src/core/logic/answers.ts。T43・ADR 0028）。
 * 実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let lib;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  lib = await vite.ssrLoadModule('/src/core/logic/answers.ts');
});
after(async () => { await vite.close(); });

// 受け取りの待ち（3 時間）を超える時間
const DAY = 4 * 3_600_000;
const e = (id, ownerUid, createdAt) => ({ id, ownerUid, heat: 1, createdAt });
const spot = (id, entries) => ({ id, lat: 35, lng: 139, totalHeat: entries.length, requestCount: entries.length, updatedAt: 0, entries });
// 地点（35, 139）の近くに置く。遠い動画・リクエストより前の動画は届いたことにしない（ルールの answerable と同じ）
const marker = (id, ownerUid, answers, createdAt, deleted = false, lat = 35.001) => ({ id, ownerUid, answers, createdAt, deleted, lat, lng: 139 });

describe('answerTargets', () => {
  it('自分のリクエストと持ち主の無い古い行を除き、新しい順に返す', () => {
    const s = spot('s1', [e('r1', 'alice', 10), e('r2', 'me', 20), e('r3', 'bob', 30), { id: 'old', heat: 1 }]);
    assert.deepEqual(lib.answerTargets(s, 'me', 40 + DAY), ['r3', 'r1']);
  });

  it('出してから 3 時間たっていないリクエストは除く（いま登録しても受け取れない）', () => {
    const s = spot('s1', [e('r1', 'alice', 10), e('r3', 'bob', 30)]);
    assert.deepEqual(lib.answerTargets(s, 'me', 20 + lib.ANSWER_WAIT_MS), ['r1']);
  });

  it('上限（10 件）までに切る', () => {
    const s = spot('s1', Array.from({ length: 12 }, (_, i) => e(`r${i}`, 'alice', i)));
    assert.equal(lib.answerTargets(s, 'me', 100 + DAY).length, lib.MAX_ANSWERS);
  });
});

describe('deliveredAnswers', () => {
  const spots = [spot('s1', [e('r1', 'me', 1), e('r2', 'alice', 2)]), spot('s2', [e('r3', 'me', 3)])];

  it('自分のリクエストに応えた、ほかの人の動画だけを出す', () => {
    const markers = [
      marker('m1', 'bob', ['r1', 'r2'], 100 + DAY),
      marker('m2', 'me', ['r3'], 200 + DAY),
      marker('m3', 'carol', ['r3'], 300 + DAY, true),
      marker('m4', 'carol', ['r1'], 400 + DAY),
    ];
    const rows = lib.deliveredAnswers(markers, spots, 'me');
    assert.deepEqual(rows.map((r) => [r.entry.id, r.markers.map((m) => m.id)]), [['r1', ['m4', 'm1']]]);
  });

  it('遠い動画と、リクエストから 3 時間たたずに登録された動画は出さない', () => {
    const markers = [marker('m1', 'bob', ['r1'], 100 + DAY, false, 36), marker('m2', 'bob', ['r3'], 100)];
    assert.deepEqual(lib.deliveredAnswers(markers, spots, 'me'), []);
  });

  it('届いていなければ空', () => {
    assert.deepEqual(lib.deliveredAnswers([marker('m1', 'bob', ['zz'], 1)], spots, 'me'), []);
  });
});
