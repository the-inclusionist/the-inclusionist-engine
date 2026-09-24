// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of input/touch — real render/DOM (BROWSER project: uses document + querySelector). Injection by closure (the same
// pattern as ui/settings-motion.browser.test.js): a ctx with FAKE $/srSay/store/root/isMobile/viewport/frontOverlay/
// onPadDesignApplied (spies); the round and the phase are local to this file.
import { describe, it, expect, beforeEach } from 'vitest';
import { initTouch } from '../app/js/input/touch.js';
// THE SCENE BELONGS TO THE TEST: the phase is not in `core/state` — it is the `core/scenes` stack, and the three names
// live in the composition root (ADR-0030 C3). What is engine receives BOOLEANS. This `let` plays the root's part, and the
// cases stay written as they were.
let faseFalsa = 'playing';
const setPhaseValue = (p) => { faseFalsa = p; };
/*
 * 🔴 THE ROUND IS A LOCAL DOUBLE (ADR-0228): `core/run-state` went with the tile-world stack to `game-platformer`. This
 * file never tested the round — it HANDS one to what it measures —, and the three members below are exactly the ones it
 * reads. A factory and not a literal: two rounds have to be two objects.
 */
const createRunState = () => ({ numPlayers: 1, players: [], setNumPlayers(n) { this.numPlayers = n; } });
// The round is local to this file (ADR-0038, phase B); the aliases below keep the cases' bodies written as they always were.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);

const $ = (sel) => document.querySelector(sel);

function markup() {
  document.body.innerHTML = `
    <div id="touch-controls" hidden>
      <div id="touch-stick"></div>
      <div id="touch-cross" hidden></div>
      <div id="pad-diamond">
        <button class="pad-b" data-btn="0"></button>
        <button class="pad-b" data-btn="1"></button>
        <button class="pad-b" data-btn="2"></button>
        <button class="pad-b" data-btn="3"></button>
      </div>
    </div>
    <button id="opt-touchcfg" type="button"></button>
    <div id="touchcfg" hidden>
      <select id="pad-dir"><option value="stick">analógico</option><option value="cross">cruz</option></select>
      <input id="pad-size" type="range" min="11" max="16" step="0.5" value="12.5">
      <span id="pad-size-val"></span><span id="pad-size-tag"></span>
      <input id="pad-gap" type="range" min="2" max="6" step="0.5" value="3">
      <span id="pad-gap-val"></span><span id="pad-gap-tag"></span>
      <input id="pad-stick" type="range" min="15" max="22" step="0.5" value="18">
      <span id="pad-stick-val"></span><span id="pad-stick-tag"></span>
      <input id="pad-travel" type="range" min="3" max="7" step="0.5" value="4.5">
      <span id="pad-travel-val"></span><span id="pad-travel-tag"></span>
      <input id="pad-dpad" type="range" min="10" max="16" step="0.5" value="12">
      <span id="pad-dpad-val"></span><span id="pad-dpad-tag"></span>
      <button id="pad-preset-child" type="button"></button>
      <button id="pad-preset-adult" type="button"></button>
      <div id="touchmap-list"></div>
      <button id="touchcfg-close" type="button"></button>
    </div>`;
}

function makeCtx(over = {}) {
  const calls = { srSay: [], frontOverlay: [], set: [], onPadDesignApplied: 0 };
  const backing = new Map();
  const store = {
    get: (k, fb = null) => (backing.has(k) ? backing.get(k) : fb),
    set: (k, v) => { backing.set(k, String(v)); calls.set.push([k, v]); return true; },
    getNum: (k, fb = 0) => (backing.has(k) ? parseFloat(backing.get(k)) : fb),
    getJSON: (k, fb = null) => (backing.has(k) ? JSON.parse(backing.get(k)) : fb),
    setJSON: (k, obj) => backing.set(k, JSON.stringify(obj)),
  };
  const ctx = {
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    $,
    srSay: (t) => calls.srSay.push(t),
    // The positions THIS 'game' uses. Each slot's menu offers the game's positions, not a fixed engine list; in a test,
    // the game is the fixture.
    gameActions: () => [
      { action: 'left', label: 'Andar a esquerda' }, { action: 'right', label: 'Andar a direita' },
      { action: 'up', label: 'Subir' }, { action: 'down', label: 'Descer' },
      { action: 'action2', label: 'Pular' }, { action: 'action1', label: 'Correr' },
      { action: 'action3', label: 'Especial' }, { action: 'action4', label: 'Trocar poder' },
      { action: 'start', label: 'Pausar (START)' },
    ],
    store,
    root: document.documentElement,
    isMobile: () => false,
    viewport: () => ({ w: 1280, h: 800 }),
    frontOverlay: (el) => calls.frontOverlay.push(el),
    onPadDesignApplied: () => { calls.onPadDesignApplied++; },
    // The pad's POLICY comes in through the ctx (item 19). The default is "may": the cases testing the OPPOSITE pass
    // `padAllowed: () => false` and say, in the title, which game condition they represent.
    padAllowed: () => true,
    ...over,
  };
  return { ctx, calls, store };
}

