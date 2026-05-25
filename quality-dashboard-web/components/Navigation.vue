<template>
  <nav>
    <ul class="menu-links">
      <li>
        <NuxtLink to="/"
          ><img src="/icon.svg" alt="QualityDashboard" class="nav-logo"
        /></NuxtLink>
        <span v-if="pageTitle" class="breadcrumb">
          <span class="breadcrumb-sep">&gt;</span>
          <span class="breadcrumb-title">{{ pageTitle }}</span>
        </span>
      </li>
    </ul>
    <ul class="menu-links">
      <template v-if="initialized === null">
        <li><span class="nav-loading">...</span></li>
      </template>
      <template
        v-else-if="!initialized && !authenticationStore.isAuthenticated"
      >
        <li>
          <NuxtLink to="/users/initialize" title="Initialize">
            <i class="bi bi-database-add"></i>
          </NuxtLink>
        </li>
      </template>
      <template v-else>
        <li>
          <NuxtLink to="/reports" title="Reports"
            ><i class="bi bi-bar-chart-line-fill"></i
          ></NuxtLink>
        </li>
        <li>
          <NuxtLink to="/dashboards" title="Dashboards"
            ><i class="bi bi-grid-1x2-fill"></i
          ></NuxtLink>
        </li>
        <li v-if="authenticationStore.isAuthenticated">
          <NuxtLink to="/users/profile"
            ><i class="bi bi-person-circle"></i
          ></NuxtLink>
        </li>
        <li v-if="authenticationStore.isAdmin">
          <NuxtLink to="/settings"><i class="bi bi-gear-fill"></i></NuxtLink>
        </li>
      </template>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { AuthService } from "~~/services/AuthService";
import Config from "~~/services/Config";
import axios from "axios";

const authenticationStore = AuthenticationStore();
const applicationSetttingsStore = ApplicationSetttingsStore();

const route = useRoute();

const pageTitle = computed(() => {
  const path = route.path;
  if (path === "/reports") return "Reports";
  if (path === "/dashboards") return "Dashboards";
  if (path === "/settings") return "Settings";
  if (path.startsWith("/users/")) return "User";
  return null;
});

const initialized = ref<boolean | null>(null);

onMounted(async () => {
  // Load initialization state from the server
  await applicationSetttingsStore.refresh();
  initialized.value = applicationSetttingsStore.isInitialized;

  // Authenticate and renew token if needed
  if (await authenticationStore.ensureAuthenticated()) {
    setTimeout(async () => {
      // Renew session token
      axios
        .post(
          `${(await Config.get()).SERVER_URL}/users/session`,
          {},
          await AuthService.getAuthHeader(),
        )
        .then((res) => {
          AuthService.saveToken(res.data.token);
          authenticationStore.refreshFromToken();
        });
    }, 10000);
  }
});
</script>

<style scoped>
.nav-logo {
  height: 1.6em;
  width: auto;
  vertical-align: middle;
}
.menu-links {
  display: flex;
  align-items: center;
  gap: 0;
  height: 2rem;
}
.menu-links li {
  padding-right: 1em;
  font-size: 1em;
  display: flex;
  align-items: center;
}
.breadcrumb {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: 0.15em;
  font-size: var(--font-base);
  font-weight: 400;
  color: var(--color-text-muted);
}
.breadcrumb-sep {
  color: var(--color-text-placeholder);
}
.breadcrumb-title {
  color: var(--color-text-secondary);
  max-width: 18ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (prefers-color-scheme: dark) {
  .breadcrumb {
    color: var(--color-text-muted);
  }
  .breadcrumb-sep {
    color: var(--color-text-placeholder);
  }
  .breadcrumb-title {
    color: var(--color-text-secondary);
  }
}
</style>
