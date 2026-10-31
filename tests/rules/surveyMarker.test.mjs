/**
 * 公式の紹介のマーカー（ADR 0035・0036）。REST で書いたものの形がルールを満たすか、利用者が公式の印を付けたり変えたりできないかを確かめる。
 * エミュレータはオーナーの Bearer owner をルールの外の書き込みとして扱う。
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { Timestamp, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { PROJECT_ID, newMarker, registerWrite, resetFirestore, seed, setupEnv, stampedWrite } from './helpers.mjs';
import { OPERATOR, RegisterError, createRegister, markerFields } from '../../scripts/lib/survey-marker.mjs';

const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const base = `http://${HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const VIDEO = 'abcdefghijk';
const video = { title: '霧島神宮', channelTitle: '公式', thumbnailUrl: 'https://i.ytimg.com/vi/x/hq.jpg' };
const official = { provider: '霧島市', sourceUrl: 'https://www.city-kirishima.jp/sns.html' };
const input = { videoId: VIDEO, lat: 31.8, lng: 130.8, tags: { subject: 'heritage', mood: 'calm', season: 'autumn' }, memo: '参道', prefecture: '鹿児島県', city: '霧島市', official };

let env;
let reg;
before(async () => { env = await setupEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await resetFirestore(env);
  await seed(env, (db) => setDoc(doc(db, 'admins', 'root'), { addedAt: serverTimestamp() }));
  reg = createRegister({ base, getToken: async () => 'owner', oembed: async () => video });
});
const as = (uid) => env.authenticatedContext(uid).firestore();

describe('調査のページからの登録', () => {
  it('登録すると、マーカーと索引が運営の名前で入り、一覧に公式として出る', async () => {
    const { markerId } = await reg.add(input);
    const db = as('alice');
    const m = (await getDoc(doc(db, 'markers', markerId))).data();
    assert.equal(m.videoId, VIDEO);
    assert.equal(m.youtubeUrl, `https://www.youtube.com/watch?v=${VIDEO}`);
    assert.equal(m.ownerUid, OPERATOR.uid);
    assert.equal(m.createdBy, OPERATOR.nickname);
    assert.equal(m.deleted, false);
    assert.deepEqual(m.official, official);
    assert.deepEqual(m.equipment, { category: '', manufacturer: '', series: '', model: '' });
    assert.ok(m.createdAt.toMillis() > 0 && m.updatedAt.toMillis() === m.createdAt.toMillis());
    assert.deepEqual((await getDoc(doc(db, 'videos', VIDEO))).data(), { markerId, ownerUid: OPERATOR.uid });
    assert.deepEqual((await reg.list()).markers.map((x) => [x.videoId, x.official]), [[VIDEO, true]]);
  });

  it('REST で書いた文書は validMarker を満たす（管理者の通常の更新が通る）', async () => {
    const { markerId } = await reg.add(input);
    await assertSucceeds(updateDoc(doc(as('root'), 'markers', markerId), { memo: '直した', updatedAt: serverTimestamp() }));
  });

  it('同じ動画は 2 回登録できず、利用者も同じ動画を投稿できない', async () => {
    await reg.add(input);
    await assert.rejects(reg.add(input), RegisterError);
    await assertFails(stampedWrite(as('alice'), 'alice', 'm9', newMarker('alice', { videoId: VIDEO })));
  });

  it('必須のタグ・提供元・根拠の URL が無いと書かない', async () => {
    await assert.rejects(reg.add({ ...input, tags: { subject: 'heritage' } }), RegisterError);
    await assert.rejects(reg.add({ ...input, tags: { subject: 'x', mood: 'calm' } }), RegisterError);
    await assert.rejects(reg.add({ ...input, official: { provider: '', sourceUrl: official.sourceUrl } }), RegisterError);
    await assert.rejects(reg.add({ ...input, official: { provider: 'x', sourceUrl: 'javascript:alert(1)' } }), RegisterError);
    assert.deepEqual((await reg.list()).markers, []);
  });

  it('埋め込めない動画は書かない', async () => {
    const none = createRegister({ base, getToken: async () => 'owner', oembed: async () => null });
    await assert.rejects(none.add(input), RegisterError);
    assert.deepEqual((await reg.list()).markers, []);
  });

  it('登録の前でも、運営の名前は新規登録と改名で取れない（ほかの名前は取れる）', async () => {
    const profile = (nickname) => ({ nickname, consentVersion: 1, agreedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    for (const name of [OPERATOR.nickname, 'Loca運営', 'LOCA 運営']) await assertFails(registerWrite(as('dave'), 'dave', profile(name)));
    const rename = (name) => {
      const db = as('alice');
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', 'alice'), { nickname: name, updatedAt: serverTimestamp() });
      batch.delete(doc(db, 'nicknames', 'alice さん'));
      batch.set(doc(db, 'nicknames', name.toLowerCase()), { uid: 'alice' });
      return batch.commit();
    };
    await assertFails(rename(OPERATOR.nickname));
    await assertSucceeds(rename('ありす'));
    await assertSucceeds(registerWrite(as('dave'), 'dave', profile('だいち')));
  });

  it('ルールに合わない値は書かない（座標・長さ・読めない URL）', async () => {
    await assert.rejects(reg.add({ ...input, lat: 91 }), RegisterError);
    await assert.rejects(reg.add({ ...input, prefecture: 'あ'.repeat(21) }), RegisterError);
    await assert.rejects(reg.add({ ...input, official: { provider: 'x', sourceUrl: 'https://a b' } }), RegisterError);
    assert.deepEqual((await reg.list()).markers, []);
  });

  it('削除は論理削除で、索引を外すので同じ動画を登録し直せる', async () => {
    const { markerId } = await reg.add(input);
    await reg.remove({ videoId: VIDEO });
    const db = as('alice');
    const m = (await getDoc(doc(db, 'markers', markerId))).data();
    assert.equal(m.deleted, true);
    assert.ok(m.updatedAt.toMillis() >= m.createdAt.toMillis());
    assert.equal(m.title, video.title);
    assert.equal((await getDoc(doc(db, 'videos', VIDEO))).exists(), false);
    assert.deepEqual((await reg.list()).markers, []);
    await reg.add(input);
  });

  it('利用者の投稿は、ここからは消せない', async () => {
    await assertSucceeds(stampedWrite(as('alice'), 'alice', 'm1', newMarker('alice', { videoId: VIDEO })));
    await assert.rejects(reg.remove({ videoId: VIDEO }), RegisterError);
    assert.deepEqual((await reg.list()).markers.map((x) => x.official), [false]);
  });
});

describe('公式の印はルールが守る', () => {
  it('利用者は公式の印を付けて作れない', async () => {
    await assertFails(stampedWrite(as('alice'), 'alice', 'm1', newMarker('alice', { official })));
  });

  it('利用者は自分の投稿に公式の印を足せない', async () => {
    await assertSucceeds(stampedWrite(as('alice'), 'alice', 'm1', newMarker('alice')));
    await seed(env, (db) => setDoc(doc(db, 'rateLimits', 'alice'), { lastWriteAt: new Date(Date.now() - 60000), target: 'old' }));
    await assertFails(stampedWrite(as('alice'), 'alice', 'm1', { official, updatedAt: serverTimestamp() }, 'update'));
  });

  it('管理者も公式の印は変えられず、論理削除はできる', async () => {
    const { markerId } = await reg.add(input);
    const db = as('root');
    await assertFails(updateDoc(doc(db, 'markers', markerId), { official: { provider: '別', sourceUrl: 'https://example.com/' }, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, 'markers', markerId), { deleted: true, updatedAt: serverTimestamp() }));
  });

  it('形の悪い公式の印はルールが拒む（URL でない根拠）', async () => {
    const { markerId } = await reg.add(input);
    await seed(env, (db) => updateDoc(doc(db, 'markers', markerId), { 'official.sourceUrl': 'javascript:alert(1)' }));
    await assertFails(updateDoc(doc(as('root'), 'markers', markerId), { memo: 'x', updatedAt: serverTimestamp() }));
  });

  it('公式の印は、どの更新の経路でも足せず、管理者も消せない', async () => {
    await assertSucceeds(stampedWrite(as('alice'), 'alice', 'm1', newMarker('alice')));
    const alice = doc(as('alice'), 'markers', 'm1');
    await assertFails(updateDoc(alice, { createdBy: 'べつ', official, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(alice, { deleted: true, official, updatedAt: serverTimestamp() }));
    const { markerId } = await reg.add(input);
    const root = doc(as('root'), 'markers', markerId);
    await assertFails(updateDoc(root, { official: deleteField(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(root, { 'official.provider': '別', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(root, { videoId: 'zyxwvutsrqp', youtubeUrl: 'https://www.youtube.com/watch?v=zyxwvutsrqp', updatedAt: serverTimestamp() }));
    await assertFails(stampedWrite(as('root'), 'root', 'm2', newMarker('root', { official })));
  });

  it('式の上限: 全項目と answers 10 件のマーカーの動画を本人が差し替えられる', async () => {
    const answers = Array.from({ length: 10 }, (_, i) => `req${i}`);
    const full = newMarker('alice', { memo: 'あ'.repeat(80), answers, prefecture: '鹿児島県', city: '霧島市', channelTitle: 'c', thumbnailUrl: 't',
      tags: { subject: 'nature', mood: 'calm', season: 'spring', timeOfDay: 'night', style: 'aerial' },
      equipment: { category: 'drone', manufacturer: 'DJI', series: 'Mini', model: '4' }, createdAt: Timestamp.fromMillis(1), updatedAt: Timestamp.fromMillis(1) });
    await seed(env, (db) => setDoc(doc(db, 'markers', 'm1'), full));
    await seed(env, (db) => setDoc(doc(db, 'rateLimits', 'alice'), { lastWriteAt: new Date(Date.now() - 60000), target: 'old' }));
    const swap = { videoId: 'zyxwvutsrqp', youtubeUrl: 'https://www.youtube.com/watch?v=zyxwvutsrqp', updatedAt: serverTimestamp() };
    await assertSucceeds(stampedWrite(as('alice'), 'alice', 'm1', swap, 'update', { index: true }));
  });

  it('運営の投稿は誰も本人として操作できない（利用者の更新は拒否）', async () => {
    const { markerId } = await reg.add(input);
    await assertFails(updateDoc(doc(as('alice'), 'markers', markerId), { deleted: true, updatedAt: serverTimestamp() }));
  });

  it('掲載の取り下げの依頼を通報できる', async () => {
    const { markerId } = await reg.add(input);
    await assertSucceeds(setDoc(doc(as('alice'), 'reports', `${markerId}_alice`), {
      markerId, reporterUid: 'alice', reasons: ['takedown'], status: 'open', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  });

  it('いいねを付けられる（投稿者が本人でないので）', async () => {
    const { markerId } = await reg.add(input);
    const db = as('alice');
    const batch = writeBatch(db);
    batch.set(doc(db, 'likes', `${markerId}_alice`), { markerId, likerUid: 'alice', deleted: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    batch.set(doc(db, 'likeCounts', markerId), { count: 1, ownerUid: OPERATOR.uid });
    batch.set(doc(db, 'rateLimits', 'alice'), { lastWriteAt: serverTimestamp(), target: markerId });
    await assertSucceeds(batch.commit());
  });
});

// markerFields は純粋な処理なので、形の確かめに使える
describe('markerFields', () => {
  it('公式の印の無い呼び出しは止まる', () => {
    assert.throws(() => markerFields({ ...input, video, official: undefined }), RegisterError);
  });
});
