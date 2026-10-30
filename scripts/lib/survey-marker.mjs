/**
 * 地域の調査のページから、公開サイトのマーカーを登録・論理削除する（ADR 0035）。
 * オーナーの権限（REST）で書くのでルールを通らない。形が validMarker を満たすことは tests/rules/surveyMarker.test.mjs が確かめる。
 * 書くのは利用者がページのボタンを押したときだけ。タグは利用者が選ぶ（AI に付けさせない。ADR 0014 決定 7）。
 */
import { randomBytes } from 'node:crypto';
import { fromFields } from './firestore-rest.mjs';

export const TAG_VALUES = {
  subject: ['nature', 'townscape', 'festival', 'food', 'transport', 'heritage', 'life'],
  mood: ['lively', 'calm', 'dreamy', 'grand', 'nostalgic', 'thrill'],
  season: ['spring', 'summer', 'autumn', 'winter'],
  timeOfDay: ['sunrise', 'morning', 'daytime', 'evening', 'night'],
  style: ['aerial', 'walking', 'vehicle', 'fixed'],
};
const REQUIRED_TAGS = ['subject', 'mood'];
const NO_EQUIPMENT = { category: '', manufacturer: '', series: '', model: '' };
const TIMEOUT_MS = 20000;

/** 利用者が直せる誤り。ページにそのまま伝える。 */
export class RegisterError extends Error {}

/** タグをルールと同じ一覧で確かめ、選ばれたものだけを返す。 */
export function cleanTags(input) {
  const tags = {};
  for (const [field, values] of Object.entries(TAG_VALUES)) {
    const v = input?.[field];
    if (!v) {
      if (REQUIRED_TAGS.includes(field)) throw new RegisterError('映っているものと雰囲気を選んでください');
      continue;
    }
    if (!values.includes(v)) throw new RegisterError(`タグの値が正しくありません: ${field}`);
    tags[field] = v;
  }
  return tags;
}

/** マーカーの項目（時刻は除く）。 */
export function markerFields({ videoId, video, lat, lng, tags, memo, prefecture, city, account }) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new RegisterError('動画 ID の形が正しくありません');
  const text = String(memo ?? '').trim();
  if (text.length > 80 || /[\r\n]/.test(text)) throw new RegisterError('現地メモは改行なしの 80 字までです');
  return {
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    videoId,
    lat,
    lng,
    tags: cleanTags(tags),
    ...(text ? { memo: text } : {}),
    equipment: NO_EQUIPMENT,
    title: String(video.title ?? '').slice(0, 300),
    channelTitle: String(video.channelTitle ?? '').slice(0, 200),
    thumbnailUrl: String(video.thumbnailUrl ?? '').slice(0, 500),
    ...(prefecture ? { prefecture } : {}),
    ...(city ? { city } : {}),
    ownerUid: account.uid,
    createdBy: account.nickname,
    deleted: false,
  };
}

/** 素の値を REST の型付きの値にする。 */
export function toValue(v) {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { doubleValue: v };
  if (v && typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  throw new Error(`扱えない値です: ${v}`);
}
export const toFields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toValue(v)]));

const now = (fieldPath) => ({ fieldPath, setToServerValue: 'REQUEST_TIME' });

/**
 * base は documents までの URL。getToken はオーナーのトークン、getAccount は { uid, nickname }、oembed は動画 ID → { title, channelTitle, thumbnailUrl }（埋め込めなければ null）。
 */
export function createRegister({ base, getToken, getAccount, oembed }) {
  const root = base.slice(base.indexOf('/projects/') + 1);
  const request = async (method, url, body) => {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore が ${res.status} を返しました: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  };
  const read = async (collection, id) => {
    const d = await request('GET', `${base}/${collection}/${id}`);
    return d ? fromFields(d.fields ?? {}) : null;
  };
  const commit = (writes) => request('POST', `${base}:commit`, { writes });

  return {
    /** 表示中のマーカーの一覧（論理削除を除く）。mine は押した人が消せるか。 */
    async list() {
      const account = await getAccount();
      const rows = [];
      let pageToken = '';
      do {
        const body = await request('GET', `${base}/markers?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`);
        for (const doc of body?.documents ?? []) rows.push({ id: doc.name.split('/').pop(), ...fromFields(doc.fields ?? {}) });
        pageToken = body?.nextPageToken ?? '';
      } while (pageToken);
      return { account: { nickname: account.nickname }, markers: rows.filter((m) => !m.deleted && m.videoId)
        .map((m) => ({ videoId: m.videoId, markerId: m.id, mine: m.ownerUid === account.uid, createdBy: m.createdBy })) };
    },

    /** 登録する。同じ動画があれば止まる（videos/{videoId} が無いことを同じ書き込みの条件にする）。 */
    async add({ videoId, lat, lng, tags, memo, prefecture, city }) {
      cleanTags(tags);
      const index = await read('videos', videoId);
      if (index?.blocked) throw new RegisterError('この動画は管理者が禁止しています');
      if (index) throw new RegisterError('この動画はすでに登録されています');
      const video = await oembed(videoId);
      if (!video) throw new RegisterError('この動画は埋め込めません（非公開・削除・埋め込みの禁止）');
      const account = await getAccount();
      const fields = markerFields({ videoId, video, lat, lng, tags, memo, prefecture, city, account });
      const markerId = randomBytes(15).toString('base64url').replace(/[-_]/g, 'x').slice(0, 20);
      await commit([
        { update: { name: `${root}/markers/${markerId}`, fields: toFields(fields) }, currentDocument: { exists: false }, updateTransforms: [now('createdAt'), now('updatedAt')] },
        { update: { name: `${root}/videos/${videoId}`, fields: toFields({ markerId, ownerUid: account.uid }) }, currentDocument: { exists: false } },
      ]);
      return { markerId, videoId };
    },

    /** 論理削除する（サイトの削除と同じ: deleted と updatedAt を変え、索引を外す）。本人のものだけ。 */
    async remove({ videoId }) {
      const index = await read('videos', videoId);
      if (!index?.markerId) throw new RegisterError('この動画は登録されていません');
      const account = await getAccount();
      if (index.ownerUid !== account.uid) throw new RegisterError('別の人が登録した動画は消せません');
      if (index.blocked) throw new RegisterError('管理者が禁止した動画は、ここでは消せません');
      await commit([
        { update: { name: `${root}/markers/${index.markerId}`, fields: toFields({ deleted: true }) }, updateMask: { fieldPaths: ['deleted'] },
          currentDocument: { exists: true }, updateTransforms: [now('updatedAt')] },
        { delete: `${root}/videos/${videoId}` },
      ]);
      return { markerId: index.markerId, videoId };
    },
  };
}
