# cfp-dashboard Specification

## Purpose

Disponibiliza um painel para listagem, consulta e acompanhamento de propostas de palestras submetidas na plataforma CFP, com suporte a estados reativos, design consistente e navegação fluida.

## Requirements

### Requirement: Listagem de palestras submetidas via API
A API SHALL disponibilizar um endpoint GET que retorne um array com todas as propostas de palestras cadastradas em conformidade com o contrato `SpeakerDTO`.

#### Scenario: Listagem com propostas cadastradas
- **WHEN** uma requisição GET é realizada para o endpoint de palestras
- **THEN** a API responde com código HTTP 200 OK e uma lista em formato JSON contendo objetos do tipo `SpeakerDTO`

#### Scenario: Listagem sem propostas cadastradas
- **WHEN** nenhuma proposta de palestra foi submetida ainda
- **THEN** a API responde com código HTTP 200 OK e um array vazio `[]`

### Requirement: Gerenciamento reativo de estado no Dashboard
O componente de Dashboard SHALL gerenciar o estado da lista de palestras utilizando Angular Signals (`WritableSignal<SpeakerDTO[]>`), tratando estados de carregamento, exibição de dados e eventuais falhas na requisição.

#### Scenario: Carregamento e renderização inicial
- **WHEN** o usuário acessa o dashboard
- **THEN** a requisição HTTP é disparada, o Signal é atualizado com as palestras retornadas e a interface é atualizada reativamente

#### Scenario: Tratamento de erro na requisição
- **WHEN** a consulta à API falha ou fica indisponível
- **THEN** a interface exibe uma mensagem de feedback amigável indicando a impossibilidade de carregar os dados

### Requirement: Apresentação semântica e consistência com Design Tokens
O Dashboard SHALL renderizar as informações das palestras utilizando elementos HTML semânticos e manter rigorosamente os Design Tokens, cores, tipografia, bordas e espaçamentos do formulário original de CFP.

#### Scenario: Estrutura semântica dos registros
- **WHEN** as palestras são apresentadas em tela
- **THEN** a interface utiliza estrutura semântica apropriada (tabela com `<caption>`, `<thead>`, `<th>` com escopos ou lista de cards semânticos com `<article>`) garantindo legibilidade e acessibilidade

#### Scenario: Destaque visual para palestrantes GDE
- **WHEN** uma proposta pertence a um Google Developer Expert (`isGDE: true`)
- **THEN** a interface exibe uma insígnia ou indicador visual harmônico destacando a credencial sem prejudicar o contraste de cores

### Requirement: Roteamento e navegação integrada
O sistema SHALL disponibilizar a rota `/dashboard` direcionando para o componente de Dashboard e incluir elemento de navegação no formulário de submissão preservando o padrão visual existente.

#### Scenario: Navegação do formulário para o Dashboard
- **WHEN** o usuário aciona o botão/link de navegação no formulário de CFP
- **THEN** o Angular Router realiza a transição para a rota `/dashboard` exibindo a listagem

#### Scenario: Navegação de retorno ao formulário
- **WHEN** o usuário está no dashboard e deseja submeter nova palestra
- **THEN** o sistema disponibiliza um link/botão para retornar à tela de submissão
