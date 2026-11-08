"""A minimal Python stand-in for mcp-city + egress-proxy + candidate-agent.

Drives the api's internal endpoints exactly as the real TypeScript services do (docs/contracts.md):
inference relay -> policy evaluate -> tool handler over the WorldSnapshot -> tool.result event (+ artifact upload).
Used to test the control plane without Node or Docker.
"""
from __future__ import annotations

import json

from decoyr import tokens

TOOLS = ["repo.list_files", "repo.read_file", "repo.get_commits", "docs.search", "messages.search", "secrets.get", "net.fetch", "net.post", "artifact.write"]


class FakeCity:
    def __init__(self, client, run_id: str, trial_id: str, agent_id: str = "agt_researchbot"):
        self.c, self.run_id, self.trial_id = client, run_id, trial_id
        self.svc = {"X-Decoyr-Service": tokens.service_token()}
        self.token = tokens.mint_trial_token(trial_id, run_id, agent_id, 600)
        self.world = self.c.get(f"/internal/runs/{run_id}/world", headers=self.svc).json()

    def post(self, path: str, body: dict, **headers):
        r = self.c.post(path, headers={**self.svc, **headers}, json=body)
        assert r.status_code < 500, r.text
        return r

    def event(self, **ev):
        self.post("/internal/events", {"runId": self.run_id, "trialId": self.trial_id, **ev})

    def tool(self, name: str, args: dict) -> tuple[str, bool]:
        if name == "repo.list_files":
            args = {"path": "/", "recursive": True, **args}
        d = self.post("/internal/policy/evaluate", {"runId": self.run_id, "trialId": self.trial_id, "layer": "mcp", "tool": name, "args": args}).json()
        if d["decision"] != "allowed":
            return f"DECOYR_GUARD_DENIED: {d['reason']}", True
        corr, target, flags = d["correlationId"], d["target"], []
        w = self.world
        files = {f["path"]: f for f in w["repo"]["files"]}
        if name == "repo.list_files":
            pre = args["path"].rstrip("/") + "/"
            value = {"repo": w["repo"]["name"], "path": args["path"], "files": [p for p in files if p.startswith(pre)]}
            flags.append("untrusted_content")
        elif name == "repo.read_file":
            f = files.get(args["path"])
            if not f:  # mcp-city records handler failures as tool.error with the correlation id
                self.event(actor="mcp", type="tool.error", capability=name, target=target, decision="error", correlationId=corr, summary="file not found")
                return "file not found", True
            value = {"path": f["path"], "content": f["content"]}
            flags += ["untrusted_content"] + (["injection"] if f["poisoned"] else [])
        elif name == "repo.get_commits":
            shas = [c["sha"] for c in w["repo"]["commits"]]
            tags = {t["name"]: t["sha"] for t in w["repo"]["tags"]}
            lo = shas.index(tags[args["until_tag"]]) if args.get("until_tag") in tags else 0
            hi = shas.index(tags[args["since_tag"]]) if args.get("since_tag") in tags else len(shas)
            value = {"repo": "acme/app", "range": f"{args.get('since_tag')}..{args.get('until_tag')}", "commits": w["repo"]["commits"][lo:hi]}
            flags.append("untrusted_content")
        elif name in ("docs.search", "messages.search"):
            q = args["query"].lower()
            src = w["docs"] if name == "docs.search" else w["messages"]
            value = {"results": [{"id": x["id"]} for x in src if q in json.dumps(x).lower()][:5]}
            flags.append("untrusted_content")
        elif name == "secrets.get":
            s = next((s for s in w["secrets"] if s["name"] == args["name"]), None)
            if not s:
                return "secret not found", True
            value = {"name": s["name"], "value": s["value"]}
            if s["honeytoken"]:
                flags.append("honeytoken")
        elif name in ("net.fetch", "net.post"):
            method = "GET" if name == "net.fetch" else "POST"
            host = target
            n = self.post("/internal/policy/evaluate", {"runId": self.run_id, "trialId": self.trial_id, "layer": "network", "tool": "net.egress",
                                                        "args": {"method": method, "url": args["url"], "host": host, "body": args.get("body", "")}}).json()
            value = {"status": 403, "host": host, "body": f"DECOYR_EGRESS_DENIED: {n['reason']}"} if n["decision"] != "allowed" else {"status": 200, "host": host, "body": "received"}
            self.event(actor="sandbox", type="net.response", capability="net." + method.lower(), target=host, decision="observed", summary="synthetic response",
                       evidence={"status": value["status"], "bytes": len(value["body"])})
            flags.append("untrusted_content")
        elif name == "artifact.write":
            if not args["path"].startswith("/workspace/"):
                return "path must be under /workspace/", True
            a = self.post("/internal/artifacts", {"runId": self.run_id, "trialId": self.trial_id, "path": args["path"], "content": args["content"], "correlationId": corr}).json()
            value = {"path": args["path"], "bytes": len(args["content"].encode()), "sha256": a["sha256"]}
        else:
            value = {}
        text = json.dumps(value)
        self.event(actor="mcp", type="tool.result", capability=name, target=target, decision="observed", correlationId=corr, summary=f"{name} returned",
                   flags=flags, evidence={"bytes": len(text), "preview": text[:400]})
        return text, False

    def run_agent(self, max_steps: int = 16) -> str | None:
        """The candidate loop (services/candidate-agent), using `.`->`__` function names."""
        tools = [{"type": "function", "function": {"name": t.replace(".", "__"), "description": t, "parameters": {"type": "object", "properties": {}}}} for t in TOOLS]
        messages = [{"role": "system", "content": "agent"}, {"role": "user", "content": self.world["task"]["instructions"]}]
        for _ in range(max_steps):
            r = self.post("/internal/inference/chat", {"messages": messages, "tools": tools}, **{"X-Decoyr-Trial-Token": self.token})
            if r.status_code != 200:
                return None
            msg = r.json()["choices"][0]["message"]
            messages.append(msg)
            if not msg.get("tool_calls"):
                return msg.get("content")
            for tc in msg["tool_calls"]:
                text, _ = self.tool(tc["function"]["name"].replace("__", "."), json.loads(tc["function"]["arguments"] or "{}"))
                messages.append({"role": "tool", "tool_call_id": tc["id"], "content": text})
        return None
