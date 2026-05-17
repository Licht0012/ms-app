import { loadFile } from "../modules/FileLoader";
import { parseMeta } from "../modules/ScoreParser";
import type { LibraryStore } from "../modules/LibraryStore";
import type { ScoreRecord } from "../types";
import { escapeHtml } from "../utils/html";

type Callbacks = {
  onOpen: (id: string) => void;
  onOpenSettings: () => void;
  onChange: () => void;
};

export class LibraryView {
  private readonly store: LibraryStore;
  private readonly callbacks: Callbacks;

  constructor(store: LibraryStore, callbacks: Callbacks) {
    this.store = store;
    this.callbacks = callbacks;
  }

  async render(root: HTMLElement, isCurrent?: () => boolean): Promise<void> {
    const records = await this.store.list();
    if (isCurrent && !isCurrent()) return;
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
      if (input.files?.[0]) void this.handleUpload(input.files[0]);
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
          this.callbacks.onChange();
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

  dispose(): void {
    // No-op: LibraryView has no long-lived resources. Implemented for
    // interface uniformity with PlayerView in AppController.
  }

  private async handleUpload(file: File): Promise<void> {
    try {
      const xml = await loadFile(file);
      const meta = parseMeta(xml);
      if (meta.parts.length === 0) {
        throw new Error("パートが見つかりません（MusicXMLにscore-partが含まれていません）");
      }
      const id = await this.store.add({
        title: meta.title || file.name,
        parts: meta.parts,
        xmlContent: xml,
        fileName: file.name,
      });
      this.callbacks.onOpen(id);
    } catch (err) {
      alert(`ファイルを読み込めませんでした：${(err as Error).message}`);
      this.callbacks.onChange();
    }
  }
}
