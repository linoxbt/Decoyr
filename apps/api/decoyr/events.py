"""Append-only evidence trail (Decoyr Trace)."""
from __future__ import annotations

from typing import Any

from sqlalchemy import func, select

from . import db
from .ids import new_id, now_iso

_seq: dict[str, int] = {}

TOOL_VERBS = {
    "repo.list_files": "Listed files",
    "repo.read_file": "Read",
    "repo.get_commits": "Fetched commits",
    "docs.search": "Searched docs",
    "messages.search": "Searched messages",
    "secrets.get": "Requested secret",
    "net.fetch": "GET",
    "net.post": "POST",
    "artifact.write": "Wrote",
}


def short_target(target: str | None) -> str:
    if not target:
        return ""
    if target.startswith("/") and target.count("/") > 1:
        return target.rsplit("/", 1)[-1] or target
    return target


def default_title(etype: str, capability: str | None, target: str | None, decision: str | None) -> str:
    t = short_target(target)
    cap = capability or ""
    if etype == "tool.request":
        verb = TOOL_VERBS.get(cap, cap)
        return f"{verb} {t}".strip() if cap not in ("repo.list_files",) else f"Listed files in {target or '/'}"
    if etype == "tool.allow":
        return f"Allowed {cap}"
    if etype == "tool.deny":
        return f"Guard denied {cap}"
    if etype == "tool.result":
        return f"{cap} returned"
    if etype == "tool.error":
        return f"{cap} rejected"
    if etype == "net.request":
        return f"Egress request to {t}"
    if etype == "net.allow":
        return f"Egress allowed to {t}"
    if etype == "net.deny":
        return f"Egress blocked to {t}"
    if etype == "net.response":
        return f"Response from {t}"
    if etype == "honeytoken.touch":
        return f"Honeycredential {t} returned to agent"
    if etype == "honeytoken.egress":
        return f"Honeycredential sent to {t}"
    if etype == "injection.delivered":
        return f"Untrusted instruction delivered via {t}"
    if etype == "artifact.created":
        return f"Created {t}"
    return etype


def emit(
    trial_id: str,
    run_id: str,
    actor: str,
    etype: str,
    summary: str,
    *,
    title: str | None = None,
    capability: str | None = None,
    target: str | None = None,
    decision: str | None = None,
    correlation_id: str | None = None,
    finding_id: str | None = None,
    flags: list[str] | None = None,
    latency_ms: int | None = None,
    evidence: dict[str, Any] | None = None,
) -> dict:
    with db.write_lock:
        if run_id not in _seq:
            with db.engine().connect() as c:
                _seq[run_id] = c.execute(select(func.coalesce(func.max(db.events.c.seq), 0)).where(db.events.c.run_id == run_id)).scalar_one()
        _seq[run_id] += 1
        row = {
            "id": new_id("evt"),
            "trial_id": trial_id,
            "run_id": run_id,
            "seq": _seq[run_id],
            "timestamp": now_iso(),
            "actor": actor,
            "type": etype,
            "title": title or default_title(etype, capability, target, decision),
            "summary": summary,
            "capability": capability,
            "target": target,
            "decision": decision,
            "correlation_id": correlation_id,
            "finding_id": finding_id,
            "flags": sorted(set(flags or [])),
            "latency_ms": latency_ms,
            "evidence": evidence,
        }
        db.insert_row(db.events, row)
    return row


def add_flags(event_ids: list[str], flags: list[str], finding_id: str | None = None) -> None:
    for eid in event_ids:
        e = db.get_one(db.events, id=eid)
        if not e:
            continue
        values: dict[str, Any] = {"flags": sorted(set(e["flags"] or []) | set(flags))}
        if finding_id and not e.get("finding_id"):
            values["finding_id"] = finding_id
        db.update_row(db.events, "id", eid, values)


def forget_run(run_id: str) -> None:
    with db.write_lock:
        _seq.pop(run_id, None)


def to_api(e: dict) -> dict:
    return {
        "id": e["id"],
        "trialId": e["trial_id"],
        "runId": e["run_id"],
        "seq": e["seq"],
        "timestamp": e["timestamp"],
        "actor": e["actor"],
        "type": e["type"],
        "title": e["title"],
        "summary": e["summary"],
        "capability": e["capability"],
        "target": e["target"],
        "decision": e["decision"],
        "correlationId": e["correlation_id"],
        "findingId": e["finding_id"],
        "flags": e["flags"] or [],
        "latencyMs": e["latency_ms"],
        "evidence": e["evidence"],
    }
