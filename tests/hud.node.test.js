// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/hud (project NODE: só a metade PURA, sem `document`). Contrato: a GRADE de telas
// (screenGrid/screenRect/screenCount), o MARKUP estático (vphudHtml/waitBadgeHtml) e a PROJEÇÃO do HUD de um
// jogador (hudRowView) são funções de valor — não dependem de DOM nem de estado global. A casca
// (initHud/buildGameHud/updateGameHud/…) está em tests/hud.browser.test.js.
// ZOMBIES + Right-BICEP. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import {
  screenGrid, screenRect, screenCount, vphudHtml, waitBadgeHtml, hudRowView,
} from '../app/js/ui/hud.js';
import { COIN_TARGET } from '../app/js/core/constants.js';

const pct = (s) => Number.parseFloat(s); // '50%' -> 50 (as funções devolvem string de CSS)

// Tabela de poderes FALSA — de propósito diferente do POWER_SHORT real: hudRowView tem que ler a tabela
// INJETADA, não uma cópia interna.
const POWERS = { off: '—', superjump: '🐇 Super-pulo', fly: '🎈 Voo' };

// ---------------------------------------------------------------------------------------------
// screenGrid — colunas/linhas da grade de telas
// ---------------------------------------------------------------------------------------------

describe('ui/hud · screenGrid', () => {
  it('[Zero] sem jogadores ainda, a grade já é 1×1 (o boot monta uma tela antes de players[] existir)', () => {
    expect(screenGrid(0)).toEqual({ cols: 1, rows: 1 });
  });

  it('[One] solo: uma coluna, uma linha', () => {
    expect(screenGrid(1)).toEqual({ cols: 1, rows: 1 });
  });

  it('[Many] 2 = lado a lado; 3 e 4 = 2×2', () => {
    expect(screenGrid(2)).toEqual({ cols: 2, rows: 1 });
    expect(screenGrid(3)).toEqual({ cols: 2, rows: 2 });
    expect(screenGrid(4)).toEqual({ cols: 2, rows: 2 });
  });

  it('[Cross-check] de 1 a 4 jogadores a grade sempre comporta todas as telas (cols×rows ≥ n)', () => {
    for (let n = 1; n <= 4; n++) {
      const { cols, rows } = screenGrid(n);
      expect(cols * rows).toBeGreaterThanOrEqual(n);
    }
  });

  it('[Boundary] 4 é o teto do jogo: a grade nunca passa de 2×2', () => {
    const { cols, rows } = screenGrid(4);
    expect(cols).toBe(2);
    expect(rows).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------
// screenRect — retângulo (em %) de cada tela
// ---------------------------------------------------------------------------------------------

describe('ui/hud · screenRect', () => {
  it('[One] solo ocupa a tela inteira', () => {
    expect(screenRect(0, 1)).toEqual({ L: '0%', T: '0%', W: '100%', H: '100%' });
  });

  it('[Many] 2 jogadores: metades esquerda e direita, altura cheia', () => {
    expect(screenRect(0, 2)).toEqual({ L: '0%', T: '0%', W: '50%', H: '100%' });
    expect(screenRect(1, 2)).toEqual({ L: '50%', T: '0%', W: '50%', H: '100%' });
  });

  it('[Many] 4 jogadores: os quatro quadrantes', () => {
    expect(screenRect(0, 4)).toEqual({ L: '0%', T: '0%', W: '50%', H: '50%' });
    expect(screenRect(1, 4)).toEqual({ L: '50%', T: '0%', W: '50%', H: '50%' });
    expect(screenRect(2, 4)).toEqual({ L: '0%', T: '50%', W: '50%', H: '50%' });
    expect(screenRect(3, 4)).toEqual({ L: '50%', T: '50%', W: '50%', H: '50%' });
  });

  it('[Boundary] 3 jogadores: a 3ª tela é CENTRALIZADA na linha de baixo (25%), não colada à esquerda', () => {
    expect(screenRect(0, 3)).toEqual({ L: '0%', T: '0%', W: '50%', H: '50%' });
    expect(screenRect(1, 3)).toEqual({ L: '50%', T: '0%', W: '50%', H: '50%' });
    expect(screenRect(2, 3)).toEqual({ L: '25%', T: '50%', W: '50%', H: '50%' });
  });

  it('[Cross-check] com 1, 2 e 4 telas a grade cobre 100% da área, sem sobra nem sobreposição', () => {
    for (const n of [1, 2, 4]) {
      let area = 0;
      for (let i = 0; i < n; i++) { const r = screenRect(i, n); area += pct(r.W) * pct(r.H); }
      expect(area).toBe(100 * 100);
    }
  });

  it('[Cross-check] com 3 telas sobra metade da linha de baixo — a área coberta é 3/4 da tela', () => {
    let area = 0;
    for (let i = 0; i < 3; i++) { const r = screenRect(i, 3); area += pct(r.W) * pct(r.H); }
    expect(area).toBe(0.75 * 100 * 100);
  });

  it('[Cross-check] nenhuma tela transborda a área visível (L+W ≤ 100 e T+H ≤ 100) em 1..4 jogadores', () => {
    for (let n = 1; n <= 4; n++) {
      for (let i = 0; i < n; i++) {
        const r = screenRect(i, n);
        expect(pct(r.L) + pct(r.W)).toBeLessThanOrEqual(100);
        expect(pct(r.T) + pct(r.H)).toBeLessThanOrEqual(100);
      }
    }
  });

  it('[Interface] os quatro campos saem prontos para o CSS (sufixo %)', () => {
    const r = screenRect(2, 4);
    for (const v of [r.L, r.T, r.W, r.H]) expect(v.endsWith('%')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// screenCount — quantas telas montar
// ---------------------------------------------------------------------------------------------

describe('ui/hud · screenCount', () => {
  it('[Zero] com 0 jogadores ainda monta 1 tela (buildGameHud roda no boot, antes de players[])', () => {
    expect(screenCount(0)).toBe(1);
  });

  it('[One/Many] a partir de 1 jogador é uma tela por jogador', () => {
    expect(screenCount(1)).toBe(1);
    expect(screenCount(4)).toBe(4);
  });

  it('[Error] valor negativo não gera laço vazio: continua sendo 1 tela', () => {
    expect(screenCount(-3)).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------
// vphudHtml — markup do contador (moedas + poder)
// ---------------------------------------------------------------------------------------------

describe('ui/hud · vphudHtml', () => {
  it('[Interface] NÃO há mais padrão: o alvo é OBRIGATÓRIO, e o HUD deixou de conhecer o do jogo', () => {
    // Era `vphudHtml(coinTarget = COIN_TARGET)`, com o comentário "parâmetro só para o teste" — um padrão
    // posto no lugar de uma fronteira. O ADR-0027 usa esse nome como o veredito do passo 4. Agora o HUD, que
    // é da engine, não importa mais a constante do jogo de plataforma: quem tem alvo é quem tem objetivo.
    expect(vphudHtml(COIN_TARGET)).toContain('/ ' + COIN_TARGET);
    expect(vphudHtml(3)).toContain('/ 3');
  });

  it('[Interface] o denominador é parâmetro: outro alvo muda o texto', () => {
    expect(vphudHtml(7)).toContain('/ 7');
    expect(vphudHtml(7)).not.toContain('/ ' + COIN_TARGET);
  });

  it('[Right] o HUD nasce zerado e sem poder', () => {
    const html = vphudHtml();
    expect(html).toContain('<b class="vphud-n">0</b>');
    expect(html).toContain('<span class="vphud-pw">—</span>');
  });

  it('[Interface] carrega os DOIS ganchos que updateGameHud consulta (.vphud-n e .vphud-pw)', () => {
    const html = vphudHtml();
    expect(html).toContain('class="vphud-n"');
    expect(html).toContain('class="vphud-pw"');
  });
});

// ---------------------------------------------------------------------------------------------
// waitBadgeHtml — selo "aperte um botão para entrar"
// ---------------------------------------------------------------------------------------------

describe('ui/hud · waitBadgeHtml', () => {
  it('[One] o índice é 0-based mas o texto fala com o jogador em 1-based', () => {
    expect(waitBadgeHtml(0)).toContain('Jogador 1:');
    expect(waitBadgeHtml(3)).toContain('Jogador 4:');
  });

  it('[Interface] carrega a classe .vp-wait, que é por onde clearWaitingBadge acha e remove o selo', () => {
    expect(waitBadgeHtml(1)).toContain('class="vphud-quit vp-wait"');
  });

  it('[Right] o convite nomeia as DUAS entradas possíveis (teclado próprio ou controle livre)', () => {
    const html = waitBadgeHtml(1);
    expect(html).toContain('teclado');
    expect(html).toContain('controle livre');
  });
});

// ---------------------------------------------------------------------------------------------
// hudRowView — projeção do HUD de UM jogador
// ---------------------------------------------------------------------------------------------

describe('ui/hud · hudRowView', () => {
  it('[Zero] jogador recém-nascido: 0 moedas, sem poder, sem selo de abandono, HUD visível', () => {
    expect(hudRowView({ collected: 0, activePower: 'off', quit: false }, POWERS)).toEqual({
      coins: '0', power: '—', quitHidden: true, visibility: 'visible',
    });
  });

  it('[Right] poder conhecido vira o rótulo curto da tabela injetada', () => {
    expect(hudRowView({ collected: 3, activePower: 'fly', quit: false }, POWERS).power).toBe('🎈 Voo');
  });

  it('[Interface] a tabela de poderes é INJETADA: o mesmo jogador rotula diferente com outra tabela', () => {
    const pl = { collected: 3, activePower: 'fly', quit: false };
    expect(hudRowView(pl, POWERS).power).toBe('🎈 Voo');
    expect(hudRowView(pl, { fly: 'FLY' }).power).toBe('FLY');
  });

  it('[Error] poder fora da tabela cai no travessão em vez de vazar a chave crua', () => {
    expect(hudRowView({ collected: 1, activePower: 'jetpack', quit: false }, POWERS).power).toBe('—');
  });

  it('[Boundary] tabela vazia: todo poder vira travessão (o HUD nunca fica em branco)', () => {
    expect(hudRowView({ collected: 1, activePower: 'fly', quit: false }, {}).power).toBe('—');
  });

  it('[Many] o contador NÃO é limitado ao alvo: passar de 10/10 mostra 12', () => {
    expect(hudRowView({ collected: 12, activePower: 'off', quit: false }, POWERS).coins).toBe('12');
  });

  it('[Right] quem desistiu perde o contador (visibility hidden) e ganha o selo (hidden=false)', () => {
    expect(hudRowView({ collected: 5, activePower: 'fly', quit: true }, POWERS)).toEqual({
      coins: '5', power: '🎈 Voo', quitHidden: false, visibility: 'hidden',
    });
  });

  it('[Cross-check] selo e contador são sempre opostos: quitHidden === (visibility === "visible")', () => {
    for (const quit of [false, true]) {
      const v = hudRowView({ collected: 0, activePower: 'off', quit }, POWERS);
      expect(v.quitHidden).toBe(v.visibility === 'visible');
    }
  });

  it('[Exercise] projetar não mexe no jogador (o HUD é leitor, o loop de jogo é o dono do estado)', () => {
    const pl = { collected: 4, activePower: 'superjump', quit: false };
    hudRowView(pl, POWERS);
    expect(pl).toEqual({ collected: 4, activePower: 'superjump', quit: false });
  });
});
