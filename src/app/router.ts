export type Route =
  | { name: "library" }
  | { name: "player"; scoreId: string }
  | { name: "settings" };

export type RouteHandler = (route: Route) => void;

export class Router {
  private readonly onChange: RouteHandler;

  constructor(onChange: RouteHandler) {
    this.onChange = onChange;
  }

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
