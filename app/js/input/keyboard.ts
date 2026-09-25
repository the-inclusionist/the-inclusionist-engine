// SPDX-License-Identifier: AGPL-3.0-or-later
// input/keyboard.ts — keyboard schemes (config) + persistence, through the store the root builds and passes in (ADR-0232).
// ⚠️ THE ACTIONS ARE POSITIONS, NOT VERBS: `up`, `down`, `left`, `right` and `action1`..`action4`. Which verb
// lives on which position belongs to the GAME (ADR-0074), and ADR-0086 §2 says which it is for the platformer.
// Schemes per player count (solo/p2/p3/p4).
// The LIVE map is one root's: `createKeyboardConfig({ store, mapping })`, built once by the composition root (ADR-0232 D4).
import type { Store } from '../platform/storage.js';
import type { KeyScheme } from '../core/entity.js';
// ⚠️ THE SCHEMES ARE DECLARED THERE (ADR-0096), and this file derives them instead of repeating them — the union
// issue #118 asks for. `default-bindings` is a leaf (it imports only `core/actions`), so there is no cycle: the
// dependant is the persistence file, not the other way round.
import { KEYBOARD_SOLO, KEYBOARD_DUO } from './default-bindings.js';

const CKEY = 'inclusionist.kbcontrols.v3';

/**
 * What the key map is read and written through: the page's store (ADR-0232, issue #207). A PARAMETER of each function that
 * touches it, not a module import — a test hands in its own, and two roots never write each other's map.
 */
export type KeyboardStore = Pick<Store, 'getJSON' | 'setJSON' | 'remove'>;

// `KeyScheme` lives in `core/entity`: the entity declares `ctrl: KeyScheme | null`, so it is the owner.
// Re-exported for whoever already imported it from here.
export type { KeyScheme } from '../core/entity.js';
/**
 * THE SET OF keyboard SCHEMES — solo plus those for 2, 3 and 4 players.
 *
 * Exported because it was already being copied: `input/keyboard-runtime` and `ui/settings-controls` each
 * declared their own `KeyboardConfig`, and BOTH said in a comment it was "the shape of input/keyboard's
 * KBDefaults". They knew they were a copy and copied anyway.
 *
 * The `settings-controls` one was `Record<string, unknown>` — meant as opaque, so the module would not depend on
 * the shape. But in PARAMETER position that inverts: to accept `(next: KBDefaults)`, the declared type has to be
 * a SUBTYPE, not a supertype. Opacity is kept by discipline — not indexing the value — and not by writing a wider
 * type (ADR-0039).
 */
export type KBDefaults = { solo: KeyScheme; p2: KeyScheme[]; p3: KeyScheme[]; p4: KeyScheme[] };

/**
 * THE SIX POSITIONS A SHARED KEYBOARD CANNOT REACH, declared as absence (issue #118, the Dev's decision).
 *
 * ⚠️ `null` HERE IS A STATEMENT, and it is what makes the closed `KeyScheme` useful instead of bureaucratic: when
 * the keyboard is split among three or four children, there is no physical room for each one's shoulders,
 * triggers, start and select — each player's block has eight keys and that is it. Inventing keys to fill them in
 * would give each child a reach they do not have, and `ui/reach-notice` (#112) would say the wrong thing.
 *
 * What `null` buys: the reach notice can say, BEFORE the child starts, which of the game's actions their control
 * does not reach — and the game can decide not to use those positions in four-player mode.
 */
const UNREACHABLE_ON_A_SHARED_KEYBOARD = Object.freeze({
  leftShoulder: null, leftTrigger: null, rightShoulder: null, rightTrigger: null, start: null, select: null,
});

// 4 base schemes for 3–4 players (modes 3 and 4 have SEPARATE schemes, p3 and p4, editable per player)
const KB_SCHEMES4: KeyScheme[] = [
  { left:['KeyA'],right:['KeyD'],up:['KeyW'],down:['KeyS'], action1:['KeyZ'],action2:['KeyX'],action4:['KeyC'],action3:['KeyV'], ...UNREACHABLE_ON_A_SHARED_KEYBOARD },
  { left:['KeyJ'],right:['KeyL'],up:['KeyI'],down:['KeyK'], action1:['KeyM'],action2:['Comma'],action4:['Period'],action3:['Semicolon','Slash'], ...UNREACHABLE_ON_A_SHARED_KEYBOARD },
  { left:['ArrowLeft'],right:['ArrowRight'],up:['ArrowUp'],down:['ArrowDown'], action1:['Home'],action2:['End'],action4:['PageUp'],action3:['PageDown'], ...UNREACHABLE_ON_A_SHARED_KEYBOARD },
  { left:['Numpad4'],right:['Numpad6'],up:['Numpad8'],down:['Numpad5'], action1:['Numpad2'],action2:['Numpad0'],action4:['Numpad3'],action3:['NumpadDecimal'], ...UNREACHABLE_ON_A_SHARED_KEYBOARD },
];

