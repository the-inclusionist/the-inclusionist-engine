// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of input/touch-bindings — the gesture→key TRANSLATION and the d-pad's GEOMETRY, with no DOM (node project).
// ZOMBIES + Right-BICEP.
//
// What this file protects is a useful lie: the on-screen button pretends to be the keyboard. `doTouch('jump',true)` does
// not push the character — it presses the virtual controller, which holds the physical code mapped to "jump" in the SAME
// `keys` keydown feeds and raises the edges on the players who have that code. Without these cases, the only way to
// check it would be on a tablet.
//
// ⚠️ THE MOST IMPORTANT BLOCK HERE is "the three copies of the table": the action→edge rule has to give the same answer
// on the three input paths (keyboard, gamepad, touch). If it goes red, one path has drifted from `input/edges`.
//
// The listener wiring (pointer capture, preventDefault, the arrows' classes) is in touch-bindings.browser.test.js and is
// NOT repeated here.
import { describe, it, expect } from 'vitest';
import { TOUCH_ACTS } from '../app/js/input/touch.js';
import {
  codeForAction, touchEdgesFor, decideTouch, initTouchBindings,
  crossDirsAt, stickDirsAt, stickKnobOffset, wantsForcedTouch,
  TOUCH_EDGE_BY_ACTION, CROSS_DEAD_FRACTION, START_TAP_MS,
} from '../app/js/input/touch-bindings.js';
import { edgesFor } from '../app/js/input/keydown.js';

/* ===================== fixtures (factory schemes of input/keyboard.ts) ===================== */

const SOLO = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], action1: ['KeyU'], action2: ['KeyJ', 'Space'], action4: ['KeyI'], action3: ['KeyK'] };
const P2B = { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], action1: ['Numpad8'], action2: ['Numpad5'], action4: ['Numpad9'], action3: ['Numpad6'] };

const mkPlayer = (ctrl, extra = {}) => ({ ctrl, easy: false, jumpEdge: false, runEdge: false, leftEdge: false, rightEdge: false, swapEdge: false, specialEdge: false, ...extra });

/** A world. Default: solo, factory scheme, nothing held. */
const snap = (over = {}) => ({ controls: SOLO, players: [mkPlayer(SOLO)], heldKeys: new Set(), ...over });

/* ===================== 1. codeForAction — WHICH key the button pretends to press ===================== */

describe('codeForAction — a ação vira a 1ª tecla do Jogador 1', () => {
  it('[Right] cada ação devolve o PRIMEIRO código do esquema, não a lista', () => {
    expect(codeForAction('action2', SOLO)).toBe('KeyJ');   // and not 'Space', which is the 2nd alias
    expect(codeForAction('left', SOLO)).toBe('KeyA');
    expect(codeForAction('action1', SOLO)).toBe('KeyU');
  });
  it('[Right] remapear o teclado remapeia o toque junto (é a MESMA tabela, não uma cópia)', () => {
    expect(codeForAction('action2', { ...SOLO, action2: ['KeyZ', 'KeyJ'] })).toBe('KeyZ');
  });
  it('[Zero/Boundary] ação inexistente, lista vazia, ação vazia e ação indefinida caem todas em null', () => {
    expect(codeForAction('voar', SOLO)).toBeNull();
    expect(codeForAction('action2', { ...SOLO, action2: [] })).toBeNull();
    expect(codeForAction('', SOLO)).toBeNull();
    expect(codeForAction(undefined, SOLO)).toBeNull(); // an empty touchMap slot arrives like this
  });
});

/* ===================== 2. touchEdgesFor — ON WHOM the edge rises ===================== */

