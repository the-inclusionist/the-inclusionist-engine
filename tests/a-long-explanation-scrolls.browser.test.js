// SPDX-License-Identifier: AGPL-3.0-or-later
// A LONG FOOTER EXPLANATION SCROLLS INSIDE ITS TWO LINES, AT THE CHILD'S READING PACE (ADR-0245).
//
// The Dev, on the BNCC texts cut at two lines in the demo quiz's footer: «Explicações com mais de duas linhas poderia rolar para
// baixo numa velocidade lenta o suficiente para leitores iniciantes ou com dificuldade de visão puderem enxergar.» And, seeing
// it built a line at a time: «Você está subindo uma linha por vez de forma analógica nas dicas, quando era para rolar de forma
// suave e contínua, lentamente.» — «Como na abertura de starwars.» (ADR-0245 erratum, 2026-09-26.)
// 📏 Before: the text stood still for seconds and then jumped a whole line (EF35EF05 at 125 ppm, sampled every 500 ms on real
// time: 0 px until 9.2 s, then 21, 42, 62, 83 — five stairs).
//
// 📌 THE PACE IS WRITTEN OUT HERE, not read through `ui/footer-scroll`: this file reads the lines itself (every word's top, by
// Range) and times them with 60 000 / ppm ms a word (ADR-0183 §4). The first view waits for its words; then the text rises at
// ONE speed, the distance from its first line to the top of its last view in the time the words below the first view take;
// the last view is held as long as its lines take; then again from the top. Reduced motion turns pages of two.
//
// 📌 With the REAL stylesheet and the root's own driver, on a 640×360 region. The glide is a Web Animation: a case reads WHERE
// THE WORDS ARE on screen (a Range's box) at a moment it sets on that animation's clock, and the smoothness case also on real
// frames. The page turns are timers, and those are faked (`setTimeout` only).
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
// The demo quiz's footer for EF35EF05 (BNCC, final version, p. 231), as `quiz.skill.explain` writes it: the text the Dev saw.
const EF35EF05 = 'Educação Física · 3º ao 5º ano — Experimentar e fruir diversos tipos de esportes de campo e taco, rede/parede e '
  + 'invasão, identificando seus elementos comuns e criando estratégias individuais e coletivas básicas para sua execução, '
  + 'prezando pelo trabalho coletivo e pelo protagonismo.';
const QUADRO = 1000 / 60; // one frame at 60 Hz

/** Lets the root's observer see the text (a microtask). */
const vista = async () => { await Promise.resolve(); await Promise.resolve(); };
/** A few real frames. */
const quadros = (n) => new Promise((r) => { const f = () => (--n <= 0 ? r(null) : requestAnimationFrame(f)); requestAnimationFrame(f); });

/** The text nodes under a footer, in order — the words wherever the driver keeps them. */
function textos(el) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const out = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) out.push(n);
  return out;
}
/** The lines as laid out: each word's box, grouped by its top at half a line — this file's own reading. */
function linhas(el) {
  const lh = parseFloat(getComputedStyle(el).lineHeight);
  const out = [];
  const range = document.createRange();
  for (const n of textos(el)) {
    for (const m of n.textContent.matchAll(/\S+/g)) {
      range.setStart(n, m.index);
      range.setEnd(n, m.index + m[0].length);
      const box = range.getClientRects()[0];
      const ultima = out.at(-1);
      if (!ultima || box.top > ultima.top + lh / 2) out.push({ top: box.top, caixas: [box] });
      else ultima.caixas.push(box);
    }
  }
  return out;
}
/** How far the text has risen, in px: the top of its content box (where its first line stands at rest) less its first word's. */
function subiu(el) {
  const n = textos(el)[0];
  const range = document.createRange();
  range.setStart(n, 0);
  range.setEnd(n, 1);
  return el.getBoundingClientRect().top + el.clientTop + parseFloat(getComputedStyle(el).paddingTop) - range.getClientRects()[0].top;
}
/**
 * ADR-0245 at `ppm`, from this file's own reading of the lines AT REST: the wait (the first view's words), the travel (the
 * words below the first view), the hold (the last view's), and the distance — from the first line to the top of the last view.
 */
