// SPDX-License-Identifier: AGPL-3.0-or-later
// THE OPENING MENU — a width that does not wrap lines, and submenus that are LISTS, not grids (ADR-0044).
//
// ========================= WHY IT IS ACCESSIBILITY, NOT LOOKS =========================
// Two observations of the Dev's, in the same request:
//
//   · a narrow `#tm-main` (13em) makes labels take TWO lines. A two-line button changes height with its text, and the
//     text changes with the language — the same screen has one geometry in pt-BR and another in Spanish. Someone
//     navigating by ear does not notice; someone navigating by residual vision loses the alignment they used to
//     orient themselves. (Since ADR-0130 rule 6 the width is the widest label's own, not a number.)
//
//   · arrow navigation walks in DOM order, so in a two-column GRID "down" jumps to the right-hand column. The ADR-0044
//     ring (item 1) is right in code — `nextTitleIndex` wraps — and a grid LAYOUT would lie about it: the child
//     presses down and the focus crosses the screen. A vertical list makes what is seen match what happens.
//
// A vertical list of eleven fractions does not fit the frame, so it SCROLLS — as the Dev asked, in so many words.
// Scrolling is the price of the visual order being the navigation order, and it is the right price: `focus()` brings
// the item into view by itself, so keyboard or pad users never lose the focus out of sight.
//
// ========================= WHY A CSS GATE, AND NOT "it looked fine on screen" =========================
// Because the regression is silent. Someone puts back `grid-template-columns:1fr 1fr` to fit more, the screen looks
// nicer, and arrow navigation jumps columns again with nothing failing. The same reason as the contrast gate: the
// promise and the screen cannot drift apart silently.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(process.cwd(), 'app', 'css', 'style.css'), 'utf8');
/** Without comments: a `/* … *\/` between two rules becomes part of the next rule's selector and nothing matches. (The
 *  `[Zero]` failed first when this file was written, and for the right reason.) */
const LIMPO = CSS.replace(/\/\*[\s\S]*?\*\//g, ' ');

/** The opening menu's five submenus. `#tm-main` is left OUT on purpose: it is the short list, with no scrolling. */
const SUBMENUS = ['#tm-alf', '#tm-mat', '#tm-tab', '#tm-fr', '#tm-cen'];

const BLOCO = /([^{}]+)\{([^}]*)\}/g;

/**
 * Declarations that reach `sel`, in file order — the last one wins.
 *
 * Matches by selector TOKEN, not by `includes`: `#tm-fr` must not match `#tm-frac`, and `#tm-fr .title-btn` is a rule
 * about the BUTTONS, not the list. Only rules whose selector ends at the token count.
 */
function declaracoes(sel) {
  const out = [];
  for (const m of LIMPO.matchAll(BLOCO)) {
    const alcanca = m[1].split(',').some((s) => s.trim() === sel);
    if (!alcanca) continue;
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i > 0) out.push([d.slice(0, i).trim(), d.slice(i + 1).trim()]);
    }
  }
  return out;
}
/** A property's EFFECTIVE value: the last declaration that sets it. */
function prop(sel, nome) {
  const hits = declaracoes(sel).filter(([k]) => k === nome);
  return hits.length ? hits[hits.length - 1][1] : null;
}
const em = (v) => (v && /^([\d.]+)em$/.test(v) ? parseFloat(v) : NaN);

