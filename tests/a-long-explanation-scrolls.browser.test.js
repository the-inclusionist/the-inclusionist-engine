// SPDX-License-Identifier: AGPL-3.0-or-later
// A LONG FOOTER EXPLANATION SCROLLS INSIDE ITS TWO LINES, AT THE CHILD'S READING PACE (ADR-0245).
//
// The Dev, on the BNCC texts cut at two lines in the demo quiz's footer: «Explicações com mais de duas linhas poderia rolar para
// baixo numa velocidade lenta o suficiente para leitores iniciantes ou com dificuldade de visão puderem enxergar.»
// 📏 Before: the band (`.barra-explicacao`) and a panel's (`.opt-explain`) clamped at two lines with an ellipsis, and the rest
// of the text reached only the ear.
//
// 📌 THE PACE IS WRITTEN OUT HERE, not read through `ui/footer-scroll`: this file reads the lines itself (every word's top, by
// Range) and times them with 60 000 / ppm ms a word (ADR-0183 §4). The first view waits for its words; each new line stays for
// its own; the last view as long as its lines take; then again from the top. Reduced motion turns pages of two.
//
// 📌 With the REAL stylesheet and the root's own driver, on a 640×360 region. Timers are faked (`setTimeout` only); the glide
// itself is the browser's smooth scroll and runs on real frames.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import css from '../app/css/style.css?raw';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { KEYS } from '../app/js/platform/storage-keys.js';

let raiz, motor;
const regiao = () => raiz.querySelector('#game-region');
const banda = () => raiz.querySelector('#game-region .barra-explicacao');
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
});

// Long as two BNCC texts end to end: five lines or more at 640 px. Each differs, so each case writes a NEW text.
const LONGO = (n) => `${n}: Resolver e elaborar problemas de multiplicação e divisão envolvendo números naturais e números racionais `
  + 'cuja representação decimal é finita, utilizando estratégias diversas, como cálculo por estimativa, cálculo mental e '
  + 'algoritmos, e explicar para os colegas, com as próprias palavras, como chegou ao resultado e por que ele faz sentido '
  + 'dentro do problema, conferindo a resposta com uma segunda estratégia antes de a registrar no caderno.';
const CURTO = 'EF05MA08 — Resolver problemas de multiplicação e divisão.';

/** Lets the root's observer see the text (a microtask). */
const vista = async () => { await Promise.resolve(); await Promise.resolve(); };
/** A few real frames, for the browser's smooth scroll. */
const quadros = (n) => new Promise((r) => { const f = () => (--n <= 0 ? r(null) : requestAnimationFrame(f)); requestAnimationFrame(f); });

/** The lines as laid out: each word's box, grouped by its top at half a line — this file's own reading. */
function linhas(el) {
  const lh = parseFloat(getComputedStyle(el).lineHeight);
  const out = [];
  const range = document.createRange();
  const n = el.firstChild;
  for (const m of n.textContent.matchAll(/\S+/g)) {
    range.setStart(n, m.index);
    range.setEnd(n, m.index + m[0].length);
    const box = range.getClientRects()[0];
    const ultima = out.at(-1);
    if (!ultima || box.top > ultima.top + lh / 2) out.push({ top: box.top, caixas: [box] });
    else ultima.caixas.push(box);
  }
  return out;
}
/** ADR-0245 at `ppm`: when each line of `palavras` (words per line) first shows, from the text's arrival; and the cycle's end. */
function chegadas(palavras, vistas, ppm) {
  const ms = 60000 / ppm;
  const ler = (a, b) => Math.round(palavras.slice(a, b).reduce((x, y) => x + y, 0) * ms);
  const ultima = palavras.length - vistas;
  const em = [0];
  let t = ler(0, vistas);
  for (let k = 1; k <= ultima; k++) {
    em.push(t);
    t += k === ultima ? ler(ultima, palavras.length) : ler(k + vistas - 1, k + vistas);
  }
  return { em, fim: t };
}
const linhaNoTopo = () => banda().dataset.topLine;
/** The words the band shows: those whose box lies inside its padding box, the rest outside it. */
function aVista(el) {
  const c = el.getBoundingClientRect();
  const top = c.top + el.clientTop;
  const bottom = top + el.clientHeight;
  return linhas(el).map((l) => {
    const dentro = l.caixas.every((b) => b.top >= top - 0.5 && b.bottom <= bottom + 0.5);
    const fora = l.caixas.every((b) => b.bottom <= top + 0.5 || b.top >= bottom - 0.5);
    return dentro ? 'in' : fora ? 'out' : 'cut';
  });
}

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const { createGame } = await import('../app/js/boot/create-game.js');
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1" style="position:relative;width:640px;height:360px"><div id="title-icons"></div></div>';
  document.body.appendChild(raiz);
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false });
});
afterAll(() => { motor.settings.setCaptionPpmValue(125); });
beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); });
afterEach(() => { motor.explain(null); vi.useRealTimers(); });

