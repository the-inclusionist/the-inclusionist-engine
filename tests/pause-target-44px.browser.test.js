// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TARGET SIZE, MEASURED IN THE REAL LAYOUT — item 6 of ADR-0044.
//
// ========================= WHY THIS GATE IS A BROWSER ONE, NOT A TEXT ONE =========================
// The other CSS gates in this repository read `style.css` and check declarations. That would not be enough here:
// a button's height is declared nowhere — it COMES OUT of `padding` + `line-height` + `font-size` + whatever the
// cascade does with the three. That is how the pause card's 35.6 px appeared: nobody wrote them, they resulted. A
// gate that read `min-height:44px` in the file would prove the line exists, not that the button is 44 px.
//
// So this file IMPORTS the real `style.css`, mounts a pause card with the production markup and MEASURES with
// `getBoundingClientRect`. It is the same difference as between "the mode promises 7:1" and "the pair measures 7.80:1".
//
// ========================= WHAT 44 IS, AND WHAT IT IS NOT =========================
// 44 is NOT the WCAG minimum — 2.5.8 asks for 24×24 CSS px, and the card already passed that with room to spare. 44 is
// Apple's recommendation (HIG), and this project treats a floor as a floor.
//
// BUT THE STRONGEST DEFENCE IS NEITHER STANDARD — it is the physical ruler in millimetres. The Dev questioned the
// number («44 é exagero»), and what answered it was the thumb: at 96 px/in, 44 CSS px = 11.6 mm, above the 9.6 mm thumb
// target and at the size where adult performance levels off (the sources are in `input/touch`). The [Interface] case at
// the end pins that REASONING, not only the number: when someone proposes lowering the target, what is lost is not
// "Apple's recommendation", it is millimetres of thumb.
//
// ========================= WHY NOT 22 =========================
// The Dev objected that the screen is drawn at 320×180 and the minimum in use is 640×360, so the button would need 22 in
// the base drawing. The reasoning is RIGHT — for what is drawn INSIDE the canvas. These buttons are not, and the
// measurement says why: 320×180 is the canvas buffer, and `#game-region`/`#dom-layer` are 640×360 CSS with
// `transform: none`. The DOM layer never enters that coordinate system.
//
// And the FRAME the Dev set is the real floor: 640×360, which is what the [Boundary] case uses. Measuring in a frame
// nobody lives in is not measuring.
//
// ⚠️ (2026-09-12) The cost this measurement once exposed — 413 px of content for 353 visible at 640×360 — is closed
// by the ADR-0163 block below: seven 44 px items fit, with the title at the 16 px floor and a 2 px gap.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../app/css/style.css';
import { screenPauseMarkup } from '../app/js/ui/pause-markup.js';
import { PM_BTNS, PM_OPTIONS_BTNS } from '../app/js/ui/pause-buttons.js';
import { minimumTarget } from '../app/js/ui/layout.js';

/** The target of ADR-0044 §6, in CSS px. */
const ALVO_PX = 44;

/**
 * THE SMALLEST FRAME IN USE, and it is not the drawing's 320×180.
 *
 * The Dev set this one. 320×180 is the canvas BUFFER; the browser scales it 2× and the region is 640×360 CSS. And the
 * DOM layer — the pause card, the accessibility bar, the touch controls — does not enter that coordinate system:
 * MEASURED in the built game, `#game-region` and `#dom-layer` are 640×360 CSS with `transform: none`. A button
 * declared 44px measures 44 CSS px on screen, not 88.
 *
 * Measuring in a frame production does not have is measuring something nobody lives in.
 */
const MENOR_QUADRO = { w: 640, h: 360 };

/**
 * WHY 44, and the strongest defence is not the standard — it is the millimetre.
 *
 * WCAG 2.5.8 asks for 24×24 and Apple recommends 44; both are arguments from authority. What decides here is the
 * PHYSICAL SIZE: the sources cited in `input/touch` put the adult thumb target at 9.6 mm and the point where
 * performance levels off at 11.5 mm, and a child is less precise than that.
 *
 * At 96 px/in, 44 CSS px = 11.6 mm. And 22 px, which would be the sum if these buttons lived in the 320×180 space,
 * would give 5.8 mm: below the 9.6 mm thumb target, and below WCAG's 24 px floor. The conversion assumes 96 px/in; on
 * school hardware only the device can answer.
 */
