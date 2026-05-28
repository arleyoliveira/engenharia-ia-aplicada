import { test } from '@playwright/test';

test('debug DOM', async ({ page }) => {
  await page.goto('https://erickwendel.github.io/vanilla-js-web-app-example/');
  await page.waitForLoadState('networkidle');
  const inputs = await page.$$eval('input', els => els.map(e => ({ id: e.id, type: e.type, placeholder: e.getAttribute('placeholder') })));
  console.log('inputs:', inputs);
  const hasTitle = await page.$('#title') !== null;
  const visible = await page.isVisible('#title');
  console.log('#title exists:', hasTitle, 'visible:', visible);
});
