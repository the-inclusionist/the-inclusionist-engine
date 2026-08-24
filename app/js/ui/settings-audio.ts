// SPDX-License-Identifier: GPL-3.0-or-later
// ui/settings-audio — Audio panel (Estágio 4, #audio overlay): extracted from game.js's renderAudio()/
// renderAudioSinks()/catRowHTML/wireCatControls/renderNavSound/reflectAudioMaster + the TTS-panel functions that
// platform/tts.ts already documents as belonging here (reflectTTS/populateTTSEngines/populateTTSVoices). Pure
// logic (category markup, volume->percent, sink option/label, cane-div validation, pt-BR voice filtering) is
// separated from the thin DOM-touching render/wire functions. DI via initSettingsAudio(ctx): `$`, `srSay`,
// `store` (narrow get/set), the live sound/mixer primitives from platform/audio.ts (getSoundOn/setSoundOn/
// getVolume/setVolume/getAudioCat/setCatGain), the injected `tts` panel API (platform/tts.ts), and the SHARED
// game.js helpers other panels also use (`toggleBtn`, `getNumPlayers`/`getPlayers`) or that live outside audio
// entirely (`getModoCego`/`setModoCego`, `getCaneBlockDiv`/`setCaneBlockDiv` — core collision state; the widgets
// live in this overlay, the state does not). Overlay open/close plumbing (#audio hidden toggle, frontOverlay,
// focus management, Escape, `ensureAC()`) is the shared infra every settings panel uses and stays in game.js,
// which calls `renderAudio()` from its `openAudio()`. `reflectModoCego`/`reflectTts` are also exported because
// game.js's own `setModoCego()` and the pause-menu icon bar (`iconAct('tts'|'blind', …)`) call them directly.

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
import { t, bcp47 } from '../core/i18n.js';
import type { PlayerView } from '../core/entity.js';

export type DomQuery = <T extends Element = Element>(sel: string) => T | null;

/** Minimal platform/storage.ts shape this module needs (get/set only — no direct localStorage access). */
export interface AudioStore {
  get(key: string, fallback?: string | null): string | null;
  set(key: string, value: string | number | boolean): boolean;
}

export interface AudioCatDef { k: string; lbl: string; }
export interface AudioCatState { on: boolean; vol: number; }

export interface TtsPanelEngine { id: string; speak: (text: string) => void; }
/** Minimal shape of the injected `tts` (platform/tts.ts's createTts() instance) this panel drives. */
export interface TtsPanel {
  getEngineSel: () => string;
  setEngineSel: (v: string) => void;
  getEngine: () => TtsPanelEngine | null;
  getVoiceObj: () => SpeechSynthesisVoice | null;
  setVoiceObj: (v: SpeechSynthesisVoice | null) => void;
  loadTTS: () => void;
  narrate: (text: string) => void;
}

/** Saída de áudio dedicada de um jogador: o id do dispositivo e o AudioContext/ganho que ele abriu. */
export type SinkPlayer = PlayerView<'audioSink' | '_ac' | '_acOut'>;

export interface SettingsAudioCtx {
  /** DOM selector (querySelector), injected — never reaches `document` globally. */
  $: DomQuery;
  /** Screen-reader "polite" announcement (core/a11y-sr's srSay), injected. */
  srSay: (msg: string) => void;
  /** Persistence (platform/storage.ts) — only the TTS engine/voice choice and the per-player audio sink live
   *  here; the mixer categories persist through `setCatGain` (platform/audio.ts already saves them). */
  store: AudioStore;
  /** Category catalog (platform/audio-mixer.ts's AUDIO_CATS) — pure data, injected like game.js's own import. */
  audioCats: readonly AudioCatDef[];
  /** Shared helper (game.js): toggles a button's .is-on/aria-pressed. Used by many other panels too — not ours. */
  toggleBtn: (b: HTMLElement, on: boolean) => void;
  /** Shared: current player count (core/state.ts's numPlayers, read live via game.js). */
  getNumPlayers: () => number;
  /** Shared: the live players array (core/state.ts) — only `.audioSink`/`._ac`/`._acOut` are touched here. */
  getPlayers: () => SinkPlayer[];
  /** Master mute (platform/audio.ts's soundOn), read/write live via game.js's re-export. */
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
  /** Core collision state (NOT owned by this panel — core/collision.ts reads it via isModoCego). The toggle's
   *  widget lives inside #audio; the state and its gameplay side effects (setupExtras) stay in game.js. */
  getModoCego: () => boolean;
  setModoCego: (on: boolean) => void;
  /** Core collision state (cane hit spacing). Same reasoning as modo cego. */
  getCaneBlockDiv: () => number;
  setCaneBlockDiv: (div: number) => void;
}

