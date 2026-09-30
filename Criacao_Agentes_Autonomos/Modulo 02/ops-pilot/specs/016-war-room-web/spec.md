# Feature Specification: War room web

**Feature Branch**: `016-war-room-web`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "War room web/ (Vite+react+TS) com instructions de design: chat -> /chat, com "ver raciocínio" abrindo o trace tipado. 202 vira cartão aprovar/negar; engranagem com URL da API, BASE /opspilot/; CORS"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conversar com o OpsPilot na war room (Priority: P1)

O plantonista abre a war room e envia uma mensagem operacional. A war room entrega essa mensagem ao chat do OpsPilot e mostra a resposta no mesmo fio, sem recarregar a página. Antes da primeira mensagem, a sala não fica em branco.

**Why this priority**: Sem o fio de conversa não há war room. As outras histórias só existem em cima de um turno enviado e exibido.

**Independent Test**: Com um chat fake (sem modelo e sem rede externa), abrir a war room, enviar uma mensagem e ver a resposta `200` no fio, reutilizando a conversa no turno seguinte.

**Acceptance Scenarios**:

1. **Given** a war room aberta sem turnos, **When** o plantonista ainda não enviou nada, **Then** a sala mostra um estado vazio com o que falta e a ação de enviar a primeira mensagem, não uma área em branco.
2. **Given** uma URL de API válida, **When** o plantonista envia uma mensagem, **Then** a war room chama `POST {api}/chat` com `message` e, a partir do segundo turno, o `conversationId` devolvido antes, e exibe a `answer` do `200` no fio.
3. **Given** um `200` com `requestId`, **When** a resposta aparece, **Then** o identificador fica visível como metadado do turno (texto menor que a resposta).
4. **Given** um turno em andamento, **When** o plantonista olha o fio, **Then** o estado de espera é distinto do vazio e do erro, e o envio não dispara um segundo pedido até o primeiro concluir.

---

### User Story 2 - Ver o raciocínio tipado do turno (Priority: P1)

Em um turno que trouxe trace, o plantonista aciona "ver raciocínio" e vê os eventos na ordem, cada um apresentado pelo seu tipo (não um bloco único indiferenciado). O painel abre e fecha sem novo pedido ao chat.

**Why this priority**: A war room existe para o plantão inspecionar o raciocínio. A resposta sozinha não mostra como o OpsPilot chegou nela.

**Independent Test**: Um `200` (ou `202`) fake com um trace que cubra os tipos conhecidos; "ver raciocínio" revela cada evento com os campos daquele tipo e na mesma ordem do array.

**Acceptance Scenarios**:

1. **Given** um turno `200` com trace não vazio, **When** o plantonista aciona "ver raciocínio", **Then** o painel mostra os eventos na ordem do `trace`, e cada tipo usa os seus campos: `thought`, `observation`, `critique`, `summarize` e `answer` mostram `content`; `action` mostra `tool` e `args`; `plan` mostra `steps`; `route` mostra `route`, `reason` e `override`; `fallback` mostra `from` e `to`. O `node`, quando vier, aparece como metadado do evento.
2. **Given** o painel aberto, **When** o plantonista aciona de novo o controle, **Then** o painel fecha e o chat não é chamado outra vez.
3. **Given** um turno `200` com `trace` vazio ou ausente, **When** o plantonista aciona "ver raciocínio", **Then** o painel explica que não há eventos, em vez de abrir um bloco vazio sem texto.
4. **Given** um turno `202` que também traga `trace`, **When** o plantonista aciona "ver raciocínio" no cartão, **Then** vale a mesma apresentação tipada da história.

---

### User Story 3 - Resposta 202 vira cartão de aprovar ou negar (Priority: P1)

Quando o chat responde `202`, o plantonista não vê erro nem uma resposta final. Vê um cartão com a ação pendente e duas decisões: Aprovar e Negar. A escolha volta ao mesmo chat, na mesma conversa.

**Why this priority**: Uma ação que espera decisão humana não pode parecer falha nem resposta concluída. O cartão é o que torna o `202` operável.

**Independent Test**: Chat fake que responde `202` com ação pendente e, no `POST` seguinte com `decision`, responde `200`. O fio mostra o cartão, depois a escolha, depois a resposta.

**Acceptance Scenarios**:

