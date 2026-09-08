# Quarentena do Liberated Pixel Cup

Esta árvore guarda **arte de terceiro** vinda do [Liberated Pixel Cup](https://github.com/OpenGameArt/LiberatedPixelCup),
sob **CC BY-SA 3.0**. A decisão e as suas razões estão no **ADR-0107**; o que governa o quê está em
[`../../docs/LICENSES.md`](../../docs/LICENSES.md) §3.

⚠️ **Isto é mecanismo, não arrumação.** O share-alike alcança o que nós alterarmos. A arte própria do
projeto pertence a uma **terceira pessoa que não está neste repositório** (ADR-0010, pilar 10), e um recurso
que misturasse as duas fontes licenciaria a arte **dela** em share-alike — gastando um direito alheio, por
engano de pipeline, sem que ninguém lhe perguntasse. O CC BY-SA 3.0 é também **incompatível com a família
GPL**, então esta mesma separação é o que mantém o regime do código limpo.

## As três regras (ADR-0107 §3)

1. Nenhum recurso contém ao mesmo tempo material derivado do LCP e a arte própria da autora.
2. Nenhum material derivado do LCP entra em paleta, imagem semântica ou atlas que também carregue arte própria.
3. Para um dado recurso, um jogo usa **ou** a arte da autora **ou** a do LCP — nunca uma mistura das duas.

## Como se acrescenta um recurso

O ficheiro entra aqui **e** ganha uma linha em [`ATTRIBUTION.csv`](ATTRIBUTION.csv). As duas coisas, sempre:
o gate `tests/lcp-quarantine.node.test.js` reprova um ficheiro sem linha e uma linha sem ficheiro.

| coluna | o que é |
|---|---|
| `caminho` | caminho a partir da raiz do repositório; tem de começar por `art/lcp/` |
| `autor` | ⚠️ **obrigatório.** Atribuição é condição de uso nos dois braços da licença, não uma linha de crédito. Recurso sem autor conhecido **não entra** — «não consegui descobrir» não é licença |
| `fonte` | de onde veio dentro do LCP (o repositório guarda ficheiros de autoria separados para originais e derivados; a cadeia lê-se por recurso, não em bloco) |
| `licenca` | `CC-BY-SA-3.0`. É o braço que o ADR-0107 §2 tomou — o braço GPL-3.0 é leitura defensável e **não** é o deste projeto |
| `derivado-de` | os recursos deste repositório de que este foi feito, separados por `;`. ⚠️ **Todos têm de estar dentro desta árvore.** Derivar de algo de fora é, por construção, um recurso de duas fontes |

## O que está aqui hoje

**Nada.** O LCP foi decidido em 2026-09-08 e ainda não entrou. A árvore existe antes dos recursos de
propósito: é ela que faz o gate ter o que medir, em vez de passar por vácuo no dia em que o primeiro
ficheiro chegar.

⚠️ **Quais recursos entram, e para que jogos, é direção de arte** — o ADR-0107 diz explicitamente que não
decide isso. Também não decide como a grade 32×32 do LCP encontra a canvas 320×180 do pilar 5.
