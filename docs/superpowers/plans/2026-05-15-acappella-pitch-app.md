# アカペラ音取り PWA 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホで MusicXML (`.mxl` / `.musicxml` / `.xml`) をアップロードし、アカペラの各パートを音取り練習できる PWA を構築して GitHub Pages に公開する。

**Architecture:** Vite + TypeScript + Vanilla DOM の完全クライアントサイド PWA。楽譜描画は OpenSheetMusicDisplay (OSMD)、音声再生は osmd-audio-player、楽譜は IndexedDB に永続化。3 画面（ライブラリ / プレイヤー / 設定）構成。

**Tech Stack:** Vite, TypeScript, opensheetmusicdisplay, osmd-audio-player, jszip, idb, vite-plugin-pwa, vitest, fake-indexeddb

**Spec:** `docs/superpowers/specs/2026-05-15-acappella-pitch-app-design.md`

---

## ファイル構成

実装で作成 / 変更するファイルは以下：

```
ms-app/
├── public/
│   ├── icons/
│   │   ├── icon-192.png            # PWA アイコン
│   │   └── icon-512.png
│   └── (manifest.webmanifest)      # vite-plugin-pwa が生成
├── src/
│   ├── main.ts                     # エントリ：AppController 起動
│   ├── types.ts                    # 共有型定義
│   ├── app/
│   │   ├── AppController.ts        # 画面遷移＋グローバル状態
│   │   └── router.ts               # ハッシュベースルーター
│   ├── modules/
│   │   ├── FileLoader.ts           # アップロードファイル → MusicXML 文字列
│   │   ├── ScoreParser.ts          # MusicXML → メタ情報
│   │   ├── LibraryStore.ts         # IndexedDB CRUD
│   │   ├── ScoreRenderer.ts        # OSMD ラッパー
│   │   └── AudioPlayer.ts          # osmd-audio-player ラッパー
│   ├── views/
│   │   ├── LibraryView.ts
│   │   ├── PlayerView.ts
│   │   └── SettingsView.ts
│   └── styles/
│       └── main.css
├── tests/
│   ├── FileLoader.test.ts
│   ├── ScoreParser.test.ts
│   ├── LibraryStore.test.ts
│   └── fixtures/
│       ├── sample.musicxml         # テスト用 MusicXML
│       └── sample.mxl              # テスト用圧縮版
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Pages デプロイ
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
└── README.md
```

---

## Phase 1: プロジェクト基盤

### Task 1: Vite + TypeScript プロジェクトを初期化

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `.gitignore`

- [ ] **Step 1: プロジェクトを scaffold**

Run:
```bash
cd /Users/yucky0629/Claude/ms-app
npm create vite@latest . -- --template vanilla-ts
```
プロンプトが出たら "Ignore files and continue" を選ぶ（既存ディレクトリ）。

- [ ] **Step 2: 依存をインストール**

Run: `npm install`

- [ ] **Step 3: 不要なボイラープレートを削除**

削除：`src/counter.ts`, `src/style.css`, `public/vite.svg`, `src/typescript.svg`（存在する場合）

- [ ] **Step 4: `src/main.ts` を最小化**

`src/main.ts`:
```typescript
import "./styles/main.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.textContent = "ms-app: starting...";
}
```

- [ ] **Step 5: `index.html` を最小化**

`index.html`:
```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <title>ms-app - アカペラ音取り</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: 空の CSS を作成**

`src/styles/main.css`:
```css
:root {
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  -webkit-tap-highlight-color: transparent;
}
* { box-sizing: border-box; }
body { margin: 0; }
```

- [ ] **Step 7: dev server で動作確認**

Run: `npm run dev`
Expected: ブラウザで http://localhost:5173 を開くと "ms-app: starting..." が表示される。Ctrl+C で停止。

- [ ] **Step 8: git 初期化と初回コミット**

```bash
git init
git add -A
git commit -m "chore: initial Vite + TypeScript scaffold"
```

---

### Task 2: テスト・Lint・フォーマッタを導入

**Files:**
- Create: `vitest.config.ts`, `.eslintrc.cjs`, `.prettierrc`
- Modify: `package.json` (scripts 追加)

- [ ] **Step 1: 開発依存をインストール**

Run:
```bash
npm install -D vitest @vitest/ui happy-dom fake-indexeddb eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier eslint-config-prettier
```

- [ ] **Step 2: `vitest.config.ts` を作成**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
```

- [ ] **Step 3: `tests/setup.ts` を作成**

```typescript
import "fake-indexeddb/auto";
```

- [ ] **Step 4: `.eslintrc.cjs` を作成**

```javascript
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  ignorePatterns: ["dist/", "node_modules/"],
};
```

- [ ] **Step 5: `.prettierrc` を作成**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 6: `package.json` の scripts を追加**

Modify `package.json` の `"scripts"` セクション：
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint 'src/**/*.ts' 'tests/**/*.ts'",
    "format": "prettier --write 'src/**/*.{ts,css}' 'tests/**/*.ts'"
  }
}
```

- [ ] **Step 7: ダミーテストで動作確認**

Create `tests/smoke.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: 1 test passing.

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "chore: add vitest, eslint, prettier setup"
```

---

### Task 3: 共有型を定義

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: `src/types.ts` を作成**

```typescript
export type PartInfo = {
  index: number;        // OSMD のパートインデックス
  name: string;         // MusicXML <part-name>
  shortName: string;    // <part-abbreviation> または name の先頭文字
};

export type PlayMode = "emphasize" | "solo" | "minusOne";
export type DisplayMode = "all" | "selectedOnly";

export type ScorePlayState = {
  selectedPartIndex: number;
  playMode: PlayMode;
  displayMode: DisplayMode;
  cursorMeasure: number;
  tempo: number;
};

export type ScoreRecord = {
  id: string;
  title: string;
  parts: PartInfo[];
  xmlContent: string;
  fileName: string;
  createdAt: number;
  updatedAt: number;
  lastState?: ScorePlayState;
};

export type ScoreMeta = Pick<ScoreRecord, "title" | "parts">;
```

- [ ] **Step 2: 型エラーが無いことを確認**

Run: `npx tsc --noEmit`
Expected: エラー無し。

- [ ] **Step 3: コミット**

```bash
git add src/types.ts
git commit -m "feat: add shared type definitions"
```

---

## Phase 2: コアロジック（テストファースト）

### Task 4: FileLoader - 非圧縮 MusicXML（.musicxml / .xml）を読む

**Files:**
- Create: `src/modules/FileLoader.ts`, `tests/FileLoader.test.ts`, `tests/fixtures/sample.musicxml`

- [ ] **Step 1: テスト用 MusicXML フィクスチャを作成**

`tests/fixtures/sample.musicxml`:
```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC
    "-//Recordare//DTD MusicXML 4.0 Partwise//EN"
    "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>Test Song</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Lead</part-name><part-abbreviation>L</part-abbreviation></score-part>
    <score-part id="P2"><part-name>Bass</part-name><part-abbreviation>B</part-abbreviation></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>F</sign><line>4</line></clef></attributes>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/FileLoader.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadFile } from "../src/modules/FileLoader";

