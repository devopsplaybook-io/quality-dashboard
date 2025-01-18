<script setup lang="ts">
import UserService from "./services/UserService";
import { Timeout } from "@/services/Timeout";
</script>

<template>
  <div class="app">
    <div class="app-title">
      <h1 v-on:click="goto('/')">QualityDashboard</h1>
    </div>
    <div class="app-actions">
      <h2>
        <font-awesome-icon class="menu-icon" icon="tachometer-alt" v-on:click="goto('/')" />
        <font-awesome-icon class="menu-icon" icon="gear" v-on:click="goto('/settings')" />
      </h2>
    </div>
    <div class="app-content">
      <AlertMessages />
      <RouterView />
    </div>
  </div>
</template>

<script lang="ts">
import { appConfigStore } from "@/stores/appConfig";
import AlertMessages from "@/components/AlertMessages.vue";
import AlertService from "@/services/AlertService";

export default {
  components: { AlertMessages },
  data() {
    return {
      count: 1,
      isAuthInitialized: false,
      isInitialized: true,
    };
  },

  mounted() {
    const appConfig = appConfigStore();
    appConfig.$subscribe((mutation, state) => {
      if (!state.isAuthInitialized) {
        this.goto("/settings");
      }
    });
    UserService.refreshInitializationStatus();
    this.checkAuthentication();
  },
  methods: {
    async checkAuthentication() {
      await UserService.checkAuthentication().catch((err: Error) => {
        AlertService.send({
          text: `ERR: Connection to server failed (${err.message})`,
          type: "error",
        });
      });
      await Timeout.wait(30000);
      this.checkAuthentication();
    },
    async goto(path: string) {
      this.$router.push(path);
    },
  },
};
</script>

<style>
@import "@/assets/base.css";

body {
  padding: 0;
  margin: 0;
  background-color: #f0f0f0;
}

h1 {
  font-size: 180%;
}
h2 {
  font-size: 160%;
}
h3 {
  font-size: 140%;
}
h4 {
  font-size: 120%;
}

.app {
  font-family: "Avenir", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  display: grid;
  grid-template-rows: 5em 1fr;
  grid-template-columns: 1fr 1fr;
  padding: 0;
  margin: 0;
}

.app-title {
  grid-row: 1;
  grid-column: 1;
  padding-left: 5vw;
  padding-top: 1em;
  background-color: #3949ab;
  color: #eee;
}

.app-actions {
  grid-row: 1;
  grid-column: 2;
  text-align: right;
  padding-right: 5vw;
  padding-top: 1em;
  background-color: #3949ab;
  color: #eee;
}

.app-content {
  grid-row: 2;
  grid-column-start: 1;
  grid-column-end: 2 span;
  padding: 1em 5vw;
}

button {
  background-color: #039be5; /* Green */
  border: none;
  color: white;
  padding: 0.4em 0.8em;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 1em;
  margin-top: 0.4em;
  margin-bottom: 0.4em;
}

input {
  background-color: #fff; /* Green */
  border: solid 1px #666;
  padding: 0.4em 0.6em;
  font-size: 1em;
}

.menu-icon {
  margin-left: 0.6em;
}

.alert-message {
  background-color: #fff59d;
  padding: 2em;
}
</style>
