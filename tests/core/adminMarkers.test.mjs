/**
 * 管理者画面のマーカー管理とログ一覧の絞り込み（src/core/logic/adminMarkers.ts。T60）。
 * 実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let lib;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  lib = await vite.ssrLoadModule('/src/core/logic/adminMarkers.ts');
});
after(async () => { await vite.close(); });

const m = (id, ownerUid, createdBy, updatedAt, extra = {}) => ({ id, ownerUid, createdBy, updatedAt, createdAt: 0, deleted: false, ...extra });
const markers = [
  m('a1', 'alice', 'Alice', 1, { title: '富士山' }),
  m('a2', 'alice', 'Alice', 5),
  m('b1', 'bob', 'Bobby', 3),
  m('c1', 'carol', 'かろる', 4, { deleted: true }),
];

describe('postersMatching', () => {
  it('名前に含む投稿者を、大文字小文字を区別せず、マーカーの多い順に返す', () => {
    assert.deepEqual(lib.postersMatching(markers, 'b').map((r) => [r.ownerUid, r.count]), [['bob', 1]]);
    assert.deepEqual(lib.postersMatching(markers, '').map((r) => [r.ownerUid, r.count]), [['alice', 2], ['bob', 1]]);
    assert.deepEqual(lib.postersMatching(markers, 'ALI').map((r) => r.name), ['Alice']);
  });

  it('論理削除済みのマーカーしか無い人は出さない', () => {
    assert.deepEqual(lib.postersMatching(markers, 'かろる'), []);
  });
});

describe('markersOfOwner', () => {
  it('その人の未削除のマーカーを更新の新しい順に返す', () => {
    assert.deepEqual(lib.markersOfOwner(markers, 'alice').map((x) => x.id), ['a2', 'a1']);
  });
});

describe('logRows', () => {
  it('更新の新しい順に limit 件まで。total は切る前の件数', () => {
    const { rows, total } = lib.logRows(markers, '', 2);
    assert.deepEqual(rows.map((x) => x.id), ['a2', 'c1']);
    assert.equal(total, 4);
  });

  it('題名・投稿者名・ID・uid で絞れる', () => {
    assert.deepEqual(lib.logRows(markers, '富士', 10).rows.map((x) => x.id), ['a1']);
    assert.deepEqual(lib.logRows(markers, 'bob', 10).rows.map((x) => x.id), ['b1']);
  });
});
