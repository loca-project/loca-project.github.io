/**
 * 静的 JSON を読む唯一のデータ実装。
 *
 * 公開データは GitHub リポジトリ上の `public/data/*.json` にあり、GitHub Actions が作り直す
 * （Firestore からの日次同期）。GitHub Pages が生きていれば必ず読める。
 */

import type { EquipmentDef, MarkerData, RequestMarkerData } from '@/core/types';
import type { CatalogPort, CatalogSnapshot } from '@/ports';
import { EMPTY_SNAPSHOT } from '@/ports';
import { appConfig } from '@/runtime/config';

interface MarkerBundle {
  generatedAt?: number;
  syncedAt?: number;
  markers?: MarkerData[];
}

interface RequestBundle {
  generatedAt?: number;
  syncedAt?: number;
  markers?: RequestMarkerData[];
}

/** 公開データを待つ上限。応答が無いまま地図が空で止まらないよう、諦めて残りで描画する（T103） */
const DATA_TIMEOUT_MS = 30_000;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(DATA_TIMEOUT_MS) });
    if (!res.ok) {
      console.warn(`[loca] ${url} が ${res.status} を返しました`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[loca] ${url} を取得できませんでした`, e);
    return null;
  }
}

export const staticCatalogAdapter: CatalogPort = {
  name: 'static',

  async probe(): Promise<boolean> {
    return true;
  },

  /**
   * 3 ファイルを並行して読む。1 つ落ちても残りで描画する（部分的な欠損を許容する）。
   */
  async load(): Promise<CatalogSnapshot> {
    const base = appConfig.dataBaseUrl;
    const [markerBundle, requestBundle, equipment] = await Promise.all([
      fetchJson<MarkerBundle | MarkerData[]>(`${base}/markers.json`),
      fetchJson<RequestBundle | RequestMarkerData[]>(`${base}/requests.json`),
      fetchJson<EquipmentDef[]>(`${base}/equipment.json`),
    ]);

    if (!markerBundle && !requestBundle && !equipment) return EMPTY_SNAPSHOT;

    const markers = Array.isArray(markerBundle) ? markerBundle : (markerBundle?.markers ?? []);
    const requestMarkers = Array.isArray(requestBundle)
      ? requestBundle
      : (requestBundle?.markers ?? []);

    return {
      // 論理削除は公開データに含めない建前だが、混ざっていても弾く
      markers: markers.filter((m) => !m.deleted),
      requestMarkers,
      equipment: equipment ?? [],
      generatedAt: (Array.isArray(markerBundle) ? 0 : markerBundle?.generatedAt) ?? 0,
      syncedAt: (Array.isArray(markerBundle) ? 0 : markerBundle?.syncedAt) ?? 0,
      requestsSyncedAt: (Array.isArray(requestBundle) ? 0 : requestBundle?.syncedAt) ?? 0,
    };
  },
};
