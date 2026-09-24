// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of input/touch-bindings — what ONLY the browser proves (BROWSER project): the WIRING of pointer listeners. A real
// rectangle (`getBoundingClientRect` of an element with a real size), real pointer capture, real `preventDefault`, real
// `classList`.
//
// The gesture→key translation and the pure geometry are in touch-bindings.node.test.js and are NOT repeated here — what
// this file asserts is always "the EVENT reached the right place", never "the sum is right".
//
// Injection by closure (the same pattern as tests/touch.browser.test.js): the ctx is all fake probes, and the `win` is a
// real ancestor <div> (not `window`), so the listeners do not leak from one case to the next — but really an ancestor,
// or the CAPTURE phase would stop meaning anything.
import { describe, it, expect, beforeEach } from 'vitest';
import { initTouchBindings, START_TAP_MS } from '../app/js/input/touch-bindings.js';

const SOLO = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], action1: ['KeyU'], action2: ['KeyJ', 'Space'], action4: ['KeyI'], action3: ['KeyK'] };
const TOUCH_MAP = { up: 'up', down: 'down', left: 'left', right: 'right', start: 'start', b0: 'action2', b1: 'action3', b2: 'action1', b3: 'action4' };

const $ = (sel) => document.querySelector(sel);

/** The cross and the stick get a REAL size and a fixed position: the direction sum depends on the rectangle.
 *  #touch-controls stays VISIBLE on purpose — with the `hidden` attribute (display:none from the user-agent sheet) every
 *  `getBoundingClientRect()` inside it comes back zeroed and the geometry would have nothing to measure. */
function markup() {
  document.body.innerHTML = `
    <div id="host">
      <div id="touch-controls">
        <div id="touch-cross" style="position:fixed;left:0;top:0;width:200px;height:200px">
          <span class="dpad-arm dpad-up"></span><span class="dpad-arm dpad-down"></span>
          <span class="dpad-arm dpad-left"></span><span class="dpad-arm dpad-right"></span>
        </div>
        <div id="touch-stick" style="position:fixed;left:0;top:300px;width:120px;height:120px">
          <span class="touch-knob"></span>
        </div>
        <button class="touch-btn" type="button" data-btn="0"></button>
        <button class="touch-btn" type="button" data-btn="3"></button>
        <button class="touch-start" id="touch-start" type="button">START</button>
      </div>
    </div>`;
}

let ctx, calls, players, heldKeys, api;

function wire(over = {}) {
  calls = { pause: 0, show: 0, hideTips: 0, defer: [], origens: new Map() };
  players = [{ ctrl: SOLO, easy: false, jumpEdge: false, runEdge: false, leftEdge: false, rightEdge: false, swapEdge: false, specialEdge: false }];
  heldKeys = new Set();
  ctx = {
    $,
    win: $('#host'),
    getSearch: () => '',
    getControls: () => SOLO,
    getPlayers: () => players,
    // ⚠️ The PAIR of `input/state` (ADR-0109): the set is still there to READ, and the two writes are where the source
    // travels. The double stamps into a `Map` so a case can assert the DEVICE, and not only the key — which is what the
    // erasure of §C made impossible.
    heldKeys,
    /*
     * 🔴 THE VIRTUAL CONTROLLER'S DOUBLE (ADR-0223): the pad presses a POSITION, and what takes it to the key, the menu or
     * the cartridge is the controller. The double resolves the position in the scheme and holds the key with the stamp,
     * which is what these cases assert — and returns `true`, because there is no open menu here.
     */
    press: (action, source) => {
      const code = SOLO[action]?.[0];
      if (code) { heldKeys.add(code); calls.origens.set(code, source); }
      return true;
    },
    release: (action, source) => {
      const code = SOLO[action]?.[0];
      if (code) { heldKeys.delete(code); calls.origens.delete(code); }
      void source;
    },
    // The per-player edge (ADR-0113 clause 4). Here it only has to exist: the seat is asserted by the node-project case,
    // where the two schemes fit without a screen.
    playerEdge: () => {},
    attractOnInput: () => false,
    showTouchControls: () => { calls.show++; },
    hideTips: () => { calls.hideTips++; },
    togglePause: () => { calls.pause++; },
    getTouchMap: () => TOUCH_MAP,
    getStartAction: () => 'start',
    getStickTravelPx: () => 42,
    getStickDeadPx: () => 12,
    defer: (fn, ms) => { calls.defer.push([fn, ms]); },
    ...over,
  };
  api = initTouchBindings(ctx);
  api.attach();
  return api;
}

