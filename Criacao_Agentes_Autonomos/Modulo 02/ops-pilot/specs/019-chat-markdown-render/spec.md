# Feature Specification: Respostas em Markdown na war room

**Feature Branch**: `019-chat-markdown-render`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "No cliente web, preciso que renderize na tela do chat o conteudo markdown formatado, para que os usuários consigam ler as respostas de forma estruturada."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O plantonista lê a resposta estruturada (Priority: P1)

Quando o OpsPilot devolve uma `answer` com Markdown (títulos, listas, negrito, código e links), a war room mostra esse conteúdo formatado no balão da resposta, não como um único parágrafo com asteriscos e cercas visíveis. O `requestId` e "ver raciocínio" continuam como hoje, abaixo ou ao lado do corpo formatado.

**Why this priority**: Hoje a resposta é texto cru dentro de um `<p>`. Relatórios de plantão e passos numerados ficam ilegíveis; este é o valor pedido.

**Independent Test**: Com `fetch` fake, um `200` cujo `answer` traz cabeçalho, lista com três itens, trecho `inline code` e bloco cercado. A sala deve exibir hierarquia e listas reconhecíveis, sem mostrar os delimitadores Markdown literais no lugar da formatação.

**Acceptance Scenarios**:

1. **Given** um turno `200` com `answer` contendo `## Status` seguido de uma lista com `- item a` e `- item b`, **When** a resposta aparece no fio, **Then** o plantonista vê um título de segundo nível e uma lista com dois itens, não a string `## Status` nem `- item a` como texto corrido único.
2. **Given** uma `answer` com `**crítico**` e `` `list_alerts` ``, **When** a resposta é exibida, **Then** negrito e código inline aparecem distintos do texto normal.
3. **Given** uma `answer` com bloco cercado (três crases) contendo várias linhas, **When** a resposta é exibida, **Then** o bloco aparece como bloco de código preservando quebras de linha, com contraste legível no tema claro e no escuro.
4. **Given** um turno `200` já no fio, **When** o plantonista abre ou fecha "ver raciocínio", **Then** a formatação da `answer` não some nem é reenviada ao chat.

---

### User Story 2 - Texto sem Markdown continua legível (Priority: P1)

Respostas em prosa simples, sem sintaxe Markdown, continuam aparecendo como hoje: parágrafos legíveis, sem erro nem aviso de “formato inválido”. Mensagens do plantonista no fio permanecem texto simples (sem interpretar Markdown no balão do usuário).

**Why this priority**: Nem todo turno trará Markdown. Quebrar respostas antigas ou mensagens curtas inviabiliza o chat.

**Independent Test**: `200` com `answer: "Nenhum alerta firing."` — um parágrafo, sem elementos estruturados extras. Mensagem do usuário com `**teste**` continua mostrando os asteriscos literalmente.

**Acceptance Scenarios**:

1. **Given** `answer` sem marcadores Markdown, **When** o turno é renderizado, **Then** o texto aparece inteiro, legível, sem bloco de erro e sem exigir Markdown.
2. **Given** o plantonista envia `**urgente**` como mensagem, **When** ela entra no fio, **Then** o balão do usuário mostra `**urgente**` literal, sem negrito.
3. **Given** `answer` vazia ou só espaços (caso já previsto na war room), **When** o turno aparece, **Then** continua valendo o tratamento atual de resposta vazia; esta feature não remove esse estado.

---

### User Story 3 - Leitura segura e links previsíveis (Priority: P1)

O conteúdo formatado não executa script nem HTML arbitrário vindo do modelo. Links na resposta abrem fora da página atual de forma segura. Código e links mantêm contraste nos temas claro, escuro e sistema.

**Why this priority**: Markdown renderizado sem sanitização vira vetor de XSS no navegador do plantonista. Links silenciosos no mesmo contexto confundem plantão.

**Independent Test**: `answer` fake com `<script>alert(1)</script>`, `[clique](javascript:alert(1))` e `[status](https://example.com)`. O DOM da resposta não contém `script` executável; o link https é clicável com abertura em nova aba (ou equivalente seguro) e indicação acessível quando aplicável.

**Acceptance Scenarios**:

1. **Given** `answer` contendo tags HTML cruas ou blocos `<script>`, **When** a resposta é renderizada, **Then** o HTML perigoso não é interpretado como markup ativo; o plantonista vê texto seguro ou elementos inofensivos equivalentes, sem execução de script.
2. **Given** `answer` com link Markdown para URL `https`, **When** o plantonista ativa o link, **Then** a navegação não substitui a war room na mesma aba por padrão, e o destino usa `rel` que impede que a página aberta controle a sessão da war room.
3. **Given** tema escuro ou claro, **When** a resposta inclui código inline e bloco, **Then** fundo e texto do código respeitam tokens de cor da sala e mantêm contraste legível (equivalente AA nos textos do corpo).

---

### User Story 4 - Estrutura acessível no balão da resposta (Priority: P2)

Cabeçalhos gerados a partir da `answer` entram na hierarquia da página sem pular níveis dentro do balão. Listas são anunciadas como listas. O balão da resposta continua distinguível da mensagem do plantonista e não compete com o `h1` da sala.

**Why this priority**: Markdown existe para estrutura; sem semântica correta, leitores de tela perdem o benefício.

**Independent Test**: Resposta fake com `### Detalhe` dentro do balão; inspecionar que o elemento de cabeçalho existe e que não há `h1` extra na página além do título principal da war room.

**Acceptance Scenarios**:

