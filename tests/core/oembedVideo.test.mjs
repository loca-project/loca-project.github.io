/**
 * YouTube oEmbed のアダプタ（src/adapters/video/oembed.ts。T103）。
 * fetch は差し替える（本物の API は呼ばない）。実行: npm run test:core（npm run check に含む）
 * 待ち時間の上限を渡すこと、応答しないときと見つからないときで別のエラーにすることを確かめる。
 */
import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let o;
let ports;
const realFetch = globalThis.fetch;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  o = await vite.ssrLoadModule('/src/adapters/video/oembed.ts');
  ports = await vite.ssrLoadModule('/src/ports/index.ts');
});
after(async () => { await vite.close(); });
afterEach(() => { globalThis.fetch = realFetch; });

const timeout = async () => { throw new DOMException('timed out', 'TimeoutError'); };

describe('oembedVideoAdapter.fetchMeta', () => {
  it('どの窓口にも待ち時間の上限（signal）を渡し、題を返す', async () => {
    const signals = [];
    globalThis.fetch = async (url, init) => {
      signals.push(init?.signal instanceof AbortSignal);
      return new Response(JSON.stringify({ title: '題', author_name: 'ch' }), { status: 200 });
    };
    const meta = await o.oembedVideoAdapter.fetchMeta('abcdefghijk');
    assert.equal(meta.title, '題');
    assert.deepEqual(signals, [true]);
  });

  it('すべての窓口が応答しないときは UpstreamTimeoutError（陽性）', async () => {
    globalThis.fetch = timeout;
    await assert.rejects(o.oembedVideoAdapter.fetchMeta('abcdefghijk'), (e) => e instanceof ports.UpstreamTimeoutError);
  });

  it('見つからない（404）ときは UpstreamTimeoutError にしない（陰性）', async () => {
    globalThis.fetch = async () => new Response('', { status: 404 });
    await assert.rejects(o.oembedVideoAdapter.fetchMeta('abcdefghijk'),
      (e) => e instanceof ports.UpstreamError && !(e instanceof ports.UpstreamTimeoutError));
  });

  it('1 つ目が応答せず 2 つ目が 404 なら、応答しないとは言わない', async () => {
    let n = 0;
    globalThis.fetch = async () => (n++ === 0 ? timeout() : new Response('', { status: 404 }));
    await assert.rejects(o.oembedVideoAdapter.fetchMeta('abcdefghijk'), (e) => !(e instanceof ports.UpstreamTimeoutError));
  });
});