1. **Given** um `POST /chat` que responde `202` com `pendingAction.summary`, `conversationId` e `requestId`, **When** a war room recebe a resposta, **Then** o turno é um cartão com esse resumo, a ação primária Aprovar e a ação secundária Negar, e não é estado de erro.
2. **Given** esse cartão, **When** o plantonista aprova, **Then** a war room envia `POST {api}/chat` com o `conversationId` do `202` e `decision: "approve"`, sem `message`, e o fio registra a aprovação.
3. **Given** esse cartão, **When** o plantonista nega, **Then** o pedido leva `decision: "deny"` no mesmo formato, e o fio registra a negação.
4. **Given** a decisão enviada e um `200` em seguida, **When** a resposta chega, **Then** o cartão deixa de oferecer Aprovar e Negar e a `answer` entra no fio como na história 1.
5. **Given** um `202` sem `pendingAction.summary` utilizável, **When** o cartão aparece, **Then** ele ainda oferece Aprovar e Negar e usa o texto fixo "Ação aguardando decisão" no lugar do resumo.

---

### User Story 4 - Engrenagem com a URL da API (Priority: P2)

O plantonista abre a engrenagem, informa a URL base da API e passa a conversar com esse servidor. A URL permanece neste navegador entre visitas.

**Why this priority**: A war room e a API não nascem na mesma origem. Sem a URL configurável, o chat da história 1 só funcionaria para um endereço fixo.

**Independent Test**: Gravar uma URL na engrenagem, recarregar a war room e confirmar que o próximo envio chama `{url}/chat`. Uma URL inválida não apaga a última URL válida.

**Acceptance Scenarios**:

1. **Given** a war room sem URL gravada, **When** o plantonista abre a sala pela primeira vez, **Then** a URL sugerida é `http://localhost:3000` e o chat usa essa base até ele mudar.
2. **Given** a engrenagem aberta, **When** o plantonista informa uma URL absoluta `http` ou `https` e confirma, **Then** os `POST /chat` seguintes usam essa origem, com um único `/chat` mesmo que a URL salva termine em `/`.
3. **Given** uma URL já salva, **When** o plantonista recarrega a war room, **Then** a mesma URL continua valendo, sem pedir de novo.
4. **Given** uma URL vazia ou que não seja absoluta `http`/`https`, **When** o plantonista confirma, **Then** a war room mostra o erro junto ao campo e mantém a URL válida anterior.

---

### User Story 5 - A war room vive em /opspilot/ e o navegador alcança a API (Priority: P2)

O plantonista abre a war room no caminho `/opspilot/`. O aplicativo, os recursos e a navegação resolvem nesse prefixo. Como a página e a API ficam em origens diferentes, o navegador consegue completar o `POST /chat` (incluindo a preflight).

**Why this priority**: O prefixo e o CORS são o que tornam as histórias 1 e 3 possíveis no navegador. Não substituem o fio de conversa.

**Independent Test**: Carregar a war room em `/opspilot/` (não na raiz `/`) e, a partir de outra origem, obter `POST /chat` `200` no navegador, com preflight `OPTIONS` aceita.

**Acceptance Scenarios**:

1. **Given** a war room publicada, **When** o plantonista abre `/opspilot/`, **Then** a sala aparece e os recursos da página resolvem sob `/opspilot/`, não na raiz do host.
2. **Given** a página numa origem diferente da API, **When** o navegador envia a preflight do `POST /chat` com `Content-Type: application/json`, **Then** a API autoriza essa origem, o método `POST` e o cabeçalho `Content-Type`, e o `POST` seguinte completa com o corpo JSON legível pela página.
3. **Given** um `POST /chat` autorizado, **When** a resposta sai, **Then** a página consegue ler o corpo (`answer` ou o cartão do `202`) sem o navegador bloquear a resposta por CORS.

---

### User Story 6 - A sala segue as instructions de design (Priority: P2)

A war room é utilizável no tema claro, no escuro e no tema do sistema: hierarquia clara, espaçamento da escada, estados vazio e de erro com recuperação, e controles acessíveis pelo teclado.

**Why this priority**: O fio já entrega valor sem o visual fechado, mas a sala do plantão não entra sem essas regras. Elas valem para todas as histórias acima.

**Independent Test**: Percorrer sala vazia, turno `200`, cartão `202`, erro de rede e a engrenagem no tema claro e no escuro, só com teclado, e conferir a escada de espaçamento e o contraste dos textos.

**Acceptance Scenarios**:

