<p align="center">
  <img src="reviewer-icon.svg" width="80" height="80" alt="Reviewer のアイコン">
</p>
<h1 align="center">Reviewer</h1>
<p align="center">思い出して、解いて、続きから。<br>自分の教材で学べる、単語カードと4択クイズの復習ツール。</p>
<p align="center">
  <a href="https://kntt.pages.dev/tools/reviewer">アプリを開く ↗</a> ·
  <a href="#使い方">使い方</a> ·
  <a href="docs/development.md">開発・ビルド</a>
</p>
<p align="center">
  <a href="https://github.com/kntt32/reviewer/actions/workflows/publish.yml"><img src="https://github.com/kntt32/reviewer/actions/workflows/publish.yml/badge.svg" alt="Deploy の実行状態"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kntt32/reviewer" alt="ライセンス: MIT"></a>
  <a href="docs/development.md"><img src="https://img.shields.io/badge/Node.js-24-5FA04E?logo=nodedotjs&amp;logoColor=white" alt="ビルド環境: Node.js 24"></a>
  <a href="src/reviewer.html"><img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&amp;logoColor=black" alt="Vanilla JavaScript"></a>
  <a href="docs/development.md"><img src="https://img.shields.io/badge/build-single_HTML-555555?logo=html5&amp;logoColor=white" alt="単一HTMLビルド"></a>
</p>

![学習の累計、おすすめのセット、苦手なカードをまとめたReviewerのダッシュボード](docs/images/dashboard.png)

## できること

- **学習ダッシュボード** — 学習回数、クイズ回答、カード評価、学習したカード枚数を一覧に。おすすめのセットや苦手なカードから次の復習へ。
- **単語カード** — 表面から答えを思い出し、「覚えていない・難しかった・覚えた」で記録。
- **4択クイズ** — 間違えた問題を再出題。解説を読みながら苦手を復習。
- **続きから再開** — カードの順序や位置、クイズの回答状況を保存。再読み込み後も続きを学習。
- **ローカルとウェブの教材** — 自分で作成したりJSONを読み込んだり、公開URLの教材を同期したり。
- **整理しやすいサイドバー** — 検索、並び替え、セクションの折りたたみ。閉じれば学習画面を広く使える。

クイズ・単語カードはサイドバーとヘッダーを隠し、ブラウザの表示領域全体で学習できます。「セットに戻る」またはEscキーで通常表示へ戻ります。

PC・タブレット・スマートフォンに対応し、端末設定に合わせてライト／ダーク表示を切り替えます。アプリ本体は、外部ライブラリ不要の**単一HTML**です。

<table>
  <tr><th>単語カード</th><th>モバイルのクイズ</th></tr>
  <tr>
    <td width="75%"><img src="docs/images/flashcards.png" alt="答えと解説を表示した単語カード"></td>
    <td width="25%"><img src="docs/images/quiz-mobile.png" alt="スマートフォンで表示した4択クイズ"></td>
  </tr>
</table>

<sub>スクリーンショットはデモ教材を使って撮影しています。</sub>

## 使い方

1. [Reviewer を開く](https://kntt.pages.dev/tools/reviewer)。
2. サイドバーの「作成」で教材を作るか、「インポート」でJSONを読み込む。
3. 学習セットを選んで「単語カード」または「クイズ」を始める。

虫眼鏡ボタンから教材を検索し、ローカル・ウェブの見出し右側にある矢印アイコンから並び順を選べます。サイドバー上部の開閉ボタンを押すと教材一覧を隠し、右側のボタンから再表示できます。モバイルでは教材を選ぶとサイドバーが閉じます。

並び順とセット名右側の「…」は、ボタンの近くに小さなメニューを表示します。外側のクリックやEscで閉じられます。「…」から名前変更・削除・そのセットだけのエクスポートができます。ウェブ教材の名前変更・削除はこの端末内の表示に適用し、配信元のJSONは変更しません。削除したウェブ教材は同期後も非表示になり、配信元を登録し直すと再取得できます。

カード右側の本のアイコンを押すと、解説・例を専用ダイアログで読めます。鉛筆アイコンで編集、ごみ箱アイコンで削除できます。ダイアログは本文だけがスクロールし、保存・キャンセル・閉じるボタンは常に下部に表示されます。

### ホームで学習を振り返る

「Reviewer」を押すと、学習ダッシュボードへ戻ります。学習回数は回答・評価の累計で、同じカードを繰り返した分も数えます。「学習したカード」は、一度でも回答・評価したカードの枚数です。

おすすめには途中の学習、苦手のあるセット、復習時期が来たセット、未学習のセットを優先して表示します。「続きから」で再開でき、苦手なカードは「解説を見る」から振り返れます。以前の履歴も合計に含め、クイズとカードの内訳は記録を追加した分から表示します。

### 公開URLの教材を使う

「ウェブ → URLを登録」で、セクション名とJSONのURLを登録します。登録時・起動時・手動の「同期」で更新し、配信元ごとに教材をまとめます。取得に失敗したときも、保存済みの教材で学習できます。

配信元はブラウザからの取得を許可する **CORS設定**が必要です。GitHubのRaw URLなどが使えます。ウェブ教材を編集したいときは、配信元の操作から「ローカルへコピー」を選んでください。

### JSONの例

```json
{
  "sets": [
    {
      "title": "英語の復習",
      "description": "語句と構文を少しずつ",
      "items": [
        {
          "term": "provided that ...",
          "meaning": "〜という条件で、〜ならば",
          "explanation": "条件を表す接続表現。",
          "example": "You may leave early, provided that your work is finished.",
          "translation": "仕事が終わっているなら、早く帰ってもよい。",
          "question": "provided that の意味は？",
          "options": ["〜という条件で", "〜にもかかわらず", "〜した結果", "〜する代わりに"],
          "answer": 0
        }
      ]
    }
  ]
}
```

`answer` は0始まりの番号です。「インポート」内には、AIに教材JSONを作ってもらうためのプロンプトをコピーする機能もあります。

### 保存とバックアップ

教材・学習履歴・途中の進捗は、利用中のブラウザ内に保存します。アカウント登録は不要です。別の端末やブラウザへの自動同期はありません。

「エクスポート」で教材JSONを書き出し、「バックアップ」で履歴や進捗を含む保存データを書き出せます。ブラウザのデータを削除する前や、教材を移す前にバックアップしてください。バックアップの取り込みはローカル教材として行われ、ウェブURLの登録や途中の学習位置は再設定が必要です。

## 開発

Node.js 24で実行できます。依存パッケージのインストールは不要です。

```bash
npm test
npm run build
```

`src/reviewer.html` を編集し、ビルドで `dist/reviewer.html` を生成します。CSS・JavaScript・アイコン・Web App Manifestを1つのHTMLにまとめます。

詳しい構成、ブラウザテスト、教材形式、自動配信の設定は[開発ガイド](docs/development.md)を参照してください。

## ライセンス

[![License: MIT](https://img.shields.io/github/license/kntt32/reviewer)](LICENSE)
