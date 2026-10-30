/**
 * Firestore アダプタ（src/adapters/firebase/markerStore.ts）を、本番と同じルールのエミュレータに当てる。
 * ルール単体のテスト（tests/rules/）と違い、アプリが実際に組み立てる書き込みが通るかを確かめる。
 *
 * TypeScript と @/ の別名は Vite の ssrLoadModule で解決する。
 * 実行: npm run test:rules（エミュレータの中で tests/rules と一緒に走る）
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { createServer } from 'vite';
import { expireStamp, newMarker, nextVideoId, seed, resetFirestore, setupEnv, urlOf } from '../rules/helpers.mjs';

let env;
let vite;
let createMarkerStore;

before(async () => {
  env = await setupEnv();
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  ({ createMarkerStore } = await vite.ssrLoadModule('/src/adapters/firebase/markerStore.ts'));
});
after(async () => {
  await env.cleanup();
  await vite.close();
});
beforeEach(async () => { await resetFirestore(env); });

const user = (uid) => ({ uid, displayName: `${uid} さん`, email: null, photoUrl: null });
const storeFor = (uid) => createMarkerStore(env.authenticatedContext(uid).firestore(), () => user(uid));

/** 登録内容。動画は呼ぶたびに別のもの（同じ動画は重複の禁止で拒否されるため）。 */
const content = (videoId = nextVideoId()) => ({
  youtubeUrl: urlOf(videoId),
  videoId,
  lat: 35.681,
  lng: 139.767,
  // 任意のタグの未選択は undefined で来る。保存時に落とされること
  tags: { subject: 'nature', mood: 'calm', season: 'autumn', timeOfDay: undefined },
  equipment: { category: '', manufacturer: '', series: '', model: '' },
  title: 'テスト動画',
  city: undefined, // 値の無い項目は保存時に落とされること
});

async function read(id) {
  let data;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), 'markers', id))).data();
  });
  return data;
}

describe('アダプタでの作成・更新・論理削除', () => {
  it('作成すると本人の uid とプロフィールのニックネーム（本名ではない）、未削除で保存される', async () => {
    const id = await storeFor('alice').create(content());
    const saved = await read(id);
    assert.equal(saved.ownerUid, 'alice');
    assert.equal(saved.createdBy, 'alice さん');
    assert.equal(saved.deleted, false);
    assert.equal('city' in saved, false);
    assert.deepEqual(saved.tags, { subject: 'nature', mood: 'calm', season: 'autumn' });
  });

  it('プロフィール未登録なら、登録を促すエラーで止まる（ADR 0019）', async () => {
    await assert.rejects(storeFor('dave').create(content()), /プロフィールを登録/);
  });

  it('現地メモを空にして更新すると、項目ごと消える', async () => {
    const store = storeFor('alice');
    const id = await store.create({ ...content(), memo: '北側の展望台から' });
    assert.equal((await read(id)).memo, '北側の展望台から');
    await expireStamp(env, 'alice');
    await store.update(id, { memo: undefined });
    assert.equal('memo' in (await read(id)), false);
  });

  it('本人は更新できる（6 秒あけたあと）', async () => {
    const store = storeFor('alice');
    const id = await store.create(content());
    await expireStamp(env, 'alice');
    await store.update(id, { title: '書き換えた' });
    assert.equal((await read(id)).title, '書き換えた');
  });

  it('本人は論理削除できる', async () => {
    const store = storeFor('alice');
    const id = await store.create(content());
    await expireStamp(env, 'alice');
    await store.softDelete(id);
    assert.equal((await read(id)).deleted, true);
  });
});

