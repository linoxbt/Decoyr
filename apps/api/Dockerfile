# syntax=docker/dockerfile:1
# Decoyr control plane (FastAPI). Build from the REPOSITORY ROOT so the scenario packs are included:
#   docker build -f apps/api/Dockerfile .        (compose: context ../.., dockerfile apps/api/Dockerfile)
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    DECOYR_REPO_ROOT=/srv/decoyr
WORKDIR /srv/decoyr/apps/api
COPY apps/api/requirements.txt ./
RUN pip install -r requirements.txt
COPY packages/scenarios /srv/decoyr/packages/scenarios
COPY apps/api/decoyr ./decoyr
# Non-root. The orchestrator reaches the host Docker socket through supplementary group membership:
# compose adds the socket's group id (DOCKER_GID) with `group_add`. Candidates never get this socket,
# these credentials, or this network.
RUN groupadd --system --gid 10002 decoyr-api \
    && useradd --system --uid 10002 --gid 10002 --no-create-home --shell /usr/sbin/nologin decoyr-api
USER 10002:10002
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=2)"
CMD ["uvicorn", "decoyr.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