describe('touchEdgesFor — a borda sobe em quem tem AQUELE código no PRÓPRIO esquema', () => {
  it('[Right] solo: a ação levanta exatamente uma borda, no jogador 0', () => {
    expect(touchEdgesFor('action2', 'KeyJ', [mkPlayer(SOLO)])).toEqual([{ playerIndex: 0, edge: 'jumpEdge' }]);
    expect(touchEdgesFor('action4', 'KeyI', [mkPlayer(SOLO)])).toEqual([{ playerIndex: 0, edge: 'swapEdge' }]);
    expect(touchEdgesFor('action3', 'KeyK', [mkPlayer(SOLO)])).toEqual([{ playerIndex: 0, edge: 'specialEdge' }]);
  });

  it('[CrossCheck] jogador cujo esquema NÃO contém o código não recebe borda nenhuma', () => {
    // multi-screen: touch is always P1's, and P2 has another scheme. 'KeyJ' is not theirs.
    const out = touchEdgesFor('action2', 'KeyJ', [mkPlayer(SOLO), mkPlayer(P2B)]);
    expect(out).toEqual([{ playerIndex: 0, edge: 'jumpEdge' }]);
  });

  it('[Right] dois jogadores que compartilham o código recebem a borda os DOIS, na ordem do array', () => {
    const out = touchEdgesFor('left', 'ArrowLeft', [mkPlayer(SOLO), mkPlayer(P2B)]);
    expect(out).toEqual([{ playerIndex: 0, edge: 'leftEdge' }, { playerIndex: 1, edge: 'leftEdge' }]);
  });

  it('[Zero] jogador sem esquema (tela ainda não ativada) é pulado, sem estourar', () => {
    expect(touchEdgesFor('action2', 'KeyJ', [{ ctrl: null }, mkPlayer(SOLO)])).toEqual([{ playerIndex: 1, edge: 'jumpEdge' }]);
    expect(touchEdgesFor('action2', 'KeyJ', [])).toEqual([]);
  });

  it('[CrossCheck] a AÇÃO manda, não o código: `run` com o código do pulo não levanta jumpEdge', () => {
    // the (action, code) pair always arrives consistent from codeForAction; if someone unpairs them, nothing rises.
    expect(touchEdgesFor('action1', 'KeyJ', [mkPlayer(SOLO)])).toEqual([]);
  });

  it('[Zero] ação fora da tabela das seis bordas não levanta nada (up/down andam por `keys`, sem borda)', () => {
    expect(touchEdgesFor('up', 'KeyW', [mkPlayer(SOLO)])).toEqual([]);
    expect(touchEdgesFor('down', 'KeyS', [mkPlayer(SOLO)])).toEqual([]);
    expect(TOUCH_EDGE_BY_ACTION.map(([a]) => a)).toEqual(['action2', 'action1', 'left', 'right', 'action4', 'action3']);
  });

  it('[Zero] esquema sem a ação vira no-op (o original estouraria em TypeError — desvio declarado)', () => {
    const semPulo = { ...SOLO }; delete semPulo.action2;
    expect(touchEdgesFor('action2', 'KeyJ', [mkPlayer(semPulo)])).toEqual([]);
  });
});

/* ===================== 3. ⚠️ THE THREE COPIES OF THE TABLE — the Easy-mode divergence ===================== */

