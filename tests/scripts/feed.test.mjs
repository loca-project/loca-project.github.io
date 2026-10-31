/**
 * 新着マーカーの RSS（scripts/lib/feed.mjs。T47）。通信しないので、エミュレータなしで走る。
 * 実行: npm run test:scripts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FEED_LIMIT, buildFeed } from '../../scripts/lib/feed.mjs';

const marker = (id, createdAt, over = {}) => ({
  id, title: `題名 ${id}`, createdAt, prefecture: '東京都', city: '台東区', createdBy: 'たろう', ...over,
});
const itemIds = (xml) => [...xml.matchAll(/<guid[^>]*>loca-marker-([^<]+)<\/guid>/g)].map((m) => m[1]);

describe('buildFeed', () => {
  it('新しく登録された順に並べ、リンクは地図の共有 URL にする', () => {
    const { xml, items } = buildFeed({ markers: [marker('a', 1000), marker('b', 3000), marker('c', 2000)], siteUrl: 'https://example.test/' });
    assert.equal(items, 3);
    assert.deepEqual(itemIds(xml), ['b', 'c', 'a']);
    assert.match(xml, /<link>https:\/\/example\.test\/\?m=b<\/link>/);
    assert.match(xml, /<atom:link href="https:\/\/example\.test\/feed\.xml" rel="self"/);
  });

  it(`載せるのは新しい ${FEED_LIMIT} 件まで`, () => {
    const many = Array.from({ length: FEED_LIMIT + 5 }, (_, i) => marker(`m${i}`, i));
    const { xml, items } = buildFeed({ markers: many });
    assert.equal(items, FEED_LIMIT);
    assert.equal(itemIds(xml)[0], `m${FEED_LIMIT + 4}`);
  });

  it('記号と制御文字をエスケープし、論理削除の行は載せない', () => {
    const { xml, items } = buildFeed({
      markers: [marker('x', 5, { title: '<script>&"\'\u0001', memo: 'A & B' }), marker('y', 6, { deleted: true })],
    });
    assert.equal(items, 1);
    assert.match(xml, /<title>&lt;script&gt;&amp;&quot;&apos;<\/title>/);
    assert.match(xml, /東京都 台東区 \/ A &amp; B \/ 投稿: たろう/);
  });

  it('公式の紹介は、投稿者ではなく提供元を出す（ADR 0036）', () => {
    const { xml } = buildFeed({ generatedAt: 0, markers: [{ id: 'm', title: 'x', youtubeUrl: 'https://www.youtube.com/watch?v=a', createdAt: 0, prefecture: '鹿児島県',
      createdBy: 'Loca 運営', official: { provider: '霧島市', sourceUrl: 'https://example.com/' } }] });
    assert.match(xml, /公式の紹介: 霧島市/);
    assert.doesNotMatch(xml, /投稿: Loca 運営/);
  });

  it('マーカーが無くても、項目の無い正しい RSS を返す', () => {
    const { xml, items } = buildFeed({ markers: [], generatedAt: 0 });
    assert.equal(items, 0);
    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/);
    assert.match(xml, /<lastBuildDate>Thu, 01 Jan 1970 00:00:00 GMT<\/lastBuildDate>/);
  });
});
