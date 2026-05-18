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
# Kyverno PolicyReport (single upload with List wrapper)
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"kyverno/quality-dashboard/test","displayName":"Kyverno PolicyReports - Test","processor":"kyverno"}' \
    -F file=@"samples/polr-quality-dashboard.yaml" \
    ${UPLOAD_SERVER}/api/reports

echo ""