function ritmo(el, vistas, ppm) {
  const ls = linhas(el);
  const palavras = ls.map((l) => l.caixas.length);
  const ler = (a, b) => Math.round(palavras.slice(a, b).reduce((x, y) => x + y, 0) * (60000 / ppm));
  const ultima = ls.length - vistas;
  const espera = ler(0, vistas);
  const viagem = ler(vistas, ls.length);
  const segura = ler(ultima, ls.length);
  return { ls, espera, viagem, segura, fim: espera + viagem + segura, distancia: ls[ultima].top - ls[0].top };
}
/** The one animation moving a footer's words; the case fails if there is not exactly one. */
function animacao(el) {
  const as = el.getAnimations({ subtree: true });
  expect(as.length, `the footer has ${as.length} animations, not one`).toBe(1);
  return as[0];
}
/** Where the words stand at moment `t` of the glide's clock (the clock of the document only moves between frames). */
const em = (el, a, t) => { a.currentTime = t; return subiu(el); };
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
  it('🎯 [Zero] never moves: no scrolling mark, no timer, no animation, its DOM untouched, the clamp as before', async () => {
    const antes = vi.getTimerCount();
    motor.explain(CURTO);
    await vista();
    expect(banda().textContent).toBe(CURTO);
    expect(banda().dataset.scroll, 'a text that fits was set to scroll').toBeUndefined();
    expect(vi.getTimerCount(), 'a text that fits left a timer running').toBe(antes);
    expect(banda().getAnimations({ subtree: true }), 'a text that fits is animated').toEqual([]);
    expect([...banda().childNodes].map((n) => n.nodeType), 'a text that fits was wrapped').toEqual([3]);
    vi.advanceTimersByTime(60000);
    await quadros(3);
    expect([banda().scrollTop, subiu(banda())]).toEqual([0, 0]);
  });
});