beforeEach(() => {
  markup();
  players.length = 0;
  players.push({}); // this module reads no player (item 19) — the array exists for the rest of the state
  setNumPlayersValue(1);
  setPhaseValue('playing');
});

describe('initTouch — boot', () => {
  it('[Right] roda applyPadDesign/applyPadPhysical/applyDirStyle sem lançar, mesmo com painel vazio de #pad-diamond', () => {
    document.body.innerHTML = ''; // with NONE of the module's elements — every `if(el)` must protect
    const { ctx } = makeCtx();
    expect(() => initTouch(ctx)).not.toThrow();
  });
  it('[Right] escreve as custom properties --pad-* na raiz injetada', () => {
    const { ctx } = makeCtx();
    initTouch(ctx);
    expect(ctx.root.style.getPropertyValue('--pad-btn')).toMatch(/px$/);
    expect(ctx.root.style.getPropertyValue('--stick-base')).toMatch(/px$/);
    expect(ctx.root.style.getPropertyValue('--dpad-span')).toMatch(/px$/);
  });
});

describe('initTouch — renderTouchMap / config de toque', () => {
  it('[Right] popula #touchmap-list com 13 linhas (uma por slot) e persiste ao trocar', () => {
    const { ctx, calls, store } = makeCtx();
    const api = initTouch(ctx);
    api.renderTouchMap();
    const selects = document.querySelectorAll('#touchmap-list select[data-slot]');
    expect(selects.length).toBe(13); // nine up to the four shoulders of ADR-0160
    const b0 = document.querySelector('#tm-b0');
    b0.value = 'action1';
    b0.dispatchEvent(new Event('change'));
    expect(api.getTouchMap().b0).toBe('action1');
    expect(JSON.parse(store.get('incl_touchmap')).b0).toBe('action1');
    expect(calls.srSay.some((s) => s.includes('Correr'))).toBe(true);
  });

  it('[Right] ⚠️ a PALAVRA DO JOGO entra por texto, nunca por markup (issue #106)', () => {
    // A third sink of the same class — all three consume the SAME `gameActions()`, which returns the preset's words. A
    // game lives in another repository (ADR-0083) and this tree does not review its text.
    //
    // ⚠️ AND THE `value="${acao}"` STAYS, which looks inconsistent and is not: `acao` is the ABSTRACT name, enumerated by
    // the engine in `core/actions`. It is ADR-0086's separation — what belongs to the game is the word, not the position —
    // and it is what makes one of the two safe and the other not.
    // ⚠️ THE PAYLOAD CLOSES THE `<option>` AND GETS OUT. See the sibling case in `settings-controls.browser`: an `onerror`
    // is asynchronous and does not fire in time, and checking the final DOM tells nothing apart, because the later
    // `textContent` writes over what `innerHTML` has already parsed. What discriminates is the element that lands OUTSIDE
    // the `textContent` target and therefore survives.
    const { ctx } = makeCtx();
    const FUGA = '</option><option id="fugiu-do-jogo"></option>';
    ctx.gameActions = () => [{ action: 'action1', label: FUGA }];
    initTouch(ctx).renderTouchMap();

    const lista = document.querySelector('#touchmap-list');
    expect(lista.querySelector('#fugiu-do-jogo'), 'a palavra do jogo foi ANALISADA como marcação').toBe(null);
    const op = lista.querySelector('select[data-slot] option');
    expect(op.textContent).toBe(FUGA);
    expect(op.value).toBe('action1'); // o nome abstrato continua no atributo
  });

  // 🔴 THE SIBLING OF `7742ac0`, IN THE MODULE NEXT DOOR. That fix said the screen reader may never say `action2` to a
  // child, and it is ADR-0074's sharpest rule — the fourth gate ADR-0111 owes. Here the slot's announcement fell back to
  // `sel.value`, which IS the abstract name:
  //
  //     acao: escolhida ? escolhida.rotulo : sel.value
  //
  // ⚠️ AND THE FALLBACK IS REACHABLE THROUGH THE SHAPE THIS PROJECT PURSUES, not by accident: `gameActions()` is a
  // cartridge FUNCTION, called again at every `change`. In a single-screen game it always returns the same; in a hub of
  // activities the list changes when the child switches activity, and the `<option>` drawn before is orphaned. Then the
  // `find` fails and the sentence comes out with the id.
  it('[Fronteira] com a lista do jogo trocada por baixo, o anúncio NÃO diz o nome abstrato', () => {
    const { ctx, calls } = makeCtx();
    const api = initTouch(ctx);
    api.renderTouchMap();

    const b0 = document.querySelector('#tm-b0');
    b0.value = 'action3'; // a posição existia no desenho anterior

    // The child switches activity: the new preset names other positions.
    ctx.gameActions = () => [{ action: 'action1', label: 'Responder' }];
    b0.dispatchEvent(new Event('change'));

    const ditos = calls.srSay.join(' | ');
    for (const abstrato of ['action1', 'action2', 'action3', 'action4', 'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger']) {
      expect(ditos, `o leitor de tela disse o id interno «${abstrato}»`).not.toContain(abstrato);
    }
    // 📌 THE SILENT TWIN has to stay closed: silencing the whole announcement would pass the loop above. The child who
    // navigates by ear needs to know her choice landed.
    expect(calls.srSay.length, 'o anúncio sumiu em vez de perder o id').toBeGreaterThan(0);
  });
});

