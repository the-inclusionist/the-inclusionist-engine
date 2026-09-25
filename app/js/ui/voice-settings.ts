// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/voice-settings — THE VOICE SECTION of the hearing panel: the narration switch, the engine, the voice, the rate, the
// spoken index and the sample button (ADR-0221; issue #203).
//
// 🔴 WHY IT LEFT `ui/settings-audio`: that module was the third largest in the engine, and half of it was about SPEECH while
// the other half was about sound categories, the cane, blind mode and the audio outputs. The two halves never needed each
// other. What binds these seven pieces is one question — «what does the child hear when the engine talks, and what does she
// change to hear it differently».
//
// ⚠️ AND IT RECEIVES THE BROWSER INSTEAD OF REACHING IT, which the ratchet of ADR-0221 step 7d made compulsory rather than
// tasteful: a module born today that reaches a global is refused, because there the ceiling is ZERO and not a p90. So
// `document.createElement`, `speechSynthesis.getVoices`, the sample utterance and the `onvoiceschanged` subscription arrive
// as four ports. What that buys beyond the gate: the whole section can be exercised without a browser's speech engine.
//
// 📌 THE SPOKEN INDEX («6 of 10») LIVES HERE and not in a visual panel, by the decision of ADR-0044 item 3: it changes the
// NARRATION, and whoever turns it off is shortening what she hears at every step. She comes here when what she hears bothers
// her.

import { toggleLabel } from './dom.js';
import type { Translator } from '../core/i18n.js';
import { SPEECH_RATES } from '../core/speech-rate.js';
import type { DomQuery } from '../core/dom-query.js';
import {
  type AudioCatState, volPercent, voiceEngineOptions, pickVoicesFor, voiceLabel,
} from './audio-choices.js';

export interface TtsPanelEngine { id: string; speak: (text: string) => void; }

/** Minimal shape of the injected `tts` (platform/tts.ts's createTts() instance) this section drives. */
export interface TtsPanel {
  getEngineSel: () => string;
  setEngineSel: (v: string) => void;
  getEngine: () => TtsPanelEngine | null;
  getVoiceObj: () => SpeechSynthesisVoice | null;
  setVoiceObj: (v: SpeechSynthesisVoice | null) => void;
  loadTTS: () => void;
  narrate: (text: string) => void;
  /**
   * Does this assembly have a neural engine (the game's Kokoro port, ADR-0198)? Optional, absent reads `true`: a panel test
   * fake written before this field has no opinion on neural engines.
   */
  neuralAvailable?: boolean;
  /** The voices of the language (ADR-0185). Optional: a panel driven without them offers no «Voz» list and locks nothing. */
  voices?: () => readonly PanelVoice[];
  currentVoice?: () => PanelVoice | null;
  setVoice?: (id: string) => boolean;
}

/** A voice as this panel lists it: `webspeech:<name>` for the browser's, `xx_name` for Kokoro's. */
export interface PanelVoice { readonly voice: string; readonly engine?: string; readonly recommended?: boolean }

/**
 * The browser, as four functions.
 *
 * 🔴 A module that reaches `document` or `window` undoes a decision (ADR-0178), and the health ratchet refuses a NEW one that
 * does. These four are what the voice section actually needs from the browser, and naming them is what makes the section
 * testable: hand it a fake `doc`, a list of voices and two no-ops, and every branch below runs without a speech engine.
 */
export interface VoicePorts {
  /** Makes one <option> — the only element this section builds. A FUNCTION and not the document: a port read at wiring
   *  time would make a panel unmountable where there is no document yet, and the node suite mounts exactly there. */
  readonly newOption: () => HTMLOptionElement;
  /** The system voices, or an empty list where the browser has none or throws. */
  readonly systemVoices: () => readonly SpeechSynthesisVoice[];
  /** Speak the sample through the BROWSER's own synthesiser — the neural engine speaks through `tts` instead. */
  readonly speakSample: (text: string, chosen: SpeechSynthesisVoice | null) => void;
  /** Called again whenever the browser finishes loading its voice list: they arrive late, and often empty first.
   *  ⚠️ The parameter is gain and not un, which is a GAME ACTION word this layer does not say (the boundary of 2026-09-06). */
  readonly whenVoicesChange: (again: () => void) => void;
}

/**
 * What this section needs from the panel's ctx.
 *
 * ⚠️ The store shape is written here and NOT imported from `ui/settings-audio`, which declares the same two methods: that
 * module imports this one, and importing it back would be the cycle ADR-0173 forbids — for a type as much as for a value.
 */
