<template>
  <div v-if="visible" class="modal" @click.self="$emit('close')">
    <div class="modal-card upload-help-card">
      <div class="upload-help-header">
        <h3 class="upload-help-title">How to upload a report</h3>
        <button class="btn-secondary" title="Close" @click="$emit('close')">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div class="upload-help-body">
        <div v-if="reportsStore.isFetchingProcessors" class="upload-help-status">
          <i class="bi bi-arrow-repeat spin"></i> Loading processors...
        </div>
        <div v-else-if="reportsStore.lastError" class="upload-help-error">
          <i class="bi bi-exclamation-triangle-fill"></i>
          {{ reportsStore.lastError }}
        </div>

        <template v-else>
          <p class="upload-help-intro">
            Uploads are <code>multipart/form-data</code> POSTs to
            <code>{{ apiBaseUrl }}/reports</code>. The snippets below use
            <code>$UPLOAD_TOKEN</code> (set in
            <NuxtLink to="/settings" @click="$emit('close')"
              >Settings → Reports Settings</NuxtLink
            >) and <code>$DASHBOARD_URL</code> — replace them with your own
            values, and use the server's public URL from CI.
          </p>

          <div
            v-for="proc in sortedProcessors"
            :key="proc.name"
            class="processor-section"
          >
            <div class="processor-header">
              <h4 class="processor-name">
                <i class="bi bi-gear"></i> {{ proc.name }}
                <span v-if="proc.source" class="processor-source">{{
                  proc.source
                }}</span>
              </h4>
              <p v-if="proc.describe?.summary" class="processor-summary">
                {{ proc.describe.summary }}
              </p>
              <p v-if="acceptsOf(proc).length" class="processor-accepts">
                Accepts:
                <code v-for="a in acceptsOf(proc)" :key="a" class="accept-chip">{{
                  a
                }}</code>
              </p>
            </div>

            <div
              v-for="snippet in snippetsFor(proc)"
              :key="snippet.id"
              class="snippet-block"
            >
              <div class="snippet-header">
                <span class="snippet-title">
                  <i :class="['bi', snippet.icon]"></i> {{ snippet.title }}
                </span>
                <button
                  class="btn-secondary btn-copy"
                  type="button"
                  :title="snippet.title + ' — copy to clipboard'"
                  @click="copyText(snippet.id, snippet.code)"
                >
                  <template v-if="copiedId === snippet.id">
                    <i class="bi bi-check-lg"></i> Copied
                  </template>
                  <template v-else>
                    <i class="bi bi-clipboard"></i> Copy
                  </template>
                </button>
              </div>
              <pre class="snippet-pre"><code>{{ snippet.code }}</code></pre>
            </div>
          </div>

          <div class="payload-section">
            <h4 class="processor-name">
              <i class="bi bi-braces"></i> Payload format
            </h4>
            <p class="processor-summary">
              The <code>meta</code> part is JSON: <code>key</code> (required,
              unique, <code>^[a-zA-Z0-9._:\-/]{1,200}$</code>),
              <code>displayName</code> (optional), <code>processor</code>
              (required, one of the names above) and <code>jsonPayload</code>
              (optional, for JSON-aware processors). Metrics are
              <code>{ name, type, value }</code> where type is one of
              <code>count</code>, <code>percentage</code>, <code>duration</code>
              or <code>boolean</code>.
            </p>
            <div class="snippet-block">
              <div class="snippet-header">
                <span class="snippet-title">
                  <i class="bi bi-filetype-json"></i> meta example
                </span>
                <button
                  class="btn-secondary btn-copy"
                  type="button"
                  title="meta example — copy to clipboard"
                  @click="copyText('meta-example', metaExample)"
                >
                  <template v-if="copiedId === 'meta-example'">
                    <i class="bi bi-check-lg"></i> Copied
                  </template>
                  <template v-else>
                    <i class="bi bi-clipboard"></i> Copy
                  </template>
                </button>
              </div>
              <pre class="snippet-pre"><code>{{ metaExample }}</code></pre>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProcessorInfo } from "~~/stores/ReportsStore";

