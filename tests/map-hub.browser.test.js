// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/map-hub — o que só o DOM de verdade prova (project browser: Chromium/Playwright).
// A parte pura (tabela, habilitação por modo, markup, as duas frases faladas) está em map-hub.node.test.js.
//
// Aqui fica a amarração: `innerHTML` no `#map-hub`, `querySelectorAll('button[data-map]')` e o clique que
// abre o painel certo. E fica também a TESTEMUNHA DE UM DEFEITO: botão com o atributo `disabled` não dispara
// `click` no navegador, então os dois `srAlert` do módulo não são alcançáveis por clique. O caso abaixo
// PINA esse comportamento — se ficar vermelho, alguém trocou `disabled` por `aria-disabled` (que é o conserto
// provável), e aí as frases passam a ser faladas: leia o cabeçalho de app/js/ui/map-hub.ts antes de mexer.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initMapHub, MAP_HUB_ROWS } from '../app/js/ui/map-hub.js';

let host;
const $ = (sel) => document.querySelector(sel);

function mkCtx(np, over = {}) {
  const log = { alerts: [], options: 0, padwiz: 0 };
  const api = initMapHub({
    $, srAlert: (m) => log.alerts.push(m),
    getNumPlayers: () => np,
    openOptions: () => { log.options++; },
    openPadWiz: () => { log.padwiz++; },
    ...over,
  });
  return { api, log };
}

const botoes = () => [...document.querySelectorAll('#map-hub button[data-map]')];

beforeEach(() => { host = document.createElement('div'); host.id = 'map-hub'; document.body.appendChild(host); });
afterEach(() => { host.remove(); });

describe('initMapHub().render — a amarração', () => {
  it('[Right] desenha um botão por linha da tabela, na ordem, dentro do #map-hub', () => {
    mkCtx(1).api.render();
    const bs = botoes();
    expect(bs).toHaveLength(MAP_HUB_ROWS.length);
    expect(bs.map(b => b.dataset.map)).toEqual(MAP_HUB_ROWS.map((_, i) => String(i)));
  });

  it('[Right] em 2 telas, o botão habilitado é o do modo 2 — e clicar nele abre o remap de teclado', () => {
    const { api, log } = mkCtx(2);
    api.render();
    const b = botoes()[1];
    expect(b.disabled).toBe(false);
    b.click();
    expect(log.options).toBe(1);
    expect(log.padwiz).toBe(0);
  });

  it('[Right] o botão do gamepad abre o assistente, em qualquer nº de telas', () => {
    for (const np of [1, 4]) {
      const { api, log } = mkCtx(np);
      api.render();
      botoes()[4].click();
      expect([log.padwiz, log.options]).toEqual([1, 0]);
    }
  });

  it('[Right] re-renderizar troca os botões e NÃO acumula ouvintes do desenho anterior', () => {
    const { api, log } = mkCtx(1);
    api.render(); api.render(); api.render();
    expect(botoes()).toHaveLength(MAP_HUB_ROWS.length); // e não 24
    botoes()[0].click();
    expect(log.options).toBe(1); // um clique, uma abertura
  });

  it('[Right] as linhas de modo errado e as em construção nascem `disabled` e cinzas', () => {
    mkCtx(1).api.render();
    const bs = botoes();
    expect(bs.map(b => b.disabled)).toEqual([false, true, true, true, false, true, true, true]);
    expect(bs[5].closest('.ctrl-row').classList.contains('row-off')).toBe(true);
    expect(bs[0].closest('.ctrl-row').classList.contains('row-off')).toBe(false);
  });

  it('⚠️ [DEFEITO PINADO] botão `disabled` não dispara click — os dois srAlert ficam inalcançáveis', () => {
    const { api, log } = mkCtx(1);
    api.render();
    botoes()[1].click(); // teclado modo 2, em 1 tela
    botoes()[5].click(); // olhos e boca, em construção
    expect(log.alerts).toEqual([]);  // ← o comportamento ATUAL, não o desejado
    expect(log.options).toBe(0);
    // e as mensagens seguem existindo e sendo testadas em map-hub.node.test.js, prontas para quando
    // o `disabled` virar `aria-disabled`.
  });

  it('[Zero] sem #map-hub no documento, render() desiste em silêncio', () => {
    host.remove();
    const { api } = mkCtx(1);
    expect(() => api.render()).not.toThrow();
    host = document.createElement('div'); host.id = 'map-hub'; document.body.appendChild(host); // o afterEach precisa
  });

  it('[Right] render() lê o nº de telas A CADA chamada (o menu reabre depois de trocar de modo)', () => {
    let np = 1;
    const { api } = mkCtx(0, { getNumPlayers: () => np });
    api.render();
    expect(botoes()[0].disabled).toBe(false);
    np = 3; api.render();
    expect(botoes().map(b => b.disabled).slice(0, 4)).toEqual([true, true, false, true]);
  });
});
