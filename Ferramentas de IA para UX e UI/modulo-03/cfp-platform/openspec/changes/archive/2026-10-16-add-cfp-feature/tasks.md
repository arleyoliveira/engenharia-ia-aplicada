# Tasks

## 1. Dependências e Infraestrutura do Backend

- [x] 1.1 Instalar e verificar dependências de validação (`class-validator` e `class-transformer`) no workspace através do npm.
- [x] 1.2 Configurar o `ValidationPipe` global no arquivo `api/src/main.ts` com as opções `whitelist: true`, `forbidNonWhitelisted: true` e `transform: true`.

## 2. Implementação do Módulo Backend (NestJS)

- [x] 2.1 Criar a classe `CreateSpeakerDto` em `api/src/app/dto/create-speaker.dto.ts` implementando o contrato `SpeakerDTO` importado de `@cfp-platform/shared-types`, decorando os campos com `@IsString()`, `@IsNotEmpty()`, `@IsEmail()` e `@IsBoolean()`.
- [x] 2.2 Criar o `SpeakersService` em `api/src/app/speakers/speakers.service.ts` para gerenciar a criação e armazenamento das submissões de palestrantes.
- [x] 2.3 Criar o `SpeakersController` em `api/src/app/speakers/speakers.controller.ts` com o endpoint `@Post('speakers')` recebendo o `@Body() dto: CreateSpeakerDto` e registrá-lo no `AppModule`.
- [x] 2.4 Criar testes unitários com Jest em `api/src/app/speakers/speakers.controller.spec.ts` validando o fluxo de sucesso e garantindo que requisições com dados inválidos ou ausentes disparem exceções de validação (400 Bad Request), verificando com `npx nx test api`.

## 3. Implementação do Módulo Frontend (Angular 21)

- [x] 3.1 Habilitar o `provideHttpClient(withFetch())` no arquivo `frontend/src/app/app.config.ts`.
- [x] 3.2 Criar o serviço `CfpService` em `frontend/src/app/services/cfp.service.ts` consumindo o tipo `SpeakerDTO` de `@cfp-platform/shared-types` e realizando a chamada HTTP POST para `/api/speakers`.
- [x] 3.3 Criar o componente standalone `CfpFormComponent` em `frontend/src/app/components/cfp-form/cfp-form.component.ts` com gerenciamento de estado baseado em Signals (`signal()` para valores dos campos e status; `computed()` para cálculo de validade e bloqueio do botão).
- [x] 3.4 Implementar o template acessível WAI-ARIA para o `CfpFormComponent` (`aria-required`, `aria-invalid`, `aria-describedby` apontando para alertas de erro, live region para status e bloqueio reativo do botão de envio).
- [x] 3.5 Integrar o `CfpFormComponent` na aplicação principal em `frontend/src/app/app.ts` e `frontend/src/app/app.html`.
- [x] 3.6 Criar testes unitários com Jest em `frontend/src/app/components/cfp-form/cfp-form.component.spec.ts` validando o estado inicial dos Signals (vazios/iniciais) e o bloqueio estrito do botão de envio até que os Signals correspondam a um formulário válido, verificando com `npx nx test frontend`.

## 4. Validação de Qualidade e Integração do Monorepo

- [x] 4.1 Executar a suíte de testes unitários de todos os projetos afetados (`npx nx run-many -t test -p api frontend shared-types`) e verificar que todos passam com 100% de sucesso.
- [x] 4.2 Executar a verificação de linting (`npx nx run-many -t lint -p api frontend shared-types`) e garantir conformidade de código.
