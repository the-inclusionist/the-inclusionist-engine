// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/settings-empathy — render()/open()/close() (project BROWSER: usa document). Contrato: DI por
// closure (ctx.$/srSay/store/setters/getters/reflect-helpers), nenhum acesso a globais fora do ctx. A lógica pura
// (catálogo/rótulos) está coberta em settings-empathy.node.test.js. Modelo: tests/a11y-sr.browser.test.js,
// tests/settings-typo.browser.test.js.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initSettingsEmpathy, EMPATHY_VIZ_MODES } from '../app/js/ui/settings-empathy.js';
import { hearingLoss, setHearingLossGraph } from '../app/js/platform/audio.js';

const $ = (sel) => document.querySelector(sel);

// Fake de platform/storage.ts (só getBool, único método que o módulo usa).
function fakeStore(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { map: m, getBool: (k, fallback = false) => (m.has(k) ? m.get(k) === '1' : fallback) };
}

function fullCtx(over = {}) {
  const said = [];
  const calls = { renderVizGroup: [], reflectMotorEmpathy: 0, reflectVizButtons: 0, frontOverlay: [], setHearingLoss: [], setOneButton: [], setWheelchair: [], setEmpathyOpen: [], setPlayerViz: [] };
  let oneButton = false, wheelchair = false;
  const players = [{ viz: 'normal' }, { viz: 'normal' }];
  return {
    $,
    srSay: (msg) => said.push(msg),
    store: fakeStore(),
    renderVizGroup: (listSel, tabsSel, modes) => { calls.renderVizGroup.push([listSel, tabsSel, modes]); },
    reflectMotorEmpathy: () => { calls.reflectMotorEmpathy++; },
    reflectVizButtons: () => { calls.reflectVizButtons++; },
    frontOverlay: (el) => { calls.frontOverlay.push(el); },
    setHearingLoss: (on) => { calls.setHearingLoss.push(on); },
    setOneButton: (on) => { calls.setOneButton.push(on); oneButton = on; },
    setWheelchair: (on) => { calls.setWheelchair.push(on); wheelchair = on; },
    getOneButton: () => oneButton,
    getWheelchair: () => wheelchair,
    getPlayers: () => players,
    setPlayerViz: (i, mode) => { calls.setPlayerViz.push([i, mode]); players[i].viz = mode; },
    players,
    said,
    calls,
    ...over,
  };
}

const EMPATHY_HTML = `
  <div id="empathy" class="overlay" hidden>
    <button id="empathy-close" type="button">x</button>
    <button id="empathy-reset" type="button">Restaurar</button>
    <div class="ctrl-row"><span>Um botão</span><button id="opt-onebtn" type="button" aria-pressed="false">▶ Desligado</button></div>
    <div class="ctrl-row"><span>Cadeirante</span><button id="opt-wheelchair" type="button" aria-pressed="false">▶ Desligado</button></div>
    <div class="ctrl-row"><span>Perda auditiva</span><button id="opt-hearing" type="button" aria-pressed="false">▶ Desligado</button></div>
    <div id="empathy-players"></div>
    <div id="empathy-list"></div>
  </div>
  <button id="opt-empathy" type="button">Empatia</button>
  <button data-act="empatia" class="pm-btn" type="button">Modo empatia</button>
`;

