// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de input/latch — SEGURAR VIRA ALTERNAR (project node: puro, sem DOM nem PIXI). ZOMBIES + Right-BICEP.
//
// POR QUE ESTE ARQUIVO IMPORTA MAIS QUE O TAMANHO DO MÓDULO SUGERE. Estas 15 linhas são a diferença entre
// jogar e não jogar para quem não consegue MANTER um botão pressionado. A política morava dentro do cálculo
// de movimento em game/physics.ts, onde nenhum teste a alcançava sem montar um jogador, um mundo e um passo
// de física inteiro — e por isso a regra do toque nunca teve teste próprio em lugar nenhum.
//
// O que se fixa aqui, e que antes era um efeito não intencional da ordem de dois `if`: com as duas bordas no
// MESMO quadro, o resultado é sempre 1, seja qual for o estado anterior.
import { describe, it, expect } from 'vitest';
import { nextLatchedDir, latchedDrive, LATCH_HELD, LATCH_IDLE } from '../app/js/input/latch.js';

describe('nextLatchedDir — o toque que trava a direção', () => {
  it('[Zero] sem borda nenhuma, o sentido travado não muda (é isso que faz o personagem andar sozinho)', () => {
    expect(nextLatchedDir(0, false, false)).toBe(0);
    expect(nextLatchedDir(-1, false, false)).toBe(-1);
    expect(nextLatchedDir(1, false, false)).toBe(1);
  });

  it('[Right] parado: um toque trava naquele sentido', () => {
    expect(nextLatchedDir(0, true, false)).toBe(-1);
    expect(nextLatchedDir(0, false, true)).toBe(1);
  });

  it('[Right] tocar no sentido em que JÁ se anda para — o mesmo botão liga e desliga', () => {
    // Não existe botão de parar de propósito: quem tem um dedo só pagaria o dobro de alcances por ele.
    expect(nextLatchedDir(-1, true, false)).toBe(0);
    expect(nextLatchedDir(1, false, true)).toBe(0);
  });

  it('[Right] tocar no sentido OPOSTO inverte direto, sem passar pelo zero', () => {
    // Quem toca "esquerda" andando para a direita quer ir para a esquerda, não quer parar e tocar de novo.
    expect(nextLatchedDir(1, true, false)).toBe(-1);
    expect(nextLatchedDir(-1, false, true)).toBe(1);
  });

  it('[Boundary] as DUAS bordas no mesmo quadro: o resultado é SEMPRE 1, venha de onde vier', () => {
    // Acontece de verdade — dois dedos, ou um switch duplo mal calibrado. Como a esquerda é avaliada antes
    // da direita, a esquerda nunca deixa `dir` valendo 1, e a direita então sempre encontra algo diferente
    // de 1 e trava em 1. Não é "a direita vence" no sentido frouxo: é que o estado anterior deixa de
    // importar por completo. Escrevi este caso primeiro esperando `0` para o estado 1 — o comentário que eu
    // mesmo pusera ao lado já traçava o caminho certo enquanto a asserção dizia outra coisa. O código estava
    // certo; a expectativa, errada.
    expect(nextLatchedDir(0, true, true)).toBe(1);   // esq: 0 → -1 · dir: -1 ≠ 1 → 1
    expect(nextLatchedDir(1, true, true)).toBe(1);   // esq: 1 → -1 · dir: -1 ≠ 1 → 1
    expect(nextLatchedDir(-1, true, true)).toBe(1);  // esq: -1 → 0 · dir: 0 ≠ 1 → 1
  });

  it('[Interface] só devolve -1, 0 ou 1 — nunca um sentido inventado, em nenhuma das 12 combinações', () => {
    for (const cur of [-1, 0, 1]) {
      for (const l of [false, true]) {
        for (const r of [false, true]) {
          expect([-1, 0, 1]).toContain(nextLatchedDir(cur, l, r));
        }
      }
    }
  });

  it('[Inverse] dois toques no mesmo sentido, a partir do zero, voltam ao zero', () => {
    expect(nextLatchedDir(nextLatchedDir(0, true, false), true, false)).toBe(0);
    expect(nextLatchedDir(nextLatchedDir(0, false, true), false, true)).toBe(0);
  });
});

describe('latchedDrive — quanto anda, e para que lado', () => {
  it('[Zero] parado é zero, esteja segurando o que estiver', () => {
    expect(latchedDrive(0, false, false)).toBe(0);
    expect(latchedDrive(0, true, true)).toBe(0);
  });

  it('[Right] travado e SEM segurar: anda sozinho a 1/3 da velocidade, com o sinal do sentido', () => {
    expect(latchedDrive(-1, false, false)).toBeCloseTo(-LATCH_IDLE, 10);
    expect(latchedDrive(1, false, false)).toBeCloseTo(LATCH_IDLE, 10);
  });

  it('[Right] travado E segurando o botão DAQUELE sentido: acelera para 2/3', () => {
    expect(latchedDrive(-1, true, false)).toBeCloseTo(-LATCH_HELD, 10);
    expect(latchedDrive(1, false, true)).toBeCloseTo(LATCH_HELD, 10);
  });

  it('[Boundary] segurar o botão CONTRÁRIO ao sentido travado não acelera nada', () => {
    // Segurar "direita" enquanto o travamento é para a esquerda não é intenção de acelerar à esquerda.
    expect(latchedDrive(-1, false, true)).toBeCloseTo(-LATCH_IDLE, 10);
    expect(latchedDrive(1, true, false)).toBeCloseTo(LATCH_IDLE, 10);
  });

  it('[Invariant] segurar SEMPRE anda mais que não segurar, nos dois sentidos', () => {
    expect(Math.abs(latchedDrive(1, false, true))).toBeGreaterThan(Math.abs(latchedDrive(1, false, false)));
    expect(Math.abs(latchedDrive(-1, true, false))).toBeGreaterThan(Math.abs(latchedDrive(-1, false, false)));
  });

  it('[Invariant] o sinal é o do sentido travado, nunca o do botão segurado', () => {
    for (const l of [false, true]) for (const r of [false, true]) {
      expect(latchedDrive(-1, l, r)).toBeLessThan(0);
      expect(latchedDrive(1, l, r)).toBeGreaterThan(0);
    }
  });

  it('[Interface] nunca passa da velocidade de caminhada cheia — 2/3 é o teto', () => {
    for (const d of [-1, 0, 1]) for (const l of [false, true]) for (const r of [false, true]) {
      expect(Math.abs(latchedDrive(d, l, r))).toBeLessThanOrEqual(LATCH_HELD);
    }
  });
});
