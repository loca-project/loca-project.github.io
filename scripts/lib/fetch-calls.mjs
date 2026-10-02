/**
 * ソースの文字列から fetch の呼び出しを取り出し、待ち時間の上限（signal）の有無を見る（verify の 1d。T96・T103）。
 * 構文解析はせず、括弧の対応だけを数える。コメントの行（// と * で始まる行）の fetch は数えない。
 */

/** fetch( の呼び出しごとに、行番号と引数の文字列を返す */
export function fetchCalls(text) {
  const calls = [];
  const re = /(?<![\w.$])fetch\(/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const lineStart = text.lastIndexOf('\n', m.index) + 1;
    const head = text.slice(lineStart, m.index).trim();
    if (head.startsWith('//') || head.startsWith('*') || head.startsWith('/*')) continue;
    const open = m.index + m[0].length;
    let depth = 1;
    let i = open;
    for (; i < text.length && depth > 0; i += 1) {
      if (text[i] === '(') depth += 1;
      else if (text[i] === ')') depth -= 1;
    }
    calls.push({ line: text.slice(0, m.index).split('\n').length, args: text.slice(open, i - 1) });
  }
  return calls;
}

/** signal を渡していない fetch の行番号 */
export function fetchCallsWithoutSignal(text) {
  return fetchCalls(text)
    .filter((c) => !/\bsignal\b/.test(c.args))
    .map((c) => c.line);
}
