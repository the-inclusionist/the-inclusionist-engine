// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-visual (BROWSER project: uses document). Contract: initSettingsVisual(ctx) never touches
// localStorage directly — every piece of state that is not its own (lq/ownerColors/cbSafe/outlines/role colors/
// selVizPlayer/setPlayerViz) arrives by injection, and the players come from the file's local round double. DI by
// closure — model: tests/debug-panel.browser.test.js.
// See docs/5-Refactoring/plan-modularization-map.md (Stage 4, ui/settings-visual).
import { describe, it, expect, beforeEach } from 'vitest';
import { axesHtml } from '../app/js/ui/visual-axes-panel.js';
import { DEFAULT_VISUAL, migrateVisual } from '../app/js/render/viz-axes.js';
import { createTranslator as translatorOfThisFile } from '../app/js/core/i18n.js'; // VIZ_MODES holds KEYS (item 14)
const { t } = translatorOfThisFile(); // pt: `core/i18n` holds no state (ADR-0232 D3)
import { initSettingsVisual } from '../app/js/ui/settings-visual.js';
import { ROLE_KEYS, ROLE_LABELS } from '../app/js/ui/visual-choices.js';
import pt from '../app/js/i18n/pt.js';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
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


const PANEL_HTML =
  '<div id="visual"><div id="visual-modes"></div><div id="visual-list"></div>' +
  // The two outline selects live inside a `.ctrl-row` in the real document. ADR-0029's mark looks for their row, and
  // a fixture less faithful than the document would not test exactly what the mark needs.
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
    renderVizGroup: [],
    renderVisualAxes: [],
  };
  const ctx = {
    t: translate,
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    $: (sel) => document.querySelector(sel),
    srSay: (t) => calls.srSay.push(t),
    getVisualSettings: () => ({ ...state, roleColors: { ...state.roleColors } }),
    getSelectedPlayer: () => selected,
    setSelectedPlayer: (i) => { selected = i; calls.setSelectedPlayer.push(i); },
    setPlayerViz: (i, mode) => calls.setPlayerViz.push([i, mode]),
    // ⚠️ A DOUBLE OF THE TWO AXES (#104). This panel does not use `renderVizGroup` — which stays with the EMPATHY menu,
    // whose list of simulations really is exclusive — and mounts two radio groups, one per axis. The double uses the REAL
    // generator (`axesHtml`), not an imitation: a double that invents the markup stops failing when the real markup changes.
    renderVisualAxes: (listSel, tabsSel) => {
      calls.renderVisualAxes.push([listSel, tabsSel]);
      const el = document.querySelector(listSel);
      if (!el) return;
      el.innerHTML = axesHtml(players[selected]?.visual ?? DEFAULT_VISUAL, t);
    },
    // A double of the row renderer the empathy panel uses (`renderVizGroup`, render/viz-setters). This panel draws
    // through `renderVisualAxes` instead, so this double is not called by it.
    renderVizGroup: (listSel, tabsSel, modes) => {
      calls.renderVizGroup.push([listSel, tabsSel, modes]);
      const el = document.querySelector(listSel);
      if (!el) return;
      const cur = players[selected] ? players[selected].viz : 'normal';
      el.innerHTML = modes.map((m) =>
        `<div class="ctrl-row"><span><strong>${t(m.nome)}</strong> ${t(m.desc)}</span>` +
        `<button data-viz="${m.key}" type="button" aria-pressed="${m.key === cur}"></button></div>`).join('');
      el.querySelectorAll('button[data-viz]').forEach((b) => b.addEventListener('click', () => {
        calls.setPlayerViz.push([selected, b.dataset.viz]);
      }));
    },
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

  it('[Interface] render() monta o slider L→Q, os toggles e os 4 seletores de cor', () => {
    players.push({ viz: 'hc-direto-45' });
    const { ctx } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    const list = document.querySelector('#visual-list');
    expect(list.querySelector('#opt-lq')).toBeTruthy();
    expect(list.querySelector('#opt-ownercolors')).toBeTruthy();
    expect(list.querySelector('#opt-cbsafe')).toBeTruthy();
    for (const k of ['hazard', 'climb', 'water', 'gate']) expect(list.querySelector('#opt-role-' + k)).toBeTruthy();
    expect(list.querySelector('#opt-role-reset')).toBeTruthy();
  });

  // ===================== THE «SAIU DO PADRÃO» MARK, PER AXIS (ADR-0029 · #61) =====================
  // 🔴 With two axes inside `#visual-modes` (#104 step 4d), ONE mark on the container would not say WHICH one left the
  // default — exactly ADR-0029's third channel losing information: «a criança cega percorre o menu e OUVE, em ordem, o
  // que saiu do padrão». Hearing «mudado» without knowing about what sends her searching through eight rows.
  //
  // ⚠️ AND THE MARK IS NOT COMPUTED FROM THE OBSOLETE MIRROR (`p.viz`, which #104 step 1a marked `@deprecated`). The
  // predicate that answers this exact question lives in the new model: `DEFAULT_VISUAL` of `render/viz-axes`.
  const linhaDoEixo = (eixo) => document.querySelector(`#visual-modes button[data-eixo="${eixo}"][aria-checked="true"]`)
    ?.closest('.ctrl-row') ?? null;
  const marcada = (el) => !!el && el.classList.contains('is-changed');

  it('🎯 [Right] só o eixo que SAIU do padrão fica marcado — o outro não', () => {
    players.push({ viz: 'hc7', visual: { ...DEFAULT_VISUAL, tema: 'hc7' } });
    initSettingsVisual(makeCtx().ctx).render();
    expect(marcada(linhaDoEixo('tema')), 'o tema saiu do padrão e não foi marcado').toBe(true);
    expect(marcada(linhaDoEixo('correcao')), 'a correção está no padrão e foi marcada').toBe(false);
  });

  it('🎯 [Right] e ao contrário: só a correção', () => {
    players.push({ viz: 'fix-deuter', visual: { ...DEFAULT_VISUAL, correcao: 'deuter' } });
    initSettingsVisual(makeCtx().ctx).render();
    expect(marcada(linhaDoEixo('correcao'))).toBe(true);
    expect(marcada(linhaDoEixo('tema'))).toBe(false);
  });

  it('⚠️ [Boundary] os DOIS ao mesmo tempo — o caso que o campo único não exprimia', () => {
    // `hc7 + deuter` is the pair the whole of #104 existed to make possible. If the mark still came from the mirror, it
    // would have to pick one of the two to report.
    players.push({ viz: 'hc7', visual: { tema: 'hc7', correcao: 'deuter', simulacao: null } });
    initSettingsVisual(makeCtx().ctx).render();
    expect(marcada(linhaDoEixo('tema'))).toBe(true);
    expect(marcada(linhaDoEixo('correcao'))).toBe(true);
  });

  it('⚠️ [Zero] uma SIMULAÇÃO não marca este menu — a marca é do menu de empatia', () => {
    // With two axes this rule is STRUCTURAL rather than derived: the simulation lives in another field of `VisualState`,
    // so asking about the theme and the correction never reaches it.
    players.push({ viz: 'sim-deuter', visual: migrateVisual('sim-deuter') });
    initSettingsVisual(makeCtx().ctx).render();
    expect(marcada(linhaDoEixo('tema')), 'a simulação marcou o menu errado').toBe(false);
    expect(marcada(linhaDoEixo('correcao')), 'a simulação marcou o menu errado').toBe(false);
  });

  it('⚠️ [Right] o botão que ABRE o menu fica marcado quando qualquer um dos eixos saiu', () => {
    // The channel that brings the child here: without it, she would have to open every menu to find where she changed things.
    players.push({ viz: 'normal', visual: { ...DEFAULT_VISUAL, correcao: 'protan' } });
    initSettingsVisual(makeCtx().ctx).render();
    expect(document.querySelector('[data-act="visual"]').classList.contains('is-changed')).toBe(true);
  });

  it('⚠️ [Right] o modo visual é desenhado em DOIS rádios — um por eixo (#104)', () => {
    // What this case protects is FINDABILITY: the colour-blindness corrections were visible rows in the empathy menu, and
    // a `<select>` would hide them. For a control made to be found by whoever sees poorly, that is almost not having moved.
    //
    // ⚠️ And seven options in a single list would tell an exclusivity that DOES NOT EXIST: there are two axes, and each
    // can be off the default at the same time as the other.
    players.push({ viz: 'normal', visual: DEFAULT_VISUAL });
    const { ctx, calls } = makeCtx();
    initSettingsVisual(ctx).render();
    const [listSel] = calls.renderVisualAxes.at(-1);
    expect(listSel).toBe('#visual-modes');
    const html = document.querySelector('#visual-modes').innerHTML;
    for (const v of ['padrao', 'hc3', 'hc45', 'hc7']) expect(html, `tema ${v}`).toContain(`data-valor="${v}"`);
    for (const v of ['tricro', 'protan', 'deuter', 'tritan']) expect(html, `correção ${v}`).toContain(`data-valor="${v}"`);
    expect(html, 'voltou a ser uma caixa fechada').not.toContain('<select');
    // OITO linhas: quatro temas + quatro correcoes. Eram sete numa lista so.
    expect(document.querySelectorAll('#visual-modes .ctrl-row')).toHaveLength(8);
    expect(document.querySelector('#visual-modes').textContent).toContain('Correção deuteranopia');
  });

  it('⚠️ [Boundary] com uma SIMULAÇÃO ligada, os dois eixos aparecem no PADRÃO (#104)', () => {
    // ⚠️ With the split, a simulation is a thing apart, and the two axes say what they say: they are at the default —
    // which is exactly the condition ADR-0076 requires for a simulation to run. (With a single field, a simulation left
    // this menu mute about its settings, when the child might be looking at it precisely to know where she was.)
    players.push({ viz: 'sim-deuter', visual: migrateVisual('sim-deuter') });
    const { ctx } = makeCtx();
    initSettingsVisual(ctx).render();
    const marcadas = [...document.querySelectorAll('#visual-modes button[aria-checked="true"]')]
      .map((b) => b.dataset.valor);
    expect(marcadas).toEqual(['padrao', 'tricro']);
  });

  it('[Boundary] jogador selecionado além da contagem atual é reclampado para 0 (jogador saiu)', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls, getSelected } = makeCtx();
    ctx.getSelectedPlayer = () => 3; // left over from when there were more players
    const panel = initSettingsVisual(ctx);
    panel.render();
    expect(calls.setSelectedPlayer).toContain(0);
  });

  it('⚠️ [Interface] o painel DELEGA o desenho e a escrita ao renderizador dos eixos (#104)', () => {
    // The click is not this panel's: what wires the button to the PER-AXIS writer is `renderVisualAxes`, in
    // `render/viz-setters`, and it has its own case there. What THIS panel still promises is calling it with the right
    // selector — and that is what is asserted here, instead of reimplementing the wiring inside the double and ending up
    // measuring the double.
    players.push({ viz: 'normal', visual: DEFAULT_VISUAL });
    const { ctx, calls } = makeCtx();
    initSettingsVisual(ctx).render();
    expect(calls.renderVisualAxes.at(-1)).toEqual(['#visual-modes', '#visual-players']);
  });

  it('🔴 [Right] o realce de contraste são PASSOS ⯇ ⯈: um passo grava a posição, anuncia, e não há barra (ADR-0151)', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    initSettingsVisual(ctx).render();
    const passos = document.querySelector('#opt-lq');
    expect(passos?.hasAttribute('data-passos'), 'o realce não virou passos').toBe(true);
    expect(document.querySelector('#visual-list input[type="range"]'), 'sobrou a barra').toBeNull();
    const antes = passos.getAttribute('aria-valuetext');
    passos.querySelector('[data-passo="1"]').click();
    expect(calls.setLq.at(-1), 'o passo não gravou a posição seguinte').toBeGreaterThan(0);
    expect(passos.getAttribute('aria-valuetext')).not.toBe(antes);
    expect(calls.srSay.at(-1)).toMatch(/^Realce de contraste: /);
  });

  it('🔴 [Right] a EXPLICAÇÃO nasce num .opt-hint e não colada ao rótulo — o defeito que o Dev viu', () => {
    // «A EXPLICAÇÃO ESTÁ NA OPÇÃO AO INVÉS DE IR PARA O RODAPÉ, CORRIJA». With an .opt-hint `fillExplain` takes it to the
    // footer; and the <strong> keeps only the short label, without the «(Linear → Quadrático)» that made it long.
    players.push({ viz: 'normal' });
    const { ctx } = makeCtx();
    initSettingsVisual(ctx).render();
    const linha = document.querySelector('#opt-lq').closest('.ctrl-row');
    // 📌 And the label lives INSIDE the steps, «◀ Realce de contraste: … ▶» (ADR-0130 erratum) — nothing apart.
    expect(linha.querySelector('strong'), 'sobrou um rótulo à esquerda dos passos').toBeNull();
    expect(linha.querySelector('.passo-valor').textContent).toMatch(/^Realce de contraste: /);
    expect(linha.querySelector('.opt-hint')?.textContent, 'a prosa não está no .opt-hint').toMatch(/linear/);
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
    panel.render(); // a 2nd render must NOT duplicate the static selects' listener
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
  // The beforeEach empties `players` — the round double's array, shared by the cases of this file —, so each case plants
  // the player it needs instead of assuming one exists.
  // ⚠️ WRITES BOTH FIELDS, as production's `setPlayerViz` does — deriving the new one through the SAME `migrateVisual`,
// which is what stops the translation from existing in two versions. #104 step 1a made `visual` REQUIRED: a player with
// only the obsolete `viz` is a player the program cannot produce, and a test that goes around the API measures a state
// the game never reaches.
const comViz = (viz) => { players.length = 0; players.push({ viz, visual: migrateVisual(viz) }); };

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
    // Undoing it is legitimate here, and only here: the child finds it again in the SAME selector she just used.
    // The rule is still "a reset may only undo what it can also redo".
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

  it('[Interface] a correção é ESCOLHÍVEL daqui, numa linha visível — a prova de que ela mudou de casa', () => {
    // The correction must be findable here without opening the empathy menu or a `<select>`. This case requires the row.
    const { ctx, calls } = makeCtx();
    comViz('normal');
    initSettingsVisual(ctx).render();
    // ⚠️ THE ROW STILL EXISTS, and that is what the case protects — it lives in the correction AXIS, beside the other
    // three, instead of mixed with the contrast levels in a list where choosing one erased the other.
    const linha = document.querySelector('#visual-modes button[data-valor="deuter"]').closest('.ctrl-row');
    expect(linha.textContent).toContain('Correção deuteranopia');
    // ⚠️ THE CLICK is not asserted here: what wires it to the per-axis writer is `renderVisualAxes`, and it has its own
    // case in `viz-setters`. Asserting it through the double would measure the double.
    expect(linha.querySelector('button').dataset.eixo).toBe('correcao');
  });

  it('⚠️ [Interface] com a correção ligada, a LINHA DELA fica marcada — e já não a lista inteira', () => {
    // ⚠️ With TWO axes inside `#visual-modes` (#104 step 4d), marking the container would certify a mark that does not
    // say WHICH of them left the default.
    //
    // 📌 So the mark sits where there is a NAME: the container has no accessible name, the row does. It is ADR-0029's
    // third channel — «a criança cega percorre o menu e ouve, em ordem, o que saiu do padrão» — working.
    const { ctx, state } = makeCtx();
    state.outlineFg = 1;
    comViz('fix-tritan');
    initSettingsVisual(ctx).render();
    const linhaDaCorrecao = document.querySelector('#visual-modes button[data-eixo="correcao"][aria-checked="true"]')
      .closest('.ctrl-row');
    expect(linhaDaCorrecao.classList.contains('is-changed'), 'a linha da correção não foi marcada').toBe(true);
    expect(linhaDaCorrecao.textContent, 'marcou a linha errada').toContain('tritanopia');
    expect(document.querySelector('[data-act="visual"]').classList.contains('is-changed')).toBe(true);
  });

  it('[Zero] com tudo no padrão, nenhum setter é chamado', () => {
    const { ctx, calls, state } = makeCtx();
    state.outlineFg = 1; // the fixture is born off the default in this field
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
    // `[255,110,45] === [255,110,45]` is false in JS. That false would send the child to undo what she did not do.
    const { ctx, state } = makeCtx();
    state.outlineFg = 1;
    comViz('normal');
    initSettingsVisual(ctx).render();
    const linha = document.querySelector('#opt-role-reset').closest('.ctrl-row');
    expect(linha.classList.contains('is-changed')).toBe(false);
    expect(document.querySelector('[data-act="visual"]').classList.contains('is-changed')).toBe(false);
  });
});