/**
 * THE SETTINGS THIS SECTION READS AND WRITES — the page's settings store, built by the root (ADR-0232 D2c, issue #207): the
 * spoken index (ADR-0044 item 3) and the speech rate (ADR-0183). The names are `core/state`'s, so a root passes the store
 * itself; the reads are LIVE, because the quick bar and a second screen change them too.
 */
export interface VoiceSettingsStore {
  readonly menuIndexOn: boolean;
  setMenuIndexOnValue(on: boolean): void;
  readonly speechPpm: number;
  setSpeechPpmValue(ppm: number): void;
}

export interface VoiceSettingsCtx {
  /**
   * The root's translator (ADR-0232 D3): its `t`, and the page's language as a BCP-47 tag, which picks the system voices the
   * list offers. A Pick and not a bare `t`, because the voice list reads the language.
   */
  translator: Pick<Translator, 't' | 'bcp47'>;
  /** The page's settings store (see `VoiceSettingsStore`). REQUIRED: a section reading from nowhere would show the defaults. */
  settings: VoiceSettingsStore;
  $: DomQuery;
  srSay: (msg: string) => void;
  toggleBtn: (btn: HTMLElement, on: boolean) => void;
  store: {
    get(key: string, fallback?: string | null): string | null;
    set(key: string, value: string | number | boolean): boolean;
  };
  tts: TtsPanel;
  getAudioCat: () => Record<string, AudioCatState> | null;
  setCatGain: (k: string) => void;
}

export interface VoiceSettings {
  /** Everything the section shows, refreshed from the stored state. Called by the panel's own render. */
  render: () => void;
  /** Just the narration switch and the chosen engine. Exported because the quick bar's icon reflects it from outside. */
  reflectTts: () => void;
}

/** The name a child sees for a voice: the browser's name, or the name inside a Kokoro identifier — `pf_dora` is «Dora». */
function voiceName(v: PanelVoice): string {
  // a browser voice is named by the browser (ADR-0200); Kokoro ids read `xx_name` (`pf_dora`)
  // («Microsoft Maria - Portuguese (Brazil)» is «Microsoft Maria»: the language is already the list's, and no parentheses, ADR-0158)
  if (v.voice.startsWith('webspeech:')) return v.voice.slice('webspeech:'.length).replace(/\s*\([^)]*\)/g, '').split(' - ')[0]!.trim();
  const name = v.voice.split('_')[1] ?? v.voice;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * What the list SHOWS: Kokoro's two good voices, Heart and Bella, carry a heart (ADR-0198 §3). Only SHOWN: what is said is
 * the name alone (ADR-0159 rule 12, no glyph inside a spoken name).
 */
function panelVoiceLabel(v: PanelVoice): string {
  return (v.recommended ? '❤️ ' : '') + voiceName(v);
}

/** The rows a missing voice locks (ADR-0185 §4): narration, its volume and rate, the spoken index, and the voice. */
const SPEECH_ROWS: readonly string[] = ['#opt-tts', '#tts-vol', '#tts-ppm', '#opt-menuindex', '#tts-voz'];

