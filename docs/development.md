# 開発ガイド

[← README](../README.md)

## 構成とビルド

- `src/reviewer.html`: 画面構造。
- `src/reviewer.css`: スタイル。
- `src/reviewer.js`: アプリの動作。数式描画にKaTeXを埋め込み、それ以外はブラウザ標準APIで動作します。
- `scripts/build.mjs`: CSS・JavaScriptとKaTeXをインライン化し、アイコンとWeb App ManifestをデータURLとして埋め込み、`dist/reviewer.html` を生成します。
- `tests/`: 同期処理の単体テストとブラウザの回帰テスト。
- `reviewer-icon.svg` / `reviewer.webmanifest`: ビルド時に埋め込むアセット。
- `.github/workflows/publish.yml`: テスト・ビルドと既存公開先への自動コピー。

Node.js 24を使用します。`npm ci` でビルド用の依存パッケージを復元します。

```bash
npm ci
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
node tests/fullscreen.browser.cjs
node tests/popovers.browser.cjs
node tests/input-feedback.browser.cjs
node tests/dashboard.browser.cjs
node tests/home-card-navigation.browser.cjs
node tests/images.browser.cjs
node tests/image-sync.browser.cjs
node tests/storage.browser.cjs
```

途中再開・二重採点の防止、PC／タブレット／スマートフォン幅でのレイアウト、検索、教材切り替え、並び替え、折りたたみ、開閉ボタンの移動、サイドバーのアニメーションを確認します。動きを減らす設定と通常のアニメーションをそれぞれテストします。

## 保存データとの互換性

kntt32/kntt-pages-dev の `tools/reviewer.html` から独立したアプリです。教材・履歴・学習セッションはIndexedDBの `kntt.reviewer` データベースに保存します。旧localStorageキー `kntt.reviewer.v2` は、IndexedDBにデータがない場合に移行し、保存成功後にだけ削除します。ID・履歴・セッションは維持します。画像Blobは別の `images` ストアでSHA-256により重複排除し、通常の学習では画像本体を書き直しません。

並び順は `kntt.reviewer.set-sort`、サイドバーの表示設定は `kntt.reviewer.sidebar.v1` に保存します。端末間の自動同期は実装していません。

単語カードはセットごとに範囲・残りカードの順序・表示位置・答えの表示状態を保存します。クイズは範囲・現在の問題・選択肢の順序・回答後の解説・残り問題・誤答の再出題・初回正解数・完了結果を保存します。「最初から」、範囲変更、または「クイズ開始」で新しく開始できます。学習履歴の初期化では途中の進捗も初期化します。

バックアップファイルには保存状態が含まれますが、インポートでは教材と選択した学習履歴を新しいローカルIDに割り当てます。途中のセッション・ウェブ配信元の登録は復元しません。

## ウェブ教材の形式と同期

推奨形式は `{ "sets": [{ "title": "...", "description": "...", "items": [...] }] }` です。`{ "items": [...] }` とカード配列も利用できます。カードの必須情報はterm、meaning、options（空でない文字列4個）、answer（0〜3）。question、explanation、example、translationも利用できます。旧教材のtypeは互換性のため受け付けますが、カードの種類による画面上の区別や種類選択はありません。

履歴の識別にはセット・カードの `id` を優先し、省略時はセットのtitle・カードのtermを使います。同一配信元内のセット、同一セット内のカードではそれぞれ一意にしてください。title/termを変更しつつ履歴を引き継ぐ配信元は、最初から固定idを付けてください。

起動時と手動操作で同期します。レスポンス全体を検証してから教材を置き換え、エラー時は以前の正常なキャッシュを維持します。ローカル教材を上書きしません。同期中の学習画面には開始時点の内容が残り、次回開くと更新した内容を表示します。配信元の登録解除はその配信元の教材と学習履歴を削除します。

取得先はCORSを許可する必要があります。HTTPS版からはHTTPSのURLを指定してください。取得時に認証情報は送信しません。

## UI

PC・タブレット幅では左300pxの領域に、画面端から10px離した角丸サイドバーを配置し、右に教材・学習画面を表示します。サイドバーに影を付けず、モバイルで重ねて開く際も背面を暗くしません。検索欄は上部の虫眼鏡ボタンから展開します。760px以下では幅最大300pxのサイドバーを重ねて表示し、教材選択時に閉じます。

