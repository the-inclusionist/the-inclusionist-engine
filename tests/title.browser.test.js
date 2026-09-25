// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/title.initTitle (BROWSER project: needs a real `document` — hidden/focus). Contract: show(which) hides the
// OTHER 5 submenus, shows `which`, toggles the footer legend and the title block (only on tm-main), and focuses the 1st
// <button> of the submenu now visible. See docs/5-Refactoring/plan-modularization-map.md (Stage 4).
import { describe, it, expect } from 'vitest';
import { initTitle } from '../app/js/ui/title.js';

function mountTitleDom() {
  document.body.innerHTML = `
    <div id="title-overlay">
      <div class="title-block">TÍTULO DO JOGO</div>
      <div id="tm-main"><button type="button">Ludico</button><button type="button">Alfabetização</button></div>
      <div id="tm-alf"><button type="button">Alf 1</button></div>
      <div id="tm-mat"><button type="button">Mat 1</button></div>
      <div id="tm-tab"><button type="button">Jogar</button></div>
      <div id="tm-fr"><button type="button">Fração 1</button></div>
      <div id="tm-cen"><button type="button">Cidade</button></div>
    </div>
    <div id="title-legend">legenda</div>
  `;
}

const $ = (sel) => document.querySelector(sel);

describe('ui/title · initTitle(ctx).show', () => {
  it('[Happy] tm-main: mostra só ele, legenda visível, bloco de título visível, foca o 1º botão', () => {
    mountTitleDom();
    const title = initTitle({ $ });
    title.show('tm-main');
    expect($('#tm-main').hidden).toBe(false);
    for (const id of ['tm-alf', 'tm-mat', 'tm-tab', 'tm-fr', 'tm-cen']) expect($('#' + id).hidden).toBe(true);
    expect($('#title-legend').hidden).toBe(false);
    expect($('#title-overlay .title-block').style.display).toBe('');
    expect(document.activeElement).toBe($('#tm-main button'));
  });

  it('[Interface] tm-cen: só ele visível, legenda ESCONDIDA, bloco de título escondido, foca o botão de "Cidade"', () => {
    mountTitleDom();
    const title = initTitle({ $ });
    title.show('tm-cen');
    expect($('#tm-cen').hidden).toBe(false);
    for (const id of ['tm-main', 'tm-alf', 'tm-mat', 'tm-tab', 'tm-fr']) expect($('#' + id).hidden).toBe(true);
    expect($('#title-legend').hidden).toBe(true);
    expect($('#title-overlay .title-block').style.display).toBe('none');
    expect(document.activeElement).toBe($('#tm-cen button'));
  });

  it('[Boundary] trocar de submenu várias vezes sempre deixa exatamente 1 visível', () => {
    mountTitleDom();
    const title = initTitle({ $ });
    const order = ['tm-main', 'tm-mat', 'tm-fr', 'tm-mat', 'tm-main'];
    for (const which of order) {
      title.show(which);
      const visible = ['tm-main', 'tm-alf', 'tm-mat', 'tm-tab', 'tm-fr', 'tm-cen'].filter((id) => !$('#' + id).hidden);
      expect(visible).toEqual([which]);
    }
  });

  it('[Zero] submenu sem <button> (ex.: DOM incompleto) não quebra — só não foca nada', () => {
    mountTitleDom();
    $('#tm-tab').innerHTML = ''; // no button
    const title = initTitle({ $ });
    expect(() => title.show('tm-tab')).not.toThrow();
    expect($('#tm-tab').hidden).toBe(false);
  });

  // ===================== «BACK» RETURNS THE CURSOR TO WHAT OPENED THE MENU (ADR-0130 rule 1, issue #134) =====================
  // 📏 Measured before: `show('tm-main')` from a submenu always focused tm-main's FIRST button, so a child who went into
  // «Alfabetização» (item 2) and came back was put on «Ludico» — her place lost, and nothing said she had been moved.
  it('🔴 [Right] back from a submenu puts the focus on the item that opened it, not on the first', () => {
    mountTitleDom();
    const title = initTitle({ $ });
    title.show('tm-main');
    const alfabetizacao = $('#tm-main').querySelectorAll('button')[1];
    alfabetizacao.focus();
    title.show('tm-alf');
    expect(document.activeElement, 'going IN lands on the submenu\'s item 1').toBe($('#tm-alf button'));
    title.show('tm-main');
    expect(document.activeElement, 'back landed on the first item, not on the one that opened the submenu').toBe(alfabetizacao);
  });

  it('🔴 [Right] two levels deep, each back returns to its own opener', () => {
    mountTitleDom();
    $('#tm-alf').insertAdjacentHTML('beforeend', '<button type="button">Frações</button>');
    const title = initTitle({ $ });
    title.show('tm-main');
    const doorToAlf = $('#tm-main').querySelectorAll('button')[1];
    doorToAlf.focus();
    title.show('tm-alf');
    const doorToFr = $('#tm-alf').querySelectorAll('button')[1];
    doorToFr.focus();
    title.show('tm-fr');
    title.show('tm-alf');
    expect(document.activeElement, 'first back').toBe(doorToFr);
    title.show('tm-main');
    expect(document.activeElement, 'second back').toBe(doorToAlf);
  });

  it('🔴 [Zero] a second way in, by ANOTHER item, comes back to that item — the trail was popped, not kept', () => {
    mountTitleDom();
    const title = initTitle({ $ });
    title.show('tm-main');
    const [ludico, alfabetizacao] = $('#tm-main').querySelectorAll('button');
    alfabetizacao.focus();
    title.show('tm-alf');
    title.show('tm-main');
    ludico.focus();
    title.show('tm-mat');
    expect(document.activeElement, 'going in again did not open on item 1').toBe($('#tm-mat button'));
    title.show('tm-main');
    expect(document.activeElement, 'back returned to the FIRST way in\'s opener, a stale step').toBe(ludico);
  });

  it('[Boundary] an opener the game removed from the menu falls back to item 1, never to a detached node', () => {
    mountTitleDom();
    const title = initTitle({ $ });
    title.show('tm-main');
    const door = $('#tm-main').querySelectorAll('button')[1];
    door.focus();
    title.show('tm-alf');
    door.remove();
    title.show('tm-main');
    expect(document.activeElement).toBe($('#tm-main button'));
  });

  it('[Zero] elementos ausentes do DOM (legenda/bloco de título não montados) não quebram show()', () => {
    document.body.innerHTML = `<div id="tm-main"><button type="button">Ludico</button></div>
      <div id="tm-alf"></div><div id="tm-mat"></div><div id="tm-tab"></div><div id="tm-fr"></div><div id="tm-cen"></div>`;
    const title = initTitle({ $ });
    expect(() => title.show('tm-main')).not.toThrow();
  });
});

/*
 * MUTATIONS CHECKED for the «back» cases (ADR-0130 rule 1), applied by script and restored from a copy:
 *   · coming back never returns the recorded opener → the three back cases red.
 *   · the trail not popped on the way back → the second-way-in case red (a stale opener).
 *   · nothing recorded on the way in → the two back cases red.
 *   · the opener used without checking it is still in the menu → the removed-opener case red.
 */