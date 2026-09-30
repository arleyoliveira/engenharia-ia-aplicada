# OpsPilot

## War room local

`npm run dev` sobe a API na porta 3000. `npm run dev --prefix web` sobe a sala em `http://localhost:5173/opspilot/`.

## War room publicada

A URL é `https://<owner>.github.io/<repo>/opspilot/`. Nas configurações do repositório, a origem do Pages fica em GitHub Actions. O workflow é o da raiz do git, `.github/workflows/pages.yml`.

## API

O Pages serve só a interface. A URL da API é a da engrenagem da sala (`Configurar URL da API`). O valor inicial local é `http://localhost:3000`.