const MM_POR_PX = 25.4 / 96;

let palco;

/** Mounts a REAL pause card inside a frame of the requested size, and returns the `.screen-pause`. */
function montar(largura, altura) {
  palco = document.createElement('div');
  palco.className = 'player-screen';
  palco.style.cssText = `position:relative;width:${largura}px;height:${altura}px`;
  const sp = document.createElement('div');
  sp.className = 'screen-pause';
  sp.innerHTML = screenPauseMarkup({
    player: 0, numPlayers: 1, pmButtons: PM_BTNS, optionsButtons: PM_OPTIONS_BTNS,
    dynLabel: () => null, t: (k) => k,
  });
  palco.appendChild(sp);
  document.body.appendChild(palco);
  return sp;
}

const itensVisiveis = (sp) => [...sp.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')];

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { if (palco) palco.remove(); palco = null; });

describe('menu de pausa · 44 px, centrado e mais largo (ADR-0044, item 6)', () => {
  it('[Zero] o gate está medindo layout de verdade', () => {
    // Without this, a `style.css` that failed to load would leave every case below measuring zero-height boxes —
    // and a gate that passes by measuring nothing is worse than none.
    const sp = montar(900, 700);
    const itens = itensVisiveis(sp);
    expect(itens).toHaveLength(PM_BTNS.length);
    expect(itens[0].getBoundingClientRect().width).toBeGreaterThan(0);
    expect(getComputedStyle(sp).position, 'o style.css não foi aplicado').toBe('absolute');
  });

  it('[Right] todo item da lista tem ao menos 44 px de altura', () => {
    const sp = montar(900, 700);
    const baixos = itensVisiveis(sp)
      .map((b) => [b.dataset.act, b.getBoundingClientRect().height])
      .filter(([, h]) => h < ALVO_PX - 0.5)
      .map(([a, h]) => `${a}: ${h.toFixed(1)}px`);
    expect(baixos, 'item abaixo de 44 px: ' + baixos.join(' | ')).toEqual([]);
  });

  it('[Boundary] no MENOR quadro em uso (640×360) o alvo não encolhe', () => {
    // This is where the rule broke: `.screen-pause .pm-btn` tightened the padding to fit more into the smaller frame —
    // the worst possible place to shrink a touch target. The card scrolls; the button does not.
    //
    // And the frame is the REAL one: 640×360, the floor production uses.
    const sp = montar(MENOR_QUADRO.w, MENOR_QUADRO.h);
    const baixos = itensVisiveis(sp)
      .map((b) => [b.dataset.act, b.getBoundingClientRect().height])
      .filter(([, h]) => h < ALVO_PX - 0.5)
      .map(([a, h]) => `${a}: ${h.toFixed(1)}px`);
    expect(baixos, 'no quadro apertado, item abaixo de 44 px: ' + baixos.join(' | ')).toEqual([]);
  });

  it('[Right] a lista é UMA coluna — o que se vê é a ordem em que se anda', () => {
    // A two-column grid (`grid-template-columns:1fr 1fr`) would make the arrow move in DOM order, so "down" would jump
    // to the right-hand column — the same lie the opening submenus used to tell.
    const sp = montar(900, 700);
    const esquerdas = new Set(itensVisiveis(sp).map((b) => Math.round(b.getBoundingClientRect().left)));
    expect([...esquerdas], 'a lista voltou a ter mais de uma coluna').toHaveLength(1);
  });

  it('[Right] a lista é CENTRADA no cartão e mais larga que um botão de antes', () => {
    const sp = montar(900, 700);
    const card = sp.querySelector('.pause-card').getBoundingClientRect();
    const lista = sp.querySelector('.pause-menu:not([hidden])').getBoundingClientRect();
    const desvio = Math.abs((lista.left + lista.right) / 2 - (card.left + card.right) / 2);
    expect(desvio, 'a lista saiu do centro do cartão').toBeLessThan(2);
    // 262 px was the MEASURED width of an item before this decision (see ADR-0044). "Wider" has to be a number,
    // or it is opinion.
    expect(lista.width, 'a lista não ficou mais larga que os 262 px medidos antes').toBeGreaterThan(262);
  });

  it('[Interface] 44 CSS px é a MEDIDA FÍSICA que o painel de toque deste jogo já exigia', () => {
    // The case exists to pin the REASONING, not only the number. When someone proposes lowering the target — and the
    // proposal is reasonable at first sight, because 44px of 360 is 12% of the screen height —, this is the line
    // that says what is lost: not "Apple's recommendation", but millimetres of thumb.
    expect(+(ALVO_PX * MM_POR_PX).toFixed(1), '44 CSS px saiu da faixa da mão de criança (11–12,5 mm)').toBeGreaterThanOrEqual(11);
    expect(+(22 * MM_POR_PX).toFixed(1), 'a alternativa de 22 px daria menos que o alvo de polegar (9,6 mm)').toBeLessThan(9.6);
    expect(ALVO_PX, 'abaixo de 24 o alvo furaria o piso da WCAG 2.5.8, não só a recomendação da Apple').toBeGreaterThanOrEqual(24);
  });

  it('[Interface] o submenu de opções obedece à MESMA régua', () => {
    // It is the list where the child spends the most time, item by item, adjusting what gets in her way. It would be
    // the last place to deserve a smaller button — and the first to escape a gate that only looked at the root.
    const sp = montar(900, 700);
    sp.querySelector('.pause-menu[data-sub="raiz"]').hidden = true;
    sp.querySelector('.pause-menu[data-sub="opcoes"]').hidden = false;
    const baixos = itensVisiveis(sp)
      .map((b) => [b.dataset.act, b.getBoundingClientRect().height])
      .filter(([, h]) => h < ALVO_PX - 0.5)
      .map(([a, h]) => `${a}: ${h.toFixed(1)}px`);
    expect(baixos, 'item do submenu abaixo de 44 px: ' + baixos.join(' | ')).toEqual([]);
    expect(itensVisiveis(sp).length).toBe(PM_OPTIONS_BTNS.length);
  });
});

