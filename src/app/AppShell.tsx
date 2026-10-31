/** 画面全体の組み立てと、各操作のつなぎ込み。 */

import React, { useCallback, useState } from 'react';
import type { LatLng } from '@/core/types';
import { TabMode } from '@/core/types';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAuth } from '@/shared/hooks/useAuth';
import MapCanvas from '@/features/map/MapCanvas';
import TabRail from '@/features/sidebar/TabRail';
import SidebarPanel, { SIDEBAR_PANEL_WIDTH, SIDEBAR_RAIL_WIDTH } from '@/features/sidebar/SidebarPanel';
import ResultsPanel from '@/features/results/ResultsPanel';
import ReportModal from '@/features/report/ReportModal';
import EmptyMapNotice from '@/features/contribute/EmptyMapNotice';
import MapFilterBar from '@/features/filter/MapFilterBar';
import { filterBarLeft } from '@/features/filter/placement';
import { useViewportWidth } from '@/shared/hooks/useViewportWidth';
import HeaderBar from './HeaderBar';
import HealthNotice from './HealthNotice';
import LazyModals from './LazyModals';
import SidebarContent, { sidebarTitle } from './SidebarContent';
import { useAppActions } from './useAppActions';
import { useLocaApp } from './useLocaApp';
import { useMarkerInfoWindow } from './useMarkerInfoWindow';
import { usePins } from './usePins';
import { useMapFilter } from './useMapFilter';
import { readSharedView, useShareUrl } from './useShareUrl';
import { useMarkerSubmit } from './useMarkerSubmit';
import { useRequestSubmit } from './useRequestSubmit';
import { useSearchAndRanking } from './useSearchAndRanking';
import { useRangeSelect } from './useRangeSelect';
import { answerTargets } from '@/core/logic/answers';
import AnswerNotice from '@/features/profile/AnswerNotice';