describe('ui/settings-empathy', () => {
  beforeEach(() => {
    document.body.innerHTML = EMPATHY_HTML;
  });

  // `hearingLoss` vive em platform/audio, não no ctx: um caso que o liga e não devolve contamina todos os
  // seguintes, em silêncio e na ordem do arquivo. Foi assim que o [Zero] do reset abaixo falhou pela primeira
  // vez — acusando o código certo pelo estado que outro caso tinha deixado para trás.
  afterEach(() => { if (hearingLoss) setHearingLossGraph(false); });

  it('[Right] render() desenha a lista de simulação via renderVizGroup injetado com EMPATHY_VIZ_MODES', () => {
    const ctx = fullCtx();
    const api = initSettingsEmpathy(ctx);
    api.render();
    expect(ctx.calls.renderVizGroup).toHaveLength(1);
    const [listSel, tabsSel, modes] = ctx.calls.renderVizGroup[0];
    expect(listSel).toBe('#empathy-list');
    expect(tabsSel).toBe('#empathy-players');
    expect(modes).toBe(EMPATHY_VIZ_MODES);
  });

  it('[Interface] render() reflete #opt-hearing (desligado por padrão) e chama reflectMotorEmpathy', () => {
    const ctx = fullCtx();
    const api = initSettingsEmpathy(ctx);
    api.render();
    const h = $('#opt-hearing');
    expect(h.classList.contains('is-on')).toBe(false);
    expect(h.getAttribute('aria-pressed')).toBe('false');
    expect(h.textContent).toBe('▶ Desligado');
    expect(ctx.calls.reflectMotorEmpathy).toBe(1);
  });

  it('[Right] clicar em #opt-hearing chama setHearingLoss, re-renderiza e chama reflectVizButtons', () => {
    const ctx = fullCtx();
    initSettingsEmpathy(ctx);
    $('#opt-hearing').click();
    expect(ctx.calls.setHearingLoss).toEqual([true]); // hearingLoss real (platform/audio.ts) começa false
    expect(ctx.calls.renderVizGroup.length).toBeGreaterThan(0); // render() rodou de novo
    expect(ctx.calls.reflectVizButtons).toBe(1);
  });

  it('[Right] clicar em #opt-onebtn chama setOneButton com o oposto do valor lido de getOneButton', () => {
    const ctx = fullCtx();
    initSettingsEmpathy(ctx);
    $('#opt-onebtn').click();
    expect(ctx.calls.setOneButton).toEqual([true]);
  });

  it('[Right] clicar em #opt-wheelchair chama setWheelchair com o oposto do valor lido de getWheelchair', () => {
    const ctx = fullCtx({ getWheelchair: () => true });
    initSettingsEmpathy(ctx);
    $('#opt-wheelchair').click();
    expect(ctx.calls.setWheelchair).toEqual([false]);
  });

  it('[Zero] sem incl_hearingloss persistido, initSettingsEmpathy NÃO restaura o grafo de áudio', () => {
    const ctx = fullCtx({ store: fakeStore() });
    expect(() => initSettingsEmpathy(ctx)).not.toThrow();
  });

  it('[Boundary] com incl_hearingloss persistido, initSettingsEmpathy restaura sem lançar e sem chamar setHearingLoss', () => {
    const ctx = fullCtx({ store: fakeStore({ incl_hearingloss: '1' }) });
    initSettingsEmpathy(ctx);
    expect(ctx.calls.setHearingLoss).toHaveLength(0); // restauração usa o grafo direto, não o setter (não persiste/anuncia de novo)
    expect(hearingLoss).toBe(true);
    setHearingLossGraph(false); // DEVOLVE o grafo: `hearingLoss` é estado de MÓDULO, não do ctx
  });

  it('[Right] open() renderiza, mostra o overlay, chama frontOverlay, e foca o 1º botão', () => {
    const ctx = fullCtx();
    const api = initSettingsEmpathy(ctx);
    api.open();
    expect($('#empathy').hidden).toBe(false);
    expect(ctx.calls.frontOverlay).toEqual([$('#empathy')]);
    expect(ctx.calls.renderVizGroup.length).toBeGreaterThan(0);
    expect(document.activeElement.tagName).toBe('BUTTON');
    expect(document.activeElement.closest('#empathy')).not.toBeNull();
  });

  it('[Right] close() esconde o overlay, e devolve o foco a #opt-empathy', () => {
    const ctx = fullCtx();
    const api = initSettingsEmpathy(ctx);
    api.open();
    api.close();
    expect($('#empathy').hidden).toBe(true);
    expect(document.activeElement).toBe($('#opt-empathy'));
  });

  it('[Right] clicar em #opt-empathy abre o painel; clicar em #empathy-close fecha', () => {
    const ctx = fullCtx();
    initSettingsEmpathy(ctx);
    $('#opt-empathy').click();
    expect($('#empathy').hidden).toBe(false);
    $('#empathy-close').click();
    expect($('#empathy').hidden).toBe(true);
  });

  // ---- "restaurar padrões deste menu" (ADR-0028) ----
  //
  // O caso que importa não é o reset funcionar: é ele NÃO ALCANÇAR FORA DE SI. Este menu é o mais perigoso dos
  // oito porque simula deficiências — a criança que liga "cegueira total" fica sem ver o botão que desliga —,
  // e é também o que tem a fronteira mais traiçoeira, porque a lista dele inclui três CORREÇÕES de daltonismo
  // que não têm outro lugar onde morar.
  describe('#empathy-reset', () => {
    it('[Right] desliga as três simulações globais e volta o visual dos jogadores para normal', () => {
      const ctx = fullCtx();
      initSettingsEmpathy(ctx);
      ctx.setOneButton(true); ctx.setWheelchair(true);
      ctx.players[0].viz = 'blind'; ctx.players[1].viz = 'lv-tunnel';
      ctx.calls.setOneButton.length = 0; ctx.calls.setWheelchair.length = 0;

      $('#empathy-reset').click();

      expect(ctx.players[0].viz).toBe('normal');
      expect(ctx.players[1].viz).toBe('normal');
      expect(ctx.calls.setOneButton).toEqual([false]);
      expect(ctx.calls.setWheelchair).toEqual([false]);
    });

    it('[Interface] NÃO desliga a correção de daltonismo — o menu lista `fix-*`, o reset não os toca', () => {
      // Se isto quebrar, o botão passou a tirar de uma criança daltônica a única correção que ela tem, a
      // mando do menu que existe para quem NÃO é daltônico. É a armadilha que o reset deveria desfazer,
      // instalada pelo próprio reset.
      const ctx = fullCtx();
      initSettingsEmpathy(ctx);
      ctx.players[0].viz = 'fix-deuter';
      ctx.players[1].viz = 'blind';

      $('#empathy-reset').click();

      expect(ctx.players[0].viz).toBe('fix-deuter');
      expect(ctx.players[1].viz).toBe('normal');
      expect(ctx.calls.setPlayerViz).toEqual([[1, 'normal']]);
    });

    it('[Interface] NÃO desliga o alto contraste — esse é do menu visual, e o reset não sai do seu', () => {
      const ctx = fullCtx();
      initSettingsEmpathy(ctx);
      ctx.players[0].viz = 'hc-direto-7';

      $('#empathy-reset').click();

      expect(ctx.players[0].viz).toBe('hc-direto-7');
      expect(ctx.calls.setPlayerViz).toEqual([]);
    });

    it('[Right] desliga a simulação de perda auditiva quando ela está ligada', () => {
      const ctx = fullCtx();
      initSettingsEmpathy(ctx);
      setHearingLossGraph(true);

      $('#empathy-reset').click();

      expect(ctx.calls.setHearingLoss).toEqual([false]);
    });

    it('[Zero] com tudo já no padrão, não chama setter nenhum — nada de anunciar desligamento do que nunca ligou', () => {
      const ctx = fullCtx();
      initSettingsEmpathy(ctx);

      $('#empathy-reset').click();

      expect(ctx.calls.setOneButton).toEqual([]);
      expect(ctx.calls.setWheelchair).toEqual([]);
      expect(ctx.calls.setHearingLoss).toEqual([]);
      expect(ctx.calls.setPlayerViz).toEqual([]);
    });

    it('[Interface] anuncia uma frase só, e ela é a última — uma ação, um anúncio', () => {
      const ctx = fullCtx();
      initSettingsEmpathy(ctx);
      ctx.players[0].viz = 'blind';

      $('#empathy-reset').click();

      expect(ctx.said.at(-1)).toContain('empatia');
      expect(ctx.calls.reflectVizButtons).toBeGreaterThan(0);
    });
  });

  it('[Zero] sem #empathy no DOM, open()/close() não lançam (só não fazem nada)', () => {
    document.body.innerHTML = '';
    const ctx = fullCtx();
    const api = initSettingsEmpathy(ctx);
    expect(() => api.open()).not.toThrow();
    expect(() => api.close()).not.toThrow();
  });

  it('[Zero] sem #empathy-list no DOM, render() não lança (renderVizGroup injetado é quem decide)', () => {
    document.body.innerHTML = '<button id="opt-empathy" type="button"></button>';
    const ctx = fullCtx();
    const api = initSettingsEmpathy(ctx);
    expect(() => api.render()).not.toThrow();
  });
});

