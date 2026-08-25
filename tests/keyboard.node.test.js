// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de input/keyboard — o MAPA DE TECLAS e seu dono (project node: sem DOM, sem PIXI).
//
// O arquivo não tinha teste: `loadKB`/`saveKB`/`resetKB` moravam aqui desde a Fase 2, mas o VALOR que elas
// gerenciam era um `let KB` do main.js, com um envoltório `setKB: (k) => { KB = k; }` fabricado à mão. Com o
// valor vindo para junto das funções (#50), passou a haver o que aferir.
//
// Duas propriedades importam mais que as outras, e as duas falham em silêncio se quebrarem:
//   · o módulo NÃO lê disco no import — senão qualquer teste que o importe herda o teclado do ambiente;
//   · `resetKB` devolve uma CÓPIA — senão remapear escreve dentro dos defaults e o reset deixa de resetar.
import { describe, it, expect } from 'vitest';
import { kb, initKB, setKB, resetKB, saveKB, loadKB, KB_DEFAULTS } from '../app/js/input/keyboard.js';

describe('input/keyboard — o mapa vivo, com dono (#50)', () => {
  it('[Zero] no import ele JÁ é utilizável e NÃO leu disco: nasce dos padrões', () => {
    expect(kb.solo).toBeTruthy();
    expect(kb).toEqual(KB_DEFAULTS);
  });

  it('[Boundary] e nasce como CÓPIA, não como os próprios defaults', () => {
    // Se fosse a referência, remapear uma tecla escreveria dentro de KB_DEFAULTS e o "restaurar padrões"
    // passaria a restaurar o que a criança acabou de mudar — um reset que não reseta, e sem sintoma visível.
    expect(kb).not.toBe(KB_DEFAULTS);
  });

  it('[Right] initKB() lê o persistido e o objeto que ele devolve é o que passa a valer', () => {
    const lido = initKB();
    expect(kb).toBe(lido);
    expect(kb.solo).toBeTruthy();
  });

  it('[Right] setKB troca o mapa INTEIRO — é o que o "restaurar padrões" do painel precisa', () => {
    const antes = kb;
    const novo = resetKB();
    setKB(novo);
    expect(kb).toBe(novo);
    expect(kb).not.toBe(antes);
    setKB(antes);
  });
});

describe('input/keyboard — resetKB', () => {
  it('[Right] devolve os padrões, e uma cópia nova a cada chamada', () => {
    const a = resetKB(), b = resetKB();
    expect(a).toEqual(KB_DEFAULTS);
    expect(a).not.toBe(b); // duas chamadas, dois objetos: um não pode contaminar o outro
  });
});

describe('input/keyboard — loadKB sem armazenamento', () => {
  // Este projeto de teste é `node`: não há `localStorage`, então `store` é inerte. Isso não é um limite do
  // teste — é o CENÁRIO REAL de `file://` e do modo privado, onde o jogo também precisa abrir jogável.
  it('[Zero] sem nada salvo (ou sem poder salvar), devolve os padrões íntegros', () => {
    expect(loadKB()).toEqual(KB_DEFAULTS);
  });

  it('[Zero/Error] gravar sem armazenamento não lança — o boot não pode morrer por isso', () => {
    expect(() => saveKB(KB_DEFAULTS)).not.toThrow();
    expect(loadKB()).toEqual(KB_DEFAULTS);
  });

  // A sobreposição PARCIAL do dado salvo sobre os defaults (quem remapeou só o pulo não perde as setas) e a
  // migração do formato antigo `p34` precisam de armazenamento de verdade: ficam no projeto browser.
});
