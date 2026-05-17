import { LibraryStore } from "../modules/LibraryStore";
import { Router, type Route } from "./router";
import { LibraryView } from "../views/LibraryView";
import { PlayerView } from "../views/PlayerView";

export class AppController {
  private readonly store: LibraryStore;
  private readonly router: Router;
  private rootEl!: HTMLElement;
  private renderToken = 0;
  private activeView?: { dispose(): void };

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
    this.activeView?.dispose();
    this.activeView = undefined;
    this.rootEl.innerHTML = "";
    switch (route.name) {
      case "library": {
        const view = new LibraryView(this.store, {
          onOpen: (id) => this.navigate({ name: "player", scoreId: id }),
          onOpenSettings: () => this.navigate({ name: "settings" }),
          onChange: () => void this.render({ name: "library" }),
        });
        this.activeView = view;
        await view.render(this.rootEl, () => myToken === this.renderToken);
        if (myToken !== this.renderToken) return;
        break;
      }
      case "player": {
        const view = new PlayerView(this.store, route.scoreId, {
          onBack: () => this.navigate({ name: "library" }),
        });
        this.activeView = view;
        await view.render(this.rootEl, () => myToken === this.renderToken);
        break;
      }
      case "settings":
        this.rootEl.innerHTML = "<p>Settings (TODO)</p>";
        break;
    }
  }
}
