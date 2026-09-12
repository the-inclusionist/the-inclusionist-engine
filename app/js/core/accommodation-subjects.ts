// SPDX-License-Identifier: AGPL-3.0-or-later
// core/accommodation-subjects — WHICH CONTRACT-KEYED ACCOMMODATIONS HAVE A SUBJECT, derived from what the game already
// declares (ADR-0153).
//
// ========================= WHY THIS IS DERIVED AND NOT ASKED =========================
// Fifteen accommodations have a subject that the contract ALREADY answers: whether time runs on its own (`tick`),
// whether the game holds keys (`seguraTeclas`), whether it needs a continuous pointer (`needsPointer`), whether it has a
// world and a direction (`world` × `topology`), how many players there are. Asking the cartridge again would let the two
// answers disagree — so the engine derives them, which is the `sonarPlayers` precedent: absent ⇒ derive from the contract.
//
// ⚠️ DERIVED AT CALL TIME, NEVER MEMOISED: every input is a FUNCTION of the contract, because a game changes demands
// between phases (ADR-0084). A set computed once at boot would describe the first phase forever.
//
// 📌 A separate module and not `core/accommodations`, which stays a leaf with zero imports. This one reads the contract.
import type { GameDeclaration } from './contract.js';
import type { Action } from './actions.js';
import { CONTRACT_KEYED } from './accommodations.js';

export type ContractKeyedAccommodation = (typeof CONTRACT_KEYED)[number];

/** What the derivation reads — and only that. */
export interface SubjectInputs {
  readonly declaration: Pick<GameDeclaration, 'tick' | 'seguraTeclas' | 'needsPointer' | 'world' | 'topology'>;
  /** The positions this game's preset names (`presetActions`). Empty = the game is not played by actions. */
  readonly actions: readonly Action[];
  /** How many seats (`players().length` — a game that declares none has one child playing). */
  readonly players: number;
}

/**
 * The contract-keyed accommodations with a subject in this game, NOW.
 *
 * The rules, each one the study's key (`docs/1-Discovery/estudo-acomodacoes-por-genero.md` §0.1) read off the contract:
 *   · `gameSpeed` ← time runs on its own (`tick === 'clock'`) — WCAG 2.2.1, GAG Basic «adjust the game speed»
 *   · `moveLatch`, `holdLatch` ← the game holds keys
 *   · `virtualPad`, `oneButton`, `inputCooldown`, `macros` ← the game is played by actions
 *   · `pointerSmoothing`, `pointerSensitivity`, `pointerStyle` ← the game needs a continuous pointer
 *   · `visionSimulation`, `audioDescription` ← there is a world (`world: none` refuses empathy and sonar, contract §8)
 *   · `blindMode`, `navigationSound` ← a world AND a direction: `bearing` answers `none` on `hotspots`
 *   · `perPlayerAudioOutput` ← more than one seat
 */
export function contractSubjects(i: SubjectInputs): ReadonlySet<ContractKeyedAccommodation> {
  const d = i.declaration;
  const temMundo = d.world().kind === 'element';
  const temDirecao = temMundo && d.topology().kind !== 'hotspots';
  const porAcoes = i.actions.length > 0;
  const ponteiro = d.needsPointer?.() === true;
  const segura = d.seguraTeclas();
  const regra: Readonly<Record<ContractKeyedAccommodation, boolean>> = {
    gameSpeed: d.tick === 'clock',
    moveLatch: segura, holdLatch: segura,
    virtualPad: porAcoes, oneButton: porAcoes, inputCooldown: porAcoes, macros: porAcoes,
    pointerSmoothing: ponteiro, pointerSensitivity: ponteiro, pointerStyle: ponteiro,
    visionSimulation: temMundo, audioDescription: temMundo,
    blindMode: temDirecao, navigationSound: temDirecao,
    perPlayerAudioOutput: i.players > 1,
  };
  return new Set(CONTRACT_KEYED.filter((k) => regra[k]));
}
