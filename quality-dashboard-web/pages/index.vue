<template>
  <div class="page">
    <p>QualityDashboard: Centralise your quality reports.</p>
  </div>
</template>

<script setup lang="ts">
onMounted(() => {
  useRouter().push({ path: "/reports" });
});
</script>

<style scoped></style>
