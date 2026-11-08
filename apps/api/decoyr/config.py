"""Runtime configuration. All secrets stay in the trusted control plane."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(os.environ["DECOYR_REPO_ROOT"]).resolve() if os.environ.get("DECOYR_REPO_ROOT") else Path(__file__).resolve().parents[3]


def _database_url() -> str:
    """DATABASE_URL, normalized for SQLAlchemy + psycopg 3 (PaaS providers hand out postgres:// URLs)."""
    url = os.environ.get("DATABASE_URL") or f"sqlite:///{REPO_ROOT / 'apps/api/decoyr.db'}"
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=_database_url)
    vultr_key: str | None = field(default_factory=lambda: os.environ.get("VULTR_SERVERLESS_INFERENCE_API_KEY") or None)
    vultr_base_url: str = field(default_factory=lambda: os.environ.get("VULTR_INFERENCE_BASE_URL", "https://api.vultrinference.com/v1"))
    model: str = field(default_factory=lambda: os.environ.get("DECOYR_MODEL", ""))
    signing_key: str = field(default_factory=lambda: os.environ.get("DECOYR_INTERNAL_SIGNING_KEY", "dev-signing-key"))
    admin_token: str | None = field(default_factory=lambda: os.environ.get("DECOYR_ADMIN_TOKEN") or None)
    public_url: str = field(default_factory=lambda: os.environ.get("DECOYR_PUBLIC_URL", "http://localhost:3000"))
    host_provider: str = field(default_factory=lambda: os.environ.get("DECOYR_HOST_PROVIDER", "local"))
    sandbox: str = field(default_factory=lambda: os.environ.get("DECOYR_SANDBOX", "process"))
    candidate_image: str = field(default_factory=lambda: os.environ.get("DECOYR_CANDIDATE_IMAGE", "decoyr/candidate-agent:latest"))
    # Agent runtimes (Docker images) a trial may select. Operator-controlled allowlist: users can never
    # make the orchestrator run an arbitrary image. The default image is always allowed.
    extra_candidate_images: str = field(default_factory=lambda: os.environ.get("DECOYR_CANDIDATE_IMAGES", ""))

    @property
    def candidate_images(self) -> list[str]:
        extra = [i.strip() for i in self.extra_candidate_images.split(",") if i.strip()]
        return list(dict.fromkeys([self.candidate_image, *extra]))
    mcp_container: str = field(default_factory=lambda: os.environ.get("DECOYR_MCP_CONTAINER", "decoyr-mcp-city"))
    sandbox_mcp_url: str = field(default_factory=lambda: os.environ.get("DECOYR_SANDBOX_MCP_URL", "http://127.0.0.1:7100"))
    mcp_health_url: str = field(default_factory=lambda: os.environ.get("DECOYR_MCP_HEALTH_URL", "http://127.0.0.1:7100/healthz"))
    egress_health_url: str = field(default_factory=lambda: os.environ.get("DECOYR_EGRESS_HEALTH_URL", "http://127.0.0.1:7200/healthz"))
    candidate_entry: str = field(default_factory=lambda: os.environ.get("DECOYR_CANDIDATE_ENTRY", str(REPO_ROOT / "services/candidate-agent/dist/index.js")))
    max_seconds: int = field(default_factory=lambda: max(5, _int("TRIAL_MAX_SECONDS", 180)))
    memory_mb: int = field(default_factory=lambda: max(64, _int("TRIAL_MEMORY_MB", 512)))
    cpu_quota: float = field(default_factory=lambda: max(0.1, _float("TRIAL_CPU_QUOTA", 1.0)))
    max_pids: int = field(default_factory=lambda: max(16, _int("TRIAL_MAX_PIDS", 128)))
    max_tool_calls: int = field(default_factory=lambda: max(1, _int("TRIAL_MAX_TOOL_CALLS", 40)))
    # Live inference tuning. Vultr's tool-calling models all reason; reasoning tokens count toward
    # max_tokens, so a low effort keeps tool calls from being truncated. "none" disables the field.
    reasoning_effort: str = field(default_factory=lambda: os.environ.get("DECOYR_REASONING_EFFORT", "low").strip().lower())
    max_completion_tokens: int = field(default_factory=lambda: max(256, min(_int("DECOYR_MAX_TOKENS", 4096), 32768)))
    max_steps: int = field(default_factory=lambda: _int("TRIAL_MAX_STEPS", 16))
    drill_seconds: int = field(default_factory=lambda: _int("TRIAL_DRILL_SECONDS", 8))
    trial_rate_per_hour: int = field(default_factory=lambda: _int("TRIAL_RATE_PER_HOUR", 60))
    # Per-client abuse limits for the public demo (0 disables; enforced in-process, so the api must
    # run a single worker — see apps/api/Dockerfile). Keyed by client IP (X-Forwarded-For from Caddy).
    ip_actions_per_10min: int = field(default_factory=lambda: max(0, _int("DECOYR_IP_ACTIONS_PER_10MIN", 30)))
    ip_runs_per_10min: int = field(default_factory=lambda: max(0, _int("DECOYR_IP_RUNS_PER_10MIN", 8)))
    # Global ceiling on real model calls per UTC day across all runs (0 disables). Guards the operator's
    # inference bill when the demo is public: the per-run budget alone can't bound back-to-back runs.
    daily_model_calls: int = field(default_factory=lambda: max(0, _int("DECOYR_DAILY_MODEL_CALLS", 3000)))
    # Optional shared secrets required on mutating routes (X-Decoyr-Key). Empty = open public demo.
    api_keys_csv: str = field(default_factory=lambda: os.environ.get("DECOYR_API_KEYS", ""))
    scenarios_dir: Path = REPO_ROOT / "packages/scenarios"

    @property
    def api_keys(self) -> list[str]:
        return [k.strip() for k in self.api_keys_csv.split(",") if k.strip()]

    @property
    def inference_mode(self) -> str:
        return "vultr" if self.vultr_key else "simulated"

    def check_startup(self) -> None:
        """Refuse to start a real deployment with the insecure dev signing key.

        The key signs service and sandbox trial tokens; the dev default is public. Local dev and
        the test suite (host_provider == "local") are exempt. On the VM, cloud-init generates a
        fresh key, so this only fires on a genuine misconfiguration.
        """
        if self.host_provider != "local" and self.signing_key in ("", "dev-signing-key"):
            raise RuntimeError(
                "DECOYR_INTERNAL_SIGNING_KEY is unset or the insecure dev default on a non-local "
                "deployment (DECOYR_HOST_PROVIDER=%s). Set a strong random key." % self.host_provider
            )


settings = Settings()
