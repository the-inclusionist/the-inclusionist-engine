// SPDX-License-Identifier: AGPL-3.0-or-later
// core/constants — what every 2D pixel game on this engine shares: the logical resolution and the pixel grid.
// A leaf module, no dependencies.

export const LOGICAL_W = 320, LOGICAL_H = 180, TILE = 16;

/* ===================== WHAT A GAME TUNES, AND WHAT A TILE IS, DO NOT LIVE HERE =====================
 *
 * An engine that exports GRAVITY and a COIN TARGET is deciding that every game is a platformer about collecting
 * things; a quiz has no gravity. The platformer's physics and goal left for its own repository (issue #63), and so
 * did its tile table (ADR-0228).
 *
 * 📌 THE ENGINE DID NOT STOP KNOWING WHAT DANGER IS: it asks the CONTRACT, through `roleOf`. What it no longer has is
 * a table of tile NUMBERS, which is only true on one map — `t === 9` in a second game numbered differently would
 * inherit physics, high contrast and sonar pointing at the wrong tile, with no error and nothing red.
 */


