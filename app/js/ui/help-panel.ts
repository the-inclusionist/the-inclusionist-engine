// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/help-panel — WHICH BUTTON DOES WHAT, in this game, on this child's keyboard.
//
// ========================= WHY THIS MODULE EXISTS =========================
// 🔴 MEASURED 2026-09-12: the pause card carries a `ajuda` item and NOTHING in the engine can action it, so
// `itensQueAccionam` hides it in every game. The help screen that used to fill it — `openHelp()` — did not
// die: it LEFT WITH THE CARTRIDGE (#111) and now lives in `game-platformer/app/js/main.ts`. So each of the
// three hundred games would have to write its own, which is the arrangement ADR-0139 measured failing in five
// games of six.
//
// 🎯 AND THE ENGINE ALREADY HAS EVERY INGREDIENT, which is what makes this cheap rather than new:
//   · WHICH positions this game uses, and the game's own WORD for each — `ActionPreset` (ADR-0085).
//   · The sentence that explains one — the `hint` of that preset, a field declared, typed, documented and,
//     until this module, never displayed anywhere.
//   · WHICH KEY reaches it FOR THIS CHILD — `input/keyboard-runtime.kbFor(seat)`, i.e. her remap and not the
//     factory default.
//
// ⚠️ THE ENGINE NEVER NAMES AN ACTION HERE, and that is the whole boundary (ADR-0074, ADR-0086). It knows a
// POSITION exists; only the game knows the word. A row whose word is missing is therefore ABSENT — never a
// row reading «action2», which is the defect `labellerFrom` returns `null` to prevent.
//
// 📌 AND THIS IS THE MIGRATION `ui/settings-controls.ACT_LABEL` HAS BEEN WAITING FOR. That table holds ONE
// game's words — `act.run`, `act.jump` — inside the engine, and its own header says it can only leave once
// the help screen asks the GAME instead. This module is a help screen that asks the game.
import { ACTIONS, type Action, type ActionPreset } from '../core/actions.js';

/** One line of the help table. `key` is `null` when this child's keyboard does not reach the position. */
export interface HelpRow {
  readonly action: Action;
  /** Already human-readable (`keyName`), or `null` — «this transport does not reach it» is information. */
  readonly key: string | null;
  /** The GAME's word. Never an identifier: a position without one produces no row at all. */
  readonly word: string;
  /** The game's own sentence for this position, when it declared one. */
  readonly hint?: string;
}

/**
 * The help table for one seat.
 *
 * ⚠️ WALKS `ACTIONS` AND NOT THE PRESET'S OWN KEYS, for the reason `presetActions` already carries: the
 * canonical order is the one the child meets everywhere else — the remap screen, the pad wizard, the
 * on-screen legend. A help screen ordered by whatever order the game happened to write its object in would
 * teach a different order from every other surface.
 *
 * @param preset  what this game declares — positions, words, hints.
 * @param keysOf  the codes bound to a position FOR THIS SEAT. `kbFor(seat)[action]`, so a child who remapped
 *                sees her own key. `null`/empty means the keyboard does not reach it.
 * @param keyName code → readable label (`ui/settings-controls.keyName`), injected so this half stays pure.
 */
export function helpRows(
  preset: ActionPreset | null | undefined,
  keysOf: (a: Action) => readonly string[] | null | undefined,
  keyName: (code: string) => string,
): HelpRow[] {
  if (!preset) return [];
  const rows: HelpRow[] = [];
  for (const action of ACTIONS) {
    const word = preset[action];
    // ⚠️ A BLANK LABEL IS THE SAME AS NO LABEL, and it is the case `presetProblems` already names: a row
    // whose word is whitespace reads, to a screen reader, as a button with no name.
    if (!word || !word.label.trim()) continue;
    // 📌 THE FIRST CODE, and the rest are not lost — they are the same position, and a help screen that listed
    // every alias would spend the child's attention on the keyboard instead of on the game. The remap screen
    // is where all of them are visible, because THERE they are the subject.
    const codes = keysOf(action);
    const key = codes && codes.length ? keyName(codes[0]!) : null;
    rows.push({ action, key, word: word.label, ...(word.hint ? { hint: word.hint } : {}) });
  }
  return rows;
}

/** What the row says where the keyboard reaches nothing. A KEY, not a sentence — the caller translates it. */
export const SEM_TECLA = 'help.noKey';

/**
 * The help list as markup, in the shape the §4 rule of `CLAUDE.md` fixes: the short label in `<strong>`, the
 * prose in a SINGLE `.opt-hint` inside the `<span>`, which `fillExplain` then moves to the footer.
 *
 * ⚠️ ONE `.opt-hint` PER ROW, like `linhaDeControle` enforces by construction one module over: two of them
 * would give one control two descriptions, the footer would show the first, and the second would stay in the
 * row — which is exactly the defect §4 exists to prevent.
 */
export function helpListHtml(rows: readonly HelpRow[], t: (k: string) => string): string {
  return rows.map((r) => {
    const dica = r.hint ? `<span class="opt-hint">${r.hint}</span>` : '';
    const tecla = r.key ?? t(SEM_TECLA);
    return `<div class="ctrl-row" data-act="${r.action}">`
      + `<span><strong>${r.word}</strong>${dica}</span>`
      + `<kbd class="help-key"${r.key ? '' : ' data-sem-tecla="1"'}>${tecla}</kbd>`
      + '</div>';
  }).join('');
}
