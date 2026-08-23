// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/menu-nav — a DECISÃO de navegação, sem DOM (project node): traduzir tecla em intenção, andar
// numa lista, ajustar select/slider e atravessar a fronteira entre a barra de ícones e a grade de itens.
//
// Por que isto é teste de ACESSIBILIDADE e não de aritmética: cada função aqui é um gesto que alguém faz sem
// ver a tela. Um sinal trocado em `pauseGridMove` não quebra nada visível — o menu continua desenhado, os
// botões continuam clicáveis com o mouse — e simplesmente torna um item inalcançável para quem só tem teclado.
// É o tipo de regressão que passa por build, por olho e por screenshot.
//
// A casca de DOM (foco de verdade, `offsetParent`, z-index, Escape) está em menu-nav.browser.test.js e NÃO é
// repetida aqui.
import { describe, it, expect } from 'vitest';
import {
  KEY_YES, KEY_NO, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, PAUSE_COLS,
  menuKeyIntent, hasIntent, clampIndex, selectStep, selectWrap, rangeStep, pauseGridMove,
} from '../app/js/ui/menu-nav.js';

const NONE = { yes: false, no: false, up: false, down: false, left: false, right: false };
const only = (...ks) => ({ ...NONE, ...Object.fromEntries(ks.map((k) => [k, true])) });

