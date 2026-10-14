# Spec Delta

## Purpose

Permite que palestrantes submetam propostas de palestras (Call for Papers) com validação estrita no backend e interface reativa e acessível no frontend.

## ADDED Requirements

### Requirement: Validação estrita do payload de submissão
A API SHALL validar os dados da proposta de palestra recebida contra o contrato `SpeakerDTO`. O sistema SHALL rejeitar requisições com campos ausentes, e-mails malformatados ou propriedades não reconhecidas retornando código HTTP 400 Bad Request.

#### Scenario: Submissão com payload inválido ou incompleto
- **WHEN** um cliente envia uma requisição POST sem campos obrigatórios como `nome` ou com formato inválido de `email`
- **THEN** a API responde com status 400 Bad Request e detalha os erros de validação

#### Scenario: Submissão com propriedades desconhecidas
- **WHEN** um cliente envia propriedades não permitidas no payload
- **THEN** a API rejeita a requisição com 400 Bad Request

### Requirement: Criação e recepção de proposta de palestra
A API SHALL aceitar requisições POST válidas contendo todos os dados do palestrante e retornar confirmação de sucesso com identificador gerado ou registrado.

#### Scenario: Submissão bem-sucedida de palestra
- **WHEN** o cliente envia dados completos e válidos de acordo com o `SpeakerDTO`
- **THEN** a API persiste a submissão e responde com status 201 Created com os dados confirmados

### Requirement: Estado inicial e reatividade via Signals no formulário
O frontend SHALL gerenciar o estado dos campos e da validação usando Angular Signals (`signal` e `computed`). O botão de envio SHALL permanecer desabilitado enquanto o formulário for inválido ou estiver em processamento.

#### Scenario: Estado inicial do formulário
- **WHEN** a página de CFP é carregada
- **THEN** os Signals de campos são inicializados vazios e o botão de submissão permanece bloqueado

#### Scenario: Desbloqueio do botão após preenchimento válido
- **WHEN** todos os campos obrigatórios são preenchidos corretamente
- **THEN** o Signal computado de validade torna-se verdadeiro e o botão de envio é habilitado

### Requirement: Acessibilidade WAI-ARIA no formulário
O formulário de submissão SHALL implementar atributos WAI-ARIA, associando mensagens de erro aos respectivos campos e alertando tecnologias assistivas sobre o status da submissão.

#### Scenario: Notificação de erro e foco acessível
- **WHEN** um campo obrigatório perde o foco sem preenchimento válido
- **THEN** o elemento exibe `aria-invalid="true"` e referencia o texto explicativo via `aria-describedby`
