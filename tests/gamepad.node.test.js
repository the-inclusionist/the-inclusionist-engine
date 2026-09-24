// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of input/gamepad — the PURE reading logic (stdDirs/bindActive/padActions) + the mapping wizard's state machine
// through initGamepad(ctx) (node project, no real document: ctx.$ returns FAKE elements).
// Contract: closure DI — everything comes through the ctx, with no access to `document`/`navigator` outside it.
// ZOMBIES + Right-BICEP. It covers in particular: a repeated button (release gate), Escape midway (the _skip sentinel),
// many idle ticks without advancing a step (there is no real timeout; this proves there is no spurious advance), and a
// pad disconnected during the wizard (the tick becomes a no-op without throwing).
import { GAMEPAD_STANDARD } from '../app/js/input/default-bindings.js';
import { ACTIONS } from '../app/js/core/actions.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { PADWIZ_ORDER, initGamepad, padGameAnswers } from '../app/js/input/gamepad.js';
import { stdDirs, bindActive, padActions, oneButtonAtOnce } from '../app/js/input/pad-reading.js';
import { padCur, padPrevAct, padPrevStart } from '../app/js/input/state.js';
// `oneButton` is a live binding of `core/state` (not of the ctx): these cases really turn it on and off.
import * as estado from '../app/js/core/state.js';
// Only the last block uses these: it measures the module's SOURCE, because the hole it closes is one of writing and not of
// execution — a raw sentence runs with no error at all.
import { readFileSync } from 'node:fs';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { join } from 'node:path';

// padCur/padPrevAct/padPrevStart (input/state.ts) are GENUINELY shared state — not part of the ctx, and they persist
// between initGamepad() calls in the same process (one set, for the whole lifetime). Without a reset between tests, an
// `edge` captured in one test "leaks" into the next that reuses the same pad index. A global reset — no test depends on
// another's state.
beforeEach(() => {
  for (const k of Object.keys(padCur)) delete padCur[k];
  for (const k of Object.keys(padPrevAct)) delete padPrevAct[k];
  for (const k of Object.keys(padPrevStart)) delete padPrevStart[k];
  estado.setOneButtonValue(false); // or a motor-empathy case leaks into the cases above
});

// ---------------------------------------------------------------------------------------------
// Fixture factories (fake pad + fake ctx — neither touches document/navigator)
// ---------------------------------------------------------------------------------------------

function makePad({ id = 'pad-1', index = 0, mapping = 'standard', pressed = [], axes = [0, 0, 0, 0, 0, 0, 1.3, 1.3] } = {}) {
  const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) }));
  return { id, index, mapping, buttons, axes: axes.slice() };
}

// A minimal fake DOM element — only the fields gamepad.ts actually reads/writes. `hidden:true` by default: overlays
// (#padwiz, #win-overlay) start hidden in real HTML; a fake with hidden:false would make pollPads think the victory
// screen is always open and skip all the phase logic.
function fakeEl() {
  return { textContent: '', hidden: true, className: '', style: {}, src: '', clicked: 0, click() { this.clicked++; }, _listeners: {}, addEventListener(ev, fn) { (this._listeners[ev] ??= []).push(fn); } };
}

function buildCtx(over = {}) {
  const dom = new Map([
    ['#padwiz-prompt', fakeEl()], ['#padwiz', fakeEl()], ['#padwiz-demo', fakeEl()],
    ['#padwiz-demo-img', fakeEl()], ['#padwiz-demo-fx', fakeEl()], ['#padwiz-progress', fakeEl()],
    ['#padwiz-cancel', fakeEl()], ['#win-overlay', fakeEl()], ['#btn-again', fakeEl()],
  ]);
  const said = []; const alerted = []; const fronted = [];
  let pads = [];
  let phase = 'playing';
  const players = over.players ?? [];
  const naBarra = over.naBarra || new Set();
  const calls = { setPhase: [], navTitle: [], navPause: [], navDialog: [], joinPlayer: [], respawnPlayer: [], setPauseActor: [], modalInput: [], clearWaitingBadge: [], wizardSteps: [], wizardTicks: 0, hideTouchControls: 0, stopAttract: 0, navBar: [], arestas: [], pressionadas: [], soltas: [] };
  return {
    // each ctx its own store (ADR-0232): a map one case saves cannot be the one another case reads
    store: createStorage(memoryBackend()),
    $: (sel) => dom.get(sel) ?? null,
    getGamepads: () => pads,
    // ⚠️ THE LABEL COMES FROM THE 'GAME', and in a test the game is the fixture: the wizard asks, and this object is the
    // answer. `leftShoulder` is left out on purpose: it proves an unnamed position is SKIPPED.
    actionLabel: (a) => ({
      up: 'CIMA', down: 'BAIXO', left: 'ESQUERDA', right: 'DIREITA',
      action1: 'CORRER', action2: 'PULAR', action3: 'ESPECIAL', action4: 'TROCAR', start: 'START',
    })[a] || null,
    srSay: (m) => said.push(m),
    srAlert: (m) => alerted.push(m),
    frontOverlay: (el) => fronted.push(el),
    // The ctx asks for two booleans and two verbs, not the PHASE (ADR-0030 C3). The fake keeps the string inside — it is
    // how the cases read — and translates here.
    worldRunning: () => phase === 'playing',
    pauseMenu: () => phase === 'paused',
    pause: () => { calls.setPhase.push('paused'); phase = 'paused'; },
    resume: () => { calls.setPhase.push('playing'); phase = 'playing'; },
    isAttractActive: () => false,
    stopAttract: () => { calls.stopAttract++; },
    isTouchMode: () => false,
    hideTouchControls: () => { calls.hideTouchControls++; },
    getPlayers: () => players,
    getNumPlayers: () => players.length || 1,
    navTitle: (k) => calls.navTitle.push(k),
    // The `accessibility` MODE (ADR-0044, item 7): with the game moving, the d-pad drives the HUD bar and not the
    // character. By default nobody is in it — the cases that exercise it feed `naBarra`.
    onBar: (i) => naBarra.has(i),
    navBar: (i, k, temStart) => calls.navBar.push([i, k, temStart]),
    sharedDialogOpen: () => null,
    navDialog: (dlg, k) => calls.navDialog.push([dlg, k]),
    getPauseMenu: () => null,
    navPause: (menu, pi, k) => calls.navPause.push([menu, pi, k]),
    setPauseActor: (i) => calls.setPauseActor.push(i),
    // The per-player edge (ADR-0113 clause 4). It keeps the LIST and not a counter: the question «que aparelho produz as
    // arestas» is per seat, and a number cannot tell two pads of two players apart.
    playerEdge: (jogador, origem) => calls.arestas.push([jogador, origem]),
    /*
     * 🔴 THE VIRTUAL CONTROLLER'S DOUBLE (ADR-0223). The pad does not only raise edges: it PRESSES a POSITION on its seat,
     * and what that means — going to the menu, holding the child's key, handing the command to the cartridge — is decided
     * by the controller, once, for the six transports.
     * 📌 `emMenu` belongs to the double and not the pad: `press`'s answer is what says whether the press reached the GAME,
     * and the edge depends on it. A double always answering `true` would leave that reading with nothing holding it.
     */
    press: (action, source, player) => { calls.pressionadas.push([action, source, player]); return !over.emMenu; },
    release: (action, source, player) => calls.soltas.push([action, source, player]),
    // ONE entry (ADR-0033): the pad and the keyboard must not hold COPIES of the same decision — two copies of a rule are
    // two chances to diverge.
    modalInput: (p, intent) => calls.modalInput.push([p, intent]),
    hasModal: (i) => !!(players[i] && players[i].modalAberto),
    joinPlayer: (gi) => { calls.joinPlayer.push(gi); return true; },
    respawnPlayer: (i) => calls.respawnPlayer.push(i),
    clearWaitingBadge: (i) => calls.clearWaitingBadge.push(i),
    wizardStep: (position) => calls.wizardSteps.push(position),
    wizardTick: () => { calls.wizardTicks++; },
    // test helpers (not part of the GamepadCtx contract)
    dom, said, alerted, fronted, calls,
    setPads: (p) => { pads = p; },
    setPhaseValue: (p) => { phase = p; },
    ...over,
  };
}

function makePlayer(over = {}) {
  return { pad: -1, quit: false, waiting: false, easy: false, jumpEdge: false, runEdge: false, leftEdge: false, rightEdge: false, swapEdge: false, specialEdge: false, ...over };
}

// ---------------------------------------------------------------------------------------------
// stdDirs — directions from the standard sources (stick, D-pad, hat)
// ---------------------------------------------------------------------------------------------

