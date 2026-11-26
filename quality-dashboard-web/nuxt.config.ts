// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  ssr: false,
  experimental: {
    viteEnvironmentApi: true,
  },
  // common-web ships raw .vue/.ts sources (no built layer), so it must be
  // aliased to its installed directory and transpiled by Nuxt.
  alias: {
    "@devopsplaybook.io/common-web": fileURLToPath(
      new URL("./node_modules/@devopsplaybook.io/common-web", import.meta.url),
    ),
  },
  build: {
    transpile: ["@devopsplaybook.io/common-web"],
  },
  vite: {
    optimizeDeps: {
      exclude: ["@devopsplaybook.io/common-web"],
    },
  },
  app: {
    head: {
      charset: "utf-16",
      viewport:
        "width=device-width, initial-scale=1, height=device-height, initial-scale=1.0, maximum-scale=1.0, user-scalable=no",
      title: "QualityDashboard",
      meta: [
        { name: "description", content: "QualityDashboard" },
        { name: "theme-color", content: "#212121" },
      ],
      link: [
        { rel: "manifest", href: "/manifest.json" },
        { rel: "icon", href: "/icon.svg" },
        { rel: "stylesheet", href: "/styles.css" },
      ],
    },
  },
  css: ["~/assets/css/app.css"],
  modules: ["@pinia/nuxt"],
  imports: {
    dirs: ["./stores"],
  },
  pinia: {
    autoImports: ["defineStore", "acceptHMRUpdate"],
  },
});
