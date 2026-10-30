/**
 * 疎通確認（probe-google.yml）を手動で実行し、終わるまで待って結果の行だけを出す。
 * Actions で使うキー（loca-youtube）は Secrets にしか無いので、その経路の API の返り値を確かめるときはこれを使う（T44）。
 *
 *   npm run probe                          既定の動画で実行（main の版）
 *   npm run probe -- <動画ID>              調べる動画を変える
 *   npm run probe -- <動画ID> --ref <枝>   main に入れる前の枝の版で実行する（公開は動かない）
 *
 * 読み取りだけで公開物には触れない（Firestore の probes/actions は書いてすぐ消す）。
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const R = 'loca-project/loca-project.github.io';
const WF = 'probe-google.yml';
const GH = existsSync('C:\\Program Files\\GitHub CLI\\gh.exe') ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh';
const gh = (a) => execFileSync(GH, a, { encoding: 'utf8' }).trim();

const args = process.argv.slice(2);
const refAt = args.indexOf('--ref');
const ref = refAt >= 0 ? args[refAt + 1] : 'main';
const video = args.find((a, i) => !a.startsWith('--') && (refAt < 0 || i !== refAt + 1));
if (video && !/^[\w-]{11}$/.test(video)) {
  console.error(`NG: 動画 ID の形ではありません: ${video}`);
  process.exit(2);
}

const latest = () => gh(['run', 'list', '-R', R, '-w', WF, '-b', ref, '-L', '1', '--json', 'databaseId', '-q', '.[0].databaseId']);
const before = latest();
gh(['workflow', 'run', WF, '-R', R, '--ref', ref, ...(video ? ['-f', `video=${video}`] : [])]);

// 実行が一覧に出るまで待つ（出るまで数秒かかる）
let id = '';
for (let i = 0; i < 30 && (!id || id === before); i++) {
  await sleep(2000);
  id = latest();
}
if (!id || id === before) {
  console.error('NG: 60 秒待っても実行が一覧に出ませんでした');
  process.exit(1);
}
console.log(`実行: https://github.com/${R}/actions/runs/${id}（枝 ${ref}${video ? `・動画 ${video}` : ''}）`);

const watch = spawnSync(GH, ['run', 'watch', id, '-R', R, '--exit-status', '--interval', '10'], { stdio: 'ignore' });
const log = gh(['run', 'view', id, '-R', R, '--log']);
const lines = log.split('\n').map((l) => l.replace(/^.*?Z /, '')).filter((l) => /^(動画 |status: |OK |NG |\d+ \/ \d+ 件 OK)/.test(l));
console.log(lines.length ? lines.join('\n') : '（結果の行がありません。上の URL でログを見てください）');
process.exit(watch.status === 0 ? 0 : 1);
