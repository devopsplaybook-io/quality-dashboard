<template>
  <div class="page settings-page">
    <div class="settings-card">
      <div class="settings-section">
        <h3 class="section-title">
          <i class="bi bi-shield-lock"></i>
          General Configuration
        </h3>
        <p class="section-desc">
          Manage your dashboard visibility and upload credentials.
        </p>

        <div class="setting-row setting-row--toggle">
          <div class="setting-info">
            <span class="setting-label">Public Dashboard</span>
            <span class="setting-hint">
              Allow unauthenticated users to view dashboards and reports.
            </span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" v-model="config.isDashboardPublic" />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Upload Token</span>
            <span class="setting-hint">
              Token used by CI/CD pipelines to upload reports via the API.
            </span>
          </div>
          <div class="setting-input-wrap">
            <input
              type="password"
              v-model="config.uploadToken"
              placeholder="Enter upload token…"
              class="setting-input"
            />
          </div>
        </div>
      </div>

      <div class="settings-actions">
        <button class="btn-primary" @click="saveSettings()">
          <i class="bi bi-check-lg"></i> Save Settings
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { AuthService } from "~~/services/AuthService";
import axios from "axios";
import Config from "~~/services/Config.ts";
import { handleError, EventBus, EventTypes } from "~~/services/EventBus";

export default defineComponent({
  data() {
    return {
      config: { isDashboardPublic: false, uploadToken: "" },
    };
  },

  async created() {
    if (!(await AuthenticationStore().ensureAuthenticated())) {
      useRouter().push({ path: "/users/login" });
      return;
    }
    try {
      const res = await axios.get(
        `${(await Config.get()).SERVER_URL}/settings`,
        await AuthService.getAuthHeader(),
      );
      if (res.data) {
        this.config.isDashboardPublic = !!res.data.isDashboardPublic;
        this.config.uploadToken = res.data.uploadToken || "";
      }
    } catch (err) {
      handleError(err);
    }
  },

  methods: {
    async saveSettings() {
      axios
        .put(
          `${(await Config.get()).SERVER_URL}/settings`,
          {
            isDashboardPublic: this.config.isDashboardPublic,
            uploadToken: this.config.uploadToken,
          },
          await AuthService.getAuthHeader(),
        )
        .catch(handleError);
    },
  },
});
</script>

<style scoped>
.settings-page {
  padding: 0.5em 0.5em 2em;
}
.settings-card {
  border: 1px solid #cfd8dc;
  border-radius: 6px;
  background: #fff;
  max-width: 640px;
}
.settings-section {
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
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1em;
  padding: 0.8em 0;
  border-bottom: 1px solid #eceff1;
}
.setting-row:last-of-type {
  border-bottom: none;
}
.setting-info {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  flex: 1;
  min-width: 0;
}
.setting-label {
  font-weight: 600;
  font-size: 0.9em;
  color: #37474f;
}
.setting-hint {
  font-size: 0.8em;
  color: #90a4ae;
  line-height: 1.3;
}
.setting-row--toggle {
  align-items: center;
}
.setting-input-wrap {
  flex-shrink: 0;
}
.setting-input {
  padding: 0.4em 0.6em;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  font-size: 0.85em;
  background: #fff;
  color: #455a64;
  width: 220px;
  box-sizing: border-box;
}
.setting-input::placeholder {
  color: #b0bec5;
}
.settings-actions {
  padding: 0.8em 1.2em 1.2em;
  display: flex;
  justify-content: flex-end;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}
.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #b0bec5;
  border-radius: 24px;
  transition: background 0.2s;
}
.toggle-slider::before {
  content: "";
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}
.toggle-switch input:checked + .toggle-slider {
  background: #1976d2;
}
.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

/* Shared button styles */
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

@media (prefers-color-scheme: dark) {
  .settings-card {
    background: #1e2a32;
    border-color: #455a64;
  }
  .section-title {
    color: #cfd8dc;
  }
  .setting-row {
    border-bottom-color: #37474f;
  }
  .setting-label {
    color: #cfd8dc;
  }
  .setting-input {
    background: #263238;
    color: #cfd8dc;
    border-color: #455a64;
  }
  .setting-input::placeholder {
    color: #546e7a;
  }
  .toggle-slider {
    background: #546e7a;
  }
}
</style>
