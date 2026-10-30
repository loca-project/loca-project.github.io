/**
 * マーカーの語の一致の検索（src/core/logic/search.ts）。
 * TypeScript と @/ の別名は Vite の ssrLoadModule で解決する。実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let s;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  s = await vite.ssrLoadModule('/src/core/logic/search.ts');
});
after(async () => { await vite.close(); });

const marker = (id, fields) => ({ id, lat: 35, lng: 139, tags: { subject: 'nature', mood: 'lively' }, ...fields });
// 本番に 1 件だけあったマーカー（2026-09-26）
const tomisato = marker('a', { title: 'Sample', channelTitle: '立神', prefecture: '千葉県', city: '富里市' });
const kyoto = marker('b', { title: '嵐山の竹林を歩く', channelTitle: 'kyoto walker', prefecture: '京都府', city: '京都市' });
const tokyo = marker('c', { title: 'Tokyo Tower night view', channelTitle: 'tower', prefecture: '東京都', city: '港区' });

describe('tokenize', () => {
  it('日本語は 2 文字ずつ、英数字は語のまま', () => {
    assert.deepEqual(s.tokenize('鹿児島'), ['鹿児', '児島']);
    assert.deepEqual(s.tokenize('Tokyo タワー'), ['tokyo', 'タワ', 'ワー']);
  });

  it('漢字に挟まれた助詞で区切り、ひらがなの語の中は区切らない', () => {
    assert.deepEqual(s.tokenize('千葉の富里'), ['千葉', '富里']);
    assert.deepEqual(s.tokenize('おにぎり'), ['おに', 'にぎ', 'ぎり']);
  });
});

describe('searchMarkersByText', () => {
  const all = [tomisato, kyoto, tokyo];

  it('「鹿児島県鹿屋市串良町」は、県・市の 1 文字だけでは当たらない（2026-09-26 の不具合）', () => {
    assert.deepEqual(s.searchMarkersByText(all, '鹿児島県鹿屋市串良町'), []);
  });

  it('地名・タイトル・チャンネル名の一致は当たる', () => {
    assert.deepEqual(s.searchMarkersByText(all, '富里').map((m) => m.id), ['a']);
    assert.deepEqual(s.searchMarkersByText(all, '千葉の富里').map((m) => m.id), ['a']);
    assert.deepEqual(s.searchMarkersByText(all, '嵐山').map((m) => m.id), ['b']);
    assert.deepEqual(s.searchMarkersByText(all, 'tokyo tower').map((m) => m.id), ['c']);
  });

  it('「京都駅」は、東京都の「京都」だけでは当たらない（一致率 0.5 は下限未満）', () => {
    assert.deepEqual(s.searchMarkersByText([tokyo], '京都駅'), []);
  });

  it('タグの語（日本語・英語）で当たる', () => {
    assert.equal(s.searchMarkersByText([tomisato], '賑やか').length, 1);
    assert.equal(s.searchMarkersByText([tomisato], 'lively').length, 1);
  });

  it('空の検索語はすべて返す', () => {
    assert.equal(s.searchMarkersByText(all, '  ').length, 3);
  });
});
