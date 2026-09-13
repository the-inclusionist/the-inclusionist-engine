// SPDX-License-Identifier: AGPL-3.0-or-later
// A CARTRIDGE'S DICTIONARY IS CHECKED IN THE THREE LANGUAGES (study item E4, contract part; ADR-0010 pillar 3).
//
// 📏 Measured on 2026-09-13 across the six sibling games: two register their words through `registerDict` (2048, pinball),
// both in pt, en and es; the engine checked nothing — a key registered in pt and forgotten in es showed Portuguese on a
// Spanish page, and nobody was told. The pillar-3 gates of this tree see only the engine's own dictionaries.
//
// 📌 What the engine can impose without a new contract field is to SAY it: the keys a cartridge registered in one of the
// three languages and not in another become a line in `problems`. (Strings a game never registers it cannot see.)
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, vi } from 'vitest';

function dublarDocumento() {
  vi.stubGlobal('document', { documentElement: { lang: '' }, querySelectorAll: () => [] });
  vi.stubGlobal('window', { dispatchEvent: () => true });
}
/** A CLEAN instance: the registered dictionaries live in the module. */
async function carregarI18n() {
  vi.resetModules();
  dublarDocumento();
  return import('../app/js/core/i18n.js');
}

describe('the three languages of a cartridge dictionary', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('🔴 [Right] a key registered in pt and en but not es is named, with the missing language', async () => {
    const i18n = await carregarI18n();
    i18n.registerDict('pt', { 'jogo.x.titulo': 'Título', 'jogo.x.fim': 'Fim' });
    i18n.registerDict('en', { 'jogo.x.titulo': 'Title', 'jogo.x.fim': 'End' });
    i18n.registerDict('es', { 'jogo.x.titulo': 'Título' });
    const linhas = i18n.lacunasDosDicionarios();
    expect(linhas, 'no line, or more than one').toHaveLength(1);
    expect(linhas[0]).toMatch(/\bes\b/);
    expect(linhas[0]).toContain('jogo.x.fim');
    expect(linhas[0], 'a key present in all three was accused').not.toContain('jogo.x.titulo');
  });

  it('🔴 [Right] a language never registered, while others were, is a line of its own', async () => {
    const i18n = await carregarI18n();
    i18n.registerDict('pt', { 'jogo.y.a': 'A' });
    i18n.registerDict('en', { 'jogo.y.a': 'A' });
    const linhas = i18n.lacunasDosDicionarios();
    expect(linhas.join(' | ')).toMatch(/\bes\b/);
    expect(linhas.join(' | ')).not.toMatch(/\ben\b.*jogo\.y\.a|jogo\.y\.a.*\ben\b/);
  });

  it('🎯 [Zero] three complete languages, or no cartridge dictionary at all, say nothing', async () => {
    const vazio = await carregarI18n();
    expect(vazio.lacunasDosDicionarios(), 'a game that registers nothing was accused').toEqual([]);
    const cheio = await carregarI18n();
    for (const l of ['pt', 'en', 'es']) cheio.registerDict(l, { 'jogo.z.a': l, 'jogo.z.b': l });
    expect(cheio.lacunasDosDicionarios()).toEqual([]);
  });

  it('🎯 [Boundary] a long list is cut, and says how many more', async () => {
    const i18n = await carregarI18n();
    const muitas = Object.fromEntries(Array.from({ length: 12 }, (_, k) => [`jogo.w.k${k}`, 'x']));
    i18n.registerDict('pt', muitas);
    i18n.registerDict('en', muitas);
    i18n.registerDict('es', { 'jogo.w.k0': 'x' });
    const [linha] = i18n.lacunasDosDicionarios();
    expect(linha).toContain('jogo.w.k1');
    expect(linha, 'the line lists every key').not.toContain('jogo.w.k11');
    expect(linha).toMatch(/\b6 more\b/);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   M2 no line is ever written                 🔴 three
//   M3 a game with no dictionary is accused    🔴 [Zero]
//   M4 the list is never cut                   🔴 [Boundary]
//   M5 «more» counts the shown keys too        🔴 [Boundary]
//   (M1, the wiring, in `dicionario-do-cartucho-em-problems`)
