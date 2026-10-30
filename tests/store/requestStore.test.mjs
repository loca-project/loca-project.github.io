/**
 * 撮影リクエストのアダプタ（src/adapters/firebase/requestStore.ts）と地点の集計（src/core/logic/requests.ts）。
 * 本番と同じルールのエミュレータに当てる。実行: npm run test:rules
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { resetFirestore, setupEnv } from '../rules/helpers.mjs';

let env;
let vite;
let createRequestStore;
let mergeRequestEntries;
let removeRequestEntries;
let requestBreakdown;

before(async () => {
  env = await setupEnv();
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  ({ createRequestStore } = await vite.ssrLoadModule('/src/adapters/firebase/requestStore.ts'));
  ({ mergeRequestEntries, removeRequestEntries, requestBreakdown } = await vite.ssrLoadModule('/src/core/logic/requests.ts'));
});
after(async () => {
  await env.cleanup();
  await vite.close();
});
beforeEach(async () => { await resetFirestore(env); });

const user = (uid) => ({ uid, displayName: uid, email: null, photoUrl: null });
const storeFor = (uid) => createRequestStore(env.authenticatedContext(uid).firestore(), () => user(uid));
const content = (heat, lat = 35.0) => ({
  lat, lng: 135.0, heat, season: 'spring', timeOfDay: 'morning', style: 'aerial',
  equipment: { category: '', manufacturer: '', series: '', model: '' },
});

describe('アダプタでの作成と熱量の上限', () => {
  it('作成すると使った熱量が増える', async () => {
    const store = storeFor('alice');
    assert.equal(await store.heatUsed(), 0);
    const entry = await store.create(content(3));
    assert.equal(entry.heat, 3);
    assert.equal(await store.heatUsed(), 3);
  });

  it('合計 5 を超える分は、通信する前に UpstreamError', async () => {
    const store = storeFor('alice');
    await store.create(content(3));
    await assert.rejects(store.create(content(3)), { name: 'UpstreamError', message: /3 \/ 5/ });
    await store.create(content(2));
    assert.equal(await store.heatUsed(), 5);
  });

  it('未ログインは UpstreamError', async () => {
    const guest = createRequestStore(env.unauthenticatedContext().firestore(), () => null);
    await assert.rejects(guest.create(content(1)), { name: 'UpstreamError', message: /ログイン/ });
  });
});

describe('差分の購読', () => {
  it('未ログインの閲覧者に、他人のリクエストが届く', async () => {
    const viewer = createRequestStore(env.unauthenticatedContext().firestore(), () => null);
    const arrived = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { stop(); reject(new Error('5 秒以内に通知が来ない')); }, 5000);
      const stop = viewer.subscribeChanges(Date.now() - 60_000, (rows) => {
        clearTimeout(timer);
        stop();
        resolve(rows);
      }, reject);
    });
    const saved = await storeFor('alice').create(content(2));
    const rows = await arrived;
    assert.equal(rows[0].id, saved.id);
    assert.equal(rows[0].heat, 2);
  });
});

describe('取り下げ（熱量が戻る）', () => {
  it('取り下げると使った熱量が戻り、また作成できる', async () => {
    const store = storeFor('alice');
    const first = await store.create(content(3));
    await store.create(content(2));
    assert.equal(await store.heatUsed(), 5);
    await store.withdraw({ id: first.id, heat: first.heat });
    assert.equal(await store.heatUsed(), 2);
    await store.create(content(3));
    assert.equal(await store.heatUsed(), 5);
  });

  it('他人のリクエストは取り下げられない', async () => {
    const entry = await storeFor('alice').create(content(2));
    await assert.rejects(storeFor('bob').withdraw({ id: entry.id, heat: entry.heat }), { name: 'UpstreamError' });
  });

  it('取り下げは購読で removedIds として届く', async () => {
    const entry = await storeFor('alice').create(content(1));
    const viewer = createRequestStore(env.unauthenticatedContext().firestore(), () => null);
    const removed = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { stop(); reject(new Error('5 秒以内に通知が来ない')); }, 5000);
      const stop = viewer.subscribeChanges(Date.now() - 60_000, (_added, ids) => {
        if (!ids.includes(entry.id)) return;
        clearTimeout(timer);
        stop();
        resolve(ids);
      }, reject);
    });
    await new Promise((r) => setTimeout(r, 300));
    await storeFor('alice').withdraw({ id: entry.id, heat: entry.heat });
    assert.deepEqual(await removed, [entry.id]);
  });
  it('同期より前に作られたリクエストの取り下げも、購読で届く（ADR 0013 の回帰テスト）', async () => {
    const entry = await storeFor('alice').create(content(1));
    // 作成の後に同期が走った、という状況（syncedAt が作成より後）
    await new Promise((r) => setTimeout(r, 50));
    const syncedAt = Date.now();
    const viewer = createRequestStore(env.unauthenticatedContext().firestore(), () => null);
    const removed = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { stop(); reject(new Error('5 秒以内に通知が来ない')); }, 5000);
      const stop = viewer.subscribeChanges(syncedAt, (_added, ids) => {
        if (!ids.includes(entry.id)) return;
        clearTimeout(timer);
        stop();
        resolve(ids);
      }, reject);
    });
    await new Promise((r) => setTimeout(r, 300));
    await storeFor('alice').withdraw({ id: entry.id, heat: entry.heat });
    assert.deepEqual(await removed, [entry.id]);
  });
});

describe('集計から外す・内訳（removeRequestEntries / requestBreakdown）', () => {
  const entry = (id, heat, over = {}) => ({ ...content(heat), id, ownerUid: 'u1', createdAt: 1000, ...over });

  it('外すと合計と件数が減り、空になった地点は消える', () => {
    const spots = mergeRequestEntries([], [entry('a', 2), entry('b', 3)]);
    const after = removeRequestEntries(spots, ['a']);
    assert.equal(after[0].totalHeat, 3);
    assert.equal(after[0].requestCount, 1);
    assert.equal(removeRequestEntries(after, ['b']).length, 0);
  });

  it('内訳は件数ではなく熱量の合計で、多い順に並ぶ', () => {
    const spots = mergeRequestEntries([], [
      entry('a', 1, { season: '春' }),
      entry('b', 1, { season: '春' }),
      entry('c', 5, { season: '冬' }),
    ]);
    const { season } = requestBreakdown(spots[0]);
    assert.deepEqual(season, [{ label: '冬', count: 5 }, { label: '春', count: 2 }]);
  });
});

describe('地点ごとの集計（mergeRequestEntries）', () => {
  const entry = (id, heat, lat = 35.0) => ({ ...content(heat, lat), id, createdAt: 1000 });

  it('近いリクエストは同じ地点に足し、遠ければ新しい地点を作る', () => {
    const spots = mergeRequestEntries([], [entry('a', 2), entry('b', 3, 35.0001), entry('c', 1, 36.0)]);
    assert.equal(spots.length, 2);
    const near = spots.find((s) => s.requestCount === 2);
    assert.equal(near.totalHeat, 5);
  });

  it('集計済みの ID は二重に数えない（requests.json と購読の両方に来る）', () => {
    const once = mergeRequestEntries([], [entry('a', 2)]);
    const twice = mergeRequestEntries(once, [entry('a', 2)]);
    assert.equal(twice[0].totalHeat, 2);
    assert.equal(twice[0].requestCount, 1);
  });

  it('entries を持たない地点にも、合計を壊さずに足せる', () => {
    const spots = mergeRequestEntries(
      [{ id: 'rq_1', lat: 35.0, lng: 135.0, totalHeat: 4, requestCount: 2, updatedAt: 0 }],
      [entry('a', 1)],
    );
    assert.equal(spots[0].totalHeat, 5);
    assert.equal(spots[0].requestCount, 3);
  });
});

describe('受け取り（T43・ADR 0028）', () => {
  it('依頼者が受け取ると熱量が戻り、動画の炎と件数が足される。2 件目は炎が積み上がる', async () => {
    const { doc, getDoc, setDoc } = await import('firebase/firestore');
    const { seed, storedMarker } = await import('../rules/helpers.mjs');
    const alice = storeFor('alice');
    const r1 = await alice.create(content(3));
    // 別の地点として（地点をまとめる幅 0.0003 度より遠く）、応えた動画の近く（0.01 度以内）に置く
    const r2 = await alice.create(content(2, 35.005));
    const { Timestamp } = await import('firebase/firestore');
    // 受け取れるのはリクエストから 3 時間以上たって登録された動画（ADR 0028）
    const soon = Timestamp.fromMillis(Date.now() + 4 * 3_600_000);
    await seed(env, (db) => setDoc(doc(db, 'markers', 'm1'),
      storedMarker('bob', { answers: [r1.id, r2.id], lat: 35.0, lng: 135.0, createdAt: soon, updatedAt: soon })));
    await alice.receive({ id: r1.id, heat: 3 }, { id: 'm1', ownerUid: 'bob' });
    assert.equal(await alice.heatUsed(), 2);
    await alice.receive({ id: r2.id, heat: 2 }, { id: 'm1', ownerUid: 'bob' });
    assert.equal(await alice.heatUsed(), 0);
    const counts = (await getDoc(doc(env.unauthenticatedContext().firestore(), 'answerCounts', 'm1'))).data();
    assert.deepEqual({ heat: counts.heat, count: counts.count, ownerUid: counts.ownerUid }, { heat: 5, count: 2, ownerUid: 'bob' });
  });

  it('応えていない動画は、理由の分かる UpstreamError', async () => {
    const { doc, setDoc } = await import('firebase/firestore');
    const { seed, storedMarker } = await import('../rules/helpers.mjs');
    const alice = storeFor('alice');
    const r1 = await alice.create(content(1));
    await seed(env, (db) => setDoc(doc(db, 'markers', 'm2'), storedMarker('bob')));
    await assert.rejects(alice.receive({ id: r1.id, heat: 1 }, { id: 'm2', ownerUid: 'bob' }), /受け取りが拒否されました/);
  });
});

describe('炎を読む（公開プロフィール・マーカー情報。T82）', () => {
  it('未ログインでも、動画の炎と投稿者の動画ごとの炎を読める', async () => {
    const { doc, setDoc } = await import('firebase/firestore');
    const { seed } = await import('../rules/helpers.mjs');
    await seed(env, async (db) => {
      await setDoc(doc(db, 'answerCounts', 'm1'), { heat: 3, count: 1, ownerUid: 'bob', last: 'r1' });
      await setDoc(doc(db, 'answerCounts', 'm2'), { heat: 5, count: 2, ownerUid: 'bob', last: 'r3' });
      await setDoc(doc(db, 'answerCounts', 'm3'), { heat: 1, count: 1, ownerUid: 'carol', last: 'r4' });
    });
    const guest = createRequestStore(env.unauthenticatedContext().firestore(), () => null);
    assert.deepEqual(await guest.flamesOf('m2'), { heat: 5, count: 2 });
    assert.deepEqual(await guest.flamesOf('none'), { heat: 0, count: 0 });
    assert.deepEqual(await guest.flamesBy('bob'), { m1: { heat: 3, count: 1 }, m2: { heat: 5, count: 2 } });
    assert.deepEqual(await guest.flamesBy('alice'), {});
  });
});
