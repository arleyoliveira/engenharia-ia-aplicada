# Research: War room web

**Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

## R1. Onde vive a war room

- **Decision**: Pacote separado em `web/`, com `package.json`, Vite, React e TypeScript. `vite.config.ts` fixa `base: "/opspilot/"`. O servidor Express em `src/` não serve o bundle. Os scripts da raiz passam a encadear o typecheck e os testes de `web/` depois dos de `src/`.
- **Rationale**: A spec pede `web/` com Vite, React e TypeScript, e a base `/opspilot/`. Misturar o bundle no `tsconfig` NodeNext de `src/` quebra o `jsx` e o DOM. Encadear na raiz mantém o gate único da constituição (`npm run typecheck` e `npm run test`).
- **Alternatives considered**: Servir o build pelo Express (acopla o plantão ao processo da API e foge do prefixo próprio); um único `package.json` na raiz com Vite apontando para `web/` (os tipos de Node e de DOM colidem no mesmo `tsc`).

## R2. Como a sala é testada

- **Decision**: Vitest com jsdom e Testing Library em `web/`. Funções puras (URL do chat, leitura do trace, validação da URL da API, rótulo da decisão) ficam sem DOM e também rodam no Vitest. O `POST /chat` real continua em `node:test` (`src/http/server.test.ts`). O teste de “recarregar” remonta a árvore com o mesmo `localStorage` do jsdom.
- **Rationale**: `node:test` não oferece DOM. A spec pede fio, cartão, engrenagem e erro sem modelo e sem rede: isso é teste de interface com `fetch` substituído. A API (CORS e `decision`) não precisa de navegador.
- **Alternatives considered**: Só testes puros no `node:test` (não veem o cartão nem o foco); Playwright para o gate (rede e browser reais, fora do “sem rede externa”).

## R3. CORS

- **Decision**: Middleware no `createChatServer`, antes das rotas, só para o caminho `/chat`. Se a requisição traz `Origin`, a resposta repete esse valor em `Access-Control-Allow-Origin` e envia `Vary: Origin`. `OPTIONS /chat` responde `204` com `Access-Control-Allow-Methods: POST` e `Access-Control-Allow-Headers: Content-Type`. Não há `Access-Control-Allow-Credentials`. Sem header `Origin` (os testes atuais de `fetch` no Node), a resposta não ganha esses cabeçalhos.
- **Rationale**: A spec libera a origem da página, não uma lista fixa, e não usa cookie. Refletir `Origin` cobre o Vite (`http://localhost:5173`) e qualquer outra origem da engrenagem. `*` com o corpo JSON também seria legível, mas `Vary: Origin` deixa o cache honesto quando duas origens chamam o mesmo processo.
- **Alternatives considered**: Pacote `cors` (dependência nova para poucas linhas); lista em variável de ambiente (a spec não fecha a origem); CORS em todas as rotas (a sala só chama `/chat`).

## R4. Corpo de mensagem e corpo de decisão

- **Decision**: Dois objetos Zod estritos em `z.union`. O de mensagem é o `chatRequestSchema` atual (`message` obrigatória, sem `decision`). O de decisão é `{ conversationId, decision: "approve" | "deny" }` sem `message`. Os dois juntos, `decision` fora do enum, ou decisão sem `conversationId` caem no `400` com `issues`. O handler só chama `executeTurn` no ramo de mensagem.
- **Rationale**: A spec proíbe campo extra no turno de mensagem e proíbe `message` na decisão. Um schema único com os dois opcionais aceitaria corpo vazio ou os dois campos. A união estrita rejeita a interseção.
- **Alternatives considered**: `message` sintética `"aprovar"` (a spec diz que a decisão não é mensagem livre); um segundo path `/chat/decision` (a spec manda o mesmo `POST /chat`).

## R5. O que o servidor faz com approve e deny

- **Decision**: Não chama modelo nem `executeTurn`. `lastMessages(conversationId, 1)` confirma a conversa; `NotFoundError` vira `404` e não grava trace. No sucesso, a resposta é `200` com `answer` `"Aprovado."` ou `"Negado."`, `trace` de um evento `answer` (`node: "decisao"`), `metrics` `{ llmCalls: 0, latencyMs: 0 }` e o `requestId` de sempre. O `save` do trace usa o mesmo caminho do `200` de mensagem. Depois do `save`, a conversa recebe a fala do plantonista (`"Aprovar"` ou `"Negar"`) e a resposta do assistente. Esta feature não emite `202`.
- **Rationale**: A spec deixa o efeito da decisão para o plano e exige que um fake de teste possa devolver `200` ou um novo `202`. No servidor real não há interrupção do agente; devolver um turno determinístico mantém o fio e a auditoria do `200` sem rede. O `202` fica no contrato que a sala consome, produzido pelo fake dos testes de UI.
- **Alternatives considered**: Chamar o grafo com a decisão (rede e política de interrupção, fora de escopo); responder `202` vazio no servidor (a spec não pede que este processo interrompa); aceitar o JSON e responder `204` (a sala não teria `answer` para o fio).

## R6. URL da API e tema no navegador

- **Decision**: `localStorage` com as chaves `opspilot.apiBase` e `opspilot.theme`. Sem `opspilot.apiBase`, a base é `http://localhost:3000`. A URL do chat é a base sem barra final mais `/chat` (concatenação, não `new URL("/chat", base)`, para não apagar um path que o plantonista tenha colado). Válida só se `new URL` aceitar e o protocolo for `http:` ou `https:`. Tema `system` remove o atributo e deixa o CSS em `prefers-color-scheme`; `light` e `dark` gravam `data-theme` no documento. Valor desconhecido no storage cai no padrão.
- **Rationale**: A spec pede persistência neste navegador e uma única `/chat`. Concatenar preserva `http://localhost:3000/` e também `http://host/prefix`. O tema do sistema é a ausência de override, como nas instructions de design.
- **Alternatives considered**: `sessionStorage` (some ao fechar a aba); query string (não sobrevive como preferência); `new URL` com path absoluto `/chat` (descarta o prefixo da base).

## R7. Apresentação do trace e dos estados

- **Decision**: Função pura que, para cada evento, devolve tipo, `node` opcional e linhas de campo já em texto. `args` e listas viram JSON. Tipo desconhecido vira uma linha com o JSON do evento. A sala guarda um turno por resposta ou erro: mensagem do plantonista, depois resposta, cartão ou erro. Cartão decidido guarda `approve` ou `deny` e não mostra mais os botões. Erro de rede ou status `400`, `404`, `422`, `500`, `503`, `504` guarda o pedido que falhou para “tentar de novo” reenviar o mesmo corpo. Mensagem só com espaços não entra no fio e não chama `fetch`.
- **Rationale**: O painel tipado e o retry precisam ser afirmáveis sem olhar CSS. A função pura separa o formato do evento do componente.
- **Alternatives considered**: Renderizar o JSON cru do `trace` (a spec pede campos por tipo); guardar só a última resposta (perde o fio e o retry).
