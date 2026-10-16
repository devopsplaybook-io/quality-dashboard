<template>
  <div class="page activity-page">
    <div class="activity-toolbar">
      <span v-if="reportsStore.isFetchingRecent" class="activity-loading">
        <i class="bi bi-arrow-repeat spin"></i> Loading...
      </span>
      <button
        class="activity-refresh"
        :disabled="reportsStore.isFetchingRecent"
        title="Refresh"
        @click="refresh"
      >
        <i class="bi bi-arrow-clockwise"></i>
      </button>
    </div>

    <div v-if="reportsStore.lastError" class="activity-error">
      <i class="bi bi-exclamation-triangle-fill"></i>
      {{ reportsStore.lastError }}
    </div>

    <div
      v-if="
        !reportsStore.isFetchingRecent &&
        reportsStore.recentVersions.length === 0
      "
      class="activity-empty"
    >
      <p>No uploads yet.</p>
      <p class="activity-empty-hint">
        Upload a report via <code>POST /api/reports</code> with a multipart
        payload <code>meta = { key, processor, displayName? }</code>.
      </p>
    </div>

    <div v-else class="activity-list">
      <VersionCard
        v-for="version in reportsStore.recentVersions"
        :key="version.id"
        :version="version"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { AuthService } from "~~/services/AuthService";

const reportsStore = ReportsStore();
const applicationSettingsStore = ApplicationSetttingsStore();

onMounted(async () => {
  await applicationSettingsStore.refresh();
  const isAuth = await AuthService.isAuthenticated();
  if (!isAuth) {
    if (!applicationSettingsStore.isInitialized) {
      useRouter().push({ path: "/users/initialize" });
      return;
    }
    if (!applicationSettingsStore.isDashboardPublic) {
      useRouter().push({ path: "/users/login" });
      return;
    }
  }
  await reportsStore.fetchRecent();
});

async function refresh(): Promise<void> {
  await reportsStore.fetchRecent();
}
</script>

<style scoped>
.activity-page {
  padding: var(--space-md) var(--space-md) var(--space-2xl);
}
.activity-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-md);
  margin-bottom: var(--space-base);
}
.activity-refresh {
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-xs) var(--space-compact);
  cursor: pointer;
  color: var(--color-text-secondary);
}
.activity-refresh:disabled {
  cursor: wait;
  opacity: 0.6;
}
.activity-loading .spin {
  display: inline-block;
}
@media (max-width: 480px) {
  .activity-loading {
    display: none;
  }
}
.activity-error {
  background-color: var(--color-error-bg);
  color: var(--color-error);
  border: 1px solid var(--color-error-border);
  padding: var(--space-compact) var(--space-base);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-base);
}
.activity-empty {
  text-align: center;
  color: var(--color-text-muted);
  padding: var(--space-2xl) var(--space-loose);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
}
.activity-empty-hint code {
  background-color: var(--color-bg-hover);
  padding: 0.1em var(--space-sm);
  border-radius: var(--radius-sm);
}
.activity-list {
  display: grid;
  grid-template-columns: 1fr;
}
@media (prefers-color-scheme: dark) {
  .activity-refresh {
    border-color: var(--color-border);
    color: var(--color-text);
  }
  .activity-error {
    background-color: var(--color-error-bg);
    color: var(--color-error);
    border-color: var(--color-error-border);
  }
  .activity-empty {
    border-color: var(--color-border-light);
    color: var(--color-text-muted);
  }
  .activity-empty-hint code {
    background-color: var(--color-bg-secondary);
    color: var(--color-text);
  }
}
</style>