describe('a footer text that fits', () => {
  it('🎯 [Zero] never moves: no scrolling mark, no timer, the clamp as before — a minute later it has not moved', async () => {
    const antes = vi.getTimerCount();
    motor.explain(CURTO);
    await vista();
    expect(banda().textContent).toBe(CURTO);
    expect(banda().dataset.scroll, 'a text that fits was set to scroll').toBeUndefined();
    expect(vi.getTimerCount(), 'a text that fits left a timer running').toBe(antes);
    vi.advanceTimersByTime(60000);
    expect([banda().scrollTop, banda().dataset.topLine]).toEqual([0, undefined]);
  });
});

describe('a footer text longer than its two lines (ADR-0245 §1)', () => {
  it('🔴 [Right] scrolls up one line at a time and reaches its LAST line when the words before it are read — at 125 ppm', async () => {
    motor.settings.setCaptionPpmValue(125);
    motor.explain(LONGO('A'));
    await vista();
    expect(banda().dataset.scroll, 'the long text does not scroll').toBe('glide');
    expect(getComputedStyle(banda()).scrollBehavior, 'the line does not glide').toBe('smooth');
    const ls = linhas(banda());
    expect(ls.length, 'the text is not long enough for the case').toBeGreaterThanOrEqual(5);
    const { em } = chegadas(ls.map((l) => l.caixas.length), 2, 125);
    let agora = 0;
    for (let k = 1; k < em.length; k++) {
      vi.advanceTimersByTime(em[k] - 3 - agora);
      expect(linhaNoTopo(), `line ${k} came up before its time (${em[k]} ms)`).toBe(String(k - 1));
      vi.advanceTimersByTime(6);
      agora = em[k] + 3;
      expect(linhaNoTopo(), `line ${k} is not at the top at ${em[k]} ms`).toBe(String(k));
    }
    // and what the eye sees at the end: the last two lines, whole, and no slice of any other
    await quadros(40);
    const ve = aVista(banda());
    expect(ve.slice(-2), 'the last two lines are not in view').toEqual(['in', 'in']);
    expect(ve.slice(0, -2).every((v) => v === 'out'), `a line above shows through: ${ve}`).toBe(true);
  });

  it('🔴 [Right] the pace follows the child\'s caption rate: 125, 145 and 175 words a minute', async () => {
    for (const ppm of [125, 145, 175]) {
      motor.settings.setCaptionPpmValue(ppm);
      motor.explain(LONGO(`ritmo ${ppm}`));
      await vista();
      const { em } = chegadas(linhas(banda()).map((l) => l.caixas.length), 2, ppm);
      const ultima = em.length - 1;
      vi.advanceTimersByTime(em[1] - 3);
      expect(linhaNoTopo(), `at ${ppm}: the first move came before the first two lines were read (${em[1]} ms)`).toBe('0');
      vi.advanceTimersByTime(6);
      expect(linhaNoTopo(), `at ${ppm}: no move at ${em[1]} ms`).toBe('1');
      vi.advanceTimersByTime(em[ultima] - em[1] - 6);
      expect(linhaNoTopo(), `at ${ppm}: the last line came early`).toBe(String(ultima - 1));
      vi.advanceTimersByTime(6);
      expect(linhaNoTopo(), `at ${ppm}: the last line is not up at ${em[ultima]} ms`).toBe(String(ultima));
    }
    motor.settings.setCaptionPpmValue(125);
  });

  it('🔴 [Right] holds at the end, then starts again from the top while the text is still shown', async () => {
    motor.explain(LONGO('B'));
    await vista();
    const { em, fim } = chegadas(linhas(banda()).map((l) => l.caixas.length), 2, 125);
    vi.advanceTimersByTime(fim - 3);
    expect(linhaNoTopo(), 'it left the last line before the last view was read').toBe(String(em.length - 1));
    vi.advanceTimersByTime(6);
    expect(linhaNoTopo(), 'it did not start again from the top').toBe('0');
    expect(banda().scrollTop, 'the view is not back at the top').toBe(0);
    vi.advanceTimersByTime(em[1]);
    expect(linhaNoTopo(), 'the second round does not move').toBe('1');
  });

  it('🔴 [Right] a NEW text starts from the top; the same text written again is not a new one', async () => {
    motor.explain(LONGO('C'));
    await vista();
    const { em } = chegadas(linhas(banda()).map((l) => l.caixas.length), 2, 125);
    vi.advanceTimersByTime(em[2] + 3);
    expect(linhaNoTopo()).toBe('2');
    motor.explain(LONGO('C')); // a game that writes its text again on every render
    await vista();
    expect(linhaNoTopo(), 'the same text written again sent it back to the top').toBe('2');
    motor.explain(LONGO('D'));
    await vista();
    expect([linhaNoTopo(), banda().scrollTop], 'a new text did not start from the top').toEqual(['0', 0]);
  });

  it('🔴 [Right] §4 — the live region keeps the whole text, one text node: the scrolling is for the eye', async () => {
    motor.explain(LONGO('E'));
    await vista();
    vi.advanceTimersByTime(60000);
    expect(banda().getAttribute('aria-live')).toBe('polite');
    expect([...banda().childNodes].map((n) => n.nodeType), 'the scrolling rewrote the live region').toEqual([3]);
    expect(banda().textContent).toBe(LONGO('E'));
  });

  it('🔴 [Boundary] the band keeps its size and place: the two-line box, the margin under the words', async () => {
    motor.explain(`${CURTO} Com números naturais.`); // two lines that fit: the clamped band
    await vista();
    expect(linhas(banda()).length, 'the fitting text is not two lines').toBe(2);
    const parada = banda().getBoundingClientRect();
    motor.explain(LONGO('F'));
    await vista();
    expect(banda().dataset.scroll).toBe('glide');
    const rolando = banda().getBoundingClientRect();
    expect([rolando.top, rolando.height, rolando.bottom], 'the scrolling band is not the clamped band\'s box')
      .toEqual([parada.top, parada.height, parada.bottom]);
    // the room the panels keep for it (`--footer-band-h`) is still what it takes
    const sonda = document.createElement('div');
    sonda.style.cssText = 'position:absolute;height:var(--footer-band-h)';
    regiao().appendChild(sonda);
    try {
      expect(rolando.height).toBeCloseTo(sonda.getBoundingClientRect().height, 1);
    } finally { sonda.remove(); }
    const s = getComputedStyle(banda());
    const m = parseFloat(regiao().style.getPropertyValue('--margem-borda') || '8');
    expect(parseFloat(s.borderBottomWidth), 'the edge margin under the words changed').toBe(m);
    expect(Math.abs(rolando.bottom - regiao().getBoundingClientRect().bottom), 'the band left the lowest edge').toBeLessThan(1);
    // the view is two lines: at the top, lines 0 and 1 whole and nothing of line 2
    expect(aVista(banda()).slice(0, 3)).toEqual(['in', 'in', 'out']);
  });
});

