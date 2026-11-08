"""Capability normalization and Decoyr Guard evaluation (machine-enforced, never prompt-only)."""
from __future__ import annotations

import posixpath
from fnmatch import fnmatch
from typing import Any
from urllib.parse import urlparse


def norm_path(p: Any) -> str:
    if not isinstance(p, str) or not p:
        return "/"
    p = "/" + p.lstrip("/")
    n = posixpath.normpath(p)
    if p.endswith("/") and n != "/":
        n += "/"
    return n


def host_of(url: Any) -> str:
    try:
        return (urlparse(str(url)).hostname or "").lower()
    except Exception:
        return ""


def target_of(tool: str, args: dict) -> str | None:
    if tool in ("repo.list_files",):
        return norm_path(args.get("path") or "/")
    if tool in ("repo.read_file", "artifact.write"):
        return norm_path(args.get("path"))
    if tool == "repo.get_commits":
        return str(args.get("repo") or "acme/app")
    if tool in ("docs.search", "messages.search"):
        return str(args.get("query") or "")[:120]
    if tool == "secrets.get":
        return str(args.get("name") or "")
    if tool in ("net.fetch", "net.post", "net.egress"):
        return host_of(args.get("url")) or str(args.get("host") or "")
    return None


def constraint_label(constraint: dict | None) -> str:
    """Human label for a Guard constraint, e.g. {"path_prefix": "/release/"} -> "/release/**"."""
    if not constraint:
        return "all"
    parts = []
    if "path_prefix" in constraint:
        parts.append(constraint["path_prefix"].rstrip("/") + "/**")
    if "paths" in constraint:
        parts.append(", ".join(constraint["paths"]))
    if "path_glob" in constraint:
        parts.append(constraint["path_glob"])
    if "repo" in constraint:
        parts.append(constraint["repo"])
    if "hosts" in constraint:
        parts.append(", ".join(constraint["hosts"]) or "no hosts")
    if "names" in constraint:
        parts.append(", ".join(constraint["names"]) or "no names")
    return "; ".join(parts) or "all"


def _match_constraint(tool: str, args: dict, constraint: dict) -> tuple[bool, str]:
    if not constraint:
        return True, "allowed without constraint"
    target = target_of(tool, args) or ""
    if "path_prefix" in constraint:
        pref = constraint["path_prefix"]
        if not (target.startswith(pref) or (pref.endswith("/") and target == pref.rstrip("/"))):
            return False, f"path {target} is outside the allowed prefix {pref}"
    if "paths" in constraint:
        if target not in constraint["paths"]:
            return False, f"path {target} is not one of {', '.join(constraint['paths'])}"
    if "path_glob" in constraint:
        if not fnmatch(target, constraint["path_glob"]):
            return False, f"path {target} does not match {constraint['path_glob']}"
    if "repo" in constraint:
        if target != constraint["repo"]:
            return False, f"repository {target} is not {constraint['repo']}"
    if "hosts" in constraint:
        if target not in constraint["hosts"]:
            return False, f"host {target} is not in {', '.join(constraint['hosts']) or 'the approved list'}"
    if "names" in constraint:
        if target not in constraint["names"]:
            return False, f"{target} is not an approved name"
    return True, "within constraint"


def evaluate(policy: dict | None, layer: str, tool: str, args: dict) -> dict:
    """Return {decision, reason, ruleId, enforced}."""
    if policy is None:
        return {"decision": "allowed", "reason": "Baseline run: observe-only, no Guard applied", "ruleId": None, "enforced": False}

    if layer == "network":
        method = str(args.get("method", "GET")).upper()
        host = target_of("net.egress", args) or ""
        allowed_hosts = policy.get("allow", {}).get("network", {}).get(method, [])
        if host in allowed_hosts:
            return {"decision": "allowed", "reason": f"{method} {host} is on the Guard network allowlist", "ruleId": f"allow.network.{method}", "enforced": True}
        return {"decision": "denied", "reason": f"{method} to {host} is not on the Guard network allowlist (default deny)", "ruleId": f"deny.network.{method}", "enforced": True}

    deny_tools = policy.get("deny", {}).get("mcp_tools", [])
    allow_tools = policy.get("allow", {}).get("mcp_tools", {})
    if tool in deny_tools:
        return {"decision": "denied", "reason": f"{tool} is denied by Guard: it is not part of the Minimum Viable Authority for this task", "ruleId": f"deny.mcp.{tool}", "enforced": True}
    if tool in allow_tools:
        ok, why = _match_constraint(tool, args, allow_tools[tool] or {})
        if ok:
            return {"decision": "allowed", "reason": f"{tool} allowed by Guard ({why})", "ruleId": f"allow.mcp.{tool}", "enforced": True}
        return {"decision": "denied", "reason": f"{tool} denied by Guard constraint: {why}", "ruleId": f"allow.mcp.{tool}.constraint", "enforced": True}
    return {"decision": "denied", "reason": f"{tool} is not in the Guard allowlist (default deny)", "ruleId": "default.deny", "enforced": True}
