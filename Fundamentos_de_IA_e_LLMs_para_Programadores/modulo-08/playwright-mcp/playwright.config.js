const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 5000,
  use: {
    baseURL: 'https://erickwendel.github.io/vanilla-js-web-app-example/',
    headless: true,
    actionTimeout: 5000,
    navigationTimeout: 5000
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
    ,
    {
      name: 'chrome',
      use: { browserName: 'chromium', channel: 'chrome', headless: false }
    }
  ],
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]]
});