describe('beside another footer line, ONE line on show (ADR-0164: the footer never grows past two)', () => {
  it('🔴 [Boundary] with the sound caption above it, the band scrolls through ONE line, a line at a time', async () => {
    const antes = localStorage.getItem('incl_captions');
    motor.settings.setCaptionsOnValue(true);
    try {
      motor.explain(LONGO('L'));
      // a caption long enough to stay the whole case (its words at 125 ppm: 14.4 s)
      motor.captionSound('Porta rangendo devagar no corredor escuro da casa velha '.repeat(3) + 'e a chuva forte na janela');
      await vista();
      expect(raiz.querySelector('#game-region .legenda-de-som').hidden, 'no caption beside the band').toBe(false);
      expect(banda().dataset.scroll, 'the band does not scroll beside the caption').toBe('glide');
      const s = getComputedStyle(banda());
      const lh = parseFloat(s.lineHeight);
      const texto = banda().getBoundingClientRect().height - parseFloat(s.borderTopWidth) - parseFloat(s.borderBottomWidth)
        - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom);
      expect(texto, 'the band is not one line tall beside the caption').toBeCloseTo(lh, 1);
      const { em } = chegadas(linhas(banda()).map((l) => l.caixas.length), 1, 125);
      vi.advanceTimersByTime(em[1] - 3);
      expect(linhaNoTopo(), 'it moved before its one line was read').toBe('0');
      vi.advanceTimersByTime(6);
      expect(linhaNoTopo(), 'the second line did not come up after the first was read').toBe('1');
      await quadros(40);
      expect(aVista(banda()).slice(0, 3), 'the one-line view shows more than its line').toEqual(['out', 'in', 'out']);
    } finally {
      vi.advanceTimersByTime(20000); // the caption leaves on its own timer, a faked one: run it out before the clock goes back
      motor.settings.setCaptionsOnValue(false);
      if (antes === null) localStorage.removeItem('incl_captions'); else localStorage.setItem('incl_captions', antes);
    }
  });
});