const props = defineProps<{ visible: boolean }>();

defineEmits<{ close: [] }>();

const reportsStore = ReportsStore();

const copiedId = ref<string | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const apiBaseUrl = `${window.location.origin}/api`;

const sortedProcessors = computed(() =>
  [...reportsStore.processors].sort((a, b) => a.name.localeCompare(b.name)),
);

const metaExample = `curl -X POST "$DASHBOARD_URL/reports" \\
  -H "X-Upload-Token: $UPLOAD_TOKEN" \\
  -F 'meta={"key":"my-team/my-app/unit-tests","displayName":"Unit tests","processor":"json","jsonPayload":{"metrics":[{"name":"tests.passed","type":"count","value":42}]}};type=application/json'`;

function acceptsOf(proc: ProcessorInfo): string[] {
  return proc.describe?.accepts || [];
}

function fileNameFor(accepts: string[]): string {
  if (accepts.includes("tar.gz")) return "report.tar.gz";
  if (accepts.includes("zip")) return "report.zip";
  if (accepts.includes("html")) return "report.html";
  if (accepts.includes("yaml")) return "report.yaml";
  return "report.html";
}

function curlMetaArg(proc: ProcessorInfo): string {
  const accepts = acceptsOf(proc);
  if (accepts.includes("json")) {
    return `-F 'meta={"key":"my-team/my-app/report","processor":"${proc.name}","jsonPayload":{"metrics":[{"name":"tests.passed","type":"count","value":42}]}};type=application/json'`;
  }
  return `-F 'meta={"key":"my-team/my-app/report","processor":"${proc.name}"};type=application/json'`;
}

function snippetsFor(proc: ProcessorInfo): {
  id: string;
  title: string;
  icon: string;
  code: string;
}[] {
  const accepts = acceptsOf(proc);
  const curlLines = [
    `curl -X POST "${apiBaseUrl}/reports" \\`,
    `  -H "X-Upload-Token: $UPLOAD_TOKEN" \\`,
    `  ${curlMetaArg(proc)}`,
  ];
  if (!accepts.includes("json")) {
    curlLines.push(`  -F file=@./${fileNameFor(accepts)}`);
  }
  const actionsLines = [
    `- name: Upload report to quality dashboard`,
    `  env:`,
    `    DASHBOARD_URL: \${{ secrets.DASHBOARD_URL }}`,
    `    UPLOAD_TOKEN: \${{ secrets.UPLOAD_TOKEN }}`,
    `  run: |`,
    `    curl -X POST "$DASHBOARD_URL/reports" \\`,
    `      -H "X-Upload-Token: $UPLOAD_TOKEN" \\`,
    `      ${curlMetaArg(proc)}`,
  ];
  if (!accepts.includes("json")) {
    actionsLines.push(`      -F file=@./${fileNameFor(accepts)}`);
  }
  const gitlabLines = [
    `upload-report:`,
    `  stage: publish`,
    `  image: curlimages/curl:latest`,
    `  variables:`,
    `    # UPLOAD_TOKEN: masked CI/CD variable (Settings > CI/CD > Variables)`,
    `  script:`,
    `    - curl -X POST "$DASHBOARD_URL/reports"`,
    `        -H "X-Upload-Token: $UPLOAD_TOKEN"`,
    `        ${curlMetaArg(proc)}`,
  ];
  if (!accepts.includes("json")) {
    gitlabLines.push(`        -F file=@./${fileNameFor(accepts)}`);
  }
  return [
    {
      id: `${proc.name}-curl`,
      title: "curl",
      icon: "bi-terminal",
      code: curlLines.join("\n"),
    },
    {
      id: `${proc.name}-actions`,
      title: "GitHub Actions",
      icon: "bi-github",
      code: actionsLines.join("\n"),
    },
    {
      id: `${proc.name}-gitlab`,
      title: "GitLab CI",
      icon: "bi-gitlab",
      code: gitlabLines.join("\n"),
    },
  ];
}

