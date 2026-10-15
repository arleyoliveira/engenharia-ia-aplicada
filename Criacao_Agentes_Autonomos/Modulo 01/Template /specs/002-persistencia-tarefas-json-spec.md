# Spec: Persistência de Tarefas em JSON entre Sessões

## 1. Contexto / Problema
Atualmente, o uso do CLI não preserva as tarefas entre execuções. A cada nova execução do comando, o estado volta ao vazio, o que impede continuidade do fluxo de trabalho no terminal.

A feature deve garantir que as tarefas sejam mantidas entre sessões por meio de persistência em arquivo JSON, permitindo retomar o contexto sem recriar itens já cadastrados.

## 2. User Stories
- Como pessoa usuária de CLI, quero manter minhas tarefas entre execuções, para não perder o histórico ao fechar o terminal.
- Como pessoa usuária, quero que as tarefas criadas, concluídas e removidas sejam refletidas de forma persistente, para ter confiança no estado exibido.
- Como pessoa usuária, quero que a API HTTP e o CLI leiam/escrevam o mesmo estado persistido, para manter consistência entre canais.
- Como pessoa usuária, quero receber uma resposta clara quando o arquivo estiver inválido, para entender como recuperar o funcionamento.

## 3. Requisitos Funcionais
- RF-1: O sistema deve persistir o estado de tarefas em arquivo JSON para manter dados entre sessões.
- RF-2: O arquivo de persistência deve ficar em `.data/tasks.json`.
- RF-3: Se o arquivo `.data/tasks.json` não existir, o sistema deve criá-lo automaticamente com estado inicial vazio.
- RF-4: Operações de criar, concluir e remover tarefa devem atualizar o estado persistido.
- RF-5: Operações de listagem devem refletir o conteúdo persistido mais recente.
- RF-6: CLI e HTTP devem operar sobre o mesmo estado persistido em `.data/tasks.json`.
- RF-7: Se o arquivo de persistência estiver inválido/corrompido, o sistema deve criar backup do arquivo problemático e reinicializar o estado persistido para vazio.
- RF-8: Após recuperação de arquivo inválido/corrompido, o sistema deve continuar aceitando operações normalmente.
- RF-9: Em caso de recuperação por corrupção, o sistema deve comunicar de forma compreensível que ocorreu backup e reinicialização.
- RF-10: O comportamento em acessos simultâneos ao arquivo pode ser best effort, sem garantia forte de sincronização.

## 4. Critérios de Aceite (EARS)
- Quando a pessoa usuária executar comandos de tarefa em sessões distintas, o sistema deve manter as tarefas previamente registradas.
- Quando a pessoa usuária executar o sistema sem existir `.data/tasks.json`, o sistema deve criar o arquivo automaticamente com estado vazio.
- Quando a pessoa usuária criar uma tarefa, o sistema deve persistir o novo estado no arquivo JSON.
- Quando a pessoa usuária concluir uma tarefa, o sistema deve persistir a alteração de status no arquivo JSON.
- Quando a pessoa usuária remover uma tarefa, o sistema deve persistir a remoção no arquivo JSON.
- Quando a pessoa usuária listar tarefas após reiniciar o CLI, o sistema deve retornar o estado persistido previamente.
- Quando a pessoa usuária usar CLI e HTTP de forma alternada, o sistema deve refletir o mesmo conjunto de tarefas em ambos os canais.
- Quando o sistema detectar JSON inválido/corrompido, o sistema deve criar backup do arquivo inválido e reinicializar o estado para vazio.
- Quando ocorrer recuperação por corrupção, o sistema deve informar mensagem compreensível sobre backup e reinicialização.
- Quando houver execuções concorrentes do CLI, o sistema deve operar em modo best effort sem promessa de consistência forte.

## 5. Fora do Escopo
- Migração para banco de dados relacional, NoSQL ou serviços externos.
- Sincronização distribuída entre múltiplas máquinas.
- Garantias transacionais fortes para acessos concorrentes.
- Histórico versionado de alterações de tarefas.
- Criptografia de conteúdo do arquivo de tarefas.

## 6. Questões em Aberto
- Nenhuma no momento.

## 7. Decisões Registradas
- O backup deve usar o padrão de nome `tasks.backup-YYYYMMDDHHmmss.json`.
- A retenção de backup deve manter apenas 1 backup mais recente.
- A mensagem da CLI na recuperação por corrupção deve ser: `Arquivo de tarefas corrompido detectado. Backup criado em <caminho>. Estado reiniciado.`.
- No HTTP, a recuperação por corrupção não deve ser exposta ao cliente; deve ficar apenas em log interno.
