// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-controls — render()/handleCaptureKeydown() (project BROWSER: usa document). Contrato: DI
// por closure (ctx.$/srSay/srAlert/store/kb/setKB/kbFor/getNumPlayers/applyControls/assignControls), nenhum
// acesso a globais fora do ctx. A lógica pura (keyName/keyUsedByOther) está coberta em settings-controls.node.test.js.
// Modelo: tests/a11y-sr.browser.test.js, tests/settings-typo.browser.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { initSettingsControls } from '../app/js/ui/settings-controls.js';

const $ = (sel) => document.querySelector(sel);

// Um KB de teste com 2 jogadores (schemes distintos), como o input/keyboard.ts real (solo/p2/p3/p4).
function makeKB() {
  return {
    p2: [
      { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action1: ['KeyU'], action2: ['KeyJ'], action4: ['KeyI'], action3: ['KeyK'] },
      { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], action1: ['Numpad8'], action2: ['Numpad5'], action4: ['Numpad9'], action3: ['Numpad6'] },
    ],
  };
}

// Fábrica do ctx de teste. `kb` é mutável no closure (kbFor sempre lê o valor atual — o "setter" ctx.setKB troca
// essa referência, como o game.js reatribuindo seu `let KB`). said/alerted/applyCalls/store ficam expostos no
// objeto retornado para os testes inspecionarem os efeitos colaterais.
function buildCtx(over = {}) {
  const said = [];
  const alerted = [];
  const applyCalls = { applyControls: 0, assignControls: 0 };
  let kb = makeKB();
  const store = {
    saved: [],
    saveKB(k) { this.saved.push(k); },
    resetKB() { return makeKB(); },
  };
  return {
    $,
    // As posicoes que ESTE 'jogo' usa. Num teste, o jogo e o fixture — e e por isso que a lista
    // vive aqui e nao numa tabela da engine: era a engine a decidir que todo jogo tem quatro verbos.
    acoesDoJogo: () => [
      { acao: 'left', rotulo: 'Esquerda' }, { acao: 'right', rotulo: 'Direita' },
      { acao: 'up', rotulo: 'Subir' }, { acao: 'down', rotulo: 'Descer' },
      { acao: 'action1', rotulo: 'Correr' }, { acao: 'action2', rotulo: 'Pular' },
      { acao: 'action4', rotulo: 'Trocar' }, { acao: 'action3', rotulo: 'Especial' },
    ],
    srSay: (msg) => said.push(msg),
    srAlert: (msg) => alerted.push(msg),
    store,
    kb,
    kbFor: (i) => kb.p2[i] ?? kb.p2[0],
    getNumPlayers: () => 2,
    applyControls: () => { applyCalls.applyControls++; },
    assignControls: () => { applyCalls.assignControls++; },
    setKB: (next) => { kb = next; },
    said, alerted, applyCalls,
    ...over,
  };
}

