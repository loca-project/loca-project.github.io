/**
 * Edge AI の起動（src/runtime/edgeAi.ts。T101）と、前もって計算したタグの埋め込み（public/data/semantic-tags.json）。
 * 実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

let vite;
let edge;
let models;
let tags;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  edge = await vite.ssrLoadModule('/src/runtime/edgeAi.ts');
  models = await vite.ssrLoadModule('/src/adapters/semantic/models.ts');
  tags = await vite.ssrLoadModule('/src/core/constants/tagDescriptions.ts');
});
after(async () => { await vite.close(); });

const LIMITS = { stall: 80, start: 160, tick: 10 };
const never = () => new Promise(() => {});

describe('watch（止まったら諦めて、Edge AI なしで起動を続ける）', () => {
  it('取得中に進み具合が止まったら、stall の上限で諦める', async () => {
    const state = { at: Date.now(), downloading: true };
    const t0 = Date.now();
    await assert.rejects(edge.watch(never(), () => state, LIMITS), /取得が/);
    assert.ok(Date.now() - t0 < 1000);
  });

  it('取得のあとの起動が終わらなければ、start の上限で諦める（「準備中 100%」のまま止まったとき）', async () => {
    const state = { at: Date.now(), downloading: false };
    await assert.rejects(edge.watch(never(), () => state, LIMITS), /起動が/);
  });

  it('進み具合が届き続けている間は諦めない', async () => {
    const state = { at: Date.now(), downloading: true };
    const timer = setInterval(() => { state.at = Date.now(); }, 20);
    const work = new Promise((r) => setTimeout(() => r('ok'), 300)); // stall の上限（80 ms）より長い
    assert.equal(await edge.watch(work, () => state, LIMITS), 'ok');
    clearInterval(timer);
  });
});

describe('skipReason（準備しない端末。T105）', () => {
  it('データセーバーがオンなら準備しない', () => {
    assert.equal(edge.skipReason('', { saveData: true }), 'データセーバーがオン');
  });
  it('データセーバーがオフ・navigator.connection が無い（Safari・Firefox）なら準備する', () => {
    assert.equal(edge.skipReason('', { saveData: false }), null);
    assert.equal(edge.skipReason('', undefined), null);
    assert.equal(edge.skipReason('?m=abc', {}), null);
  });
  it('?edgeai=off なら準備しない', () => {
    assert.equal(edge.skipReason('?edgeai=off', undefined), '?edgeai=off');
  });
});

describe('semantic-tags.json（前もって計算したタグの埋め込み）', () => {
  it('今のモデルと説明文から作ったもの（違えば npm run semantic:vectors で作り直す）', async () => {
    const saved = JSON.parse(await readFile('public/data/semantic-tags.json', 'utf8'));
    assert.equal(saved.model, models.MODELS[models.ACTIVE_MODEL].id);
    assert.equal(saved.fingerprint, tags.descriptionsFingerprint());
    assert.deepEqual(saved.keys, Object.keys(tags.TAG_DESCRIPTIONS));
    assert.ok(saved.vectors.every((v) => v.length === saved.vectors[0].length && v.length > 0));
  });
});
