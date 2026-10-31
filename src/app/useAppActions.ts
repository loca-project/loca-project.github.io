/** 画面の操作（検索・投稿・削除・共有・通報など）。結果をトーストで伝えて、一覧と画面の状態へ反映する。 */

import { useCallback } from 'react';
import type { ReportReason } from '@/core/types';
import { encodeSharedView } from '@/core/logic/shareUrl';
import { useI18n } from '@/shared/hooks/useI18n';
import type { useAuth } from '@/shared/hooks/useAuth';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useToast } from '@/shared/components/Toast';
import type { useLocaApp } from './useLocaApp';
import type { useMapFilter } from './useMapFilter';
import type { useMarkerSubmit } from './useMarkerSubmit';
import type { useRequestSubmit } from './useRequestSubmit';
import type { useSearchAndRanking } from './useSearchAndRanking';

interface Deps {
  app: ReturnType<typeof useLocaApp>;
  auth: ReturnType<typeof useAuth>;
  search: ReturnType<typeof useSearchAndRanking>;
  requestSubmit: ReturnType<typeof useRequestSubmit>;
  submit: ReturnType<typeof useMarkerSubmit>['submit'];
  remove: ReturnType<typeof useMarkerSubmit>['remove'];
  filter: ReturnType<typeof useMapFilter>['filter'];
}

export function useAppActions({ app, auth, search, requestSubmit, submit, remove, filter }: Deps) {
  const { t } = useI18n();
  const toast = useToast();

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
      const { origin, pathname, search: query, hash } = window.location;
      void copyLink(`${origin}${pathname}${encodeSharedView({ filter, markerId }, query)}${hash}`);
    },
    [copyLink, filter],
  );

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

  return {
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
    reportSubmitting: report.loading,
  };
}
