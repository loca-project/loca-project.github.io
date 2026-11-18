/**
 * 撮影リクエストの地点の閲覧パネル（指摘 8）。
 *
 * 並びはリクエストに応えたい人の動線の順: 熱量 → 何を撮ればよいか（内訳）→ ここに投稿する → 自分もリクエストする
 * → 周辺の動画 → 自分のリクエストの取り下げ → 閉じる。
 * 内訳は季節・時間帯・雰囲気・機器ごとの熱量の合計（件数ではなく熱量で重みを付ける）。
 */

import React from 'react';
import type { RequestMarkerData } from '@/core/types';
import { formatCount } from '@/core/logic/format';
import { requestBreakdown } from '@/core/logic/requests';
import { REQUEST_TAG_FIELDS, equipmentCategoryLabel, tagLabel } from '@/core/constants';
import { Button } from '@/shared/components/Controls';
import BarList from '@/shared/components/BarList';
import { useI18n } from '@/shared/hooks/useI18n';

interface RequestViewProps {
  marker: RequestMarkerData;
  /** ログイン中のユーザーの uid。未ログインなら null */
  currentUid: string | null;
  busy: boolean;
  onAddRequest: () => void;
  onPostVideo: () => void;
  onSearchRelated: () => void;
  /** 共有リンクをコピーする（この地点を開く URL。T84） */
  onShare: () => void;
  onWithdraw: (entries: { id: string; heat: number }[]) => void;
  onCancel: () => void;
}

export default function RequestView({
  marker,
  currentUid,
  busy,
  onAddRequest,
  onPostVideo,
  onSearchRelated,
  onShare,
  onWithdraw,
  onCancel,
}: RequestViewProps) {
  const { t, lang } = useI18n();
  const breakdown = requestBreakdown(marker);
  const hasBreakdown = (marker.entries ?? []).length > 0;
  const mine = currentUid ? (marker.entries ?? []).filter((e) => e.ownerUid === currentUid) : [];
  const myHeat = mine.reduce((sum, e) => sum + e.heat, 0);

  const withdraw = () => {
    if (!window.confirm(t.request.confirmWithdraw.replace('{heat}', String(myHeat)))) return;
    onWithdraw(mine.map((e) => ({ id: e.id, heat: e.heat })));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg bg-gray-900 p-4 text-center text-white">
        <p className="text-[11px] text-gray-300">{t.form.totalHeat}</p>
        <p className="text-2xl font-bold">
          <i className="fa-solid fa-fire mr-1.5 text-orange-400" />
          {formatCount(marker.totalHeat)}
        </p>
        <p className="mt-1 text-[11px] text-gray-400">{t.request.entries.replace('{count}', formatCount(marker.requestCount))}</p>
        {(marker.prefecture || marker.city) && (
          <p className="mt-1 text-[11px] text-gray-400">{[marker.prefecture, marker.city].filter(Boolean).join(' ')}</p>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-[11px] font-bold text-gray-600">{t.request.breakdown}</h3>
        {hasBreakdown ? (
          <>
            {REQUEST_TAG_FIELDS.map((field) => (
              <BarList key={field} title={t.tags[field]} rows={breakdown[field].map((r) => ({ ...r, label: tagLabel(r.label, lang) }))} />
            ))}
            {breakdown.equipmentCategory.length > 0 && (
              <BarList
                title={t.form.category}
                rows={breakdown.equipmentCategory.map((r) => ({ ...r, label: equipmentCategoryLabel(r.label, lang) }))}
              />
            )}
            {breakdown.equipment.length > 0 && <BarList title={t.form.equipment} rows={breakdown.equipment} />}
            <p className="text-[11px] text-gray-500">{t.request.howToAnswer}</p>
          </>
        ) : (
          <p className="text-[11px] text-gray-400">{t.request.noBreakdown}</p>
        )}
      </section>

      <Button onClick={onPostVideo}>
        <i className="fa-brands fa-youtube mr-1.5" />
        {t.form.postVideo}
      </Button>
      <Button variant="secondary" onClick={onAddRequest}>
        <i className="fa-solid fa-fire mr-1.5" />
        {t.form.addRequest}
      </Button>
      <Button variant="secondary" onClick={onSearchRelated}>
        <i className="fa-solid fa-magnifying-glass mr-1.5" />
        {t.form.relatedVideos}
      </Button>
      <Button variant="secondary" onClick={onShare}>
        <i className="fa-solid fa-share-nodes mr-1.5" />
        {t.actions.share}
      </Button>

      {mine.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md bg-gray-50 p-3">
          <p className="text-[11px] text-gray-600">
            {t.request.mine.replace('{heat}', String(myHeat)).replace('{count}', String(mine.length))}
          </p>
          <Button variant="secondary" className="text-red-600" disabled={busy} onClick={withdraw}>
            <i className="fa-solid fa-rotate-left mr-1.5" />
            {t.request.withdraw}
          </Button>
        </div>
      )}

      <Button variant="ghost" onClick={onCancel}>
        {t.close}
      </Button>
    </div>
  );
}
