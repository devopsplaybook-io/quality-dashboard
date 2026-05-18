<template>
  <div class="page users-page">
    <div class="users-card">
      <div class="users-section">
        <h3 class="section-title">
          <i class="bi bi-box-arrow-in-right"></i>
          Sign In
        </h3>
        <p class="section-desc">
          Enter your credentials to access the dashboard.
        </p>

        <div class="field-row">
          <label class="field-label">Username</label>
          <input
            type="text"
            v-model="account.name"
            placeholder="Enter username"
            class="field-input"
            @keyup.enter="login"
          />
        </div>
        <div class="field-row">
          <label class="field-label">Password</label>
          <input
            type="password"
            v-model="account.password"
            placeholder="Enter password"
            class="field-input"
            @keyup.enter="login"
          />
        </div>
      </div>

      <div class="users-actions">
        <button class="btn-primary" :disabled="loggingIn" @click="login">
          <i class="bi bi-box-arrow-in-right"></i>
          {{ loggingIn ? "Signing in…" : "Sign In" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import Config from "~~/services/Config.ts";
import { handleError, EventBus, EventTypes } from "~~/services/EventBus";
import { AuthService } from "~~/services/AuthService";
import { UserService } from "~~/services/UserService";

const router = useRouter();

const account = reactive({ name: "", password: "" });
const loggingIn = ref(false);

onMounted(async () => {
  if (!(await UserService.isInitialized())) {
    router.push({ path: "/users/initialize" });
    return;
  }
  await ApplicationSetttingsStore().refresh();
});

async function login() {
  if (!account.name || !account.password) {
    EventBus.emit(EventTypes.ALERT_MESSAGE, {
      type: "error",
      text: "Username or password missing",
    });
    return;
  }
  loggingIn.value = true;
  try {
    const res = await UserService.login(account.name, account.password);
    AuthService.saveToken(res.data.token);
    await AuthenticationStore().refreshFromToken();
    router.push({ path: "/" });
  } catch (err) {
    handleError(err);
  } finally {
    loggingIn.value = false;
  }
}
</script>

<style scoped>
.users-page {
  display: flex;
  justify-content: center;
  padding-top: var(--space-2xl);
}
.users-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg);
  max-width: 400px;
  width: 100%;
}
.users-section {
  padding: 1.2em 1.2em 0.6em;
}
.section-title {
  margin: 0 0 0.15em;
  font-size: 1em;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-text);
}
.section-desc {
  margin: 0 0 1em;
  font-size: var(--font-base);
  color: var(--color-text-muted);
}
.users-actions {
  padding: 0.8em 1.2em 1.2em;
  display: flex;
  justify-content: flex-end;
}
@media (prefers-color-scheme: dark) {
  .users-card {
    background: var(--color-bg);
    border-color: var(--color-border);
  }
  .section-title {
    color: var(--color-text);
  }
  .section-desc {
    color: var(--color-text-muted);
  }
}
</style>
