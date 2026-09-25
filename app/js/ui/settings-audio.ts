// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-audio — the hearing accessibility and audio panels (#audio overlay): the thin DOM-touching render/wire
// functions; what a choice IS lives in ./audio-choices.js and the voice section in ./voice-settings.js. DI via
// initSettingsAudio(ctx): `$`, `srSay`, `store` (narrow get/set), the browser through three required ports
// (`newElement`, `speech`, `audioOutputs`), the live sound/mixer primitives from platform/audio.ts
// (getSoundOn/setSoundOn/getVolume/setVolume/getAudioCat/setCatGain), the injected `tts` panel API (platform/tts.ts), and
// the host's shared helpers (`toggleBtn`, `getNumPlayers`/`getPlayers`) plus state that lives outside audio
// (`getBlindMode`/`setBlindMode`, `getCaneBlockDiv`/`setCaneBlockDiv` — the widgets live in this overlay, the state does
// not). Overlay open/close plumbing (frontOverlay, focus management, Escape) is the shared infrastructure every settings
// panel uses. `reflectBlindMode`/`reflectTts` are exported because the pause-menu icon bar calls them directly.

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
import { toggleLabel } from './dom.js';
import { t } from '../core/i18n.js';
import { DEFAULTS } from '../core/setting-defaults.js';
import { markChanged, markMenuChanged } from './changed-mark.js';
import { defaultAudioCat } from '../platform/audio-mixer.js';
import type { PlayerView } from '../core/entity.js';
import type { PlayerAudioOut } from '../platform/audio-sonar.js'; // ADR-0039: the owner declares `_ac`/`_acOut`
import type { DomQuery } from '../core/dom-query.js';
import type { PanelShellCtx } from './panel-shell.js';
import { controlRow, labelRow, type ControlRowSpec } from './panel-widgets.js';
/*
 * 🔴 THE VOICE SECTION LIVES IN `ui/voice-settings` (ADR-0221, issue #203): speech — the narration switch, the engine, the
 * voice, the rate, the spoken index and the test button — and the sound categories, cane, blind mode and outputs never
 * needed each other.
 */
import { createVoiceSettings, type TtsPanel, type VoiceSettingsStore } from './voice-settings.js';

// `DomQuery` lives in `core/dom-query`: copies of this line in many modules drifted apart. Re-exported for whoever
// already imported it from here.
export type { DomQuery } from '../core/dom-query.js';

/** Minimal platform/storage.ts shape this module needs (get/set only — no direct localStorage access). */
export interface AudioStore {
  get(key: string, fallback?: string | null): string | null;
  set(key: string, value: string | number | boolean): boolean;
}

/*
 * 🔴 THE PURE HALF LIVES IN `ui/audio-choices` (ADR-0221, issue #203): what a choice IS — the category list, the volume
 * arithmetic, the engine catalogue, the voice filter, an output's label — needs no document, and this file is about
 * FINDING the controls and wiring them. The suite had already made the cut: the node test imported exactly those names
 * and the browser test drove the rest.
 */
import {
  type AudioCatDef, type AudioCatState,
  NAV_CATS, GEN_CATS, volPercent, navMasterVolume, parseCaneDiv, caneDivMessage,
  sinksSupported, sinkOptionLabel, sinkSelectValue,
} from './audio-choices.js';

/**
 * A player's dedicated audio output: the device id and the AudioContext/gain it opened.
 *
 * The id is the entity's (a persisted player preference); the `_ac`/`_acOut` pair is `platform/audio-sonar`'s, which
 * creates them. Hence the intersection instead of three keys in one view.
 */
export type SinkPlayer = PlayerView<'audioSink'> & PlayerAudioOut;

/**
 * THE SETTINGS THIS PANEL READS AND WRITES — the page's settings store, built by the root (ADR-0232 D2c, issue #207): the
 * voice section's (the spoken index and the speech rate) and the default blind-mode writer. A root passes `core/state`.
 */
export interface SettingsAudioSettings extends VoiceSettingsStore {
  /** Write, persist, notify — used when the host injects no `setBlindMode`. */
  setBlindModeValue(on: boolean): void;
}

