// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de input/touch-bindings — o que SÓ o navegador prova (project BROWSER): o AMARRADO de ouvintes de
// ponteiro. Retângulo de verdade (`getBoundingClientRect` de um elemento com tamanho real), captura de
// ponteiro de verdade, `preventDefault` de verdade, `classList` de verdade.
//
// A tradução gesto→tecla e a geometria pura estão em touch-bindings.node.test.js e NÃO são repetidas aqui —
// o que se afirma neste arquivo é sempre "o EVENTO chegou ao lugar certo", nunca "a conta está certa".
//
// Injeção por closure (mesmo padrão de tests/touch.browser.test.js): o ctx é todo de sondas falsas, e o
// `win` é um <div> ancestral de verdade (e não `window`), para os ouvintes não vazarem de um caso para o
// outro — mas ancestral mesmo, senão a fase de CAPTURA deixaria de significar coisa alguma.
import { describe, it, expect, beforeEach } from 'vitest';
import { initTouchBindings, START_TAP_MS } from '../app/js/input/touch-bindings.js';

const SOLO = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], run: ['KeyU'], jump: ['KeyJ', 'Space'], swap: ['KeyI'], especial: ['KeyK'] };
const TOUCH_MAP = { up: 'up', down: 'down', left: 'left', right: 'right', start: 'pause', b0: 'jump', b1: 'especial', b2: 'run', b3: 'swap' };

const $ = (sel) => document.querySelector(sel);

/** A cruz e o analógico ficam com tamanho REAL e posição fixa: a conta de direção depende do retângulo.
 *  #touch-controls fica VISÍVEL de propósito — com o atributo `hidden` (display:none pela folha do agente)
 *  todo `getBoundingClientRect()` de dentro dele volta zerado e a geometria não teria o que medir. */
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
  calls = { pause: 0, show: 0, hideTips: 0, defer: [] };
  players = [{ ctrl: SOLO, easy: false, jumpEdge: false, runEdge: false, leftEdge: false, rightEdge: false, swapEdge: false, specialEdge: false }];
  heldKeys = new Set();
  ctx = {
    $,
    win: $('#host'),
    getSearch: () => '',
    getControls: () => SOLO,
    getPlayers: () => players,
    heldKeys,
    attractOnInput: () => false,
    showTouchControls: () => { calls.show++; },
    hideTips: () => { calls.hideTips++; },
    togglePause: () => { calls.pause++; },
    getTouchMap: () => TOUCH_MAP,
    getStartAction: () => 'pause',
    getStickTravelPx: () => 42,
    getStickDeadPx: () => 12,
    defer: (fn, ms) => { calls.defer.push([fn, ms]); },
    ...over,
  };
  api = initTouchBindings(ctx);
  api.attach();
  return api;
}

/** Um evento de ponteiro de verdade (não um objeto literal): é o `preventDefault` real que interessa. */
function ptr(type, { id = 1, x = 0, y = 0 } = {}) {
  return new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true });
}
function fire(el, type, opts) { const e = ptr(type, opts); el.dispatchEvent(e); return e; }

/** Deslocamento da manopla, em números — o CSSOM reserializa `translate(0,0)` como `translate(0px, 0px)`,
 *  então comparar a string crua testaria a serialização do navegador, não o código. */
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
    expect(calls.show).toBe(0); // nem o ouvinte global foi registrado
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

/* ===================== 3. os botões do losango ===================== */

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

  it('[Right] o slot é lido do touchMap A CADA evento: remapear vale no toque seguinte', () => {
    const map = { ...TOUCH_MAP };
    wire({ getTouchMap: () => map });
    map.b0 = 'run';                       // o painel remapeou o botão 0 para "correr"
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

/* ===================== 4. o botão START ===================== */

describe('#touch-start', () => {
  it('[Right] com a ação padrão (pause), o clique pausa', () => {
    wire();
    $('#touch-start').click();
    expect(calls.pause).toBe(1);
  });

  it('[Right] com ação momentânea, aperta no clique e agenda o soltar', () => {
    wire({ getStartAction: () => 'especial' });
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
    // Sonda contável de propósito: `keys`/bordas NÃO servem aqui — um segundo despacho de "esquerda ligada"
    // seria absorvido pela guarda de tecla-já-segurada e o teste passaria com a trava do gate removida
    // (medido: a versão anterior deste caso sobrevivia à mutação). Com a esquerda remapeada para `pause`,
    // cada despacho vira um togglePause visível, e a contagem denuncia o re-disparo.
    wire({ getTouchMap: () => ({ ...TOUCH_MAP, left: 'pause' }) });
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
    fire(cross(), 'pointerup', { id: 2, x: 190, y: 100 });   // e não pode soltar o gesto alheio
    expect(heldKeys.has('KeyA')).toBe(true);
  });

  it('[Right] pointerdown/move/up dão preventDefault (o navegador não pode rolar a página no gesto)', () => {
    wire();
    expect(fire(cross(), 'pointerdown', { x: 10, y: 100 }).defaultPrevented).toBe(true);
    expect(fire(cross(), 'pointermove', { x: 12, y: 100 }).defaultPrevented).toBe(true);
    expect(fire(cross(), 'pointerup', { x: 12, y: 100 }).defaultPrevented).toBe(true);
  });

  it('[Right] a cruz é REMAPEÁVEL como qualquer botão — a direção física passa pelo touchMap', () => {
    wire({ getTouchMap: () => ({ ...TOUCH_MAP, left: 'jump' }) });
    fire(cross(), 'pointerdown', { x: 10, y: 100 });
    expect(heldKeys.has('KeyJ')).toBe(true);
    expect(heldKeys.has('KeyA')).toBe(false);
  });
});

/* ===================== 6. o ANALÓGICO ===================== */

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
    dead = 30;                                       // o painel de tamanho mexeu nos mm
    fire(stick(), 'pointermove', { x: 80, y: 360 }); // os mesmos 20 px agora são miolo
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
