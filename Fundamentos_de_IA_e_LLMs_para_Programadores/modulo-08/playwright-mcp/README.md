
# Playwright tests (Chromium only)

## Configuração local

1. Instale o Playwright test runner como dependência de desenvolvimento:

```bash
npm i -D @playwright/test
```

2. Instale apenas os binários do Chromium (menor/mais rápido):

```bash
npx playwright install --with-deps chromium
```

3. Executar os testes:

```bash
npm test
```

4. Para abrir o relatório HTML gerado:

```bash
npm run show-report
```

CI

O workflow em `.github/workflows/playwright.yml` instala apenas o Chromium e executa `npm test`. Em caso de falha, o relatório HTML é enviado como artefato.
