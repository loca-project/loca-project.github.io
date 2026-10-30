/**
 * 自己申告の YouTube チャンネルの入力（src/core/logic/channel.ts。T55・ADR 0029）。
 * 実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let lib;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  lib = await vite.ssrLoadModule('/src/core/logic/channel.ts');
});
after(async () => { await vite.close(); });

const UC = `UC${'aB3_-'.repeat(4)}xy`;

describe('parseChannelInput', () => {
  it('チャンネル ID と @ハンドルの URL・そのままの値を読む', () => {
    assert.equal(lib.parseChannelInput(`https://www.youtube.com/channel/${UC}`), UC);
    assert.equal(lib.parseChannelInput(`youtube.com/channel/${UC}/videos`), UC);
    assert.equal(lib.parseChannelInput('https://www.youtube.com/@loca_ch/videos'), '@loca_ch');
    assert.equal(lib.parseChannelInput('https://m.youtube.com/@loca.ch?si=x'), '@loca.ch');
    assert.equal(lib.parseChannelInput(`  ${UC}  `), UC);
    assert.equal(lib.parseChannelInput('@loca_ch'), '@loca_ch');
    assert.equal(lib.parseChannelInput('https://www.youtube.com/@%E3%83%AD%E3%82%AB%E5%85%AC%E5%BC%8F'), '@ロカ公式');
  });

  it('決めた形でないもの（動画の URL・古い形式・ほかのサイト・空）は null', () => {
    assert.equal(lib.parseChannelInput('https://www.youtube.com/watch?v=abcdefghijk'), null);
    assert.equal(lib.parseChannelInput('https://www.youtube.com/c/LocaChannel'), null);
    assert.equal(lib.parseChannelInput('https://www.youtube.com/user/loca'), null);
    assert.equal(lib.parseChannelInput('https://example.com/@loca_ch'), null);
    assert.equal(lib.parseChannelInput(''), null);
    assert.equal(lib.parseChannelInput('@ab'), null);
  });
});

describe('channelUrl', () => {
  it('保存した形から URL を作る', () => {
    assert.equal(lib.channelUrl('@loca_ch'), 'https://www.youtube.com/@loca_ch');
    assert.equal(lib.channelUrl(UC), `https://www.youtube.com/channel/${UC}`);
  });
});
