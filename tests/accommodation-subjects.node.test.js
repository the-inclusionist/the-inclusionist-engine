// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CONTRACT-KEYED ACCOMMODATIONS, DERIVED (ADR-0153) — each rule, and both sides of it.
//
// A rule tested on one side only passes a derivation that answers «yes» (or «no») always. So every accommodation
// here is asked twice, with the contract answer flipped.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { contractSubjects } from '../app/js/core/accommodation-subjects.js';
import { CONTRACT_KEYED } from '../app/js/core/accommodations.js';

/** A board-like game: player's turn, nothing held, no pointer, a world with a grid, played by actions, one seat. */
const base = () => ({
  declaration: {
    tick: 'player',
    holdsKeys: () => false,
    needsPointer: () => false,
    world: () => ({ kind: 'element', selector: '#game-region' }),
    topology: () => ({ kind: 'grid', size: [3, 3], move: 'orthogonal', frame: 'compass' }),
  },
  actions: ['up', 'down', 'action1'],
  players: 1,
});
const com = (patch) => { const b = base(); return { ...b, ...patch, declaration: { ...b.declaration, ...(patch.declaration ?? {}) } }; };
const tem = (i, k) => contractSubjects(i).has(k);

describe('contractSubjects — every rule, both sides', () => {
  it('🔴 gameSpeed follows the clock', () => {
    expect(tem(base(), 'gameSpeed')).toBe(false);
    expect(tem(com({ declaration: { tick: 'clock' } }), 'gameSpeed')).toBe(true);
  });

  it('🔴 the two latches follow held keys', () => {
    for (const k of ['moveLatch', 'holdLatch']) {
      expect(tem(base(), k)).toBe(false);
      expect(tem(com({ declaration: { holdsKeys: () => true } }), k)).toBe(true);
    }
  });

  it('🔴 the pad, one-button, cooldown and macros follow ACTION input', () => {
    for (const k of ['virtualPad', 'oneButton', 'inputCooldown', 'macros']) {
      expect(tem(base(), k)).toBe(true);
      expect(tem(com({ actions: [] }), k), `${k} offered to a game not played by actions`).toBe(false);
    }
  });

  it('🔴 the three pointer ones follow a continuous pointer — and an ABSENT needsPointer means no', () => {
    for (const k of ['pointerSmoothing', 'pointerSensitivity', 'pointerStyle']) {
      expect(tem(base(), k)).toBe(false);
      expect(tem(com({ declaration: { needsPointer: () => true } }), k)).toBe(true);
      const semCampo = base(); delete semCampo.declaration.needsPointer;
      expect(tem(semCampo, k), 'an optional field left out became a yes').toBe(false);
    }
  });

  it('🔴 vision simulation and audio description follow the world', () => {
    for (const k of ['visionSimulation', 'audioDescription']) {
      expect(tem(base(), k)).toBe(true);
      expect(tem(com({ declaration: { world: () => ({ kind: 'none' }) } }), k)).toBe(false);
    }
  });

  it('🔴 blind mode and navigation sound need a world AND a direction — hotspots have none', () => {
    for (const k of ['blindMode', 'navigationSound']) {
      expect(tem(base(), k)).toBe(true);
      expect(tem(com({ declaration: { topology: () => ({ kind: 'hotspots', order: ['a'] }) } }), k), `${k} on hotspots`).toBe(false);
      // 📌 and a spatial topology with NO world is still no: the contract refuses sonar without a world
      expect(tem(com({ declaration: { world: () => ({ kind: 'none' }) } }), k), `${k} with world none`).toBe(false);
    }
  });

  it('🔴 per-player audio output follows the seat count', () => {
    expect(tem(base(), 'perPlayerAudioOutput')).toBe(false);
    expect(tem(com({ players: 2 }), 'perPlayerAudioOutput')).toBe(true);
  });

  it('[Interface] the answer only ever holds contract-keyed ids', () => {
    const tudoLigado = com({ declaration: { tick: 'clock', holdsKeys: () => true, needsPointer: () => true }, players: 2 });
    expect([...contractSubjects(tudoLigado)].sort()).toEqual([...CONTRACT_KEYED].sort());
  });

  it('⚠️ [Right] derived at CALL time: a topology that changes between phases changes the answer (ADR-0084)', () => {
    let fase = 'mapa';
    const i = com({ declaration: { topology: () => (fase === 'mapa' ? { kind: 'grid', size: [3, 3], move: 'orthogonal', frame: 'compass' } : { kind: 'hotspots', order: ['a'] }) } });
    expect(tem(i, 'navigationSound')).toBe(true);
    fase = 'menu';
    expect(tem(i, 'navigationSound'), 'the answer was frozen at the first call').toBe(false);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   S1 hotspots no longer remove the direction           🔴 sonar on a list of points
//   S2 needsPointer absent counts as yes                 🔴 an optional field decides yes
//   S3 the pad ignores the action list                   🔴 pad for a game with no actions
//   S4 perPlayerAudioOutput from players >= 1            🔴 per-player output for one child
