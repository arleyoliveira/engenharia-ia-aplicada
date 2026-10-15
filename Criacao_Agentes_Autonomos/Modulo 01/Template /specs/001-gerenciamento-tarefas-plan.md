# Plano Técnico - Feature 001 (Gerenciamento de Tarefas via HTTP e CLI)

## 1. Arquitetura
A feature seguirá a separação de camadas exigida pela constituição:
- Fluxo obrigatório: http/cli -> service -> store
- O domínio permanece sem IO.

### 1.1 Arquivos planejados
Arquivos novos/alterados previstos por camada.

Camada de domínio (`src/domain`):
- Criar tipo `TaskStatus` com valores permitidos.
- Criar tipo `Task` (entidade principal).
- Criar schemas Zod de entrada e saída da feature.
- Criar erros de domínio para recursos inexistentes e regras previsíveis.

Camada de store (`src/store`):
- Criar store in-memory para tarefas.
- Expor operações de persistência necessárias para criar, listar, concluir e remover.
- Garantir geração de identificador numérico incremental e preservação da ordem de criação.

Camada de service (`src/service`):
- Criar serviço de tarefas com regras de negócio:
  - criação com status inicial `open`;
  - listagem com filtros `all`, `open`, `done` e padrão `all`;
  - conclusão idempotente;
  - remoção por id com erro para inexistente.
- Traduzir falhas previsíveis em classes de erro de domínio.

Camada HTTP (`src/http`):
- Criar/ajustar roteamento com `node:http` para os contratos da feature.
- Validar toda entrada externa com Zod na borda HTTP.
- Traduzir erros de domínio para respostas HTTP consistentes.

Camada CLI (`src/cli`):
- Evoluir ponto de entrada de CLI para suportar comandos da feature.
- Validar argumentos com Zod na borda CLI.
- Traduzir erros de domínio para saída textual clara e código de saída apropriado.

Pontos de entrada (`src/index.ts`, `src/cli.ts`):
- Ajustar composição das camadas, mantendo dependências unidirecionais.

## 2. Modelo de Dados (Tipos e Schemas Zod)

### 2.1 Entidade principal
- `Task`:
  - `id`: número inteiro positivo, incremental.
  - `title`: texto obrigatório (regras exatas pendentes em decisões humanas).
  - `status`: enum `open | done`.

### 2.2 Tipos auxiliares
- `TaskFilter`: enum `all | open | done`.

### 2.3 Schemas de entrada (fronteira)
- Schema de criação:
  - campo `title` obrigatório.
- Schema de identificação de tarefa:
  - `id` numérico inteiro positivo.
- Schema de filtro de listagem:
  - aceita `all | open | done`;
  - aplica padrão `all` quando ausente.

### 2.4 Schemas de saída
- Schema da tarefa retornada (`Task`).
- Schema de coleção de tarefas (`Task[]`) para listagem.
- Schema de mensagens de erro da borda (HTTP e CLI) para padronização de contrato externo.

## 3. Contratos

## 3.1 Contratos HTTP
Base path sugerida: `/tasks`.

1. Criar tarefa
- Método/rota: `POST /tasks`
- Entrada:
  - body JSON com `title`.
- Saída de sucesso:
  - tarefa criada com `id`, `title`, `status`.
- Saída de erro:
  - erro de validação para entrada inválida;
  - erro interno para falhas não previstas.

2. Listar tarefas
- Método/rota: `GET /tasks`
- Entrada:
  - query opcional `filter=all|open|done`;
  - ausência de `filter` implica `all`.
- Saída de sucesso:
  - lista de tarefas ordenada por criação (mais antigas primeiro).
- Saída de erro:
  - erro de validação para filtro inválido.

3. Concluir tarefa
- Método/rota: `PATCH /tasks/:id/complete`
- Entrada:
  - `id` no path.
- Saída de sucesso:
  - tarefa em status `done` (inclusive em operação idempotente).
- Saída de erro:
  - erro de validação para `id` inválido;
  - erro de domínio para tarefa inexistente.

4. Remover tarefa
- Método/rota: `DELETE /tasks/:id`
- Entrada:
  - `id` no path.
- Saída de sucesso:
  - confirmação de remoção (formato final pendente de decisão humana).