/**
 * A DEEP and MUTABLE copy of a declared table. Remapping writes into the live scheme, so it cannot share an
 * object with the `input/default-bindings` table, which is frozen and is the declaration.
 */
const mutableCopy = (t: unknown): KeyScheme => JSON.parse(JSON.stringify(t)) as KeyScheme;

/**
 * ⚠️ THE TWO KEYBOARD TABLES BECAME ONE (issue #118). Solo and duo are no longer written here: they are LIVE
 * COPIES of what `input/default-bindings` declares, which is where ADR-0096 put the decision.
 *
 * They used to be two parallel lists of eight positions each, and all eight "matched" — but one. Player 1's
 * `Space` in duo was in one list and not the other, and the cost was concrete: the webcam control of the time
 * synthesised `Space` for "look up = jump", so a second player joining took JUMP away from whoever played with
 * their eyes and left walking. Nothing failed out loud. Deriving instead of repeating makes that divergence
 * impossible to come back, instead of catching it after it happens.
 */
export const KB_DEFAULTS: KBDefaults = {
  solo: mutableCopy(KEYBOARD_SOLO),
  p2: KEYBOARD_DUO.map(mutableCopy),
  p3: KB_SCHEMES4.slice(0, 3).map(mutableCopy), // 3-player mode (independent of 4)
  p4: KB_SCHEMES4.map(mutableCopy),             // 4-player mode
};

// saved data (partial): it overlays the defaults; p34 is the OLD format (migrates to p3+p4).
// The SHAPE comes from `vocabulary-migration`, which is what translates it — declaring it here again would be
// the copy `core/entity` spent a month removing.
import { migrateSaved, type SavedKB } from './vocabulary-migration.js';

// ⚠️ THE VOCABULARY MIGRATION LIVES IN ANOTHER FILE, and the split is deliberate:
// `input/vocabulary-migration.ts` is the ONLY place in the engine allowed to say `jump`, because translating the
// old name is its job. Leaving it here would put the coupling in a module that is not historical, and the
// `action-vocabulary-boundary` gate failed it — correctly. See the header there for when it gets deleted.

/**
 * THE DEFAULT THE GAME WANTS, per player count and per seat (ADR-0115). Partial: whatever it does not say stays
 * as the engine's factory left it.
 */
export type KeyboardMapping = (players: number, seat: number) => Partial<KeyScheme> | null;

/**
 * THE FACTORY WITH THE GAME'S DEFAULT ON TOP — the **only** resolution, used by `loadKB` AND by the reset.
 *
 * ⚠️ One function, and that is the whole point: while there were two copies of `JSON.parse(JSON.stringify(...))`,
 * the reset's did not know the game, and the difference only showed when a child pressed "restore".
 * 📌 The mapping is a PARAMETER, `null` for a game with no opinion (ADR-0232 D4): as a module registration a second
 * root would overwrite the first root's (D2b erratum). What once justified the registration — the controls panel
 * resetting without the game's declaration at hand — is answered by `createKeyboardConfig`, which receives the
 * mapping once and hands the panel a reset that already knows it.
 */
export function factoryWithGame(mapping: KeyboardMapping | null): KBDefaults {
  const d: KBDefaults = JSON.parse(JSON.stringify(KB_DEFAULTS));
  if (!mapping) return d;
  const overlayGameMapping = (target: KeyScheme, players: number, seat: number): void => {
    const changes = mapping(players, seat);
    if (changes) Object.assign(target, changes);
  };
  overlayGameMapping(d.solo, 1, 0);
  d.p2.forEach((seatScheme, i) => overlayGameMapping(seatScheme, 2, i));
  d.p3.forEach((seatScheme, i) => overlayGameMapping(seatScheme, 3, i));
  d.p4.forEach((seatScheme, i) => overlayGameMapping(seatScheme, 4, i));
  return d;
}

