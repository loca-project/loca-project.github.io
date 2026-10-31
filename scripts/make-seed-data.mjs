/**
 * 初期表示用のサンプルデータを public/data に書き出す。
 *
 * 実行: npm run data:seed（件数を増やすなら npm run data:seed -- --count 2000）
 * 冪等。既存ファイルは毎回上書きするので、実データを入れたあとは実行しないこと。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.join(process.cwd(), 'public', 'data');

const SPOTS = [
  { name: '札幌', pref: '北海道', city: '札幌市', lat: 43.0618, lng: 141.3545 },
  { name: '五稜郭', pref: '北海道', city: '函館市', lat: 41.7969, lng: 140.7569 },
  { name: '中尊寺', pref: '岩手県', city: '平泉町', lat: 38.9935, lng: 141.0994 },
  { name: '蔵王', pref: '山形県', city: '山形市', lat: 38.1667, lng: 140.45 },
  { name: '浅草', pref: '東京都', city: '台東区', lat: 35.7148, lng: 139.7967 },
  { name: '横浜みなとみらい', pref: '神奈川県', city: '横浜市', lat: 35.4563, lng: 139.6317 },
  { name: '河口湖', pref: '山梨県', city: '富士河口湖町', lat: 35.5171, lng: 138.7527 },
  { name: '上高地', pref: '長野県', city: '松本市', lat: 36.2504, lng: 137.6319 },
  { name: '白川郷', pref: '岐阜県', city: '白川村', lat: 36.2578, lng: 136.9063 },
  { name: '名古屋城', pref: '愛知県', city: '名古屋市', lat: 35.1856, lng: 136.8997 },
  { name: '伏見稲荷', pref: '京都府', city: '京都市', lat: 34.9671, lng: 135.7727 },
  { name: '道頓堀', pref: '大阪府', city: '大阪市', lat: 34.6687, lng: 135.5013 },
  { name: '姫路城', pref: '兵庫県', city: '姫路市', lat: 34.8394, lng: 134.6939 },
  { name: '宮島', pref: '広島県', city: '廿日市市', lat: 34.2959, lng: 132.3197 },
  { name: '祖谷', pref: '徳島県', city: '三好市', lat: 33.8797, lng: 133.8306 },
  { name: '太宰府', pref: '福岡県', city: '太宰府市', lat: 33.5213, lng: 130.5348 },
  { name: '阿蘇', pref: '熊本県', city: '阿蘇市', lat: 32.8846, lng: 131.1041 },
  { name: '桜島', pref: '鹿児島県', city: '鹿児島市', lat: 31.5931, lng: 130.6572 },
  { name: '古宇利島', pref: '沖縄県', city: '今帰仁村', lat: 26.7003, lng: 128.0194 },
  { name: '積丹岬', pref: '北海道', city: '積丹町', lat: 43.3406, lng: 140.4636 },
];

// タグのキー（要件 3.3。src/core/constants/tags.ts と同じ）
const SUBJECTS = ['nature', 'townscape', 'festival', 'food', 'transport', 'heritage', 'life'];
const MOODS = ['lively', 'calm', 'dreamy', 'grand', 'nostalgic', 'thrill'];
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const TIMES = ['sunrise', 'morning', 'daytime', 'evening', 'night'];
const STYLES = ['aerial', 'walking', 'vehicle', 'fixed'];
// 撮影機器（分類 → メーカー → シリーズ → モデル。ADR 0018。scripts/data/equipment-master.mjs にある組み合わせ）
const GEAR = [
  { category: 'drone', manufacturer: 'DJI', series: 'Mavic', model: 'Mavic 3 Pro' },
  { category: 'drone', manufacturer: 'DJI', series: 'Mini', model: 'Mini 4 Pro' },
  { category: 'mirrorless', manufacturer: 'Sony', series: 'Alpha', model: 'a7 IV' },
  { category: 'cinema', manufacturer: 'Sony', series: 'Cinema Line', model: 'FX3' },
  { category: 'action', manufacturer: 'GoPro', series: 'HERO', model: 'HERO13 Black' },
  { category: 'smartphone', manufacturer: 'Apple', series: 'iPhone', model: 'iPhone 16 Pro' },
];

/** 11 桁の擬似 YouTube ID。形式は妥当だが実在しない。 */
function fakeVideoId(index) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
  let id = '';
  let n = index * 2654435761;
  for (let i = 0; i < 11; i += 1) {
    n = (n * 31 + 17) >>> 0;
    id += alphabet[n % alphabet.length];
  }
  return id;
}

const now = Date.now();

/**
 * --count N で件数を増やす（密集地のクラスタの確認用。T41）。
 * 21 件目からは 20 地点の周り（±0.3 度）に決まった並びで散らす。何度実行しても同じ結果になる。
 */
