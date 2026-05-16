<template>
  <div class="page">
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
</template>

<script>
import { AuthService } from "~~/services/AuthService";

export default defineComponent({
  data() {
    return {
      account: { password: "" },
    };
  },

  async created() {
    if (!(await AuthenticationStore().ensureAuthenticated())) {
      useRouter().push({ path: "/users/login" });
    }
  },

  methods: {
    changePassword() {
      if (!this.account.password) {
        AlertService.send({ text: `Password Missing`, type: "error" });
      } else {
        UserService.updatePassword(this.account.password);
        this.account.name = "";
        this.account.password = "";
      }
    },

    logout() {
      AuthService.removeToken();
      useRouter().push({ path: "/users/login" });
    },
  },
});
</script>

<style></style>