describe('modo Fácil e `run`: os três caminhos de entrada têm de CONCORDAR', () => {
  // Context (measured, not assumed): `runEdge` is NOT the running speed — in the platform game it is the wall CLING and
  // RELEASE trigger. The action→edge rule and the Easy guard live in `input/edges.ts` (`EDGE_BY_ACTION`, `edgeAllowed`),
  // and the three input paths apply it: `input/keydown.ts`, `input/gamepad.ts` and `input/touch-bindings.ts` (HERE).
  // For a while only touch lacked the guard: in Easy mode climbing did not exist on the keyboard or the gamepad, and
  // existed on the on-screen button — that is, the child with a motor difficulty, on the tablet, played a different game
  // from the same child on the keyboard. These cases exist so it does not come back.
  // The `edgesFor` below is the REAL one, imported from keydown.js — comparing with a reimplementation here would prove
  // nothing, because the two copies could drift together.
  const easy = [mkPlayer(SOLO, { easy: true })];

  it('[toque] com `easy`, o botão da tela NÃO levanta runEdge', () => {
    expect(touchEdgesFor('action1', 'KeyU', easy)).toEqual([]);
  });

  it('[teclado] com `easy`, o keydown NÃO levanta runEdge — a guarda "Fácil: sem correr"', () => {
    const s = { players: [{ i: 0, ctrl: SOLO, easy: true }], numPlayers: 1 };
    expect(edgesFor('KeyU', s)).toEqual([]);
  });

  it('[Invariant] com `easy`, toque e teclado dão a MESMA resposta para `run`', () => {
    const s = { players: [{ i: 0, ctrl: SOLO, easy: true }], numPlayers: 1 };
    expect(touchEdgesFor('action1', 'KeyU', easy)).toEqual(edgesFor('KeyU', s));
  });

  it('[Inverse] SEM `easy`, os dois levantam runEdge — prova que a guarda é o `easy`, não o esquema', () => {
    const normal = [mkPlayer(SOLO, { easy: false })];
    const s = { players: [{ i: 0, ctrl: SOLO, easy: false }], numPlayers: 1 };
    expect(touchEdgesFor('action1', 'KeyU', normal)).toEqual([{ playerIndex: 0, edge: 'runEdge' }]);
    expect(edgesFor('KeyU', s)).toEqual([{ playerIndex: 0, edge: 'runEdge' }]);
  });

  it('[Invariant] fora do `run`, as duas tabelas concordam mesmo com `easy` ligado', () => {
    const s = { players: [{ i: 0, ctrl: SOLO, easy: true }], numPlayers: 1 };
    expect(touchEdgesFor('action2', 'KeyJ', easy)).toEqual([{ playerIndex: 0, edge: 'jumpEdge' }]);
    expect(edgesFor('KeyJ', s)).toEqual([{ playerIndex: 0, edge: 'jumpEdge' }]);
  });
});

/* ===================== 4. decideTouch — o despacho ===================== */

describe('decideTouch — apertar, soltar e o caso especial `pause`', () => {
  it('[Right] apertar uma ação mapeada: devolve a POSIÇÃO e traz as bordas', () => {
    // 🔴 THE CURRENCY OF THIS DECISION IS THE POSITION AND NOT THE KEY (ADR-0223): touch presses the virtual controller,
    // which is the single door, and the key is an EFFECT of the press, written in one place only.
    const d = decideTouch('action2', true, snap());
    expect(d).toEqual({ kind: 'press', action: 'action2', addKey: true, edges: [{ playerIndex: 0, edge: 'jumpEdge' }], hideTips: true });
  });

  it('[Right] soltar devolve a posição — NÃO abaixa borda (quem zera bordas é a física)', () => {
    expect(decideTouch('action2', false, snap())).toEqual({ kind: 'release', action: 'action2' });
  });

  it('[Right] `pause` é o único que não vira tecla: apertar pausa, SOLTAR não faz nada', () => {
    expect(decideTouch('start', true, snap())).toEqual({ kind: 'pause' });
    expect(decideTouch('start', false, snap())).toEqual({ kind: 'noop' }); // releasing START does not unpause
  });

  it('[Boundary] tecla JÁ segurada: sem re-injeção e sem borda — é BORDA, não estado', () => {
    const d = decideTouch('action2', true, snap({ heldKeys: new Set(['KeyJ']) }));
    expect(d.kind).toBe('press');
    expect(d.addKey).toBe(false);
    expect(d.edges).toEqual([]);
  });

  it('[Right] ...mas `hideTips` roda mesmo com a tecla já segurada (verbatim do original)', () => {
    expect(decideTouch('action2', true, snap({ heldKeys: new Set(['KeyJ']) })).hideTips).toBe(true);
  });

  it('[CrossCheck] `hideTips` é só do pulo — nenhuma outra ação o dispara', () => {
    for (const a of ['action1', 'left', 'right', 'action4', 'action3', 'up', 'down']) {
      expect(decideTouch(a, true, snap()).hideTips).toBe(false);
    }
  });

  it('[Zero] slot vazio ou string que não é posição: noop nos dois sentidos', () => {
    expect(decideTouch(undefined, true, snap())).toEqual({ kind: 'noop' });
    expect(decideTouch(undefined, false, snap())).toEqual({ kind: 'noop' });
    expect(decideTouch('acao99', true, snap()), 'uma string que não é posição não aperta nada').toEqual({ kind: 'noop' });
  });

  it('🔴 [Boundary] uma posição SEM TECLA mapeada chega na mesma ao cartucho', () => {
    // 🔴 A position the cartridge declared has to reach it even if the child has no key for it: the map belongs to the
    // GAME and not to the keyboard (ADR-0111), and answering `noop` would put the silence on the wrong side of the
    // boundary. ⚠️ With no key there is no edge to raise — `addKey` is false —, but the POSITION travels.
    const semTecla = snap({ controls: { ...SOLO, action2: [] } });
    expect(decideTouch('action2', true, semTecla))
      .toEqual({ kind: 'press', action: 'action2', addKey: false, edges: [], hideTips: true });
    expect(decideTouch('action2', false, semTecla)).toEqual({ kind: 'release', action: 'action2' });
  });

  it('[Right] `up`/`down` viram posição sem borda: sobem escada por `keys`, não por flag', () => {
    expect(decideTouch('up', true, snap())).toEqual({ kind: 'press', action: 'up', addKey: true, edges: [], hideTips: false });
  });
});

