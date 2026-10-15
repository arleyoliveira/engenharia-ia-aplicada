# Discovery & Refinement — Módulo 01: IA Aplicada a UX e UI

## Descrição do Projeto
Este repositório contém artefatos, prompts estruturados e diretrizes técnicas para a automação e otimização do processo de **Discovery e Refinement** de produto utilizando Modelos de Linguagem de Grande Escala (LLMs). O pipeline é nativamente integrado ao ecossistema do **Google AI Studio (Gemini)**, aplicando técnicas avançadas de Engenharia de Prompt para transformar inputs brutos de negócio em especificações técnicas de UI/UX, user stories refinadas e critérios de aceite estruturados, garantindo conformidade com padrões de privacidade e segurança (LGPD).

---

## Arquitetura do Pipeline

O fluxo de trabalho técnico está estruturado nos seguintes estágios operacionais:

1. **Inpút & Sanitização de Dados (Data Sanitization - LGPD):**
   * Processamento inicial de dados brutos de pesquisa de usuários, transcrições e dores de negócio, removendo qualquer Informação Pessoal Identificável (PII) antes da submissão ao modelo de LLM.
2. **Camada de Engenharia de Prompt (`/prompts`):**
   * Aplicação de templates de prompts parametrizados (contexto, restrições, persona, formato de saída e few-shot examples) otimizados para o motor Gemini.
3. **Processamento via LLM (Google AI Studio / Gemini):**
   * Execução dos prompts no motor para destilação de requisitos, geração de hipóteses de solução de UX e estruturação de wireframes textuais/especificações de interface.
4. **Output Estruturado (`/output` ou equivalentes):**
   * Geração de artefatos de saída padronizados em JSON e Markdown, contemplando matrizes de rastreabilidade, User Stories, fluxos de navegação e diretrizes de UI.

---

## Stack Tecnológico

* **LLM Engine:** Google Gemini (via Google AI Studio)
* **Engenharia de Prompt:** System Instructions, Chain-of-Thought, Structured Output Parsing
* **Formatos de Dados:** Markdown, JSON
* **Visualização de Arquitetura:** Mermaid.js
* **Governança:** Data Sanitization & Compliance com LGPD

---

## Como Utilizar

Para replicar este pipeline de Discovery & Refinement em seu ambiente de desenvolvimento ou motor de LLM:

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/arleyoliveira/engenharia-ia-aplicada.git
   cd engenharia-ia-aplicada
   git checkout feature/modulo-01