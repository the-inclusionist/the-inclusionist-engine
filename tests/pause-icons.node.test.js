// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/pause-icons — the pause's accessibility icon bar (.pi-btn) and the per-screen menu.
// NODE project: PURE logic (labels, cycles, the autism-mode plan, markup) + the reflect shells over a FAKE DOM
// (plain objects, in the style of tests/gamepad.node.test.js — no real `document`). The shell that only exists
// in the browser (buildScreenPause, which uses document.createElement/innerHTML) lives in pause-icons.browser.test.js.
//
// WHAT THESE TESTS PROTECT, above all: the icons' accessibility contract. A `.pi-btn` toggles state owned
// elsewhere (blind mode, TTS, Libras, autism mode, latching keys, contrast, colour blindness) — if its
// `aria-label` does not say the CURRENT state, the button is invisible to a screen-reader user, and that is why
// `iconLabel`/`computeIconLabel` exist. Hence the invariants: every icon has a non-empty label, the label changes
// when the state changes, and no icon ever declares itself on without a state behind it.
// ZOMBIES (Zero/One/Many/Boundary/Interface/Exception/Simple) + Right-BICEP.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { migrateVisual, DEFAULT_VISUAL } from '../app/js/render/viz-axes.js';
import pt from '../app/js/i18n/pt.js';
import {
  hasPrivateOutputIn,
  computeIconLabel, computeIconVisual, ICON_STATE_CLASSES, inputModeOf, nextInputMode,
  iconsThatAct,
  initPauseIcons,
} from '../app/js/ui/pause-icons.js';
// 📌 The catalogue lives in `core/pause-icon-catalogue` (ADR-0221, issue #203): WHICH icons exist and in what order is
// data, and this file measures what they DO. The cases stay here because this is where the bar is mounted.
import { PAUSE_ICONS } from '../app/js/core/pause-icon-catalogue.js';
// 📌 And the MARKUP lives in `ui/pause-markup` (ADR-0221, issue #203): building the string and wiring the elements the browser
// makes from it are two jobs that do not need each other. The cases stay here because they measure the whole bar.
import { iconBtnMarkup, iconsMarkup, pmBtnMarkup, screenPauseMarkup } from '../app/js/ui/pause-markup.js';
// 📌 Calm mode lives in `core/calm-mode` (ADR-0221, issue #203): it is not about icons, it is about what a child who cannot
// bear noise needs the engine to silence. The cases stay here because this is where the ☺ cycle is exercised.
import { nextCalmMode, calmAudioPlan, calmMotionPlan, CALM_AUDIO_CATS } from '../app/js/core/calm-mode.js';
import { CVD_SEQ, CVD_NAMES, nextContrast, nextCvd, CONTRAST_LEVELS } from '../app/js/core/visual-cycles.js';

// ☝️ keeps ONE value for the whole engine (ADR-0218), so it is read and reset here in this file's own store (ADR-0232 D4).
import { createSettingsStore } from '../app/js/core/state.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { KEYS } from '../app/js/platform/storage-keys.js';
import { filePort } from './fixtures/file-storage.js';
import { createTranslator } from '../app/js/core/i18n.js';
const estado = createSettingsStore(filePort);
const translator = createTranslator(); // the root's translator, played by the test (ADR-0232 D3)
const translate = translator.t;
/*
 * 🔴 THE ROUND IS A LOCAL DOUBLE (ADR-0038, ADR-0228): the round's state is not in `core/state` and `core/run-state` left
 * the engine. This file never tested the round — it HANDS one to the pause card, and what it measures is the card. The
 * minimum the card reads is built here, and the double is honest because the assertions were never about it. The aliases
 * below keep the cases written as they always were.
 */
const rodada = {
  numPlayers: 1,
  players: [],
  setNumPlayers(n) { this.numPlayers = n; },
};
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);
const numPlayers = () => rodada.numPlayers; // a function, so the cases call `numPlayers()`


// NO DYNAMIC LABEL: the answer of a game whose button has no label of its own. The module receives the ready phrase or
// `null` (item 19); building it is the game's job.
const SEM_DIN = () => null;

// ---------------------------------------------------------------------------------------------
// Fixtures — a fake DOM (plain objects) and a fake ctx that records everything called on it
// ---------------------------------------------------------------------------------------------

// Minimal classList: only what reflectIconBtn uses (variadic remove, add, toggle with `force`, contains).
// `className` is derived from it, so a case that reads `b.className` sees the same classes the classList holds —
// a fake that let the two drift apart would make a case pass for the wrong reason.
function fakeClassList() {
  const set = new Set();
  return {
    _set: set,
    add: (...ns) => ns.forEach((n) => set.add(n)),
    remove: (...ns) => ns.forEach((n) => set.delete(n)),
    contains: (n) => set.has(n),
    toggle: (n, force) => { if (force) set.add(n); else set.delete(n); return set.has(n); },
  };
}

function fakeIconBtn(pi) {
  const attrs = {};
  const classList = fakeClassList();
  return {
    dataset: { pi },
    classList,
    get className() { return [...classList._set].join(' '); },
    setAttribute(n, v) { attrs[n] = v; },
    getAttribute(n) { return n in attrs ? attrs[n] : null; },
    // ⚠️ A DOUBLE POORER THAN THE REAL THING does not fail the code — it breaks beside it, and the error points at the
    // engine instead of at itself. The fix belongs to the DOUBLE, not to the engine. `removeAttribute` is here because
    // issue #128 (`aria-disabled` mirroring `pi-dis`) is a case that REMOVES an attribute.
    removeAttribute(n) { delete attrs[n]; },
    _attrs: attrs,
  };
}

// Fake "pause screen": it only needs to hand back its .pi-btn.
function fakeScreen(keys = PAUSE_ICONS.map((ic) => ic.k)) {
  const btns = keys.map(fakeIconBtn);
  return { _btns: btns, querySelectorAll: (sel) => (sel === '.pi-btn' ? btns : []) };
}

function makeAudioCat() {
  return {
    tts: { on: false, vol: 1 }, ambient: { on: true, vol: 1 }, music: { on: true, vol: 0.8 },
    earcons: { on: true, vol: 1 }, other: { on: true, vol: 1 }, interact: { on: true, vol: 1 },
    sonar: { on: true, vol: 1 }, guarda: { on: true, vol: 1 },
  };
}

const RM_KEYS = ['parallax', 'decor', 'items', 'particles'];
const RM_CHAR = [{ k: 'walk', prop: 'rmWalk' }, { k: 'breath', prop: 'rmBreath' }, { k: 'flavor', prop: 'rmFlavor' }];

const PM_BTNS = [
  { act: 'resume', lbl: '▶ Continuar' },
  { act: 'letra', lbl: '🔠 ABC', dynamicLabel: true },
  { act: 'quit', lbl: '🚪 Sair do jogo' },
];
const PM_OPTS = [
  { act: 'pmback' },
  { act: 'caa' },
];
const QL_NAME = { 1: 'pré-silábico', 2: 'silábico', 3: 'silábico-alfabético', 4: 'escritor', 5: 'escritor cego' };

function buildCtx(over = {}) {
  const said = [], alerted = [];
  const state = {
    blindMode: false, libras: false, pauseActor: -1,
    audioCat: makeAudioCat(),
    rm: { parallax: false, decor: false, items: false, particles: false },
    saved: 0, catGains: [], ttsPanelRefreshes: 0, toggleMoveCalls: [], vizCalls: [], librasToggles: 0,
    screens: [],
    acts: {},
  };
  const ctx = {
    translator,
    // required (ADR-0232 D4); this project has no DOM, so a case that builds the card or the bar fails loudly here
    doc: { createElement: () => { throw new Error('pause-icons.node builds no element — that case belongs in the browser project'); } },
    store: createStorage(memoryBackend()), // each ctx its own store (ADR-0232)
    settings: estado, // the test plays the root: the page's settings store
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    srSay: (m) => said.push(m),
    srAlert: (m) => alerted.push(m),
    pmButtons: PM_BTNS,
    optionsButtons: PM_OPTS,
    qlName: QL_NAME,
    getPauseActs: () => state.acts,
    // ⚠️ A REQUIRED FIELD. Omitted, the `altmove` icon would vanish in silence — hiding the control is half the
    // defect this field exists to prevent. It is a function (ADR-0142), so omitting it THROWS, which is what is
    // wanted: a badly built ctx can no longer lie quietly.
    holdsKeys: () => true,
    setPauseActor: (i) => { state.pauseActor = i; },
    getPauseScreens: () => state.screens,
    // The QUICK BARS (ADR-0044, item 7): the icons live in the bars, outside the card, and this is how
    // `reflectPauseIcons` finds them. The cases that exercise the reflect fill `state.bars`; the ones that only look
    // at the card's markup leave the list empty — and the reflect then does nothing, correctly.
    getA11yBars: () => state.bars || state.screens,
    getBlindMode: () => state.blindMode,
    setBlindMode: (on) => { state.blindMode = on; },
    getAudioCat: () => state.audioCat,
    setCatGain: (k) => state.catGains.push(k),
    reflectTtsPanel: () => { state.ttsPanelRefreshes++; },
    reflectTtsPanelEnabled: false, // `false`: the icon does not repaint the TTS panel — see `reflectTtsPanelEnabled` in ui/pause-icons
    isLibrasOn: () => state.libras,
    toggleLibras: () => { state.librasToggles++; state.libras = !state.libras; },
    rm: state.rm,
    rmKeys: RM_KEYS,
    rmChar: RM_CHAR,
    saveRM: () => { state.saved++; },
    matchMedia: () => ({ matches: false }), // mandatory (ADR-0232): the reduced-motion question is injected
    setToggleMove: (i, on) => { state.toggleMoveCalls.push([i, on]); const p = players[i]; if (p) p.toggleMove = on; },
    setPlayerViz: (i, mode) => { state.vizCalls.push([i, mode]); const p = players[i]; if (p) { p.viz = mode; p.visual = migrateVisual(mode); } },
    // The PER-AXIS writers (#104): moving one does not erase the other, and that is what the cases assert.
    setPlayerTheme: (i, tema) => { state.vizCalls.push([i, 'tema:' + tema]); const p = players[i]; if (p) p.visual = { ...(p.visual ?? DEFAULT_VISUAL), tema }; },
    setPlayerCorrection: (i, correcao) => { state.vizCalls.push([i, 'correcao:' + correcao]); const p = players[i]; if (p) p.visual = { ...(p.visual ?? DEFAULT_VISUAL), correcao }; },
    ...over,
  };
  return { ctx, state, said, alerted };
}