describe('reduced motion (ADR-0245 §2): pages, not a glide', () => {
  const original = window.matchMedia;
  afterEach(() => { window.matchMedia = original; });

  /**
   * Walks the pages: each shows two lines, is in place AT ONCE (no glide on its way), and stays for the words on it — for a
   * page of two new lines that is what it brought, and the last page, which may repeat a line to stay full, is held for its two.
   */
  function folheia() {
    expect(banda().dataset.scroll).toBe('pages');
    expect(getComputedStyle(banda()).scrollBehavior, 'the page turn slides').toBe('auto');
    const ls = linhas(banda());
    const palavras = ls.map((l) => l.caixas.length);
    const ultima = ls.length - 2;
    const ler = (a, b) => Math.round(palavras.slice(a, b).reduce((x, y) => x + y, 0) * (60000 / 125));
    const topos = [0];
    while (topos.at(-1) < ultima) topos.push(Math.min(topos.at(-1) + 2, ultima));
    expect(topos.length, 'the case turns fewer than two pages').toBeGreaterThanOrEqual(3);
    for (let p = 1; p < topos.length; p++) {
      vi.advanceTimersByTime(ler(topos[p - 1], topos[p - 1] + 2) - 3);
      expect(linhaNoTopo(), `page ${p - 1} turned before its words were read`).toBe(String(topos[p - 1]));
      vi.advanceTimersByTime(3);
      expect(linhaNoTopo(), `page ${p} is not lines ${topos[p]}–${topos[p] + 1}`).toBe(String(topos[p]));
      expect(Math.abs(banda().scrollTop - (ls[topos[p]].top - ls[0].top)), `page ${p} is not in place at once`).toBeLessThan(1);
    }
  }

  it('🔴 [Right] the system asks for it: two lines at a time, at once, at the same pace', async () => {
    window.matchMedia = (q) => ({ matches: q.includes('prefers-reduced-motion'), media: q, addEventListener() {}, removeEventListener() {} });
    motor.explain(LONGO('G'));
    await vista();
    folheia();
  });

  it('🔴 [Right] the child asks for it — the calm icon reduces the scene\'s motion, and the footer turns pages too', async () => {
    const calmo = raiz.querySelector('#title-icons .pi-btn[data-pi="tea"]');
    expect(calmo, 'no calm icon on the bar').not.toBeNull();
    calmo.click(); // level 1: the scene's motion reduced
    try {
      motor.explain(LONGO('G2'));
      await vista();
      folheia();
    } finally {
      calmo.click(); calmo.click(); // round the cycle, back to level 0
      localStorage.removeItem(KEYS.tea);
      localStorage.removeItem(KEYS.reducedMotion);
    }
    motor.explain(LONGO('G3'));
    await vista();
    expect(banda().dataset.scroll, 'back at level 0, the text still turns pages').toBe('glide');
  });
});

