// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de game/secret-areas — a área secreta que acende quando alguém entra, e o ANÚNCIO que ela faz.
// ZOMBIES + Right-BICEP. project NODE: o módulo inteiro é aritmética + dois campos (`alpha`, `visible`), então
// o `PIXI.Graphics` é um objeto literal. Não há nada que precise de navegador.
//
// ⚠️ O CASO MAIS IMPORTANTE DAQUI NÃO É VISUAL, É A HISTERESE DO ANÚNCIO. Enquanto isto vivia dentro do
// `update(dt)` do main.js não havia teste nenhum, e a falha teria sido silenciosa das duas formas possíveis:
// anunciar a cada quadro (60 "Área secreta revelada." por segundo em cima de quem usa leitor de tela) ou
// nunca rearmar (a segunda visita à mesma sala fica muda, e o segredo deixa de existir para quem não vê).
// Nenhuma das duas aparece num screenshot.
import { describe, it, expect } from 'vitest';
import {
  playerTileSpan, spanTouchesCells, regionOccupied,
  stepRevealAlpha, isRevealVisible, nextAnnounce, initSecretAreas,
  REVEAL_ALPHA_STEP, REVEAL_VISIBLE_MIN, SECRET_REVEAL_MSG, EDGE_EPSILON,
} from '../app/js/game/secret-areas.js';
import { BOX } from '../app/js/game/player.js';
import { TILE } from '../app/js/core/constants.js';

/* ===================== fixtures ===================== */

// Uma grade de brinquedo: tile 10, caixa 4x8. Números pequenos para a conta ser conferível a olho.
const T = 10, B = { w: 4, h: 8 };
const cells = (...pares) => new Set(pares.map(([x, y]) => x + ',' + y));
/** Um jogador de pé com os PÉS em (x,y) — `pl.x` é o centro, `pl.y` é a base. */
const at = (x, y) => ({ x, y });

/* ===================== 1. playerTileSpan — a caixa vira retângulo de tiles ===================== */

describe('playerTileSpan — a caixa do jogador em coordenadas de tile', () => {
  it('[Right] jogador no meio de uma célula ocupa a coluna dele e as linhas do corpo inteiro', () => {
    // x=25 => 23..27 => coluna 2. y=30 (pés) e altura 8 => 22..30 => linhas 2 e 3.
    expect(playerTileSpan(at(25, 30), B, T)).toEqual({ tx0: 2, tx1: 2, ty0: 2, ty1: 2 });
  });

  it('[Right] a caixa é CENTRADA em x e sobe a partir de y (os pés), nunca desce', () => {
    const s = playerTileSpan(at(25, 41), B, T); // pés na linha 4, cabeça em 33 => linha 3
    expect([s.ty0, s.ty1]).toEqual([3, 4]);
  });

  it('[Boundary] borda direita EXATA na fronteira não reivindica a coluna seguinte (o desconto de 0,01)', () => {
    // x=28, w=4 => direita exatamente em 30.0, que seria a coluna 3 sem o épsilon.
    expect(playerTileSpan(at(28, 30), B, T).tx1).toBe(2);
    // e um fio de cabelo além já conta:
    expect(playerTileSpan(at(28 + EDGE_EPSILON, 30), B, T).tx1).toBe(3);
  });

  it('[Boundary] os PÉS exatamente na fronteira ficam na célula de CIMA, não na de baixo', () => {
    expect(playerTileSpan(at(25, 30), B, T).ty1).toBe(2);   // y=30.0 => linha 2
    expect(playerTileSpan(at(25, 30.5), B, T).ty1).toBe(3); // meio pixel adiante => linha 3
  });

  it('[Right] a esquerda e o topo NÃO descontam nada — a assimetria é de propósito', () => {
    expect(playerTileSpan(at(22, 38), B, T).tx0).toBe(2); // 22-2 = 20.0 => coluna 2
    expect(playerTileSpan(at(25, 38), B, T).ty0).toBe(3); // 38-8 = 30.0 => linha 3
  });

  it('[CrossCheck] com o TILE e o BOX de verdade do jogo, o corpo cabe em 2 ou 3 linhas de tile', () => {
    const s = playerTileSpan({ x: 100, y: 100 }, BOX, TILE); // BOX 10x30, TILE 16
    expect(s.tx1 - s.tx0).toBeLessThanOrEqual(1);
    expect(s.ty1 - s.ty0).toBe(2); // 30px de altura atravessam 2 fronteiras de 16px
  });
});