1. **Given** `answer` com `### Seção`, **When** renderizada, **Then** o título aparece como cabeçalho de nível adequado dentro do artigo da resposta (não como `h1` da página).
2. **Given** `answer` com lista ordenada e não ordenada, **When** renderizada, **Then** os itens aparecem em `<ol>` ou `<ul>` (ou equivalente semântico), não como linhas separadas só por `<br>`.
3. **Given** resposta formatada, **When** o plantonista navega só por teclado, **Then** links dentro da resposta recebem foco visível, como os demais controles da sala.

---

### Edge Cases

- Markdown malformado (lista sem fechamento, cercas ímpares): a war room mostra o máximo legível possível, sem tela de erro e sem quebrar o restante do fio.
- Resposta muito longa: todo o conteúdo continua no fio, com rolagem da página; esta feature não pagina nem trunca a `answer`.
- Imagens em Markdown (`![alt](url)`): fora de escopo; não renderizar `<img>` remoto a partir da `answer` (evita vazamento de IP e conteúdo inesperado). O alt ou a sintaxe pode aparecer como texto, ou o trecho é omitido de forma estável documentada no plano.
- Tabelas Markdown: desejável se o renderizador suportar; se não, linhas da tabela aparecem como texto sem derrubar o turno.
- Resposta após decisão (`Aprovado.` / `Negado.`): mesma regra de formatação que qualquer `answer` (geralmente prosa simples).
- Cartão `202` e resumo `pendingAction.summary`: permanecem texto simples; só o balão de `answer` do assistente usa Markdown.
- Conteúdo duplicado no trace (`answer` no trace e no corpo): o painel "ver raciocínio" continua texto plano por evento; só o balão principal da resposta usa Markdown.
- Copiar/colar: fora de escopo garantir clipboard rich text; basta seleção visual correta.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A war room em `web/` MUST renderizar o campo `answer` dos turnos `kind: "answer"` como Markdown formatado, substituindo a exibição atual de texto cru em um único parágrafo.
- **FR-002**: O subconjunto suportado MUST incluir, no mínimo: parágrafos; cabeçalhos até o terceiro nível; ênfase forte e itálica; listas ordenadas e não ordenadas; links com destino `http` ou `https`; código inline e blocos cercados.
- **FR-003**: A renderização MUST sanitizar a saída: sem `<script>`, sem event handlers inline, sem `javascript:` em links, e sem HTML arbitrário do modelo interpretado como ativo. Falha de sanitização MUST preferir omitir o trecho perigoso a executá-lo.
- **FR-004**: Links externos MUST abrir de forma que a war room não seja descartada na mesma aba por padrão e MUST usar relação que mitigue tabnabbing.
- **FR-005**: Mensagens do plantonista (`kind: "user"`) MUST NOT passar pelo renderizador Markdown.
- **FR-006**: Cartões `202`, textos de erro, metadados (`requestId`) e o painel "ver raciocínio" MUST permanecer como hoje (campos tipados / texto plano), salvo o balão principal da `answer`.
- **FR-007**: Estilos do Markdown MUST usar tokens de cor e tipografia da sala (`.github/instructions/design.instructions.md` / regras de design em `web/`), incluindo tema claro, escuro e sistema, com contraste legível em código e links.
- **FR-008**: Cabeçalhos gerados dentro do balão da resposta MUST NOT ser `h1` da página; MUST respeitar a hierarquia já definida para a war room (um único título principal na sala).
- **FR-009**: O contrato HTTP do chat MUST NOT mudar: `answer` continua string; nenhum campo novo no `POST /chat` ou no `200`.
- **FR-010**: Testes automatizados em `web/` MUST cobrir, sem rede externa: resposta com lista e cabeçalho visíveis; prosa simples inalterada; mensagem do usuário sem Markdown; trecho com HTML/script na `answer` não executa script no DOM; link https presente e configurado de forma segura. `npm run typecheck` e `npm run test` na raiz MUST permanecer verdes.

### Key Entities

- **Answer renderizada**: visão derivada da string `answer` do turno. Entrada: Markdown (ou prosa). Saída: DOM sanitizado dentro do balão do assistente. Não é persistida separadamente.
- **Turno answer**: item do fio com `answer`, `trace`, `requestId` — único alvo da formatação Markdown nesta feature.
- **Balão do assistente**: região visual que agrupa corpo formatado, metadado e "ver raciocínio".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos casos de teste com `answer` Markdown (cabeçalho + lista + código), o plantonista identifica estrutura sem ler delimitadores literais (`#`, `-`, crases).
- **SC-002**: Em 100% dos casos de teste com `answer` em prosa simples, o texto permanece legível e o turno não exibe erro de renderização.
- **SC-003**: Em 100% dos casos de teste com payload malicioso na `answer`, nenhum script roda no contexto da war room após renderizar.
- **SC-004**: Em 100% dos casos de teste com link `https` na `answer`, o link está presente no DOM renderizado e segue a política de abertura segura definida em FR-004.
- **SC-005**: Nos temas claro e escuro exercitados nos testes, blocos de código e links da resposta mantêm contraste legível segundo os tokens da sala.
- **SC-006**: "ver raciocínio", envio de mensagem, cartão `202` e engrenagem continuam passando nos testes existentes da war room sem regressão funcional.

## Assumptions

- Escopo limitado ao cliente web em `web/` (war room). API, agentes e CLI não alteram o formato da `answer`.
- CommonMark ou GFM reduzido é aceitável desde que FR-002 seja atendido; a escolha da biblioteca fica para `/speckit-plan`.
- Imagens remotas em Markdown ficam fora de escopo (FR de segurança e simplicidade).
- Não há edição WYSIWYG nem preview antes de enviar; só leitura da resposta do assistente.
- Português da UI permanece; conteúdo da `answer` pode vir em qualquer idioma que o modelo devolver.
- A feature 016 (war room) já entregue permanece a base; isto é incremento visual no balão da resposta.
