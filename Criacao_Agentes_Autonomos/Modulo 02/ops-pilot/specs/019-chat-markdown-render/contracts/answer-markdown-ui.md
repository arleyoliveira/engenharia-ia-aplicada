# Contract: Corpo da resposta (Markdown)

**Date**: 2026-09-29 | **Spec**: [spec.md](../spec.md) | **Model**: [data-model.md](../data-model.md)

Extensão da war room ([016 war-room-ui](../016-war-room-web/contracts/war-room-ui.md)). HTTP do chat **inalterado** — ver [chat-http.md](chat-http.md).

## Região afetada

Dentro do turno `200` no fio, no `<article class="bubble">` do assistente:

| Ordem de leitura | Conteúdo | Formato |
| --- | --- | --- |
| 1 | Corpo da resposta | Markdown renderizado em `.answer-md` |
| 2 | `requestId` | metadado `.meta`, texto plano |
| 3 | "ver raciocínio" | comportamento existente, trace em texto plano |

O compositor, cartão `202`, engrenagem e estados de erro permanecem como na 016.

## Entrada

String `answer` do JSON `200`, idêntica ao contrato atual. Exemplos representativos:

- Prosa: `"Nenhum alerta firing."`
- Estruturado: `"## Status\n\n- item a\n\n- item b\n\nUse `list_alerts`."`
- Malicioso (testes): HTML/script ou links `javascript:` — devem ser inertes na tela.

## Saída visual mínima (FR-002)

| Constructo Markdown | Deve aparecer como |
| --- | --- |
| Parágrafo | `<p>` com texto legível |
| `#` … `###` | Cabeçalho `h2` … `h4` (nunca `h1` da página) |
| `**` / `*` | ênfase forte / itálica |
| `-` / `1.` | lista não ordenada / ordenada |
| `` ` `` / cercas | código inline / bloco `pre` > `code` |
| `[texto](https://…)` | link clicável, nova aba, `rel` anti-tabnabbing |
| `![alt](url)` | sem imagem remota; alt ou omissão estável |

## Segurança (FR-003, FR-004)

- Nenhum `<script>` executável no subtree da resposta.
- Links só `http:` e `https:`; demais esquemas não navegam.
- Links externos: não substituem a war room na mesma aba por padrão.

## Estilo

Tokens `--text`, `--text-muted`, `--accent`, `--border`, `--surface-raised` e escala de espaçamento 4–48. Contraste legível para código e links nos temas claro, escuro e `system`.

## Testes de contrato (Vitest, sem rede)

1. `answer` com `##` e lista de dois itens — cabeçalho e `<li>` presentes; literais `##` e `-` não dominam o texto visível.
2. Prosa simples — conteúdo integral visível, sem mensagem de erro.
3. Mensagem do plantonista com `**x**` — asteriscos literais no balão do usuário.
4. `answer` com `<script>…</script>` — sem `script` no container da resposta.
5. Link `https://example.com` — elemento `a` com `href`, `target="_blank"`, `rel` contendo `noopener`.
