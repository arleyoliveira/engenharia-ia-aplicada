---
applyTo: "web/**"
---

# Design da interface

Aplique estas regras em toda tela, componente e estilo em `web/`.

## Hierarquia

- Uma página tem um único `h1`. Títulos descem em ordem (`h1` → `h2` → `h3`), sem pular nível.
- Cada região tem uma ação primária. Ações secundárias ficam visivelmente menores (peso, tamanho ou estilo outline).
- Ordem de leitura: título, contexto, conteúdo, metadado. Metadado (hora, id, contagem) usa texto menor e cor de menor ênfase.
- Não comunique importância só com cor. Combine tamanho, peso e posição.

## Espaçamento em escada

Use só a escala 4, 8, 12, 16, 24, 32, 48. O espaço cresce conforme a relação enfraquece:

| Relação | Espaço |
| --- | --- |
| Ícone e rótulo no mesmo controle | 4 |
| Itens da mesma linha ou lista | 8 |
| Controles do mesmo grupo | 16 |
| Grupos dentro de uma seção | 24 |
| Seções da página | 32 ou 48 |

- Padding interno de um card é menor que o espaço entre cards; o espaço entre cards é menor que o espaço entre seções.
- Não invente margens fora da escala (5, 10, 18, 20).

## Estados vazios e de erro

- Lista ou painel sem dados mostra estado vazio: o que está ausente, por que isso pode ocorrer e a próxima ação (por exemplo, "Nenhum alerta aberto" + botão para atualizar).
- Falha mostra estado de erro: o que falhou, o efeito para o usuário e como recuperar (tentar de novo, voltar, ajustar filtro). Nunca deixe a área em branco nem só mude a cor.
- Carregando, vazio e erro são estados distintos. Um spinner não substitui o vazio; uma mensagem genérica ("Erro") não substitui a recuperação.
- Erros de campo ficam junto ao campo, associados pelo `id`, e o resumo de falha de formulário recebe foco.

## Dark mode

- Cores saem de tokens semânticos (`--surface`, `--text`, `--text-muted`, `--border`, `--accent`, `--danger`), com valor para claro e escuro. Componente não usa hex solto.
- O tema segue `prefers-color-scheme` e pode ser fixado pelo usuário (`light` | `dark` | `system`), persistido entre visitas.
- Evite preto `#000` e branco `#fff` puros. Superfície escura usa cinza próximo do preto; texto sobre ela mantém contraste AA nos dois temas.
- Sombras no escuro cedem lugar a borda ou elevação por superfície; ícones e gráficos têm variante para os dois temas.

## Acessibilidade

- Use elemento nativo (`button`, `a`, `label`, `input`). Se um controle não for nativo, exponha `role`, nome acessível e teclado (Enter e Espaço).
- Todo campo tem rótulo visível. Placeholder não substitui rótulo.
- Foco visível em todo controle interativo (`:focus-visible`), com contraste nos dois temas. Não remova outline sem substituto.
- Contraste mínimo: 4,5:1 para texto, 3:1 para texto grande e componentes de interface.
- Estado (sucesso, alerta, erro) combina cor, ícone e texto.
- Área que atualiza sozinha (alerta novo, erro de envio) usa `aria-live`. Alvo de toque ou clique com pelo menos 24×24 px.
- Imagem informativa tem `alt`; imagem decorativa tem `alt=""`.
