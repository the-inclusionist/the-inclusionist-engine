// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/storage-keys.ts — THE NAMES OF WHAT IS STORED: the register of known keys and the rule that scopes a game's key.
//
// 📌 A STATELESS MODULE ON PURPOSE (ADR-0232, issue #207): a key is a string, and a module that only needs the NAME must not
// import `platform/storage`, which reaches `localStorage`, to get it. `input/touch` and `ui/settings-mobility` read and write
// through an injected store and import only these names.
//
// 📌 WHY `platform/` AND NOT `core/` (ADR-0173): the table names places in the browser's persistent storage, and every module
// that reads it is at `platform` or above — the storage itself, the input, the renderer, the panels, and the games. `core/`
// reaches storage only through the port `core/state.loadState` receives (ADR-0178), which carries the keys it needs; putting
// the table in `core/` would invite the core to name storage places again, the dependency ADR-0178 took out.
//
// 📌 THIS IS THE ONLY HOME OF `KEYS` (ADR-0232 D2b): `platform/storage` is a factory now and publishes no key table. The
// port `core/state.loadState` receives carries the table beside the store — the root passes `{ ...store, KEYS }`.

/**
 * The full name of a key in the GAME's scope.
 *
 * ⚠️ THE ID COMES IN AS AN ARGUMENT; it was once a constant. By ADR-0080's test — *would a second game want a different
 * value here?* — the answer is yes, at once: two games in the same browser profile collided on every game-scoped key, and
 * one overwrote the other's progress with no error at all.
 *
 * ⚠️ AND THE ID DOES NOT COME FROM THE DECLARATION, the obvious design. It cannot: a game's state is read before any
 * `createGame()`, so an id from the declaration would arrive after the keys were resolved — against nothing, in silence.
 * Whoever knows its own id is the GAME, which passes it as its own constant; ADR-0080 forbids the ENGINE from knowing it,
 * not the game.
 */
export function gameKey(gameId: string, keyName: string): string { return 'incl.' + gameId + '.' + keyName; }

// The register of known keys (documentation in ONE place; the source of truth is still their use). Keys taking an
// argument are parameterised by player, scenery or game. The two scopes — the CHILD's `incl_*` and the GAME's
// `incl.<game>.*` — are explained in `platform/storage`.
export const KEYS = {
  // motor/hearing empathy
  onebtn: 'incl_onebtn', wheelchair: 'incl_wheelchair', modocego: 'incl_modocego', caneDiv: 'incl_cane_div',
  hearingloss: 'incl_hearingloss',
  // activity / quiz / scenery — the GAME's SCOPE (see the two scopes in `platform/storage`). `*Legado` is the old name, which
  // the read inherits from once; the write goes to the new one only.
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
   * ⚠️ AND THE NEW KEY DOES NOT LIVE HERE, on purpose. It is `latchKey`, in `input/latch-scope` — `platform/` does not
   * import `input/`, the layer above. Building it here would need either a backwards edge or a second copy of the name.
   * Whoever owns the name is whoever knows the transport rule.
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
