// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/map-hub — o painel "Mapear controles" do menu de Movimento (parte PURA, project node).
// ZOMBIES + Right-BICEP. A amarração de DOM (innerHTML + os cliques) está em map-hub.browser.test.js.
//
// O que este arquivo protege: a regra de habilitação por MODO — "⌨ Mapear teclado para modo 3 jogadores" só
// fica clicável quando o jogo ESTÁ em 3 telas — e as duas frases que o leitor de tela recebe quando a linha
// está cinza. As frases são conteúdo de acessibilidade: elas são o único jeito de saber POR QUE o botão não
// responde, e um refator que "melhore o texto" muda o que a criança ouve.
import { describe, it, expect } from 'vitest';
import {
  MAP_HUB_ROWS, mapHubStates, mapHubMarkup, soonName, soonMessage, wrongModeMessage,
} from '../app/js/ui/map-hub.js';

/* ===================== 1. a tabela ===================== */

describe('MAP_HUB_ROWS — a tabela do painel', () => {
  it('[Right] oito linhas: 4 de teclado (um por modo), gamepad, e 3 em construção', () => {
    expect(MAP_HUB_ROWS).toHaveLength(8);
    expect(MAP_HUB_ROWS.filter(r => r.act === 'options').map(r => r.mode)).toEqual([1, 2, 3, 4]);
    expect(MAP_HUB_ROWS.filter(r => r.act === 'padwiz')).toHaveLength(1);
    expect(MAP_HUB_ROWS.filter(r => r.soon)).toHaveLength(3);
  });

  it('[Right] só as linhas de teclado exigem modo; gamepad e as futuras valem em qualquer nº de telas', () => {
    for (const r of MAP_HUB_ROWS) {
      if (r.act === 'options') expect(typeof r.mode).toBe('number');
      else expect(r.mode).toBeUndefined();
    }
  });

  it('[Right] a tabela é DADO congelado — ninguém a edita em tempo de execução', () => {
    expect(Object.isFrozen(MAP_HUB_ROWS)).toBe(true);
    expect(Object.isFrozen(MAP_HUB_ROWS[0])).toBe(true);
  });

  it('[CrossCheck] toda linha em construção NÃO tem painel para abrir (senão o `soon` seria mentira)', () => {
    for (const r of MAP_HUB_ROWS) if (r.soon) expect(r.act).toBeUndefined();
  });
});

/* ===================== 2. mapHubStates — quem fica cinza ===================== */

describe('mapHubStates — a habilitação por modo', () => {
  it('[Right] em 1 tela, só a linha do modo 1 e o gamepad ficam clicáveis', () => {
    const st = mapHubStates(1);
    expect(st.map(s => s.dis)).toEqual([false, true, true, true, false, true, true, true]);
  });

  it('[Right] trocar o nº de telas move a única linha de teclado habilitada', () => {
    for (const np of [1, 2, 3, 4]) {
      const st = mapHubStates(np);
      const livres = st.slice(0, 4).map((s, i) => (s.dis ? null : i + 1)).filter(Boolean);
      expect(livres).toEqual([np]); // exatamente uma, e é a do modo atual
    }
  });

  it('[Boundary] num nº de telas fora do catálogo (0, 5), NENHUMA linha de teclado habilita', () => {
    for (const np of [0, 5, 99]) expect(mapHubStates(np).slice(0, 4).every(s => s.dis)).toBe(true);
  });

  it('[CrossCheck] `off` é só o modo errado; `dis` é o modo errado OU a construção', () => {
    const st = mapHubStates(2);
    expect(st[1]).toEqual({ off: false, dis: false }); // teclado modo 2, em 2 telas
    expect(st[2]).toEqual({ off: true, dis: true });   // teclado modo 3
    expect(st[5]).toEqual({ off: false, dis: true });  // olhos e boca: em construção, mas o modo não é o motivo
  });
});

/* ===================== 3. mapHubMarkup — o HTML ===================== */

