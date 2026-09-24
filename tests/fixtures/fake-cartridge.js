// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FAKE GAME THE ENGINE'S GATES USE — so that no gate imports a game to set itself up (issue #111). With the
// cartridge out of this repository, a gate that imported it would simply not compile.
//
// ========================= THIS FILE'S RULE =========================
// ⚠️ A FAKE DECLARES THE MINIMUM SLICE, NEVER THE WHOLE GAME. `core/entity.ts` records why the narrow views exist:
// swapping them for one fat interface would make every fixture invent every field. Copying a real game's player here
// would be exactly that, made worse by the copy drifting with nobody noticing.
//
// ⚠️ AND WHAT A FAKE CANNOT DO IS PROVE A RELATION TO THE REAL GAME. Where a gate asserted something about the
// cartridge — that the platform preset has nine actions, that the sprite manifest has four `idle` frames — the
// assertion was NOT faked: it moved to `game-platformer`, where the game exists and the engine arrives as a package.
// Integration belongs to whoever integrates.

/**
 * A fake tile→role table. The real one belongs to the GAME and the engine RECEIVES it.
 *
 * ⚠️ The roles are the ENGINE's (`render/hc-role-data`), not the game's tiles: what a high-contrast gate proves is that
 * the colour comes from the ROLE, and any table that returns roles serves for that. One that copied the platformer's
 * tiles would tie the engine to a game again, only from below.
 */
export function roleOfFalso(tipo) {
  // ⚠️ THE NAMES ARE `render/hc-role-data.HC_ROLE_KEYS`'s, not invented: `hazard`, `climb`, `water`. A role that does
  // not exist makes the browser cases throw `Cannot read properties of undefined`, because the colour table is indexed
  // by role. `gate` is left out on purpose: the module itself records that it does NOT come from `roleOf()`.
  // ⚠️ THE NUMBERS ARE NOT FREE EITHER: the high-contrast gates build a test world and write the types into the cases'
  // prose — «col0=pedra(2, estrutura) · col1=lava(9, hazard) · col2=escada(4, climb)», and «água(3)». Swapping 2 and 9
  // repaints the stone and not the lava, and three cases fail saying exactly that. `2` returns `null` on purpose:
  // structure has NO role, it is only desaturated.
  if (tipo === 9) return 'hazard';
  if (tipo === 4) return 'climb';
  if (tipo === 3) return 'water';
  return null;
}

/**
 * A preset of NINE actions — the number the platform game declares.
 *
 * ⚠️ That is why it is fake and not imported: the gate proving the REAL preset has nine actions moved to
 * `game-platformer`, together with the preset. What stays here is the engine's behaviour GIVEN a nine-action preset,
 * which is what the `input/touch` tests use it for.
 */
export function presetFalso() {
  // The SHAPE is `{ label, short? }` — the same as `core/actions`' `ActionPreset`. Only the four actions have `short`,
  // because it is the CAPTION's word and the directions do not appear in it.
  return {
    up: { label: 'subir' }, down: { label: 'descer' },
    left: { label: 'esquerda' }, right: { label: 'direita' },
    action1: { label: 'correr', short: 'corre' },
    action2: { label: 'pular', short: 'pula' },
    action3: { label: 'especial', short: 'esp' },
    action4: { label: 'interagir', short: 'pega' },
    start: { label: 'pausar' },
  };
}