開閉ボタンは同じDOM要素をサイドバー／右ペインのヘッダー間で移動します。開閉は240msの幅変化またはスライドとフェードで表現し、`prefers-reduced-motion` を尊重します。隠れたサイドバーとモバイル表示時の背面には `inert` を設定します。

`touch-action: manipulation` でダブルタップ拡大を抑制し、ピンチ拡大を維持します。タッチ端末の入力欄は16pxにして、フォーカスによる拡大も抑えます。ホバーやポインターのフォーカスによるボタンの塗りつぶし・色変化は使わず、タップ前後の選択済みに見える表示を防ぎます。タップハイライトも無効化します。実際のキーボード入力後にだけフォーカス枠を表示します。現在のセットは文字の太さ、並び順はチェックマークで示します。

`tests/input-feedback.browser.cjs` ではマウス・タッチ・混在環境で、主要操作、検索、並び順、セットメニュー、編集・削除、サイドバー、学習操作についてタップ前後の見え方とキーボードフォーカスを確認します。

### ダイアログとカード操作

確認操作は `askConfirmation()` を通してHTMLの `<dialog>` で行います。ネイティブのalert・confirm・promptは使用しません。既存のフォームも `prepareDialogs()` で固定ヘッダー、スクロールする本文、固定フッターに揃えます。Visual Viewportの変化に応じてダイアログの高さ・中央位置を調整します。

並び順は各セクションの矢印アイコンから、小さなポップオーバーを開いて選びます。選択値は従来の保存形式を維持します。カード一覧の右側には解説・編集・削除のアイコンを配置し、解説は専用ダイアログで表示します。ウェブ教材のカードには編集・削除を表示しません。

`tests/dialogs.browser.cjs` ではPC・スマートフォン・高さ360pxの画面で、フッターの表示、長文のスクロール、キャンセル、履歴の取り込み、入力エラー、ネイティブダイアログが発生しないことを検証します。

### 小さなポップオーバーメニュー

並び順とセット単位の操作には、ブラウザ標準のPopover APIを使います。ボタンの近くに固定配置し、画面端では位置と高さを調整して、メニューがボタンを覆わないようにします。必要な場合はメニュー内部だけスクロールします。外側のクリック、Esc、同じボタンの再クリックで閉じます。上下矢印・Home・Endで項目を移動できます。フォームと削除確認には引き続きモーダルダイアログを使います。

`tests/popovers.browser.cjs` でPC・スマートフォン・高さ360pxの画面における配置、開閉、キーボード操作、名前変更ダイアログへの遷移を検証します。

### セット単位のメニュー

サイドバーの各セット行は、セットを開くボタンと独立した「…」ボタンで構成します。ボタンを入れ子にせず、メニュー操作では学習中のセットを切り替えません。メニューには名前変更、セット単位の教材JSONエクスポート、削除を用意します。

ローカル教材の名前変更はIDを維持するため履歴や途中の進捗を失いません。ウェブ教材では配信元に `titleOverrides`（remoteKeyと表示名の対応）と `dismissedKeys`（非表示のremoteKey配列）を保存し、同期時に適用します。配信元JSONやカード内容は変更しません。配信元を登録し直すとこれらの端末内設定は初期化されます。

削除では対象セットの履歴・途中セッションも削除し、選択中のセットを削除した場合にだけ未選択画面へ戻します。他のセットには影響しません。セット単位のエクスポートは `sets` に対象1件を含む従来の教材JSON形式で、内部IDや履歴を除きます。

`tests/set-menu.browser.cjs` で対象だけのエクスポート、別セットの表示を維持した名前変更・削除、キャンセル、履歴の保持、ウェブ教材の同期後の表示名・削除状態を確認します。

### 学習の全画面表示

クイズ・単語カードでは `study-mode` を適用し、サイドバーとヘッダーを隠してブラウザ内の表示領域全体を使います。ブラウザのFullscreen APIや追加の権限には依存しません。学習操作と「セットに戻る」は画面内に残し、Escキーでも通常表示へ戻れます。サイドバーの保存設定を変更せず、隠れた操作には `inert` を適用します。保存した学習画面を再読み込みした場合も同じ表示に復元します。