export interface SettingsAudioApi {
  /** Re-renders the whole #audio overlay content (master, categories, nav-sound, TTS panel, sinks, modo-cego and
   *  cane-div sync) and re-wires whatever it (re)creates. Idempotent; game.js's openAudio() calls it every open. */
  renderAudio: () => void;
  /** Refreshes the #opt-modocego button. Exported because game.js's setModoCego() calls it directly. */
  reflectModoCego: () => void;
  /** Refreshes the #opt-tts button + #tts-engine selection. Exported because the pause-menu icon bar's
   *  iconAct('tts', …) toggles audioCat.tts.on itself and then calls this. */
  reflectTts: () => void;
}

// ---------------------------------------------------------------------------------------------
// Pure logic (no `document`, testable in node)
// ---------------------------------------------------------------------------------------------

/** Categorias de NAVEGAÇÃO SONORA (bengala/sonar/guarda/guia) — volume geral separado do som do jogo. */
export const NAV_CATS = ['sonar', 'guard', 'guide'] as const;
/** Categorias GERAIS do jogo (TTS fica na seção Voz, fora desta lista). */
export const GEN_CATS = ['music', 'ambient', 'interact', 'earcons', 'other'] as const;

/** 0..1 -> 0..100 rounded (slider display value). */
export function volPercent(v: number): number {
  return Math.round(v * 100);
}

/** One category row's markup (volume slider + on/off switch). Pure — resolves label/state from the given data,
 *  never from a global. Returns '' for an unknown/missing category (defensive; never hit with real catalogs). */
export function catRowHTML(k: string, cats: readonly AudioCatDef[], state: Readonly<Record<string, AudioCatState>>): string {
  const c = cats.find((x) => x.k === k);
  const a = state[k];
  if (!c || !a) return '';
  return `<div class="ctrl-row"><span>${c.lbl}</span><span style="display:flex;gap:.5rem;align-items:center;flex-shrink:0">` +
    `<input class="vol" type="range" min="0" max="100" step="5" value="${volPercent(a.vol)}" data-avol="${k}" aria-label="Volume de ${c.lbl}">` +
    `<button class="mode-btn switch${a.on ? ' is-on' : ''}" data-acat="${k}" type="button" aria-pressed="${a.on}" aria-label="${c.lbl}"></button></span></div>`;
}

/** Full innerHTML for a category list (#audio-list or #navsound-list). Pure string building — no DOM. */
export function catsListHTML(keys: readonly string[], cats: readonly AudioCatDef[], state: Readonly<Record<string, AudioCatState>>): string {
  return keys.map((k) => catRowHTML(k, cats, state)).join('');
}

/** #navsound-master's value: the loudest of the nav categories, as a 0..100 slider value. */
export function navMasterVolume(state: Readonly<Record<string, AudioCatState>>, navCats: readonly string[] = NAV_CATS): number {
  return volPercent(Math.max(...navCats.map((k) => state[k].vol)));
}

/** Cane-hit spacing select -> validated int (garbage/empty -> 1, "a batida por bloco"). */
export function parseCaneDiv(raw: string): number {
  return (+raw) || 1;
}

/** srSay text for a cane-hit spacing choice. The two halves are ONE sentence per case, not a shared prefix
 *  plus a tail: a language that renders this as "One tap per block (cane)" needs to move the word "cane". */
export function caneDivMessage(div: number): string {
  return t(div === 2 ? 'sr.audio.caneHalfBlock' : 'sr.audio.canePerBlock');
}

/** #tts-engine's option catalog: (value, i18n KEY of the label). The engine NAMES are proper nouns and stay
 *  put; what translates is the parenthetical that explains each one. Keys, not text — see input/devices. */
export const TTS_ENGINE_OPTIONS: readonly (readonly [string, string])[] = [
  ['webspeech', 'tts.engine.webspeech'],
  ['piper', 'tts.engine.piper'],
  ['kokoro', 'tts.engine.kokoro'],
  ['kitten', 'tts.engine.kitten'],
  ['espeak', 'tts.engine.espeak'],
];

export interface VoiceLike { name: string; lang: string; }

