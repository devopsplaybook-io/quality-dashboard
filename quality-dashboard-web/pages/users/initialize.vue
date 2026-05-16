<template>
  <div class="page">
    <h2>Create Admin Account</h2>
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
    <button v-on:click="createAdmin()">Create</button>
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

  // async created() {
  //   await ApplicationSetttingsStore().refresh()
  // },
  async created() {
    if (await UserService.isInitialized()) {
      useRouter().push({ path: "/users/login" });
    }

    await ApplicationSetttingsStore().refresh();
    if (ApplicationSetttingsStore().isInitialized) {
      useRouter().push({ path: "/users/login" });
    }
  },
  methods: {
    async createAdmin() {
      if (this.account.name && this.account.password) {
        axios
          .post(
            `${(await Config.get()).SERVER_URL}/users`,
            {
              name: this.account.name,
              password: this.account.password,
            },
            await AuthService.getAuthHeader(),
          )
          .then(async (response) => {
            return axios.post(
              `${(await Config.get()).SERVER_URL}/users/login`,
              {
                name: this.account.name,
                password: this.account.password,
              },
              await AuthService.getAuthHeader(),
            );
          })
          .then((response) => {
            AlertService.send({ text: `User Created`, type: "info" });
            useRouter().push({ path: "/settings" });
          })
          .catch(handleError);
      } else {
        EventBus.emit(EventTypes.ALERT_MESSAGE, {
          type: "error",
          text: "Username or password missing",
        });
      }

      // if (!this.account.name || !this.account.password) {
      //   AlertService.send({ text: `Username/Password missing`, type: "error" });
      // } else {
      //   await UserService.addUser(this.account.name, this.account.password);
      //   this.account.name = "";
      //   this.account.password = "";
      //   UserService.refreshInitializationStatus();
      // }
    },
  },
});
</script>
<style></style>