describe('stdDirs', () => {
  it('[Zero] pad em repouso -> nenhuma direção', () => {
    const d = stdDirs(makePad());
    expect(d).toEqual({ left: false, right: false, up: false, down: false });
  });
  it('[Right] stick 0 além da zona morta ativa esquerda/direita', () => {
    expect(stdDirs(makePad({ axes: [-0.9, 0, 0, 0, 0, 0, 1.3, 1.3] })).left).toBe(true);
    expect(stdDirs(makePad({ axes: [0.9, 0, 0, 0, 0, 0, 1.3, 1.3] })).right).toBe(true);
  });
  it('[Boundary] D-pad (botões 12-15) ativa direções mesmo com sticks parados', () => {
    const d = stdDirs(makePad({ pressed: [12, 15] })); // cima + direita
    expect(d.up).toBe(true); expect(d.right).toBe(true); expect(d.left).toBe(false); expect(d.down).toBe(false);
  });
  it('[Interface] stick E D-pad mapeados juntos: os dois ficam vivos (nenhum mata o outro)', () => {
    const d = stdDirs(makePad({ pressed: [14], axes: [0, -0.9, 0, 0, 0, 0, 1.3, 1.3] })); // D-pad esquerda + stick cima
    expect(d.left).toBe(true); expect(d.up).toBe(true);
  });
  it('[Right] hat (POV) no eixo 6: cada um dos 8 passos ativa a combinação certa de direções', () => {
    expect(stdDirs(makePad({ axes: [0, 0, 0, 0, 0, 0, -1, 1.3] }))).toMatchObject({ up: true, down: false, left: false, right: false });
    expect(stdDirs(makePad({ axes: [0, 0, 0, 0, 0, 0, 1, 1.3] }))).toMatchObject({ up: true, down: false, left: true, right: false });
    expect(stdDirs(makePad({ axes: [0, 0, 0, 0, 0, 0, 0.4286, 1.3] }))).toMatchObject({ down: true, left: true });
  });
  it('[Error] eixo do hat fora do range de repouso (>1.001) é ignorado sem lançar', () => {
    expect(() => stdDirs(makePad({ axes: [0, 0, 0, 0, 0, 0, 1.286, 1.3] }))).not.toThrow();
    expect(stdDirs(makePad({ axes: [0, 0, 0, 0, 0, 0, 1.286, 1.3] }))).toEqual({ left: false, right: false, up: false, down: false });
  });
});

// ---------------------------------------------------------------------------------------------
// bindActive — a wizard binding (digital/analogue/hat) against the current frame
// ---------------------------------------------------------------------------------------------

