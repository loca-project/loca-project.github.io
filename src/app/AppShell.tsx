/** 画面全体の組み立てと、各操作のつなぎ込み。 */

import React, { useCallback, useEffect, useState } from 'react';
import type { LatLng, ReportReason } from '@/core/types';
import { MapMode, TabMode } from '@/core/types';
import { encodeSharedView } from '@/core/logic/shareUrl';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAuth } from '@/shared/hooks/useAuth';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useToast } from '@/shared/components/Toast';
import MapCanvas from '@/features/map/MapCanvas';
import {
  LOCA_INFO_EVENT,
  buildMarkerInfoHtml,
  installInfoWindowDelegate,
  type InfoActionDetail,
} from '@/features/map/infoWindow';
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
import { useLocaApp } from './useLocaApp';
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
  const toast = useToast();
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

  // インフォウィンドウ内のボタンは CustomEvent 経由で受け取る
  useEffect(() => installInfoWindowDelegate(), []);
  useEffect(() => {
    const onAction = (e: Event) => {
      const { action, markerId } = (e as CustomEvent<InfoActionDetail>).detail;
      const marker = app.catalog.markers.find((m) => m.id === markerId);
      if (!marker) return;
      app.setSelectedMarker(marker);
      app.openModal(action === 'details' ? 'videoDetails' : 'report');
    };
    window.addEventListener(LOCA_INFO_EVENT, onAction);
    return () => window.removeEventListener(LOCA_INFO_EVENT, onAction);
  }, [app]);

  // マーカーを選んだらインフォウィンドウを開く（要件 3.5 の排他表示）
  useEffect(() => {
    if (app.mapMode === MapMode.EDIT && app.selectedMarker) {
      app.services.map.openInfoWindow({
        position: { lat: app.selectedMarker.lat, lng: app.selectedMarker.lng },
        html: buildMarkerInfoHtml(app.selectedMarker, {
          openYoutube: t.details.openYoutube,
          report: t.actions.report,
          details: t.details.btnLabel,
        }),
      });
    }
  }, [app.selectedMarker, app.mapMode, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeMobileSidebar = useCallback(() => {
    if (window.innerWidth < 768) app.setSidebarOpen(false);
  }, [app]);

  const handleSearch = useCallback(async () => {
    closeMobileSidebar();
    if (app.searchTarget === 'map') {
      const error = await search.searchPlace(app.searchQuery, app.catalog.markers);
      if (error) toast.error(error);
      return;
    }
    await search.searchMarkers(app.searchQuery, app.catalog.markers);
  }, [app, search, toast, closeMobileSidebar]);

  const handleSubmitMarker = useCallback(async () => {
    if (!app.tempPos) {
      toast.info(t.post.needPlace);
      return;
    }
    const result = await submit({
      form: app.form,
      existing: app.catalog.markers,
      equipment: app.catalog.equipment,
      editing: app.editing,
    });
    if (!result) return; // 実行中の 2 回目の押下
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    if (result.saved) app.catalog.upsertMarker(result.saved);
    app.resetToSearch();
  }, [app, submit, toast]);

  /** 本人の撮影リクエストの取り下げ（熱量が戻る）。取り下げた分は集計から外す。 */
  const handleWithdrawRequests = useCallback(
    async (entries: { id: string; heat: number }[]) => {
      const result = await requestSubmit.withdraw(entries);
      if (!result) return; // 実行中の 2 回目の押下（取り下げ済みのものを消そうとして拒否されるのを防ぐ）
      app.catalog.removeRequestEntryIds(result.removedIds);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      app.resetToSearch();
    },
    [app, requestSubmit, toast],
  );

  /** 投稿タブのパネルからのログイン。 */
  const handleSignIn = useCallback(async () => {
    try {
      if (await auth.signIn()) toast.success(t.auth.signedIn);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [auth, toast, t]);

  /** 本人のマーカーの論理削除（要件 3.x）。元に戻せないので確認を挟む。 */
  const handleDeleteMarker = useCallback(async () => {
    const marker = app.selectedMarker;
    if (!marker || !window.confirm(t.store.confirmDelete)) return;
    const result = await remove(marker);
    if (!result) return;
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    app.catalog.removeMarker(marker.id);
    app.resetToSearch();
  }, [app, remove, toast, t]);

  const handleSubmitRequest = useCallback(async () => {
    if (!app.tempPos) {
      toast.info(t.post.needPlace);
      return;
    }
    const result = await requestSubmit.submit(app.requestForm, app.tempPos);
    if (!result) return;
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    if (result.saved) app.catalog.addRequestEntries([result.saved]);
    app.resetToSearch();
  }, [app, requestSubmit, toast, t]);

  const copyLink = useCallback(
    async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        toast.info(t.actions.linkCopied);
      } catch (e) {
        console.error('[loca] リンクをコピーできませんでした', e);
        toast.error(t.actions.linkCopyFailed);
      }
    },
    [t, toast],
  );

  const handleShare = useCallback(async () => {
    if (!app.selectedMarker && !app.selectedRequest) return;
    // 今の URL には地図フィルタと選択中のマーカー（撮影リクエストの地点）が載っている（T42・T84）。開いた人に同じ地図を見せる
    await copyLink(window.location.href);
  }, [app.selectedMarker, app.selectedRequest, copyLink]);

  /** 結果パネルの行の「共有」。今の地図フィルタのまま、その行のマーカーを開く URL を渡す（T42 と同じ形） */
  const handleShareRow = useCallback(
    (markerId: string) => {
      const { origin, pathname, search, hash } = window.location;
      void copyLink(`${origin}${pathname}${encodeSharedView({ filter: mapFilter.filter, markerId }, search)}${hash}`);
    },
    [copyLink, mapFilter.filter],
  );

  const range = useRangeSelect(app, search, mapFilter.markers, closeMobileSidebar);

  /** 通報（要件 3.8）。Firestore に保存し、管理者が対応するまでマーカーは表示したまま。 */
  const report = useExclusive();
  const handleReportSubmit = useCallback(
    async (reasons: ReportReason[], detail: string) => {
      const marker = app.selectedMarker;
      const store = app.services.reportStore;
      if (!marker) return;
      if (!store) {
        toast.error(t.actions.reportUnavailable);
        return;
      }
      if (!auth.user) {
        toast.info(t.actions.reportLogin);
        return;
      }
      const result = await report.exclusive(async () => {
        try {
          return await store.submit({ markerId: marker.id, reasons, detail });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : String(e));
          return null;
        }
      });
      if (!result) return;
      toast.success(result === 'created' ? t.actions.reportSent : t.actions.reportUpdated);
      app.openModal('report', false);
    },
    [app, auth.user, report, t, toast],
  );

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
        submitting={report.loading}
        onClose={() => app.openModal('report', false)}
        onSubmit={handleReportSubmit}
      />

      {/* 自分の投稿・動画の詳細・投稿ガイド・管理者モードは、開いたときに読み込む */}
      <LazyModals app={app} uid={auth.user?.uid ?? null} />
    </div>
  );
}
