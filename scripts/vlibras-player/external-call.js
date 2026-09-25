// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PLAYER'S CALLS TO THE PAGE, PARSED AND NEVER EVALUATED (ADR-0234, route A).
//
// The VLibras player is a Unity 2018 WebGL build, and its C# talks to the page through `Application.ExternalCall`, which Unity's
// framework JavaScript implements as `eval(str)` — refused by the delivery's policy, which never gains `unsafe-eval`. The
// delivery rewrites that one `eval(str)` into `window.__vlExternalCall(str)` (`scripts/vlibras-player.mjs`), and this is what
// the call reaches: a PARSER. 📏 Every string the player sent while route A was measured was a plain call with JSON literals —
// `CounterGloss(1, 2);`, `onLoadPlayer();`, `GetAvatar("icaro");`, `onPlayingStateChange("False", "False", "False", "False",
// "True");` — so that is the whole language accepted: one of the player's five event names, and arguments that are JSON.
//
// 🔴 ANYTHING ELSE IS REFUSED, never run: a name outside the five (even a real global), a dotted path, a second statement, an
// expression. What reaches the page is always data handed to one of our own functions.
//
// 📌 A module shared by the player page (loaded by `csp-shim.js`) and the node tests, so the rule tested is the rule shipped.

/** The five functions the player calls on the page — the names the published glue defines, and nothing else. */
export const PLAYER_CALLS = Object.freeze(['onPlayingStateChange', 'CounterGloss', 'onLoadPlayer', 'GetAvatar', 'FinishWelcome']);

/** `name(arguments)`, an optional semicolon, and nothing around it. The name is a bare identifier: no dot, no brackets. */
const PLAIN_CALL = /^\s*([A-Za-z_$][\w$]*)\s*\(([\s\S]*)\)\s*;?\s*$/;

/**
 * Parses one string the player sent: `{ name, args }`, or an Error saying why it is not a call the page takes.
 * The arguments go through `JSON.parse` as an array, so they are data or they are refused.
 */
export function parseExternalCall(text, allowed = PLAYER_CALLS) {
  if (typeof text !== 'string') throw new TypeError(`vlibras: the player sent a ${typeof text}, not a call`);
  const call = PLAIN_CALL.exec(text);
  if (!call) throw new Error(`vlibras: not a plain call, refused: ${text}`);
  const [, name, rawArgs] = call;
  if (!allowed.includes(name)) throw new Error(`vlibras: not one of the player's calls, refused: ${name}`);
  let args;
  try {
    args = rawArgs.trim() ? JSON.parse(`[${rawArgs}]`) : [];
  } catch {
    throw new Error(`vlibras: arguments that are not JSON, refused: ${text}`);
  }
  return { name, args };
}
