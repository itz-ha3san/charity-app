import {defineConfig,devices} from '@playwright/test';
const port=process.env.QA_PORT||'4173';
export default defineConfig({
 testDir:'./tests/e2e',fullyParallel:false,workers:1,forbidOnly:!!process.env.CI,
 retries:0,timeout:45000,expect:{timeout:12000},
 reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:`http://127.0.0.1:${port}`,serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure',video:'off',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}},
 webServer:{command:'node scripts/start-e2e.mjs',url:`http://127.0.0.1:${port}/ready`,reuseExistingServer:false,timeout:120000},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'mobile',use:{...devices['Pixel 7']}}],
});
