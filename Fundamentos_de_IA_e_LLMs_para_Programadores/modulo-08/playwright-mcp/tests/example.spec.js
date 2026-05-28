const { test, expect } = require('@playwright/test');

test('home page loads and responds', async ({ page }) => {
  const url = 'https://erickwendel.github.io/vanilla-js-web-app-example/';
  const response = await page.goto(url);
  expect(response, `Expected HTTP 200 but got ${response ? response.status() : 'no response'}`).not.toBeNull();
  expect(response.status(), `Expected HTTP 200 but got ${response.status()}`).toBe(200);
  const main = page.locator('main');
  await expect(main).toBeVisible();
});
