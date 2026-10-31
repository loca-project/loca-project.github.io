/**
 * YouTube Data API の結果から、更新と論理削除の計画を立てる（scripts/lib/youtube-refresh.mjs。T24）。通信しない。
 * 実行: npm run test:scripts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MISSING_WINDOW_MS, missingTargets, parseDuration, planRefresh } from '../../scripts/lib/youtube-refresh.mjs';

const marker = (id, videoId = `v_${id}`) => ({ id, videoId });
const item = (videoId, over = {}) => ({
  id: videoId,
  snippet: { publishedAt: '2026-01-02T03:04:05Z' },
  statistics: { viewCount: '1234', likeCount: '56' },
  contentDetails: { duration: 'PT4M13S' },
  status: { privacyStatus: 'public', uploadStatus: 'processed' },
  ...over,
});

describe('parseDuration', () => {
  it('ISO 8601 の長さを秒にする', () => {
    assert.equal(parseDuration('PT4M13S'), 253);
    assert.equal(parseDuration('PT1H2M3S'), 3723);
    assert.equal(parseDuration('P1DT1S'), 86401);
    assert.equal(parseDuration('PT0S'), 0);
  });
  it('読めない値は null（0 と区別する）', () => {
    assert.equal(parseDuration(''), null);
    assert.equal(parseDuration('4:13'), null);
  });
});

describe('planRefresh', () => {
  it('公開中の動画は再生数・投稿日・長さで更新する（数値は数にする）', () => {
    const plan = planRefresh([marker('a')], [item('v_a')]);
    assert.deepEqual(plan.updates, [
      { id: 'a', youtube: { viewCount: 1234, likeCount: 56, publishedAt: '2026-01-02T03:04:05Z', durationSec: 253 } },
    ]);
    assert.deepEqual(plan.gone, []);
  });

  it('API が返さない動画と非公開の動画は、消えたものとして論理削除の対象にする', () => {
    const plan = planRefresh([marker('a'), marker('b'), marker('c')], [item('v_a'), item('v_c', { status: { privacyStatus: 'private' } })]);
    assert.deepEqual(plan.gone.sort(), ['b', 'c']);
    assert.deepEqual(plan.updates.map((u) => u.id), ['a']);
  });

  it('公式の紹介も利用者の投稿と同じに扱い、消えた動画は論理削除の対象にする（ADR 0037）', () => {
    const official = { ...marker('o'), official: { provider: '鹿児島県', sourceUrl: 'https://example.com/' }, ownerUid: 'loca-official' };
    assert.deepEqual(planRefresh([official], []).gone, ['o']);
    assert.deepEqual(planRefresh([official], [item('v_o')]).updates.map((u) => u.id), ['o']);
  });

  it('限定公開は再生できるので残す', () => {
    const plan = planRefresh([marker('a')], [item('v_a', { status: { privacyStatus: 'unlisted', uploadStatus: 'processed' } })]);
    assert.deepEqual(plan.gone, []);
  });

  it('再生数を隠している動画は、再生数だけ持たない', () => {
    const plan = planRefresh([marker('a')], [item('v_a', { statistics: {} })]);
    assert.equal('viewCount' in plan.updates[0].youtube, false);
    assert.equal(plan.updates[0].youtube.durationSec, 253);
  });

  it('10 件以上あって 2 割を超えて消えたと出たら、削除を止める（API の異常で消しすぎないため）', () => {
    const markers = Array.from({ length: 10 }, (_, i) => marker(String(i)));
    const alive = markers.slice(0, 7).map((m) => item(m.videoId));
    const plan = planRefresh(markers, alive);
    assert.deepEqual(plan.gone, []);
    assert.equal(plan.blockedGone, 3);
  });

  it('10 件未満なら割合では止めない', () => {
    const plan = planRefresh([marker('a'), marker('b')], [item('v_a')]);
    assert.deepEqual(plan.gone, ['b']);
    assert.equal(plan.blockedGone, 0);
  });
});

describe('missingTargets（毎時の更新。T57）', () => {
  it('YouTube の情報が無く、論理削除されておらず、動画 ID があるものだけ', () => {
    const rows = [
      { id: 'new', videoId: 'v1' },
      { id: 'done', videoId: 'v2', youtube: { viewCount: 1 } },
      { id: 'gone', videoId: 'v3', deleted: true },
      { id: 'broken' },
    ];
    assert.deepEqual(missingTargets(rows).map((m) => m.id), ['new']);
  });

  it('読む範囲は 1 日より長い（毎晩の全件更新が 1 回失敗しても拾える）', () => {
    assert.ok(MISSING_WINDOW_MS > 24 * 60 * 60 * 1000);
  });
});
