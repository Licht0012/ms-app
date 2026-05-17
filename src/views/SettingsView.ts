import type { LibraryStore } from "../modules/LibraryStore";

type Callbacks = {
  onBack: () => void;
};

export class SettingsView {
  private readonly store: LibraryStore;
  private readonly callbacks: Callbacks;

  constructor(store: LibraryStore, callbacks: Callbacks) {
    this.store = store;
    this.callbacks = callbacks;
  }

  render(root: HTMLElement): void {
    root.innerHTML = `
      <header class="app-header">
        <button class="icon-btn" data-action="back" aria-label="戻る">←</button>
        <h1>設定</h1>
        <span class="spacer"></span>
      </header>
      <main class="settings">
        <section>
          <h2>ライブラリ</h2>
          <button class="danger-btn" data-action="clear">全ての楽譜を削除</button>
        </section>
        <section>
          <h2>このアプリについて</h2>
          <p>ms-app - アカペラ音取り PWA</p>
          <p class="muted">楽譜データは端末内に保存され、サーバーには送信されません。</p>
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

  dispose(): void {
    // No persistent resources to release.
  }
}
