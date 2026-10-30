/**
 * アカウント削除でアダプタが行う Firestore の手順（要件 2.7・ADR 0021）を、本番と同じルールのエミュレータに当てる。
 * ログインの登録の削除（Firebase Authentication）はエミュレータの外なので、ここでは確かめない。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { createServer } from 'vite';
import { resetFirestore, seed, setupEnv, storedMarker } from '../rules/helpers.mjs';

let env;
let vite;
let stores;

before(async () => {
  env = await setupEnv();
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  stores = {
    marker: (await vite.ssrLoadModule('/src/adapters/firebase/markerStore.ts')).createMarkerStore,
    request: (await vite.ssrLoadModule('/src/adapters/firebase/requestStore.ts')).createRequestStore,
    profile: (await vite.ssrLoadModule('/src/adapters/firebase/profileStore.ts')).createProfileStore,
  };
});
after(async () => {
  await env.cleanup();
  await vite.close();
});
beforeEach(async () => { await resetFirestore(env); });

const user = (uid) => ({ uid, displayName: uid, email: null, photoUrl: null });
const storeOf = (kind, uid) => stores[kind](env.authenticatedContext(uid).firestore(), () => user(uid));

/** ルールを通さずにコレクションを読む（ID → データ）。 */
async function all(name) {
  const rows = {};
  await env.withSecurityRulesDisabled(async (ctx) => {
    (await getDocs(collection(ctx.firestore(), name))).forEach((d) => { rows[d.id] = d.data(); });
  });
  return rows;
}

describe('マーカーをすべて論理削除する', () => {
  beforeEach(async () => {
    await seed(env, async (db) => {
      for (let i = 0; i < 7; i += 1) {
        const m = storedMarker('alice');
        await setDoc(doc(db, 'markers', `a${i}`), m);
        // 1 本だけ管理者が禁止した動画（索引は外さない）
        await setDoc(doc(db, 'videos', m.videoId), { markerId: `a${i}`, ownerUid: 'alice', ...(i === 0 ? { blocked: true } : {}) });
      }
      await setDoc(doc(db, 'markers', 'b1'), storedMarker('bob'));
    });
  });

  it('本人の 7 件（3 件ずつのバッチ）が消え、禁止の印の無い動画の索引が外れる。他人のは残る', async () => {
    assert.equal(await storeOf('marker', 'alice').softDeleteAllMine(), 7);
    const markers = await all('markers');
    assert.ok(Object.keys(markers).filter((id) => id.startsWith('a')).every((id) => markers[id].deleted === true));
    assert.equal(markers.b1.deleted, false);
    const videos = Object.values(await all('videos'));
    assert.equal(videos.length, 1);
    assert.equal(videos[0].blocked, true);
  });

  it('もう一度呼ぶと 0 件（途中で止まっても続きから進められる）', async () => {
    const store = storeOf('marker', 'alice');
    await store.softDeleteAllMine();
    assert.equal(await store.softDeleteAllMine(), 0);
  });
});

describe('撮影リクエストをすべて取り下げる', () => {
  it('本人のリクエストがすべて取り下げられ、熱量が 0 に戻る', async () => {
    const store = storeOf('request', 'alice');
    const content = (heat, lat) => ({ lat, lng: 135, heat, equipment: { category: '', manufacturer: '', series: '', model: '' } });
    await store.create(content(2, 35));
    await store.create(content(3, 36));
    assert.equal(await store.withdrawAllMine(), 2);
    const requests = Object.values(await all('requests'));
    assert.ok(requests.every((r) => r.withdrawn === true));
    assert.equal(await store.heatUsed(), 0);
  });
});

describe('プロフィールを消す', () => {
  it('プロフィールと名前の索引が消え、ほかの人がその名前を使えるようになる', async () => {
    await storeOf('profile', 'alice').remove();
    await env.withSecurityRulesDisabled(async (ctx) => {
      assert.equal((await getDoc(doc(ctx.firestore(), 'users', 'alice'))).exists(), false);
      assert.equal((await getDoc(doc(ctx.firestore(), 'nicknames', 'alice さん'))).exists(), false);
    });
    await storeOf('profile', 'dave').register('alice さん');
  });

  it('プロフィールが無くても（途中で止まったあとの再実行）失敗しない', async () => {
    const store = storeOf('profile', 'alice');
    await store.remove();
    await store.remove();
  });
});

describe('選んだマーカーだけを論理削除する（自分の投稿の一括削除。T53 改訂）', () => {
  it('選んだ本人のマーカーだけが消え、選んでいない・他人のは残る', async () => {
    await seed(env, async (db) => {
      for (const id of ['a1', 'a2', 'a3']) await setDoc(doc(db, 'markers', id), storedMarker('alice'));
      await setDoc(doc(db, 'markers', 'b1'), storedMarker('bob'));
    });
    assert.equal(await storeOf('marker', 'alice').softDeleteMine(['a1', 'a3', 'b1']), 2);
    const markers = await all('markers');
    assert.deepEqual(['a1', 'a2', 'a3', 'b1'].map((id) => markers[id].deleted), [true, false, true, false]);
  });
});
