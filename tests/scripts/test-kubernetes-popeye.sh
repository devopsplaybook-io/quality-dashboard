#!/bin/bash

echo "Testing Container Images"

UPLOAD_SERVER="http://localhost:8080"

rm -f /tmp/test-popeye
mkdir -p /tmp/test-popeye
cd /tmp/test-popeye
wget https://github.com/derailed/popeye/releases/download/v0.10.0/popeye_Linux_x86_64.tar.gz
tar zxf popeye*.tar.gz

POPEYE_REPORT_DIR=$(pwd) ./popeye --save --out html --output-file report.html

curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/kubernetes/popeye","displayName":"Kubernetes Popeye","processor":"popeye-html"}' \
    -F report=@"./report.html" \
    ${UPLOAD_SERVER}/api/reports

rm -fr /tmp/test-popeye