/* ===================== 5. geometria da CRUZ (pura) ===================== */

describe('crossDirsAt — posição do dedo → direções, com miolo neutro', () => {
  // 200×200 at the origin: centre at (100,100), dead zone = 200 × 0.18 = 36 px on each axis.
  const R = { left: 0, top: 0, width: 200, height: 200 };
  const DEAD = 200 * CROSS_DEAD_FRACTION; // 36

  it('[Zero] o centro exato não liga NADA — é para isso que a zona morta existe', () => {
    expect(crossDirsAt(100, 100, R)).toEqual({ left: false, right: false, up: false, down: false });
  });

  it('[Right] cada braço liga a SUA direção, e só ela', () => {
    expect(crossDirsAt(10, 100, R)).toEqual({ left: true, right: false, up: false, down: false });
    expect(crossDirsAt(190, 100, R)).toEqual({ left: false, right: true, up: false, down: false });
    expect(crossDirsAt(100, 10, R)).toEqual({ left: false, right: false, up: true, down: false });
    expect(crossDirsAt(100, 190, R)).toEqual({ left: false, right: false, up: false, down: true });
  });

  it('[Right] as diagonais ligam DUAS — é o que faz a cruz valer como D-pad de 8 setores', () => {
    expect(crossDirsAt(10, 10, R)).toMatchObject({ left: true, up: true, right: false, down: false });
    expect(crossDirsAt(190, 190, R)).toMatchObject({ right: true, down: true, left: false, up: false });
    expect(crossDirsAt(190, 10, R)).toMatchObject({ right: true, up: true });
    expect(crossDirsAt(10, 190, R)).toMatchObject({ left: true, down: true });
  });

  it('[Boundary] a borda da zona morta é EXCLUSIVA: exatamente ±36 ainda é miolo; 1 px além liga', () => {
    expect(crossDirsAt(100 - DEAD, 100, R).left).toBe(false);     // = -36 → strictly greater than -36? no
    expect(crossDirsAt(100 - DEAD - 1, 100, R).left).toBe(true);
    expect(crossDirsAt(100 + DEAD, 100, R).right).toBe(false);
    expect(crossDirsAt(100 + DEAD + 1, 100, R).right).toBe(true);
    expect(crossDirsAt(100, 100 - DEAD, R).up).toBe(false);
    expect(crossDirsAt(100, 100 - DEAD - 1, R).up).toBe(true);
    expect(crossDirsAt(100, 100 + DEAD, R).down).toBe(false);
    expect(crossDirsAt(100, 100 + DEAD + 1, R).down).toBe(true);
  });

  it('[Right] o retângulo NÃO está na origem: a conta é relativa ao centro dele, não à tela', () => {
    const off = { left: 500, top: 300, width: 200, height: 200 }; // centro em (600,400)
    expect(crossDirsAt(600, 400, off)).toEqual({ left: false, right: false, up: false, down: false });
    expect(crossDirsAt(510, 400, off)).toMatchObject({ left: true, right: false });
    expect(crossDirsAt(600, 310, off)).toMatchObject({ up: true, down: false });
  });

  it('[⚠️ verbatim] a zona morta VERTICAL também sai da LARGURA — a altura nunca entra na conta', () => {
    // A flattened cross (400 wide, 100 high): vertical dead centre = 72 px, that is, MORE than half the height → no point
    // inside the element turns `up`/`down` on. Current behaviour; see the header.
    const flat = { left: 0, top: 0, width: 400, height: 100 }; // centro (200,50); dead = 72
    expect(crossDirsAt(200, 0, flat).up).toBe(false);
    expect(crossDirsAt(200, 100, flat).down).toBe(false);
    expect(crossDirsAt(0, 50, flat).left).toBe(true); // no eixo horizontal continua funcionando
  });

  it('[Zero] elemento de largura 0: zona morta 0, e qualquer desvio liga (não trava, não estoura)', () => {
    const z = { left: 0, top: 0, width: 0, height: 0 };
    expect(crossDirsAt(0, 0, z)).toEqual({ left: false, right: false, up: false, down: false });
    expect(crossDirsAt(-1, 0, z).left).toBe(true);
  });
});

