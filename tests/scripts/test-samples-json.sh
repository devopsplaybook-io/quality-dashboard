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
# Test 1: Integration Test Baseline
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/integration/test","displayName":"Integration Test","processor":"json","jsonPayload":{"metrics":[{"name":"success","type":"count","value":10},{"name":"error","type":"count","value":9},{"name":"warning","type":"count","value":8},{"name":"total","type":"count","value":27},{"name":"coverage","type":"percentage","value":80}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 2: ESLint Static Analysis
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/lint/eslint","displayName":"ESLint Analysis","processor":"json","jsonPayload":{"metrics":[{"name":"errors","type":"count","value":3},{"name":"warnings","type":"count","value":15},{"name":"files_scanned","type":"count","value":142},{"name":"fixable","type":"count","value":8}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 3: Unit Test Results
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/tests/unit","displayName":"Unit Tests","processor":"json","jsonPayload":{"metrics":[{"name":"passed","type":"count","value":487},{"name":"failed","type":"count","value":2},{"name":"skipped","type":"count","value":5},{"name":"duration_seconds","type":"duration","value":34},{"name":"pass_rate","type":"percentage","value":98.6}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 4: End-to-End Test Suite
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/tests/e2e","displayName":"E2E Test Suite","processor":"json","jsonPayload":{"metrics":[{"name":"passed","type":"count","value":56},{"name":"failed","type":"count","value":1},{"name":"flaky","type":"count","value":3},{"name":"duration_seconds","type":"duration","value":312},{"name":"pass_rate","type":"percentage","value":96.7}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 5: Code Coverage Report
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/coverage/lines","displayName":"Code Coverage","processor":"json","jsonPayload":{"metrics":[{"name":"lines","type":"percentage","value":82.4},{"name":"branches","type":"percentage","value":76.1},{"name":"functions","type":"percentage","value":88.9},{"name":"statements","type":"percentage","value":81.7},{"name":"uncovered_lines","type":"count","value":1240}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 6: Bundle Size Analysis
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/build/bundle","displayName":"Bundle Size","processor":"json","jsonPayload":{"metrics":[{"name":"js_size_kb","type":"bytes","value":284},{"name":"css_size_kb","type":"bytes","value":42},{"name":"total_assets","type":"count","value":37},{"name":"gzip_ratio","type":"percentage","value":72},{"name":"initial_load_kb","type":"bytes","value":168}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 7: Build Performance
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/build/performance","displayName":"Build Performance","processor":"json","jsonPayload":{"metrics":[{"name":"build_time_seconds","type":"duration","value":127},{"name":"cache_hits","type":"count","value":43},{"name":"cache_misses","type":"count","value":12},{"name":"cache_hit_rate","type":"percentage","value":78.2}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 8: Dependency Audit
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/dependencies/audit","displayName":"Dependency Audit","processor":"json","jsonPayload":{"metrics":[{"name":"total_dependencies","type":"count","value":834},{"name":"critical_vulnerabilities","type":"count","value":0},{"name":"high_vulnerabilities","type":"count","value":2},{"name":"moderate_vulnerabilities","type":"count","value":7},{"name":"outdated_packages","type":"count","value":23},{"name":"direct_deps","type":"count","value":42}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 9: Security Scan (Trivy)
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/security/trivy","displayName":"Trivy Security Scan","processor":"json","jsonPayload":{"metrics":[{"name":"critical","type":"count","value":0},{"name":"high","type":"count","value":1},{"name":"medium","type":"count","value":14},{"name":"low","type":"count","value":36},{"name":"scanned_layers","type":"count","value":52}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 10: API Response Times (p99)
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/api/latency","displayName":"API Latency","processor":"json","jsonPayload":{"metrics":[{"name":"p50_ms","type":"duration","value":45},{"name":"p95_ms","type":"duration","value":210},{"name":"p99_ms","type":"duration","value":580},{"name":"requests_per_minute","type":"count","value":1420},{"name":"error_rate","type":"percentage","value":0.3}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 11: Database Query Performance
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/database/queries","displayName":"Database Performance","processor":"json","jsonPayload":{"metrics":[{"name":"avg_query_ms","type":"duration","value":12},{"name":"slow_queries_gt_1s","type":"count","value":3},{"name":"active_connections","type":"count","value":8},{"name":"pool_utilization","type":"percentage","value":44},{"name":"deadlocks","type":"count","value":0}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 12: Container Image Scan
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/container/scan","displayName":"Container Image","processor":"json","jsonPayload":{"metrics":[{"name":"image_size_mb","type":"bytes","value":187},{"name":"startup_time_seconds","type":"duration","value":2.4},{"name":"layers","type":"count","value":14},{"name":"base_image_age_days","type":"duration","value":45}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 13: Accessibility Audit
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/a11y/audit","displayName":"Accessibility Audit","processor":"json","jsonPayload":{"metrics":[{"name":"score","type":"percentage","value":89},{"name":"violations_critical","type":"count","value":0},{"name":"violations_serious","type":"count","value":3},{"name":"violations_moderate","type":"count","value":8},{"name":"elements_checked","type":"count","value":312}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 14: Lighthouse Performance
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/lighthouse/performance","displayName":"Lighthouse Report","processor":"json","jsonPayload":{"metrics":[{"name":"performance","type":"percentage","value":72},{"name":"accessibility","type":"percentage","value":89},{"name":"best_practices","type":"percentage","value":95},{"name":"seo","type":"percentage","value":91},{"name":"largest_contentful_paint_ms","type":"duration","value":2500}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 15: Kubernetes Cluster Health
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/kubernetes/health","displayName":"K8s Cluster Health","processor":"json","jsonPayload":{"metrics":[{"name":"nodes_ready","type":"count","value":5},{"name":"nodes_not_ready","type":"count","value":0},{"name":"pods_running","type":"count","value":47},{"name":"pods_pending","type":"count","value":1},{"name":"pods_crashlooping","type":"count","value":0},{"name":"cpu_utilization","type":"percentage","value":62}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 16: SSL Certificate Expiry
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/ssl/expiry","displayName":"SSL Certificate Check","processor":"json","jsonPayload":{"metrics":[{"name":"certificates_checked","type":"count","value":6},{"name":"expiring_within_30d","type":"count","value":1},{"name":"expiring_within_7d","type":"count","value":0},{"name":"expired","type":"count","value":0},{"name":"oldest_expiry_days","type":"duration","value":23}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 17: Git Branch Hygiene
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/git/hygiene","displayName":"Git Branch Hygiene","processor":"json","jsonPayload":{"metrics":[{"name":"total_branches","type":"count","value":28},{"name":"stale_branches_gt_90d","type":"count","value":6},{"name":"merged_branches_not_deleted","type":"count","value":4},{"name":"open_pull_requests","type":"count","value":5},{"name":"avg_branch_age_days","type":"duration","value":47}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 18: TypeScript Strictness
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/typescript/strictness","displayName":"TypeScript Strictness","processor":"json","jsonPayload":{"metrics":[{"name":"total_files","type":"count","value":186},{"name":"any_usage","type":"count","value":22},{"name":"ts_ignore","type":"count","value":5},{"name":"explicit_any","type":"count","value":14},{"name":"strictness_score","type":"percentage","value":78}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 19: Log Error Rate Monitoring
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/logging/errors","displayName":"Log Error Rate","processor":"json","jsonPayload":{"metrics":[{"name":"total_logs","type":"count","value":124500},{"name":"errors","type":"count","value":342},{"name":"warnings","type":"count","value":1890},{"name":"error_rate_per_1k","type":"percentage","value":2.7},{"name":"unique_error_signatures","type":"count","value":48}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 20: CI Pipeline Duration
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/ci/pipeline","displayName":"CI Pipeline Duration","processor":"json","jsonPayload":{"metrics":[{"name":"total_minutes","type":"duration","value":8.5},{"name":"setup_seconds","type":"duration","value":23},{"name":"test_seconds","type":"duration","value":184},{"name":"build_seconds","type":"duration","value":127},{"name":"deploy_seconds","type":"duration","value":45},{"name":"queued_seconds","type":"duration","value":12}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""

# --------------------------------------------------
# Test 21: SonarQube Quality Gate
# --------------------------------------------------
curl -X POST \
    -H "X-Upload-Token: $UPLOAD_TOKEN" \
    -F 'meta={"key":"quality-dashboard/sonarqube/gate","displayName":"SonarQube Quality Gate","processor":"json","jsonPayload":{"metrics":[{"name":"bugs","type":"count","value":4},{"name":"code_smells","type":"count","value":137},{"name":"technical_debt_days","type":"duration","value":3.5},{"name":"duplication_percent","type":"percentage","value":5.2},{"name":"reliability_rating","type":"percentage","value":85},{"name":"security_hotspots","type":"count","value":2}]}}' \
    ${UPLOAD_SERVER}/api/reports

echo ""
