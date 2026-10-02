/**
 * YouTube oEmbed による動画メタ取得。
 *
 * API キー不要・CORS 対応で、GitHub Pages の静的配信からそのまま呼べる。
 * 返るのは タイトル / チャンネル名 / サムネイル の 3 項目だけ。
 * 再生数・投稿日・再生時間は Google API 無しでは取得できないため扱わない。
 */

import type { VideoMeta } from '@/core/types';
import type { VideoMetaPort } from '@/ports';
import { UpstreamError, UpstreamTimeoutError } from '@/ports';
import { thumbnailUrl, watchUrl } from '@/core/logic/youtube';

/** 窓口 1 つあたりの応答を待つ上限。上限が無いと、応答しないときに投稿ボタンが戻らない（T103） */
export const OEMBED_TIMEOUT_MS = 8_000;

interface OEmbedResponse {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

/** 公式が落ちたときの代替。同じ形の JSON を返すミラー。 */
const ENDPOINTS = [
  (v: string) => `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl(v))}&format=json`,
  (v: string) => `https://noembed.com/embed?url=${encodeURIComponent(watchUrl(v))}`,
];

export const oembedVideoAdapter: VideoMetaPort = {
  name: 'oembed',

  async probe(): Promise<boolean> {
    // 到達性は呼び出し時に判断する。ここで通信すると起動が遅くなるため常に true。
    return true;
  },

  async fetchMeta(videoId: string): Promise<VideoMeta> {
    let lastError: unknown = null;
    let timeouts = 0;

    for (const build of ENDPOINTS) {
      try {
        const res = await fetch(build(videoId), { signal: AbortSignal.timeout(OEMBED_TIMEOUT_MS) });
        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        const data = (await res.json()) as OEmbedResponse;
        if (!data.title) {
          lastError = new Error('タイトルが空');
          continue;
        }
        return {
          title: data.title,
          channelTitle: data.author_name ?? '(チャンネル不明)',
          thumbnailUrl: data.thumbnail_url ?? thumbnailUrl(videoId),
          source: 'oembed',
        };
      } catch (e) {
        lastError = e;
        if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) timeouts += 1;
      }
    }

    // どの窓口も応答しなかったときは、URL の誤りではないので別に伝える
    if (timeouts === ENDPOINTS.length) throw new UpstreamTimeoutError('YouTube が応答しません', lastError);
    throw new UpstreamError(
      '動画情報の取得に失敗しました。URL が正しいか、動画が非公開になっていないか確認してください。',
      lastError,
    );
  },
};
