"""Live-inference request shaping (no network: the OpenAI client is replaced)."""
from types import SimpleNamespace

from decoyr import inference
from decoyr.config import settings


class FakeCompletions:
    def __init__(self):
        self.kwargs = None

    def create(self, **kwargs):
        self.kwargs = kwargs
        msg = {"role": "assistant", "content": None, "tool_calls": [{"id": "c1", "type": "function", "function": {"name": "repo__list_files", "arguments": "{}"}}]}
        return SimpleNamespace(model_dump=lambda exclude_none=True: {"model": kwargs["model"], "choices": [{"index": 0, "message": msg, "finish_reason": "tool_calls"}]})


def _with(monkeypatch, **overrides):
    for k, v in overrides.items():
        object.__setattr__(settings, k, v)
    fake = FakeCompletions()
    monkeypatch.setattr(inference, "_client", SimpleNamespace(chat=SimpleNamespace(completions=fake)))
    return fake


def test_live_request_sets_reasoning_effort_and_token_cap(monkeypatch):
    old = (settings.vultr_key, settings.model, settings.reasoning_effort, settings.max_completion_tokens)
    try:
        fake = _with(monkeypatch, vultr_key="test-key", model="glm-5.3-flash", reasoning_effort="low", max_completion_tokens=4096)
        out = inference.chat({"messages": [{"role": "user", "content": "hi"}], "tools": [{"type": "function", "function": {"name": "x", "parameters": {}}}]})
        assert fake.kwargs["model"] == "glm-5.3-flash" and fake.kwargs["max_tokens"] == 4096
        assert fake.kwargs["extra_body"] == {"reasoning_effort": "low"} and fake.kwargs["tool_choice"] == "auto"
        assert out["choices"][0]["finish_reason"] == "tool_calls"
        # an agent asking for more than the cap is clamped; "none" omits the reasoning field
        fake = _with(monkeypatch, reasoning_effort="none")
        inference.chat({"messages": [], "max_tokens": 100000})
        assert fake.kwargs["max_tokens"] == 4096 and "extra_body" not in fake.kwargs
    finally:
        for k, v in zip(("vultr_key", "model", "reasoning_effort", "max_completion_tokens"), old):
            object.__setattr__(settings, k, v)
        inference._client = None
