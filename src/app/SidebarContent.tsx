/**
 * サイドメニューに何を出すかの振り分け。タブと地図モードだけで決まる。
 * 投稿は「投稿」タブに分けた（指摘 9）。地図タブでは地図のクリックで投稿画面に移らない。
 */

import React, { Suspense, lazy } from 'react';
import { MapMode, TabMode } from '@/core/types';
import { useI18n } from '@/shared/hooks/useI18n';
import { Button, Segmented } from '@/shared/components/Controls';
import SearchPanel from '@/features/sidebar/SearchPanel';
import MarkerForm from '@/features/sidebar/MarkerForm';
import MarkerDetails from '@/features/sidebar/MarkerDetails';
import RankingFilters from '@/features/sidebar/RankingFilters';
import RequestForm from '@/features/sidebar/RequestForm';
import RequestView from '@/features/sidebar/RequestView';
import type { LocaApp } from './useLocaApp';

// ユーザーのタブは開いたときに読む（初期読み込みの JS を 260 kB 以内に保つ。T62・T88）
const PeoplePanel = lazy(() => import('@/features/people/PeoplePanel'));
// 最近のアクティビティも開いたときに読む（T80）
const ActivityTab = lazy(() => import('./ActivityTab'));

export interface SidebarHandlers {
  onSearch: () => void;
  onStartDrawing: () => void;
  onClearRectangle: () => void;
  onSubmitMarker: () => void;
  onSubmitRequest: () => void;
  onApplyRanking: () => void;
  /** ユーザーのタブの「検索」（T93） */
  onSearchPeople: () => void;
  onShare: () => void;
  onReport: () => void;
  onWatch: () => void;
  onAddRequest: () => void;
  onPostVideoFromRequest: () => void;
  onSearchRelated: () => void;
  onEditMarker: () => void;
  onDeleteMarker: () => void;
  onWithdrawRequests: (entries: { id: string; heat: number }[]) => void;
}

interface SidebarContentProps {
  app: LocaApp;
  handlers: SidebarHandlers;
  busy: boolean;
  /** ログイン中のユーザーの uid。未ログインなら null */
  currentUid: string | null;
  /** ログイン中のユーザーが使った熱量。不明なら null */
  heatUsed: number | null;
  /** 投稿にログインが要るのに未ログイン */
  needsLogin: boolean;
  onSignIn: () => void;
}

export function sidebarTitle(app: LocaApp, t: ReturnType<typeof useI18n>['t']): string {
  if (app.tab === TabMode.ACTIVITY) return t.activity.title;
  if (app.tab === TabMode.RANKING_REGION) return t.headers.regionRanking;
  if (app.tab === TabMode.PEOPLE) return t.headers.people;
  if (app.tab === TabMode.RANKING_EQUIPMENT) return t.headers.gearRanking;
  if (app.tab === TabMode.RANKING_REQUEST) return t.headers.requestRanking;
  if (app.tab === TabMode.POST) return app.editing ? t.headers.editMarker : t.headers.newReg;
  if (app.mapMode === MapMode.REQUEST_VIEW) return t.headers.requestTitle;
  if (app.mapMode === MapMode.EDIT) return t.headers.viewMarker;
  return t.headers.mapSearch;
}

