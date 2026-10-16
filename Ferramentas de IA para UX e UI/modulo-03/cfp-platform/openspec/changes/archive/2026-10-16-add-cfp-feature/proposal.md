# Proposal

## Why

A plataforma CFP precisa permitir que palestrantes submetam propostas de palestras de forma segura, tipada e com uma experiência acessível e moderna. Atualmente, a aplicação possui apenas a casca inicial dos apps frontend e api, sem regras de negócio ou formulário de submissão. Esta proposta introduz o fluxo completo de Call for Papers consumindo o contrato compartilhado `SpeakerDTO`.

## What Changes

- **Backend (`apps/api` - NestJS)**:
  - Criação do endpoint POST `/api/speakers` (ou `/api/submissions`) para recepção e persistência em memória/serviço das submissões de palestras.
  - Implementação de DTO com validação rigorosa via `class-validator` e `class-transformer`, garantindo a validação de formato de e-mail, preenchimento de campos obrigatórios (`nome`, `talkTitle`, etc.) e tipos booleanos (`isGDE`).
  - Habilitação global do `ValidationPipe` do NestJS com `whitelist: true` e `forbidNonWhitelisted: true` para rejeição com `400 Bad Request` em caso de payloads inválidos.
  - Testes unitários com Jest cobrindo a aceitação de payloads válidos e a rejeição (400) de payloads inválidos.

- **Frontend (`apps/frontend` - Angular 21)**:
  - Criação do componente standalone do formulário de CFP (`CfpFormComponent` ou integrado na rota principal).
  - Utilização obrigatória de Signals (`signal`, `computed`) para gerenciar reatividade e estado do formulário (validação, loading, status de envio).
  - Aderência estrita aos padrões WAI-ARIA para acessibilidade (atributos `aria-describedby`, `aria-invalid`, `aria-live`, roles adequadas e feedback a leitores de tela).
  - Bloqueio reativo do botão de envio enquanto os critérios mínimos do formulário não forem atendidos ou durante o envio em andamento.
  - Testes unitários com Jest validando o estado inicial dos Signals e o bloqueio/desbloqueio do botão de submissão.

- **Shared (`shared-types`)**:
  - Consumo direto da interface `SpeakerDTO` exportada por `@cfp-platform/shared-types` tanto no frontend quanto no backend, garantindo alinhamento tipado ponto-a-ponto.

## Capabilities

### New Capabilities
- `cfp-submission`: Submissão e validação de propostas de palestras por palestrantes via API REST e interface Angular orientada a Signals e acessibilidade WAI-ARIA.

### Modified Capabilities
*(Nenhuma capacidade existente modificada, pois trata-se da primeira funcionalidade de negócio do sistema).*

## Impact

- **Dependências**: Adição de `class-validator` e `class-transformer` em `package.json` para suportar validação de decorators no NestJS.
- **APIs**: Novo endpoint POST `/api/speakers` com contrato `SpeakerDTO`.
- **Frontend**: Configuração do cliente HTTP (HttpClient com fetch) para envio de dados e adição da UI de submissão.
- **Contratos**: Utilização ativa do pacote `@cfp-platform/shared-types`.
