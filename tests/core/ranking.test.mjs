/**
 * 地域別・機器別ランキングの集計（src/core/logic/ranking.ts。ADR 0038）。
 * TypeScript と @/ の別名は Vite の ssrLoadModule で解決する。実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let rankPrefectures;
let rankEquipment;
let DEFAULT_RANKING_FILTER;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  ({ rankPrefectures, rankEquipment } = await vite.ssrLoadModule('/src/core/logic/ranking.ts'));
  ({ DEFAULT_RANKING_FILTER } = await vite.ssrLoadModule('/src/core/types/ranking.ts'));
});
after(async () => { await vite.close(); });

const eq = (model) => ({ category: 'drone', manufacturer: 'DJI', series: 'Mini', model });
const marker = (id, prefecture, createdAt, extra = {}) => ({
  id, prefecture, createdAt, deleted: false, lat: 31, lng: 130, tags: { subject: 'nature', mood: 'calm' }, equipment: eq('4'), ...extra,
});
const OFFICIAL = { official: { provider: '霧島市', sourceUrl: 'https://example.com/' } };
const labels = (rows) => rows.map((r) => [r.label, r.count]);

describe('地域別・機器別ランキング', () => {
  it('再生数が多くても順位は動かず、登録件数の多い順に並ぶ', () => {
    const markers = [
      marker('a', '東京都', 1, { youtube: { viewCount: 1000000 } }),
      marker('b', '鹿児島県', 2, { youtube: { viewCount: 1 } }),
      marker('c', '鹿児島県', 3, { youtube: { viewCount: 1 } }),
    ];
    assert.deepEqual(labels(rankPrefectures(markers, DEFAULT_RANKING_FILTER)), [['鹿児島県', 2], ['東京都', 1]]);
  });

  it('再生数の合計を持たない（規約 III.E.2・III.E.4.h）', () => {
    const [row] = rankPrefectures([marker('a', '東京都', 1, { youtube: { viewCount: 5 } })], DEFAULT_RANKING_FILTER);
    assert.equal('views' in row, false);
  });

  it('件数が同じなら、新しく登録した順', () => {
    const markers = [marker('a', '東京都', 1), marker('b', '鹿児島県', 2)];
    assert.deepEqual(labels(rankPrefectures(markers, DEFAULT_RANKING_FILTER)), [['鹿児島県', 1], ['東京都', 1]]);
  });

  it('公式の紹介と論理削除は数えない', () => {
    const markers = [
      marker('a', '鹿児島県', 1, OFFICIAL),
      marker('b', '鹿児島県', 2, OFFICIAL),
      marker('c', '東京都', 3),
      marker('d', '東京都', 4, { deleted: true }),
    ];
    assert.deepEqual(labels(rankPrefectures(markers, DEFAULT_RANKING_FILTER)), [['東京都', 1]]);
    assert.deepEqual(labels(rankEquipment(markers, DEFAULT_RANKING_FILTER)), [['DJI / Mini / 4', 1]]);
  });

  it('機器別も登録件数の多い順', () => {
    const markers = [
      marker('a', '東京都', 1, { equipment: eq('3'), youtube: { viewCount: 1000000 } }),
      marker('b', '東京都', 2, { equipment: eq('4') }),
      marker('c', '東京都', 3, { equipment: eq('4') }),
    ];
    assert.deepEqual(labels(rankEquipment(markers, DEFAULT_RANKING_FILTER)), [['DJI / Mini / 4', 2], ['DJI / Mini / 3', 1]]);
  });
});