/* ===================== 6. geometria do ANALÓGICO (pura) ===================== */

describe('stickDirsAt / stickKnobOffset — a zona morta vem em px de input/touch.ts', () => {
  const R = { left: 0, top: 0, width: 120, height: 120 }; // centro (60,60)

  it('[Zero] centro não liga nada; a manopla fica no zero', () => {
    expect(stickDirsAt(60, 60, R, 12)).toEqual({ left: false, right: false, up: false, down: false });
    expect(stickKnobOffset(60, 60, R, 42)).toEqual({ x: 0, y: 0 });
  });

  it('[Boundary] a zona morta é EXCLUSIVA: exatamente ±dead ainda é miolo', () => {
    expect(stickDirsAt(60 - 12, 60, R, 12).left).toBe(false);
    expect(stickDirsAt(60 - 13, 60, R, 12).left).toBe(true);
    expect(stickDirsAt(60, 60 + 12, R, 12).down).toBe(false);
    expect(stickDirsAt(60, 60 + 13, R, 12).down).toBe(true);
  });

  it('[Right] a zona morta é PARÂMETRO: aumentá-la desliga uma direção que estava ligada', () => {
    expect(stickDirsAt(40, 60, R, 12).left).toBe(true);   // 20 px de desvio > 12
    expect(stickDirsAt(40, 60, R, 30).left).toBe(false);  // 20 px de desvio < 30
  });

  it('[Right] dentro do curso, a manopla segue o dedo exatamente', () => {
    expect(stickKnobOffset(90, 60, R, 42)).toEqual({ x: 30, y: 0 });
    expect(stickKnobOffset(60, 30, R, 42)).toEqual({ x: 0, y: -30 });
  });

  it('[Boundary/Invariant] passando do curso, ela PARA no raio e mantém o ÂNGULO (recorte radial)', () => {
    const o = stickKnobOffset(60 + 300, 60 + 300, R, 42); // diagonal bem além do curso
    expect(Math.hypot(o.x, o.y)).toBeCloseTo(42, 6);      // on the radius, not at 42×42 (which would be per-axis clipping)
    expect(o.x).toBeCloseTo(o.y, 6);                      // 45° angle preserved
    expect(o.x).toBeLessThan(42);                         // and so NO axis reaches 42 on its own
  });

  it('[Boundary] exatamente no raio não recorta (o recorte é `>`, não `>=`)', () => {
    expect(stickKnobOffset(60 + 42, 60, R, 42)).toEqual({ x: 42, y: 0 });
  });
});