1. **Given** qualquer tema (claro, escuro ou sistema), **When** o plantonista lê a sala, **Then** há um único título principal, a ação primária de cada região se distingue da secundária por mais do que a cor, e o espaçamento usa só a escala 4, 8, 12, 16, 24, 32, 48, crescendo do interior do cartão para o espaço entre turnos e daí para as seções.
2. **Given** falha de rede, tempo esgotado ou resposta `400`, `404`, `422`, `500`, `503` ou `504`, **When** o turno termina, **Then** a sala mostra o que falhou, o efeito e uma recuperação (tentar de novo), sem apagar o fio já exibido.
3. **Given** o tema do sistema, **When** o plantonista não escolheu um tema, **Then** a sala acompanha a preferência do sistema; uma escolha explícita (claro, escuro ou sistema) permanece neste navegador.
4. **Given** só o teclado, **When** o plantonista envia mensagem, abre "ver raciocínio", aprova ou nega e abre a engrenagem, **Then** cada controle tem nome acessível, foco visível e rótulo visível nos campos (a URL da API não depende só de placeholder).

---

### Edge Cases

- Mensagem só com espaços: a war room não envia o `POST` e aponta o campo, em vez de receber `400` por mensagem vazia.
- `200` sem `answer`: o turno mostra que a resposta veio vazia e mantém "ver raciocínio" se houver trace.
- `202` seguido de outro `202` após a decisão: o fio ganha um novo cartão; o anterior permanece decidido.
- Duplo acionamento em Aprovar ou Negar: sai um único `POST` de decisão.
- URL da API inalcançável: estado de erro com tentar de novo; a URL salva não é apagada.
- `conversationId` ausente no `200` ou no `202`: o turno aparece, e o turno seguinte não inventa um id; a conversa recomeça no próximo envio.
- Evento de trace com `type` fora da lista conhecida: o painel mostra o tipo e o conteúdo bruto daquele item, sem quebrar os demais.
- Preflight recusada ou resposta sem CORS: a sala trata como erro de alcance da API, com recuperação, não como sala em branco.
- Abrir a war room na raiz `/` do host estático: fora do escopo redirecionar; o caminho suportado é `/opspilot/`.
- Tema escuro: superfície sem preto puro e texto com contraste equivalente ao claro; estado de erro não depende só da cor.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A war room MUST ser um aplicativo em `web/`, com Vite, React e TypeScript, servido com base `/opspilot/`. Recursos e rotas da interface MUST resolver sob esse prefixo.
- **FR-002**: A interface em `web/**` MUST seguir `.github/instructions/design.instructions.md`: um título principal, hierarquia que não usa só cor, espaçamento exclusivo da escala 4, 8, 12, 16, 24, 32, 48, estados vazio e de erro com próxima ação, carregamento distinto desses dois, tokens de cor para claro e escuro, e acessibilidade (controle nativo ou nome acessível, rótulo visível, foco visível, contraste AA, estado com texto além da cor).
- **FR-003**: Enviar uma mensagem MUST chamar `POST {apiBase}/chat` com JSON `message` (texto não vazio) e, quando a conversa já existir, `conversationId`. A war room MUST NOT enviar campos extras no turno de mensagem.
- **FR-004**: Um `200` MUST aparecer no fio como resposta do OpsPilot, com `requestId` em metadado. "ver raciocínio" MUST abrir e fechar o `trace` daquele turno sem novo `POST`.
- **FR-005**: O painel de raciocínio MUST apresentar cada evento pelo discriminante `type`, na ordem do array, com os campos definidos na história 2. Tipo desconhecido MUST aparecer sem descartar o restante do trace. Trace vazio MUST ter texto de estado vazio.
- **FR-006**: Um `202` MUST ser um cartão de decisão, nunca estado de erro nem resposta final. O cartão MUST mostrar `pendingAction.summary` ou, se faltar, "Ação aguardando decisão", mais Aprovar (primária) e Negar (secundária). Se o `202` trouxer `trace`, "ver raciocínio" MUST funcionar como no `200`.
- **FR-007**: Aprovar MUST enviar um único `POST {apiBase}/chat` com `{ conversationId, decision: "approve" }`. Negar MUST enviar `{ conversationId, decision: "deny" }`. Nenhum dos dois leva `message`. O fio MUST registrar a escolha. A resposta seguinte (`200`, novo `202` ou erro) MUST entrar no fio pelas regras já definidas.
- **FR-008**: O `POST /chat` do servidor MUST aceitar o corpo de decisão da FR-007 sem rejeitá-lo como campo extra. `message` continua obrigatória quando `decision` está ausente. `decision` só aceita `approve` ou `deny`, e nesse caso `conversationId` é obrigatório.
- **FR-009**: A engrenagem MUST editar a URL base da API. O valor MUST ser uma URL absoluta `http` ou `https`. A war room MUST persistir a URL neste navegador e usá-la em todos os `POST /chat`, normalizando a barra final. Valor inválido MUST falhar junto ao campo e MUST NOT substituir a última URL válida. Sem valor gravado, a base inicial é `http://localhost:3000`.
- **FR-010**: A API MUST responder a preflight e MUST permitir que uma origem diferente leia o `POST /chat`: origem da página, método `POST`, cabeçalho `Content-Type`. A página MUST conseguir ler o JSON de `200`, `202` e dos erros já usados pelo chat.
- **FR-011**: Falha de rede e respostas `400`, `404`, `422`, `500`, `503` e `504` MUST ser estado de erro com o que falhou e a ação de tentar de novo, preservando o fio. A war room MUST NOT enviar mensagem vazia.
- **FR-012**: O tema MUST seguir a preferência do sistema e MUST poder ser fixado em claro, escuro ou sistema, persistido neste navegador.
- **FR-013**: Testes automatizados da war room MUST cobrir, sem modelo e sem rede externa: envio e segundo turno com `conversationId`; "ver raciocínio" tipado e trace vazio; `202` como cartão e um único `POST` de decisão; URL da engrenagem persistida e rejeição de URL inválida; erro com recuperação. O teste da API MUST cobrir CORS da preflight e o corpo `decision` aceito, mais a rejeição de `decision` inválida. `npm run typecheck` MUST permanecer verde, incluindo o projeto em `web/`.

