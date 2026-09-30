# Feature Specification: Servidor MCP OpsPilot

**Feature Branch**: `006-mcp-server`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "MCP server do OpsPilot: src/mcp/server.ts com @modelcontextprotocol/sdk, transport stdio, expondo list_alerts, open_incident e resolve_incidente - reutilizando o mesmo OpsStore e os mesmo schemas zod das tools existente (uma unica fonte de verdade). Nome do server: opspilot. Script npm: mcp = \"tsx src/mcp/server.ts\" (se precisar de env, alterar o script e carregar elas antes). REGRA CRÍTICA: nunhum console.log no server - no stdio o stdout é o canal do protocolo; diagnóstico vai para o stderr. Test: sobre o server e valida o list de tools"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Descobrir as ferramentas operacionais via MCP (Priority: P1)

Um operador ou cliente MCP (IDE, assistente, harness de teste) inicia o servidor OpsPilot pelo processo local e pergunta quais ferramentas estão disponíveis. A lista retornada contém exatamente as três operações de plantão expostas nesta feature: listar alertas, abrir incidente e resolver incidente — com nomes e contratos alinhados às ferramentas já usadas pelo agente interno.

**Why this priority**: Sem descoberta confiável das tools, o servidor MCP não entrega valor; é o contrato mínimo para qualquer cliente se conectar.

**Independent Test**: Subir o servidor MCP, solicitar a listagem de ferramentas e verificar que as três tools esperadas aparecem com nomes corretos; nenhum outro nome inventado nesta feature.

**Acceptance Scenarios**:

1. **Given** o servidor MCP OpsPilot em execução via o script npm `mcp`, **When** um cliente solicita a listagem de tools, **Then** a resposta inclui `list_alerts`, `open_incident` e `resolve_incident`.
2. **Given** a listagem de tools, **When** o cliente inspeciona cada tool, **Then** nomes, parâmetros e descrições são os mesmos contratos das tools operacionais já existentes no agente (fonte única de verdade).
3. **Given** o servidor identificado como `opspilot`, **When** o cliente consulta o nome do servidor, **Then** o identificador exposto é `opspilot`.

---

### User Story 2 - Executar operações de plantão pelo mesmo store (Priority: P2)

O plantonista (via cliente MCP) lista alertas, abre um incidente e depois o resolve. As operações leem e escrevem no mesmo store operacional que o agente e o restante do OpsPilot já usam — sem duplicar regras de validação nem estados divergentes.

**Why this priority**: O valor operacional do MCP é reutilizar o domínio existente; divergência de schemas ou store quebraria a fonte única de verdade.

**Independent Test**: Com store de teste (ex.: banco em memória), invocar as três tools via handlers MCP e confirmar comportamento equivalente ao das tools do agente sobre o mesmo store.

**Acceptance Scenarios**:

1. **Given** alertas presentes no store, **When** o cliente chama `list_alerts` (com ou sem filtro de status), **Then** recebe a mesma forma de resultado que a tool equivalente do agente.
2. **Given** parâmetros válidos de título, serviço e severidade, **When** o cliente chama `open_incident`, **Then** o incidente é criado no OpsStore compartilhado e devolvido no resultado.
3. **Given** um incidente aberto existente, **When** o cliente chama `resolve_incident` com o id, **Then** o incidente passa a resolvido no mesmo store e o registro atualizado é devolvido.
4. **Given** argumentos inválidos (fora do schema), **When** qualquer das três tools é chamada, **Then** a chamada é rejeitada na fronteira com erro compreensível, sem corromper o store.

---

### User Story 3 - Canal stdio íntegro e diagnóstico seguro (Priority: P3)

Quem opera o servidor precisa de diagnósticos sem corromper o protocolo. Qualquer mensagem de diagnóstico ou log vai para o canal de erro; o canal de saída padrão permanece exclusivo para mensagens do protocolo MCP sobre stdio.

**Why this priority**: Um único `console.log` no stdout quebra clientes MCP; é pré-requisito de operação estável do transporte stdio.

**Independent Test**: Rodar o servidor (ou o módulo sob teste) e garantir ausência de escrita diagnóstica no stdout; diagnósticos, se houver, só em stderr.

**Acceptance Scenarios**:

1. **Given** o servidor em execução, **When** ocorre inicialização ou evento diagnóstico, **Then** nenhuma mensagem de log/diagnóstico é emitida no stdout.
2. **Given** a necessidade de diagnosticar falha, **When** o servidor emite diagnóstico, **Then** a saída vai para stderr sem misturar com o protocolo.

---

### Edge Cases