// ===================================================================================================
// THE TARGET IS 44 px AT 640×360 AND GROWS WITH THE SCALE (ADR-0163) — ADR-0095's height ruler is gone
// ===================================================================================================
// 🔴 ADR-0163 made 640×360 the engine's resolution floor, and the Dev set the target: 44 px («44px é o correto, eu errei
// quando disse 42px»). There is no smaller screen left to shrink for; what is left is the card having to FIT with 44 px
// items. (ADR-0095 used to lower the target with the viewport height, because a card of 44 px items scrolled at 640×360.)
describe('o alvo de toque é 44 px a 640×360 e cresce com a escala (ADR-0163)', () => {
  /** Mounts the card with the variable `applyScale` writes for scale `k` — the production path. */
  function montarNaEscala(k) {
    const sp = montar(320 * k, 180 * k);
    palco.style.setProperty('--alvo-min', minimumTarget(k) + 'px');
    return sp;
  }

  it('[Interface] o piso é do CÓDIGO, não deste teste — 44 px no mínimo, e cresce com k', () => {
    expect(minimumTarget(2)).toBe(44);
    expect(minimumTarget(4)).toBe(88);
    // below k=2 there is no screen (ADR-0163), and an invalid k does not invent a smaller target
    expect(minimumTarget(1)).toBe(44);
    expect(minimumTarget(NaN)).toBe(44);
  });

  it('🔴 [Right] a 640×360 todo item da raiz e do submenu mede pelo menos 44 px', () => {
    const sp = montarNaEscala(2);
    for (const sub of ['raiz', 'opcoes']) {
      sp.querySelectorAll('.pause-menu').forEach((m) => { m.hidden = m.dataset.sub !== sub; });
      const baixos = itensVisiveis(sp).map((b) => [b.dataset.act, b.getBoundingClientRect().height]).filter(([, h]) => h < 43.5);
      expect(baixos, `${sub}: ${baixos.map(([a, h]) => `${a} ${h.toFixed(1)}px`).join(' | ')}`).toEqual([]);
    }
  });

  it('🔴 [Right] com itens de 44 px, o cartão CABE a 640×360 — a raiz e o submenu, sem rolar', () => {
    const sp = montarNaEscala(2);
    for (const [sub, n] of [['raiz', PM_BTNS.length], ['opcoes', PM_OPTIONS_BTNS.length]]) {
      sp.querySelectorAll('.pause-menu').forEach((m) => { m.hidden = m.dataset.sub !== sub; });
      expect(itensVisiveis(sp).length, 'o caso mediria uma lista vazia').toBe(n);
      const card = sp.querySelector('.pause-card');
      const excesso = card.scrollHeight - card.clientHeight;
      expect(excesso, `${sub}: o cartão transborda ${excesso}px a 640×360`).toBeLessThanOrEqual(0);
    }
  });

  it('⚠️ [Right] a 1280×720 o alvo acompanha a escala (88 px)', () => {
    const sp = montarNaEscala(4);
    const h = Math.min(...itensVisiveis(sp).map((b) => b.getBoundingClientRect().height));
    expect(h).toBeGreaterThanOrEqual(87.5);
  });

  it('⚠️ [Right] o ESPAÇAMENTO entre centros continua a proteger o dedo — nunca menos de 24 px', () => {
    for (const k of [2, 3, 4]) {
      const sp = montarNaEscala(k);
      const centros = itensVisiveis(sp).map((b) => { const r = b.getBoundingClientRect(); return r.top + r.height / 2; }).sort((a, b) => a - b);
      for (let i = 1; i < centros.length; i++) {
        expect(centros[i] - centros[i - 1], `k=${k}: dois itens a ${(centros[i] - centros[i - 1]).toFixed(1)}px`).toBeGreaterThanOrEqual(24);
      }
      palco.remove(); palco = null;
    }
  });
});