/** A real pointer event (not an object literal): the real `preventDefault` is what matters. */
function ptr(type, { id = 1, x = 0, y = 0 } = {}) {
  return new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true });
}
function fire(el, type, opts) { const e = ptr(type, opts); el.dispatchEvent(e); return e; }

/** The knob's offset, as numbers — the CSSOM re-serialises `translate(0,0)` as `translate(0px, 0px)`, so comparing the
 *  raw string would test the browser's serialisation, not the code. */
function knobXY() {
  const m = /translate\(\s*(-?[\d.]+)(?:px)?\s*,\s*(-?[\d.]+)(?:px)?\s*\)/.exec($('.touch-knob').style.transform);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
}

beforeEach(() => { markup(); });

/* ===================== 1. a guarda de entrada ===================== */

describe('attach — a guarda do IIFE original', () => {
  it('[Zero] sem #touch-controls no documento, attach não amarra NADA (e não estoura)', () => {
    document.body.innerHTML = '<div id="host"></div>';
    wire();
    expect(() => fire($('#host'), 'pointerdown')).not.toThrow();
    expect(calls.show).toBe(0); // not even the global listener was registered
  });

  it('[Right] com ?touch=1, os controles são revelados já na amarração', () => {
    wire({ getSearch: () => '?debug=true&touch=1' });
    expect(calls.show).toBe(1);
  });

  it('[Zero] sem ?touch=1, a amarração não revela nada por conta própria', () => {
    wire();
    expect(calls.show).toBe(0);
  });
});

/* ===================== 2. os dois ouvintes globais ===================== */

describe('o primeiro toque revela os botões — e encerra a demo', () => {
  it('[Right] pointerdown na janela revela os controles', () => {
    wire();
    fire($('#touch-controls'), 'pointerdown');
    expect(calls.show).toBe(1);
  });

  it('[CrossCheck] se a demo estava rodando, o toque só a encerra: NÃO revela', () => {
    wire({ attractOnInput: () => true });
    fire($('#touch-controls'), 'pointerdown');
    expect(calls.show).toBe(0);
  });

  it('[Right] touchstart também revela (aparelho que não emite pointer events)', () => {
    wire();
    $('#touch-controls').dispatchEvent(new Event('touchstart', { bubbles: true }));
    expect(calls.show).toBe(1);
  });
});

/* ===================== 3. the diamond's buttons ===================== */

describe('.touch-btn — a função vem do touchMap, não do data-act', () => {
  const b0 = () => $('.touch-btn[data-btn="0"]');

  it('[Right] pointerdown injeta a tecla e levanta a borda; pointerup a apaga', () => {
    wire();
    fire(b0(), 'pointerdown');
    expect(heldKeys.has('KeyJ')).toBe(true);
    expect(players[0].jumpEdge).toBe(true);
    fire(b0(), 'pointerup');
    expect(heldKeys.has('KeyJ')).toBe(false);
  });

  it('⚠️ [Right] a tecla entra CARIMBADA como `toque` — é a regra 2 do ADR-0109 a tornar-se executável', () => {
    // 📏 What this fixes, measured in issue #114 §C: touch wrote the RAW code into the set, and from then on it was
    // indistinguishable from a keyboard key. The latch is a property of the DEVICE, and the question it asks — «este toque
    // veio de um aparelho com alternância?» — had its answer thrown away before being asked. Now it travels with the key.
    wire();
    fire(b0(), 'pointerdown');
    expect(calls.origens.get('KeyJ'), 'a tecla entrou sem origem').toBe('toque');
    fire(b0(), 'pointerup');
    expect(calls.origens.has('KeyJ'), 'a origem sobreviveu à tecla').toBe(false);
  });

  it('[Right] o slot é lido do touchMap A CADA evento: remapear vale no toque seguinte', () => {
    const map = { ...TOUCH_MAP };
    wire({ getTouchMap: () => map });
    map.b0 = 'action1';                       // the panel remapped button 0 to "run"
    fire(b0(), 'pointerdown');
    expect(heldKeys.has('KeyU')).toBe(true);
    expect(heldKeys.has('KeyJ')).toBe(false);
  });

  it('[Right] o botão 3 vai para `swap` — cada slot tem a sua função', () => {
    wire();
    fire($('.touch-btn[data-btn="3"]'), 'pointerdown');
    expect(heldKeys.has('KeyI')).toBe(true);
    expect(players[0].swapEdge).toBe(true);
  });

  it('[Right] pointerdown e pointerup dão preventDefault (senão o navegador sintetiza clique/scroll)', () => {
    wire();
    expect(fire(b0(), 'pointerdown').defaultPrevented).toBe(true);
    expect(fire(b0(), 'pointerup').defaultPrevented).toBe(true);
  });

  it('[Right] o dedo escorregando para FORA (pointerleave) conta como soltar — senão a tecla fica presa', () => {
    wire();
    fire(b0(), 'pointerdown');
    fire(b0(), 'pointerleave');
    expect(heldKeys.has('KeyJ')).toBe(false);
  });

  it('[Right] pointercancel (o sistema roubou o gesto) também solta', () => {
    wire();
    fire(b0(), 'pointerdown');
    fire(b0(), 'pointercancel');
    expect(heldKeys.has('KeyJ')).toBe(false);
  });

  it('[Right] segurar o botão não abre o menu de contexto do sistema', () => {
    wire();
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    b0().dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });
});

