/**
 * インフォウィンドウの HTML 生成（要件 3.5）。
 * 表示は サムネイル・再生数・チャンネル名 の 3 項目と YouTube への導線。
 */

import type { MarkerData } from '@/core/types';
import { getYoutubeId, thumbnailUrl } from '@/core/logic/youtube';

/** 属性値・テキストに差し込む前に必ず通す。 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface InfoWindowLabels {
  openYoutube: string;
  report: string;
  details: string;
  /** 題名がまだ無いとき（oEmbed の失敗・毎晩の更新の前）の文言 */
  noTitle: string;
}

/**
 * ボタンは CustomEvent で App 側へ通知する。
 * 地図エンジンが差し替わっても HTML とイベント名だけで完結させるため。
 */
export function buildMarkerInfoHtml(marker: MarkerData, labels: InfoWindowLabels): string {
  const videoId = getYoutubeId(marker.youtubeUrl);
  const thumb = marker.thumbnailUrl || (videoId ? thumbnailUrl(videoId) : '');
  const title = escapeHtml(marker.title || labels.noTitle);
  const channel = escapeHtml(marker.channelTitle ?? '');
  const url = escapeHtml(marker.youtubeUrl);

  return `
<div class="w-[260px] text-xs">
  ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" class="h-[146px] w-full object-cover" />` : ''}
  <div class="p-3">
    <p class="mb-1 line-clamp-2 font-bold text-gray-800">${title}</p>
    <p class="mb-2 text-[11px] text-gray-500">${channel}</p>
    <div class="flex gap-2">
      <a href="${url}" target="_blank" rel="noopener noreferrer"
         class="flex-1 rounded bg-red-600 px-2 py-1.5 text-center font-bold text-white">
        ${escapeHtml(labels.openYoutube)}
      </a>
      <button type="button" data-loca-action="details" data-loca-id="${escapeHtml(marker.id)}"
              class="rounded border border-gray-300 px-2 py-1.5 font-bold text-gray-600">
        ${escapeHtml(labels.details)}
      </button>
      <button type="button" data-loca-action="report" data-loca-id="${escapeHtml(marker.id)}"
              class="rounded border border-gray-300 px-2 py-1.5 font-bold text-gray-600">
        ${escapeHtml(labels.report)}
      </button>
    </div>
  </div>
</div>`;
}

export const LOCA_INFO_EVENT = 'loca:info-action';

export interface InfoActionDetail {
  action: 'details' | 'report';
  markerId: string;
}

/** ポップアップ内のボタン押下を 1 箇所で拾い、CustomEvent に変換する。 */
export function installInfoWindowDelegate(): () => void {
  const handler = (e: Event) => {
    const target = (e.target as HTMLElement | null)?.closest('[data-loca-action]');
    if (!target) return;
    const action = target.getAttribute('data-loca-action') as InfoActionDetail['action'] | null;
    const markerId = target.getAttribute('data-loca-id');
    if (!action || !markerId) return;
    window.dispatchEvent(new CustomEvent<InfoActionDetail>(LOCA_INFO_EVENT, { detail: { action, markerId } }));
  };
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
}