export interface SettingsAudioCtx {
  /** The page's settings store (see `SettingsAudioSettings`). REQUIRED (ADR-0232): no module reads it by import. */
  settings: SettingsAudioSettings;
  /**
   * Subscribes to a setting's change and returns the release. REQUIRED, and it is the ROOT'S door (`stateOn` in
   * `createGame`): a subscription made through it ends with the root's `dispose()` (ADR-0220), where one made on the
   * page's bus by import went on redrawing the panel of an ended root.
   */
  on: (setting: 'blindMode', react: (on: boolean) => void) => () => void;
  /** DOM selector (querySelector), injected — never reaches `document` globally. */
  $: DomQuery;
  /** Screen-reader "polite" announcement (core/a11y-sr's srSay), injected. */
  srSay: (msg: string) => void;
  /** Persistence (platform/storage.ts) — only the TTS engine/voice choice and the per-player audio sink live
   *  here; the mixer categories persist through `setCatGain` (platform/audio.ts already saves them). */
  store: AudioStore;
  /*
   * 🔴 THE BROWSER ARRIVES THROUGH THREE REQUIRED PORTS, and is not reached (ADR-0227; the Dev: «(a)»): `document`,
   * `window.speechSynthesis` and `navigator.mediaDevices` come in, so this module's global reach is zero, like
   * `ui/voice-settings`, which receives the browser through four ports.
   *
   * ⚠️ REQUIRED, which is what separates this from optional ports that mean "not offered": a host with no voices answers
   * `voices: () => []`, and the panel already knows how to say the browser cannot, in the child's language — that is the
   * host SPEAKING. An absent port is the host SILENT, and a forgotten field is indistinguishable from a field answered
   * "no" (ADR-0224).
   */
  /**
   * Creates an element KEEPING its type — the outputs' `<select>` answers `.value`, the voice list needs `<option>`.
   *
   * 📌 Named like its neighbour, `ui/voice-settings`'s `newOption`.
   */
  newElement: <K extends keyof HTMLElementTagNameMap>(tag: K) => HTMLElementTagNameMap[K];
  /** THIS device's speech synthesis. With no voices, `voices` returns an empty list — which is an answer. */
  speech: {
    voices: () => readonly SpeechSynthesisVoice[];
    speakSample: (sample: string, chosen: SpeechSynthesisVoice | null) => void;
    whenVoicesChange: (again: () => void) => void;
  };
  /** This device's audio outputs, and what it can do with them. */
  audioOutputs: {
    /** Can this browser LIST outputs? */
    canList: () => boolean;
    /** Can this browser ROUTE sound to a chosen output? (It needs an AudioContext.) */
    canRoute: () => boolean;
    /** The outputs already known, without asking permission — many come unnamed, which is the browser's design. */
    list: () => Promise<readonly MediaDeviceInfo[]>;
    /** Asks permission so the outputs have NAMES, and returns them. */
    detect: () => Promise<readonly MediaDeviceInfo[]>;
  };
  /** Category catalog (platform/audio-mixer.ts's AUDIO_CATS) — pure data, injected. */
  audioCats: readonly AudioCatDef[];
  /** Shared helper (the host's): toggles a button's .is-on/aria-pressed. Used by many other panels too — not ours. */
  toggleBtn: (b: HTMLElement, on: boolean) => void;
  /** Shared: current player count, read live from the host. */
  getNumPlayers: () => number;
  /** Shared: the live players array — only `.audioSink`/`._ac`/`._acOut` are touched here. */
  getPlayers: () => SinkPlayer[];
  /** Master mute (platform/audio.ts's soundOn), read/write live. */
  getSoundOn: () => boolean;
  setSoundOn: (on: boolean) => void;
  /** Master volume 0..1 (platform/audio.ts's volume). */
  getVolume: () => number;
  setVolume: (v: number) => void;
  /** The live per-category mixer state (platform/audio.ts's audioCat) — mutated in place, never reassigned. */
  getAudioCat: () => Record<string, AudioCatState> | null;
  /** Re-applies a category's gain to the audio graph AND persists it (platform/audio.ts's setCatGain). */
  setCatGain: (cat: string) => void;
  /** Narration engine/voice panel API (platform/tts.ts's createTts() instance). */
  tts: TtsPanel;
  /** Blind-mode state (NOT owned by this panel). The toggle's widget lives inside #audio; the state and its gameplay
   *  side effects belong to the host. */
  getBlindMode: () => boolean;
  setBlindMode?: (on: boolean) => void;
  /** Cane hit spacing. Same reasoning as blind mode. */
  getCaneBlockDiv: () => number;
  setCaneBlockDiv: (div: number) => void;
  /**
   * Moves the rows' prose to the footer (`ui/settings-panel` → `fillExplain`). Called on EVERY render.
   *
   * ⚠️ Relabelling a row puts its `.opt-hint` back inside it — so without this call the explanation appears twice, in
   * the footer and under the label, from the first click. `CLAUDE.md` §4 records exactly this (issue #109).
   *
   * Optional in the signature because a consumer can mount the panel without the shell (a test): without the shell
   * there is no footer to duplicate.
   */
  fillExplain?: (card: HTMLElement | null) => void;
}

export interface SettingsAudioApi {
  /** Re-renders the whole #audio overlay content (master, categories, nav-sound, TTS panel, sinks, blind-mode and
   *  cane-div sync) and re-wires whatever it (re)creates. Idempotent; the host calls it on every open. */
  renderAudio: () => void;
  /** Refreshes the #opt-modocego button. Exported because the host's blind-mode setter calls it directly. */
  reflectBlindMode: () => void;
  /** Refreshes the #opt-tts button + #tts-engine selection. Exported because the pause-menu icon bar toggles
   *  audioCat.tts.on itself and then calls this. */
  reflectTts: () => void;
}

