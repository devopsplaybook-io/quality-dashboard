<template>
  <div class="page">
    <p>QualityDashboard: Centralise your quality reports.</p>
  </div>
</template>

<script>
import { AuthService } from "~~/services/AuthService";

export default {
  data() {
    return {};
  },
  async created() {
    if (await AuthService.isAuthenticated()) {
      useRouter().push({ path: "/reports" });
    }
  },
};
</script>

<style scoped></style>