describe('bindActive', () => {
  it('[Zero] binding ausente -> false', () => {
    expect(bindActive(makePad(), null)).toBe(false);
    expect(bindActive(makePad(), undefined)).toBe(false);
  });
  it('[Right] binding digital {b}: reflete gp.buttons[b].pressed', () => {
    const gp = makePad({ pressed: [3] });
    expect(bindActive(gp, { b: 3 })).toBe(true);
    expect(bindActive(gp, { b: 4 })).toBe(false);
  });
  it('[Right] binding analógico {ax,s}: limiar por SINAL na metade do curso', () => {
    const gp = makePad({ axes: [0.6, 0, 0, 0, 0, 0, 1.3, 1.3] });
    expect(bindActive(gp, { ax: 0, s: 1 })).toBe(true); // same sign, beyond 0.5
    expect(bindActive(gp, { ax: 0, s: -1 })).toBe(false); // opposite sign
  });
  it('[Boundary] binding hat {av,v}: só dentro de ±0.13 do valor exato do passo', () => {
    const gp = makePad({ axes: [0, 0, 0, 0, 0, 0, 0.43, 1.3] });
    expect(bindActive(gp, { av: 6, v: 0.4286 })).toBe(true);
    expect(bindActive(gp, { av: 6, v: -0.4286 })).toBe(false);
  });
  it('[Error] binding malformado (sem b/ax/av) -> false, não lança', () => {
    expect(() => bindActive(makePad(), {})).not.toThrow();
    expect(bindActive(makePad(), {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// padActions — the DEFAULT map (Gamepad "standard") vs the CUSTOM map saved by the wizard
// ---------------------------------------------------------------------------------------------

describe('padActions', () => {
  it('[Right] sem custom (null): usa o mapa padrão da Gamepad API standard (0=pulo,1=especial,3=troca,9=start)', () => {
    const gp = makePad({ pressed: [0, 9] });
    const a = padActions(gp, null);
    expect(a.action2).toBe(true); expect(a.action3).toBe(false); expect(a._pause).toBe(true); expect(a._start).toBe(true);
  });
  it('⚠️ R1 e R2 DEIXARAM de correr: agora são os ombros/gatilhos da direita (ADR-0086)', () => {
    // With the four shoulders as positions of their own, `run` (`action1`) is X only, not X, R1 and R2 — the asterisk
    // ADR-0086 put on its own «zero movimento»: no VERB changes button, but this one loses alternatives.
    expect(padActions(makePad({ pressed: [5] }), null).action1).toBe(false);
    expect(padActions(makePad({ pressed: [5] }), null).rightShoulder).toBe(true);
    expect(padActions(makePad({ pressed: [7] }), null).rightTrigger).toBe(true);
    expect(padActions(makePad({ pressed: [2] }), null).action1, 'X continua a correr').toBe(true);
  });

  it('⚠️ o mapa LIDO é o mapa DECLARADO — a asserção que a divergência exigia', () => {
    // The defect this case closes: `padActions` with literal indices while `input/default-bindings` declares others, and
    // nothing comparing the two. The same shape as the defect the touch gate caught — two tables that agree with each
    // other prove nothing about a third that reads them. Here there is no third: the reading COMES FROM the table.
    for (const [acao, indice] of Object.entries(GAMEPAD_STANDARD)) {
      if (typeof indice !== 'number') continue;
      if (['up', 'down', 'left', 'right'].includes(acao)) continue; // they come from the stick/D-pad, not from `at()`
      const a = padActions(makePad({ pressed: [indice] }), null);
      expect(a[acao], `botão ${indice} devia levantar "${acao}"`).toBe(true);
    }
  });
  it('[Right] custom presente e sem _skip: usa os bindings do usuário para as AÇÕES', () => {
    const gp = makePad({ pressed: [8] });
    const custom = { action2: { b: 8 } };
    expect(padActions(gp, custom).action2).toBe(true);
    expect(padActions(gp, null).action2).toBe(false); // button 8 is not jump in the default map
  });
  it('[Interface] custom com _skip:true é tratado como "sem custom" (cai no mapa padrão)', () => {
    const gp = makePad({ pressed: [0] });
    const custom = { _skip: true, action2: { b: 5 } }; // if it were honoured, jump would depend on button 5
    expect(padActions(gp, custom).action2).toBe(true); // default jump (button 0), not the ignored custom one
  });
  it('[Boundary] direções custom caem de volta em stdDirs quando o binding do usuário não está ativo', () => {
    const gp = makePad({ axes: [-0.9, 0, 0, 0, 0, 0, 1.3, 1.3] }); // stick left (physical D-pad not mapped in the custom map)
    const custom = { action2: { b: 0 } }; // custom does not define 'left' -> stdDirs covers it
    expect(padActions(gp, custom).left).toBe(true);
  });
  it('[Zero] nenhum botão/eixo ativo -> todas as ações false', () => {
    const a = padActions(makePad(), null);
    expect(Object.values(a).every((v) => v === false)).toBe(true);
  });
});

describe('PADWIZ_STEPS', () => {
  it('⚠️ o assistente alcança TODAS as quatorze posições — nem uma a menos', () => {
    // An accessibility hole otherwise: a game declaring `leftShoulder` would give the child no way to map it. And the
    // wizard exists FOR pads that are not «standard» — generic, adapted, one-handed — so a missing position is
    // unreachable exactly for whoever needs it most.
    //
    // The assertion is about COVERAGE, not size: comparing with `ACTIONS` makes a new position be born covered or make
    // this case fail, the only way the list cannot fall behind again.
    expect([...PADWIZ_ORDER].sort()).toEqual([...ACTIONS].sort());
  });

  it('a ordem é de ERGONOMIA: direções, losango, ombros, sistema', () => {
    // The order is what is left of the engine's decision here — the words are the game's. Directions first because the
    // child finds them without thinking; system last because `start` and `select` tend to be the smallest, most hidden
    // buttons.
    expect(PADWIZ_ORDER.slice(0, 4)).toEqual(['up', 'down', 'left', 'right']);
    expect(PADWIZ_ORDER.slice(-2)).toEqual(['start', 'select']);
  });

  it('⚠️ nenhum RÓTULO sobrou na tabela — era português cru dentro da engine', () => {
    // A label in the table (`['action2', 'PULAR']`) would be platformer vocabulary inside the engine AND in one language,
    // in front of a child, in a file pillar 3 requires to be localisable. Each entry is a position and nothing more.
    for (const passo of PADWIZ_ORDER) expect(typeof passo).toBe('string');
    expect(PADWIZ_ORDER.some((p) => /[a-z]{2,}\s/.test(p))).toBe(false); // nenhuma frase
  });
});

// ---------------------------------------------------------------------------------------------
// initGamepad — the wizard (state machine) through a fully injected ctx, no real document/navigator
// ---------------------------------------------------------------------------------------------

describe('initGamepad — wizard: fluxo completo', () => {
  let ctx; let api;
  beforeEach(() => { ctx = buildCtx(); api = initGamepad(ctx); });

  it('[Right] identifica o controle no 1º botão pressionado, espera soltar, e faz os passos NOMEADOS até fechar sozinho', () => {
    api.openPadWiz();
    expect(api.getPadWiz()).not.toBeNull();
    // no pad identified yet: any pad with a pressed button is adopted (array indexed by POSITION like the real Gamepad
    // API: index:0 to match array position 0)
    ctx.setPads([makePad({ id: 'DirectInput X', index: 0, pressed: [0] })]);
    api.padWizTick();
    expect(api.getPadWiz().gi).toBe(0);
    expect(api.getPadWiz().id).toBe('DirectInput X');
    // still holding button 0 -> baseWait keeps waiting for the release
    api.padWizTick();
    expect(api.getPadWiz().baseWait).toBe(true);
    // release everything -> captures the rest snapshot and enters step 0 ('up')
    ctx.setPads([makePad({ id: 'DirectInput X', index: 0, pressed: [] })]);
    api.padWizTick();
    expect(api.getPadWiz().baseWait).toBe(false);
    expect(api.getPadWiz().step).toBe(0);

    // ⚠️ IT WALKS THE POSITIONS THE GAME NAMES, not the whole list. This file's fake preset names nine of the fourteen,
    // and the wizard SKIPS the five this game does not use — asking for them would produce a mute step.
    const NOMEADAS = PADWIZ_ORDER.filter((a) => ctx.actionLabel(a) !== null);
    expect(NOMEADAS).toHaveLength(9);
    for (let i = 0; i < NOMEADAS.length; i++) {
      ctx.setPads([makePad({ id: 'DirectInput X', index: 0, pressed: [i] })]);
      api.padWizTick(); // captures button i for the current step
      if (i < NOMEADAS.length - 1) {
        expect(api.getPadWiz().map[NOMEADAS[i]]).toEqual({ b: i });
        ctx.setPads([makePad({ id: 'DirectInput X', index: 0, pressed: [] })]);
        api.padWizTick(); // release -> frees the next prompt
      }
    }
    // the last step (start) closes and SAVES by itself (closePadWiz(true))
    expect(api.getPadWiz()).toBeNull();
    expect(ctx.alerted.some((m) => m.includes('Mapeamento salvo'))).toBe(true);
    const saved = api.padMapFor('DirectInput X');
    expect(saved.up).toEqual({ b: 0 });
    expect(saved.start).toEqual({ b: 8 });
  });
});

describe('initGamepad — wizard: botão repetido (release-gate)', () => {
  it('[Right] segurar o MESMO botão do passo anterior não captura o passo seguinte — precisa soltar antes', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-rep', index: 0, pressed: [] }));
    ctx.setPads([makePad({ id: 'pad-rep', index: 0, pressed: [] })]);
    api.padWizTick(); // baseWait termina (nada pressionado) -> passo 0
    expect(api.getPadWiz().step).toBe(0);

    ctx.setPads([makePad({ id: 'pad-rep', index: 0, pressed: [7] })]);
    api.padWizTick(); // binds step 0 to button 7
    expect(api.getPadWiz().map[PADWIZ_ORDER[0]]).toEqual({ b: 7 });
    expect(api.getPadWiz().step).toBe(1);
    expect(api.getPadWiz().release).toBe(true);

    // keeps holding the SAME button 7 for several ticks: must not capture step 1 nor advance
    for (let i = 0; i < 10; i++) api.padWizTick();
    expect(api.getPadWiz().step).toBe(1);
    expect(api.getPadWiz().release).toBe(true);
    expect(api.getPadWiz().map[PADWIZ_ORDER[1]]).toBeUndefined();

    // release -> frees step 1's prompt; press the SAME button 7 again -> it IS accepted for the new step
    // (the wizard does not deduplicate bindings across actions — documented behaviour)
    ctx.setPads([makePad({ id: 'pad-rep', index: 0, pressed: [] })]);
    api.padWizTick(); // release=false, prompta o passo 1
    expect(api.getPadWiz().release).toBe(false);
    ctx.setPads([makePad({ id: 'pad-rep', index: 0, pressed: [7] })]);
    api.padWizTick();
    expect(api.getPadWiz().map[PADWIZ_ORDER[1]]).toEqual({ b: 7 });
  });
});

describe('initGamepad — wizard: Escape no meio (cancelar)', () => {
  it('[Right] closePadWiz(false) fecha sem salvar; padMapFor devolve o sentinel _skip (mapa padrão, não persiste)', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-esc', index: 0 }));
    expect(api.getPadWiz()).not.toBeNull();
    api.closePadWiz(false); // Esc
    expect(api.getPadWiz()).toBeNull();
    expect(ctx.alerted.some((m) => m.includes('salvo'))).toBe(false);
    expect(api.padMapFor('pad-esc')).toEqual({ _skip: true });
  });
  it('[Boundary] Esc sem nenhum wizard aberto é no-op (não lança)', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    expect(() => api.closePadWiz(false)).not.toThrow();
    expect(api.getPadWiz()).toBeNull();
  });
  it('[Interface] o botão #padwiz-cancel já sai ligado a closePadWiz(false)', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-btn', index: 0 }));
    ctx.dom.get('#padwiz-cancel')._listeners.click[0]();
    expect(api.getPadWiz()).toBeNull();
  });
});

describe('initGamepad — wizard: muitos ticks ociosos não avançam passo ("timeout")', () => {
  it('[Zero/Many] 200 ticks com o pad em repouso mantêm o wizard parado no MESMO passo, sem lançar', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-idle', index: 0, pressed: [] }));
    ctx.setPads([makePad({ id: 'pad-idle', index: 0, pressed: [] })]);
    api.padWizTick(); // sai do baseWait -> passo 0
    expect(api.getPadWiz().step).toBe(0);
    expect(() => { for (let i = 0; i < 200; i++) api.padWizTick(); }).not.toThrow();
    expect(api.getPadWiz().step).toBe(0); // no spurious advance — there is no real timeout
  });
});

describe('initGamepad — wizard: controle desconectado durante o mapeamento', () => {
  it('[Right] índice do pad passa a devolver undefined -> tick vira no-op (não lança, não perde o passo)', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-dc', index: 1, pressed: [] }));
    ctx.setPads([undefined, makePad({ id: 'pad-dc', index: 1, pressed: [] })]);
    api.padWizTick();
    expect(api.getPadWiz().step).toBe(0);
    ctx.setPads([]); // disconnected: pads[1] is now undefined
    expect(() => api.padWizTick()).not.toThrow();
    expect(api.getPadWiz()).not.toBeNull();
    expect(api.getPadWiz().step).toBe(0); // frozen, no progress lost
    // reconnect -> responds normally again
    ctx.setPads([undefined, makePad({ id: 'pad-dc', index: 1, pressed: [3] })]);
    api.padWizTick();
    expect(api.getPadWiz().map[PADWIZ_ORDER[0]]).toEqual({ b: 3 });
  });
  it('[Boundary] getGamepads() devolvendo null/undefined inteiro não lança em nenhuma fase', () => {
    const ctx = buildCtx({ getGamepads: () => null }); const api = initGamepad(ctx);
    expect(() => api.openPadWiz()).not.toThrow();
    expect(() => api.padWizTick()).not.toThrow();
  });
});

describe('initGamepad — wizard: classificação de eixo (analógico vs D-pad/hat)', () => {
  it('[Right] eixo que VARIA continuamente por 8 ticks -> binding analógico {ax,s}', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-ax', index: 0, pressed: [], axes: [0, 0, 0, 0, 0, 0, 1.3, 1.3] }));
    ctx.setPads([makePad({ id: 'pad-ax', index: 0, pressed: [], axes: [0, 0, 0, 0, 0, 0, 1.3, 1.3] })]);
    api.padWizTick(); // passo 0
    // axis 2 leaves rest beyond 0.45 -> the tick that DETECTS it only STARTS tracking (does not count); 8 tracking ticks
    // AFTER that (ticks>=8) are needed to close the classification.
    ctx.setPads([makePad({ id: 'pad-ax', index: 0, axes: [0, 0, 0.5, 0, 0, 0, 1.3, 1.3] })]); api.padWizTick(); // starts tracking
    const seq = [0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9]; // 8 PROCESSING ticks, changing at each one (>2 changes)
    for (const v of seq) { ctx.setPads([makePad({ id: 'pad-ax', index: 0, axes: [0, 0, v, 0, 0, 0, 1.3, 1.3] })]); api.padWizTick(); }
    expect(api.getPadWiz().map[PADWIZ_ORDER[0]]).toEqual({ ax: 2, s: 1 });
  });
  it('[Right] eixo que salta e FICA CONSTANTE por 8 ticks -> binding de hat {av,v}', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-hat', index: 0, pressed: [], axes: [0, 0, 0, 0, 0, 0, 1.3, 1.3] }));
    ctx.setPads([makePad({ id: 'pad-hat', index: 0, pressed: [], axes: [0, 0, 0, 0, 0, 0, 1.3, 1.3] })]);
    api.padWizTick(); // passo 0
    // same detail: 1 tick to DETECT (starts tracking) + 8 processing ticks (ticks>=8)
    for (let i = 0; i < 9; i++) { ctx.setPads([makePad({ id: 'pad-hat', index: 0, axes: [0, 0, 0.7143, 0, 0, 0, 1.3, 1.3] })]); api.padWizTick(); }
    expect(api.getPadWiz().map[PADWIZ_ORDER[0]]).toEqual({ av: 2, v: 0.7143 });
  });
});

