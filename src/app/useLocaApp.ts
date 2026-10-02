/**
 * アプリの状態と操作をまとめた view-model。
 * App.tsx は、ここが返す値を描画するだけにする。
 *
 * 保持するのは UI 状態と読み込んだ公開データだけ。保存は useMarkerSubmit がポート越しに行う。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Bounds, LatLng, MarkerData, RankingFilter, RequestMarkerData } from '@/core/types';
import { DEFAULT_PEOPLE_FILTER, type PeopleFilter } from '@/core/logic/people';
import { DEFAULT_RANKING_FILTER, MapMode, TabMode } from '@/core/types';
import { JUMP_ZOOM } from '@/core/logic/geo';
import { useCatalog } from '@/shared/hooks/useCatalog';
import { useServices } from '@/shared/hooks/useServices';
import { EMPTY_FORM, formFromMarker, type MarkerFormState } from '@/features/marker/formState';
import { EMPTY_REQUEST_FORM, type RequestFormState } from '@/features/sidebar/RequestForm';
import type { SearchTarget } from '@/features/sidebar/SearchPanel';

export type ModalName = 'admin' | 'report' | 'videoDetails' | 'requestList' | 'guide' | 'myPosts';

export function useLocaApp() {
  const services = useServices();
  const catalog = useCatalog();

  const [tab, setTab] = useState<TabMode>(TabMode.MAP);
  const [mapMode, setMapMode] = useState<MapMode>(MapMode.SEARCH);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  // 選んだときの写しをそのまま出すと、差分の購読で届いた変更（投稿者名の追従など）が開き直すまで映らない。
  // 一覧に同じ ID の行があれば、いつもその最新の行を出す。一覧から消えたら（削除・取り下げ）選択を解く（下の effect）
  const [pickedMarker, setSelectedMarker] = useState<MarkerData | null>(null);
  const selectedMarker = useMemo(
    () => (pickedMarker ? (catalog.markers.find((m) => m.id === pickedMarker.id) ?? null) : null),
    [pickedMarker, catalog.markers],
  );
  const [pickedRequest, setSelectedRequest] = useState<RequestMarkerData | null>(null);
  const selectedRequest = useMemo(
    () => (pickedRequest ? (catalog.requestMarkers.find((s) => s.id === pickedRequest.id) ?? null) : null),
    [pickedRequest, catalog.requestMarkers],
  );
  const [tempPos, setTempPos] = useState<LatLng | null>(null);
  /** 開いている投稿者の公開プロフィール（T82）。null なら閉じている */
  const [poster, setPoster] = useState<{ uid: string; name: string } | null>(null);

  const [form, setForm] = useState<MarkerFormState>(EMPTY_FORM);
  const [requestForm, setRequestForm] = useState<RequestFormState>(EMPTY_REQUEST_FORM);
  const [registerTab, setRegisterTab] = useState<'marker' | 'request'>('marker');
  /** 編集中のマーカー（本人のみ）。新規登録なら null */
  const [editing, setEditing] = useState<MarkerData | null>(null);

  const [searchTarget, setSearchTarget] = useState<SearchTarget>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [rectangle, setRectangle] = useState<Bounds | null>(null);

  const [filter, setFilter] = useState<RankingFilter>(DEFAULT_RANKING_FILTER);
  /** ユーザーのタブの条件（T93）。タブを切り替えても残す */
  const [people, setPeople] = useState<PeopleFilter>(DEFAULT_PEOPLE_FILTER);
  const [modals, setModals] = useState<Record<ModalName, boolean>>({
    admin: false,
    report: false,
    videoDetails: false,
    requestList: false,
    guide: false,
    myPosts: false,
  });

  const openModal = useCallback((name: ModalName, open = true) => {
    setModals((prev) => ({ ...prev, [name]: open }));
  }, []);

  /** 地図タブの検索モードに戻し、仮マーカーと選択を解除する（要件 3.2）。 */
  const resetToSearch = useCallback(() => {
    setTab(TabMode.MAP);
    setMapMode(MapMode.SEARCH);
    setTempPos(null);
    setSelectedMarker(null);
    setSelectedRequest(null);
    setForm(EMPTY_FORM);
    setRequestForm(EMPTY_REQUEST_FORM);
    setEditing(null);
    services.map.closeInfoWindow();
  }, [services.map]);

  // 選んでいたマーカー・撮影リクエストの地点が一覧から消えたら（自分やほかの人の削除・取り下げ）、
  // 消えたものの情報を出し続けないよう、選択を解いてサイドメニューとインフォウィンドウを閉じる
  const selectionGone = (pickedMarker && !selectedMarker) || (pickedRequest && !selectedRequest);
  useEffect(() => {
    if (selectionGone && !catalog.loading) resetToSearch();
  }, [selectionGone, catalog.loading, resetToSearch]);

  const jumpTo = useCallback(
    (pos: LatLng) => {
      services.map.setCenter(pos, JUMP_ZOOM);
      setTab(TabMode.MAP);
    },
    [services.map],
  );

  /** 投稿タブを開く。場所は地図のクリックで選ぶ（編集中だったら新規の入力に戻す）。 */
  const openPostTab = useCallback(() => {
    services.map.closeInfoWindow();
    setTab(TabMode.POST);
    setMapMode(MapMode.REGISTER);
    setSelectedMarker(null);
    setSelectedRequest(null);
    setSidebarOpen(true);
    if (editing) {
      setEditing(null);
      setTempPos(null);
      setForm(EMPTY_FORM);
    }
  }, [editing, services.map]);

  /** 指定した地点で投稿タブを開く（撮影リクエストの地点から投稿・リクエストするとき）。 */
  const startRegisterAt = useCallback(
    (pos: LatLng) => {
      services.map.closeInfoWindow();
      setTab(TabMode.POST);
      setMapMode(MapMode.REGISTER);
      setSelectedMarker(null);
      setSelectedRequest(null);
      setEditing(null);
      setTempPos(pos);
      setForm({ ...EMPTY_FORM, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) });
      setSidebarOpen(true);
    },
    [services.map],
  );

  /**
   * 地図のクリック（指摘 9）。見ているだけの人を投稿画面に飛ばさない。
   * 投稿タブの間だけ、入力を保ったままピンの位置を決める・動かす。
   * マーカー・撮影リクエストを選んでいるときは、マーカー以外のクリックで選択を解き、サイドメニューを検索の最初に戻す
   * （ピンのクリックは pinLayer が止めるので、ここには地図の地面のクリックだけが届く）。
   * 投稿タブ以外では、地図の地面を押したらサイドメニューを閉じる（T108。投稿タブは場所を選ぶのでフォームを開いたままにする）。
   */
  const hasSelection = pickedMarker !== null || pickedRequest !== null;
  const handleMapClick = useCallback(
    (pos: LatLng) => {
      if (drawing) return;
      if (tab === TabMode.POST) {
        setTempPos(pos);
        setForm((prev) => ({ ...prev, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }));
        return;
      }
      if (hasSelection) resetToSearch();
      else services.map.closeInfoWindow();
      setSidebarOpen(false);
    },
    [drawing, tab, hasSelection, resetToSearch, services.map],
  );

  const handleMarkerClick = useCallback((marker: MarkerData) => {
    setTab(TabMode.MAP);
    setSelectedRequest(null);
    setSelectedMarker(marker);
    setTempPos(null);
    setMapMode(MapMode.EDIT);
    setSidebarOpen(true);
  }, []);

  const handleRequestClick = useCallback((marker: RequestMarkerData) => {
    setTab(TabMode.MAP);
    setSelectedMarker(null);
    setSelectedRequest(marker);
    setTempPos(null);
    setMapMode(MapMode.REQUEST_VIEW);
    setSidebarOpen(true);
  }, []);

  /** 本人のマーカーを編集フォームに読み込む（要件 3.x。GPS も変更できる）。 */
  const startEdit = useCallback(
    (marker: MarkerData) => {
      services.map.closeInfoWindow();
      setTab(TabMode.POST);
      setMapMode(MapMode.REGISTER);
      setRegisterTab('marker');
      setEditing(marker);
      setSelectedMarker(null);
      setTempPos({ lat: marker.lat, lng: marker.lng });
      setForm(formFromMarker(marker));
      setSidebarOpen(true);
    },
    [services.map],
  );

  /** GPS 欄の手入力に合わせて仮マーカーと地図を動かす（要件 3.2）。 */
  const patchForm = useCallback(
    (patch: Partial<MarkerFormState>) => {
      setForm((prev) => {
        const next = { ...prev, ...patch };
        if (patch.lat !== undefined || patch.lng !== undefined) {
          const lat = Number(next.lat);
          const lng = Number(next.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            setTempPos({ lat, lng });
            services.map.setCenter({ lat, lng });
          }
        }
        return next;
      });
    },
    [services.map],
  );

  const requestEntriesOf = useMemo(
    () => (markerId: string) => catalog.requestMarkers.filter((r) => r.id === markerId),
    [catalog.requestMarkers],
  );

  return {
    services,
    catalog,
    tab,
    setTab,
    mapMode,
    setMapMode,
    sidebarOpen,
    setSidebarOpen,
    selectedMarker,
    setSelectedMarker,
    selectedRequest,
    tempPos,
    setTempPos,
    form,
    patchForm,
    setForm,
    requestForm,
    setRequestForm,
    registerTab,
    setRegisterTab,
    editing,
    startEdit,
    searchTarget,
    setSearchTarget,
    searchQuery,
    setSearchQuery,
    drawing,
    setDrawing,
    rectangle,
    setRectangle,
    filter,
    setFilter,
    people,
    setPeople,
    modals,
    openModal,
    resetToSearch,
    jumpTo,
    handleMapClick,
    startRegisterAt,
    openPostTab,
    handleMarkerClick,
    handleRequestClick,
    requestEntriesOf,
    poster,
    setPoster,
  };
}

export type LocaApp = ReturnType<typeof useLocaApp>;
