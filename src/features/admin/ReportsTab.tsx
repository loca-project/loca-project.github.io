/**
 * 通報のタブ（要件 3.8 の受け皿・T61）。マーカーごとに、通報した人数・確認待ち・理由の内訳・詳細を出す（確認待ちの多い順）。
 * 対象のマーカーの題名・投稿者・現地メモも並べる（現地メモも通報の対象。ADR 0014）。
 * 操作は「地図へ」「マーカーを削除」（論理削除し、通報を対応済みにする）「対応済みにする」（マーカーは残す）。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { MarkerData, ReportSummary } from '@/core/types';
import { REPORT_REASONS } from '@/core/constants';
import { formatDateTime, interpolate } from '@/core/logic/format';
import { Button } from '@/shared/components/Controls';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useI18n } from '@/shared/hooks/useI18n';
import { useServices } from '@/shared/hooks/useServices';
import { useToast } from '@/shared/components/Toast';
import { publishLocalChange } from '@/shared/localChanges';

interface ReportsTabProps {
  markers: MarkerData[];
  onJump: (marker: MarkerData) => void;
}

export default function ReportsTab({ markers, onJump }: ReportsTabProps) {
  const { reportStore, adminStore } = useServices();
  const { t } = useI18n();
  const rt = t.admin.reports;
  const toast = useToast();
  const { loading, exclusive } = useExclusive();
  const [summaries, setSummaries] = useState<ReportSummary[] | null>(null);
  const byId = useMemo(() => new Map(markers.map((m) => [m.id, m])), [markers]);

  const reload = useCallback(async () => {
    if (!reportStore) return;
    try {
      setSummaries(await reportStore.summaries());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [reportStore, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = (confirmText: string, action: () => Promise<unknown>, done: string) => () => {
    if (!window.confirm(confirmText)) return;
    void exclusive(async () => {
      try {
        await action();
        toast.success(done);
        await reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  if (!reportStore || !adminStore) return null;
  if (!summaries) return <p className="text-xs text-gray-500">{t.details.loading}</p>;
  if (summaries.length === 0) return <p className="text-xs text-gray-500">{rt.empty}</p>;

  const reasonLabel = (id: string) => {
    const key = REPORT_REASONS.find((r) => r.id === id)?.labelKey;
    return key ? t.reportReasons[key as keyof typeof t.reportReasons] : id;
  };

  return (
    <ul className="h-full space-y-3 overflow-y-auto">
      {summaries.map((s) => {
        const marker = byId.get(s.markerId);
        const title = marker?.title ?? rt.gone;
        return (
          <li key={s.markerId} className={`rounded-lg border p-3 ${s.open > 0 ? 'border-red-200 bg-red-50/40' : 'border-gray-100'}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-bold text-gray-800">{title}</p>
              <p className="text-[11px] text-gray-500">
                {interpolate(rt.counts, { reporters: s.reporters, open: s.open })} ・ {formatDateTime(s.latestAt)}
              </p>
            </div>
            {marker && (
              <p className="text-[11px] text-gray-500">
                {marker.official ? `${t.official.provider}: ${marker.official.provider}` : `${t.details.contributor}: ${marker.createdBy}`}
                {marker.memo ? ` ・ ${t.tags.memo}: ${marker.memo}` : ''}
              </p>
            )}
            <p className="mt-1 text-[11px] text-gray-700">
              {Object.entries(s.reasons)
                .map(([id, n]) => `${reasonLabel(id)}（${n}）`)
                .join(' / ')}
            </p>
            {s.details.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-[11px] text-gray-600">
                {s.details.map((d, i) => (
                  <li key={i} className="break-words">
                    {d}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" disabled={!marker} onClick={() => marker && onJump(marker)}>
                <i className="fa-solid fa-location-arrow mr-1.5" />
                {t.myPosts.jump}
              </Button>
              <Button
                variant="danger"
                disabled={loading || !marker}
                onClick={run(
                  interpolate(rt.confirmDelete, { title }),
                  async () => {
                    await adminStore.softDeleteMarkers([s.markerId]);
                    publishLocalChange({ kind: 'markers', ids: [s.markerId] });
                    await reportStore.resolve(s.markerId);
                  },
                  rt.deleted,
                )}
              >
                {rt.deleteMarker}
              </Button>
              <Button
                variant="secondary"
                disabled={loading || s.open === 0}
                onClick={run(interpolate(rt.confirmResolve, { title }), () => reportStore.resolve(s.markerId), rt.resolved)}
              >
                {rt.resolve}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
