// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/storage.ts — the single persistence layer (localStorage), a leaf module. Exception-proof: localStorage
// THROWS on file:// and in some browsers' private mode, and that used to bring the whole boot down (hence every access
// is try/catch). Centralised here: one place to change the strategy (namespacing, IndexedDB…) without hunting dozens of
// call sites.

// OVERLOADS BECAUSE THE DEFAULT DECIDES THE RETURN TYPE. With a `fallback: string` the result CANNOT be null — a single
// signature returned `string | null` regardless, and every caller with a default paid for an impossible `null`.
export function get(key: string, fallback: string): string;
export function get(key: string, fallback?: null): string | null;
export function get(key: string, fallback: string | null = null): string | null {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
}
export function set(key: string, value: string | number | boolean): boolean {
  try { localStorage.setItem(key, String(value)); return true; } catch { return false; }
}
export function remove(key: string): void { try { localStorage.removeItem(key); } catch { /* noop */ } }

export function getBool(key: string, fallback = false): boolean { const v = get(key, null); return v == null ? fallback : v === '1'; }
export function setBool(key: string, on: boolean): void { set(key, on ? '1' : '0'); }

export function getNum(key: string, fallback = 0): number {
  const v = get(key, null); const n = v == null ? NaN : parseFloat(v);
  return isFinite(n) ? n : fallback;
}

export function getJSON<T = unknown>(key: string, fallback: T | null = null): T | null {
  try { const s = get(key, null); return s == null ? fallback : (JSON.parse(s) as T); } catch { return fallback; }
}
export function setJSON(key: string, obj: unknown): void { try { set(key, JSON.stringify(obj)); } catch { /* noop */ } }

/* ===================== the TWO scopes (namespaced saves, ADR-0027 step 7) ===================== */
//
// The obvious namespacing — a per-game prefix on EVERYTHING — would be a serious accessibility defect, and it is worth
// saying why before saying what was done.
//
// A blind child sets up blind mode, the cane, the voice, the narration speed. A colour-blind child picks the correction.
// A dyslexic child picks the font. If every game had its own namespace, they would have to REDO all of that in every
// game — and whoever depends most on the settings is exactly whoever has the least margin to redo them.
//
// So there are TWO scopes, and the line between them is not technical, it is about whom the thing belongs to:
//
//   · SHARED (`incl_*`) — what belongs to the CHILD: accessibility, typography, language, voice, controls, touch. It
//     follows them from game to game, on purpose: a second game reading the font chosen in the first is RIGHT.
//   · THE GAME'S (`incl.<game>.*`) — what belongs to THIS play-through: activity, level, scenery, the demo recording.
//     Two games with a "level 3" do not have the same level 3.
//
// THE READ INHERITS FROM THE OLD KEY and the write goes to the new one only (`getWithLegacy`). No migration step, because
// a scheduled migration would arrive after the reads. And the old key stays where it is: it is the child's data, not mine
// to delete, and keeping it is what makes a way back possible.

/**
 * The full name of a key in the GAME's scope.
 *
 * ⚠️ THE ID COMES IN AS AN ARGUMENT; it was once a constant here. By ADR-0080's test — *would a second game want a
 * different value here?* — the answer is yes, at once: two games in the same browser profile collided on every
 * game-scoped key, and one overwrote the other's progress with no error at all.
 *
 * ⚠️ AND THE ID DOES NOT COME FROM THE DECLARATION, the obvious design. It cannot: a game's state is read before any
 * `createGame()`, so an id from the declaration would arrive after the keys were resolved — against nothing, in silence.
 * Whoever knows its own id is the GAME, which passes it as its own constant; ADR-0080 forbids the ENGINE from knowing it,
 * not the game.
 */
export function gameKey(gameId: string, keyName: string): string { return 'incl.' + gameId + '.' + keyName; }

