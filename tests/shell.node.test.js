// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/shell — the phase DECISION, with no DOM (node project). This is where the reason the extraction separated
// projection from effect is proved: `phaseView` and `touchControlsPlan` answer "what this phase says to do" with no
// overlay, no audio and no PIXI, and a swapped `!==` becomes an assertion instead of a silent symptom.
//
// The shell (real focus, the legend's innerHTML, Print mode's listeners) is in shell.browser.test.js.
import { describe, it, expect } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // the legend comes from the dictionary (item 14)
import {
  phaseView, touchControlsPlan, chip, legendRow1, legendRow2, legendHtml,
  padActionGlyphs, touchActionGlyphs, pickLegendPad,
} from '../app/js/ui/shell.js';

// THE SHELL DOES NOT KNOW THE PHASES (ADR-0030 C3). `phaseView`/`touchControlsPlan` receive three BOOLEANS —
// `SceneFacts` —, and the three names live in the composition root. This file stays written in
// `'title'`/`'playing'`/`'paused'` because that is how the cases read best; the translation happens here, in one place,
// which is exactly what the root really does.
const fase = (p) => ({ titleScreen: p === 'title', worldRunning: p === 'playing', pauseMenu: p === 'paused' });
/** The three scenes THIS game lives. The shell no longer knows how many there are. */
const PHASES = ['title', 'playing', 'paused'];

describe('phaseView — a fase projetada em ordens para o documento', () => {
  it('as três fases, e só elas', () => {
    expect([...PHASES]).toEqual(['title', 'playing', 'paused']);
  });

  it('o splash aparece SÓ no título', () => {
    expect(phaseView(fase('title')).titleOverlayHidden).toBe(false);
    expect(phaseView(fase('playing')).titleOverlayHidden).toBe(true);
    expect(phaseView(fase('paused')).titleOverlayHidden).toBe(true);
  });

  it('os menus de pausa por tela aparecem SÓ na pausa', () => {
    expect(phaseView(fase('paused')).screenPauseHidden).toBe(false);
    expect(phaseView(fase('title')).screenPauseHidden).toBe(true);
    expect(phaseView(fase('playing')).screenPauseHidden).toBe(true);
  });

  // GAG (a11y pillar): game sound with the game stopped is noise to whoever depends on audio to find their way.
  it('fora de "playing" TODO o som cala, e o controle virtual some', () => {
    for (const p of PHASES) {
      expect(phaseView(fase(p)).masterMuted, p).toBe(p !== 'playing');
      expect(phaseView(fase(p)).hideTouchControls, p).toBe(p !== 'playing');
    }
  });

  it('⚠️ a pausa GLOBAL não existe: a casca não PROCURA `#pause-overlay` em lado nenhum', async () => {
    // ⚠️ A case asserting «fica escondido» accepts that the element exists. This one asserts that the shell does not
    // know it, which is why it cannot come back by distraction. (Pause markup copied into a cartridge's page had already
    // drifted — two «Comunicação» items, and an `#opt-letra` the engine now generates — and looked like the most official
    // pause menu in the repository.)
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../app/js/ui/shell.ts', import.meta.url), 'utf8');
    const linhas = src.split(/\r?\n/)
      .map((ln, i) => [i + 1, ln])
      .filter(([, ln]) => !/^\s*(\/\/|\*|\/\*)/.test(ln) && /pause-overlay|pauseOverlayHidden/.test(ln));
    expect(linhas, 'a casca voltou a procurar a pausa global').toEqual([]);
  });

  it('o botão de pausa diz ao leitor de tela se está pausado', () => {
    expect(phaseView(fase('paused')).pausePressed).toBe(true);
    expect(phaseView(fase('playing')).pausePressed).toBe(false);
    expect(phaseView(fase('title')).pausePressed).toBe(false);
  });

  // An a11y requirement: entering a screen without taking the focus along leaves keyboard/screen-reader users with no anchor.
  it('cada fase leva o foco para um lugar, e nunca deixa ninguém sem destino', () => {
    expect(phaseView(fase('playing')).focus).toBe('game-region');
    expect(phaseView(fase('paused')).focus).toBe('pause-menu');
    expect(phaseView(fase('title')).focus).toBe('title-button');
    for (const p of PHASES) expect(phaseView(fase(p)).focus, p).toBeTruthy();
  });
});

