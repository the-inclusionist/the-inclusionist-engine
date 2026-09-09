# `art/` — a arte importada, e o livro-razão que diz de onde veio

Esta pasta guarda arte de fora que entrou pela **segunda porta** do **ADR-0133**. Não é uma quarentena, e
já foi: até 2026-09-09 este lugar chamava-se `art/lcp/` e existia para segurar uma parede à volta de
material CC BY-SA. A parede saiu quando saiu o que ela segurava.

## As quatro licenças que a arte pode ter

| licença | o que exige | onde a atribuição mora |
|---|---|---|
| `CC0-1.0` | nada | a linha do livro, por decência e por proveniência |
| `CC-BY-3.0` | atribuição | a linha do livro |
| `CC-BY-4.0` | atribuição | a linha do livro |
| `OGA-BY-3.0` · `OGA-BY-4.0` | atribuição | a linha do livro |

🔴 **E o que não entra é nomeado, porque uma regra que só lista o permitido lê-se como lista de exemplos:**

- **ND** — proíbe derivar, e recolorir já é derivar. O pipeline procedural não conseguiria nem trocar-lhe a
  paleta.
- **NC** — deixaria a arte **mais estreita que o código**: a AGPL permite uso comercial, então alguém que a
  licença convida seria travado por um sprite.
- **Share-alike, em qualquer versão, e o braço GPL de uma licença dupla** — o share-alike **viaja**. Uma
  imagem semântica traçada de um sprite é derivada dele, e um pipeline que misturasse fontes licenciaria a
  arte da autora sem lhe perguntar. Segurar isso custa uma quarentena, e o Dev decidiu não a pagar.

📌 A razão de fundo, que sobrevive à moda: **a CC BY é compatível num sentido só com a BY-SA.** Um acervo
permissivo pode sempre virar share-alike; o contrário está fechado para sempre. Recusar SA hoje não fecha
porta nenhuma.

## O livro-razão

`ATTRIBUTION.csv` — uma linha por recurso, e o gate `tests/arte-licencas-aceites.node.test.js` reprova um
ficheiro sem linha e uma linha sem ficheiro.

| coluna | o que carrega |
|---|---|
| `caminho` | caminho a partir da raiz do repositório; tem de começar por `art/` |
| `autor` | quem fez. Vazio **reprova** — «não consegui descobrir» não é licença |
| `fonte` | a **URL** da página de origem. Vazia ou sem URL **reprova** |
| `licenca` | uma das cinco identificações da tabela acima, e mais nenhuma |
| `derivado-de` | de que recursos este derivou, separados por `;`. Proveniência, não regra |

⚠️ **A coluna `fonte` é uma URL e não um nome por uma razão que foi medida.** O ADR-0133 exige que a licença
declarada seja conferida contra a **concessão na origem**, porque uma declaração a jusante é indício e não
autoridade — o `ElizaWy/LPC` declara tudo CC BY 3.0 ou OGA-BY 3.0, e uma das páginas que os créditos dele
citam concede apenas CC-BY-SA 3.0 e GPL 3.0. Essa conferência precisa de rede e ainda não existe; está na
[#140](https://github.com/the-inclusionist/the-inclusionist-engine/issues/140). A URL guardada por recurso é
a matéria-prima dela.

**Hoje o livro está vazio.** Nenhum recurso entrou nunca.
