/**
 * Edge AI（AI 検索。ADR 0033）の起動。起動画面「Loca を起動しています... n%」の間に、地図より先に準備する（T101）。
 *
 * - 準備ができた = モデルを読み、試しに 1 回計算できたこと（スマホで最初の検索のときに止まるのを、起動の時点で見つける）
 * - タグの説明文の埋め込みは前もって計算したもの（public/data/semantic-tags.json）を使う。
 *   モデルか説明文が違えば端末で計算し直す（スマホで 26 件を計算すると「準備中 100%」のまま止まった。2026-09-26）
 * - 止まったら諦めて、Edge AI なしで起動を続ける（取得中に STALL_MS 進まない・取得後に START_MS で終わらない）
 * - `?edgeai=off` で開くと準備しない（画面の確認用。/ui-check の --preview）
 * このファイルは遅延 import する（初期読み込みの JS に入れない）。
 */

import type { TagField } from '@/core/constants/tags';
import { pickTags, rankTags, type TagScore } from '@/core/logic/semanticSearch';
import type { SemanticPort } from '@/ports/semantic';

/** 取得中に進み具合が止まってから諦めるまで */
export const STALL_MS = 45_000;
/** 取得が終わって（またはキャッシュから読んで）から、起動と試しの計算が終わるまでの上限 */
export const START_MS = 120_000;

export interface EdgeAi {
  /** ready なら検索語をタグに読み替える。unavailable なら常に空 */
  readonly status: 'ready' | 'unavailable';
  /** unavailable の理由（ログ用） */
  readonly reason?: string;
  tagsFor(query: string): Promise<TagScore[]>;
}

const UNAVAILABLE = (reason: string): EdgeAi => ({ status: 'unavailable', reason, tagsFor: async () => [] });

type TagVector = { key: string; field: TagField; vector: number[] };

/** 前もって計算したタグの埋め込みを読む。モデルか説明文が違えば端末で計算する */
async function tagVectors(port: SemanticPort): Promise<TagVector[]> {
  const { TAG_DESCRIPTIONS, tagDocument, descriptionsFingerprint } = await import('@/core/constants/tagDescriptions');
  const keys = Object.keys(TAG_DESCRIPTIONS);
  const toTags = (vectors: number[][], order: string[]) =>
    order.map((key, i) => ({ key, field: TAG_DESCRIPTIONS[key].field, vector: vectors[i] }));
  try {
    // 応答しないときは端末で計算する側に回る（上限が無いと起動の見張りが諦めるまで待つ。T103）
    const res = await fetch(new URL('./data/semantic-tags.json', document.baseURI), { signal: AbortSignal.timeout(30_000) });
    const saved = (await res.json()) as { model: string; fingerprint: string; keys: string[]; vectors: number[][] };
    if (saved.model === port.model.id && saved.fingerprint === descriptionsFingerprint()) return toTags(saved.vectors, saved.keys);
    console.warn('[loca] タグの埋め込みが今のモデル・説明文と違うので、端末で計算します（npm run semantic:vectors で作り直す）');
  } catch (e) {
    console.warn('[loca] 前もって計算したタグの埋め込みを読めないので、端末で計算します', e);
  }
  return toTags(await port.embedDocuments(keys.map(tagDocument)), keys);
}

/** 進み具合が止まったら reject する見張りを付けて待つ（上限は試験のために差し替えられる） */
export function watch<T>(
  work: Promise<T>,
  lastEvent: () => { at: number; downloading: boolean },
  limits = { stall: STALL_MS, start: START_MS, tick: 1_000 },
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setInterval(() => {
      const { at, downloading } = lastEvent();
      const limit = downloading ? limits.stall : limits.start;
      if (Date.now() - at > limit) {
        clearInterval(timer);
        reject(new Error(downloading ? `取得が ${limit / 1000} 秒進まない` : `起動が ${limit / 1000} 秒で終わらない`));
      }
    }, limits.tick);
    work.then(
      (v) => { clearInterval(timer); resolve(v); },
      (e) => { clearInterval(timer); reject(e); },
    );
  });
}

export async function startEdgeAi(onProgress: (ratio: number | null) => void): Promise<EdgeAi> {
  if (new URLSearchParams(location.search).get('edgeai') === 'off') return UNAVAILABLE('?edgeai=off');
  const state = { at: Date.now(), downloading: false };
  try {
    const [{ createTransformersSemantic }, { MODELS, ACTIVE_MODEL }] = await Promise.all([
      import('@/adapters/semantic/transformers'),
      import('@/adapters/semantic/models'),
    ]);
    const port = createTransformersSemantic(MODELS[ACTIVE_MODEL]);
    const ready = watch(
      (async () => {
        await port.load((ratio) => {
          // 97% を超えたら起動の段階（分母がモデルの見込みの大きさなので、取得が済んでも 1 にちょうど届かないことがある）。
          // 進み具合が分からないとき（null）は取得中とみなす
          state.at = Date.now();
          state.downloading = ratio === null || ratio < 0.97;
          onProgress(ratio);
        });
        state.at = Date.now();
        state.downloading = false;
        const tags = await tagVectors(port);
        await port.embedQuery('Loca'); // 試しの計算
        return tags;
      })(),
      () => state,
    );
    const tags = await ready;
    return {
      status: 'ready',
      async tagsFor(query) {
        if (!query.trim()) return [];
        return pickTags(rankTags(await port.embedQuery(query.trim()), tags), port.model.rule);
      },
    };
  } catch (e) {
    const reason = e instanceof Error ? `${e.message}${e.cause instanceof Error ? `（${e.cause.message}）` : ''}` : String(e);
    console.warn('[loca] Edge AI を使えないので、語の一致だけで検索します:', reason);
    return UNAVAILABLE(reason);
  }
}