/**
 * MOUNTS THIS PANEL'S INSIDE — the controls and containers it reaches.
 *
 * 🔴 IT IS THE LARGEST INVISIBLE CONTRACT OF THE PANELS: this file looks for `#opt-modocego`, `#cane-div`,
 * `#opt-menuindex`, `#opt-tts`, `#tts-vol` and more, and nothing in the type says so — which is why it builds them.
 *
 * ⚠️ AND EACH ONE'S TAG MATTERS, which makes this the worst place to guess: `#cane-div` and the voice selects have to be
 * `<select>` — the panel writes `.value` into them —, and the volumes have to be `<input type=range>`. On a `<button>`,
 * writing `.value` gives no error at all: it creates a property nobody reads, and the child's choice vanishes silently.
 *
 * 📌 THE ORDER IS THE DECISION (ADR-0044 §2), from general to particular (see the composition below).
 *
 * ⚠️ `#opt-sound` IS NOT CREATED HERE, deliberately: it is this setting's mirror on the quick bar, outside the panel.
 * `reflectMaster` reaches it with a guard (`if (sb)`), because a game may have no bar.
 *
 * Idempotent: calling it twice reuses what exists instead of duplicating it.
 */
export function mountAudioInside(ctx: PanelShellCtx, card: HTMLElement, list: HTMLElement): void {
  // Each entry is either a control row or a CONTAINER the panel fills with rows of its own.
  const pieces: (ControlRowSpec | { readonly container: string; readonly label?: string })[] = [
    /*
     * 🔴 THE COMPOSITION OF ADR-0151 AND ITS ERRATA, from general to particular:
     *   · BLIND MODE first, because it is the mode where the other sounds become the screen — and WITHOUT the hint: «é
     *     redundante. Quem precisa sabe o que é»;
     *   · the CANE beside it (and only in a game that answers that someone walks, ADR-0153);
     *   · the SONAR, GUARD and GUIDE, each with its switch and volume: they are the shell's list;
     *   · NARRATION and its volume, with the SPOKEN INDEX right after, because narration is what it shortens.
     * 🔴 The GENERAL sound and volume live in the audio panel (`mountSoundInside`) — «toggle + barra para som geral
     * voltam», the Dev said, and they came back to the sound panel, not the accessibility one. There is no separate
     * navigation volume: it would be a second place for the list's three volumes (one place per choice, D2 of the record).
     */
    // ⚠️ Their own short keys, not the bar's `icon.blind`/`icon.tts`: those carry «(navegação sonora)» and «(TTS)», and
    // a row keeps no explanation in parentheses (ADR-0158).
    { id: 'opt-modocego', label: t('audio.modocego') },
    { id: 'cane-div', label: t('audio.cane'), hint: t('audio.cane.dica'), shape: 'escolha' },
    { container: '@lista' }, // the shell's list: sonar, guard and guide
    { id: 'opt-tts', label: t('audio.narracao'), hint: t('audio.tts.dica') },
    { id: 'tts-vol', label: t('audio.ttsVol'), shape: 'cursor' },
    // ADR-0183 §1, ADR-0196: the speech rate, 254 to 504 by 50 — six positions, so a list (ADR-0130 erratum)
    { id: 'tts-ppm', label: t('audio.ttsPpm'), hint: t('audio.ttsPpm.dica'), shape: 'escolha' },
    // ADR-0185: the child picks the voice, among the voices that speak the language — a list, since English passes five
    { id: 'tts-voz', label: t('audio.voz'), shape: 'escolha' },
    { id: 'opt-menuindex', label: t('audio.menuindex'), hint: t('audio.menuindex.dica') },
    /*
     * 🔴 NOT OFFERED by the engine (ADR-0151), in the Dev's words:
     *   · the ENGINE, the VOICE and the voice TEST — «quem escolhe a voz é o jogo (cartucho), não o jogador. Jogador só
     *     habilita/desabilita o TTS»;
     *   · the PER-PLAYER AUDIO OUTPUTS and their detect button — «navegadores não são bons nisso».
     * 📌 `initSettingsAudio`'s wiring for those ids STAYS and is guarded (`if (el)`): a game with markup of its own does
     * not break. What changed is that the engine no longer OFFERS the choice to the child.
     */
  ];

  /*
   * ⚠️ IT RELABELS INSTEAD OF SKIPPING what already exists, which is why this function is also called from every open's
   * `render()`: anything built once at boot captures the fallback language's text — `initI18n` applies the fallback
   * synchronously and REQUESTS the preferred one, which arrives later — and a panel would serve its TITLE in one
   * language and its ROWS in another. No unit test catches it: they all run in one language.
   */
  // ADR-0158: the rows go BEFORE the reset, never after it — the reset is the panel's last item, and «Voltar» its first.
  const actions = card.querySelector<HTMLElement>(':scope > .overlay__actions');
  for (const piece of pieces) {
    if ('container' in piece) {
      if (piece.container === '@lista') { card.insertBefore(list, actions); continue; }
      const jaHa = ctx.find('#' + piece.container);
      if (jaHa) {
        if (piece.label) jaHa.setAttribute('aria-label', piece.label);
        continue;
      }
      const c = ctx.create('div');
      c.id = piece.container;
      c.className = 'ctrl-list';
      c.setAttribute('role', 'group');
      if (piece.label) c.setAttribute('aria-label', piece.label);
      card.insertBefore(c, actions);
      continue;
    }
    const alreadyThere = ctx.find('#' + piece.id);
    if (alreadyThere) {
      const rowNode = alreadyThere.closest<HTMLElement>('.ctrl-row');
      if (rowNode) labelRow(rowNode, piece);
      continue;
    }
    card.insertBefore(controlRow(ctx, piece).row, actions);
  }
}