// Fills the round's players IN PLACE (the ctx reads `rodada.players`; the array is never reassigned).
function setPlayers(list) {
  players.length = 0;
  // ⚠️ DERIVES `visual` from `viz`, the same mirror rule production keeps (#104), so the cases can keep naming the
  // mode by its name — which is how they speak. A case that needs BOTH axes at once passes `visual` directly, and
  // that is what sets it apart.
  list.forEach((p) => players.push(
    p && p.visual === undefined && p.viz !== undefined ? { ...p, visual: migrateVisual(p.viz) } : p,
  ));
  setNumPlayersValue(list.length || 1);
}

// ⚠️ `switchScan` and `voiceControl` are MODULE state (one key for the whole engine, ADR-0218 and issue #184): without
// resetting them, a case that enters the scan — or turns the microphone on — leaves the next one starting inside it, and
// a case that depends on the order of its neighbours does not measure what it says.
beforeEach(() => {
  setPlayers([{ viz: 'normal', visual: DEFAULT_VISUAL }]);
  estado.setSwitchScanValue(false);
  estado.setVoiceControlValue(false);
});

// =============================================================================================
// PURE — private audio output (the gate of the sound icons)
// =============================================================================================
describe('hasPrivateOutputIn — quem pode mexer em som/TTS/modo cego', () => {
  it('ZERO jogadores: devolve true (a contagem <=1 curto-circuita antes de olhar a lista)', () => {
    expect(hasPrivateOutputIn([], 0, 0)).toBe(true);
  });

  it('UM jogador: true mesmo sem audioSink — não há com quem compartilhar', () => {
    expect(hasPrivateOutputIn([{}], 1, 0)).toBe(true);
  });

  it('MUITOS jogadores sem audioSink: nenhum tem saída privada', () => {
    const list = [{}, {}, {}];
    expect(list.map((_, i) => hasPrivateOutputIn(list, 3, i))).toEqual([false, false, false]);
  });

  it('MUITOS com o MESMO sink: nenhum tem saída privada', () => {
    const list = [{ audioSink: 'fone-A' }, { audioSink: 'fone-A' }];
    expect(list.map((_, i) => hasPrivateOutputIn(list, 2, i))).toEqual([false, false]);
  });

  it('MUITOS com sinks DISTINTOS: todos têm saída privada', () => {
    const list = [{ audioSink: 'fone-A' }, { audioSink: 'fone-B' }];
    expect(list.map((_, i) => hasPrivateOutputIn(list, 2, i))).toEqual([true, true]);
  });

  it('BORDA: um sozinho num sink e dois num sink compartilhado — só o sozinho passa', () => {
    const list = [{ audioSink: 'A' }, { audioSink: 'B' }, { audioSink: 'B' }];
    expect(list.map((_, i) => hasPrivateOutputIn(list, 3, i))).toEqual([true, false, false]);
  });

  it('EXCEÇÃO: índice fora da lista devolve false (não lança)', () => {
    expect(hasPrivateOutputIn([{ audioSink: 'A' }, { audioSink: 'B' }], 2, 9)).toBe(false);
  });
});

// =============================================================================================
// PURE — the three cycles (autism mode, contrast, colour blindness)
// =============================================================================================
describe('ciclos dos ícones', () => {
  it('TEA percorre 0→1→2→0 (BORDA: fecha o anel, não estoura em 3)', () => {
    expect([0, 1, 2].map(nextCalmMode)).toEqual([1, 2, 0]);
  });

  it('contraste percorre os 4 níveis e VOLTA ao início (Right-BICEP: inverso por repetição)', () => {
    let v = 'normal';
    const seen = [];
    for (let n = 0; n < 4; n++) { v = nextContrast(v); seen.push(v); }
    expect(seen).toEqual(['hc-direto', 'hc-direto-45', 'hc-direto-7', 'normal']);
    expect(CONTRAST_LEVELS).toContain(v);
  });

  it('contraste com viz FORA da lista cai no índice 0 → devolve o 2º nível', () => {
    expect(nextContrast('fix-protan')).toBe('hc-direto');
    expect(nextContrast(undefined)).toBe('hc-direto');
  });

  it('daltonismo percorre os 4 modos e VOLTA ao início', () => {
    let v = 'normal';
    const seen = [];
    for (let n = 0; n < 4; n++) { v = nextCvd(v).mode; seen.push(v); }
    expect(seen).toEqual(['fix-protan', 'fix-deuter', 'fix-tritan', 'normal']);
  });

  it('ASSIMETRIA proposital: viz fora da lista cai no índice 1 no daltonismo (e no 0 no contraste)', () => {
    expect(nextCvd('hc-direto')).toEqual({ idx: 1, mode: 'fix-protan' });
    expect(nextCvd(undefined)).toEqual({ idx: 1, mode: 'fix-protan' });
    expect(nextContrast('hc-direto')).toBe('hc-direto-45'); // this one IS in the list; the asymmetry is only for values outside it
  });

  it('INVARIANTE: os nomes de anúncio estão alinhados por índice com a sequência de modos', () => {
    expect(CVD_NAMES).toHaveLength(CVD_SEQ.length);
    // CVD_NAMES holds i18n KEYS (phase 5); the assertion goes through the dictionary so it keeps asserting what
    // the person hears, and not merely that some key is there.
    expect(pt[CVD_NAMES[nextCvd('normal').idx]]).toBe('protanopia');
    expect(pt[CVD_NAMES[nextCvd('fix-tritan').idx]]).toBe('visão tricromática');
  });
});

// =============================================================================================
// PURO — plano do modo TEA
// =============================================================================================
describe('plano do modo TEA (applyCalm sem DOM)', () => {
  it('nível 0: cena solta, personagem solto', () => {
    expect(calmMotionPlan(0)).toEqual({ sceneReduced: false, charFrozen: false });
  });
  it('nível 1 (calmo): reduz a CENA mas NÃO congela o personagem', () => {
    expect(calmMotionPlan(1)).toEqual({ sceneReduced: true, charFrozen: false });
  });
  it('nível 2 (silencioso): reduz a cena E congela o personagem', () => {
    expect(calmMotionPlan(2)).toEqual({ sceneReduced: true, charFrozen: true });
  });

  it('áudio nível 0: liga a categoria e NÃO mexe no volume', () => {
    expect(calmAudioPlan(0, 0.9)).toEqual({ on: true, vol: 0.9 });
  });
  it('áudio nível 1: liga e limita o volume a 0.3', () => {
    expect(calmAudioPlan(1, 0.9)).toEqual({ on: true, vol: 0.3 });
  });
  it('áudio nível 1 com volume JÁ abaixo do teto: não sobe (Math.min, não atribuição)', () => {
    expect(calmAudioPlan(1, 0.1)).toEqual({ on: true, vol: 0.1 });
  });
  it('áudio nível 2: desliga e preserva o volume gravado', () => {
    expect(calmAudioPlan(2, 0.9)).toEqual({ on: false, vol: 0.9 });
  });
  it('BUG PRESERVADO: 0→1→0 NÃO devolve o volume original (o teto de 0.3 é destrutivo)', () => {
    const v1 = calmAudioPlan(1, 0.9).vol;
    expect(calmAudioPlan(0, v1).vol).toBe(0.3); // and not 0.9 — the 0.3 cap is not undone
  });
});

// =============================================================================================
// PURE — the label REFLECTS the state (the heart of these buttons' accessibility)
// =============================================================================================
/**
 * ⚠️ THE SNAPSHOT CARRIES `visual` (#104), and this helper DERIVES it from `viz` so the cases can keep naming the
 * mode by its name — which is how they speak. It is the same mirror rule production keeps.
 *
 * A case that needs a state the single key CANNOT express — `hc7` with `fix-deuter`, which is the point of the
 * issue — passes `visual` directly, and that is what sets it apart from the others.
 */
function snap(over = {}) {
  const base = {
    blindMode: false, ttsOn: false, librasOn: false, calmMode: 0,
    toggleMove: false, viz: 'normal', privateOutput: true, ...over,
  };
  return { ...base, visual: base.visual ?? migrateVisual(base.viz) };
}

