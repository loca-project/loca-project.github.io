/**
 * 管理者モードのアダプタ（src/adapters/firebase/adminStore.ts。T27）を、本番と同じルールのエミュレータに当てる。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { createServer } from 'vite';
import { resetFirestore, seed, setupEnv } from '../rules/helpers.mjs';

let env;
let vite;
let createAdminStore;

before(async () => {
  env = await setupEnv();
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  ({ createAdminStore } = await vite.ssrLoadModule('/src/adapters/firebase/adminStore.ts'));
});
after(async () => {
  await env.cleanup();
  await vite.close();
});
beforeEach(async () => {
  await resetFirestore(env);
  await seed(env, async (db) => {
    await setDoc(doc(db, 'admins', 'root'), { note: '初期管理者' });
    await setDoc(doc(db, 'jobs', 'purge-deleted'), {
      markers: 2, requests: 0, videos: 1, ranAt: Timestamp.fromMillis(Date.parse('2026-09-24T15:00:00Z')),
    });
  });
});

const storeFor = (uid) =>
  createAdminStore(env.authenticatedContext(uid).firestore(), () => ({ uid, displayName: uid, email: null, photoUrl: null }));

describe('管理者モードのアダプタ', () => {
  it('管理者なら true、一般の利用者と未ログインは false', async () => {
    assert.equal(await storeFor('root').amIAdmin(), true);
    assert.equal(await storeFor('alice').amIAdmin(), false);
    const guest = createAdminStore(env.unauthenticatedContext().firestore(), () => null);
    assert.equal(await guest.amIAdmin(), false);
  });

  it('管理者は定期処理の記録を読める（数値の項目と日時）', async () => {
    const jobs = await storeFor('root').jobs();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].id, 'purge-deleted');
    assert.deepEqual(jobs[0].values, { markers: 2, requests: 0, videos: 1 });
    assert.equal(jobs[0].ranAt, Date.parse('2026-09-24T15:00:00Z'));
  });

  it('一般の利用者は定期処理の記録を読めない（UpstreamError）', async () => {
    await assert.rejects(storeFor('alice').jobs(), { name: 'UpstreamError', message: /管理者だけ/ });
  });
});

describe('ユーザー管理（T59）', () => {
  it('3 区画: 管理者・一般のユーザー（管理者とブラックリストを除く）・ブラックリスト', async () => {
    await seed(env, (db) => setDoc(doc(db, 'blacklist', 'mallory'), { reason: 'スパム' }));
    const lists = await storeFor('root').users();
    assert.deepEqual(lists.admins.map((r) => [r.uid, r.nickname]), [['root', 'root さん']]);
    assert.deepEqual(lists.users.map((r) => r.uid).sort(), ['alice', 'bob', 'carol']);
    assert.deepEqual(lists.blacklist.map((r) => r.uid), ['mallory']);
  });

  it('削除するとプロフィールと名前の索引が消え、その名前をほかの人が使える', async () => {
    await storeFor('root').deleteUser('alice');
    const lists = await storeFor('root').users();
    assert.equal(lists.users.some((r) => r.uid === 'alice'), false);
    await env.withSecurityRulesDisabled(async (ctx) => {
      assert.equal((await getDoc(doc(ctx.firestore(), 'nicknames', 'alice さん'))).exists(), false);
    });
  });

  it('ブラックリストに入れると本人から「入っている」と分かり、外すと戻る', async () => {
    await storeFor('root').blacklist('bob');
    assert.equal(await storeFor('bob').amIBlacklisted(), true);
    assert.equal(await storeFor('alice').amIBlacklisted(), false);
    await storeFor('root').unblacklist('bob');
    assert.equal(await storeFor('bob').amIBlacklisted(), false);
  });

  it('一般の利用者は一覧・削除・ブラックリストの操作ができない（UpstreamError）', async () => {
    const alice = storeFor('alice');
    await assert.rejects(alice.users(), { name: 'UpstreamError', message: /管理者だけ/ });
    await assert.rejects(alice.deleteUser('bob'), { name: 'UpstreamError' });
    await assert.rejects(alice.blacklist('bob'), { name: 'UpstreamError' });
  });
});

describe('マーカー管理（T60）', () => {
  beforeEach(async () => {
    const { storedMarker } = await import('../rules/helpers.mjs');
    await seed(env, async (db) => {
      for (let i = 0; i < 4; i += 1) {
        const m = storedMarker('alice');
        await setDoc(doc(db, 'markers', `a${i}`), m);
        await setDoc(doc(db, 'videos', m.videoId), { markerId: `a${i}`, ownerUid: 'alice', ...(i === 0 ? { blocked: true } : {}) });
      }
    });
  });

  it('管理者は他人のマーカーをまとめて論理削除でき（3 件ずつのバッチ）、禁止の印の無い索引が外れる', async () => {
    assert.equal(await storeFor('root').softDeleteMarkers(['a0', 'a1', 'a2', 'a3']), 4);
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (let i = 0; i < 4; i += 1) assert.equal((await getDoc(doc(db, 'markers', `a${i}`))).data().deleted, true);
    });
    assert.equal(await storeFor('root').softDeleteMarkers(['a0']), 0);
  });

  it('一般の利用者は他人のマーカーを消せない（UpstreamError）', async () => {
    await assert.rejects(storeFor('bob').softDeleteMarkers(['a1']), { name: 'UpstreamError' });
  });
});

describe('撮影リクエストの取り下げ（要件 5.2.5）', () => {
  beforeEach(async () => {
    await seed(env, async (db) => {
      const past = Timestamp.fromMillis(Date.parse('2026-09-01T00:00:00Z'));
      const base = { lat: 35, lng: 135, equipment: { category: '', manufacturer: '', series: '', model: '' },
        ownerUid: 'alice', createdAt: past, updatedAt: past };
      await setDoc(doc(db, 'requests', 'r1'), { ...base, heat: 3 });
      await setDoc(doc(db, 'requests', 'r2'), { ...base, heat: 2 });
      await setDoc(doc(db, 'heatBudgets', 'alice'), { used: 5, target: 'r2' });
    });
  });

  it('管理者が取り下げると論理削除になり、持ち主の熱量が戻る', async () => {
    await storeFor('root').withdrawRequest({ id: 'r1', heat: 3, ownerUid: 'alice' });
    await storeFor('root').withdrawRequest({ id: 'r2', heat: 2, ownerUid: 'alice' });
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      assert.equal((await getDoc(doc(db, 'requests', 'r1'))).data().withdrawn, true);
      assert.equal((await getDoc(doc(db, 'requests', 'r2'))).data().withdrawn, true);
      assert.equal((await getDoc(doc(db, 'heatBudgets', 'alice'))).data().used, 0);
    });
  });

  it('取り下げ済みをもう一度取り下げると UpstreamError（熱量を二重に戻さない）', async () => {
    await storeFor('root').withdrawRequest({ id: 'r1', heat: 3, ownerUid: 'alice' });
    await assert.rejects(storeFor('root').withdrawRequest({ id: 'r1', heat: 3, ownerUid: 'alice' }), { name: 'UpstreamError' });
  });

  it('一般の利用者は他人のリクエストを取り下げられない（UpstreamError）', async () => {
    await assert.rejects(storeFor('bob').withdrawRequest({ id: 'r1', heat: 3, ownerUid: 'alice' }), { name: 'UpstreamError' });
  });
});

describe('撮影リクエストの取り下げ: 熱量の記録が合わない行', () => {
  it('持ち主の印が無いときは、書く前に理由の分かる UpstreamError で止まる', async () => {
    await seed(env, async (db) => {
      const past = Timestamp.fromMillis(Date.parse('2026-09-01T00:00:00Z'));
      await setDoc(doc(db, 'requests', 'orphan'), { lat: 35, lng: 135, heat: 2,
        equipment: { category: '', manufacturer: '', series: '', model: '' }, ownerUid: 'carol', createdAt: past, updatedAt: past });
    });
    await assert.rejects(storeFor('root').withdrawRequest({ id: 'orphan', heat: 2, ownerUid: 'carol' }),
      { name: 'UpstreamError', message: /熱量の記録（なし）/ });
  });
});

describe('機器マスタ（T28・ADR 0025）', () => {
  const makers = [{ name: 'GoPro', series: [{ name: 'HERO', models: ['HERO13 Black'] }] }];

  it('管理者は分類を保存し、読み直せる（上書きも同じ文書）', async () => {
    const store = storeFor('root');
    assert.deepEqual(await store.editedEquipment(), {});
    await store.saveEquipment('action', makers);
    const edited = await store.editedEquipment();
    assert.deepEqual(Object.keys(edited), ['action']);
    assert.deepEqual(edited.action.makers, makers);
    assert.ok(edited.action.updatedAt > 0);
    await store.saveEquipment('action', []);
    assert.deepEqual((await store.editedEquipment()).action.makers, []);
  });

  it('一般の利用者の保存は、理由の分かるエラーになる', async () => {
    await assert.rejects(storeFor('alice').saveEquipment('action', makers), /管理者/);
  });
});

describe('管理者への昇格と一般への戻し（T75）', () => {
  it('管理者は一般ユーザーを管理者にし、一般に戻せる。自分自身を戻すのは通信する前に止める', async () => {
    const store = storeFor('root');
    await store.grantAdmin('alice');
    assert.deepEqual((await store.users()).admins.map((r) => r.uid).sort(), ['alice', 'root']);
    await store.revokeAdmin('alice');
    assert.deepEqual((await store.users()).admins.map((r) => r.uid), ['root']);
    await assert.rejects(store.revokeAdmin('root'), /自分自身は一般に戻せません/);
  });

  it('一般ユーザーの昇格は、理由の分かるエラーになる', async () => {
    await assert.rejects(storeFor('alice').grantAdmin('bob'), /管理者/);
  });
});
