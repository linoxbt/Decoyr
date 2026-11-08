/** WorldSnapshot (see docs/contracts.md) and pure, deterministic tool logic over it. */
export class ToolError extends Error {
}
function normPath(p) {
    let s = (p ?? "/").trim();
    if (!s.startsWith("/"))
        s = "/" + s;
    s = s.replace(/\/+/g, "/");
    // resolve . and .. segments without escaping root
    const out = [];
    for (const seg of s.split("/")) {
        if (!seg || seg === ".")
            continue;
        if (seg === "..")
            out.pop();
        else
            out.push(seg);
    }
    return "/" + out.join("/");
}
export function listFiles(world, path = "/", recursive = true) {
    const prefix = normPath(path);
    const base = prefix === "/" ? "/" : prefix + "/";
    const all = world.repo.files.map((f) => normPath(f.path)).sort();
    let files;
    if (recursive) {
        files = all.filter((f) => f === prefix || f.startsWith(base));
    }
    else {
        const set = new Set();
        for (const f of all) {
            if (!f.startsWith(base))
                continue;
            const rest = f.slice(base.length);
            const first = rest.split("/")[0];
            set.add(base + first + (rest.includes("/") ? "/" : ""));
        }
        files = [...set].sort();
    }
    return { repo: world.repo.name, path: prefix, files };
}
export function readFile(world, path) {
    const p = normPath(path);
    const f = world.repo.files.find((x) => normPath(x.path) === p);
    if (!f)
        throw new ToolError(`file not found: ${p}`);
    return { path: p, content: f.content, poisoned: Boolean(f.poisoned) };
}
export function getCommits(world, opts) {
    const repo = opts.repo ?? world.repo.name;
    if (repo !== world.repo.name)
        throw new ToolError(`unknown repository: ${repo}`);
    const commits = world.repo.commits; // newest first
    const tagSha = (name) => world.repo.tags.find((t) => t.name === name)?.sha ?? commits.find((c) => c.tag === name)?.sha;
    const idxOf = (name) => {
        const sha = tagSha(name);
        if (!sha)
            throw new ToolError(`unknown tag: ${name}`);
        const i = commits.findIndex((c) => c.sha === sha || c.sha.startsWith(sha) || sha.startsWith(c.sha));
        if (i < 0)
            throw new ToolError(`tag ${name} points to unknown commit`);
        return i;
    };
    const start = opts.until_tag ? idxOf(opts.until_tag) : 0;
    const end = opts.since_tag ? idxOf(opts.since_tag) : commits.length; // exclusive: commits *after* since_tag
    const limit = opts.limit ?? 50;
    const slice = commits.slice(start, Math.max(start, end)).slice(0, limit);
    return {
        repo,
        range: `${opts.since_tag ?? "(root)"}..${opts.until_tag ?? "HEAD"}`,
        commits: slice.map((c) => ({ sha: c.sha, message: c.message, author: c.author, date: c.date, tag: c.tag ?? null })),
    };
}
function matches(query, ...fields) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0)
        return true;
    const hay = fields.filter(Boolean).join("\n").toLowerCase();
    return terms.some((t) => hay.includes(t));
}
function score(query, ...fields) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hay = fields.filter(Boolean).join("\n").toLowerCase();
    return terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
}
function snippet(content, query) {
    const lower = content.toLowerCase();
    const term = query.toLowerCase().split(/\s+/).find((t) => t && lower.includes(t));
    const at = term ? Math.max(0, lower.indexOf(term) - 80) : 0;
    return content.slice(at, at + 300);
}
export function searchDocs(world, query, limit = 5) {
    const hits = world.docs
        .filter((d) => matches(query, d.title, d.content, (d.tags ?? []).join(" ")))
        .sort((a, b) => score(query, b.title, b.content, (b.tags ?? []).join(" ")) - score(query, a.title, a.content, (a.tags ?? []).join(" ")))
        .slice(0, limit);
    return {
        results: hits.map((d) => ({ id: d.id, title: d.title, url: d.url, snippet: snippet(d.content, query) })),
        poisoned: hits.some((d) => d.poisoned),
    };
}
export function searchMessages(world, query, limit = 5) {
    const hits = world.messages
        .filter((m) => matches(query, m.subject, m.body, m.channel, m.from))
        .sort((a, b) => score(query, b.subject, b.body) - score(query, a.subject, a.body))
        .slice(0, limit);
    return {
        results: hits.map((m) => ({ id: m.id, channel: m.channel, from: m.from, subject: m.subject, body: m.body, timestamp: m.timestamp })),
        poisoned: hits.some((m) => m.poisoned),
    };
}
export function getSecret(world, name) {
    const s = world.secrets.find((x) => x.name === name);
    if (!s)
        throw new ToolError(`secret not found: ${name}`);
    return { name: s.name, value: s.value };
}
export function workspacePath(world, path) {
    const root = normPath(world.workspace?.root ?? "/workspace/");
    const p = normPath(path);
    if (!(p === root || p.startsWith(root + "/")) || p === root)
        throw new ToolError(`artifact path must be under ${root}/`);
    return p;
}
export { normPath };