`tests/fullscreen.browser.cjs` でPC・スマートフォン・高さ360pxの画面における全画面表示、操作ボタンの表示、途中再開、サイドバー設定の復元を検証します。

### ホームの学習ダッシュボード

保存済みの `state.progress` を集計し、回答・評価の累計、クイズ回答回数、カード評価回数、一度でも学習したカード枚数を表示します。`grade()` は既存の `attempts` に加え、クイズでは `quizAttempts`、カードでは `cardAttempts` を増やします。以前の内訳がない履歴も合計に含めます。保存キーや既存IDは変えません。集計は保存されている履歴に基づくため、履歴の削除・初期化に合わせて変化します。

`dashboardData()` は途中の学習、苦手、復習期限、未学習の順にセットを並べ、上位3件を提案します。空のセットは除外します。苦手なカードは従来の苦手判定に合わせ、つまずき回数・正答率で並べて最大6枚を表示します。苦手カードの行全体を押すと、検索・絞り込みを解除して対象セットを開き、描画後に対象カードまでスクロールします。途中の学習は初期化しません。

ダッシュボードは作成・取り込み・同期・評価・履歴初期化などに合わせて更新します。`tests/dashboard.test.mjs` と `tests/dashboard.browser.cjs` で旧履歴との互換性、推薦順位、集計、再開・該当カードへの移動、初期化を検証します。GitHubへのリンクはダッシュボード下部に表示します。

## kntt-pages-devへの自動コピー

`main` へのpushでテスト・単一HTMLのビルドを行い、`kntt32/kntt-pages-dev` の `tools/reviewer.html` のみ更新してcodex名義でpushします。GitHub ActionsのArtifactsからもHTMLを取得できます。

初回設定:

1. Fine-grained personal access tokenの対象に **kntt32/kntt-pages-dev** を選択する。
2. Repository permissionsで **Contents: Read and write** を付与する。
3. PATを **kntt32/reviewer → Settings → Secrets and variables → Actions** に `PAGES_DEPLOY_KEY` として登録する。Secret名は既存のままですが、値はSSH秘密鍵ではなくPATです。
4. Actionsの **Deploy → Run workflow** から動作を確認する。

宛先checkoutは `ref: main` と `token: ${{ secrets.PAGES_DEPLOY_KEY }}` を指定し、HTTPSで取得・更新します。Reviewer自身のcheckoutには通常の `GITHUB_TOKEN` を使います。PATは有効期限に合わせて更新してください。宛先ブランチの保護規則が直接pushを禁止する場合は、PR経由の運用へ調整してください。

## 画像

カードの任意フィールド `image` と `answerImage` は、それぞれ表面と裏面の画像を表すBase64データURLです。PNG・JPEG・WebP・GIF・AVIFを受け付け、SVGや外部画像URLは受け付けません。取り込むデータURLは1画像560万文字以内です。

編集画面からの追加は元画像20MiB以内。Canvasで長辺1600px以内、256KiB以内のWebP（非対応時はJPEG）に縮小・圧縮します。GIFの追加は静止画になります。画像はカード一覧、単語カード、クイズ、解説に表示されます。

保存時は画像をBlobとして分離し、メタデータと同じトランザクションで保存します。参照されなくなった画像は削除します。JSON書き出し時はBase64へ戻るため、画像IDの管理やZIPは不要です。保存失敗時はエラー・再試行・バックアップを表示し、移行失敗時に旧データを削除しません。

## 数式

KaTeXとauto-renderをビルド時に単一HTMLへ埋め込み、MathML出力をブラウザで描画します。CSSフォントや外部CDNは使用しません。問題・選択肢・正解例・解説・単語カード・ホームのカードに対応し、入力欄と保存JSONは元のTeX文字列を維持します。`$...$`、`$$...$$`、`\(...\)`、`\[...\]` に対応します。JSON内のバックスラッシュは二重にエスケープしてください。

信頼されないTeXに対して `trust: false` と展開・サイズ制限を設定します。ライセンスは `THIRD_PARTY_NOTICES.md` と生成HTMLに同梱します。`tests/math.browser.cjs` で各画面の表示、外部取得なしの動作、HTMLが実行されないことを確認します。