/* ===================== 4. the START button ===================== */

describe('#touch-start', () => {
  it('[Right] com a ação padrão (pause), o clique pausa', () => {
    wire();
    $('#touch-start').click();
    expect(calls.pause).toBe(1);
  });

  it('[Right] com ação momentânea, aperta no clique e agenda o soltar', () => {
    wire({ getStartAction: () => 'action3' });
    $('#touch-start').click();
    expect(heldKeys.has('KeyK')).toBe(true);
    expect(calls.defer[0][1]).toBe(START_TAP_MS);
    calls.defer[0][0]();
    expect(heldKeys.has('KeyK')).toBe(false);
  });
});

/* ===================== 5. a CRUZ direcional ===================== */

describe('#touch-cross — hit-test com retângulo real e captura de ponteiro', () => {
  const cross = () => $('#touch-cross');
  // 200×200 na origem: centro (100,100), zona morta 36 px.

  it('[Zero] tocar o miolo não liga direção nenhuma', () => {
    wire();
    fire(cross(), 'pointerdown', { x: 100, y: 100 });
    expect(heldKeys.size).toBe(0);
  });

  it('[Right] cada braço injeta a tecla da SUA direção', () => {
    wire();
    fire(cross(), 'pointerdown', { x: 10, y: 100 });
    expect([...heldKeys]).toEqual(['KeyA']); // esquerda
    fire(cross(), 'pointerup', { x: 10, y: 100 });
    fire(cross(), 'pointerdown', { x: 100, y: 10 });
    expect([...heldKeys]).toEqual(['KeyW']); // cima
  });

  it('[CrossCheck] esquerda é esquerda e direita é direita (troca de dois = teste vermelho)', () => {
    wire();
    fire(cross(), 'pointerdown', { x: 190, y: 100 });
    expect(heldKeys.has('KeyD')).toBe(true);
    expect(heldKeys.has('KeyA')).toBe(false);
  });

  it('[Right] a seta correspondente ganha a classe `on`, e só ela', () => {
    wire();
    fire(cross(), 'pointerdown', { x: 100, y: 190 });
    expect($('.dpad-down').classList.contains('on')).toBe(true);
    expect($('.dpad-up').classList.contains('on')).toBe(false);
  });

  it('[Right] arrastar de um braço para o outro TROCA a direção: solta a antiga, liga a nova', () => {
    wire();
    fire(cross(), 'pointerdown', { x: 10, y: 100 });
    fire(cross(), 'pointermove', { x: 190, y: 100 });
    expect(heldKeys.has('KeyA')).toBe(false);
    expect(heldKeys.has('KeyD')).toBe(true);
    expect($('.dpad-left').classList.contains('on')).toBe(false);
    expect($('.dpad-right').classList.contains('on')).toBe(true);
  });

  it('[Right] arrastar DENTRO do mesmo braço não RE-DESPACHA a ação (só a MUDANÇA despacha)', () => {
    // A countable probe on purpose: `keys`/edges will NOT do here — a second dispatch of "left on" would be absorbed by
    // the key-already-held guard and the test would pass with the gate's lock removed (measured: the previous version of
    // this case survived the mutation). With left remapped to `pause`, each dispatch becomes a visible togglePause, and the
    // count exposes the re-firing.
    wire({ getTouchMap: () => ({ ...TOUCH_MAP, left: 'start' }) });
    fire(cross(), 'pointerdown', { x: 10, y: 100 });
    expect(calls.pause).toBe(1);
    fire(cross(), 'pointermove', { x: 20, y: 100 });   // mesmo quadrante
    fire(cross(), 'pointermove', { x: 30, y: 100 });
    expect(calls.pause).toBe(1);
  });

  it('[Right] a diagonal liga DUAS direções ao mesmo tempo', () => {
    wire();
    fire(cross(), 'pointerdown', { x: 190, y: 190 });
    expect(heldKeys.has('KeyD')).toBe(true);
    expect(heldKeys.has('KeyS')).toBe(true);
  });

  it('[Right] soltar limpa TUDO: teclas e classes', () => {
    wire();
    fire(cross(), 'pointerdown', { x: 190, y: 190 });
    fire(cross(), 'pointerup', { x: 190, y: 190 });
    expect(heldKeys.size).toBe(0);
    expect($('.dpad-right').classList.contains('on')).toBe(false);
    expect($('.dpad-down').classList.contains('on')).toBe(false);
  });

  it('[Right] `lostpointercapture` (o gesto foi embora sem pointerup) também limpa tudo', () => {
    wire();
    fire(cross(), 'pointerdown', { x: 10, y: 100 });
    cross().dispatchEvent(new Event('lostpointercapture', { bubbles: true }));
    expect(heldKeys.size).toBe(0);
  });

  it('[CrossCheck] um dedo por vez: o SEGUNDO ponteiro não mexe no gesto do primeiro', () => {
    wire();
    fire(cross(), 'pointerdown', { id: 1, x: 10, y: 100 });
    fire(cross(), 'pointermove', { id: 2, x: 190, y: 100 }); // outro dedo, ignorado
    expect(heldKeys.has('KeyA')).toBe(true);
    expect(heldKeys.has('KeyD')).toBe(false);
    fire(cross(), 'pointerup', { id: 2, x: 190, y: 100 });   // and it must not release someone else's gesture
    expect(heldKeys.has('KeyA')).toBe(true);
  });

  it('[Right] pointerdown/move/up dão preventDefault (o navegador não pode rolar a página no gesto)', () => {
    wire();
    expect(fire(cross(), 'pointerdown', { x: 10, y: 100 }).defaultPrevented).toBe(true);
    expect(fire(cross(), 'pointermove', { x: 12, y: 100 }).defaultPrevented).toBe(true);
    expect(fire(cross(), 'pointerup', { x: 12, y: 100 }).defaultPrevented).toBe(true);
  });

  it('[Right] a cruz é REMAPEÁVEL como qualquer botão — a direção física passa pelo touchMap', () => {
    wire({ getTouchMap: () => ({ ...TOUCH_MAP, left: 'action2' }) });
    fire(cross(), 'pointerdown', { x: 10, y: 100 });
    expect(heldKeys.has('KeyJ')).toBe(true);
    expect(heldKeys.has('KeyA')).toBe(false);
  });
});