/**
 * THE KEYS OUTSIDE EVERY ENGINE SCOPE (study item E2): not the child's `incl_*` (and the older `inclusionist.*`), not a
 * game's `incl.<game>.*`. 📏 Measured: pinball stores `pinball:*`. ⚠️ A game's data stored in the CHILD's scope
 * (chess's `incl_chess_*`) is not seen: the engine's own `incl_` keys are not one closed list, so that question would
 * accuse the engine.
 */
export function keysOutsideScopes(storedKeys: Iterable<string>): string[] {
  return [...storedKeys].filter((k) => !k.startsWith('incl_') && !k.startsWith('inclusionist.') && !k.startsWith('incl.'));
}

/**
 * Reads the NEW key; if it does not exist yet, inherits the LEGACY one's value. Read-only: whoever writes, writes to the
 * new one. It is what lets a key be renamed without a migration step and without anyone losing a setting.
 */
export function getWithLegacy(newKey: string, legacyKey: string, fallback: string): string;
export function getWithLegacy(newKey: string, legacyKey: string, fallback?: null): string | null;
export function getWithLegacy(newKey: string, legacyKey: string, fallback: string | null = null): string | null {
  const v = get(newKey, null);
  if (v !== null) return v;
  const inherited = get(legacyKey, null);
  return inherited !== null ? inherited : fallback;
}

/** `getWithLegacy`'s pair for a JSON value — the inheritance has to hold for both formats, or half the keys migrate and
 *  the other half vanish, the worst of both worlds. */
export function getJsonWithLegacy<T = unknown>(newKey: string, legacyKey: string, fallback: T | null = null): T | null {
  const v = getJSON<T>(newKey, null);
  if (v !== null) return v;
  const inherited = getJSON<T>(legacyKey, null);
  return inherited !== null ? inherited : fallback;
}

