<template>
  <div v-if="visible" class="modal" @click.self="$emit('close')">
    <div class="modal-card file-content-card">
      <div class="file-content-header">
        <h3 class="file-content-title">{{ fileName }}</h3>
        <div class="file-content-header-actions">
          <div v-if="isPreview" class="view-tabs">
            <button
              :class="['tab-btn', { active: viewMode === 'preview' }]"
              title="View formatted preview"
              @click="switchView('preview')"
            >
              <i class="bi bi-eye"></i> Preview
            </button>
            <button
              :class="['tab-btn', { active: viewMode === 'raw' }]"
              title="View raw file content"
              @click="switchView('raw')"
            >
              <i class="bi bi-file-text"></i> Raw
            </button>
          </div>
          <button
            class="btn-primary"
            title="Download file"
            @click="downloadFile"
          >
            <i class="bi bi-download"></i> Download
          </button>
          <button class="btn-secondary" title="Close" @click="$emit('close')">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>
      <div class="file-content-body">
        <div v-if="loading" class="file-content-status">
          <i class="bi bi-arrow-repeat spin"></i> Loading...
        </div>
        <div v-else-if="error" class="file-content-error">
          <i class="bi bi-exclamation-triangle-fill"></i> {{ error }}
        </div>
        <div
          v-else-if="isPreview && viewMode === 'preview'"
          class="file-content-html"
        >
          <iframe
            :srcdoc="content"
            class="preview-iframe"
            sandbox="allow-same-origin"
            title="Report preview"
          ></iframe>
        </div>
        <pre
          v-else-if="viewMode === 'raw' || !isPreview"
          class="file-content-pre"
        ><code>{{ content }}</code></pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AuthService } from "~~/services/AuthService";
import axios from "axios";

async function downloadFile(): Promise<void> {
  try {
    const token = await AuthService.getToken();
    if (!token) {
      window.open(props.downloadUrl, "_blank");
      return;
    }
    const response = await fetch(props.fileUrl + "?download=1", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = props.fileName || "report";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error("Download failed", err);
  }
}

const props = defineProps<{
  visible: boolean;
  fileUrl: string;
  downloadUrl: string;
  fileName: string;
  isPreview?: boolean;
  previewUrl?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const content = ref("");
const loading = ref(false);
const error = ref<string | null>(null);
const viewMode = ref<"preview" | "raw">("preview");

async function fetchContent(): Promise<void> {
  loading.value = true;
  error.value = null;
  content.value = "";
  try {
    const targetUrl =
      props.isPreview && viewMode.value === "preview" && props.previewUrl
        ? props.previewUrl
        : props.fileUrl;
    const res = await axios.get(targetUrl, await AuthService.getAuthHeader());
    const data = res.data;
    content.value =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);
  } catch (err) {
    error.value = (err as Error).message || "Failed to load file content";
  } finally {
    loading.value = false;
  }
}

function switchView(mode: "preview" | "raw"): void {
  viewMode.value = mode;
  fetchContent();
}

watch(
  () => props.visible,
  async (isVisible) => {
    if (!isVisible) return;
    viewMode.value = "preview";
    await fetchContent();
  },
);
</script>

<style scoped>
.file-content-card {
  width: min(96vw, 1200px);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.file-content-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: 0.7em var(--space-loose);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  flex-shrink: 0;
}
.file-content-title {
  margin: 0;
  font-size: var(--font-lg);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}
.file-content-header-actions {
  display: flex;
  gap: var(--space-sm);
  flex-shrink: 0;
  align-items: center;
}
.view-tabs {
  display: flex;
  gap: 2px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  padding: 2px;
  border: 1px solid var(--color-border);
}
.tab-btn {
  padding: 4px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;
}
.tab-btn.active {
  background: var(--color-primary);
  color: #fff;
}
.tab-btn:not(.active):hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}
.file-content-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  min-height: 200px;
}
.file-content-html {
  min-height: 200px;
  display: flex;
}
.file-content-html :deep(> div) {
  padding: 0;
}

.preview-iframe {
  width: 100%;
  height: 70vh;
  border: none;
}
.file-content-pre {
  margin: 0;
  padding: var(--space-loose);
  font-family:
    ui-monospace, "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
  font-size: var(--font-sm);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  tab-size: 2;
  background: #263238;
  color: #e0e0e0;
  border-radius: 0;
}
.file-content-pre code {
  font-family: inherit;
}
.file-content-status,
.file-content-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-3xl) var(--space-loose);
  color: var(--color-text-muted);
  font-size: var(--font-body);
}
.file-content-error {
  color: var(--color-error);
}

@media (prefers-color-scheme: dark) {
  .file-content-card {
    background: var(--color-bg);
  }
  .file-content-header {
    background: var(--color-bg-secondary);
    border-bottom-color: var(--color-border);
    color: var(--color-text);
  }
  .view-tabs {
    background: var(--color-bg-secondary);
    border-color: var(--color-border);
  }
  .tab-btn:not(.active):hover {
    color: var(--color-text);
    background: var(--color-bg-hover);
  }
  .file-content-pre {
    background: #0d1b1e;
    color: var(--color-text);
  }
  .file-content-error {
    color: var(--color-error);
  }
  .file-content-status {
    color: var(--color-text-muted);
  }
}
</style>
