<script setup>
function updateAppHeight() {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

onMounted(() => {
  updateAppHeight();
  window.addEventListener("resize", updateAppHeight);
  window.visualViewport?.addEventListener("resize", updateAppHeight);
});

onUnmounted(() => {
  window.removeEventListener("resize", updateAppHeight);
  window.visualViewport?.removeEventListener("resize", updateAppHeight);
});
</script>

<template>
  <div id="page-layout">
    <header>
      <Navigation />
    </header>
    <main>
      <NuxtPage />
    </main>
    <AlertMessages id="page-alert-messages" />
  </div>
</template>

<style>
/* Layout */

#page-layout {
  height: var(--app-height, 100dvh);
  display: grid;
  grid-template-rows: 2.5em 1fr;
  overflow: hidden !important;
  width: 100vw;
}

header,
main {
  padding: var(--space-md);
  overflow: hidden;
}

.page {
  height: 100%;
  overflow-y: auto;
  padding: 0 var(--space-loose);
}

#page-alert-messages {
  position: fixed;
  right: 3rem;
  bottom: 3rem;
  max-width: 80vw;
}

/* Common Component */

.actions i {
  font-size: 1.5em;
  cursor: pointer;
  margin-left: 0.5em;
  margin-right: 0.5em;
}

@media (prefers-color-scheme: dark) {
  .actions i {
    color: #bcc6ce;
  }
}
@media (prefers-color-scheme: light) {
  .actions i {
    color: #1d2832;
  }
}

/* Aninations */

.fade-in-slow {
  animation: fadeIn 2s;
}
.fade-in-fast {
  animation: fadeIn 0.5s;
}
@keyframes fadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.blink {
  transition: all 1s ease-in-out;
  animation: blink normal 3s infinite ease-in-out;
}
@keyframes blink {
  0% {
    color: inherit;
  }
  50% {
    color: #039be5;
  }
  100% {
    color: inherit;
  }
}
</style>