const fixturesDir = join(__dirname, "fixtures");

function fileFromFixture(name: string, mime = ""): File {
  const buffer = readFileSync(join(fixturesDir, name));
  return new File([buffer], name, { type: mime });
}

describe("FileLoader", () => {
  it("reads .musicxml file as MusicXML string", async () => {
    const file = fileFromFixture("sample.musicxml", "application/xml");
    const xml = await loadFile(file);
    expect(xml).toContain("<score-partwise");
    expect(xml).toContain("<part-name>Lead</part-name>");
  });

  it("reads .xml file as MusicXML string", async () => {
    const buffer = readFileSync(join(fixturesDir, "sample.musicxml"));
    const file = new File([buffer], "song.xml", { type: "application/xml" });
    const xml = await loadFile(file);
    expect(xml).toContain("<score-partwise");
  });

  it("rejects unsupported extensions", async () => {
    const file = new File(["data"], "song.mscz");
    await expect(loadFile(file)).rejects.toThrow(/unsupported/i);
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `npm test`
Expected: FAIL — `loadFile` が見つからない。

- [ ] **Step 4: 最小実装**

`src/modules/FileLoader.ts`:
```typescript
export async function loadFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".musicxml") || name.endsWith(".xml")) {
    return await file.text();
  }
  if (name.endsWith(".mxl")) {
    return await loadMxl(file);
  }
  throw new Error(`Unsupported file extension: ${file.name}`);
}

async function loadMxl(_file: File): Promise<string> {
  throw new Error("MXL loading not implemented yet");
}
```

- [ ] **Step 5: テスト再実行**

Run: `npm test`
Expected: 非圧縮形式のテスト 2 件と "unsupported" のテスト 1 件、すべて PASS。

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "feat(FileLoader): load .musicxml and .xml as text"
```

---

### Task 5: FileLoader - 圧縮 MusicXML（.mxl）を読む

**Files:**
- Modify: `src/modules/FileLoader.ts`
- Modify: `tests/FileLoader.test.ts`
- Create: `tests/fixtures/sample.mxl`（生成スクリプトで作る）

- [ ] **Step 1: jszip をインストール**

Run: `npm install jszip`

- [ ] **Step 2: テスト用 .mxl フィクスチャを生成**

`tests/fixtures/make-mxl.mjs`（テストフィクスチャ生成用、リポジトリには結果のみ含めても可）:
```javascript
import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const musicxml = readFileSync(join(dir, "sample.musicxml"));

const zip = new JSZip();
zip.file("META-INF/container.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<container>
  <rootfiles>
    <rootfile full-path="sample.musicxml" media-type="application/vnd.recordare.musicxml+xml"/>
  </rootfiles>
</container>`);
zip.file("sample.musicxml", musicxml);

const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync(join(dir, "sample.mxl"), buffer);
console.log("Created sample.mxl");
```

Run: `node tests/fixtures/make-mxl.mjs`
Expected: `tests/fixtures/sample.mxl` が作成される。

- [ ] **Step 3: 失敗するテストを追加**

Add to `tests/FileLoader.test.ts`:
```typescript
  it("reads .mxl file by extracting the rootfile listed in META-INF/container.xml", async () => {
    const file = fileFromFixture("sample.mxl", "application/vnd.recordare.musicxml");
    const xml = await loadFile(file);
    expect(xml).toContain("<score-partwise");
    expect(xml).toContain("<part-name>Lead</part-name>");
  });

  it("falls back to first .musicxml entry when container.xml is missing", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("something.musicxml", "<?xml version=\"1.0\"?><score-partwise>fallback</score-partwise>");
    const buffer = await zip.generateAsync({ type: "uint8array" });
    const file = new File([buffer], "x.mxl");
    const xml = await loadFile(file);
    expect(xml).toContain("fallback");
  });
```

- [ ] **Step 4: テストを実行して失敗を確認**

Run: `npm test`
Expected: FAIL — `loadMxl` が未実装。

- [ ] **Step 5: `loadMxl` を実装**

Modify `src/modules/FileLoader.ts` — replace the `loadMxl` stub:
```typescript
import JSZip from "jszip";

// ...keep loadFile as-is...

async function loadMxl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  // container.xml から rootfile を解決
  const container = zip.file("META-INF/container.xml");
  if (container) {
    const containerXml = await container.async("string");
    const match = containerXml.match(/full-path="([^"]+)"/);
    if (match) {
      const entry = zip.file(match[1]);
      if (entry) return await entry.async("string");
    }
  }

  // フォールバック：最初の .musicxml / .xml エントリを返す
  for (const name of Object.keys(zip.files)) {
    if (/\.(musicxml|xml)$/i.test(name) && !name.startsWith("META-INF/")) {
      const entry = zip.file(name);
      if (entry) return await entry.async("string");
    }
  }

  throw new Error("No MusicXML content found in .mxl archive");
}
```

- [ ] **Step 6: テスト再実行**

Run: `npm test`
Expected: 全テスト PASS（5 件）。

- [ ] **Step 7: コミット**

```bash
git add -A
git commit -m "feat(FileLoader): support .mxl via JSZip"
```

---

### Task 6: ScoreParser - メタ情報を抽出

**Files:**
- Create: `src/modules/ScoreParser.ts`, `tests/ScoreParser.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/ScoreParser.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMeta } from "../src/modules/ScoreParser";

const sample = readFileSync(join(__dirname, "fixtures/sample.musicxml"), "utf-8");

describe("ScoreParser.parseMeta", () => {
  it("extracts work title", () => {
    const meta = parseMeta(sample);
    expect(meta.title).toBe("Test Song");
  });

  it("extracts parts with names and abbreviations", () => {
    const meta = parseMeta(sample);
    expect(meta.parts).toHaveLength(2);
    expect(meta.parts[0]).toMatchObject({ index: 0, name: "Lead", shortName: "L" });
    expect(meta.parts[1]).toMatchObject({ index: 1, name: "Bass", shortName: "B" });
  });

  it("falls back to first letter when part-abbreviation is missing", () => {
    const xml = `<?xml version="1.0"?>
      <score-partwise>
        <part-list>
          <score-part id="P1"><part-name>Soprano</part-name></score-part>
        </part-list>
      </score-partwise>`;
    const meta = parseMeta(xml);
    expect(meta.parts[0].shortName).toBe("S");
  });

  it("falls back to 'Untitled' when no work title", () => {
    const xml = `<?xml version="1.0"?>
      <score-partwise>
        <part-list>
          <score-part id="P1"><part-name>X</part-name></score-part>
        </part-list>
      </score-partwise>`;
    const meta = parseMeta(xml);
    expect(meta.title).toBe("Untitled");
  });
});
```

- [ ] **Step 2: テスト実行で失敗を確認**

Run: `npm test`
Expected: FAIL — `parseMeta` が見つからない。

- [ ] **Step 3: `ScoreParser` を実装**

`src/modules/ScoreParser.ts`:
```typescript
import type { PartInfo, ScoreMeta } from "../types";

export function parseMeta(xml: string): ScoreMeta {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Invalid MusicXML");
  }

  const title =
    doc.querySelector("work > work-title")?.textContent?.trim() ||
    doc.querySelector("movement-title")?.textContent?.trim() ||
    "Untitled";

  const scoreParts = Array.from(doc.querySelectorAll("part-list > score-part"));
  const parts: PartInfo[] = scoreParts.map((el, index) => {
    const name = el.querySelector("part-name")?.textContent?.trim() || `Part ${index + 1}`;
    const abbr = el.querySelector("part-abbreviation")?.textContent?.trim();
    const shortName = abbr && abbr.length > 0 ? abbr : name.charAt(0).toUpperCase();
    return { index, name, shortName };
  });

  return { title, parts };
}
```

- [ ] **Step 4: テスト再実行**

Run: `npm test`
Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat(ScoreParser): extract title and parts from MusicXML"
```

---

### Task 7: LibraryStore - IndexedDB の CRUD

**Files:**
- Create: `src/modules/LibraryStore.ts`, `tests/LibraryStore.test.ts`

- [ ] **Step 1: idb をインストール**

Run: `npm install idb`

- [ ] **Step 2: 失敗するテストを書く**

`tests/LibraryStore.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { LibraryStore } from "../src/modules/LibraryStore";
import type { ScoreRecord } from "../src/types";

function makeRecord(overrides: Partial<ScoreRecord> = {}): Omit<ScoreRecord, "id" | "createdAt" | "updatedAt"> {
  return {
    title: "Test Song",
    parts: [{ index: 0, name: "Lead", shortName: "L" }],
    xmlContent: "<score-partwise/>",
    fileName: "test.musicxml",
    ...overrides,
  };
}

describe("LibraryStore", () => {
  let store: LibraryStore;

  beforeEach(async () => {
    // fake-indexeddb resets between tests via tests/setup.ts? Make sure each test uses unique DB
    store = new LibraryStore(`test-db-${Math.random()}`);
    await store.open();
  });

  it("adds and retrieves a record", async () => {
    const id = await store.add(makeRecord());
    const record = await store.get(id);
    expect(record?.title).toBe("Test Song");
    expect(record?.id).toBe(id);
    expect(record?.createdAt).toBeGreaterThan(0);
  });

  it("lists all records sorted by updatedAt desc", async () => {
    const id1 = await store.add(makeRecord({ title: "First" }));
    await new Promise((r) => setTimeout(r, 5));
    const id2 = await store.add(makeRecord({ title: "Second" }));
    const list = await store.list();
    expect(list.map((r) => r.id)).toEqual([id2, id1]);
  });

  it("deletes a record", async () => {
    const id = await store.add(makeRecord());
    await store.delete(id);
    expect(await store.get(id)).toBeUndefined();
  });

  it("updates lastState", async () => {
    const id = await store.add(makeRecord());
    await store.updateLastState(id, {
      selectedPartIndex: 1,
      playMode: "solo",
      displayMode: "all",
      cursorMeasure: 4,
      tempo: 120,
    });
    const record = await store.get(id);
    expect(record?.lastState?.selectedPartIndex).toBe(1);
    expect(record?.lastState?.playMode).toBe("solo");
  });

  it("tracks and returns the last opened id", async () => {
    const id = await store.add(makeRecord());
    await store.setLastOpened(id);
    expect(await store.getLastOpened()).toBe(id);
  });
});
```

- [ ] **Step 3: テスト実行で失敗を確認**

Run: `npm test`
Expected: FAIL — `LibraryStore` が無い。

- [ ] **Step 4: `LibraryStore` を実装**

`src/modules/LibraryStore.ts`:
```typescript
import { openDB, type IDBPDatabase } from "idb";
import type { ScoreRecord, ScorePlayState } from "../types";

const SCORES_STORE = "scores";
const META_STORE = "meta";
const LAST_OPENED_KEY = "lastOpenedId";

export class LibraryStore {
  private db?: IDBPDatabase;
  constructor(private readonly dbName: string = "ms-app") {}

  async open(): Promise<void> {
    this.db = await openDB(this.dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SCORES_STORE)) {
          const store = db.createObjectStore(SCORES_STORE, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE);
        }
      },
    });
  }

  private requireDb(): IDBPDatabase {
    if (!this.db) throw new Error("LibraryStore.open() not called");
    return this.db;
  }

  async add(input: Omit<ScoreRecord, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const db = this.requireDb();
    const now = Date.now();
    const record: ScoreRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await db.put(SCORES_STORE, record);
    return record.id;
  }

  async get(id: string): Promise<ScoreRecord | undefined> {
    return this.requireDb().get(SCORES_STORE, id);
  }

  async list(): Promise<ScoreRecord[]> {
    const all = await this.requireDb().getAll(SCORES_STORE);
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async delete(id: string): Promise<void> {
    await this.requireDb().delete(SCORES_STORE, id);
  }

  async updateLastState(id: string, lastState: ScorePlayState): Promise<void> {
    const db = this.requireDb();
    const existing = await db.get(SCORES_STORE, id);
    if (!existing) return;
    existing.lastState = lastState;
    existing.updatedAt = Date.now();
    await db.put(SCORES_STORE, existing);
  }

  async setLastOpened(id: string): Promise<void> {
    await this.requireDb().put(META_STORE, id, LAST_OPENED_KEY);
  }

  async getLastOpened(): Promise<string | undefined> {
    return this.requireDb().get(META_STORE, LAST_OPENED_KEY);
  }

  async clearAll(): Promise<void> {
    const db = this.requireDb();
    await db.clear(SCORES_STORE);
    await db.clear(META_STORE);
  }
}
```

- [ ] **Step 5: テスト再実行**

Run: `npm test`
Expected: 全テスト PASS。

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "feat(LibraryStore): IndexedDB CRUD for scores and metadata"
```

---

## Phase 3: 楽譜描画と音声再生

### Task 8: ScoreRenderer - OSMD ラッパー

**Files:**
- Create: `src/modules/ScoreRenderer.ts`

注：OSMD は DOM 操作と Canvas/SVG レンダリングに依存するため、自動テストはせず手動確認とする。

- [ ] **Step 1: OSMD をインストール**

Run: `npm install opensheetmusicdisplay`

- [ ] **Step 2: `ScoreRenderer` を実装**

`src/modules/ScoreRenderer.ts`:
```typescript
import { OpenSheetMusicDisplay, type IOSMDOptions } from "opensheetmusicdisplay";
import type { DisplayMode } from "../types";

export class ScoreRenderer {
  private osmd: OpenSheetMusicDisplay;

  constructor(private readonly container: HTMLElement, options: IOSMDOptions = {}) {
    this.osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: "svg",
      drawTitle: true,
      drawPartNames: true,
      ...options,
    });
  }

  async load(xml: string): Promise<void> {
    await this.osmd.load(xml);
    this.osmd.render();
    this.osmd.cursor.show();
    this.osmd.cursor.reset();
  }

  getOsmd(): OpenSheetMusicDisplay {
    return this.osmd;
  }

  setDisplayMode(mode: DisplayMode, selectedPartIndex: number): void {
    const instruments = this.osmd.Sheet?.Instruments ?? [];
    instruments.forEach((inst, i) => {
      inst.Visible = mode === "all" ? true : i === selectedPartIndex;
    });
    this.osmd.render();
    this.osmd.cursor.show();
  }

  goToMeasure(measureIndex: number): void {
    this.osmd.cursor.reset();
    for (let i = 0; i < measureIndex; i++) {
      this.osmd.cursor.next();
    }
  }

  getCurrentMeasureIndex(): number {
    const iterator = this.osmd.cursor.Iterator;
    return iterator?.CurrentMeasureIndex ?? 0;
  }
}
```

- [ ] **Step 3: 型エラーが無いことを確認**

Run: `npx tsc --noEmit`
Expected: エラー無し（OSMD の型がインストール済み）。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "feat(ScoreRenderer): OSMD wrapper with display mode toggle"
```

---

### Task 9: AudioPlayer - osmd-audio-player ラッパー

**Files:**
- Create: `src/modules/AudioPlayer.ts`

- [ ] **Step 1: osmd-audio-player をインストール**

Run: `npm install osmd-audio-player`

注：osmd-audio-player の API は実装時に最新の README で確認すること。下記の `PlaybackManager`, `LinearTimingSource`, `BasicAudioPlayer` は現在の主要 export だが、バージョンで変わる可能性がある。

- [ ] **Step 2: `AudioPlayer` を実装**

`src/modules/AudioPlayer.ts`:
```typescript
import { PlaybackManager, LinearTimingSource, BasicAudioPlayer } from "osmd-audio-player";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { PlayMode } from "../types";

const VOLUME_PROFILES: Record<PlayMode, { selected: number; others: number }> = {
  emphasize: { selected: 1.0, others: 0.3 },
  solo:      { selected: 1.0, others: 0.0 },
  minusOne:  { selected: 0.0, others: 1.0 },
};

export class AudioPlayer {
  private pbm: PlaybackManager;
  private ready = false;

  constructor() {
    const timing = new LinearTimingSource();
    const audio = new BasicAudioPlayer();
    this.pbm = new PlaybackManager(timing, null as never, audio, { MessageOccurred: undefined } as never);
  }

  async load(osmd: OpenSheetMusicDisplay): Promise<void> {
    if (!osmd.Sheet) throw new Error("OSMD sheet not loaded");
    this.pbm.initialize(osmd.Sheet);
    this.pbm.addListener(osmd.cursor);
    this.ready = true;
  }

  async play(): Promise<void> {
    if (!this.ready) return;
    await this.pbm.play();
  }

  pause(): void {
    if (!this.ready) return;
    this.pbm.pause();
  }

  stop(): void {
    if (!this.ready) return;
    this.pbm.reset();
  }

  applyPlayMode(mode: PlayMode, selectedPartIndex: number, totalParts: number): void {
    if (!this.ready) return;
    const { selected, others } = VOLUME_PROFILES[mode];
    for (let i = 0; i < totalParts; i++) {
      const volume = i === selectedPartIndex ? selected : others;
      // osmd-audio-player は 0..100 スケールを使用
      this.pbm.setInstrumentVolume?.(i, Math.round(volume * 100));
    }
  }

  setTempo(bpm: number): void {
    if (!this.ready) return;
    this.pbm.setBpm?.(bpm);
  }

  onCursorMove(callback: () => void): void {
    // PlaybackManager 経由でステップ通知を取得（具体的なイベント名は最新 API を要確認）
    this.pbm.addListener({
      cursorPositionChanged: () => callback(),
    } as never);
  }
}
```

注：`setInstrumentVolume` / `setBpm` のシグネチャや、リスナーの形は実装時に osmd-audio-player の README と TS 定義ファイルを確認して微調整すること。コード内の `as never` はライブラリの型が厳しい場合のエスケープで、実装時に正確な型に置き換える。

- [ ] **Step 3: 型エラーが無いことを確認**

Run: `npx tsc --noEmit`
Expected: エラー無し。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "feat(AudioPlayer): wrap osmd-audio-player with play modes"
```

---

## Phase 4: UI 層

### Task 10: ハッシュベースルーター

**Files:**
- Create: `src/app/router.ts`

- [ ] **Step 1: シンプルなルーターを実装**

`src/app/router.ts`:
```typescript
export type Route =
  | { name: "library" }
  | { name: "player"; scoreId: string }
  | { name: "settings" };

export type RouteHandler = (route: Route) => void;

export class Router {
  constructor(private readonly onChange: RouteHandler) {}

  start(): void {
    window.addEventListener("hashchange", () => this.dispatch());
    this.dispatch();
  }

  navigate(route: Route): void {
    window.location.hash = this.serialize(route);
  }

  private dispatch(): void {
    const hash = window.location.hash.replace(/^#/, "");
    this.onChange(this.parse(hash));
  }

  private parse(hash: string): Route {
    if (hash.startsWith("/player/")) {
      const scoreId = hash.slice("/player/".length);
      if (scoreId) return { name: "player", scoreId };
    }
    if (hash === "/settings") return { name: "settings" };
    return { name: "library" };
  }

  private serialize(route: Route): string {
    if (route.name === "player") return `#/player/${route.scoreId}`;
    if (route.name === "settings") return "#/settings";
    return "#/";
  }
}
```

- [ ] **Step 2: 型確認**

Run: `npx tsc --noEmit`
Expected: エラー無し。

- [ ] **Step 3: コミット**

```bash
git add -A
git commit -m "feat(router): hash-based router"
```

---

### Task 11: AppController スケルトン

**Files:**
- Create: `src/app/AppController.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: `AppController` を実装**

