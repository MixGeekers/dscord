// Minimal method + path router. A string path matches exactly; a RegExp passes its decoded groups to the handler.
export class Router {
  routes = [];

  on(method, path, handler) {
    this.routes.push({ method, path, handler });
    return this;
  }

  get(path, handler) { return this.on('GET', path, handler); }
  post(path, handler) { return this.on('POST', path, handler); }
  put(path, handler) { return this.on('PUT', path, handler); }
  delete(path, handler) { return this.on('DELETE', path, handler); }

  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method && route.method !== '*') continue;
      if (typeof route.path === 'string') {
        if (route.path === pathname) return { handler: route.handler, params: [] };
      } else {
        const found = pathname.match(route.path);
        if (found) return { handler: route.handler, params: found.slice(1).map(part => part === undefined ? undefined : decodeURIComponent(part)) };
      }
    }
    return undefined;
  }
}

export function httpError(status, message, extra = {}) {
  return Object.assign(new Error(message), { status, ...extra });
}
