#!/usr/bin/env bash
#
# Upload a Trivy scan report to a quality-dashboard server.
#
# The script takes a Trivy HTML report and uploads it using the built-in
# "trivy-html" processor. The processor analyses the HTML and extracts
# vulnerability counts by severity (critical, high, medium, low).
#
# Usage:
#   trivy image --format html -o report.html my-image
#   ./scripts/trivy-scan.sh -key my-image \\
#       -file report.html \\
#       -server http://localhost:8080 -token s3cr3t
#
# Required dependencies: curl
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
      echo "  -file         Path to Trivy HTML report (required)" >&2
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

if [[ -z "$FILE" ]]; then
  echo "ERROR: -file is required" >&2
  exit 1
fi

if [[ ! -f "$FILE" ]]; then
  echo "ERROR: File not found: $FILE" >&2
  exit 1
fi

# Strip trailing slash from SERVER
SERVER="${SERVER%/}"

# ---------------------------------------------------------------------------
# Build meta JSON
# ---------------------------------------------------------------------------
if [[ -n "$DISPLAY_NAME" ]]; then
  META_JSON=$(jq -n \
    --arg key "$KEY" \
    --arg displayName "$DISPLAY_NAME" \
    '{ key: $key, processor: "trivy-html", displayName: $displayName }')
else
  META_JSON=$(jq -n \
    --arg key "$KEY" \
    '{ key: $key, processor: "trivy-html" }')
fi

# ---------------------------------------------------------------------------
# Upload via multipart/form-data (meta + file)
# ---------------------------------------------------------------------------
echo "Uploading Trivy scan report '${KEY}' to ${SERVER}/reports/ ..."

HTTP_STATUS=$(curl -s -o /tmp/qd-upload-response.json -w "%{http_code}" \
  -X POST \
  -H "X-Upload-Token: ${TOKEN}" \
  -F "meta=${META_JSON}" \
  -F "file=@${FILE}" \
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
