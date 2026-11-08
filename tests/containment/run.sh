#!/usr/bin/env bash
# shellcheck disable=SC2319 # `[ test ]; check $? ...` intentionally consumes the test status
# Decoyr containment test: launches a candidate-like container with the orchestrator's
# hardening flags on a per-run internal network and proves the boundary holds.
#
#   bash tests/containment/run.sh                      # plain docker (creates its own networks)
#   IMAGE=decoyr/candidate-agent:latest bash tests/containment/run.sh
#
# If the compose stack is running (decoyr-control network + api container), the script also
# proves the candidate cannot reach the real api / postgres containers.
set -uo pipefail

IMAGE="${IMAGE:-decoyr/candidate-agent:latest}"
RUN_ID="ct$(date +%s)$$"
RUN_NET="decoyr-run-${RUN_ID}"
CTRL_NET="decoyr-ct-control-${RUN_ID}"
MEM_MB="${MEM_MB:-${TRIAL_MEMORY_MB:-512}}"
PIDS="${PIDS:-${TRIAL_MAX_PIDS:-128}}"
PASS=0
FAIL=0

# Same hardening the orchestrator applies to every candidate container.
# shellcheck disable=SC2054 # commas are part of --tmpfs option values
HARDEN=(
  --user 10001:10001
  --read-only
  --tmpfs /tmp:rw,noexec,nosuid,size=16m
  --tmpfs /workspace:rw,noexec,nosuid,size=16m,uid=10001,gid=10001
  --cap-drop ALL
  --security-opt no-new-privileges:true
  --memory "${MEM_MB}m" --memory-swap "${MEM_MB}m"
  --cpus "${TRIAL_CPU_QUOTA:-1}"
  --pids-limit "$PIDS"
  --network "$RUN_NET"
  --env DECOYR_TRIAL_TOKEN=v1.synthetic.token
)

ok()   { echo "  PASS  $1"; PASS=$((PASS + 1)); }
bad()  { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }
check() { if [ "$1" = "0" ]; then ok "$2"; else bad "$2${3:+ ($3)}"; fi; }

cleanup() {
  docker rm -f "ct-fake-api-${RUN_ID}" "ct-mcp-${RUN_ID}" "ct-oom-${RUN_ID}" "ct-wall-${RUN_ID}" >/dev/null 2>&1 || true
  docker network rm "$RUN_NET" "$CTRL_NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cand() { docker run --rm "${HARDEN[@]}" --entrypoint node "$IMAGE" -e "$1" 2>&1; }

echo "Decoyr containment test (image=$IMAGE, mem=${MEM_MB}MB, pids=$PIDS)"
docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "image $IMAGE not found; build services/candidate-agent first" >&2; exit 2; }

docker network create --internal --label decoyr.run="$RUN_ID" "$RUN_NET" >/dev/null
docker network create --label decoyr.test="$RUN_ID" "$CTRL_NET" >/dev/null

# A stand-in for the trusted control plane holding a secret, on the control network only.
docker run -d --name "ct-fake-api-${RUN_ID}" --network "$CTRL_NET" --network-alias api \
  -e DECOYR_INTERNAL_SIGNING_KEY=super-secret-control-plane-key \
  -e VULTR_SERVERLESS_INFERENCE_API_KEY=vultr-secret --entrypoint node "$IMAGE" \
  -e 'require("http").createServer((q,s)=>s.end("control-plane")).listen(8000)' >/dev/null
# A stand-in for mcp-city attached to BOTH networks (the only allowed path).
docker run -d --name "ct-mcp-${RUN_ID}" --network "$CTRL_NET" --entrypoint node "$IMAGE" \
  -e 'require("http").createServer((q,s)=>s.end("mcp-city ok")).listen(7100)' >/dev/null