describe('computeIconLabel — o rótulo tem de dizer o estado', () => {
  it('INTERFACE: todo ícone com estado produz rótulo não-vazio nas duas pontas do toggle', () => {
    const on = snap({ blindMode: true, ttsOn: true, librasOn: true, calmMode: 2, toggleMove: true, viz: 'hc-direto' });
    for (const ic of PAUSE_ICONS) {
      expect(computeIconLabel(translate, ic.k, snap()).length).toBeGreaterThan(0);
      expect(computeIconLabel(translate, ic.k, on).length).toBeGreaterThan(0);
    }
  });

  it('os 5 toggles booleanos dizem on/off e MUDAM quando o estado muda', () => {
    const cases = [
      ['blind', 'blindMode', 'Modo cego'],
      ['tts', 'ttsOn', 'Narração por voz'],
      ['libras', 'librasOn', 'Modo pessoa surda'],
      // ☝️ LEFT THIS LIST in 2026-09-21: it stopped being a boolean and became three positions (ADR-0218). Its own case is below.
    ];
    for (const [k, flag, prefix] of cases) {
      // 'on'/'off' would be ENGLISH words inside a Portuguese sentence — the exact defect the i18n pass exists
      // to remove. The state goes through the dictionary too.
      expect(computeIconLabel(translate, k, snap({ [flag]: false }))).toBe(prefix + ': desligado');
      expect(computeIconLabel(translate, k, snap({ [flag]: true }))).toBe(prefix + ': ligado');
    }
  });

  /*
   * ☝️ SAYS WHICH OF THE THREE READINGS IS IN USE (ADR-0218), and the name is the SUBJECT while the value is the position —
   * the same shape as the camera's. A label of «on» would no longer answer the child's question, which is «on WHAT».
   */
  it('🔴 [Right] o ☝️ diz a POSIÇÃO — padrão, não precisa segurar, um botão só', () => {
    expect(computeIconLabel(translate, 'altmove', snap({ toggleMove: false }))).toBe('Jeito de apertar: padrão');
    expect(computeIconLabel(translate, 'altmove', snap({ toggleMove: true }))).toBe('Jeito de apertar: não precisa segurar');
    expect(computeIconLabel(translate, 'altmove', snap({ switchScan: true }))).toBe('Jeito de apertar: um botão só');
    // 🔴 AND THE SCAN WINS OVER THE LATCH: with one button only there is nothing to hold, and a stored latch value would
    // make the icon announce a position the child is not in.
    expect(computeIconLabel(translate, 'altmove', snap({ toggleMove: true, switchScan: true }))).toBe('Jeito de apertar: um botão só');
  });

  /*
   * 🔴 Probed 2026-09-23: nine of twenty-five decisions of the label could be undone with the suite green — none of them «says the
   * state». Four are what the label says when a value is MISSING, which is the normal case on a first boot: a screen reader reading
   * «undefined» is what the child would hear. They are the three cases below.
   * ⚠️ The other five are EQUIVALENT today, each measured, and have no case:
   *   · the SHORT names of the autism and colour-blindness icons (`icon.tea.short`, `icon.cvd.short`) — the code says the long name
   *     carries the list of levels, and it no longer does: in all three dictionaries the short key is the long key, word for word;
   *   · rounding the speed — the six speeds that exist (1, 0.9 … 0.5) all give a whole number when multiplied by 100, and a stored
   *     value is sanitised to one of them;
   *   · the state as a parameter of `icon.state` rather than concatenated — all three dictionaries write `{nome}: {v}`;
   *   · an absent language read as `pt`, because the fallback right after it answers the same — the two together are held below.
   */
  it('🔴 [Zero] um valor AUSENTE diz o que a engine faz sem ele: câmera desligada, português, velocidade a 100%', () => {
    expect(computeIconLabel(translate, 'camera', snap())).toBe(computeIconLabel(translate, 'camera', snap({ camera: 'off' })));
    expect(computeIconLabel(translate, 'idioma', snap())).toBe(computeIconLabel(translate, 'idioma', snap({ locale: 'pt' })));
    expect(computeIconLabel(translate, 'velocidade', snap())).toMatch(/: 100%$/);
  });

  it('🔴 [Boundary] uma língua fora do ciclo lê-se como português, e não como «undefined»', () => {
    expect(computeIconLabel(translate, 'idioma', snap({ locale: 'fr' }))).toBe(computeIconLabel(translate, 'idioma', snap({ locale: 'pt' })));
  });

  it('🔴 [Right] e ele só se acende fora do padrão — as outras duas posições são «ligado»', () => {
    expect(computeIconVisual('altmove', snap({ toggleMove: false })).on).toBe(false);
    expect(computeIconVisual('altmove', snap({ toggleMove: true })).on).toBe(true);
    expect(computeIconVisual('altmove', snap({ switchScan: true })).on).toBe(true);
    // 🔴 AND NEVER GREYED OUT: no device locks it (ADR-0249), and what a game cannot hold the cycle leaves out.
    expect(computeIconVisual('altmove', snap({ toggleMove: true })).dis).toBe(false);
  });

  describe('nextInputMode — o ciclo de ☝️, e a única coisa que lhe tira uma posição (ADR-0218, ADR-0249)', () => {
    it('🔴 [Right] num jogo que segura tecla são três, na ordem que o Dev pediu', () => {
      expect(nextInputMode('standard', true)).toBe('sticky');
      expect(nextInputMode('sticky', true)).toBe('scan');
      expect(nextInputMode('scan', true)).toBe('standard');
    });

    it('🔴 [Right] num jogo que NÃO segura tecla são duas: a aderência não teria o que segurar', () => {
      expect(nextInputMode('standard', false)).toBe('scan');
      expect(nextInputMode('scan', false)).toBe('standard');
      // and a position that does not exist in this cycle returns the first one, instead of staying stuck outside it
      expect(nextInputMode('sticky', false)).toBe('standard');
    });

    it('🔴 [Right] o ciclo NÃO tem argumento de aparelho — nenhum aparelho tira o «padrão» (ADR-0249)', () => {
      // The superseded rule took a third argument, «the device requires the latch», and skipped `standard`. On eyes, face,
      // gestures and speech the latch now starts as the game's `holdsKeys()` and the child may turn it off.
      expect(nextInputMode.length, 'o ciclo voltou a perguntar pelo aparelho').toBe(2);
      expect(nextInputMode('scan', true, true), 'um terceiro argumento voltou a tirar o «padrão»').toBe('standard');
    });

    it('📌 [Right] e a leitura da posição dá a varredura como vencedora da aderência', () => {
      expect(inputModeOf({})).toBe('standard');
      expect(inputModeOf({ toggleMove: true })).toBe('sticky');
      expect(inputModeOf({ switchScan: true })).toBe('scan');
      expect(inputModeOf({ toggleMove: true, switchScan: true })).toBe('scan');
    });
  });

  it('TEA tem TRÊS estados no rótulo — não é booleano', () => {
    expect([0, 1, 2].map((c) => computeIconLabel(translate, 'tea', snap({ calmMode: c }))))
      .toEqual(['Modo TEA: desligado', 'Modo TEA: calmo', 'Modo TEA: silencioso']);
  });

  it('contraste diz a RAZÃO de contraste do nível, e "off" fora da lista', () => {
    expect(computeIconLabel(translate, 'contrast', snap({ viz: 'normal' }))).toBe('Alto contraste: desligado');
    expect(computeIconLabel(translate, 'contrast', snap({ viz: 'hc-direto' }))).toBe('Alto contraste: 3:1');
    expect(computeIconLabel(translate, 'contrast', snap({ viz: 'hc-direto-45' }))).toBe('Alto contraste: 4,5:1');
    expect(computeIconLabel(translate, 'contrast', snap({ viz: 'hc-direto-7' }))).toBe('Alto contraste: 7:1');
    expect(computeIconLabel(translate, 'contrast', snap({ viz: 'fix-protan' }))).toBe('Alto contraste: desligado');
  });

  it('a quarta ESCOLHA nomeia a visão; o FALLBACK continua `desligado` — e não são a mesma chave', () => {
    expect(computeIconLabel(translate, 'cvd', snap({ viz: 'fix-protan' }))).toBe('Correção de daltonismo: protanopia');
    expect(computeIconLabel(translate, 'cvd', snap({ viz: 'fix-deuter' }))).toBe('Correção de daltonismo: deuteranopia');
    expect(computeIconLabel(translate, 'cvd', snap({ viz: 'fix-tritan' }))).toBe('Correção de daltonismo: tritanopia');
    // ⚠️ THIS IS THE FALLBACK, AND IT STAYS `desligado` ON PURPOSE. `hc-direto` is high contrast: no colour-blindness
    // correction is on, and that is all the label may assert. Saying `visão tricromática` would be the software
    // asserting what the child SEES — and the fallback covers 13 of the 16 modes, including the three colour-blindness
    // SIMULATIONS, low vision and blind mode. The fourth CHOICE of the cycle names the vision (`cvd.tricro`, in the
    // invariant test above); the fallback names the switch. They are different keys.
    expect(computeIconLabel(translate, 'cvd', snap({ viz: 'hc-direto' }))).toBe('Correção de daltonismo: desligado');
    // and the simulation is the case that makes the distinction mandatory, not a subtlety:
    expect(computeIconLabel(translate, 'cvd', snap({ viz: 'sim-deuter' }))).toBe('Correção de daltonismo: desligado');
  });

  /*
   * 🔴 NO ICON ON THE BAR ANNOUNCES ITSELF «EM CONSTRUÇÃO» (issue #184): the `soon` mechanism left the bar, so a loop over
   * `PAUSE_ICONS.filter((x) => x.soon)` would run over an EMPTY list and pass forever. What is asserted instead is the ABSENCE,
   * and it has a child inside it: the 👄 now COMMANDS, and a label still saying «em construção» about an icon that acts would
   * teach the child not to try — the same defect, turned inside out.
   */
  it('🔴 [Zero] nenhum ícone da barra se anuncia EM CONSTRUÇÃO — e o 👄, que era o último, diz o estado', () => {
    const tudoLigado = snap({ blindMode: true, ttsOn: true, librasOn: true, calmMode: 2, toggleMove: true, voice: true });
    for (const ic of PAUSE_ICONS) {
      expect(ic, `${ic.k} trouxe o campo \`soon\` de volta sem mecanismo por trás`).not.toHaveProperty('soon');
      expect(computeIconLabel(translate, ic.k, tudoLigado), ic.k).not.toMatch(/em constru|under construction|en construcci/i);
    }
    expect(computeIconLabel(translate, 'voice', tudoLigado)).toBe('Comando de voz: ligado');
    expect(computeIconLabel(translate, 'voice', snap({ voice: false }))).toBe('Comando de voz: desligado');
  });

  it('EXCEÇÃO: chave desconhecida devolve string vazia (não lança, não inventa rótulo)', () => {
    expect(computeIconLabel(translate, 'nao-existe', snap())).toBe('');
  });
});

// =============================================================================================
// PURO — o estado VISUAL (classes + aria-pressed)
// =============================================================================================
describe('computeIconVisual — o visual e o aria-pressed andam juntos', () => {
  it('ZERO estado: nenhum ícone se declara ativo', () => {
    for (const ic of PAUSE_ICONS) expect(computeIconVisual(ic.k, snap()).active).toBe(false);
  });

  /*
   * ⚠️ The 👄 answers to ITS OWN state (issue #184), and to nothing else: with everything else on, nothing on the rest
   * of the bar may turn it on.
   */
  it('🔴 [Right] o 👄 lê o próprio estado, e nada do resto da barra o liga', () => {
    const tudoMenosAVoz = snap({ blindMode: true, ttsOn: true, librasOn: true, calmMode: 2, toggleMove: true, viz: 'fix-protan', privateOutput: false });
    expect(computeIconVisual('voice', tudoMenosAVoz)).toEqual({ on: false, dis: false, calm: false, cvd: '', active: false });
    expect(computeIconVisual('voice', snap({ voice: true }))).toMatchObject({ on: true, active: true });
  });

  it('blind/tts ficam DESABILITADOS sem saída de áudio privada — mas o `on` continua verdadeiro', () => {
    const s = snap({ blindMode: true, ttsOn: true, privateOutput: false });
    expect(computeIconVisual('blind', s)).toMatchObject({ on: true, dis: true });
    expect(computeIconVisual('tts', s)).toMatchObject({ on: true, dis: true });
  });

  it('🔴 [Right] tts is LOCKED when no voice speaks the language (ADR-0185), even with a private output', () => {
    expect(computeIconVisual('tts', snap({ ttsOn: true, noVoice: true }))).toMatchObject({ on: true, dis: true });
    expect(computeIconVisual('tts', snap({ ttsOn: true, noVoice: false })), 'locked with a voice for the language').toMatchObject({ dis: false });
    expect(computeIconVisual('blind', snap({ blindMode: true, noVoice: true })), 'blind mode needs no voice').toMatchObject({ dis: false });
  });

  it('BORDA do TEA: nível 1 é `.pi-calm` (não `.pi-on`) e nível 2 é `.pi-on` (não `.pi-calm`)', () => {
    expect(computeIconVisual('tea', snap({ calmMode: 0 }))).toMatchObject({ on: false, calm: false, active: false });
    expect(computeIconVisual('tea', snap({ calmMode: 1 }))).toMatchObject({ on: false, calm: true, active: true });
    expect(computeIconVisual('tea', snap({ calmMode: 2 }))).toMatchObject({ on: true, calm: false, active: true });
  });

  it('contraste acende em QUALQUER nível hc-direto* (prefixo, não igualdade)', () => {
    for (const v of ['hc-direto', 'hc-direto-45', 'hc-direto-7']) {
      expect(computeIconVisual('contrast', snap({ viz: v })).on).toBe(true);
    }
    expect(computeIconVisual('contrast', snap({ viz: 'normal' })).on).toBe(false);
    expect(computeIconVisual('contrast', snap({ viz: 'fix-protan' })).on).toBe(false);
  });

  it('daltonismo NÃO usa `.pi-on`: o fundo bicolor é o sinal — mas aria-pressed continua true', () => {
    const v = computeIconVisual('cvd', snap({ viz: 'fix-deuter' }));
    expect(v).toEqual({ on: false, dis: false, calm: false, cvd: 'pi-cvd-deuter', active: true });
  });

  it('INVARIANTE: active é exatamente on || calm || cvd — nunca um subconjunto', () => {
    const estados = [snap({ calmMode: 1 }), snap({ viz: 'fix-tritan' }), snap({ blindMode: true }), snap()];
    for (const s of estados) {
      for (const ic of PAUSE_ICONS) {
        const v = computeIconVisual(ic.k, s);
        expect(v.active).toBe(v.on || v.calm || !!v.cvd);
      }
    }
  });

  it('as classes de estado limpas antes de reaplicar cobrem TODAS as classes que o visual pode gerar', () => {
    const geradas = new Set();
    for (const v of ['fix-protan', 'fix-deuter', 'fix-tritan']) geradas.add(computeIconVisual('cvd', snap({ viz: v })).cvd);
    geradas.add('pi-calm');
    for (const c of geradas) expect(ICON_STATE_CLASSES).toContain(c);
  });
});

