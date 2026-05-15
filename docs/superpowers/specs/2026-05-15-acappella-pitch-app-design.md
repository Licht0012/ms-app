# アカペラ音取りアプリ 設計ドキュメント

- **作成日**: 2026-05-15
- **プロジェクト名（仮）**: ms-app
- **形態**: PWA（Progressive Web App）
- **対象端末**: スマートフォン（iOS Safari / Android Chrome）を主、PC ブラウザでも動作

## 1. 目的

MuseScore で作成されたアカペラ譜面を、スマホ単体で「各パートの音取り練習」ができるようにする。
合唱団員が「URL を開く → 楽譜ファイルを追加 → すぐ音取り開始」できる体験を目指す。

## 2. ターゲットユーザー

- アカペラ合唱団員（パート練習用）
- 音楽の専門知識は問わない（楽譜が読めない人でも音は聞ける）
- スマホで片手操作する前提

## 3. スコープ

### 3.1 MVP に含まれる機能

| 機能 | 説明 |
|---|---|
| ファイルアップロード | `.mxl` / `.musicxml` / `.xml` 形式を受け付ける |
| ライブラリ画面 | 追加した楽譜を端末内に保存・一覧・削除 |
| 楽譜表示 | スマホ画面で楽譜を描画（OpenSheetMusicDisplay） |
| パート選択 | Lead / Top / 2nd / 3rd / 4th / Bass など、楽譜内のパートを選択（パート名は MusicXML 内の `<part-name>` をそのまま使用） |
| 再生モード 3 種 | **強調**（選択パート大・他小）／ **ソロ**（選択パートのみ）／ **マイナスワン**（選択パートのみ無音） |
| カーソル同期 | 再生中、楽譜上のカーソルが現在位置をハイライト |
| 表示モード切替 | 「全パート表示」⇔「選択パートのみ表示」を切替可能 |
| 状態の永続化 | 楽譜・最終再生状態（パート、モード、位置）を IndexedDB に保存 |
| PWA 対応 | ホーム画面追加、オフライン動作 |

### 3.2 MVP に含めない（v2 以降）

- テンポ変更・部分ループ機能（実装余力があれば MVP に含める）
- パートごとのボリューム微調整 UI（再生モードのデフォルト数値で十分とする）
- 人声音色（ピアノ音のみ）
- クラウド同期・楽譜共有
- 移調、メトロノーム、録音

### 3.3 スコープ外（やらない）

- `.mscz` 形式の直接読み込み（技術的制約のため MusicXML に統一）
- サーバーサイド処理（完全クライアントサイドで完結）
- ユーザーアカウント / 認証

## 4. 技術スタック

| カテゴリ | 採用ライブラリ | 用途 |
|---|---|---|
| ビルド | Vite | dev server / 静的ビルド |
| 言語 | TypeScript | 型安全 |
| PWA | vite-plugin-pwa | manifest と Service Worker 自動生成 |
| 楽譜描画 | opensheetmusicdisplay (OSMD) | MusicXML を SVG レンダリング |
| 音声再生 | osmd-audio-player | OSMD と同期した MIDI 再生・パート別ボリューム |
| zip 展開 | jszip | `.mxl` を解凍して MusicXML を取り出す |
| 永続化 | idb | IndexedDB の薄いラッパー |
| テスト | vitest | ユニットテスト |
| Lint / Format | eslint + prettier | コード品質 |
| ホスティング | GitHub Pages | 静的サイトの無料公開（`gh` CLI 経由でデプロイ） |

## 5. アーキテクチャ

### 5.1 全体構成

