
# Better Auth + Next.js (demo)

Demo mínimo: Next.js (App Router) + Better Auth + GitHub OAuth + SQLite.

Passos essenciais:

1) Instalar dependências
```bash
npm install --legacy-peer-deps
```

2) Criar o arquivo de variáveis de ambiente

Crie `.env.local` na raiz do projeto com estes valores (substitua pelos seus):

```
GITHUB_CLIENT_ID=seu_client_id
GITHUB_CLIENT_SECRET=seu_client_secret
NEXT_PUBLIC_AUTH_BASE_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
```

Como obter `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET`:

- Acesse https://github.com/settings/developers → "OAuth Apps" → "New OAuth App".
- Use `http://localhost:3000` como Homepage URL.
- Defina a Authorization callback URL conforme instruído pelo GitHub (ex: `http://localhost:3000/api/auth/callback`).
- Copie `Client ID` e `Client Secret` para o `.env.local`.

3) Gerar as tabelas do Better Auth
```bash
npm run migrate
```

4) Rodar em desenvolvimento
```bash
npm run dev
```

5) Teste rápido

- Abra `http://localhost:3000` e clique em "Entrar com GitHub" — você será redirecionado para o fluxo OAuth do GitHub.

Boas práticas:

- Nunca comite `.env.local` no repositório. Adicione-o ao `.gitignore` (ex.: `.gitignore` inclui `node_modules` e `.env.local`).
- Se alterar `.env.local`, reinicie o servidor dev com `npm run dev`.

