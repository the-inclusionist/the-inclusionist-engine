// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de input/touch — render/DOM real (project BROWSER: usa document + querySelector). Injeção por closure
// (mesmo padrão de ui/settings-motion.browser.test.js): ctx com $/srSay/store/root/isMobile/viewport/
// frontOverlay/onPadDesignApplied FALSOS (spies), mas `players`/`numPlayers`/`phase` (core/state.js) e
// `setMinimapCorner` (render/minimap.js) são os módulos REAIS — os mesmos que initTouch importa direto.
import { describe, it, expect, beforeEach } from 'vitest';
import { initTouch } from '../app/js/input/touch.js';
import { players, setNumPlayersValue, setPhaseValue } from '../app/js/core/state.js';
import { getMinimap } from '../app/js/render/minimap.js';

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
    $,
    srSay: (t) => calls.srSay.push(t),
    store,
    root: document.documentElement,
    isMobile: () => false,
    viewport: () => ({ w: 1280, h: 800 }),
    frontOverlay: (el) => calls.frontOverlay.push(el),
    onPadDesignApplied: () => { calls.onPadDesignApplied++; },
    ...over,
  };
  return { ctx, calls, store };
}

beforeEach(() => {
  markup();
  players.length = 0;
  players.push({ quiz: false });
  setNumPlayersValue(1);
  setPhaseValue('playing');
});

describe('initTouch — boot', () => {
  it('[Right] roda applyPadDesign/applyPadPhysical/applyDirStyle sem lançar, mesmo com painel vazio de #pad-diamond', () => {
    document.body.innerHTML = ''; // sem NENHUM elemento do módulo — todo `if(el)` deve proteger
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
  it('[Right] popula #touchmap-list com 9 linhas (uma por slot) e persiste ao trocar', () => {
    const { ctx, calls, store } = makeCtx();
    const api = initTouch(ctx);
    api.renderTouchMap();
    const selects = document.querySelectorAll('#touchmap-list select[data-slot]');
    expect(selects.length).toBe(9);
    const b0 = document.querySelector('#tm-b0');
    b0.value = 'run';
    b0.dispatchEvent(new Event('change'));
    expect(api.getTouchMap().b0).toBe('run');
    expect(JSON.parse(store.get('incl_touchmap')).b0).toBe('run');
    expect(calls.srSay.some((s) => s.includes('Correr'))).toBe(true);
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
});

describe('initTouch — hideTouchControls / showTouchControls', () => {
  it('[Right] showTouchControls: desoculta #touch-controls, marca body.touch-mode, mexe no minimapa', () => {
    const { ctx } = makeCtx();
    const api = initTouch(ctx);
    api.showTouchControls();
    expect($('#touch-controls').hidden).toBe(false);
    expect(document.body.classList.contains('touch-mode')).toBe(true);
    expect(getMinimap()).toBeNull(); // sem initMinimap() no teste — setMinimapCorner() só faz no-op seguro
  });
  it('[Inverse] hideTouchControls desfaz o showTouchControls', () => {
    const { ctx } = makeCtx();
    const api = initTouch(ctx);
    api.showTouchControls();
    api.hideTouchControls();
    expect($('#touch-controls').hidden).toBe(true);
    expect(document.body.classList.contains('touch-mode')).toBe(false);
  });
  it('[Boundary] com mais de 1 jogador, showTouchControls não faz nada (multi-tela = sem toque, ambíguo)', () => {
    setNumPlayersValue(2);
    const { ctx } = makeCtx();
    const api = initTouch(ctx);
    api.showTouchControls();
    expect($('#touch-controls').hidden).toBe(true);
  });
  it('[Boundary] fora de "playing" (menu/pausa), showTouchControls não faz nada', () => {
    setPhaseValue('paused');
    const { ctx } = makeCtx();
    const api = initTouch(ctx);
    api.showTouchControls();
    expect($('#touch-controls').hidden).toBe(true);
  });
  it('[Boundary] com quiz aberto num jogador, showTouchControls não faz nada', () => {
    players[0].quiz = true;
    const { ctx } = makeCtx();
    const api = initTouch(ctx);
    api.showTouchControls();
    expect($('#touch-controls').hidden).toBe(true);
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
  it('[Right] preset "mão de criança" ajusta os 5 valores de uma vez e persiste todos', () => {
    const { ctx, store, calls } = makeCtx();
    initTouch(ctx);
    $('#pad-preset-child').click();
    expect(store.get('incl_padbtnmm')).toBe('12');
    expect(store.get('incl_padstickmm')).toBe('16.5');
    expect(calls.srSay.some((s) => s.includes('criança'))).toBe(true);
  });
  it('[Right] preset "mão de adulto" idem, valores maiores', () => {
    const { ctx, store } = makeCtx();
    initTouch(ctx);
    $('#pad-preset-adult').click();
    expect(store.get('incl_padbtnmm')).toBe('14');
    expect(store.get('incl_paddpadmm')).toBe('14');
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
    expect(calls.onPadDesignApplied).toBeGreaterThan(0); // hook p/ a legenda Sim/Não da pausa (fora deste módulo)
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
