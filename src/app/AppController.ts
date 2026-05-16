import { LibraryStore } from "../modules/LibraryStore";
import { Router, type Route } from "./router";
import { LibraryView } from "../views/LibraryView";
import { escapeHtml } from "../utils/html";

export class AppController {
  private readonly store: LibraryStore;
  private readonly router: Router;
  private rootEl!: HTMLElement;
  private renderToken = 0;

  constructor() {
    this.store = new LibraryStore();
    this.router = new Router((route) => {
      void this.render(route);
    });
  }

  async start(rootEl: HTMLElement): Promise<void> {
    this.rootEl = rootEl;
    await this.store.open();
    // 起動時にハッシュが空なら、前回開いていた楽譜を復元
    if (!window.location.hash) {
      const lastId = await this.store.getLastOpened();
      if (lastId) {
        const exists = await this.store.get(lastId);
        if (exists) {
          window.location.hash = `#/player/${encodeURIComponent(lastId)}`;
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
    const myToken = ++this.renderToken;
    this.rootEl.innerHTML = "";
    switch (route.name) {
      case "library": {
        const view = new LibraryView(this.store, {
          onOpen: (id) => this.navigate({ name: "player", scoreId: id }),
          onOpenSettings: () => this.navigate({ name: "settings" }),
        });
        await view.render(this.rootEl);
        if (myToken !== this.renderToken) return;
        break;
      }
      case "player":
        this.rootEl.innerHTML = `<p>Player ${escapeHtml(route.scoreId)} (TODO)</p>`;
        break;
      case "settings":
        this.rootEl.innerHTML = "<p>Settings (TODO)</p>";
        break;
    }
  }
}
