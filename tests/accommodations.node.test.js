// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ACCOMMODATION CATALOGUE (ADR-0145) — the closed vocabulary, its three families, and the preset over it.
//
// ========================= WHAT THIS FILE DECIDES =========================
// 🎯 THE FAMILIES ARE THE STUDY'S FINDING, HELD AS TYPES. Whether an accommodation has a subject in a game is
// answered in three different places — always, by the contract, or by the game — and a family that drifts
// from the study is an accommodation the engine would derive wrongly. So one case reads the study's own
// catalogue (`scripts/lib/accommodations.mjs`) and compares family sizes: the two lists cannot silently part.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  ACCOMMODATIONS, GENERAL, CONTRACT_KEYED, GAME_KEYED, isAccommodation, presetAccommodations,
  accommodationLabellerFrom, accommodationPresetProblems, accommodationAnswersProblems, subjectWord, isGameKeyed,
} from '../app/js/core/accommodations.js';
import { ACOM, U } from '../scripts/lib/accommodations.mjs';

describe('the catalogue and its three families', () => {
  it('🎯 [Right] no id repeats', () => {
    expect(new Set(ACCOMMODATIONS).size).toBe(ACCOMMODATIONS.length);
  });

  it('🔴 [Right] the three families cover the whole list and do not overlap', () => {
    // ⚠️ THIS IS WHAT PREVENTS AN ORPHAN. An accommodation added to the list and to no family would pass
    // `isAccommodation` and be answered by nobody — neither mounted always, nor derived, nor declared.
    const families = [...GENERAL, ...CONTRACT_KEYED, ...GAME_KEYED];
    expect(families).toHaveLength(ACCOMMODATIONS.length);
    expect([...families].sort()).toEqual([...ACCOMMODATIONS].sort());
  });

  it('🔴 [Cross-check] each family has the size the STUDY measured', () => {
    // The study keys each accommodation on one axis. Universal ⇒ GENERAL; an axis the contract (or the
    // players list) already answers ⇒ CONTRACT_KEYED; anything else ⇒ GAME_KEYED.
    const ANSWERED_BY_THE_CONTRACT = new Set(['tick', 'segura', 'entrada', 'mundo', 'espaco', 'jogadores']);
    const study = Object.values(ACOM);
    expect(study).toHaveLength(ACCOMMODATIONS.length);
    expect(study.filter((a) => a.chave === U)).toHaveLength(GENERAL.length);
    expect(study.filter((a) => a.chave !== U && ANSWERED_BY_THE_CONTRACT.has(a.chave.eixo))).toHaveLength(CONTRACT_KEYED.length);
    expect(study.filter((a) => a.chave !== U && !ANSWERED_BY_THE_CONTRACT.has(a.chave.eixo))).toHaveLength(GAME_KEYED.length);
  });

  it('📌 [Right] platform vocabulary is NOT general — the wheelchair-in-chess defect', () => {
    // ADR-0145's context, in the Dev's words: «Não faz sentido um modo cadeira de rodas num xadrez».
    for (const a of ['wheelchairMode', 'easyMode', 'pieceSets']) {
      expect(GENERAL, `${a} would mount in every game`).not.toContain(a);
      expect(GAME_KEYED).toContain(a);
    }
  });

  it('[Boundary] isAccommodation rejects what is not an id of the catalogue', () => {
    expect(isAccommodation('gameSpeed')).toBe(true);
    for (const x of ['GameSpeed', 'velocidadeDoJogo', '', null, undefined, 3, {}]) expect(isAccommodation(x)).toBe(false);
  });
});

describe('the preset — a game names only what has a subject in it', () => {
  const PLATFORM = {
    wheelchairMode: { label: 'Wheelchair mode', hint: 'No jumping: ramps and lifts instead.' },
    easyMode: { label: 'Easy mode' },
  };

  it('🎯 [Right] presetAccommodations returns the named entries in CANONICAL order, not declaration order', () => {
    expect(presetAccommodations({ wheelchairMode: { label: 'W' }, typography: { label: 'T' } }))
      .toEqual(['typography', 'wheelchairMode']);
  });

  it('🔴 [Right] the labeller gives the GAME\'s word, and null — never the id — for what it does not name', () => {
    const name = accommodationLabellerFrom(PLATFORM);
    expect(name('wheelchairMode')).toBe('Wheelchair mode');
    expect(name('pieceSets')).toBeNull();
    // 📌 The pair: a blank label is also null, so a whitespace word cannot reach a screen reader as a name.
    expect(accommodationLabellerFrom({ easyMode: { label: '   ' } })('easyMode')).toBeNull();
  });

  it('🔴 [Zero] an ABSENT preset is conformant — a game that names nothing still gets the general ones', () => {
    // ⚠️ The deliberate difference from `presetProblems`, which calls an empty action preset a problem.
    expect(accommodationPresetProblems(undefined)).toEqual([]);
    expect(accommodationPresetProblems(null)).toEqual([]);
    expect(accommodationPresetProblems({})).toEqual([]);
    expect(accommodationPresetProblems(PLATFORM)).toEqual([]);
  });

  it('🔴 [Error] a blank label is a problem, named by its accommodation', () => {
    const p = accommodationPresetProblems({ ...PLATFORM, easyMode: { label: ' ' } });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/easyMode has an empty label/);
  });

  it('🔴 [Error] an unknown key is a problem, and the message says where a game\'s OWN accommodation goes', () => {
    const p = accommodationPresetProblems({ ...PLATFORM, wheelchair: { label: 'Wheelchair' } });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/«wheelchair» is not in the catalogue/);
    expect(p[0]).toMatch(/addition \(ADR-0145 §2\)/);
  });

  it('[Error] a preset that is not an object is refused in one line', () => {
    expect(accommodationPresetProblems(['typography'])).toEqual(['accommodations: must be an object keyed by accommodation']);
    expect(accommodationPresetProblems('typography')).toEqual(['accommodations: must be an object keyed by accommodation']);
  });
});