/**
 * As vozes do sistema no idioma pedido; sem nenhuma, a lista inteira.
 *
 * Chamava-se `pickPtVoices` e filtrava `/^pt/i` fixo, de modo que o jogo em inglês oferecia à pessoa uma
 * lista de vozes PORTUGUESAS para ler texto em inglês. O nome dizia a verdade sobre o que fazia e mentia
 * sobre o que devia fazer.
 *
 * A comparação é pelo PREFIXO de idioma, não pela etiqueta inteira: quem joga em pt-BR também deve poder
 * escolher uma voz pt-PT se for a única instalada, e o navegador de uma escola raramente tem a variante
 * exata. O recuo para a lista inteira fica: uma lista vazia seria pior que uma lista no idioma errado, que
 * ao menos a pessoa pode ouvir e rejeitar.
 */
export function pickVoicesFor<T extends VoiceLike>(voices: readonly T[], lang: string): readonly T[] {
  const pref = lang.slice(0, 2).toLowerCase();
  const iguais = voices.filter((v) => v.lang.slice(0, 2).toLowerCase() === pref);
  return iguais.length ? iguais : voices;
}

/** "<name> (<lang>)" option label. */
export function voiceLabel(v: VoiceLike): string {
  return v.name + ' (' + v.lang + ')';
}

/** Whether the browser can list/switch audio outputs at all (gates the #audio-sinks hint copy). */
export function sinksSupported(hasEnumerateDevices: boolean, hasAudioContextCtor: boolean): boolean {
  return hasEnumerateDevices && hasAudioContextCtor;
}

export interface SinkDeviceLike { deviceId: string; label?: string; }

/** A device's option label, falling back to a 1-based "Saída N" when the browser withholds the real label
 *  (no getUserMedia permission granted yet). */
export function sinkOptionLabel(d: SinkDeviceLike, index: number): string {
  return d.label || t('audio.sinkFallback', { n: index + 1 });
}

/** A player's current sink select value ('' = default/shared). */
export function sinkSelectValue(p: { audioSink?: string | null } | undefined): string {
  return (p && p.audioSink) || '';
}

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

