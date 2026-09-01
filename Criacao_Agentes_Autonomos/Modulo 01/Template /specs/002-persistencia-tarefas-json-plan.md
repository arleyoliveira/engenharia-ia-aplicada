# Plano Técnico - Feature 002 (Persistência de Tarefas em JSON entre Sessões)

## 1. Arquitetura
A evolução seguirá as camadas já adotadas no projeto, mantendo o fluxo:
- http/cli -> service -> store
- Domínio sem IO.

### 1.1 Arquivos criados/alterados por camada

Camada de domínio (`src/domain`):
- Reaproveitar tipos/schemas de tarefa existentes.
- Incluir, se necessário, erros de domínio específicos para persistência previsível (ex.: falha de leitura grave não recuperável).

Camada de store (`src/store`):
- Criar uma implementação de store persistente em arquivo JSON em `.data/tasks.json`.
- Manter mesma interface comportamental da store atual (criar, listar, concluir, remover, buscar por id quando aplicável).
- Encapsular leitura/escrita e recuperação de corrupção com backup.

Camada de service (`src/service`):
- Reaproveitar `TaskService` atual sem acoplamento ao mecanismo de persistência.
- Garantir que regras de negócio permaneçam iguais (idempotência, erros de domínio, filtros).

Camada HTTP (`src/http`):
- Ajustar composição para usar a store persistente em vez da store somente em memória.
- Preservar contratos e validações de entrada já existentes.

Camada CLI (`src/cli`):
- Ajustar composição para usar a mesma store persistente.
- Preservar comandos e mensagens já definidas.

Composição da aplicação (`src/index.ts`, `src/cli.ts`):
- Centralizar criação do caminho de dados `.data/tasks.json`.
- Garantir que HTTP e CLI apontem para o mesmo arquivo.

## 2. Modelo de Dados (Tipos e Schemas Zod)

### 2.1 Estrutura persistida
Documento JSON com metadados mínimos para manter estabilidade de ids:
- `nextId`: número inteiro positivo.
- `tasks`: coleção de `Task`.

### 2.2 Schemas Zod para persistência
- `persistedTasksSchema`:
  - valida objeto raiz com `nextId` e `tasks`.
  - valida cada item com `taskSchema` já existente.
- Uso do schema tanto na leitura quanto antes da escrita final.

### 2.3 Regras de normalização/recuperação
- Arquivo ausente -> criar estrutura vazia válida.
- JSON inválido/corrompido -> gerar backup e resetar para estrutura vazia válida.

## 3. Contratos

## 3.1 Contratos HTTP
Sem mudança funcional de rota, método ou payload:
- `POST /tasks`
- `GET /tasks?filter=all|open|done`
- `PATCH /tasks/:id/complete`
- `DELETE /tasks/:id`

Entradas/saídas permanecem iguais; diferença é o comportamento de persistência entre execuções e compartilhamento de estado com CLI.

Comportamento adicional esperado:
- Quando ocorrer recuperação por corrupção, resposta deve ser compreensível conforme decisão de produto para canal HTTP.

## 3.2 Contratos CLI
Sem mudança de comandos:
- `tasks create --title "..."`
- `tasks list [--filter all|open|done]`
- `tasks complete --id <numero>`
- `tasks remove --id <numero>`

Entradas/saídas funcionais permanecem; diferença é persistência entre execuções.

Comportamento adicional esperado:
- Em recuperação por corrupção, CLI deve informar backup + reinicialização em mensagem compreensível.

## 4. Decisões e Trade-offs

1. Persistência em arquivo local JSON
- Decisão: `.data/tasks.json` como fonte única de estado.
- Benefício: simples, transparente e sem dependência externa.
- Trade-off: suscetível a edição manual e corrupção de arquivo.

2. Compartilhamento do mesmo arquivo por HTTP e CLI
- Decisão: ambos os canais usam o mesmo arquivo.
- Benefício: consistência entre interfaces.
- Trade-off: maior chance de disputa de escrita sob concorrência.

3. Estratégia de corrupção: backup + reset
- Decisão: preservar arquivo inválido em backup e recuperar operação com estado vazio.
- Benefício: continuidade operacional com rastreabilidade.
- Trade-off: possível perda de estado mais recente não legível.

4. Concorrência best effort
- Decisão: sem lock forte nesta fase.
- Benefício: menor complexidade e entrega mais rápida.
- Trade-off: risco de condição de corrida em acessos simultâneos.

## 5. Estratégia de Testes (`node:test`)

1. Testes da store persistente
- Cria arquivo automaticamente quando ausente.
- Persiste criação/conclusão/remoção e mantém dados entre novas instâncias da store.
- Mantém `nextId` consistente após reinício.
- Faz backup e reset quando JSON inválido é detectado.
- Continua operando após recuperação.

2. Testes de integração CLI (entre execuções)
- Executar sequência create em uma invocação e list em outra, verificando persistência.
- Validar mensagem de recuperação quando arquivo corrompido.

3. Testes de integração HTTP + CLI compartilhando estado
- Criar via HTTP e listar via CLI.
- Criar via CLI e listar via HTTP.
- Concluir/remover em um canal e verificar no outro.

4. Testes de regressão dos contratos existentes
- Reexecutar suíte atual para garantir ausência de quebra funcional em comandos/rotas.

5. Gate de qualidade
- `npm run test` verde.
- `npm run typecheck` verde.

## 6. Riscos e Pontos para Decisão Humana

### 6.1 Riscos técnicos
- Corrida de escrita em execuções simultâneas pode causar perda de atualização em cenário best effort.
- Estrutura de backup sem política de retenção pode crescer indefinidamente em disco.
- Divergência de comunicação de recuperação entre HTTP e CLI pode confundir usuário.

### 6.2 Decisões humanas tomadas
- Nome do backup: `tasks.backup-YYYYMMDDHHmmss.json`.
- Retenção de backup: manter apenas 1 backup mais recente.
- Comunicação no CLI: `Arquivo de tarefas corrompido detectado. Backup criado em <caminho>. Estado reiniciado.`.
- Comunicação no HTTP: não expor ao cliente; registrar apenas em log interno.

### 6.3 Decisão humana ainda pendente
- Escopo de permissões do diretório `.data`:
  - regras de criação e tratamento quando diretório não puder ser criado.
