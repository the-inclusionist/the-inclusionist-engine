// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of core/state — the shared state and its event bus (node project).
//
// WHY THIS FILE. Many test files import `core/state` as scenery without ever checking its contract. That is enough
// while it only keeps values; it stops being enough once it receives state that several modules consult, with
// persistence and an event coupled to it — `blindMode` is the first (#50).
//
// WHAT IS CHECKED HERE IS THE SETTER'S DISCIPLINE: write, persist, notify — and NOTHING MORE. A blind-mode setter that
// redid the level's extras, reflected a DOM panel and announced to the screen reader inside itself could not be called
// by any test. The separation between writing and reacting is what makes this file possible, so it is what the cases
// protect.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { blindMode, setBlindModeValue, setCaneBlockDivValue, setLetterCaseValue, setCaptionsOnValue,
  on, off } from '../app/js/core/state.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { KEYS } from '../app/js/platform/storage-keys.js';
import { filePort } from './fixtures/file-storage.js';

// `blindMode` is a LIVE binding: re-importing is not needed, but reading the old value from a local copy would be the
// classic mistake — so the cases always read from the module.
import * as state from '../app/js/core/state.js';

// Each case loads the settings from a store of its own (ADR-0178's port, ADR-0232): what is checked is that the setter
// ORDERS persistence through the port it was loaded with — the real storage module on the way, over a backend nobody
// else writes. Without a backend every write would be refused and every read return the default, silently.
let desinscrever = [];
let store;
beforeEach(() => {
  store = createStorage(memoryBackend());
  state.loadState({ ...store, KEYS });
  setBlindModeValue(false); desinscrever = [];
});
afterEach(() => {
  desinscrever.forEach((f) => f()); setBlindModeValue(false); setLetterCaseValue('upper'); setCaptionsOnValue(true);
  state.loadState(filePort); // back to this file's storage, as the setup left it
});

function escuta(evt) {
  const vistos = [];
  const fn = (v) => vistos.push(v);
  on(evt, fn);
  desinscrever.push(() => off(evt, fn));
  return vistos;
}

describe('core/state — blindMode e o espaçamento da bengala', () => {
  it('[Right] o setter grava, e a leitura vê o valor novo pelo binding vivo', () => {
    expect(state.blindMode).toBe(false);
    setBlindModeValue(true);
    expect(state.blindMode).toBe(true);
  });

  it('[Right] persiste em incl_modocego, para o modo sobreviver a fechar o jogo', () => {
    setBlindModeValue(true);
    expect(store.getBool('incl_modocego')).toBe(true);
    setBlindModeValue(false);
    expect(store.getBool('incl_modocego')).toBe(false);
  });

  it('[Right] avisa quem assinou, com o valor novo', () => {
    const vistos = escuta('blindMode');
    setBlindModeValue(true);
    expect(vistos).toEqual([true]);
  });

  it('[Zero] gravar o valor QUE JÁ ESTÁ não avisa ninguém', () => {
    // The guard is not an optimisation: without it, every redundant click on the pause icon would repeat the
    // announcement "Modo cego ligado" in the ear of whoever depends on the screen reader.
    const vistos = escuta('blindMode');
    setBlindModeValue(false); // already false
    expect(vistos).toEqual([]);
    setBlindModeValue(true);
    setBlindModeValue(true);
    expect(vistos).toEqual([true]); // and not [true, true]
  });

  it('[Interface] o setter NÃO reage — não toca DOM, não anuncia, não redesenha', () => {
    // It is the property that makes this file possible. If someone one day hangs an effect here, this case stays green
    // (there is no way to assert an absence in general), but the test BREAKS another way: it would need `document`, and
    // the `node` project has none. The absence of setup is the assertion.
    expect(typeof document).toBe('undefined');
    setBlindModeValue(true);
    expect(state.blindMode).toBe(true);
  });

  it('[Inverse] desinscrever para de receber', () => {
    const vistos = [];
    const fn = (v) => vistos.push(v);
    on('blindMode', fn);
    setBlindModeValue(true);
    off('blindMode', fn);
    setBlindModeValue(false);
    expect(vistos).toEqual([true]);
  });

  it('[Regressão] o espaçamento da bengala PERSISTE — antes era lido no boot e nunca gravado', () => {
    // A DEFECT FOUND BY THE MIGRATION, not by searching: `incl_cane_div` was read at boot and the setter never wrote it —
    // the key was even registered in `storage.KEYS.caneDiv`, so the intent existed and the write was never written.
    // Effect: the blind child who chose a beat every HALF block (fine resolution to measure distance walked) found the
    // default again every session, with no warning and no explanation.
    setCaneBlockDivValue(2);
    expect(state.caneBlockDiv).toBe(2);
    expect(store.getNum('incl_cane_div', 1)).toBe(2);
  });

  it('[Error] valor corrompido no armazenamento não desliga a bengala', () => {
    // The `|| 1` is not decorative defensiveness: a corrupted `incl_cane_div` would become NaN, and a cane that beats every
    // NaN blocks never beats — the most silent failure mode there is for whoever navigates by sound.
    setCaneBlockDivValue(Number.NaN);
    expect(state.caneBlockDiv).toBe(1);
    setCaneBlockDivValue(0);
    expect(state.caneBlockDiv).toBe(1);
  });


  it('[Right] caixa da letra e legendas PERSISTEM — decisão do ADR-0028: todo menu persiste', () => {
    // Neither had a key nor a boot read, and inventing persistence would be inventing the decision. The Dev's answer was
    // broader: every menu persists AND every menu gets a reset of its own defaults. The reason is accessibility, not
    // convenience — a deaf child who turns captions on and finds them off tomorrow pays that price every day.
    setLetterCaseValue('lower');
    expect(store.get('incl_lettercase', null)).toBe('lower');
    setCaptionsOnValue(false);
    expect(store.getBool('incl_captions', true)).toBe(false);
    setCaptionsOnValue(true);
    expect(store.getBool('incl_captions', false)).toBe(true);
  });

  it('[Boundary] o import nomeado é uma FOTOGRAFIA; o binding do módulo é que é vivo', () => {
    // A distinction that has already bitten this project: `import { blindMode }` gives a live binding in ESM, but copying
    // it into a local variable (`const m = blindMode`) freezes the value. The case documents both sides.
    const copia = state.blindMode;
    setBlindModeValue(true);
    expect(copia).toBe(false);        // the local copy does not follow
    expect(state.blindMode).toBe(true); // the module's binding does
    expect(blindMode).toBe(true);       // and so does the named import: ESM re-reads the cell
  });
});

// `defaultReducedMotion` left this module with the defaults (ADR-0232): its cases are in `tests/setting-defaults.node.test.js`.

// ========================= WHAT IS NOT HERE =========================
// Round state (`ended`, `selVizPlayer`, `pauseActor`, `players`, `numPlayers`, the phase…) does not live in
// `core/state`: nothing of it persists, and not persisting is the ROUND criterion (ADR-0038); the round left the engine
// with `core/run-state` (ADR-0228). What `core/state` keeps is PAGE state — accessibility, language, device.
