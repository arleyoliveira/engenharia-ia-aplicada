# Contract: README do OpsPilot

**Date**: 2026-09-28 | **Spec**: [spec.md](../spec.md)

Arquivo: `README.md` na raiz do OpsPilot, o diretório que contém `web/` e `package.json`. Criar se não existir. Se existir, acrescentar estas seções sem apagar o restante.

## Seções

1. **War room local.** `npm run dev` sobe a API na porta 3000. `npm run dev --prefix web` sobe a sala em `http://localhost:5173/opspilot/`.
2. **War room publicada.** A URL é `https://<owner>.github.io/<repo>/opspilot/`. Nas configurações do repositório, a origem do Pages fica em GitHub Actions. O workflow é o da raiz do git, `.github/workflows/pages.yml`.
3. **API.** O Pages serve só a interface. A URL da API é a da engrenagem da sala (`Configurar URL da API`). O valor inicial local é `http://localhost:3000`.

## Proibido no arquivo

- Valor de token, chave ou senha.
- Conteúdo de `.env` ou de `.env.*`.
- Instrução para commitar segredo.
