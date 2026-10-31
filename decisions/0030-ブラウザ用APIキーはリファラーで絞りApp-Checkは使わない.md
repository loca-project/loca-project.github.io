# 0030. ブラウザ用の API キーは HTTP リファラーで絞り、App Check は使わない

- 状態: 採用
- 日付: 2026-09-26
- 関連: [0010](0010-書き込みと認証にFirebase無料プランを使う.md)、T32

## 背景

Firebase のブラウザ用の API キー（`VITE_FIREBASE_API_KEY`）は公開値で、ページから誰でも取り出せる。
持ち出したキーでログインまわりの API（アカウントの作成など）を別のサイトやスクリプトから叩かれるのを減らしたい。
移植元では App Check（reCAPTCHA）を使っていた。

## 調べたこと（2026-09-26。使い捨てのキーで試してから消した）

| 試したこと | 結果 |
|---|---|
| Firestore の REST を、キーなし・でたらめなキー・リファラー制限付きのキー（Referer なし）で読む | 3 つとも 200。**Firestore はキーを検査しない**（守りはルールだけ） |
| identitytoolkit（ログインの API）を、リファラー制限付きのキーで呼ぶ | 許可したサイトの Referer は 200、Referer なし・別のサイトは 403 `API_KEY_HTTP_REFERRER_BLOCKED` |
| reCAPTCHA（App Check の提供元）の条件 | 無料の範囲（月 1 万回）でも Google Cloud の支払い方法の登録が要る |
| （同上の出典） | [比較表](https://docs.cloud.google.com/recaptcha/docs/compare-tiers)・[移行の案内](https://docs.cloud.google.com/recaptcha/docs/migrate-recaptcha) |

## 決定

1. **ブラウザ用のキー（表示名「Browser key (auto created by Firebase)」）を HTTP リファラーで絞る。** 許可するのは次の 4 つ。

   | リファラー | 使うところ |
   |---|---|
   | `https://loca-project.github.io/*` | 公開サイト |
   | `https://loca-d3792.firebaseapp.com/*` | Google ログインのポップアップ（authDomain） |
   | `http://localhost:5173/*` | `npm run dev` |
   | `http://localhost:4173/*` | `/ui-check` の vite preview |

   使える API（Firebase が自動で入れた 27 種）は変えない。
2. **App Check は使わない。** 提供元の reCAPTCHA が支払い方法の登録を求め、請求先を前提にしない方針（ADR 0010）に反する。
   独自の提供元はトークンを発行するサーバー（Cloud Functions など）が要り、これも使えない。
3. Actions とスクリプトは変えない。キーだけで Firestore を呼ぶもの（同期の `lib/firestore-rest.mjs`、書き込みが拒否されることの確認を含む
   `probe-rules.mjs`）はキーを検査されず、管理用のスクリプト（`accounts.mjs`・`admins.mjs`）はオーナーのトークンで identitytoolkit を
   呼ぶので、どちらも制限の影響を受けない。

## 検討した代替案

- **App Check（reCAPTCHA v3・Enterprise）**: 上の理由で却下。強制すると、キーだけで Firestore を読む Actions の同期も止まる。
- **使える API を Firebase Auth と Firestore だけに絞る**: 効果は小さく（Firestore はキーを見ない）、SDK が裏で使う API を
  外すとログインが壊れるおそれがある。今回は見送り。

## 結果

- 公開サイト・ログインのポップアップ・上の 2 つのポート以外からは、このキーでログインできない。
  `http://127.0.0.1:5173` も拒否される（もともと Firebase の承認済みドメインに無い）。別のポートや独自ドメインを使うときは、先に許可に足す。
- リファラーはブラウザ以外なら偽れるので、これは本人確認ではない。守りは引き続きセキュリティルールが担う。
- 変更・取り消しは API Keys API（`apikeys.googleapis.com`）で、Firebase CLI にログイン中のオーナーのトークンを使って行える（gcloud は不要）。

## 確かめ方

`npm run keys:check`（`scripts/api-key-check.mjs`。読むだけ）が、キーの設定が上の表と一致し、identitytoolkit の `GET /v1/projects` が
上の 4 つの Referer では 200、Referer なし・別のサイト・`127.0.0.1` では 403 になることを確かめる（2026-09-26 に 8 / 8 件 OK）。
許可を変えるときは、スクリプトの `REFERRERS` とこの表を一緒に直す。公開サイトで Google ログインができる（2026-09-26 に利用者が確認）。