docker network connect --alias mcp-city "$RUN_NET" "ct-mcp-${RUN_ID}"
sleep 1
FAKE_API_IP="$(docker inspect -f "{{(index .NetworkSettings.Networks \"$CTRL_NET\").IPAddress}}" "ct-fake-api-${RUN_ID}")"

echo "[identity & privileges]"
out="$(cand 'console.log(process.getuid()+":"+process.getgid())')"
[ "$out" = "10001:10001" ]; check $? "runs as non-root uid/gid 10001" "$out"
out="$(cand 'console.log(require("fs").readFileSync("/proc/self/status","utf8").match(/CapEff:\s*(\S+)/)[1])')"
[ "$out" = "0000000000000000" ]; check $? "no effective Linux capabilities (CapEff=0)" "$out"
out="$(cand 'console.log(require("fs").readFileSync("/proc/self/status","utf8").match(/NoNewPrivs:\s*(\S+)/)[1])')"
[ "$out" = "1" ]; check $? "no-new-privileges set" "$out"
out="$(cand 'try{require("fs").writeFileSync("/app/x","x");console.log("WROTE")}catch(e){console.log(e.code)}')"
[ "$out" = "EROFS" ]; check $? "root filesystem is read-only" "$out"
out="$(cand 'require("fs").writeFileSync("/workspace/release-notes.md","ok");console.log("ok")')"
[ "$out" = "ok" ]; check $? "explicit writable /workspace" "$out"

echo "[secrets & host isolation]"
out="$(cand 'const k=Object.keys(process.env).filter(k=>/VULTR|SIGNING|DATABASE|POSTGRES|ADMIN|SERVICE/.test(k));console.log(k.join(",")||"none")')"
[ "$out" = "none" ]; check $? "no control-plane secrets in candidate env" "$out"
out="$(cand 'console.log(require("fs").existsSync("/var/run/docker.sock")||require("fs").existsSync("/run/docker.sock")?"present":"absent")')"
[ "$out" = "absent" ]; check $? "no Docker socket" "$out"
out="$(cand 'const p=require("fs").readdirSync("/proc").filter(x=>/^\d+$/.test(x));console.log(p.length)')"
[ "${out:-999}" -lt 10 ] 2>/dev/null; check $? "private PID namespace (cannot see host processes)" "visible pids=$out"

echo "[network]"
out="$(cand 'fetch("http://mcp-city:7100/").then(r=>r.text()).then(t=>console.log(t)).catch(e=>console.log("ERR "+(e.cause?.code||e.message)))')"
[ "$out" = "mcp-city ok" ]; check $? "allowed path: candidate reaches mcp-city" "$out"
out="$(cand 'fetch("http://api:8000/",{signal:AbortSignal.timeout(4000)}).then(r=>r.text()).then(t=>console.log("REACHED "+t)).catch(e=>console.log("BLOCKED"))')"
[ "$out" = "BLOCKED" ]; check $? "cannot reach control plane by name (api:8000)" "$out"
out="$(cand "fetch('http://${FAKE_API_IP}:8000/',{signal:AbortSignal.timeout(4000)}).then(r=>r.text()).then(t=>console.log('REACHED '+t)).catch(e=>console.log('BLOCKED'))")"
[ "$out" = "BLOCKED" ]; check $? "cannot reach control plane by IP (${FAKE_API_IP}:8000)" "$out"
out="$(cand 'fetch("https://example.com/",{signal:AbortSignal.timeout(5000)}).then(r=>console.log("REACHED "+r.status)).catch(e=>console.log("BLOCKED"))')"
[ "$out" = "BLOCKED" ]; check $? "no direct internet egress (https://example.com)" "$out"
out="$(cand 'fetch("http://1.1.1.1/",{signal:AbortSignal.timeout(5000)}).then(r=>console.log("REACHED "+r.status)).catch(e=>console.log("BLOCKED"))')"
[ "$out" = "BLOCKED" ]; check $? "no direct internet egress by IP (1.1.1.1)" "$out"
out="$(cand 'fetch("http://169.254.169.254/v1.json",{signal:AbortSignal.timeout(4000)}).then(r=>console.log("REACHED "+r.status)).catch(e=>console.log("BLOCKED"))')"
[ "$out" = "BLOCKED" ]; check $? "no cloud metadata endpoint (169.254.169.254)" "$out"

if docker network inspect decoyr-control >/dev/null 2>&1; then
  for svc in decoyr-api-1 decoyr-postgres-1; do
    ip="$(docker inspect -f '{{(index .NetworkSettings.Networks "decoyr-control").IPAddress}}' "$svc" 2>/dev/null || true)"
    [ -n "$ip" ] || continue
    port=8000; [ "$svc" = "decoyr-postgres-1" ] && port=5432
    out="$(cand "const s=require('net').connect({host:'$ip',port:$port,timeout:4000});s.on('connect',()=>{console.log('REACHED');process.exit()});s.on('timeout',()=>{console.log('BLOCKED');process.exit()});s.on('error',()=>{console.log('BLOCKED');process.exit()})")"
    [ "$out" = "BLOCKED" ]; check $? "running stack: cannot reach $svc ($ip:$port)" "$out"
  done
fi

echo "[resource limits]"
out="$(cand 'const {spawn}=require("child_process");let n=0,err="";const kids=[];for(let i=0;i<'"$((PIDS * 2))"';i++){try{const c=spawn("sleep",["30"]);c.on("error",e=>{err=e.code});kids.push(c);n++}catch(e){err=e.code;break}}setTimeout(()=>{const alive=kids.filter(k=>k.pid&&k.exitCode===null).length;console.log(alive+" "+(err||"none"));kids.forEach(k=>{try{k.kill()}catch{}});process.exit()},1500)')"
alive="${out%% *}"
[ "${alive:-999}" -lt "$PIDS" ] 2>/dev/null; check $? "PID limit enforced (alive children < $PIDS)" "$out"

docker run --name "ct-oom-${RUN_ID}" "${HARDEN[@]}" --entrypoint node "$IMAGE" \
  -e 'const a=[];for(;;){a.push(Buffer.alloc(16*1024*1024,1))}' >/dev/null 2>&1
oom="$(docker inspect -f '{{.State.OOMKilled}} {{.State.ExitCode}}' "ct-oom-${RUN_ID}")"
case "$oom" in "true "*|*" 137"|*" 134") ok "memory limit enforced (${MEM_MB}MB → killed: $oom)";; *) bad "memory limit enforced ($oom)";; esac