describe('a footer text longer than its two lines GLIDES (ADR-0245 §1 and its erratum)', () => {
  it('🔴 [Right] still for the first view, then up at ONE speed, a fraction of a pixel a frame, to its last line when all its words are read — EF35EF05 at 125 ppm', async () => {
    motor.settings.setCaptionPpmValue(125);
    motor.explain(EF35EF05);
    await vista();
    expect(banda().dataset.scroll, 'the long text does not scroll').toBe('glide');
    const { ls, espera, viagem, fim, distancia } = ritmo(banda(), 2, 125);
    expect(ls.length, 'the text is not long enough for the case').toBeGreaterThanOrEqual(5);
    const a = animacao(banda());
    for (const t of [0, espera / 2, espera - 1]) expect(em(banda(), a, t), `it moved at ${t} ms, before the first view was read`).toBeCloseTo(0, 2);
    // the travel, a 60 Hz frame apart: every frame a little higher than the last, by the same fraction of a pixel
    const ps = [];
    for (let t = espera; t <= espera + viagem; t += QUADRO) ps.push(em(banda(), a, t));
    const passos = ps.slice(1).map((p, i) => p - ps[i]);
    const passo = (distancia / viagem) * QUADRO;
    const fora = passos.map((d, i) => [i, d]).filter(([, d]) => Math.abs(d - passo) > 0.05);
    expect(fora.slice(0, 5), `frames that do not rise by ${passo.toFixed(3)} px (a stall or a jump): ${JSON.stringify(fora.slice(0, 5))}`).toEqual([]);
    expect(ps.some((p) => Math.abs(p - Math.round(p)) > 0.1), 'the words only stand on whole pixels').toBe(true);
    // not there early: 300 ms before the words are read the last line is still coming in; then it is in, whole
    em(banda(), a, espera + viagem - 300);
    expect(aVista(banda()).at(-1), 'the last line was in view before all the words were read').not.toBe('in');
    expect(em(banda(), a, espera + viagem), 'the glide did not end on the last view').toBeCloseTo(distancia, 1);
    const ve = aVista(banda());
    expect(ve.slice(-2), 'the last two lines are not in view').toEqual(['in', 'in']);
    expect(ve.slice(0, -2).every((v) => v === 'out'), `a line above shows through: ${ve}`).toBe(true);
    expect(em(banda(), a, fim - 1), 'the last view was not held for its words').toBeCloseTo(distancia, 1);
  });

  it('🔴 [Right] on REAL frames, too: every frame higher than the last, by less than a pixel', async () => {
    motor.settings.setCaptionPpmValue(125);
    motor.explain(LONGO('real'));
    await vista();
    const { espera, viagem, distancia } = ritmo(banda(), 2, 125);
    const a = animacao(banda());
    a.currentTime = espera + viagem / 3;
    const ps = [];
    const ts = [];
    for (let k = 0; k < 40; k++) { await quadros(1); ps.push(subiu(banda())); ts.push(a.currentTime); }
    const passos = ps.slice(1).map((p, i) => p - ps[i]);
    expect(Math.min(...passos), `it went back down between frames: ${passos}`).toBeGreaterThanOrEqual(0);
    expect(Math.max(...passos), 'a frame jumped a pixel or more').toBeLessThan(1);
    expect(new Set(ps.map((p) => p.toFixed(2))).size, `it stood still on real frames: ${ps}`).toBeGreaterThan(20);
    // and at the planned speed: what it rose is the distance times the share of the travel's clock that passed
    const andou = ((ts.at(-1) - ts[0]) * distancia) / viagem;
    expect(Math.abs(ps.at(-1) - ps[0] - andou), `rose ${ps.at(-1) - ps[0]} px on real frames, not ${andou}`).toBeLessThan(0.1);
  });

  it('🔴 [Right] the pace follows the child\'s caption rate: 125, 145 and 175 words a minute', async () => {
    for (const ppm of [125, 145, 175]) {
      motor.settings.setCaptionPpmValue(ppm);
      motor.explain(LONGO(`ritmo ${ppm}`));
      await vista();
      const { espera, viagem, fim, distancia } = ritmo(banda(), 2, ppm);
      const a = animacao(banda());
      expect(em(banda(), a, espera - 1), `at ${ppm}: it moved before the first view was read (${espera} ms)`).toBeCloseTo(0, 2);
      expect(em(banda(), a, espera + 200), `at ${ppm}: not moving at ${espera + 200} ms`).toBeGreaterThan(0.5);
      expect(em(banda(), a, espera + viagem / 2), `at ${ppm}: not halfway at half the travel`).toBeCloseTo(distancia / 2, 0);
      expect(em(banda(), a, espera + viagem - 150), `at ${ppm}: the last view came early`).toBeLessThan(distancia - 0.5);
      expect(em(banda(), a, espera + viagem), `at ${ppm}: the last view is not up at ${espera + viagem} ms`).toBeCloseTo(distancia, 1);
      expect(em(banda(), a, fim - 1), `at ${ppm}: the last view was not held to ${fim} ms`).toBeCloseTo(distancia, 1);
    }
    motor.settings.setCaptionPpmValue(125);
  });

  it('🔴 [Right] holds at the end, then starts again from the top while the text is still shown', async () => {
    motor.explain(LONGO('B'));
    await vista();
    const { espera, viagem, fim, distancia } = ritmo(banda(), 2, 125);
    const a = animacao(banda());
    expect(em(banda(), a, fim - 1), 'it left the last view before it was read').toBeCloseTo(distancia, 1);
    a.currentTime = fim;
    await quadros(3);
    const b = animacao(banda());
    expect(b, 'it did not start again').not.toBe(a);
    expect(subiu(banda()), 'the view is not back at the top').toBeCloseTo(0, 2);
    expect(em(banda(), b, espera + viagem / 2), 'the second round does not move').toBeCloseTo(distancia / 2, 0);
  });

  it('🔴 [Right] a NEW text starts from the top; the same text written again goes on from where it was', async () => {
    motor.explain(LONGO('C'));
    await vista();
    const { espera, viagem } = ritmo(banda(), 2, 125);
    const a = animacao(banda());
    const meio = em(banda(), a, espera + viagem / 2);
    expect(meio).toBeGreaterThan(1);
    motor.explain(LONGO('C')); // a game that writes its text again on every render
    await vista();
    expect(animacao(banda()), 'the same text written again started a new glide').toBe(a);
    expect(subiu(banda()), 'the same text written again sent it back to the top').toBeCloseTo(meio, 1);
    motor.explain(LONGO('D'));
    await vista();
    expect(animacao(banda()), 'a new text kept the old glide').not.toBe(a);
    expect(subiu(banda()), 'a new text did not start from the top').toBeCloseTo(0, 2);
  });

  it('🔴 [Right] §4 — the live region keeps the text it was given, one text node, and the motion writes nothing into it', async () => {
    motor.explain(CURTO);
    await vista();
    const registos = [];
    let quadro = false;
    const mo = new MutationObserver((rs) => rs.forEach((r) => registos.push({ r, quadro })));
    mo.observe(banda(), { childList: true, characterData: true, subtree: true });
    try {
      motor.explain(LONGO('E'));
      const escrito = banda().firstChild; // the node the game's text was written as
      requestAnimationFrame(() => { quadro = true; });
      await vista();
      await quadros(2);
      // whatever the driver did to move the words, it did before a frame was drawn, and the words are the SAME node, whole
      expect(registos.filter((x) => x.quadro), 'the live region was changed after a frame was drawn').toEqual([]);
      // ⚠️ by IDENTITY: `toEqual` compares DOM nodes by `isEqualNode`, and a copy of the text passes it (measured)
      expect(textos(banda()).length, 'the live region holds more than one text node').toBe(1);
      expect(textos(banda())[0], 'the text was rewritten, not moved').toBe(escrito);
      expect(escrito.data).toBe(LONGO('E'));
      registos.length = 0;
      // a whole round and into the next: not one change
      const { espera, viagem, fim } = ritmo(banda(), 2, 125);
      const a = animacao(banda());
      a.currentTime = espera + viagem / 2;
      await quadros(2);
      a.currentTime = fim;
      await quadros(3);
      animacao(banda()).currentTime = espera + viagem / 2;
      await quadros(2);
      expect(registos.map((x) => x.r.type), 'the motion wrote into the live region').toEqual([]);
      expect(banda().getAttribute('aria-live')).toBe('polite');
      expect(textos(banda()).length).toBe(1);
      expect(textos(banda())[0], 'the motion replaced the text node').toBe(escrito);
      expect(banda().textContent).toBe(LONGO('E'));
    } finally { mo.disconnect(); }
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
    // the view is two lines: at the top, lines 0 and 1 whole and nothing of line 2; mid-glide, a line is cut only at the edges
    expect(aVista(banda()).slice(0, 3)).toEqual(['in', 'in', 'out']);
  });
});