describe('menu de abertura · largura de uma linha e submenus em lista vertical', () => {
  it('[Zero] o gate está lendo o style.css de verdade', () => {
    // Without this, renaming the file would leave the cases below green for measuring nothing.
    expect(CSS.length).toBeGreaterThan(5000);
    expect(declaracoes('.title-menu').length).toBeGreaterThan(0);
  });

  it('[Right] the six opening menus take the width of their widest item — `fit-content`, not a number (ADR-0130 rule 6)', () => {
    // A number chosen in Portuguese truncates or wraps a longer translation. The browser half measures the result
    // (`menu-width-follows-content.browser.test.js`); this half names the declaration, so the regression names itself.
    const fixas = ['#tm-main', ...SUBMENUS]
      .filter((s) => prop(s, 'width') !== 'fit-content')
      .map((s) => `${s}: width=${prop(s, 'width')}`);
    expect(fixas, 'an opening menu with a width that does not follow its content: ' + fixas.join(' | ')).toEqual([]);
  });

  it('[Right] nenhum submenu da abertura é grade de duas colunas', () => {
    // The grid is what makes "down" jump to the right-hand column. If it comes back, this is the line that fails.
    const grades = SUBMENUS
      .map((s) => [s, prop(s, 'grid-template-columns')])
      .filter(([, v]) => v && v.trim().split(/\s+/).length > 1)
      .map(([s, v]) => `${s}: ${v}`);
    expect(grades, 'submenu da abertura voltou a ser grade — a seta passa a andar em ordem de DOM, não do que se vê: ' + grades.join(' | ')).toEqual([]);
  });

  it('[Right] cada submenu da abertura ROLA em vez de transbordar', () => {
    // A vertical list of eleven items does not fit the frame. Without scrolling it runs off the bottom of the canvas and
    // the last items become unreachable — the opening menu's `quit` is "Voltar", and it is the LAST.
    const faltam = SUBMENUS
      .filter((s) => !/auto|scroll/.test(prop(s, 'overflow-y') || '') || !prop(s, 'max-height'))
      .map((s) => `${s}: overflow-y=${prop(s, 'overflow-y')} max-height=${prop(s, 'max-height')}`);
    expect(faltam, 'submenu sem rolagem declarada — os itens do fim saem do quadro: ' + faltam.join(' | ')).toEqual([]);
  });

  it('[Boundary] o item que ganha o foco não fica embaixo do cabeçalho grudado', () => {
    // MEASURED in the browser, and the reason the line exists: wrapping from the last to the first, the browser
    // considered the first button "already visible" and did not scroll — but the `sticky` header covered 12px of it.
    // Covered focus is lost focus for someone reading by residual vision, and no node layout test would see it.
    // `scroll-margin-top` is what tells the browser where the USEFUL frame begins.
    const falta = SUBMENUS
      .map((s) => [s, em(prop(`${s} .title-btn`, 'scroll-margin-top'))])
      .filter(([, v]) => !(v >= 2))
      .map(([s, v]) => `${s}: ${v}`);
    expect(falta, 'botão sem margem de rolagem — o cabeçalho grudado encobre o foco: ' + falta.join(' | ')).toEqual([]);
  });

  it('[Right] NADA dentro de um submenu da abertura se deita na horizontal', () => {
    // No exception for "groups" (the fraction notations, the times-table number rows): the Dev rejected them —
    // «menus que não estão na vertical, mas sim MISTOS». For someone walking with arrows, a horizontal group is a part of
    // the list where "down" walks SIDEWAYS. The order seen must be the order walked, without exception — an exception
    // would appear right in the middle of the list, with no warning.
    // ⚠️ A BUTTON IS NOT A CONTAINER OF ITEMS. This case's rule is about containers laying several NAVIGABLE items side
    // by side — that is what makes "down" walk sideways. A button's INTERNAL arrangement (the ☑ mark beside the symbol,
    // inside the same clickable box) is one thing for whoever navigates, and laying it flat moves no cursor.
    //
    // (It is why `#tm-fr .fnot-opt`, the notation button whose mark and symbol sit side by side, is exempt. If one of
    // these names stops being a button, it is watched again.)
    const BOTOES = ['.title-btn', '.fnot-opt', '.pi-btn', '.pm-btn'];
    const ehBotao = (sel) => BOTOES.some((b) => sel.endsWith(b));
    const deitados = [];
    for (const m of LIMPO.matchAll(BLOCO)) {
      const sels = m[1].split(',').map((x) => x.trim())
        .filter((x) => SUBMENUS.some((s) => x.startsWith(s + ' ')) && !ehBotao(x));
      if (!sels.length) continue;
      const decl = Object.fromEntries(m[2].split(';').map((d) => {
        const i = d.indexOf(':');
        return i > 0 ? [d.slice(0, i).trim(), d.slice(i + 1).trim()] : ['', ''];
      }));
      const flexDeitado = decl['display'] === 'flex' && (decl['flex-direction'] || 'row').startsWith('row');
      const gradeLarga = decl['grid-template-columns'] && decl['grid-template-columns'].trim().split(/\s+/).length > 1;
      if (flexDeitado || gradeLarga) deitados.push(sels.join(',') + ' → ' + (decl['display'] || decl['grid-template-columns']));
    }
    expect(deitados, 'container horizontal dentro de um submenu da abertura: ' + deitados.join(' | ')).toEqual([]);
  });

  it('[Right] a barra do HUD tem altura declarada e o HUD desce pelo MESMO token', () => {
    // The defect this prevents was seen on screen: the bar and the HUD BOTH anchored at the top, and the HUD drawn over
    // the icons. Two measures that must agree, written in two places, are the drift this repository has paid for many
    // times with `DomQuery` — here agreement is structural: both read the same token, so one cannot move without the other.
    const alturaBarra = prop('.screen-a11y', 'height');
    const topoDoHud = prop('.screen-exp .vphud', 'top');
    expect(alturaBarra, '.screen-a11y sem altura declarada — o HUD não tem por onde descer').toBeTruthy();
    expect(topoDoHud, '.vphud não desceu: volta a ser desenhado por cima dos ícones').toBeTruthy();
    expect(topoDoHud, 'o HUD desceu por uma medida PRÓPRIA — as duas vão divergir').toBe(alturaBarra);
    expect(alturaBarra).toContain('--a11y-h');
  });

  it('[Right] a explicação da barra fica FORA do fluxo — só os botões ocupam espaço', () => {
    // «É para aparecer somente os botões, nada de explicação» (the Dev). A caption in the flow reserves height on the
    // game screen even when empty, and the bar stops being a shortcut and becomes a band.
    expect(prop('.screen-a11y .pause-icons-cap', 'position')).toBe('absolute');
  });

  it('[Interface] o casador de seletor distingue a LISTA dos seus botões', () => {
    // The case that keeps the gate from fooling itself. `#tm-fr .frac-nots{justify-content:center}` must not be read as a
    // declaration about `#tm-fr`, or a child's property would count as the list's.
    expect(declaracoes('#tm-fr .frac-nots').length).toBeGreaterThan(0);
    expect(declaracoes('#tm-fr').some(([k]) => k === 'justify-content')).toBe(false);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · putting back `#tm-alf{grid-template-columns:1fr 1fr}` → the [Right] no-grid case fails naming `#tm-alf: 1fr 1fr`.
//   · removing `overflow-y:auto` from the five's rule → the [Right] scrolling case fails with the five names.
//   · putting back `#tm-main{width:26em}` (2026-09-25) → the [Right] fit-content case fails naming `#tm-main: width=26em`.
//   · removing `scroll-margin-top` from the buttons → the [Boundary] focused-item case fails with the five.
//   · putting back `display:flex` (without `flex-direction:column`) on `#tm-fr .frac-nots` → the [Right] nothing-lies-
//     horizontal case fails naming the selector.