const countArg = process.argv.indexOf('--count');
const COUNT = countArg >= 0 ? Number(process.argv[countArg + 1]) : SPOTS.length;
if (!Number.isInteger(COUNT) || COUNT < SPOTS.length) {
  throw new Error(`--count は ${SPOTS.length} 以上の整数で指定してください（${process.argv[countArg + 1]}）`);
}
const jitter = (i, salt) => ((((i * 2654435761 + salt * 40503) >>> 0) % 6001) / 10000 - 0.3);
const places = Array.from({ length: COUNT }, (_, i) => {
  const spot = SPOTS[i % SPOTS.length];
  if (i < SPOTS.length) return spot;
  return { ...spot, name: `${spot.name}${Math.floor(i / SPOTS.length)}`, lat: spot.lat + jitter(i, 1), lng: spot.lng + jitter(i, 2) };
});

const markers = places.map((spot, i) => {
  const videoId = fakeVideoId(i + 1);
  return {
    id: `seed_${String(i + 1).padStart(Math.max(3, String(COUNT).length), '0')}`,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    lat: spot.lat,
    lng: spot.lng,
    // 任意のタグは一部の行だけに付ける（未設定の行が絞り込みで当たらないことを確かめられるように）
    tags: {
      subject: SUBJECTS[i % SUBJECTS.length],
      mood: MOODS[i % MOODS.length],
      ...(i % 2 === 0 ? { season: SEASONS[i % SEASONS.length], timeOfDay: TIMES[i % TIMES.length] } : {}),
      ...(i % 3 === 0 ? { style: STYLES[i % STYLES.length] } : {}),
    },
    ...(i % 4 === 0 ? { memo: `${spot.name}の展望台から撮影（サンプル）` } : {}),
    // 毎晩 Actions が取る値（ADR 0017）。5 件に 1 件はまだ取っていない状態にする
    ...(i % 5 === 4
      ? {}
      : {
          youtube: {
            viewCount: ((i * 7919) % 50000) + 100,
            publishedAt: now - (i * 45 + 3) * 86_400_000,
            durationSec: [95, 250, 600, 1500][i % 4],
            checkedAt: now,
          },
        }),
    equipment: GEAR[i % GEAR.length],
    title: `${spot.name}のサンプル映像`,
    channelTitle: `サンプルチャンネル ${(i % 5) + 1}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    prefecture: spot.pref,
    city: spot.city,
    // 投稿者は 3 人に分ける（公開プロフィールの一覧を確かめるため。T82）。本物のマーカーと同じく uid を持つ
    // 最後の 1 件は公式の紹介（ADR 0036）
    ...(i === places.length - 1
      ? { ownerUid: 'loca-official', createdBy: 'Loca 運営', official: { provider: 'サンプル市', sourceUrl: 'https://example.com/sns' } }
      : { ownerUid: `seed-user-${(i % 3) + 1}`, createdBy: `loca-seed-${(i % 3) + 1}` }),
    createdAt: now - i * 86_400_000,
    updatedAt: now - i * 86_400_000,
  };
});

/** 撮影リクエストのサンプル。まだ動画が無い地点。 */
const requestMarkers = [
  { name: '知床', pref: '北海道', city: '斜里町', lat: 44.0833, lng: 145.0 },
  { name: '奥入瀬', pref: '青森県', city: '十和田市', lat: 40.5461, lng: 140.9436 },
  { name: '天橋立', pref: '京都府', city: '宮津市', lat: 35.5686, lng: 135.1889 },
].map((spot, i) => ({
  id: `seedrq_${i + 1}`,
  lat: spot.lat,
  lng: spot.lng,
  totalHeat: (i + 1) * 2,
  requestCount: i + 1,
  prefecture: spot.pref,
  city: spot.city,
  updatedAt: now - i * 3_600_000,
  entries: Array.from({ length: i + 1 }, (_, k) => ({
    id: `seedre_${i + 1}_${k + 1}`,
    userId: 'loca-seed',
    heat: 2,
    ...(k % 2 === 0 ? { season: SEASONS[k % SEASONS.length] } : {}),
    timeOfDay: TIMES[(i + k) % TIMES.length],
    style: STYLES[k % STYLES.length],
    equipment: GEAR[k % GEAR.length],
    createdAt: now - k * 3_600_000,
  })),
}));

await mkdir(OUT_DIR, { recursive: true });
await writeFile(
  path.join(OUT_DIR, 'markers.json'),
  `${JSON.stringify({ generatedAt: now, syncedAt: now, markers }, null, 2)}\n`,
  'utf8',
);
await writeFile(
  path.join(OUT_DIR, 'requests.json'),
  `${JSON.stringify({ generatedAt: now, syncedAt: now, markers: requestMarkers }, null, 2)}\n`,
  'utf8',
);

console.log(`OK: マーカー ${markers.length} 件 / リクエスト ${requestMarkers.length} 件 を書き出しました`);