```
┌─────────────────────────────────────────────────┐
│  ブラウザ（スマホ）                              │
│                                                  │
│  ┌──────────────┐   ┌─────────────────────┐    │
│  │ UI Layer     │   │ Service Worker      │    │
│  │ (Vanilla TS) │   │ (PWA / オフライン)  │    │
│  └──────┬───────┘   └─────────────────────┘    │
│         │                                        │
│  ┌──────▼──────────────────────────────┐        │
│  │  App Controller                      │        │
│  │  画面遷移 / 状態管理                  │        │
│  └──┬───────────┬──────────────┬────────┘        │
│     │           │              │                 │
│  ┌──▼────┐  ┌──▼──────────┐ ┌─▼─────────────┐  │
│  │File   │  │ OSMD        │ │ osmd-audio-   │  │
│  │Loader │  │ (Score      │ │ player        │  │
│  │       │  │  Render)    │ │ (MIDI 再生)   │  │
│  └──┬────┘  └─────────────┘ └───────────────┘  │
│     │                                            │
│  ┌──▼──────────────────────────────────────┐    │
│  │  Library Store (IndexedDB)               │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

### 5.2 設計原則

- **完全クライアントサイド**: サーバー不要。ファイルは端末外に出ない（プライバシー保護）
- **疎結合モジュール**: 各モジュールは独立してテスト可能。インタフェースで通信
- **状態の永続化**: ブラウザを閉じても次回開いた時に最後の状態から再開できる

### 5.3 モジュール構成

| モジュール | 責務 |
|---|---|
| `FileLoader` | アップロードファイルを正規化された MusicXML 文字列に変換。`.mxl` は JSZip で展開、`.musicxml` / `.xml` はテキストとして読む |
| `ScoreParser` | MusicXML から「曲名」「パート一覧」「テンポ」などのメタ情報を抽出（DOMParser ベース） |
| `LibraryStore` | IndexedDB を使った楽譜レコードの CRUD（idb ラッパー利用） |
| `ScoreRenderer` | OSMD のラッパー。楽譜描画、表示モード切替（全パート ⇔ 選択パートのみ）、カーソル制御 |
| `AudioPlayer` | osmd-audio-player のラッパー。再生 / 停止 / シーク、パート別ボリューム、再生モード（強調 / ソロ / マイナスワン）の適用 |
| `AppController` | 画面遷移・グローバル状態管理・各モジュールの統合 |

## 6. データモデル

```typescript
type ScoreRecord = {
  id: string;              // UUID
  title: string;           // 曲名（MusicXML から抽出、無ければファイル名）
  parts: PartInfo[];       // パート一覧
  xmlContent: string;      // 正規化後の MusicXML（文字列）
  fileName: string;        // 元ファイル名
  createdAt: number;       // Unix epoch ms
  updatedAt: number;       // Unix epoch ms
  lastState?: ScorePlayState;
};

type PartInfo = {
  index: number;           // OSMD のパートインデックス
  name: string;            // 例: "Lead", "Top", "2nd", "3rd", "4th", "Bass"（<part-name> をそのまま）
  shortName: string;       // 例: "L", "T", "2"（<part-abbreviation>、無ければ name の先頭文字）
};

type ScorePlayState = {
  selectedPartIndex: number;
  playMode: "emphasize" | "solo" | "minusOne";
  displayMode: "all" | "selectedOnly";
  cursorMeasure: number;   // 何小節目で停止していたか
  tempo: number;           // BPM（テンポ変更未実装時は楽譜の既定値）
};
```

## 7. 再生モードの実装方針

`osmd-audio-player` の `setVolume(partIndex, 0-1)` を使い、選択パートと他パートで異なるボリュームを設定する。

| モード | 選択パート | 他パート |
|---|---|---|
| 強調（emphasize） | 1.0 | 0.3 |
| ソロ（solo） | 1.0 | 0.0 |
| マイナスワン（minusOne） | 0.0 | 1.0 |

数値は実装時に微調整可能なデフォルト。設定画面で将来的にユーザー調整可能にする余地を残す。

## 8. データフロー

### 8.1 ファイル追加〜再生

```
[ユーザーがファイル選択]
        ↓
FileLoader.load(File)
   ├→ .mxl: JSZip で展開し container.xml から rootfile を取得
   └→ .musicxml / .xml: テキストとしてそのまま読み込み
        ↓
[MusicXML 文字列]
        ↓
ScoreParser.parseMeta(xml)
   └→ { title, parts[] }
        ↓
LibraryStore.add({ ...meta, xmlContent })
   └→ IndexedDB に保存
        ↓
AppController.openScore(id)
   ├→ ScoreRenderer.load(xml) → 画面に楽譜表示
   └→ AudioPlayer.load(osmd)  → 再生準備
        ↓
[ユーザーがパート選択＋再生ボタン]
        ↓
AudioPlayer.setVolumes(playMode, selectedPartIndex)
AudioPlayer.play()
   └→ MIDI 再生＋ OSMD カーソル同期