describe('initTouch — openTouchCfg / closeTouchCfg', () => {
  it('[Right] abre: desoculta #touchcfg, chama frontOverlay, foca o 1º select/botão', () => {
    const { ctx, calls } = makeCtx();
    const api = initTouch(ctx);
    api.openTouchCfg();
    expect($('#touchcfg').hidden).toBe(false);
    expect(calls.frontOverlay.length).toBe(1);
  });
  it('[Right] fecha: oculta #touchcfg e devolve o foco a #opt-touchcfg', () => {
    const { ctx } = makeCtx();
    const api = initTouch(ctx);
    api.openTouchCfg();
    api.closeTouchCfg();
    expect($('#touchcfg').hidden).toBe(true);
    expect(document.activeElement).toBe($('#opt-touchcfg'));
  });
  it('[Right] o botão #opt-touchcfg já vem ligado a openTouchCfg() (wiring interno do initTouch)', () => {
    const { ctx } = makeCtx();
    initTouch(ctx);
    $('#opt-touchcfg').click();
    expect($('#touchcfg').hidden).toBe(false);
  });
  it('🔴 [Right] and the panel\'s own close button is wired too — a panel a child can open and not close is a trap', () => {
    const { ctx } = makeCtx();
    initTouch(ctx);
    $('#opt-touchcfg').click();
    $('#touchcfg-close').click();
    expect($('#touchcfg').hidden).toBe(true);
  });
});

