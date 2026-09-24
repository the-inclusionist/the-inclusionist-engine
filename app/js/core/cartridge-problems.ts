// SPDX-License-Identifier: AGPL-3.0-or-later
// core/cartridge-problems — WHAT IS WRONG WITH WHAT THIS CARTRIDGE DECLARED (ADR-0169, ADR-0221 step 7c).
//
// `problems` is the engine's diagnostic channel, and its rule is written in the `CLAUDE.md`: the engine REFUSES a
// malformed contract, REPORTS what works only in part, and TOLERATES silently only a capability of the environment.
// This module holds the REPORT half for the half of `problems` that belongs to the GAME — the part that stops being
// true the moment `mount()` swaps the cartridge, as opposed to the host's lines, which describe a page and last.
//
// WHY IT IS NOT IN THE COMPOSITION ROOT
// It used to be, and it was ~30 lines and nine branches of `boot/create-game`. A root is expected to be large and is
// supposed to hold WIRING: «is this cartridge's declared world actually in the page?» is not wiring, it is a rule with
// a reason, a sentence to a human, and a decision about when to stay quiet. ADR-0221's erratum puts a number on it —
// the root's debt is paid when its BRANCHES tend to zero, not its lines.
//
// ⚠️ AND IT IS PURE ON PURPOSE. Everything the page had to be asked — whether the declared world is in it, whether the
// cartridge resized the region, what it drew below the floor, what the virtual pad is missing — is MEASURED by the
// caller and arrives as an answer. That is what lets this module live in `core`, which is what the engine IS without a
// browser (ADR-0173), and what lets a case exercise every line without a document.

/** What was already MEASURED in the page about this cartridge: each one is a finished line, or nothing. */
export interface MeasuredCartridgeProblems {
  /** The positions the virtual pad cannot mount. */
  readonly padGaps: readonly string[];
  /** The game region resized by the cartridge itself (ADR-0163). */
  readonly resizedRegion: string | null;
  /** What the cartridge drew below the screen's floor. */
  readonly drawnBelowFloor: string | null;
  /** The genre the cartridge declared, when it is one that is warned about (ADR-0156). */
  readonly genreWarning: string | null;
}

/** What the cartridge DECLARED, which only it knows — this module's three rules are read from here. */
export interface DeclaredCartridgeFacts {
  /** The world's selector, when the cartridge declared an ELEMENT; `null` for any other kind of world. */
  readonly worldSelector: string | null;
  /** Is that selector in the page? Answered by whoever holds a document. */
  readonly worldIsInPage: boolean;
  /** Did the game ask for the neural voice (`uses.neuralVoice`, ADR-0216)? */
  readonly wantsNeuralVoice: boolean;
  /** …or decline it on purpose? */
  readonly declinesNeuralVoice: boolean;
  /** How many seats the cartridge declared. */
  readonly seats: number;
  /** Did it pass `setPauseActor`? */
  readonly setsPauseActor: boolean;
  /** …or decline the pause actor on purpose? */
  readonly declinesPauseActor: boolean;
}

/**
 * This cartridge's lines, in the order a reader of `problems` meets them: first what was MEASURED in the page, then
 * what was DECLARED — a measurement describes what already happened, a declaration describes the contract.
 */
export function cartridgeProblems(measured: MeasuredCartridgeProblems, declared: DeclaredCartridgeFacts): string[] {
  return [
    ...measured.padGaps,
    ...[measured.resizedRegion, measured.drawnBelowFloor, measured.genreWarning].filter((l): l is string => !!l),
    ...declaredProblems(declared),
  ];
}

/**
 * The THREE rules only the cartridge's declaration can break.
 *
 * 📌 Each names what the CHILD loses and what fixes it, which is the shape ADR-0169 requires — a line that only says
 * "X is missing" leaves its reader to guess why X matters.
 */
function declaredProblems(d: DeclaredCartridgeFacts): string[] {
  const lines: string[] = [];
  // The declared world has to exist in the page — and it is the game that declares it, not the host.
  if (d.worldSelector && !d.worldIsInPage) {
    lines.push(`the declared world ${d.worldSelector} is not in the page: the colour correction and vision filters a child turns on reach nothing — fix \`world()\``);
  }
  // ⚠️ MIXED, and it lives on this side for its second half: the answer is the host's (`uses.neuralVoice`), but the
  // decline is the CARTRIDGE's — so the line can appear or go quiet when the game changes under the same host.
  if (!d.wantsNeuralVoice && !d.declinesNeuralVoice) {
    lines.push(
      'there is no neural voice: a child who cannot read gets the system voice, which a school Chromebook may not have '
      + 'for the child\'s language — declare `uses: { neuralVoice: true }` (ADR-0216) or `declines.noNeuralVoice`',
    );
  }
  if (d.seats > 1 && !d.declinesPauseActor && !d.setsPauseActor) {
    lines.push(
      `${d.seats} players are declared and the pause actor is not set: the controls panel always edits seat 0, so `
      + 'no child but the first can remap — pass `setPauseActor`, or declare `declines.noPauseActor` if on purpose',
    );
  }
  return lines;
}
