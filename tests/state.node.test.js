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
import { createSettingsStore } from '../app/js/core/state.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { KEYS } from '../app/js/platform/storage-keys.js';

// Each case BUILDS a settings store over a store of its own (ADR-0178's port, ADR-0232 D4): what is checked is that the
// setter ORDERS persistence through the port it was built with — the real storage module on the way, over a backend nobody
// else writes. Without a backend every write would be refused and every read return the default, silently.
// `state.blindMode` is a LIVE getter; reading the old value from a local copy would be the classic mistake — so the cases
// always read from the store.
let desinscrever = [];
let store;
let state, setBlindModeValue, setCaneBlockDivValue, setLetterCaseValue, setCaptionsOnValue, on, off;
beforeEach(() => {
  store = createStorage(memoryBackend());
  state = createSettingsStore({ ...store, KEYS });
  ({ setBlindModeValue, setCaneBlockDivValue, setLetterCaseValue, setCaptionsOnValue, on, off } = state);
  desinscrever = [];
});
afterEach(() => { desinscrever.forEach((f) => f()); });

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

  it('[Boundary] desestruturar a leitura é uma FOTOGRAFIA; o getter do store é que é vivo', () => {
    // A distinction that has already bitten this project, and the factory makes it sharper (ADR-0232 D4): the store's
    // `blindMode` is a getter, so `const { blindMode } = state` copies the value of that moment. The case documents both sides.
    const copia = state.blindMode;
    const { blindMode } = state;
    setBlindModeValue(true);
    expect(copia).toBe(false);          // the local copy does not follow
    expect(blindMode).toBe(false);      // nor does a destructured read
    expect(state.blindMode).toBe(true); // the store's getter does
  });

  it('🔴 [Independence] dois stores não compartilham nada — nem o valor, nem o barramento (ADR-0142, ADR-0232 D4)', () => {
    // Two roots on one page, or two test files: each builds its own store, and a write or an event in one never reaches
    // the other. This is what the factory exists for; a module-level binding would fail both halves.
    const outro = createSettingsStore({ ...createStorage(memoryBackend()), KEYS });
    const ouvidosNoOutro = [];
    outro.on('blindMode', (v) => ouvidosNoOutro.push(v));
    setBlindModeValue(true);
    expect(state.blindMode).toBe(true);
    expect(outro.blindMode, 'a write in one store changed the other').toBe(false);
    expect(ouvidosNoOutro, 'an event in one store reached the other').toEqual([]);
  });
});

/*
 * EVERY SETTER TELLS ITS EVENT, and the third of its three effects is checked for all of them — the lifetime gate checks the
 * second (persist) for all, and until this block only blind mode had the third checked. A setter that stored and persisted
 * but told nobody leaves every panel that subscribes to it showing the old value, with no error anywhere.
 * The setters are DISCOVERED on the store, so a new one without an entry below fails here instead of passing unseen.
 */
describe('core/state — cada setter avisa o seu evento, com o valor guardado', () => {
  /** The event each setter tells, where it is not the setter's own name (`setXValue` → `x`). */
  const EVENTO = { setOutlineFgValue: 'hcOutlineFg', setOutlineBgValue: 'hcOutlineBg' };
  /** Two values per setter: whatever the store holds, at least one call crosses the equality guard. */
  const VALORES = {
    setVizModeValue: ['sim-deuter', 'normal'], setBlindModeValue: [true, false], setLetterCaseValue: ['mixed', 'upper'],
    setCaptionsOnValue: [false, true], setMenuIndexOnValue: [false, true], setCbSafeValue: [true, false],
    setOwnerColorsValue: [false, true], setOutlineFgValue: [2, 0], setOutlineBgValue: [2, 0], setCaneBlockDivValue: [4, 2],
    setWheelchairValue: [true, false], setOneButtonValue: [true, false], setNoGripStrengthValue: [true, false],
    setInputCooldownValue: [500, 0], setSwitchScanValue: [true, false], setVoiceControlValue: [true, false],
    // 'no-such-mode' reads as off: what is told must be the SANITISED value the store kept, not what the caller passed
    setCameraControlValue: ['eyes', 'no-such-mode'], setGameSpeedValue: [0.5, 1], setCaptionPpmValue: [175, 125],
    setSpeechPpmValue: [404, 254],
    // 0 minutes reads as the default hour: what is told must be the sanitised value, as for the camera above
    setSessionMinutesValue: [30, 0], setSessionEndingValue: ['pulse', 'red'],
  };
  const setters = () => Object.keys(state).filter((k) => /^set\w+Value$/.test(k));

  it('a descoberta é MECÂNICA, e cada setter descoberto tem par de valores', () => {
    expect(setters().length).toBe(22);
    expect(setters().filter((s) => !(s in VALORES)), 'setter novo sem par de valores').toEqual([]);
  });

  it('🔴 [Right] cada setter avisa o SEU evento com o valor que o store passou a ler', () => {
    const mudos = [];
    for (const nome of setters()) {
      const evento = EVENTO[nome] ?? nome.replace(/^set(\w)(\w*)Value$/, (_, a, b) => a.toLowerCase() + b);
      const ouvidos = [];
      desinscrever.push(on(evento, (v) => ouvidos.push(v)));
      for (const v of VALORES[nome]) state[nome](v);
      if (!ouvidos.length || ouvidos.at(-1) !== state[evento]) mudos.push(`${nome} → ${evento}`);
    }
    expect(mudos, 'setters that changed the store and told nobody (or told another value)').toEqual([]);
  });
});

// `defaultReducedMotion` left this module with the defaults (ADR-0232): its cases are in `tests/setting-defaults.node.test.js`.

// ========================= WHAT IS NOT HERE =========================
// Round state (`ended`, `selVizPlayer`, `pauseActor`, `players`, `numPlayers`, the phase…) does not live in
// `core/state`: nothing of it persists, and not persisting is the ROUND criterion (ADR-0038); the round left the engine
// with `core/run-state` (ADR-0228). What `core/state` keeps is PAGE state — accessibility, language, device.

// ========================= MUTATIONS CHECKED (ADR-0232 D4) =========================
// Each applied, seen RED, and undone:
//   · the bus hoisted out of the factory (one map for every store)        🔴 [Independence] — an event in one store reached the other
//   · `blindMode` hoisted out of the factory (one binding for every store)  🔴 [Independence] — a write in one store changed the other
//   · `setMenuIndexOnValue` without its `emit`                             🔴 cada setter avisa — it was GREEN before this block existed
//   · `setOutlineBgValue` telling `hcOutlineFg`                              🔴 cada setter avisa
//   · `setCameraControlValue` telling the raw value, not the sanitised one 🔴 cada setter avisa
