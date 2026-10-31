/**
 * 動画の視聴モーダル。
 * 動画そのものは Loca に保存せず、YouTube の埋め込みプレイヤーで再生する。
 */

import React from 'react';
import type { MarkerData } from '@/core/types';
import { formatDate, hostOf } from '@/core/logic/format';
import { embedUrl, getYoutubeId } from '@/core/logic/youtube';
import Modal from '@/shared/components/Modal';
import { useI18n } from '@/shared/hooks/useI18n';
import { publishedLabel } from './published';

interface VideoDetailsModalProps {
  open: boolean;
  marker: MarkerData | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-2 last:border-0">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-800">{value}</dd>
    </div>
  );
}

export default function VideoDetailsModal({ open, marker, onClose }: VideoDetailsModalProps) {
  const { t } = useI18n();
  if (!marker) return null;

  const videoId = getYoutubeId(marker.youtubeUrl);

  return (
    <Modal open={open} title={marker.title ?? t.details.btnLabel} size="md" onClose={onClose}>
      {videoId ? (
        <div className="relative mb-3 w-full overflow-hidden rounded bg-black pt-[56.25%]">
          <iframe
            className="absolute inset-0 h-full w-full"
            src={embedUrl(videoId)}
            title={marker.title ?? 'YouTube'}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <p className="mb-3 rounded bg-amber-50 p-2 text-[11px] text-amber-800">{t.alerts.invalidUrl}</p>
      )}

      <dl className="text-xs">
        <Row label={t.details.channel} value={marker.channelTitle ?? '-'} />
        <Row
          label={t.filters.prefecture}
          value={[marker.prefecture, marker.city].filter(Boolean).join(' ') || '-'}
        />
        <Row label={t.details.publishedAt} value={publishedLabel(marker, t)} />
        <Row label={t.details.registeredAt} value={formatDate(marker.createdAt)} />
        {marker.official ? (
          <>
            <Row label={t.official.badge} value={t.official.note} />
            <Row label={t.official.provider} value={marker.official.provider} />
            <Row
              label={t.official.source}
              value={
                <a href={marker.official.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 underline">
                  {hostOf(marker.official.sourceUrl)}
                </a>
              }
            />
          </>
        ) : (
          <Row label={t.details.contributor} value={marker.createdBy || '-'} />
        )}
      </dl>

      <a
        href={marker.youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block rounded bg-red-600 py-2 text-center text-xs font-bold text-white hover:bg-red-700"
      >
        <i className="fa-brands fa-youtube mr-1.5" />
        {t.details.openYoutube}
      </a>
    </Modal>
  );
}
