// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0027'S VERDICT (step 4), as a test — item 13 of the pipeline.
//
// The record did not leave the question vague, nor the consequence: if `createGame()` could not be written without a
// parameter called `coinTarget`, the boundary it proposed was wrong and its steps 5 to 7 could not begin.
//
// This file has TWO halves, and they measure different things.
//
// The first reads the SOURCE. It exists because the verdict is about what the signature DEMANDS, and a signature is read
// — not run. A test that only called `createGame()` with a valid argument would never notice an optional `coinTarget`
// sleeping in the type.
//
// The second RUNS, in a make-believe DOM. It exists because the first half is blind to what matters next: whether the
// mandatory order really is mandatory, whether declaring badly throws, whether missing markup does not.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { specifiersOf } from '../scripts/lib/module-specifiers.mjs';

const FONTE = readFileSync(join(process.cwd(), 'app', 'js', 'boot', 'create-game.ts'), 'utf8');
/** What the root names, as paths under `app/js`, in EVERY import form the parser returns (type-only included: a boot that
 *  knows a game's type knows the game). A pattern over `from '…'` let a literal `import()` through. */
const ALVOS = specifiersOf(FONTE, 'create-game.ts')
  .filter((s) => s.spec?.startsWith('.')).map((s) => posix.normalize(posix.join('boot', s.spec)));

/** The source's CODE lines: no comments. This module's prose QUOTES `coinTarget` to explain the verdict, and a filter
 *  that confused the quotation with the demand would fail the record itself. */
