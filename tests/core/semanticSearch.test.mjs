/**
 * AI 検索の組み立て（src/core/logic/semanticSearch.ts。ADR 0033）。モデルは使わず、ベクトルを手で与える。
 * 実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let s;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  s = await vite.ssrLoadModule('/src/core/logic/semanticSearch.ts');
});
after(async () => { await vite.close(); });

const RULE = { minTop: 0.27, margin: 0.02, maxTags: 3 };
const score = (key, field, value) => ({ key, field, score: value });

describe('pickTags', () => {
  it('1 位が下限未満なら読み替えない（地名など。地名 25 語の 1 位は最大 0.268）', () => {
    assert.deepEqual(s.pickTags([score('townscape', 'subject', 0.164), score('fixed', 'style', 0.163)], RULE), []);
  });

  it('1 位から幅の中のタグを採り、外は採らない', () => {
    const ranked = [score('autumn', 'season', 0.40), score('nature', 'subject', 0.385), score('dreamy', 'mood', 0.37)];
    assert.deepEqual(s.pickTags(ranked, RULE).map((t) => t.key), ['autumn', 'nature']);
  });

  it('採るのは最大 maxTags 個', () => {
    const ranked = [0.40, 0.399, 0.398, 0.397].map((v, i) => score(`k${i}`, 'mood', v));
    assert.equal(s.pickTags(ranked, RULE).length, 3);
  });
});

describe('rankTags', () => {
  it('内積の大きい順に並べる', () => {
    const tags = [
      { key: 'a', field: 'mood', vector: [1, 0] },
      { key: 'b', field: 'mood', vector: [0, 1] },
    ];
    assert.deepEqual(s.rankTags([0.2, 0.9], tags).map((t) => t.key), ['b', 'a']);
  });
});

describe('searchMarkersWithTags', () => {
  const m = (id, title, tags) => ({ id, title, lat: 35, lng: 139, tags });
  const markers = [
    m('text', '紅葉の嵐山', { subject: 'nature', mood: 'calm' }),
    m('autumn', 'Sample', { subject: 'nature', mood: 'calm', season: 'autumn' }),
    m('both', 'Sample', { subject: 'heritage', mood: 'dreamy', season: 'autumn' }),
    m('none', 'Sample', { subject: 'food', mood: 'lively', season: 'summer' }),
  ];

  it('語の一致を先に、その後ろに読み替えたタグを持つ動画を並べる（重複なし）', () => {
    const tags = [score('autumn', 'season', 0.4)];
    assert.deepEqual(s.searchMarkersWithTags(markers, '紅葉', tags).map((x) => x.id), ['text', 'autumn', 'both']);
  });

  it('採ったタグを多く持つ動画を先に並べる', () => {
    const tags = [score('autumn', 'season', 0.4), score('dreamy', 'mood', 0.39)];
    assert.deepEqual(s.searchMarkersWithTags(markers, 'zzz', tags).map((x) => x.id), ['both', 'autumn']);
  });

  it('読み替えが無ければ語の一致だけ（無関係のタグの動画は出さない）', () => {
    assert.deepEqual(s.searchMarkersWithTags(markers, '鹿児島県鹿屋市串良町', []), []);
  });
});