describe('initTouch — what the machine kept is what the pad starts with', () => {
  it('🔴 [Right] a stored cross: the selector SHOWS it, and the cross is the one drawn, from the first frame', () => {
    const { ctx, store } = makeCtx();
    store.set('incl_paddir', 'cross');
    initTouch(ctx);
    expect($('#pad-dir').value, 'the selector shows a direction the child did not choose').toBe('cross');
    expect($('#touch-stick').hidden, 'the stick is drawn over a stored cross').toBe(true);
    expect($('#touch-cross').hidden).toBe(false);
  });
  it('🔴 [Right] a stored button design is painted at boot, not only after the next choice', () => {
    const { ctx, store } = makeCtx();
    store.set('incl_paddesign', 'sony');
    initTouch(ctx);
    expect(document.querySelector('.pad-b[data-btn="0"]').textContent).toBe('✕');
  });
  it('📌 [Boundary] an EMPTY stored value is the default, never an empty design or direction', () => {
    const { ctx, store } = makeCtx();
    store.set('incl_paddesign', '');
    store.set('incl_paddir', '');
    const api = initTouch(ctx);
    expect(api.getPadDesign()).toBe('generic');
    expect($('#pad-dir').value).toBe('stick');
  });
  it('🔴 [Right] choosing a direction KEEPS it for the next session', () => {
    const { ctx, store } = makeCtx();
    initTouch(ctx);
    const sel = $('#pad-dir');
    sel.value = 'cross';
    sel.dispatchEvent(new Event('change'));
    expect(store.get('incl_paddir')).toBe('cross');
  });
  it('🔴 [Interface] the window it listens to for a new size is the one the ctx hands it', () => {
    const ouvidos = [];
    const { ctx } = makeCtx({ win: { addEventListener: (tipo) => ouvidos.push(tipo) } });
    initTouch(ctx);
    expect(ouvidos).toEqual(['resize']);
  });
});

describe('initTouch — hideTouchControls / showTouchControls', () => {
  it('[Right] showTouchControls: desoculta #touch-controls, marca body.touch-mode, avisa a raiz', () => {
    const { ctx } = makeCtx();
    const avisos = [];
    const api = initTouch({ ...ctx, onTouchControlsShown: () => avisos.push('shown'), onTouchControlsHidden: () => avisos.push('hidden') });
    api.showTouchControls();
    expect($('#touch-controls').hidden).toBe(false);
    expect(document.body.classList.contains('touch-mode')).toBe(true);
    expect(avisos).toEqual(['shown']);
    api.hideTouchControls();
    expect(avisos, 'the root is not told the pad left — a minimap moved out of its way stays there').toEqual(['shown', 'hidden']);
  });
  it('[Inverse] hideTouchControls desfaz o showTouchControls', () => {
    const { ctx } = makeCtx();
    const api = initTouch(ctx);
    api.showTouchControls();
    api.hideTouchControls();
    expect($('#touch-controls').hidden).toBe(true);
    expect(document.body.classList.contains('touch-mode')).toBe(false);
  });
  it('[Boundary] o jogo dizendo NÃO cala o pad, e é a ÚNICA coisa que este módulo consulta', () => {
    // The module asks `padAllowed()` and nothing else. The conditions that hide the pad (more than one player, outside
    // "playing", a quiz open) are the game's policy and live in the root that answers `padAllowed`, not in the touch layer.
    const { ctx } = makeCtx({ padAllowed: () => false });
    const api = initTouch(ctx);
    api.showTouchControls();
    expect($('#touch-controls').hidden).toBe(true);
  });

  it('[Interface] a resposta é lida A CADA chamada, não guardada no init', () => {
    // Without this, a module reading `padAllowed()` once at init would pass everything above and stay stuck with the first
    // instant's answer — and the pad would never appear again after a pause.
    let pode = false;
    const { ctx } = makeCtx({ padAllowed: () => pode });
    const api = initTouch(ctx);
    api.showTouchControls();
    expect($('#touch-controls').hidden).toBe(true);
    pode = true;
    api.showTouchControls();
    expect($('#touch-controls').hidden).toBe(false);
  });
  it('[Right] o parâmetro `reason` de hideTouchControls é aceito mas ignorado (fachada — mesmo comportamento do original)', () => {
    const { ctx } = makeCtx();
    const api = initTouch(ctx);
    api.showTouchControls();
    api.hideTouchControls('teclado');
    expect($('#touch-controls').hidden).toBe(true);
  });
});

describe('initTouch — applyDirStyle (analógico × cruz)', () => {
  it('[Right] padrão "stick": mostra o analógico, esconde a cruz', () => {
    const { ctx } = makeCtx();
    initTouch(ctx);
    expect($('#touch-stick').hidden).toBe(false);
    expect($('#touch-cross').hidden).toBe(true);
  });
  it('[Right] trocar #pad-dir para "cross" via UI esconde o analógico e mostra a cruz', () => {
    const { ctx, calls } = makeCtx();
    initTouch(ctx);
    const sel = $('#pad-dir');
    sel.value = 'cross';
    sel.dispatchEvent(new Event('change'));
    expect($('#touch-stick').hidden).toBe(true);
    expect($('#touch-cross').hidden).toBe(false);
    expect(calls.srSay.some((s) => s.includes('cruz'))).toBe(true);
  });
});