// ==========================================================================================================
// THIS PANEL'S ROWS, AS NODES (ADR-0129; ADR-0221 step 7c)
//
// 📌 THESE CASES CHANGED PROJECT, not requirement. They measured the STRING `renderVisualPanelHtml` returned; the panel
// builds NODES with the kit, so the string no longer exists and what they assert is observable only in a document.
// Every assertion is here whole — the label, the hint in `.opt-hint`, the state on both channels, one swatch per role
// with the colour and the name of each, and the ↺.
//
// 🎯 AND TWO OF THEM ASSERT MORE THAN BEFORE, because nodes have what the string did not: the steps row SURVIVES a
// render (it used to be rebuilt each time, and the cursor fell out of it), and the listeners are wired only once.
// ==========================================================================================================
describe('ui/settings-visual — o interior montado em nós', () => {
  const montar = (patch = {}) => {
    const feito = makeCtx();
    Object.assign(feito.state, patch);
    const api = initSettingsVisual(feito.ctx);
    api.render();
    return { ...feito, api };
  };
  const linhaDe = (sel) => document.querySelector(sel)?.closest('.ctrl-row') ?? null;
  const dicaDe = (sel) => linhaDe(sel)?.querySelector('.opt-hint')?.textContent ?? null;
  const rotuloDe = (sel) => linhaDe(sel)?.querySelector('strong')?.textContent ?? null;

  it('[Interface] NÃO monta o modo visual — ele saiu daqui para uma lista de rádio própria', () => {
    montar();
    // The visual mode is not a `<select>` inside this interior: it is `#visual-modes`, drawn as visible rows, because the
    // colour-blindness corrections had to stay VISIBLE when they changed menu — inside a closed box they vanished.
    const lista = document.querySelector('#visual-list');
    expect(lista.querySelector('#opt-contrast')).toBeNull();
    expect(lista.querySelector('select')).toBeNull();
  });

  it('🔴 [Right] cada uma das três linhas diz o que o dicionário diz, e a explicação vai para o `.opt-hint`', () => {
    montar();
    for (const [sel, rotulo, dica] of [
      ['#opt-ownercolors', 'visual.dono', 'visual.dono.dica'],
      ['#opt-cbsafe', 'visual.cbsafe', 'visual.cbsafe.dica'],
      ['#opt-role-reset', 'visual.papeis', 'visual.papeis.dica'],
    ]) {
      expect(rotuloDe(sel), `${sel}: o rótulo não é o do dicionário`).toBe(pt[rotulo]);
      expect(dicaDe(sel), `${sel}: a explicação não está no .opt-hint que o rodapé recolhe (CLAUDE.md §4)`).toBe(pt[dica]);
    }
    // 📌 And the list of the four roles did not come back into the sentence: «perigo, escalável, água e portão» are a
    // game's words, and the engine does not describe a game. What names them is each colour's accessible name, by `{param}`.
    expect(pt['visual.papeis.dica']).not.toMatch(/lava|escada|trampolim/);
  });

  it('🎯 [Cross-check] NENHUMA linha fica com o rótulo ou a explicação vazios — a regra, e não uma linha de cada vez', () => {
    // The assertions above NAME three rows, and that is how the safe palette once went without any case. This one
    // measures the rule of `CLAUDE.md` §4 over everything the panel mounts, and the next row inherits it.
    montar();
    const linhas = [...document.querySelectorAll('#visual-list .ctrl-row')];
    expect(linhas.length, 'o painel montou um interior vazio — o caso não mediria nada').toBeGreaterThanOrEqual(4);
    for (const linha of linhas) {
      const forte = linha.querySelector('strong');
      // the STEPS row has no short label on purpose: it lives inside the control (ADR-0130 erratum)
      if (forte) expect(forte.textContent, 'uma linha ficou com o rótulo curto vazio').toBeTruthy();
      const dica = linha.querySelector('.opt-hint');
      expect(dica, 'uma linha ficou sem `.opt-hint` nenhum').not.toBeNull();
      expect(dica.textContent, 'uma linha ficou com a explicação vazia').toBeTruthy();
    }
  });

  it('[Interface] reflete ownerColors/cbSafe LIGADOS nos dois canais — a classe e o estado falado', () => {
    montar({ ownerColors: true, cbSafe: true });
    for (const sel of ['#opt-ownercolors', '#opt-cbsafe']) {
      const b = document.querySelector(sel);
      expect(b.classList.contains('is-on'), sel).toBe(true);
      expect(b.getAttribute('aria-pressed'), sel).toBe('true');
    }
  });

  it('[Interface] e DESLIGADOS, sem a classe e sem o estado', () => {
    montar({ ownerColors: false, cbSafe: false });
    for (const sel of ['#opt-ownercolors', '#opt-cbsafe']) {
      const b = document.querySelector(sel);
      expect(b.classList.contains('is-on'), sel).toBe(false);
      expect(b.getAttribute('aria-pressed'), sel).toBe('false');
    }
  });

  it('[Right] uma amostra de cor por papel, com a cor de agora e o nome de cada uma', () => {
    montar();
    for (const k of ROLE_KEYS) {
      const inp = document.querySelector('#opt-role-' + k);
      expect(inp, `falta a amostra do papel ${k}`).not.toBeNull();
      expect(inp.getAttribute('type')).toBe('color');
      expect(inp.getAttribute('aria-label'), k).toBe(t('visual.papel.cor', { papel: ROLE_LABELS[k] }));
    }
    expect(document.querySelector('#opt-role-hazard').value).toBe('#ff6e2d');
  });

  it('[Zero] e o botão de repor as cores padrão, com nome acessível', () => {
    montar();
    const rr = document.querySelector('#opt-role-reset');
    expect(rr, 'o ↺ não foi montado').not.toBeNull();
    expect(rr.getAttribute('aria-label')).toBe(pt['visual.papel.repor']);
  });

  it('🔴 [Right] a linha dos PASSOS sobrevive a um render — o cursor não sai dela quando a criança mexe noutra', () => {
    // 📏 Measured on 2026-09-23, before the conversion: `render()` rebuilt the interior through `innerHTML`, so the steps
    // control was BUILT AGAIN on every render — a click on any other row took the focus away from it.
    const { api } = montar();
    const antes = document.querySelector('#opt-lq');
    expect(antes, 'o controle de passos não foi montado').not.toBeNull();
    antes.focus();
    api.render();
    expect(document.querySelector('#opt-lq'), 'o controle de passos foi refeito no render').toBe(antes);
    expect(document.activeElement, 'o cursor saiu do controle no render').toBe(antes);
  });

  it('🔴 [Boundary] um clique escreve UMA vez — as escutas não se acumulam a cada render', () => {
    // The pair of the case above: mounting once and relabelling afterwards is only safe if wiring also happens once.
    const { ctx, calls, api } = montar({ cbSafe: false });
    api.render();
    api.render();
    document.querySelector('#opt-cbsafe').click();
    expect(calls.setCbSafe, 'o clique escreveu mais de uma vez: as escutas acumularam-se').toHaveLength(1);
    void ctx;
  });
});
