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
import { handleError } from "~~/services/EventBus";
import { AuthService } from "~~/services/AuthService";

const router = useRouter();

const newPassword = ref("");
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
    AlertService.send({ text: "Password is required", type: "error" });
    return;
  }
  saving.value = true;
  try {
    await axios.put(
      `${(await Config.get()).SERVER_URL}/users/password`,
      { password: newPassword.value },
      await AuthService.getAuthHeader(),
    );
    AlertService.send({ text: "Password updated", type: "info" });
    newPassword.value = "";
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
.field-row {
  margin-bottom: 0.8em;
}
.field-label {
  display: block;
  font-weight: 600;
  font-size: 0.85em;
  color: #37474f;
  margin-bottom: 0.3em;
}
.field-input {
  display: block;
  width: 100%;
  padding: 0.5em 0.6em;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  font-size: 0.9em;
  background: #fff;
  color: #455a64;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.field-input:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.15);
}
.field-input::placeholder {
  color: #b0bec5;
}
.users-actions {
  padding: 0.8em 1.2em 1.2em;
  display: flex;
  justify-content: flex-end;
}
.btn-primary {
  padding: 0.4em 1em;
  border-radius: 4px;
  border: 1px solid #1976d2;
  background: #1976d2;
  color: #fff;
  cursor: pointer;
  font-size: 0.9em;
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  transition: background 0.15s;
}
.btn-primary:hover {
  background: #1565c0;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-secondary {
  padding: 0.4em 1em;
  border-radius: 4px;
  border: 1px solid #cfd8dc;
  background: transparent;
  color: #455a64;
  cursor: pointer;
  font-size: 0.9em;
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.btn-secondary:hover {
  background: #f5f7f8;
  border-color: #90a4ae;
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
  .field-label {
    color: #cfd8dc;
  }
  .field-input {
    background: #263238;
    color: #cfd8dc;
    border-color: #455a64;
  }
  .field-input:focus {
    border-color: #64b5f6;
    box-shadow: 0 0 0 2px rgba(100, 181, 246, 0.2);
  }
  .field-input::placeholder {
    color: #546e7a;
  }
  .btn-secondary {
    color: #b0bec5;
    border-color: #455a64;
  }
  .btn-secondary:hover {
    background: #263238;
    border-color: #607d8b;
  }
}
</style>