const CODIGO = FONTE.split('\n')
  .filter((ln) => { const t = ln.trim(); return t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*'); })
  .join('\n');

describe('o veredito: a fronteira passa ou não passa', () => {
  it('[Right] `createGame()` NÃO pede coinTarget — nem alvo de moeda com outro nome', () => {
    // It is the ADR's sentence turned gate. If one day someone needs the coin count here, the case fails and the
    // conversation goes back to being about the BOUNDARY, not about one more parameter.
    expect(CODIGO).not.toMatch(/coinTarget/);
    expect(CODIGO).not.toMatch(/\bcoins?\b/i);
    expect(CODIGO).not.toMatch(/\bmoedas?\b/i);
  });

  it('[Right] o alvo vem do CONTRATO, e é assim que `coinTarget` deixou de ser preciso', () => {
    // Absence is not enough: an engine that simply did not know about the objective would also pass the case above, and
    // it would have lost the feature instead of generalising it. `objectiveOf` is field 5.
    expect(CODIGO).toMatch(/GameDeclaration/);
    expect(CODIGO).toMatch(/conformanceProblems/);
  });

  it('[Right] a raiz de composição NÃO importa de game/', () => {
    expect(ALVOS.filter((a) => a.startsWith('game/'))).toEqual([]);
  });

  it('[Right] nem de educational/ — currículo é da plataforma, e um boot genérico não o conhece', () => {
    expect(ALVOS.filter((a) => a.startsWith('educational/'))).toEqual([]);
  });

  it('[Interface] o mixer é ligado ANTES da voz — a ordem do achado 3, na ordem do arquivo', () => {
    // Finding 3 of the second consumer: without the mixer loaded first, `audioCat` is null and `narrate` goes quiet with
    // no error. `createAudio` loads it as it is built (ADR-0232 D4); the order is the file's, and this case is what prevents
    // a careless reordering.
    const mixer = CODIGO.indexOf('createAudio({');
    const voz = CODIGO.indexOf('createTts(');
    expect(mixer, 'createAudio({ newContext, store }) precisa ser chamado').toBeGreaterThan(-1);
    expect(voz, 'createTts() precisa ser chamado').toBeGreaterThan(-1);
    expect(mixer, 'mixer depois da voz = narração muda, sem erro nenhum').toBeLessThan(voz);
  });

  it('[Interface] o idioma é ligado com o documento do HOSPEDEIRO, não com o global', () => {
    // Finding 15, and why it is a case and not a note: the language's boot reached the global `document` underneath whoever
    // called it. In a browser it makes no difference, which is why it survived so long.
    expect(CODIGO).toMatch(/translator\.init\(doc\)/);
    // 🔴 THIS CASE WAS ONCE DEAD AND NOBODY KNEW. The regex had an invisible CONTROL character in the middle —
    // `/docu<VT>ment/` — injected by an edit through PowerShell, where the backtick is an escape and `` `v `` is a vertical
    // tab. It could never match `document`, so the case always passed, for the worst reason possible: it looked like it
    // guarded the boundary and guarded nothing.
    // ⚠️ AND REVIVED IT ACCUSED A FALSE POSITIVE, the second half of the lesson: the PORTUGUESE word `documento`, inside a
    // `problems` line addressed to whoever integrates the engine, contains `document`. The word boundary separates the two
    // — `documento` has an `o` after it, so `\b` fails there.
    expect(CODIGO, 'nenhuma linha de código deste boot pode alcançar o document global').not.toMatch(/\bdocument\b/);
  });
});

/* ===================== a metade que EXECUTA ===================== */

/** A make-believe document: just enough for `createGame` to do what it does without a browser. */
function domFalso({ comMarcacao = true, ausentes = [], map: mapa = {}, listas = {} } = {}) {
  const feito = [];
  const el = (id) => ({
    id,
    hidden: true,
    /*
     * ⚠️ `style` WITH BOTH METHODS: `{}` looks like a `style` and is not. The engine applies the stored font at boot and
     * writes `--font-custom` on the document root (`initSettingsTypo`) — with `{}` that is a `TypeError` in the middle of
     * the boot. Every time this double is poorer than the real thing, the engine looks wrong for the double's sake.
     */
    style: { setProperty() {}, removeProperty() {} },
    dataset: {},
    /*
     * ⚠️ A `classList` THAT WORKS, not one that swallows: `reflectMotionBtn` does `b.classList.toggle('is-on', …)` and
     * `ui/dom.toggleBtn` does the same on any master button.
     *
     * 📌 Over a `Set` and not with empty methods: a double that accepts the call and keeps nothing answers yes to any
     * question about a class, and a test that asks whether it stayed on passes without anything having stayed.
     */
    classList: (() => {
      const s = new Set();
      return {
        add: (c) => s.add(c),
        remove: (c) => s.delete(c),
        contains: (c) => s.has(c),
        toggle: (c, forcar) => {
          const por = forcar ?? !s.has(c);
          if (por) s.add(c); else s.delete(c);
          return por;
        },
      };
    })(),
    // ⚠️ `innerHTML`, for the same lesson `ausentes` and `mapa` teach in this file: a double poorer than the real thing
    // does not test the question. Every real `Element` has `innerHTML`; without it here, mounting the bar (ADR-0106 step
    // 2) refused to run and the double made the engine look wrong.
    innerHTML: '',
    // ⚠️ `appendChild` for the same reason: `createGame` HANGS the pause card on the host, and a double that takes no
    // children made the engine accuse a gap that existed only in the double.
    filhos: [],
    appendChild(n) { this.filhos.push(n); return n; },
    // ⚠️ `insertBefore` and `contains` came with the settings panels. `contains` answers the question the engine asks —
    // is this host inside `#game-region`? —, and a double that always answered `false` would make the engine accuse a gap
    // that exists only in the double. Recursive because the real question is too.
    insertBefore(novo, ref) {
      const i = this.filhos.indexOf(ref);
      if (i < 0) this.filhos.push(novo); else this.filhos.splice(i, 0, novo);
      return novo;
    },
    contains(n) { return n === this || this.filhos.some((f) => f === n || (f.contains && f.contains(n))); },
    /*
     * ⚠️ `closest`, for the retranslation of the panels' insides: `mountAudioInside` climbs from a control to its
     * `.ctrl-row` to rewrite its words. 📌 It returns `null` and not `this`: here the nodes have no parent, so the honest
     * answer to which ancestor matches is none — and the caller already handles it (`if (linha)`).
     */
    closest() { return null; },
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, setAttribute: () => {}, removeAttribute: () => {}, removeChild: () => {},
    // ⚠️ `focus`: the reach card (`ui/reach-notice`) moves focus to the card itself and not to the button, «porque a
    // criança tem de OUVIR o motivo antes de decidir». It is mounted only when the reach FAILS, which is why no case of
    // this file needed it until a game declared a pointer.
    // 📌 These gaps together are why `boot-create-game.browser.test.js` exists — a double knows only what whoever wrote
    // it knew, and the mounting lives where the DOM decides.
    focus: () => {},
    get firstChild() { return null; },
    ownerDocument: null,
  });
  /*
   * 🔴 THE SAME SELECTOR RETURNS THE SAME NODE — and this was the double's most expensive lie.
   *
   * In a real document, `$('#game-region')` called twice returns the SAME element; here it returned two different
   * objects, and no test could observe what had been written into one of them. `mapa` exists precisely because of that
   * — the per-case patch of a lie that is fixed once.
   *
   * ⚠️ AND IT MATTERS: the engine asks whether the pause host is INSIDE `#game-region`, because
   * `ui/settings-panel.topVisibleOverlay` scans `'#game-region .overlay'` and that is how the arrows find the open panel.
   * With two objects answering the same id, the answer is always no — and the engine would accuse a gap that exists only
   * here.
   */
  const memo = new Map();
  const doc = {
    // The root where the chosen font is applied (`dataset.fonte` + `--font-custom`). ONE object and not a getter that
    // manufactures: the same reason as the memo above — whoever writes and whoever reads must find the same node.
    documentElement: el('html'),
    activeElement: null,
    createElement: (tag) => { feito.push(tag); return el(tag); },
    contains: () => false,
    // ⚠️ `ausentes` exists because a double that answers YES to any selector does not test the question — it only tests
    // that it was asked. That is what let the non-existent world case pass green.
    // ⚠️ `mapa` lets a case NAME the element a selector returns. Without it the double always answered a new object, and
    // no test could observe what was written into THAT element.
    querySelector: (sel) => {
      if (mapa[sel] !== undefined) return mapa[sel];
      if (ausentes.includes(sel) || !comMarcacao) return null;
      if (!memo.has(sel)) memo.set(sel, el(sel));
      return memo.get(sel);
    },
    // ⚠️ BY SELECTOR, not one list: returning the same thing to every selector made the fake overlays reach `[data-i18n]`
    // too, and `applyDom` called `getAttribute` on an object that does not have it. A double that does not tell the
    // questions apart ends up answering the wrong one.
    querySelectorAll: (sel) => (listas[sel] ?? []),
  };
  // ⚠️ THE `win` RECORDS, and it is not fussiness: a double that swallows `addEventListener` cannot answer whether
  // something was SWITCHED ON, which is exactly issue #109's question. While it was a no-op, `createGame` could mount
  // the menu navigation and not switch it on without anything going red — and that is what happened.
  const ouvintes = [];
  const win = {
    addEventListener: (tipo, fn, captura) => { ouvintes.push({ type: tipo, fn, captura }); },
    getComputedStyle: () => ({ zIndex: '0' }),
    // The root passes it to whoever asks the reduced-motion default (ADR-0232); this double asks for no reduction.
    matchMedia: () => ({ matches: false }),
  };
  return { doc, win, ouvintes };
}

/**
 * The `#game-region` a case NAMES, so it can see what the engine hung on it.
 *
 * ⚠️ ONE FUNCTION AND NOT COPIES OF THE SAME LITERAL: the engine asks whether the pause host is INSIDE `#game-region`
 * (the arrows find the open panel through `'#game-region .overlay'`), and every copy needed the same new answer at the
 * same time. A function is the place where such an answer is written once.
 */
function regiaoFalsa() {
  return {
    id: 'game-region', innerHTML: '', filhos: [],
    appendChild(n) { this.filhos.push(n); return n; },
    // `contains` tells the truth about itself and about its children — the question the engine asks.
    contains(n) { return n === this || this.filhos.includes(n); },
    addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [],
    // ⚠️ `classList` and `style`, since the root's CRT draws on THIS region (ADR-0232 D4): it used to look `#game-region`
    // up in the global document, which this project does not have, so it never reached the injected one at all.
    classList: (() => {
      const s = new Set();
      return { add: (c) => s.add(c), remove: (c) => s.delete(c), contains: (c) => s.has(c) };
    })(),
    style: { setProperty() {}, removeProperty() {} },
  };
}

/** A conforming quiz declaration — no space, only order. It is the genre that cannot pretend to be a platformer. */
const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  holdsAtOnce: () => 1,
  // A hotspots game holds nothing — and declaring `1` above and `false` here is ADR-0115's distinction written in a
  // fixture: the two fields answer different questions.
  holdsKeys: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'primeira pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

describe('createGame em execução', () => {
  // WARMS THE MODULE ONCE, OUTSIDE EACH CASE'S 5 s WINDOW.
  //
  // This block's `await import()` calls are on purpose: the first half of the file reads the SOURCE, and a static import
  // would make a broken `create-game` bring down the cases that only read text too — exactly what is wanted measured
  // apart.
  //
  // The price was an INTERMITTENT test: the first `import` pays the cold transformation of the whole boot graph (engine +
  // i18n + audio + overlays), and that goes past vitest's default 5 s when the machine is loaded or an edit invalidated
  // the transform cache. It failed with "Test timed out in 5000ms", which reads as a slow test and is really a test
  // measuring compilation. Warming here, the following imports come from the cache and measure only what they should.
  beforeAll(async () => { await import('../app/js/boot/create-game.js'); }, 30000);

  it('[Zero] declaração MALFORMADA explode — um jogo meio declarado é pior que um que não abre', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const ruim = { ...declaracaoValida(), topology: undefined };
    expect(() => createGame({ accommodations: SEM_ASSUNTO, declaration: ruim, host: { doc, win } })).toThrow(/malformada/);
  });

  it('🔴 [Zero] um cartucho que declara «start» no preset é RECUSADO, com o motivo dito (ADR-0144 §4)', async () => {
    // 🔴 THIS IS THE GATE A CARELESS IMPLEMENTATION PASSES BY ACCIDENT, and the record itself warns of it: no cartridge
    // declares «start» TODAY, so asserting only that nothing broke would stay green with nothing in force. That is why the
    // case BUILDS the forbidden cartridge instead of waiting for one.
    //
    // ⚠️ AND THE RULE IS NOT TIDINESS: since ADR-0122 the pause is not declinable, and «start» is the only position that
    // reaches it. A game that took it for something else would decline the pause by the back door — with the panels
    // mounted, in the document, and unreachable, with no red line anywhere.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const base = () => ({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });

    expect(() => createGame({ accommodations: SEM_ASSUNTO, ...base(), preset: { start: { label: 'Turbo' } } }))
      .toThrow(/«start» is the position that opens the pause/);

    // THE PAIR THAT PREVENTS A CHECK THAT ALWAYS ACCUSES: the same preset without «start» passes. Without it, a refusal
    // written `if (preset) throw` would stay green above and take the vocabulary away from the whole catalogue.
    expect(() => createGame({ accommodations: SEM_ASSUNTO, ...base(), preset: { action2: { label: 'Confirmar' } } })).not.toThrow();

    // AND `mount()` REFUSES BY THE SAME RULE. `CartridgeHooks` carries `preset`, so a SECOND cartridge could take the
    // «start» the first respected — and the pause would become unreachable mid-session.
    const motor = createGame(base());
    expect(() => motor.mount(declaracaoValida(), { accommodations: SEM_ASSUNTO, preset: { start: { label: 'Turbo' } } }))
      .toThrow(/«start» is the position that opens the pause/);
  });

  it('🔴 [Right] the optional genre (ADR-0156): Casino game refused at createGame and mount; Horror game reported «avoid»', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const base = () => ({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    expect(() => createGame({ ...base(), genre: 'Casino game' })).toThrow(/Casino game.*prohibited/);
    expect(() => createGame({ ...base(), genre: 'Educational game' })).toThrow(/not in the engine's genre list/);
    // the pair: no genre, and a listed one, boot
    expect(() => createGame(base())).not.toThrow();
    const motor = createGame({ ...base(), genre: 'Horror game' });
    expect(motor.problems.join(' '), 'Horror game boots without its «avoid» mark said').toMatch(/Horror game.*avoid/);
    expect(createGame({ ...base(), genre: 'Platform games' }).problems.join(' ')).not.toMatch(/genre/i);
    expect(() => motor.mount(declaracaoValida(), { accommodations: SEM_ASSUNTO, genre: 'Casino game' })).toThrow(/Casino game.*prohibited/);
  });

  it('🔴 [Zero] e um cartucho que declara «select» também é RECUSADO — é a porta dos menus (ADR-0155 §4)', async () => {
    // Same construction as the case above, and for the same reason: no game declares «select» today (measured in the
    // games' repositories), so only a BUILT cartridge can turn this check red.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const base = () => ({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    expect(() => createGame({ ...base(), preset: { select: { label: 'Mapa' } } }))
      .toThrow(/«select» is the position that opens the pause menus/);
    // the pair: a preset with no system position passes
    expect(() => createGame({ ...base(), preset: { action1: { label: 'Mapa' } } })).not.toThrow();
    const motor = createGame(base());
    expect(() => motor.mount(declaracaoValida(), { accommodations: SEM_ASSUNTO, preset: { select: { label: 'Mapa' } } }))
      .toThrow(/«select» is the position that opens the pause menus/);
  });

  it('[Right] a exceção DIZ o que falta, em vez de "erro ao iniciar"', () => {
    // Whoever writes a preset reads this message at the first `npm run dev`; it is the manual at that moment.
    return import('../app/js/boot/create-game.js').then(({ createGame }) => {
      const { doc, win } = domFalso();
      const ruim = { ...declaracaoValida(), tick: 'turno', roleAt: undefined };
      let msg = '';
      try { createGame({ accommodations: SEM_ASSUNTO, declaration: ruim, host: { doc, win } }); } catch (e) { msg = String(e.message); }
      expect(msg).toMatch(/tick/);
      expect(msg).toMatch(/roleAt/);
    });
  });

  it('[Boundary] marcação AUSENTE não explode: vira `problems`, e o resto da engine liga', async () => {
    // The asymmetry is the module's decision, and this pair of cases is what holds it. A wrong declaration is a PROGRAM
    // defect; a missing id is a gap of the HOST, and the second consumer proved that switching on only the part that
    // serves is legitimate — that is how it declined the pad and the sonar without lying.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso({ comMarcacao: false });
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    expect(motor.problems.length).toBeGreaterThan(0);
    expect(motor.problems.join(' ')).toMatch(/game-region/);
    expect(motor.tts, 'a voz tem de existir mesmo com o documento incompleto').toBeTruthy();
    expect(motor.nav).toBeTruthy();
  });

  it('[Right] com o documento completo, `problems` só acusa o que de fato falta', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    // ⚠️ The neural-voice declaration is here because a REAL game opens it (ADR-0094, one line). Without it, `problems`
    // would accuse — correctly — and this case would stop measuring what it says it measures.
    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win },
      uses: { neuralVoice: true },
      // ⚠️ The `preset` is here for the same reason: the help is mounted by the engine (ADR-0147 §4) and, without the
      // game's words, it accuses — rightly. Without this line the case would stop measuring what it says it measures.
      // (its word is a KEY of the game's dictionary, in the three languages: ADR-0232 D3)
      preset: { action2: { labelKey: 'game.confirm' } },
      dictionaries: { pt: { 'game.confirm': 'Confirmar' }, en: { 'game.confirm': 'Confirm' }, es: { 'game.confirm': 'Confirmar' } },
    });
    // The filter host was not supplied in this case, and it is the ONLY gap that must remain.
    expect(motor.problems).toHaveLength(1);
    expect(motor.problems[0]).toMatch(/filter host/);
  });

  it('🔴 [Zero] SEM `preset` a AJUDA não é montada, e a engine DIZ porquê', async () => {
    // 🔴 The help screen lists POSITION ↔ key ↔ the game's word. Without the words it could only show `action2` to a
    // child who opened the help precisely for not knowing what the button does — the defect ADR-0074 forbids. So it is
    // not mounted; and ADR-0106 §5 prefers absence to a dead button.
    //
    // ⚠️ BUT THE ABSENCE MUST BE SAID, by the precedent the neural-voice case set: an engine feature that vanishes for lack
    // of ONE declaration, silently, is the same class of defect.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win },
      uses: { neuralVoice: true },
    });
    const daAjuda = motor.problems.filter((p) => /help screen/.test(p));
    expect(daAjuda, 'sem `preset` a ajuda sumiu e nada o disse').toHaveLength(1);
    // 📌 And the line must be ACTIONABLE: it says the missing field and the record that defines it. A line that only said
    // something is missing would be ADR-0106 §2's gap the consumer reads as a choice.
    expect(daAjuda[0]).toMatch(/preset/);
  });

  it('⚠️ [Zero] with NO neural voice declared, the engine SAYS so', async () => {
    // A game that does not ask for one (ADR-0216 §3) has only the browser's voice, and nothing said so: the line is the warning.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    const linha = motor.problems.find((p) => /neural voice/.test(p));
    expect(linha, 'sem voz neural e a engine não disse nada').toBeTruthy();
    expect(linha, 'the way out is not named').toMatch(/neuralVoice/);
    expect(linha, 'the decline is not named').toMatch(/noNeuralVoice/);
    expect(linha, 'what the child loses is not said').toMatch(/cannot read/);
  });

  it('⚠️ [Right] DECLARAR `noNeuralVoice` cala a linha — declinar é escolha, não declarar é omissão', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win }, declines: { noNeuralVoice: true },
    });
    expect(motor.problems.filter((p) => /neural voice/.test(p))).toEqual([]);
  });

  // ===================== THE DECLARED POINTER (ADR-0112) =====================
  // ⚠️ WITHOUT THIS WIRING, THE DECISION IS A PARAMETER NOBODY CAN SET. `reach()` accepts the question and has its own
  // gate, but the fourth argument always arrived `false` because `GameDeclaration` had no way to say it — a drawing game
  // could not declare that it draws.
  const TRES_PALAVRAS = { up: { label: 'Subir' }, down: { label: 'Descer' }, action1: { label: 'Confirmar' } };
  const soTeclado = (rato) => ({
    gamepad: () => false, touch: () => false, keyboard: () => true, mouse: () => rato,
  });

  it('⚠️ [Zero] um jogo que DECLARA ponteiro é recusado por um aparelho que não aponta', async () => {
    // ADR-0112's scenario: free drawing on a device with neither mouse nor touch. The refusal must happen HERE, before
    // the child starts, and not in the middle of the first stroke.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: { ...declaracaoValida(), needsPointer: () => true },
      host: { doc, win }, preset: TRES_PALAVRAS, availability: soTeclado(false),
    });
    expect(motor.reach.needsPointer, 'a declaração não chegou ao alcance').toBe(true);
    expect(motor.reach.ok, 'disse sim a um jogo que esta criança não consegue jogar').toBe(false);
    expect(motor.reach.cannotPoint).toEqual(['teclado']);
  });

  it('⚠️ [Right] o MESMO jogo com RATO passa — «no caso do teclado, o sinal contínuo é o mouse»', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: { ...declaracaoValida(), needsPointer: () => true },
      host: { doc, win }, preset: TRES_PALAVRAS, availability: soTeclado(true),
    });
    expect(motor.reach.ok).toBe(true);
    expect(motor.reach.cannotPoint).toEqual([]);
  });

  it('⚠️ [Zero] quem NÃO declara nada não pede ponteiro — o campo é opcional de propósito', async () => {
    // ⚠️ AND BEING OPTIONAL IS A DECISION, not carelessness. `holdsAtOnce` is required because it has no safe default and
    // fails INVISIBLY to whoever writes the game — they have a full keyboard; whoever finds out is the child on a
    // two-finger phone. This one has a safe default (`false`) and fails VISIBLY: a drawing game that forgets to declare is
    // unusable on its own author's device. Forcing every game to write `needsPointer: () => false` would charge
    // `holdsAtOnce`'s price without its reason.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win }, preset: TRES_PALAVRAS, availability: soTeclado(false),
    });
    expect(motor.reach.needsPointer).toBe(false);
    expect(motor.reach.ok).toBe(true);
  });

  it('⚠️ [Right] a engine MONTA a barra de acessibilidade da primeira tela (ADR-0106 etapa 2)', async () => {
    // ⚠️ THIS IS THE DEV'S REQUEST AS AN ASSERTION: «todo jogo da engine inclusionist deve ter os mesmos ícones de
    // acessibilidade desde a primeira tela». Reporting the absence is not offering the bar; the engine mounts it.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const barra = {
      id: 'title-icons', innerHTML: '', addEventListener: () => {},
      querySelector: () => null, querySelectorAll: () => [],
    };
    const { doc, win } = domFalso({ map: { '#title-icons': barra } });
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });

    expect(barra.innerHTML, 'a engine não escreveu ícone nenhum na barra').toContain('pi-btn');
    expect(barra.innerHTML, 'o modo cego não está na primeira tela').toContain('data-pi="blind"');
    expect(barra.innerHTML, 'o TTS não está na primeira tela').toContain('data-pi="tts"');
    // ⚠️ And §5 reaches the mounted bar through HERE too: with no visual writer injected, the icon that needs one does not
    // come in — instead of coming in and refusing the child who presses it.
    expect(barra.innerHTML, 'contraste montado sem quem o escreva').not.toContain('data-pi="contrast"');
    expect(barra.innerHTML, 'correção de cor montada sem quem a escreva').not.toContain('data-pi="cvd"');
    expect(motor.problems.filter((p) => /accessibility bar/.test(p)), 'acusou uma barra que montou').toEqual([]);
  });

  it('⚠️ [Zero] a barra que a engine monta é NAVEGÁVEL sem o jogo dar nada (ADR-0106 §5)', async () => {
    // ⚠️ THIS CASE GUARDS A HOLE THAT STEP 2 OPENED. Before it, `onBar`/`navBar` falling to a no-op was harmless: with no
    // bar mounted, nobody called them. With the bar mounted and both as no-ops, it would exist and be reachable only by
    // POINTER.
    //
    // For a blind child, who navigates by keyboard, a bar she cannot reach is the same as no bar — the offering of a path
    // and then refusing it that §5 forbids, with the bar in the role of the door.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win },
      uses: { neuralVoice: true },
    });
    // The `nav` is mounted with the engine's OWN answers — not no-ops. `menuNavKey` is the keyboard translator, and it is
    // how the directional reaches the bar.
    expect(motor.nav, 'a navegação de menu não foi montada').toBeTruthy();
    expect(typeof motor.nav.menuNavKey, 'o tradutor de teclado não existe').toBe('function');
    expect(typeof motor.nav.navPause, 'a navegação da pausa não existe').toBe('function');
    // ⚠️ And the proof that the two defaults are no longer no-ops: this root's source answers with its own instance. Read
    // from the file because `initMenuNav`'s `ctx` is not observable from outside — and a claim that cannot be made is
    // better said this way than faked with a double that accepts everything.
    // ⚠️ THESE TWO CHECKS READ THE SOURCE TEXT, so they are tied to the NAME of whoever holds the game's half
    // (`cartridge`, ADR-0142), and to the answer being one `const` shared by the menu navigation and the gamepad (ADR-0224).
    // A rename fails here with the right message — which is wanted — but the cause is the name, not the rule.
    expect(FONTE, 'a barra montada voltou a ser inalcançável por teclado')
      // ⚠️ This case ANCHORS on a literal of the source, and a literal that changes name must change here in the same
      // commit — or the gate stops demanding what it demands, silently.
      .toMatch(/const isOnBar = cartridge\.onBar \?\? \(\(i: number\) => pauseIcons\.onBar\(i\)\)/);
    expect(FONTE).toMatch(/const navBar = cartridge\.navBar \?\? \(\(i: number, k: NavKeys, withStart\?: boolean\) => pauseIcons\.navBar\(i, k, withStart\)\)/);
    // ⚠️ And the mounted bar must go on TELLING THE TRUTH when blind mode changes elsewhere (the audio panel, the empathy
    // simulation). Without this subscription the icon would go on saying off after the child turned it on — the family of
    // a control lying about its state.
    expect(FONTE, 'a barra montada não se refaz quando o modo cego muda fora dela')
      .toMatch(/stateOn\('blindMode',\s*\(\)\s*=>\s*\{\s*pauseIcons\.reflectIconsIn\(a11yBar,\s*0\);\s*\}\)/);
  });

  it('🔴 [Right] trocar de idioma avisa o RECONHECIMENTO DE FALA, e não só o que se desenha (ADR-0225)', () => {
    // 🔴 `ui/voice-control` has the cases of what it DOES when told the language changed; what nothing held was the root
    // TELLING it — a mutation that deleted this line passed with the whole suite green.
    // ⚠️ READ FROM THE SOURCE, for the reason of the two checks above: the 👄 is born only where there is a microphone to
    // ask for, and in a test boot it is never ON at the instant of the change (the model is not in the delivery, so it
    // fails to start and switches off). What this holds is the WIRING; the behaviour is held in `voice-control`.
    expect(FONTE, 'a troca de idioma deixou de alcançar o reconhecimento de fala: a criança passa a ser ouvida na língua velha')
      .toMatch(/localeOn\(\(\) => \{[\s\S]{0,2000}?voiceControl\?\.languageChanged\(\)/);
  });

  it('⚠️ [Right] a engine monta o CARTÃO DE PAUSA — e com o id que ela própria procura', async () => {
    // 📏 THE LOOP THIS CLOSES: `#vp-pause-0` is looked for by this root's `getPauseMenu` and games did not create it. The
    // engine had invented a convention, looked for it, not found it, and concluded in silence that no game had a pause
    // menu.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const regiao = regiaoFalsa();
    const { doc, win } = domFalso({ map: { '#game-region': regiao } });
    createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });

    // ⚠️ BY THE ID AND NOT BY THE COUNT. The count was never the demand — it was a proxy, true while the card was the only
    // thing the engine hung there. The engine hangs the settings panels there too, and a count would measure how many
    // things the engine mounts instead of whether the card is there.
    const cartao = regiao.filhos.find((f) => f.id === 'vp-pause-0');
    expect(cartao, 'a engine não pendurou o cartão com o id que ela própria procura').toBeTruthy();
    expect(cartao.className).toBe('screen-pause');
  });

  it('🔴 [Inverse] NENHUMA declinação tira o cartão — nem a que existia e foi aposentada (ADR-0122)', async () => {
    // 🎯 THE GATE ADR-0122 OWED, and it asserts the Dev's whole decision: «o menu de pausa da engine e os botões no hud
    // para acessibilidade rápida deveriam estar em todos os jogos, por isso seriam responsabilidade da engine». It is not
    // offered; it is the engine's.
    //
    // ⚠️ THE FIXTURE PASSES THE RETIRED PAUSE-MENU DECLINE ON PURPOSE, and that is what makes it a gate instead of a
    // repetition of the case above. The field left the contract, so in TypeScript this does not even compile — but an
    // object from a cartridge on `7.0.1` carries the key all the same, and what is asserted is that it has no effect.
    // Putting the query back makes this case fail and the one above pass.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const regiao = regiaoFalsa();
    const { doc, win } = domFalso({ map: { '#game-region': regiao } });
    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win },
      declines: { semMenuDePausa: true, noPauseActor: true, noNeuralVoice: true },
    });

    // By the id and not the count, for the reason written in the case above.
    expect(regiao.filhos.some((f) => f.id === 'vp-pause-0'),
      'uma declinação aposentada voltou a tirar o cartão da criança').toBe(true);
    // 📌 And silence does not come back by the other door: with a valid host there is nothing to accuse.
    expect(motor.problems.filter((p) => p.includes('pausa')), 'acusou pausa com hospedeiro válido').toEqual([]);
  });

  it('⚠️ [Right] MONTAR não é MOSTRAR — e a engine dá as duas, sem o jogo caçar id nenhum', async () => {
    // ⚠️ MOUNTING IS NOT SHOWING. The card is born `hidden` — it must, a pause is opened — and the engine reveals it on
    // SELECT, the ☰ and the quick pause's `action4`. These two let a game do it too; without them a game mounted by
    // `createGame` would have to look for `#vp-pause-0` in the document — exactly the knowledge this file exists not to
    // demand.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const cartaoMapeado = {
      id: '', hidden: true, className: '', dataset: {}, innerHTML: '',
      appendChild: (n) => n, addEventListener: () => {},
      querySelector: () => null, querySelectorAll: () => [],
    };
    const regiao = regiaoFalsa();
    const { doc, win } = domFalso({ map: { '#game-region': regiao, '#vp-pause-0': cartaoMapeado } });
    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win },
      uses: { neuralVoice: true },
    });

    expect(typeof motor.pause.show, 'a engine monta e não sabe mostrar').toBe('function');
    expect(cartaoMapeado.hidden, 'o cartão tem de nascer escondido — uma pausa ABRE-SE').toBe(true);
    motor.pause.show(0);
    expect(cartaoMapeado.hidden, 'mostrar não revelou o cartão').toBe(false);
    motor.pause.hide(0);
    expect(cartaoMapeado.hidden).toBe(true);
  });

  it('⚠️ [Right] quem DECLINA o menu de pausa não recebe cartão nem acusação', async () => {
    // Declining is a recorded choice; not having is an omission. ADR-0106 §2 is entirely about the difference, and a gate
    // that treated them alike would erase the reason declines exist.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const regiao = regiaoFalsa();
    const { doc, win } = domFalso({ map: { '#game-region': regiao } });
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    // 🔴 THE CASE'S TITLE PREDATES ADR-0120, and the assertion is its opposite. The pause-menu decline was retired — the
    // Dev: «Aposentar.» — because ADR-0106 built what it stood for: a default list of buttons and the mounting of the card.
    // 📌 So the assertion is the OPPOSITE and stronger: EVERY game gets the card, with nothing to declare. A game that
    // used to stay quiet now has a place where the child reaches the settings during the match.
    expect(regiao.filhos.length, 'a engine deixou de montar a pausa que agora é de todos').toBeGreaterThan(0);
    expect(motor.problems.filter((p) => /menu de pausa/.test(p)), 'acusou um jogo com hospedeiro válido').toEqual([]);
  });

  it('⚠️ [Boundary] um hospedeiro que não aceita conteúdo nem clique NÃO derruba o boot', async () => {
    // Bringing the whole game down because of the bar would take it from everyone so as to give it to no one. The gap
    // becomes `problems`, like the host's others.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const inutil = { id: 'title-icons', querySelector: () => null, querySelectorAll: () => [] };
    const { doc, win } = domFalso({ map: { '#title-icons': inutil } });
    let motor;
    expect(() => { motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } }); }).not.toThrow();
    expect(motor.problems.some((p) => /takes neither content nor clicks/.test(p))).toBe(true);
  });

  it('⚠️ [Zero] com DOIS assentos e sem ator de pausa, a engine DIZ — o segundo não consegue remapear', async () => {
    // Finding 3 of the `game-soccer` audit. The keyboard panel is parameterised by the SEAT (`render(selPlayer)` draws
    // that scheme's positions) and has no selector — the consumer chooses, by passing the pause actor. ⚠️ Without
    // `setPauseActor` this root's default is `() => {}`: a two-seat game mounted by `createGame` leaves the child in the
    // SECOND seat unable to remap, silently.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: declaracaoValida(),
      host: { doc, win },
      players: [{ ctrl: {} }, { ctrl: {} }],
    });
    const linha = motor.problems.find((p) => /pause actor/.test(p));
    expect(linha, 'dois assentos sem ator de pausa e a engine não disse nada').toBeTruthy();
    // ⚠️ The sentence names the WAY OUT and what is lost, as the others of this block do — a line that only says something
    // is missing sends someone searching, and whoever searches is whoever did not already know.
    expect(linha).toMatch(/remap/);
    expect(linha).toMatch(/noPauseActor/);
  });

  it('[Right] UM assento não acusa nada — a frase é sobre o segundo, e não sobre existir', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win }, players: [{ ctrl: {} }],
    });
    expect(motor.problems.filter((p) => /pause actor/.test(p))).toEqual([]);
  });

  it('⚠️ [Right] DECLARAR `noPauseActor` cala a linha — ausência declarada é escolha', async () => {
    // The distinction this case guards: declining is a recorded choice; not declining is an omission. ADR-0106 §2 is
    // entirely about the difference between the two, and a gate that treated them alike would erase the reason declines
    // exist.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: declaracaoValida(),
      host: { doc, win },
      players: [{ ctrl: {} }, { ctrl: {} }],
      declines: { noPauseActor: true },
    });
    expect(motor.problems.filter((p) => /pause actor/.test(p))).toEqual([]);
  });

  it('⚠️ [Zero] SEM barra de acessibilidade na primeira tela, a engine DIZ — e cinco jogos não a têm', () => {
    // ⚠️ `ausentes` and not `comMarcacao: false`, and the reason is written in `domFalso` itself: a double that answers
    // YES to any selector does not test the question — it only tests that it was asked. Without this the case would stay
    // green without ever exercising the absence, which is how the non-existent world case once passed green.
    //
    // THE DEV'S REQUEST (2026-09-07): «os ícones de acessibilidade que aparecem no jogo desde a primeira tela
    // devem ser oferecidos pela ENGINE e não pela programação do jogo. Todo jogo da engine inclusionist deve
    // ter o mesmo menu de pausa e ícones de acessibilidade desde a primeira.»
    //
    // ⚠️ Most of the catalogue's games had no bar at all — they did not call `initPauseIcons` nor mount a HUD. A child
    // who depends on blind mode, narration or high contrast opened them and had no way in. This case does not mount the
    // bar; it closes the SILENCE, the part that made those games look complete.
    return import('../app/js/boot/create-game.js').then(({ createGame }) => {
      const { doc, win } = domFalso({ ausentes: ['#title-icons'] });
      const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
      const linha = motor.problems.find((p) => /accessibility bar/.test(p));
      expect(linha, 'a engine calou-se sobre a barra que falta').toBeTruthy();
      // The sentence names the WAY OUT and what is LOST — saying something is missing sends someone searching without
      // saying for what.
      expect(linha).toMatch(/a11yBarHost/);
      expect(linha).toMatch(/#title-icons/);
      expect(linha, 'não diz o que a criança perde').toMatch(/blind mode|narration|Libras/);
    });
  });

  // ========================= MUTATIONS CHECKED (the first screen's a11y bar) =========================
  //   · `if (!a11yBar)` -> `if (false)` (the engine goes quiet again) -> fails the Zero case. It is what makes games
  //     without a bar look complete.
  //   · removing `o.host.a11yBarHost ??` -> fails the case of the game that declares its element. The gate would demand
  //     an ID instead of a bar, and a cartridge with other markup would be accused with no defect at all.
  //   · shortening the sentence to say only that there is no bar on the first screen -> fails, because it stops naming
  //     the WAY OUT (`a11yBarHost` / `#title-icons`). Saying something is missing sends someone searching without saying
  //     for what.
  //   · removing the second half of the sentence -> fails: it stops saying what the CHILD loses, the part that makes
  //     someone fix instead of file.

  it('[Right] e um jogo que DECLARA o seu elemento não é acusado — a barra não tem de se chamar assim', () => {
    // The `#title-icons` id is the one the platformer has always used, and it is not a naming requirement: a cartridge
    // with other markup declares the element and is served. Without this case, the one above would be demanding an id
    // instead of a bar.
    return import('../app/js/boot/create-game.js').then(({ createGame }) => {
      const { doc, win } = domFalso({ ausentes: ['#title-icons'] });
      // ⚠️ The double has `innerHTML` and `addEventListener`: the engine MOUNTS the bar in here (ADR-0106 step 2), and an
      // element that takes neither content nor clicks is accused by a `problems` line of its own — correctly, but that is
      // not what this case measures.
      const meuSitio = {
        id: 'outro-lugar', innerHTML: '', addEventListener: () => {},
        querySelector: () => null, querySelectorAll: () => [],
      };
      const motor = createGame({ accommodations: SEM_ASSUNTO,
        declaration: declaracaoValida(),
        host: { doc, win, a11yBarHost: meuSitio },
      });
      expect(motor.problems.some((p) => /accessibility bar/.test(p)),
        'acusou um jogo que declarou onde a barra entra').toBe(false);
    });
  });


  it('⚠️ o MUNDO declarado que NAO existe no documento vira `problems` (ADR-0087)', async () => {
    // The failure conformance does not reach: `conformanceProblems` checks the SHAPE — that there is a selector and it is
    // not empty — and cannot check whether it MATCHES anything, because `core/contract` is pure and sees no DOM.
    //
    // A typo passes conformance and produces exactly the defect ADR-0087 exists to remove: the empathy simulation applied
    // to NOTHING, and an adult told they felt something they did not. It is a HOST gap, so it goes into `problems` — the
    // game opens and whoever integrated it reads.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso({ ausentes: ['#gaem-region'] });
    const torto = { ...declaracaoValida(), world: () => ({ kind: 'element', selector: '#gaem-region' }) };
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: torto, host: { doc, win } });
    expect(motor.problems.join(' ')).toMatch(/declared world \S+ is not in the page/);
    expect(motor.tts, 'o jogo abre mesmo assim').toBeTruthy();
  });

  it('`none` NAO exige elemento nenhum — atividade sem espaco', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const paint = { ...declaracaoValida(), world: () => ({ kind: 'none' }) };
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: paint, host: { doc, win } });
    expect(motor.problems.join(' ')).not.toMatch(/declared world/);
  });

  it('⚠️ a navegacao de menu fica LIGADA, e nao so montada (issue #109)', async () => {
    // `MenuNavApi.attach()` existed and `createGame` never called it. In a game booted by the engine, the accessibility
    // dialogs and the pause menu answered only to the MOUSE — pillar 2 failing whole. The `consumer-quiz` had to call it
    // by hand right after `createGame`, which was the symptom.
    //
    // THE CAPTURE PHASE is part of the assertion: the menu must see the key BEFORE whoever is underneath, or the game
    // consumes the arrow and the open dialog does not navigate.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win, ouvintes } = domFalso();
    createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    const nav = ouvintes.filter((o) => o.type === 'keydown' && o.captura === true);
    expect(nav.length, 'a navegacao de menu voltou a ficar desligada').toBeGreaterThan(0);
  });

  it('⚠️ a ARMADILHA DE FOCO fica instalada, e prende de verdade (issue #109)', async () => {
    // ⚠️ THIS CASE WAS BORN OF A MUTATION THAT SURVIVED. Checking that there is a capturing keydown listener was not
    // enough: the menu navigation already installed one, so removing the whole trap from `createGame` left the count
    // intact and the test green. Counting listeners answers that someone registered, not that the trap exists. So this
    // case FIRES a Tab through the installed listeners and checks what happened to the focus.
    const { createGame } = await import('../app/js/boot/create-game.js');

    const focados = [];
    const botao = (n) => ({ n, hidden: false, getClientRects: () => [{}], focus() { focados.push(n); } });
    const isInside = [botao('primeiro'), botao('ultimo')];
    const overlay = {
      hidden: false, style: { zIndex: '61' },
      querySelectorAll: () => isInside,
    };
    const { doc, win, ouvintes } = domFalso({ listas: { '#game-region .overlay': [overlay] } });
    doc.activeElement = { n: 'o tabuleiro por baixo' }; // focus is OUTSIDE the dialog: the realistic case

    createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });

    let impedido = false;
    const tab = { key: 'Tab', shiftKey: false, preventDefault: () => { impedido = true; } };
    for (const o of ouvintes) if (o.type === 'keydown' && o.captura === true) o.fn(tab);

    expect(focados, 'o Tab saiu do dialogo para o jogo por baixo').toEqual(['primeiro']);
    expect(impedido, 'sem preventDefault o navegador move o foco logo a seguir').toBe(true);
  });

  it('⚠️ a engine ENTREGA o aviso de que o laco parou (ADR-0054, issue #109)', async () => {
    // `core/loop` already stopped when a frame threw, and stopped IN SILENCE. A frozen screen is a VISUAL symptom — in
    // blind mode, a stopped game and a thinking game produce the same thing.
    //
    // ⚠️ HANDED OVER, and the case checks that form on purpose: whoever calls `startLoop` is the GAME, owner of the ticker.
    // The engine hands the notice over (`onFailure`) and also registers it with `core/loop` as the default (study item
    // D1), so no game has to write its own message, which would diverge silently between games.
    // ⚠️ `#incl-parou` goes into `ausentes`: the notice looks for the box BEFORE creating it, so as not to stack two. A
    // double that returned an element for any selector would make the module think it already exists and never add it —
    // and this case would assert the opposite of what it promises.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const alerta = { textContent: '' };
    // `classList` and `style.setProperty` since the root's CRT draws on the injected region (ADR-0232 D4); the CRT is not
    // this case's subject.
    const regiao = { filhos: [], appendChild(f) { this.filhos.push(f); }, style: { setProperty() {} }, contains: () => false,
      classList: { add() {}, remove() {} } };
    const { doc, win } = domFalso({
      map: { '#sr-alert': alerta, '#game-region': regiao },
      ausentes: ['#incl-parou'],
    });
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });

    expect(typeof motor.onFailure, 'a engine deixou de entregar o aviso').toBe('function');
    motor.onFailure(new Error('o quadro quebrou'));
    expect(alerta.textContent, 'quem nao ve a tela nao foi avisado').toBeTruthy();
    const caixa = regiao.filhos.find((f) => f.id === 'incl-parou');
    expect(caixa, 'quem ve a tela nao foi avisado').toBeTruthy();
    expect(caixa.textContent).toBe(alerta.textContent);
  });

  it('⚠️ o filtro de visao cai no MUNDO DECLARADO, e nao numa canvas assumida (ADR-0087)', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const mundo = { style: {}, contains: () => false };
    const { doc, win } = domFalso({ map: { '#meu-mundo': mundo } });
    const d = { ...declaracaoValida(), world: () => ({ kind: 'element', selector: '#meu-mundo' }) };
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: d, host: { doc, win } });
    motor.applyVisionFilter('brightness(0)', 'mundo');
    expect(mundo.style.filter).toBe('brightness(0)');
  });

  it('⚠️ um overlay DENTRO do mundo perde o filtro — e um de fora nao e tocado', async () => {
    // The generalisation that replaces the platformer's hand-written rule: it cleared `#dom-layer` because that sits INSIDE
    // `#game-region` and a CSS filter is inherited. Here the code ASKS the DOM instead of assuming the shape, which is why
    // it serves both the engine's markup and a game's that nests nothing.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const isInside = { style: { filter: 'brightness(0)' } };
    const fora = { style: { filter: 'brightness(0)' } };
    const mundo = { style: {}, contains: (el) => el === isInside };
    const { doc, win } = domFalso({ map: { '#meu-mundo': mundo }, listas: { '#game-region .overlay': [isInside, fora] } });
    const d = { ...declaracaoValida(), world: () => ({ kind: 'element', selector: '#meu-mundo' }) };
    createGame({ accommodations: SEM_ASSUNTO, declaration: d, host: { doc, win } }).applyVisionFilter('brightness(0)', 'mundo');
    expect(isInside.style.filter, 'o menu dentro do mundo tem de sair da simulacao').toBe('');
    expect(fora.style.filter, 'um overlay fora do mundo nao e assunto desta funcao').toBe('brightness(0)');
  });

  it('com alcance `mundo-e-menus` o overlay de dentro MANTEM o filtro', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const isInside = { style: { filter: 'contrast(2)' } };
    const mundo = { style: {}, contains: () => true };
    const { doc, win } = domFalso({ map: { '#meu-mundo': mundo }, listas: { '#game-region .overlay': [isInside] } });
    const d = { ...declaracaoValida(), world: () => ({ kind: 'element', selector: '#meu-mundo' }) };
    createGame({ accommodations: SEM_ASSUNTO, declaration: d, host: { doc, win } }).applyVisionFilter('contrast(2)', 'mundo-e-menus');
    expect(isInside.style.filter, 'melhoria alcanca os menus; so a EMPATIA os poupa').toBe('contrast(2)');
  });

  it('⚠️ `none` NAO pinta nada — atividade sem espaco nao tem mundo para simular', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const qualquer = { style: {}, contains: () => false };
    const { doc, win } = domFalso({ map: { '#meu-mundo': qualquer } });
    const d = { ...declaracaoValida(), world: () => ({ kind: 'none' }) };
    createGame({ accommodations: SEM_ASSUNTO, declaration: d, host: { doc, win } }).applyVisionFilter('brightness(0)', 'mundo');
    expect(qualquer.style.filter, 'pintar um filtro sobre atividade sem espaco e a mentira ao contrario').toBeUndefined();
  });
  it('[Interface] declinar fica NO REGISTRO — um consumidor pode ser auditado pelo que recusou', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win },
      // The case is about declines CROSSING the root, not about which ones exist: one declared, one left out, so both
      // halves are asserted (ADR-0122 and ADR-0231 each took a field out of this contract).
      declines: { noNeuralVoice: true },
    });
    expect(motor.declines.noNeuralVoice).toBe(true);
    expect(motor.declines.noPauseActor).toBeUndefined();
  });

  it('[Right] a declaração ATRAVESSA intacta — a engine carrega os sete campos, não uma cópia deles', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const d = declaracaoValida();
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: d, host: { doc, win } });
    expect(motor.declaration).toBe(d);
    // And the objective is readable WITHOUT the engine knowing what a coin is: it is field 5 answering.
    expect(motor.declaration.objectiveOf(0)).toEqual({
      name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3,
    });
  });

  /**
   * 🎯 WHAT THE DECLARATION CAUSES, not only what it says (ADR-0216 §3): the list the boot downloads comes from the game's
   * answer. A game that does not ask for a neural voice cannot pay 372 MB of model, voices and runtime on a school's link
   * — and the opposite is worse to see, because nobody notices a download that happens.
   *
   * ⚠️ `downloadHeavy` is replaced here because the list exists only in the CALL: what is measured is the argument, which
   * is the decision.
   */
  it('🔴 [Right] o arranque só baixa a voz neural do jogo que a pediu', async () => {
    const pedidos = [];
    vi.doMock('../app/js/platform/heavy.js', async (original) => ({
      ...(await original()),
      downloadHeavy: async ({ only: apenas }) => { pedidos.push(apenas); },
    }));
    vi.resetModules();
    try {
      const { createGame } = await import('../app/js/boot/create-game.js');
      createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { ...domFalso() } });
      createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { ...domFalso() }, uses: { neuralVoice: true } });
      const [semVoz, comVoz] = pedidos;
      expect(semVoz, 'a lista do arranque não foi pedida').toBeTruthy();
      expect(semVoz.some((id) => id.startsWith('voz:')), 'um jogo mudo baixou a voz neural que nunca vai usar').toBe(false);
      expect(comVoz.some((id) => id === 'voz:kokoro:modelo'), 'o jogo pediu a voz e o modelo dela não desce').toBe(true);
      expect(comVoz.some((id) => id === 'voz:runtime:onnx'), 'o modelo desce e quem o corre não').toBe(true);
      expect(semVoz.concat(comVoz).filter((id) => id.startsWith('reading:')),
        'nenhum destes dois jogos escuta, e um modelo de leitura desceu').toEqual([]);
    } finally {
      vi.doUnmock('../app/js/platform/heavy.js');
      vi.resetModules();
    }
  });

  /**
   * 🔴 THE LIBRAS PLAYER COMES DOWN ONLY WHILE DEAF MODE IS ON (ADR-0234, route A): 19.3 MiB of Unity build, asked for by the
   * person's stored choice and never by the game — so a child who left deaf mode on finds the player kept for her, and one who
   * never turned it on never pays for it.
   */
  it('🔴 [Right] the boot asks for the Libras player only when deaf mode is on', async () => {
    const pedidos = [];
    vi.doMock('../app/js/platform/heavy.js', async (original) => ({
      ...(await original()),
      downloadHeavy: async ({ only: apenas }) => { pedidos.push(apenas); },
    }));
    vi.resetModules();
    try {
      const { createGame } = await import('../app/js/boot/create-game.js');
      const { memoryBackend } = await import('../app/js/platform/storage.js');
      createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { ...domFalso(), storage: memoryBackend() } });
      createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(),
        host: { ...domFalso(), storage: memoryBackend([['incl_libras', '1']]) } });
      const [ouvinte, surda] = pedidos.map((ids) => ids.filter((id) => id.startsWith('libras:')));
      expect(ouvinte, 'deaf mode is off and the Libras player came down').toEqual([]);
      expect(surda, 'deaf mode is on and the Libras player did not come down').toHaveLength(4);
    } finally {
      vi.doUnmock('../app/js/platform/heavy.js');
      vi.resetModules();
    }
  });

  /**
   * 🔴 AND READING COMES DOWN IN THE CHILD'S LANGUAGE (ADR-0216 §3; ADR-0201 erratum). 📏 The three models add up to 850
   * MiB — pt 378, en 162, es 310 —, so this game listens cannot mean download all three. The language is not a new
   * question: it is the one the interface booted in (ADR-0031).
   */
  it('🔴 [Right] o jogo que ESCUTA baixa o modelo de uma língua só, e é a da interface', async () => {
    const pedidos = [];
    vi.doMock('../app/js/platform/heavy.js', async (original) => ({
      ...(await original()),
      downloadHeavy: async ({ only: apenas }) => { pedidos.push(apenas); },
    }));
    vi.resetModules();
    try {
      const { createGame } = await import('../app/js/boot/create-game.js');
      const { bcp47 } = await import('../app/js/core/i18n.js');
      const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { ...domFalso() }, uses: { reading: true } });
      const leitura = pedidos[0].filter((id) => id.startsWith('reading:'));
      expect(leitura.length, 'o jogo declarou que escuta e nenhum modelo de leitura desce').toBeGreaterThan(0);
      const linguas = new Set(leitura.map((id) => id.split(':')[1]));
      expect([...linguas], 'desceu mais de uma língua, ou a língua errada').toEqual([bcp47(motor.locale()).split('-')[0].toLowerCase()]);
    } finally {
      vi.doUnmock('../app/js/platform/heavy.js');
      vi.resetModules();
    }
  });

  it('[Right] um jogo SEM FASES não precisa inventar uma — `isNavigable` ausente vale `true`', async () => {
    // Finding 10 of the second consumer, turned default: the quiz had to declare itself paused to navigate its own menus.
    // The simplest case became the one that does not force a lie.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    expect(() => createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } })).not.toThrow();
  });
});

