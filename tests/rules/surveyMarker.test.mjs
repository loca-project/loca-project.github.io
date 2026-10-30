/**
 * 地域の調査のページからの登録・削除（ADR 0035）。REST で書いたものが、サイトの書き込みと同じ形（validMarker）を満たすかを確かめる。
 * エミュレータはオーナーの Bearer owner をルールの外の書き込みとして扱う。
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { PROJECT_ID, resetFirestore, setupEnv, stampedWrite } from './helpers.mjs';
import { RegisterError, createRegister, markerFields } from '../../scripts/lib/survey-marker.mjs';

const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const base = `http://${HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const VIDEO = 'abcdefghijk';
const account = { uid: 'alice', nickname: 'alice さん' };
const video = { title: '霧島神宮', channelTitle: '公式', thumbnailUrl: 'https://i.ytimg.com/vi/x/hq.jpg' };
const input = { videoId: VIDEO, lat: 31.8, lng: 130.8, tags: { subject: 'heritage', mood: 'calm', season: 'autumn' }, memo: '参道', prefecture: '鹿児島県', city: '霧島市' };

let env;
let reg;
before(async () => { env = await setupEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await resetFirestore(env);
  reg = createRegister({ base, getToken: async () => 'owner', getAccount: async () => account, oembed: async () => video });
});
const alice = () => env.authenticatedContext('alice').firestore();

describe('調査のページからの登録', () => {
  it('REST で書く項目は、ルールの作成を通る', async () => {
    const data = { ...markerFields({ ...input, video, account }), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertSucceeds(stampedWrite(alice(), 'alice', 'm1', data));
  });

  it('登録すると、マーカーと索引がサイトと同じ形で入り、一覧に出る', async () => {
    const { markerId } = await reg.add(input);
    const db = alice();
    const m = (await getDoc(doc(db, 'markers', markerId))).data();
    assert.equal(m.videoId, VIDEO);
    assert.equal(m.youtubeUrl, `https://www.youtube.com/watch?v=${VIDEO}`);
    assert.equal(m.ownerUid, 'alice');
    assert.equal(m.createdBy, 'alice さん');
    assert.equal(m.deleted, false);
    assert.deepEqual(m.equipment, { category: '', manufacturer: '', series: '', model: '' });
    assert.ok(m.createdAt.toMillis() > 0 && m.updatedAt.toMillis() === m.createdAt.toMillis());
    assert.deepEqual((await getDoc(doc(db, 'videos', VIDEO))).data(), { markerId, ownerUid: 'alice' });
    const { markers } = await reg.list();
    assert.deepEqual(markers.map((x) => [x.videoId, x.mine]), [[VIDEO, true]]);
    // 書いた文書は、本人がサイトから論理削除できる
    await assertSucceeds(updateDoc(doc(db, 'markers', markerId), { deleted: true, updatedAt: serverTimestamp() }));
  });

  it('同じ動画は 2 回登録できない', async () => {
    await reg.add(input);
    await assert.rejects(reg.add(input), RegisterError);
  });

  it('必須のタグが無いと書かない', async () => {
    await assert.rejects(reg.add({ ...input, tags: { subject: 'heritage' } }), RegisterError);
    await assert.rejects(reg.add({ ...input, tags: { subject: 'x', mood: 'calm' } }), RegisterError);
    assert.deepEqual((await reg.list()).markers, []);
  });

  it('埋め込めない動画は書かない', async () => {
    const none = createRegister({ base, getToken: async () => 'owner', getAccount: async () => account, oembed: async () => null });
    await assert.rejects(none.add(input), RegisterError);
    assert.deepEqual((await reg.list()).markers, []);
  });

  it('削除は論理削除で、索引を外すので同じ動画を登録し直せる', async () => {
    const { markerId } = await reg.add(input);
    await reg.remove({ videoId: VIDEO });
    const db = alice();
    const m = (await getDoc(doc(db, 'markers', markerId))).data();
    assert.equal(m.deleted, true);
    assert.ok(m.updatedAt.toMillis() >= m.createdAt.toMillis());
    assert.equal(m.title, video.title);
    assert.equal((await getDoc(doc(db, 'videos', VIDEO))).exists(), false);
    assert.deepEqual((await reg.list()).markers, []);
    await reg.add(input);
  });

  it('別の人が登録した動画は消せない', async () => {
    await reg.add(input);
    const bob = createRegister({ base, getToken: async () => 'owner', getAccount: async () => ({ uid: 'bob', nickname: 'bob さん' }), oembed: async () => video });
    await assert.rejects(bob.remove({ videoId: VIDEO }), RegisterError);
    assert.deepEqual((await bob.list()).markers.map((x) => x.mine), [false]);
  });
});
