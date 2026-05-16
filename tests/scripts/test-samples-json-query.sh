#!/bin/bash

APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." && pwd )"
cd "${APP_DIR}"

if [ -f .env-dev.sh ]; then
    echo "Loading dev env file"
    . .env-dev.sh
fi

if [ "$UPLOAD_SERVER" = "" ]; then
    UPLOAD_SERVER="http://localhost"
fi
echo "Report Server: ${UPLOAD_SERVER}"

# --------------------------------------------------
# Test Json Processor with Query (deprecated — jsonPayload goes in meta)
# --------------------------------------------------
# The new API no longer supports query-string jsonPayload. Use the meta field instead.
# Example:
# curl -X POST \
#     -H "X-Upload-Token: $UPLOAD_TOKEN" \
#     -F 'meta={"key":"quality-dashboard/integration/test-processors-query","displayName":"Test Processors Query","processor":"json","jsonPayload":{"success":10,"error":9,"warning":8,"total":27,"coverage":80}};type=application/json' \
#     ${UPLOAD_SERVER}/api/reports

cd "${APP_DIR}/tests/scripts"

# Upload a report with file + jsonPayload in meta
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/integration/test-processors-query","displayName":"Test Processors Query","processor":"json","jsonPayload":{"metrics":[{"name":"success","type":"count","value":10},{"name":"error","type":"count","value":9},{"name":"warning","type":"count","value":8},{"name":"total","type":"count","value":27},{"name":"coverage","type":"percentage","value":80}]}}' \
    -F file=@"./report.html" \
    ${UPLOAD_SERVER}/api/reports

# Upload JSON-only (no file)
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/integration/test-processors-query-nofile","displayName":"Test Processors Query No File","processor":"json","jsonPayload":{"metrics":[{"name":"success","type":"count","value":10},{"name":"error","type":"count","value":9},{"name":"warning","type":"count","value":8},{"name":"total","type":"count","value":27},{"name":"coverage","type":"percentage","value":80}]}}' \
    ${UPLOAD_SERVER}/api/reports
