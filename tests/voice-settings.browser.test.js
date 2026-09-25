// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/voice-settings driven on its own — the voice section of the hearing panel, with its four browser ports faked.
//
// 🔴 A probe (2026-09-23) disabled thirty-five decisions of `createVoiceSettings`, one at a time, against the nine files that
// drive the section: TWENTY stayed green. Two families:
//   · a LOCKED speech row (no voice speaks the language, ADR-0185 §4) refused and spoke, but nothing checked that it also
//     undoes what the control did — the moved volume, the picked rate, the voice list — nor what the footer says on focus;
//   · three controls the engine never builds — the engine selector, the system voice and the sample button — are wired
//     wherever a page carries them (the platformer's does), and no case drove them at all.
// The fixture here carries all of them, and every browser port is a recording fake.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createVoiceSettings } from '../app/js/ui/voice-settings.js';
import { t } from '../app/js/core/i18n.js';
import * as state from '../app/js/core/state.js';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)

const $ = (sel) => document.querySelector(sel);

const PAGE = '<div class="overlay__card"><p class="opt-explain"></p><button id="otro">outro</button>'
  + '<button id="opt-tts"></button><select id="tts-engine"></select><select id="tts-voice"></select>'
  + '<input id="tts-vol" type="range" min="0" max="100"><select id="tts-ppm"></select>'
  + '<button id="opt-menuindex"></button><select id="tts-voz"></select><button id="opt-tts-test"></button></div>';

function mount({ voices = [{ voice: 'pf_dora' }, { voice: 'pm_alex' }], setVozOk = true, engineSel = 'webspeech', engine = null } = {}) {
  document.body.innerHTML = PAGE;
  const said = []; const narrated = []; const gains = []; const stored = new Map(); const samples = []; const spoken = [];
  const rec = { loadTTS: 0, voiceObj: undefined, voicesAgain: null };
  const cat = { tts: { on: true, vol: 0.4 } };
  let sel = engineSel;
  let current = voices[0] ?? null;
  const system = [{ name: 'Maria', lang: 'pt-BR' }, { name: 'Luciana', lang: 'pt-BR' }];
  const ctx = {
    translator: createTranslator(), // the root's translator, played by the test (ADR-0232 D3)
    settings: state, // the test plays the root: the page's settings store (ADR-0232)
    $, srSay: (m) => said.push(m),
    toggleBtn: (b, on) => b.classList.toggle('is-on', on),
    store: { get: (k, f = null) => (stored.has(k) ? stored.get(k) : f), set: (k, v) => { stored.set(k, v); return true; } },
    getAudioCat: () => cat,
    setCatGain: (k) => gains.push(k),
    tts: {
      getEngineSel: () => sel, setEngineSel: (v) => { sel = v; },
      getEngine: () => (engine ? { id: 'kokoro', speak: (x) => spoken.push(x) } : null),
      getVoiceObj: () => rec.voiceObj ?? null, setVoiceObj: (v) => { rec.voiceObj = v; },
      loadTTS: () => { rec.loadTTS++; }, narrate: (m) => narrated.push(m),
      voices: () => voices, currentVoice: () => current,
      setVoice: (id) => { if (!setVozOk) return false; current = voices.find((v) => v.voice === id) ?? current; return true; },
    },
  };
  const ports = {
    newOption: () => document.createElement('option'),
    systemVoices: () => system,
    speakSample: (text, chosen) => samples.push([text, chosen]),
    whenVoicesChange: (again) => { rec.voicesAgain = again; },
  };
  const section = createVoiceSettings(ctx, ports);
  section.render();
  return { section, said, narrated, gains, stored, samples, spoken, rec, cat, system };
}

