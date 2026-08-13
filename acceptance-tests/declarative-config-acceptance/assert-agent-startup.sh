#!/usr/bin/env bash
#
# Asserts that the Java agent installs cleanly with the generated declarative config.
#
# When declarative config parsing fails, the agent aborts SDK autoconfiguration but the JVM
# keeps running, so the app starts up and serves traffic completely uninstrumented. The OATS
# assertions can only observe the resulting absence of telemetry, which is indistinguishable
# from a collector/exporter problem — so check the startup logs directly, before OATS runs.
#
# Boots only the `app` service from docker-compose.yml (no lgtm stack): exporting fails without
# it, which is fine and expected here, because this script only inspects agent bootstrap.
#
# Usage: ./assert-agent-startup.sh
set -uo pipefail

cd "$(dirname "$0")" || exit 1

READY_TIMEOUT_SECONDS=120
# The app logs this once Spring Boot is up. It appears whether or not the agent installed
# successfully, which is exactly what makes it a usable readiness marker here.
READY_MARKER="Started SpringbootApplication"
# Agent bootstrap failures. Deliberately narrow: the broad `[otel.javaagent ...] ERROR` prefix
# also covers export failures, which are expected while the lgtm stack is absent.
FAILURE_PATTERN="OpenTelemetry Javaagent failed to start|Unable to parse configuration|DeclarativeConfigException|ConfigurationException"

cleanup() {
  docker compose down --volumes --remove-orphans >/dev/null 2>&1
}
trap cleanup EXIT

if ! docker compose up --detach app; then
  echo "::error::Could not start the app service."
  exit 1
fi

echo "Waiting up to ${READY_TIMEOUT_SECONDS}s for the app to finish starting..."
ready=false
for _ in $(seq "$READY_TIMEOUT_SECONDS"); do
  logs=$(docker compose logs --no-color app 2>&1)
  if grep -qE "$FAILURE_PATTERN" <<<"$logs"; then
    break
  fi
  if grep -qF "$READY_MARKER" <<<"$logs"; then
    ready=true
    break
  fi
  # The agent can also fail hard enough to take the JVM down before either marker appears.
  if [ -z "$(docker compose ps --quiet --status running app)" ]; then
    break
  fi
  sleep 1
done

logs=$(docker compose logs --no-color app 2>&1)

if grep -qE "$FAILURE_PATTERN" <<<"$logs"; then
  echo "::error::The Java agent failed to start with the generated config. Startup logs:"
  echo "$logs"
  exit 1
fi

if [ "$ready" != true ]; then
  echo "::error::The app did not report '${READY_MARKER}' within ${READY_TIMEOUT_SECONDS}s. Startup logs:"
  echo "$logs"
  exit 1
fi

echo "The Java agent installed cleanly and the app started."
