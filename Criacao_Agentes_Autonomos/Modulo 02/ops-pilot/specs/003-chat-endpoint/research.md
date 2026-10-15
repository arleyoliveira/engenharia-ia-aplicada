# Research: Endpoint de Chat Operacional

**Date**: 2026-09-14 | **Feature**: [spec.md](spec.md)

Nenhuma pendência de esclarecimento permaneceu no contexto técnico. As decisões abaixo respeitam o contrato existente de `ReasoningStrategy`, a constituição do OpsPilot e o requisito de testes sem rede.

## R1. Borda HTTP Express injetável

- **Decision**: Criar uma fábrica `createChatServer(dependencies?)` em `src/http/server.ts` que devolve uma aplicação Express configurada com o parser JSON e a rota `POST /chat`.
- **Rationale**: A fábrica separa a configuração do servidor da abertura de porta, permitindo que o teste de integração envie requisições para a aplicação com um registry fake, sem modelo, OpenRouter ou credenciais.
- **Alternatives considered**: (a) escutar a porta dentro do módulo: dificulta testes e gerenciamento de ciclo de vida; (b) chamar Express diretamente de `src/index.ts`: mistura inicialização de processo com o contrato HTTP.

## R2. Schema de entrada e respostas de falha

- **Decision**: Validar `req.body` com Zod em um schema estrito: `{ message: string trim min(1), strategy?: string trim min(1), reflect?: boolean }`, aplicando defaults `strategy: "react"` e `reflect: false`. Falhas de parse/validação devolvem `400` com `{ issues }`; estratégia ausente devolve `422` com `{ error: { code: "UNKNOWN_STRATEGY", message } }`.
- **Rationale**: A validação na fronteira atende a constituição e dá ao consumidor distinção inequívoca entre erro de formato e seleção inválida.
- **Alternatives considered**: (a) coerção de `reflect` por string: aceita payloads ambíguos como `"true"`, contrariando a spec; (b) usar `404` para strategy: o endpoint existe, mas a opção de domínio é inválida, portanto `422` é mais precisa.

## R3. Registry central de estratégias

- **Decision**: Criar `src/agents/index.ts` com `createStrategyRegistry(strategies?)` e método `resolve(name, reflect)`. O registry padrão associa `react` e `plan-and-execute` a suas estratégias existentes; quando `reflect` é verdadeiro, o registry retorna `withReflection(base)`.
- **Rationale**: Centraliza nomes públicos e evita a repetição do mapa existente na arena e na futura rota HTTP. A injeção do mapa permite o cenário fake determinístico.
- **Alternatives considered**: (a) mapear estratégias dentro de cada controller: duplica regras e impede testes isolados; (b) registrar as variantes refletidas como nomes separados: não implementa corretamente o campo booleano `reflect` do contrato.

## R4. Timeout de 180 segundos

- **Decision**: Executar `strategy.run()` através de helper `runWithTimeout` que disputa a execução contra uma promessa que rejeita com erro de domínio de timeout após 180000 ms. O controller converte esse erro em `504`.
- **Rationale**: Limita a duração da requisição inteira, inclusive reflexão, sem alterar estratégias ou cancelar operações de domínio em curso.
- **Alternatives considered**: (a) timeout somente do servidor HTTP: não é determinístico para testes e pode deixar a requisição pendurada; (b) alterar cada estratégia: espalha uma responsabilidade de transporte.

## R5. Teste de integração sem rede

- **Decision**: Criar teste com `node:test` que instancia `createChatServer` com um registry fake determinístico e usa o servidor HTTP local efêmero apenas para emitir `fetch` contra `POST /chat`.
- **Rationale**: Exercita parsing JSON, validação, seleção, status e serialização HTTP reais, mantendo o comportamento repetível e sem qualquer chamada de LLM/rede externa.
- **Alternatives considered**: (a) testar somente o controller por chamada direta: não cobre a borda Express e o parser JSON; (b) usar a estratégia `react` real: exigiria credenciais e chamadas de rede.