/**
 * 管理者画面のユーザー管理の絞り込み（src/core/logic/adminUsers.ts。T74）。
 * 実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let lib;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  lib = await vite.ssrLoadModule('/src/core/logic/adminUsers.ts');
});
after(async () => { await vite.close(); });

const rows = [
  { uid: 'uidAAA111', nickname: 'Hanako', createdAt: 3 },
  { uid: 'uidBBB222', nickname: '山の写真家', createdAt: 2 },
  { uid: 'uidCCC333', nickname: null, createdAt: 0 },
];
const ids = (list) => list.map((r) => r.uid);

describe('usersMatching', () => {
  it('空白だけの検索語なら全件を同じ並びで返す', () => {
    assert.deepEqual(ids(lib.usersMatching(rows, '  ')), ['uidAAA111', 'uidBBB222', 'uidCCC333']);
  });
  it('ニックネームの一部で、大文字小文字を区別せずに絞る', () => {
    assert.deepEqual(ids(lib.usersMatching(rows, 'hana')), ['uidAAA111']);
    assert.deepEqual(ids(lib.usersMatching(rows, '写真')), ['uidBBB222']);
  });
  it('uid の一部でも絞れる（プロフィールの無い行も uid で探せる）', () => {
    assert.deepEqual(ids(lib.usersMatching(rows, 'ccc3')), ['uidCCC333']);
  });
  it('当たらなければ空', () => {
    assert.deepEqual(lib.usersMatching(rows, 'zzz'), []);
  });
});
