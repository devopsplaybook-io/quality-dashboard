import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      // `~~` must win over `~` (aliases match by prefix).
      { find: "~~", replacement: root },
      { find: "~", replacement: root },
      {
        find: "@devopsplaybook.io/common-web",
        replacement: fileURLToPath(
          new URL("./node_modules/@devopsplaybook.io/common-web", import.meta.url),
        ),
      },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.spec.ts"],
    server: {
      deps: {
        inline: ["@devopsplaybook.io/common-web"],
      },
    },
  },
});
