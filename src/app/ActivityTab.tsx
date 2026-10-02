/**
 * 最近のアクティビティのタブ（T80・ADR 0034）。画面が持っている動画と撮影リクエストから一覧を作り、
 * 行を押したら共有リンクと同じく、地図を寄せてマーカーの情報か撮影リクエストの内訳を開く。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { recentActivity, type ActivityItem } from '@/core/logic/activity';
import ActivityPanel from '@/features/activity/ActivityPanel';
import type { LocaApp } from './useLocaApp';

export default function ActivityTab({ app }: { app: LocaApp }) {
  const { catalog, jumpTo, handleMarkerClick, handleRequestClick } = app;
  const items = useMemo(() => recentActivity(catalog.markers, catalog.requestMarkers), [catalog.markers, catalog.requestMarkers]);
  // 「〇分前」を開いている間も進める
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const select = (item: ActivityItem) => {
    if (item.kind === 'video') {
      const marker = catalog.markers.find((m) => m.id === item.markerId);
      if (!marker) return;
      jumpTo({ lat: marker.lat, lng: marker.lng });
      handleMarkerClick(marker);
      return;
    }
    const spot = catalog.requestMarkers.find((s) => s.id === item.spotId);
    if (!spot) return;
    jumpTo({ lat: spot.lat, lng: spot.lng });
    handleRequestClick(spot);
  };

  return <ActivityPanel items={items} now={now} onSelect={select} />;
}