const fire = (el, kind) => { const e = new Event(kind, { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };

let ppmBefore; let indexBefore;
beforeEach(() => { ppmBefore = state.speechPpm; indexBefore = state.menuIndexOn; });
// ⚠️ Rate and index are STORED, and every browser file shares one origin: a case that leaves them moved writes on others.
afterEach(() => { state.setSpeechPpmValue(ppmBefore); state.setMenuIndexOnValue(indexBefore); });

describe('a LOCKED speech row undoes what the control did, and says why (ADR-0185 §4)', () => {
  it('🔴 [Right] the refused click is not the browser\'s either — its default is prevented', () => {
    const m = mount({ voices: [] });
    const e = fire($('#opt-tts'), 'click');
    expect(e.defaultPrevented).toBe(true);
    expect(m.cat.tts.on, 'the narration switch moved under a lock').toBe(true);
  });

  it('🔴 [Right] a moved volume goes back to the stored one, and the stored one does not move', () => {
    const m = mount({ voices: [] });
    const vol = $('#tts-vol');
    vol.value = '90';
    fire(vol, 'input');
    expect(vol.value).toBe('40');
    expect(m.cat.tts.vol).toBe(0.4);
  });

  it('🔴 [Right] a picked rate goes back to the stored rate', () => {
    mount({ voices: [] });
    const rate = $('#tts-ppm');
    const other = [...rate.options].find((o) => o.value !== String(state.speechPpm));
    rate.value = other.value;
    fire(rate, 'change');
    expect(rate.value).toBe(String(state.speechPpm));
  });

  it('🔴 [Right] the voice list is drawn again — what the child picked under a lock does not stay picked', () => {
    mount({ voices: [] });
    const list = $('#tts-voz');
    const stray = document.createElement('option'); stray.value = 'x'; list.appendChild(stray); list.value = 'x';
    fire(list, 'change');
    expect([...list.options].map((o) => o.textContent)).toEqual([t('audio.voz.nenhuma')]);
  });

  it('🔴 [Right] focusing a locked row puts its reason in the footer', () => {
    mount({ voices: [] });
    $('#opt-tts').focus();
    expect($('.opt-explain').textContent).toBe(t('audio.semVoz'));
  });

  it('🔴 [Boundary] the footer is written only for the row itself, and only while it is locked', () => {
    mount({ voices: [] });
    $('#otro').focus();
    expect($('.opt-explain').textContent, 'focusing another control wrote a speech row\'s reason').toBe('');
    mount();
    $('.opt-explain').textContent = 'the row\'s own explanation';
    $('#opt-tts').focus();
    expect($('.opt-explain').textContent, 'an UNLOCKED row wiped the footer').toBe('the row\'s own explanation');
  });
});

describe('the voice, the rate, the engine, the system voice and the sample', () => {
  it('🔴 [Right] a voice the engine refuses is not left picked — the list goes back to the voice in use', () => {
    mount({ setVozOk: false });
    const list = $('#tts-voz');
    list.value = 'pm_alex';
    fire(list, 'change');
    expect(list.value).toBe('pf_dora');
  });

  it('🔴 [Right] a new rate is announced, with its number', () => {
    const m = mount();
    const rate = $('#tts-ppm');
    const other = [...rate.options].find((o) => o.value !== String(state.speechPpm));
    rate.value = other.value;
    fire(rate, 'change');
    expect(m.said.at(-1)).toBe(`${t('audio.ttsPpm')}: ${t('visual.legenda.ppm', { n: Number(other.value) })}`);
  });

  it('🔴 [Right] picking a neural engine stores it, starts its download and says which it is', () => {
    const m = mount();
    const eng = $('#tts-engine');
    eng.value = 'kokoro';
    fire(eng, 'change');
    expect(m.stored.get('incl_tts_engine')).toBe('kokoro');
    expect(m.rec.loadTTS, 'the neural voice was never asked to come down').toBe(1);
    expect(m.narrated.at(-1)).toBe(t('sr.audio.engineSet', { motor: t('tts.engine.kokoro') }));
  });

  it('🔴 [Boundary] picking the browser\'s engine downloads nothing', () => {
    const m = mount({ engineSel: 'kokoro' });
    const eng = $('#tts-engine');
    eng.value = 'webspeech';
    fire(eng, 'change');
    expect(m.rec.loadTTS).toBe(0);
  });

  it('🔴 [Right] a system voice picked is the one used, and stays chosen', () => {
    const m = mount();
    const sys = $('#tts-voice');
    sys.value = 'Luciana';
    fire(sys, 'change');
    expect(m.rec.voiceObj).toBe(m.system[1]);
    expect(m.stored.get('incl_tts_voice')).toBe('Luciana');
  });

  it('🔴 [Right] the sample speaks through the neural engine when it is chosen and loaded — not through the browser', () => {
    const m = mount({ engineSel: 'kokoro', engine: true });
    $('#opt-tts-test').click();
    expect(m.spoken).toEqual([t('audio.voiceSample')]);
    expect(m.samples).toHaveLength(0);
    expect(m.said.at(-1)).toBe(t('sr.audio.testingVoice'));
  });

  it('🔴 [Boundary] with the browser\'s engine the sample is the browser\'s, and nothing neural comes down', () => {
    const m = mount({ engineSel: 'webspeech' });
    $('#opt-tts-test').click();
    expect(m.samples.map(([text]) => text)).toEqual([t('audio.voiceSample')]);
    expect(m.rec.loadTTS).toBe(0);
  });

  it('🔴 [Right] voices the browser lists LATE are drawn when they arrive', () => {
    const m = mount();
    m.system.push({ name: 'Joana', lang: 'pt-BR' });
    m.rec.voicesAgain();
    expect([...$('#tts-voice').options].map((o) => o.value)).toContain('Joana');
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/sonda-voz.py`: the twenty decisions green before this file. Declared and not pinned:
//   · the refusal in the CAPTURE phase is equivalent today: the refusal is registered on the control BEFORE the control's
//     own listener, and at the target both phases run in registration order, so it runs first either way.