describe('initTouch — setPadMm / presets (mm reais, WCAG 2.5.5)', () => {
  it('[Right] mover o slider #pad-size chama setPadMm e persiste incl_padbtnmm', () => {
    const { ctx, store } = makeCtx();
    initTouch(ctx);
    const s = $('#pad-size');
    s.value = '14';
    s.dispatchEvent(new Event('input'));
    expect(store.get('incl_padbtnmm')).toBe('14');
    expect($('#pad-size-val').textContent).toBe('14,0 mm');
  });
  it.each([
    ['#pad-size', 'incl_padbtnmm', '14'], ['#pad-gap', 'incl_padgapmm', '5'], ['#pad-stick', 'incl_padstickmm', '20'],
    ['#pad-travel', 'incl_padtravelmm', '6'], ['#pad-dpad', 'incl_paddpadmm', '15'],
  ])('🔴 [Right] every one of the five sliders is wired: %s keeps its own measure (%s)', (id, chave, valor) => {
    // Only the first slider had a case; the other four could lose their listener with the suite green.
    const { ctx, store } = makeCtx();
    initTouch(ctx);
    const s = $(id);
    s.value = valor;
    s.dispatchEvent(new Event('input'));
    expect(store.get(chave)).toBe(valor);
    expect($(`${id}-val`).textContent).toBe(`${valor},0 mm`);
  });
  it('[Right] preset "mão de criança" ajusta os 5 valores de uma vez e persiste todos', () => {
    const { ctx, store, calls } = makeCtx();
    initTouch(ctx);
    $('#pad-preset-child').click();
    expect(store.get('incl_padbtnmm')).toBe('12');
    expect(store.get('incl_padstickmm')).toBe('16.5');
    expect(calls.srSay.some((s) => s.includes('criança'))).toBe(true);
  });
  it('[Right] preset "mão de adulto" idem, valores maiores', () => {
    const { ctx, store, calls } = makeCtx();
    initTouch(ctx);
    $('#pad-preset-adult').click();
    expect(store.get('incl_padbtnmm')).toBe('14');
    expect(store.get('incl_paddpadmm')).toBe('14');
    expect(calls.srSay.some((s) => s.includes('adulto')), 'the adult preset changed five sizes in silence').toBe(true);
  });
  it('[Boundary] tag "mão de criança/adulto/intermediário" reflete a faixa do valor atual', () => {
    const { ctx } = makeCtx();
    initTouch(ctx);
    $('#pad-preset-child').click();
    expect($('#pad-size-tag').dataset.who).toBe('crianca');
    $('#pad-preset-adult').click();
    expect($('#pad-size-tag').dataset.who).toBe('adulto');
  });
});

describe('initTouch — applyPadDesign (rótulos físicos dos botões)', () => {
  it('[Right] repinta os 4 botões de #pad-diamond conforme PAD_DESIGNS[design]', () => {
    const { ctx, calls } = makeCtx();
    const api = initTouch(ctx);
    api.applyPadDesign('sony');
    const btn0 = document.querySelector('.pad-b[data-btn="0"]');
    expect(btn0.textContent).toBe('✕');
    expect(api.getPadDesign()).toBe('sony');
    expect(calls.onPadDesignApplied).toBeGreaterThan(0); // hook for the pause's Yes/No legend (outside this module)
  });
  it('[Inverse] design desconhecido não muda nada (mantém o atual)', () => {
    const { ctx } = makeCtx();
    const api = initTouch(ctx);
    api.applyPadDesign('sony');
    const before = api.getPadDesign();
    api.applyPadDesign('nao-existe');
    expect(api.getPadDesign()).toBe(before);
  });
  it('[Right] persiste incl_paddesign', () => {
    const { ctx, store } = makeCtx();
    const api = initTouch(ctx);
    api.applyPadDesign('microsoft');
    expect(store.get('incl_paddesign')).toBe('microsoft');
  });
});