/**
 * MOUNTS THE AUDIO PANEL'S INSIDE (ADR-0151 §2 item 4): the general sound — switch and volume — and then the shell's
 * list with the four taste categories (music, ambience, interaction, earcons).
 *
 * ⚠️ THE IDS ARE THE ONES `initSettingsAudio` ALREADY LISTENS TO (`#audio-master`, `#audio-master-vol`, `#audio-list`). And
 * the same order rule: mount BEFORE `init`. Idempotent and relabellable, like its hearing sibling.
 */
export function mountSoundInside(ctx: PanelShellCtx, card: HTMLElement, list: HTMLElement): void {
  const actions = card.querySelector<HTMLElement>(':scope > .overlay__actions');
  const rows: ControlRowSpec[] = [
    { id: 'audio-master', label: t('audio.som'), hint: t('audio.som.dica') },
    { id: 'audio-master-vol', label: t('audio.volume'), shape: 'cursor' },
  ];
  for (const piece of rows) {
    const alreadyThere = ctx.find('#' + piece.id);
    if (alreadyThere) {
      const rowNode = alreadyThere.closest<HTMLElement>('.ctrl-row');
      if (rowNode) labelRow(rowNode, piece);
      continue;
    }
    card.insertBefore(controlRow(ctx, piece).row, list.parentNode === card ? list : actions);
  }
  if (list.parentNode !== card) card.insertBefore(list, actions);
}

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

