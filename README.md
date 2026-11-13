<p align="center">
  <img src="reviewer-icon.svg" width="80" height="80" alt="Reviewer のアイコン">
</p>
<h1 align="center">Reviewer</h1>
<p align="center">思い出して、解いて、続きから。<br>自分の教材で学べる、単語カードと選択式・自由回答クイズの復習ツール。</p>
<p align="center">
  <a href="https://kntt.pages.dev/tools/reviewer">アプリを開く ↗</a> ·
  <a href="#はじめる">はじめる</a> ·
  <a href="docs/development.md">開発・ビルド</a>
</p>
<p align="center">
  <a href="https://github.com/kntt32/reviewer/actions/workflows/publish.yml"><img src="https://github.com/kntt32/reviewer/actions/workflows/publish.yml/badge.svg" alt="Deploy の実行状態"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kntt32/reviewer" alt="ライセンス: MIT"></a>
  <a href="docs/development.md"><img src="https://img.shields.io/badge/Node.js-24-5FA04E?logo=nodedotjs&amp;logoColor=white" alt="ビルド環境: Node.js 24"></a>
  <a href="src/reviewer.js"><img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&amp;logoColor=black" alt="Vanilla JavaScript"></a>
  <a href="docs/development.md"><img src="https://img.shields.io/badge/build-single_HTML-555555?logo=html5&amp;logoColor=white" alt="単一HTMLビルド"></a>
</p>

![Reviewerの学習ダッシュボード](docs/images/dashboard.png)

## できること

- **単語カードとクイズ** — 選択式・自由回答で復習。
- **画像・数式** — 図や数式を含む教材にも対応。
- **学習ダッシュボード** — 記録を振り返り、おすすめや苦手なカードから学習。
- **続きから再開** — カードの位置やクイズの回答状況を保存。
- **教材の作成・共有** — JSONの取り込み・書き出し。

PC・タブレット・スマートフォンに対応。ライト／ダーク表示を切り替えられます。

<table>
  <tr><th>単語カード</th><th>モバイルのクイズ</th></tr>
  <tr>
    <td width="75%"><img src="docs/images/flashcards.png" alt="単語カードの学習画面"></td>
    <td width="25%"><img src="docs/images/quiz-mobile.png" alt="スマートフォンのクイズ画面"></td>
  </tr>
</table>

## はじめる

1. [アプリを開く](https://kntt.pages.dev/tools/reviewer)。
2. 教材を作成するか、JSONをインポートする。
3. セットを選んで学習する。
