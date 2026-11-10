# Reviewer

学習セット、単語カード、4択クイズを使う日本語の復習ツール。kntt32/kntt-pages-dev の tools/reviewer.html から独立しました。既存UIと localStorage キーを維持し、同じ公開URLで既存の教材・履歴を引き継ぎます。

## 開発・ビルド

Node.js 24 で `npm test`、`npm run build`。依存パッケージ不要。`src/reviewer.html` がソース、`dist/reviewer.html` がアイコンとmanifestを含む単一HTML成果物です。ビルド成果物はコミットしません。

## ネット教材

サイドバーの「ウェブ → URLを登録」でセクション名と公開JSON URLを指定します。登録時・起動時・「同期」で更新。各URLが独立したセクションになり、複数セットを表示します。失敗時には前回の正常な教材と学習履歴を維持します。ネット教材は読み取り専用で、「ローカルへコピー」すると編集できます。登録解除はその配信元の教材・履歴を削除します。

形式は従来の `{ "sets": [{ "title": "...", "description": "...", "items": [...] }] }` に対応。`{ "items": [...] }` とカード配列も利用できます。カードの必須情報は term、meaning、options（空でない文字列4個）、answer（0〜3）。従来のtype、question、explanation、example、translationも利用できます。

配信元がCORSを許可している必要があります。GitHub raw URLなどが利用できます。HTTPSで公開しているアプリからはHTTPS URLを指定してください。認証情報は送信しません。

履歴の識別にはセット・カードの `id` を優先し、省略時はセットのtitle・カードのtermを使います。同一配信元内のセット、同一セット内のカードではそれぞれ一意にしてください。title/termを変更しつつ履歴を引き継ぐ配信元は、最初から固定idを付けてください。更新中の学習画面には開始時点の教材が表示され、次回開いたときに新しい教材になります。

エクスポートとバックアップにはキャッシュ済み教材も含まれます。バックアップのインポートは従来と同じくローカル教材として復元します。URLの登録は改めて行ってください。

## kntt-pages-dev への自動コピー

mainへのpushでテスト・単一HTMLのビルドを行い、`kntt32/kntt-pages-dev` の `tools/reviewer.html` のみ更新してcodex名義でpushします。GitHub ActionsのArtifactsからもHTMLを取得できます。

初回のみ次を設定してください。

1. Fine-grained personal access token を作成し、対象リポジトリに **kntt32/kntt-pages-dev** を選択する。
2. Repository permissions の **Contents: Read and write** を付与する（Metadataの読み取りは自動で含まれます）。
3. PAT を **kntt32/reviewer → Settings → Secrets and variables → Actions** に `PAGES_DEPLOY_KEY` として登録する。既存のSecret名を維持していますが、値はSSH秘密鍵ではなくPATです。
4. ReviewerのActionsで **Build and copy Reviewer → Run workflow** を実行する。以後はmainへのpushで自動実行される。

checkoutには `token: ${{ secrets.PAGES_DEPLOY_KEY }}` を指定し、HTTPSで宛先のmainを取得・更新します。Reviewer自身のcheckoutには通常のGITHUB_TOKENを使います。

トークンをファイルやチャットに公開しないでください。PATの有効期限切れには更新が必要です。宛先ブランチの保護規則が直接pushを禁止する場合は、PR経由の運用へ調整してください。

## 学習の中断・再開

単語カードはセットごとに範囲・残りカードの順序・表示位置・答えの表示状態を保存します。クイズは範囲・現在の問題・選択肢の順序・回答後の解説・残り問題・誤答の再出題・初回正解数・完了結果を保存します。画面を離れてから戻った場合や再読み込み後も続きから再開します。「最初から」、範囲変更、または「クイズ開始」で新しく開始できます。学習履歴の初期化では途中の進捗も初期化します。

ブラウザ回帰テストはビルド後に `node tests/resume.browser.cjs` で実行できます（PlaywrightとChromiumが必要。`CHROMIUM_PATH`で実行ファイルを指定可能）。

## 画面構成

PC・iPad幅では左に幅280pxの縦長サイドバー、右に教材の詳細・単語カード・クイズを表示します。左上の操作は作成、インポート、エクスポートの順で縦に配置し、その下に検索、ローカル、ウェブを表示します。ローカル・ウェブ・配信元は折りたたみ可能です。ローカルとウェブには別々の並び順（名前、作成日時、最終学習日時、最終変更日時）を設定できます。並び順と折りたたみ状態はブラウザに保存されます。

サイドバーはヘッダーのボタンで非表示・再表示できます。760px以下では重ねて開く方式に切り替え、教材選択時に閉じて右画面を全面表示します。タッチ操作部分の `touch-action: manipulation` でダブルタップ拡大を抑え、ピンチ拡大は維持します。

サイドバーのブラウザテスト: `node tests/sidebar.browser.cjs`（PlaywrightとChromiumが必要）。デスクトップ・タブレット・スマートフォン幅でレイアウト、開閉・並び順の保存、教材切り替え、画面内に収まるクイズ操作を確認します。
