/**
 * Firestore の行から、次の markers.json の markers を作る（通信しない純粋な処理）。今の markers.json は地名の引き継ぎにだけ使う。
 *
 * - 論理削除（deleted: true）の行は含めない（要件 1.4）。
 * - 地名が空の行は、前回の markers.json で同じ座標に地名があれば引き継ぐ。
 * - 並びは登録の新しい順。
 * - いいねの件数（likeCounts/{markerId} の count）を likes に入れる。0 件は項目ごと出さない（ユーザーのタブの並び。ADR 0031・T92）。
 */

/** 公開する項目だけに絞る（Firestore の行に余計な項目が混ざっても出さない）。 */
const PUBLIC_KEYS = [
  'id', 'youtubeUrl', 'videoId', 'lat', 'lng', 'tags', 'memo', 'youtube', 'equipment', 'title', 'channelTitle', 'thumbnailUrl',
  'prefecture', 'city', 'ownerUid', 'createdBy', 'createdAt', 'updatedAt',
  // 応えた撮影リクエストの ID（依頼者のブラウザが「届きました」を探す。ADR 0028）
  'answers',
  // 公式の紹介の提供元と根拠のページ（ADR 0036）
  'official',
];

const pick = (row) => Object.fromEntries(PUBLIC_KEYS.filter((k) => row[k] !== undefined).map((k) => [k, row[k]]));

export function mergeMarkers(firestoreRows, currentMarkers, likeCounts = []) {
  const previous = new Map(currentMarkers.map((m) => [m.id, m]));
  const likes = new Map(likeCounts.map((c) => [c.id, c.count]));

  const live = firestoreRows.filter((r) => r.deleted !== true).map((row) => {
    const m = pick(row);
    const prev = previous.get(m.id);
    if (!m.prefecture && prev?.prefecture && prev.lat === m.lat && prev.lng === m.lng) {
      Object.assign(m, { prefecture: prev.prefecture, city: prev.city ?? '' });
    }
    const count = likes.get(m.id);
    if (Number.isInteger(count) && count > 0) m.likes = count;
    return m;
  });

  return {
    markers: live.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    live: live.length,
    deleted: firestoreRows.length - live.length,
  };
}
