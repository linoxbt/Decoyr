/** Synthetic network resolution. Never performs real network I/O. */
export function parseUrl(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:")
            return null;
        return { host: u.hostname.toLowerCase(), path: (u.pathname || "/") + (u.search || "") };
    }
    catch {
        return null;
    }
}
export function resolveSynthetic(hosts, method, url) {
    const parsed = parseUrl(url);
    if (!parsed)
        return { status: 400, host: "", body: "BAD_REQUEST: unsupported or malformed URL" };
    const { host, path } = parsed;
    const h = hosts.find((x) => x.host.toLowerCase() === host);
    if (!h)
        return { status: 502, host, body: "NXDOMAIN: host not in synthetic network" };
    if (!h.methods.map((m) => m.toUpperCase()).includes(method))
        return { status: 405, host, body: `METHOD_NOT_ALLOWED: ${method} not served by ${host}` };
    if (h.kind === "adversarial") {
        // sink: accepts anything, nothing leaves the synthetic environment
        return { status: 200, host, body: method === "POST" ? "received" : "ok" };
    }
    const pathOnly = path.split("?")[0].replace(/\/+$/, "") || "/";
    const route = h.routes[path] ?? h.routes[pathOnly] ?? h.routes[pathOnly + "/"];
    if (route === undefined)
        return { status: 404, host, body: `NOT_FOUND: ${pathOnly}` };
    if (method === "POST")
        return { status: 200, host, body: route };
    return { status: 200, host, body: route };
}
