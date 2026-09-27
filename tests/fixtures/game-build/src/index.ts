// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SMALLEST CARTRIDGE THE ENGINE'S BUILD IS PROVED ON (ADR-0253) — the demo's one-screen declaration, cut to three answers.
//
// It is ADR-0139 §2's `Cartridge` as the entry's default export, which is the shape `inclusionist-check-cartridge` reads. It names
// an engine function at RUN time (`conformanceProblems`), so the cartridge build has an import it must keep external and the app
// build one it must bundle; a real cartridge names many more.
import type { CartridgeHooks } from '@the-inclusionist/engine';
import { conformanceProblems, type GameDeclaration } from '@the-inclusionist/engine/core/contract.js';
import { ANSWERS } from './answers.js';

export type { Answer } from './answers.js';

/** Which answer the cursor is on — the one piece of state, read through the declaration's functions (ADR-0084). */
let cursor = 0;

/** A list with no space: hotspots, the player's turn, nothing held. */
const declaration: GameDeclaration = {
  topology: () => ({ kind: 'hotspots', order: ANSWERS.map((a) => a.id) }),
  world: () => ({ kind: 'element', selector: '#game-region' }),
  // a list has no axis, so one position at a time
  holdsAtOnce: () => 1,
  holdsKeys: () => false,
  tick: 'player',
  roleAt: (at) => (at.x === cursor ? 'goal' : 'free'),
  nameAt: (at) => (ANSWERS[at.x] ? { text: ANSWERS[at.x].text, gender: 'f', plural: false } : null),
  focusOf: () => ({ id: 'p0', at: { x: cursor, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'resposta', gender: 'f', plural: false }, have: 0, need: 1 }),
  targetsOf: () => [{ x: cursor, y: 0 }],
};

/** The game's half of the options: the accommodations answered, every one, as ADR-0153 requires. */
const hooks: CartridgeHooks = {
  accommodations: {
    cameraSway: false, easyMode: false, wheelchairMode: false, detectionLeniency: false, intensity: false,
    hints: { labelKey: 'fixture.hints' }, reducedCharacterMotion: false, caneSpacing: false, textPace: false,
    lexicalDifficulty: false, wordHighlight: false, pieceSets: false, distinguishableSuits: false, timingWindow: false,
    aimAssist: false, repeatedInput: false, ownerColors: false, contrastOutlines: false,
  },
  declines: { noPauseActor: true },
  dictionaries: { pt: { 'fixture.hints': 'Dicas' } },
};

/** What `create(ctx)` hands back: nothing runs before it. */
export interface Instance {
  update(dt: number): void;
  teardown(): void;
}

const cartridge = {
  slug: 'game-build-fixture',
  declaration,
  hooks,
  create(ctx: { readonly region: HTMLElement }): Instance {
    // the region shows what the engine would say of this declaration: nothing, when it holds
    ctx.region.textContent = conformanceProblems(declaration).join('\n');
    return {
      update: () => { cursor = (cursor + 1) % ANSWERS.length; },
      teardown: () => { ctx.region.replaceChildren(); },
    };
  },
};

export default cartridge;
