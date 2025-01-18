<template>
  <div class="settings-page">
    <div v-if="isAuthenticated" class="settings-login">
      <h1>User</h1>
      <div class="form">
        <p>You are logged in</p>
        <button v-on:click="logout()">Logout</button>
      </div>
      <div class="form">
        <div class="form-label">Change Password:</div>
        <div class="form-field">
          <input type="password" v-model="account.password" />
        </div>
        <button v-on:click="changePassword()">Save</button>
      </div>
    </div>
    <div v-else class="settings-login">
      <h2 v-if="isInitialized">User</h2>
      <h2 v-else>Create Admin Account</h2>
      <div class="form">
        <div class="form-label">Username:</div>
        <div class="form-field">
          <input type="username" v-model="account.username" />
        </div>
        <div class="form-label">Password:</div>
        <div class="form-field">
          <input type="password" v-model="account.password" />
        </div>
      </div>
      <button v-if="isInitialized" v-on:click="login()">Login</button>
      <button v-else v-on:click="createAdmin()">Create</button>
    </div>
    <div v-if="isAuthenticated" class="settings-app">
      <h1>Settting</h1>
      <div class="form">
        <div class="form-field">
          <input type="checkbox" id="isDashboardPublic" v-model="config.isDashboardPublic" />&nbsp;&nbsp;Make Dashboard
          Public
        </div>
        <div class="form-label">Upload Token:</div>
        <div class="form-field">
          <input type="password" v-model="config.uploadToken" />
        </div>
        <br />
        <button v-on:click="saveSettings()">Save</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import UserService from "@/services/UserService";
import AppConfigService from "@/services/AppConfigService";
import { appConfigStore } from "@/stores/appConfig";
import { userAuthenticationStore } from "@/stores/userAuthentication";
import AlertService from "@/services/AlertService";
import { defineComponent } from 'vue'

export default defineComponent({
  data() {
    return {
      isAuthenticated: false,
      uploadToken: "",
      isInitialized: true,
      account: { password: "", username: "" },
      config: { isDashboardPublic: false, uploadToken: "" },
    };
  },

  mounted() {
    const appConfig = appConfigStore();
    appConfig.$subscribe((mutation, state) => {
      this.config.isDashboardPublic = state.isDashboardPublic;
      this.config.uploadToken = state.uploadToken;
      this.isInitialized = state.isAuthInitialized;
    });
    this.isInitialized = appConfig.isAuthInitialized;
    this.config.isDashboardPublic = appConfig.isDashboardPublic;
    this.config.uploadToken = appConfig.uploadToken;

    const userAuthentication = userAuthenticationStore();
    userAuthentication.$subscribe((mutation, state) => {
      this.isAuthenticated = state.isAuthenticated;
    });
    this.isAuthenticated = userAuthentication.isAuthenticated;

    AppConfigService.refresh();
    UserService.refreshInitializationStatus();
  },
  methods: {
    async login() {
      if (!this.account.username || !this.account.password) {
        AlertService.send({ text: `Username/Password missing`, type: "error" });
      } else {
        await UserService.login(this.account.username, this.account.password);
        this.account.username = "";
        this.account.password = "";
      }
    },

    async createAdmin() {
      if (!this.account.username || !this.account.password) {
        AlertService.send({ text: `Username/Password missing`, type: "error" });
      } else {
        await UserService.addUser(this.account.username, this.account.password);
        this.account.username = "";
        this.account.password = "";
        UserService.refreshInitializationStatus();
      }
    },

    changePassword() {
      if (!this.account.password) {
        AlertService.send({ text: `Password Missing`, type: "error" });
      } else {
        UserService.updatePassword(this.account.password);
        this.account.username = "";
        this.account.password = "";
      }
    },

    logout() {
      UserService.logout();
    },

    saveSettings() {
      AppConfigService.update({
        isDashboardPublic: this.config.isDashboardPublic,
        uploadToken: this.config.uploadToken,
      });
    },
  },
});
</script>
<style>

.settings-page {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
}

@media only screen and (max-width: 600px) {
  .settings-page {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }

  .settings-app {
    padding-top: 2em;
  }

}

.settings-page .form {
  margin-top: 1em;
}
.settings-page .form-label {
  margin-top: 0.8em;
}
</style>
