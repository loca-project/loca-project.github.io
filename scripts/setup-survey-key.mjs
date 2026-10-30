/**
 * 地域の調査（T128）でこの PC から YouTube Data API を呼ぶための、調べもの専用の API キー（T130・ADR 0017 の追記）。
 * 何度流しても同じ結果になる（キーがあれば作らず、.env.local の行を書き直すだけ）。
 *
 * 1. YouTube Data API だけに制限した API キー `loca-survey` を作る（Actions 用の `loca-youtube` とは別）
 * 2. 値を .env.local の YOUTUBE_SURVEY_API_KEY に書く（VITE_ で始めない。ブラウザに配られるため）
 * 3. YouTube Data API が通り、制限の外の API（Identity Toolkit）が断られることを確かめる
 *
 * キーの値は画面にもログにも出さない。
 * 実行: node scripts/setup-survey-key.mjs（Firebase CLI にオーナーでログインしていること）
 * 消し方: Google Cloud コンソール（loca-d3792）の「API とサービス → 認証情報」で「Loca Survey - YouTube Data API」を削除し、
 *         .env.local の YOUTUBE_SURVEY_API_KEY の行を消す
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PROJECT, call, fail, ownerToken } from './lib/owner-auth.mjs';

const KEY_ID = 'loca-survey';
const ENV_KEY = 'YOUTUBE_SURVEY_API_KEY';
const ENV_FILE = path.join(process.cwd(), '.env.local');
const TIMEOUT = 15000;

const { token } = await ownerToken();
const api = (method, url, body) => call(token, method, url, body);

/** 長く掛かる操作（operation）の完了を待つ。 */
async function waitOperation(base, op) {
  for (let i = 0; i < 60 && op && !op.done; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    op = await api('GET', `${base}/${op.name}`);
  }
  if (op?.error) fail(`${op.name}: ${JSON.stringify(op.error)}`);
  return op;
}

// 1. API キー（YouTube Data API だけ）
const project = await api('GET', `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}`);
const keys = 'https://apikeys.googleapis.com/v2';
const keyName = `projects/${project.projectNumber}/locations/global/keys/${KEY_ID}`;
let created = false;
if (!(await api('GET', `${keys}/${keyName}`))) {
  const op = await api('POST', `${keys}/projects/${PROJECT}/locations/global/keys?keyId=${KEY_ID}`, {
    displayName: 'Loca Survey - YouTube Data API',
    restrictions: { apiTargets: [{ service: 'youtube.googleapis.com' }] },
  });
  await waitOperation(keys, op);
  created = true;
}
const key = await api('GET', `${keys}/${keyName}`);
const targets = (key.restrictions?.apiTargets ?? []).map((t) => t.service);
if (targets.length !== 1 || targets[0] !== 'youtube.googleapis.com') fail(`キーの制限が想定と違います: ${targets.join(',')}`);
console.log(`OK  API キー ${KEY_ID}（${created ? '新しく作成' : '既存を再利用'}・制限 ${targets.join(',')}）`);

// 2. .env.local に書く（既存の行は置き換え、無ければ足す）
const { keyString } = await api('GET', `${keys}/${keyName}/keyString`);
let text = '';
try {
  text = await readFile(ENV_FILE, 'utf8');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const lines = text.split(/\r?\n/).filter((l, i, a) => !(i === a.length - 1 && l === ''));
const at = lines.findIndex((l) => new RegExp(`^\\s*${ENV_KEY}\\s*=`).test(l));
const line = `${ENV_KEY}=${keyString}`;
if (at >= 0) lines[at] = line;
else lines.push(line);
await writeFile(ENV_FILE, `${lines.join('\n')}\n`);
console.log(`OK  .env.local の ${ENV_KEY} を${at >= 0 ? '書き直し' : '追加'}`);

// 3. 効き目を確かめる（YouTube は 200、制限の外は 403）。キーが広まるまで最大 2 分待つ
async function probe() {
  const yt = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=id&id=Firkhg9yU9g&key=${keyString}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  );
  // キーだけで呼べる窓口を使う（accounts:query はキーより先にログインを求めて 401 になり、制限を試せない）。
  // ブラウザ用のキーでは 200 になることを確かめてある（陽性の対照。2026-10-24）
  const other = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${keyString}`, {
    method: 'POST',
    body: JSON.stringify({ identifier: 'probe@example.com', continueUri: 'http://localhost:5173' }),
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const otherBody = await other.text();
  return { yt: yt.status, other: other.status, blocked: /API_KEY_SERVICE_BLOCKED/.test(otherBody) };
}
let result;
for (let i = 0; i < 12; i += 1) {
  result = await probe();
  if (result.yt === 200 && result.other === 403 && result.blocked) break;
  await new Promise((r) => setTimeout(r, 10000));
}
console.log(`${result.yt === 200 ? 'OK' : 'NG'}  YouTube Data API（videos.list）: ${result.yt}`);
console.log(`${result.other === 403 && result.blocked ? 'OK' : 'NG'}  制限の外の API（Identity Toolkit）: ${result.other}`
  + `${result.blocked ? '（キーの制限で拒否）' : ''}`);
if (!(result.yt === 200 && result.other === 403 && result.blocked)) process.exit(1);