- Saída de erro:
  - erro de validação para `id` inválido;
  - erro de domínio para tarefa inexistente.

## 3.2 Contratos CLI
Comando raiz sugerido: `tasks`.

1. Criar
- Comando: `tasks create --title "..."`
- Entrada:
  - argumento obrigatório de título.
- Saída de sucesso:
  - representação textual da tarefa criada.
- Saída de erro:
  - mensagem de validação amigável e código de saída não zero.

2. Listar
- Comando: `tasks list [--filter all|open|done]`
- Entrada:
  - filtro opcional, padrão `all`.
- Saída de sucesso:
  - lista em ordem de criação.
- Saída de erro:
  - mensagem de validação amigável para filtro inválido.

3. Concluir
- Comando: `tasks complete --id <numero>`
- Entrada:
  - id numérico obrigatório.
- Saída de sucesso:
  - confirmação textual com estado final `done`.
- Saída de erro:
  - mensagem para `id` inválido;
  - mensagem para tarefa inexistente.

4. Remover
- Comando: `tasks remove --id <numero>`
- Entrada:
  - id numérico obrigatório.
- Saída de sucesso:
  - confirmação textual de remoção.
- Saída de erro:
  - mensagem para `id` inválido;
  - mensagem para tarefa inexistente.

## 4. Decisões e Trade-offs

1. Store in-memory
- Decisão: manter persistência em memória.
- Benefício: simplicidade, alinhamento com escopo atual.
- Trade-off: dados se perdem ao reiniciar processo.

2. IDs numéricos incrementais
- Decisão: adotar contador incremental por processo.
- Benefício: previsibilidade em HTTP e CLI.
- Trade-off: sem unicidade global entre reinicializações.

3. Operação de conclusão idempotente
- Decisão: concluir item já concluído retorna sucesso.
- Benefício: robustez para retries e simplicidade de uso.
- Trade-off: pode ocultar repetição acidental de comando.

4. Mesma regra de negócio para HTTP e CLI
- Decisão: centralizar regras no service e traduzir na borda.
- Benefício: consistência funcional entre canais.
- Trade-off: exige cuidado no mapeamento de erros específicos de cada canal.

5. Filtro padrão `all`
- Decisão: ausência de filtro equivale a `all`.
- Benefício: experiência mais simples para listagem inicial.
- Trade-off: listas extensas podem produzir saída mais verbosa na CLI.

## 5. Estratégia de Testes (`node:test`)
Cobertura proposta priorizando regra de negócio e contratos de borda.

1. Testes de service (prioridade alta)
- Criação define status `open` e id incremental.
- Listagem por `all`, `open`, `done` com ordem de criação.
- Conclusão de tarefa `open` altera para `done`.
- Conclusão idempotente de tarefa já `done` mantém sucesso.
- Concluir/remover tarefa inexistente dispara erro de domínio.
- Remoção elimina item da coleção.

2. Testes de store (prioridade média)
- Persistência em memória preserva ordem de inserção.
- Incremento de id e recuperação por id.

3. Testes HTTP (prioridade alta)
- Fluxos de sucesso para criar/listar/concluir/remover.
- Rejeição de payload/query/path inválidos com resposta adequada.
- Tradução correta de erro de domínio para resposta HTTP.

4. Testes CLI (prioridade média/alta)
- Parsing/validação de comandos e argumentos.
- Saídas esperadas nos fluxos de sucesso.
- Mensagens e códigos de saída para erros de validação e domínio.

5. Critérios de qualidade
- `npm run typecheck` verde.
- `npm run test` verde.
- Sem introduzir acoplamento entre camadas fora do fluxo definido.

## 6. Riscos e Pontos para Decisão Humana

### 6.1 Riscos técnicos
- Divergência de mensagens entre HTTP e CLI pode gerar inconsistência percebida.
- Definição incompleta de resposta de remoção pode gerar retrabalho em consumidores.

### 6.2 Decisões humanas tomadas
- Política do título: normalizar com trim automático.
- Limites do título: mínimo 1 e máximo 255 caracteres após normalização.
- Resposta de remoção no HTTP: status 204 sem corpo.
- Listagem vazia na CLI: mensagem amigável "Nenhuma tarefa encontrada.".
