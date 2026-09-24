// SPDX-License-Identifier: AGPL-3.0-or-later
// The gate of the SAVED-DATA MIGRATION (issue #103 — the half that touches the child's browser).
//
// ⚠️ WHAT IS AT STAKE IS NOT COMPATIBILITY, IT IS AN ADAPTATION. Whoever remapped keys usually did it out of need — hand
// reach, a finger that does not stretch, a keyboard with no numpad. A saved scheme whose old keys stop matching raises
// no error: the keys simply stop responding, and the child concludes the game broke. Losing that is losing an
// adaptation, not a preference.
import { describe, it, expect } from 'vitest';
import { migrateScheme, migrateSaved, migrateTouchMap, migrateControlMap, OLD_VOCABULARY } from '../app/js/input/vocabulary-migration.js';

/** A scheme as saved in the old platform vocabulary. */
const ANTIGO = {
  left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
  run: ['KeyU'], jump: ['KeyJ', 'Space'], swap: ['KeyI'], especial: ['KeyK'],
};

describe('a tradução segue o ADR-0086, e não o ADR-0074', () => {
  it('⚠️ `run` é `action1` e `jump` é `action2` — a tabela do 0074 movia a tecla da criança', () => {
    expect(OLD_VOCABULARY).toEqual({
      run: 'action1', jump: 'action2', especial: 'action3', swap: 'action4',
      // ⚠️ The fifth is not a platform verb: the touch layer called `pause` the position everything else calls
      // `start`. It was the only action word missing from the abstract set.
      pause: 'start',
    });
  });

  it('cada tecla chega à posição certa, sem se mover', () => {
    const novo = migrateScheme(ANTIGO);
    expect(novo.action1).toEqual(['KeyU']);          // correr
    expect(novo.action2).toEqual(['KeyJ', 'Space']); // pular
    expect(novo.action3).toEqual(['KeyK']);          // especial
    expect(novo.action4).toEqual(['KeyI']);          // trocar
  });

  it('as direções atravessam intactas — nunca mudaram de nome', () => {
    const novo = migrateScheme(ANTIGO);
    expect(novo.left).toEqual(['KeyA']);
    expect(novo.right).toEqual(['KeyD']);
    expect(novo.up).toEqual(['KeyW']);
    expect(novo.down).toEqual(['KeyS']);
  });

  it('⚠️ NENHUMA tecla se perde: o conjunto de códigos é o mesmo antes e depois', () => {
    // The assertion that counts, because it is the only one that catches a mistranslation of ANY key, including one
    // this test did not think to name.
    const codigos = (e) => [...new Set(Object.values(e).flat())].sort();
    expect(codigos(migrateScheme(ANTIGO))).toEqual(codigos(ANTIGO));
  });
});

describe('a função aguenta o mundo real', () => {
  it('é IDEMPOTENTE — aplicada duas vezes dá o mesmo', () => {
    // `loadKB` may run more than once in a session; a migration that broke on the second pass would fail far from its
    // cause.
    const uma = migrateScheme(ANTIGO);
    expect(migrateScheme(uma)).toEqual(uma);
  });

  it('chave desconhecida atravessa em vez de ser apagada', () => {
    const comLixo = { ...ANTIGO, action7: ['KeyO'], qualquer: ['F13'] };
    const novo = migrateScheme(comLixo);
    expect(novo.action7).toEqual(['KeyO']);
    expect(novo.qualquer).toEqual(['F13']);
  });

  it('esquema meio migrado UNE as duas chaves em vez de perder uma', () => {
    // Losing a key is the damage; having the same one twice is not.
    const meio = { jump: ['KeyJ'], action2: ['Space'] };
    expect(migrateScheme(meio).action2.sort()).toEqual(['KeyJ', 'Space']);
  });

  it('nulo e indefinido não estouram', () => {
    expect(migrateScheme(null)).toBeNull();
    expect(migrateScheme(undefined)).toBeNull();
    expect(migrateSaved(null)).toBeNull();
  });
});

describe('o objeto salvo inteiro, com os quatro formatos que existem', () => {
  it('solo, p2, p3 e p4 são todos traduzidos', () => {
    const salvo = { solo: ANTIGO, p2: [ANTIGO, ANTIGO], p3: [ANTIGO], p4: [ANTIGO, ANTIGO, ANTIGO, ANTIGO] };
    const novo = migrateSaved(salvo);
    expect(novo.solo.action2).toEqual(['KeyJ', 'Space']);
    expect(novo.p2).toHaveLength(2);
    expect(novo.p2[1].action1).toEqual(['KeyU']);
    expect(novo.p3[0].action3).toEqual(['KeyK']);
    expect(novo.p4[3].action4).toEqual(['KeyI']);
  });

  it('⚠️ o formato mais antigo, `p34`, também é traduzido — ele já sobreviveu a uma migração', () => {
    // `loadKB` migrates the SHAPE of `p34` into p3+p4; if the vocabulary were not migrated here, the oldest data of all
    // would be the only data lost.
    const novo = migrateSaved({ p34: [ANTIGO, null, ANTIGO] });
    expect(novo.p34[0].action2).toEqual(['KeyJ', 'Space']);
    expect(novo.p34[1]).toBeNull();
    expect(novo.p34[2].action1).toEqual(['KeyU']);
  });

  it('grupo ausente continua ausente — não se inventa esquema', () => {
    const novo = migrateSaved({ solo: ANTIGO });
    expect(novo.p2).toBeUndefined();
    expect(novo.p3).toBeUndefined();
    expect(novo.p4).toBeUndefined();
  });
});