describe('1.4 差分の購読（別のタブの変更が届く）', () => {
  /** 条件を満たす通知が来るまで待つ。来なければ 5 秒で失敗させる。 */
  function waitFor(store, sinceMs, predicate) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { stop(); reject(new Error('5 秒以内に通知が来ない')); }, 5000);
      const stop = store.subscribeChanges(sinceMs, (rows) => {
        const hit = rows.find(predicate);
        if (!hit) return;
        clearTimeout(timer);
        stop();
        resolve(hit);
      }, (e) => { clearTimeout(timer); stop(); reject(e); });
    });
  }

  it('未ログインの閲覧者に、他人の新規登録が届く', async () => {
    const viewer = createMarkerStore(env.unauthenticatedContext().firestore(), () => null);
    const arrived = waitFor(viewer, Date.now() - 60_000, (m) => m.title === 'テスト動画');
    const id = await storeFor('alice').create(content());
    const got = await arrived;
    assert.equal(got.id, id);
    assert.equal(got.deleted, false);
    assert.ok(got.updatedAt > 0, 'updatedAt が epoch ms になっている');
  });

  it('論理削除は deleted: true の行として届く', async () => {
    const store = storeFor('alice');
    const id = await store.create(content());
    await expireStamp(env, 'alice');
    const viewer = createMarkerStore(env.unauthenticatedContext().firestore(), () => null);
    const arrived = waitFor(viewer, Date.now() - 60_000, (m) => m.id === id && m.deleted);
    await store.softDelete(id);
    assert.equal((await arrived).deleted, true);
  });

  it('markers.json の生成時刻より前の行は届かない', async () => {
    await storeFor('alice').create(content());
    const viewer = createMarkerStore(env.unauthenticatedContext().firestore(), () => null);
    const future = Date.now() + 3_600_000;
    await assert.rejects(waitFor(viewer, future, () => true), /5 秒以内/);
  });
});

describe('重複動画の禁止（videos/{videoId} の索引）', () => {
  it('同じ動画は 2 件目を登録できない（別の利用者でも）', async () => {
    const video = content();
    await storeFor('alice').create(video);
    await assert.rejects(storeFor('bob').create({ ...video }), { name: 'UpstreamError', message: /すでに登録/ });
  });

  it('画面の確認を飛ばしても、ルールが二重登録を拒否する', async () => {
    const video = content();
    await storeFor('alice').create(video);
    await seed(env, (db) => deleteDoc(doc(db, 'videos', video.videoId)));
    await seed(env, (db) => setDoc(doc(db, 'videos', video.videoId), { markerId: 'other', ownerUid: 'alice' }));
    const bobDb = env.authenticatedContext('bob').firestore();
    const batch = writeBatch(bobDb);
    batch.set(doc(bobDb, 'rateLimits', 'bob'), { lastWriteAt: serverTimestamp(), target: 'm2' });
    batch.set(doc(bobDb, 'markers', 'm2'), newMarker('bob', { videoId: video.videoId }));
    batch.set(doc(bobDb, 'videos', video.videoId), { markerId: 'm2', ownerUid: 'bob' });
    await assert.rejects(batch.commit());
  });

  it('管理者が禁止した動画は登録できない', async () => {
    const video = content();
    await seed(env, (db) => setDoc(doc(db, 'videos', video.videoId), { blocked: true, reason: 'スパム' }));
    await assert.rejects(storeFor('alice').create(video), { name: 'UpstreamError', message: /登録できません/ });
  });

  it('本人が論理削除すると索引が外れ、同じ動画を登録し直せる', async () => {
    const store = storeFor('alice');
    const video = content();
    const id = await store.create(video);
    await expireStamp(env, 'alice');
    await store.softDelete(id);
    await expireStamp(env, 'alice');
    await store.create({ ...video });
  });

  it('動画を差し替えると、古い動画の索引が外れて新しい動画の索引ができる', async () => {
    const store = storeFor('alice');
    const oldVideo = content();
    const id = await store.create(oldVideo);
    await expireStamp(env, 'alice');
    const next = content();
    await store.update(id, { youtubeUrl: next.youtubeUrl, videoId: next.videoId });
    let oldIndex;
    let newIndex;
    await env.withSecurityRulesDisabled(async (ctx) => {
      oldIndex = (await getDoc(doc(ctx.firestore(), 'videos', oldVideo.videoId))).exists();
      newIndex = (await getDoc(doc(ctx.firestore(), 'videos', next.videoId))).data();
    });
    assert.equal(oldIndex, false);
    assert.equal(newIndex.markerId, id);
  });
});

describe('拒否されたときのエラー', () => {
  it('6 秒以内の連続保存は UpstreamError（permission-denied）', async () => {
    const store = storeFor('alice');
    await store.create(content());
    await assert.rejects(store.create(content()), { name: 'UpstreamError', message: /6 秒/ });
  });

  it('他人のマーカーは更新できない', async () => {
    const id = await storeFor('alice').create(content());
    await assert.rejects(storeFor('bob').update(id, { title: '乗っ取り' }), { name: 'UpstreamError' });
  });

  it('未ログインでは通信する前に UpstreamError', async () => {
    const guest = createMarkerStore(env.unauthenticatedContext().firestore(), () => null);
    await assert.rejects(guest.create(content()), { name: 'UpstreamError', message: /ログイン/ });
  });
});