// ---------------------------------------------------------------------------------------------
// initGamepad — pollPads: dispatch by phase (title/paused/playing), auto-wizard, and map persistence
// ---------------------------------------------------------------------------------------------

describe('o assento: quem dirige qual tela (sondado 2026-09-23)', () => {
  /*
   * 🔴 SIX OF THIS BLOCK'S SEVEN DECISIONS WERE LOOSE (the 2026-09-23 probe), and it is the block that decides which child
   * drives which screen. Getting it wrong breaks nothing visible — the game keeps responding — it simply puts one
   * child's pad into another's game, the same shape of defect the keyboard's owner routing has written in its file's
   * header.
   */
  const jogando = (players, over = {}) => {
    const ctx = buildCtx({ players, ...over });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    return { ctx, api };
  };

  it('⚠️ um controle toma assento numa BORDA, e nunca por estar apenas ligado', () => {
    const p = makePlayer();
    const { ctx, api } = jogando([p]);
    ctx.setPads([makePad({ id: 'std', index: 0, pressed: [] })]);
    api.pollPads();
    expect(p.pad, 'um controle em repouso tomou a tela de alguém').toBe(-1);
    ctx.setPads([makePad({ id: 'std', index: 0, pressed: [0] })]);
    api.pollPads();
    expect(p.pad, 'e a borda de um botão toma-a').toBe(0);
  });

  it('⚠️ o DIRECIONAL também toma assento — uma criança que só move a alavanca não fica de fora', () => {
    const p = makePlayer();
    const { ctx, api } = jogando([p]);
    ctx.setPads([makePad({ id: 'std', index: 0, axes: [-1, 0, 0, 0, 0, 0, 1.3, 1.3] })]);
    api.pollPads();
    expect(p.pad, 'só os botões tomavam assento, e quem joga com a alavanca ficava sem tela').toBe(0);
  });

  it('⚠️ uma tela À ESPERA tem prioridade sobre um assento livre qualquer', () => {
    const livre = makePlayer(), esperando = makePlayer({ waiting: true });
    const { ctx, api } = jogando([livre, esperando]);
    ctx.setPads([makePad({ id: 'std', index: 0, pressed: [0] })]);
    api.pollPads();
    expect(esperando.pad, 'o controle foi para uma tela que não estava à espera de ninguém').toBe(0);
    expect(livre.pad).toBe(-1);
  });

  it('⚠️ uma tela ABANDONADA não é um assento livre', () => {
    const saiu = makePlayer({ quit: true }), livre = makePlayer();
    const { ctx, api } = jogando([saiu, livre]);
    ctx.setPads([makePad({ id: 'std', index: 0, pressed: [0] })]);
    api.pollPads();
    expect(saiu.pad, 'o controle foi para uma tela que já tinha sido abandonada').toBe(-1);
    expect(livre.pad).toBe(0);
  });

  it('⚠️ sem assento nenhum livre, o controle PEDE para entrar em vez de ficar mudo', () => {
    const cheio = makePlayer({ pad: 5 });
    const { ctx, api } = jogando([cheio]);
    ctx.setPads([makePad({ id: 'std', index: 0, pressed: [0] })]);
    api.pollPads();
    expect(ctx.calls.joinPlayer, 'um controle a mais não pediu para entrar: apertar não fazia nada').toEqual([0]);
  });

  // 🔴 Probed 2026-09-23 (second probe): removing START or `action1` from the list that takes a seat stayed GREEN — only
  // button 0 and the stick had a case. A child whose first gesture is START would get no screen and no notice.
  it.each([
    ['action2', 0], ['action3', 1], ['action1', 2], ['action4', 3], ['START', 9],
  ])('⚠️ o botão %s sozinho toma assento', (_nome, botao) => {
    const p = makePlayer();
    const { ctx, api } = jogando([p]);
    ctx.setPads([makePad({ id: 'std', index: 0, pressed: [botao] })]);
    api.pollPads();
    expect(p.pad, 'este botão foi apertado e a criança ficou sem tela').toBe(0);
  });

  it('⚠️ a tela à espera perde o selo e a criança ouve que entrou', () => {
    const esperando = makePlayer({ waiting: true });
    const { ctx, api } = jogando([esperando]);
    ctx.setPads([makePad({ id: 'std', index: 0, pressed: [0] })]);
    api.pollPads();
    expect(esperando.waiting).toBe(false);
    expect(ctx.calls.clearWaitingBadge, 'o selo «aguardando» ficou na tela de quem já entrou').toEqual([0]);
    expect(ctx.said.some((m) => /1/.test(m)), 'e nada foi dito a quem não vê a tela').toBe(true);
  });
});