// =============================================================================================
// PURO — markup
// =============================================================================================
describe('markup dos ícones e do menu', () => {

  it('[Right] o ícone da alternância é ☝️ — o gesto de UM DEDO, não o braço mecânico', () => {
    // The Dev's request. 🦾 is a prosthesis; the movement toggle is not about prostheses, it is about TAPPING with one
    // finger instead of holding — which is what the motor panel's hint says: one touch turns it on and another turns it
    // off, instead of holding the button. The icon shows the gesture the setting asks for.
    const alt = PAUSE_ICONS.find((i) => i.k === 'altmove');
    expect(alt, 'o ícone da alternância sumiu da barra').toBeTruthy();
    expect(alt.e).toBe('☝️');
  });
  it('a barra tem um botão por ícone declarado', () => {
    expect(iconsMarkup(translator).match(/class="pi-btn/g)).toHaveLength(PAUSE_ICONS.length);
  });

  it('INVARIANTE DE ACESSIBILIDADE: todo .pi-btn nasce com aria-label NÃO-VAZIO', () => {
    const labels = [...iconsMarkup(translator).matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
    expect(labels).toHaveLength(PAUSE_ICONS.length);
    for (const l of labels) expect(l.trim().length).toBeGreaterThan(0);
  });

  it('todo .pi-btn é type="button" (não submete formulário) e carrega seu data-pi', () => {
    const html = iconsMarkup(translator);
    expect(html.match(/type="button"/g)).toHaveLength(PAUSE_ICONS.length);
    for (const ic of PAUSE_ICONS) expect(html).toContain('data-pi="' + ic.k + '"');
  });

  it('🔴 [Zero] nenhum botão nasce com a marca de «em construção» — nem a classe, nem o sufixo (issue #184)', () => {
    // The markup was the other side of the mechanism that left: `.pi-soon` greyed the button to 55% and the `aria-label`
    // carried the suffix. Both left together, and the class left `style.css` too — a class the CSS still painted would
    // grey a live button again the day someone wrote it by mistake.
    for (const ic of PAUSE_ICONS) {
      const h = iconBtnMarkup(translator, ic);
      expect(h, `${ic.k} nasceu com \`pi-soon\``).not.toContain('pi-soon');
      expect(h, `${ic.k} nasceu «em construção»`).not.toContain(', em construção');
    }
  });

  it('🔴 o sufixo do assento é CHAVE, e não português cru colado no markup', () => {
    // 🔴 A seat suffix concatenated as raw Portuguese inside an ENGINE module would read «Paused · Jogador 2» in an
    // English game — the same family as the «📚 Nível» this file already caught once, and the raw-prose sieve cannot see
    // it because it is born from a concatenation and not from a whole literal.
    //
    // ⚠️ THIS CASE MEASURES THE SHAPE; THE LANGUAGE IS MEASURED ELSEWHERE. Here the active dictionary is pt, where the
    // key and a raw literal produce the SAME string — an assertion «não contém Jogador» would be measuring the
    // dictionary and not the mechanism, and would stay green with the literal back. What tells literal from key is
    // BOOTING IN `en`: `tests/bar-in-the-boot-language.browser.test.js`.
    const h = screenPauseMarkup({ player: 1, numPlayers: 2, pmButtons: [], optionsButtons: [], dynLabel: SEM_DIN, t: translate });
    // The `<span>` of its own is what `refreshPauseItems` needs to REPAINT the suffix when the pause opens —
    // without a named place, the language fix has nowhere to land.
    expect(h, 'o sufixo do assento desapareceu em multijogador').toContain('class="pause-seat"');
    expect(h.match(/class="pause-seat">([^<]*)</)[1].trim().length,
      'o `<span>` do assento existe e está vazio com dois jogadores').toBeGreaterThan(0);
    // And with ONE player it stays empty — the suffix is multiplayer information, not decoration.
    const solo = screenPauseMarkup({ player: 0, numPlayers: 1, pmButtons: [], optionsButtons: [], dynLabel: SEM_DIN, t: translate });
    expect(solo).toContain('<span class="pause-seat"></span>');
  });

  it('ZERO botões de menu: o cartão, o título, as duas listas e o rodapé continuam lá', () => {
    const h = screenPauseMarkup({ player: 0, numPlayers: 1, pmButtons: [], optionsButtons: [], dynLabel: SEM_DIN, t: translate });
    expect(h).toContain('class="pause-card" role="dialog" aria-modal="true"');
    // The BAR and the LEGEND are not in the card (ADR-0044, item 7) — they live in the HUD, in `quickBarMarkup`. This
    // case ASSERTS the absence: if they came back here, the pause would be a two-zone grid again and the ring of
    // `stepInPause` would again be forbidden by XAG 106.
    expect(h).not.toContain('pause-icons');
    expect(h).not.toContain('pi-btn');
    // TWO lists (ADR-0044, item 5): the visible root and the hidden options.
    expect(h).toContain('<div class="pause-menu" role="menu" data-sub="raiz"></div>');
    expect(h).toContain('<div class="pause-menu" role="menu" data-sub="opcoes" hidden></div>');
    // No `aria-hidden` on the legend (ADR-0044, item 4): it says which button confirms, and hiding it hid it from
    // exactly who cannot see the glyph. What hides now are the CHIPS, and only they — see `pauseLegendHtml`.
    expect(h).toContain('class="pause-legend"');
    expect(h).not.toContain('class="pause-legend" aria-hidden');
  });

  it('UM jogador: o título NÃO ganha sufixo; MUITOS: ganha "· Jogador N" (1-based)', () => {
    const mk = (player, n) => screenPauseMarkup({ player, numPlayers: n, pmButtons: [], optionsButtons: [], dynLabel: SEM_DIN, t: translate });
    expect(mk(0, 1)).not.toContain('· Jogador');
    expect(mk(1, 2)).toContain('· Jogador 2');
    expect(mk(3, 4)).toContain('aria-label="Menu de pausa do jogador 4"');
  });

  it('botão de rótulo ESTÁTICO é traduzido e ganha data-i18n; o dinâmico não ganha (senão o applyDom o apaga)', () => {
    const t = (k) => 'T:' + k;
    expect(pmBtnMarkup({ act: 'quit', lbl: 'x' }, SEM_DIN, t))
      .toBe('<button class="pm-btn" role="menuitem" type="button" data-act="quit" data-glifo="🚪" data-i18n="pause.quit">T:pause.quit</button>');
    const letra = pmBtnMarkup({ act: 'letra', lbl: '🔠 ABC', dynamicLabel: true }, SEM_DIN, t);
    expect(letra).toContain('pm-letra');
    expect(letra).not.toContain('data-i18n');
    expect(letra).toContain('>🔠 ABC<');
  });

  it('BORDA: o botão de NÍVEL (dormente hoje) monta o rótulo com o nível vigente', () => {
    // The LABEL arrives READY (item 19): building it is the game's job, since the game knows what a level is, what it
    // is called and in which language to say it. What this case measures — and it is what matters — is that the
    // dynamic button uses the label it was given and does NOT get `data-i18n` (or `applyDom` would erase it).
    const h = pmBtnMarkup({ act: 'nivel', lbl: 'ignorado', level: true }, () => 'RÓTULO DO JOGO', (k) => k);
    expect(h).toContain('pm-nivel');
    expect(h).toContain('RÓTULO DO JOGO');
    expect(h).not.toContain('ignorado'); // the static `lbl` is ignored when there is a dynamic label
    expect(h).not.toContain('data-i18n');
  });

  it('o menu monta um .pm-btn por entrada de PM_BTNS, na ordem recebida — e o submenu depois dele', () => {
    // The order of the TWO lists in the markup matters to whoever reads the document in sequence: the root comes first,
    // and it is the visible one. The NAVIGATION order comes from `PM_VISIBLE_ITEMS` and never mixes the two.
    const h = screenPauseMarkup({ player: 0, numPlayers: 1, pmButtons: PM_BTNS, optionsButtons: PM_OPTS, dynLabel: SEM_DIN, t: translate });
    const acts = [...h.matchAll(/data-act="([^"]+)"/g)].map((m) => m[1]);
    // ⚠️ And the THIRD list comes last (ADR-0146): with no `jogoButtons` it is the default, only «voltar».
    expect(acts).toEqual(['resume', 'letra', 'quit', 'pmback', 'caa', 'pmback']);
  });
});

// =============================================================================================
// CASCA — initPauseIcons com DOM falso
// =============================================================================================
describe('initPauseIcons — ações dos ícones', () => {
  it('🔴 [Right] the 📷 cycles the camera control IN THE SETTINGS STORE it is handed (ADR-0215; ADR-0232)', () => {
    // The store is a port now: a store of this case's own, recording, stands where `core/state` stands in a game.
    const { ctx, said } = buildCtx();
    const writes = [];
    ctx.camera = true;
    ctx.settings = { ...estado, cameraControl: 'off', setCameraControlValue: (m) => { writes.push(m); } };
    initPauseIcons(ctx).iconAct('camera', 0);
    expect(writes, 'the icon did not write the next camera mode into the store it was handed').toEqual(['hands']);
    // 🔴 a mode that STARTS is announced by its control, once it has started or with the reason it could not — never here
    expect(said, 'the bar announced the hands before the camera had answered').toEqual([]);
    // and the step that turns it off IS said here: off is true the moment it is written
    ctx.settings = { ...estado, cameraControl: 'eyes', setCameraControlValue: (m) => { writes.push(m); } };
    initPauseIcons(ctx).iconAct('camera', 0);
    expect(writes.at(-1)).toBe('off');
    expect(said, 'the bar stopped saying the 📷 went off').toEqual(['Jogar pela webcam: desligado.']);
  });

  it('🔴 [Right] with no voice for the language, the narration icon says why and turns nothing on (ADR-0185)', () => {
    const { ctx, state, alerted } = buildCtx();
    ctx.noVoice = () => true;
    const antes = state.audioCat.tts.on;
    initPauseIcons(ctx).iconAct('tts', 0);
    expect(state.audioCat.tts.on, 'the locked icon still toggled narration').toBe(antes);
    expect(alerted.join(' '), 'refused in silence').toMatch(/voz|voice/i);
  });
  it('SIMPLES: o modo cego liga e o anúncio conta o estado NOVO', () => {
    const { ctx, state, said } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('blind', 0);
    expect(state.blindMode).toBe(true);
    expect(said).toEqual(['Modo cego ligado.']);
    api.iconAct('blind', 0);
    expect(state.blindMode).toBe(false);
    expect(said[1]).toBe('Modo cego desligado.');
  });
  it('⚠️ [Right] SEM `setModoCego` injetado, o ícone continua a ligar o modo cego — e a PERSISTIR', async () => {
    // ADR-0106 §4, step 1b. A game that injects none of this must not leave a blind child with no way in. The default
    // is `core/state`'s `setBlindModeValue`, which does the three things that record says a setter does — write,
    // persist, notify — and NOTHING more: redoing the level's extras is a reaction, and whoever reacts signs for it.
    const guardado = {};
    // The real settings store persists through the port it is built with (ADR-0178): a store of this case's own (ADR-0232 D4)
    const estadoReal = createSettingsStore({ ...createStorage({
      getItem: (k) => (k in guardado ? guardado[k] : null),
      setItem: (k, v) => { guardado[k] = String(v); },
      removeItem: (k) => { delete guardado[k]; },
    }), KEYS });
    const antes = estadoReal.blindMode;
    const { ctx, said } = buildCtx();
    ctx.settings = estadoReal;               // the root's store, played by the case
    delete ctx.setBlindMode;                 // the game that forgot
    ctx.getBlindMode = () => estadoReal.blindMode;

    initPauseIcons(ctx).iconAct('blind', 0);

    expect(estadoReal.blindMode, 'o ícone não mexeu no estado real').toBe(!antes);
    // ⚠️ `'1'`/`'0'` and not `'true'`/`'false'`: it is the encoding `store.setBool` writes, and it is what the
    // storage of a child who has already played contains. Pinned by the literal on purpose — asserting it by
    // reading back through `store.getBool` would measure the round trip through the same table, and the two would move together.
    expect(guardado['incl_modocego'], 'ligou mas não persistiu — no arranque seguinte volta a estar desligado')
      .toBe(antes ? '0' : '1');
    // ⚠️ And the announcement is neither lost nor doubled: the icon says it, not the setter.
    expect(said).toEqual([antes ? 'Modo cego desligado.' : 'Modo cego ligado.']);
  });


  // 🎯 THE GATE ADR-0113 ASKS OF THE ICON: «pressioná-lo escreve a bandeira DO TRANSPORTE EM USO, e não
  // uma global». The sibling of the blind-mode case just above — same shape, same reason: the bar's icon is the
  // OTHER surface that writes the latch, and if it and the panel wrote different things the two would drift apart
  // in silence.
  it('🎯 [Right] o ícone `altmove` escreve as DUAS chaves — a do aparelho em uso e a legada', async () => {
    const guardado = {};
    // the latch is written through the store the ctx hands in (ADR-0232), over this case's own object
    const backend = {
      getItem: (k) => (k in guardado ? guardado[k] : null),
      setItem: (k, v) => { guardado[k] = String(v); },
      removeItem: (k) => { delete guardado[k]; },
    };
    {
      setPlayers([{ viz: 'normal', toggleMove: false, walkDir: 0 }]);
      const { ctx } = buildCtx();
      ctx.store = createStorage(backend);
      delete ctx.setToggleMove;                  // the game that forgot
      ctx.transportInUse = () => 'gamepad';     // and the root that knows the device

      initPauseIcons(ctx).iconAct('altmove', 0);

      // ⚠️ Literals, not `latchKey(...)`: asserting the key by calling the same function that writes it would
      // measure the round trip through the same table, and the two would move together. The blind-mode case carries
      // the same note about the `1`/`0` encoding.
      expect(guardado['incl_togglemove_p0_gamepad'], 'o ícone não escreveu a chave do aparelho em uso')
        .toBe('1');
      expect(guardado['incl_togglemove_p0'], 'o ícone deixou de escrever a legada e a criança perde a escolha')
        .toBe('1');
    }
  });

  // 📌 WITHOUT THE ROOT ANSWERING, the icon does exactly what it always did — which is what makes the optional field
  // safe for a consumer that has not migrated.
  it('📌 [Zero] sem `transporteEmUso`, o ícone escreve só a legada', async () => {
    const guardado = {};
    // the latch is written through the store the ctx hands in (ADR-0232), over this case's own object
    const backend = {
      getItem: (k) => (k in guardado ? guardado[k] : null),
      setItem: (k, v) => { guardado[k] = String(v); },
      removeItem: (k) => { delete guardado[k]; },
    };
    {
      setPlayers([{ viz: 'normal', toggleMove: false, walkDir: 0 }]);
      const { ctx } = buildCtx();
      ctx.store = createStorage(backend);
      delete ctx.setToggleMove;
      initPauseIcons(ctx).iconAct('altmove', 0);
      expect(Object.keys(guardado)).toEqual(['incl_togglemove_p0']);
    }
  });

  it('🔴 [Right] the latch the icon writes is announced in the language of the bar\'s translator (ADR-0232 D3)', () => {
    // With no host writer, the icon writes through `setMoveLatch`, which speaks with the `t` the bar hands it.
    setPlayers([{ viz: 'normal', toggleMove: false, walkDir: 0 }]);
    const { ctx, said } = buildCtx();
    delete ctx.setToggleMove;
    initPauseIcons(ctx).iconAct('altmove', 0);
    expect(said.join(' | '), 'the latch was announced with a raw key').toContain(pt['sr.motor.toggleMoveOn']);
  });

  // ========================= ADR-0249: THE OPTION IS OFFERED ON THE FOUR ONE-COMMAND TRANSPORTS =========================
  // The latch on eyes, face, gestures and speech starts as the game's `holdsKeys()`, and the child may change it for that
  // device. The bar's icon is where she does: it writes under the key of the transport in use, which the root reads first
  // the next time that transport presses.
  // MUTATIONS CHECKED (2026-09-27, `scratchpad/latch-by-game/mutate.mjs`): the icon refusing the write on the four → 🔴 this case
  // and the cycle case below; `writeLatch` refusing the four → 🔴 this case; a device argument that skips «padrão» in
  // `nextInputMode` → 🔴 «o ciclo NÃO tem argumento de aparelho».
  it('🔴 [Right] com a fala ou o olhar em uso, o ícone `altmove` ESCREVE a escolha dela — sob a chave DAQUELE aparelho', () => {
    for (const aparelho of ['olhos', 'rosto', 'gestos', 'fala']) {
      const guardado = {};
      const backend = {
        getItem: (k) => (k in guardado ? guardado[k] : null),
        setItem: (k, v) => { guardado[k] = String(v); },
        removeItem: (k) => { delete guardado[k]; },
      };
      setPlayers([{ viz: 'normal', toggleMove: false, walkDir: 0 }]);
      const { ctx, alerted } = buildCtx();
      ctx.store = createStorage(backend);
      delete ctx.setToggleMove;
      ctx.transportInUse = () => aparelho;
      ctx.holdsKeys = () => true;

      initPauseIcons(ctx).iconAct('altmove', 0);

      expect(rodada.players[0].toggleMove, `${aparelho}: o ícone recusou a escolha`).toBe(true);
      // ⚠️ Literal key, not `latchKey(...)` — the same note as the gamepad case above.
      expect(guardado[`incl_togglemove_p0_${aparelho}`], `${aparelho}: a escolha não foi guardada para esse aparelho`).toBe('1');
      expect(alerted, `${aparelho}: o ícone disse uma recusa`).toEqual([]);
    }
  });

  it('📌 [Zero] sem `transporteEmUso`, o ícone continua a alternar', () => {
    setPlayers([{ viz: 'normal', toggleMove: false, walkDir: 0 }]);
    const { ctx, state } = buildCtx();
    initPauseIcons(ctx).iconAct('altmove', 0);
    expect(state.toggleMoveCalls, 'o ícone deixou de accionar quando não há recusa nenhuma').toHaveLength(1);
  });

  /*
   * 🔴 AND THE CYCLE OFFERS THE THREE POSITIONS WITH THE EYES IN USE (ADR-0249). Under the superseded rule it skipped «padrão»
   * there; now the child playing a platform game with her eyes can go back to the standard reading, and the icon stays
   * actionable throughout.
   */
  it('🔴 [Right] com o olhar em uso, o ciclo PASSA pelo padrão — as três posições, como no teclado', () => {
    setPlayers([{ viz: 'normal', toggleMove: true, walkDir: 0 }]);
    const { ctx, state } = buildCtx();
    ctx.transportInUse = () => 'olhos';
    ctx.holdsKeys = () => true; // otherwise the latch would have nothing to hold and the cycle would be the two-position one
    const api = initPauseIcons(ctx);
    const b = fakeIconBtn('altmove');
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-dis'), 'o ícone foi apagado e levou a varredura com ele').toBe(false);

    // From «não precisa segurar» it goes to «um botão só»…
    api.iconAct('altmove', 0);
    expect(estado.switchScan, 'não entrou na varredura').toBe(true);
    // …and from there to the STANDARD, which the eyes may now choose: the latch is written off for them.
    api.iconAct('altmove', 0);
    expect(estado.switchScan).toBe(false);
    expect(state.toggleMoveCalls, 'o padrão não foi alcançado com o olhar em uso').toEqual([[0, false]]);
  });

  // 🔴 ISSUE #128, AND IT IS ONE LINE. `pi-dis` is a CSS CLASS: the child who sees gets a greyed icon, the one who
  // navigates by screen reader gets nothing — the button announces itself actionable and does not respond.
  it('🔴 [Right] `pi-dis` passa a ter par em `aria-disabled` — e sai quando o motivo sai', () => {
    const { ctx } = buildCtx();
    const api = initPauseIcons(ctx);
    const b = fakeIconBtn('blind');

    setPlayers([{ audioSink: 'x' }, { audioSink: 'x' }]);   // two on the same sink: no private output
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-dis'), 'o cenário não desabilitou o ícone').toBe(true);
    expect(b.getAttribute('aria-disabled'), 'a criança cega não sabe que o botão não responde').toBe('true');

    setPlayers([{ audioSink: 'x' }]);                        // alone: the output is private again
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-dis')).toBe(false);
    expect(b.getAttribute('aria-disabled'), 'ficou marcado como desabilitado depois de voltar a funcionar')
      .toBe(null);
  });

  it('o TTS alterna a categoria, reaplica o ganho e anuncia', () => {
    const { ctx, state, said } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('tts', 0);
    expect(state.audioCat.tts.on).toBe(true);
    expect(state.catGains).toEqual(['tts']);
    expect(said).toEqual(['Narração ligada.']);
  });

  it('BUG PRESERVADO: o painel auditivo NÃO é reatualizado (a guarda morta do game.js foi portada)', () => {
    const { ctx, state } = buildCtx();
    initPauseIcons(ctx).iconAct('tts', 0);
    expect(state.ttsPanelRefreshes).toBe(0);
  });

  it('…e com a guarda LIGADA o painel é reatualizado (prova que o caminho existe, só está desligado)', () => {
    const { ctx, state } = buildCtx({ reflectTtsPanelEnabled: true });
    initPauseIcons(ctx).iconAct('tts', 0);
    expect(state.ttsPanelRefreshes).toBe(1);
  });

  // `audioCat` is born NULL in platform/audio and only becomes an object in `initAudioMixer()`, which the root calls
  // at boot. The invariant is written in comments (platform/audio, boot/create-game, consumer-quiz/main-quiz) and
  // enforced nowhere — so the TTS action guards it like the other readings of it in this module do.
  // MUTATION: with the guard removed, this case fails with
  // `TypeError: Cannot read properties of null (reading 'tts')` — checked before it counted.
  it('o ícone de TTS não quebra quando o mixer ainda não foi inicializado', () => {
    const { ctx, state, said } = buildCtx({ getAudioCat: () => null });
    expect(() => initPauseIcons(ctx).iconAct('tts', 0)).not.toThrow();
    expect(state.catGains).toEqual([]);   // does not touch the gain of a mixer that does not exist
    expect(said).toEqual([]);             // and does not announce a state it did not read
  });

  it('Libras delega ao intérprete e anuncia o estado resultante', () => {
    const { ctx, state, said } = buildCtx();
    initPauseIcons(ctx).iconAct('libras', 0);
    expect(state.librasToggles).toBe(1);
    expect(said).toEqual(['Modo pessoa surda: Libras ligado.']);
  });

  it('TEA avança o ciclo, aplica e anuncia — três cliques voltam ao começo', () => {
    const { ctx, said } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('tea', 0); api.iconAct('tea', 0); api.iconAct('tea', 0);
    expect(said).toEqual(['Modo TEA: calmo.', 'Modo TEA: silencioso.', 'Modo TEA: desligado.']);
    expect(api.getCalmMode()).toBe(0);
  });

  /*
   * 🔴 THE WHOLE CYCLE THROUGH THE ACT, in a game that holds keys and on a device that requires nothing — the common case,
   * the keyboard. `nextInputMode` is pure and measured; what this proves is that PRESSING the icon three times walks the
   * three positions and comes back. 📌 Written after the Dev reported «só cicla entre padrão e não precisa segurar».
   */
  it('🔴 [Right] três toques no ☝️ percorrem as TRÊS posições e voltam ao padrão', () => {
    setPlayers([{ viz: 'normal', toggleMove: false, walkDir: 0 }]);
    const { ctx, state } = buildCtx();
    ctx.holdsKeys = () => true;
    const api = initPauseIcons(ctx);
    const posicao = () => api.iconLabel('altmove', 0);

    expect(posicao()).toBe('Jeito de apertar: padrão');
    api.iconAct('altmove', 0);
    expect(state.toggleMoveCalls, 'o primeiro toque não escreveu a aderência').toEqual([[0, true]]);
    rodada.players[0].toggleMove = true; // the ctx's writer is a spy; this is the seat it would write
    expect(posicao()).toBe('Jeito de apertar: não precisa segurar');

    api.iconAct('altmove', 0);
    expect(estado.switchScan, 'o segundo toque não chegou a «um botão só»').toBe(true);
    expect(posicao()).toBe('Jeito de apertar: um botão só');

    api.iconAct('altmove', 0);
    expect(estado.switchScan).toBe(false);
    rodada.players[0].toggleMove = false;
    expect(posicao(), 'a terceira posição não voltou ao padrão').toBe('Jeito de apertar: padrão');
  });

  it('teclas de alternância invertem a flag do jogador CERTO', () => {
    // 📌 Both seats start at the STANDARD: since ADR-0218 a press on a seat already latched takes it to «um botão só»,
    // which writes no latch at all — and the case would stop measuring the seat, which is what it exists to measure.
    setPlayers([{ toggleMove: false }, { toggleMove: false }]);
    const { ctx, state } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('altmove', 1);
    expect(state.toggleMoveCalls).toEqual([[1, true]]);
  });

  it('⚠️ contraste e daltonismo ciclam CADA UM NO SEU EIXO, e um não apaga o outro (#104)', () => {
    // ⚠️ Each icon writes ITS OWN axis (#104): when contrast and colour blindness shared ONE field, turning contrast on
    // cost the colour-blindness correction its place. The assertion that matters is the last one: after moving BOTH,
    // BOTH are still on.
    setPlayers([{ visual: DEFAULT_VISUAL }, { visual: DEFAULT_VISUAL }]);
    const { ctx, state, said } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('contrast', 1);
    expect(state.vizCalls).toEqual([[1, 'tema:hc3']]);
    expect(said).toEqual(['Alto contraste: 3:1.']);
    api.iconAct('cvd', 1);
    expect(state.vizCalls[1]).toEqual([1, 'correcao:protan']);
    expect(said[1]).toBe('Correção de daltonismo: protanopia.');
    // ⚠️ AND THE THEME SURVIVED THE SECOND CLICK — the line a single shared field could not produce.
    expect(players[1].visual).toEqual({ tema: 'hc3', correcao: 'protan', simulacao: null });
  });

  /*
   * 🔴 THE 👄 IS NOT AN EXCEPTION (issue #184): it writes the child's answer. What it SAYS is only what is already true: off.
   * «On» is `ui/voice-control`'s to say — ready, or the reason it could not start, which turns the icon back off — because
   * at the moment of the press nothing has started yet (the bar used to say «ligado» over a microphone that was refused).
   */
  it('🔴 [Right] o 👄 escreve a chave guardada; diz «desligado», e «ligado» fica para o controle', () => {
    const { ctx, state, said, alerted } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('voice', 0);
    expect(estado.voiceControl, 'o comando de voz não foi ligado').toBe(true);
    expect(said, 'the bar announced «on» before the control had answered').toEqual([]);
    expect(alerted, 'o ícone continuou a recusar-se em vez de comandar').toEqual([]);
    api.iconAct('voice', 0);
    expect(estado.voiceControl, 'o segundo toque não desligou').toBe(false);
    expect(said).toEqual(['Comando de voz: desligado.']);
    // and the 👄's act does not slip into its neighbours
    expect(state.blindMode).toBe(false);
    expect(state.vizCalls).toEqual([]);
  });

  it('EXCEÇÃO: sem saída de áudio privada, blind e tts são RECUSADOS com alerta', () => {
    setPlayers([{ audioSink: 'A' }, { audioSink: 'A' }]);
    const { ctx, state, alerted } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('blind', 0);
    api.iconAct('tts', 0);
    expect(alerted).toHaveLength(2);
    expect(state.blindMode).toBe(false);
    expect(state.audioCat.tts.on).toBe(false);
  });

  it('…mas a recusa vale SÓ para som: TEA e contraste passam na mesma configuração compartilhada', () => {
    setPlayers([{ audioSink: 'A', viz: 'normal' }, { audioSink: 'A', viz: 'normal' }]);
    const { ctx, state, alerted } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('tea', 0);
    api.iconAct('contrast', 0);
    expect(alerted).toEqual([]);
    expect(api.getCalmMode()).toBe(1);
    expect(state.vizCalls).toEqual([[0, 'tema:hc3']]);
  });

  it('EXCEÇÃO: chave desconhecida é no-op silencioso (nem fala, nem alerta, nem lança)', () => {
    const { ctx, said, alerted } = buildCtx();
    expect(() => initPauseIcons(ctx).iconAct('nao-existe', 0)).not.toThrow();
    expect(said).toEqual([]); expect(alerted).toEqual([]);
  });

  it('BUG SURFADO: altmove sem jogador no índice LANÇA (contraste/cvd têm guarda `||{}`, altmove não)', () => {
    setPlayers([{ viz: 'normal' }]);
    const { ctx } = buildCtx();
    const api = initPauseIcons(ctx);
    expect(() => api.iconAct('altmove', 3)).toThrow();
    expect(() => api.iconAct('contrast', 3)).not.toThrow(); // a assimetria, provada
  });
});

describe('initPauseIcons — applyCalm', () => {
  it('nível 0: solta a cena, solta o personagem, religa as 5 categorias e persiste o rm', () => {
    setPlayers([{ rmWalk: true, rmBreath: true, rmFlavor: true }]);
    const { ctx, state } = buildCtx();
    const api = initPauseIcons(ctx);
    api.setCalmMode(0); api.applyCalm();
    expect(state.rm).toEqual({ parallax: false, decor: false, items: false, particles: false });
    expect(players[0]).toMatchObject({ rmWalk: false, rmBreath: false, rmFlavor: false });
    expect(state.saved).toBe(1);
    expect(state.catGains).toEqual([...CALM_AUDIO_CATS]);
  });

  it('nível 1 (calmo): reduz a CENA, deixa o personagem solto e limita os volumes a 0.3', () => {
    setPlayers([{ rmWalk: false }]);
    const { ctx, state } = buildCtx();
    const api = initPauseIcons(ctx);
    api.setCalmMode(1); api.applyCalm();
    expect(state.rm).toEqual({ parallax: true, decor: true, items: true, particles: true });
    expect(players[0].rmWalk).toBe(false);
    for (const k of CALM_AUDIO_CATS) {
      expect(state.audioCat[k].on).toBe(true);          // calm REDUCES, it does not silence
      expect(state.audioCat[k].vol).toBeLessThanOrEqual(0.3);
    }
  });

  it('nível 2 (silencioso): congela o personagem e desliga as 5 categorias', () => {
    setPlayers([{}, {}]);
    const { ctx, state } = buildCtx();
    const api = initPauseIcons(ctx);
    api.setCalmMode(2); api.applyCalm();
    for (const p of players) expect(p).toMatchObject({ rmWalk: true, rmBreath: true, rmFlavor: true });
    for (const k of CALM_AUDIO_CATS) expect(state.audioCat[k].on).toBe(false);
  });

  it('PILAR: o TEA NUNCA desliga o TTS nem as pistas de navegação — só o ruído', () => {
    const { ctx, state } = buildCtx();
    state.audioCat.tts.on = true;
    const api = initPauseIcons(ctx);
    api.setCalmMode(2); api.applyCalm();
    expect(state.audioCat.tts.on).toBe(true);
    expect(state.audioCat.sonar.on).toBe(true);
    expect(state.audioCat.guarda.on).toBe(true);
    expect(state.catGains).not.toContain('tts');
  });

  it('MUITOS jogadores: o congelamento vale para TODOS, não só para quem apertou', () => {
    setPlayers([{}, {}, {}, {}]);
    const { ctx } = buildCtx();
    const api = initPauseIcons(ctx);
    api.setCalmMode(2); api.applyCalm();
    expect(players.every((p) => p.rmWalk === true)).toBe(true);
  });

  it('EXCEÇÃO: categoria de áudio ausente é pulada sem lançar', () => {
    const { ctx, state } = buildCtx();
    delete state.audioCat.music;
    const api = initPauseIcons(ctx);
    api.setCalmMode(2);
    expect(() => api.applyCalm()).not.toThrow();
    expect(state.catGains).not.toContain('music');
  });
});

describe('initPauseIcons — reflexo nos botões (DOM falso)', () => {
  // 🔴 AN ICON WITH NO STATE MUST ALSO BE RELABELLED BY THE REFLECT. Such a button has no state to report, but its
  // markup label is only «mesma string» while the markup and the reflect run in the SAME language.
  //
  // ⚠️ MEASURED IN A BROWSER ON 2026-09-08, on the bar `createGame` mounts: `initI18n` loads en/es ASYNCHRONOUSLY
  // (they are chunks of their own), the bar's markup is generated BEFORE the dictionary arrives, and only the labels WITH
  // state corrected themselves afterwards. The page served five icons saying «Blind mode… / Voice narration…» and three
  // still in Portuguese, on the same bar.
  //
  // 📌 The same shape as FINDING 15 in the header of `boot/create-game`: a premise that held while every root was a
  // `main.ts` mounting after i18n, and that the engine broke by mounting the bar itself.
  // 📌 The icon with no state today is the ☰, which opens the menus and keeps nothing (the 👄 was it while it was
  // «em construção», until issue #184) — and the rule is the same.
  it('🔴 [Zero] um ícone SEM ESTADO recebe rótulo do reflexo — «mesma string» deixou de ser verdade', () => {
    const { ctx } = buildCtx();
    const api = initPauseIcons(ctx);
    const b = fakeIconBtn('menu');
    b.setAttribute('aria-label', 'Menu — written by a markup from another language');
    api.reflectIconBtn(b, 0);
    expect(b.getAttribute('aria-label'), 'o reflexo saltou o ícone e o rótulo ficou como a marcação o deixou')
      .toBe(api.iconLabel('menu', 0));
    expect(b.getAttribute('aria-pressed'), 'o ☰ abre algo e não guarda estado: não anuncia um interruptor').toBeNull();
  });

  it('UM botão: recebe classe, aria-pressed e aria-label coerentes com o estado', () => {
    const { ctx, state } = buildCtx();
    state.blindMode = true;
    const api = initPauseIcons(ctx);
    const b = fakeIconBtn('blind');
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-on')).toBe(true);
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.getAttribute('aria-label')).toBe('Modo cego: ligado');
  });

  it('o reflexo é IDEMPOTENTE e reversível: desligar limpa a classe e corrige o rótulo', () => {
    const { ctx, state } = buildCtx();
    state.blindMode = true;
    const api = initPauseIcons(ctx);
    const b = fakeIconBtn('blind');
    api.reflectIconBtn(b, 0); api.reflectIconBtn(b, 0);
    expect(b.className.split(' ').filter((c) => c === 'pi-on')).toHaveLength(1);
    state.blindMode = false;
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-on')).toBe(false);
    expect(b.getAttribute('aria-label')).toBe('Modo cego: desligado');
  });

  it('BORDA: sair do daltonismo LIMPA a classe bicolor anterior (o remove roda antes do add)', () => {
    setPlayers([{ viz: 'fix-protan' }]);
    const { ctx } = buildCtx();
    const api = initPauseIcons(ctx);
    const b = fakeIconBtn('cvd');
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-cvd-protan')).toBe(true);
    players[0].visual = migrateVisual('fix-tritan');
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-cvd-protan')).toBe(false);
    expect(b.classList.contains('pi-cvd-tritan')).toBe(true);
  });

  // ⚠️ The reflect WRITES the label on every icon: with the engine mounting the bar before the asynchronous dictionary
  // arrives, the markup's label and the reflect's can be in different LANGUAGES, so skipping the write for an icon
  // with no state is not safe.
  //
  // 📌 What is asserted is what must not regress: when the language did NOT change, the reflect writes exactly the
  // string the markup would.
  it('⚠️ [Right] o reflexo ESCREVE em todo ícone: o rótulo com estado por cima do de repouso, e a mesma string onde não há estado', () => {
    const { ctx } = buildCtx();
    const api = initPauseIcons(ctx);
    const daMarcacao = (k) => /aria-label="([^"]*)"/.exec(iconBtnMarkup(translator, PAUSE_ICONS.find((i) => i.k === k)))?.[1];
    for (const ic of PAUSE_ICONS) {
      const b = fakeIconBtn(ic.k);
      api.reflectIconBtn(b, 0);
      expect(b.getAttribute('aria-label'), `${ic.k} ficou sem rótulo do reflexo`).toBe(api.iconLabel(ic.k, 0));
    }
    // 🔴 AND BOTH ENDS OF THE SAME RULE, so «escreve sempre» is not mistaken for «escreve o mesmo»: where there is state, the
    // reflect's label REPLACES the resting one the markup gave; where there is none, it writes exactly the same string —
    // which is why the ☰ seemed not to need the write, until the bar started being born before the async dictionary arrived.
    const comEstado = fakeIconBtn('blind');
    api.reflectIconBtn(comEstado, 0);
    expect(comEstado.getAttribute('aria-label'), 'o rótulo com estado não substituiu o de repouso').not.toBe(daMarcacao('blind'));
    const semEstado = fakeIconBtn('menu');
    api.reflectIconBtn(semEstado, 0);
    expect(semEstado.getAttribute('aria-label')).toBe(daMarcacao('menu'));
  });

  it('ZERO telas: reflectPauseIcons não faz nada e não lança', () => {
    const { ctx } = buildCtx();
    expect(() => initPauseIcons(ctx).reflectPauseIcons()).not.toThrow();
  });

  it('MUITAS telas: cada uma reflete o estado do SEU jogador (o índice é o escopo)', () => {
    setPlayers([{ viz: 'hc-direto', toggleMove: true }, { viz: 'normal', toggleMove: false }]);
    const { ctx, state } = buildCtx();
    state.screens = [fakeScreen(['contrast', 'altmove']), fakeScreen(['contrast', 'altmove'])];
    initPauseIcons(ctx).reflectPauseIcons();
    const [s0, s1] = state.screens;
    expect(s0._btns.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'true']);
    expect(s1._btns.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
    expect(s0._btns[0].getAttribute('aria-label')).toBe('Alto contraste: 3:1');
    expect(s1._btns[0].getAttribute('aria-label')).toBe('Alto contraste: desligado');
  });

  it('INVARIANTE: depois do reflexo, TODO .pi-btn tem aria-label não-vazio e aria-pressed definido', () => {
    setPlayers([{ viz: 'fix-deuter', toggleMove: true }]);
    const { ctx, state } = buildCtx();
    state.blindMode = true; state.libras = true;
    state.screens = [fakeScreen()];
    const api = initPauseIcons(ctx);
    api.setCalmMode(1);
    api.reflectPauseIcons();
    for (const b of state.screens[0]._btns) {
      const lbl = b.getAttribute('aria-label');
      // ⚠️ NO BRANCH ON `soon`: the title of this case says «TODO .pi-btn», and the case agrees with it — that
      // agreement is what catches an icon stranded in the markup's language.
      expect(lbl.trim().length, `${b.dataset.pi} ficou sem rótulo depois do reflexo`).toBeGreaterThan(0);
      // the ☰ opens the menus and holds no state: it is the one button that must NOT announce itself as a toggle
      expect(b.dataset.pi === 'menu' ? [null] : ['true', 'false'], b.dataset.pi).toContain(b.getAttribute('aria-pressed'));
    }
  });

  it('reflectIconsIn com raiz nula é no-op (não lança)', () => {
    const { ctx } = buildCtx();
    expect(() => initPauseIcons(ctx).reflectIconsIn(null, 0)).not.toThrow();
  });

  it('CRUZAMENTO: iconLabel do módulo bate com computeIconLabel puro sobre o mesmo snapshot', () => {
    setPlayers([{ viz: 'hc-direto-7', toggleMove: true }]);
    const { ctx, state } = buildCtx();
    state.blindMode = true; state.audioCat.tts.on = true; state.libras = true;
    const api = initPauseIcons(ctx);
    api.setCalmMode(2);
    const s = api.iconState(0);
    for (const ic of PAUSE_ICONS) expect(api.iconLabel(ic.k, 0)).toBe(computeIconLabel(translate, ic.k, s));
  });

  it('o snapshot lê os bindings VIVOS de core/state (mutar players muda o rótulo sem re-init)', () => {
    setPlayers([{ viz: 'normal', toggleMove: false }]);
    const { ctx } = buildCtx();
    const api = initPauseIcons(ctx);
    expect(api.iconLabel('altmove', 0)).toBe('Jeito de apertar: padrão');
    players[0].toggleMove = true;
    expect(api.iconLabel('altmove', 0)).toBe('Jeito de apertar: não precisa segurar');
  });

  it('o ciclo COMPLETO (agir → refletir) mantém rótulo e classe em acordo', () => {
    setPlayers([{ viz: 'normal' }]);
    const { ctx, state } = buildCtx();
    state.screens = [fakeScreen(['contrast'])];
    const api = initPauseIcons(ctx);
    const b = state.screens[0]._btns[0];
    for (const esperado of ['3:1', '4,5:1', '7:1', 'desligado']) {
      api.iconAct('contrast', 0);
      api.reflectPauseIcons();
      expect(b.getAttribute('aria-label')).toBe('Alto contraste: ' + esperado);
      expect(b.getAttribute('aria-pressed')).toBe(String(esperado !== 'desligado'));
    }
  });
});

