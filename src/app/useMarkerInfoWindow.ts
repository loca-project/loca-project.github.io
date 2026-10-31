/** マーカーのインフォウィンドウ: 選んだら開き、中のボタンの操作を受け取る。 */

import { useEffect } from 'react';
import { MapMode } from '@/core/types';
import {
  LOCA_INFO_EVENT,
  buildMarkerInfoHtml,
  installInfoWindowDelegate,
  type InfoActionDetail,
} from '@/features/map/infoWindow';
import { useI18n } from '@/shared/hooks/useI18n';
import type { useLocaApp } from './useLocaApp';

export function useMarkerInfoWindow(app: ReturnType<typeof useLocaApp>) {
  const { t } = useI18n();

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
}