describe('initGamepad — pollPads', () => {
  it('⚠️ sem gamepads NENHUNS o laço não rebenta — `getGamepads()` responde `null` quando a aba perde o foco', () => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })], getGamepads: () => null });
    const api = initGamepad(ctx);
    expect(() => api.pollPads()).not.toThrow();
  });

  it('⚠️ uma posição VAZIA na lista é saltada — `getGamepads()` devolve um array esparso com buracos', () => {
    const p = makePlayer({ pad: 1 });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([null, makePad({ id: 'std', index: 1, pressed: [0] })]);
    expect(() => api.pollPads()).not.toThrow();
    expect(p.jumpEdge, 'o buraco na lista engoliu o controle que vinha depois dele').toBe(true);
  });

  it('⚠️ o controle que ABRE o assistente pára o quadro: os outros não são lidos por cima dele', () => {
    const p = makePlayer({ pad: 1 });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([
      makePad({ id: 'DirectInput Z', index: 0, mapping: '', pressed: [0] }), // no map: opens the wizard
      makePad({ id: 'std', index: 1, pressed: [0] }),
    ]);
    api.pollPads();
    expect(api.getPadWiz()).not.toBeNull();
    expect(p.jumpEdge, 'o segundo controle jogou para dentro de um quadro em que o assistente acabara de abrir').toBe(false);
    // 📌 And the assertion that BITES is this one: the second pad was never READ. Without it the case passed with the guard
    // off, because opening the wizard pauses the phase and the second pad fell into the pause branch, which writes nothing
    // visible — a green case over a pad that was read all the same.
    expect(padCur[1], 'o segundo controle foi lido dentro do quadro do assistente').toBeUndefined();
  });

  it('⚠️ um botão FÍSICO faz sumir o controle na tela — a mesma regra do teclado (E13)', () => {
    const p = makePlayer({ pad: 0 });
    const ctx = buildCtx({ players: [p], isTouchMode: () => true });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, pressed: [0] })]);
    api.pollPads();
    expect(ctx.calls.hideTouchControls, 'o pad virtual ficou na tela por cima do jogo de quem tem um controle na mão').toBeGreaterThan(0);
  });

  it('⚠️ dentro do modal a ORDEM decide: com esquerda e confirmar no mesmo quadro, ganha esquerda', () => {
    // 📌 The order is `input/keydown`'s, which has had a case there since a mutation passed. A pad delivers a SNAPSHOT,
    // with no order of arrival, so the only thing separating two positions pressed in the same frame is this list — and
    // swapping it makes the child confirm when they wanted to move.
    const p = makePlayer({ pad: 0, modalAberto: true });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, pressed: [0, 14] })]); // action2 and the left d-pad
    api.pollPads();
    expect(ctx.calls.modalInput, 'confirmar passou à frente de andar').toEqual([[0, 'left']]);
  });

  it('[Right] controle DirectInput sem mapa salvo, apertando algo em "playing": pausa e abre o wizard sozinho', () => {
    const players = [makePlayer({ pad: 0 })];
    const ctx = buildCtx({ players });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'DirectInput Y', index: 0, mapping: '', pressed: [0] })]);
    api.pollPads();
    expect(ctx.calls.setPhase).toContain('paused');
    expect(api.getPadWiz()).not.toBeNull();
    expect(api.getPadWiz().id).toBe('DirectInput Y');
  });
  it('[Right] durante o wizard, pollPads não processa nada (só o wizard fala com os pads)', () => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })] });
    const api = initGamepad(ctx);
    api.openPadWiz();
    ctx.setPads([makePad({ id: 'x', index: 0, pressed: [0] })]);
    expect(() => api.pollPads()).not.toThrow();
    expect(ctx.calls.navTitle).toHaveLength(0);
    // 🔴 Probed 2026-09-23: the assertion above stayed GREEN with the guard deleted — the frame went on to the game branch,
    // which does not call `navTitle`. The one that bites is this: the pad was never even READ.
    expect(padCur[0], 'o controle foi lido por baixo do assistente').toBeUndefined();
  });

  it('⚠️ na DEMONSTRAÇÃO sem botão nenhum, o quadro acaba ali — a alavanca não toma assento por baixo da demo', () => {
    const p = makePlayer();
    const ctx = buildCtx({ players: [p], isAttractActive: () => true });
    const api = initGamepad(ctx);
    ctx.setPads([makePad({ id: 'std', index: 0, axes: [-1, 0, 0, 0, 0, 0, 1.3, 1.3] })]);
    api.pollPads();
    expect(ctx.calls.stopAttract, 'uma alavanca não é um botão: a demo não acaba').toBe(0);
    expect(p.pad, 'a demo corria e um controle tomou assento por baixo dela').toBe(-1);
    expect(padCur[0]).toBeUndefined();
  });

  // 🔴 Probed 2026-09-23: removing START or `action4` from the list of physical buttons stayed GREEN — only button 0 had a
  // case. Any of the nine positions the pad reads is a pad in hand, and the on-screen pad must leave.
  it.each([
    ['cima', 12], ['baixo', 13], ['esquerda', 14], ['direita', 15],
    ['action2', 0], ['action3', 1], ['action1', 2], ['action4', 3], ['START', 9],
  ])('⚠️ %s sozinho faz sumir o controle na tela', (_nome, botao) => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })], isTouchMode: () => true });
    const api = initGamepad(ctx);
    ctx.setPads([makePad({ id: 'std', index: 0, pressed: [botao] })]);
    api.pollPads();
    expect(ctx.calls.hideTouchControls).toBeGreaterThan(0);
  });

  it('[Inverse] fora do modo de toque não há pad virtual a esconder, e a porta não é chamada', () => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })], isTouchMode: () => false });
    const api = initGamepad(ctx);
    ctx.setPads([makePad({ id: 'std', index: 0, pressed: [0] })]);
    api.pollPads();
    expect(ctx.calls.hideTouchControls).toBe(0);
  });

  it('⚠️ com o cartão de pausa aberto SOBRE um mundo que corre, manda a pausa: o START retoma e não volta a pausar', () => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })], worldRunning: () => true, pauseMenu: () => true });
    const api = initGamepad(ctx);
    ctx.setPads([makePad({ id: 'std', index: 0, pressed: [9] })]);
    api.pollPads();
    expect(ctx.calls.setPhase, 'o controle jogou por baixo de um cartão de pausa aberto').toEqual(['playing']);
  });

  // 🔴 Probed 2026-09-23: four of the modal's six intents could vanish with the suite green — only «esquerda» and «cima»
  // had a case. Each position inside a modal is a word the child builds, and each is a rule.
  it.each([
    ['direita', 15, 'right'], ['baixo', 13, 'down'], ['action2', 0, 'confirm'], ['action3', 1, 'erase'],
  ])('⚠️ dentro do modal, %s vira a intenção %s', (_nome, botao, intencao) => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0, modalAberto: true })] });
    const api = initGamepad(ctx);
    ctx.setPads([makePad({ id: 'std', index: 0, pressed: [botao] })]);
    api.pollPads();
    expect(ctx.calls.modalInput).toEqual([[0, intencao]]);
  });

  it('[Inverse] dentro do modal, um botão SEM intenção não manda nada — nem uma intenção vazia', () => {
    const p = makePlayer({ pad: 0, modalAberto: true });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPads([makePad({ id: 'std', index: 0, pressed: [2] })]); // action1: the modal does not read it
    api.pollPads();
    expect(ctx.calls.modalInput).toEqual([]);
    expect(p.runEdge, 'e o modal continua a comer o botão: nada chega ao jogo por baixo dele').toBe(false);
  });
  it('[Right] fase "playing", mapa padrão: pulo do controle marca jumpEdge só na BORDA (subida)', () => {
    const p = makePlayer({ pad: 0 });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [0] })]);
    api.pollPads();
    expect(p.jumpEdge).toBe(true);
    p.jumpEdge = false; // the game consumes the edge every frame
    api.pollPads(); // button 0 still pressed -> no NEW edge
    expect(p.jumpEdge).toBe(false);
  });
  // The Easy guard (input/edges.ts) holds on all THREE input paths. These two cases close the triangle with keydown and
  // touch-bindings — without them the rule could be switched off in the leaf with nothing here reacting.
  //
  // 🔴 THE BUTTON IS 2, not 5: ADR-0086 took `run` off the shoulders («`action1` perde dois dos seus três», as
  // `input/gamepad` records beside its table). With button 5, `runEdge` is false because there is NO edge at all, and
  // the case measured the vacuum — deleting `edgeAllowed` from the pad loop left it GREEN (found by mutation,
  // 2026-09-09). Button 2 is what the [Inverse] case below proves raises `runEdge` without Easy.
  it('[Right] Fácil: o botão de correr do controle NÃO levanta runEdge (mesma regra do teclado e do toque)', () => {
    const p = makePlayer({ pad: 0, easy: true });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [2] })]);
    api.pollPads();
    expect(p.runEdge, 'a guarda do Fácil não está a valer no caminho do controle').toBe(false);
  });
  it('[Inverse] SEM Fácil, o mesmo botão levanta runEdge — prova que a guarda é o `easy`, não o mapa', () => {
    const p = makePlayer({ pad: 0, easy: false });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [2] })]);
    api.pollPads();
    expect(p.runEdge).toBe(true);
  });
  it('🎯 a aresta do CONTROLE chega ao autómato, por assento (ADR-0113 cláusula 4)', () => {
    // 🔴 Without `playerEdge` in production, the latch read would be the KEYBOARD's even with the pad in hand (the state
    // measured on 2026-09-09). ⚠️ And the gamepad stays identifiable (it goes through `padCur`, not the key set), which
    // makes the gap invisible: the module knows which pad the edge came from, and the automaton would not.
    const p = makePlayer({ pad: 0, easy: false });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [2] })]);
    api.pollPads();
    expect(ctx.calls.arestas, 'a aresta do controle não chegou ao autómato').toEqual([[0, 'gamepad']]);

    api.pollPads(); // same button still pressed: no new edge, and no new transport edge
    expect(ctx.calls.arestas.length, 'segurar o botão contou como uma segunda aresta').toBe(1);
  });

  it('⚠️ e ela conta MESMO com o Modo Fácil a filtrar a bandeira — a criança carregou no botão', () => {
    // 📌 The distinction this line buys: reading the same condition as `p[flag]` would leave a child in Easy mode with the
    // KEYBOARD's latch while playing on the pad. Easy decides what the GAME does with the button; not which device is in
    // their hand.
    const p = makePlayer({ pad: 0, easy: true });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    // 📌 BUTTON 2 and not 5, a measured choice: it is the button the [Inverse] case above proves raises `runEdge` without
    // Easy. With 5, `runEdge` is false because there is NO edge at all, and the case would measure nothing — the defect it
    // exists to catch elsewhere.
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [2] })]);
    api.pollPads();
    expect(p.runEdge, 'o Fácil devia ter filtrado a bandeira').toBe(false);
    expect(ctx.calls.arestas, 'o aparelho em uso passou a depender do Modo Fácil').toEqual([[0, 'gamepad']]);
  });

  /* ===================== THE SINGLE DOOR (ADR-0223) ===================== */
  // 🔴 The pad goes through the virtual controller: raising edges on the player alone would leave a cartridge that
  // listens only to `onCommand` — what the ADR-0111 erratum asked of all — deaf to a pad in the child's hand. These cases
  // hold the three halves: the press, the answer and the release.

  it('🔴 [Right] o botão APERTA o controle virtual, com a origem e com o ASSENTO', () => {
    // 📌 THE SECOND SEAT, which separates «diz o assento certo» from «diz sempre 0»: pad 0 is in player 2's hand, so the
    // position must reach the virtual controller with seat 1.
    const ctx = buildCtx({ players: [makePlayer({ pad: -1 }), makePlayer({ pad: 0, easy: false })] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [0] })]); // acção 2 (pulo)
    api.pollPads();
    expect(ctx.calls.pressionadas, 'a posição não chegou à porta única, ou chegou ao assento errado')
      .toEqual([['action2', 'gamepad', 1]]);
  });

  it('🔴 [CrossCheck] as OITO posições apertam, e não só as seis que têm aresta', () => {
    // 📏 `EDGE_BY_ACTION` has six; up and down move by held key and raise no flag. All eight reach the cartridge — the
    // edge is a subset of what the door carries, not the other way round.
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [12] })]); // D-pad para cima
    api.pollPads();
    expect(ctx.calls.pressionadas.map((c) => c[0]), 'uma posição sem aresta não chegou ao cartucho').toEqual(['up']);
  });

  it('🔴 [CrossCheck] com um MENU a levar a pressão, a aresta NÃO sobe — a resposta do controle é lida', () => {
    // 🎯 It is why `press` answers a boolean (ADR-0223): the transport does not guess whether the press reached the game.
    // Without this reading, a child navigating a menu with the pad would raise the jump edge, which the physics consumes
    // on the frame the game comes back.
    const p = makePlayer({ pad: 0, easy: false });
    const ctx = buildCtx({ players: [p], emMenu: true });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [0] })]);
    api.pollPads();
    expect(ctx.calls.pressionadas, 'a posição nem chegou a ser apertada').toHaveLength(1);
    expect(p.jumpEdge, 'o menu levou a pressão e mesmo assim a aresta subiu').toBe(false);
    expect(ctx.calls.arestas, 'o autómato foi avisado de uma aresta que não houve').toEqual([]);
  });

  it('🔴 [Right] soltar o botão SOLTA a posição — senão o jogo fica a acreditar que ele continua em baixo', () => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [0] })]);
    api.pollPads();
    // ⚠️ THE HALF A MUTATION SHOWED MISSING: with the button still DOWN there is no release at all. Without this line, an
    // edge computed backwards (`!prev && cur`) released the position the instant it was pressed and the case stayed green
    // — both readings end with the same list, and what separates them is WHEN.
    expect(ctx.calls.soltas, 'soltou uma posição que continua premida').toEqual([]);
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [] })]);
    api.pollPads();
    expect(ctx.calls.soltas, 'o dedo saiu do botão e a posição ficou premida para sempre')
      .toEqual([['action2', 'gamepad', 0]]);
  });

  it('🔴 [Boundary] e a soltura é INCONDICIONAL: abrir a pausa com o botão premido não deixa a tecla segurada', () => {
    // ⚠️ The press is only born in the GAME branch, but the finger leaves the button wherever it likes. If the release
    // depended on the branch, a child who opens the pause card with jump pressed would return to a game jumping by itself.
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [0] })]);
    api.pollPads();
    ctx.setPhaseValue('paused');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [] })]);
    api.pollPads();
    expect(ctx.calls.soltas, 'a soltura ficou presa ao ramo de jogo').toEqual([['action2', 'gamepad', 0]]);
  });

  it('🔴 [Invariant] o Modo Fácil filtra a ARESTA e não a porta: o cartucho ouve o botão na mesma', () => {
    // 📌 It is what keeps the three transports agreeing: delivery to the cartridge does not go through `edgeAllowed` on
    // the keyboard, and does not here. Easy decides what the PHYSICS does with the button, not whether the game heard it.
    const p = makePlayer({ pad: 0, easy: true });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [2] })]); // acção 1 (correr)
    api.pollPads();
    expect(p.runEdge, 'o Fácil devia ter filtrado a bandeira').toBe(false);
    expect(ctx.calls.pressionadas, 'o Fácil silenciou o botão para o cartucho, e isso não é o que ele é')
      .toEqual([['action1', 'gamepad', 0]]);
  });

  it('[Right] fase "title": navTitle recebe as teclas quando algum jogador aciona', () => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('title');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [0] })]); // pulo = "yes"
    api.pollPads();
    expect(ctx.calls.navTitle).toHaveLength(1);
    expect(ctx.calls.navTitle[0].yes).toBe(true);
  });
  it('[Boundary] MP, controle de um jogador != J1 na tela de título: não navega, só avisa', () => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 1 }), makePlayer({ pad: 0 })] }); // the owner of pad 0 is index 1 (P2)
    const api = initGamepad(ctx);
    ctx.setPhaseValue('title');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [0] })]);
    api.pollPads();
    expect(ctx.calls.navTitle).toHaveLength(0);
    expect(ctx.said.some((m) => m.includes('Aguarde o Jogador 1'))).toBe(true);
  });
  it('[Right] fase "playing", MODAL aberto: CIMA vira intenção e NÃO mexe jumpEdge', () => {
    // Dictating a Braille cell is what a literacy activity does with `up`; the pad only delivers `up` (ADR-0033). What is
    // asserted — and what matters — is that the key goes to the modal instead of becoming a game edge.
    const p = makePlayer({ pad: 0, modalAberto: true });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [12] })]); // D-pad cima
    api.pollPads();
    expect(ctx.calls.modalInput).toEqual([[0, 'up']]); // the owner's INDEX, not the object (ADR-0033/0039)
    expect(p.jumpEdge).toBe(false);
  });
  it('[Right] jogador ausente (owner<0) que aperta algo em "playing" e não há tela esperando: chama joinPlayer', () => {
    const ctx = buildCtx({ players: [] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 3, mapping: 'standard', pressed: [0] })]);
    api.pollPads();
    expect(ctx.calls.joinPlayer).toEqual([3]);
  });

  /*
   * ============== THE FIVE BRANCHES NOBODY SAW (2026-09-22, ADR-0221 step 7c) ==============
   *
   * 🔴 THESE CASES CAME FROM A MEASUREMENT, NOT A READING. Before restructuring `pollPads`, each of its nine top-level
   * branches was SWITCHED OFF, one at a time, to ask the suite whether it noticed.
   * 📏 Four failed (wizard, title, pad without a seat, modal) and **five stayed GREEN**: the demo mode, the victory modal,
   * the pause card's navigation, the quick bar and the START that pauses. Five branches that could be deleted whole with
   * the suite green — and one of them, the bar, is what keeps the button from becoming a game action.
   *
   * 📌 Restructuring code no case sees is not a refactor, it is a blind rewrite. That is why these cases assert each
   * branch's EFFECT and not its shape.
   */
  it('🔴 [Right] na DEMONSTRAÇÃO, um botão de controle encerra a demo e mais nada acontece', () => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })], isAttractActive: () => true });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('title');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [0] })]);
    api.pollPads();
    expect(ctx.calls.stopAttract, 'o botão do controle não encerrou a demonstração').toBe(1);
    expect(ctx.calls.navTitle, 'a demo encerrou E o menu andou: a criança perdeu uma escolha que não viu').toHaveLength(0);
  });

  it('🔴 [Right] com a tela de VITÓRIA aberta, o START carrega «jogar de novo» e não chega ao jogo', () => {
    const p = makePlayer({ pad: 0 });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.dom.get('#win-overlay').hidden = false;
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [9] })]); // START
    api.pollPads();
    expect(ctx.dom.get('#btn-again').clicked, 'o START não fechou a tela de vitória').toBe(1);
    expect(ctx.calls.setPhase, 'o mesmo START que fechou a vitória também pausou o jogo por baixo dela').toEqual([]);
  });

  it('🔴 [Right] no CARTÃO DE PAUSA, o direcional navega o menu do próprio assento', () => {
    const menu = { hidden: false };
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })], getPauseMenu: () => menu });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('paused');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [13] })]); // D-pad baixo
    api.pollPads();
    expect(ctx.calls.navPause, 'o cartão de pausa ficou surdo ao controle').toHaveLength(1);
    expect(ctx.calls.navPause[0][0]).toBe(menu);
    expect(ctx.calls.navPause[0][1], 'o menu navegado não é o do assento deste controle').toBe(0);
    expect(ctx.calls.navPause[0][2].down).toBe(true);
  });

  it('🔴 [Right] no cartão de pausa, o START retoma o jogo', () => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('paused');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [9] })]);
    api.pollPads();
    expect(ctx.calls.setPhase, 'o START não retomou — a pausa aberta pelo controle não fecha pelo controle').toEqual(['playing']);
  });

  it('🔴 [Right] na BARRA RÁPIDA, o botão dirige a barra e NÃO vira acção de jogo (ADR-0044 item 7)', () => {
    // ⚠️ The second expectation carries the subject: while the mode is on, nothing from this pad is the game's. Without it, a
    // bar that navigated and let the character jump at the same time would pass.
    const p = makePlayer({ pad: 0 });
    const ctx = buildCtx({ players: [p], naBarra: new Set([0]) });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [0] })]); // the jump button
    api.pollPads();
    expect(ctx.calls.navBar, 'a barra rápida não recebeu o controle').toHaveLength(1);
    expect(ctx.calls.navBar[0][0]).toBe(0);
    expect(ctx.calls.navBar[0][1].yes).toBe(true);
    expect(p.jumpEdge, 'o mesmo botão dirigiu a barra E fez o personagem saltar').toBe(false);
  });

  it('🔴 [Right] a jogar, o START pausa e diz QUEM pausou', () => {
    const p = makePlayer({ pad: 0 });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [9] })]);
    api.pollPads();
    expect(ctx.calls.setPhase, 'o START do controle não pausa').toEqual(['paused']);
    expect(ctx.calls.setPauseActor, 'pausou sem dizer de quem é o cartão que abre').toEqual([0]);
  });
});