describe('menuKeyIntent — tecla física → intenção', () => {
  it('as quatro teclas de "sim" genéricas confirmam', () => {
    for (const c of ['Space', 'KeyJ', 'Enter', 'NumpadEnter']) {
      expect(menuKeyIntent(c, null).yes, c).toBe(true);
    }
  });

  // Este caso PINA o DEFEITO 2 (conhecido, não consertado): Escape é a intenção "voltar", a MESMA que a ação
  // "especial" do gamepad. Não existe, hoje, uma intenção "fechar diálogo" separada de "voltar ao jogo".
  it('Escape é "não" — e é a MESMA intenção que a ação "especial" (defeito 2, pinado)', () => {
    expect(menuKeyIntent('Escape', null).no).toBe(true);
    expect(menuKeyIntent('KeyL', 'especial').no).toBe(true);
    // e Escape NÃO é nenhuma outra intenção — se virasse, o menu andaria ao tentar voltar
    const k = menuKeyIntent('Escape', null);
    expect([k.yes, k.up, k.down, k.left, k.right]).toEqual([false, false, false, false, false]);
  });

  it('WASD e as setas andam; a ação remapeada do dono da tecla vale igual', () => {
    expect(menuKeyIntent('KeyW', null).up).toBe(true);
    expect(menuKeyIntent('ArrowDown', null).down).toBe(true);
    expect(menuKeyIntent('KeyA', null).left).toBe(true);
    expect(menuKeyIntent('ArrowRight', null).right).toBe(true);
    // tecla exótica, mas remapeada para "up" pelo jogador: navega igual (é o pilar — o remap vale nos menus)
    expect(menuKeyIntent('Numpad8', 'up').up).toBe(true);
  });

  it('tecla sem função nenhuma não expressa intenção (e por isso NÃO é consumida)', () => {
    expect(hasIntent(menuKeyIntent('KeyQ', null))).toBe(false);
    expect(hasIntent(menuKeyIntent('Escape', null))).toBe(true);
  });

  it('as tabelas genéricas não se sobrepõem entre si', () => {
    const sets = [KEY_YES, KEY_NO, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT];
    const all = sets.flatMap((s) => [...s]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('passos de lista e de controle', () => {
  it('clampIndex não dá a volta em nenhuma das pontas', () => {
    expect(clampIndex(5, 0, -1)).toBe(0);
    expect(clampIndex(5, 4, +1)).toBe(4);
    expect(clampIndex(5, 2, +1)).toBe(3);
  });

  it('select: esquerda/direita são passo PRESO; "sim" dá a volta (diferença deliberada)', () => {
    expect(selectStep(0, 3, -1)).toBe(0);
    expect(selectStep(2, 3, +1)).toBe(2);
    expect(selectWrap(2, 3)).toBe(0);
    expect(selectWrap(0, 3)).toBe(1);
  });

  it('slider anda um STEP e respeita min/max; step ausente ou zero vale 1', () => {
    expect(rangeStep(4, 0, 10, 2, +1)).toBe(6);
    expect(rangeStep(0, 0, 10, 2, -1)).toBe(0);
    expect(rangeStep(10, 0, 10, 2, +1)).toBe(10);
    expect(rangeStep(4, 0, 10, 0, +1)).toBe(5);   // `+cur.step||1`
    expect(rangeStep(4, 0, 10, NaN, -1)).toBe(3); // idem
  });
});

describe('pauseGridMove — a grade do menu de pausa e a fronteira ícones↔itens', () => {
  const ICONS = 10, ITEMS = 8; // números da vida real: 10 `.pi-btn`, ~8 `.pm-btn`

  it('na barra de ícones, esquerda/direita andam preso nas pontas', () => {
    expect(pauseGridMove({ zone: 'icons', index: 0 }, only('left'), ICONS, ITEMS)).toEqual({ zone: 'icons', index: 0 });
    expect(pauseGridMove({ zone: 'icons', index: 9 }, only('right'), ICONS, ITEMS)).toEqual({ zone: 'icons', index: 9 });
    expect(pauseGridMove({ zone: 'icons', index: 3 }, only('right'), ICONS, ITEMS)).toEqual({ zone: 'icons', index: 4 });
  });

  it('"cima" na barra de ícones NÃO sai da barra (não há nada acima)', () => {
    expect(pauseGridMove({ zone: 'icons', index: 4 }, only('up'), ICONS, ITEMS)).toEqual({ zone: 'icons', index: 4 });
  });

  // FRONTEIRA, sentido descida. Regra: cai sempre no PRIMEIRO item (Continuar), nunca no alinhado por coluna.
  it('"baixo" na barra cai no PRIMEIRO item, venha de qual ícone vier', () => {
    for (const i of [0, 5, 9]) {
      expect(pauseGridMove({ zone: 'icons', index: i }, only('down'), ICONS, ITEMS)).toEqual({ zone: 'items', index: 0 });
    }
  });

  // FRONTEIRA, sentido subida. Só a PRIMEIRA LINHA sobe para a barra; da segunda em diante é passo de linha.
  it('"cima" da 1ª linha de itens sobe para a barra, no ícone de mesmo índice', () => {
    expect(pauseGridMove({ zone: 'items', index: 0 }, only('up'), ICONS, ITEMS)).toEqual({ zone: 'icons', index: 0 });
    expect(pauseGridMove({ zone: 'items', index: 1 }, only('up'), ICONS, ITEMS)).toEqual({ zone: 'icons', index: 1 });
  });

  it('"cima" da 2ª linha em diante sobe UMA LINHA (não vai para a barra)', () => {
    expect(pauseGridMove({ zone: 'items', index: 2 }, only('up'), ICONS, ITEMS)).toEqual({ zone: 'items', index: 0 });
    expect(pauseGridMove({ zone: 'items', index: 5 }, only('up'), ICONS, ITEMS)).toEqual({ zone: 'items', index: 3 });
  });

  it('barra com MENOS ícones que colunas: a subida prende no último ícone', () => {
    expect(pauseGridMove({ zone: 'items', index: 1 }, only('up'), 1, ITEMS)).toEqual({ zone: 'icons', index: 0 });
  });

  it('sem ícone nenhum, "cima" da 1ª linha vira passo de linha e o cursor NÃO some', () => {
    expect(pauseGridMove({ zone: 'items', index: 1 }, only('up'), 0, ITEMS)).toEqual({ zone: 'items', index: 0 });
  });

  it('nos itens, baixo/cima pulam de LINHA (2 colunas) e esquerda/direita pulam de item', () => {
    expect(PAUSE_COLS).toBe(2);
    expect(pauseGridMove({ zone: 'items', index: 0 }, only('down'), ICONS, ITEMS)).toEqual({ zone: 'items', index: 2 });
    expect(pauseGridMove({ zone: 'items', index: 0 }, only('right'), ICONS, ITEMS)).toEqual({ zone: 'items', index: 1 });
    expect(pauseGridMove({ zone: 'items', index: 3 }, only('left'), ICONS, ITEMS)).toEqual({ zone: 'items', index: 2 });
  });

  it('nos itens, as pontas prendem (a última linha não some pelo fim)', () => {
    expect(pauseGridMove({ zone: 'items', index: 7 }, only('down'), ICONS, ITEMS)).toEqual({ zone: 'items', index: 7 });
    expect(pauseGridMove({ zone: 'items', index: 6 }, only('down'), ICONS, ITEMS)).toEqual({ zone: 'items', index: 7 });
    expect(pauseGridMove({ zone: 'items', index: 0 }, only('left'), ICONS, ITEMS)).toEqual({ zone: 'items', index: 0 });
  });

  it('índice negativo (cursor perdido) entra como 0 — verbatim do `if(idx<0)idx=0`', () => {
    expect(pauseGridMove({ zone: 'items', index: -1 }, only('right'), ICONS, ITEMS)).toEqual({ zone: 'items', index: 1 });
  });

  it('TODO item da grade é alcançável a partir de Continuar só com cima/baixo/esquerda/direita', () => {
    // Right-BICEP (Cross-check): a varredura prova o que os casos pontuais só sugerem — que a grade não tem
    // buraco. Se ela tiver, alguém não consegue chegar num item do menu sem mouse.
    const seen = new Set();
    const fila = [JSON.stringify({ zone: 'items', index: 0 })];
    while (fila.length) {
      const cur = JSON.parse(fila.shift());
      const key = JSON.stringify(cur);
      if (seen.has(key)) continue;
      seen.add(key);
      for (const g of ['up', 'down', 'left', 'right']) {
        fila.push(JSON.stringify(pauseGridMove(cur, only(g), ICONS, ITEMS)));
      }
    }
    for (let i = 0; i < ITEMS; i++) expect(seen.has(JSON.stringify({ zone: 'items', index: i })), 'item ' + i).toBe(true);
    for (let i = 0; i < ICONS; i++) expect(seen.has(JSON.stringify({ zone: 'icons', index: i })), 'ícone ' + i).toBe(true);
  });
});
