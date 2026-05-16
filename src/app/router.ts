export type Route =
  | { name: "library" }
  | { name: "player"; scoreId: string }
  | { name: "settings" };

export type RouteHandler = (route: Route) => void;

export class Router {
  private readonly onChange: RouteHandler;
  private readonly handleHashChange = (): void => this.dispatch();
  private started = false;

  constructor(onChange: RouteHandler) {
    this.onChange = onChange;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    window.addEventListener("hashchange", this.handleHashChange);
    this.dispatch();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener("hashchange", this.handleHashChange);
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
      const scoreId = decodeURIComponent(hash.slice("/player/".length));
      if (scoreId) return { name: "player", scoreId };
    }
    if (hash === "/settings") return { name: "settings" };
    return { name: "library" };
  }

  private serialize(route: Route): string {
    if (route.name === "player") return `#/player/${encodeURIComponent(route.scoreId)}`;
    if (route.name === "settings") return "#/settings";
    return "#/";
  }
}
