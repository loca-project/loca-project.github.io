/**
 * 地図フィルタと選択中のマーカーの URL（src/core/logic/shareUrl.ts。T42）。
 * TypeScript と @/ の別名は Vite の ssrLoadModule で解決する。実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let decodeSharedView;
let encodeSharedView;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  ({ decodeSharedView, encodeSharedView } = await vite.ssrLoadModule('/src/core/logic/shareUrl.ts'));
});
after(async () => { await vite.close(); });

const DEFAULT = { videos: true, requests: true, tags: {}, equipmentCategories: [] };

describe('encodeSharedView', () => {
  it('既定の絞り込みでマーカーも無ければ空文字', () => {
    assert.equal(encodeSharedView({ filter: DEFAULT, markerId: null }), '');
  });

  it('タグ・機器・種類・マーカーを載せる（区切りのカンマはそのまま）', () => {
    const filter = { videos: true, requests: false, tags: { mood: ['calm', 'grand'], season: ['winter'] }, equipmentCategories: ['drone'] };
    assert.equal(
      encodeSharedView({ filter, markerId: 'abc_123' }),
      '?mood=calm,grand&season=winter&eq=drone&requests=0&m=abc_123',
    );
  });

  it('撮影リクエストは位置を小数 6 桁で載せる。マーカーがあればマーカーだけ（T84）', () => {
    assert.equal(encodeSharedView({ filter: DEFAULT, markerId: null, requestAt: { lat: 35.7095873, lng: 140.35 } }), '?r=35.709587,140.350000');
    assert.equal(encodeSharedView({ filter: DEFAULT, markerId: 'x', requestAt: { lat: 35, lng: 140 } }), '?m=x');
  });

  it('ほかのクエリは残し、扱うキーだけを書き換える', () => {
    assert.equal(encodeSharedView({ filter: DEFAULT, markerId: 'x' }, '?utm=a&mood=calm&m=old'), '?utm=a&m=x');
  });
});

describe('decodeSharedView', () => {
  it('書いたものを読むと元に戻る', () => {
    const view = {
      filter: { videos: false, requests: true, tags: { subject: ['nature'], mood: ['calm'] }, equipmentCategories: ['drone', 'action'] },
      markerId: 'm1',
      requestAt: null,
    };
    assert.deepEqual(decodeSharedView(encodeSharedView(view)), view);
  });

  it('何も無ければ既定の絞り込み', () => {
    assert.deepEqual(decodeSharedView(''), { filter: DEFAULT, markerId: null, requestAt: null });
  });

  it('撮影リクエストの位置を読む。範囲外・数でないものは読み飛ばす（T84）', () => {
    assert.deepEqual(decodeSharedView('?r=35.709587,140.350000').requestAt, { lat: 35.709587, lng: 140.35 });
    assert.equal(decodeSharedView('?r=95,140').requestAt, null);
    assert.equal(decodeSharedView('?r=abc,140').requestAt, null);
  });

  it('知らないキー・重複・不正なマーカー ID は読み飛ばす', () => {
    const view = decodeSharedView('?mood=calm,unknown,calm&eq=drone,spaceship&m=<script>');
    assert.deepEqual(view.filter.tags, { mood: ['calm'] });
    assert.deepEqual(view.filter.equipmentCategories, ['drone']);
    assert.equal(view.markerId, null);
  });
});
