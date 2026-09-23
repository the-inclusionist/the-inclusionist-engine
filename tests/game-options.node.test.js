// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAME OPTIONS A CARTRIDGE DECLARES (ADR-0182; issue #178) — the pure half: what a well-formed declaration is, and when
// the «Opções do jogo» door is live.
//
// MUTATIONS CHECKED — at the end of `opcoes-do-jogo.browser.test.js`.
import { describe, it, expect } from 'vitest';
import { gameOptionsProblems } from '../app/js/ui/game-options.js';
import { rootThatActs } from '../app/js/ui/pause-icons.js';

const nada = () => {};
const dificuldade = () => ({
  id: 'difficulty', kind: 'steps', label: 'Dificuldade', hint: 'Quanto o jogo ajuda.',
  values: [{ value: 'easy', label: 'fácil' }, { value: 'medium', label: 'médio' }, { value: 'hard', label: 'difícil' }],
  read: () => 'easy', write: nada,
});
const dicas = () => ({ id: 'hints', kind: 'switch', label: 'Dicas', read: () => true, write: nada });

describe('a game options declaration', () => {
  it('🎯 [Zero] absent is well formed: the cartridge has no options of its own', () => {
    expect(gameOptionsProblems(undefined)).toEqual([]);
  });

  it('🔴 [Right] two well-formed rows have no problem', () => {
    expect(gameOptionsProblems([dificuldade(), dicas(), { ...dificuldade(), id: 'speed', kind: 'list' }])).toEqual([]);
  });

  it('🔴 [Right] each malformed part is named', () => {
    const casos = [
      ['not a list', { id: 'x' }, /gameOptions must be a list/],
      ['no id', [{ ...dicas(), id: '' }], /gameOptions\[0\]\.id/],
      ['repeated id', [dicas(), dicas()], /gameOptions\[1\]\.id .*repeat/],
      ['unknown kind', [{ ...dicas(), kind: 'slider' }], /gameOptions\[0\]\.kind/],
      ['empty label', [{ ...dicas(), label: ' ' }], /gameOptions\[0\]\.label/],
      ['no reader', [{ ...dicas(), read: 1 }], /gameOptions\[0\]\.read/],
      ['no writer', [{ ...dicas(), write: undefined }], /gameOptions\[0\]\.write/],
      ['steps with one value', [{ ...dificuldade(), values: [{ value: 'a', label: 'a' }] }], /gameOptions\[0\]\.values .*two/],
      ['a value with no label', [{ ...dificuldade(), values: [{ value: 'a', label: 'a' }, { value: 'b', label: '' }] }], /gameOptions\[0\]\.values\[1\]/],
      ['a repeated value', [{ ...dificuldade(), values: [{ value: 'a', label: 'a' }, { value: 'a', label: 'b' }] }], /gameOptions\[0\]\.values\[1\].*repeat/],
    ];
    for (const [nome, decl, esperado] of casos) {
      expect(gameOptionsProblems(decl).join(' | '), nome).toMatch(esperado);
    }
  });

  /*
   * 🔴 Probed 2026-09-23: nine of twenty-six checks could be undone with this file green. Almost all are the same gap — every case
   * above was malformed in VALUE and never in TYPE — and three of the mutations did not fail, they THREW: the validator that exists
   * to tell a cartridge what is wrong would crash the start instead. A declaration comes from outside the engine; its type is not
   * given.
   */
  it('🔴 [Right] a part of the WRONG TYPE is named, and nothing throws', () => {
    const casos = [
      ['a row that is text', ['difficulty'], /gameOptions\[0\] must be a row$/],
      ['a row that is null', [null], /gameOptions\[0\] must be a row$/],
      ['an id that is a number', [{ ...dicas(), id: 7 }], /gameOptions\[0\]\.id/],
      ['a hint that is not text', [{ ...dicas(), hint: 3 }], /gameOptions\[0\]\.hint/],
      ['a list with no values', [{ ...dicas(), kind: 'list' }], /gameOptions\[0\]\.values .*two/],
      ['values that are text', [{ ...dificuldade(), values: 'abc' }], /gameOptions\[0\]\.values .*two/],
      ['a position that is null', [{ ...dificuldade(), values: [{ value: 'a', label: 'a' }, null] }], /gameOptions\[0\]\.values\[1\]/],
      ['a position whose value is a number', [{ ...dificuldade(), values: [{ value: 'a', label: 'a' }, { value: 2, label: 'b' }] }], /gameOptions\[0\]\.values\[1\]/],
      ['a position whose label is a number', [{ ...dificuldade(), values: [{ value: 'a', label: 'a' }, { value: 'b', label: 5 }] }], /gameOptions\[0\]\.values\[1\]/],
    ];
    for (const [nome, decl, esperado] of casos) {
      let problems;
      expect(() => { problems = gameOptionsProblems(decl); }, `${nome}: the validator threw`).not.toThrow();
      expect(problems.join(' | '), nome).toMatch(esperado);
    }
  });

  it('🔴 [Right] steps hold at most five positions; more is a list (ADR-0130 erratum)', () => {
    const seis = Array.from({ length: 6 }, (_, i) => ({ value: String(i), label: String(i) }));
    expect(gameOptionsProblems([{ ...dificuldade(), values: seis }]).join(' '), 'six steps accepted').toMatch(/five.*list/);
    expect(gameOptionsProblems([{ ...dificuldade(), kind: 'list', values: seis }])).toEqual([]);
  });
});

describe('the «Opções do jogo» door', () => {
  const raiz = [{ act: 'resume' }, { act: 'opcoesdojogo' }, { act: 'quit' }];
  const opcoes = [{ act: 'pmback' }, { act: 'audio' }];
  const vivo = (acts) => rootThatActs(raiz, opcoes, { audio: nada, ...acts }, [{ act: 'pmback' }]).map((b) => b.act);

  it('🎯 [Zero] with nothing behind it, the door is not live', () => {
    expect(vivo({})).not.toContain('opcoesdojogo');
  });
  it('🔴 [Right] an action for the door makes it live, with no list of its own behind it', () => {
    expect(vivo({ opcoesdojogo: nada })).toContain('opcoesdojogo');
  });
});
