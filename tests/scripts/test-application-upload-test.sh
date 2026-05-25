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
# Server
# --------------------------------------------------
cd "${APP_DIR}/quality-dashboard-server"
npm run test
tar czf coverage.tar.gz coverage
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/server/unit-test-coverage","displayName":"Server Coverage","processor":"lcov-coverage"}' \
    -F file=@"./coverage.tar.gz" \
    ${UPLOAD_SERVER}/api/reports
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/server/unit-test","displayName":"Server Unit Tests","processor":"jest-html-reporter"}' \
    -F file=@"./test-report.html" \
    ${UPLOAD_SERVER}/api/reports
rm -f ./coverage.tar.gz


# --------------------------------------------------
# Integration tests
# --------------------------------------------------
cd "${APP_DIR}/tests/integration"
npm run test
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/integration/integration-test","displayName":"Integration Tests","processor":"jest-html-reporter"}' \
    -F file=@"./test-report.html" \
    ${UPLOAD_SERVER}/api/reports


# --------------------------------------------------
# Test Json Processor
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/integration/test-processors","displayName":"Test Processors","processor":"json","jsonPayload":{"metrics":[{"name":"success","type":"count","value":10},{"name":"error","type":"count","value":9},{"name":"warning","type":"count","value":8},{"name":"total","type":"count","value":27},{"name":"coverage","type":"percentage","value":80}]}}' \
    ${UPLOAD_SERVER}/api/reports

curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/integration/test-processors-2","displayName":"Test Processors 2","processor":"json","jsonPayload":{"metrics":[{"name":"success","type":"count","value":10},{"name":"error","type":"count","value":9},{"name":"warning","type":"count","value":8},{"name":"total","type":"count","value":27},{"name":"coverage","type":"percentage","value":80}]}}' \
    ${UPLOAD_SERVER}/api/reports

curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/integration/test-processors-3","displayName":"Test Processors 3","processor":"json","jsonPayload":{"metrics":[{"name":"success","type":"count","value":10},{"name":"error","type":"count","value":9},{"name":"warning","type":"count","value":8},{"name":"total","type":"count","value":27},{"name":"coverage","type":"percentage","value":80},{"name":"link","type":"count","value":1}]}}' \
    ${UPLOAD_SERVER}/api/reports
