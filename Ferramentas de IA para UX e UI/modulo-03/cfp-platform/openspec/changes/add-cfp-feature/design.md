# Design

## Context

A plataforma é estruturada como um Nx Monorepo composto pelos apps `api` (NestJS) e `frontend` (Angular 21) e pela biblioteca de contratos `shared-types` (`@cfp-platform/shared-types`). A biblioteca já exporta a interface `SpeakerDTO` contendo `id`, `nome`, `email`, `talkTitle` e `isGDE`.

Ver `proposal.md` para motivação e escopo geral.

## Goals / Non-Goals

**Goals:**
- Implementar o backend NestJS com controller e service dedicados a palestrantes/propostas, garantindo validação em tempo de execução via `class-validator` e `class-transformer` com rejeição automática (400 Bad Request) para payloads inválidos ou com campos não permitidos.
- Implementar componente Standalone no Angular 21 usando Signals para reatividade granular e WAI-ARIA para conformidade total de acessibilidade.
- Compartilhar e respeitar estritamente o contrato `SpeakerDTO` da lib `shared-types`.
- Estruturar bateria de testes unitários com Jest tanto no NestJS quanto no Angular.

**Non-Goals:**
- Integração com banco de dados externo ou ORM nesta fase (armazenamento em memória no serviço NestJS é suficiente para o fluxo de CFP).
- Mecanismo de autenticação/login de palestrantes (a submissão é pública).
- Alteração da configuração base do Nx ou criação de bibliotecas adicionais além das já mapeadas.

## Decisions

### 1. Backend: Implementação da classe DTO com `class-validator` e `ValidationPipe`
- **Decisão**: Criar a classe `CreateSpeakerDto` no NestJS que implementa explicitamente `SpeakerDTO` (`implements SpeakerDTO`), decorando cada propriedade com as anotações do `class-validator` (`@IsString()`, `@IsNotEmpty()`, `@IsEmail()`, `@IsBoolean()`).
- **Alternativa considerada**: Validar manualmente no controller ou service. *Rejeitado* porque decorators declarativos integrados ao `ValidationPipe` do NestJS (`whitelist: true`, `forbidNonWhitelisted: true`) padronizam respostas de erro (400) com mensagens descritivas e rejeitam chaves intrusas.
- **Dependências**: Instalação de `class-validator` e `class-transformer` em `package.json`.

### 2. Frontend: Componente Standalone e Gestão de Estado via Signals
- **Decisão**: Criar `CfpFormComponent` como Standalone Component com imports diretos (`ReactiveFormsModule` ou inputs baseados em Signal). O formulário utilizará `signal()` para armazenar os valores dos campos (`nome`, `email`, `talkTitle`, `isGDE`) e status de envio (`isSubmitting`, `submitSuccess`, `errorMessage`), e `computed()` para calcular a validade dos dados e o estado habilitado/bloqueado do botão (`isFormValid = computed(() => ...)`).
- **Alternativa considerada**: NgRx ou BehaviorSubjects com RxJS. *Rejeitado* pela regra do projeto priorizando a simplicidade, performance e ergonomia dos Signals nativos do Angular 21.

### 3. Acessibilidade (WAI-ARIA)
- **Decisão**: Utilizar marcação semântica HTML5 combinada com:
  - Labels explicitamente associados com `for`/`id`.
  - `aria-required="true"` nos campos mandatórios.
  - `aria-invalid="true"` condicional quando um campo estiver inválido e tocado.
  - `aria-describedby` apontando para o elemento de erro de validação correspondente.
  - Região ao vivo (`role="status"` ou `aria-live="polite"`) para comunicar sucesso ou falha na submissão a usuários de leitores de tela.
  - Botão de envio com atributo `[disabled]="!isFormValid() || isSubmitting()"` e estado refletido via `aria-disabled`.

### 4. Integração HTTP e Consumo do `shared-types`
- **Decisão**: 
  - Backend: importar `SpeakerDTO` de `@cfp-platform/shared-types`.
  - Frontend: criar `CfpService` injetando `HttpClient` (com `provideHttpClient(withFetch())` no `app.config.ts`), que consome `SpeakerDTO` como tipo de retorno/envio da chamada POST `/api/speakers`.

### 5. Estratégia de Testes Unitários com Jest
- **Backend (`api`)**:
  - Teste unitário de controller/service simulando submissões válidas.
  - Teste de validação e pipeline garantindo que payloads com email inválido, campos em branco ou propriedades desconhecidas disparem erro de validação com código 400.
- **Frontend (`frontend`)**:
  - Testar estado inicial dos Signals ao instanciar o componente (valores vazios, `isSubmitting` falso).
  - Testar que o botão de envio encontra-se bloqueado inicialmente (`disabled` verdadeiro).
  - Testar que a atualização dos Signals para valores válidos desbloqueia o botão de envio.

## Risks / Trade-offs

- **[Risco] Falta de dependências `class-validator`/`class-transformer` no Monorepo**  
  → *Mitigação*: Instalar `class-validator` e `class-transformer` via `npm install` no root antes de rodar os testes da API.
- **[Risco] Validação de `id` na criação**  
  → *Mitigação*: O palestrante não envia o `id` na requisição; o `CreateSpeakerDto` pode omitir `id` (ou torná-lo opcional), enquanto o retorno da API devolve o `SpeakerDTO` completo com um `id` gerado (UUID/nanoid).
- **[Risco] SSR (Server-Side Rendering) no Angular 21**  
  → *Mitigação*: O projeto frontend está configurado com SSR. O formulário deve garantir que chamadas e manipulações de formulário sejam puras e seguras contra SSR, utilizando injeção padrão de `HttpClient` e Signals.
