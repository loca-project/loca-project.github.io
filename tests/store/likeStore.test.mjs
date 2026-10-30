/**
 * いいねのアダプタ（src/adapters/firebase/likeStore.ts）。本番と同じルールのエミュレータに当てる。
 * 実行: npm run test:rules
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createServer } from 'vite';
import { expireStamp, seed, resetFirestore, setupEnv, storedMarker } from '../rules/helpers.mjs';

let env;
let vite;
let createLikeStore;

before(async () => {
  env = await setupEnv();
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  ({ createLikeStore } = await vite.ssrLoadModule('/src/adapters/firebase/likeStore.ts'));
});
after(async () => {
  await env.cleanup();
  await vite.close();
});
beforeEach(async () => {
  await resetFirestore(env);
  await seed(env, async (db) => {
    await setDoc(doc(db, 'markers', 'm1'), storedMarker('alice'));
    await setDoc(doc(db, 'markers', 'm2'), storedMarker('alice'));
    await setDoc(doc(db, 'markers', 'b1'), storedMarker('bob'));
  });
});

const storeFor = (uid) => createLikeStore(env.authenticatedContext(uid).firestore(), () => ({ uid, displayName: uid, email: null, photoUrl: null }));
const guestStore = () => createLikeStore(env.unauthenticatedContext().firestore(), () => null);
const m1 = { id: 'm1', ownerUid: 'alice' };

async function stored(path) {
  let data;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data();
  });
  return data;
}

describe('いいねのアダプタ', () => {
  it('付ける・外す・付け直すたびに件数が増減し、状態が返る', async () => {
    const bob = storeFor('bob');
    assert.deepEqual(await bob.state('m1'), { count: 0, liked: false });
    assert.deepEqual(await bob.set(m1, true), { count: 1, liked: true });
    await expireStamp(env, 'bob');
    assert.deepEqual(await storeFor('carol').set(m1, true), { count: 2, liked: true });
    assert.deepEqual(await bob.set(m1, false), { count: 1, liked: false });
    await expireStamp(env, 'bob');
    assert.deepEqual(await bob.set(m1, true), { count: 2, liked: true });
    assert.deepEqual(await bob.state('m1'), { count: 2, liked: true });
    assert.deepEqual(await stored('likeCounts/m1'), { count: 2, ownerUid: 'alice' });
  });

  it('すでにその状態なら書かずに今の状態を返す（連打で件数がずれない）', async () => {
    const bob = storeFor('bob');
    await bob.set(m1, true);
    assert.deepEqual(await bob.set(m1, true), { count: 1, liked: true });
    assert.equal((await stored('likeCounts/m1')).count, 1);
  });

  it('未ログインは件数だけ読め、付けるのは UpstreamError', async () => {
    await storeFor('bob').set(m1, true);
    assert.deepEqual(await guestStore().state('m1'), { count: 1, liked: false });
    await assert.rejects(guestStore().set(m1, true), { name: 'UpstreamError' });
  });

  it('自分のマーカー・6 秒以内の続けてのいいねは UpstreamError', async () => {
    await assert.rejects(storeFor('alice').set(m1, true), { name: 'UpstreamError' });
    const bob = storeFor('bob');
    await bob.set(m1, true);
    await assert.rejects(bob.set({ id: 'm2', ownerUid: 'alice' }, true), { name: 'UpstreamError' });
  });

  it('受け取った件数は自分のマーカーの分だけ、0 件は含めない', async () => {
    await storeFor('bob').set(m1, true);
    await storeFor('carol').set(m1, true);
    await storeFor('carol').set({ id: 'b1', ownerUid: 'bob' }, false);
    assert.deepEqual(await storeFor('alice').receivedByMine(), { m1: 2 });
    assert.deepEqual(await storeFor('bob').receivedByMine(), {});
  });

  it('アカウント削除: 付けたいいねをすべて外し、件数が戻る', async () => {
    const bob = storeFor('bob');
    await bob.set(m1, true);
    await expireStamp(env, 'bob');
    await bob.set({ id: 'm2', ownerUid: 'alice' }, true);
    await storeFor('carol').set(m1, true);
    assert.equal(await bob.unlikeAllMine(), 2);
    assert.equal((await stored('likeCounts/m1')).count, 1);
    assert.equal((await stored('likeCounts/m2')).count, 0);
    assert.equal(await bob.unlikeAllMine(), 0, '2 回目は外すものが無い');
  });
});

describe('投稿者の動画が受け取ったいいね（公開プロフィール。T82）', () => {
  it('未ログインでも、投稿者の件数の文書を動画ごとに読める（ほかの人の分は入らない）', async () => {
    await seed(env, async (db) => {
      await setDoc(doc(db, 'likeCounts', 'a1'), { count: 3, ownerUid: 'alice' });
      await setDoc(doc(db, 'likeCounts', 'a2'), { count: 2, ownerUid: 'alice' });
      await setDoc(doc(db, 'likeCounts', 'b1'), { count: 7, ownerUid: 'bob' });
    });
    assert.deepEqual(await guestStore().receivedBy('alice'), { a1: 3, a2: 2 });
    assert.deepEqual(await guestStore().receivedBy('carol'), {});
  });
});
