/**
 * コミット済みの状態（HEAD）を別の場所に取り出して処理を行う。
 *
 * 複数のチャットが同じ作業ツリーを編集していると、作業ツリーには他人の書きかけが混ざる。
 * 検証・ルールの反映を作業ツリーで行うと、その書きかけまで検証・反映してしまう（2026-09-25 T29）。
 * ここでは git worktree で HEAD を ../tmp/work/_head-<時刻>/ に取り出し、node_modules はリンクで共有し、
 * .env.local（git 管理外）は写してから処理し、終わったら片付ける。
 *
 * 片付けの注意: node_modules のリンク（Windows ではジャンクション）を先に外す。
 * リンクを残したまま再帰的に消すと、リンク先の本体の node_modules まで消えうる。
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/**
 * 未コミットの変更があるファイル（paths を渡すとその範囲だけ）。未追跡の新しいファイルも数える
 * （その場で型チェックやビルドをすると、未追跡の書きかけも対象に入るため）。
 */
export function dirtyFiles(root, paths = []) {
  // -z で読む。git() の trim が 1 行目の先頭の空白（作業ツリーだけの変更 " M"）を消し、パスの 1 文字目が欠けていた（2026-09-26）。
  // -z なら非 ASCII のパスも引用符とエスケープ無しで返り、改名は「新しいパス、元のパス」の 2 項目になる
  const out = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all', '--', ...paths], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const items = out.split('\0').filter(Boolean);
  const files = [];
  for (let i = 0; i < items.length; i += 1) {
    files.push(items[i].slice(3));
    if (/^[RC]/.test(items[i])) i += 1; // 改名・複写の元のパスは飛ばす
  }
  return files;
}

function unlinkModules(dir) {
  const link = join(dir, 'node_modules');
  if (!existsSync(link)) return;
  // ジャンクションはリンクだけを外す（中身は消さない）
  if (process.platform === 'win32') execFileSync('cmd', ['/c', 'rmdir', link], { stdio: 'ignore' });
  else unlinkSync(link);
}

/**
 * HEAD を取り出した場所で fn(dir) を実行し、結果を返す。失敗しても片付けてから例外をそのまま投げる。
 * 片付けで消せなかった場所は警告だけ出す（tmp/ は git の管理外で、公開には影響しない）。
 */
export async function withHeadSnapshot(root, fn) {
  const dir = resolve(root, '..', 'tmp', 'work', `_head-${Date.now()}`);
  git(root, ['worktree', 'add', '--detach', dir, 'HEAD']);
  try {
    symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'junction');
    if (existsSync(join(root, '.env.local'))) copyFileSync(join(root, '.env.local'), join(dir, '.env.local'));
    console.log(`HEAD（${git(root, ['rev-parse', '--short', 'HEAD'])}）を ${dir} に取り出しました`);
    return await fn(dir);
  } finally {
    rmSync(join(dir, '.env.local'), { force: true });
    try {
      unlinkModules(dir);
    } catch (e) {
      console.warn(`注意: ${dir}/node_modules のリンクを外せませんでした（${e.message}）`);
    }
    // リンクが残っていたら消さない（リンク先の本体を巻き込むため）。手で rmdir してから消す
    if (existsSync(join(dir, 'node_modules'))) {
      console.warn(`注意: ${dir} を残しました。cmd /c rmdir "${join(dir, 'node_modules')}" のあと git worktree prune`);
    } else {
      removeSnapshot(root, dir);
    }
  }
}

function removeSnapshot(root, dir) {
  try {
    git(root, ['worktree', 'remove', '--force', dir]);
  } catch {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    git(root, ['worktree', 'prune']);
    if (existsSync(dir)) console.warn(`注意: ${dir} を消せませんでした（git の登録は外しました。tmp/ なので公開には影響しません）`);
  }
}
