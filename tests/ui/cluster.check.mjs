/**
 * T41: 密集地がクラスタにまとまり、件数が合い、押すと広がること。2000 件でも地図が操作できること。
 * 実行: node tools/ui-check/run.mjs project/tests/ui/cluster.check.mjs --seed-count 2000
 */
const ready = `document.querySelector('.maplibregl-canvas')`;
/** 画面に出ている件数: 個別のピン + クラスタの中身 */
const shown = `(() => {
  const pins = document.querySelectorAll('.loca-pin').length;
  const clusters = [...document.querySelectorAll('.loca-cluster')];
  const inClusters = clusters.reduce((n, c) => n + Number(c.dataset.count), 0);
  return { pins, clusters: clusters.length, total: pins + inClusters, max: Math.max(0, ...clusters.map((c) => Number(c.dataset.count))) };
})()`;

export default async function check(ui, ctx) {
  await ui.size(1280, 860);
  await ui.run(`localStorage.setItem('loca.lang', 'ja'); true`);
  const expected = ctx.markers.length + ctx.spots.length;
  await ui.waitFor(ready, 20000);
  await ui.waitFor(`${shown}.total === ${expected}`, 20000);

  const first = await ui.run(shown);
  ui.check('ピンとクラスタの件数の合計が公開データと一致', first.total === expected, `${JSON.stringify(first)} / 期待 ${expected}`);
  ui.check('クラスタが出ている', first.clusters > 0, `${first.clusters} 個`);
  ui.check('地図に置く DOM が 300 個以下（件数に比例しない）', first.pins + first.clusters <= 300, `${first.pins + first.clusters} 個`);
  await ui.shot('t41-japan');

  // 操作の滑らかさ: ホイールで寄って引く間のフレームの間隔
  const frame = await ui.run(`(async () => {
    const canvas = document.querySelector('.maplibregl-canvas');
    const r = canvas.getBoundingClientRect();
    const times = [];
    let running = true;
    const tick = (t) => { times.push(t); if (running) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    for (let i = 0; i < 16; i += 1) {
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: i < 8 ? -120 : 120, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true }));
      await new Promise((ok) => setTimeout(ok, 60));
    }
    await new Promise((ok) => setTimeout(ok, 800));
    running = false;
    const gaps = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
    return { frames: gaps.length, p95: Math.round(gaps[Math.floor(gaps.length * 0.95)] ?? 0) };
  })()`);
  ui.check('寄り引きの間のフレーム間隔（95%）が 100ms 以下', frame.p95 > 0 && frame.p95 <= 100, JSON.stringify(frame));
  await ui.waitFor(`${shown}.total === ${expected}`, 10000);

  // いちばん大きいクラスタを押すと、寄ってほどける
  const before = await ui.run(shown);
  await ui.run(`(() => { const cs = [...document.querySelectorAll('.loca-cluster')];
    cs.sort((a, b) => Number(b.dataset.count) - Number(a.dataset.count)); cs[0].click(); return true; })()`);
  await ui.waitFor('false', 1500);
  await ui.waitFor(`${shown}.max < ${before.max}`, 5000);
  const after = await ui.run(shown);
  ui.check('クラスタを押すと寄って、まとまりが小さくなる', after.max < before.max, `最大 ${before.max} → ${after.max}`);
  await ui.shot('t41-expanded');

  // 動画の個別のピン（中が丸。撮影リクエストは数字）が出るまで、いちばん大きいクラスタを押し続ける
  const videoPin = `.loca-pin:has(circle)`;
  let clicks = 1;
  for (; clicks < 16 && (await ui.count(videoPin)) === 0; clicks += 1) {
    await ui.run(`(() => { const cs = [...document.querySelectorAll('.loca-cluster')];
      cs.sort((a, b) => Number(b.dataset.count) - Number(a.dataset.count)); cs[0]?.click(); return true; })()`);
    await ui.waitFor('false', 1200);
  }
  const pins = await ui.count(videoPin);
  ui.check('寄っていくと動画の個別のピンが出る', pins > 0, `${pins} 本（クラスタを ${clicks} 回押した）`);
  await ui.run(`document.querySelector('${videoPin}')?.click(); true`);
  await ui.waitFor(`location.search.includes('m=')`, 5000);
  ui.check('ピンを押すとマーカーが開く（URL に m が載る）', (await ui.run(`location.search`)).includes('m='));
  await ui.shot('t41-pin');
}
