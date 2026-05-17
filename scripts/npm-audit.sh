#!/usr/bin/env bash
#
# Upload an npm audit report to a quality-dashboard server.
#
# The script reads the JSON output of `npm audit --json`, transforms it into
# the quality-dashboard metrics format, and uploads it using the built-in
# "json" processor.
#
# Usage:
#   npm audit --json | ./scripts/npm-audit.sh -key my-app \\
#       -server http://localhost:8080 -token s3cr3t
#
#   ./scripts/npm-audit.sh -key my-app \\
#       -file audit.json \\
#       -server http://localhost:8080 -token s3cr3t
#
# Required dependencies: curl, jq
#

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
KEY=""
SERVER="${QD_SERVER:-}"
TOKEN="${QD_TOKEN:-}"
FILE=""
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
    -display-name) DISPLAY_NAME="$2"; shift 2 ;;
    *)
      echo "ERROR: Unknown parameter: $1" >&2
      echo "" >&2
      echo "Valid parameters:" >&2
      echo "  -key          Report key (required)" >&2
      echo "  -server       Server base URL (required; fallback: \$QD_SERVER)" >&2
      echo "  -token        Upload token (required; fallback: \$QD_TOKEN)" >&2
      echo "  -file         Path to npm audit JSON file (default: stdin)" >&2
      echo "  -display-name Optional human-friendly display name" >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Validation
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

# Strip trailing slash from SERVER
SERVER="${SERVER%/}"

# ---------------------------------------------------------------------------
# Read npm audit JSON
# ---------------------------------------------------------------------------
AUDIT_JSON=""
if [[ -n "$FILE" ]]; then
  if [[ ! -f "$FILE" ]]; then
    echo "ERROR: File not found: $FILE" >&2
    exit 1
  fi
  AUDIT_JSON=$(cat "$FILE")
else
  AUDIT_JSON=$(cat)
fi

if [[ -z "$AUDIT_JSON" ]]; then
  echo "ERROR: No npm audit JSON provided (stdin is empty or file is empty)" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Transform into quality-dashboard metrics payload
# ---------------------------------------------------------------------------
META_JSON=$(echo "$AUDIT_JSON" | jq \
  --arg key "$KEY" \
  --arg displayName "${DISPLAY_NAME:-}" \
  '{
    key: $key,
    processor: "json",
    jsonPayload: {
      metrics: [
        { name: "npm-audit.critical", type: "count", value: (.metadata.vulnerabilities.critical // 0) },
        { name: "npm-audit.high",     type: "count", value: (.metadata.vulnerabilities.high // 0) },
        { name: "npm-audit.medium",   type: "count", value: (.metadata.vulnerabilities.medium // 0) },
        { name: "npm-audit.low",      type: "count", value: (.metadata.vulnerabilities.low // 0) }
      ],
      info: { source: "npm-audit" }
    }
  }
  + (if $displayName != "" then { displayName: $displayName } else {} end)
')

# ---------------------------------------------------------------------------
# Upload via multipart/form-data
# ---------------------------------------------------------------------------
echo "Uploading npm audit report '${KEY}' to ${SERVER}/reports/ ..."

HTTP_STATUS=$(curl -s -o /tmp/qd-upload-response.json -w "%{http_code}" \
  -X POST \
  -H "X-Upload-Token: ${TOKEN}" \
  -F "meta=${META_JSON}" \
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