describe('initPauseIcons — o que NÃO acontece no import', () => {
  it('nenhum efeito colateral no init: sem ctx chamado, sem estado tocado', () => {
    const { ctx, state, said, alerted } = buildCtx();
    const spy = vi.spyOn(ctx, 'getPauseActs');
    const api = initPauseIcons(ctx);
    expect(api.getCalmMode()).toBe(0);
    expect(said).toEqual([]); expect(alerted).toEqual([]);
    expect(state.saved).toBe(0); expect(state.catGains).toEqual([]);
    expect(spy).not.toHaveBeenCalled(); // pauseActs is LAZY — never read at init (a game may define its acts after the icons are mounted)
  });

  // The count comes from the round's getter injected in the ctx, and the module ASKS on every use instead of
  // copying the count at init. A `const n = ctx.getNumPlayers()` kept at init would make the second half of this
  // case fail.
  it('a contagem é PERGUNTADA a cada uso, não copiada no init', () => {
    setPlayers([{ audioSink: 'A' }, { audioSink: 'A' }]);
    const { ctx, alerted } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('blind', 0);
    expect(alerted).toHaveLength(1); // compartilhado → recusa
    setPlayers([{ audioSink: 'A' }]);
    expect(numPlayers()).toBe(1);
    api.iconAct('blind', 0);
    expect(alerted).toHaveLength(1); // sozinho → passa, sem novo alerta
  });
});

