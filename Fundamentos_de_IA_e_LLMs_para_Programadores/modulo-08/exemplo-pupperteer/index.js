import puppeteer from 'puppeteer';
// Or import puppeteer from 'puppeteer-core';

// Launch the browser and open a new blank page.
const browser = await puppeteer.launch({
  headless: false,  // Mude para false se quiser ver o navegador (facilita debug)
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const page = await browser.newPage();

// Adicionar timeout maior e condition de carregamento menos rigorosa
try {
  await page.goto('https://developer.chrome.com/', {
    timeout: 60000,  // 60 segundos em vez de 30
    waitUntil: 'domcontentloaded'  // Espera apenas o DOM estar pronto (mais rápido)
    // Outras opções: 'load', 'networkidle0', 'networkidle2'
  });
} catch (error) {
  console.error('Erro ao carregar página:', error.message);
}

// Set the screen size.
await page.setViewport({width: 1080, height: 1024});

// Open the search menu using the keyboard.
await page.keyboard.press('/');

// Type into search box using accessible input name.
await page.locator('::-p-aria(Search)').fill('automate beyond recorder');

// Wait and click on first result.
await page.locator('.devsite-result-item-link').click();

// Locate the full title with a unique string.
const textSelector = await page
  .locator('::-p-text(Customize and automate)')
  .waitHandle();
const fullTitle = await textSelector?.evaluate(el => el.textContent);

// Print the full title.
console.log('The title of this blog post is "%s".', fullTitle);

await browser.close();