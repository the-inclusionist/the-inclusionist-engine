// SPDX-License-Identifier: AGPL-3.0-or-later
// The fixture cartridge's content: a module of its own, so the emitted types have a relative re-export to follow.

/** One answer on the screen. */
export interface Answer {
  readonly id: string;
  readonly text: string;
}

export const ANSWERS: readonly Answer[] = [
  { id: 'a', text: 'dois' },
  { id: 'b', text: 'três' },
  { id: 'c', text: 'quatro' },
];
