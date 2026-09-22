// SPDX-License-Identifier: AGPL-3.0-or-later
// core/dom-query — O SELETOR DE DOM INJETADO, declarado UMA VEZ.
//
// ========================= POR QUE ESTE ARQUIVO EXISTE =========================
// A mesma declaração de `DomQuery` — uma seta genérica sobre `Element`, devolvendo `T | null` — estava
// escrita em DEZESSEIS módulos: `game/coin-spawning`, `game/quiz`, `input/gamepad`, `input/keydown`,
// `input/touch`, `input/touch-bindings`, `ui/activities-menu`, `ui/hud`, `ui/map-hub`, `ui/menu-nav`,
// `ui/settings-audio`, `ui/settings-controls`, `ui/settings-mobility`, `ui/settings-typo`, `ui/shell` e
// `ui/title`.
//
// Dezesseis cópias de uma verdade, que é o defeito do ADR-0039 um degrau acima: lá era um CAMPO descrito
// duas vezes, aqui é um TIPO descrito dezesseis.
//
// E, como sempre acontece com cópia, elas divergiram. O `game/session` declarava a sua NÃO-genérica,
// devolvendo um `SessionEl` estrutural. Uma função genérica atribuída a uma assinatura não-genérica é
// instanciada pela RESTRIÇÃO e não pelo padrão: o `$` real, que é `<T extends Element = HTMLElement>`,
// virava `Element` — e `Element` não tem `hidden`. Dois erros de tipo no `main.ts` nasciam daí, e nenhum
// deles falava de seletor.
//
// ========================= POR QUE EM `core/` =========================
// Porque é a camada que todos podem importar sem inverter nada — `input/`, `render/` e `ui/` (ADR-0173). E não custa
// dependência nenhuma: `Element` é global de `lib.dom`, e as duas consultas abaixo não tocam no DOM no import, então
// `core/` continua testável sem navegador.
// 📌 The two global queries (`$`, `$$`) live here and not in `ui/dom` so that `core/a11y-sr` and `render/crt` can use them
// without importing upward (issue #167); `ui/dom` still exports them under the same names.

/**
 * `document.querySelector`, na forma em que os módulos o recebem por INJEÇÃO — nunca importando `document`.
 *
 * O padrão é `HTMLElement` e não `Element` porque é o que os chamadores usam: `.hidden`, `.textContent`,
 * `.dataset`, `.focus()`. Quem precisa de outra coisa instancia — há um `$<SVGElement>` na árvore, e é por
 * causa dele que a RESTRIÇÃO continua sendo `Element`.
 */
export type DomQuery = <T extends Element = HTMLElement>(sel: string) => T | null;

/**
 * ⚠️ RESOLVIDO POR `globalThis` E NÃO PELO GLOBAL CRU, e a diferença é entre devolver `null` e LANÇAR.
 *
 * `document.querySelector(...)` com `document` inexistente dá `ReferenceError` — não `undefined` —, e a
 * assinatura destas duas funções promete `T | null`. Uma consulta que lança onde promete `null` é um defeito
 * pela própria assinatura, e ele viajava longe: medido em 2026-09-08, o `core/a11y-sr.srAlert` chama o `$`
 * daqui, e o `createGame` chama o `srAlert` ao mostrar o aviso de alcance — logo bootar a engine contra um
 * documento INJECTADO (um iframe, um editor ao lado do jogo, um teste) rebentava o boot inteiro num anúncio.
 *
 * 📌 É o ACHADO 15 do `boot/create-game` outra vez, e sobreviveu pela mesma razão: enquanto toda raiz era um
 * `main.ts` num navegador, o global ERA o documento certo. `globalThis.document` é a mesma coisa onde ele
 * existe, e é `undefined` — em vez de explosão — onde não existe.
 *
 * ⚠️ E ELAS CONTINUAM A OLHAR PARA O GLOBAL, de propósito: quem precisa de consultar OUTRO documento injecta
 * o seu (`create-game` tem um `$` próprio ligado ao `doc` do hospedeiro, e o `ui/pause-icons` tem o
 * `docDaMontagem`). O que este conserto muda não é ONDE se procura — é o que acontece quando não há onde.
 */
const docGlobal = (): Document | undefined => (globalThis as { document?: Document }).document;
export const $ = <T extends Element = HTMLElement>(s: string): T | null => docGlobal()?.querySelector<T>(s) ?? null;
export const $$ = <T extends Element = HTMLElement>(s: string): T[] => [...(docGlobal()?.querySelectorAll<T>(s) ?? [])];
