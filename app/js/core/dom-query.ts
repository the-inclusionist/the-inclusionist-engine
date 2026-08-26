// SPDX-License-Identifier: AGPL-3.0-or-later
// core/dom-query — O SELETOR DE DOM INJETADO, declarado UMA VEZ.
//
// ========================= POR QUE ESTE ARQUIVO EXISTE =========================
// A mesma declaração de `DomQuery` — uma seta genérica sobre `Element`, devolvendo `T | null` — estava
// escrita em DEZESSEIS módulos: `game/coin-spawning`, `game/quiz`, `input/gamepad`, `input/keydown`,
// `input/touch`, `input/touch-bindings`, `ui/activities-menu`, `ui/hud`, `ui/map-hub`, `ui/menu-nav`,
// `ui/settings-audio`, `ui/settings-controls`, `ui/settings-motor`, `ui/settings-typo`, `ui/shell` e
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
// Porque é a camada que todos podem importar sem inverter nada — `game/`, `input/`, `render/` e `ui/`. E
// não custa dependência nenhuma: o arquivo é SÓ TIPO, `import type` é apagado na compilação, e `Element` é
// global de `lib.dom`, ligado no tsconfig. Nada aqui roda, então a propriedade de `core/` ser testável sem
// navegador continua intacta.

/**
 * `document.querySelector`, na forma em que os módulos o recebem por INJEÇÃO — nunca importando `document`.
 *
 * O padrão é `HTMLElement` e não `Element` porque é o que os chamadores usam: `.hidden`, `.textContent`,
 * `.dataset`, `.focus()`. Quem precisa de outra coisa instancia — há um `$<SVGElement>` na árvore, e é por
 * causa dele que a RESTRIÇÃO continua sendo `Element`.
 */
export type DomQuery = <T extends Element = HTMLElement>(sel: string) => T | null;
