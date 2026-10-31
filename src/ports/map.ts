import type { Bounds, LatLng } from '@/core/types';
import type { Adapter, Unsubscribe } from './common';

/** 地図に置くピンの見た目と振る舞い。 */
export interface MapPinOptions {
  id: string;
  position: LatLng;
  /** 塗り色（#RRGGBB） */
  color: string;
  /** ピン中央に出す文字。撮影リクエストの熱量表示などに使う */
  label?: string;
  /** 半透明にする（仮マーカー） */
  ghost?: boolean;
  zIndex?: number;
  onClick?: () => void;
}

/** 地図上に開く情報ウィンドウ。 */
export interface InfoWindowOptions {
  position: LatLng;
  /** 信頼済みの HTML 文字列。呼び出し側でエスケープ済みにすること */
  html: string;
  onClose?: () => void;
}

/**
 * 地図エンジンのポート。
 * 地図の部品を差し替えても同じ機能を満たせる粒度に切っている（今の実装は MapLibre と OpenStreetMap。ADR 0032）。
 */
export interface MapPort extends Adapter {
  /** 地図を生成して DOM に載せる。二重呼び出しは無視する。 */
  mount(container: HTMLElement): Promise<void>;
  destroy(): void;
  readonly isReady: boolean;

  setCenter(pos: LatLng, zoom?: number): void;
  fitBounds(bounds: Bounds, paddingPx?: number): void;
  getZoom(): number;

  /** ピンの全置き換え。差分計算は実装側の責務。 */
  setPins(pins: MapPinOptions[]): void;
  /** 仮マーカー（常にグレー・1 個だけ）。null で消す。 */
  setGhostPin(position: LatLng | null): void;

  openInfoWindow(options: InfoWindowOptions): void;
  closeInfoWindow(): void;

  /** 地図の空白部分のクリック。 */
  onMapClick(cb: (pos: LatLng) => void): Unsubscribe;

  /** 矩形描画モードの ON/OFF。ON の間はカーソルが十字になる。 */
  setRectangleDrawing(enabled: boolean): void;
  /** 矩形の描画完了。マウスアップ時に 1 回呼ばれる。 */
  onRectangleDrawn(cb: (bounds: Bounds) => void): Unsubscribe;
  /** 描画済みの矩形を表示／消去する。 */
  showRectangle(bounds: Bounds | null): void;
}