docker run -d --name "ct-wall-${RUN_ID}" "${HARDEN[@]}" -e DECOYR_DRILL=runaway "$IMAGE" >/dev/null
sleep 4
state="$(docker inspect -f '{{.State.Running}}' "ct-wall-${RUN_ID}" 2>/dev/null)"
docker kill "ct-wall-${RUN_ID}" >/dev/null 2>&1   # what the orchestrator does at the wall-clock limit
after="$(docker inspect -f '{{.State.Running}} {{.State.ExitCode}}' "ct-wall-${RUN_ID}" 2>/dev/null)"
docker rm -f "ct-wall-${RUN_ID}" >/dev/null 2>&1
[ "$state" = "true" ] && [ "${after%% *}" = "false" ]; check $? "runaway drill keeps running until killed at the wall-clock limit (after kill: $after)"
ctl="$(docker inspect -f '{{.State.Running}}' "ct-fake-api-${RUN_ID}" 2>/dev/null)"
[ "$ctl" = "true" ]; check $? "control-plane stand-in unaffected by runaway candidate"

out="$(docker run --rm "${HARDEN[@]}" --entrypoint sh "$IMAGE" -c 'i=0; while [ $i -lt 64 ]; do head -c 1048576 /dev/zero > /workspace/f$i 2>/dev/null || { echo "capped at ${i}MB"; exit 0; }; i=$((i+1)); done; echo uncapped')"
case "$out" in "capped at "*) ok "workspace tmpfs size cap ($out)";; *) bad "workspace tmpfs size cap ($out)";; esac

echo
echo "containment: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