/*
 * D4-B5 · THE HEAVY FILES AND THE RECOGNISERS RECEIVE THE BROWSER FROM THE ROOT (ADR-0232 D4, issue #207).
 *
 * 🔴 The modules no longer reach `caches`, `fetch`, `crypto`, `navigator`, `AudioContext`, `performance` or `Worker`: each is
 * a REQUIRED port, and the root fills it from the HOST's window. What these cases measure is that filling — the host's own
 * doubles are what answer, so a root that went back to a global (or dropped a port) turns them red.
 */
describe('D4-B5 · the root lends the heavy files and the recognisers the host\'s browser (ADR-0232 D4)', () => {
  beforeAll(async () => { await import('../app/js/boot/create-game.js'); }, 30000);

  /** A host window with the browser the heavy files use, each piece a double that records who asked it. */
  const hostWith = (win, log) => ({
    ...win,
    caches: { open: async (name) => { log.opened.push(name); return { match: async (u) => (u === 'https://kept.example/x' ? { ok: true } : undefined) }; } },
    fetch: async (u) => { log.fetched.push(u); return { ok: false, status: 404 }; },
    crypto: { subtle: { digest: async (alg) => { log.hashed.push(alg); return new Uint8Array([0xab]).buffer; } } },
  });
  const newLog = () => ({ opened: [], fetched: [], hashed: [] });

  it('🔴 [Right] the download receives the host\'s cache, fetch, hash and page', async () => {
    const pedidos = [];
    vi.doMock('../app/js/platform/heavy.js', async (original) => ({
      ...(await original()),
      downloadHeavy: async (options) => { pedidos.push(options); return []; },
    }));
    vi.resetModules();
    try {
      const { createGame } = await import('../app/js/boot/create-game.js');
      const { doc, win } = domFalso();
      doc.baseURI = 'https://escola.example/jogo/';
      const log = newLog();
      const host = hostWith(win, log);
      createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win: host } });
      const [o] = pedidos;
      expect(o.cacheStorage, 'the download was not handed the host\'s Cache Storage').toBe(host.caches);
      expect(o.base, 'the delivery is not resolved against the host\'s page').toBe('https://escola.example/jogo/');
      await o.fetch('https://escola.example/jogo/heavy/a');
      expect(log.fetched, 'the download does not fetch through the host').toEqual(['https://escola.example/jogo/heavy/a']);
      expect(await o.digest(new ArrayBuffer(1)), 'the hash is not the host\'s crypto.subtle').toBe('ab');
      expect(log.hashed).toEqual(['SHA-256']);
    } finally {
      vi.doUnmock('../app/js/platform/heavy.js');
      vi.resetModules();
    }
  });

  it('🎯 [Zero] a host with no cache, no fetch and no crypto (an insecure context) lends none — the global is never taken instead', async () => {
    const pedidos = [];
    vi.doMock('../app/js/platform/heavy.js', async (original) => ({
      ...(await original()),
      downloadHeavy: async (options) => { pedidos.push(options); return []; },
    }));
    vi.resetModules();
    try {
      const { createGame } = await import('../app/js/boot/create-game.js');
      createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { ...domFalso() } });
      // 📌 node HAS a global `fetch` and `crypto.subtle`: a root that fell back to them would hand them over here
      expect(pedidos[0]).toMatchObject({ cacheStorage: undefined, fetch: undefined, digest: null });
    } finally {
      vi.doUnmock('../app/js/platform/heavy.js');
      vi.resetModules();
    }
  });

  it('🔴 [Right] the three camera controls ask the HOST\'s checked cache whether a file is there', async () => {
    const recebidos = {};
    const dublar = (nome, modulo) => vi.doMock(`../app/js/ui/${modulo}.js`, async (original) => ({
      ...(await original()),
      [nome]: (deps) => { recebidos[modulo] = deps; return { apply: async () => {} }; },
    }));
    dublar('createEyeControl', 'eye-control');
    dublar('createFaceControl', 'face-control');
    dublar('createHandControl', 'hand-control');
    vi.resetModules();
    try {
      const { createGame } = await import('../app/js/boot/create-game.js');
      const { CACHE_HEAVY } = await import('../app/js/platform/heavy.js');
      const { doc, win } = domFalso();
      const log = newLog();
      const host = { ...hostWith(win, log), navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } } };
      createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win: host }, downloadHeavy: false });
      const { hasFile } = recebidos['eye-control'];
      expect(await hasFile('https://kept.example/x'), 'a file the host\'s cache holds was answered missing').toBe(true);
      expect(await hasFile('https://missing.example/y')).toBe(false);
      expect(log.opened, 'another cache than the checked one was asked').toEqual([CACHE_HEAVY, CACHE_HEAVY]);
      expect(recebidos['face-control'].hasFile, 'the face asks another cache than the eyes').toBe(hasFile);
      expect(recebidos['hand-control'].hasFile, 'the hands ask another cache than the eyes').toBe(hasFile);
    } finally {
      for (const m of ['eye-control', 'face-control', 'hand-control']) vi.doUnmock(`../app/js/ui/${m}.js`);
      vi.resetModules();
    }
  });

  it('🔴 [Right] the voice control receives the host\'s cache, microphone and audio context — and ONE bundle loader', async () => {
    let recebido = null;
    vi.doMock('../app/js/ui/voice-control.js', async (original) => ({
      ...(await original()),
      createVoiceControl: (deps) => { recebido = deps; return { apply: async () => {}, refreshGrammar: () => {}, languageChanged: async () => {} }; },
    }));
    vi.resetModules();
    try {
      const { createGame } = await import('../app/js/boot/create-game.js');
      const { CACHE_HEAVY } = await import('../app/js/platform/heavy.js');
      const { doc, win } = domFalso();
      const log = newLog();
      const microfones = [];
      class HostAudioContext {}
      const host = {
        ...hostWith(win, log), AudioContext: HostAudioContext,
        navigator: { mediaDevices: { getUserMedia: async (c) => { microfones.push(c); return { getTracks: () => [] }; } } },
      };
      doc.defaultView = host; // the eye control, built too for a host with a camera, reads the camera through its document
      createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win: host }, downloadHeavy: false });
      expect(recebido, 'the voice control was not built for a host with a microphone').toBeTruthy();
      expect(await recebido.hasFile('https://kept.example/x'), 'the recogniser does not ask the host\'s checked cache').toBe(true);
      expect(log.opened).toEqual([CACHE_HEAVY]);
      await recebido.getUserMedia({ audio: true });
      expect(microfones, 'the listener would open another microphone than the host\'s').toEqual([{ audio: true }]);
      expect(recebido.createContext(), 'the listener would build another audio context than the host\'s').toBeInstanceOf(HostAudioContext);
      // 📌 ONE loader for the root: the same address asked twice is one load (the memo that left `platform/vosk-runtime`)
      const endereco = 'file:///no-such-delivery/heavy/vosk.js';
      const primeiro = recebido.loadBundle(endereco);
      expect(recebido.loadBundle(endereco), 'the bundle would be put in the page twice').toBe(primeiro);
      await primeiro.catch(() => {});
    } finally {
      vi.doUnmock('../app/js/ui/voice-control.js');
      vi.resetModules();
    }
  });

  /** Waits for `ready()` over real ticks: the reading loads its modules lazily, and each `import()` is its own turn. */
  const until = async (ready) => { for (let i = 0; i < 300 && !ready(); i++) await new Promise((r) => { setTimeout(r, 10); }); };

  /*
   * 🔴 THE THREAD IS OPENED BY THE HOST'S `Worker` (ADR-0232 D4). The literal `new Worker(new URL(…, import.meta.url))` lives in
   * the root because a bundler only emits the worker's file for that form; the `Worker` it names is a local holding the host's.
   * Node has no global `Worker`: a root that reached for one would throw here instead of opening this double.
   */
  it('🔴 [Right] a reading opens its thread with the host\'s Worker, and hears through the host\'s microphone, audio and clock', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    doc.baseURI = 'https://escola.example/jogo/';
    const abertas = [], microfones = [], contextos = [], parados = [];
    class HostWorker {
      constructor(url, options) { abertas.push([String(url), options]); this.onmessage = null; this.onerror = null; }
      postMessage() {} terminate() {}
    }
    let processador = null;
    class HostAudioContext {
      constructor(options) { contextos.push(options); this.sampleRate = 16000; this.destination = {}; }
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      createScriptProcessor() { processador = { onaudioprocess: null, connect() {}, disconnect() {} }; return processador; }
      close() {}
    }
    let relogio = 0;
    const host = {
      ...win, Worker: HostWorker, AudioContext: HostAudioContext, removeEventListener: () => {},
      // every read of the host's clock jumps 50 s: the first block of sound is already past the 30 s ceiling
      performance: { now: () => (relogio += 50_000) },
      navigator: { mediaDevices: { getUserMedia: async (c) => { microfones.push(c); return { getTracks: () => [{ stop: () => parados.push('track') }] }; } } },
    };
    doc.defaultView = host;
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win: host }, downloadHeavy: false, uses: { reading: true } });
    void motor.reading.listen().catch(() => {});
    await until(() => abertas.length && processador);
    expect(abertas, 'the thread was not opened by the host\'s Worker, as a module, on the worker\'s file')
      .toEqual([[expect.stringMatching(/reading-worker/), { type: 'module' }]]);
    expect(microfones, 'the reading did not open the host\'s microphone').toEqual([{ audio: true }]);
    expect(contextos, 'the reading did not build the host\'s audio context at the model\'s rate').toEqual([{ sampleRate: 16000 }]);
    processador.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(4) } });
    expect(parados, 'the reading was not timed by the host\'s clock: its ceiling never fell').toEqual(['track']);
    motor.dispose();
  });

  it('🔴 [Right] where the host has no Worker, the model on this thread fetches through the host\'s fetch — and `problems` says so', async () => {
    let recebido = null;
    vi.doMock('../app/js/platform/reading-runtime.js', async (original) => ({
      ...(await original()),
      loadReadingRuntime: async (d) => { recebido = d; return { transcribe: async () => '' }; },
    }));
    vi.resetModules();
    try {
      const { createGame } = await import('../app/js/boot/create-game.js');
      const { doc, win } = domFalso();
      doc.baseURI = 'https://escola.example/jogo/';
      const log = newLog();
      const host = { ...hostWith(win, log), removeEventListener: () => {}, navigator: { mediaDevices: { getUserMedia: async () => { throw new Error('no microphone in this case'); } } } };
      doc.defaultView = host;
      const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win: host }, downloadHeavy: false, uses: { reading: true } });
      await motor.reading.listen().catch(() => {});
      await until(() => recebido);
      expect(recebido, 'the runtime was not opened on this thread').toMatchObject({ base: 'https://escola.example/jogo/' });
      await recebido.fetch('https://escola.example/jogo/heavy/modelo.onnx');
      expect(log.fetched, 'the model is fetched by another fetch than the host\'s').toEqual(['https://escola.example/jogo/heavy/modelo.onnx']);
      expect(motor.problems.join(' ')).toMatch(/has no `Worker`/);
      motor.dispose();
    } finally {
      vi.doUnmock('../app/js/platform/reading-runtime.js');
      vi.resetModules();
    }
  });
});

