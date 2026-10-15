# Constituition - Notas API

Principios não-negociáveis que toda spec, plano, tarefa e código segue.

1. Camadas explícitas. Dependências fluem http/cli -> service -> store. Domínio não faz IO
2. Validações na fronteira. Toda entrada externa é validada com o zod antes de virar domínio.
3. Erros são de domínio. Falhas previsiveis viram classes de erro, traduzidas sem status/saida na boarda.
4. Teste é parte da tarefa. Nenhum lógica nova entra sem teste. typecheck e test sempre verdes.
5. Segurança por padrão. Sem segredos no repo. Ações destrutivas passam por guardrails (deny list + pre-commit), não pela confiança do modelo.
6. Spec antes do código. Mudança relevantes passam por spec -> plan -> task -> implement, com revisão humana entre as fase.
7.  Pequeno e recersível. Cada tarefa cabe em um commit

## Stack obrigatório
Node 22, Typescript ESM strict, zod, node:test via tasx, node:http
