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

/** O que já foi MEDIDO na página sobre este cartucho: cada uma é uma linha pronta, ou nada. */
export interface MeasuredCartridgeProblems {
  /** As posições que o controle virtual não consegue montar. */
  readonly padGaps: readonly string[];
  /** A região do jogo redimensionada pelo próprio cartucho (ADR-0163). */
  readonly resizedRegion: string | null;
  /** O que o cartucho desenhou abaixo do piso da tela. */
  readonly drawnBelowFloor: string | null;
  /** O género que o cartucho declarou, quando ele é dos que se avisam (ADR-0156). */
  readonly genreWarning: string | null;
}

/** O que o cartucho DECLAROU, e que só ele sabe — as três regras deste módulo leem-se daqui. */
export interface DeclaredCartridgeFacts {
  /** O selector do mundo, quando o cartucho declarou um ELEMENTO; `null` para qualquer outra forma de mundo. */
  readonly worldSelector: string | null;
  /** Esse selector está na página? Respondido por quem tem documento. */
  readonly worldIsInPage: boolean;
  /** O jogo pediu voz neural (`uses.neuralVoice`, ADR-0216)? */
  readonly wantsNeuralVoice: boolean;
  /** …ou declinou-a de propósito? */
  readonly declinesNeuralVoice: boolean;
  /** Quantos assentos o cartucho declarou. */
  readonly seats: number;
  /** Ele passou `setPauseActor`? */
  readonly setsPauseActor: boolean;
  /** …ou declinou o ator de pausa de propósito? */
  readonly declinesPauseActor: boolean;
}

/**
 * As linhas deste cartucho, na ordem em que a criança as vê ao ler `problems`: primeiro o que foi MEDIDO na página,
 * depois o que foi DECLARADO — porque uma medição descreve o que já aconteceu e uma declaração descreve o contrato.
 */
export function cartridgeProblems(measured: MeasuredCartridgeProblems, declared: DeclaredCartridgeFacts): string[] {
  return [
    ...measured.padGaps,
    ...[measured.resizedRegion, measured.drawnBelowFloor, measured.genreWarning].filter((l): l is string => !!l),
    ...declaredProblems(declared),
  ];
}

/**
 * As TRÊS regras que só a declaração do cartucho pode quebrar.
 *
 * 📌 Cada uma nomeia o que a CRIANÇA perde e o que se conserta, que é a forma que o ADR-0169 exige — uma linha que só
 * diga «falta X» manda quem a lê adivinhar porque é que X importa.
 */
function declaredProblems(d: DeclaredCartridgeFacts): string[] {
  const lines: string[] = [];
  // O mundo declarado tem de existir na página — e quem o declara é o jogo, não o hospedeiro.
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
