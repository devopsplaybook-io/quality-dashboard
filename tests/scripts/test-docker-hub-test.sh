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


NB_SUCCESS=0
NB_ERROR=0


function testImageBuild(){
    STATUS=$(curl -s "https://hub.docker.com/api/audit/v1/build/?include_related=true&offset=0&limit=1&object=%2Fapi%2Frepo%2Fv1%2Frepository%2F${1}%2F" \
        | jq -r ".objects[0].state")
    if [ "${STATUS}" = "Success" ]; then
        NB_SUCCESS=$((${NB_SUCCESS}+1))
    else
        NB_SUCCESS=$((${NB_SUCCESS}+1))
    fi
}


testImageBuild didierhoarau%2Fquality-dashboard-ui
testImageBuild didierhoarau%2Fquality-dashboard-server

echo "Result: ${NB_SUCCESS}, ${NB_ERROR}"


curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/docker-hub","displayName":"Docker Hub Builds","processor":"json","jsonPayload":{"metrics":[{"name":"success","type":"count","value":'${NB_SUCCESS}'},{"name":"error","type":"count","value":'${NB_ERROR}'}]}}' \
    ${UPLOAD_SERVER}/api/reports
