# notas-api

## Stack
- Node 22 LTS.
- TypeScript em ESM, strict.
- Zod na fronteira HTTP/CLI.
- Testes com `node:test` via `tsx`.
- Sem framework HTTP; usar `node:http` de propósito.

## Comandos
- `npm run dev`: sobe a API em `localhost:3000`.
- `npm run cli`: executa a CLI.
- `npm run test`: roda os testes com `node --import tsx --test "src/**/*.test.ts"`.
- `npm run typecheck`: roda `tsc --noEmit`.

## Estrutura
- `src/domain`: tipos e Zod, sem IO.
- `src/store`: persistência in-memory.
- `src/service`: regras de negócio.
- `src/http`: transporte HTTP.
- `src/cli`: transporte CLI.
- `specs/`: specs guiando a implementação.

## Convenções
- Camadas não pulam: http/cli -> service -> store.
- Valide toda entrada externa com Zod.
- Erros de domínio são classes e viram resposta na borda.
- Nova lógica nasce com teste; `typecheck` e `test` devem ficar verdes.
- Nunca commitar segredos ou ler `.env`.

## Fluxo de trabalho
- `/especificar` -> revisão humana -> `/planejar` -> revisão humana -> `/tarefas` -> revisão humana -> `/implementar`.
- Artefatos ficam em `specs/`.
