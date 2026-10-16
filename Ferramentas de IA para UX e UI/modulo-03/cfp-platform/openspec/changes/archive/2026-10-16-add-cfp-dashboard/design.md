# Design

## Context

O sistema é um monorepo Nx contendo uma API NestJS (`api`), uma aplicação Angular 21 (`frontend`) e contratos compartilhados (`shared-types`).
Atualmente, o backend possui `SpeakersController` (`/api/speakers`) com método `create` e `findAll`, e o frontend possui o componente `CfpFormComponent` para envio de propostas.
Veja `proposal.md` para motivação e escopo.

## Goals / Non-Goals

**Goals:**
- Prover endpoint GET explícito e documentado para listar as palestras cadastradas como `SpeakerDTO[]`.
- Implementar `CfpDashboardComponent` standalone no Angular 21 gerenciando o estado reativo da lista de palestras via `WritableSignal<SpeakerDTO[]>`.
- Utilizar `HttpClient` para requisitar os dados da API ao inicializar o componente.
- Construir a UI utilizando HTML semântico (tabela acessível com headers e escopos apropriados) e aderir com fidelidade aos Design Tokens de `CfpFormComponent` (cores `#3182ce`, sombras, tipografia de sistema, bordas `#e2e8f0` e cartões brancos com cantos arredondados).
- Configurar rotas no Angular com `path: 'dashboard'` e adicionar botão de navegação coerente em `CfpFormComponent`.

**Non-Goals:**
- Implementar paginação no backend ou filtros avançados neste incremento.
- Implementar edição ou exclusão de propostas já submetidas.
- Alterar as regras e contratos estritos do payload de submissão existente.

## Decisions

### 1. Endpoint Backend e Nomenclatura do Controller
- **Decisão**: Garantir que o endpoint GET retorne `SpeakerDTO[]`. O backend pode disponibilizar `CfpController` ou estender/aliasing `@Controller(['speakers', 'cfp'])` para suportar tanto `/api/cfp` quanto `/api/speakers`, atendendo expressamente à diretriz "CfpController" sem romper integrações prévias.
- **Alternativas consideradas**:
  - *Apenas criar novo CfpController sem manter `/api/speakers`*: Quebraria o `CfpService` atual que já consome `/api/speakers`.
  - *Criar `CfpController` em `/api/cfp` e apontar o dashboard para ele*: Boa abordagem, compatível e atende diretamente ao requisito.

### 2. Gerenciamento de Estado no Frontend com Angular 21 Signals
- **Decisão**: Declarar `readonly speakers = signal<SpeakerDTO[]>([])` como `WritableSignal<SpeakerDTO[]>`. Adicionalmente, incluir signals auxiliares para estado de carregamento (`isLoading = signal<boolean>(true)`) e mensagem de erro (`errorMessage = signal<string | null>(null)`).
- **Alternativas consideradas**:
  - *Usar apenas Observables com AsyncPipe*: Descartado, pois o requisito exige expressamente gerenciamento de estado via Signals (`WritableSignal<SpeakerDTO[]>`).
  - *Signal construído com `toSignal`*: O requisito solicita `WritableSignal` para manipulação direta de estado e resposta a eventos.

### 3. Consumo HTTP e Ciclo de Vida
- **Decisão**: Injetar `HttpClient` no componente (ou reutilizar serviço injetando `HttpClient`) e invocar o método de busca na inicialização (`ngOnInit` ou construtor via `inject(HttpClient)`).
- **Alternativas consideradas**:
  - *Resource API experimental do Angular 19/21*: Como o requisito pede injeção explícita de `HttpClient` e atualização de `WritableSignal`, o padrão com `httpClient.get<SpeakerDTO[]>(...).subscribe(...)` é o mais direto e seguro.

### 4. Estrutura Semântica e Design Tokens da Interface
- **Decisão**: Renderizar os dados das palestras em uma tabela HTML estruturada com:
  - `<section class="cfp-container">` e container `.cfp-card-wide` mantendo o estilo de cartão centralizado.
  - Tabela com `<caption>`, `<thead>`, `<th scope="col">` e `<tbody>`.
  - Badge visual acessível para a propriedade `isGDE` (indicador discreto e de alto contraste).
  - Estado vazio estilizado (`empty state`) quando não houver palestras.
  - Cores, fontes e botões reutilizando estritamente os estilos do formulário (`#1a202c`, `#4a5568`, `#3182ce`, bordas `#e2e8f0`).
- **Alternativas consideradas**:
  - *Lista de cartões móveis*: Embora válida, tabelas tabulares oferecem visão panorâmica superior para múltiplos registros de CFP em telas médias/grandes, com overflow horizontal responsivo suave.

### 5. Roteamento e Navegação
- **Decisão**:
  - Configurar `app.routes.ts`:
    - `path: ''`: redireciona ou exibe `CfpFormComponent`.
    - `path: 'submit'`: exibe `CfpFormComponent`.
    - `path: 'dashboard'`: exibe `CfpDashboardComponent`.
  - Ajustar `app.html` para usar `<router-outlet>` de forma que a navegação alterne entre o formulário e o dashboard.
  - Adicionar botão de navegação secundário/outline estilizado em `CfpFormComponent` para direcionar ao `/dashboard`.
  - Adicionar botão no cabeçalho do `CfpDashboardComponent` para retornar ao `/` (formulário).

## Risks / Trade-offs

- **[Risco]** Limpeza da renderização em `app.html` (atualmente com `<app-cfp-form>` fixo antes do `<router-outlet>`).
  - **Mitigação**: Atualizar `app.routes.ts` definindo a rota raiz (`''`) associada ao `CfpFormComponent`, garantindo que o formulário apareça por padrão via `<router-outlet>` sem duplicações.
- **[Risco]** Volume de dados sem paginação.
  - **Mitigação**: O escopo atual é focado no MVP em memória; a tabela conterá scroll horizontal e layout fluido para acomodar as propostas submetidas.
