/**
 * 機器マスタの編集用の文章と一覧の変換（src/core/logic/equipmentText.ts。ADR 0025）。
 * 実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let lib;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  lib = await vite.ssrLoadModule('/src/core/logic/equipmentText.ts');
});
after(async () => { await vite.close(); });

const makers = [
  { name: 'DJI', series: [{ name: 'Osmo Action', models: ['Osmo Action 5 Pro', 'Osmo Action 4'] }] },
  { name: 'GoPro', series: [{ name: 'HERO', models: [] }] },
];

describe('makersToText と textToMakers', () => {
  it('文章にして戻すと元の一覧になる', () => {
    const text = lib.makersToText(makers);
    assert.equal(text.split('\n')[1], '  Osmo Action');
    assert.deepEqual(lib.textToMakers(text), { makers, problems: [] });
  });

  it('空行と CRLF は読み飛ばす', () => {
    const { makers: got, problems } = lib.textToMakers('DJI\r\n\r\n  Osmo Action\r\n    Osmo Action 4\r\n');
    assert.deepEqual(problems, []);
    assert.deepEqual(got[0].series[0].models, ['Osmo Action 4']);
  });

  it('字下げの誤り・親の無い行・重複・長すぎる名前を行番号付きで拾う', () => {
    const text = ['  浮いたシリーズ', 'DJI', '   3 字下げ', '  Mini', '    Mini 4 Pro', '    Mini 4 Pro', 'DJI', 'x'.repeat(81)].join('\n');
    const kinds = lib.textToMakers(text).problems.map((p) => `${p.line}:${p.kind}`);
    assert.deepEqual(kinds, ['1:orphan', '3:indent', '6:duplicate', '7:duplicate', '8:long']);
  });

  it('タブの字下げは拒む', () => {
    assert.equal(lib.textToMakers('DJI\n\tMini').problems[0].kind, 'indent');
  });

  it('メーカーが上限を超えたら拒む', () => {
    const text = Array.from({ length: lib.MAX_MAKERS + 1 }, (_, i) => `M${i}`).join('\n');
    assert.equal(lib.textToMakers(text).problems.at(-1).kind, 'tooMany');
  });
});

describe('件数の上限', () => {
  it('シリーズ・モデルが上限を超えたら拒む', () => {
    const series = Array.from({ length: lib.MAX_SERIES + 1 }, (_, i) => `  S${i}`);
    assert.equal(lib.textToMakers(['X', ...series].join('\n')).problems.at(-1).kind, 'tooManySeries');
    const models = Array.from({ length: lib.MAX_MODELS + 1 }, (_, i) => `    M${i}`);
    assert.equal(lib.textToMakers(['X', '  S', ...models].join('\n')).problems.at(-1).kind, 'tooManyModels');
  });
});

describe('countMakers', () => {
  it('メーカー・シリーズ・モデルを数える', () => {
    assert.deepEqual(lib.countMakers(makers), { makers: 2, series: 2, models: 2 });
  });
});
