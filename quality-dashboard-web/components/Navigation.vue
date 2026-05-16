<template>
  <nav>
    <ul class="menu-links">
      <li>
        <NuxtLink to="/"><strong>QualityDashboard</strong></NuxtLink>
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
        <li v-if="authenticationStore.isAuthenticated">
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
        });
    }, 10000);
  }
});
</script>

<style scoped>
.menu-links li {
  padding-right: 1em;
  font-size: 1.2em;
}
</style>