export function createVoiceSettings(ctx: VoiceSettingsCtx, ports: VoicePorts): VoiceSettings {
  const { t, bcp47 } = ctx.translator;
  function reflectTts(): void {
    const b = ctx.$<HTMLButtonElement>('#opt-tts');
    const cat = ctx.getAudioCat();
    const on = !!(cat && cat.tts && cat.tts.on);
    if (b) { ctx.toggleBtn(b, on); b.textContent = toggleLabel(t, on); }
    const e = ctx.$<HTMLSelectElement>('#tts-engine');
    if (e) e.value = ctx.tts.getEngineSel();
  }

  function reflectMenuIndex(): void {
    const b = ctx.$<HTMLButtonElement>('#opt-menuindex');
    if (b) { ctx.toggleBtn(b, ctx.settings.menuIndexOn); b.textContent = toggleLabel(t, ctx.settings.menuIndexOn); }
  }

  function populateTtsEngines(): void {
    const sel = ctx.$<HTMLSelectElement>('#tts-engine');
    if (!sel || sel.dataset.filled) return;
    sel.dataset.filled = '1';
    voiceEngineOptions(ctx.tts.neuralAvailable !== false).forEach(([v, l]) => {
      const o = ports.newOption(); o.value = v; o.textContent = t(l); sel.appendChild(o);
    });
    sel.value = ctx.tts.getEngineSel();
  }

  function populateTtsVoices(): void {
    const sel = ctx.$<HTMLSelectElement>('#tts-voice');
    if (!sel) return;
    const list = pickVoicesFor(ports.systemVoices(), bcp47());
    sel.innerHTML = '';
    if (!list.length) {
      const o = ports.newOption(); o.textContent = t('audio.noSystemVoices'); sel.appendChild(o);
      ctx.tts.setVoiceObj(null);
      return;
    }
    list.forEach((v) => {
      const o = ports.newOption(); o.value = v.name; o.textContent = voiceLabel(v); sel.appendChild(o);
    });
    const saved = ctx.store.get('incl_tts_voice', null);
    const pick = list.find((v) => v.name === saved) || list[0]!;
    sel.value = pick.name;
    ctx.tts.setVoiceObj(pick);
  }

  const noVoice = (): boolean => !!ctx.tts.voices && ctx.tts.voices().length === 0;

  /** The speech rate list: each step «N PPM», the stored one selected (ADR-0183 §1, ADR-0196). */
  function renderRate(): void {
    const sel = ctx.$<HTMLSelectElement>('#tts-ppm');
    if (!sel) return;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    for (const ppm of SPEECH_RATES) {
      const o = ports.newOption(); o.value = String(ppm); o.textContent = t('visual.legenda.ppm', { n: ppm }); sel.appendChild(o);
    }
    sel.value = String(ctx.settings.speechPpm);
  }

  function renderVoiceList(): void {
    const sel = ctx.$<HTMLSelectElement>('#tts-voz');
    if (!sel || !ctx.tts.voices) return;
    const list = ctx.tts.voices();
    sel.replaceChildren(); // options built node by node: no markup sink
    if (!list.length) {
      const o = ports.newOption(); o.textContent = t('audio.voz.nenhuma'); sel.appendChild(o);
      return;
    }
    for (const v of list) {
      const o = ports.newOption(); o.value = v.voice; o.textContent = panelVoiceLabel(v); sel.appendChild(o);
    }
    sel.value = ctx.tts.currentVoice?.()?.voice ?? list[0]!.voice;
  }

  /**
   * No voice speaks the language (ADR-0185 §4): the five speech rows are LOCKED with the reason, never hidden (ADR-0161).
   * `aria-disabled` and not `disabled`, so the keyboard still reaches the row and hears why.
   */
  function lockSpeechRows(): void {
    const lock = noVoice();
    for (const id of SPEECH_ROWS) {
      const el = ctx.$<HTMLElement>(id);
      if (!el) continue;
      if (lock) { el.setAttribute('aria-disabled', 'true'); el.dataset.motivo = t('audio.semVoz'); }
      else { el.removeAttribute('aria-disabled'); delete el.dataset.motivo; }
    }
  }

  /*
   * A LOCKED SPEECH ROW DOES NOTHING AND SAYS WHY (ADR-0185 §4). In the CAPTURE phase on the control itself, so it runs
   * before the row's own listener and stops it; a moved range goes back to the stored volume, a changed list to the voice in
   * use. The footer shows the reason when the row takes focus: the card hears `focusin` after the row's own explanation.
   */
  /**
   * What a refused control puts back, by row: the moved volume to the stored one, the picked voice and rate to the ones in use.
   * A row not here has nothing to undo (a switch was never flipped). A table, as the other «which row does what» answers here.
   */
  const UNDO_ON_REFUSAL: Readonly<Record<string, (el: HTMLElement) => void>> = {
    '#tts-vol': (el) => { const cat = ctx.getAudioCat(); if (cat?.tts) (el as HTMLInputElement).value = String(volPercent(cat.tts.vol)); },
    '#tts-voz': () => renderVoiceList(),
    '#tts-ppm': () => renderRate(),
  };

  function refuseWhileLocked(): void {
    for (const id of SPEECH_ROWS) {
      const el = ctx.$<HTMLElement>(id);
      if (!el) continue;
      const refuse = (e: Event): void => {
        if (el.getAttribute('aria-disabled') !== 'true') return;
        e.stopImmediatePropagation();
        e.preventDefault();
        UNDO_ON_REFUSAL[id]?.(el);
        ctx.srSay(el.dataset.motivo ?? t('audio.semVoz'));
      };
      for (const kind of ['click', 'input', 'change']) el.addEventListener(kind, refuse, true);
      el.closest<HTMLElement>('.overlay__card')?.addEventListener('focusin', (e) => {
        if (e.target !== el || el.getAttribute('aria-disabled') !== 'true') return;
        const footer = el.closest<HTMLElement>('.overlay__card')?.querySelector<HTMLElement>('.opt-explain');
        if (footer) footer.textContent = el.dataset.motivo ?? '';
      });
    }
  }
  refuseWhileLocked();

  /**
   * THE SEVEN CONTROLS, wired where the page carries them: the voice list, the rate, the narration switch, the spoken
   * index, and the three the engine never builds but a page may (the engine selector, the system voice, the sample).
   * A page that lacks one simply has that row missing.
   */
  function wireControls(): void {
    const voiceSel = ctx.$<HTMLSelectElement>('#tts-voz');
    if (voiceSel) voiceSel.addEventListener('change', () => {
      if (!ctx.tts.setVoice?.(voiceSel.value)) { renderVoiceList(); return; }
      const v = ctx.tts.currentVoice?.();
      if (v) ctx.srSay(t('sr.audio.voz', { nome: voiceName(v) }));
    });

    const rateSel = ctx.$<HTMLSelectElement>('#tts-ppm');
    if (rateSel) rateSel.addEventListener('change', () => {
      ctx.settings.setSpeechPpmValue(Number(rateSel.value));
      renderRate();
      ctx.srSay(`${t('audio.ttsPpm')}: ${t('visual.legenda.ppm', { n: ctx.settings.speechPpm })}`);
    });

    const ttsBtn = ctx.$<HTMLButtonElement>('#opt-tts');
    if (ttsBtn) ttsBtn.addEventListener('click', () => {
      const cat = ctx.getAudioCat(); if (!cat) return;
      cat.tts.on = !cat.tts.on;
      ctx.setCatGain('tts');
      reflectTts();
      ctx.srSay(t(cat.tts.on ? 'sr.audio.ttsOn' : 'sr.audio.ttsOff'));
      if (cat.tts.on) ctx.tts.narrate(t('sr.audio.ttsOnSpoken'));
    });

    const idxBtn = ctx.$<HTMLButtonElement>('#opt-menuindex');
    if (idxBtn) idxBtn.addEventListener('click', () => {
      ctx.settings.setMenuIndexOnValue(!ctx.settings.menuIndexOn);
      reflectMenuIndex();
      // The announcement of the change carries NO index: it is not an item of any list, and a «1 of 1» here would be noise at
      // exactly the moment the child is judging whether the noise bothers her.
      ctx.srSay(t(ctx.settings.menuIndexOn ? 'sr.menu.indexOn' : 'sr.menu.indexOff'));
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
      ctx.tts.setVoiceObj(ports.systemVoices().find((v) => v.name === ttsVoiceSel.value) || null);
      ctx.store.set('incl_tts_voice', ttsVoiceSel.value);
      ctx.tts.narrate(t('sr.audio.voicePicked'));
    });

    const ttsTestBtn = ctx.$<HTMLButtonElement>('#opt-tts-test');
    if (ttsTestBtn) ttsTestBtn.addEventListener('click', () => {
      const sample = t('audio.voiceSample');
      const engine = ctx.tts.getEngine();
      if (ctx.tts.getEngineSel() !== 'webspeech' && engine && engine.speak) {
        try { engine.speak(sample); } catch (e) { /* noop */ } // the neural engine is already loaded
      } else {
        ports.speakSample(sample, ctx.tts.getVoiceObj()); // audible fallback (volume 1) + starts the neural download
        if (ctx.tts.getEngineSel() !== 'webspeech') ctx.tts.loadTTS();
      }
      ctx.srSay(t('sr.audio.testingVoice'));
    });

    const ttsVolEl = ctx.$<HTMLInputElement>('#tts-vol');
    if (ttsVolEl) ttsVolEl.addEventListener('input', () => {
      const cat = ctx.getAudioCat(); if (!cat) return;
      cat.tts.vol = (+ttsVolEl.value) / 100;
      cat.tts.on = true;
      ctx.setCatGain('tts');
      reflectTts();
    });
  }
  wireControls();

  ports.whenVoicesChange(populateTtsVoices);

  return {
    render: (): void => {
      reflectTts();
      // 🔴 THIS ONE WAS MISSING, and only the case for the engine-mounted panel saw it (2026-09-12): the index is born ON, the
      // button was born with no state, and the panel opened saying «off» — the control lying to the screen reader again.
      reflectMenuIndex();
      populateTtsEngines();
      populateTtsVoices();
      renderVoiceList();
      renderRate();
      lockSpeechRows();
    },
    reflectTts,
  };
}