export function initSettingsAudio(ctx: SettingsAudioCtx): SettingsAudioApi {
  let audioDevices: MediaDeviceInfo[] = [];

  function reflectMaster(): void {
    const b = ctx.$<HTMLButtonElement>('#audio-master');
    if (b) {
      b.classList.toggle('is-on', ctx.getSoundOn());
      b.setAttribute('aria-pressed', String(ctx.getSoundOn()));
      b.textContent = ctx.getSoundOn() ? '🔊 Ligado' : '🔇 Desligado';
    }
    const v = ctx.$<HTMLInputElement>('#audio-master-vol');
    if (v) v.value = String(volPercent(ctx.getVolume()));
    const sb = ctx.$<HTMLElement>('#opt-sound');
    if (sb) ctx.toggleBtn(sb, ctx.getSoundOn());
  }

  function wireCatControls(el: HTMLElement): void {
    el.querySelectorAll<HTMLButtonElement>('button[data-acat]').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.dataset.acat; if (!k) return;
        const state = ctx.getAudioCat(); if (!state || !state[k]) return;
        state[k].on = !state[k].on;
        ctx.setCatGain(k);
        b.classList.toggle('is-on', state[k].on);
        b.setAttribute('aria-pressed', String(state[k].on));
      });
    });
    el.querySelectorAll<HTMLInputElement>('input[data-avol]').forEach((s) => {
      s.addEventListener('input', () => {
        const k = s.dataset.avol; if (!k) return;
        const state = ctx.getAudioCat(); if (!state || !state[k]) return;
        state[k].vol = (+s.value) / 100;
        state[k].on = true;
        ctx.setCatGain(k);
        const bb = el.querySelector<HTMLButtonElement>('button[data-acat="' + k + '"]');
        if (bb) { bb.classList.add('is-on'); bb.setAttribute('aria-pressed', 'true'); }
      });
    });
  }

  function renderCategoryList(sel: string, keys: readonly string[]): void {
    const el = ctx.$<HTMLElement>(sel);
    const state = ctx.getAudioCat();
    if (!el || !state) return;
    el.innerHTML = catsListHTML(keys, ctx.audioCats, state);
    wireCatControls(el);
  }

  function renderNavSound(): void {
    renderCategoryList('#navsound-list', NAV_CATS);
    const m = ctx.$<HTMLInputElement>('#navsound-master');
    const state = ctx.getAudioCat();
    if (m && state) m.value = String(navMasterVolume(state, NAV_CATS));
  }

  function reflectTts(): void {
    const b = ctx.$<HTMLButtonElement>('#opt-tts');
    const state = ctx.getAudioCat();
    const on = !!(state && state.tts && state.tts.on);
    if (b) { ctx.toggleBtn(b, on); b.textContent = on ? '❚❚ Ligado' : '▶ Desligado'; }
    const e = ctx.$<HTMLSelectElement>('#tts-engine');
    if (e) e.value = ctx.tts.getEngineSel();
  }

  function populateTtsEngines(): void {
    const sel = ctx.$<HTMLSelectElement>('#tts-engine');
    if (!sel || sel.dataset.filled) return;
    sel.dataset.filled = '1';
    TTS_ENGINE_OPTIONS.forEach(([v, l]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = t(l); sel.appendChild(o);
    });
    sel.value = ctx.tts.getEngineSel();
  }

  function populateTtsVoices(): void {
    const sel = ctx.$<HTMLSelectElement>('#tts-voice');
    if (!sel) return;
    let voices: SpeechSynthesisVoice[] = [];
    try { voices = (window.speechSynthesis && window.speechSynthesis.getVoices()) || []; } catch (e) { /* noop */ }
    const list = pickVoicesFor(voices, bcp47());
    sel.innerHTML = '';
    if (!list.length) {
      const o = document.createElement('option'); o.textContent = t('audio.noSystemVoices'); sel.appendChild(o);
      ctx.tts.setVoiceObj(null);
      return;
    }
    list.forEach((v) => {
      const o = document.createElement('option'); o.value = v.name; o.textContent = voiceLabel(v); sel.appendChild(o);
    });
    const saved = ctx.store.get('incl_tts_voice', null);
    const pick = list.find((v) => v.name === saved) || list[0];
    sel.value = pick.name;
    ctx.tts.setVoiceObj(pick);
  }

  function hasEnumerateDevices(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices);
  }
  function hasAudioContextCtor(): boolean {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    return typeof (w.AudioContext || w.webkitAudioContext) !== 'undefined';
  }

  function renderSinks(devices: readonly MediaDeviceInfo[]): void {
    const el = ctx.$<HTMLElement>('#audio-sinks');
    if (!el) return;
    el.innerHTML = '';
    if (!devices.length) {
      const supported = sinksSupported(hasEnumerateDevices(), hasAudioContextCtor());
      el.innerHTML = '<p class="opt-hint">' +
        t(supported ? 'audio.sinksHint' : 'audio.sinksUnsupported') +
        '</p>';
      return;
    }
    const players = ctx.getPlayers();
    const n = Math.max(1, ctx.getNumPlayers());
    for (let i = 0; i < n; i++) {
      const p = players[i];
      const row = document.createElement('div'); row.className = 'ctrl-row';
      const lbl = document.createElement('label'); lbl.textContent = t('audio.playerN', { n: i + 1 }); lbl.setAttribute('for', 'sink-p' + i);
      const sel = document.createElement('select'); sel.className = 'vol'; sel.id = 'sink-p' + i;
      const o0 = document.createElement('option'); o0.value = ''; o0.textContent = t('audio.sinkShared'); sel.appendChild(o0);
      devices.forEach((d, k) => {
        const o = document.createElement('option'); o.value = d.deviceId; o.textContent = sinkOptionLabel(d, k); sel.appendChild(o);
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
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devs = await navigator.mediaDevices.enumerateDevices();
        audioDevices = devs.filter((d) => d.kind === 'audiooutput');
      }
    } catch (e) { /* sem pedir permissão: só lista as saídas já conhecidas */ }
    renderSinks(audioDevices);
  }

  async function detectAudioDevices(): Promise<void> {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => {});
      const devs = await navigator.mediaDevices.enumerateDevices();
      audioDevices = devs.filter((d) => d.kind === 'audiooutput');
    } catch (e) { audioDevices = []; }
    renderSinks(audioDevices);
  }

  function reflectModoCego(): void {
    const b = ctx.$<HTMLButtonElement>('#opt-modocego');
    if (b) { ctx.toggleBtn(b, ctx.getModoCego()); b.textContent = ctx.getModoCego() ? '❚❚ Ligado' : '▶ Desligado'; }
  }

  function renderAudio(): void {
    reflectMaster();
    renderCategoryList('#audio-list', GEN_CATS);
    renderNavSound();
    reflectModoCego();
    reflectTts();
    populateTtsEngines();
    populateTtsVoices();
    const cd = ctx.$<HTMLSelectElement>('#cane-div');
    if (cd) cd.value = String(ctx.getCaneBlockDiv());
    void enumerateSinks(); // sem await no original: dispara e segue (lista assíncrona atualiza sozinha)
  }

  // ----- widgets estáticos (existem sempre no #audio; fiados UMA vez, nunca recriados por renderAudio) -----

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

  const mcBtn = ctx.$<HTMLButtonElement>('#opt-modocego');
  if (mcBtn) mcBtn.addEventListener('click', () => { ctx.setModoCego(!ctx.getModoCego()); reflectModoCego(); });

  const caneDivSel = ctx.$<HTMLSelectElement>('#cane-div');
  if (caneDivSel) {
    caneDivSel.value = String(ctx.getCaneBlockDiv());
    caneDivSel.addEventListener('change', () => {
      const div = parseCaneDiv(caneDivSel.value);
      ctx.setCaneBlockDiv(div);
      ctx.srSay(caneDivMessage(div));
    });
  }

  const ttsBtn = ctx.$<HTMLButtonElement>('#opt-tts');
  if (ttsBtn) ttsBtn.addEventListener('click', () => {
    const state = ctx.getAudioCat(); if (!state) return;
    state.tts.on = !state.tts.on;
    ctx.setCatGain('tts');
    reflectTts();
    ctx.srSay(t(state.tts.on ? 'sr.audio.ttsOn' : 'sr.audio.ttsOff'));
    if (state.tts.on) ctx.tts.narrate(t('sr.audio.ttsOnSpoken'));
  });
  const ttsEngSel = ctx.$<HTMLSelectElement>('#tts-engine');
  if (ttsEngSel) ttsEngSel.addEventListener('change', () => {
    ctx.tts.setEngineSel(ttsEngSel.value);
    ctx.store.set('incl_tts_engine', ttsEngSel.value);
    if (ttsEngSel.value !== 'webspeech') ctx.tts.loadTTS();
    const opt = ttsEngSel.options[ttsEngSel.selectedIndex];
    ctx.tts.narrate(t('sr.audio.engineSet', { motor: opt ? opt.text : '' }));
  });
  const ttsVoiceSel = ctx.$<HTMLSelectElement>('#tts-voice');
  if (ttsVoiceSel) ttsVoiceSel.addEventListener('change', () => {
    try {
      const vs = window.speechSynthesis.getVoices();
      ctx.tts.setVoiceObj(vs.find((v) => v.name === ttsVoiceSel.value) || null);
      ctx.store.set('incl_tts_voice', ttsVoiceSel.value);
    } catch (e) { /* noop */ }
    ctx.tts.narrate(t('sr.audio.voicePicked'));
  });
  const ttsTestBtn = ctx.$<HTMLButtonElement>('#opt-tts-test');
  if (ttsTestBtn) ttsTestBtn.addEventListener('click', () => {
    const txt = t('audio.voiceSample');
    const engine = ctx.tts.getEngine();
    if (ctx.tts.getEngineSel() !== 'webspeech' && engine && engine.speak) {
      try { engine.speak(txt); } catch (e) { /* noop */ } // motor neural já carregado
    } else {
      try {
        const ss = window.speechSynthesis;
        if (ss) {
          ss.cancel();
          const u = new SpeechSynthesisUtterance(txt);
          u.lang = 'pt-BR';
          const vo = ctx.tts.getVoiceObj();
          if (vo) u.voice = vo;
          u.rate = 1; u.volume = 1;
          ss.speak(u);
        }
      } catch (e) { /* noop */ } // fallback audível (volume 1) + dispara download do neural
      if (ctx.tts.getEngineSel() !== 'webspeech') ctx.tts.loadTTS();
    }
    ctx.srSay(t('sr.audio.testingVoice'));
  });
  try { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = populateTtsVoices; } catch (e) { /* noop */ }

  const ttsVolEl = ctx.$<HTMLInputElement>('#tts-vol');
  if (ttsVolEl) ttsVolEl.addEventListener('input', () => {
    const state = ctx.getAudioCat(); if (!state) return;
    state.tts.vol = (+ttsVolEl.value) / 100;
    state.tts.on = true;
    ctx.setCatGain('tts');
    reflectTts();
  });

  const audioDetectBtn = ctx.$<HTMLButtonElement>('#audio-detect');
  if (audioDetectBtn) audioDetectBtn.addEventListener('click', () => { void detectAudioDevices(); });

  reflectMaster(); // estado inicial do botão/slider mestre, antes de qualquer abertura do painel

  return { renderAudio, reflectModoCego, reflectTts };
}
