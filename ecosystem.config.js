const fs = require("fs");
let devEnv = {};
if (fs.existsSync("./env-dev.js")) {
  devEnv = require("./env-dev");
}

module.exports = {
  apps: [
    {
      name: "quality-dashboard-proxy",
      cwd: "quality-dashboard-proxy",
      script: "npm",
      args: "run start",
      autorestart: false,
      ignore_watch: ["node_modules"],
    },
    {
      name: "quality-dashboard-server",
      cwd: "quality-dashboard-server",
      script: "npm",
      args: "run dev",
      autorestart: true,
      env_development: {
        ...devEnv,
        DEV_MODE: "true",
        DATA_DIR: "../docs/dev/data",
        TMP_DIR: "../docs/dev/data/tmp",
        OPENTELEMETRY_COLLECTOR_HTTP: "http://localhost:4318/v1/traces",
        OPENTELEMETRY_COLLECTOR_AWS: true,
      },
    },
    {
      name: "quality-dashboard-web",
      cwd: "quality-dashboard-web",
      script: "npm",
      args: "run dev",
      autorestart: false,
      env_development: {
        DEV_MODE: "true",
      },
    },
  ],
};
