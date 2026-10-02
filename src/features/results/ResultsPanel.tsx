/**
 * 共通結果パネル（要件 2.3 / 4.1 / 4.4）。
 * サイドメニューの右端から 10px あけて配置し、開閉に連動して動く。
 * 行ごとに「地図へ」「共有」のボタンを持つ。チェックボックスと下部の一括ジャンプは置かない
 * （複数選んだときにどこへ飛ぶのか分からないため。2026-09-25）。
 */

import React from 'react';
import type { LatLng } from '@/core/types';
import { interpolate } from '@/core/logic/format';
import { Button, IconButton } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';
import { useViewportWidth } from '@/shared/hooks/useViewportWidth';
import type { ResultRow } from './resultRow';

const PANEL_CLASS = [
  'pointer-events-auto absolute bottom-4 z-30 flex w-[min(28rem,calc(100vw-5.5rem))] flex-col overflow-hidden',
  'rounded-xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur transition-[left] duration-200',
].join(' ');

/** 行の「地図へ」「共有」。スマホ幅（パネル約 290px）では印だけにして、題の幅を残す（2026-10-02） */
const ACTION_CLASS = 'w-9 shrink-0 sm:w-20';

/** パネルの幅（PANEL_CLASS の w-[min(28rem,calc(100vw-5.5rem))] と同じ式） */
const panelWidth = (viewport: number) => Math.min(448, viewport - 88);
/** 右上のアカウントのボタン（HeaderBar。right-4・ログインの文字で約 80px）が占める幅に余白を足したもの */
const HEADER_RESERVE = 112;
/** 上端。右上のボタンに重なるときだけ、その下（top-4 ＋ 高さ 36px ＋ 12px）に下げる（T94） */
const TOP = 16;
const TOP_UNDER_HEADER = 64;

interface ResultsPanelProps {
  open: boolean;
  title: string;
  rows: ResultRow[];
  /** サイドメニュー右端の X 座標（px）。ここから 10px あけて置く */
  offsetLeft: number;
  /** フィルタによる 100 件制限の注記を出すか */
  limitedTo?: number;
  onClose: () => void;
  onJump: (position: LatLng) => void;
  /** マーカーの行の「共有」。そのマーカーを開く URL をコピーする */
  onShare?: (markerId: string) => void;
  /** ユーザーの行（T93）を押したとき。公開プロフィールを開く */
  onOpenPoster?: (poster: { uid: string; name: string }) => void;
}

export default function ResultsPanel({
  open,
  title,
  rows,
  offsetLeft,
  limitedTo,
  onClose,
  onJump,
  onShare,
  onOpenPoster,
}: ResultsPanelProps) {
  const { t } = useI18n();
  const viewport = useViewportWidth();

  if (!open) return null;
  // スマホ幅では右端が右上のボタンに届き、閉じるボタンが隠れて押せなかった（T94）
  const underHeader = offsetLeft + 10 + panelWidth(viewport) > viewport - HEADER_RESERVE;

  return (
    <section
      className={PANEL_CLASS}
      style={{ left: offsetLeft + 10, top: underHeader ? TOP_UNDER_HEADER : TOP }}
      aria-label={title}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-2.5">
        <h2 className="text-xs font-bold text-gray-700">
          {title}
          <span className="ml-2 font-normal text-gray-400">
            {interpolate(t.results.count, { count: rows.length })}
          </span>
        </h2>
        <IconButton icon="fa-solid fa-xmark" label={t.close} onClick={onClose} />
      </header>

      <div className="grow overflow-y-auto">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-xs text-gray-400">{t.results.empty}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                {row.thumbnailUrl && (
                  <img src={row.thumbnailUrl} alt="" className="h-9 w-16 shrink-0 rounded object-cover" />
                )}
                {row.poster && <i className="fa-solid fa-circle-user shrink-0 text-lg text-gray-300" />}
                <div className="min-w-0 grow">
                  {row.poster ? (
                    <button
                      type="button"
                      className="block max-w-full truncate text-left text-[11px] font-bold text-loca-700 hover:underline"
                      onClick={() => onOpenPoster?.(row.poster!)}
                    >
                      {row.title}
                    </button>
                  ) : (
                    <p className="truncate text-[11px] font-bold text-gray-800">{row.title}</p>
                  )}
                  {/* ユーザーの行は 4 つの数を切らずに折り返す（スマホ幅で「いいね …」になるため。T93） */}
                  {row.subtitle && (
                    <p className={`${row.poster ? 'break-words' : 'truncate'} text-[10px] text-gray-500`}>{row.subtitle}</p>
                  )}
                  {/* スマホ幅では右端の指標を題の下に回す（右に並べると行がパネルから 42px はみ出した。2026-10-02） */}
                  {row.metric && <p className="truncate font-mono text-[10px] text-gray-600 sm:hidden">{row.metric}</p>}
                </div>
                {row.metric && <span className="hidden shrink-0 font-mono text-[11px] text-gray-600 sm:block">{row.metric}</span>}
                {/* 幅は中身に合わせる（w-20 では iPhone の書体で「プロフィール」がはみ出した。2026-09-26） */}
                {row.poster && (
                  <Button variant="secondary" className="shrink-0" onClick={() => onOpenPoster?.(row.poster!)}>
                    <i className="fa-solid fa-user mr-1" />
                    {t.people.profile}
                  </Button>
                )}
                {/* 動線の順（見に行く → 人に渡す）に、同じ大きさで並べる。文言は自分の投稿・マーカーの詳細とそろえる */}
                {!row.poster && (
                  <Button
                    variant="secondary"
                    className={ACTION_CLASS}
                    disabled={!row.position}
                    onClick={() => row.position && onJump(row.position)}
                    title={t.form.jumpToMap}
                    aria-label={t.myPosts.jump}
                  >
                    <i className="fa-solid fa-location-arrow sm:mr-1" />
                    <span className="hidden sm:inline">{t.myPosts.jump}</span>
                  </Button>
                )}
                {onShare && row.markerId && (
                  <Button
                    variant="secondary"
                    className={ACTION_CLASS}
                    onClick={() => onShare(row.markerId!)}
                    title={t.actions.share}
                    aria-label={t.actions.share}
                  >
                    <i className="fa-solid fa-share-nodes sm:mr-1" />
                    <span className="hidden sm:inline">{t.actions.share}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {limitedTo ? (
        <footer className="shrink-0 border-t border-gray-100 px-3 py-2">
          <p className="text-[10px] text-gray-400">{interpolate(t.results.limitMsg, { limit: limitedTo })}</p>
        </footer>
      ) : null}
    </section>
  );
}
