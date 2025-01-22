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
# Test Json Processor with Query
# --------------------------------------------------

cd "${APP_DIR}/test/scripts"

curl -X POST \
    -F report=@"./report.html" \
    ${UPLOAD_SERVER}/api/reports/quality-dashboard/integration/master/test-processors-query/json?data_json=%7B\"success\"%3A10,\"error\"%3A9,\"warning\"%3A8,\"total\"%3A27,\"coverage\"%3A80%7D

curl -X POST \
    ${UPLOAD_SERVER}/api/reports/quality-dashboard/integration/master/test-processors-query-nofile/json?data_json=%7B\"success\"%3A10,\"error\"%3A9,\"warning\"%3A8,\"total\"%3A27,\"coverage\"%3A80%7D