describe('iconesQueAccionam — nenhuma etapa entrega botão morto (ADR-0106 §5)', () => {
  it('⚠️ [Right] SEM escritor visual, o contraste e a cor NÃO entram na barra', () => {
    // The record decides this in writing: «uma barra que oferece a uma criança um caminho e depois o recusa é
    // pior do que uma barra que ela vê que não está lá, porque a primeira ensina-lhe que o caminho não é
    // para ela». The other icons stay — losing the whole bar because of two would be the wrong trade.
    // 📌 `tipografia: true` (ADR-0149): the typography icon follows the same rule as the two visual ones, and leaving
    // it out here would measure TWO absences instead of the one the case names.
    const chaves = iconsThatAct({ clock: () => true, theme: false, correction: false, holdsKeys: () => true, typography: true, camera: true, microphone: true, menus: true }).map((ic) => ic.k);
    expect(chaves).not.toContain('contrast');
    expect(chaves).not.toContain('cvd');
    expect(chaves).toContain('blind');
    expect(chaves).toContain('tts');
    expect(chaves).toHaveLength(PAUSE_ICONS.length - 2);
  });

  it('[Right] COM escritor visual, a barra é a lista inteira e na mesma ordem', () => {
    expect(iconsThatAct({ clock: () => true, theme: true, correction: true, holdsKeys: () => true, typography: true, camera: true, microphone: true, menus: true })).toEqual(PAUSE_ICONS);
  });

  it('⚠️ [Boundary] com UM escritor só, aparece UM ícone só — e é o que funciona', () => {
    // ⚠️ THIS CASE WAS BORN FROM A SURVIVING MUTATION, and it pointed at a DESIGN defect rather than a coverage
    // hole. While the question was a single flag («este jogo tem escritores visuais»), swapping `&&` for `||` failed
    // nothing — because every case removed BOTH. And the two operators are wrong in opposite directions: `&&` hides
    // an icon that WORKS, `||` shows one that does NOT. The right question is per ICON.
    const soTema = iconsThatAct({ theme: true, correction: false, holdsKeys: () => true, typography: true }).map((ic) => ic.k);
    expect(soTema).toContain('contrast');
    expect(soTema).not.toContain('cvd');

    const soCor = iconsThatAct({ theme: false, correction: true, holdsKeys: () => true }).map((ic) => ic.k);
    expect(soCor).not.toContain('contrast');
    expect(soCor).toContain('cvd');
  });

  it('⚠️ [Right] o ícone que sobra SOME — «este jogo não tem» nunca foi «em breve»', () => {
    // «Em breve» said «ainda não construímos isto», and a button saying it about high contrast would lie: high contrast
    // is built. What is missing is a way for this game to apply it — and the answer to that is absence.
    // 📌 The `soon` mechanism is gone (issue #184); what this case guards is that the absence is NOT replaced by a
    // greyed button calling itself unbuilt.
    const ficaram = iconsThatAct({ theme: false, correction: false, holdsKeys: () => true });
    for (const ic of ficaram) expect(ic, `${ic.k} voltou a anunciar-se em construção`).not.toHaveProperty('soon');
    expect(ficaram.map((ic) => ic.k), 'o contraste sem escritor ficou na barra').not.toContain('contrast');
  });

  /* ===================== ADR-0115 · a game that holds nothing does not OFFER the latch =====================
   *
   * 🔴 The defect has a child inside it: the latch exists for whoever cannot HOLD a key down. In a quiz, a board or
   * a tile puzzle there is nothing to latch — and the control, offered anyway, is an option that does nothing. The
   * child turns on the setting she depends on and nothing happens; she learns the setting is broken.
   *
   * ⚠️ Explaining why a control does nothing is still handing over a control that does nothing, so the latch is left
   * out here — on every device, the four one-command ones included (ADR-0249). */
  it('🎯 [Zero] um jogo que não segura teclas NEM declara posição não recebe o ícone `altmove`', () => {
    const chaves = iconsThatAct({ clock: () => true, theme: true, correction: true, holdsKeys: () => false, typography: true, camera: true, microphone: true, menus: true }).map((ic) => ic.k);
    expect(chaves, 'o `altmove` foi montado num jogo que não segura nada').not.toContain('altmove');
    expect(chaves).toHaveLength(PAUSE_ICONS.length - 1);
  });

  /*
   * 🔴 AND THE OTHER HALF (ADR-0218), which a surviving mutation showed was not measured: the icon also exists where the
   * game DECLARES POSITIONS without holding any key — the quiz. The latch has nothing to hold there; «um botão só» has
   * something to scan.
   */
  it('🔴 [Right] mas um jogo que DECLARA POSIÇÃO recebe-o, mesmo sem segurar tecla — é o caso do quiz', () => {
    const chaves = iconsThatAct({
      clock: () => true, theme: true, correction: true, holdsKeys: () => false, declaredPositions: () => 5,
      typography: true, camera: true, microphone: true, menus: true,
    }).map((ic) => ic.k);
    expect(chaves, 'o jogo que declara cinco posições ficou sem «um botão só»').toContain('altmove');
    expect(chaves).toHaveLength(PAUSE_ICONS.length);
  });

  it('⚠️ [Right] e o PAR: um jogo que segura recebe-o — senão «ausente» passaria por nunca montar nada', () => {
    // Without this case, an implementation returning an empty list would satisfy the one above. The same reason
    // the [Zero] of the visual writers has its pair just above.
    const chaves = iconsThatAct({ theme: true, correction: true, holdsKeys: () => true, typography: true }).map((ic) => ic.k);
    expect(chaves).toContain('altmove');
  });

  it('⚠️ [Boundary] a ausência do `altmove` é INDEPENDENTE dos escritores visuais', () => {
    // The filter's branches are separate questions, and an implementation collapsing two of them into one flag
    // would pass the cases above — exactly the defect the `&&`/`||` mutation exposed for the theme/correction pair.
    // ⚠️ `tipografia` is LEFT OUT here on purpose, and the number below counts FOUR absences: this case measures
    // that the filter's branches are INDEPENDENT, and the typography branch is one of them (ADR-0149).
    const semNada = iconsThatAct({ clock: () => true, theme: false, correction: false, holdsKeys: () => false }).map((ic) => ic.k);
    expect(semNada).not.toContain('contrast');
    expect(semNada).not.toContain('cvd');
    expect(semNada).not.toContain('altmove');
    expect(semNada).not.toContain('tipografia');
    expect(semNada).not.toContain('camera');
    expect(semNada, 'o 👄 apareceu num aparelho sem microfone por onde ouvir').not.toContain('voice');
    expect(semNada).not.toContain('menu');
    expect(semNada).toHaveLength(PAUSE_ICONS.length - 7);

    const soAlternancia = iconsThatAct({ theme: false, correction: false, holdsKeys: () => true, typography: true }).map((ic) => ic.k);
    expect(soAlternancia).toContain('altmove');
    expect(soAlternancia).not.toContain('contrast');
  });

  it('📌 [Interface] e o ☝️ que FICA não se anuncia em construção — ele tem as três posições', () => {
    const alt = iconsThatAct({ theme: true, correction: true, holdsKeys: () => true }).find((ic) => ic.k === 'altmove');
    expect(alt, 'o ☝️ sumiu de um jogo que segura teclas').toBeTruthy();
    expect(alt, 'a alternância passou a anunciar-se como em construção').not.toHaveProperty('soon');
  });

  // ⚠️ THE MOUNTED BAR is a BROWSER-project case (`buildQuickBar` calls `document.createElement`), and it is there:
  // `SEM escritor visual, o contraste e a cor não são MONTADOS`. Here is the pure half, where the RULE lives; there
  // is the proof that it reaches the DOM.

  it('[Zero] e chamar `iconAct` por chave, sem escritor, não rebenta nem anuncia', () => {
    // `iconAct` is EXPORTED: the bar no longer mounts the button, but a consumer can call it by key.
    const { ctx, said } = buildCtx();
    delete ctx.setPlayerTheme;
    delete ctx.setPlayerCorrection;
    const api = initPauseIcons(ctx);
    expect(() => { api.iconAct('contrast', 0); api.iconAct('cvd', 0); }).not.toThrow();
    expect(said).toEqual([]);
  });
});

describe('PauseIconsCtx — o campo que ninguém lia (ADR-0106)', () => {
  it('⚠️ [Zero] a barra e o cartão montam-se SEM `getPauseScreens` — ele era obrigatório e morto', () => {
    // 📏 Measured on all three sides before it left: zero readers in `ui/pause-icons`, in the tests only the fixtures
    // supplied it, and `game-platformer` passed it for nothing. 📌 The namesake in `ui/shell` belongs to ANOTHER ctx and
    // has real readers — it is what hides and shows the cards per phase.
    const { ctx, said } = buildCtx();
    delete ctx.getPauseScreens;
    const api = initPauseIcons(ctx);

    expect(() => api.reflectPauseIcons()).not.toThrow();
    expect(() => api.iconAct('libras', 0)).not.toThrow();
    expect(said.length, 'o ícone deixou de anunciar sem um campo que ele não lê').toBeGreaterThan(0);
    expect(typeof api.iconLabel('blind', 0)).toBe('string');
  });
});