`src/app/AppController.ts`:
```typescript
import { LibraryStore } from "../modules/LibraryStore";
import { Router, type Route } from "./router";

export class AppController {
  private readonly store = new LibraryStore();
  private readonly router = new Router((route) => this.render(route));
  private rootEl!: HTMLElement;

  async start(rootEl: HTMLElement): Promise<void> {
    this.rootEl = rootEl;
    await this.store.open();
    // 起動時にハッシュが空なら、前回開いていた楽譜を復元
    if (!window.location.hash) {
      const lastId = await this.store.getLastOpened();
      if (lastId) {
        const exists = await this.store.get(lastId);
        if (exists) {
          window.location.hash = `#/player/${lastId}`;
        }
      }
    }
    this.router.start();
  }

  navigate(route: Route): void {
    this.router.navigate(route);
  }

  getStore(): LibraryStore {
    return this.store;
  }

  private async render(route: Route): Promise<void> {
    this.rootEl.innerHTML = "";
    switch (route.name) {
      case "library":
        // Task 12 で LibraryView を統合
        this.rootEl.innerHTML = "<p>Library (TODO)</p>";
        break;
      case "player":
        this.rootEl.innerHTML = `<p>Player ${route.scoreId} (TODO)</p>`;
        break;
      case "settings":
        this.rootEl.innerHTML = "<p>Settings (TODO)</p>";
        break;
    }
  }
}
```

- [ ] **Step 2: `src/main.ts` を更新**

```typescript
import "./styles/main.css";
import { AppController } from "./app/AppController";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("#app element not found");

