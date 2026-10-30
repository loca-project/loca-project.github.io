/**
 * node --test を上限の時間つきで流す。止まったら子のプロセスごと止め、終了コード 3 で知らせる。
 *
 *   node scripts/run-tests.mjs <上限の秒> <試験のファイルかパターン...>
 *
 * なぜ要るか: node の --test-timeout は、止まった after には効かない（上限 5 秒の見本が 40 秒でも終わらなかった。T143）。
 * 試験の Vite の後片付けが止まると npm run check が 3 時間戻らず、check:head を通る deploy・release も止まった。
 *
 * 1 ファイルずつ流す（test:rules と同じ）。Vite のキャッシュが無いとき、並列の Vite が node_modules/.vite/deps_* の rename を取り合って
 * Windows で EPERM になり、before が落ちたまま止まるため（HEAD を取り出した直後の 1 回目に毎回起きた。T143）。
 */
import { execFileSync, spawn } from 'node:child_process';

const [limitSec, ...patterns] = process.argv.slice(2);
if (!Number(limitSec) || patterns.length === 0) {
  console.error('NG: 使い方: node scripts/run-tests.mjs <上限の秒> <試験のファイルかパターン...>');
  process.exit(2);
}

const child = spawn(process.execPath, ['--test', '--test-concurrency=1', ...patterns], { stdio: 'inherit' });
let timedOut = false;

function stopTree(pid) {
  if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else process.kill(pid, 'SIGKILL');
}

const timer = setTimeout(() => {
  timedOut = true;
  console.error(`NG: 試験が ${limitSec} 秒で終わらないので止めました（${patterns.join(' ')}）。止まった試験は、上の出力の最後の方にあります`);
  try {
    stopTree(child.pid);
  } catch (e) {
    console.error(`注意: 試験のプロセスを止められませんでした（${e.message}）`);
  }
}, Number(limitSec) * 1000);

child.on('close', (code) => {
  clearTimeout(timer);
  process.exit(timedOut ? 3 : (code ?? 1));
});
