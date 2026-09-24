// SPDX-License-Identifier: AGPL-3.0-or-later
// A ARESTA E A ALTERNÂNCIA CHEGAM JUNTAS — a cadeia inteira do ADR-0113, de ponta a ponta (issue #127).
//
// ========================= O QUE ESTE FICHEIRO FECHA =========================
// Os outros três gates desta cadeia afirmam cada um a sua peça: a REGRA (`latch-scope`), o ARMAZENAMENTO
// (`latch-store`), o AUTÓMATO (`transport-in-use`) e a RESOLUÇÃO (`latch-sync`). Todos verdes, e durante um
// dia inteiro a cadeia não existia — medido em 2026-09-09, `playerEdge` e `storedLatch` tinham
// ZERO chamadores em produção. Peças aferidas não são uma fiação.
//
// 🎯 Este é o caso que só passa quando as quatro estão ligadas: uma criança troca de aparelho, e o jogador
// que a física lê muda com ela.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLatchedEdge } from '../app/js/input/latch-edge.js';
import { inputOf, forgetInputs } from '../app/js/input/state.js';
import { latchKey, legacyLatchKey } from '../app/js/input/latch-scope.js';
import { BASE_DA_MARCHA } from '../app/js/input/latch-sync.js';

function armazemFalso(inicial = {}) {
  const dados = { ...inicial };
  const escritas = [];
  return {
    get: (chave) => (chave in dados ? dados[chave] : null),
    set: (chave, valor) => { escritas.push(chave); dados[chave] = valor; },
    escritas,
  };
}

const jogador = () => ({ toggleMove: false, walkDir: 0 });
const chave = (i, transporte) => latchKey(BASE_DA_MARCHA, i, transporte);

beforeEach(() => { forgetInputs(); });
afterEach(() => { forgetInputs(); });

describe('a aresta que também resolve a alternância', () => {
  it('[Right] a aresta chega ao autómato E o jogador recebe a alternância daquele aparelho', () => {
    const armazem = armazemFalso({ [chave(0, 'gamepad')]: '1' });
    const p = jogador();
    const aresta = createLatchedEdge(() => [p], { store: armazem, padrao: false });

    aresta(0, 'gamepad');

    expect(inputOf(0).inUse, 'o autómato não soube do controle').toBe('gamepad');
    expect(p.toggleMove, 'a alternância guardada para o controle não chegou ao jogador').toBe(true);
  });

  it('🎯 [Sequência] trocar de aparelho troca a resposta — e o armazenamento não é tocado', () => {
    const armazem = armazemFalso({ [chave(0, 'gamepad')]: '1', [chave(0, 'teclado')]: '0' });
    const p = jogador();
    const aresta = createLatchedEdge(() => [p], { store: armazem, padrao: false });

    aresta(0, 'gamepad');
    expect(p.toggleMove).toBe(true);
    p.walkDir = -1;                       // ela estava a andar por travamento

    aresta(0, 'teclado');
    expect(p.toggleMove, 'o teclado herdou a alternância do controle').toBe(false);
    expect(p.walkDir, '🔴 perdeu a alternância e a personagem continuou a andar sozinha').toBe(0);

    expect(armazem.escritas, 'trocar de aparelho GRAVOU — apagaria a escolha do outro controle').toEqual([]);
  });

  it('🔴 uma aresta de OLHOS traz a alternância ligada mesmo com `0` guardado — cláusula 3, pela cadeia toda', () => {
    const armazem = armazemFalso({
      [chave(0, 'olhos')]: '0', [legacyLatchKey(BASE_DA_MARCHA, 0)]: '0',
    });
    const p = jogador();
    createLatchedEdge(() => [p], { store: armazem, padrao: false })(0, 'olhos');
    expect(p.toggleMove, 'quem joga por olhar ficou sem a alternância de que a entrada dela depende').toBe(true);
  });

  it('[Muitos] cada assento resolve o seu — a aresta do J2 não mexe no J1', () => {
    const armazem = armazemFalso({ [chave(1, 'toque')]: '1' });
    const p0 = jogador(); const p1 = jogador();
    const aresta = createLatchedEdge(() => [p0, p1], { store: armazem, padrao: false });

    aresta(1, 'toque');

    expect([p0.toggleMove, p1.toggleMove], 'a alternância foi para o assento errado').toEqual([false, true]);
    expect(inputOf(0).inUse, 'a aresta do J2 mexeu no transporte do J1').toBe('teclado');
    expect(inputOf(1).inUse).toBe('toque');
  });

  it('[Zero] assento sem jogador: a aresta fica registada à mesma, e nada rebenta', () => {
    const armazem = armazemFalso();
    const aresta = createLatchedEdge(() => [], { store: armazem, padrao: false });
    expect(() => aresta(3, 'toque')).not.toThrow();
    expect(inputOf(3).inUse, 'o transporte em uso é facto sobre a ENTRADA, não sobre quem já entrou').toBe('toque');
  });

  it('📌 [Boundary] o padrão de fábrica é o do `DEFAULTS`, não um `false` escrito à mão', async () => {
    const { DEFAULTS } = await import('../app/js/core/state.js');
    const armazem = armazemFalso();
    const p = { toggleMove: !DEFAULTS.toggleMove, walkDir: 0 };
    createLatchedEdge(() => [p], { store: armazem })(0, 'teclado');
    expect(p.toggleMove, 'sem nada guardado, a resposta tem de ser a de fábrica').toBe(DEFAULTS.toggleMove);
  });
});

// ================================ MUTAÇÕES CONFERIDAS ================================
// 1. tirar o `playerEdge(jogador, origem)` → a [Sequência] reprova: sem o autómato, `emUso` fica no
//    `teclado` para sempre e a alternância do controle nunca é lida. É a metade que faltava até hoje.
// 2. tirar o `syncLatch(...)` → o [Right] reprova: o autómato sabe, e o jogador não.
// 3. resolver o jogador 0 sempre (`getPlayers()[0]`) → o [Muitos] reprova. A alternância é o ajuste de quem
//    não consegue manter uma tecla premida; dá-la ao assento errado é dá-la a quem não pediu e tirá-la a
//    quem precisa.
// 4. ⚠️ trocar `inputOf(jogador).emUso` por `origem` → SOBREVIVE, e está registada por isso: hoje o
//    `afterEdge` põe sempre `emUso = origem`, logo as duas expressões são o mesmo valor. Fica no código a
//    ler o autómato — não por cobertura, mas porque QUAL transporte está em uso é a pergunta que aquele
//    módulo existe para responder, e uma segunda resposta divergiria no dia em que ele ganhasse uma regra.