describe('it can be held (ADR-0245 §3, WCAG 2.2.2)', () => {
  it('🔴 [Right] pointer over the band holds it, however long; leaving lets it go on', async () => {
    motor.explain(LONGO('H'));
    await vista();
    const { em } = chegadas(linhas(banda()).map((l) => l.caixas.length), 2, 125);
    expect(getComputedStyle(banda()).pointerEvents, 'a pointer cannot reach the band').toBe('auto');
    banda().dispatchEvent(new PointerEvent('pointerenter'));
    vi.advanceTimersByTime(em[1] * 10);
    expect(linhaNoTopo(), 'the pointer over it did not hold it').toBe('0');
    expect(vi.getTimerCount(), 'a held band keeps a timer').toBe(0);
    banda().dispatchEvent(new PointerEvent('pointerleave'));
    vi.advanceTimersByTime(em[1] + 3);
    expect(linhaNoTopo(), 'leaving did not let it go on').toBe('1');
  });

  it('🔴 [Right] focus in it holds it too, and focus leaving lets it go on', async () => {
    motor.explain(LONGO('I'));
    await vista();
    const { em } = chegadas(linhas(banda()).map((l) => l.caixas.length), 2, 125);
    banda().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(em[1] * 10);
    expect(linhaNoTopo(), 'focus in it did not hold it').toBe('0');
    banda().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    vi.advanceTimersByTime(em[1] + 3);
    expect(linhaNoTopo(), 'focus leaving did not let it go on').toBe('1');
  });
});

describe('hidden, it stops', () => {
  it('🔴 [Right] the band hidden mid-way leaves NO timer running, and no scrolling mark', async () => {
    motor.explain(LONGO('J'));
    await vista();
    vi.advanceTimersByTime(20000);
    expect(vi.getTimerCount(), 'the case measures nothing: no timer while it scrolls').toBeGreaterThan(0);
    motor.explain(null);
    await vista();
    expect(vi.getTimerCount(), 'a timer outlived the band').toBe(0);
    expect(banda().dataset.scroll).toBeUndefined();
    expect(banda().scrollTop).toBe(0);
  });

  it('🔴 [Right] a PANEL\'s footer scrolls too, and closing the panel stops it', async () => {
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="visual"]').click();
    await vista();
    const painel = [...regiao().querySelectorAll('.overlay')].find((o) => !o.hidden);
    try {
      const rodape = painel.querySelector('.opt-explain');
      rodape.textContent = LONGO('K'); // what a row's hover writes (`ui/settings-panel`), long
      await vista();
      expect(rodape.dataset.scroll, 'the panel\'s long explanation does not scroll').toBe('glide');
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      const faixa = rodape.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(rodape).lineHeight);
      const m = parseFloat(regiao().style.getPropertyValue('--margem-borda') || '8');
      expect(faixa.height, 'the panel\'s band is not two lines tall').toBeCloseTo(4 + 2 * lh + m, 1);
    } finally {
      for (const ov of regiao().querySelectorAll('.overlay')) ov.hidden = true;
      motor.pause.hide(0);
    }
    await vista();
    expect(vi.getTimerCount(), 'the closed panel\'s footer kept its timer').toBe(0);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-26; `scratchpad/footer-scroll/mutate.mjs`, counting each target first) — all red, here or in `footer-scroll.node`:
//   S1 a text that fits gets a plan          S2 the plan always null (never moves)     S3 the rate ignored (always 125)
//   S4 reduced motion steps one line          S5 no hold at the end                     S6 the plan glides under reduced motion
//   S7 the root reads a fixed rate            S8 the child's scene motion ignored       S9 the system's reduced motion ignored
//   S10 pointer does not hold                 S11 focus does not hold                   S12 leaving does not go on
//   S13 a hold keeps its timer                S14 no restart at the end                 S15 the same text written again restarts
//   S16 a footer out of view keeps its timer  S17 no scrollTop (nothing moves)          S18 scrolled by line height ×2, not by the lines
//   S19 a new text not from the top           S20 CSS: pages slide                      S21 CSS: the 4 px as padding (a slice shows)
//   S22 CSS: the box grows to the text        S23 CSS: the box 1.5 lines a line          S24 CSS: no pointer events on the band
//   S25 CSS: beside the caption the clamp is 1 but the scroll box keeps 2 (red only after the one-line case was added)
//   S26 CSS: no glide (`smooth` gone)         S27 lines read by a whole line, not half (node only)
