import {defineConfig,devices} from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  testMatch:"lab.spec.ts",
  fullyParallel:false,
  forbidOnly:Boolean(process.env.CI),
  retries:process.env.CI?1:0,
  workers:1,
  reporter:"list",
  timeout:45000,
  expect:{timeout:12000},
  use:{
    baseURL:"http://127.0.0.1:5179",
    ...devices["Pixel 7"],
    serviceWorkers:"allow",
    trace:"retain-on-failure",
    screenshot:"only-on-failure"
  },
  webServer:{
    command:"npm run dev -- --host 127.0.0.1 --port 5179 --strictPort",
    url:"http://127.0.0.1:5179/flexy-mini/demo.html",
    reuseExistingServer:!process.env.CI,
    timeout:120000
  }
});
