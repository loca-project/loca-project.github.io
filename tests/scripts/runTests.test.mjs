/**
 * 試験の実行の上限（scripts/run-tests.mjs。T143）。止まった after を、上限の時間で止められるか。
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const RUNNER = path.resolve('scripts/run-tests.mjs');
let dir;
before(() => { dir = mkdtempSync(path.join(tmpdir(), 'loca-run-tests-')); });
after(() => { rmSync(dir, { recursive: true, force: true }); });

function run(limit, name, body) {
  const file = path.join(dir, name);
  writeFileSync(file, `import { after, test } from 'node:test';\n${body}\n`);
  const started = Date.now();
  // 試験の中の node --test は、継承した NODE_TEST_CONTEXT があると何もせず 0 で終わる
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(process.execPath, [RUNNER, String(limit), file], { encoding: 'utf8', timeout: 60000, env });
  return { code: r.status, sec: (Date.now() - started) / 1000, err: r.stderr };
}

test('止まった after は上限の時間で止め、終了コード 3 で知らせる', () => {
  const r = run(4, 'hang.test.mjs', `after(() => new Promise(() => { setInterval(() => {}, 1000); }));\ntest('本体', () => {});`);
  assert.equal(r.code, 3);
  assert.ok(r.sec < 30, `${r.sec} 秒`);
  assert.match(r.err, /4 秒で終わらない/);
});

test('通る試験は 0、落ちる試験は 0 以外を返す', () => {
  assert.equal(run(30, 'ok.test.mjs', `test('通る', () => {});`).code, 0);
  assert.equal(run(30, 'ng.test.mjs', `test('落ちる', () => { throw new Error('x'); });`).code, 1);
});

test('引数が足りなければ 2', () => {
  assert.equal(spawnSync(process.execPath, [RUNNER], { encoding: 'utf8' }).status, 2);
});
