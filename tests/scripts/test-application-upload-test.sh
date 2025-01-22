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
   -F report=@"./coverage.tar.gz" \
   ${UPLOAD_SERVER}/api/reports/quality-dashboard/server/master/unit-test-coverage/lcov-coverage
curl -X POST \
    -F report=@"./test-report.html" \
    ${UPLOAD_SERVER}/api/reports/quality-dashboard/server/master/unit-test/jest-html-reporter
rm -f ./coverage.tar.gz


# --------------------------------------------------
# Integration tests
# --------------------------------------------------
cd "${APP_DIR}/test/integration"
npm run test
curl -X POST \
    -F report=@"./test-report.html" \
    ${UPLOAD_SERVER}/api/reports/quality-dashboard/integration/master/integration-test/jest-html-reporter


# --------------------------------------------------
# Test Json Processor
# --------------------------------------------------
curl -X POST \
    -d '{"link":"https://github.com/DidierHoarau/quality-dashboard", "success": 10, "error": 9, "warning": 8, "total": 27, "coverage": 80 }' \
    -H "Content-Type: application/json" \
    ${UPLOAD_SERVER}/api/reports/quality-dashboard/integration/master/test-processors/json

curl -X POST \
    -d '{"success": 10, "error": 9, "warning": 8, "total": 27, "coverage": 80 }' \
    -H "Content-Type: application/json" \
    ${UPLOAD_SERVER}/api/reports/quality-dashboard/integration/master/test-processors-2/json

curl -X POST \
    -d '{"link":"./TEST/", "success": 10, "error": 9, "warning": 8, "total": 27, "coverage": 80 }' \
    -H "Content-Type: application/json" \
    ${UPLOAD_SERVER}/api/reports/quality-dashboard/integration/master/test-processors-3/json
