/**
 * OpenStreetMap の Nominatim によるジオコーディング（ADR 0032）。
 *
 * - 地名 → 座標: /search（日本に絞る。日本語・英語の地名とも引ける）
 * - 座標 → 地名: /reverse（都道府県は ISO 3166-2 のコード JP-13 などから引く。東京都は province が空で返るため）
 *
 * 公開サーバーの利用規約（operations.osmfoundation.org/policies/nominatim/）に従う:
 * - 利用者が検索したときだけ呼ぶ（入力途中の候補表示はしない）
 * - 全利用者の合計で 1 秒に 1 回まで。この端末からは 1.1 秒に 1 回以下に並べる
 * - 結果はこちら側でキャッシュする（同じ問い合わせを繰り返すと止められる）。ブラウザに保存し、次の訪問でも使う
 * - Referer はブラウザが送る。出典は地図の右下の OpenStreetMap の表記で示す
 * 稼働の保証は無い。予備の実装は持たず、失敗は理由を添えて利用者に伝える。
 */

import type { LatLng, PlaceMeta } from '@/core/types';
import type { GeocodePort } from '@/ports';
import { UpstreamError, UpstreamTimeoutError } from '@/ports';
import { PREFECTURES, prefectureFromCode } from '@/core/constants';

const BASE = 'https://nominatim.openstreetmap.org';
/** 応答を待つ上限。上限が無いと、応答しないときにボタンが「確認中」のまま戻らない（T96） */
export const NOMINATIM_TIMEOUT_MS = 10_000;
/** この端末からの問い合わせの最小の間隔（規約は全体で 1 秒に 1 回） */
export const MIN_INTERVAL_MS = 1_100;
/** ブラウザに保存する結果の件数の上限（古いものから捨てる） */
const CACHE_LIMIT = 300;
const CACHE_KEY = 'loca.geocode.v1';

/** 待ち時間の上限を超えたことを表す（利用者への文言を分けるため）。 */
export class GeocodeTimeoutError extends UpstreamTimeoutError {}

// ---- キャッシュ（メモリとブラウザの保存領域。保存領域が使えなくても動く）----

type Cached = { at: number; value: LatLng | PlaceMeta | null };
let memory: Map<string, Cached> | null = null;

function cache(): Map<string, Cached> {
  if (memory) return memory;
  memory = new Map();
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]') as [string, Cached][];
    for (const [k, v] of saved) memory.set(k, v);
  } catch {
    // 保存領域が使えない（プライベートブラウズなど）ときはメモリだけで続ける
  }
  return memory;
}

function remember(key: string, value: LatLng | PlaceMeta | null): void {
  const m = cache();
  m.delete(key);
  m.set(key, { at: Date.now(), value });
  while (m.size > CACHE_LIMIT) m.delete(m.keys().next().value as string);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify([...m]));
  } catch {
    // 保存できなくても結果は返す
  }
}

/** テスト用: キャッシュと間隔の記録を空にする */
export function resetNominatimState(): void {
  memory = new Map();
  lastRequestAt = 0;
  queue = Promise.resolve();
}

// ---- 間隔を空けて 1 件ずつ問い合わせる ----

let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

/* eslint-disable @typescript-eslint/no-explicit-any */
export function getJson(path: string, params: Record<string, string>, timeoutMs = NOMINATIM_TIMEOUT_MS): Promise<any> {
  const run = async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    const url = `${BASE}${path}?${new URLSearchParams({ format: 'jsonv2', ...params })}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        throw new GeocodeTimeoutError('OpenStreetMap の検索が応答しません', e);
      }
      throw e;
    }
    if (!res.ok) throw new UpstreamError(`OpenStreetMap の検索のエラー (${res.status})`);
    return res.json();
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

/** 検索語を正規化してキャッシュのキーにする（前後の空白・全角空白・大文字小文字をそろえる） */
export function normalizeQuery(q: string): string {
  return q.replace(/　/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** 逆ジオコーディングの結果の住所から、都道府県と市区町村（Loca の粒度）を取り出す */
export function placeFromAddress(address: Record<string, string> | undefined): PlaceMeta | null {
  if (!address || address.country_code !== 'jp') return null;
  const iso = address['ISO3166-2-lvl4'] ?? '';
  const byCode = /^JP-\d{2}$/.test(iso) ? prefectureFromCode(iso.slice(3)) : '';
  const byName = [address.province, address.state].find((p) => p && (PREFECTURES as readonly string[]).includes(p)) ?? '';
  const prefecture = byCode || byName;
  if (!prefecture) return null;
  // 政令指定都市は市（city）、特別区は区（city）、町村は town・village で返る
  const city = address.city ?? address.town ?? address.village ?? '';
  return { prefecture, city, source: 'osm' };
}

export const nominatimGeocodeAdapter: GeocodePort = {
  name: 'nominatim',

  async probe(): Promise<boolean> {
    return typeof fetch === 'function';
  },

  async reverse(lat: number, lng: number): Promise<PlaceMeta> {
    const failure = '地図情報（都道府県・市町村）の取得に失敗しました。';
    // 4 桁（約 10 m）で丸めてキャッシュする。同じ地点を置き直しても問い合わせない
    const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
    const hit = cache().get(key);
    if (hit?.value) return hit.value as PlaceMeta;
    let data: any;
    try {
      data = await getJson('/reverse', { lat: String(lat), lon: String(lng), zoom: '10', 'accept-language': 'ja' });
    } catch (e) {
      throw new UpstreamError(failure, e);
    }
    // 海上など日本の市区町村に属さない地点では address が返らない
    const place = placeFromAddress(data?.address);
    if (!place) throw new UpstreamError(failure);
    remember(key, place);
    return place;
  },

  async forward(address: string): Promise<LatLng> {
    const query = address.trim();
    const key = `f:${normalizeQuery(query)}`;
    const hit = cache().get(key);
    if (hit) {
      if (hit.value) return hit.value as LatLng;
      throw new UpstreamError('場所が見つかりませんでした。');
    }
    let data: any;
    try {
      data = await getJson('/search', { q: query, countrycodes: 'jp', limit: '1' });
    } catch (e) {
      // 応答しないのは「見つからない」とは別なので、時間をおくよう伝える
      if (e instanceof GeocodeTimeoutError) {
        throw new UpstreamError('OpenStreetMap の検索が応答しません。時間をおいて試してください。', e);
      }
      throw new UpstreamError('場所を検索できませんでした。時間をおいて試してください。', e);
    }
    const first = Array.isArray(data) ? data[0] : null;
    const pos = first ? { lat: Number(first.lat), lng: Number(first.lon) } : null;
    // 見つからなかった結果も覚える（同じ語を繰り返し問い合わせない）
    remember(key, pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng) ? pos : null);
    if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) throw new UpstreamError('場所が見つかりませんでした。');
    return pos;
  },
};
