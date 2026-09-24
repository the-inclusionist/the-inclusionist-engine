// SPDX-License-Identifier: AGPL-3.0-or-later
// LEGACY KEY INHERITANCE — `getWithLegacy` / `getJsonWithLegacy`.
//
// Worth saying what is lost when this breaks, because it is not a value: it is continuity. The child who already played
// has level 5, the chosen scenery and the demo recording stored under the OLD NAMES. Renaming the key without
// inheritance gives no error at all — it gives a factory game. She opens it and finds level 2 instead of 5, with nothing
// explaining, and no way to know the setting existed.
//
// That is why inheritance is READ-only: writing goes to the new name and the old key stays where it is. It is the child's
// data, not mine to delete, and its permanence is what makes going back possible — if the migration turns out wrong, the
// original value is still there.
//
// ⚠️ THE CASE THAT MATTERS MOST HERE IS THE FALSY VALUE. `''`, `'0'` and `false` are CHOSEN VALUES, not absences: the
// child who turned the cane off chose `'0'` as much as whoever turned it on chose `'1'`. An `if (v)` instead of
// `if (v !== null)` compiles, passes every case with a "normal" value, and silently erases exactly the choices to turn
// something off. It is the mutation these cases exist to catch.
//
// Each case builds a REAL store over a backend of its own (ADR-0232): what is checked is the persistence module itself,
// and without a backend every read would return the default — silently and uselessly.
import { describe, it, expect, beforeEach } from 'vitest';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

const NOVA = 'incl.jogo.nivel';
const LEGADA = 'incl_nivel';

let get, set, setJSON, remove, getWithLegacy, getJsonWithLegacy;
beforeEach(() => {
  ({ get, set, setJSON, remove, getWithLegacy, getJsonWithLegacy } = createStorage(memoryBackend()));
});

describe('getWithLegacy — a chave nova ganha, a velha sustenta', () => {
  it('[Right] com a NOVA presente, é ela que responde — mesmo havendo legada', () => {
    set(NOVA, '5');
    set(LEGADA, '2');
    expect(getWithLegacy(NOVA, LEGADA, 'padrao')).toBe('5');
  });

  it('[Right] sem a nova, HERDA a legada — é assim que o nível 5 sobrevive à renomeação', () => {
    set(LEGADA, '5');
    expect(getWithLegacy(NOVA, LEGADA, 'padrao')).toBe('5');
  });

  it('[Zero] sem nenhuma das duas, devolve o padrão', () => {
    expect(getWithLegacy(NOVA, LEGADA, 'padrao')).toBe('padrao');
    expect(getWithLegacy(NOVA, LEGADA)).toBe(null);
  });

  it('[Boundary] ⚠️ um valor FALSO herdado é um valor: `0` e `` não caem no padrão', () => {
    // Whoever turned the cane off stored '0'. Treating that as absence returns the default ON, and the child finds on
    // again the thing she turned off — the worst kind of accessibility defect, because it looks as if the program ignored
    // her choice.
    set(LEGADA, '0');
    expect(getWithLegacy(NOVA, LEGADA, '1')).toBe('0');
    set(LEGADA, '');
    expect(getWithLegacy(NOVA, LEGADA, 'padrao')).toBe('');
  });

  it('[Boundary] ⚠️ e um valor falso na NOVA também ganha — é AQUI que `!== null` decide', () => {
    // This is the case that discriminates. On the LEGACY side, `if (v)` and `if (v !== null)` give the same result: the
    // new one is absent either way. Only when the NEW one carries the falsy value does the difference show — and then it
    // returns the value of the key the child had already ABANDONED.
    //
    // ⚠️ And there is only one falsy string: `'0'` is TRUTHY in JavaScript, against what other languages' intuition
    // suggests. A case written with `'0'` would pass under the mutation and prove nothing.
    set(NOVA, '');
    set(LEGADA, 'valor-abandonado');
    expect(getWithLegacy(NOVA, LEGADA, 'padrao')).toBe('');
  });

  it('[Interface] LER não migra — a legada continua lá e a nova continua ausente', () => {
    // The old key's permanence is what makes going back possible. If reading wrote to the new one, the first read would
    // be irreversible and a wrong migration would have no way back.
    set(LEGADA, '5');
    getWithLegacy(NOVA, LEGADA, 'padrao');
    expect(get(NOVA, null), 'a leitura gravou na chave nova').toBe(null);
    expect(get(LEGADA, null), 'a leitura apagou a chave legada').toBe('5');
  });
});

describe('getJsonWithLegacy — a mesma herança, para o outro formato', () => {
  it('[Right] a nova ganha; sem ela, herda a legada', () => {
    setJSON(NOVA, { nivel: 5 });
    setJSON(LEGADA, { nivel: 2 });
    expect(getJsonWithLegacy(NOVA, LEGADA)).toEqual({ nivel: 5 });

    remove(NOVA);
    expect(getJsonWithLegacy(NOVA, LEGADA)).toEqual({ nivel: 2 });
  });

  it('[Zero] sem nenhuma das duas, devolve o padrão', () => {
    expect(getJsonWithLegacy(NOVA, LEGADA, { nivel: 1 })).toEqual({ nivel: 1 });
    expect(getJsonWithLegacy(NOVA, LEGADA)).toBe(null);
  });

  it('[Boundary] ⚠️ `false` e `0` herdados são valores — a metade JSON tem a mesma armadilha', () => {
    // If inheritance is not the same for both formats, half the keys migrate and the other half vanish, which is the worst
    // of both worlds: neither the old data nor an error that reveals it.
    setJSON(LEGADA, false);
    expect(getJsonWithLegacy(NOVA, LEGADA, true)).toBe(false);
    setJSON(LEGADA, 0);
    expect(getJsonWithLegacy(NOVA, LEGADA, 9)).toBe(0);

    // ⚠️ And the same on the NEW side, which is where `!== null` actually decides. In JSON the trap is bigger than in text:
    // `false`, `0`, `''` and `null` are all falsy, so an `if (v)` here returns the OLD setting to whoever just turned the
    // thing off in the new one.
    setJSON(NOVA, false);
    setJSON(LEGADA, true);
    expect(getJsonWithLegacy(NOVA, LEGADA)).toBe(false);
  });

  it('[Error] JSON corrompido na nova cai para a legada em vez de derrubar o boot', () => {
    // `localStorage` is data that may have been written by an older version, by another tab, or been truncated. A
    // `JSON.parse` that throws here brings the whole boot down, because `core/state` reads at import.
    set(NOVA, '{isto nao e json');
    setJSON(LEGADA, { nivel: 5 });
    expect(getJsonWithLegacy(NOVA, LEGADA)).toEqual({ nivel: 5 });
  });
});
