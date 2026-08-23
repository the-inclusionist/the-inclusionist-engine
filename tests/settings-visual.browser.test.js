// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/settings-visual (project BROWSER: usa document). Contrato: initSettingsVisual(ctx) NUNCA importa
// game.js nem toca localStorage direto — todo estado que não é dele (lq/ownerColors/cbSafe/outlines/role colors/
// selVizPlayer/setPlayerViz) chega por injeção; só numPlayers/players vêm de core/state.js (binding vivo, como o
// próprio game.js usa). DI por closure — modelo: tests/debug-panel.browser.test.js.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, ui/settings-visual).
import { describe, it, expect, beforeEach } from 'vitest';
import { initSettingsVisual } from '../app/js/ui/settings-visual.js';
import { players, setNumPlayersValue } from '../app/js/core/state.js';

const PANEL_HTML =
  '<div id="visual"><div id="visual-list"></div>' +
  '<select id="opt-outline-fg"><option value="0">Nenhum</option><option value="1">Fino</option><option value="2">Grosso</option></select>' +
  '<select id="opt-outline-bg"><option value="0">Nenhum</option><option value="1">Fino</option><option value="2">Grosso</option></select></div>';

function makeCtx(overrides = {}) {
  const state = {
    lq: 0, ownerColors: true, cbSafe: false, outlineFg: 0, outlineBg: 1,
    roleColors: { hazard: [255, 110, 45], climb: [55, 225, 205], water: [70, 140, 255], gate: [194, 58, 212] },
  };
  let selected = 0;
  const calls = {
    setPlayerViz: [], setLq: [], setOwnerColors: [], setCbSafe: [],
    setOutlineFg: [], setOutlineBg: [], setRoleColor: [], resetRoleColors: 0, srSay: [], setSelectedPlayer: [],
  };
  const ctx = {
    $: (sel) => document.querySelector(sel),
    srSay: (t) => calls.srSay.push(t),
    getVisualSettings: () => ({ ...state, roleColors: { ...state.roleColors } }),
    getSelectedPlayer: () => selected,
    setSelectedPlayer: (i) => { selected = i; calls.setSelectedPlayer.push(i); },
    setPlayerViz: (i, mode) => calls.setPlayerViz.push([i, mode]),
    setLq: (t) => { state.lq = t; calls.setLq.push(t); },
    setOwnerColors: (on) => { state.ownerColors = on; calls.setOwnerColors.push(on); },
    setCbSafe: (on) => { state.cbSafe = on; calls.setCbSafe.push(on); },
    setOutlineFg: (v) => { state.outlineFg = v; calls.setOutlineFg.push(v); },
    setOutlineBg: (v) => { state.outlineBg = v; calls.setOutlineBg.push(v); },
    setRoleColor: (k, hex) => calls.setRoleColor.push([k, hex]),
    resetRoleColors: () => { calls.resetRoleColors++; },
    ...overrides,
  };
  return { ctx, calls, state, getSelected: () => selected };
}

beforeEach(() => {
  document.body.innerHTML = PANEL_HTML;
  players.length = 0;
  setNumPlayersValue(1);
});

