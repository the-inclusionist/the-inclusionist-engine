// SPDX-License-Identifier: AGPL-3.0-or-later
// render/hc-role-data — color-blocking's SEMANTIC ROLES, in one place.
//
// There were two lists of the same four roles: one in the visual settings panel (which draws a colour picker per role)
// and one in render/high-contrast (which repaints the tiles). Nothing tied them, and the failure was silent: a fifth
// role added to the renderer would get a colour and no picker, with no type error anywhere — the panel would simply not
// offer a way to customise it.
//
// This module is a LEAF on purpose: zero dependencies. Both the renderer and the UI import it, and a data file with no
// dependency at all can be imported from both sides without dragging the rendering pipeline into a settings panel (nor
// the reverse).
//
// What does NOT live here: the roles' labels, which are presentation and sit in ui/visual-choices (`ROLE_LABELS`). They
// are typed by `HcRoleKey`, so they stay obliged to cover exactly these four roles.

/** The roles `roleOf(tile)` can return — those the high-contrast repaint applies straight to the tile. */
export type PaintableRole = 'hazard' | 'climb' | 'water';

/** All the customisable roles. `gate` does not come from `roleOf()`: a game's locked-gate drawing uses it apart, but
 *  the player picks its colour in the same panel. */
export type HcRoleKey = PaintableRole | 'gate';

/** The roles' canonical order — the order in which the panel draws the colour pickers. */
export const HC_ROLE_KEYS: readonly HcRoleKey[] = ['hazard', 'climb', 'water', 'gate'];

/**
 * Default colours per role (RGB 0-255). Color-blocking: hazard = warm orange, climbable/interactive (ladder/trampoline)
 * = cyan, water = blue, gate = magenta. Structure (stone/wall) stays in the level's blue-grey and so is not a role.
 * Customisable and persisted — see the `role` palette of render/high-contrast's `createHighContrast`.
 */
export const HC_ROLE_DEF: Record<HcRoleKey, [number, number, number]> = {
  hazard: [255, 110, 45], climb: [55, 225, 205], water: [70, 140, 255], gate: [194, 58, 212],
};
