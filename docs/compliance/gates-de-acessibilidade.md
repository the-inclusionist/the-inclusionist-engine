<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Que critérios da WCAG este repositório AFERE — e quais ele apenas cita

Levantado em **2026-09-07** varrendo `tests/`, `app/js/`, `app/css/` e `scripts/` por citações de critério
(`\d\.\d+\.\d+`), e classificando cada uma por onde ela aparece. É a metade automatizável da **#13** (a
auditoria final WCAG 2.2 + GAG), e existe para que a auditoria manual saiba **o que não precisa de remedir** —
e, mais importante, **o que ninguém mediu**.

⚠️ **UMA CITAÇÃO NÃO É UM GATE.** Um comentário que diz «WCAG 2.1.1» descreve uma intenção; um caso em
`tests/` que reprova quando ela deixa de valer é a única coisa que impede a intenção de envelhecer. A coluna
da direita é a que interessa.

Este documento é também matéria-prima do **relatório anual** (ADR-0053), que o próprio registo descreve como
«em boa parte, um índice de gates que já correm».

## Aferidos — há caso que reprova

| critério | o que promete | onde é aferido |
|---|---|---|
| **1.3.1** Info and Relationships | a estrutura chega ao leitor de tela | `tests/menu-nav.browser.test.js` |
| **1.4.1** Use of Color | cor nunca é o único portador | `tests/state-never-by-colour-alone.browser.test.js` (os dois gates do menu de título foram com ele para o `game-platformer`, ADR-0174) |
| **1.4.11** Non-text Contrast (3:1) | indicador não-textual visível | `tests/menu-contrast-measured.node.test.js`, `tests/changed-mark-contrast.node.test.js` |
| **2.3.3** Animation from Interactions | movimento de interação é desligável | `tests/settings-motion.browser.test.js`, `tests/state.node.test.js` |
| **2.4.3** Focus Order | a ordem de foco segue a leitura | `tests/menu-nav.browser.test.js` |
| **2.5.5** Target Size (Enhanced, AAA) | 44 px onde a tela permite | `tests/pause-target-44px.browser.test.js`, `tests/touch.browser.test.js` |
| **2.5.8** Target Size (Minimum, AA) | 24 px de piso, e o espaçamento que o substitui | `tests/pause-target-44px.browser.test.js` |
| **1.4.6** Contrast (Enhanced, AAA) | menus a 7:1, não só 4,5:1 | `tests/menu-contrast-measured.node.test.js` |

E o gate que corre contra a aplicação CONSTRUÍDA, cobrindo A/AA em bloco: `scripts/axe-check.mjs`, no job
`a11y` do `.github/workflows/ci.yml`.

## ⚠️ Citados e NÃO aferidos — os buracos

Estes critérios aparecem no código como intenção declarada e **nenhum caso os mede**. Cada linha é trabalho
que a auditoria manual da #13 terá de fazer à mão, ou um gate por escrever.

| critério | onde é citado | por que o buraco importa |
|---|---|---|
| **2.2.2** Pause, Stop, Hide | provado pelo gate do clima, que saiu | 🔴 **O CASO SAIU NA F12** (ADR-0228): ele media a chuva de UM jogo a parar com o movimento reduzido, e foi com `render/weather` para o `game-platformer`. A REGRA é da engine — movimento automático tem de poder parar — e passou a não ter quem a reprove aqui |
| **2.4.1** Bypass Blocks | provado pelos gates da ordem de camadas, que saíram | 🔴 **OS CASOS SAÍRAM NA F12** (ADR-0228): liam `core/layers`, e uma ordem-z é a ordem das camadas de UM jogo. O que o critério exige da engine é que o *skip-link* seja alcançável, e isso está por reprovar aqui |
| **1.4.12** Text Spacing | `app/css/style.css` | os valores (`--ls`, `--ws`, `--lh`) estão na folha e nada afere que sobrevivem a uma mudança de tema |
| **2.1.1** Keyboard | `app/js/ui/menu-nav.ts` | é o critério mais estruturante do projeto e o único aferido só por partes — cada painel tem o seu caso, ninguém afirma o todo |
| **2.2.1** Timing Adjustable | `app/js/core/contract.ts` | o relógio de tempo de tela (#94) ainda não existe; quando existir, é aqui que ele se prova |
| **2.4.7** Focus Visible | `app/js/core/state.ts`, `app/js/render/high-contrast.ts` | o `:focus-visible` tem regra no CSS e nenhum caso afere que ela sobrevive ao alto contraste, que é onde ela mais importa |

### ⚠️ E um que é pior que um buraco: 2.3.1 Three Flashes

🔴 **E PIOROU EM 23/09**: o módulo que declara `FLASH_LIMIT` como o passe mais externo saiu deste repositório na
F12 (ADR-0228), logo a frase abaixo descreve uma decisão que já não está escrita aqui. ⚠️ O limite de flashes é
saúde — é a WCAG 2.3.1 — e é da ENGINE; onde ela volta a declará-lo é a fronteira seguinte.

O módulo da ordem de camadas declarava `FLASH_LIMIT` como o **passe mais externo** da cadeia de pós-processo, e
explica porquê com todas as letras: *«ele decide se a imagem pode FAZER MAL […] o único quadro cuja
luminância importa é o que chega ao olho»*.

**Ele não está implementado.** O próprio ficheiro diz isso — *«FLASH_LIMIT ainda NÃO está implementado; está
declarado aqui, e aferido por teste, para que quem o implementar encontre o lugar certo já ocupado»* — e o
que o teste afere é a **ordem** na lista, não o efeito.

Quer dizer: a ordem correta de um limitador de cintilação está garantida, e o limitador não existe. É uma
promessa de segurança (não de conforto) sobre epilepsia fotossensível, e é a linha mais urgente desta página.

## O que este documento não é

Não é um veredito de conformidade, e o §53 do requerimento exige que os dois níveis sejam separados: **AA em
todo o conteúdo, AAA nas telas de entrada e nos menus de acessibilidade**. Um documento que desse um número
único estaria a esconder exactamente a distinção que a promessa faz.

⚠️ E o levantamento acha o que está ESCRITO. Um critério que ninguém citou não aparece aqui — nem como
aferido, nem como buraco. Isso é uma terceira categoria, invisível a esta varredura, e é a razão de a
auditoria manual da #13 continuar a ser necessária depois de todos os buracos acima serem fechados.