async function copyText(id: string, code: string): Promise<void> {
  let ok = false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(code);
      ok = true;
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    // Fallback for non-secure contexts (self-hosted http)
    const ta = document.createElement("textarea");
    ta.value = code;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
  }
  if (ok) {
    copiedId.value = id;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copiedId.value = null;
    }, 1500);
  }
}

watch(
  () => props.visible,
  async (isVisible) => {
    if (!isVisible) return;
    copiedId.value = null;
    if (reportsStore.processors.length === 0) {
      await reportsStore.fetchProcessors();
    }
  },
);
</script>

<style scoped>
.upload-help-card {
  width: min(96vw, 900px);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.upload-help-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: 0.7em var(--space-loose);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  flex-shrink: 0;
}
.upload-help-title {
  margin: 0;
  font-size: var(--font-lg);
  font-weight: 600;
  flex: 1;
  min-width: 0;
}
.upload-help-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-loose);
}
.upload-help-intro {
  margin: 0 0 var(--space-loose);
  color: var(--color-text-secondary);
  font-size: var(--font-body);
  line-height: 1.6;
}
.upload-help-intro code {
  background-color: var(--color-bg-hover);
  padding: 0.1em var(--space-sm);
  border-radius: var(--radius-sm);
}
.upload-help-status,
.upload-help-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-3xl) var(--space-loose);
  color: var(--color-text-muted);
  font-size: var(--font-body);
}
.upload-help-error {
  color: var(--color-error);
}
.processor-section,
.payload-section {
  margin-bottom: var(--space-xl);
  padding-bottom: var(--space-loose);
  border-bottom: 1px solid var(--color-border-light);
}
.payload-section {
  border-bottom: none;
  margin-bottom: 0;
}
.processor-header {
  margin-bottom: var(--space-md);
}
.processor-name {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-body);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.processor-source {
  font-size: var(--font-xs);
  font-weight: 400;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 0 0.6em;
  text-transform: uppercase;
}
.processor-summary {
  margin: 0 0 var(--space-xs);
  color: var(--color-text-secondary);
  font-size: var(--font-body);
}
.processor-summary code {
  background-color: var(--color-bg-hover);
  padding: 0.1em var(--space-sm);
  border-radius: var(--radius-sm);
}
.processor-accepts {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-md);
}
.accept-chip {
  display: inline-block;
  margin: 0 var(--space-xs) 0 0;
  padding: 0 0.4em;
  background: var(--color-bg-hover);
  border-radius: var(--radius-sm);
}
.snippet-block {
  margin-bottom: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.snippet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-xs) var(--space-md);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}
.snippet-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.btn-copy {
  padding: 2px 10px;
  font-size: var(--font-md);
}
.snippet-pre {
  margin: 0;
  padding: var(--space-md);
  font-family:
    ui-monospace, "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
  font-size: var(--font-md);
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre;
  background: #263238;
  color: #e0e0e0;
}
.snippet-pre code {
  font-family: inherit;
}
.spin {
  display: inline-block;
}

@media (prefers-color-scheme: dark) {
  .upload-help-card {
    background: var(--color-bg);
  }
  .upload-help-header {
    background: var(--color-bg-secondary);
    border-bottom-color: var(--color-border);
    color: var(--color-text);
  }
  .upload-help-intro,
  .processor-summary {
    color: var(--color-text-secondary);
  }
  .processor-section {
    border-bottom-color: var(--color-border-light);
  }
  .accept-chip,
  .upload-help-intro code,
  .processor-summary code {
    background-color: var(--color-bg-hover);
  }
  .snippet-block {
    border-color: var(--color-border);
  }
  .snippet-header {
    background: var(--color-bg-secondary);
    border-bottom-color: var(--color-border);
  }
  .snippet-title {
    color: var(--color-text-secondary);
  }
  .snippet-pre {
    background: #0d1b1e;
    color: var(--color-text);
  }
  .upload-help-error {
    color: var(--color-error);
  }
}
</style>