// ========================= MUTATIONS CHECKED =========================
//   ⚠️ (2026-09-12) the ADR-0095 ruler cases were replaced by the ADR-0163 block above; their mutations below that name
//   `REGUA_DE_ALVO` or the 24/34/44 steps are history — the ones for this block are at its end of the list.
//   · removing `min-height:44px` from `.pm-btn` → `[Right] todo item` fails, measuring ~35.6 px.
//   · restoring `.screen-pause .pm-btn{padding:.3rem .5rem}` with no minimum height → "[Boundary] o quadro
//     apertado" fails, and the other cases stay green — which is exactly the hole it closes.
//   · restoring `grid-template-columns:1fr 1fr` on `.pause-menu` → `[Right] a lista é UMA coluna` fails
//     with two distinct widths.
//   · lowering `ALVO_PX` to 22 (the proposal the Dev raised) → `[Interface] 44 CSS px é a MEDIDA FÍSICA`
//     fails in TWO assertions: 5.8 mm is below the thumb target and 22 breaks WCAG's floor of 24.
//   · restoring a LITERAL `min-height:44px` on `.pm-btn`, instead of `var(--alvo-min,44px)` → the three ruler cases
//     fail: the item at 360 measures 44 where the ruler says 24, and the sheet ignores the decision again.
//   · lowering the FLOOR of `REGUA_DE_ALVO` from 24 to 14 → the three size cases fail and ⚠️ the SPACING one does NOT.
//     Not a hole: a `.pm-btn` measures ~35.6 px from `padding` + line-height (the number in the first line of this
//     list), so a `min-height` of 14 never bites. The spacing case checks `gap`/`padding`, and that is what turns it
//     red — it is written in the body of the case itself.