describe('the cartridge\'s answer — COMPLETE, and mandatory (ADR-0153)', () => {
  /** A game where nothing game-keyed has a subject, and every «no» is written. */
  const NENHUMA = Object.fromEntries(GAME_KEYED.map((k) => [k, false]));
  const PLATFORM = { ...NENHUMA, wheelchairMode: { label: 'Wheelchair mode' }, caneSpacing: { label: 'Cane taps' } };

  it('🎯 [Right] an answer that covers all sixteen is conformant — «no» everywhere included', () => {
    expect(accommodationAnswersProblems(NENHUMA)).toEqual([]);
    expect(accommodationAnswersProblems(PLATFORM)).toEqual([]);
  });

  it('🔴 [Zero] NO answer is a problem — the difference from the preset, and the Dev\'s decision', () => {
    expect(accommodationAnswersProblems(undefined)[0]).toMatch(/missing .*ADR-0153/);
    expect(accommodationAnswersProblems(null)).toHaveLength(1);
  });

  it('🔴 [Boundary] ONE missing key is a problem, named — silence is not «no»', () => {
    const { easyMode: _fora, ...semUma } = NENHUMA;
    const p = accommodationAnswersProblems(semUma);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/easyMode is not answered/);
  });

  it('🔴 [Error] «true», a blank label and a string are refused — a subject needs a WORD', () => {
    expect(accommodationAnswersProblems({ ...NENHUMA, hints: true })[0]).toMatch(/hints must be false or a word/);
    expect(accommodationAnswersProblems({ ...NENHUMA, hints: { label: ' ' } })[0]).toMatch(/hints must be false or a word/);
    expect(accommodationAnswersProblems({ ...NENHUMA, hints: 'Hints' })[0]).toMatch(/hints must be false or a word/);
  });

  it('🔴 [Error] answering a general or contract-keyed one is refused, and says why — asking twice lets answers disagree', () => {
    expect(accommodationAnswersProblems({ ...NENHUMA, gameSpeed: false })[0]).toMatch(/gameSpeed is not the cartridge's to answer/);
    expect(accommodationAnswersProblems({ ...NENHUMA, wheelchair: false })[0]).toMatch(/«wheelchair» is not in the catalogue/);
  });

  it('🎯 [Right] subjectWord gives the game\'s word, and null for «no» — never the id, never true', () => {
    expect(subjectWord(PLATFORM, 'wheelchairMode')).toEqual({ label: 'Wheelchair mode' });
    expect(subjectWord(PLATFORM, 'pieceSets')).toBeNull();
    expect(isGameKeyed('caneSpacing')).toBe(true);
    expect(isGameKeyed('typography')).toBe(false);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Applied by script, occurrence count checked before each:
//   A1 an accommodation drops out of its family               🔴 orphan
//   A2 the same id in two families                            🔴 overlap
//   A3 wheelchairMode moves to GENERAL                        🔴 the chess defect
//   A4 presetAccommodations returns declaration order         🔴 canonical order
//   A5 the labeller falls back to the id                      🔴 id reaches a child
//   A6 the labeller stops trimming                            🔴 blank word passes
//   A7 an absent preset becomes a problem                     🔴 general ones would need a word
//   A8 unknown keys stop being reported                       🔴 a typo vanishes
//   A9 blank labels stop being reported                       🔴 nameless row
//   A10 an accommodation added to the study and not here      🔴 the two lists part
//   R1 an absent answer passes                                 🔴 the optional field the Dev refused
//   R2 missing keys are not reported                           🔴 silence answers
//   R3 `true` is accepted as an answer                          🔴 a subject with no word
//   R4 a non-game-keyed key is not reported                    🔴 two answers for one question