/* ===================== WHAT AN ABSENCE MEANS (ADR-0224) ===================== */
// 🔴 The engine MOUNTS this transport, and what only the cartridge knows arrives in an optional field. The value of these
// cases is not the table — it is that each absence has ONE written meaning, instead of being guessed where it is missed.
// A cartridge that declares nothing has a working pad, and that is what the first case asserts.
describe('padGameAnswers — a ausência é uma resposta, não um esquecimento', () => {
  const SEMPRE_A_ANDAR = () => true;

  it('🔴 [Zero] um cartucho que declara NADA responde a tudo, e nada explode', () => {
    const a = padGameAnswers(undefined, SEMPRE_A_ANDAR);
    expect(a.worldRunning(), 'o mundo parou porque ninguém o declarou').toBe(true);
    expect(a.attractActive(), 'inventou-se uma demonstração que não existe').toBe(false);
    expect(a.hasModal(0), 'inventou-se um desafio aberto').toBe(false);
    expect(a.joinPlayer(1), 'deixou entrar alguém num jogo que não sabe receber').toBe(false);
    // 📌 The ones that return nothing: what is asserted is that they EXIST and do not throw — a missing door would blow up
    // mid-frame, the worst possible place to discover a forgotten declaration.
    expect(() => { a.navTitle({}); a.stopAttract(); a.modalInput(0, 'confirm'); a.respawnPlayer(0); a.clearWaitingBadge(0); a.wizardStep('up'); a.wizardTick(); })
      .not.toThrow();
  });

  it('🔴 [Right] o que o cartucho DECLARA é o que vale — a tabela é piso, não tecto', () => {
    const vistos = [];
    const a = padGameAnswers({
      hasModal: (i) => i === 1,
      modalInput: (i, intent) => vistos.push([i, intent]),
      joinPlayer: () => true,
      wizardStep: (position) => vistos.push(['passo', position]),
    }, SEMPRE_A_ANDAR);
    expect(a.hasModal(1)).toBe(true);
    expect(a.hasModal(0)).toBe(false);
    a.modalInput(1, 'erase');
    expect(vistos).toEqual([[1, 'erase']]);
    expect(a.joinPlayer(0)).toBe(true);
    a.wizardStep('up');
    expect(vistos.at(-1)).toEqual(['passo', 'up']);
    expect(a.attractActive(), 'declarar uma coisa apagou as outras').toBe(false);
  });

  it('🔴 [Boundary] um campo escrito como `undefined` é uma AUSÊNCIA, e não um buraco', () => {
    // ⚠️ The silent defect the function exists not to have: spreading the raw object over the table overwrites the answer
    // with `undefined`, and the first frame that calls it throws. A cartridge writes
    // `{ hasModal: temModal ? f : undefined }` without a second thought.
    const a = padGameAnswers({ hasModal: undefined, wizardStep: undefined }, SEMPRE_A_ANDAR);
    expect(typeof a.hasModal, 'a resposta da tabela foi apagada por um `undefined` declarado').toBe('function');
    expect(a.hasModal(0)).toBe(false);
    expect(() => a.wizardStep(null), 'a demonstração declarada como `undefined` apagou a resposta').not.toThrow();
  });

  it('🔴 [CrossCheck] `worldRunning` é a única ausência que quem MONTA responde', () => {
    // 📌 And the reason is written: the others have a universal answer, this one depends on knowing which menus are open —
    // something only the host knows. Declared, it wins over the host like any other.
    expect(padGameAnswers(undefined, () => false).worldRunning()).toBe(false);
    expect(padGameAnswers({ worldRunning: () => true }, () => false).worldRunning()).toBe(true);
  });
});

