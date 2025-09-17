// src/router/router.ts
import type { Unmount } from "../views/AppShell";
import type { Route } from "./routes";

export type NavigationTarget = {
  route: Route;
  params: Record<string, string>;
  fullPath: string;
};

export type RouterOptions = {
  defaultPath?: string;
  onBeforeEach?: (to: NavigationTarget) => void | Promise<void>;
  onAfterEach?: (to: NavigationTarget) => void | Promise<void>;
};

export class Router {
  private routes: Route[];
  private options: RouterOptions;
  private outlet: HTMLElement;
  private currentUnmount: Unmount | null = null;
  private onHashChangeBound: () => void;
  private navToken = 0;

  constructor(routes: Route[], outletSelector = "#app", options: RouterOptions = {}) {
    const outlet = document.querySelector(outletSelector);
    if (!outlet) throw new Error(`Router outlet "${outletSelector}" not found`);
    this.routes = routes;
    this.options = options;
    this.outlet = outlet as HTMLElement;
    this.onHashChangeBound = this.render.bind(this);
  }

  start() {
    if (!location.hash) {
      this.navigate(this.options.defaultPath || "/login");
    }
    window.addEventListener("hashchange", this.onHashChangeBound);
    void this.render();
  }

  dispose() {
    window.removeEventListener("hashchange", this.onHashChangeBound);
    this.unmountCurrent();
    this.navToken++;
  }

  navigate(path: string) {
    location.hash = path.startsWith("#") ? path : `#${path}`;
  }

  renderNow() {
    return this.render();
  }

  setRoutes(routes: Route[]) {
    this.routes = routes;
    return this.render();
  }

  private unmountCurrent() {
    if (this.currentUnmount) {
      try {
        this.currentUnmount();
      } catch {}
      this.currentUnmount = null;
    }
  }

  private pathToRegex(path: string): RegExp {
    return new RegExp("^" + path.replace(/:[^/]+/g, "([^/]+)") + "$");
  }

  private extractParams(path: string, match: RegExpExecArray): Record<string, string> {
    const keys = (path.match(/:([^/]+)/g) || []).map((k) => k.slice(1));
    const values = match.slice(1);
    const params: Record<string, string> = {};
    keys.forEach((k, i) => (params[k] = values[i]));
    return params;
  }

  private matchRoute(path: string): NavigationTarget | null {
    for (const r of this.routes) {
      const rx = this.pathToRegex(r.path);
      const result = rx.exec(path);
      if (result) {
        return {
          route: r,
          params: this.extractParams(r.path, result),
          fullPath: path,
        };
      }
    }
    return null;
  }

  private async render() {
    const raw = (location.hash || "").replace(/^#/, "");
    const path = raw || this.options.defaultPath || "/login";

    const matched = this.matchRoute(path) ?? this.matchRoute(this.options.defaultPath || "/login");

    if (!matched) {
      this.outlet.replaceChildren();
      this.currentUnmount = null;
      return;
    }

    const token = ++this.navToken;

    if (this.options.onBeforeEach) {
      await this.options.onBeforeEach(matched);
      if (token !== this.navToken) return;
    }

    this.unmountCurrent();
    this.outlet.replaceChildren();

    try {
      const maybeUnmount = await matched.route.view(this.outlet, matched.params);
      if (token !== this.navToken) {
        if (typeof maybeUnmount === "function") {
          try {
            maybeUnmount();
          } catch {}
          return;
        }
      }

      this.currentUnmount = typeof maybeUnmount === "function" ? maybeUnmount : null;

      if (this.options.onAfterEach) {
        await this.options.onAfterEach(matched);
        if (token !== this.navToken) return;
      }

      window.scrollTo(0, 0);
    } catch (e) {
      if (token !== this.navToken) return;

      const n = document.createElement("div");
      n.className = "p-4 text-red-600";
      n.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
      this.outlet.replaceChildren(n);
      this.currentUnmount = null;
    }

    window.scrollTo(0, 0);
  }
}