/*
 * MOUNT AND UNMOUNT — one composition root, several cartridges (ADR-0142).
 *
 * ⚠️ The deciding case is the FIRST: without it, `mount()` would be a function that swaps a field while the diagnosis
 * went on talking about the game that booted — exactly the debt ADR-0139 §5 recorded and this record came to pay. A test
 * that only checked that `mount` does not throw would prove none of that.
 */
describe('mount / unmount — uma raiz, vários cartuchos (ADR-0142)', () => {
  // ⚠️ THE DOUBLE RETURNS AN ELEMENT FOR ANY SELECTOR, so a world that does not exist exists only if we tell the double —
  // that is what `ausentes` is for. Without it these cases would go green without ever exercising the line they claim
  // to, the most expensive way for a test to lie.
  const SELETOR_AUSENTE = '#mundo-que-nao-existe';
  const semDom = () => domFalso({ ausentes: [SELETOR_AUSENTE] });
  const semMundo = () => ({
    ...declaracaoValida(),
    world: () => ({ kind: 'element', selector: SELETOR_AUSENTE }),
  });

  it('🎯 [Right] `problems` passa a descrever o cartucho MONTADO, e não o que arrancou', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = semDom();
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: semMundo(), host: { doc, win } });
    expect(motor.problems.join(' '), 'o arranque devia acusar o mundo que não existe').toMatch(/declared world/);

    motor.mount(declaracaoValida(), { accommodations: SEM_ASSUNTO });
    expect(motor.problems.join(' '), 'o diagnóstico ficou a falar do cartucho anterior').not.toMatch(/declared world/);
  });

  it('⚠️ [Right] e o PAR: montar um cartucho sem mundo ACUSA — senão «sumiu» passaria por nunca olhar', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = semDom();
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    expect(motor.problems.join(' ')).not.toMatch(/declared world/);

    motor.mount(semMundo(), { accommodations: SEM_ASSUNTO });
    expect(motor.problems.join(' '), 'montou um mundo inexistente e não disse nada').toMatch(/declared world/);
  });

  it('🔴 [Zero] um cartucho que NÃO RESPONDE às suas acomodações é RECUSADO no arranque e no mount (ADR-0153)', async () => {
    // «Gênero não precisa responder todas as acomodações, mas sim o cartucho, obrigatoriamente.» A refusal, not
    // `problems`: without the answer the engine does not know which rows to mount, and mounting all is the wheelchair in
    // chess.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    expect(() => createGame({ declaration: declaracaoValida(), host: { doc, win } })).toThrow(/ADR-0153/);
    // ONE missing key too — the silence of a single one is the same defect
    const { caneSpacing: _fora, ...incompleta } = SEM_ASSUNTO;
    expect(() => createGame({ accommodations: incompleta, declaration: declaracaoValida(), host: { doc, win } }))
      .toThrow(/caneSpacing is not answered/);
    // 📌 THE PAIR: the complete answer passes — otherwise a check that always refused would stay green above
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    // and mount() refuses by the same rule: a SECOND cartridge cannot come in without answering
    expect(() => motor.mount(declaracaoValida(), {})).toThrow(/ADR-0153/);
    // and with NO hooks at all — the type allows it — the refusal is the engine's sentence, not a TypeError on `hooks.preset`
    expect(() => motor.mount(declaracaoValida())).toThrow(/ADR-0153/);
  });

  it('🔴 [Zero] `mount` LANÇA numa declaração malformada — contrato é pré-condição, não diagnóstico', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    expect(() => motor.mount({ ...declaracaoValida(), topology: undefined }, { accommodations: SEM_ASSUNTO })).toThrow(/malformada/);
    // ⚠️ AND THE GOOD CARTRIDGE STAYS MOUNTED: a refusal cannot leave the root halfway.
    expect(motor.problems.join(' ')).not.toMatch(/declared world/);
  });

  it('[Right] `declaration` devolve o cartucho corrente', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const primeira = declaracaoValida();
    const segunda = declaracaoValida();
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: primeira, host: { doc, win } });
    expect(motor.declaration).toBe(primeira);
    motor.mount(segunda, { accommodations: SEM_ASSUNTO });
    expect(motor.declaration, 'a engine devolveu a declaração do cartucho anterior').toBe(segunda);
  });

  it('⚠️ [Zero] `unmount` esvazia a pilha de cenas, e cada `exit()` corre — é ele o teardown', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    const saiu = [];
    motor.scenes.push({ name: 'a', exit: () => saiu.push('a') });
    motor.scenes.push({ name: 'b', exit: () => saiu.push('b') });
    expect(motor.scenes.names()).toEqual(['a', 'b']);

    // ⚠️ `push` ALREADY RUNS THE LOWER SCENE'S `exit()` — measured here, not assumed: pushing `b` over `a` produces an
    // `'a'` before `unmount` exists. Measuring only the TAIL is what separates what this case asserts from what the stack
    // already did by itself.
    const antes = saiu.length;
    motor.unmount();
    expect(motor.scenes.names(), 'a pilha guardou cenas do cartucho anterior').toEqual([]);
    // THE ORDER IS TOP TO BOTTOM: `pop()` undoes what was pushed last, the only order in which a scene can count on what
    // it pushed beneath it still being there.
    expect(saiu.slice(antes), 'uma cena saiu sem correr o seu `exit()`').toEqual(['b', 'a']);
  });

  /*
   * THE TWO MAPPINGS FOLLOW THE CARTRIDGE: `mount()` brings the new one's, `unmount()` gives the engine's back.
   *
   * 📌 Read through the root's own handles (ADR-0232 D4): the keyboard through `keyboardConfig.factoryWithGame()`, the pad
   * through what a real poll leaves in `input.padCur` — the table is not published, and the behaviour is the better check
   * anyway: what the child's button does, not which object is in a cache.
   */
  const comTeclas = () => ({
    ...declaracaoValida(),
    keyboardMapping: () => ({ up: ['KeyZ'] }),
    padMapping: () => ({ up: 99 }),
  });

  it('🎯 [Right] `unmount` devolve o TECLADO à fábrica da engine — o mapa do cartucho sai com ele', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();

    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: comTeclas(), host: { doc, win } });
    expect(motor.keyboardConfig.factoryWithGame().solo.up, 'o mapa do jogo nem chegou a valer').toEqual(['KeyZ']);

    motor.unmount();
    expect(motor.keyboardConfig.factoryWithGame().solo.up, 'as teclas do cartucho anterior ficaram a valer depois de ele sair')
      .toEqual(['KeyW', 'ArrowUp']);
    // and mounting another cartridge brings ITS default, through the same config the controls panel resets with
    motor.mount({ ...declaracaoValida(), keyboardMapping: () => ({ up: ['KeyY'] }) }, { accommodations: SEM_ASSUNTO });
    expect(motor.keyboardConfig.factoryWithGame().solo.up, '`mount` kept the previous game\'s keyboard').toEqual(['KeyY']);
  });

  /**
   * A root whose host has ONE standard pad, and the poll the root starts when the pad connects. The frame is captured
   * only across the `gamepadconnected` call, so no other animation frame of the boot is mistaken for the pad's.
   */
  function rootWithAPad(declaration) {
    return import('../app/js/boot/create-game.js').then(({ createGame }) => {
      const { doc, win, ouvintes } = domFalso();
      let pads = [];
      win.navigator = { getGamepads: () => pads };
      const motor = createGame({ accommodations: SEM_ASSUNTO, declaration, host: { doc, win } });
      let poll = null;
      win.requestAnimationFrame = (cb) => { poll ??= cb; return 1; };
      win.cancelAnimationFrame = () => {};
      /** Presses `buttons` on the pad and runs one poll; answers what the root recorded for pad 0. */
      const press = (...buttons) => {
        pads = [{ id: 'std', index: 0, mapping: 'standard', axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 24 }, (_, i) => ({ pressed: buttons.includes(i) })) }];
        if (!poll) for (const o of ouvintes.filter((x) => x.type === 'gamepadconnected')) o.fn();
        poll();
        return motor.input.padCur[0];
      };
      return { motor, press };
    });
  }

  it('🎯 [Right] e o PAD segue o cartucho: `mount` traz a tabela do novo, `unmount` a da engine — sem memória do anterior', async () => {
    const { GAMEPAD_STANDARD } = await import('../app/js/input/default-bindings.js');
    const { motor, press } = await rootWithAPad({ ...declaracaoValida(), padMapping: () => ({ action1: 20 }) });
    expect(press(20).action1, 'o botão que o jogo declarou não responde').toBe(true);

    motor.mount({ ...declaracaoValida(), padMapping: () => ({ action1: 21 }) }, { accommodations: SEM_ASSUNTO });
    // ⚠️ THE SAME QUESTION, `players:seat` — a table kept in cache would answer with the first game's button
    expect(press(20).action1, 'o pad ficou com a tabela do cartucho anterior em cache').toBe(false);
    expect(press(21).action1, 'a tabela do cartucho novo não chegou ao pad').toBe(true);

    motor.unmount();
    expect(press(21).action1, 'o botão do cartucho que saiu continuou a valer').toBe(false);
    expect(press(GAMEPAD_STANDARD.action1).action1, 'sem cartucho, a fábrica da engine').toBe(true);
  });

  it('🎯 [Right] a raiz arranca com o teclado que a criança GUARDOU, por cima do padrão do jogo', async () => {
    // 📌 The live map is loaded once, at boot, from the store the host lends: without that load a child who remapped plays
    // on the factory keys until she opens the panel — and the keyboard conductor presses what she no longer uses.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { memoryBackend } = await import('../app/js/platform/storage.js');
    const { doc, win } = domFalso();
    const storage = memoryBackend([['inclusionist.kbcontrols.v3', JSON.stringify({ solo: { action2: ['KeyM'] } })]]);
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: comTeclas(), host: { doc, win, storage } });
    expect(motor.keyboardConfig.kb().solo.action2, 'the root booted without what the child stored').toEqual(['KeyM']);
    expect(motor.keyboardConfig.kb().solo.up, 'and without the game\'s default under it').toEqual(['KeyZ']);
    expect(motor.keyboard.kbFor(0).action2, 'the runtime reads another map than the config').toEqual(['KeyM']);
  });

  it('🔴 [Cross-check] duas raízes na mesma página, dois teclados e duas memórias de entrada (ADR-0142, ADR-0232 D4)', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const a = createGame({ accommodations: SEM_ASSUNTO, declaration: comTeclas(), host: domFalso() });
    const b = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: domFalso() });
    expect(b.keyboardConfig.factoryWithGame().solo.up, 'a segunda raiz herdou o mapa do jogo da primeira').toEqual(['KeyW', 'ArrowUp']);
    expect(a.keyboardConfig.factoryWithGame().solo.up, 'e a primeira perdeu o seu para a segunda').toEqual(['KeyZ']);
    a.input.markKey('KeyA', 'olhos');
    expect(b.input.keys.has('KeyA'), 'a tecla segurada numa raiz apareceu na outra').toBe(false);
  });
});
describe('the shape of a line of `problems` (ADR-0169, issue #163)', () => {
  it('🔴 [Right] every line is in English and says what it costs the child', async () => {
    // 📏 Measured on 2026-09-13: of the lines this root pushed, the older were Portuguese («sem sítio para o menu de
    // pausa…») and the newer English; several named the fix and not the child. A host that lacks almost everything
    // gives the most lines at once: no markup, no bar, two seats with no pause actor, no preset, a world not in the page.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso({ comMarcacao: false, ausentes: ['#title-icons', '#missing-world'] });
    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: { ...declaracaoValida(), world: () => ({ kind: 'element', selector: '#missing-world' }) },
      host: { doc, win }, players: [{ ctrl: 'kb' }, { ctrl: 'kb' }],
    });
    const linhas = motor.problems;
    expect(linhas.length, 'too few lines — the case would measure little').toBeGreaterThanOrEqual(5);
    // Portuguese by its accents and its words that are not English words too («no», «do», «as» are left out)
    const PORTUGUES = /[áàâãéêíóôõúüç]|\b(de|da|das|dos|para|com|sem|em|na|nos|nas|um|uma|ou|que|ao|aos|pelo|pela|seu|sua|mais|não)\b/i;
    for (const l of linhas) {
      expect(PORTUGUES.test(l), `a line in Portuguese: «${l.slice(0, 80)}»`).toBe(false);
      expect(l, `a line that does not say what the child loses: «${l.slice(0, 80)}»`).toMatch(/\bchild\b/);
    }
  });
  // MUTATIONS CHECKED (2026-09-13): the neural-voice line back in Portuguese 🔴 · «child» taken out of the pause-actor
  // line 🔴. ⚠️ Browser-only lines (stylesheet, bar, resolution, floor, storage, flashes, dictionaries) are not reached by
  // this node host; their Portuguese is still counted by `engine-i18n`, their «child» by review.
});

// ADR-0232 D4-B6 — the root's CRT draws on the INJECTED document's region.
describe('the root\'s CRT and L→Q enhancement live in the injected document (ADR-0232 D4)', () => {
  beforeAll(async () => { await import('../app/js/boot/create-game.js'); }, 30000);

  it('🔴 [Right] the stored scanlines land on the injected `#game-region` at boot — this project has no global document', async () => {
    // `render/crt` used to look the region up with `core/dom-query`'s `$`, over the GLOBAL document: under an injected
    // document (an iframe, an editor, this project) the CRT drew nowhere, and the panel's «Scanlines: on» was a lie.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const regiao = regiaoFalsa();
    const { doc, win } = domFalso({ map: { '#game-region': regiao } });
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    expect(typeof globalThis.document, 'the premise: no global document here').toBe('undefined');
    expect(regiao.classList.contains('crt-scan-1'), 'the factory scanlines did not reach the injected region').toBe(true);
    expect(motor.crt.cfg.scan).toBe(1);
    expect(typeof motor.lq.filter, 'the enhancement handle is missing').toBe('function');
  });
});