/* ===================== 6. the STICK ===================== */

describe('#touch-stick — manopla e direções', () => {
  const stick = () => $('#touch-stick');
  // 120×120 em (0,300): centro (60,360); curso 42 px; zona morta 12 px.

  it('[Zero] tocar o centro não liga direção e deixa a manopla no zero', () => {
    wire();
    fire(stick(), 'pointerdown', { x: 60, y: 360 });
    expect(heldKeys.size).toBe(0);
    expect(knobXY()).toEqual([0, 0]);
  });

  it('[Right] a manopla segue o dedo dentro do curso', () => {
    wire();
    fire(stick(), 'pointerdown', { x: 90, y: 360 });
    expect(knobXY()).toEqual([30, 0]);
    expect(heldKeys.has('KeyD')).toBe(true);
  });

  it('[Boundary] passando do curso, a manopla PARA no raio (não acompanha o dedo até o fim da tela)', () => {
    wire();
    fire(stick(), 'pointerdown', { x: 600, y: 360 });
    expect(knobXY()).toEqual([42, 0]);
  });

  it('[Right] soltar recentra a manopla e apaga as teclas', () => {
    wire();
    fire(stick(), 'pointerdown', { x: 600, y: 360 });
    fire(stick(), 'pointerup', { x: 600, y: 360 });
    expect(knobXY()).toEqual([0, 0]);
    expect(heldKeys.size).toBe(0);
  });

  it('[Right] o curso e a zona morta são relidos a CADA movimento (girar o aparelho muda os px)', () => {
    let dead = 12, travel = 42;
    wire({ getStickDeadPx: () => dead, getStickTravelPx: () => travel });
    fire(stick(), 'pointerdown', { x: 80, y: 360 }); // 20 px > 12 → liga
    expect(heldKeys.has('KeyD')).toBe(true);
    dead = 30;                                       // the size panel changed the mm
    fire(stick(), 'pointermove', { x: 80, y: 360 }); // the same 20 px are now the dead centre
    expect(heldKeys.has('KeyD')).toBe(false);
  });
});

/* ===================== 7. window.__incl.showTouch ===================== */

describe('revealForTests', () => {
  it('[Right] revela os controles à força, sem passar pelas guardas de fase/quiz', () => {
    wire();
    $('#touch-controls').hidden = true;
    api.revealForTests();
    expect($('#touch-controls').hidden).toBe(false);
  });
});