- Pedido escreveu `resolve_incidente`; o nome canônico da tool existente (e desta feature) é `resolve_incident`.
- Tools do agente fora do escopo MCP v1 (`list_incidents`, `consultar_runbook`, `check_provider_status`) NÃO aparecem na listagem MCP desta feature.
- Store indisponível ou falha de domínio ao abrir/resolver: erro previsível devolvido ao cliente MCP, sem derrubar o processo do protocolo de forma silenciosa.
- Script `mcp` precisa carregar variáveis de ambiente (ex.: `OPSPILOT_DB`) da mesma forma que os outros scripts do projeto, se o store depender delas.
- Reinício do processo MCP: estado persiste conforme o OpsStore configurado (arquivo SQLite ou `:memory:` em testes), sem store paralelo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST disponibilizar um servidor MCP local nomeado `opspilot`, iniciável pelo script npm `mcp`.
- **FR-002**: O servidor MUST comunicar-se com clientes via transporte stdio (entrada/saída padrão como canal do protocolo).
- **FR-003**: O servidor MUST expor exatamente três tools nesta feature: `list_alerts`, `open_incident` e `resolve_incident`.
- **FR-004**: Nomes, schemas de argumentos e descrições dessas tools MUST ser a mesma fonte de verdade usada pelas tools operacionais do agente (sem schemas duplicados divergentes).
- **FR-005**: As tools MCP MUST operar sobre o mesmo OpsStore usado pelo restante do OpsPilot (mesmo contrato de persistência/alertas/incidentes).
- **FR-006**: O servidor MUST NÃO emitir diagnóstico ou log no stdout; qualquer diagnóstico MUST ir para stderr.
- **FR-007**: O script npm `mcp` MUST iniciar o ponto de entrada do servidor MCP; se o store exigir env, o script MUST carregar o arquivo de ambiente da mesma forma que os demais scripts do projeto.
- **FR-008**: Deve existir teste automatizado que sobe (ou instancia) o servidor e valida a listagem das tools expostas (`list_alerts`, `open_incident`, `resolve_incident`).

### Key Entities

- **Servidor MCP OpsPilot**: processo local identificado como `opspilot` que expõe tools operacionais via protocolo MCP sobre stdio.
- **Tool operacional MCP**: capacidade descoberta e invocável pelo cliente (`list_alerts`, `open_incident`, `resolve_incident`), alinhada à tool do agente.
- **OpsStore**: store operacional compartilhado de alertas e incidentes (fonte de dados das tools).
- **Listagem de tools**: resposta de descoberta com nome e contrato de cada tool exposta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das execuções do teste de listagem, as três tools `list_alerts`, `open_incident` e `resolve_incident` aparecem e nenhuma tool fora do escopo desta feature é exigida para passar.
- **SC-002**: Um cliente consegue listar alertas, abrir e resolver um incidente pelo MCP usando os mesmos dados do OpsStore compartilhado (verificável em teste com store de teste).
- **SC-003**: 0 mensagens de diagnóstico/log no stdout durante a execução coberta pelos testes do servidor; diagnósticos, se presentes, só em stderr.
- **SC-004**: Um mantenedor inicia o servidor com um único comando npm (`mcp`) sem passos manuais extras além do já usado nos outros scripts do projeto.
- **SC-005**: Alterar o schema de uma das três tools na fonte compartilhada reflete no MCP e no agente sem manutenção de duas definições paralelas (fonte única de verdade).

## Assumptions

- Nome canônico da tool de resolução é `resolve_incident` (pedido: `resolve_incidente`); alinhado a `src/agents/tools.ts`.
- Ponto de entrada do servidor: `src/mcp/server.ts`; dependência de SDK MCP (`@modelcontextprotocol/sdk`) e transporte stdio ficam para o plano/implementação.
- Script npm alvo: `"mcp": "tsx --env-file-if-exists=.env src/mcp/server.ts"` (mesmo padrão de `dev`/`seed`), salvo decisão contrária no plano se env não for necessário.
- “Mesma fonte de verdade” significa extrair/reutilizar schemas Zod e handlers (ou fábrica) das tools existentes — não copiar schemas em arquivo separado do MCP.
- Escopo MCP v1: apenas as três tools citadas; demais tools do agente ficam para features futuras.
- Teste mínimo obrigatório: listagem de tools; cobertura de invocação das três tools é desejável e alinhada à US2, mas a aceitação explícita do pedido foca no list.
- Constituição: validação Zod na fronteira, erros de domínio, testes com `node:test`, store SQLite/`OPSPILOT_DB` conforme princípios VII.
