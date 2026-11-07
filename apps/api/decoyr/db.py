"""Persistence (SQLAlchemy Core). SQLite for local dev, PostgreSQL in deployment."""
from __future__ import annotations

import json
import threading
from typing import Any, Iterable

from sqlalchemy import (Column, Index, Integer, MetaData, String, Table, Text, create_engine, delete, insert, select,
                        update)
from sqlalchemy.engine import Engine

from .config import settings

metadata = MetaData()

agents = Table(
    "agents", metadata,
    Column("id", String(40), primary_key=True),
    Column("name", String(120), nullable=False),
    Column("version", String(40), nullable=False),
    Column("purpose", Text, nullable=False),
    Column("model", String(200), nullable=False),
    Column("requested_capabilities", Text, nullable=False),
    Column("config", Text, nullable=False),
    Column("builtin", Integer, nullable=False, default=0),
    Column("created_at", String(40), nullable=False),
)

trials = Table(
    "trials", metadata,
    Column("id", String(40), primary_key=True),
    Column("short_id", String(12), nullable=False),
    Column("name", String(200), nullable=False),
    Column("agent_id", String(40), nullable=False, index=True),
    Column("world_version", String(60), nullable=False),
    Column("scenario_id", String(60), nullable=False),
    Column("scenario_pack", Text, nullable=False),
    Column("task_id", String(80), nullable=False),
    Column("seed", String(60), nullable=False),
    Column("world_json", Text, nullable=False),
    Column("world_sha256", String(64), nullable=False),
    Column("status", String(20), nullable=False),
    Column("conclusion", String(20), nullable=False),
    Column("guard_id", String(40)),
    Column("error", Text),
    Column("created_at", String(40), nullable=False),
    Column("updated_at", String(40), nullable=False),
)

runs = Table(
    "runs", metadata,
    Column("id", String(40), primary_key=True),
    Column("trial_id", String(40), nullable=False, index=True),
    Column("type", String(12), nullable=False),
    Column("status", String(12), nullable=False),
    Column("guard_id", String(40)),
    Column("started_at", String(40)),
    Column("ended_at", String(40)),
    Column("sandbox", Text, nullable=False),
    Column("assertions", Text, nullable=False),
    Column("task_result", String(10), nullable=False),
    Column("security_result", String(10), nullable=False),
    Column("tool_calls", Integer, nullable=False, default=0),
    Column("model_calls", Integer, nullable=False, default=0),
    Column("denied_calls", Integer, nullable=False, default=0),
    Column("error", Text),
    Column("created_at", String(40), nullable=False),
)

events = Table(
    "events", metadata,
    Column("id", String(40), primary_key=True),
    Column("trial_id", String(40), nullable=False),
    Column("run_id", String(40), nullable=False),
    Column("seq", Integer, nullable=False),
    Column("timestamp", String(40), nullable=False),
    Column("actor", String(20), nullable=False),
    Column("type", String(40), nullable=False),
    Column("title", Text, nullable=False),
    Column("summary", Text, nullable=False),
    Column("capability", String(80)),
    Column("target", Text),
    Column("decision", String(12)),
    Column("correlation_id", String(60)),
    Column("finding_id", String(40)),
    Column("flags", Text, nullable=False),
    Column("latency_ms", Integer),
    Column("evidence", Text),
)
Index("ix_events_run_seq", events.c.run_id, events.c.seq, unique=True)
Index("ix_events_trial", events.c.trial_id)

artifacts = Table(
    "artifacts", metadata,
    Column("id", String(40), primary_key=True),
    Column("trial_id", String(40), nullable=False, index=True),
    Column("run_id", String(40), nullable=False, index=True),
    Column("kind", String(20), nullable=False),
    Column("path", Text, nullable=False),
    Column("sha256", String(64), nullable=False),
    Column("size", Integer, nullable=False),
    Column("content", Text, nullable=False),
    Column("event_id", String(40)),
    Column("created_at", String(40), nullable=False),
)

findings = Table(
    "findings", metadata,
    Column("id", String(40), primary_key=True),
    Column("trial_id", String(40), nullable=False, index=True),
    Column("run_id", String(40), nullable=False),
    Column("data", Text, nullable=False),
    Column("created_at", String(40), nullable=False),
)

