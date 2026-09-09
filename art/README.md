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
  imagem semântica traçada de um sprite é derivada dele, logo tudo o que o pipeline produzisse a partir de
  uma fonte SA sairia SA. Essa saída é a arte futura do próprio projeto, que ele deixaria de poder licenciar.
  Segurar isso custa uma quarentena, e o Dev decidiu não a pagar.

📌 A razão de fundo, que sobrevive à moda: **a CC BY é compatível num sentido só com a BY-SA.** Um acervo
permissivo pode sempre virar share-alike; o contrário está fechado para sempre. Recusar SA hoje não fecha
porta nenhuma.

⚠️ **E a recusa é informada:** existe caminho legal de CC BY-SA **4.0** até um projeto AGPL — a 3.0 sobe para
4.0 numa derivada, a Creative Commons declarou a GPLv3 compatível num sentido só, e o §13 da GPLv3 permite
combinar com AGPLv3. O **ADR-0133** descreve o caminho e recusa-o, com os quatro custos escritos.

## As fontes já medidas (2026-09-09)

| fonte | licença lida na origem | veredicto |
|---|---|---|
| **Kenney** · `kenney.nl/assets` | CC0 1.0 — igual em `kenney.nl`, itch.io e OpenGameArt | ✅ entra |
| **ansimuz** · `ansimuz.itch.io` | CC0 1.0 **por pacote** (3 amostrados) | ✅ entra, **lido pacote a pacote** |
| **Tiny Swords** · `TS_old version_CC0 Licensed` | CC0 — declarado no **nome do ficheiro**, na página do autor | ✅ entra, **com a ressalva abaixo** |
| **Tiny Swords** · `Tiny Swords (Free Pack).zip` | concessão própria do autor, **não é nenhuma das quatro** | ❌ fica de fora |
| **Liberated Pixel Cup** · `OpenGameArt/LiberatedPixelCup` | CC BY-SA 3.0 **ou** GPL-3.0 | ❌ os dois braços são recusados |

⚠️ **O CASO DO TINY SWORDS É O QUE JUSTIFICA A LISTA SER FECHADA, e a razão é mais simples do que uma leitura
jurídica.** A licença do pacote atual são três linhas do próprio autor, e as duas primeiras são permissivas:
*«Feel free to use this asset pack in both personal and commercial projects, modifying the assets as needed.
Crediting is not required…»*. Só a terceira restringe: *«You may not redistribute, resell, or repackage the
assets, even if the files are modified.»*

**Ele fica de fora porque não é nenhuma das quatro**, e mais nada precisa de ser decidido. 🎯 É exactamente
aqui que uma lista vale mais do que um teste: «redistribuir» exigiria interpretação — um repositório público
serve os PNG em bruto a quem quiser, e é defensável que isso seja redistribuição, mas isso é uma **leitura** e
não uma medição. Um acervo cuja admissibilidade depende de quem interpreta a palavra é um acervo que entra no
dia em que alguém tiver pressa.

📌 **E a ressalva do pacote CC0 é a nossa própria regra aplicada a si mesma:** a única afirmação de CC0 na
página é o **nome do ficheiro**. Não há campo de licença, e nenhuma outra frase o diz. É o autor a declará-lo
na página dele, o que basta para acreditar — mas a linha do livro tem de apontar para o `LICENSE` de dentro
do zip, que é a concessão a sério, e não para um nome de ficheiro.

⚠️ **E no ansimuz o perfil não concede nada: a página do PACOTE é que concede.** No `warped-city` a secção de
música descreve termos parecidos com CC-BY enquanto o campo de metadados diz CC0 — quando o campo e a prosa
discordam, o pacote não está resolvido, e a linha do livro não pode fingir que está.

Quais recursos entram e para que jogos é **direção de arte**, e não se decide aqui.

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