describe('initGamepad — padMapFor', () => {
  it('[Right] sem mapa salvo (armazenamento vazio) -> null, sem lançar', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    expect(api.padMapFor('nunca-visto')).toBeNull();
  });
  it('[Interface] cacheia por id: chamadas repetidas devolvem a MESMA referência, sem reconsultar o store', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    const a = api.padMapFor('algum-pad');
    const b = api.padMapFor('algum-pad');
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------------------------
// The wizard's demonstration belongs to the GAME (note CD). The engine asks the questions and says at each step WHICH
// position it is asking for; what that position looks like — the platformer's boy climbing a ladder — the game draws.
// The engine draws no game here.
// ---------------------------------------------------------------------------------------------

describe('initGamepad — a demonstração do assistente é do jogo', () => {
  it('[Right] abrir o assistente avisa o jogo com `null` — o passo de antes de qualquer pergunta', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWiz();
    expect(ctx.calls.wizardSteps).toEqual([null]);
  });

  it('[Right] o relógio do assistente chega ao jogo, para uma demonstração que anima', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWiz();
    api.padWizTick();
    expect(ctx.calls.wizardTicks, 'o tique do assistente não chegou à demonstração do jogo').toBeGreaterThan(0);
  });
});

// ===================================================================================================
// THE ONE-BUTTON MODE MUST HOLD ON THE PAD TOO (issue #120)
// ===================================================================================================
// ⚠️ `input/keydown.ts` honours the motor empathy — when a game key arrives with the mode on, ALL the other held game
// keys are released (`releaseKeys`) — and `pollPads` must do the equivalent.
//
// ⚠️ AND THE CHILD HAS NO WAY TO KNOW. They turn the mode on because they need it, and it works — until someone
// connects a pad. No error, no notice, no symptom: the settings say it is on and the device behaves as if it were not.
// It is pillar 2 of ADR-0010 failing silently.
//
// ⚠️ THE DIRECTIONS COUNT, and that is what makes the rule what it is. On the keyboard, `isGameKeyCode` includes
// `p.ctrl`'s keys, which are the four directions — so walking and jumping do NOT coexist with the mode on. A filter that
// spared the directions would be more comfortable and would simulate a different disability.
describe('empatia motora no CONTROLE: um botão por vez (issue #120)', () => {
  const nada = {
    left: false, right: false, up: false, down: false,
    action1: false, action2: false, action3: false, action4: false,
    leftShoulder: false, leftTrigger: false, rightShoulder: false, rightTrigger: false,
    start: false, select: false,
  };
  const ligadas = (a) => Object.keys(a).filter((k) => a[k] === true && !k.startsWith('_')).sort();

  it('[Zero] com o modo DESLIGADO nada é filtrado — duas posições continuam a valer', () => {
    const atual = { ...nada, right: true, action2: true };
    expect(ligadas(oneButtonAtOnce(nada, atual, false))).toEqual(['action2', 'right']);
  });

  it('⚠️ [Right] com o modo ligado, duas ao mesmo tempo viram UMA', () => {
    const atual = { ...nada, right: true, action2: true };
    expect(ligadas(oneButtonAtOnce(nada, atual, true))).toHaveLength(1);
  });

  it('⚠️ [Right] a que já estava em baixo MANTÉM-SE — a nova não a rouba', () => {
    // On the keyboard the new arrival wins because there IS an arrival. On a polled pad there is no "new": there is a
    // snapshot. Keeping the one that already held is what keeps the run button from being cut because the thumb brushed
    // another — and it is the reading ADR-0077 gives to holding.
    const antes = { ...nada, action2: true };
    const atual = { ...nada, action2: true, right: true };
    expect(ligadas(oneButtonAtOnce(antes, atual, true))).toEqual(['action2']);
  });

  it('⚠️ [Right] quando a activa solta, a próxima em baixo assume', () => {
    const antes = { ...nada, action2: true };
    const atual = { ...nada, right: true };
    expect(ligadas(oneButtonAtOnce(antes, atual, true))).toEqual(['right']);
  });

  it('⚠️ [Interface] as DIREÇÕES contam — andar e pular não coexistem', () => {
    const atual = { ...nada, left: true, action2: true };
    const saida = oneButtonAtOnce(nada, atual, true);
    expect(ligadas(saida), 'um filtro que poupe as direções simula outra deficiência').toHaveLength(1);
  });

  it('[Zero] nada apertado continua nada apertado', () => {
    expect(ligadas(oneButtonAtOnce(nada, { ...nada }, true))).toEqual([]);
  });

  it('[Interface] START e SELECT NÃO são cortados — pausar é a saída, não uma jogada', () => {
    // Cutting START would trap the child inside the match: the same reasoning as ADR-0044 («a saída primeiro») and
    // ADR-0090's focus trap. An accommodation that locks in is no accommodation.
    const atual = { ...nada, action2: true, start: true, select: true };
    const saida = oneButtonAtOnce(nada, atual, true);
    expect(saida.start).toBe(true);
    expect(saida.select).toBe(true);
  });

  it('[Interface] não muta o retrato que recebeu', () => {
    const atual = { ...nada, right: true, action2: true };
    const copia = { ...atual };
    oneButtonAtOnce(nada, atual, true);
    expect(atual).toEqual(copia);
  });
});