describe('⚠️ o SEGUNDO dado salvo: o mapa de toque, onde a ação está no VALOR', () => {
  it('traduz o valor de cada slot', () => {
    const antigo = { up: 'up', down: 'down', left: 'left', right: 'right', start: 'pause', b0: 'jump', b1: 'especial', b2: 'run', b3: 'swap' };
    const novo = migrateTouchMap(antigo);
    expect(novo.b0).toBe('action2');
    expect(novo.b1).toBe('action3');
    expect(novo.b2).toBe('action1');
    expect(novo.b3).toBe('action4');
  });

  it('as direções atravessam intactas', () => {
    expect(migrateTouchMap({ up: 'up', left: 'left' })).toEqual({ up: 'up', left: 'left' });
  });

  it('⚠️ o slot do START deixa de dizer `pause` e passa a dizer `start`', () => {
    // Without this translation a tablet's only pause button would stop pausing: `decide()` looks for `'start'` and
    // would receive `'pause'`, which is no action any more. No error and no warning.
    expect(migrateTouchMap({ start: 'pause' })).toEqual({ start: 'start' });
  });

  it('é idempotente, como o do teclado', () => {
    const uma = migrateTouchMap({ b0: 'jump' });
    expect(migrateTouchMap(uma)).toEqual(uma);
  });

  it('nulo não estoura', () => {
    expect(migrateTouchMap(null)).toBeNull();
    expect(migrateTouchMap(undefined)).toBeNull();
  });

  it('⚠️ NENHUM slot se perde — o conjunto de chaves é o mesmo', () => {
    // The damage here would be an on-screen button that stops doing anything, and on a public-school tablet touch is
    // not the alternative path: it is the only one.
    const antigo = { up: 'up', down: 'down', left: 'left', right: 'right', start: 'pause', b0: 'jump', b1: 'especial', b2: 'run', b3: 'swap' };
    expect(Object.keys(migrateTouchMap(antigo)).sort()).toEqual(Object.keys(antigo).sort());
  });
});

describe('⚠️ o TERCEIRO dado salvo: o mapa do assistente de controle', () => {
  it('traduz as chaves de ação e preserva o binding físico', () => {
    const antigo = { up: { b: 12 }, jump: { b: 0 }, run: { b: 2 }, swap: { b: 3 }, especial: { b: 1 }, start: { b: 9 } };
    const novo = migrateControlMap(antigo);
    expect(novo.action2).toEqual({ b: 0 });
    expect(novo.action1).toEqual({ b: 2 });
    expect(novo.action4).toEqual({ b: 3 });
    expect(novo.action3).toEqual({ b: 1 });
    expect(novo.up).toEqual({ b: 12 });
    expect(novo.start).toEqual({ b: 9 });
  });

  it('`_skip` atravessa — é sentinela, não ação', () => {
    expect(migrateControlMap({ _skip: true }).\u005Fskip).toBe(true);
  });

  it('bindings analógicos e de hat atravessam sem perder campo', () => {
    const novo = migrateControlMap({ jump: { ax: 2, s: -1 }, run: { av: 6, v: -0.71 } });
    expect(novo.action2).toEqual({ ax: 2, s: -1 });
    expect(novo.action1).toEqual({ av: 6, v: -0.71 });
  });

  it('é idempotente e não estoura em nulo', () => {
    const uma = migrateControlMap({ jump: { b: 0 } });
    expect(migrateControlMap(uma)).toEqual(uma);
    expect(migrateControlMap(null)).toBeNull();
  });

  it('⚠️ NENHUM binding se perde — a contagem de entradas é a mesma', () => {
    // This is the costliest of the three to lose: the map exists because someone went through a wizard, button by
    // button, almost always because the pad is NOT "standard".
    const antigo = { up: { b: 12 }, down: { b: 13 }, left: { b: 14 }, right: { b: 15 }, jump: { b: 0 }, run: { b: 2 }, swap: { b: 3 }, especial: { b: 1 }, start: { b: 9 } };
    expect(Object.keys(migrateControlMap(antigo))).toHaveLength(Object.keys(antigo).length);
  });
});
