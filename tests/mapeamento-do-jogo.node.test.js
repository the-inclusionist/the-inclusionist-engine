// SPDX-License-Identifier: AGPL-3.0-or-later
// O JOGO DECLARA O MAPEAMENTO PADRÃO DO TECLADO — e «restaurar padrões» volta AO DELE (ADR-0115, issue #127).
//
// ========================= A ARMADILHA QUE ESTE FICHEIRO GUARDA =========================
// 🔴 Há DOIS sítios que materializam padrões de teclado, e só um deles é óbvio:
//
//   · `loadKB()`  — fábrica + o que a criança guardou. O sítio em que toda a gente pensa.
//   · `resetKB()` — devolvia uma cópia CRUA do `KB_DEFAULTS`. É o «restaurar padrões» do painel de controles.
//
// Com o padrão do jogo a existir e só o primeiro a conhecê-lo, «restaurar padrões» apagaria o mapeamento que
// o JOGO escolheu e devolveria o da ENGINE. A criança carrega no botão esperando voltar ao que o jogo lhe
// deu, e volta para outra coisa — e num jogo cujo autor escolheu o layout por uma razão de acessibilidade,
// ela perde essa razão sem nada o dizer. A resolução passou a ser uma FUNÇÃO SÓ, usada pelos dois.
//
// 📌 A precedência afirmada aqui é a do registo: **fábrica da engine → padrão do JOGO → remapeamento da
// CRIANÇA**. O que ela guardou vem sempre por último, porque é a única das três que ela escolheu.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  factoryWithGame, loadKB, resetKB, registerKeyboardMapping, KB_DEFAULTS,
} from '../app/js/input/keyboard.js';
import * as store from '../app/js/platform/storage.js';

// A MESMA chave que o `input/keyboard` usa. Escrita à mão aqui de propósito: se ela mudar lá, este caso
// deixa de exercitar o dado salvo e o gate diz-o em vez de passar a medir o vazio.
const CKEY = 'inclusionist.kbcontrols.v3';

/**
 * ⚠️ UM `localStorage` DE MENTIRA, e sem ele metade deste ficheiro mediria o nada. O project `node` não tem
 * nenhum e o `platform/storage` degrada em SILÊNCIO (todo acesso é `try/catch`), logo o `setJSON` de um caso
 * não escreve, o `loadKB` não lê, e a asserção «o que ela gravou vence» passaria a comparar a fábrica consigo
 * própria. Apanhado a correr, e não previsto — é a convenção que o `tests/motion-scene` já carrega.
 */
function comArmazenamento(inicial = {}) {
  const dados = { ...inicial };
  globalThis.localStorage = {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
  };
  return dados;
}

beforeEach(() => { registerKeyboardMapping(null); comArmazenamento(); });
afterEach(() => { registerKeyboardMapping(null); delete globalThis.localStorage; });

