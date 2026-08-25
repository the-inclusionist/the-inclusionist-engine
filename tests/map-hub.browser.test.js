// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/map-hub — o que só o DOM de verdade prova (project browser: Chromium/Playwright).
// A parte pura (tabela, habilitação por modo, markup, as duas frases faladas) está em map-hub.node.test.js.
//
// Aqui fica a amarração: `innerHTML` no `#map-hub`, `querySelectorAll('button[data-map]')` e o clique que
// abre o painel certo. Já foi testemunha de um defeito: com o atributo `disabled` o botão não disparava
// `click` no navegador, então os dois `srAlert` do módulo não são alcançáveis por clique. O caso abaixo
// click, as duas mensagens de srAlert eram inalcançáveis e seis das oito linhas ficavam fora da ordem de
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
    expect(b.getAttribute('aria-disabled')).toBe(null);
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

  it('[Right] as linhas de modo errado e as em construção nascem `aria-disabled` e cinzas', () => {
    mkCtx(1).api.render();
    const bs = botoes();
    expect(bs.map(b => b.getAttribute('aria-disabled') === 'true')).toEqual([false, true, true, true, false, true, true, true]);
    expect(bs.every(b => b.disabled === false)).toBe(true); // alcançáveis por teclado, todas as oito
    expect(bs[5].closest('.ctrl-row').classList.contains('row-off')).toBe(true);
    expect(bs[0].closest('.ctrl-row').classList.contains('row-off')).toBe(false);
  });

  it('[Right] a linha indisponível DIZ por que está indisponível, em vez de calar', () => {
    // Era aqui o defeito: com `disabled` o click não disparava, então as duas frases que este módulo já
    // trazia nunca chegavam a ninguém — e o botão ainda saía da ordem de foco, de modo que quem navega por
    // teclado nem encontrava a linha. Com `aria-disabled` o estado é anunciado E o motivo é dito.
    const { api, log } = mkCtx(1);
    api.render();
    botoes()[1].click(); // teclado modo 2, com 1 tela ativa
    botoes()[5].click(); // olhos e boca, em construção
    expect(log.alerts).toHaveLength(2);
    expect(log.alerts[0]).toContain('2 jogador');   // o motivo: modo errado
    expect(log.alerts[1]).toContain('construção');  // o motivo: ainda não existe
    expect(log.options).toBe(0);                    // e nenhuma delas ABRE nada
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
    expect(botoes()[0].getAttribute('aria-disabled')).toBe(null);
    np = 3; api.render();
    expect(botoes().map(b => b.getAttribute('aria-disabled') === 'true').slice(0, 4)).toEqual([true, true, false, true]);
  });
});
