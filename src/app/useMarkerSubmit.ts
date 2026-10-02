/**
 * マーカーの登録・更新・削除。
 *
 * Firestore に保存する（ADR 0010）。Firebase の設定が無い構成（services.markerStore が null）では投稿できない。
 * 入力を検証し、動画情報（oEmbed）と地名（OpenStreetMap の Nominatim）を取得してから保存する。
 */

import { useCallback } from 'react';
import type { MarkerContent, MarkerData, PlaceMeta, VideoMeta } from '@/core/types';
import { getYoutubeId } from '@/core/logic/youtube';
import { validateMarkerDraft } from '@/core/logic/validation';
import { normalizeMemo, toMarkerTags } from '@/core/logic/tags';
import { isValidEquipment } from '@/core/logic/equipment';
import { findDuplicateByVideoId } from '@/core/logic/search';
import { UpstreamTimeoutError, type AuthUser } from '@/ports';
import { useServices } from '@/shared/hooks/useServices';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useProfile } from '@/shared/hooks/useProfile';
import { useI18n } from '@/shared/hooks/useI18n';
import { draftFromForm, type MarkerFormState } from '@/features/marker/formState';

export interface SubmitContext {
  form: MarkerFormState;
  existing: MarkerData[];
  equipment: Parameters<typeof isValidEquipment>[0];
  /** 編集中のマーカー。新規登録なら null */
  editing: MarkerData | null;
}

export interface SubmitResult {
  ok: boolean;
  message: string;
  /** Firestore に保存したとき、手元の一覧に反映する形 */
  saved?: MarkerData;
}

/** 保存する内容を組み立てる。地名が取れなければ編集前の値を残す。 */
function contentOf(form: MarkerFormState, videoId: string, meta: VideoMeta, place: PlaceMeta | null, prev: MarkerData | null) {
  const content: MarkerContent = {
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    videoId,
    lat: Number(form.lat),
    lng: Number(form.lng),
    tags: toMarkerTags(form.tags),
    // 空にしたときも項目を残す（更新でアダプタが古いメモを消せるように）
    memo: normalizeMemo(form.memo),
    equipment: form.equipment,
    title: meta.title,
    channelTitle: meta.channelTitle,
    thumbnailUrl: meta.thumbnailUrl,
    prefecture: place?.prefecture ?? prev?.prefecture,
    city: place?.city ?? prev?.city,
  };
  // 応えるリクエストは新規登録のときだけ付ける（ルールも作成のあとは変えさせない）
  if (!prev && form.answers?.length) content.answers = form.answers;
  return content;
}

/** 保存直後に手元の一覧へ入れる形。時刻は端末の時計で近似する（正確な値は Firestore 側にある）。 */
function localMarker(id: string, content: MarkerContent, user: AuthUser, author: string, prev: MarkerData | null): MarkerData {
  const now = Date.now();
  return {
    ...content,
    id,
    ownerUid: prev?.ownerUid ?? user.uid,
    createdBy: prev?.createdBy ?? author,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    deleted: false,
  };
}

export function useMarkerSubmit() {
  const { video, geocode, auth, markerStore } = useServices();
  const { t } = useI18n();
  const { loading, exclusive } = useExclusive();
  const { profile } = useProfile();

  const submit = useCallback(
    async (ctx: SubmitContext): Promise<SubmitResult | undefined> => {
      const user = auth?.currentUser() ?? null;
      if (!markerStore) return { ok: false, message: t.store.unavailable };
      if (!user) return { ok: false, message: t.store.loginRequired };
      // 投稿者名はプロフィールのニックネーム（ADR 0019）。アダプタとルールでも確かめる
      if (!profile) return { ok: false, message: t.profile.needed };

      const issues = validateMarkerDraft(draftFromForm(ctx.form, ''));
      if (issues.length > 0) {
        return { ok: false, message: t.alerts[issues[0].messageKey as keyof typeof t.alerts] };
      }

      const videoId = getYoutubeId(ctx.form.youtubeUrl);
      if (!videoId) return { ok: false, message: t.alerts.invalidUrl };

      // 要件 3.3: 同じ動画が既に登録されていれば登録させない（編集中の自分自身は除く）
      const others = ctx.existing.filter((m) => m.id !== ctx.editing?.id);
      if (findDuplicateByVideoId(others, videoId, getYoutubeId)) {
        return { ok: false, message: t.alerts.duplicateUrl };
      }

      if (!isValidEquipment(ctx.equipment, ctx.form.equipment)) {
        return { ok: false, message: '登録されていない撮影機器の組み合わせです。' };
      }

      return exclusive(async () => {
        try {
          // 動画情報は必須。地名は取れなくても保存は止めない（日次の再生成で補う）
          const [metaResult, placeResult] = await Promise.allSettled([
            video.fetchMeta(videoId),
            geocode.reverse(Number(ctx.form.lat), Number(ctx.form.lng)),
          ]);
          if (metaResult.status === 'rejected') {
            // 応答しないときは URL の誤りと取られないよう、文言を分ける（T103）
            const timedOut = metaResult.reason instanceof UpstreamTimeoutError;
            return { ok: false, message: timedOut ? t.alerts.fetchTimeout : t.alerts.fetchFail };
          }
          const meta = metaResult.value;
          const place = placeResult.status === 'fulfilled' ? placeResult.value : null;

          const content = contentOf(ctx.form, videoId, meta, place, ctx.editing);
          const id = ctx.editing ? ctx.editing.id : await markerStore.create(content);
          if (ctx.editing) await markerStore.update(id, content);
          return {
            ok: true,
            message: ctx.editing ? t.store.updated : t.store.saved,
            saved: localMarker(id, content, user, profile.nickname, ctx.editing),
          };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
      });
    },
    [video, geocode, auth, markerStore, profile, exclusive, t],
  );

  /** 本人のマーカーを論理削除する。 */
  const remove = useCallback(
    async (marker: MarkerData): Promise<SubmitResult | undefined> => {
      if (!markerStore) return { ok: false, message: t.store.unavailable };
      return exclusive(async () => {
        try {
          await markerStore.softDelete(marker.id);
          return { ok: true, message: t.store.deleted };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
      });
    },
    [markerStore, exclusive, t],
  );

  return { submit, remove, loading };
}
