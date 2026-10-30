/**
 * OpenStreetMap の Nominatim のアダプタ（src/adapters/geocode/nominatim.ts。ADR 0032）。
 * fetch は差し替える（本物の API は呼ばない）。実行: npm run test:core（npm run check に含む）
 * 利用規約の守り（間隔・キャッシュ・待ち時間の上限）と、住所から都道府県・市区町村を取り出す規則を確かめる。
 */
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let n;
const realFetch = globalThis.fetch;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  n = await vite.ssrLoadModule('/src/adapters/geocode/nominatim.ts');
});
after(async () => { await vite.close(); });
beforeEach(() => n.resetNominatimState());
afterEach(() => { globalThis.fetch = realFetch; });

/** 呼ばれた URL と時刻を記録し、決まった JSON を返す fetch */
function recordingFetch(body) {
  const calls = [];
  const fn = async (url) => {
    calls.push({ url: String(url), at: Date.now() });
    return new Response(JSON.stringify(typeof body === 'function' ? body(String(url)) : body), { status: 200 });
  };
  return { fn, calls };
}

describe('forward（地名 → 座標）', () => {
  it('日本に絞って 1 件だけ問い合わせ、座標を返す', async () => {
    const { fn, calls } = recordingFetch([{ lat: '34.9858', lon: '135.7588' }]);
    globalThis.fetch = fn;
    assert.deepEqual(await n.nominatimGeocodeAdapter.forward('京都駅'), { lat: 34.9858, lng: 135.7588 });
    const u = new URL(calls[0].url);
    assert.equal(u.origin + u.pathname, 'https://nominatim.openstreetmap.org/search');
    assert.equal(u.searchParams.get('countrycodes'), 'jp');
    assert.equal(u.searchParams.get('limit'), '1');
  });

  it('同じ語（空白・大文字小文字の違いを含む）は 2 回目から問い合わせない（規約のキャッシュ）', async () => {
    const { fn, calls } = recordingFetch([{ lat: '35', lon: '139' }]);
    globalThis.fetch = fn;
    await n.nominatimGeocodeAdapter.forward('Tokyo Tower');
    await n.nominatimGeocodeAdapter.forward('  tokyo　tower ');
    assert.equal(calls.length, 1);
  });

  it('見つからなかった語も覚え、繰り返し問い合わせない', async () => {
    const { fn, calls } = recordingFetch([]);
    globalThis.fetch = fn;
    await assert.rejects(n.nominatimGeocodeAdapter.forward('存在しない地名'), /見つかりませんでした/);
    await assert.rejects(n.nominatimGeocodeAdapter.forward('存在しない地名'), /見つかりませんでした/);
    assert.equal(calls.length, 1);
  });

  it('応答しないときは「見つからない」ではなく、応答しないと伝える', async () => {
    globalThis.fetch = async () => { throw new DOMException('timed out', 'TimeoutError'); };
    await assert.rejects(n.nominatimGeocodeAdapter.forward('京都駅'), /応答しません/);
  });
});

describe('getJson（間隔と待ち時間の上限）', () => {
  it('続けて呼んでも 1.1 秒以上あけて 1 件ずつ問い合わせる（規約は全体で 1 秒に 1 回）', async () => {
    const { fn, calls } = recordingFetch([]);
    globalThis.fetch = fn;
    await Promise.all([n.getJson('/search', { q: 'a' }), n.getJson('/search', { q: 'b' })]);
    assert.equal(calls.length, 2);
    assert.ok(calls[1].at - calls[0].at >= n.MIN_INTERVAL_MS - 5, `${calls[1].at - calls[0].at} ms`);
  });

  it('応答が無ければ上限の時間で GeocodeTimeoutError になる（止まったままにならない）', async () => {
    globalThis.fetch = (_url, { signal }) => new Promise((_r, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
    const started = Date.now();
    await assert.rejects(n.getJson('/search', { q: 'a' }, 50), (e) => e instanceof n.GeocodeTimeoutError);
    assert.ok(Date.now() - started < 2000);
  });
});

describe('placeFromAddress（座標 → 都道府県・市区町村）', () => {
  it('東京都は province が空でも ISO のコード JP-13 から引く（2026-09-26 の実測）', () => {
    const a = { city: '港区', 'ISO3166-2-lvl4': 'JP-13', country_code: 'jp' };
    assert.deepEqual(n.placeFromAddress(a), { prefecture: '東京都', city: '港区', source: 'osm' });
  });

  it('政令指定都市は市の名前（京都市）', () => {
    const a = { city: '京都市', province: '京都府', 'ISO3166-2-lvl4': 'JP-26', country_code: 'jp' };
    assert.deepEqual(n.placeFromAddress(a), { prefecture: '京都府', city: '京都市', source: 'osm' });
  });

  it('町村は town・village から取る', () => {
    assert.equal(n.placeFromAddress({ town: '小山町', 'ISO3166-2-lvl4': 'JP-22', country_code: 'jp' }).city, '小山町');
    assert.equal(n.placeFromAddress({ village: '白川村', province: '岐阜県', country_code: 'jp' }).city, '白川村');
  });

  it('日本の外・都道府県が分からない住所は null', () => {
    assert.equal(n.placeFromAddress({ city: 'Seoul', country_code: 'kr' }), null);
    assert.equal(n.placeFromAddress({ country_code: 'jp' }), null);
    assert.equal(n.placeFromAddress(undefined), null);
  });
});
