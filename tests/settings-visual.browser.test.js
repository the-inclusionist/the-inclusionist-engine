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
  // Os dois selects de contorno vivem dentro de `.ctrl-row` no documento real. O fixture os tinha soltos, e
  // isso bastava enquanto ninguém procurava a linha deles — a marca do ADR-0029 procura, e um fixture menos
  // fiel que o documento não testaria justamente o que passou a existir.
  '<div class="ctrl-row"><span>Contorno de 1º plano</span>' +
  '<select id="opt-outline-fg"><option value="0">Nenhum</option><option value="1">Fino</option><option value="2">Grosso</option></select></div>' +
  '<div class="ctrl-row"><span>Contorno de 2º plano</span>' +
  '<select id="opt-outline-bg"><option value="0">Nenhum</option><option value="1">Fino</option><option value="2">Grosso</option></select></div>' +
  '<button id="visual-reset" type="button">Restaurar</button></div>' +
  '<button data-act="visual" class="pm-btn" type="button">Acessibilidade visual</button>';

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

describe('ui/settings-visual — restaurar padrões DESTE menu (ADR-0028) + marca (ADR-0029)', () => {
  // O beforeEach zera `players` — ele é o array VIVO de core/state, compartilhado com o resto da suíte —,
  // então cada caso planta o jogador de que precisa em vez de assumir que existe um.
  const comViz = (viz) => { players.length = 0; players.push({ viz }); };

  it('[Right] devolve realce, cores de dono, paleta segura, contornos e cores de papel', () => {
    const { ctx, calls, state } = makeCtx();
    state.lq = 0.6; state.ownerColors = false; state.cbSafe = true; state.outlineFg = 2; state.outlineBg = 0;
    state.roleColors.hazard = [1, 2, 3];
    initSettingsVisual(ctx).render();

    document.querySelector('#visual-reset').click();

    expect(calls.setLq).toEqual([0]);
    expect(calls.setOwnerColors).toEqual([true]);
    expect(calls.setCbSafe).toEqual([false]);
    expect(calls.setOutlineFg).toEqual([1]);
    expect(calls.setOutlineBg).toEqual([1]);
    expect(calls.resetRoleColors).toBe(1);
    expect(calls.srSay.at(-1)).toContain('visual');
  });

  it('[Right] devolve o contraste ao normal quando é um NÍVEL DE CONTRASTE', () => {
    const { ctx, calls } = makeCtx();
    comViz('hc-direto-7');
    initSettingsVisual(ctx).render();
    document.querySelector('#visual-reset').click();
    expect(calls.setPlayerViz).toEqual([[0, 'normal']]);
  });

  it('[Right] a correção de daltonismo AGORA é zerada — ela mudou para este menu (#60)', () => {
    // Desfazê-la é legítimo aqui, e só aqui: a criança a reencontra no MESMO seletor que acabou de usar.
    // A regra continua sendo "um reset só pode desfazer o que ele também consegue refazer".
    const { ctx, calls } = makeCtx();
    comViz('fix-deuter');
    initSettingsVisual(ctx).render();
    document.querySelector('#visual-reset').click();
    expect(calls.setPlayerViz).toEqual([[0, 'normal']]);
  });

  it('[Interface] NÃO apaga as SIMULAÇÕES — essas são do menu de empatia, e `viz` é um campo só', () => {
    for (const modo of ['lv-tunnel', 'blind', 'sim-deuter']) {
      const { ctx, calls } = makeCtx();
      comViz(modo);
      initSettingsVisual(ctx).render();
      document.querySelector('#visual-reset').click();
      expect(calls.setPlayerViz).toEqual([]);
    }
  });

  it('[Interface] o seletor oferece os 7 modos em dois grupos, e a correção é escolhível daqui', () => {
    // A prova de que a mudança de casa chegou à TELA: antes desta issue, uma criança daltônica não tinha
    // como achar a correção dela sem abrir o menu de empatia.
    const { ctx, calls } = makeCtx();
    comViz('normal');
    initSettingsVisual(ctx).render();
    const sel = document.querySelector('#opt-contrast');
    expect(sel.querySelectorAll('optgroup')).toHaveLength(2);
    expect([...sel.querySelectorAll('option')].map((o) => o.value)).toEqual(
      ['normal', 'hc-direto', 'hc-direto-45', 'hc-direto-7', 'fix-protan', 'fix-deuter', 'fix-tritan']);
    sel.value = 'fix-deuter';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(calls.setPlayerViz).toEqual([[0, 'fix-deuter']]);
  });

  it('[Interface] com a correção ligada, a linha do modo visual fica MARCADA', () => {
    const { ctx, state } = makeCtx();
    state.outlineFg = 1;
    comViz('fix-tritan');
    initSettingsVisual(ctx).render();
    const linha = document.querySelector('#opt-contrast').closest('.ctrl-row');
    expect(linha.classList.contains('is-changed')).toBe(true);
  });

  it('[Zero] com tudo no padrão, nenhum setter é chamado', () => {
    const { ctx, calls, state } = makeCtx();
    state.outlineFg = 1; // o fixture nasce fora do padrão neste campo
    comViz('normal');
    initSettingsVisual(ctx).render();
    document.querySelector('#visual-reset').click();
    expect(calls.setLq).toEqual([]);
    expect(calls.setOutlineFg).toEqual([]);
    expect(calls.resetRoleColors).toBe(0);
    expect(calls.setPlayerViz).toEqual([]);
  });

  it('[Right] a marca aparece só nas linhas fora do padrão, e sobe para o botão do menu', () => {
    const { ctx, state } = makeCtx();
    state.outlineFg = 1; state.cbSafe = true;
    comViz('normal');
    initSettingsVisual(ctx).render();
    const linha = (sel) => document.querySelector(sel).closest('.ctrl-row');
    expect(linha('#opt-cbsafe').classList.contains('is-changed')).toBe(true);
    expect(linha('#opt-ownercolors').classList.contains('is-changed')).toBe(false);
    expect(linha('#opt-outline-fg').classList.contains('is-changed')).toBe(false);
    expect(document.querySelector('[data-act="visual"]').classList.contains('is-changed')).toBe(true);
  });

  it('[Boundary] cor de papel IGUAL ao padrão não marca — comparar arrays por identidade diria "alterado"', () => {
    // `[255,110,45] === [255,110,45]` é false em JS. Esse false mandaria a criança desfazer o que não fez.
    const { ctx, state } = makeCtx();
    state.outlineFg = 1;
    comViz('normal');
    initSettingsVisual(ctx).render();
    const linha = document.querySelector('#opt-role-reset').closest('.ctrl-row');
    expect(linha.classList.contains('is-changed')).toBe(false);
    expect(document.querySelector('[data-act="visual"]').classList.contains('is-changed')).toBe(false);
  });
});