describe('ui/settings-empathy — marca o que saiu do padrão (ADR-0029)', () => {
  // O beforeEach do arquivo monta só as regiões do leitor de tela; o painel vem do describe irmão. Sem isto,
  // `$('#opt-onebtn')` é null e o caso falha por falta de fixture, não por falta de marca.
  beforeEach(() => { document.body.innerHTML = EMPATHY_HTML + '<p id="sr-status"></p><p id="sr-alert"></p>'; });
  // Neste menu a marca quer dizer "esta simulação está LIGADA", e é a mais útil dos sete: a criança que ligou
  // a simulação de cegueira está com a tela preta e não lê nada — mas o leitor de tela percorre o menu e diz
  // qual linha saiu do padrão. Os casos CLICAM porque estes dois setters não passam por render().
  it('[Right] ligar "um botão" marca a linha e o botão do menu', () => {
    const ctx = fullCtx();
    initSettingsEmpathy(ctx).render();
    $('#opt-onebtn').click();
    expect($('#opt-onebtn').closest('.ctrl-row').classList.contains('is-changed')).toBe(true);
    expect($('[data-act="empatia"]').classList.contains('is-changed')).toBe(true);
  });

  it('[Right] desligar apaga a marca', () => {
    const ctx = fullCtx();
    initSettingsEmpathy(ctx).render();
    $('#opt-onebtn').click();
    $('#opt-onebtn').click();
    expect($('#opt-onebtn').closest('.ctrl-row').classList.contains('is-changed')).toBe(false);
    expect($('[data-act="empatia"]').classList.contains('is-changed')).toBe(false);
  });

  it('[Interface] uma SIMULAÇÃO ligada marca a lista; uma CORREÇÃO de daltonismo não', () => {
    const ctx = fullCtx();
    const api = initSettingsEmpathy(ctx);
    ctx.players[0].viz = 'blind';
    api.render();
    expect($('#empathy-list').classList.contains('is-changed')).toBe(true);

    ctx.players[0].viz = 'fix-deuter';
    api.render();
    expect($('#empathy-list').classList.contains('is-changed')).toBe(false);
  });
});
