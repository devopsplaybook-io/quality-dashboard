#!/bin/bash

echo "Testing Container Images"

UPLOAD_SERVER="http://localhost:8080/api"

rm -f /tmp/test-trivy-html.tpl
wget -O /tmp/test-trivy-html.tpl https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/html.tpl

for NAMESPACE in $(kubectl get namespace --no-headers | cut -d' ' -f1); do

    for POD in $(kubectl -n ${NAMESPACE} get pod --no-headers | cut -d' ' -f1); do

        CONTAINER_INDEX=0
        for CONTAINER in $(kubectl -n ${NAMESPACE} get pod ${POD} -o jsonpath='{.spec.containers[*].name}'); do
            
            CONTAINER_IMAGE=$(kubectl -n ${NAMESPACE} get pod ${POD} -o jsonpath='{.spec.containers['${CONTAINER_INDEX}'].image}')
            echo "---"
            echo "Scanning Pod: ${NAMESPACE} - ${POD} - ${CONTAINER} - ${CONTAINER_IMAGE}"
            CONTAINER_INDEX=$(expr $CONTAINER_INDEX + 1)

            rm -fr /tmp/test-trivy
            mkdir -p /tmp/test-trivy
            trivy image \
                -format template \
                --template "@/tmp/test-trivy-html.tpl" \
                -o /tmp/test-trivy/report.html \
                ${CONTAINER_IMAGE}

            curl -X POST \
                -F report=@"/tmp/test-trivy/report.html" \
                ${UPLOAD_SERVER}/reports/quality-dashboard/container-images/${NAMESPACE}/${POD}_${CONTAINER}/trivy-html

            rm -fr /tmp/test-trivy

        done
    done

done
