/**
 * MapLibre GL JS + OpenStreetMap の標準タイルによる地図アダプタ（ADR 0032）。
 *
 * OSM のタイルは API キー不要・請求先不要（OSM 財団の利用規約に従うだけ）で、
 * GitHub Pages のような静的配信からそのまま使える。予備のタイルは持たない。
 * タイルを 1 枚も読めなかったときだけ、その旨を画面に出す。
 */

import type { Map as MlMap, Marker as MlMarker, Popup as MlPopup } from 'maplibre-gl';
import type { Bounds, LatLng } from '@/core/types';
import type { InfoWindowOptions, MapPinOptions, MapPort, Unsubscribe } from '@/ports';
import { JAPAN_BOUNDS, MAX_ZOOM, MIN_ZOOM, normalizeBounds } from '@/core/logic/geo';
import { NEUTRAL_HEX } from '@/core/constants';
import { createPinElement } from './pinElement';
import { PinLayer } from './pinLayer';
import { setHealth } from '@/runtime/health';
import {
  OSM_SOURCE,
  RECT_FILL,
  RECT_LINE,
  RECT_SOURCE,
  boundsToFeatureCollection,
  osmStyle,
} from './maplibreStyle';

type MapLibreModule = typeof import('maplibre-gl');

export class MapLibreAdapter implements MapPort {
  readonly name = 'maplibre';

  private map: MlMap | null = null;
  private lib: MapLibreModule | null = null;
  /** ピンとクラスタ（T41）。地図の読み込みが終わってから作る */
  private pinLayer: PinLayer | null = null;
  /** 読み込み前に渡されたピン。PinLayer を作ったら渡す */
  private pendingPins: MapPinOptions[] = [];
  /**
   * 地図を作る前に頼まれた中心と吹き出し。作ったら当てる。
   * 共有リンク（?m=）は公開データが届いた時点で寄せるので、地図の部品の読み込みより先に来ることがある（T106）
   */
  private pendingCenter: { pos: LatLng; zoom?: number } | null = null;
  private pendingInfo: InfoWindowOptions | null = null;
  private ghost: MlMarker | null = null;
  private popup: MlPopup | null = null;

  private mapClickHandlers = new Set<(pos: LatLng) => void>();
  private rectHandlers = new Set<(b: Bounds) => void>();
  private drawing = false;
  private dragStart: LatLng | null = null;

  get isReady(): boolean {
    return this.map !== null;
  }

