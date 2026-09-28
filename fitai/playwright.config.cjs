const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  expect: { timeout: 7000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "./test-results",
  use: {
    baseURL: "http://127.0.0.1:5175",
    channel: "chrome",
    headless: true,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command:
      "npm run dev --workspace=client -- --host 127.0.0.1 --port 5175 --strictPort",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
    timeout: 30000,
    env: {
      VITE_API_URL: "http://127.0.0.1:4015",
      VITE_SUPABASE_URL: "https://fitai-local-qa.supabase.co",
      VITE_SUPABASE_ANON_KEY: "sb_publishable_local_test_only",
    },
  },
});