describe('mapHubMarkup — o painel em HTML', () => {
  it('[Right] cabeçalho + uma .ctrl-row por linha da tabela', () => {
    const html = mapHubMarkup(1);
    expect(html.startsWith('<h3 class="panel-sub">Mapear controles <span class="panel-sub__tag">por jogador</span></h3>')).toBe(true);
    expect(html.match(/class="ctrl-row/g)).toHaveLength(MAP_HUB_ROWS.length);
  });

  it('[Right] a linha habilitada sai sem `row-off`, sem `aria-disabled` e com o rótulo "Abrir"', () => {
    const html = mapHubMarkup(1);
    expect(html).toContain('<div class="ctrl-row"><span>⌨ Mapear teclado para modo 1 jogador</span><button class="mode-btn" type="button" data-map="0">Abrir</button></div>');
  });

  it('[Right] a linha de modo errado sai cinza e aria-disabled, mas ainda diz "Abrir"', () => {
    const html = mapHubMarkup(1);
    expect(html).toContain('<div class="ctrl-row row-off"><span>⌨ Mapear teclado para modo 2 jogadores</span><button class="mode-btn" type="button" data-map="1" aria-disabled="true">Abrir</button></div>');
  });

  it('[Right] a linha em construção ganha a nota em <em> e o botão diz "Em breve"', () => {
    const html = mapHubMarkup(1);
    expect(html).toContain('<span>👁 Mapear olhos e boca <em style="opacity:.7">(em construção)</em></span>');
    expect(html).toContain('data-map="5" aria-disabled="true">Em breve</button>');
  });

  it('[CrossCheck] o `data-map` é o ÍNDICE na tabela — é por ele que o clique acha a linha', () => {
    const html = mapHubMarkup(4);
    for (let i = 0; i < MAP_HUB_ROWS.length; i++) expect(html).toContain(`data-map="${i}"`);
    // e o índice bate com o rótulo: a 5ª entrada (i=4) é o gamepad
    expect(html.indexOf('🎮 Mapear gamepad')).toBeLessThan(html.indexOf('data-map="5"'));
    expect(html.indexOf('data-map="4"')).toBeLessThan(html.indexOf('data-map="5"'));
  });

  it('[Right] `aria-disabled` aparece exatamente nas linhas que mapHubStates marca', () => {
    for (const np of [1, 2, 3, 4]) {
      const esperado = mapHubStates(np).filter(s => s.dis).length;
      expect(mapHubMarkup(np).match(/ aria-disabled="true">/g)).toHaveLength(esperado);
    }
  });
});

/* ===================== 4. as duas frases faladas ===================== */

describe('soonName / soonMessage — o aviso da linha em construção', () => {
  it('[Right] o emoji da frente sai; o resto do rótulo fica inteiro', () => {
    expect(soonName('👁 Mapear olhos e boca')).toBe('Mapear olhos e boca');
    expect(soonName('🎯 Mapear setores de olhar')).toBe('Mapear setores de olhar');
    expect(soonName('🎤 Mapear palavras (fala)')).toBe('Mapear palavras (fala)');
  });

  it('[Right] a frase inteira, palavra por palavra — é o que o leitor de tela fala', () => {
    expect(soonMessage('🎤 Mapear palavras (fala)')).toBe('Mapear palavras (fala): em construção — chega junto com os subsistemas de webcam e fala.');
  });

  it('[Zero] rótulo sem emoji ou vazio não perde texto nem estoura', () => {
    expect(soonName('Mapear')).toBe('Mapear'); // uma palavra só: não há o que cortar
    expect(soonName('')).toBe('');
  });
});

describe('wrongModeMessage — o aviso da linha de modo errado', () => {
  it('[Right] singular no modo 1, plural nos demais', () => {
    expect(wrongModeMessage(1)).toBe('Disponível só no modo 1 jogador. Troque o nº de telas na barra do topo.');
    expect(wrongModeMessage(2)).toBe('Disponível só no modo 2 jogadores. Troque o nº de telas na barra do topo.');
    expect(wrongModeMessage(4)).toBe('Disponível só no modo 4 jogadores. Troque o nº de telas na barra do topo.');
  });

  it('[Right] a frase diz o que FAZER, não só o que não dá — a barra do topo é o caminho', () => {
    expect(wrongModeMessage(3)).toContain('Troque o nº de telas na barra do topo.');
  });
});
