// THE CHILD'S STORED SETTINGS ARE READ WHEN THE ROOT BUILDS THE STORE, AND NO STORE EXISTS WITHOUT THEM (ADR-0178, issue #174;
// ADR-0232 D4).
//
// 📏 Before: `core/state` and `core/i18n` read storage the moment they were imported — `core` importing `platform/storage`
// against ADR-0173. Then an explicit `loadState`, with a write before it throwing, because it would overwrite what the child
// saved. Since D4 the store is a FACTORY over a REQUIRED port: there is no «before the load» for a write to happen in.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { specifiersOf } from '../scripts/lib/module-specifiers.mjs';
import { createSettingsStore } from '../app/js/core/state.js';

/** A storage double with the shape of `platform/storage`, holding what a child saved. */
function portaGuardada(inicial = {}) {
  const mapa = new Map(Object.entries(inicial));
  const escritas = [];
  return {
    map: mapa,
    escritas,
    get: (k, fallback) => (mapa.has(k) ? mapa.get(k) : fallback),
    set: (k, v) => { escritas.push(k); mapa.set(k, String(v)); return true; },
    getBool: (k, fallback = false) => (mapa.has(k) ? mapa.get(k) === '1' : fallback),
    setBool: (k, on) => { escritas.push(k); mapa.set(k, on ? '1' : '0'); },
    getNum: (k, fallback = 0) => (mapa.has(k) ? Number(mapa.get(k)) : fallback),
    KEYS: { letterCase: 'incl_lettercase', captions: 'incl_captions', menuIndex: 'incl_menuindex', cbsafe: 'incl_cbsafe',
      ownercolors: 'incl_ownercolors', outfg: 'incl_outfg', outbg: 'incl_outbg', lang: 'incl_lang' },
  };
}

describe('the stored settings, read when the root builds the store (ADR-0178, ADR-0232 D4)', () => {
  it('🔴 [Right] the store is born with what the child saved', () => {
    const state = createSettingsStore(portaGuardada({ incl_modocego: '1', incl_lettercase: 'mixed', incl_captions: '0', incl_cane_div: '4' }));
    expect(state.blindMode).toBe(true);
    expect(state.letterCase).toBe('mixed');
    expect(state.captionsOn).toBe(false);
    expect(state.caneBlockDiv).toBe(4);
  });

  it('🎯 [Zero] over an empty storage the store holds the defaults', () => {
    const state = createSettingsStore(portaGuardada());
    expect(state.blindMode).toBe(false);
    expect(state.letterCase).toBe('upper');
  });

  it('🎯 [Zero] a setter that changes nothing writes nothing — the saved choice is never rewritten with itself', () => {
    const porta = portaGuardada({ incl_modocego: '1' });
    const state = createSettingsStore(porta);
    state.setBlindModeValue(true);
    expect(porta.escritas, 'a setter rewrote a choice it did not change').toEqual([]);
  });

  it('🔴 [Right] a setter writes through the port the store was built with', () => {
    const porta = portaGuardada();
    const state = createSettingsStore(porta);
    state.setWheelchairValue(true);
    state.setLetterCaseValue('mixed');
    expect(porta.map.get('incl_wheelchair')).toBe('1');
    expect(porta.map.get('incl_lettercase')).toBe('mixed');
  });
  it('🔴 [Right] setLocale on a translator with no port is refused, and nothing has moved', async () => {
    const { createTranslator } = await import('../app/js/core/i18n.js');
    const tr = createTranslator();
    const antes = tr.locale();
    await expect(tr.setLocale('en')).rejects.toThrow(/without a port/);
    expect(tr.locale(), 'the language changed before the refusal').toBe(antes);
  });

  it('🎯 [Zero] core imports no storage — the two debts of #167 are paid', () => {
    // Every import form, read by the parser — a side-effect or `import()` of the storage escaped a `from '…'` pattern —
    // and type-only imports included, as ADR-0173 counts them.
    for (const f of ['state.ts', 'i18n.ts']) {
      const fonte = readFileSync(join(process.cwd(), 'app', 'js', 'core', f), 'utf8');
      const alvos = specifiersOf(fonte, f).filter((s) => s.spec?.startsWith('.'))
        .map((s) => posix.normalize(posix.join('core', s.spec)));
      expect(alvos, `core/${f} imports platform/storage again`).not.toContain('platform/storage.js');
    }
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   R1 the store reads nothing at construction (defaults kept)      🔴 the store is born with what the child saved
//   R2 `setBlindModeValue`'s equality guard removed              🔴 a setter that changes nothing writes nothing
//   R3 setLocale's guard moved back after the switch                 🔴 nothing has moved
//   R4 createGame builds its store over an empty port             🔴 caixa-alta: opened after capitals were chosen