authority = Table(
    "authority", metadata,
    Column("trial_id", String(40), primary_key=True),
    Column("data", Text, nullable=False),
    Column("updated_at", String(40), nullable=False),
)

guards = Table(
    "guards", metadata,
    Column("id", String(40), primary_key=True),
    Column("trial_id", String(40), nullable=False, index=True),
    Column("version", Integer, nullable=False),
    Column("policy_json", Text, nullable=False),
    Column("sha256", String(64), nullable=False),
    Column("rules", Text, nullable=False),
    Column("created_at", String(40), nullable=False),
)

passports = Table(
    "passports", metadata,
    Column("id", String(40), primary_key=True),
    Column("trial_id", String(40), nullable=False, index=True),
    Column("data", Text, nullable=False),
    Column("generated_at", String(40), nullable=False),
)

JSON_COLS = {"requested_capabilities", "config", "scenario_pack", "sandbox", "assertions", "flags", "evidence", "data", "rules"}

_engine: Engine | None = None
write_lock = threading.RLock()


def engine() -> Engine:
    global _engine
    if _engine is None:
        url = settings.database_url
        kwargs: dict[str, Any] = {"future": True}
        if url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30}
        else:
            kwargs["pool_size"] = 10
            kwargs["max_overflow"] = 20
            kwargs["pool_pre_ping"] = True
        _engine = create_engine(url, **kwargs)
        if url.startswith("sqlite"):
            with _engine.begin() as c:
                c.exec_driver_sql("PRAGMA journal_mode=WAL")
        metadata.create_all(_engine)
    return _engine


def _dump(row: dict) -> dict:
    out = {}
    for k, v in row.items():
        out[k] = json.dumps(v) if k in JSON_COLS and v is not None and not isinstance(v, str) else v
    return out


def _load(row: Any) -> dict:
    d = dict(row._mapping)
    for k in list(d):
        if k in JSON_COLS and isinstance(d[k], str):
            try:
                d[k] = json.loads(d[k])
            except json.JSONDecodeError:
                pass
    return d


def insert_row(table: Table, row: dict) -> None:
    with write_lock, engine().begin() as c:
        c.execute(insert(table).values(**_dump(row)))


def update_row(table: Table, key: str, key_value: Any, values: dict) -> None:
    with write_lock, engine().begin() as c:
        c.execute(update(table).where(table.c[key] == key_value).values(**_dump(values)))


def upsert_authority(trial_id: str, data: dict, updated_at: str) -> None:
    with write_lock, engine().begin() as c:
        c.execute(delete(authority).where(authority.c.trial_id == trial_id))
        c.execute(insert(authority).values(trial_id=trial_id, data=json.dumps(data), updated_at=updated_at))


def get_one(table: Table, **where: Any) -> dict | None:
    stmt = select(table)
    for k, v in where.items():
        stmt = stmt.where(table.c[k] == v)
    with engine().connect() as c:
        r = c.execute(stmt.limit(1)).first()
    return _load(r) if r else None


def get_many(table: Table, order_by: Iterable | None = None, limit: int | None = None, **where: Any) -> list[dict]:
    stmt = select(table)
    for k, v in where.items():
        stmt = stmt.where(table.c[k] == v)
    if order_by is not None:
        stmt = stmt.order_by(*order_by)
    if limit:
        stmt = stmt.limit(limit)
    with engine().connect() as c:
        return [_load(r) for r in c.execute(stmt)]


def run_events(run_id: str, after: int = 0) -> list[dict]:
    stmt = select(events).where(events.c.run_id == run_id, events.c.seq > after).order_by(events.c.seq)
    with engine().connect() as c:
        return [_load(r) for r in c.execute(stmt)]


def delete_trial_data(trial_id: str) -> None:
    with write_lock, engine().begin() as c:
        for t in (events, artifacts, findings, guards, passports, runs):
            c.execute(delete(t).where(t.c.trial_id == trial_id))
        c.execute(delete(authority).where(authority.c.trial_id == trial_id))
        c.execute(delete(trials).where(trials.c.id == trial_id))
