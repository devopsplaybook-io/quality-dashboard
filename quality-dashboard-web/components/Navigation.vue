<template>
  <nav>
    <ul class="menu-links">
      <li>
        <NuxtLink to="/"><strong>QualityDashboard</strong></NuxtLink>
      </li>
    </ul>
    <ul class="menu-links">
      <li>
        <NuxtLink to="/"><i class="bi bi-bar-chart-line-fill"></i></NuxtLink>
      </li>
      <li v-if="authenticationStore.isAuthenticated">
        <NuxtLink to="/users/profile"><i class="bi bi-person-circle"></i></NuxtLink>
      </li>
      <li v-if="authenticationStore.isAuthenticated">
        <NuxtLink to="/settings"><i class="bi bi-gear-fill"></i></NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<script setup>
const authenticationStore = AuthenticationStore();
const applicationSetttingsStore = ApplicationSetttingsStore();
</script>

<script>
import axios from "axios";
import Config from "~~/services/Config.ts";
import { AuthService } from "~~/services/AuthService";

export default {
  async created() {
    if (await AuthenticationStore().ensureAuthenticated()) {
      setTimeout(async () => {
        // Renew session tocken
        axios
          .post(`${(await Config.get()).SERVER_URL}/users/session`, {}, await AuthService.getAuthHeader())
          .then((res) => {
            AuthService.saveToken(res.data.token);
          });
      }, 10000);
    }
  },
};
</script>

<style scoped>
.menu-links li {
  padding-right: 1em;
  font-size: 1.2em;
}
</style>
