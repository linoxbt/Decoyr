# Deploying Decoyr on Vultr

Decoyr's control plane runs on a single **Vultr Cloud Compute** VM (Ubuntu 24.04 LTS,
4 vCPU / 8 GB recommended). Everything — API/orchestrator, Postgres, MCP city, egress proxy,
web UI, Caddy — runs in Docker on that VM; every candidate agent runs in its own hardened
container on a per-run internal network. All agent LLM calls go to **Vultr Serverless
Inference** from the control plane only.

## 1. Provision (from your machine)

```bash
export VULTR_API_KEY=...            # Vultr account API key (stays on your machine)
export ADMIN_CIDR=203.0.113.7/32    # who may SSH
export VULTR_SSH_KEY_ID=...         # optional, recommended (Vultr dashboard → SSH Keys)
export VULTR_REGION=ewr VULTR_PLAN=vc2-4c-8gb
export DECOYR_DOMAIN=decoyr.example.com   # optional; DNS A record → VM IP gives automatic HTTPS
./infra/vultr/provision.sh
```

`provision.sh` uses the Vultr API v2 to:

1. resolve the Ubuntu 24.04 x64 image,
2. create a **Firewall Group**: 80/443 open, 22 only from `ADMIN_CIDR`,
3. create the instance with `cloud-init.yaml` as user-data, and wait for its IP.

cloud-init installs Docker Engine + Compose, clones the repo to `/opt/decoyr`, generates the
internal signing key / Postgres password / admin token **on the VM**, builds all images
(including `decoyr/candidate-agent`) and starts the stack. No secret is placed in user-data.

## 2. Add the Vultr Serverless Inference key

Create `infra/docker/.env` locally (copy `.env.example`) with at least:

```
VULTR_SERVERLESS_INFERENCE_API_KEY=...
DECOYR_MODEL=<model id from GET https://api.vultrinference.com/v1/models>
```

then:

```bash
VM_HOST=<vm-ip> ./infra/vultr/deploy.sh
```

`deploy.sh` rsyncs the working tree (or `SYNC=git` to `git pull` on the VM), merges only the
inference/domain keys into the VM's `.env` (mode 600), rebuilds and restarts, then smoke-tests
`/api/v1/health`. Until a key is present the API runs a clearly-labelled *simulated* model.

## 3. Verify

```bash
curl http://<vm-ip>/api/v1/health
curl http://<vm-ip>/api/v1/system      # inference.mode should be "vultr"
ssh root@<vm-ip> 'cd /opt/decoyr && bash tests/containment/run.sh'
```

## Operational notes

* Log rotation: Docker `json-file` 10 MB × 3 (daemon + compose).
* Trial cleanup: the orchestrator destroys each run's container and network; a cron safety net
  (`/usr/local/bin/decoyr-cleanup`, every 15 min) removes exited `decoyr-run-*` containers and
  orphaned `decoyr-run-*` networks.
* Only the `api` container mounts the Docker socket. Candidate containers never do.
* Throwaway-VM-per-trial (Vultr API instances/snapshots) is a post-MVP high-isolation mode.