describe('beside another footer line, ONE line on show (ADR-0164: the footer never grows past two)', () => {
  it('🔴 [Boundary] with the sound caption above it, the band glides through ONE line', async () => {
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
      const { espera, viagem, distancia } = ritmo(banda(), 1, 125);
      const a = animacao(banda());
      expect(em(banda(), a, espera - 1), 'it moved before its one line was read').toBeCloseTo(0, 2);
      expect(aVista(banda()).slice(0, 2), 'the one-line view shows more than its line').toEqual(['in', 'out']);
      expect(em(banda(), a, espera + viagem), 'it did not glide to its last line').toBeCloseTo(distancia, 1);
      const ve = aVista(banda());
      expect(ve.at(-1), 'the last line is not in view').toBe('in');
      expect(ve.slice(0, -1).every((v) => v === 'out'), `the one-line view shows more than its line: ${ve}`).toBe(true);
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
    expect(banda().getAnimations({ subtree: true }), 'the pages glide').toEqual([]);
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
      expect(banda().dataset.topLine, `page ${p - 1} turned before its words were read`).toBe(String(topos[p - 1]));
      vi.advanceTimersByTime(3);
      expect(banda().dataset.topLine, `page ${p} is not lines ${topos[p]}–${topos[p] + 1}`).toBe(String(topos[p]));
      expect(Math.abs(subiu(banda()) - (ls[topos[p]].top - ls[0].top)), `page ${p} is not in place at once`).toBeLessThan(1);
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
  /** Holds the band mid-glide with `segura`, lets real frames pass, and lets it go with `solta`: it stays, then goes on. */
  async function seguraESolta(segura, solta, porque) {
    const { espera, viagem, distancia } = ritmo(banda(), 2, 125);
    const a = animacao(banda());
    const porQuadro = (distancia / viagem) * QUADRO;
    const aqui = em(banda(), a, espera + viagem / 3);
    segura();
    await quadros(2); // a pause lands on the next frame (Web Animations: a pending pause)
    const parado = subiu(banda());
    expect(Math.abs(parado - aqui), `${porque} did not hold it where it was`).toBeLessThan(2 * porQuadro + 0.01);
    await quadros(20);
    expect(subiu(banda()), `${porque} did not hold it`).toBe(parado);
    expect(vi.getTimerCount(), 'a held band keeps a timer').toBe(0);
    const t1 = a.currentTime;
    solta();
    await quadros(20);
    const andou = subiu(banda()) - parado;
    expect(andou, 'letting go did not let it go on').toBeGreaterThan(0.2);
    expect(Math.abs(andou - ((a.currentTime - t1) * distancia) / viagem), 'letting go did not go on from where it was held')
      .toBeLessThan(0.1);
    expect(animacao(banda()), 'holding it restarted the glide').toBe(a);
  }

  it('🔴 [Right] pointer over the band holds it where it is, however long; leaving lets it go on from there', async () => {
    motor.explain(LONGO('H'));
    await vista();
    expect(getComputedStyle(banda()).pointerEvents, 'a pointer cannot reach the band').toBe('auto');
    await seguraESolta(
      () => banda().dispatchEvent(new PointerEvent('pointerenter')),
      () => banda().dispatchEvent(new PointerEvent('pointerleave')),
      'the pointer over it',
    );
  });

  it('🔴 [Right] focus in it holds it too, and focus leaving lets it go on', async () => {
    motor.explain(LONGO('I'));
    await vista();
    await seguraESolta(
      () => banda().dispatchEvent(new FocusEvent('focusin', { bubbles: true })),
      () => banda().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null })),
      'focus in it',
    );
  });

  it('🔴 [Right] a text that ARRIVES under the pointer waits, held, until the pointer leaves', async () => {
    motor.explain(LONGO('H2'));
    await vista();
    banda().dispatchEvent(new PointerEvent('pointerenter'));
    motor.explain(LONGO('H3'));
    await vista();
    const { espera, viagem } = ritmo(banda(), 2, 125);
    const a = animacao(banda());
    expect(a.playState, 'a new text under the pointer moves').toBe('paused');
    banda().dispatchEvent(new PointerEvent('pointerleave'));
    expect(em(banda(), a, espera + viagem / 2), 'leaving did not let the new text go').toBeGreaterThan(1);
  });
});