const app = new AppController();
app.start(root);
```

- [ ] **Step 3: dev server で動作確認**

Run: `npm run dev`
Expected: "Library (TODO)" が表示される。URL を `#/settings` に変えると "Settings (TODO)"、`#/player/xxx` で "Player xxx (TODO)"。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "feat(app): AppController with placeholder routes"
```

---

### Task 12: LibraryView - 一覧、追加、削除

**Files:**
- Create: `src/views/LibraryView.ts`
- Modify: `src/app/AppController.ts`
- Modify: `src/styles/main.css`

- [ ] **Step 1: `LibraryView` を実装**

`src/views/LibraryView.ts`:
```typescript
import { loadFile } from "../modules/FileLoader";
import { parseMeta } from "../modules/ScoreParser";
import type { LibraryStore } from "../modules/LibraryStore";
import type { ScoreRecord } from "../types";

type Callbacks = {
  onOpen: (id: string) => void;
  onOpenSettings: () => void;
};

export class LibraryView {
  constructor(
    private readonly store: LibraryStore,
    private readonly callbacks: Callbacks,
  ) {}

  async render(root: HTMLElement): Promise<void> {
    const records = await this.store.list();
    root.innerHTML = `
      <header class="app-header">
        <h1>🎵 ms-app</h1>
        <button class="icon-btn" data-action="settings" aria-label="設定">⚙</button>
      </header>
      <main class="library">
        <label class="upload-btn">
          ＋ 楽譜を追加
          <input type="file" accept=".mxl,.musicxml,.xml" hidden />
        </label>
        <ul class="score-list">
          ${records.map((r) => this.renderRecord(r)).join("")}
        </ul>
        ${records.length === 0 ? `<p class="empty">楽譜を追加してください</p>` : ""}
      </main>
    `;

    root.querySelector<HTMLInputElement>("input[type=file]")?.addEventListener("change", (e) => {
      const input = e.target as HTMLInputElement;
      if (input.files?.[0]) this.handleUpload(input.files[0], root);
    });

    root.querySelector("[data-action=settings]")?.addEventListener("click", () => {
      this.callbacks.onOpenSettings();
    });

    root.querySelectorAll<HTMLLIElement>("[data-score-id]").forEach((li) => {
      const id = li.dataset.scoreId!;
      li.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest("[data-action=delete]")) return;
        this.callbacks.onOpen(id);
      });
      li.querySelector("[data-action=delete]")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm("この楽譜を削除しますか？")) {
          await this.store.delete(id);
          await this.render(root);
        }
      });
    });
  }

  private renderRecord(r: ScoreRecord): string {
    const updated = new Date(r.updatedAt).toLocaleString("ja-JP");
    return `
      <li class="score-item" data-score-id="${r.id}">
        <div class="score-title">📄 ${escapeHtml(r.title)}</div>
        <div class="score-meta">${r.parts.length} パート / ${updated}</div>
        <button class="delete-btn" data-action="delete" aria-label="削除">×</button>
      </li>
    `;
  }

  private async handleUpload(file: File, root: HTMLElement): Promise<void> {
    try {
      const xml = await loadFile(file);
      const meta = parseMeta(xml);
      const id = await this.store.add({
        title: meta.title || file.name,
        parts: meta.parts,
        xmlContent: xml,
        fileName: file.name,
      });
      this.callbacks.onOpen(id);
    } catch (err) {
      alert(`ファイルを読み込めませんでした：${(err as Error).message}`);
      await this.render(root);
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
```

- [ ] **Step 2: `AppController` で LibraryView を使う**

Modify `src/app/AppController.ts` の render メソッド：
```typescript
import { LibraryView } from "../views/LibraryView";
// ...

  private async render(route: Route): Promise<void> {
    this.rootEl.innerHTML = "";
    switch (route.name) {
      case "library": {
        const view = new LibraryView(this.store, {
          onOpen: (id) => this.navigate({ name: "player", scoreId: id }),
          onOpenSettings: () => this.navigate({ name: "settings" }),
        });
        await view.render(this.rootEl);
        break;
      }
      case "player":
        this.rootEl.innerHTML = `<p>Player ${route.scoreId} (TODO)</p>`;
        break;
      case "settings":
        this.rootEl.innerHTML = "<p>Settings (TODO)</p>";
        break;
    }
  }
```

- [ ] **Step 3: CSS を追加**

Append to `src/styles/main.css`:
```css
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #1f2937;
  color: white;
  position: sticky;
  top: 0;
  z-index: 10;
}
.app-header h1 { font-size: 18px; margin: 0; }
.icon-btn {
  background: none; border: none; color: white;
  font-size: 20px; cursor: pointer; padding: 4px 8px;
}

.library { padding: 16px; }
.upload-btn {
  display: block; padding: 14px; text-align: center;
  background: #3b82f6; color: white; border-radius: 8px;
  cursor: pointer; font-weight: bold; margin-bottom: 16px;
}
.score-list { list-style: none; padding: 0; margin: 0; }
.score-item {
  position: relative; padding: 14px; margin-bottom: 8px;
  background: white; border: 1px solid #e5e7eb; border-radius: 8px;
  cursor: pointer;
}
.score-title { font-weight: bold; }
.score-meta { font-size: 12px; color: #6b7280; margin-top: 4px; }
.delete-btn {
  position: absolute; top: 8px; right: 8px;
  background: none; border: none; font-size: 20px; cursor: pointer;
  color: #9ca3af;
}
.empty { text-align: center; color: #6b7280; margin-top: 32px; }
```

- [ ] **Step 4: 動作確認**

Run: `npm run dev`
Expected:
- 空状態で「楽譜を追加してください」が表示される
- 「＋ 楽譜を追加」ボタンでファイル選択ダイアログが開く
- `.musicxml` ファイルを選ぶと一覧に追加され、自動でプレイヤー画面（TODO 表示）に遷移する
- 戻る（ブラウザバック）で一覧に戻れる
- × ボタンで削除できる

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat(LibraryView): upload, list, and delete scores"
```

---

### Task 13: PlayerView - 楽譜・パート選択・再生

**Files:**
- Create: `src/views/PlayerView.ts`
- Modify: `src/app/AppController.ts`
- Modify: `src/styles/main.css`

- [ ] **Step 1: `PlayerView` を実装**

`src/views/PlayerView.ts`:
```typescript
import { ScoreRenderer } from "../modules/ScoreRenderer";
import { AudioPlayer } from "../modules/AudioPlayer";
import type { LibraryStore } from "../modules/LibraryStore";
import type { ScoreRecord, PlayMode, DisplayMode } from "../types";

type Callbacks = {
  onBack: () => void;
};

export class PlayerView {
  private renderer?: ScoreRenderer;
  private player?: AudioPlayer;
  private record?: ScoreRecord;
  private state = {
    selectedPartIndex: 0,
    playMode: "emphasize" as PlayMode,
    displayMode: "all" as DisplayMode,
    isPlaying: false,
  };

  constructor(
    private readonly store: LibraryStore,
    private readonly scoreId: string,
    private readonly callbacks: Callbacks,
  ) {}

  async render(root: HTMLElement): Promise<void> {
    const record = await this.store.get(this.scoreId);
    if (!record) {
      root.innerHTML = `<p class="error">楽譜が見つかりません</p>`;
      return;
    }
    this.record = record;

    // 復元
    if (record.lastState) {
      this.state.selectedPartIndex = record.lastState.selectedPartIndex;
      this.state.playMode = record.lastState.playMode;
      this.state.displayMode = record.lastState.displayMode;
    }

    root.innerHTML = `
      <header class="app-header">
        <button class="icon-btn" data-action="back" aria-label="戻る">←</button>
        <h1>${escapeHtml(record.title)}</h1>
        <span></span>
      </header>
      <div class="score-container" id="score-container"></div>
      <div class="controls">
        <div class="parts">
          ${record.parts.map((p) => `
            <button class="part-chip ${p.index === this.state.selectedPartIndex ? "active" : ""}"
                    data-part-index="${p.index}">${escapeHtml(p.name)}</button>
          `).join("")}
        </div>
        <div class="mode-row">
          <label><input type="radio" name="mode" value="emphasize" ${this.state.playMode === "emphasize" ? "checked" : ""}/> 強調</label>
          <label><input type="radio" name="mode" value="solo" ${this.state.playMode === "solo" ? "checked" : ""}/> ソロ</label>
          <label><input type="radio" name="mode" value="minusOne" ${this.state.playMode === "minusOne" ? "checked" : ""}/> マイナスワン</label>
        </div>
        <div class="display-row">
          表示:
          <select data-action="display-mode">
            <option value="all" ${this.state.displayMode === "all" ? "selected" : ""}>全パート</option>
            <option value="selectedOnly" ${this.state.displayMode === "selectedOnly" ? "selected" : ""}>選択パートのみ</option>
          </select>
        </div>
        <div class="transport">
          <button data-action="play" class="play-btn">▶</button>
          <button data-action="stop">■</button>
        </div>
      </div>
    `;

    // 描画＆再生器を準備
    const scoreContainer = root.querySelector<HTMLDivElement>("#score-container")!;
    this.renderer = new ScoreRenderer(scoreContainer);
    await this.renderer.load(record.xmlContent);
    this.renderer.setDisplayMode(this.state.displayMode, this.state.selectedPartIndex);

    this.player = new AudioPlayer();
    await this.player.load(this.renderer.getOsmd());
    this.player.applyPlayMode(this.state.playMode, this.state.selectedPartIndex, record.parts.length);

    this.bindEvents(root);
    await this.store.setLastOpened(this.scoreId);
  }

  private bindEvents(root: HTMLElement): void {
    root.querySelector("[data-action=back]")?.addEventListener("click", () => {
      this.callbacks.onBack();
    });

    root.querySelectorAll<HTMLButtonElement>(".part-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.state.selectedPartIndex = parseInt(btn.dataset.partIndex!, 10);
        root.querySelectorAll(".part-chip").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.applyState();
        this.persist();
      });
    });

    root.querySelectorAll<HTMLInputElement>("input[name=mode]").forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.checked) {
          this.state.playMode = radio.value as PlayMode;
          this.applyState();
          this.persist();
        }
      });
    });

    root.querySelector<HTMLSelectElement>("[data-action=display-mode]")?.addEventListener("change", (e) => {
      this.state.displayMode = (e.target as HTMLSelectElement).value as DisplayMode;
      this.renderer?.setDisplayMode(this.state.displayMode, this.state.selectedPartIndex);
      this.persist();
    });

    root.querySelector("[data-action=play]")?.addEventListener("click", async () => {
      if (this.state.isPlaying) {
        this.player?.pause();
        this.state.isPlaying = false;
        root.querySelector(".play-btn")!.textContent = "▶";
      } else {
        await this.player?.play();
        this.state.isPlaying = true;
        root.querySelector(".play-btn")!.textContent = "⏸";
      }
    });

    root.querySelector("[data-action=stop]")?.addEventListener("click", () => {
      this.player?.stop();
      this.state.isPlaying = false;
      root.querySelector(".play-btn")!.textContent = "▶";
    });
  }

  private applyState(): void {
    if (!this.record) return;
    this.player?.applyPlayMode(this.state.playMode, this.state.selectedPartIndex, this.record.parts.length);
    this.renderer?.setDisplayMode(this.state.displayMode, this.state.selectedPartIndex);
  }

  private async persist(): Promise<void> {
    if (!this.record) return;
    await this.store.updateLastState(this.scoreId, {
      selectedPartIndex: this.state.selectedPartIndex,
      playMode: this.state.playMode,
      displayMode: this.state.displayMode,
      cursorMeasure: this.renderer?.getCurrentMeasureIndex() ?? 0,
      tempo: this.record.lastState?.tempo ?? 120,
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
```

- [ ] **Step 2: `AppController` で PlayerView を使う**

Modify the `player` case in `AppController.render`:
```typescript
import { PlayerView } from "../views/PlayerView";
// ...

      case "player": {
        const view = new PlayerView(this.store, route.scoreId, {
          onBack: () => this.navigate({ name: "library" }),
        });
        await view.render(this.rootEl);
        break;
      }
```

- [ ] **Step 3: CSS を追加**

Append to `src/styles/main.css`:
```css
.score-container {
  background: white;
  padding: 8px;
  overflow-x: auto;
  min-height: 200px;
  border-bottom: 1px solid #e5e7eb;
}
.controls {
  background: #f9fafb;
  padding: 12px 16px;
  position: sticky;
  bottom: 0;
}
.parts {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  margin-bottom: 12px;
  padding-bottom: 4px;
}
.part-chip {
  padding: 8px 16px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 14px;
}
.part-chip.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}
.mode-row {
  display: flex;
  gap: 16px;
  font-size: 14px;
  margin-bottom: 10px;
}
.mode-row label {
  display: flex;
  align-items: center;
  gap: 4px;
}
.display-row {
  font-size: 14px;
  margin-bottom: 12px;
}
.transport {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.transport button {
  width: 56px;
  height: 56px;
  font-size: 20px;
  border: 1px solid #d1d5db;
  border-radius: 50%;
  background: white;
  cursor: pointer;
}
.play-btn { background: #3b82f6 !important; color: white; }
.error { padding: 24px; color: #ef4444; text-align: center; }
```

- [ ] **Step 4: 動作確認**

Run: `npm run dev`
Expected:
- ライブラリから楽譜を選ぶとプレイヤー画面に遷移
- 楽譜が表示される
- パートチップをタップで選択が切り替わる
- 再生モードのラジオで切替できる
- 表示モード（全パート / 選択パートのみ）の切替ができる
- 再生ボタンで音が鳴る（実機ブラウザで要確認）
- 停止ボタンで止まる
- 戻ってもう一度開くと、最後の状態が復元される

注：音声再生は実機 / Chrome DevTools で動作確認。iOS Safari ではユーザー操作（タップ）が必須。

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat(PlayerView): score rendering, part selection, play modes"
```

---

### Task 14: SettingsView - 最小限の設定画面

**Files:**
- Create: `src/views/SettingsView.ts`
- Modify: `src/app/AppController.ts`
- Modify: `src/styles/main.css`

- [ ] **Step 1: `SettingsView` を実装**

`src/views/SettingsView.ts`:
```typescript
import type { LibraryStore } from "../modules/LibraryStore";

type Callbacks = {
  onBack: () => void;
};

export class SettingsView {
  constructor(
    private readonly store: LibraryStore,
    private readonly callbacks: Callbacks,
  ) {}

  render(root: HTMLElement): void {
    root.innerHTML = `
      <header class="app-header">
        <button class="icon-btn" data-action="back" aria-label="戻る">←</button>
        <h1>設定</h1>
        <span></span>
      </header>
      <main class="settings">
        <section>
          <h2>ライブラリ</h2>
          <button class="danger-btn" data-action="clear">全ての楽譜を削除</button>
        </section>
        <section>
          <h2>このアプリについて</h2>
          <p>ms-app - アカペラ音取り PWA</p>
          <p style="font-size: 12px; color: #6b7280;">
            楽譜データは端末内に保存され、サーバーには送信されません。
          </p>
        </section>
      </main>
    `;

    root.querySelector("[data-action=back]")?.addEventListener("click", () => this.callbacks.onBack());

    root.querySelector("[data-action=clear]")?.addEventListener("click", async () => {
      if (confirm("全ての楽譜を削除します。本当によろしいですか？")) {
        await this.store.clearAll();
        alert("削除しました");
        this.callbacks.onBack();
      }
    });
  }
}
```

- [ ] **Step 2: `AppController` で SettingsView を使う**

```typescript
import { SettingsView } from "../views/SettingsView";
// ...
      case "settings": {
        const view = new SettingsView(this.store, {
          onBack: () => this.navigate({ name: "library" }),
        });
        view.render(this.rootEl);
        break;
      }
```

- [ ] **Step 3: CSS を追加**

Append to `src/styles/main.css`:
```css
.settings { padding: 16px; }
.settings section {
  background: white; padding: 16px; border-radius: 8px;
  margin-bottom: 16px; border: 1px solid #e5e7eb;
}
.settings h2 { font-size: 14px; color: #6b7280; margin: 0 0 12px 0; }
.danger-btn {
  width: 100%; padding: 12px; background: #fee2e2;
  border: 1px solid #fca5a5; color: #b91c1c;
  border-radius: 6px; cursor: pointer; font-weight: bold;
}
```

- [ ] **Step 4: 動作確認**

Run: `npm run dev`
Expected: ライブラリ画面の ⚙ ボタンで設定画面に遷移、戻るボタンで戻る、「全削除」で確認後に削除される。

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat(SettingsView): minimal settings with library clear"
```

---

## Phase 5: PWA 対応

### Task 15: vite-plugin-pwa の導入

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`

- [ ] **Step 1: vite-plugin-pwa をインストール**

Run: `npm install -D vite-plugin-pwa`

- [ ] **Step 2: アイコンを用意**

シンプルな単色＋音符絵文字アイコンを 2 サイズ作成。手作業で用意するか、以下のスクリプトで生成：

`scripts/make-icons.mjs`（一度きりの生成用、リポジトリに含めなくても OK）:
```javascript
import { writeFileSync, mkdirSync } from "node:fs";

// SVG をベースに PNG を作る代わりに、最小実装として SVG ファイルを使う方法もある。
// ここでは単純化のため、SVG を 2 つの PNG として手動で用意する想定。
// 代替：https://realfavicongenerator.net/ で 1 枚の画像から生成し
// `public/icons/icon-192.png` `public/icons/icon-512.png` に配置する。

console.log("Please place icon-192.png and icon-512.png under public/icons/");
console.log("You can use https://realfavicongenerator.net/ or any image editor.");
```

代替案：`public/icons/icon.svg` を 1 枚作り、PWA マニフェストで `purpose: any` として使う：
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#3b82f6"/>
  <text x="50%" y="55%" font-size="320" text-anchor="middle" dominant-baseline="middle" fill="white">♪</text>
</svg>
```

ただし iOS Safari は PNG を強く推奨するため、可能なら PNG で 192 / 512 を用意する。

- [ ] **Step 3: `vite.config.ts` を更新**

```typescript
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*"],
      manifest: {
        name: "ms-app - アカペラ音取り",
        short_name: "ms-app",
        description: "MusicXML をアップロードしてアカペラの音取りができる PWA",
        theme_color: "#1f2937",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(?:js|css|woff2)$/,
            handler: "StaleWhileRevalidate",
          },
        ],
      },
    }),
  ],
});
```

注：`base: "./"` は GitHub Pages のサブパス配信に必要。

- [ ] **Step 4: ビルドして PWA 生成物を確認**

Run: `npm run build`
Expected: `dist/sw.js` と `dist/manifest.webmanifest` が生成される。エラー無し。

Run: `npm run preview`
Expected: http://localhost:4173 でビルド版が動く。ブラウザの DevTools → Application → Manifest にマニフェスト情報が表示される。

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat(pwa): add vite-plugin-pwa with manifest and service worker"
```

---

### Task 16: PWA 手動 QA

これは実装ではなく検証タスク。

- [ ] **Step 1: ローカルでオフライン動作確認**

`npm run preview` で起動 → ブラウザ DevTools → Network → "Offline" にチェック → ページをリロード → 起動できることを確認。

- [ ] **Step 2: スマホ実機での確認（後でデプロイ後に再確認）**

Phase 6 で GitHub Pages デプロイ後、スマホで URL を開き：
- iOS Safari：共有 → 「ホーム画面に追加」
- Android Chrome：メニュー → 「ホーム画面に追加」

ホーム画面のアイコンから起動 → スタンドアロンモードで動く（ブラウザ UI なし）ことを確認。

---

## Phase 6: デプロイ

### Task 17: GitHub Pages へのデプロイ準備

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`

- [ ] **Step 1: GitHub Actions ワークフローを作成**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: README を作成**

`README.md`:
```markdown
# ms-app

アカペラ譜面（MusicXML）をスマホでアップロードして、パートごとの音取り練習ができる PWA。

## 機能
- `.mxl` / `.musicxml` / `.xml` 形式のアップロード
- パート選択と 3 種類の再生モード（強調 / ソロ / マイナスワン）
- 楽譜表示と再生位置のカーソル同期
- 全パート表示 ⇔ 選択パートのみ表示の切替
- 端末内に楽譜を保存（IndexedDB、サーバー送信なし）
- PWA としてホーム画面に追加可能、オフライン動作

## 開発

```
npm install
npm run dev      # 開発サーバー
npm test         # テスト
npm run build    # 本番ビルド
npm run preview  # ビルド版の確認
```

## デプロイ

`main` ブランチに push すると GitHub Actions が自動で GitHub Pages にデプロイします。
```

- [ ] **Step 3: コミット**

```bash
git add -A
git commit -m "ci: add GitHub Pages deploy workflow and README"
```

---

### Task 18: GitHub リポジトリ作成とデプロイ

実機認証が必要な手動作業を含む。

- [ ] **Step 1: GitHub CLI をインストール**

Run: `brew install gh`
Expected: インストール完了。`gh --version` で確認。

- [ ] **Step 2: GitHub にログイン**

Run: `gh auth login`
プロンプト指示に従って認証（GitHub.com → HTTPS → ブラウザログイン推奨）。
Expected: `gh auth status` で "Logged in" が表示される。

- [ ] **Step 3: リポジトリを作成**

Run:
```bash
gh repo create ms-app --public --source=. --remote=origin --description="アカペラ音取り PWA"
```
Expected: GitHub に `ms-app` リポジトリが作成され、ローカルの `origin` リモートが設定される。

- [ ] **Step 4: main ブランチに切り替え＆ push**

```bash
git branch -M main
git push -u origin main
```
Expected: push 成功。

- [ ] **Step 5: GitHub Pages を有効化**

Run:
```bash
gh api -X POST "repos/$(gh repo view --json owner,name -q '.owner.login + "/" + .name')/pages" \
  -f "build_type=workflow" 2>&1 | head -10
```
代替（うまく動かない場合）：ブラウザで `https://github.com/<user>/ms-app/settings/pages` を開き、Source を "GitHub Actions" に設定。

- [ ] **Step 6: ワークフロー完了を待ち、URL を確認**

```bash
gh run watch
```
完了後、`https://<user>.github.io/ms-app/` でアプリにアクセスできる。

- [ ] **Step 7: スマホでアクセスして PWA 動作確認**

- iOS Safari でアクセス → 共有 → 「ホーム画面に追加」
- Android Chrome でアクセス → メニュー → 「ホーム画面に追加」
- ホーム画面から起動 → スタンドアロンで動く
- 楽譜をアップロード → 音取り再生できる

- [ ] **Step 8: 完了コミット（必要な調整があれば）**

```bash
git add -A
git commit -m "chore: deployment verification"
git push
```

---

## Phase 7: テンポ機能（任意・余力があれば）

### Task 19: テンポ調整（オプション）

**Files:**
- Modify: `src/views/PlayerView.ts`, `src/views/SettingsView.ts`

これは MVP の "あれば便利" 機能。Task 18 までで MVP は完成しているので、ここはスキップしても OK。

- [ ] **Step 1: SettingsView にテンポスライダーを追加**

`SettingsView.ts` の HTML に追加：
```html
<section>
  <h2>再生</h2>
  <label>
    テンポ調整 (BPM)
    <input type="range" min="40" max="200" value="120" data-action="tempo" />
    <span data-display="tempo">120</span>
  </label>
</section>
```

設定値は `localStorage.setItem("tempo", value)` で保持し、PlayerView 側で読んで `AudioPlayer.setTempo(bpm)` を呼ぶ。

- [ ] **Step 2: PlayerView の `applyState` でテンポを反映**

```typescript
const tempo = parseInt(localStorage.getItem("tempo") ?? "120", 10);
this.player?.setTempo(tempo);
```

- [ ] **Step 3: 実機で確認＆コミット**

```bash
git add -A
git commit -m "feat: tempo adjustment in settings"
git push
```

---

## 完了条件チェック

すべての Task が完了したら、設計ドキュメント `Section 15. 完了条件（MVP）` の項目を一つずつ確認：

1. ✅ `.mxl` / `.musicxml` / `.xml` をアップロードしてライブラリに追加できる（Task 5, 12）
2. ✅ ライブラリから楽譜を選んでプレイヤー画面に遷移できる（Task 12, 13）
3. ✅ 楽譜が画面に正しく描画される（Task 8, 13）
4. ✅ パート選択ができ、3 種の再生モードが切替えられる（Task 9, 13）
5. ✅ 再生中、カーソルが現在位置をハイライトする（Task 8, 9）
6. ✅ 表示モードを切替えられる（Task 8, 13）
7. ✅ ブラウザを閉じても最後の状態から再開できる（Task 7, 13）
8. ✅ PWA としてホーム画面に追加でき、オフラインで起動できる（Task 15, 16, 18）
9. ✅ GitHub Pages 上に公開され、URL でアクセス可能（Task 17, 18）

---

## 既知のリスク・運用上の注意

- **osmd-audio-player の API バージョン依存**：Task 9 のラッパー実装は、インストール後に実際のパッケージの d.ts / README を見て微調整が必要かもしれない。
- **iOS Safari の音声制約**：自動再生不可。「再生ボタンを押す」UX で対応済み。
- **大きな楽譜ファイル**：IndexedDB の容量制限（端末依存）。容量超過時は alert 表示。
- **MusicXML の方言**：OSMD が対応していない記法を含む楽譜は描画失敗する可能性。エラー時の alert 表示で対処。