export function initSettingsAudio(ctx: SettingsAudioCtx): SettingsAudioApi {
  // ⚠️ THE ENGINE'S DEFAULT (ADR-0106 §4): whoever injects rules; whoever does not still gets blind mode.
  // `setBlindModeValue` does the three things `core/state` says a setter does — store, persist, notify — and nothing
  // more: the effects are reactions, and whoever reacts subscribes to the event.
  const writeBlindMode = ctx.setBlindMode ?? ((on: boolean): void => { ctx.settings.setBlindModeValue(on); });

  let audioDevices: MediaDeviceInfo[] = [];

  /*
   * ⚠️ THE BROWSER TRAVELS AS FOUR FUNCTIONS, not as a global reached inside: a module that reaches `document` or
   * `window` is refused by the ratchet (the reach ceiling is ZERO). What this file received through its own ports it
   * passes down as ports.
   */
  const voice = createVoiceSettings(ctx, {
    newOption: () => ctx.newElement('option'),
    systemVoices: () => [...ctx.speech.voices()],
    speakSample: (sample, chosen) => ctx.speech.speakSample(sample, chosen),
    whenVoicesChange: (again) => ctx.speech.whenVoicesChange(again),
  });

  function reflectMaster(): void {
    const b = ctx.$<HTMLButtonElement>('#audio-master');
    if (b) {
      b.classList.toggle('is-on', ctx.getSoundOn());
      b.setAttribute('aria-pressed', String(ctx.getSoundOn()));
      b.textContent = toggleLabel(t, ctx.getSoundOn()); // the dictionary's words, no glyph in the name (ADR-0159 rule 12)
    }
    const v = ctx.$<HTMLInputElement>('#audio-master-vol');
    if (v) v.value = String(volPercent(ctx.getVolume()));
    const sb = ctx.$<HTMLElement>('#opt-sound');
    if (sb) ctx.toggleBtn(sb, ctx.getSoundOn());
  }

  /**
   * The kit's ctx comes from the LIST NODE itself, not from a global `document` nor from a new contract field —
   * `ownerDocument` is the document that list lives in, which is where its rows have to be born. Same shape as
   * `ui/settings-caa`, and it is what removes this file's reach to `document` without touching `SettingsAudioCtx`.
   */
  const kitCtx = (list: HTMLElement): PanelShellCtx => ({
    find: (sel) => ctx.$<HTMLElement>(sel),
    create: (tag) => list.ownerDocument.createElement(tag),
  });

  /**
   * The same document, but KEEPING the element type.
   *
   * 📌 `PanelShellCtx.create` is `string → HTMLElement` on purpose: the shell only ever appends generic nodes, and
   * widening it would be a one-way door on a published shape (ADR-0172). The sinks section needs a `<select>` that
   * answers `.value`, so the typed factory lives HERE, over the same `ownerDocument`, instead of the contract
   * growing a field for one caller.
   */
  const makerFor = (host: HTMLElement) =>
    <K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] =>
      host.ownerDocument.createElement(tag);

  /**
   * ONE CATEGORY ROW, in nodes: label, volume slider and toggle.
   *
   * 📌 NOT A KIT ROW, and not by taste: 📏 measured on 2026-09-23, `controlRow` builds «a label, a hint and ONE
   * control» and this row carries TWO — the volume and the on/off of the same category. Same reason the visual
   * panel's four paper-colour row stayed hand-built: inventing a shape for it would be giving a second answer to
   * the question «what is a row».
   */
  function buildCatRow(kit: PanelShellCtx, k: string): HTMLElement {
    const row = kit.create('div');
    row.className = 'ctrl-row';
    const text = kit.create('span');
    text.appendChild(kit.create('strong'));
    row.appendChild(text);
    const box = kit.create('span');
    box.style.cssText = 'display:flex;gap:.5rem;align-items:center;flex-shrink:0';
    const vol = kit.create('input');
    vol.className = 'vol';
    vol.setAttribute('type', 'range');
    vol.setAttribute('min', '0');
    vol.setAttribute('max', '100');
    vol.setAttribute('step', '5');
    vol.setAttribute('data-avol', k);
    box.appendChild(vol);
    const toggle = kit.create('button');
    toggle.className = 'mode-btn switch';
    toggle.setAttribute('type', 'button');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('data-acat', k);
    box.appendChild(toggle);
    row.appendChild(box);
    return row;
  }

  /** Creates what is missing IN THE RIGHT POSITION, rewrites the words of what stayed, removes what is no longer asked for. */
  function mountCatRows(list: HTMLElement, keys: readonly string[]): void {
    const kit = kitCtx(list);
    let previous: HTMLElement | null = null;
    // ⚠️ WHAT SURVIVES IS WHAT THE HOST STILL NAMES, not simply what is in `keys`. A row whose category lost its
    // name would otherwise stay on screen with the old label — asked for by the key list, offered by nobody.
    const named = new Set<string>();
    for (const k of keys) {
      const c = ctx.audioCats.find((x) => x.k === k);
      if (!c) continue; // a category this host does not name: what has no name is not offered
      named.add(k);
      let row = list.querySelector<HTMLElement>(`[data-acat="${k}"]`)?.closest<HTMLElement>('.ctrl-row') ?? null;
      if (!row) {
        row = buildCatRow(kit, k);
        // ⚠️ INSERTED in place, never appended and reordered: a node that changes parent is removed and put back,
        // and the browser blurs it on removal — that would take the cursor from whoever is setting the volume.
        list.insertBefore(row, previous ? previous.nextSibling : list.firstChild);
      }
      const label = t(c.lbl);
      const strong = row.querySelector<HTMLElement>('strong');
      if (strong) strong.textContent = label;
      row.querySelector(`[data-avol="${k}"]`)?.setAttribute('aria-label', t('audio.cat.volumeDe', { c: label }));
      row.querySelector(`[data-acat="${k}"]`)?.setAttribute('aria-label', label);
      previous = row;
    }
    for (const b of [...list.querySelectorAll<HTMLElement>('[data-acat]')]) {
      if (!named.has(b.dataset.acat ?? '')) b.closest('.ctrl-row')?.remove();
    }
  }

  /** The STATE of each row — the volume where it is and the toggle saying what it says. */
  function reflectCatRows(list: HTMLElement, keys: readonly string[]): void {
    const state = ctx.getAudioCat();
    if (!state) return;
    for (const k of keys) {
      const a = state[k];
      if (!a) continue;
      const vol = list.querySelector<HTMLInputElement>(`input[data-avol="${k}"]`);
      if (vol) vol.value = String(volPercent(a.vol));
      const toggle = list.querySelector<HTMLElement>(`button[data-acat="${k}"]`);
      if (toggle) { toggle.classList.toggle('is-on', a.on); toggle.setAttribute('aria-pressed', String(a.on)); }
    }
  }

  /** The listeners, ONCE per list and by delegation — rows come and go, the list stays. */
  function wireCatControls(el: HTMLElement): void {
    if (el.dataset.catsWired) return;
    el.dataset.catsWired = '1';
    el.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement | null)?.closest<HTMLElement>('button[data-acat]');
      const k = b?.dataset.acat;
      if (!b || !k) return;
      const state = ctx.getAudioCat(); if (!state || !state[k]) return;
      state[k].on = !state[k].on;
      ctx.setCatGain(k);
      b.classList.toggle('is-on', state[k].on);
      b.setAttribute('aria-pressed', String(state[k].on));
      refreshMarks(); // the mark follows the CHANGE, not only the redraw — see the note in refreshMarks
    });
    el.addEventListener('input', (ev) => {
      const s = (ev.target as HTMLElement | null)?.closest<HTMLInputElement>('input[data-avol]');
      const k = s?.dataset.avol;
      if (!s || !k) return;
      const state = ctx.getAudioCat(); if (!state || !state[k]) return;
      state[k].vol = (+s.value) / 100;
      state[k].on = true;
      ctx.setCatGain(k);
      const bb = el.querySelector<HTMLButtonElement>('button[data-acat="' + k + '"]');
      if (bb) { bb.classList.add('is-on'); bb.setAttribute('aria-pressed', 'true'); }
      refreshMarks();
    });
  }

  function renderCategoryList(sel: string, keys: readonly string[]): void {
    const el = ctx.$<HTMLElement>(sel);
    const state = ctx.getAudioCat();
    if (!el || !state) return;
    mountCatRows(el, keys);
    reflectCatRows(el, keys);
    wireCatControls(el);
    // The prose goes back to the footer after the rows change (CLAUDE.md §4, #109) — in the card of WHOEVER holds
    // this list: since ADR-0151 there are two panels, and the other one's footer is not this child's.
    ctx.fillExplain?.(el.closest<HTMLElement>('.overlay__card'));
  }

  function renderNavSound(): void {
    renderCategoryList('#navsound-list', NAV_CATS);
    const m = ctx.$<HTMLInputElement>('#navsound-master');
    const state = ctx.getAudioCat();
    if (m && state) m.value = String(navMasterVolume(state, NAV_CATS));
  }

  // 📌 Both questions are the HOST's (ADR-0227), and they stay TWO because they produce different sentences: the browser
  // cannot do it, and there is no device at all, are not the same news to someone looking for their headphones.
  const hasEnumerateDevices = (): boolean => ctx.audioOutputs.canList();
  const hasAudioContextCtor = (): boolean => ctx.audioOutputs.canRoute();

  function renderSinks(devices: readonly MediaDeviceInfo[]): void {
    const el = ctx.$<HTMLElement>('#audio-sinks');
    if (!el) return;
    // 📌 The document comes from the list node, never from the global one — same shape as the rest of this file
    // since the conversion to nodes, and it is what removes the reach to `document` without asking the contract
    // for a new field (ADR-0221 step 7d).
    const make = makerFor(el);
    while (el.firstChild) el.removeChild(el.firstChild);
    if (!devices.length) {
      const supported = sinksSupported(hasEnumerateDevices(), hasAudioContextCtor());
      // ⚠️ TWO SENTENCES, not one: «this browser CANNOT do it» and «there is no device yet» are different things to
      // a child who is looking for their own headphones, and the dictionary has always had both.
      const hint = make('p');
      hint.className = 'opt-hint';
      hint.textContent = t(supported ? 'audio.sinksHint' : 'audio.sinksUnsupported');
      el.appendChild(hint);
      return;
    }
    const players = ctx.getPlayers();
    const n = Math.max(1, ctx.getNumPlayers());
    for (let i = 0; i < n; i++) {
      const p = players[i];
      const row = make('div'); row.className = 'ctrl-row';
      const lbl = make('label'); lbl.textContent = t('audio.playerN', { n: i + 1 }); lbl.htmlFor = 'sink-p' + i;
      const sel = make('select'); sel.className = 'vol'; sel.id = 'sink-p' + i;
      const o0 = make('option'); o0.value = ''; o0.textContent = t('audio.sinkShared'); sel.appendChild(o0);
      devices.forEach((d, k) => {
        const o = make('option'); o.value = d.deviceId; o.textContent = sinkOptionLabel(t, d, k); sel.appendChild(o);
      });
      sel.value = sinkSelectValue(p);
      sel.addEventListener('change', () => {
        if (!p) return;
        p.audioSink = sel.value || null;
        ctx.store.set('incl_sink_p' + i, p.audioSink || '');
        if (p._ac) { try { p._ac.close(); } catch (e) { /* noop */ } p._ac = null; p._acOut = null; }
        ctx.srSay(t(p.audioSink ? 'sr.audio.sinkChanged' : 'sr.audio.sinkDefault', { n: i + 1 }));
      });
      row.appendChild(lbl); row.appendChild(sel); el.appendChild(row);
    }
  }

  async function enumerateSinks(): Promise<void> {
    // without asking permission: only the outputs already known
    try { audioDevices = [...await ctx.audioOutputs.list()]; } catch (e) { /* the port refused; the list stays as it is */ }
    renderSinks(audioDevices);
  }

  async function detectAudioDevices(): Promise<void> {
    // ⚠️ THE LIST EMPTIES when detection fails, and `enumerateSinks` above does NOT empty it: there an error means "I
    // could not ask", here it means "the child asked and the answer is none". The two sentences the panel draws next are
    // different, and so are the two `catch`es.
    try { audioDevices = [...await ctx.audioOutputs.detect()]; } catch (e) { audioDevices = []; }
    renderSinks(audioDevices);
  }

  function drawBlindMode(): void {
    const b = ctx.$<HTMLButtonElement>('#opt-modocego');
    if (b) { ctx.toggleBtn(b, ctx.getBlindMode()); b.textContent = toggleLabel(t, ctx.getBlindMode()); }
  }

  function renderAudio(): void {
    reflectMaster();
    renderCategoryList('#audio-list', GEN_CATS);
    renderNavSound();
    drawBlindMode();
    voice.render();
    const cd = ctx.$<HTMLSelectElement>('#cane-div');
    if (cd) cd.value = String(ctx.getCaneBlockDiv());
    void enumerateSinks(); // not awaited: fire and carry on (the asynchronous list updates by itself)
    refreshMarks();
  }

  /**
   * The left-the-default mark (ADR-0029).
   *
   * Called from inside the change HANDLERS, not only from `renderAudio()`: changing a category updates that row by
   * itself, without redrawing the panel, so a mark hung only on render goes stale on screen — ADR-0029 warns about it.
   * The rule: the mark travels with whoever WRITES the value, never with whoever draws.
   *
   * The cut is the SAME as this menu's reset, and that is the rule, not thrift: only what has a default in
   * DEFAULTS/`defaultAudioCat` can be marked. The voice engine and the per-player audio output have none, because they
   * are a DEVICE choice and not a restorable preference; marking them would mean inventing a second opinion on what a
   * headset's "default" is.
   */
  function refreshMarks(): void {
    const state = ctx.getAudioCat();
    const didChange: boolean[] = [];
    const mark = (sel: string, changed: boolean): void => {
      didChange.push(changed);
      markChanged(t, ctx.$<HTMLElement>(sel)?.closest<HTMLElement>('.ctrl-row') ?? null, changed);
    };
    mark('#opt-modocego', ctx.getBlindMode() !== DEFAULTS.blindMode);
    mark('#cane-div', ctx.getCaneBlockDiv() !== DEFAULTS.caneBlockDiv);
    // ⚠️ TWO MENU MARKS, one per panel: the audio panel's lit by a changed sonar would send the child searching the
    // wrong panel.
    const fromSound: boolean[] = [];
    for (const c of ctx.audioCats) {
      const d = defaultAudioCat(c.k);
      const a = state?.[c.k];
      const changedHere = !!a && (a.on !== d.on || a.vol !== d.vol);
      if ((GEN_CATS as readonly string[]).includes(c.k)) {
        fromSound.push(changedHere);
        markChanged(t, ctx.$<HTMLElement>(`[data-acat="${c.k}"]`)?.closest<HTMLElement>('.ctrl-row') ?? null, changedHere);
      } else mark(`[data-acat="${c.k}"]`, changedHere);
    }
    markMenuChanged(t, ctx.$<HTMLElement>('[data-act="audio"]'), didChange);
    markMenuChanged(t, ctx.$<HTMLElement>('[data-act="som"]'), fromSound);
  }

  // ----- static widgets (always present in #audio; wired ONCE, never recreated by renderAudio) -----

  const audioMasterBtn = ctx.$<HTMLButtonElement>('#audio-master');
  if (audioMasterBtn) audioMasterBtn.addEventListener('click', () => {
    const next = !ctx.getSoundOn();
    ctx.setSoundOn(next);
    reflectMaster();
    ctx.srSay(t(next ? 'sr.audio.soundOn' : 'sr.audio.soundOff'));
  });
  const audioMasterVol = ctx.$<HTMLInputElement>('#audio-master-vol');
  if (audioMasterVol) audioMasterVol.addEventListener('input', () => {
    const v = (+audioMasterVol.value) / 100;
    ctx.setVolume(v);
    if (v > 0 && !ctx.getSoundOn()) { ctx.setSoundOn(true); reflectMaster(); }
  });

  const navMasterEl = ctx.$<HTMLInputElement>('#navsound-master');
  if (navMasterEl) navMasterEl.addEventListener('input', () => {
    const v = (+navMasterEl.value) / 100;
    const state = ctx.getAudioCat();
    if (state) NAV_CATS.forEach((k) => { state[k].vol = v; state[k].on = true; ctx.setCatGain(k); });
    renderNavSound();
  });

  /*
   * ⚠️ THIS BUTTON ANNOUNCES, like its siblings (sound, TTS, cane spacing, menu index, audio output): with the engine's
   * default setter (`setBlindModeValue`, which stores/persists/notifies and does NOT speak), a game that does not inject
   * its own setter would otherwise get a mute button. A toggle that changes state without saying so is invisible to a
   * screen-reader user.
   *
   * The announcement belongs to WHOEVER IS ACTIVATED, not to the setter: `core/state` says a setter does three things
   * and only three. ⚠️ Lockstep consequence, written so it is not discovered later: a cartridge whose own `setBlindMode`
   * also speaks must drop that, or the child hears the state twice.
   */
  const mcBtn = ctx.$<HTMLButtonElement>('#opt-modocego');
  if (mcBtn) {
    mcBtn.addEventListener('click', () => {
      writeBlindMode(!ctx.getBlindMode());
      drawBlindMode();
      ctx.srSay(t(ctx.getBlindMode() ? 'sr.blind.on' : 'sr.blind.off'));
    });
  }

  const caneDivSel = ctx.$<HTMLSelectElement>('#cane-div');
  if (caneDivSel) {
    caneDivSel.value = String(ctx.getCaneBlockDiv());
    caneDivSel.addEventListener('change', () => {
      const div = parseCaneDiv(caneDivSel.value);
      ctx.setCaneBlockDiv(div);
      ctx.srSay(caneDivMessage(t, div));
    });
  }

  //
  // The hard rule is scope: this button restores what the HEARING menu contains and nothing else. A reset that reached
  // beyond itself would be worse than the trap it exists to undo — a child who undoes a sound setting and loses the
  // mobility setup along with it can no longer play, and does not understand why.
  //
  // What belongs to this menu: blind mode, the cane spacing and the mixer categories that are not the audio panel's.
  // The voice engine and the per-player audio output do NOT — they are a device choice, not a restorable preference,
  // and clearing them would take away the child's own headset in a shared room.
  /** Resets the categories in `keys` (those that exist in the mixer) to their factory state. */
  function resetCategories(keys: readonly string[]): void {
    const state = ctx.getAudioCat();
    if (!state) return;
    for (const k of keys) {
      if (!state[k]) continue;
      const d = defaultAudioCat(k);
      state[k]!.on = d.on; state[k]!.vol = d.vol;
      ctx.setCatGain(k);
    }
  }
  const resetBtn = ctx.$<HTMLButtonElement>('#audio-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    writeBlindMode(DEFAULTS.blindMode);
    ctx.setCaneBlockDiv(DEFAULTS.caneBlockDiv);
    // 🔴 THIS MENU DOES NOT HOLD THE MUSIC (ADR-0151): resetting it here would reach beyond itself — the scope rule,
    // above. Everything that is not a taste category belongs to this panel.
    resetCategories(ctx.audioCats.map((c) => c.k).filter((k) => !(GEN_CATS as readonly string[]).includes(k)));
    renderAudio(); drawBlindMode();
    ctx.srSay(t('sr.audio.reset'));
  });
  // The AUDIO panel's reset: the taste categories and nothing else.
  const soundReset = ctx.$<HTMLButtonElement>('#som-reset');
  if (soundReset) soundReset.addEventListener('click', () => {
    resetCategories(GEN_CATS);
    renderAudio();
    ctx.srSay(t('sr.audio.reset'));
  });

  const audioDetectBtn = ctx.$<HTMLButtonElement>('#audio-detect');
  if (audioDetectBtn) audioDetectBtn.addEventListener('click', () => { void detectAudioDevices(); });

  reflectMaster(); // initial state of the master button/slider, before the panel is ever opened

  /*
   * ⚠️ THE PANEL SUBSCRIBES TO THE EVENT — the decision `core/state` writes next to `setBlindModeValue`: a setter stores,
   * persists and notifies, and effects are reactions, subscribed by whoever reacts.
   *
   * Without it, a game that does NOT inject its own `setBlindMode` switches blind mode on through the bar's icon and this
   * panel's `#opt-modocego` keeps saying off, with `aria-pressed=false` — the control lying about the state to the screen
   * reader.
   *
   * ⚠️ It is safe for whoever ALREADY reflects from their own setter: reflecting is idempotent — it rereads the state and
   * rewrites the button. A duplicated announcement would be another matter, which is why the subscription does NOT
   * announce: the bar's icon already speaks for itself.
   */
  ctx.on('blindMode', () => { drawBlindMode(); }); // through the root's door: released by its `dispose()`

  return { renderAudio, reflectBlindMode: drawBlindMode, reflectTts: voice.reflectTts };
}
