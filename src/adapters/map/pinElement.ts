/** 地図エンジンに依存しないピンの DOM 生成（MapLibre のアダプタが使う）。 */

export interface PinVisual {
  color: string;
  label?: string;
  ghost?: boolean;
}

const PIN_PATH = 'M16 1C9.4 1 4 6.4 4 13c0 9 12 22 12 22s12-13 12-22c0-6.6-5.4-12-12-12z';

/**
 * 縁取りの色。OSM の明るい地図で白い縁取りは地に溶けるので濃くする（T98）。
 * ラベル付き（撮影リクエスト。濃い地に白い数字）だけは、雰囲気のピンと見分けるため白のまま。
 */
const OUTLINE_DARK = '#1F2937';
const OUTLINE_LIGHT = '#ffffff';

/** 32x38 のピン。中央にラベルを置ける。 */
export function createPinElement({ color, label, ghost }: PinVisual): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'loca-pin';
  wrapper.style.cursor = 'pointer';
  wrapper.style.opacity = ghost ? '0.65' : '1';
  wrapper.style.lineHeight = '0';

  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', '32');
  svg.setAttribute('height', '38');
  svg.setAttribute('viewBox', '0 0 32 38');

  const path = document.createElementNS(svgNs, 'path');
  path.setAttribute('d', PIN_PATH);
  path.setAttribute('fill', color);
  path.setAttribute('stroke', label ? OUTLINE_LIGHT : OUTLINE_DARK);
  path.setAttribute('stroke-width', '2');
  svg.appendChild(path);

  if (label) {
    const text = document.createElementNS(svgNs, 'text');
    text.setAttribute('x', '16');
    text.setAttribute('y', '17');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '11');
    text.setAttribute('font-weight', '700');
    text.setAttribute('fill', '#ffffff');
    text.textContent = label;
    svg.appendChild(text);
  } else {
    const dot = document.createElementNS(svgNs, 'circle');
    dot.setAttribute('cx', '16');
    dot.setAttribute('cy', '13');
    dot.setAttribute('r', '4.5');
    dot.setAttribute('fill', '#ffffff');
    dot.setAttribute('fill-opacity', '0.85');
    svg.appendChild(dot);
  }

  wrapper.appendChild(svg);
  return wrapper;
}

/** 密集地をまとめた円（T41）。中にまとめた件数を出す。件数が多いほど少し大きくする。 */
export function createClusterElement(count: number): HTMLElement {
  const size = count < 10 ? 30 : count < 100 ? 36 : 42;
  const el = document.createElement('div');
  el.className = 'loca-cluster';
  el.dataset.count = String(count);
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `${count} 件`);
  Object.assign(el.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: '#ffffff',
    border: '3px solid #334155',
    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
    // 撮影リクエストのピン（濃い地に白い数字）と見分けられるよう、白地に濃い文字にする
    color: '#1e293b',
    font: '700 12px/1 sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  });
  el.textContent = count > 999 ? `${Math.floor(count / 1000)}k` : String(count);
  return el;
}