describe('o padrão do jogo entra entre a fábrica e a criança', () => {
  it('[Zero] sem declaração, a fábrica da engine fica intacta', () => {
    expect(factoryWithGame().solo.action1).toEqual(KB_DEFAULTS.solo.action1);
  });

  it('[Right] o jogo troca UMA posição e o resto continua a ser da engine', () => {
    registerKeyboardMapping(() => ({ action1: ['KeyQ'] }));
    const d = factoryWithGame();
    expect(d.solo.action1, 'o padrão do jogo não chegou').toEqual(['KeyQ']);
    expect(d.solo.action2, 'parcial virou substituição: o resto da fábrica desapareceu').toEqual(KB_DEFAULTS.solo.action2);
  });

  it('🎯 [Boundary] o ASSENTO chega ao jogo — o teclado de dois não é o de um', () => {
    // ⚠️ O defeito que isto prende: um padrão que não soubesse o assento daria as mesmas teclas a duas
    // crianças sentadas ao mesmo teclado, e nenhuma das duas jogaria.
    const vistos = [];
    registerKeyboardMapping((jogadores, assento) => {
      vistos.push([jogadores, assento]);
      return { action1: [`J${jogadores}A${assento}`] };
    });
    const d = factoryWithGame();
    expect(vistos, 'a fábrica não perguntou por cada arranjo e assento').toEqual([
      [1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [3, 2], [4, 0], [4, 1], [4, 2], [4, 3],
    ]);
    expect(d.p2[1].action1).toEqual(['J2A1']);
    expect(d.p4[3].action1).toEqual(['J4A3']);
  });

  it('📌 devolver `null` para um arranjo deixa esse arranjo com a fábrica', () => {
    registerKeyboardMapping((jogadores) => (jogadores === 1 ? { action1: ['KeyQ'] } : null));
    const d = factoryWithGame();
    expect(d.solo.action1).toEqual(['KeyQ']);
    expect(d.p2[0].action1).toEqual(KB_DEFAULTS.p2[0].action1);
  });
});

describe('a precedência, e o botão que a punha em causa', () => {
  it('[Right] o remapeamento da CRIANÇA vence o padrão do jogo', () => {
    registerKeyboardMapping(() => ({ action1: ['KeyQ'] }));
    store.setJSON(CKEY, { solo: { action1: ['KeyZ'] } });
    expect(loadKB().solo.action1, 'o que ela gravou tem de vir por último').toEqual(['KeyZ']);
  });

  it('🔴 «restaurar padrões» volta ao padrão do JOGO, não ao da ENGINE', () => {
    registerKeyboardMapping(() => ({ action1: ['KeyQ'] }));
    store.setJSON(CKEY, { solo: { action1: ['KeyZ'] } });

    const d = resetKB();

    expect(d.solo.action1, 'o reset devolveu a fábrica da engine e apagou a escolha do jogo').toEqual(['KeyQ']);
    expect(store.get(CKEY, null), 'o reset tem de apagar o que ela guardou — é isso que ele é').toBeNull();
  });

  it('[Zero] e sem jogo declarado o reset continua a devolver a fábrica da engine', () => {
    store.setJSON(CKEY, { solo: { action1: ['KeyZ'] } });
    expect(resetKB().solo.action1).toEqual(KB_DEFAULTS.solo.action1);
  });

  it('⚠️ [Interface] a fábrica devolve CÓPIAS: mexer no resultado não contamina o `KB_DEFAULTS`', () => {
    const d = factoryWithGame();
    d.solo.action1 = ['KeyX'];
    expect(factoryWithGame().solo.action1, 'a fábrica foi mutada por quem a leu').toEqual(KB_DEFAULTS.solo.action1);
  });
});

describe('o contrato recusa uma declaração que seria ignorada em silêncio', () => {
  it('⚠️ um VALOR em vez de função é acusado — senão o mapeamento é descartado e ninguém sabe', async () => {
    const { conformanceProblems } = await import('../app/js/core/contract.js');
    const d = { ...declaracaoMinima(), mapeamentoDoTeclado: { action1: ['KeyQ'] } };
    expect(conformanceProblems(d).join(' | ')).toContain('mapeamentoDoTeclado');
  });

  it('⚠️ e um retorno que não é objecto nem `null` também — a fusão engoli-lo-ia sem escrever nada', async () => {
    const { conformanceProblems } = await import('../app/js/core/contract.js');
    const d = { ...declaracaoMinima(), mapeamentoDoTeclado: () => 'KeyQ' };
    expect(conformanceProblems(d).join(' | ')).toContain('mapeamentoDoTeclado');
  });

  it('[Zero] uma declaração correcta — e uma ausente — não acusam nada', async () => {
    const { conformanceProblems } = await import('../app/js/core/contract.js');
    const bom = { ...declaracaoMinima(), mapeamentoDoTeclado: () => ({ action1: ['KeyQ'] }) };
    const nulo = { ...declaracaoMinima(), mapeamentoDoTeclado: () => null };
    expect(conformanceProblems(bom).filter((x) => x.includes('mapeamentoDoTeclado'))).toEqual([]);
    expect(conformanceProblems(nulo).filter((x) => x.includes('mapeamentoDoTeclado'))).toEqual([]);
    expect(conformanceProblems(declaracaoMinima()).filter((x) => x.includes('mapeamentoDoTeclado'))).toEqual([]);
  });
});

/** O mínimo que o contrato aceita — copiado dos outros gates, não inventado. */
function declaracaoMinima() {
  return {
    topology: () => ({ kind: 'hotspots', order: ['q1'] }),
    holdsAtOnce: () => 1,
    seguraTeclas: () => false,
    tick: 'player',
    world: () => ({ kind: 'none' }),
    roleAt: () => 'goal',
    nameAt: () => ({ text: 'x', gender: 'm', plural: false }),
    focusOf: () => null,
    objectiveOf: () => ({ name: { text: 'x', gender: 'm', plural: false }, have: 0, need: 1 }),
    targetsOf: () => [],
  };
}

// ================================ MUTAÇÕES CONFERIDAS ================================
// 1. `resetKB` a voltar a `JSON.parse(JSON.stringify(KB_DEFAULTS))` → 🔴 o caso do «restaurar padrões»
//    reprova. É a armadilha inteira, e a única mutação desta lista que descreve um defeito que uma criança
//    encontra com um clique.
// 2. `factoryWithGame` a chamar o jogo só para o `solo` → o caso do ASSENTO reprova, na lista de perguntas.
// 3. `Object.assign(alvo, parcial)` → `alvo = parcial` (substituir em vez de fundir) → o caso do parcial
//    reprova: o resto da fábrica desaparecia e o jogo passava a ter de declarar as catorze posições.
// 4. o padrão do jogo aplicado DEPOIS do dado salvo, no `loadKB` → o caso da precedência reprova: o
//    remapeamento da criança seria apagado pelo jogo a cada arranque.
