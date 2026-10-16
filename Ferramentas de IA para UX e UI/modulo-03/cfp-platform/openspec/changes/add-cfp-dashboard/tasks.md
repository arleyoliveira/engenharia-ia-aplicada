# Tasks

## 1. Backend Endpoint (NestJS)

- [ ] 1.1 Configurar endpoint GET no backend (em `CfpController` ou `SpeakersController`) retornando `SpeakerDTO[]` e verificar execução através de testes unitários com `npx nx test api`.

## 2. Frontend Service e Roteamento (Angular 21)

- [ ] 2.1 Adicionar método de busca de palestras no `CfpService` consumindo o endpoint GET via `HttpClient` e verificar integridade da tipagem `SpeakerDTO[]`.
- [ ] 2.2 Configurar as rotas da aplicação em `frontend/src/app/app.routes.ts` associando `path: 'dashboard'` ao `CfpDashboardComponent` e a rota inicial ao formulário, ajustando `app.html` para navegação via `<router-outlet>`.

## 3. Componente CfpDashboard e Design Tokens

- [ ] 3.1 Criar o componente standalone `CfpDashboardComponent` gerenciando o estado das palestras com `WritableSignal<SpeakerDTO[]>` e sinais reativos de carregamento e erro.
- [ ] 3.2 Implementar o template HTML semântico (tabela acessível com headers e caption) e folha de estilos CSS mantendo conformidade estrita com os Design Tokens do `CfpFormComponent` (cores, cartões, fontes e badge para `isGDE`).
- [ ] 3.3 Adicionar botão de navegação para o Dashboard no formulário `CfpFormComponent` e link de retorno no Dashboard com estilos consistentes.

## 4. Testes e Validação

- [ ] 4.1 Criar testes unitários para o `CfpDashboardComponent` validando inicialização, consumo HTTP, atualização do Signal e tratamento de erro.
- [ ] 4.2 Executar os testes automatizados do monorepo (`npx nx test api` e `npx nx test frontend`) e verificar que todos passam sem regressões.

## Workflow follow-up

- Iniciar implementação executando `/opsx-apply`.
- Executar sincronização ou arquivamento do OpenSpec após conclusão dos testes.
