<template>
  <div v-if="visible" class="modal" @click.self="$emit('close')">
    <div class="modal-card file-content-card">
      <div class="file-content-header">
        <h3 class="file-content-title">{{ fileName }}</h3>
        <div class="file-content-header-actions">
          <a
            :href="downloadUrl"
            class="btn-primary"
            download
            title="Download file"
          >
            <i class="bi bi-download"></i> Download
          </a>
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
        <pre v-else class="file-content-pre"><code>{{ content }}</code></pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AuthService } from "~~/services/AuthService";
import axios from "axios";

const props = defineProps<{
  visible: boolean;
  fileUrl: string;
  downloadUrl: string;
  fileName: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const content = ref("");
const loading = ref(false);
const error = ref<string | null>(null);

watch(
  () => props.visible,
  async (isVisible) => {
    if (!isVisible) return;
    loading.value = true;
    error.value = null;
    content.value = "";
    try {
      const res = await axios.get(props.fileUrl, await AuthService.getAuthHeader());
      const data = res.data;
      content.value =
        typeof data === "string"
          ? data
          : JSON.stringify(data, null, 2);
    } catch (err) {
      error.value = (err as Error).message || "Failed to load file content";
    } finally {
      loading.value = false;
    }
  },
);
</script>

<style scoped>
.file-content-card {
  width: min(92vw, 960px);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 6px;
  overflow: hidden;
}
.file-content-header {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.7em 1em;
  border-bottom: 1px solid #cfd8dc;
  background: #f5f7f8;
  flex-shrink: 0;
}
.file-content-title {
  margin: 0;
  font-size: 1em;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}
.file-content-header-actions {
  display: flex;
  gap: 0.4em;
  flex-shrink: 0;
}
.file-content-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  min-height: 200px;
}
.file-content-pre {
  margin: 0;
  padding: 1em;
  font-family: ui-monospace, "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
  font-size: 0.78em;
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
  gap: 0.5em;
  padding: 3em 1em;
  color: #78909c;
  font-size: 0.9em;
}
.file-content-error {
  color: #bf360c;
}
.spin {
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.btn-primary,
.btn-secondary {
  padding: 0.3em 0.7em;
  border-radius: 4px;
  border: 1px solid #cfd8dc;
  cursor: pointer;
  background: #fff;
  color: #263238;
  font-size: 0.85em;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
}
.btn-primary {
  background: #1976d2;
  color: #fff;
  border-color: #1976d2;
}
.btn-primary:hover {
  background: #1565c0;
}
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
@media (prefers-color-scheme: dark) {
  .file-content-card {
    background: #1e2a32;
  }
  .file-content-header {
    background: #263238;
    border-bottom-color: #455a64;
    color: #cfd8dc;
  }
  .file-content-pre {
    background: #0d1b1e;
    color: #cfd8dc;
  }
  .btn-secondary {
    background: #1e2a32;
    color: #cfd8dc;
    border-color: #455a64;
  }
  .file-content-error {
    color: #ffab91;
  }
  .file-content-status {
    color: #90a4ae;
  }
}
</style>