// ⚠️ AND THE WIRE MUST BE CONNECTED, not just exist. ADR-0090 records facilities the engine BUILT and never wired —
// «ausência seria visível; o objeto TEM uma `nav`, o laço TEM um campo `aoFalhar`, e os dois parecem prontos». A pure
// function, tested and never called, would be one more.
describe('e o modo de um botão está LIGADO no laço de sondagem (issue #120)', () => {
  const comPad = (pressed) => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })] });
    ctx.setPads([makePad({ pressed })]);
    return ctx;
  };

  it('⚠️ [Right] com o modo ligado, duas posições no mesmo quadro deixam UMA no estado', () => {
    estado.setOneButtonValue(true);
    const ctx = comPad([0, 15]); // action2 (A) + D-pad direita
    initGamepad(ctx).pollPads();
    const ligadas = Object.keys(padCur[0]).filter((k) => padCur[0][k] === true && !k.startsWith('_'));
    expect(ligadas, 'o pad ignorou a empatia motora').toHaveLength(1);
  });

  it('[Zero] e com o modo desligado as duas continuam a valer', () => {
    estado.setOneButtonValue(false);
    const ctx = comPad([0, 15]);
    initGamepad(ctx).pollPads();
    const ligadas = Object.keys(padCur[0]).filter((k) => padCur[0][k] === true && !k.startsWith('_'));
    expect(ligadas.length).toBeGreaterThan(1);
  });
});

// ==========================================================================================================
// ⚠️ WHAT THE MAPPING WIZARD SAYS GOES THROUGH `t()` — ALL OF IT, NOT ONLY WHAT HAS AN ACCENT (#123)
//
// This is a SOURCE gate inside a behaviour file, for a measured reason: the `tests/engine-i18n.node.test.js` sieve
// looks for prose by ACCENT or by pt-BR function word, and its own header declares what that lets through. In this
// module it let through three of five — `' — aperte: '`, `'Mapeados: '` and `'. Agora SOLTE tudo.'` have neither accent
// nor a listed word.
//
// The property here does not depend on how the sentence is written: **everything that reaches `wizSay` comes from
// `t(`**. `wizSay` is the only way this wizard speaks — it writes to `#padwiz-prompt` AND announces to the screen reader
// — so holding it holds both outputs at once.
//
// ⚠️ And there is a cause to remember: a `wizSay` parameter named `t` SHADOWS `core/i18n`'s `t` throughout the function.
// It is not an oversight attention avoids; it is a name that closes the door without warning. The `[Interface]` case
// below keeps the name from coming back.
//
// MUTATIONS CHECKED:
//   · putting `wizSay('Aperte QUALQUER botão…')` back → the [Zero] case of everything the wizard says fails, naming the
//     line. (And the `engine-i18n` sieve also fails on this one, because it has an accent.)
//   · putting `wizSay((padWiz.step + 1) + ' de ' + …)` back → [Zero] fails, and `engine-i18n` TOO. ⚠️ The prediction was
//     that it would not, and it was wrong: that line contains `' de '`, and `de` is a function word on the sieve's list.
//     What gets through it is the `' — aperte: '` piece alone.
//   · putting `'Mapeados: ' + (…)` back in the progress footer → the [Right] progress-footer case fails and `engine-i18n`
//     stays GREEN. This is the hole measured instead of supposed: with no accent and no function word, a whole sentence
//     crosses the prose sieve without touching anything.
//   · renaming the `wizSay` parameter back to `t` → the [Interface] no-shadowing case fails.
// ==========================================================================================================
describe('input/pad-wizard — o assistente de mapeamento fala por t(), sem excepção (#123, pilar 3)', () => {
  // 📌 The wizard moved to `input/pad-wizard` (issue #182): its sentences are said THERE, through `ctx.dizer` and
  // `ctx.progresso`, and the host only shows them. Each rule below first finds its subject, so a move cannot leave it green
  // measuring nothing.
  const FONTE = readFileSync(join(process.cwd(), 'app', 'js', 'input', 'pad-wizard.ts'), 'utf8')
    .split(String.fromCharCode(13)).join('');
  const CODIGO = FONTE.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => !/^\s*(\/\/|\*|\/\*)/.test(l));

  it('⚠️ [Zero] tudo o que o assistente fala vem de t( — nenhuma chamada com literal', () => {
    const falas = CODIGO.filter(([, l]) => /ctx\.say\s*\(/.test(l));
    expect(falas.length, 'ninguem fala pelo assistente; rever este caso').toBeGreaterThan(0);
    const crus = falas
      .filter(([, l]) => !/ctx\.say\s*\(\s*t\s*\(/.test(l) && !/ctx\.say\s*\(\s*phrase\s*\)/.test(l))
      .map(([n, l]) => `${n}: ${l.trim()}`);
    expect(crus, 'o assistente fala uma frase que nao passa por t()').toEqual([]);
    // the one `ctx.dizer(frase)` is `comecar`'s, and every caller of `comecar` hands it a `t(`
    const comecos = CODIGO.filter(([, l]) => /begin\s*\(/.test(l) && !/function begin/.test(l));
    expect(comecos.length).toBeGreaterThan(0);
    for (const [n, l] of comecos) expect(l, `linha ${n}`).toMatch(/t\s*\(\s*'pad\.wiz\./);
  });

  it('[Right] e o rodape de progresso tambem — ou apaga, ou passa por t(', () => {
    const escritas = CODIGO.filter(([, l]) => /ctx\.progress\s*\(/.test(l));
    expect(escritas.length, 'ninguem escreve no rodape de progresso; rever este caso').toBeGreaterThan(0);
    const crus = escritas
      .filter(([, l]) => !/ctx\.progress\s*\(\s*''\s*\)/.test(l) && !/ctx\.progress\s*\(\s*t\s*\(/.test(l))
      .map(([n, l]) => `${n}: ${l.trim()}`);
    expect(crus, 'o rodape de progresso recebe texto que nao passa por t()').toEqual([]);
    expect(escritas.some(([, l]) => /t\s*\(\s*'pad\.wiz\.mapped'/.test(l)),
      'a frase do progresso deixou de usar a chave').toBe(true);
  });

  it('⚠️ [Interface] nada no assistente sombreia o t do core/i18n', () => {
    // A parameter or a local named `t` makes translating impossible where it is in scope — and nothing errors.
    expect(FONTE, 'o assistente deixou de importar t').toMatch(/import \{ t \} from '\.\.\/core\/i18n\.js'/);
    const sombras = CODIGO.filter(([, l]) => /\(\s*t\s*[:,)]|\bconst t\b|\blet t\b/.test(l)).map(([n, l]) => `${n}: ${l.trim()}`);
    expect(sombras, 'um t local fecha a porta outra vez').toEqual([]);
  });

  it('[Interface] as cinco chaves existem nos tres dicionarios', () => {
    const CHAVES = ['pad.wiz.step', 'pad.wiz.mapped', 'pad.wiz.pressAny', 'pad.wiz.detected', 'pad.wiz.releaseAll'];
    for (const lang of ['pt', 'en', 'es']) {
      const d = readFileSync(join(process.cwd(), 'app', 'js', 'i18n', lang + '.ts'), 'utf8');
      for (const k of CHAVES) expect(d, `${lang} nao tem ${k}`).toContain("'" + k + "'");
    }
  });
});
