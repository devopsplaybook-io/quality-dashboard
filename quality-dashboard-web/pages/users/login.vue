<template>
  <div>
    <h2>User</h2>
    <div class="form">
      <div class="form-label">Username:</div>
      <div class="form-field">
        <input type="name" v-model="account.name" />
      </div>
      <div class="form-label">Password:</div>
      <div class="form-field">
        <input type="password" v-model="account.password" />
      </div>
    </div>
    <button v-on:click="login()">Login</button>
  </div>
</template>

<script>
import axios from "axios";
import Config from "~~/services/Config.ts";
import { handleError, EventBus, EventTypes } from "~~/services/EventBus";
import { AuthService } from "~~/services/AuthService";
import { UserService } from "~~/services/UserService";

export default defineComponent({
  data() {
    return {
      account: { password: "", name: "" },
    };
  },

  async created() {
    if (!await UserService.isInitialized()) {
      useRouter().push({ path: "/users/initialize" });
    }

    await ApplicationSetttingsStore().refresh()
  },
  methods: {
    async login() {
      if (this.account.name && this.account.password) {
        UserService.login(this.account.name, this.account.password)
          .then((res) => {
            AuthService.saveToken(res.data.token);
            useRouter().push({ path: "/" });      
          })
          .catch(handleError);
      } else {
        EventBus.emit(EventTypes.ALERT_MESSAGE, {
          type: "error",
          text: "Username or password missing",
        });
      }
    },
  },
});
</script>

<style>
</style>