/* ===================== 2. regionOccupied — quem está dentro ===================== */

describe('regionOccupied — a ocupação da região', () => {
  const sala = cells([2, 2], [3, 2], [2, 3], [3, 3]);

  it('[Right] jogador dentro da sala ocupa', () => {
    expect(regionOccupied(sala, [at(25, 30)], B, T)).toBe(true);
  });

  it('[CrossCheck] jogador FORA não ocupa — e não basta estar perto', () => {
    expect(regionOccupied(sala, [at(5, 30)], B, T)).toBe(false);   // coluna 0
    expect(regionOccupied(sala, [at(25, 60)], B, T)).toBe(false);  // linhas 5 e 6, abaixo da sala
  });

  it('[Boundary] a borda DIREITA exatamente na parede da sala ainda está do lado de fora (o épsilon)', () => {
    // x=18 => direita em 20.0, que é a 1ª coluna da sala. Sem o desconto de 0,01 ele já a reivindicaria.
    expect(regionOccupied(sala, [at(18, 30)], B, T)).toBe(false);
    expect(regionOccupied(sala, [at(18.5, 30)], B, T)).toBe(true); // meio pixel para dentro e acende
  });

  it('[Boundary] os PÉS exatamente no piso da sala ainda estão do lado de fora (o mesmo épsilon, em y)', () => {
    expect(regionOccupied(sala, [at(25, 20)], B, T)).toBe(false);   // y=20.0 = 1ª linha da sala
    expect(regionOccupied(sala, [at(25, 20.5)], B, T)).toBe(true);
  });

  it('[Zero] sem jogadores, ou com a região vazia, ninguém ocupa nada', () => {
    expect(regionOccupied(sala, [], B, T)).toBe(false);
    expect(regionOccupied(new Set(), [at(25, 30)], B, T)).toBe(false);
  });

  it('[Many] basta UM jogador — e é isso que faz o J2 revelar a sala do J1 (multi-tela)', () => {
    expect(regionOccupied(sala, [at(5, 30), at(25, 30)], B, T)).toBe(true);
    expect(regionOccupied(sala, [at(5, 30), at(5, 60)], B, T)).toBe(false);
  });

  it('[Right] uma ÚNICA célula do corpo dentro já ocupa (a cabeça basta)', () => {
    const so_a_linha_2 = cells([2, 2]);
    // pés na linha 3, cabeça na linha 2: só a cabeça encosta.
    const s = playerTileSpan(at(25, 38), B, T);
    expect([s.ty0, s.ty1]).toEqual([3, 3]);
    expect(regionOccupied(so_a_linha_2, [at(25, 38)], B, T)).toBe(false);
    expect(regionOccupied(so_a_linha_2, [at(25, 34)], B, T)).toBe(true); // 34-8=26 => linha 2
  });

  it('[Interface] spanTouchesCells é o predicado nu: um retângulo contra um conjunto', () => {
    expect(spanTouchesCells({ tx0: 0, tx1: 5, ty0: 0, ty1: 5 }, sala)).toBe(true);
    expect(spanTouchesCells({ tx0: 0, tx1: 1, ty0: 0, ty1: 1 }, sala)).toBe(false);
    expect(spanTouchesCells({ tx0: 3, tx1: 2, ty0: 2, ty1: 2 }, sala)).toBe(false); // retângulo vazio
  });
});