/* ===================== 7. ?touch=1 ===================== */

describe('wantsForcedTouch', () => {
  it('[Right] só com o parâmetro de verdade — e em qualquer posição da query', () => {
    expect(wantsForcedTouch('?touch=1')).toBe(true);
    expect(wantsForcedTouch('?debug=true&touch=1')).toBe(true);
    expect(wantsForcedTouch('?touch=1&debug=true')).toBe(true);
  });
  it('[Zero/CrossCheck] vazio, outro valor, ou nome que só CONTÉM "touch" não contam', () => {
    expect(wantsForcedTouch('')).toBe(false);
    expect(wantsForcedTouch('?touch=0')).toBe(false);
    expect(wantsForcedTouch('?notouch=1')).toBe(false); // without the `?`/`&` in front, it does not match
  });
});

/* ===================== 8. the dispatch wired to the world (no DOM: only the ctx) ===================== */

/** A minimal ctx: `initTouchBindings` touches no DOM while `attach()` is not called. */
function makeCtx(over = {}) {
  const calls = {
    pause: 0, hideTips: 0, show: 0, defer: [], origens: new Map(), arestas: [],
    aoMenu: [],
  };
  const players = over.players || [mkPlayer(SOLO)];
  const heldKeys = over.heldKeys || new Set();
  const ctx = {
    $: () => null,
    win: { addEventListener: () => {} },
    getSearch: () => '',
    getControls: () => over.controls || SOLO,
    getPlayers: () => players,
    heldKeys,
    /*
     * 🔴 THE VIRTUAL CONTROLLER'S DOUBLE (ADR-0223). The pad no longer writes keys: it PRESSES a position, and what decides
     * what that means — going to the menu, holding the child's key, delivering the command — is the controller. The double
     * does the minimum the real controller does so these cases can keep asserting what they asserted: it resolves the
     * position in the scheme, holds the key with the stamp, and returns whether the press reached the GAME.
     *
     * 📌 `emMenu` belongs to the double and not to the pad: the question «há um menu aberto?» has ONE answer, the controller's.
     */
    press: (action, source) => {
      if (over.emMenu) { calls.aoMenu.push([action, source]); return false; }
      const code = (over.controls || SOLO)[action]?.[0];
      if (code) { heldKeys.add(code); calls.origens.set(code, source); }
      return true;
    },
    release: (action, source) => {
      void source;
      const code = (over.controls || SOLO)[action]?.[0];
      if (code) { heldKeys.delete(code); calls.origens.delete(code); }
    },
    // 📌 The double KEEPS THE LIST instead of counting: the question «que aparelho está a produzir as arestas» is PER
    // PLAYER, and a counter would not tell two presses by player 1 from one press on each seat.
    playerEdge: (jogador, origem) => { calls.arestas.push([jogador, origem]); },
    attractOnInput: () => false,
    showTouchControls: () => { calls.show++; },
    hideTips: () => { calls.hideTips++; },
    togglePause: () => { calls.pause++; },
    getTouchMap: () => ({ up: 'up', down: 'down', left: 'left', right: 'right', start: 'start', b0: 'action2', b1: 'action3', b2: 'action1', b3: 'action4' }),
    getStartAction: () => ('startAction' in over ? over.startAction : 'start'),
    getStickTravelPx: () => 42,
    getStickDeadPx: () => 12,
    defer: (fn, ms) => { calls.defer.push([fn, ms]); },
  };
  return { api: initTouchBindings(ctx), calls, players, heldKeys };
}

