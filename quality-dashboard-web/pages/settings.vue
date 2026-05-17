<template>
  <div class="page settings-page">
    <!-- Tab Navigation -->
    <div class="settings-tabs">
      <button
        class="settings-tab"
        :class="{ active: currentTab === 'users' }"
        @click="currentTab = 'users'"
      >
        <i class="bi bi-people-fill"></i> User Management
      </button>
      <button
        class="settings-tab"
        :class="{ active: currentTab === 'reports' }"
        @click="currentTab = 'reports'"
      >
        <i class="bi bi-shield-lock"></i> Reports Settings
      </button>
    </div>

    <!-- ======================== USER MANAGEMENT TAB ======================== -->
    <div v-if="currentTab === 'users'" class="settings-card">
      <div class="settings-section">
        <div class="section-header">
          <h3 class="section-title">
            <i class="bi bi-people-fill"></i>
            User Management
          </h3>
          <button class="btn-primary btn-sm" @click="openCreateUser()">
            <i class="bi bi-person-plus"></i> Create User
          </button>
        </div>
        <p class="section-desc">
          Manage users, roles, and permissions. At least one admin must exist.
        </p>

        <!-- Users Table -->
        <div class="users-table-wrap" v-if="users.length > 0">
          <table class="users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Permissions</th>
                <th class="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td>
                  <span class="user-name">{{ u.name }}</span>
                  <span v-if="u.id === currentUserId" class="badge-self"
                    >You</span
                  >
                </td>
                <td>
                  <span
                    class="role-badge"
                    :class="u.role === 'admin' ? 'role-admin' : 'role-user'"
                  >
                    {{ u.role }}
                  </span>
                </td>
                <td class="perms-cell">
                  <span v-if="u.role === 'admin'" class="perm-text"
                    >All permissions</span
                  >
                  <span v-else class="perm-list">
                    <i
                      class="bi"
                      :class="
                        u.permissions?.canConfigureDashboards
                          ? 'bi-check-circle-fill text-green'
                          : 'bi-x-circle-fill text-muted'
                      "
                    ></i>
                    Dashboards
                    <i
                      class="bi"
                      :class="
                        u.permissions?.canConfigureReportTags
                          ? 'bi-check-circle-fill text-green'
                          : 'bi-x-circle-fill text-muted'
                      "
                    ></i>
                    Tags
                  </span>
                </td>
                <td class="col-actions">
                  <button
                    class="icon-btn"
                    title="Edit"
                    @click="openEditUser(u)"
                  >
                    <i class="bi bi-pencil-fill"></i>
                  </button>
                  <button
                    class="icon-btn icon-btn--danger"
                    title="Delete"
                    :disabled="u.id === currentUserId"
                    @click="confirmDeleteUser(u)"
                  >
                    <i class="bi bi-trash3-fill"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty-state">
          <i class="bi bi-people"></i>
          <p>No users found.</p>
        </div>
      </div>
    </div>

    <!-- ======================== REPORTS SETTINGS TAB ======================== -->
    <div v-if="currentTab === 'reports'" class="settings-card">
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

    <!-- ======================== CREATE/EDIT USER MODAL ======================== -->
    <div v-if="showUserModal" class="modal" @click.self="closeUserModal">
      <div class="modal-card">
        <div class="modal-header">
          <h3>
            <i
              :class="editingUser ? 'bi bi-pencil-fill' : 'bi bi-person-plus'"
            ></i>
            {{ editingUser ? "Edit User" : "Create User" }}
          </h3>
          <button class="icon-btn" @click="closeUserModal">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="field-row">
            <label class="field-label">Username</label>
            <input
              type="text"
              v-model="userForm.name"
              placeholder="Enter username"
              class="field-input"
              :disabled="!!editingUser"
            />
          </div>
          <div class="field-row">
            <label class="field-label">
              {{
                editingUser
                  ? "New Password (leave blank to keep current)"
                  : "Password"
              }}
            </label>
            <input
              type="password"
              v-model="userForm.password"
              :placeholder="
                editingUser ? 'Leave blank to keep' : 'Enter password'
              "
              class="field-input"
            />
          </div>
          <div class="field-row">
            <label class="field-label">Role</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" v-model="userForm.role" value="user" />
                User
              </label>
              <label class="radio-label">
                <input type="radio" v-model="userForm.role" value="admin" />
                Admin
              </label>
            </div>
          </div>

          <!-- Permissions (only for non-admin) -->
          <div v-if="userForm.role !== 'admin'" class="perms-section">
            <label class="field-label">Permissions</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  v-model="userForm.permissions.canConfigureDashboards"
                />
                Can Configure Dashboards
              </label>
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  v-model="userForm.permissions.canConfigureReportTags"
                />
                Can Configure Report Tags
              </label>
            </div>
          </div>
          <div v-else class="perms-section">
            <p class="perm-note">
              <i class="bi bi-info-circle-fill"></i>
              Admins have all permissions by default.
            </p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeUserModal">Cancel</button>
          <button class="btn-primary" :disabled="savingUser" @click="saveUser">
            <i class="bi bi-check-lg"></i>
            {{ savingUser ? "Saving…" : "Save" }}
          </button>
        </div>
      </div>
    </div>

    <!-- ======================== DELETE CONFIRM MODAL ======================== -->
    <div
      v-if="showDeleteConfirm"
      class="modal"
      @click.self="showDeleteConfirm = false"
    >
      <div class="modal-card modal-card--sm">
        <div class="modal-header">
          <h3>
            <i class="bi bi-exclamation-triangle-fill text-warning"></i> Delete
            User
          </h3>
          <button class="icon-btn" @click="showDeleteConfirm = false">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="modal-body">
          <p>
            Are you sure you want to delete user
            <strong>{{ deleteTarget?.name }}</strong
            >?
          </p>
          <p class="text-muted">This action cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showDeleteConfirm = false">
            Cancel
          </button>
          <button
            class="btn-danger"
            :disabled="deletingUser"
            @click="executeDelete"
          >
            <i class="bi bi-trash3-fill"></i>
            {{ deletingUser ? "Deleting…" : "Delete" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { AuthService } from "~~/services/AuthService";
import { UserService } from "~~/services/UserService";
import axios from "axios";
import Config from "~~/services/Config.ts";
import { handleError, EventBus, EventTypes } from "~~/services/EventBus";

export default defineComponent({
  data() {
    return {
      currentTab: "reports",
      config: { isDashboardPublic: false, uploadToken: "" },
      // Users
      users: [],
      currentUserId: null,
      showUserModal: false,
      editingUser: null,
      savingUser: false,
      userForm: {
        name: "",
        password: "",
        role: "user",
        permissions: {
          canConfigureDashboards: false,
          canConfigureReportTags: false,
        },
      },
      showDeleteConfirm: false,
      deleteTarget: null,
      deletingUser: false,
    };
  },

  async created() {
    const auth = AuthenticationStore();
    await auth.ensureAuthenticated();
    if (!auth.isAdmin) {
      useRouter().push({ path: "/" });
      return;
    }
    this.currentUserId = auth.userId;
    await this.loadSettings();
    await this.loadUsers();
  },

  methods: {
    async loadSettings() {
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

    async loadUsers() {
      try {
        const res = await UserService.list();
        this.users = res.data || [];
      } catch (err) {
        handleError(err);
      }
    },

    async saveSettings() {
      try {
        await axios.put(
          `${(await Config.get()).SERVER_URL}/settings`,
          {
            isDashboardPublic: this.config.isDashboardPublic,
            uploadToken: this.config.uploadToken,
          },
          await AuthService.getAuthHeader(),
        );
        EventBus.emit(EventTypes.ALERT_MESSAGE, {
          type: "info",
          text: "Settings saved",
        });
      } catch (err) {
        handleError(err);
      }
    },

    // ============ User Management ============

    resetUserForm() {
      this.userForm = {
        name: "",
        password: "",
        role: "user",
        permissions: {
          canConfigureDashboards: false,
          canConfigureReportTags: false,
        },
      };
    },

    openCreateUser() {
      this.editingUser = null;
      this.resetUserForm();
      this.showUserModal = true;
    },

    openEditUser(user) {
      this.editingUser = user;
      this.userForm = {
        name: user.name,
        password: "",
        role: user.role,
        permissions: {
          canConfigureDashboards:
            user.permissions?.canConfigureDashboards || false,
          canConfigureReportTags:
            user.permissions?.canConfigureReportTags || false,
        },
      };
      this.showUserModal = true;
    },

    closeUserModal() {
      this.showUserModal = false;
      this.editingUser = null;
      this.resetUserForm();
    },

    async saveUser() {
      this.savingUser = true;
      try {
        if (this.editingUser) {
          const payload = {
            role: this.userForm.role,
            permissions: this.userForm.permissions,
          };
          if (this.userForm.password) {
            payload.password = this.userForm.password;
          }
          await UserService.update(this.editingUser.id, payload);
          EventBus.emit(EventTypes.ALERT_MESSAGE, {
            type: "info",
            text: "User updated",
          });
        } else {
          if (!this.userForm.name || !this.userForm.password) {
            EventBus.emit(EventTypes.ALERT_MESSAGE, {
              type: "error",
              text: "Username and password required",
            });
            this.savingUser = false;
            return;
          }
          await UserService.create({
            name: this.userForm.name,
            password: this.userForm.password,
            role: this.userForm.role,
            permissions: this.userForm.permissions,
          });
          EventBus.emit(EventTypes.ALERT_MESSAGE, {
            type: "info",
            text: "User created",
          });
        }
        this.closeUserModal();
        await this.loadUsers();
      } catch (err) {
        handleError(err);
      } finally {
        this.savingUser = false;
      }
    },

    confirmDeleteUser(user) {
      this.deleteTarget = user;
      this.showDeleteConfirm = true;
    },

    async executeDelete() {
      this.deletingUser = true;
      try {
        await UserService.delete(this.deleteTarget.id);
        EventBus.emit(EventTypes.ALERT_MESSAGE, {
          type: "info",
          text: "User deleted",
        });
        this.showDeleteConfirm = false;
        this.deleteTarget = null;
        await this.loadUsers();
      } catch (err) {
        handleError(err);
      } finally {
        this.deletingUser = false;
      }
    },
  },
});
</script>

<style scoped>
.settings-page {
  padding: 0.5em 0.5em 2em;
}

/* Tabs */
.settings-tabs {
  display: flex;
  gap: 0.25em;
  margin-bottom: 1em;
  border-bottom: 1px solid #cfd8dc;
  padding-bottom: 0;
}
.settings-tab {
  padding: 0.5em 1em;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  background: transparent;
  cursor: pointer;
  font-size: 0.85em;
  color: #546e7a;
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  transition: all 0.15s;
  margin-bottom: -1px;
}
.settings-tab:hover {
  background: #eceff1;
  color: #263238;
}
.settings-tab.active {
  background: #fff;
  border-color: #cfd8dc;
  color: #1976d2;
  font-weight: 600;
}

@media (prefers-color-scheme: dark) {
  .settings-tabs {
    border-bottom-color: #455a64;
  }
  .settings-tab {
    color: #b0bec5;
  }
  .settings-tab:hover {
    background: #263238;
    color: #cfd8dc;
  }
  .settings-tab.active {
    background: #1e2a32;
    border-color: #455a64;
    color: #64b5f6;
  }
}

/* Card */
.settings-card {
  border: 1px solid #cfd8dc;
  border-radius: 6px;
  background: #fff;
  max-width: 800px;
}
.settings-section {
  padding: 1.2em 1.2em 0.6em;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5em;
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

/* Setting rows (re-used from existing) */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1em;
  padding: 0.8em 0;
  border-bottom: 1px solid #eceff1;
}
@media (max-width: 480px) {
  .setting-row {
    flex-direction: column;
    gap: 0.5em;
  }
  .setting-row--toggle {
    flex-direction: row;
  }
  .setting-input {
    max-width: 100%;
  }
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
  width: 100%;
  max-width: 280px;
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

/* Users Table */
.users-table-wrap {
  overflow-x: auto;
}
.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85em;
}
.users-table th,
.users-table td {
  text-align: left;
  padding: 0.6em 0.5em;
  border-bottom: 1px solid #eceff1;
}
.users-table th {
  font-weight: 600;
  color: #546e7a;
  white-space: nowrap;
}
.users-table tbody tr:hover {
  background: #f5f7f8;
}
.col-actions {
  text-align: right;
  white-space: nowrap;
}
.user-name {
  font-weight: 500;
  color: #263238;
}
.badge-self {
  display: inline-block;
  font-size: 0.75em;
  padding: 0.1em 0.4em;
  border-radius: 3px;
  background: #e3f2fd;
  color: #1976d2;
  margin-left: 0.4em;
  vertical-align: middle;
}
.role-badge {
  display: inline-block;
  font-size: 0.8em;
  padding: 0.15em 0.5em;
  border-radius: 3px;
  font-weight: 500;
}
.role-admin {
  background: #fce4ec;
  color: #c62828;
}
.role-user {
  background: #e8f5e9;
  color: #2e7d32;
}
.perms-cell {
  font-size: 0.82em;
  color: #546e7a;
}
.perm-text {
  color: #78909c;
  font-style: italic;
}
.perm-list {
  display: flex;
  align-items: center;
  gap: 0.3em;
  white-space: nowrap;
}
.perm-list .bi {
  font-size: 0.9em;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25em 0.4em;
  color: #78909c;
  border-radius: 3px;
  transition: all 0.15s;
}
.icon-btn:hover {
  background: #eceff1;
  color: #263238;
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.icon-btn--danger:hover {
  background: #fce4ec;
  color: #c62828;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-card {
  background: #fff;
  border-radius: 8px;
  max-width: 480px;
  width: 90vw;
  padding: 1em 1.2em;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}
.modal-card--sm {
  max-width: 380px;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 0.5em;
}
.modal-header h3 {
  margin: 0;
  font-size: 1em;
  display: flex;
  align-items: center;
  gap: 0.4em;
  color: #263238;
}
.modal-body {
  padding: 0.5em 0 1em;
}
.modal-body p {
  margin: 0.5em 0;
  font-size: 0.9em;
  color: #455a64;
}
.modal-footer {
  padding: 0.8em 0 0;
  display: flex;
  justify-content: flex-end;
  gap: 0.5em;
}

/* Form fields */
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
.field-input:disabled {
  background: #f5f7f8;
  color: #90a4ae;
}
.radio-group {
  display: flex;
  gap: 1em;
}
.radio-label {
  display: flex;
  align-items: center;
  gap: 0.3em;
  font-size: 0.9em;
  color: #455a64;
  cursor: pointer;
}
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.4em;
  font-size: 0.9em;
  color: #455a64;
  cursor: pointer;
}
.perms-section {
  margin-top: 0.3em;
}
.perm-note {
  font-size: 0.82em;
  color: #78909c;
  display: flex;
  align-items: center;
  gap: 0.3em;
}

@media (prefers-color-scheme: dark) {
  .settings-card {
    background: #1e2a32;
    border-color: #455a64;
  }
  .section-title {
    color: #cfd8dc;
  }
  .section-desc {
    color: #90a4ae;
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
  .users-table th,
  .users-table td {
    border-bottom-color: #37474f;
  }
  .users-table th {
    color: #90a4ae;
  }
  .users-table tbody tr:hover {
    background: #263238;
  }
  .user-name {
    color: #cfd8dc;
  }
  .badge-self {
    background: #1a3a5c;
    color: #64b5f6;
  }
  .radio-label,
  .checkbox-label {
    color: #b0bec5;
  }
  .icon-btn:hover {
    background: #263238;
    color: #b0bec5;
  }
  .icon-btn--danger:hover {
    background: #2d1a1a;
    color: #ef5350;
  }
}
</style>
