#!/usr/bin/env bash
# Provision the Decoyr control-plane VM on Vultr Cloud Compute (API v2).
#
# Required env:
#   VULTR_API_KEY      Vultr account API key (used only on your machine; never sent to the VM)
# Optional env:
#   ADMIN_CIDR         CIDR allowed to SSH, e.g. 203.0.113.7/32 (omit: port 22 stays closed)
#   VULTR_SERVERLESS_INFERENCE_API_KEY  passed to the VM in a 0600 bootstrap file (see cloud-init.yaml)
#   DECOYR_MODEL       live model id (e.g. glm-5.3-flash)
#   DECOYR_OPS_TOKEN   secret path for the /_ops/<token>/ status page (default: random)
#   VULTR_REGION       default: ewr
#   VULTR_PLAN         default: vc2-4c-8gb   (4 vCPU / 8 GB)
#   VULTR_SSH_KEY_ID   id of an SSH key already uploaded to Vultr (recommended)
#   REPO_URL           default: https://github.com/linoxbt/Decoyr.git
#   REPO_REF           default: main
#   DECOYR_DOMAIN      default: auto (HTTPS on <ip>.sslip.io); or a DNS name, or :80 for plain HTTP
#   LABEL              default: decoyr-control-plane
set -euo pipefail

API="https://api.vultr.com/v2"
: "${VULTR_API_KEY:?VULTR_API_KEY is required}"
REGION="${VULTR_REGION:-ewr}"
PLAN="${VULTR_PLAN:-vc2-4c-8gb}"
REPO_URL="${REPO_URL:-https://github.com/linoxbt/Decoyr.git}"
REPO_REF="${REPO_REF:-main}"
DOMAIN="${DECOYR_DOMAIN:-auto}"
LABEL="${LABEL:-decoyr-control-plane}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

vultr() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -fsS -X "$method" "$API$path" -H "Authorization: Bearer $VULTR_API_KEY" -H "Content-Type: application/json" --data "$body"
  else
    curl -fsS -X "$method" "$API$path" -H "Authorization: Bearer $VULTR_API_KEY"
  fi
}

echo "==> Resolving Ubuntu 24.04 LTS image id"
OS_ID="$(vultr GET "/os?per_page=500" | jq -r '[.os[] | select(.name | test("Ubuntu 24.04"; "i")) | select(.arch == "x64")][0].id')"
[ -n "$OS_ID" ] && [ "$OS_ID" != "null" ] || { echo "could not find Ubuntu 24.04 image" >&2; exit 1; }
echo "    os_id=$OS_ID"

echo "==> Creating firewall group"
FW_ID="$(vultr POST /firewalls "$(jq -nc --arg d "$LABEL" '{description:$d}')" | jq -r '.firewall_group.id')"
echo "    firewall_group=$FW_ID"
add_rule() {
  local subnet="$1" size="$2" port="$3" notes="$4"
  vultr POST "/firewalls/$FW_ID/rules" "$(jq -nc --arg s "$subnet" --argjson z "$size" --arg p "$port" --arg n "$notes" \
    '{ip_type:"v4", protocol:"tcp", subnet:$s, subnet_size:$z, port:$p, notes:$n}')" >/dev/null
}
add_rule 0.0.0.0 0 80 "http"
add_rule 0.0.0.0 0 443 "https"
if [ -n "${ADMIN_CIDR:-}" ]; then
  add_rule "${ADMIN_CIDR%/*}" "${ADMIN_CIDR#*/}" 22 "ssh-admin"
  echo "    rules: 80/443 public, 22 from $ADMIN_CIDR"
else
  echo "    rules: 80/443 public, 22 closed (no ADMIN_CIDR)"
fi

echo "==> Rendering cloud-init"
OPS_TOKEN="${DECOYR_OPS_TOKEN:-$(openssl rand -hex 16)}"
BOOTSTRAP_B64="$(printf 'VULTR_SERVERLESS_INFERENCE_API_KEY=%s\nDECOYR_MODEL=%s\nDECOYR_OPS_TOKEN=%s\n' \
  "${VULTR_SERVERLESS_INFERENCE_API_KEY:-}" "${DECOYR_MODEL:-}" "$OPS_TOKEN" | base64 | tr -d '\n')"
USER_DATA="$(sed -e "s|__REPO_URL__|$REPO_URL|g" -e "s|__REPO_REF__|$REPO_REF|g" -e "s|__DECOYR_DOMAIN__|$DOMAIN|g" \
  -e "s|__BOOTSTRAP_B64__|$BOOTSTRAP_B64|g" "$HERE/cloud-init.yaml" | base64 | tr -d '\n')"

echo "==> Creating instance ($PLAN in $REGION)"
BODY="$(jq -nc \
  --arg region "$REGION" --arg plan "$PLAN" --argjson os "$OS_ID" --arg label "$LABEL" \
  --arg fw "$FW_ID" --arg ud "$USER_DATA" --arg key "${VULTR_SSH_KEY_ID:-}" \
  '{region:$region, plan:$plan, os_id:$os, label:$label, hostname:$label, firewall_group_id:$fw,
    user_data:$ud, backups:"disabled", enable_ipv6:false, tags:["decoyr"]}
   + (if $key != "" then {sshkey_id:[$key]} else {} end)')"
INSTANCE_ID="$(vultr POST /instances "$BODY" | jq -r '.instance.id')"
echo "    instance=$INSTANCE_ID"

echo "==> Waiting for instance to become active"
IP="0.0.0.0"
for _ in $(seq 1 90); do
  INFO="$(vultr GET "/instances/$INSTANCE_ID")"
  STATUS="$(jq -r '.instance.status' <<<"$INFO")"
  IP="$(jq -r '.instance.main_ip' <<<"$INFO")"
  if [ "$STATUS" = "active" ] && [ "$IP" != "0.0.0.0" ]; then break; fi
  sleep 10
done
echo "    status=$STATUS ip=$IP"

cat <<MSG

Decoyr VM provisioned.
  instance id : $INSTANCE_ID
  public IP   : $IP
  firewall    : $FW_ID

cloud-init installs Docker, clones $REPO_URL ($REPO_REF) into /opt/decoyr and starts the stack
(~5-10 min). Progress and logs (no SSH needed):
  http://$IP/_ops/$OPS_TOKEN/
The VM pulls $REPO_REF every 2 minutes and redeploys when it changes.
App:  http://$IP/
MSG
