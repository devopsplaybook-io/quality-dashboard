# quality-dashboard Upload Scripts

This directory contains ready-to-use shell scripts for uploading reports to a
[quality-dashboard](https://github.com/devopsplaybook-io/quality-dashboard)
server.

## Requirements

All scripts depend on **curl**. The `npm-audit.sh` script additionally requires
**jq**. Both are commonly available or installable via your package manager:

```bash
# Debian / Ubuntu
sudo apt install curl jq

# macOS
brew install curl jq

# Alpine
apk add curl jq
```

## Common Parameters

Every script accepts these standard named arguments:

| Argument        | Description                                 | Required | Default      |
| --------------- | ------------------------------------------- | -------- | ------------ |
| `-key`          | Unique report key                           | yes      | —            |
| `-server`       | Quality-dashboard server base URL           | yes\*    | `$QD_SERVER` |
| `-token`        | Upload token for authentication             | yes\*    | `$QD_TOKEN`  |
| `-display-name` | Human-friendly display name shown in the UI | no       | report key   |

**\*** The `-server` and `-token` arguments can be omitted if the corresponding
environment variables `QD_SERVER` and `QD_TOKEN` are set. Command-line
arguments take precedence over environment variables.

---

## `npm-audit.sh`

Uploads an **npm audit** report. Reads the JSON output of `npm audit --json`,
transforms the vulnerability counts into quality-dashboard metrics, and submits
them via the [`json`](/README.md) processor.

### Extra Parameters

| Argument | Description                         | Default |
| -------- | ----------------------------------- | ------- |
| `-file`  | Path to a saved npm audit JSON file | stdin   |

### Examples

**Pipe from npm audit:**

```bash
npm audit --json | ./scripts/npm-audit.sh \
  -key my-app \
  -server http://localhost:8080 \
  -token s3cr3t
```

**From a saved file:**

```bash
npm audit --json > audit.json

./scripts/npm-audit.sh \
  -key my-app \
  -file audit.json \
  -server http://localhost:8080 \
  -token s3cr3t
```

**With environment variables:**

```bash
export QD_SERVER=http://localhost:8080
export QD_TOKEN=s3cr3t

npm audit --json | ./scripts/npm-audit.sh -key my-app
```

---

## `trivy-scan.sh`

Uploads a **Trivy** vulnerability scan report. Sends the HTML output of
`trivy --format html` to the [`trivy-html`](/README.md) processor, which
parses the report and counts vulnerabilities by severity.

### Extra Parameters

| Argument | Description                        | Required |
| -------- | ---------------------------------- | -------- |
| `-file`  | Path to the Trivy HTML report file | yes      |

### Examples

**Generate a Trivy report and upload it:**

```bash
trivy image --format html -o report.html my-image:latest

./scripts/trivy-scan.sh \
  -key my-image \
  -file report.html \
  -server http://localhost:8080 \
  -token s3cr3t
```

**With environment variables:**

```bash
export QD_SERVER=http://localhost:8080
export QD_TOKEN=s3cr3t

trivy image --format html -o report.html my-image:latest
./scripts/trivy-scan.sh -key my-image -file report.html
```

---

## Processors Reference

The metrics extracted by each script correspond to these quality-dashboard
system processors:

| Script          | Processor    | Source                            |
| --------------- | ------------ | --------------------------------- |
| `npm-audit.sh`  | `json`       | `processors_system/json.js`       |
| `trivy-scan.sh` | `trivy-html` | `processors_system/trivy-html.js` |

For custom processors or additional upload scenarios, refer to the
[quality-dashboard documentation](/README.md).
