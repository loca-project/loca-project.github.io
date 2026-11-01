/**
 * ユーザーのタブの集計（src/core/logic/people.ts。T88・T93・ADR 0031）。
 * TypeScript と @/ の別名は Vite の ssrLoadModule で解決する。実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let summarizePosters;
let rankPeople;
let DEFAULT_PEOPLE_FILTER;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  ({ summarizePosters, rankPeople, DEFAULT_PEOPLE_FILTER } = await vite.ssrLoadModule('/src/core/logic/people.ts'));
});
after(async () => { await vite.close(); });

const NO_EQ = { category: '', manufacturer: '', series: '', model: '' };
const marker = (id, ownerUid, createdBy, createdAt, extra = {}) => ({
  id, ownerUid, createdBy, createdAt, deleted: false, tags: { subject: 'nature', mood: 'calm' }, equipment: NO_EQ, ...extra,
});

// alice: 2 本（いいね 1・応えた 1）。bob: 1 本。carol: 3 本（いいね 9・応えた 3）。再生数は数えない（ADR 0038）
const MARKERS = [
  marker('a1', 'alice', 'アリス', 1, { youtube: { viewCount: 100 }, likes: 1, tags: { subject: 'townscape', mood: 'lively', season: 'spring' } }),
  marker('a2', 'alice', 'アリス', 5, { youtube: { viewCount: 50 }, answers: ['r1'] }),
  marker('b1', 'bob', 'Bob', 3, { youtube: { viewCount: 500 }, equipment: { ...NO_EQ, category: 'drone', manufacturer: 'DJI' } }),
  marker('c1', 'carol', 'キャロル', 9, { likes: 4, answers: ['r2', 'r3'] }),
  marker('c2', 'carol', 'キャロル', 7, { likes: 5, answers: ['r4'] }),
  marker('c3', 'carol', 'キャロル', 8),
  marker('c4', 'carol', 'キャロル', 2, { likes: 50, deleted: true }),
  marker('x1', undefined, '見本', 4, { youtube: { viewCount: 999 } }),
];

const rank = (patch) => rankPeople(MARKERS, { ...DEFAULT_PEOPLE_FILTER, ...patch }).map((p) => p.uid);

describe('summarizePosters', () => {
  it('投稿数・いいね・応えた撮影リクエストを数え、論理削除と ownerUid の無いものは数えない', () => {
    const rows = summarizePosters(MARKERS).sort((a, b) => a.uid.localeCompare(b.uid));
    assert.deepEqual(rows.map(({ uid, posts, likes, requests, latestAt }) => ({ uid, posts, likes, requests, latestAt })), [
      { uid: 'alice', posts: 2, likes: 1, requests: 1, latestAt: 5 },
      { uid: 'bob', posts: 1, likes: 0, requests: 0, latestAt: 3 },
      { uid: 'carol', posts: 3, likes: 9, requests: 3, latestAt: 9 },
    ]);
  });

  it('再生数の合計を持たない（規約 III.E.2・III.E.4.h。ADR 0038）', () => {
    assert.equal('views' in summarizePosters(MARKERS)[0], false);
  });

  it('名前はいちばん新しく登録したマーカーのもの', () => {
    const official = summarizePosters([marker('1', 'loca-official', 'Loca 運営', 9, { official: { provider: '霧島市', sourceUrl: 'https://example.com/' } }), marker('2', 'u', 'ふつう', 1)]);
    assert.deepEqual(official.map((r) => r.uid), ['u']); // 公式の紹介は投稿者に数えない（ADR 0036）
    const rows = summarizePosters([marker('1', 'u', '新しい名前', 9), marker('2', 'u', '古い名前', 1)]);
    assert.equal(rows[0].name, '新しい名前');
  });
});

describe('rankPeople', () => {
  it('既定は投稿数の順。ソート順を変えると、その値の多い順', () => {
    assert.deepEqual(rank({}), ['carol', 'alice', 'bob']);
    assert.deepEqual(rank({ order: 'likes' }), ['carol', 'alice', 'bob']);
    assert.deepEqual(rank({ order: 'requests' }), ['carol', 'alice', 'bob']);
  });

  it('タグ（項目の中は OR・間は AND）と撮影機器に当たる動画だけで数える', () => {
    assert.deepEqual(rank({ tags: { mood: ['lively'] } }), ['alice']);
    assert.deepEqual(rank({ tags: { season: ['spring', 'summer'], subject: ['townscape'] } }), ['alice']);
    assert.deepEqual(rank({ tags: { subject: ['nature'] } }), ['carol', 'alice', 'bob']);
    const [alice] = rankPeople(MARKERS, { ...DEFAULT_PEOPLE_FILTER, tags: { subject: ['nature'] }, name: 'アリス' });
    assert.equal(alice.posts, 1);
    assert.deepEqual(rank({ equipment: { ...NO_EQ, category: 'drone' } }), ['bob']);
    assert.deepEqual(rank({ equipment: { ...NO_EQ, category: 'drone', manufacturer: 'Sony' } }), []);
  });

  it('名前は大文字と小文字・全角と半角・空白を区別せずに部分一致', () => {
    assert.deepEqual(rank({ name: 'ＢＯ' }), ['bob']);
    assert.deepEqual(rank({ name: ' リス ' }), ['alice']);
    assert.deepEqual(rank({ name: 'りす' }), []);
  });
});
