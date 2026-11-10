# 開発ガイド

[← README](../README.md)

## 構成とビルド

- `src/reviewer.html`: HTML・CSS・JavaScriptのソース。外部ライブラリを使わず、ブラウザ標準APIで動作します。
- `scripts/build.mjs`: アイコンとWeb App ManifestをデータURLとして埋め込み、`dist/reviewer.html` を生成します。
- `tests/`: 同期処理の単体テストとブラウザの回帰テスト。
- `reviewer-icon.svg` / `reviewer.webmanifest`: ビルド時に埋め込むアセット。
- `.github/workflows/publish.yml`: テスト・ビルドと既存公開先への自動コピー。

Node.js 24を使用します。ビルド・単体テストの依存パッケージはありません。

```bash
npm test
npm run build
```

生成したHTMLを静的ホスティングで配信します。ブラウザの安全なコンテキストを使用するAPIがあるため、開発時はlocalhost、本番ではHTTPSを利用してください。`dist/` はコミットしません。

### ブラウザテスト

ビルド後、PlaywrightとChromiumが利用できる環境で実行します。`CHROMIUM_PATH` でChromiumの実行ファイルを指定できます。既定値は `/usr/bin/chromium` です。

```bash
node tests/resume.browser.cjs
node tests/sidebar.browser.cjs
node tests/dialogs.browser.cjs
node tests/set-menu.browser.cjs
```

途中再開・二重採点の防止、PC／タブレット／スマートフォン幅でのレイアウト、検索、教材切り替え、並び替え、折りたたみ、開閉ボタンの移動、サイドバーのアニメーションを確認します。動きを減らす設定と通常のアニメーションをそれぞれテストします。

## 保存データとの互換性

kntt32/kntt-pages-dev の `tools/reviewer.html` から独立したアプリです。教材・履歴・学習セッションの保存先は、既存の `kntt.reviewer.v2` を維持しています。同じオリジンの同じブラウザなら、以前のローカル教材を読み込めます。

並び順は `kntt.reviewer.set-sort`、サイドバーの表示設定は `kntt.reviewer.sidebar.v1` に保存します。端末間の自動同期は実装していません。

単語カードはセットごとに範囲・残りカードの順序・表示位置・答えの表示状態を保存します。クイズは範囲・現在の問題・選択肢の順序・回答後の解説・残り問題・誤答の再出題・初回正解数・完了結果を保存します。「最初から」、範囲変更、または「クイズ開始」で新しく開始できます。学習履歴の初期化では途中の進捗も初期化します。

バックアップファイルには保存状態が含まれますが、インポートでは教材と選択した学習履歴を新しいローカルIDに割り当てます。途中のセッション・ウェブ配信元の登録は復元しません。

## ウェブ教材の形式と同期

推奨形式は `{ "sets": [{ "title": "...", "description": "...", "items": [...] }] }` です。`{ "items": [...] }` とカード配列も利用できます。カードの必須情報はterm、meaning、options（空でない文字列4個）、answer（0〜3）。type、question、explanation、example、translationも利用できます。

履歴の識別にはセット・カードの `id` を優先し、省略時はセットのtitle・カードのtermを使います。同一配信元内のセット、同一セット内のカードではそれぞれ一意にしてください。title/termを変更しつつ履歴を引き継ぐ配信元は、最初から固定idを付けてください。

起動時と手動操作で同期します。レスポンス全体を検証してから教材を置き換え、エラー時は以前の正常なキャッシュを維持します。ローカル教材を上書きしません。同期中の学習画面には開始時点の内容が残り、次回開くと更新した内容を表示します。配信元の登録解除はその配信元の教材と学習履歴を削除します。

取得先はCORSを許可する必要があります。HTTPS版からはHTTPSのURLを指定してください。取得時に認証情報は送信しません。

## UI

PC・タブレット幅では左260pxのサイドバー、右に教材・学習画面を配置します。検索欄は上部の虫眼鏡ボタンから展開します。760px以下では幅最大280pxのサイドバーを重ねて表示し、教材選択時に閉じます。

開閉ボタンは同じDOM要素をサイドバー／右ペインのヘッダー間で移動します。開閉は240msの幅変化またはスライドとフェードで表現し、`prefers-reduced-motion` を尊重します。隠れたサイドバーとモバイル表示時の背面には `inert` を設定します。

`touch-action: manipulation` でダブルタップ拡大を抑制し、ピンチ拡大を維持します。タッチ端末の入力欄は16pxにして、フォーカスによる拡大も抑えます。

### ダイアログとカード操作

確認操作は `askConfirmation()` を通してHTMLの `<dialog>` で行います。ネイティブのalert・confirm・promptは使用しません。既存のフォームも `prepareDialogs()` で固定ヘッダー、スクロールする本文、固定フッターに揃えます。Visual Viewportの変化に応じてダイアログの高さ・中央位置を調整します。

並び順は各セクションの矢印アイコンからHTMLダイアログを開いて選びます。選択値は従来の保存形式を維持します。カード一覧の右側には解説・編集・削除のアイコンを配置し、解説は専用ダイアログで表示します。ウェブ教材のカードには編集・削除を表示しません。

`tests/dialogs.browser.cjs` ではPC・スマートフォン・高さ360pxの画面で、フッターの表示、長文のスクロール、キャンセル、履歴の取り込み、入力エラー、ネイティブダイアログが発生しないことを検証します。

### セット単位のメニュー

サイドバーの各セット行は、セットを開くボタンと独立した「…」ボタンで構成します。ボタンを入れ子にせず、メニュー操作では学習中のセットを切り替えません。メニューには名前変更、セット単位の教材JSONエクスポート、削除を用意します。

ローカル教材の名前変更はIDを維持するため履歴や途中の進捗を失いません。ウェブ教材では配信元に `titleOverrides`（remoteKeyと表示名の対応）と `dismissedKeys`（非表示のremoteKey配列）を保存し、同期時に適用します。配信元JSONやカード内容は変更しません。配信元を登録し直すとこれらの端末内設定は初期化されます。

削除では対象セットの履歴・途中セッションも削除し、選択中のセットを削除した場合にだけ未選択画面へ戻します。他のセットには影響しません。セット単位のエクスポートは `sets` に対象1件を含む従来の教材JSON形式で、内部IDや履歴を除きます。

`tests/set-menu.browser.cjs` で対象だけのエクスポート、別セットの表示を維持した名前変更・削除、キャンセル、履歴の保持、ウェブ教材の同期後の表示名・削除状態を確認します。

## kntt-pages-devへの自動コピー

`main` へのpushでテスト・単一HTMLのビルドを行い、`kntt32/kntt-pages-dev` の `tools/reviewer.html` のみ更新してcodex名義でpushします。GitHub ActionsのArtifactsからもHTMLを取得できます。

初回設定:

1. Fine-grained personal access tokenの対象に **kntt32/kntt-pages-dev** を選択する。
2. Repository permissionsで **Contents: Read and write** を付与する。
3. PATを **kntt32/reviewer → Settings → Secrets and variables → Actions** に `PAGES_DEPLOY_KEY` として登録する。Secret名は既存のままですが、値はSSH秘密鍵ではなくPATです。
4. Actionsの **Deploy → Run workflow** から動作を確認する。

宛先checkoutは `ref: main` と `token: ${{ secrets.PAGES_DEPLOY_KEY }}` を指定し、HTTPSで取得・更新します。Reviewer自身のcheckoutには通常の `GITHUB_TOKEN` を使います。PATは有効期限に合わせて更新してください。宛先ブランチの保護規則が直接pushを禁止する場合は、PR経由の運用へ調整してください。