/* ===================== 3. stepRevealAlpha — o passo, e as DUAS travas ===================== */

describe('stepRevealAlpha — a cobertura andando', () => {
  it('[Right] ocupada: o alfa CAI 0,08 por tick', () => {
    expect(stepRevealAlpha(1, true, 1)).toEqual({ alpha: 1 - REVEAL_ALPHA_STEP, visible: true, changed: true });
    expect(stepRevealAlpha(1, true, 2).alpha).toBeCloseTo(1 - 2 * REVEAL_ALPHA_STEP, 10); // dt escala o passo
  });

  it('[Right] vazia: o alfa SOBE 0,08 por tick, de volta ao preto', () => {
    expect(stepRevealAlpha(0, false, 1)).toEqual({ alpha: REVEAL_ALPHA_STEP, visible: true, changed: true });
  });

  it('[Boundary] TRAVA na descida: um dt grande para em 0 exato, nunca em negativo', () => {
    const r = stepRevealAlpha(0.05, true, 10); // 0,05 - 0,8 daria -0,75
    expect(r.alpha).toBe(0);
    expect(r.visible).toBe(false);
  });

  it('[Boundary] TRAVA na subida: um dt grande para em 1 exato, nunca acima', () => {
    const r = stepRevealAlpha(0.9, false, 10); // 0,9 + 0,8 daria 1,7
    expect(r.alpha).toBe(1);
    expect(r.visible).toBe(true);
  });

  it('[Right] sem a trava a cobertura PISCARIA: alfa fora de [0,1] é o sintoma que estas duas guardam', () => {
    // varredura: nenhum dt, por maior que seja, tira o alfa do intervalo — nos dois sentidos.
    for (const dt of [0.5, 1, 3, 17, 240]) {
      for (const occ of [true, false]) {
        for (const a of [0, 0.001, 0.5, 0.999, 1]) {
          const r = stepRevealAlpha(a, occ, dt);
          expect(r.alpha).toBeGreaterThanOrEqual(0);
          expect(r.alpha).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('[Zero] já no alvo: NADA muda, e `changed` é falso para o chamador não reescrever visible', () => {
    expect(stepRevealAlpha(0, true, 1)).toEqual({ alpha: 0, visible: false, changed: false });
    expect(stepRevealAlpha(1, false, 1)).toEqual({ alpha: 1, visible: true, changed: false });
  });

  it('[Boundary] isRevealVisible corta ESTRITAMENTE acima de 0,001 — a única cópia do limiar', () => {
    expect(isRevealVisible(REVEAL_VISIBLE_MIN)).toBe(false);      // exatamente 0,001 já sai do render
    expect(isRevealVisible(REVEAL_VISIBLE_MIN + 1e-9)).toBe(true); // um fio acima e volta
    expect(isRevealVisible(0)).toBe(false);
    expect(isRevealVisible(1)).toBe(true);
  });

  it('[CrossCheck] os dois ramos de stepRevealAlpha usam esse MESMO limiar, e não uma cópia', () => {
    for (const [a, occ, dt] of [[0.5, true, 0], [0.5, false, 0], [0, true, 1], [1, false, 1], [0.081, true, 1]]) {
      const r = stepRevealAlpha(a, occ, dt);
      expect(r.visible).toBe(isRevealVisible(r.alpha));
    }
  });

  it('[Boundary] o corte de visibilidade é ESTRITAMENTE acima de 0,001', () => {
    // dt=0 congela o alfa e deixa ver só a decisao de visibilidade, no valor exato do limiar.
    expect(stepRevealAlpha(REVEAL_VISIBLE_MIN, true, 0).visible).toBe(false); // == 0,001 ja some do render
    expect(stepRevealAlpha(0.002, true, 0).visible).toBe(true);
    expect(stepRevealAlpha(0, true, 1).visible).toBe(false);
  });

  it('[Zero] dt = 0 (quadro congelado) não move o alfa, mas ainda conta como passo', () => {
    const r = stepRevealAlpha(0.5, true, 0);
    expect(r.alpha).toBe(0.5);
    expect(r.changed).toBe(true); // 0,5 !== alvo: o original entrava no if e reescrevia os dois campos
  });
});

/* ===================== 4. nextAnnounce — A HISTERESE (o coração deste arquivo) ===================== */

describe('nextAnnounce — anuncia ao entrar, cala enquanto dentro, rearma só no preto total', () => {
  it('[Right] entrou e não tinha avisado: FALA e trava', () => {
    expect(nextAnnounce(false, true, 1)).toEqual({ announced: true, say: true });
  });

  it('[Right] está dentro e já avisou: SILÊNCIO — a trava é o que impede 60 anúncios por segundo', () => {
    for (const a of [1, 0.5, 0]) expect(nextAnnounce(true, true, a)).toEqual({ announced: true, say: false });
  });

  it('[Boundary] saiu mas a cobertura ainda está voltando: a trava CONTINUA de pé', () => {
    for (const a of [0, 0.5, 0.999]) expect(nextAnnounce(true, false, a)).toEqual({ announced: true, say: false });
  });

  it('[Boundary] saiu e o preto voltou a ser TOTAL (alfa >= 1): rearma, calado', () => {
    expect(nextAnnounce(true, false, 1)).toEqual({ announced: false, say: false });
  });

  it('[Right] rearmado, a próxima entrada fala de novo', () => {
    expect(nextAnnounce(false, true, 1).say).toBe(true);
  });

  it('[CrossCheck] a decisão NUNCA fala fora de uma entrada — sair não anuncia nada', () => {
    for (const armed of [true, false]) for (const a of [0, 0.5, 1]) {
      expect(nextAnnounce(armed, false, a).say).toBe(false);
    }
  });
});

/* ===================== 5. stepSecretAreas — a narrativa inteira, quadro a quadro ===================== */

function mkWorld(over = {}) {
  const ditos = [];
  const gfx = { alpha: 1, visible: true };
  const reg = { set: cells([2, 2], [3, 2], [2, 3], [3, 3]), gfx, announced: false };
  let players = over.players || [at(50, 30)]; // começa FORA (coluna 4/5)
  const api = initSecretAreas({
    regions: [reg], getPlayers: () => players, box: B, tile: T, srSay: (m) => ditos.push(m),
  });
  return { api, reg, gfx, ditos, entra: () => { players = [at(25, 30)]; }, sai: () => { players = [at(50, 30)]; } };
}

describe('stepSecretAreas — a visita completa', () => {
  it('[Right] entrar revela a cobertura até sumir, e anuncia UMA vez só no caminho todo', () => {
    const w = mkWorld();
    w.entra();
    for (let i = 0; i < 40; i++) w.api.stepSecretAreas(1); // 40 quadros: 0,08 x 40 = 3,2, muito além do 1
    expect(w.gfx.alpha).toBe(0);
    expect(w.gfx.visible).toBe(false);
    expect(w.ditos).toEqual([SECRET_REVEAL_MSG]); // UMA, e não 40
  });

  it('[Right] o anúncio sai no PRIMEIRO quadro dentro, antes de a cobertura ter sumido', () => {
    const w = mkWorld();
    w.entra(); w.api.stepSecretAreas(1);
    expect(w.ditos).toEqual([SECRET_REVEAL_MSG]);
    expect(w.gfx.alpha).toBeCloseTo(1 - REVEAL_ALPHA_STEP, 10); // ainda quase toda preta
  });

  it('[Right] sair re-escurece: o alfa sobe de volta a 1 e a cobertura reaparece', () => {
    const w = mkWorld();
    w.entra(); for (let i = 0; i < 40; i++) w.api.stepSecretAreas(1);
    w.sai();
    w.api.stepSecretAreas(1);
    expect(w.gfx.visible).toBe(true);   // já no 1º quadro de volta ela volta ao render
    for (let i = 0; i < 40; i++) w.api.stepSecretAreas(1);
    expect(w.gfx.alpha).toBe(1);
  });

  it('[Right] ir e VOLTAR na soleira não gera um 2º anúncio enquanto a cobertura não fechou', () => {
    const w = mkWorld();
    w.entra(); w.api.stepSecretAreas(1); w.api.stepSecretAreas(1); // alfa 0,84
    w.sai(); w.api.stepSecretAreas(1);                               // volta a 0,92 — ainda NÃO fechou
    expect(w.gfx.alpha).toBeLessThan(1);
    expect(w.reg.announced).toBe(true);                              // a trava continua de pé
    w.entra(); for (let i = 0; i < 5; i++) w.api.stepSecretAreas(1);
    expect(w.ditos).toEqual([SECRET_REVEAL_MSG]); // uma só
  });

  it('[Right] a segunda visita, com o preto TOTAL restaurado, anuncia de novo', () => {
    const w = mkWorld();
    w.entra(); for (let i = 0; i < 40; i++) w.api.stepSecretAreas(1);
    w.sai(); for (let i = 0; i < 40; i++) w.api.stepSecretAreas(1);
    expect(w.gfx.alpha).toBe(1);
    expect(w.reg.announced).toBe(false); // rearmou
    w.entra(); w.api.stepSecretAreas(1);
    expect(w.ditos).toEqual([SECRET_REVEAL_MSG, SECRET_REVEAL_MSG]);
  });

  it('[Zero] parado do lado de fora, quadro após quadro: nada muda e nada é dito', () => {
    const w = mkWorld();
    for (let i = 0; i < 30; i++) w.api.stepSecretAreas(1);
    expect(w.gfx).toEqual({ alpha: 1, visible: true });
    expect(w.ditos).toEqual([]);
  });

  it('[Zero] sem jogador nenhum a região permanece escura e muda', () => {
    const w = mkWorld({ players: [] });
    for (let i = 0; i < 10; i++) w.api.stepSecretAreas(1);
    expect(w.gfx.alpha).toBe(1);
    expect(w.ditos).toEqual([]);
  });

  it('[Right] parada no alvo NÃO reescreve `visible` — o `if(alpha!==target)` do original é preservado', () => {
    const w = mkWorld();
    w.gfx.visible = 'sentinela'; // valor impossível: só é sobrescrito se o módulo entrar no ramo de escrita
    for (let i = 0; i < 5; i++) w.api.stepSecretAreas(1); // fora, alfa já em 1 = alvo
    expect(w.gfx.visible).toBe('sentinela');
  });

  it('[Many] duas regiões são independentes: entrar numa não anuncia nem revela a outra', () => {
    const ditos = [];
    const a = { set: cells([2, 2]), gfx: { alpha: 1, visible: true }, announced: false };
    const b = { set: cells([8, 8]), gfx: { alpha: 1, visible: true }, announced: false };
    const api = initSecretAreas({ regions: [a, b], getPlayers: () => [at(25, 34)], box: B, tile: T, srSay: (m) => ditos.push(m) });
    for (let i = 0; i < 40; i++) api.stepSecretAreas(1);
    expect(a.gfx.alpha).toBe(0);
    expect(b.gfx.alpha).toBe(1);
    expect(ditos).toEqual([SECRET_REVEAL_MSG]); // uma região, um anúncio
  });

  it('[Performance/Right] dt grande (aba que volta do segundo plano) revela de uma vez, sem passar do ponto', () => {
    const w = mkWorld();
    w.entra(); w.api.stepSecretAreas(60); // 60 ticks de uma vez
    expect(w.gfx.alpha).toBe(0);
    expect(w.gfx.visible).toBe(false);
    expect(w.ditos).toEqual([SECRET_REVEAL_MSG]);
  });
});
