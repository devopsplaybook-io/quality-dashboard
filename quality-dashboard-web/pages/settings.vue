<template>
  <div>    
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
    if (!await AuthenticationStore().ensureAuthenticated()) {
      useRouter().push({ path: "/users/login" });
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
          await AuthService.getAuthHeader()
        )
        .catch(handleError);
    },
  },
});
</script>

<style>
</style>
