// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/typo-choices.ts — WHAT A TYPOGRAPHY CHOICE IS, with no document anywhere near it.
//
// This module answers three questions and only three: which faces can be chosen, what CSS each choice drives, and what
// shape the row offering it has. Zero DOM, zero ctx, zero state — it is the half the node project can exercise whole,
// and the SUITE drew this seam before it existed: the pure cases live in `tests/settings-typo.node.test.js` and the
// markup ones in another file.
//
// 📌 The same cut `ui/audio-choices` received from `ui/settings-audio`, for the same reason: `ui/settings-typo` holds the
// work its name never mentioned — finding the nodes it reaches and never created, wiring them and reflecting the
// choice — and the table of what a choice IS lives here (ADR-0221).
import { t } from '../core/i18n.js';
import { FONT_GROUPS, FONT_BY_KEY, fontRole, faceAvailable, type FontItem } from './fonts.js';
import type { ControlRowSpec } from './panel-widgets.js';

/**
 * A key is selectable when it exists in the catalog, is not marked `.off` (licence pending, etc.) — and is
 * `geral`.
 *
 * ⚠️ WITHOUT THE THIRD TERM (issue #87) the menu would stop OFFERING the handwriting faces and they would stay
 * SELECTABLE by any other path — `resolveFontKey` of a stored key, a `data-font` in a consumer's markup. "Not in the
 * list" and "cannot be chosen" have to be the same statement, or the list is only a suggestion.
 */
export function isSelectableFont(k: string, installed?: (family: string) => boolean): boolean {
  const it = FONT_BY_KEY[k];
  return !!it && faceAvailable(it, installed) && fontRole(it) === 'geral';
}

export interface FontCssTarget {
  /** Value written to root.dataset.fonte. */
  font: 'padrao' | 'alfabetizacao' | 'dislexia' | 'custom';
  /** Value for the --font-custom CSS property, or null to remove the property. */
  customFamily: string | null;
  /**
   * Is this a JOINED face? (ADR-0149 §3.)
   *
   * 🔴 It drives `data-cursiva` on the root, which is what removes the BDA letter/word spacing. Letter
   * spacing on a joined face pulls the letters apart at exactly the joins that make it cursive — the spacing
   * meant to help reading would destroy the thing being read. The Dev's words: «para manter os conectores».
   *
   * 📌 Read off `FontItem.fb` rather than a new field: the catalogue already tells cursive faces apart, and a
   * second source for the same fact is a second place for it to drift.
   */
  cursive: boolean;
}

/**
 * Maps a selectable font key to the CSS it drives. The three canonical fonts (atkinson/andika/lexend) use
 * dedicated data-fonte values (Lexend's keeps the BDA letter/word spacing tied to data-fonte="dislexia"); every
 * other catalog font goes through --font-custom with a generic fallback by family (serif/cursive/none).
 */
export function fontCssTarget(k: string, it: FontItem): FontCssTarget {
  // ⚠️ THE THREE CANONICAL FACES ARE NOT CURSIVE, and answering `false` for them is a statement, not an oversight:
  // Atkinson, Andika and Lexend are reading faces, and it is exactly on them that the BDA spacing must hold.
  if (k === 'atkinson') return { font: 'padrao', customFamily: null, cursive: false };
  if (k === 'andika') return { font: 'alfabetizacao', customFamily: null, cursive: false };
  if (k === 'lexend') return { font: 'dislexia', customFamily: null, cursive: false };
  // `joined` is the word the field's own documentation uses — "is this a JOINED face?".
  const joined = it.fb === 'cursive';
  const suffix = it.fb === 'serif' ? ',Georgia,serif' : joined ? ',cursive' : '';
  return { font: 'custom', customFamily: `'${it.fam}'${suffix}`, cursive: joined };
}

export interface TypoRow {
  key: string;
  fam: string;
  selected: boolean;
  disabled: boolean;
  /** Description (+ "— <off reason>" when disabled), or '' when there is none. */
  note: string;
}
export interface TypoGroupView {
  g: string;
  rows: TypoRow[];
}

/**
 * ONE row of the list, from a catalogue face. A function of its own so the gate of the `.off` mechanism can exercise it
 * with a FAKE face: a case that depends on the catalogue's composition fails every time the roster changes.
 *
 * The mechanism is needed (issue #87, item 4): the **Ronde** can only be offered if one of three faces is installed,
 * because two of them are free for personal use only and cannot be bundled.
 */
export function fontRow(it: FontItem, fontKey: string, installed?: (family: string) => boolean): TypoRow {
  // ⚠️ THE SAME question `isSelectableFont` asks, through the SAME function. Two answers would give a clickable row the
  // click refuses — or, worse, a grey row that `resolveFontKey` accepts by another path. "Not available" and "cannot be
  // chosen" have to be the same statement.
  const disabled = !faceAvailable(it, installed);
  // `d` and `off` hold KEYS too. The dash joining them is punctuation, not a sentence — the two halves are independent
  // and each translates on its own.
  const desc = it.d ? t(it.d) : '', reason = it.off ? t(it.off) : '';
  const note = desc ? desc + (disabled ? ' — ' + reason : '') : disabled ? reason : '';
  return { key: it.k, fam: it.fam, selected: fontKey === it.k, disabled, note };
}

/** Pure view-model for the typography list: which row is selected/disabled and its note, per catalog group. */
export function typoGroups(fontKey: string, installed?: (family: string) => boolean): TypoGroupView[] {
  // ⚠️ ONLY THE GENERAL FACES ENTER THE LIST (ADR-0012 amendment, issue #87). The handwriting faces exist for the child
  // to LEARN to read cursive — that is subject matter, and it lives INSIDE the activities, on buttons of their own.
  // Offering them here would hand the child the subject as an obstacle everywhere they only want to navigate the menu.
  //
  // A group left with no general face disappears from the list, instead of appearing as an empty heading.
  return FONT_GROUPS.map((g) => ({
    g: t(g.g),  // `g` holds an i18n KEY (see ui/fonts)
    rows: g.items.filter((it) => fontRole(it) === 'geral').map((it) => fontRow(it, fontKey, installed)),
  })).filter((group) => group.rows.length > 0);
}

/** The id of a face's button. It comes from the catalogue KEY, which is unique by construction (`FONT_BY_KEY`). */
export const typoControlId = (key: string): string => `typo-font-${key}`;

/**
 * What a font row SAYS, before any node exists — the shape the kit consumes.
 *
 * ⚠️ `shape: 'radio'` and not a switch: independent switches announcing on/off to choose ONE font say the opposite of
 * the ADR-0012 amendment, «THE MENU IS A CHOICE, NOT A TOGGLE […] One font is active; the others are alternatives, not
 * switches.»
 *
 * 📌 The note goes into the HINT — which `fillExplain` takes to the footer — and ALSO into the accessible name, because
 * whoever does not see the row needs to hear who that face is for without hunting for the footer.
 */
export function typoRowSpec(row: TypoRow): ControlRowSpec {
  return {
    id: typoControlId(row.key),
    label: row.fam,
    ...(row.note ? { hint: row.note } : {}),
    shape: 'radio',
    ariaLabel: row.fam + (row.note ? ' — ' + row.note : ''),
  };
}