```

### 8.2 アプリ再開時の復元

1. 起動時に `LibraryStore.getLastOpened()` で前回開いていた曲 ID を取得
2. 該当の `ScoreRecord` を取り出し、`lastState` があれば適用
3. 楽譜・再生位置・パート選択・モードを復元（自動再生はしない、UX 上の理由）

## 9. 画面構成

### 9.1 画面①: ライブラリ（ホーム）

- ヘッダー: アプリ名
- ファイル追加ボタン（`.mxl` / `.musicxml` / `.xml` を選択）
- 楽譜一覧: タイトル、パート数、更新日時。タップで画面②へ、長押しで削除メニュー
- 空状態: 「楽譜を追加してください」とガイド表示

### 9.2 画面②: プレイヤー

- ヘッダー: 戻るボタン、曲名、設定アイコン
- 楽譜表示エリア（OSMD レンダリング）
- パート選択: 横並びチップ、タップで選択切替
- 再生モード切替: ラジオボタン（強調 / ソロ / マイナスワン）
- 表示モード切替: ドロップダウン（全パート / 選択パートのみ）
- 再生コントロール: 再生・停止・前小節・次小節・ループ、シークバー、現在時刻

### 9.3 画面③: 設定

- テンポ調整スライダー（実装余力がある場合のみ）
- ライブラリ全削除ボタン（確認ダイアログ付き）
- アプリ情報（バージョン、リンク）

### 9.4 UX の重要原則

- **「アップロード → すぐ音が出る」**: 追加直後に自動で画面②に遷移、デフォルトでは楽譜内の最初のパート（通常は Lead）が選択された状態
- **片手操作前提**: 主要操作は画面下半分に集中
- **iOS Safari の制約**: ユーザー操作なしの自動再生は不可。常に「再生ボタンを押して開始」を必須とする

## 10. プロジェクト構成

```
ms-app/
├── public/
│   ├── icons/                  # PWA アイコン
│   ├── soundfonts/             # ピアノ音色データ
│   └── manifest.webmanifest    # PWA マニフェスト
├── src/
│   ├── main.ts                 # エントリーポイント
│   ├── app/
│   │   ├── AppController.ts
│   │   └── routes.ts           # ハッシュベースの簡易ルーター
│   ├── modules/
│   │   ├── FileLoader.ts
│   │   ├── ScoreParser.ts
│   │   ├── LibraryStore.ts
│   │   ├── ScoreRenderer.ts
│   │   └── AudioPlayer.ts
│   ├── views/
│   │   ├── LibraryView.ts
│   │   ├── PlayerView.ts
│   │   └── SettingsView.ts
│   ├── styles/
│   │   └── main.css
│   └── sw.ts                   # Service Worker（vite-plugin-pwa が生成）
├── tests/                      # vitest テスト
├── docs/superpowers/specs/     # 設計ドキュメント
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 11. PWA 要件

- **manifest.webmanifest**: アプリ名、アイコン（192x192 / 512x512）、テーマカラー、`display: standalone`
- **Service Worker**:
  - アプリシェル（HTML/CSS/JS）をキャッシュ → オフライン起動可
  - サウンドフォントをキャッシュ
- **ホーム画面追加**: iOS Safari / Android Chrome のプロンプトに対応
- **オフライン動作**: 一度開けば、保存済みの楽譜は通信なしで再生可能

## 12. ホスティング・デプロイ

- **GitHub Pages** を使用
- `vite build` の成果物（`dist/`）を `gh-pages` ブランチに push、または GitHub Actions で自動デプロイ
- カスタムドメインは将来追加可能
- 連携: `gh` CLI（実装フェーズで `brew install gh` → `gh auth login`）

## 13. テスト方針

| 種別 | 対象 | ツール |
|---|---|---|
| ユニット | `FileLoader` の正規化（.mxl 解凍含む） | vitest |
| ユニット | `ScoreParser` のメタ抽出 | vitest |
| ユニット | `LibraryStore` の CRUD | vitest + fake-indexeddb |
| 手動 | OSMD / osmd-audio-player の挙動 | 実機 / Chrome DevTools |
| 手動 | PWA インストール、オフライン動作 | 実機（iOS Safari / Android Chrome） |

実音再生やレンダリングの自動テストは難しいため、**ロジック層はユニットテスト、UI / 音声層は手動 QA** の二段構え。

## 14. 主要リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| MusicXML の方言（バージョン差、エクスポーターの癖） | 一部の曲が正しく解析できない | OSMD の対応範囲に任せる。失敗時はエラーメッセージで別バージョン出力を促す |
| osmd-audio-player のメンテ状況 | バグやブラウザ非互換 | 採用前に最新版で動作確認。代替として soundfont-player + 自前シーケンサも検討可 |
| iOS Safari の自動再生制約 | 自動再生不可 | 「再生ボタンを押して開始」を必須にする UX で対応 |
| 大きな楽譜での IndexedDB 容量制限 | 端末によっては保存失敗 | エラー時は「容量不足」を表示。容量上限は端末依存（数十 MB〜数 GB） |
| サウンドフォントのサイズ | 初回ロード重 | ピアノ単音のみの小さい SoundFont を採用、Service Worker でキャッシュ |

## 15. 完了条件（MVP）

以下がすべて満たされた時点で MVP 完成とする：

1. `.mxl` / `.musicxml` / `.xml` ファイルをアップロードしてライブラリに追加できる
2. ライブラリから楽譜を選んでプレイヤー画面に遷移できる
3. 楽譜が画面に正しく描画される
4. パート選択ができ、3 種の再生モード（強調 / ソロ / マイナスワン）が切り替えられる
5. 再生中、楽譜上のカーソルが現在位置をハイライトする
6. 表示モード（全パート ⇔ 選択パートのみ）が切り替えられる
7. ブラウザを閉じても次回開いた時に最後の状態から再開できる
8. PWA としてホーム画面に追加でき、オフラインで起動できる
9. GitHub Pages 上に公開され、URL でアクセス可能