describe('doTouch — a decisão carimbada no mundo', () => {
  it('[Right] apertar injeta o código em `keys` E levanta a borda no jogador', () => {
    const { api, players, heldKeys } = makeCtx();
    api.doTouch('action2', true);
    expect(heldKeys.has('KeyJ')).toBe(true);
    expect(players[0].jumpEdge).toBe(true);
  });

  it('[Right] soltar APAGA o código de `keys` (senão o personagem anda para sempre)', () => {
    const { api, heldKeys } = makeCtx();
    api.doTouch('left', true);
    expect(heldKeys.has('KeyA')).toBe(true);
    api.doTouch('left', false);
    expect(heldKeys.has('KeyA')).toBe(false);
  });

  it('[Right] soltar NÃO abaixa a borda — ela é consumida e zerada pela física, não pelo dedo', () => {
    const { api, players } = makeCtx();
    api.doTouch('action2', true);
    api.doTouch('action2', false);
    expect(players[0].jumpEdge).toBe(true);
  });

  it('[CrossCheck] a borda sobe SÓ em quem tem o código: o J2 de outro esquema fica intacto', () => {
    const { api, players } = makeCtx({ players: [mkPlayer(SOLO), mkPlayer(P2B)] });
    api.doTouch('action2', true);
    expect(players[0].jumpEdge).toBe(true);
    expect(players[1].jumpEdge).toBe(false); // 'KeyJ' is not in their scheme
  });

  it('🎯 a aresta do TOQUE é por JOGADOR, e só chega a quem tem o código (ADR-0113 cláusula 4)', () => {
    // 🔴 The defect this pins: always marking player 0 would give the second seat the first one's latch — and the latch is
    // the setting of whoever cannot hold a key down, so the error falls exactly on whoever depends on it. Measured on
    // 2026-09-09: until this line, `playerEdge` had ZERO callers in production and the automaton answered `teclado` to
    // everyone.
    const { api, calls } = makeCtx({ players: [mkPlayer(SOLO), mkPlayer(P2B)] });
    api.doTouch('action2', true);
    expect(calls.arestas, 'a aresta do toque não chegou ao autómato, ou chegou ao assento errado').toEqual([[0, 'toque']]);

    // 🎯 AND THE SECOND SEAT, which is what separates «marca o jogador certo» from «marca sempre o 0»: with P2's controller
    // producing the code, the edge is THEIRS. Without this half, hard-coding `0` in the wiring would go unnoticed.
    const dois = makeCtx({ controls: P2B, players: [mkPlayer(SOLO), mkPlayer(P2B)] });
    dois.api.doTouch('action2', true);
    expect(dois.calls.arestas, 'o toque do segundo assento foi contado no primeiro').toEqual([[1, 'toque']]);
  });

  // 🔴 THE CONTROLLER'S ANSWER IS READ, AND THIS IS THE CASE THAT HOLDS IT (ADR-0223). The controller answers whether a
  // menu is open, and the pad STOPS: with a menu open the position moves the menu and nothing else happens on this side —
  // no edge saying the player pressed, no hint disappearing, no key held.
  // 📏 Measured by mutation: without reading the answer (or with the answer lying), a finger on the pad while the pause
  // card is open raises the jump edge — and the physics consumes it on the frame the game comes back.
  it('🔴 [CrossCheck] com um MENU aberto o toque para: sem aresta, sem dica, sem tecla — só o menu anda', () => {
    const { api, calls, players, heldKeys } = makeCtx({ emMenu: true });
    api.doTouch('action2', true);
    expect(calls.aoMenu, 'a posição não chegou ao menu').toEqual([['action2', 'toque']]);
    expect(calls.arestas, 'o menu levou a pressão e mesmo assim uma aresta subiu no jogador').toEqual([]);
    expect(players[0].jumpEdge, 'o jogo vai consumir um pulo que ninguém pediu').toBe(false);
    expect(calls.hideTips, 'as dicas sumiram por uma pressão que o jogo nunca ouviu').toBe(0);
    expect(heldKeys.size, 'ficou uma tecla segurada de uma pressão que foi para o menu').toBe(0);
  });

  it('[Boundary] apertar com a tecla já segurada não re-levanta a borda', () => {
    const { api, players, heldKeys } = makeCtx({ heldKeys: new Set(['KeyJ']) });
    api.doTouch('action2', true);
    players[0].jumpEdge = false;      // pretends the physics consumed the edge
    api.doTouch('action2', true);        // the same button again, without releasing
    expect(players[0].jumpEdge).toBe(false);
    expect(heldKeys.has('KeyJ')).toBe(true);
  });

  it('[Right] `pause` chama togglePause no apertar e ignora o soltar; não mexe em `keys`', () => {
    const { api, calls, heldKeys } = makeCtx();
    api.doTouch('start', true);
    api.doTouch('start', false);
    expect(calls.pause).toBe(1);
    expect(heldKeys.size).toBe(0);
  });

  it('[Zero] ação indefinida (slot vazio) não mexe em nada', () => {
    const { api, calls, heldKeys, players } = makeCtx();
    api.doTouch(undefined, true);
    expect(heldKeys.size).toBe(0);
    expect(calls.pause).toBe(0);
    expect(players[0].jumpEdge).toBe(false);
  });

  it('[Right] só o pulo chama hideTips', () => {
    const { api, calls } = makeCtx();
    api.doTouch('action1', true);
    expect(calls.hideTips).toBe(0);
    api.doTouch('action2', true);
    expect(calls.hideTips).toBe(1);
  });
});