export default function AppShell() {
  const { t } = useI18n();
  const app = useLocaApp();
  const auth = useAuth();
  const { submit, remove, loading: submitting } = useMarkerSubmit();
  const requestSubmit = useRequestSubmit(auth.user?.uid ?? null);
  const search = useSearchAndRanking();

  // 地図に出すのは画面下の地図フィルタで絞った後のもの（ADR 0015）
  // 共有された URL の絞り込みとマーカーで始め、変えたら URL に映す（T42）
  const [shared] = useState(readSharedView);
  const mapFilter = useMapFilter(app.catalog.markers, app.catalog.requestMarkers, shared.filter);
  useShareUrl(app, mapFilter.filter, shared);
  const viewportWidth = useViewportWidth();
  const pins = usePins(
    mapFilter.markers,
    mapFilter.requestMarkers,
    app.handleMarkerClick,
    app.handleRequestClick,
  );
  const busy = submitting || requestSubmit.loading || search.loading || app.catalog.loading;

  useMarkerInfoWindow(app);
  const {
    closeMobileSidebar,
    handleSearch,
    handleSubmitMarker,
    handleWithdrawRequests,
    handleSignIn,
    handleDeleteMarker,
    handleSubmitRequest,
    handleShare,
    handleShareRow,
    handleReportSubmit,
    reportSubmitting,
  } = useAppActions({ app, auth, search, requestSubmit, submit, remove, filter: mapFilter.filter });

  const range = useRangeSelect(app, search, mapFilter.markers, closeMobileSidebar);

  const jump = useCallback((pos: LatLng) => app.jumpTo(pos), [app]);
  const sidebarOffset = SIDEBAR_RAIL_WIDTH + (app.sidebarOpen ? SIDEBAR_PANEL_WIDTH : 0);
  const filterLeft = filterBarLeft({
    viewportWidth,
    sidebarOffset,
    resultsOpen: search.results.open,
    registering: app.tempPos !== null,
  });

  return (
    <div className="relative flex h-[100dvh] w-screen overflow-hidden bg-gray-100">
      <MapCanvas
        pins={pins}
        ghost={app.tempPos}
        rectangle={app.rectangle}
        drawing={app.drawing}
        onMapClick={range.onMapClick}
        onRectangleDrawn={range.onRectangleDrawn}
      />

      <TabRail
        current={app.tab}
        expanded={app.sidebarOpen}
        onSelect={(next) => {
          if (next === app.tab) {
            app.setSidebarOpen(!app.sidebarOpen);
            return;
          }
          if (next === TabMode.POST) {
            app.openPostTab();
            return;
          }
          app.setTab(next);
          app.setSidebarOpen(true);
          if (next === TabMode.MAP) app.resetToSearch();
        }}
        onToggle={() => app.setSidebarOpen(!app.sidebarOpen)}
      />

      <SidebarPanel open={app.sidebarOpen} title={sidebarTitle(app, t)}>
        <SidebarContent
          app={app}
          busy={busy}
          currentUid={auth.user?.uid ?? null}
          needsLogin={auth.enabled && !auth.user}
          onSignIn={handleSignIn}
          heatUsed={requestSubmit.heatUsed}
          handlers={{
            onSearch: handleSearch,
            onStartDrawing: () => app.setDrawing(true),
            onClearRectangle: range.clear,
            onSubmitMarker: handleSubmitMarker,
            onSubmitRequest: handleSubmitRequest,
            onApplyRanking: () => {
              closeMobileSidebar();
              search.applyRanking(app.tab, app.filter, app.catalog.markers, app.catalog.requestMarkers);
            },
            onSearchPeople: () => {
              closeMobileSidebar();
              search.searchPeople(app.people, app.catalog.markers);
            },
            onShare: handleShare,
            onReport: () => app.openModal('report'),
            onWatch: () => app.openModal('videoDetails'),
            onEditMarker: () => {
              if (app.selectedMarker) app.startEdit(app.selectedMarker);
            },
            onDeleteMarker: handleDeleteMarker,
            onWithdrawRequests: handleWithdrawRequests,
            onAddRequest: () => {
              if (!app.selectedRequest) return;
              app.startRegisterAt({ lat: app.selectedRequest.lat, lng: app.selectedRequest.lng });
              app.setRegisterTab('request');
            },
            onPostVideoFromRequest: () => {
              if (!app.selectedRequest) return;
              const answers = answerTargets(app.selectedRequest, auth.user?.uid ?? null);
              app.startRegisterAt({ lat: app.selectedRequest.lat, lng: app.selectedRequest.lng });
              // 地点のほかの人のリクエストに応える投稿にする（ADR 0028）
              if (answers.length > 0) app.setForm((f) => ({ ...f, answers }));
              app.setRegisterTab('marker');
            },
            onSearchRelated: () => {
              const spot = app.selectedRequest;
              if (!spot) return;
              const keyword = [spot.prefecture, spot.city].filter(Boolean).join(' ');
              app.setSearchTarget('marker');
              app.setSearchQuery(keyword);
              search.searchMarkers(keyword, app.catalog.markers);
            },
          }}
        />
      </SidebarPanel>

      {/* 公開直後など、まだ 1 件も無いときだけ出す案内 */}
      {!app.catalog.loading && app.catalog.markers.length === 0 && !search.results.open && (
        <EmptyMapNotice offsetLeft={sidebarOffset} onOpenGuide={() => app.openModal('guide')} />
      )}

      <ResultsPanel
        open={search.results.open}
        title={search.results.title}
        rows={search.results.rows}
        offsetLeft={sidebarOffset}
        limitedTo={search.results.limitedTo}
        onClose={search.close}
        onJump={jump}
        onShare={handleShareRow}
        onOpenPoster={app.setPoster}
      />

      {filterLeft !== null && (
        <MapFilterBar
          filter={mapFilter.filter}
          onChange={mapFilter.setFilter}
          left={filterLeft}
          shown={mapFilter.markers.length}
          total={app.catalog.markers.length}
        />
      )}

      <HealthNotice />
      <AnswerNotice
        uid={auth.user?.uid ?? null}
        markers={app.catalog.markers}
        spots={app.catalog.requestMarkers}
        onOpen={() => app.openModal('myPosts')}
      />

      <HeaderBar
        onOpenGuide={() => app.openModal('guide')}
        onOpenMyPosts={() => app.openModal('myPosts')}
        onOpenAdmin={() => app.openModal('admin')}
      />

      <ReportModal
        open={app.modals.report}
        official={!!app.selectedMarker?.official}
        submitting={reportSubmitting}
        onClose={() => app.openModal('report', false)}
        onSubmit={handleReportSubmit}
      />

      {/* 自分の投稿・動画の詳細・投稿ガイド・管理者モードは、開いたときに読み込む */}
      <LazyModals app={app} uid={auth.user?.uid ?? null} />
    </div>
  );
}
