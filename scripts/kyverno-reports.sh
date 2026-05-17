#!/usr/bin/env bash
#
# Upload Kyverno PolicyReport YAML to a quality-dashboard server.
#
# The script takes a YAML file produced by `kubectl get polr -o yaml` (or
# `kubectl get cpolr -o yaml`) and uploads it using the built-in "kyverno"
# processor. The processor parses the YAML and extracts pass/fail/warn/error
# counts from each report's summary section.
#
# Usage:
#   kubectl get polr -n default -o yaml > reports.yaml
#   ./scripts/kyverno-reports.sh -key kyverno/policyreports/ns/default \
#       -file reports.yaml \
#       -server http://localhost:8080 -token s3cr3t
#
#   # Or let the script fetch via kubectl:
#   ./scripts/kyverno-reports.sh -key kyverno/policyreports/ns/default \
#       -namespace default \
#       -server http://localhost:8080 -token s3cr3t
#
# Required dependencies: curl, jq, kubectl (only if -namespace / -cluster-wide)
#

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
KEY=""
SERVER="${QD_SERVER:-}"
TOKEN="${QD_TOKEN:-}"
FILE=""
NAMESPACE=""
CLUSTER_WIDE=false
DISPLAY_NAME=""

# ---------------------------------------------------------------------------
# Parse named arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    -key)         KEY="$2";         shift 2 ;;
    -server)      SERVER="$2";      shift 2 ;;
    -token)       TOKEN="$2";       shift 2 ;;
    -file)        FILE="$2";        shift 2 ;;
    -namespace)   NAMESPACE="$2";   shift 2 ;;
    -cluster-wide) CLUSTER_WIDE=true; shift ;;
    -display-name) DISPLAY_NAME="$2"; shift 2 ;;
    *)
      echo "ERROR: Unknown parameter: $1" >&2
      echo "" >&2
      echo "Valid parameters:" >&2
      echo "  -key          Report key (required)" >&2
      echo "  -server       Server base URL (required; fallback: \$QD_SERVER)" >&2
      echo "  -token        Upload token (required; fallback: \$QD_TOKEN)" >&2
      echo "  -file         Path to existing Kyverno PolicyReport YAML" >&2
      echo "  -namespace    Kubernetes namespace to fetch PolicyReports from" >&2
      echo "  -cluster-wide Fetch ClusterPolicyReports" >&2
      echo "  -display-name Optional human-friendly display name" >&2
      echo "" >&2
      echo "Either -file or -namespace/-cluster-wide is required." >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Validate inputs and collect report data
# ---------------------------------------------------------------------------
if [[ -z "$KEY" ]]; then
  echo "ERROR: -key is required" >&2
  exit 1
fi

if [[ -z "$SERVER" ]]; then
  echo "ERROR: -server (or QD_SERVER env var) is required" >&2
  exit 1
fi

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: -token (or QD_TOKEN env var) is required" >&2
  exit 1
fi

if [[ -n "$FILE" && ( -n "$NAMESPACE" || "$CLUSTER_WIDE" == true ) ]]; then
  echo "ERROR: Use either -file or -namespace / -cluster-wide, not both" >&2
  exit 1
fi

if [[ -z "$FILE" && -z "$NAMESPACE" && "$CLUSTER_WIDE" != true ]]; then
  echo "ERROR: Either -file or -namespace / -cluster-wide is required" >&2
  exit 1
fi

# Strip trailing slash from SERVER
SERVER="${SERVER%/}"

# ---------------------------------------------------------------------------
# Fetch reports via kubectl if requested
# ---------------------------------------------------------------------------
if [[ -n "$NAMESPACE" || "$CLUSTER_WIDE" == true ]]; then
  if ! command -v kubectl &>/dev/null; then
    echo "ERROR: kubectl not found -- required for -namespace / -cluster-wide" >&2
    exit 1
  fi

  WORK_DIR=$(mktemp -d "/tmp/kyverno-reports.XXXXXX")
  trap 'rm -rf "$WORK_DIR"' EXIT

  if [[ "$CLUSTER_WIDE" == true ]]; then
    FILE="${WORK_DIR}/cpolr.yaml"
    echo "Fetching ClusterPolicyReports via kubectl..."
    kubectl get cpolr -o yaml > "$FILE"
  else
    FILE="${WORK_DIR}/polr-${NAMESPACE}.yaml"
    echo "Fetching PolicyReports from namespace '${NAMESPACE}' via kubectl..."
    kubectl get polr -n "$NAMESPACE" -o yaml > "$FILE"
  fi
fi

# ---------------------------------------------------------------------------
# Build meta JSON
# ---------------------------------------------------------------------------
if [[ -n "$DISPLAY_NAME" ]]; then
  META_JSON=$(jq -n \
    --arg key "$KEY" \
    --arg displayName "$DISPLAY_NAME" \
    '{ key: $key, processor: "kyverno", displayName: $displayName }')
else
  META_JSON=$(jq -n \
    --arg key "$KEY" \
    '{ key: $key, processor: "kyverno" }')
fi

# ---------------------------------------------------------------------------
# Upload via multipart/form-data (meta + file)
# ---------------------------------------------------------------------------
echo "Uploading Kyverno PolicyReport '${KEY}' to ${SERVER}/reports/ ..."

HTTP_STATUS=$(curl -s -o /tmp/qd-upload-response.json -w "%{http_code}" \
  -X POST \
  -H "X-Upload-Token: ${TOKEN}" \
  -F "meta=${META_JSON}" \
  -F "file=@${FILE};type=text/yaml" \
  "${SERVER}/reports/")

if [[ "$HTTP_STATUS" == "201" ]]; then
  echo "SUCCESS: Report uploaded (HTTP ${HTTP_STATUS})"
  cat /tmp/qd-upload-response.json
  echo ""
else
  echo "ERROR: Upload failed (HTTP ${HTTP_STATUS})" >&2
  cat /tmp/qd-upload-response.json >&2
  echo "" >&2
  exit 1
fi
