# ms-app

アカペラ譜面（MusicXML）をスマホでアップロードして、パートごとの音取り練習ができる PWA。

## 機能

- `.mxl` / `.musicxml` / `.xml` 形式のアップロード
- パート選択と 3 種類の再生モード（強調 / ソロ / マイナスワン）
- 楽譜表示と再生位置のカーソル同期
- 全パート表示 ⇔ 選択パートのみ表示の切替
- 端末内に楽譜を保存（IndexedDB、サーバー送信なし）
- PWA としてホーム画面に追加可能、オフライン動作

## 使い方

1. MuseScore で楽譜を開き、「ファイル → エクスポート → MusicXML」で `.mxl` または `.musicxml` を書き出す
2. このアプリを開き、「＋ 楽譜を追加」からファイルを選択
3. 楽譜が表示されたら、練習したいパートを選び、再生モードを選んで再生

## 開発

```bash
npm install
npm run dev      # 開発サーバー
npm test         # テスト
npm run build    # 本番ビルド
npm run preview  # ビルド版の確認
```

## デプロイ

`main` ブランチに push すると GitHub Actions が自動で GitHub Pages にデプロイします。

## 設計ドキュメント

- 仕様: `docs/superpowers/specs/2026-05-15-acappella-pitch-app-design.md`
- 実装プラン: `docs/superpowers/plans/2026-05-15-acappella-pitch-app.md`

## ライセンス

未定（個人プロジェクト）
