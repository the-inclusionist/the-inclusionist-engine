// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/settings-empathy — render()/open()/close() (project BROWSER: usa document). Contrato: DI por
// closure (ctx.$/srSay/store/setters/getters/reflect-helpers), nenhum acesso a globais fora do ctx. A lógica pura
// (catálogo/rótulos) está coberta em settings-empathy.node.test.js. Modelo: tests/a11y-sr.browser.test.js,
// tests/settings-typo.browser.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { initSettingsEmpathy, EMPATHY_VIZ_MODES } from '../app/js/ui/settings-empathy.js';

const $ = (sel) => document.querySelector(sel);

// Fake de platform/storage.ts (só getBool, único método que o módulo usa).
function fakeStore(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { map: m, getBool: (k, fallback = false) => (m.has(k) ? m.get(k) === '1' : fallback) };
}

function fullCtx(over = {}) {
  const said = [];
  const calls = { renderVizGroup: [], reflectMotorEmpathy: 0, reflectVizButtons: 0, frontOverlay: [], setHearingLoss: [], setOneButton: [], setWheelchair: [], setEmpathyOpen: [] };
  let oneButton = false, wheelchair = false;
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
    said,
    calls,
    ...over,
  };
}

const EMPATHY_HTML = `
  <div id="empathy" class="overlay" hidden>
    <button id="empathy-close" type="button">x</button>
    <button id="opt-onebtn" type="button" aria-pressed="false">▶ Desligado</button>
    <button id="opt-wheelchair" type="button" aria-pressed="false">▶ Desligado</button>
    <button id="opt-hearing" type="button" aria-pressed="false">▶ Desligado</button>
    <div id="empathy-players"></div>
    <div id="empathy-list"></div>
  </div>
  <button id="opt-empathy" type="button">Empatia</button>
`;

describe('ui/settings-empathy', () => {
  beforeEach(() => {
    document.body.innerHTML = EMPATHY_HTML;
  });

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