describe('touchControlsPlan — o único pedaço da troca de fase com memória', () => {
  const st = (hidden, wasOn) => ({ hidden, wasOn });

  it('pausar com o controle virtual LIGADO guarda que estava ligado e o esconde', () => {
    expect(touchControlsPlan(fase('paused'), st(false, false), 1)).toEqual({ hidden: true, wasOn: true });
  });

  it('retomar com a marca guardada e UMA tela devolve o controle virtual', () => {
    expect(touchControlsPlan(fase('playing'), st(true, true), 1)).toEqual({ hidden: false, wasOn: false });
  });

  it('retomar em MULTITELA não devolve o controle (o virtual é só de tela única)', () => {
    expect(touchControlsPlan(fase('playing'), st(true, true), 2)).toEqual({ hidden: true, wasOn: false });
  });

  it('o título sempre esconde e esquece', () => {
    expect(touchControlsPlan(fase('title'), st(false, true), 1)).toEqual({ hidden: true, wasOn: false });
  });

  // 📌 THE PLAN READS THE MARK FROM THE STATE IT IS GIVEN, so `ui/shell` reads before it hides (`readTouchControls`, then
  // `applyTouchControls`): given a pad that is already hidden, pausing has nothing to remember. That caller order is
  // measured in shell.browser, by the case that pauses with the d-pad visible and resumes; this case holds the plan's half
  // of the rule, the one branch the cases above do not reach.
  it('pausing with the pad ALREADY hidden changes nothing: no mark is invented, and a stored mark survives', () => {
    // hidden before the pause (by the player, or by a caller that hid first): no mark, so resuming leaves it hidden
    const paused = touchControlsPlan(fase('paused'), st(true, false), 1);
    expect(paused).toEqual({ hidden: true, wasOn: false });
    expect(touchControlsPlan(fase('playing'), paused, 1).hidden).toBe(true);
    // the scene projected again while paused: the mark the first pause stored is kept, so resuming still brings it back
    const again = touchControlsPlan(fase('paused'), st(true, true), 1);
    expect(again).toEqual({ hidden: true, wasOn: true });
    expect(touchControlsPlan(fase('playing'), again, 1).hidden).toBe(false);
  });
});

describe('legenda do título — os chips de dispositivo', () => {
  it('chip sem cor não emite style; com cor, emite', () => {
    expect(chip('A', null, 'pular')).toBe('<span class="lg"><span class="lg-ico">A</span> pular</span>'); // `chip` receives the word READY: whoever calls it translates
    expect(chip('A', '#2fae4e')).toBe('<span class="lg"><span class="lg-ico" style="background:#2fae4e">A</span></span>');
  });

  it('as duas linhas saem na ordem fixa: direcional+pausa, depois pular/especial/correr/trocar', () => {
    const l1 = legendRow1('✜', 'START');
    const l2 = legendRow2({ action2: ['A', null], action3: ['B', null], action1: ['C', null], action4: ['D', null] }, (a) => ({ action1: 'correr', action2: 'pular', action3: 'especial', action4: 'trocar' })[a] || null);
    // Against `t()` and not against the Portuguese: pinning the words here would bring back into the test the text that
    // left the code. The ORDER is what this case guards, and it depends on no language at all.
    expect(l1.indexOf(t('legend.move'))).toBeLessThan(l1.indexOf(t('legend.pause')));
    const pos = ['legend.jump', 'legend.especial', 'legend.run', 'legend.swap'].map((k) => l2.indexOf(t(k)));
    expect(pos.every((n) => n >= 0)).toBe(true);
    expect(pos).toEqual([...pos].sort((a, b) => a - b)); // estritamente na ordem declarada
    expect(new Set(pos).size).toBe(4);
    expect(legendHtml(l1, l2)).toBe(`<span class="lg-row">${l1}</span><span class="lg-row">${l2}</span>`);
  });

  it('gamepad no padrão: rótulos e cores do MODELO detectado', () => {
    const g = padActionGlyphs('microsoft', null);
    expect(g.action2).toEqual(['A', '#2fae4e']);
    expect(g.action3).toEqual(['B', '#d23b3b']);
    expect(g.action1).toEqual(['X', '#2f6fd2']);
    expect(g.action4).toEqual(['Y', '#d9a400']);
  });

  it('gamepad FORA do padrão: o mapa do assistente redireciona cada ação para o botão que a pessoa apertou', () => {
    const g = padActionGlyphs('generic', { action2: { b: 2 }, action3: { b: 3 } });
    expect(g.action2[0]).toBe('2');     // "pular" now shows button 2
    expect(g.action3[0]).toBe('3');
    expect(g.action1[0]).toBe('2');      // no custom entry: falls back to the default index
    expect(g.action4[0]).toBe('3');
  });

  it('mapa custom com índice fora do design cai no cinza de fallback, sem quebrar a legenda', () => {
    const g = padActionGlyphs('microsoft', { action2: { b: 9 } });
    expect(g.action2).toEqual(['9', '#3a4a6a']);
  });

  it('design desconhecido cai em "generic"; o toque usa sempre o generic', () => {
    expect(padActionGlyphs('inventado', null)).toEqual(padActionGlyphs('generic', null));
    expect(touchActionGlyphs().action2).toEqual(['0', '#3a4a6a']);
  });

  it('a legenda descreve o pad do JOGADOR 1 quando ele tem um; senão, o primeiro conectado', () => {
    const pads = [null, { index: 1, id: 'x', mapping: 'standard' }, { index: 2, id: 'y', mapping: '' }];
    expect(pickLegendPad(pads, 2).index).toBe(2);   // P1 bound to pad 2 → it is that one
    expect(pickLegendPad(pads, -1).index).toBe(1);  // no binding → the first connected
    expect(pickLegendPad([null, null], -1)).toBe(null);
  });

  it('P1 associado a um pad DESCONECTADO não pega o pad de outro jogador (cai no teclado)', () => {
    const pads = [{ index: 0, id: 'a', mapping: 'standard' }];
    expect(pickLegendPad(pads, 3)).toBe(null);
  });
});