describe('hidden, it stops', () => {
  it('🔴 [Right] the band hidden mid-way leaves NO animation and no timer running, and no scrolling mark', async () => {
    motor.explain(LONGO('J'));
    await vista();
    const { espera, viagem } = ritmo(banda(), 2, 125);
    em(banda(), animacao(banda()), espera + viagem / 2);
    motor.explain(null);
    await vista();
    expect(banda().getAnimations({ subtree: true }), 'an animation outlived the band').toEqual([]);
    expect(document.getAnimations().filter((x) => banda().contains(x.effect?.target ?? null)), 'an animation outlived the band').toEqual([]);
    expect(vi.getTimerCount(), 'a timer outlived the band').toBe(0);
    expect(banda().dataset.scroll).toBeUndefined();
    expect(banda().scrollTop).toBe(0);
  });

  it('🔴 [Right] a PANEL\'s footer glides too, and closing the panel stops it', async () => {
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="visual"]').click();
    await vista();
    const painel = [...regiao().querySelectorAll('.overlay')].find((o) => !o.hidden);
    let rodape;
    try {
      rodape = painel.querySelector('.opt-explain');
      rodape.textContent = LONGO('K'); // what a row's hover writes (`ui/settings-panel`), long
      await vista();
      expect(rodape.dataset.scroll, 'the panel\'s long explanation does not scroll').toBe('glide');
      const { espera, viagem, distancia } = ritmo(rodape, 2, 125);
      expect(em(rodape, animacao(rodape), espera + viagem), 'the panel\'s footer did not glide to its last view').toBeCloseTo(distancia, 1);
      const faixa = rodape.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(rodape).lineHeight);
      const m = parseFloat(regiao().style.getPropertyValue('--margem-borda') || '8');
      expect(faixa.height, 'the panel\'s band is not two lines tall').toBeCloseTo(4 + 2 * lh + m, 1);
    } finally {
      for (const ov of regiao().querySelectorAll('.overlay')) ov.hidden = true;
      motor.pause.hide(0);
    }
    await vista();
    expect(rodape.getAnimations({ subtree: true }), 'the closed panel\'s footer kept its animation').toEqual([]);
    expect(vi.getTimerCount(), 'the closed panel\'s footer kept a timer').toBe(0);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-26; `scratchpad/footer-glide/mutate.mjs`, counting each target first) — all red, here or in `footer-scroll.node`:
//   G0 the line-by-line build of b2ff44e6 put back   G1 the travel stepped a line at a time    G2 the plan ignores the rate
//   G3 the driver reads a fixed rate                 G4 pointer/focus do not pause             G5 leaving does not resume
//   G6 leaving resumes from the top                  G7 the travel takes the first view's words too
//   G8 no hold at the end                            G9 the glide stops a line short           G10 no restart at the end
//   G11 the words COPIED into the block, not moved — green until the node was compared by identity (`toEqual` on DOM
//       nodes is `isEqualNode`)                      G12 the same text written again left out of the gliding block
//   G13 a footer forgotten keeps its animation       G14 CSS: the block inline (the transform does nothing)
//   G15 eased in and out, not one speed              G16 reduced motion ignored: it glides     G17 a text arriving under the
//   pointer not held                                 G18 no wait (the driver)                  G19 no wait (the plan)
