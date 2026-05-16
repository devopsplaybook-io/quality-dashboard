#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/" && pwd )"
cd "${SCRIPT_DIR}"

if [ -f .env-dev.sh ]; then
    echo "Loading dev env file"
    . .env-dev.sh
fi

if [ "$UPLOAD_SERVER" = "" ]; then
    UPLOAD_SERVER="http://localhost:9999"
fi
echo "Report Server: ${UPLOAD_SERVER}"


# --------------------------------------------------
# Test Json Processor
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/integration/test","displayName":"Test","processor":"json","jsonPayload":{"metrics":[{"name":"success","type":"count","value":10},{"name":"error","type":"count","value":9},{"name":"warning","type":"count","value":8},{"name":"total","type":"count","value":27},{"name":"coverage","type":"percentage","value":80}]}}' \
    ${UPLOAD_SERVER}/api/reports
