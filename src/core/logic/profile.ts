/**
 * プロフィールの入力の決まり（ADR 0019）。値は rules/40-users.rules の validNickname・consentVersion と同じにすること。
 */

/** 同意の文面の版。文面を変えたら上げ、ルールの consentVersion も合わせる */
export const CONSENT_VERSION = 1;

/** 同意の項目。すべてに印が付くまで登録できない（要件 2.5.3）。文言は i18n の profile.consents に持つ */
export const CONSENT_KEYS = ['rights', 'onSite', 'data'] as const;
export type ConsentKey = (typeof CONSENT_KEYS)[number];

export const NICKNAME_MAX = 20;

/**
 * 保存する形にする。NFKC で全角英数・半角カナなどをそろえ（見た目の近い別名を減らす）、改行を空白にし、前後の空白を落とす。
 */
export function normalizeNickname(input: string): string {
  return input.normalize('NFKC').replace(/[\r\n]+/g, ' ').trim();
}

/**
 * 保存できるニックネームか（normalizeNickname のあとの値で判定する）。
 * 文字数は UTF-16 の長さで数える（絵文字は 2。ルールの size() と同じか厳しい側）。
 * 索引の文書 ID に使えない形（/ を含む・. と ..・__ で囲む）は使えない（ルールの validNickname と同じ）。
 */
export function isValidNickname(nickname: string): boolean {
  return (
    nickname.length >= 1 &&
    nickname.length <= NICKNAME_MAX &&
    nickname === normalizeNickname(nickname) &&
    !/loca.*運営/i.test(nickname) && // 運営の名前は名乗らせない（ルールと同じ。ADR 0036）
    !nickname.includes('/') &&
    nickname !== '.' &&
    nickname !== '..' &&
    !/^__.*__$/.test(nickname)
  );
}

/** 重複を判定するキー（nicknames/{キー}）。大文字小文字だけの違いは同じ名前とみなす（ルールの nicknameKey と同じ）。 */
export function nicknameKey(nickname: string): string {
  return nickname.toLowerCase();
}
