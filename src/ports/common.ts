/** すべてのポートに共通する約束事。 */

/** 購読の解除関数。 */
export type Unsubscribe = () => void;

/** 実装が自分の素性と生死を名乗るための最小インターフェース。 */
export interface Adapter {
  /** ログや RuntimeHealth に出す識別子（例: 'static', 'maplibre'） */
  readonly name: string;
  /**
   * 使える状態かを確認する。false を返した実装はフォールバック対象になる。
   * ネットワーク到達性など、起動時に 1 回だけ確かめたいことをここに書く。
   */
  probe(): Promise<boolean>;
}

/** 外部サービス側の失敗。フォールバックの判断材料になる。 */
export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

/** 外部サービスが待ち時間の上限までに応答しなかった。「見つからない」と分けて伝えるため（T96・T103） */
export class UpstreamTimeoutError extends UpstreamError {}