// loads the saved schemes OVER the defaults (migrating the old p34 data → p3+p4)
export function loadKB(store: KeyboardStore, mapping: KeyboardMapping | null): KBDefaults {
  // ⚠️ THE PRECEDENCE IS THIS AND IT IS WRITTEN ONCE: the engine's factory → the GAME's default → the CHILD's
  // remapping. What the child saved always comes last, because it is the only one of the three they chose.
  const d: KBDefaults = factoryWithGame(mapping);
  // ⚠️ THE SAVED DATA GOES THROUGH THE TRANSLATOR BEFORE IT TOUCHES THE DEFAULTS. Without this line, a scheme
  // saved with the old keys (`run`, `jump`, `swap`, `especial`) would be merged over defaults that already use
  // `action1`..`action4`: the object would carry BOTH families of keys, the transports would read only the new
  // ones, and the child's remapping would become dead data in their browser. Nothing would fail out loud —
  // their keys would simply stop responding. See `input/vocabulary-migration.ts`.
  const s = migrateSaved(store.getJSON<SavedKB>(CKEY, null));
  if (s) {
    if (s.solo) Object.assign(d.solo, s.solo);
    if (Array.isArray(s.p34)) { s.p34.forEach((m, i) => { if (m) { if (d.p4[i]) Object.assign(d.p4[i], m); if (i < 3 && d.p3[i]) Object.assign(d.p3[i], m); } }); }
    (['p2', 'p3', 'p4'] as const).forEach((g) => { const arr = s[g]; if (Array.isArray(arr)) arr.forEach((m, i) => { if (d[g][i] && m) Object.assign(d[g][i], m); }); });
  }
  return d;
}
export function saveKB(store: KeyboardStore, kb: KBDefaults): void { store.setJSON(CKEY, kb); }

/** What one root's keyboard config is built from (ADR-0232 D4). Both required: see `createKeyboardConfig`. */
export interface KeyboardConfigOptions {
  /** Where the child's remapping is kept — the page's store, built by the root. */
  readonly store: KeyboardStore;
  /** The GAME's default, `null` for a game with no opinion. Read on every factory resolution, so a root that mounts
   *  another cartridge can answer with the mounted one's. */
  readonly mapping: KeyboardMapping | null;
}

/** ONE ROOT'S LIVE KEY MAP and the doors that manage it — what `Engine.keyboardConfig` is. */
export interface KeyboardConfigApi {
  /** THE LIVE KEY MAP (#50). Remapping one key MUTATES this object; `set` is the only way to replace it. */
  kb(): KBDefaults;
  /** Replaces the whole map. Only "restore defaults" needs this — reassigning by mistake would leave live references
   *  pointing at the old map. */
  set(next: KBDefaults): void;
  /** Stores `conf` (the live map when omitted) in the store. */
  save(conf?: KBDefaults): void;
  /**
   * "RESTORE DEFAULTS" — erases what the child stored and returns the GAME's default, not the engine's (ADR-0115).
   * 🔴 Resetting to the engine's factory alone would silently erase the mapping the game chose. It does NOT replace
   * the live map: the caller decides (`set`), as the controls panel does.
   */
  reset(): KBDefaults;
  /** The engine's factory with this game's default on top — a fresh copy each call. */
  factoryWithGame(): KBDefaults;
  /** Reads the stored map into the live one and returns it. */
  load(): KBDefaults;
}

/**
 * BUILDS ONE ROOT'S KEYBOARD CONFIG (ADR-0232 D4). The mapping is a construction parameter and not a registration: a
 * registration is module state a second root overwrites (D2b erratum), and the reset this object hands out already knows
 * the game, which is what the registration existed to guarantee.
 *
 * ⚠️ IT DOES NOT READ THE STORE WHEN BUILT: the live map is born from the game's factory and `load()` is what reads, called
 * once by the root. A test that builds one inherits nothing from any storage.
 */
export function createKeyboardConfig(opts: KeyboardConfigOptions): KeyboardConfigApi {
  const { store, mapping } = opts;
  // born as a COPY of the engine's defaults — a reference would let a remap write into `KB_DEFAULTS`, and the reset
  // would restore what the child just changed
  let kb: KBDefaults = JSON.parse(JSON.stringify(KB_DEFAULTS));
  return {
    kb: () => kb,
    set(next) { kb = next; },
    save(conf = kb) { saveKB(store, conf); },
    reset() { store.remove(CKEY); return factoryWithGame(mapping); },
    factoryWithGame: () => factoryWithGame(mapping),
    load() { kb = loadKB(store, mapping); return kb; },
  };
}
