/**
 * プロフィールのアダプタ（src/adapters/firebase/profileStore.ts）を、本番と同じルールのエミュレータに当てる。
 * dave は未登録（resetFirestore が置く REGISTERED に含めない）。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { createServer } from 'vite';
import { resetFirestore, seed, setupEnv, storedMarker } from '../rules/helpers.mjs';

let env;
let vite;
let createProfileStore;

before(async () => {
  env = await setupEnv();
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  ({ createProfileStore } = await vite.ssrLoadModule('/src/adapters/firebase/profileStore.ts'));
});
after(async () => {
  await env.cleanup();
  await vite.close();
});
beforeEach(async () => { await resetFirestore(env); });

const user = (uid) => ({ uid, displayName: `${uid} Google 名`, email: `${uid}@example.com`, photoUrl: null });
const storeFor = (uid) => createProfileStore(env.authenticatedContext(uid).firestore(), () => user(uid));

/** 購読して、条件に合う最初の値を返す。 */
function next(store, uid, until) {
  return new Promise((resolve, reject) => {
    const stop = store.watch(uid, (p) => {
      if (!until(p)) return;
      stop();
      resolve(p);
    }, reject);
  });
}

/** マーカー ID → 投稿者名（ルールを通さずに読む）。 */
async function markerNames() {
  const names = {};
  await env.withSecurityRulesDisabled(async (ctx) => {
    (await getDocs(collection(ctx.firestore(), 'markers'))).forEach((d) => { names[d.id] = d.data().createdBy; });
  });
  return names;
}

/** 名前の索引の持ち主（ルールを通さずに読む）。無ければ undefined。 */
async function indexOf(nickname) {
  let uid;
  await env.withSecurityRulesDisabled(async (ctx) => {
    uid = (await getDoc(doc(ctx.firestore(), 'nicknames', nickname.toLowerCase()))).data()?.uid;
  });
  return uid;
}

async function read(uid) {
  let data;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), 'users', uid))).data();
  });
  return data;
}

describe('プロフィールの登録と編集', () => {
  it('未登録なら null が届く', async () => {
    assert.equal(await next(storeFor('dave'), 'dave', () => true), null);
  });

  it('登録すると、ニックネームと同意の版だけが保存される（メール・Google の名前は保存しない）', async () => {
    await storeFor('dave').register('  だいち  ');
    const saved = await read('dave');
    assert.deepEqual(Object.keys(saved).sort(), ['agreedAt', 'consentVersion', 'createdAt', 'nickname', 'updatedAt']);
    assert.equal(saved.nickname, 'だいち');
    assert.equal(saved.consentVersion, 1);
  });

  it('登録後の購読には、ニックネームと同意日時が届く', async () => {
    const store = storeFor('dave');
    await store.register('だいち');
    const p = await next(store, 'dave', (v) => v !== null);
    assert.equal(p.nickname, 'だいち');
    assert.ok(p.agreedAt > 0);
  });

  it('ニックネームを変えられる', async () => {
    await storeFor('alice').rename('ありす');
    assert.equal((await read('alice')).nickname, 'ありす');
  });

  it('変えると、本人のマーカー（120 件・論理削除済みを含む）の投稿者名も新しい名前になり、他人のは変わらない', async () => {
    await seed(env, async (db) => {
      for (let i = 0; i < 120; i += 1) {
        await setDoc(doc(db, 'markers', `a${i}`), storedMarker('alice', { deleted: i === 0 }));
      }
      await setDoc(doc(db, 'markers', 'b1'), storedMarker('bob'));
    });
    await storeFor('alice').rename('ありす');
    const names = await markerNames();
    const alice = Object.entries(names).filter(([id]) => id.startsWith('a'));
    assert.equal(alice.length, 120);
    assert.ok(alice.every(([, name]) => name === 'ありす'));
    assert.equal(names.b1, 'bob さん');
  });

  it('変えると古い名前の索引を手放し、新しい名前の索引を持つ', async () => {
    await storeFor('alice').rename('ありす');
    assert.equal(await indexOf('alice さん'), undefined);
    assert.equal(await indexOf('ありす'), 'alice');
  });

  it('ほかの人が使っている名前（大文字小文字違い・全角英字を含む）は、登録も変更も止める', async () => {
    await storeFor('dave').register('Daichi');
    await assert.rejects(storeFor('erin').register('ＤＡＩＣＨＩ'), /ほかの人が使っています/);
    await assert.rejects(storeFor('alice').rename('bob さん'), /ほかの人が使っています/);
  });

  it('ずれた投稿者名はログイン時の修復でそろう（件数を返す）', async () => {
    await seed(env, async (db) => {
      await setDoc(doc(db, 'markers', 'a1'), storedMarker('alice', { createdBy: '古い名前' }));
      await setDoc(doc(db, 'markers', 'a2'), storedMarker('alice'));
    });
    assert.equal(await storeFor('alice').repair('alice さん'), 1);
    assert.equal((await markerNames()).a1, 'alice さん');
  });

  it('重複の禁止より前に登録した人（索引なし）は、修復でいまの名前の索引を取る', async () => {
    await seed(env, (db) => deleteDoc(doc(db, 'nicknames', 'alice さん')));
    await storeFor('alice').repair('alice さん');
    assert.equal(await indexOf('alice さん'), 'alice');
  });

  it('いまのニックネーム以外への修復はルールが拒否する', async () => {
    await seed(env, (db) => setDoc(doc(db, 'markers', 'a1'), storedMarker('alice')));
    await assert.rejects(storeFor('alice').repair('だれか'), /そろえられませんでした/);
  });

  it('21 字のニックネームは送る前に止める', async () => {
    await assert.rejects(storeFor('dave').register('あ'.repeat(21)), /1〜20 字/);
  });

  it('登録済みの人が登録し直す（同意日時の上書き）は拒否', async () => {
    await assert.rejects(storeFor('alice').register('ありす'), /保存できませんでした/);
  });

  it('他人のプロフィールは購読できない', async () => {
    await assert.rejects(next(storeFor('bob'), 'alice', () => true), /読み込めません/);
  });
});

describe('公開プロフィールのチャンネル（T55・ADR 0029）', () => {
  it('登録・変更・削除ができ、誰でも読める。形が違えば通信する前に止める。アカウントのプロフィール削除で一緒に消える', async () => {
    const store = storeFor('alice');
    const guest = createProfileStore(env.unauthenticatedContext().firestore(), () => null);
    await store.setChannel('@loca_alice');
    assert.equal(await guest.channelOf('alice'), '@loca_alice');
    await store.setChannel(null);
    assert.equal(await guest.channelOf('alice'), null);
    await assert.rejects(store.setChannel('https://www.youtube.com/@loca_alice'), { name: 'UpstreamError' });
    await store.setChannel('@loca_alice');
    await store.remove();
    assert.equal(await guest.channelOf('alice'), null);
  });
});