  /** WebGL が無い環境では描画できないため、ここで判定して他の実装に譲る。 */
  async probe(): Promise<boolean> {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      return gl !== null;
    } catch {
      return false;
    }
  }

  /**
   * タイルを 1 枚も読めていない状態でのエラーだけを「地図を取得できない」とみなす。
   * 一部のタイルだけが読めないときは知らせない。
   */
  private watchTiles(map: MlMap): void {
    let loaded = false;
    map.on('data', (e) => {
      if (e.dataType === 'source' && 'sourceId' in e && e.sourceId === OSM_SOURCE && 'tile' in e) {
        loaded = true;
        setHealth({ mapUnavailable: false });
      }
    });
    map.on('error', (e) => {
      if (loaded || (e as { sourceId?: string }).sourceId !== OSM_SOURCE) return;
      console.warn('[loca] OpenStreetMap のタイルを取得できませんでした', e.error);
      setHealth({ mapUnavailable: true });
    });
  }

  /**
   * mount と destroy のたびに進める世代番号。
   * StrictMode では mount → destroy → mount が await の途中で重なるため、
   * await から戻ったときに世代が変わっていたら、その mount は捨てる（T34）。
   */
  private generation = 0;

  async mount(container: HTMLElement): Promise<void> {
    if (this.map) return;
    const gen = ++this.generation;
    const lib = await import('maplibre-gl');
    if (gen !== this.generation) return;
    this.lib = lib;

    const map = new lib.Map({
      container,
      style: osmStyle() as never,
      bounds: [
        [JAPAN_BOUNDS.west, JAPAN_BOUNDS.south],
        [JAPAN_BOUNDS.east, JAPAN_BOUNDS.north],
      ],
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      // maxBounds は設定しない。
      // 全世界（-180〜180）を渡すと MapLibre の制約計算が破綻し、
      // 中心が経度 180 度・ズーム最大に飛ばされて何も描画されなくなる（実測で確認）。
      // 要件 3.1 の「世界地図以外を表示させない」は minZoom と
      // renderWorldCopies（既定 true）で足りる。
    });

    this.map = map;
    if (this.pendingCenter) {
      const { pos, zoom } = this.pendingCenter;
      this.pendingCenter = null;
      map.jumpTo({ center: [pos.lng, pos.lat], ...(zoom !== undefined ? { zoom } : {}) });
    }

    map.addControl(new lib.NavigationControl({ showCompass: false }), 'bottom-right');
    this.watchTiles(map);
    // 読み込み前に destroy されたら 'load' は来ないので、'remove' でも待ちを解く
    await new Promise<void>((resolve) => {
      map.once('load', () => resolve());
      map.once('remove', () => resolve());
    });
    if (gen !== this.generation) return;
    this.setupRectangleLayer();
    this.setupInteractions();
    this.pinLayer = new PinLayer(map, lib);
    this.pinLayer.setPins(this.pendingPins);
    if (this.pendingInfo) this.openInfoWindow(this.pendingInfo);
  }

  private setupRectangleLayer(): void {
    const map = this.map;
    if (!map) return;
    map.addSource(RECT_SOURCE, { type: 'geojson', data: boundsToFeatureCollection(null) as never });
    map.addLayer({
      id: RECT_FILL,
      type: 'fill',
      source: RECT_SOURCE,
      paint: { 'fill-color': '#2f7de1', 'fill-opacity': 0.12 },
    });
    map.addLayer({
      id: RECT_LINE,
      type: 'line',
      source: RECT_SOURCE,
      paint: { 'line-color': '#2f7de1', 'line-width': 2 },
    });
  }

  private setupInteractions(): void {
    const map = this.map;
    if (!map) return;

    map.on('click', (e) => {
      if (this.drawing) return;
      this.mapClickHandlers.forEach((h) => h({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    });

    map.on('mousedown', (e) => {
      if (!this.drawing) return;
      e.preventDefault();
      this.dragStart = { lat: e.lngLat.lat, lng: e.lngLat.lng };
    });

    map.on('mousemove', (e) => {
      if (!this.drawing || !this.dragStart) return;
      this.showRectangle(normalizeBounds(this.dragStart, { lat: e.lngLat.lat, lng: e.lngLat.lng }));
    });

    map.on('mouseup', (e) => {
      if (!this.drawing || !this.dragStart) return;
      const bounds = normalizeBounds(this.dragStart, { lat: e.lngLat.lat, lng: e.lngLat.lng });
      this.dragStart = null;
      this.setRectangleDrawing(false);
      this.showRectangle(bounds);
      this.rectHandlers.forEach((h) => h(bounds));
    });
  }

  destroy(): void {
    this.generation += 1;
    this.pinLayer?.destroy();
    this.pinLayer = null;
    this.ghost?.remove();
    this.ghost = null;
    this.popup?.remove();
    this.popup = null;
    this.map?.remove();
    this.map = null;
  }

  setCenter(pos: LatLng, zoom?: number): void {
    if (!this.map) {
      this.pendingCenter = { pos, zoom };
      return;
    }
    this.map.easeTo({ center: [pos.lng, pos.lat], zoom: zoom ?? this.map.getZoom(), duration: 600 });
  }

  fitBounds(bounds: Bounds, paddingPx = 48): void {
    this.map?.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { padding: paddingPx, duration: 600 },
    );
  }

  getZoom(): number {
    return this.map?.getZoom() ?? MIN_ZOOM;
  }

  /** ピンの全置き換え。密集地はまとめて描く（T41。pinLayer.ts） */
  setPins(pins: MapPinOptions[]): void {
    this.pendingPins = pins;
    this.pinLayer?.setPins(pins);
  }

  /** 仮マーカーは要件 3.2 により感情タグによらず一律グレー。 */
  setGhostPin(position: LatLng | null): void {
    const map = this.map;
    const lib = this.lib;
    if (!map || !lib) return;

    if (!position) {
      this.ghost?.remove();
      this.ghost = null;
      return;
    }
    if (!this.ghost) {
      const el = createPinElement({ color: NEUTRAL_HEX, ghost: true });
      // addTo の前に座標を与えないと MapLibre 側で参照エラーになる
      this.ghost = new lib.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([position.lng, position.lat])
        .addTo(map);
      return;
    }
    this.ghost.setLngLat([position.lng, position.lat]);
  }

  openInfoWindow(options: InfoWindowOptions): void {
    const map = this.map;
    const lib = this.lib;
    // 読み込みが終わる前（PinLayer を作る前）は覚えておき、mount の最後に開く
    if (!map || !lib || !this.pinLayer) {
      this.pendingInfo = options;
      return;
    }
    this.closeInfoWindow();
    this.popup = new lib.Popup({ offset: 38, closeButton: true, maxWidth: '320px' })
      .setLngLat([options.position.lng, options.position.lat])
      .setHTML(options.html)
      .addTo(map);
    if (options.onClose) this.popup.on('close', options.onClose);
  }

  closeInfoWindow(): void {
    this.pendingInfo = null;
    this.popup?.remove();
    this.popup = null;
  }

  onMapClick(cb: (pos: LatLng) => void): Unsubscribe {
    this.mapClickHandlers.add(cb);
    return () => {
      this.mapClickHandlers.delete(cb);
    };
  }

  setRectangleDrawing(enabled: boolean): void {
    this.drawing = enabled;
    const map = this.map;
    if (!map) return;
    map.getCanvas().style.cursor = enabled ? 'crosshair' : '';
    if (enabled) map.dragPan.disable();
    else map.dragPan.enable();
  }

  onRectangleDrawn(cb: (b: Bounds) => void): Unsubscribe {
    this.rectHandlers.add(cb);
    return () => {
      this.rectHandlers.delete(cb);
    };
  }

  showRectangle(bounds: Bounds | null): void {
    const source = this.map?.getSource(RECT_SOURCE);
    if (!source || !('setData' in source)) return;
    (source as { setData: (d: unknown) => void }).setData(boundsToFeatureCollection(bounds));
  }
}
