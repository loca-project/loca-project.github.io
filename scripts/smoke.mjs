/**
 * 実ブラウザでの目視レベルの確認。
 *
 *   npm run smoke                       ローカルのプレビュー（要 npm run preview）
 *   npm run smoke -- https://例/loca/   公開済みのサイト
 *
 * なぜ要るか: DOM の文字列やピンの数だけを見ていると、
 * 地図が真っ白でも「OK」になってしまう（マーカーは HTML 要素なので描画される）。
 * ここでは**地図タイルが実際に取得されたか**を数えて判定する。
 *
 * ブラウザに依存するので CI では動かさない。公開前に手元で実行する。
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const URL_TO_OPEN = process.argv[2] ?? 'http://127.0.0.1:4173/';
const SHOT = path.join(process.cwd(), '..', 'tmp', 'smoke.png');
const PORT = 9339;

const CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) {
  console.error('NG: Chromium 系ブラウザが見つかりません。');
  process.exit(2);
}

const proc = spawn(
  browser,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1600,900',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(process.env.TEMP ?? '/tmp', 'loca-smoke')}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function debuggerUrl() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {
      /* 起動待ち */
    }
    await sleep(500);
  }
  throw new Error('ブラウザに接続できませんでした');
}

let nextId = 1;
const pending = new Map();
const tiles = [];
const consoleErrors = [];
const netFailures = [];
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok, detail });

const send = (ws, method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

try {
  const ws = new WebSocket(await debuggerUrl());
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method === 'Network.responseReceived') {
      const u = msg.params.response.url;
      if (/\.pbf(\?|$)/.test(u) || /\/\d+\/\d+\/\d+\.(png|webp)/.test(u)) tiles.push(u);
    }
    if (msg.method === 'Network.loadingFailed') netFailures.push(msg.params.errorText);
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
  });

  const { targetId } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send(ws, 'Target.attachToTarget', { targetId, flatten: true });
  await send(ws, 'Runtime.enable', {}, sessionId);
  await send(ws, 'Network.enable', {}, sessionId);
  await send(ws, 'Page.enable', {}, sessionId);
  await send(ws, 'Page.navigate', { url: URL_TO_OPEN }, sessionId);

  const run = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, returnByValue: true }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };
  // 起動画面の間に Edge AI（初回は約 240 MB）を準備してから地図を出すので、固定の時間ではなく地図が出るまで待つ（T101）。
  // 上限は 5 分。出たあと 6 秒おいてタイルを数える
  const started = Date.now();
  while (Date.now() - started < 300_000 && !(await run(`!!document.querySelector('canvas')`).catch(() => false))) await sleep(1000);
  console.log(`地図が出るまで ${Math.round((Date.now() - started) / 1000)} 秒`);
  await sleep(6000);

  check('タイトルが Loca', (await run('document.title')) === 'Loca');
  check('地図の canvas がある', (await run(`document.querySelectorAll('canvas').length`)) === 1);
  // 開閉ボタン 1 ＋ タブ 7（最近・投稿・検索・ユーザー・リクエスト・地域・機器。ADR 0034）
  check('サイドメニューのボタンが 8 個', (await run(`document.querySelectorAll('nav button').length`)) === 8);

  // ここが本命。地図タイルが 1 枚も来ていなければ、画面は白か灰色のまま。
  check('地図タイルが取得されている', tiles.length > 0, `${tiles.length} 枚`);

  check('コンソールエラーが無い', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' / '));
  check('失敗したリクエストが無い', netFailures.length === 0, [...new Set(netFailures)].slice(0, 2).join(' / '));

  const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' }, sessionId);
  await mkdir(path.dirname(SHOT), { recursive: true });
  await writeFile(SHOT, Buffer.from(shot.data, 'base64'));

  // 投稿タブ（指摘 9）: 開くと、未ログインならログインの案内、ログイン済みなら場所の案内とフォームが出る
  const opened = await run(`(() => {
    const tab = [...document.querySelectorAll('nav button')].find((b) => /投稿|Post/.test(b.getAttribute('aria-label') ?? ''));
    if (!tab) return false;
    tab.click();
    return true;
  })()`);
  await sleep(800);
  const postText = opened ? await run('document.body.innerText') : '';
  check('投稿タブを開ける', opened);
  check('投稿タブに案内が出る', /ログインが必要|Sign in to post|地図をクリックすると|Click the map to set/.test(postText));
  const postShot = await send(ws, 'Page.captureScreenshot', { format: 'png' }, sessionId);
  await writeFile(SHOT.replace(/\.png$/, '-post.png'), Buffer.from(postShot.data, 'base64'));
  const passed = checks.filter((c) => c.ok).length;
  for (const c of checks) console.log(`${c.ok ? 'OK ' : 'NG '} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  console.log(`\n${passed} / ${checks.length} 件 OK`);
  console.log(`スクリーンショット: ${path.relative(process.cwd(), SHOT)} と -post.png（目視でも確認すること）`);

  ws.close();
  if (passed !== checks.length) process.exitCode = 1;
} finally {
  proc.kill();
}
