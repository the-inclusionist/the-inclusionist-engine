// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CHILD'S STORED SETTINGS ARE LOADED BY THE ROOT, AND A WRITE BEFORE THE LOAD FAILS LOUDLY (ADR-0178, issue #174).
//
// 📏 Before: `core/state` and `core/i18n` read storage the moment they were imported — `core` importing `platform/storage`
// against ADR-0173. The Dev agreed to the explicit load: defaults until the composition root loads the settings, and a write
// before the load throwing, because it would overwrite what the child saved and nobody would see it.
//
// 📌 The projects' setup files load the settings as a root does; these cases take FRESH modules (`vi.resetModules`), which
// have seen no load.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A storage double with the shape of `platform/storage`, holding what a child saved. */
function portaGuardada(inicial = {}) {
  const mapa = new Map(Object.entries(inicial));
  return {
    mapa,
    get: (k, fallback) => (mapa.has(k) ? mapa.get(k) : fallback),
    set: (k, v) => { mapa.set(k, String(v)); return true; },
    getBool: (k, fallback = false) => (mapa.has(k) ? mapa.get(k) === '1' : fallback),
    setBool: (k, on) => { mapa.set(k, on ? '1' : '0'); },
    getNum: (k, fallback = 0) => (mapa.has(k) ? Number(mapa.get(k)) : fallback),
    KEYS: { letterCase: 'incl_lettercase', captions: 'incl_captions', menuIndex: 'incl_menuindex', cbsafe: 'incl_cbsafe',
      ownercolors: 'incl_ownercolors', outfg: 'incl_outfg', outbg: 'incl_outbg', lang: 'incl_lang' },
  };
}
async function estadoFresco() { vi.resetModules(); return import('../app/js/core/state.js'); }

describe('the stored settings, loaded by the root (ADR-0178)', () => {
  it('🔴 [Right] a write before the load throws, naming the setter — the child\'s saved choice is not overwritten', async () => {
    const state = await estadoFresco();
    expect(() => state.setBlindModeValue(true)).toThrow(/setBlindModeValue.*loadState/);
    expect(() => state.setLetterCaseValue('mixed')).toThrow(/loadState/);
    expect(state.blindMode, 'the refused write changed the binding anyway').toBe(false);
  });

  it('🎯 [Zero] a setter that changes nothing writes nothing, and does not throw', async () => {
    const state = await estadoFresco();
    expect(() => state.setBlindModeValue(false)).not.toThrow();
  });

  it('🔴 [Right] before the load the bindings hold what an empty storage gives; the load reads what the child saved', async () => {
    const state = await estadoFresco();
    expect(state.letterCase).toBe('upper');
    const porta = portaGuardada({ incl_modocego: '1', incl_lettercase: 'mixed', incl_captions: '0', incl_cane_div: '4' });
    state.loadState(porta);
    expect(state.blindMode).toBe(true);
    expect(state.letterCase).toBe('mixed');
    expect(state.captionsOn).toBe(false);
    expect(state.caneBlockDiv).toBe(4);
  });

  it('🔴 [Right] after the load, a setter writes through the loaded port', async () => {
    const state = await estadoFresco();
    const porta = portaGuardada();
    state.loadState(porta);
    state.setWheelchairValue(true);
    state.setLetterCaseValue('mixed');
    expect(porta.mapa.get('incl_wheelchair')).toBe('1');
    expect(porta.mapa.get('incl_lettercase')).toBe('mixed');
  });

  it('🔴 [Right] setLocale before the language port is refused, and nothing has moved', async () => {
    vi.resetModules();
    const i18n = await import('../app/js/core/i18n.js');
    const antes = i18n.getLocale();
    await expect(i18n.setLocale('en')).rejects.toThrow(/loadLocale/);
    expect(i18n.getLocale(), 'the language changed before the refusal').toBe(antes);
  });

  it('🎯 [Zero] core imports no storage — the two debts of #167 are paid', () => {
    for (const f of ['state.ts', 'i18n.ts']) {
      const fonte = readFileSync(join(process.cwd(), 'app', 'js', 'core', f), 'utf8');
      expect(fonte, `core/${f} imports platform/storage again`).not.toMatch(/from '\.\.\/platform\/storage\.js'/);
    }
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   R1 `armazem` returns an empty port instead of throwing          🔴 write before the load
//   R2 `loadState` keeps the port and reads nothing             🔴 the load reads what the child saved
//   R3 setLocale's guard moved back after the switch                 🔴 nothing has moved
//   R4 createGame without `state.loadState(store)`              🔴 caixa-alta: opened after capitals were chosen