// The register of known keys (documentation in ONE place; the source of truth is still their use). Keys taking an
// argument are parameterised by player, scenery or game.
export const KEYS = {
  // motor/hearing empathy
  onebtn: 'incl_onebtn', wheelchair: 'incl_wheelchair', modocego: 'incl_modocego', caneDiv: 'incl_cane_div',
  hearingloss: 'incl_hearingloss',
  // activity / quiz / scenery — the GAME's SCOPE (see the two scopes above). `*Legado` is the old name, which the read
  // inherits from once; the write goes to the new one only.
  //
  // ⚠️ THEY ARE FUNCTIONS OF THE GAME'S ID, and the child's are strings. The difference of SHAPE is what prevents the
  // mistake: a child's preference cannot be prefixed by accident, because it has nowhere to take the id — and a
  // play-through's key cannot be left unscoped, because without the argument it does not compile. The rule that once
  // lived only in a comment lives in the type.
  activity: (gameId: string): string => gameKey(gameId, 'activity'), activityLegado: 'incl_activity',
  quizlevel: (gameId: string): string => gameKey(gameId, 'quizlevel'), quizlevelLegado: 'incl_quizlevel',
  cenario: (gameId: string): string => gameKey(gameId, 'cenario'), cenarioLegado: 'incl_cenario',
  tabsel: (gameId: string): string => gameKey(gameId, 'tabsel'), tabselLegado: 'incl_tabsel',
  fracnot: (gameId: string): string => gameKey(gameId, 'fracnot'), fracnotLegado: 'incl_fracnot',
  // visual / contrast / colour
  viz: 'incl_viz', lq: 'incl_lq', cbsafe: 'incl_cbsafe', ownercolors: 'incl_ownercolors',
  outfg: 'incl_outfg', outbg: 'incl_outbg', hcrole: 'incl_hcrole', juice: 'incl_juice', crt: 'incl_crt2',
  crtLegacy: 'incl_crt', // the old (boolean) format; render/crt migrates it to incl_crt2 on the first read
  // audio / voice / i18n
  ttsEngine: 'incl_tts_engine', ttsVoice: 'incl_tts_voice', ttsVoz: 'incl_tts_voz', lang: 'incl_lang', // audiocat_{k}
  // communication / captions (ADR-0028: every panel persists)
  letterCase: 'incl_lettercase', captions: 'incl_captions',
  // ⚠️ THE AUTISM-SUPPORT LEVEL (calm / quiet) PERSISTS. It used not to: the extraction from the monolith PRESERVED "never
  // written to storage" verbatim, which is not the same as deciding it. The cost fell on the child who needs it most —
  // whoever uses quiet mode set it again every session, and unexpected noise costs them most. ADR-0028: every panel persists.
  tea: 'incl_tea',
  menuIndex: 'incl_menuindex', // the "6 of 10" at the end of an item's announcement (ADR-0044, item 3)
  // typography / controls / touch
  fontKey: 'incl_font_k', padDesign: 'incl_paddesign', padDir: 'incl_paddir', touchmap: 'incl_touchmap',
  padBtnMm: 'incl_padbtnmm', padGapMm: 'incl_padgapmm', padStickMm: 'incl_padstickmm',
  padTravelMm: 'incl_padtravelmm', padDpadMm: 'incl_paddpadmm',
  // reduced motion (the whole object in one JSON) + the old toggle-movement key, still read once to migrate whoever came
  // from the previous version
  reducedMotion: 'inclusionist.reducedmotion.v1', toggleMoveLegacy: 'inclusionist.togglemove',
  // PER PLAYER — parameterised by the screen's index. As functions here, no call site can write a crooked name.
  /**
   * @deprecated ⚠️ THE LEGACY visual-mode KEY — ONE value, from when only one fitted (issue #104).
   *
   * It is still READ, which is what keeps the child from losing what they chose; it is still WRITTEN while the controls
   * write one value at a time, because an old reader does `if (v && VIZ_BY_KEY[v])` and would reject a JSON — writing
   * the new shape HERE would erase their setting in silence, exactly the defect the migration exists not to commit.
   */
  vizP: (i: number): string => 'incl_viz_p' + i,
  /**
   * The two-axis VISUAL STATE, in JSON (ADR-0076, issue #104).
   *
   * ⚠️ A NEW KEY BESIDE THE OLD ONE, not the same key with new content. The same design as the `visual` field beside
   * `viz`: both shapes coexist while both have readers, each reads the one it understands, and the old one dies only
   * when nobody reads it. `migrateVisual` accepts both, so the fallback — new key absent, old key present — returns
   * exactly what the child chose.
   */
  visualP: (i: number): string => 'incl_visual_p' + i,
  sinkP: (i: number): string => 'incl_sink_p' + i,
  easyP: (i: number): string => 'incl_easy_p' + i,
  /**
   * ⚠️ THE TWO BELOW ARE LEGACY KEYS (ADR-0104 §C, issue #114). They are still READ — it is the child's setting, and
   * inheriting it keeps them from losing it — and never written again. What is written is the key WITH A TRANSPORT,
   * because the toggle belongs to the DEVICE and not the person: turning it on for the touch pad, where nobody holds a
   * virtual button comfortably, turned it on for the keyboard too, where holding a key is exactly what the child can do.
   *
   * ⚠️ AND THE NEW KEY DOES NOT LIVE HERE, on purpose. It is `latchKey`, in `input/latch-scope` — this is a LEAF module
   * and `platform/` does not import `input/`, the layer above. Building it here would need either a backwards edge or a
   * second copy of the name. Whoever owns the name is whoever knows the transport rule.
   */
  toggleMoveP: (i: number): string => 'incl_togglemove_p' + i,
  toggleRunP: (i: number): string => 'incl_togglerun_p' + i, // the RUN-button toggle (the movement one's sibling)
  rmWalkP: (i: number): string => 'incl_rmWalk_p' + i,
  rmBreathP: (i: number): string => 'incl_rmBreath_p' + i,
  rmFlavorP: (i: number): string => 'incl_rmFlavor_p' + i,
  // demo/attract: one recording per scenery (a function, not a string — a parameterised key). The GAME's SCOPE: the
  // recording is of a level of THIS game and means nothing in another.
  attract: (gameId: string, scenery: string): string => gameKey(gameId, 'attract_' + scenery),
  attractLegado: (scenery: string): string => 'incl_attract_' + scenery,
};
