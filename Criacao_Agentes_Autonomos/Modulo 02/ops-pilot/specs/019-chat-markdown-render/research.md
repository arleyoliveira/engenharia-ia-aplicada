# Research: Respostas em Markdown na war room

**Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

## R1. Biblioteca de renderização

- **Decision**: `react-markdown` (v10) com `remark-gfm` para listas de tarefa e tabelas GFM opcionais, e `rehype-sanitize` com o schema default estendido só o necessário (links `href` http/https, cabeçalhos, listas, código). Parsing e transformação rodam no browser; a string `answer` continua opaca na API.
- **Rationale**: O ecossistema remark/rehype é o padrão de facto em React, combina bem com Vitest/jsdom, e `rehype-sanitize` cobre FR-003 sem reinventar allowlist. `remark-gfm` atende FR-002 (listas, links, cercas) com pouca configuração. Alternativas como `marked` + `DOMPurify` exigem `dangerouslySetInnerHTML` e duplicam política de sanitização.
- **Alternatives considered**: `marked` + DOMPurify (dois passos e HTML intermediário); parser próprio (fora de escopo e frágil para edge cases); `@uiw/react-markdown-preview` (bundle maior e menos controle sobre componentes e imagens).

## R2. Onde fica a lógica (MVC da sala)

- **Decision**: Componente `AnswerBody` em `web/src/ui/AnswerBody.tsx` recebe `answer: string` e renderiza o Markdown. Funções puras em `web/src/model/answer-markdown.ts` definem o mapa de cabeçalhos (deslocamento de nível), validação de `href` permitido (`http:` / `https:`) e política de imagens (sem `<img>` remoto). `WarRoom.tsx` troca `<p>{turn.answer}</p>` por `<AnswerBody answer={turn.answer} />`. Nenhuma mudança em `src/` da API.
- **Rationale**: A constituição pede funções puras para formatação separadas de componentes (padrão já usado em `trace-lines.ts`). O turno em `thread.ts` permanece string; não há entidade persistida nova.
- **Alternatives considered**: Markdown inline só em `WarRoom.tsx` (mistura view e regras de segurança); pipeline no servidor (viola FR-009 e duplica sanitização).

## R3. Hierarquia de cabeçalhos dentro do balão

- **Decision**: Cabeçalhos Markdown `#` … `###` viram elementos `h2` … `h4` no DOM (`h1` do Markdown vira `h2`, etc.). Cabeçalhos acima de `###` no source (`####` e mais) continuam como `h4` (teto visual). Fora do balão, o único `h1` da página continua sendo "War room".
- **Rationale**: FR-008 proíbe `h1` extra na página e alinha com a regra de design (um `h1` por página; hierarquia desce sem pular nível relativa ao contexto do artigo da resposta, começando em `h2`).
- **Alternatives considered**: Manter `h1`–`h3` literais do Markdown (criaria segundo `h1` na página); renderizar cabeçalhos como `<p>` com classe (perde semântica e FR de acessibilidade).

## R4. Links e imagens

- **Decision**: Links externos via componente customizado: `target="_blank"`, `rel="noopener noreferrer"`, e `href` só se passar validação http/https (links `javascript:` ou esquemas desconhecidos viram `<span>` com texto visível ou link desativado). Imagens: componente `img` que não carrega URL — renderiza apenas o texto alternativo entre colchetes ou omite o nó (comportamento fixo escolhido na implementação e coberto por teste).
- **Rationale**: FR-004 e edge case de imagens remotas na spec. `rehype-sanitize` já remove scripts; a camada extra em links cobre tabnabbing e esquemas perigosos que às vezes escapam de configs permissivas.
- **Alternatives considered**: Abrir links na mesma aba (viola FR-004); permitir `data:` URLs (risco desnecessário); carregar imagens remotas (fora de escopo explícito).

## R5. Estilos e temas

- **Decision**: Classe wrapper `.answer-md` no artigo da resposta; filhos (`p`, `ul`, `ol`, `h2`–`h4`, `code`, `pre`, `a`, `table`) usam tokens existentes (`--text`, `--text-muted`, `--accent`, `--border`, `--surface-raised`) e escala de espaçamento 4–48 em `web/src/styles.css`. Blocos `pre`/`code` usam fundo `--surface-raised` e borda `--border`.
- **Rationale**: FR-007 e `.cursor/rules/design.mdc` — sem hex solto nos componentes. Reutilizar tokens já usados pela war room mantém contraste claro/escuro.
- **Alternatives considered**: CSS-in-JS (não usado no projeto); pacote de tema pronto tipo GitHub (cores fixas quebram tokens).

## R6. Testes

- **Decision**: Vitest + Testing Library em `web/src/ui/AnswerBody.test.tsx` (ou casos adicionais em `WarRoom.test.tsx`): cabeçalho e lista visíveis; prosa simples; usuário inalterado; payload com `<script>` sem nó executável; link `https` com `target` e `rel`. Testes puros em `answer-markdown.test.ts` para mapa de heading e filtro de URL. Gate da raiz inalterado: `npm run typecheck` e `npm run test`.
- **Rationale**: FR-010 e constituição IV. jsdom não executa scripts de forma confiável para todos os vetores; assertir ausência de `script` no container e `href` seguro é o padrão do projeto.
- **Alternatives considered**: Só teste E2E (rede/browser, fora do gate atual); confiar só na biblioteca sem testes de integração na sala.