describe('pressStart — o botão START', () => {
  it('[Right] com a ação padrão (`pause`), pausa direto e não agenda nada', () => {
    const { api, calls } = makeCtx();
    api.pressStart();
    expect(calls.pause).toBe(1);
    expect(calls.defer).toHaveLength(0);
  });

  it('[Right] com ação momentânea, aperta AGORA e agenda o soltar em START_TAP_MS', () => {
    const { api, calls, heldKeys } = makeCtx({ startAction: 'action2' });
    api.pressStart();
    expect(heldKeys.has('KeyJ')).toBe(true);
    expect(calls.defer).toHaveLength(1);
    expect(calls.defer[0][1]).toBe(START_TAP_MS);
    calls.defer[0][0]();                       // roda o timer
    expect(heldKeys.has('KeyJ')).toBe(false);  // and only then it releases
  });

  it('[Zero] ação indefinida (é o estado de HOJE no main.js — ver o relato): não pausa, não injeta tecla', () => {
    // Documents what happens when the start action arrives empty: nothing pauses and no key is injected. (The defect that
    // produced it was the call site's, not this module's.)
    const { api, calls, heldKeys } = makeCtx({ startAction: undefined });
    api.pressStart();
    expect(calls.pause).toBe(0);
    expect(heldKeys.size).toBe(0);
  });
});

describe('⚠️ TODA ação que o toque oferece é reconhecida pelo DESPACHO', () => {
  // THIS GATE WAS BORN FROM A REAL HOLE. During the `pause` -> `start` unification, `TOUCH_DEFAULT` and `TOUCH_ACTS` changed
  // together and `decideTouch` kept looking for `'pause'`. The whole suite passed green, because the `[Invariant]` that
  // already existed compares the TWO TABLES with each other — they agreed. What disagreed was the third side.
  //
  // So what it asks is the side that was wrong: does the dispatch recognise what the menu offers? (A first version that
  // repeated the invariant would have passed the same.)
  //
  // In the world, the defect was the on-screen control's START button no longer pausing — no error, no warning, and on a
  // public-school tablet that is the only pause button there is.
  // with the real solo scheme's shoulders (`input/default-bindings`): touch carries them (ADR-0160)
  const SOLO = { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action1: ['KeyU'], action2: ['KeyJ'], action3: ['KeyK'], action4: ['KeyI'],
    leftShoulder: ['Digit7'], leftTrigger: ['KeyY'], rightShoulder: ['Digit8'], rightTrigger: ['KeyO'] };
  const mundo = () => ({ controls: SOLO, heldKeys: new Set(), players: [{ ctrl: SOLO, easy: false }] });

  it.each(TOUCH_ACTS)('«%s» produz uma decisão, nunca no-op ao apertar', (acao) => {
    const d = decideTouch(acao, true, mundo());
    expect(d.kind, `o menu do slot oferece "${acao}" e o despacho não o reconhece`).not.toBe('noop');
  });
});
