# notas-api

API Node.js para gerenciamento de notas, com TypeScript, Zod e uma interface de linha de comando para tarefas rápidas.

## Sobre o projeto

Este repositório já vem configurado com:

- Node.js em modo ES Modules
- TypeScript com configuração estrita
- Zod para validação de dados
- `tsx` para executar arquivos TypeScript sem build manual

## Pré-requisitos

- Node.js 18 ou superior
- npm instalado junto com o Node.js

## Como inicializar

Instale as dependências na raiz do projeto:

```bash
npm install
```

## Como executar

Durante o desenvolvimento:

```bash
npm run dev
```

Para executar a interface de linha de comando:

```bash
npm run cli
```

Para validar os tipos TypeScript:

```bash
npm run typecheck
```

Para rodar os testes:

```bash
npm run test
```

## Scripts disponíveis

- `dev`: executa `tsx src/index.ts`
- `cli`: executa `tsx src/cli.ts`
- `test`: roda os testes com o runner nativo do Node.js e `tsx`
- `typecheck`: executa `tsc --noEmit`

## Estrutura do projeto

```text
notas-api/
├── src/
│   ├── index.ts
│   └── cli.ts
├── package.json
├── tsconfig.json
├── .gitignore
└── README.MD
```

## Observações

- O diretório `dist/` é reservado para saída de compilação, quando houver build.
- Variáveis de ambiente devem ficar em arquivos `.env`, que já estão ignorados pelo Git.
