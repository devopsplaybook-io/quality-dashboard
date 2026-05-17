<template>
  <div class="page users-page">
    <div class="users-card">
      <div class="users-section">
        <h3 class="section-title">
          <i class="bi bi-database-add"></i>
          Create Admin Account
        </h3>
        <p class="section-desc">
          Set up the initial administrator account to get started.
        </p>

        <div class="field-row">
          <label class="field-label">Username</label>
          <input
            type="text"
            v-model="account.name"
            placeholder="Enter username"
            class="field-input"
            @keyup.enter="createAdmin"
          />
        </div>
        <div class="field-row">
          <label class="field-label">Password</label>
          <input
            type="password"
            v-model="account.password"
            placeholder="Enter password"
            class="field-input"
            @keyup.enter="createAdmin"
          />
        </div>
      </div>

      <div class="users-actions">
        <button class="btn-primary" :disabled="creating" @click="createAdmin">
          <i class="bi bi-person-plus"></i>
          {{ creating ? "Creating…" : "Create" }}
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
const creating = ref(false);

onMounted(async () => {
  if (await UserService.isInitialized()) {
    router.push({ path: "/users/login" });
    return;
  }
  await ApplicationSetttingsStore().refresh();
  if (ApplicationSetttingsStore().isInitialized) {
    router.push({ path: "/users/login" });
  }
});

async function createAdmin() {
  if (!account.name || !account.password) {
    EventBus.emit(EventTypes.ALERT_MESSAGE, {
      type: "error",
      text: "Username or password missing",
    });
    return;
  }
  creating.value = true;
  try {
    const config = await Config.get();
    await axios.post(
      `${config.SERVER_URL}/users`,
      {
        name: account.name,
        password: account.password,
      },
      await AuthService.getAuthHeader(),
    );
    const loginRes = await axios.post(`${config.SERVER_URL}/users/session`, {
      name: account.name,
      password: account.password,
    });
    AuthService.saveToken(loginRes.data.token);
    AlertService.send({ text: "User Created", type: "info" });
    router.push({ path: "/settings" });
  } catch (err) {
    handleError(err);
  } finally {
    creating.value = false;
  }
}
</script>

<style scoped>
.users-page {
  display: flex;
  justify-content: center;
  padding-top: 2em;
}
.users-card {
  border: 1px solid #cfd8dc;
  border-radius: 6px;
  background: #fff;
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
}
</style>
