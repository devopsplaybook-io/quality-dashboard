<template>
  <div>
    <div v-for="message in messages" v-bind:key="message.text">
      <div :class="'message message-' + message.type">
        <b>{{ message.type }}</b>
        {{ message.text }}
      </div>
    </div>
  </div>
</template>

<script>
import { EventBus, EventTypes } from "~~/services/EventBus";

export default {
  name: "AlertMessages",
  data() {
    return {
      messages: [],
    };
  },
  async created() {
    EventBus.on(EventTypes.ALERT_MESSAGE, (message) => {
      this.messages.push(message);
      setTimeout(() => {
        this.messages.splice(0, 1);
      }, 5000);
    });
  },
};
</script>
<style>
.message {
  padding: 1rem;
  margin: 1rem;
  color: #eee;
}
.message {
  background-color: var(--color-text-secondary);
}
.message-info {
  background-color: var(--color-success);
}
.message-error {
  background-color: var(--color-danger);
}
</style>