export default function SidebarContent({
  app,
  handlers,
  busy,
  currentUid,
  heatUsed,
  needsLogin,
  onSignIn,
}: SidebarContentProps) {
  const { t } = useI18n();

  if (app.tab === TabMode.POST) {
    if (needsLogin) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-md bg-gray-50 p-5 text-center">
          <i className="fa-solid fa-circle-user text-3xl text-gray-300" />
          <p className="text-xs font-bold text-gray-800">{t.post.loginTitle}</p>
          <p className="text-[11px] leading-relaxed text-gray-500">{t.post.loginBody}</p>
          <Button className="w-full" onClick={onSignIn}>
            <i className="fa-brands fa-google mr-1.5" />
            {t.auth.signIn}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        {!app.tempPos && (
          <p className="rounded-md bg-loca-50 p-2.5 text-[11px] font-bold text-loca-700">
            <i className="fa-solid fa-crosshairs mr-1.5" />
            {t.post.pickHint}
          </p>
        )}
        {!app.editing && (
          <Segmented
            value={app.registerTab}
            onChange={app.setRegisterTab}
            options={[
              { value: 'marker', label: t.form.tabRegister },
              { value: 'request', label: t.form.tabRequest },
            ]}
          />
        )}

        {app.registerTab === 'marker' ? (
          <MarkerForm
            form={app.form}
            equipment={app.catalog.equipment}
            loading={busy}
            onChange={app.patchForm}
            onSubmit={handlers.onSubmitMarker}
            onCancel={app.resetToSearch}
            editing={app.editing !== null}
          />
        ) : (
          <RequestForm
            form={app.requestForm}
            equipment={app.catalog.equipment}
            loading={busy}
            onChange={(patch) => app.setRequestForm((prev) => ({ ...prev, ...patch }))}
            onSubmit={handlers.onSubmitRequest}
            onCancel={app.resetToSearch}
            heatUsed={heatUsed}
          />
        )}
      </div>
    );
  }

  if (app.tab === TabMode.ACTIVITY) {
    return (
      <Suspense fallback={<p className="text-[11px] text-gray-400">{t.details.loading}</p>}>
        <ActivityTab app={app} />
      </Suspense>
    );
  }

  if (app.tab === TabMode.PEOPLE) {
    return (
      <Suspense fallback={<p className="text-[11px] text-gray-400">{t.details.loading}</p>}>
        <PeoplePanel
          filter={app.people}
          equipment={app.catalog.equipment}
          loading={busy}
          onChange={(patch) => app.setPeople((prev) => ({ ...prev, ...patch }))}
          onSearch={handlers.onSearchPeople}
        />
      </Suspense>
    );
  }

  if (app.tab !== TabMode.MAP) {
    return (
      <RankingFilters
        tab={app.tab}
        filter={app.filter}
        equipment={app.catalog.equipment}
        loading={busy}
        onChange={(patch) => app.setFilter((prev) => ({ ...prev, ...patch }))}
        onApply={handlers.onApplyRanking}
      />
    );
  }

  if (app.mapMode === MapMode.REQUEST_VIEW && app.selectedRequest) {
    return (
      <RequestView
        marker={app.selectedRequest}
        currentUid={currentUid}
        busy={busy}
        onWithdraw={handlers.onWithdrawRequests}
        onAddRequest={handlers.onAddRequest}
        onPostVideo={handlers.onPostVideoFromRequest}
        onSearchRelated={handlers.onSearchRelated}
        onShare={handlers.onShare}
        onCancel={app.resetToSearch}
      />
    );
  }

  if (app.mapMode === MapMode.EDIT && app.selectedMarker) {
    // 本人判定は表示の切り替えだけ（権限はルールが守る）
    const isOwner = currentUid !== null && app.selectedMarker.ownerUid === currentUid;
    return (
      <MarkerDetails
        marker={app.selectedMarker}
        onCancel={app.resetToSearch}
        onShare={handlers.onShare}
        onReport={handlers.onReport}
        onWatch={handlers.onWatch}
        onOpenPoster={(m) => m.ownerUid && app.setPoster({ uid: m.ownerUid, name: m.createdBy })}
        onEdit={isOwner ? handlers.onEditMarker : undefined}
        onDelete={isOwner ? handlers.onDeleteMarker : undefined}
        busy={busy}
      />
    );
  }

  return (
    <SearchPanel
      target={app.searchTarget}
      query={app.searchQuery}
      loading={busy}
      drawing={app.drawing}
      hasRectangle={app.rectangle !== null}
      onTargetChange={app.setSearchTarget}
      onQueryChange={app.setSearchQuery}
      onSearch={handlers.onSearch}
      onStartDrawing={handlers.onStartDrawing}
      onClearRectangle={handlers.onClearRectangle}
    />
  );
}
