# Reviewer

学習セット、単語カード、4択クイズを使う日本語の復習ツール。kntt32/kntt-pages-dev の tools/reviewer.html から独立しました。既存UIと localStorage キーを維持し、同じ公開URLで既存の教材・履歴を引き継ぎます。

## 開発・ビルド

Node.js 24 で `npm test`、`npm run build`。依存パッケージ不要。`src/reviewer.html` がソース、`dist/reviewer.html` がアイコンとmanifestを含む単一HTML成果物です。ビルド成果物はコミットしません。

## ネット教材

ホームの「ネット → URLを登録」でセクション名と公開JSON URLを指定します。登録時・起動時・「同期」で更新。各URLが独立したセクションになり、複数セットを表示します。失敗時には前回の正常な教材と学習履歴を維持します。ネット教材は読み取り専用で、「ローカルへコピー」すると編集できます。登録解除はその配信元の教材・履歴を削除します。

形式は従来の `{ "sets": [{ "title": "...", "description": "...", "items": [...] }] }` に対応。`{ "items": [...] }` とカード配列も利用できます。カードの必須情報は term、meaning、options（空でない文字列4個）、answer（0〜3）。従来のtype、question、explanation、example、translationも利用できます。

配信元がCORSを許可している必要があります。GitHub raw URLなどが利用できます。HTTPSで公開しているアプリからはHTTPS URLを指定してください。認証情報は送信しません。

履歴の識別にはセット・カードの `id` を優先し、省略時はセットのtitle・カードのtermを使います。同一配信元内のセット、同一セット内のカードではそれぞれ一意にしてください。title/termを変更しつつ履歴を引き継ぐ配信元は、最初から固定idを付けてください。更新中の学習画面には開始時点の教材が表示され、次回開いたときに新しい教材になります。

エクスポートとバックアップにはキャッシュ済み教材も含まれます。バックアップのインポートは従来と同じくローカル教材として復元します。URLの登録は改めて行ってください。

## kntt-pages-dev への自動コピー

mainへのpushでテスト・単一HTMLのビルドを行い、`kntt32/kntt-pages-dev` の `tools/reviewer.html` のみ更新してcodex名義でpushします。GitHub ActionsのArtifactsからもHTMLを取得できます。

初回のみ次を設定してください（このセッションのGitHub権限ではSecretsを設定できませんでした）。

1. 専用SSH鍵ペアを生成する。
2. 公開鍵を **kntt32/kntt-pages-dev → Settings → Deploy keys** に登録し、Allow write accessを有効にする。
3. 秘密鍵を **kntt32/reviewer → Settings → Secrets and variables → Actions** に `PAGES_DEPLOY_KEY` として登録する。
4. ReviewerのActionsで **Build and copy Reviewer → Run workflow** を実行する。

秘密鍵をファイルやチャットに公開しないでください。宛先ブランチの保護規則が直接pushを禁止する場合は、専用鍵に許可するかPR経由の運用へ調整してください。
