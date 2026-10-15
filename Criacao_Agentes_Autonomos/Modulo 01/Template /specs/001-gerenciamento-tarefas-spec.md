# Spec: Gerenciamento de Tarefas via HTTP e CLI

## 1. Contexto / Problema
Atualmente, o sistema não possui uma funcionalidade dedicada para gerenciamento de tarefas com ciclo de vida completo. Usuários precisam registrar atividades, acompanhar pendências, marcar tarefas concluídas e remover itens que não são mais necessários. A ausência desse fluxo reduz a utilidade prática da aplicação para organização do trabalho diário.

A feature deve oferecer o mesmo conjunto de capacidades por dois canais de entrada externos:
- HTTP (API)
- CLI (linha de comando)

A especificação define o comportamento esperado do produto, sem detalhar decisões de implementação.

## 2. User Stories
- Como pessoa usuária, quero criar uma tarefa com título, para registrar algo que preciso fazer.
- Como pessoa usuária, quero listar tarefas com filtros all, open e done, para acompanhar meu progresso.
- Como pessoa usuária, quero concluir uma tarefa existente, para indicar que ela foi finalizada.
- Como pessoa usuária, quero remover uma tarefa, para manter minha lista limpa e relevante.
- Como pessoa usuária, quero executar as mesmas operações por HTTP e por CLI, para escolher o canal mais conveniente em cada contexto.

## 3. Requisitos Funcionais
- RF-1: O sistema deve permitir criar tarefa informando título obrigatório.
- RF-2: Cada tarefa criada deve possuir identificador numérico incremental único no contexto da lista de tarefas.
- RF-3: Toda tarefa criada deve iniciar com status open.
- RF-4: O sistema deve permitir listar tarefas sem filtro explícito; nesse caso, deve assumir o filtro all.
- RF-5: O sistema deve permitir listar tarefas com filtro all, retornando tarefas open e done.
- RF-6: O sistema deve permitir listar tarefas com filtro open, retornando apenas tarefas abertas.
- RF-7: O sistema deve permitir listar tarefas com filtro done, retornando apenas tarefas concluídas.
- RF-8: A listagem de tarefas deve respeitar ordem de criação, da mais antiga para a mais recente.
- RF-9: O sistema deve permitir concluir tarefa existente por identificador numérico.
- RF-10: Concluir uma tarefa já concluída deve ser uma operação idempotente.
- RF-11: O sistema deve permitir remover tarefa existente por identificador numérico, independentemente de estar open ou done.
- RF-12: O sistema deve expor os fluxos de criar, listar, concluir e remover tanto por HTTP quanto por CLI.
- RF-13: Entradas inválidas recebidas por HTTP e por CLI devem ser rejeitadas com mensagem de erro compreensível para o canal.
- RF-14: Tentativas de concluir ou remover tarefa inexistente devem falhar com erro de domínio traduzido adequadamente para cada canal.

## 4. Critérios de Aceite (EARS)
- Quando uma pessoa usuária criar uma tarefa com título válido, o sistema deve registrar a tarefa com status open e identificador numérico incremental.
- Quando uma pessoa usuária tentar criar uma tarefa com título ausente ou inválido, o sistema deve rejeitar a solicitação com erro de validação no canal utilizado.
- Quando uma pessoa usuária listar tarefas sem informar filtro, o sistema deve retornar tarefas equivalentes ao filtro all.
- Quando uma pessoa usuária listar tarefas com filtro all, o sistema deve retornar tarefas open e done em ordem de criação.
- Quando uma pessoa usuária listar tarefas com filtro open, o sistema deve retornar somente tarefas abertas em ordem de criação.
- Quando uma pessoa usuária listar tarefas com filtro done, o sistema deve retornar somente tarefas concluídas em ordem de criação.
- Quando uma pessoa usuária concluir uma tarefa existente em status open, o sistema deve alterar o status da tarefa para done.
- Quando uma pessoa usuária concluir uma tarefa já em status done, o sistema deve manter o status done e considerar a operação bem-sucedida.
- Quando uma pessoa usuária tentar concluir uma tarefa inexistente, o sistema deve responder com erro de domínio traduzido para o canal.
- Quando uma pessoa usuária remover uma tarefa existente em qualquer status, o sistema deve excluir a tarefa da lista.
- Quando uma pessoa usuária tentar remover uma tarefa inexistente, o sistema deve responder com erro de domínio traduzido para o canal.
- Quando uma pessoa usuária executar operações equivalentes por HTTP e por CLI, o sistema deve preservar o mesmo comportamento funcional.

## 5. Fora do Escopo
- Edição de título de tarefa.
- Priorização, etiquetas, categorias ou datas de vencimento.
- Persistência em banco de dados externo ou armazenamento em arquivo.
- Autenticação, autorização ou multiusuário.
- Paginação, busca textual e ordenações alternativas.
- Operações em lote (concluir/remover múltiplas tarefas em uma única solicitação).

## 6. Questões em Aberto
- Nenhuma no momento.

## 7. Decisões Registradas
- Títulos devem ser normalizados com trim automático antes da validação final.
- Título deve ter tamanho mínimo de 1 e máximo de 255 caracteres após normalização.
- Em HTTP, remoção bem-sucedida deve responder com status 204 e sem corpo.
- Em CLI, listagem vazia deve exibir mensagem amigável: "Nenhuma tarefa encontrada.".
