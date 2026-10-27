# 面接官向け発行コード管理 Webアプリ

学習者向け公開 GAS（Anyone の bridge）とは**別の Apps Script プロジェクト**にデプロイします。

## 役割の分離

| 画面 | URL | 公開範囲 | できること |
| --- | --- | --- | --- |
| OWL JS Studio | GitHub Pages | 公開 | STEP学習・完成クイズの発行申請 |
| 学習者向け GAS bridge | 既存の `/exec` | Anyone | ping と `issueWorkFromBridge` のみ |
| 面接官向け発行コード管理 | **このプロジェクトの** `/exec` | 面接官のみが知るURL。`Anyone` でも管理者パスワード必須 | 氏名・メールから発行コードを1件作る |

公開 learner プロジェクトにこの HTML を足さないでください。`google.script.run` は同じプロジェクトのトップレベル関数を呼べるため、管理者用関数を公開 bridge に置かないことが分離の要点です。

## 管理者プロジェクトへコピーするファイル

1. `gas/IssuanceBackend.js`
2. `gas/admin/AdminIssuanceApp.js`
3. `gas/admin/print-assets.js`（特典カードのQR）
4. `gas/embedded-brand-assets.js`（正式ロゴの埋め込み）

Apps Script ではいずれも `.gs` として保存して構いません。

## Script Properties（管理者プロジェクト）

学習者プロジェクトと**同じスプレッドシート・同じハッシュ用ペッパー**を使います。パスワードは Cursor が決めません。運営者が設定してください。

| プロパティ | 必須 | 内容 |
| --- | --- | --- |
| `ADMIN_WEB_APP` | 必須 | `true` |
| `PUBLIC_LEARNER_DEPLOYMENT` | 必須 | 未設定、または `false` |
| `SPREADSHEET_ID` | 必須 | 学習者側と同じスプレッドシート ID |
| `CODE_HASH_PEPPER` | 必須 | 学習者側と**完全に同じ**値。違うと発行コードが使えません |
| `ADMIN_API_TOKEN` | 必須 | 既存の管理者トークン。画面には出しません |
| `INTERVIEWER_ADMIN_PASSWORD` | 必須 | 面接官が画面に入力するパスワード |
| `ADMIN_AUTH_ATTEMPT_LIMIT` | 任意 | 認証失敗の上限。未設定時は 5 |
| `ADMIN_AUTH_ATTEMPT_WINDOW_SECONDS` | 任意 | 上記の時間窓（秒）。未設定時は 600 |
| `DELIVERY_FOLDER_ID` | 任意 | 学習者発行時の Drive フォルダ。この画面ではメール送信しません |

学習者プロジェクト側はこれまでどおり `PUBLIC_LEARNER_DEPLOYMENT=true` のままにしてください。

## デプロイ手順

1. Google Apps Script で**新しいプロジェクト**を作る（学習者用とは別）
2. 上記2ファイルを貼る
3. Script Properties を設定する
4. デプロイ → 新しいデプロイ → 種類: **ウェブアプリ**
5. 実行ユーザー: 自分（スクリプト所有者）
6. アクセスできるユーザー: 面接官の運用に合わせて選択
   - 社内の Google アカウントだけに開くなら「組織内」または「Google アカウントを持つ全員」
   - URL とパスワードを知る面接官だけが使うなら「全員」でも可。パスワードだけに頼って disable/resend などの操作は公開していません
7. デプロイし、ウェブアプリ URL（`/exec`）を面接官へ共有する。GitHub Pages には載せない
8. 学習者用 Web アプリは再デプロイ不要（公開関数の追加なし）。`IssuanceBackend.js` の `doGet` 分岐は `ADMIN_WEB_APP` が無い学習者側では従来どおり bridge を返します

## 面接官の操作

1. 管理者用ウェブアプリ URL をブラウザで開く
2. 応募者氏名・メールアドレス・管理者パスワードを入力する
3. 「発行コードを生成する」を押す
4. 表示された発行コードをコピーするか、「特典カードを印刷」で A6 カードを渡す
5. 応募者は OWL JS Studio で STEP 1〜5 をクリアし、CLEAR から発行コードを入力する
6. 登録メールアドレスへ完成 HTML が添付されて届く（学習者側の発行処理）

成功時、この画面はコード平文をスプレッドシートへ保存しません。再表示はできません。
