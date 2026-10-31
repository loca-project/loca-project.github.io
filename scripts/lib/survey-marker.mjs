/**
 * 地域の調査のページから、公開サイトの「公式の紹介」のマーカーを登録・論理削除する（ADR 0035・0036）。
 * オーナーの権限（REST）で書くのでルールを通らない。形が validMarker を満たすことは tests/rules/surveyMarker.test.mjs が確かめる。
 * 書くのは利用者がページのボタンを押したときだけ。タグは利用者が選ぶ（AI に付けさせない。ADR 0014 決定 7）。
 * 投稿者は運営（誰もログインできない uid。名前はルールが予約する）。利用者の投稿と分け、管理者アカウントの削除でも消えないようにする。
 */
import { randomBytes } from 'node:crypto';
import { fromFields } from './firestore-rest.mjs';

export const OPERATOR = { uid: 'loca-official', nickname: 'Loca 運営' };
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

/** 提供元と根拠のページ。出所の明記は県のチャンネルの運用ポリシーの条件でもある（ADR 0036）。 */
export function cleanOfficial(official) {
  const provider = String(official?.provider ?? '').trim();
  const sourceUrl = String(official?.sourceUrl ?? '').trim();
  if (!provider || provider.length > 100) throw new RegisterError('提供元が正しくありません');
  if (!/^https?:\/\/\S+$/.test(sourceUrl) || sourceUrl.length > 500 || !URL.canParse(sourceUrl)) throw new RegisterError('根拠のページの URL が正しくありません');
  return { provider, sourceUrl };
}

/** マーカーの項目（時刻は除く）。 */
export function markerFields({ videoId, video, lat, lng, tags, memo, prefecture, city, official }) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new RegisterError('動画 ID の形が正しくありません');
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) throw new RegisterError('座標が正しくありません');
  if (String(prefecture ?? '').length > 20 || String(city ?? '').length > 50) throw new RegisterError('都道府県か市町村の名前が長すぎます');
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
    official: cleanOfficial(official),
    ownerUid: OPERATOR.uid,
    createdBy: OPERATOR.nickname,
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

/** base は documents までの URL。getToken はオーナーのトークン、oembed は動画 ID → { title, channelTitle, thumbnailUrl }（埋め込めなければ null）。 */
export function createRegister({ base, getToken, oembed }) {
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
    const d = await request('GET', `${base}/${collection}/${encodeURIComponent(id)}`);
    return d ? fromFields(d.fields ?? {}) : null;
  };
  const commit = (writes) => request('POST', `${base}:commit`, { writes });

  return {
    /** 表示中のマーカーの一覧（論理削除を除く）。official は公式の紹介（ここから消せるもの）か。 */
    async list() {
      const rows = [];
      let pageToken = '';
      do {
        const body = await request('GET', `${base}/markers?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`);
        for (const doc of body?.documents ?? []) rows.push({ id: doc.name.split('/').pop(), ...fromFields(doc.fields ?? {}) });
        pageToken = body?.nextPageToken ?? '';
      } while (pageToken);
      const live = rows.filter((m) => !m.deleted && m.videoId);
      const liveIds = new Set(live.map((m) => m.videoId));
      return {
        markers: live.map((m) => ({ videoId: m.videoId, markerId: m.id, official: !!m.official, createdBy: m.createdBy })),
        // 動画が消えて毎晩の更新が外した公式の紹介（deletedReason: unavailable。ADR 0037）。ページで「登録」に戻して見せない
        unavailable: [...new Set(rows.filter((m) => m.deleted && m.official && m.deletedReason === 'unavailable' && m.videoId && !liveIds.has(m.videoId)).map((m) => m.videoId))],
      };
    },

    /** 登録する。同じ動画があれば止まる（videos/{videoId} が無いことを同じ書き込みの条件にする）。運営の名前を利用者に取らせない。 */
    async add({ videoId, lat, lng, tags, memo, prefecture, city, official }) {
      cleanTags(tags);
      cleanOfficial(official);
      const index = await read('videos', videoId);
      if (index?.blocked) throw new RegisterError('この動画は管理者が禁止しています');
      if (index) throw new RegisterError('この動画はすでに登録されています');
      const video = await oembed(videoId);
      if (!video) throw new RegisterError('この動画は埋め込めません（非公開・削除・埋め込みの禁止）');
      const fields = markerFields({ videoId, video, lat, lng, tags, memo, prefecture, city, official });
      const markerId = randomBytes(15).toString('base64url').replace(/[-_]/g, 'x').slice(0, 20);
      await commit([
        { update: { name: `${root}/markers/${markerId}`, fields: toFields(fields) }, currentDocument: { exists: false }, updateTransforms: [now('createdAt'), now('updatedAt')] },
        { update: { name: `${root}/videos/${videoId}`, fields: toFields({ markerId, ownerUid: OPERATOR.uid }) }, currentDocument: { exists: false } },
      ]);
      return { markerId, videoId };
    },

    /** 論理削除する（サイトの削除と同じ: deleted と updatedAt を変え、索引を外す）。公式の紹介だけ。 */
    async remove({ videoId }) {
      const index = await read('videos', videoId);
      if (!index?.markerId) throw new RegisterError('この動画は登録されていません');
      if (index.ownerUid !== OPERATOR.uid) throw new RegisterError('利用者が投稿した動画は、ここでは消せません');
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