### Key Entities

- **Turno da war room**: um item do fio. É mensagem do plantonista, resposta (`answer` + `trace` + `requestId`), cartão pendente (`pendingAction` + `trace` + `requestId`) ou erro recuperável. Um cartão decidido guarda a escolha (`approve` ou `deny`).
- **Ação pendente**: o que o `202` pede para decidir. Atributo obrigatório para o texto do cartão: `summary`. Pode acompanhar o trace do turno.
- **Configuração da war room**: URL base da API e tema (`light`, `dark` ou `system`), ambos locais ao navegador.
- **Decisão**: continuação da conversa do `202`. Atributos: `conversationId` e `decision` (`approve` ou `deny`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos envios válidos do teste, o plantonista vê a resposta no fio sem recarregar a página, e o segundo envio reutiliza a conversa devolvida no primeiro.
- **SC-002**: Em 100% dos turnos de teste com trace não vazio, "ver raciocínio" mostra todos os eventos, na mesma ordem, com os campos do respectivo tipo.
- **SC-003**: Em 100% dos `202` do teste, a sala mostra o cartão com Aprovar e Negar e não classifica o turno como erro; cada botão dispara um único pedido de decisão.
- **SC-004**: A URL confirmada na engrenagem continua a mesma depois de recarregar a página e é a base de 100% dos chats seguintes do teste.
- **SC-005**: A sala carrega em `/opspilot/`, e 100% dos `POST /chat` de teste feitos de outra origem no navegador completam com o JSON legível pela página.
- **SC-006**: Nos roteiros de sala vazia, erro e cartão, o plantonista identifica o que aconteceu e a próxima ação em até um minuto, no tema claro e no escuro, usando só o teclado nos controles de enviar, ver raciocínio, aprovar, negar e configurar a URL.

## Assumptions

- O contrato de mensagem do `POST /chat` permanece o já existente (`message`, e opcionalmente `strategy`, `reflect`, `conversationId`, `userId`). Esta feature acrescenta só o corpo de decisão da FR-008. A war room não envia `strategy`, `reflect` nem `userId`.
- O `202` é consumido pela war room. Esta feature não define quando o agente passa a interromper um turno; os testes usam um chat fake que devolve o `202`. O corpo mínimo do `202` é `requestId`, `conversationId` e `pendingAction.summary` (texto), com `trace` opcional no mesmo formato do `200`.
- Aprovar e Negar não são mensagens livres. São a decisão da FR-007. O que o servidor faz com `approve` ou `deny` além de aceitar o corpo e responder um turno (ou um erro já mapeado) fica para o plano, desde que o teste fake consiga devolver `200` ou um novo `202`.
- A URL inicial `http://localhost:3000` é a porta padrão já usada pelo servidor. A engrenagem é o único lugar em que o plantonista troca esse endereço.
- CORS libera a origem da página que chama o chat, não uma lista fechada de produção. Não há cookie nem credencial de navegador nesta feature.
- Não há autenticação nova, lista de pedidos antigos, arena, CLI nem app nativo. A raiz `/` do host da war room não precisa redirecionar.
- As instructions de design em `.github/instructions/design.instructions.md` são a fonte das regras visuais. O espelho em `.cursor/rules/design.mdc` não acrescenta regra.
- Rótulos de interface desta sala ficam em português: "ver raciocínio", "Aprovar", "Negar" e o nome acessível da engrenagem para a URL da API.
