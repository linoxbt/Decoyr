#!/usr/bin/env bash
# Redeploy Decoyr to the Vultr VM over SSH.
#
#   VM_HOST=<ip-or-dns> ./infra/vultr/deploy.sh            # sync working tree, rebuild, restart
#   VM_HOST=<ip> SYNC=git ./infra/vultr/deploy.sh            # git pull on the VM instead of rsync
#
# If infra/docker/.env exists locally, keys listed in PUSH_ENV_KEYS are merged into the VM's
# .env (the VM keeps its own generated signing key / DB password unless you push them).
set -euo pipefail

: "${VM_HOST:?VM_HOST is required}"
VM_USER="${VM_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/decoyr}"
SYNC="${SYNC:-rsync}"
PUSH_ENV_KEYS="${PUSH_ENV_KEYS:-VULTR_SERVERLESS_INFERENCE_API_KEY DECOYR_MODEL VULTR_INFERENCE_BASE_URL DECOYR_DOMAIN DECOYR_PUBLIC_URL}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="$VM_USER@$VM_HOST"
SSH=(ssh -o StrictHostKeyChecking=accept-new "$TARGET")

if [ "$SYNC" = "git" ]; then
  echo "==> git pull on $VM_HOST"
  "${SSH[@]}" "cd '$REMOTE_DIR' && git pull --ff-only"
else
  echo "==> rsync working tree to $VM_HOST:$REMOTE_DIR"
  rsync -az --delete \
    --exclude '.git' --exclude 'node_modules' --exclude '.next' --exclude 'dist' --exclude 'dist-test' \
    --exclude '__pycache__' --exclude '.venv' --exclude '*.db' --exclude 'infra/docker/.env' \
    -e "ssh -o StrictHostKeyChecking=accept-new" "$ROOT/" "$TARGET:$REMOTE_DIR/"
fi

LOCAL_ENV="$ROOT/infra/docker/.env"
if [ -f "$LOCAL_ENV" ]; then
  echo "==> merging selected keys from local .env: $PUSH_ENV_KEYS"
  for key in $PUSH_ENV_KEYS; do
    line="$(grep -E "^${key}=" "$LOCAL_ENV" | tail -n1 || true)"
    [ -n "$line" ] || continue
    value="${line#*=}"
    [ -n "$value" ] || continue
    # shellcheck disable=SC2029 # expansion on the client side is intended
    printf '%s\n' "$value" | "${SSH[@]}" "set -e; f='$REMOTE_DIR/infra/docker/.env'; v=\$(cat); \
      if grep -qE '^${key}=' \"\$f\"; then sed -i \"s|^${key}=.*|${key}=\$v|\" \"\$f\"; else echo \"${key}=\$v\" >> \"\$f\"; fi; chmod 600 \"\$f\""
  done
fi

echo "==> build + restart"
"${SSH[@]}" "cd '$REMOTE_DIR/infra/docker' && docker compose --profile build build && docker compose up -d --remove-orphans && docker compose ps"

echo "==> smoke test"
"${SSH[@]}" "curl -fsS http://localhost/api/v1/health && echo"
echo "Done. Open http://$VM_HOST (or your DECOYR_DOMAIN)."
