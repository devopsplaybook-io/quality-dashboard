<template>
  <div class="page users-page">
    <div class="users-card">
      <div class="users-section">
        <h3 class="section-title">
          <i class="bi bi-person-circle"></i>
          Account
        </h3>
        <p class="section-desc">You are currently logged in.</p>
      </div>
      <div class="users-actions">
        <button class="btn-secondary" @click="logout">
          <i class="bi bi-box-arrow-right"></i> Logout
        </button>
      </div>
    </div>

    <div class="users-card">
      <div class="users-section">
        <h3 class="section-title">
          <i class="bi bi-key"></i>
          Change Password
        </h3>
        <p class="section-desc">Update your account password.</p>

        <div class="field-row">
          <label class="field-label">Current Password</label>
          <input
            type="password"
            v-model="oldPassword"
            placeholder="Enter current password"
            class="field-input"
          />
        </div>
        <div class="field-row">
          <label class="field-label">New Password</label>
          <input
            type="password"
            v-model="newPassword"
            placeholder="Enter new password"
            class="field-input"
            @keyup.enter="changePassword"
          />
        </div>
      </div>
      <div class="users-actions">
        <button class="btn-primary" :disabled="saving" @click="changePassword">
          <i class="bi bi-check-lg"></i>
          {{ saving ? "Saving…" : "Save" }}
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

const router = useRouter();

const newPassword = ref("");
const oldPassword = ref("");
const saving = ref(false);

onMounted(async () => {
  if (!(await AuthenticationStore().ensureAuthenticated())) {
    router.push({ path: "/users/login" });
  }
});

function logout() {
  AuthService.removeToken();
  router.push({ path: "/users/login" });
}

async function changePassword() {
  if (!newPassword.value) {
    EventBus.emit(EventTypes.ALERT_MESSAGE, {
      text: "Password is required",
      type: "error",
    });
    return;
  }
  saving.value = true;
  try {
    await axios.put(
      `${(await Config.get()).SERVER_URL}/users/password`,
      { password: newPassword.value, passwordOld: oldPassword.value },
      await AuthService.getAuthHeader(),
    );
    EventBus.emit(EventTypes.ALERT_MESSAGE, {
      text: "Password updated",
      type: "info",
    });
    newPassword.value = "";
    oldPassword.value = "";
  } catch (err) {
    handleError(err);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.users-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1em;
  padding-top: 2em;
}
.users-card {
  border: 1px solid #cfd8dc;
  border-radius: 6px;
  background: #fff;
  max-width: 480px;
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
  gap: 0.4em;
  color: #263238;
}
.section-desc {
  margin: 0 0 1em;
  font-size: 0.85em;
  color: #78909c;
}
.users-actions {
  padding: 0.8em 1.2em 1.2em;
  display: flex;
  justify-content: flex-end;
}
@media (prefers-color-scheme: dark) {
  .users-card {
    background: #1e2a32;
    border-color: #455a64;
  }
  .section-title {
    color: #cfd8dc;
  }
  .section-desc {
    color: #90a4ae;
  }
}
</style>