describe('ui/settings-controls', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ctrl-players"></div><div id="ctrl-list"></div><button id="ctrl-reset"></button>';
  });

  it('[Zero] render() sem #ctrl-list no DOM não lança (só não desenha)', () => {
    document.body.innerHTML = '';
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    expect(() => api.render(0)).not.toThrow();
  });

  it('[Interface] render(0) preenche #ctrl-list com uma linha por ação e o hint de #ctrl-players', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const rows = $('#ctrl-list').querySelectorAll('.ctrl-row');
    expect(rows.length).toBe(8); // as 8 ações de ACT_LABEL
    expect($('#ctrl-players').innerHTML).toContain('2 jogadores');
    expect($('#ctrl-list').innerHTML).toContain('<kbd>A</kbd>'); // KeyA do jogador 0 -> "A"
  });

  it('[Interface] render(0) x render(1) mostram os esquemas de cada jogador (não compartilham)', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(1);
    expect($('#ctrl-list').innerHTML).toContain('↔Left'); // ArrowLeft do jogador 1
  });

  it('[Right] clicar em "Alterar" inicia a captura: isCapturing()=true, texto vira "Pressione…" e srAlert soa', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const btn = $('#ctrl-list').querySelector('button[data-act="action2"]');
    btn.click();
    expect(api.isCapturing()).toBe(true);
    expect(btn.textContent).toBe('Pressione…');
    expect(ctx.alerted).toEqual(['Pressione a nova tecla para Pular do Jogador 1, ou Esc para cancelar.']);
  });

  it('[Right] handleCaptureKeydown com Escape cancela a captura e re-renderiza', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    const e = { code: 'Escape', preventDefault: () => {} };
    const consumed = api.handleCaptureKeydown(e);
    expect(consumed).toBe(true);
    expect(api.isCapturing()).toBe(false);
    expect($('#ctrl-list').querySelector('button[data-act="action2"]').textContent).toBe('Alterar');
  });

  it('[Right] handleCaptureKeydown com tecla livre associa, persiste e propaga', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    const e = { code: 'KeyP', preventDefault: () => {} };
    const consumed = api.handleCaptureKeydown(e);
    expect(consumed).toBe(true);
    expect(api.isCapturing()).toBe(false);
    expect(ctx.kbFor(0).action2).toEqual(['KeyP']);
    expect(ctx.store.saved).toHaveLength(1);
    expect(ctx.applyCalls.applyControls).toBe(1);
    expect(ctx.applyCalls.assignControls).toBe(1);
    expect($('#ctrl-list').querySelector('button[data-act="action2"]').innerHTML).toBe('Alterar');
  });

  it('[Boundary] handleCaptureKeydown com tecla já usada por OUTRO jogador alerta e mantém a captura', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0); // editando o jogador 0
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    const e = { code: 'ArrowLeft', preventDefault: () => {} }; // é do jogador 1 (índice 1)
    const consumed = api.handleCaptureKeydown(e);
    expect(consumed).toBe(true);
    expect(api.isCapturing()).toBe(true); // segue capturando
    expect(ctx.kbFor(0).action2).toEqual(['KeyJ']); // não mudou
    expect(ctx.alerted.at(-1)).toBe('Essa tecla já é do Jogador 2. Escolha outra, ou Esc para cancelar.');
    expect(ctx.store.saved).toHaveLength(0);
  });

  it('[Zero] handleCaptureKeydown sem captura em andamento retorna false e não toca no DOM', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const html = $('#ctrl-list').innerHTML;
    expect(api.handleCaptureKeydown({ code: 'KeyP', preventDefault: () => {} })).toBe(false);
    expect($('#ctrl-list').innerHTML).toBe(html);
  });

  it('[Interface] cancelCapture() encerra a captura sem re-renderizar (fechamento do diálogo)', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    expect(api.isCapturing()).toBe(true);
    api.cancelCapture();
    expect(api.isCapturing()).toBe(false);
  });

  it('[Right] clicar em #ctrl-reset restaura os padrões, propaga, re-renderiza e anuncia', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    // desvia o esquema do jogador 0 do padrão, como se já tivesse sido remapeado antes
    ctx.kbFor(0).jump = ['KeyZ'];
    api.render(0);
    $('#ctrl-reset').click();
    expect(ctx.kbFor(0).action2).toEqual(['KeyJ']); // setKB trocou o KB inteiro pelo default
    expect(ctx.applyCalls.applyControls).toBe(1);
    expect(ctx.applyCalls.assignControls).toBe(1);
    expect(ctx.said).toEqual(['Controles restaurados ao padrão.']);
    expect($('#ctrl-list').innerHTML).toContain('<kbd>J</kbd>'); // voltou ao padrão (KeyJ)
  });

  it('[Cross-check] setKB injetado recebe exatamente o retorno de store.resetKB()', () => {
    const received = [];
    const ctx = buildCtx({ setKB: (next) => received.push(next) });
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-reset').click();
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(makeKB());
  });

  it('[Error] captureMapRef aponta pro objeto do jogador certo mesmo após um render de outro jogador antes', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(1); // edita jogador 1 primeiro
    api.render(0); // depois troca p/ jogador 0
    $('#ctrl-list').querySelector('button[data-act="left"]').click();
    api.handleCaptureKeydown({ code: 'KeyQ', preventDefault: () => {} });
    expect(ctx.kbFor(0).left).toEqual(['KeyQ']);
    expect(ctx.kbFor(1).left).toEqual(['ArrowLeft']); // jogador 1 intocado
  });
});
