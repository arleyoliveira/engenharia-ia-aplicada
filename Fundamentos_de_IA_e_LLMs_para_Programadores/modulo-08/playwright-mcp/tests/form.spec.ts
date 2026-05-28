import { test, expect } from '@playwright/test';

test.use({ baseURL: 'https://erickwendel.github.io/vanilla-js-web-app-example/' });

test('submits form and updates list', async ({ page }) => {
  const url = 'https://erickwendel.github.io/vanilla-js-web-app-example/';
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('#title', { timeout: 10000 });
  const beforeCount = await page.locator('main article').count();
  const title = `Test Image ${Date.now()}`;
  const titleBox = page.locator('#title');
  const urlBox = page.locator('#imageUrl');
  const imageUrl = 'https://www.pixelcut.ai/pt-br/remover-fundo/fazer-png';
  await titleBox.fill(title);
  await urlBox.fill(imageUrl);
  await page.locator('#btnSubmit').click();
  await expect(page.locator('main article')).toHaveCount(beforeCount + 1, { timeout: 10000 });
  const added = page.locator('main article').filter({ hasText: title }).first();
  await expect(added).toBeVisible();
  await expect(added.getByRole('heading')).toHaveText(title);
  // Verify the added image src matches the submitted URL
  const imgSrc = await added.locator('img').getAttribute('src');
  expect(imgSrc, `expected image src to contain submitted URL`).toContain(imageUrl);
});

test('form validation: title required', async ({ page }) => {
  const url = 'https://erickwendel.github.io/vanilla-js-web-app-example/';
  await page.goto(url);
  const beforeCount = await page.locator('main article').count();
  // leave title empty
  const titleBox = page.locator('#title');
  const urlBox = page.locator('#imageUrl');
  await titleBox.fill('');
  await urlBox.fill('https://example.com/test.png');
  await page.locator('#btnSubmit').click();
  // Expect the list not to grow when title is empty
  await expect(page.locator('main article')).toHaveCount(beforeCount);
});
