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
import { ACOM, U, DECL, EIXOS_DA_DECLARACAO } from '../scripts/lib/accommodations.mjs';
import { MAPA } from '../scripts/lib/taxonomy.mjs';
import { createSettingsStore } from '../app/js/core/state.js';
import { filePort } from './fixtures/file-storage.js';
import { readFileSync } from 'node:fs';

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

describe('the study catalogue agrees with the code and the tables it reads', () => {
  it('🔴 [Cross-check] the taxonomy (`MAPA`) and the declaration axes (`DECL`) key the same 35 categories', () => {
    // `eixosDe` merges both tables by category name; a name only one of them has leaves the other table's axes undefined,
    // and `medir` then throws on the first key that reads one — the two accommodation scripts died that way after an automated
    // rename turned the key `Desenho / Criativo` into `Drawing / Criativo` in the taxonomy alone.
    expect(Object.keys(MAPA).sort()).toEqual(Object.keys(DECL).sort());
    expect(Object.keys(DECL)).toHaveLength(35);
  });

  it('🔴 [Cross-check] every `fonte` that names a GameDeclaration member names one the contract declares', () => {
    // The study prints each axis's source; a renamed contract field left the old name there (`seguraTeclas()` after the
    // field became `holdsKeys()`), and nothing read it against the contract.
    const src = readFileSync(new URL('../app/js/core/contract.ts', import.meta.url), 'utf8');
    const start = src.indexOf('export interface GameDeclaration {');
    expect(start, 'GameDeclaration not found — this case measures nothing').toBeGreaterThanOrEqual(0);
    const body = src.slice(start, src.indexOf('\n}', start));
    const named = Object.values(EIXOS_DA_DECLARACAO).flatMap((e) => [...(e.fonte ?? '').matchAll(/GameDeclaration\.(\w+)/g)].map((m) => m[1]));
    expect(named.length, 'no fonte names a contract member — this case measures nothing').toBeGreaterThan(0);
    const missing = named.filter((m) => !new RegExp(`^\\s*(readonly\\s+)?${m}\\??[:(]`, 'm').test(body));
    expect(missing, 'fonte names a member GameDeclaration does not have').toEqual([]);
  });

  it('🔴 [Cross-check] an accommodation whose state writer exists says `tem: true`', () => {
    // `tem: false` changes nothing in the engine, but the study ranks what is MISSING by reach and GAG level; a `false` the
    // engine already has puts a finished accommodation on the to-do list. Each writer is the one the panel or the quick
    // bar calls: game speed (ADR-0180), one-button scan (ADR-0218), wait between inputs (ADR-0217).
    const { setGameSpeedValue, setSwitchScanValue, setInputCooldownValue } = createSettingsStore(filePort);
    const BUILT = [
      ['velocidadeDoJogo', setGameSpeedValue],
      ['umBotaoSo', setSwitchScanValue],
      ['intervaloEntreEntradas', setInputCooldownValue],
    ];
    for (const [k, writer] of BUILT) {
      expect(typeof writer, `${k}: the engine's writer is gone`).toBe('function');
      expect(ACOM[k]?.tem, `${k} exists in the engine and the study says it does not`).toBe(true);
    }
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

  it('⚠️ [Error] a null word, or a label that is not text, is REPORTED — the validator never throws at the boot it guards', () => {
    // Every case above was malformed in VALUE; these are malformed in TYPE, and reading `.label` of null or `.trim()` of a
    // number would throw from the one function that exists to tell a cartridge what is wrong.
    expect(accommodationPresetProblems({ easyMode: null })[0]).toMatch(/easyMode has an empty label/);
    expect(accommodationPresetProblems({ easyMode: { label: 5 } })[0]).toMatch(/easyMode has an empty label/);
  });
});

describe('the cartridge\'s answer — COMPLETE, and mandatory (ADR-0153)', () => {
  /** A game where nothing game-keyed has a subject, and every «no» is written. */
  const NENHUMA = Object.fromEntries(GAME_KEYED.map((k) => [k, false]));
  // the answer declares KEYS of the game's dictionary (ADR-0232 D3, erratum of 2026-09-25)
  const PLATFORM = { ...NENHUMA, wheelchairMode: { labelKey: 'game.wheelchair' }, caneSpacing: { labelKey: 'game.cane', hintKey: 'game.cane.hint' } };
  /** The game's dictionary, as the root's translator would resolve it — `null` for a key it lacks. */
  const WORDS = { 'game.wheelchair': 'Wheelchair mode', 'game.cane': 'Cane taps' };
  const word = (key) => WORDS[key] ?? null;

  it('🎯 [Right] an answer that covers all sixteen is conformant — «no» everywhere included', () => {
    expect(accommodationAnswersProblems(NENHUMA)).toEqual([]);
    expect(accommodationAnswersProblems(PLATFORM)).toEqual([]);
  });

  it('🔴 [Zero] NO answer is a problem — the difference from the preset, and the Dev\'s decision', () => {
    expect(accommodationAnswersProblems(undefined)[0]).toMatch(/missing .*ADR-0153/);
    expect(accommodationAnswersProblems(null)).toHaveLength(1);
    // and `null` says the same thing — «missing», not «must be an object»: both are a cartridge that did not answer
    expect(accommodationAnswersProblems(null)[0]).toMatch(/missing .*ADR-0153/);
  });

  it('🔴 [Boundary] ONE missing key is a problem, named — silence is not «no»', () => {
    const { easyMode: _fora, ...semUma } = NENHUMA;
    const p = accommodationAnswersProblems(semUma);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/easyMode is not answered/);
  });

  it('🔴 [Error] «true», a blank key and a string are refused — a subject needs the KEY of a word', () => {
    expect(accommodationAnswersProblems({ ...NENHUMA, hints: true })[0]).toMatch(/hints must be false or \{ labelKey \}/);
    expect(accommodationAnswersProblems({ ...NENHUMA, hints: { labelKey: ' ' } })[0]).toMatch(/hints must be false or \{ labelKey \}/);
    expect(accommodationAnswersProblems({ ...NENHUMA, hints: 'Hints' })[0]).toMatch(/hints must be false or \{ labelKey \}/);
  });

  it('🔴 [Error] the OLD shape — a word under `label` — is refused, and says keys: since ADR-0232 D3 a game declares keys', () => {
    expect(accommodationAnswersProblems({ ...NENHUMA, hints: { label: 'Hints' } })[0]).toMatch(/hints must be false or \{ labelKey \}.*dictionary/);
    expect(accommodationAnswersProblems({ ...NENHUMA, hints: { labelKey: 'game.hints', hintKey: 5 } })[0]).toMatch(/hints must be false/);
  });

  it('🔴 [Error] an answer that is a list or a number is refused in ONE line — never read key by key', () => {
    // A list read key by key would answer sixteen «not answered» lines for one mistake; a number would throw on `k in 5`.
    const umaLinha = ['accommodations: must be an object keyed by accommodation'];
    expect(accommodationAnswersProblems([])).toEqual(umaLinha);
    expect(accommodationAnswersProblems(5)).toEqual(umaLinha);
    expect(accommodationAnswersProblems('Hints')).toEqual(umaLinha);
  });

  it('⚠️ [Error] a null answer, or a key that is not text, is REPORTED — never thrown', () => {
    expect(accommodationAnswersProblems({ ...NENHUMA, hints: null })[0]).toMatch(/hints must be false or \{ labelKey \}/);
    expect(accommodationAnswersProblems({ ...NENHUMA, hints: { labelKey: 5 } })[0]).toMatch(/hints must be false or \{ labelKey \}/);
  });

  it('🔴 [Error] answering a general or contract-keyed one is refused, and says why — asking twice lets answers disagree', () => {
    expect(accommodationAnswersProblems({ ...NENHUMA, gameSpeed: false })[0]).toMatch(/gameSpeed is not the cartridge's to answer/);
    expect(accommodationAnswersProblems({ ...NENHUMA, wheelchair: false })[0]).toMatch(/«wheelchair» is not in the catalogue/);
  });

  it('🎯 [Right] subjectWord gives the game\'s word, resolved NOW, and null for «no» — never the id, never the key, never true', () => {
    expect(subjectWord(PLATFORM, 'wheelchairMode', word)).toEqual({ label: 'Wheelchair mode' });
    expect(subjectWord(PLATFORM, 'pieceSets', word)).toBeNull();
    // a hint key the dictionary lacks is no hint — never the key in the footer
    expect(subjectWord(PLATFORM, 'caneSpacing', word)).toEqual({ label: 'Cane taps' });
  });

  it('🔴 [Right] a name key the dictionary lacks is NO subject shown — null, and never the key on screen (ADR-0232 D3)', () => {
    expect(subjectWord(PLATFORM, 'wheelchairMode', () => null)).toBeNull();
    // and the word follows the dictionary it is read through: the same answer, another language
    expect(subjectWord(PLATFORM, 'wheelchairMode', (k) => (k === 'game.wheelchair' ? 'Modo cadeira' : null)))
      .toEqual({ label: 'Modo cadeira' });
  });

  it('[Right] the game-keyed family is what the cartridge answers', () => {
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
//
// PROBED AGAIN (2026-09-23), nineteen decisions of the two validators disabled one at a time — `scratchpad/sonda-acc.py`.
// Seven were green, and every one was malformed in TYPE where each case above was malformed in VALUE: a list or a number as
// the answer, a null word, a label that is not text — four of them THREW instead of reporting. Held now by «…refused in ONE
// line» and the two «…REPORTED — never thrown» cases. One is EQUIVALENT and declared rather than caught: dropping the check
// that a word is an OBJECT changes nothing for a string or a number, which have no text `label` and are refused by the next
// check anyway.
//
// RE-PROBED IN THE NEW SHAPE (`isKeyed`, `isWord`, `answerProblem` — `scratchpad/sonda-acc-3.py`): 15 of 19 red, with the
// «null says missing» line above, which the new shape made necessary — there a `null` answer no longer throws (the keyed
// check refuses it), so only the MESSAGE told the two guards apart. Declared rather than caught:
//   · the keyed check refusing `null` itself — both callers return on `null` before asking it;
//   · a word being an OBJECT (as above);
//   · the ORDER between the two kinds of problem (unanswered before strangers, strangers before nameless) — kept as it was,
//     and no reader of `problems` depends on it.