describe('ui/settings-visual — initSettingsVisual', () => {
  it('[Zero] sem #visual-list no DOM, render() não quebra', () => {
    document.querySelector('#visual-list').remove();
    const { ctx } = makeCtx();
    const panel = initSettingsVisual(ctx);
    expect(() => panel.render()).not.toThrow();
  });

  it('[Interface] wireOutlineControls sincroniza os selects de contorno já na criação (antes do 1º render)', () => {
    const { ctx } = makeCtx();
    initSettingsVisual(ctx);
    expect(document.querySelector('#opt-outline-fg').value).toBe('0');
    expect(document.querySelector('#opt-outline-bg').value).toBe('1');
  });

  it('[Interface] render() monta o select de contraste, o slider L→Q, os toggles e os 4 seletores de cor', () => {
    players.push({ viz: 'hc-direto-45' });
    const { ctx } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    const list = document.querySelector('#visual-list');
    expect(list.querySelector('#opt-contrast').value).toBe('hc-direto-45');
    expect(list.querySelector('#opt-lq')).toBeTruthy();
    expect(list.querySelector('#opt-ownercolors')).toBeTruthy();
    expect(list.querySelector('#opt-cbsafe')).toBeTruthy();
    for (const k of ['hazard', 'climb', 'water', 'gate']) expect(list.querySelector('#opt-role-' + k)).toBeTruthy();
    expect(list.querySelector('#opt-role-reset')).toBeTruthy();
  });

  it('[Boundary] modo de visão fora dos 4 níveis de contraste vira "normal" no select', () => {
    players.push({ viz: 'sim-deuter' }); // simulação de daltonismo não é um nível de alto contraste
    const { ctx } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    expect(document.querySelector('#opt-contrast').value).toBe('normal');
  });

  it('[Boundary] sem jogador no índice selecionado, assume "normal"', () => {
    const { ctx } = makeCtx(); // players fica vazio
    const panel = initSettingsVisual(ctx);
    panel.render();
    expect(document.querySelector('#opt-contrast').value).toBe('normal');
  });

  it('[Boundary] jogador selecionado além da contagem atual é reclampado para 0 (jogador saiu)', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls, getSelected } = makeCtx();
    ctx.getSelectedPlayer = () => 3; // sobrou de quando havia mais jogadores
    const panel = initSettingsVisual(ctx);
    panel.render();
    expect(calls.setSelectedPlayer).toContain(0);
  });

  it('[Interface] trocar o contraste chama setPlayerViz(jogador, modo) e anuncia o rótulo curto', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    const sel = document.querySelector('#opt-contrast');
    sel.value = 'hc-direto-7';
    sel.dispatchEvent(new Event('change'));
    expect(calls.setPlayerViz).toEqual([[0, 'hc-direto-7']]);
    expect(calls.srSay).toEqual(['Alto contraste: 7:1.']);
  });

  it('[Interface] mexer no slider L→Q chama setLq com t=0..1 e atualiza o rótulo ao vivo', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    const lq = document.querySelector('#opt-lq');
    lq.value = '70';
    lq.dispatchEvent(new Event('input'));
    expect(calls.setLq).toEqual([0.7]);
    expect(document.querySelector('#opt-lq-val').textContent).toBe('quadrático');
  });

  it('[Interface] soltar o slider (change) anuncia o rótulo via srSay', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    const lq = document.querySelector('#opt-lq');
    lq.value = '20';
    lq.dispatchEvent(new Event('change'));
    expect(calls.srSay).toEqual(['Realce de contraste: linear.']);
  });

  it('[Interface] clicar em "Itens na cor do dono" alterna e re-renderiza refletindo o novo estado', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    const btn = document.querySelector('#opt-ownercolors');
    expect(btn.getAttribute('aria-pressed')).toBe('true'); // default ligado
    btn.click();
    expect(calls.setOwnerColors).toEqual([false]);
    expect(document.querySelector('#opt-ownercolors').getAttribute('aria-pressed')).toBe('false');
  });

  it('[Interface] clicar em "Paleta segura para daltonismo" alterna e re-renderiza', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    const btn = document.querySelector('#opt-cbsafe');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    btn.click();
    expect(calls.setCbSafe).toEqual([true]);
    expect(document.querySelector('#opt-cbsafe').getAttribute('aria-pressed')).toBe('true');
  });

  it('[Interface] mudar a cor de um papel chama setRoleColor(chave, hex)', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    const inp = document.querySelector('#opt-role-water');
    inp.value = '#123456';
    inp.dispatchEvent(new Event('change'));
    expect(calls.setRoleColor).toEqual([['water', '#123456']]);
  });

  it('[Interface] clicar em restaurar cores padrão chama resetRoleColors()', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    document.querySelector('#opt-role-reset').click();
    expect(calls.resetRoleColors).toBe(1);
  });

  it('[Interface] os selects de contorno chamam setOutlineFg/setOutlineBg — o listener é anexado só uma vez', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    panel.render(); // um 2º render NÃO deve duplicar o listener dos selects estáticos
    const fg = document.querySelector('#opt-outline-fg');
    fg.value = '2';
    fg.dispatchEvent(new Event('change'));
    expect(calls.setOutlineFg).toEqual([2]); // se tivesse duplicado, viria [2, 2]
  });

  it('[Interface] render() re-sincroniza os selects de contorno com o estado atual', () => {
    players.push({ viz: 'normal' });
    const { ctx, state } = makeCtx();
    state.outlineFg = 2; state.outlineBg = 0;
    const panel = initSettingsVisual(ctx);
    panel.render();
    expect(document.querySelector('#opt-outline-fg').value).toBe('2');
    expect(document.querySelector('#opt-outline-bg').value).toBe('0');
  });
});
