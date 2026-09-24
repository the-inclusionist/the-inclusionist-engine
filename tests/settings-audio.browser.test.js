// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-audio — DOM render/wiring (BROWSER project: uses document + navigator.mediaDevices +
// window.speechSynthesis). The pure logic (labels/percentages/validation) is covered in the node test; here only what
// needs a real DOM: renderAudio() rebuilds the category lists and rewires the static widgets; the clicks mutate the LIVE
// injected audioCat and call setCatGain; blind mode/cane delegate to the host through the ctx; TTS and audio outputs
// fill <select>s from browser APIs (stubbed here). See docs/5-Refactoring/plan-modularization-map.md (Stage 4,
// ui/settings-audio) and tests/a11y-sr.browser.test.js (the injection model).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initSettingsAudio } from '../app/js/ui/settings-audio.js';
import { NAV_CATS, GEN_CATS } from '../app/js/ui/audio-choices.js';
import { defaultAudioCat } from '../app/js/platform/audio-mixer.js';
import { menuIndexOn, setMenuIndexOnValue, speechPpm, setSpeechPpmValue } from '../app/js/core/state.js';
import { SPEECH_RATES } from '../app/js/core/speech-rate.js';
// The sentence is asked of the dictionary and not copied: a copy here would end up measuring itself.
import { t as tr } from '../app/js/core/i18n.js';

const AUDIO_HTML = `
  <div id="audio">
    <div class="ctrl-row"><button id="opt-modocego" type="button" aria-pressed="false">▶ Desligado</button></div>
    <select id="cane-div"><option value="1">bloco</option><option value="2">meio bloco</option></select>
    <input id="navsound-master" type="range" min="0" max="100" step="5">
    <div id="navsound-list"></div>
    <button id="opt-tts" type="button" aria-pressed="false">▶ Desligado</button>
    <button id="opt-menuindex" type="button" aria-pressed="true">▶ Desligado</button>
    <select id="tts-engine"></select>
    <select id="tts-voice"></select>
    <button id="opt-tts-test" type="button">Testar</button>
    <input id="tts-vol" type="range" min="0" max="100" step="5">
    <select id="tts-ppm"></select>
    <div class="ctrl-row"><span><strong>Voz</strong></span><select id="tts-voz"></select></div>
    <div id="audio-sinks"></div>
    <button id="audio-detect" type="button">Detectar</button>
    <button id="audio-master" type="button" aria-pressed="true">🔊 Ligado</button>
    <input id="audio-master-vol" type="range" min="0" max="100" step="5" value="60">
    <div id="audio-list"></div>
    <button id="opt-sound" type="button">Som</button>
    <button id="audio-reset" type="button">Restaurar padrões deste menu</button>
  </div>
  <button id="som-reset" type="button">Restaurar padrões do Áudio</button>
  <button data-act="audio" class="pm-btn" type="button">Acessibilidade auditiva</button>
  <button data-act="som" class="pm-btn" type="button">Áudio</button>`;

const AUDIO_CATS = [
  { k: 'music', lbl: 'Música' }, { k: 'ambient', lbl: 'Sons ambiente' }, { k: 'interact', lbl: 'Interação' },
  { k: 'earcons', lbl: 'Earcons' }, { k: 'tts', lbl: 'Narração (TTS)' },
  { k: 'sonar', lbl: 'Sonar' }, { k: 'guard', lbl: 'Guarda' }, { k: 'guide', lbl: 'Guia' },
];

/**
 * The FACTORY state of the categories — asked of `defaultAudioCat`, not copied again.
 *
 * A second copy of the rule written here (`{ on: k !== 'tts', vol: 0.8 }`) diverged the day `guide` started being born
 * off: the fixture kept it ON, and ADR-0029's "changed from default" mark showed up in a menu nobody had touched. The
 * case failed and it was right — the copy was wrong, not the code.
 */
function freshAudioCat() {
  const cat = {};
  [...GEN_CATS, ...NAV_CATS, 'tts'].forEach((k) => { cat[k] = defaultAudioCat(k); });
  return cat;
}

function fullCtx(over = {}) {
  const said = [];
  const store = new Map();
  const catGainCalls = [];
  const audioCat = over.audioCat || freshAudioCat();
  let soundOn = over.soundOn ?? true;
  let volume = over.volume ?? 0.6;
  let blindMode = over.blindMode ?? false;
  let caneBlockDiv = over.caneBlockDiv ?? 1;
  const players = over.players || [{ audioSink: null }];
  // The catalogue belongs to the HOST, and can be overridden since the list is built as nodes: what is measured is the
  // panel being told the host names other categories — the same question, asked through the path that exists.
  const audioCats = over.audioCats || AUDIO_CATS;
  const tts = {
    engineSel: 'webspeech',
    getEngineSel: () => tts.engineSel,
    setEngineSel: (v) => { tts.engineSel = v; },
    getEngine: () => null,
    voiceObj: null,
    getVoiceObj: () => tts.voiceObj,
    setVoiceObj: (v) => { tts.voiceObj = v; },
    loadTTS: () => {},
    narrate: (t) => { tts.narrated = tts.narrated || []; tts.narrated.push(t); },
  };
  const ctx = {
    $: (sel) => document.querySelector(sel),
    srSay: (t) => said.push(t),
    store: { get: (k, fb = null) => (store.has(k) ? store.get(k) : fb), set: (k, v) => { store.set(k, String(v)); return true; } },
    audioCats,
    toggleBtn: (b, on) => { b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); },
    getNumPlayers: () => players.length,
    getPlayers: () => players,
    getSoundOn: () => soundOn,
    setSoundOn: (v) => { soundOn = v; },
    getVolume: () => volume,
    setVolume: (v) => { volume = v; },
    getAudioCat: () => audioCat,
    setCatGain: (k) => { catGainCalls.push(k); },
    tts,
    getBlindMode: () => blindMode,
    setBlindMode: (v) => { blindMode = v; },
    getCaneBlockDiv: () => caneBlockDiv,
    setCaneBlockDiv: (v) => { caneBlockDiv = v; },
    /*
     * 🔴 THE BROWSER ARRIVES THROUGH PORTS (ADR-0227), and these three are required. Here they delegate to the same
     * `stubMediaDevices`/`stubSpeech` this file already set up, so the existing cases keep measuring what they measured.
     * 📌 A case that wants a device with NO browser at all passes its own ports through `ctxOver`, which is the
     * property the ports exist to buy.
     */
    newElement: (tag) => document.createElement(tag),
    speech: {
      voices: () => (window.speechSynthesis ? window.speechSynthesis.getVoices() : []),
      speakSample: (sample, chosen) => {
        const ss = window.speechSynthesis;
        if (!ss) return;
        ss.cancel();
        const u = new SpeechSynthesisUtterance(sample);
        u.lang = 'pt-BR';
        if (chosen) u.voice = chosen;
        ss.speak(u);
      },
      whenVoicesChange: (again) => { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = again; },
    },
    audioOutputs: {
      canList: () => !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices),
      canRoute: () => typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined',
      list: async () => (navigator.mediaDevices?.enumerateDevices
        ? (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput')
        : []),
      detect: async () => {
        await navigator.mediaDevices.getUserMedia({ audio: true })
          .then((s) => s.getTracks().forEach((tr) => tr.stop())).catch(() => {});
        return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
      },
    },
    ...over.ctxOver,
  };
  return { ctx, said, store, catGainCalls, audioCat, players, tts, getSoundOn: () => soundOn, getVolume: () => volume, getBlindMode: () => blindMode, getCaneBlockDiv: () => caneBlockDiv };
}

const origMediaDevices = navigator.mediaDevices;
const origSpeechSynthesis = window.speechSynthesis;

function stubMediaDevices({ devices = [], getUserMedia } = {}) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: async () => devices,
      getUserMedia: getUserMedia || (async () => ({ getTracks: () => [] })),
    },
  });
}
function restoreMediaDevices() {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: origMediaDevices });
}
function stubSpeechSynthesis(voices) {
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { getVoices: () => voices, cancel: () => {}, speak: () => {}, onvoiceschanged: null },
  });
}
function restoreSpeechSynthesis() {
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: origSpeechSynthesis });
}
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { document.body.innerHTML = AUDIO_HTML; stubMediaDevices(); stubSpeechSynthesis([]); });
afterEach(() => { restoreMediaDevices(); restoreSpeechSynthesis(); });

describe('ui/settings-audio — renderAudio (categorias)', () => {
  it('[Interface] renderAudio() preenche #audio-list (GEN_CATS) e #navsound-list (NAV_CATS)', () => {
    const { ctx } = fullCtx();
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    const genButtons = document.querySelectorAll('#audio-list button[data-acat]');
    const navButtons = document.querySelectorAll('#navsound-list button[data-acat]');
    expect(genButtons.length).toBe(GEN_CATS.length);
    expect(navButtons.length).toBe(NAV_CATS.length);
  });

  /*
   * 🔴 THE FIVE ASSERTIONS THAT USED TO LIVE ON THE STRING (BREAKING, note BV). They were node cases over
   * `catRowHTML`/`catsListHTML`, which read the markup as TEXT; the list is built as NODES, and what they required is
   * observable only in a document. No requirement was dropped: the label, the slider's percentage, the switch's state,
   * the order and the unnamed key are still pinned, now through the path that exists.
   *
   * 🎯 AND TWO ARE NEW, because only the new shape makes them possible: the row that STAYS is the SAME node between two
   * renders (which is what keeps the slider from dropping out from under whoever is moving the volume) and the row that
   * loses its name is removed. A string blew everything away on each render and neither question made sense.
   */
  it('🔴 [Right] a linha leva o rótulo, a percentagem do volume e o estado ligado do interruptor', () => {
    const cat = freshAudioCat();
    cat.music.on = true; cat.music.vol = 0.8;
    const { ctx } = fullCtx({ audioCat: cat });
    initSettingsAudio(ctx).renderAudio();
    const row = document.querySelector('#audio-list [data-acat="music"]').closest('.ctrl-row');
    expect(row.querySelector('strong').textContent).toBe('Música');
    expect(row.querySelector('input[data-avol="music"]').value).toBe('80');
    const btn = row.querySelector('button[data-acat="music"]');
    expect(btn.classList.contains('is-on')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('⚠️ [Inverse] e uma categoria DESLIGADA não fica `is-on` nem diz que está premida', () => {
    const cat = freshAudioCat();
    cat.ambient.on = false; cat.ambient.vol = 0.35;
    const { ctx } = fullCtx({ audioCat: cat });
    initSettingsAudio(ctx).renderAudio();
    const btn = document.querySelector('#audio-list button[data-acat="ambient"]');
    expect(btn.classList.contains('is-on')).toBe(false);
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('🔴 [Error] chave que o hospedeiro NÃO NOMEIA não vira linha — e o painel não lança', () => {
    // «Não se oferece o que não tem nome»: a switch with no label is a button the child does not know what it does.
    const semMusica = AUDIO_CATS.filter((c) => c.k !== 'music');
    const { ctx } = fullCtx({ audioCats: semMusica });
    expect(() => initSettingsAudio(ctx).renderAudio()).not.toThrow();
    expect(document.querySelector('#audio-list [data-acat="music"]')).toBe(null);
    expect(document.querySelectorAll('#audio-list button[data-acat]').length).toBe(GEN_CATS.length - 1);
  });

  it('🔴 [Right] as linhas saem na ORDEM das chaves, e não na do catálogo do hospedeiro', () => {
    const invertido = [...AUDIO_CATS].reverse();
    const { ctx } = fullCtx({ audioCats: invertido });
    initSettingsAudio(ctx).renderAudio();
    const ordem = [...document.querySelectorAll('#audio-list button[data-acat]')].map((b) => b.dataset.acat);
    expect(ordem).toEqual([...GEN_CATS]);
  });

  it('🎯 [Right] um segundo render REAPROVEITA os nós — a linha que fica é a mesma, e o cursor não cai', () => {
    const { ctx } = fullCtx();
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    const antes = document.querySelector('#audio-list input[data-avol="music"]');
    antes.focus();
    api.renderAudio();
    expect(document.querySelector('#audio-list input[data-avol="music"]')).toBe(antes);
    expect(document.activeElement).toBe(antes);
  });

  it('🔴 [Right] e a linha cuja categoria PERDE o nome é removida, não fica com o rótulo velho', () => {
    const cats = [...AUDIO_CATS];
    const { ctx } = fullCtx({ audioCats: cats });
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    expect(document.querySelector('#audio-list [data-acat="music"]')).not.toBe(null);
    cats.splice(cats.findIndex((c) => c.k === 'music'), 1);
    api.renderAudio();
    expect(document.querySelector('#audio-list [data-acat="music"]')).toBe(null);
  });

  it('[Interface] clicar no botão de uma categoria alterna audioCat[k].on e chama setCatGain', () => {
    const { ctx, audioCat, catGainCalls } = fullCtx();
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    const btn = document.querySelector('#audio-list button[data-acat="music"]');
    expect(audioCat.music.on).toBe(true);
    btn.click();
    expect(audioCat.music.on).toBe(false);
    expect(catGainCalls).toContain('music');
    expect(btn.classList.contains('is-on')).toBe(false);
  });

  it('[Interface] mover o slider de volume liga a categoria e chama setCatGain', () => {
    const { ctx, audioCat, catGainCalls } = fullCtx({ audioCat: (() => { const c = freshAudioCat(); c.ambient.on = false; return c; })() });
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    const slider = document.querySelector('#audio-list input[data-avol="ambient"]');
    slider.value = '25';
    // ⚠️ WITH BUBBLING, like a real `input`: the spec says an `input` fired by interaction BUBBLES, and this list listens
    // by delegation — the category rows come and go with the cartridge, and wiring control by control on every render
    // piled up listeners. A dispatch without bubbling would be a shape no real path uses.
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(audioCat.ambient.vol).toBeCloseTo(0.25);
    expect(audioCat.ambient.on).toBe(true);
    expect(catGainCalls).toContain('ambient');
  });

  it('[Interface] o slider geral de navegação sonora move sonar/guard/guide juntos e chama setCatGain 3x', () => {
    const { ctx, audioCat, catGainCalls } = fullCtx();
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    const master = document.querySelector('#navsound-master');
    master.value = '50';
    master.dispatchEvent(new Event('input'));
    NAV_CATS.forEach((k) => { expect(audioCat[k].vol).toBeCloseTo(0.5); expect(audioCat[k].on).toBe(true); });
    NAV_CATS.forEach((k) => expect(catGainCalls).toContain(k));
  });

  it('[Robustez] renderAudio() sem #audio-list/#navsound-list no DOM não lança', () => {
    document.body.innerHTML = '';
    const { ctx } = fullCtx();
    const api = initSettingsAudio(ctx);
    expect(() => api.renderAudio()).not.toThrow();
  });
});

describe('ui/settings-audio — som mestre', () => {
  it('[Interface] o botão mestre alterna soundOn, reflete texto/aria e anuncia', () => {
    const { ctx, said, getSoundOn } = fullCtx({ soundOn: true });
    initSettingsAudio(ctx);
    const btn = document.querySelector('#audio-master');
    btn.click();
    expect(getSoundOn()).toBe(false);
    expect(btn.textContent).toBe('Desligado');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(said.at(-1)).toBe('Som desligado.');
  });

  it('[Interface] subir o volume geral de 0 com som desligado religa o som', () => {
    const { ctx, getSoundOn, getVolume } = fullCtx({ soundOn: false, volume: 0 });
    initSettingsAudio(ctx);
    const vol = document.querySelector('#audio-master-vol');
    vol.value = '40';
    vol.dispatchEvent(new Event('input'));
    expect(getVolume()).toBeCloseTo(0.4);
    expect(getSoundOn()).toBe(true);
    expect(document.querySelector('#audio-master').classList.contains('is-on')).toBe(true);
  });

  it('[Boundary] mexer no volume geral SEM estar em 0 não mexe em soundOn', () => {
    const { ctx, getSoundOn } = fullCtx({ soundOn: true, volume: 0.6 });
    initSettingsAudio(ctx);
    const vol = document.querySelector('#audio-master-vol');
    vol.value = '70';
    vol.dispatchEvent(new Event('input'));
    expect(getSoundOn()).toBe(true);
  });
});

describe('ui/settings-audio — modo cego / bengala', () => {
  it('[Interface] o botão de modo cego delega a ctx.setModoCego e reflete o novo estado', () => {
    const { ctx, getBlindMode: getModoCego } = fullCtx({ blindMode: false });
    initSettingsAudio(ctx);
    const btn = document.querySelector('#opt-modocego');
    btn.click();
    expect(getModoCego()).toBe(true);
    expect(btn.textContent).toBe('Ligado');
  });

  it('[Interface] trocar a bengala para "meio bloco" persiste via ctx.setCaneBlockDiv e anuncia a mensagem certa', () => {
    const { ctx, said, getCaneBlockDiv } = fullCtx({ caneBlockDiv: 1 });
    initSettingsAudio(ctx);
    const sel = document.querySelector('#cane-div');
    sel.value = '2';
    sel.dispatchEvent(new Event('change'));
    expect(getCaneBlockDiv()).toBe(2);
    expect(said.at(-1)).toBe('Bengala: uma batida a cada meio bloco pisado.');
  });
});

describe('ui/settings-audio — TTS', () => {
  it('[Interface] renderAudio() fills #tts-engine with the 4 engines and selects the current one', () => {
    const { ctx } = fullCtx();
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    const sel = document.querySelector('#tts-engine');
    expect(sel.options.length).toBe(4);
    expect(sel.value).toBe('webspeech');
  });

  it('[Interface] renderAudio() só preenche #tts-engine UMA vez (dataset.filled trava novas chamadas)', () => {
    const { ctx } = fullCtx();
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    api.renderAudio();
    expect(document.querySelector('#tts-engine').options.length).toBe(4);
  });

  it('[Interface] com vozes pt-BR disponíveis, #tts-voice lista só elas e escolhe a 1ª', () => {
    stubSpeechSynthesis([{ name: 'Ana', lang: 'pt-BR' }, { name: 'John', lang: 'en-US' }]);
    const { ctx, tts } = fullCtx();
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    const sel = document.querySelector('#tts-voice');
    expect([...sel.options].map((o) => o.value)).toEqual(['Ana']);
    expect(tts.voiceObj.name).toBe('Ana');
  });

  it('[Zero] sem nenhuma voz do sistema, mostra o aviso e zera a voz escolhida', () => {
    stubSpeechSynthesis([]);
    const { ctx, tts } = fullCtx();
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    expect(document.querySelector('#tts-voice').textContent).toContain('sem vozes do sistema');
    expect(tts.voiceObj).toBeNull();
  });

  it('[Interface] o botão de narração alterna audioCat.tts.on, chama setCatGain("tts") e anuncia', () => {
    const { ctx, audioCat, catGainCalls, said, tts } = fullCtx();
    initSettingsAudio(ctx);
    const btn = document.querySelector('#opt-tts');
    btn.click();
    expect(audioCat.tts.on).toBe(true);
    expect(catGainCalls).toContain('tts');
    expect(said.at(-1)).toBe('Narração ligada.');
    expect(tts.narrated).toEqual(['Narração por voz ligada.']);
  });

  it('[Interface] o botão do ÍNDICE alterna o ajuste, reflete no botão e anuncia (ADR-0044, item 3)', () => {
    // The "6 de 10" index is born ON — whoever needs it to find their way has no means of discovering it exists if it
    // comes off. This case proves the path to turn it OFF, which is what XAG 106 requires to exist.
    const inicial = menuIndexOn;
    try {
      const { ctx, said } = fullCtx();
      initSettingsAudio(ctx);
      const btn = document.querySelector('#opt-menuindex');
      btn.click();
      expect(menuIndexOn).toBe(!inicial);
      expect(btn.getAttribute('aria-pressed')).toBe(String(!inicial));
      expect(said.at(-1)).toBe(inicial ? 'Posição na lista desligada.' : 'Posição na lista ligada.');
      btn.click(); // inverse: back to what it was, and the announcement follows
      expect(menuIndexOn).toBe(inicial);
      expect(said.at(-1)).toBe(inicial ? 'Posição na lista ligada.' : 'Posição na lista desligada.');
    } finally {
      setMenuIndexOnValue(inicial); // `core/state` is a module: the value outlives the case and would leak into the others
    }
  });

  it('[Interface] o slider de volume da narração liga o TTS e chama setCatGain("tts")', () => {
    const { ctx, audioCat, catGainCalls } = fullCtx();
    initSettingsAudio(ctx);
    const slider = document.querySelector('#tts-vol');
    slider.value = '90';
    slider.dispatchEvent(new Event('input'));
    expect(audioCat.tts.vol).toBeCloseTo(0.9);
    expect(audioCat.tts.on).toBe(true);
    expect(catGainCalls).toContain('tts');
  });
});

describe('ui/settings-audio — saídas de áudio (sinks)', () => {
  it('[Interface] sem dispositivos detectados ainda, mostra a dica de clicar em Detectar', async () => {
    stubMediaDevices({ devices: [] });
    const { ctx } = fullCtx();
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    await flush();
    expect(document.querySelector('#audio-sinks').textContent).toContain('Detectar');
  });

  it('[Interface] com dispositivos, monta 1 linha por jogador com as opções + a saída atual selecionada', async () => {
    stubMediaDevices({ devices: [{ deviceId: 'd1', kind: 'audiooutput', label: 'Fone USB' }, { deviceId: 'd2', kind: 'audioinput', label: 'Mic' }] });
    const { ctx } = fullCtx({ players: [{ audioSink: 'd1' }, { audioSink: null }] });
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    await flush();
    const rows = document.querySelectorAll('#audio-sinks select');
    expect(rows.length).toBe(2); // 2 jogadores
    expect(rows[0].value).toBe('d1');
    expect([...rows[0].options].map((o) => o.textContent)).toEqual(['Padrão (compartilhado)', 'Fone USB']); // only audiooutput
  });

  it('[Interface] trocar a saída de um jogador persiste via store e anuncia', async () => {
    stubMediaDevices({ devices: [{ deviceId: 'd1', kind: 'audiooutput', label: 'Fone USB' }] });
    const player = { audioSink: null };
    const { ctx, store, said } = fullCtx({ players: [player] });
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    await flush();
    const sel = document.querySelector('#audio-sinks select');
    sel.value = 'd1';
    sel.dispatchEvent(new Event('change'));
    expect(player.audioSink).toBe('d1');
    expect(store.get('incl_sink_p0')).toBe('d1');
    expect(said.at(-1)).toBe('Jogador 1 — saída de áudio trocada.');
  });

  it('[Interface] o botão Detectar pede permissão e relista os dispositivos', async () => {
    let asked = false;
    stubMediaDevices({ devices: [], getUserMedia: async () => { asked = true; return { getTracks: () => [] }; } });
    const { ctx } = fullCtx();
    initSettingsAudio(ctx);
    document.querySelector('#audio-detect').click();
    await flush();
    expect(asked).toBe(true);
  });
});

describe('ui/settings-audio — restaurar padrões DESTE menu (ADR-0028)', () => {
  // The case that matters most is not the reset working: it is the reset NOT reaching outside itself. A reset that
  // silently erased the motor settings would be worse than the trap it exists to undo — the child undoes a sound
  // setting and loses what let her play, with no visible link between one thing and the other.
  it('[Right] devolve modo cego, bengala, navegação e narração ao padrão — e NÃO a música, que é do «Áudio»', () => {
    const cat = freshAudioCat();
    cat.music.on = false; cat.music.vol = 0.1;   // changed, but in the OTHER panel (ADR-0151)
    cat.sonar.vol = 0.2;                          // mexido, e deste painel
    cat.tts.on = true;                            // TTS is born OFF, so this is a deviation
    const { ctx, said, getBlindMode: getModoCego, getCaneBlockDiv } = fullCtx({ audioCat: cat, blindMode: true, caneBlockDiv: 2 });
    initSettingsAudio(ctx);
    document.querySelector('#audio-reset').click();
    expect(getModoCego()).toBe(false);
    expect(getCaneBlockDiv()).toBe(1);
    expect(cat.sonar).toEqual(defaultAudioCat('sonar'));
    expect(cat.tts).toEqual({ on: false, vol: 0.8 }); // back to OFF, its default
    // 🔴 THE SCOPE: resetting auditory accessibility does not reach the panel next door.
    expect(cat.music, 'o «repor» auditivo desfez a música, que é do painel Áudio').toEqual({ on: false, vol: 0.1 });
    expect(said.at(-1)).toContain('auditiva');
  });

  it('[Right] o «repor» do ÁUDIO devolve as quatro categorias de gosto — e só elas', () => {
    const cat = freshAudioCat();
    cat.music.on = false; cat.music.vol = 0.1;
    cat.sonar.vol = 0.2;
    const { ctx } = fullCtx({ audioCat: cat, blindMode: true });
    initSettingsAudio(ctx);
    document.querySelector('#som-reset').click();
    expect(cat.music).toEqual(defaultAudioCat('music'));
    expect(cat.sonar.vol, 'o «repor» do Áudio alcançou o sonar, que é da acessibilidade auditiva').toBe(0.2);
  });

  it('[Interface] NÃO toca no que não é deste menu — motor de voz e saída de áudio ficam', () => {
    // A DEVICE choice is not a restorable preference: clearing the output would take from the child the headphones that
    // are hers in a shared room, and switching the voice engine would leave her without the voice she understands.
    const players = [{ audioSink: 'fone-da-crianca' }];
    const { ctx, tts } = fullCtx({ players });
    tts.setEngineSel('kokoro');
    initSettingsAudio(ctx);
    document.querySelector('#audio-reset').click();
    expect(tts.getEngineSel()).toBe('kokoro');
    expect(players[0].audioSink).toBe('fone-da-crianca');
  });
});

describe('ui/settings-audio — marca o que saiu do padrão (ADR-0029)', () => {
  // `#audio-list` is born empty: `renderAudio()` fills it, as the game does when the panel opens.
  const montar = (over) => { const { ctx } = fullCtx(over); initSettingsAudio(ctx).renderAudio(); return ctx; };
  // These cases click, as the child does: moving a category updates its row by itself, without redrawing the panel,
  // so a mark hung only on `renderAudio()` would pass a case that called `render()` and never show in the game.
  it('[Right] clicar uma categoria marca a linha dela e o botão do menu', () => {
    montar();
    document.querySelector('#audio-list button[data-acat="music"]').click();
    const linha = document.querySelector('#audio-list button[data-acat="music"]').closest('.ctrl-row');
    expect(linha.classList.contains('is-changed')).toBe(true);
    // ⚠️ THE MARK GOES TO THE MENU THAT HOLDS THE ROW: music belongs to «Áudio», and lighting auditory accessibility
    // would send the child looking in the wrong panel.
    expect(document.querySelector('[data-act="som"]').classList.contains('is-changed')).toBe(true);
    expect(document.querySelector('[data-act="audio"]').classList.contains('is-changed')).toBe(false);
  });

  it('[Right] clicar de volta APAGA a marca — a música volta ao padrão, e a marca some com ela', () => {
    montar();
    const b = () => document.querySelector('#audio-list button[data-acat="music"]');
    b().click();
    b().click();
    expect(b().closest('.ctrl-row').classList.contains('is-changed')).toBe(false);
    expect(document.querySelector('[data-act="som"]').classList.contains('is-changed')).toBe(false);
  });

  it('[Right] o reset limpa todas as marcas do menu', () => {
    montar({ blindMode: true });
    document.querySelector('#audio-list button[data-acat="music"]').click();
    expect(document.querySelectorAll('.is-changed').length).toBeGreaterThan(0);
    // each «repor» clears what is its own; the two together clear the document
    document.querySelector('#audio-reset').click();
    document.querySelector('#som-reset').click();
    expect(document.querySelectorAll('.is-changed')).toHaveLength(0);
  });
});

describe('ui/settings-audio — o painel ASSINA o modo cego (ADR-0106 §4)', () => {
  it('⚠️ [Interface] o botão #opt-modocego acompanha uma mudança feita FORA do painel', async () => {
    // The defect this case prevents is the control LYING about the state to the screen reader: the child turns blind
    // mode on through the quick bar's icon, opens this panel, and the button says «Desligado» with aria-pressed=false.
    // It is the exact twin of the dead `reflectTtsPanel` guard recorded in `ui/pause-icons` (`reflectTtsPanelEnabled`),
    // and the way out is the one `core/state` already wrote beside `setBlindModeValue`: whoever reacts subscribes to
    // the event.
    const estado = await import('../app/js/core/state.js');
    let cego = estado.blindMode;
    const { ctx } = fullCtx({});
    ctx.getBlindMode = () => cego;
    initSettingsAudio(ctx);

    const btn = document.querySelector('#opt-modocego');
    expect(btn.getAttribute('aria-pressed')).toBe(String(cego));

    cego = !cego;
    estado.setBlindModeValue(cego);          // nobody touched the panel — only the state

    expect(btn.getAttribute('aria-pressed'), 'o painel não acompanhou o evento').toBe(String(cego));
    estado.setBlindModeValue(!cego);
  });
});

// ========================= MUTATIONS CHECKED (ADR-0106 §4, step 1b) =========================
//   · removing the `state.on('blindMode', …)` at the end of `initSettingsAudio` -> fails the case above. Without it, a
//     game that does not inject its own `setModoCego` leaves this button lying about the state.
//   · replacing the subscription with `state.on('blindMode', () => {})` (subscribes and does not react) -> fails too,
//     which is the measure that the case asserts the EFFECT and not the subscription.

describe('ui/settings-audio — o modo cego ANUNCIA, como os cinco irmãos deste painel', () => {
  it('⚠️ [Interface] ligar pelo painel diz o estado NOVO — um alternador mudo é invisível a leitor de tela', () => {
    // 📏 Measured on 2026-09-08: this panel's five siblings announce (sound, TTS, cane divider, menu index, audio
    // output) and blind mode did NOT — it seemed to announce because ONE cartridge did it from its own setter, and the
    // panel inherited the effect for free.
    //
    // ⚠️ And the silence is REACHABLE: with the setter defaulting to the engine's `setBlindModeValue` (which writes,
    // persists and notifies, and does not speak), a game that does not inject its setter would get a mute button — the
    // same family as the `reflectTtsPanel` guard, which already cost a control lying about the state.
    let cego = false;
    const { ctx, said } = fullCtx({});
    ctx.getBlindMode = () => cego;
    ctx.setBlindMode = (on) => { cego = on; };
    initSettingsAudio(ctx);

    document.querySelector('#opt-modocego').click();
    expect(cego, 'o botão não mexeu no estado').toBe(true);
    // The literal is pinned, not read through `t()`: asserting through the dictionary would measure the round trip
    // through the same table, and the two halves would move together.
    expect(said.at(-1), 'ligou sem dizer nada').toBe('Modo cego ligado: bengala e pistas de áudio ativas. O 1º item de poder vira a bengala de corrida.');

    document.querySelector('#opt-modocego').click();
    expect(cego).toBe(false);
    // ⚠️ And the announcement tells the NEW state, not the one the child just left — so it comes AFTER the setter
    // (`ctx.setBlindMode`), and that is what this second half pins.
    expect(said.at(-1)).toBe('Modo cego desligado.');
  });
});

// ========================= MUTATIONS CHECKED (the blind-mode announcement) =========================
//   · removing the `ctx.srSay(...)` from the click -> fails. It is the defect that existed until then.
//   · moving the `srSay` to BEFORE `setModoCego` -> fails, because it announces the state the child just left. It is
//     the same rule as the quick bar's icon, and neither had it written down.

// ===================================================================================================
// THE VOICE CHOICE AND THE LOCK (ADR-0185; issue #180)
// ===================================================================================================
const DORA = { locale: 'pt-BR', engine: 'kokoro', voice: 'pf_dora' };
const OUTRA = { locale: 'pt-BR', engine: 'kokoro', voice: 'pm_alex' };
function comVozes(vozes) {
  const r = fullCtx({});
  let escolhida = null;
  Object.assign(r.tts, {
    voices: () => vozes,
    currentVoice: () => vozes.find((v) => v.voice === escolhida) ?? vozes[0] ?? null,
    setVoice: (id) => { if (!vozes.some((v) => v.voice === id)) return false; escolhida = id; return true; },
  });
  return r;
}
const LINHAS_DA_FALA = ['#opt-tts', '#tts-vol', '#opt-menuindex', '#tts-voz'];

describe('ui/settings-audio — the voice choice (ADR-0185)', () => {
  it('🔴 [Right] the «Voz» list holds the voices of the language, the one in use selected', () => {
    const { ctx } = comVozes([DORA, OUTRA]);
    initSettingsAudio(ctx).renderAudio();
    const sel = document.querySelector('#tts-voz');
    expect([...sel.options].map((o) => o.value)).toEqual(['pf_dora', 'pm_alex']);
    expect(sel.value).toBe('pf_dora');
    expect([...sel.options].map((o) => o.textContent), 'the option shows the identifier, not a name').toEqual(['Dora', 'Alex']);
  });

  it('🔴 [Right] a good Kokoro voice carries a heart only where it is SEEN — the choice is said by the name alone', () => {
    // ADR-0198 §3: Heart and Bella are marked; ADR-0159 rule 12: no glyph in a spoken name.
    const HEART = { locale: 'en-US', engine: 'kokoro', voice: 'af_heart', recommended: true };
    const { ctx, said, tts } = comVozes([HEART, { locale: 'en-US', engine: 'kokoro', voice: 'am_adam' }]);
    initSettingsAudio(ctx).renderAudio();
    const sel = document.querySelector('#tts-voz');
    expect([...sel.options].map((o) => o.textContent)).toEqual(['❤️ Heart', 'Adam']);
    sel.value = 'af_heart';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(tts.currentVoice().voice).toBe('af_heart');
    expect(said.at(-1) ?? '', 'the heart is spoken').not.toMatch(/❤️/);
  });

  it('🔴 [Right] the list opens on the voice in use, even when it is not the first', () => {
    // a <select> opens on its first option by itself, so only a pick further down shows the list was set
    const { ctx, tts } = comVozes([DORA, OUTRA]);
    tts.setVoice('pm_alex');
    initSettingsAudio(ctx).renderAudio();
    expect(document.querySelector('#tts-voz').value).toBe('pm_alex');
  });

  it('🔴 [Right] picking a voice sets it and says it', () => {
    const { ctx, tts, said } = comVozes([DORA, OUTRA]);
    initSettingsAudio(ctx).renderAudio();
    const sel = document.querySelector('#tts-voz');
    sel.value = 'pm_alex';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(tts.currentVoice().voice).toBe('pm_alex');
    expect(said.at(-1) ?? '', 'the choice was silent').toMatch(/Alex/);
  });

  it('🎯 [Zero] with a voice, nothing of the speech is locked', () => {
    const { ctx } = comVozes([DORA]);
    initSettingsAudio(ctx).renderAudio();
    for (const id of LINHAS_DA_FALA) expect(document.querySelector(id).getAttribute('aria-disabled'), id).toBeNull();
  });

  it('🔴 [Right] with no voice for the language, the four speech rows are locked with the reason, never hidden', () => {
    const { ctx } = comVozes([]);
    initSettingsAudio(ctx).renderAudio();
    for (const id of LINHAS_DA_FALA) {
      const el = document.querySelector(id);
      expect(el.getAttribute('aria-disabled'), id + ' not locked').toBe('true');
      expect(el.dataset.motivo ?? '', id + ' locked without its reason').toMatch(/voz/i);
      expect(el.closest('[hidden]'), id + ' hidden instead of locked').toBeNull();
    }
  });

  it('🔴 [Right] a locked row turns nothing on, and says why', () => {
    const { ctx, audioCat, said } = comVozes([]);
    initSettingsAudio(ctx).renderAudio();
    const narracao = audioCat.tts.on;
    const indice = menuIndexOn;
    document.querySelector('#opt-tts').click();
    document.querySelector('#opt-menuindex').click();
    const vol = document.querySelector('#tts-vol');
    const volAntes = audioCat.tts.vol;
    vol.value = '5';
    vol.dispatchEvent(new Event('input', { bubbles: true }));
    expect(audioCat.tts.on, 'narration toggled').toBe(narracao);
    expect(menuIndexOn, 'the spoken index toggled').toBe(indice);
    expect(audioCat.tts.vol, 'the narration volume moved').toBe(volAntes);
    expect(said.at(-1) ?? '', 'refused in silence').toMatch(/voz/i);
    setMenuIndexOnValue(indice);
  });
});

/*
 * ============== THE TWO PIECES OF THE VOICE NOBODY SAW (2026-09-22, ADR-0221 step 7c) ==============
 *
 * 🔴 MEASURED BEFORE TOUCHING, as in `pollPads`: the seven pieces of the voice block were switched off, one at a time, and
 * the suite answered for five of them. GREEN stayed `reflectTts` — the mirror of the narration switch and of the chosen
 * engine, which the icon bar calls from outside through `reflectTtsPanel` — and the speech-rate list (`renderRate`, in
 * `ui/voice-settings`).
 *
 * ⚠️ AND THE SECOND WAS BLIND FOR A REASON WORTH WRITING: this suite's fixture had no `#tts-ppm`, so the rate renderer left
 * at its first `if (!sel) return` and there was nothing to measure. A control the panel builds and the test scenario does
 * not have is a hole no case count shows.
 */
describe('ui/settings-audio — o que a voz reflecte', () => {
  it('🔴 [Right] o interruptor da narração e o motor escolhido DIZEM o estado guardado', () => {
    const { ctx, audioCat, tts } = fullCtx();
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    audioCat.tts.on = true;
    tts.setEngineSel('kokoro');
    api.reflectTts();
    expect(document.querySelector('#opt-tts').getAttribute('aria-pressed'), 'o botão não diz que a narração está ligada').toBe('true');
    expect(document.querySelector('#tts-engine').value, 'o motor escolhido não aparece na lista').toBe('kokoro');
  });

  it('⚠️ [Inverse] e desligada, ele diz isso — é a mesma função a responder as duas coisas', () => {
    const { ctx, audioCat } = fullCtx();
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    audioCat.tts.on = false;
    api.reflectTts();
    expect(document.querySelector('#opt-tts').getAttribute('aria-pressed')).toBe('false');
  });

  it('🔴 [Right] a lista de ritmo da fala nasce com os passos do ADR-0196 e com o valor guardado escolhido', () => {
    const antes = speechPpm;
    setSpeechPpmValue(SPEECH_RATES[2]);
    const { ctx } = fullCtx();
    initSettingsAudio(ctx).renderAudio();
    const sel = document.querySelector('#tts-ppm');
    expect([...sel.options].map((o) => Number(o.value)), 'a lista de ritmo não é a do registo').toEqual([...SPEECH_RATES]);
    expect(Number(sel.value), 'a lista abriu num ritmo que a criança não escolheu').toBe(SPEECH_RATES[2]);
    setSpeechPpmValue(antes);
  });
});


// ==========================================================================================================
// THE FIVE BRANCHES THE PROBE FOUND BLIND (ADR-0221 step 7c, 2026-09-23)
//
// 📏 The thirteen decisions of this panel switched off one by one, against the ten files that touch it: eight turned
// red and FIVE green. Three of the five had, beside them, a comment arguing exactly what nothing held — and a comment
// that declares a rule is not a gate.
// ==========================================================================================================
describe('ui/settings-audio — o que a sonda achou cego', () => {
  it('🔴 [Right] trocar a saída FECHA o contexto de áudio antigo — senão o som continua no aparelho anterior', async () => {
    // 🔴 THE COSTLIEST OF THE FIVE, and it is what the child feels without seeing: the line that closes the context could
    // be deleted with the whole suite green. Without it, the choice appears made in the list and the sound keeps coming
    // out of the previous device — the control answers and the world does not, which is the most frustrating kind of
    // defect for whoever depends on their own headphones to hear their game in a room with twenty other people.
    stubMediaDevices({ devices: [{ deviceId: 'd1', kind: 'audiooutput', label: 'Fone USB' }] });
    let fechado = false;
    const player = { audioSink: null, _ac: { close: () => { fechado = true; } }, _acOut: {} };
    const { ctx } = fullCtx({ players: [player] });
    initSettingsAudio(ctx).renderAudio();
    await flush();
    const sel = document.querySelector('#audio-sinks select');
    sel.value = 'd1';
    sel.dispatchEvent(new Event('change'));
    expect(fechado, 'o contexto antigo ficou aberto: o som continua na saída de antes').toBe(true);
    expect(player._ac, 'o contexto fechado continua pendurado no jogador').toBeNull();
    expect(player._acOut, 'a saída do contexto antigo continua pendurada no jogador').toBeNull();
  });

  it('🔴 [Right] um contexto que RECUSA fechar não derruba a troca — a escolha vale na mesma', async () => {
    // The pair of the case above: `close()` can throw on an already closed context, and the child must not lose the
    // choice because of it. That is why the `try` exists, and without this case it could be deleted.
    stubMediaDevices({ devices: [{ deviceId: 'd1', kind: 'audiooutput', label: 'Fone USB' }] });
    const player = { audioSink: null, _ac: { close: () => { throw new Error('already closed'); } }, _acOut: {} };
    const { ctx, store } = fullCtx({ players: [player] });
    initSettingsAudio(ctx).renderAudio();
    await flush();
    const sel = document.querySelector('#audio-sinks select');
    sel.value = 'd1';
    expect(() => sel.dispatchEvent(new Event('change'))).not.toThrow();
    expect(player.audioSink).toBe('d1');
    expect(store.get('incl_sink_p0')).toBe('d1');
  });

  it('🔴 [Boundary] um navegador que NÃO CONSEGUE ouve outra frase, e não a de «clique em Detectar»', async () => {
    // 📌 There are two sentences in the dictionary because there are two situations: «ainda não procurei» asks the child
    // for an action, «este navegador não faz isso» tells her there is no action at all. They came out as one, and nothing
    // noticed — the fixture always stubs `mediaDevices`, so the «não consegue» path was never walked.
    const semMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    try {
      const { ctx } = fullCtx();
      initSettingsAudio(ctx).renderAudio();
      await flush();
      const texto = document.querySelector('#audio-sinks').textContent;
      expect(texto, 'a secção ficou muda num navegador que não consegue').toBeTruthy();
      expect(texto, 'pede «Detectar» a quem não tem o que detectar').not.toContain('Detectar');
    } finally {
      if (semMediaDevices) Object.defineProperty(navigator, 'mediaDevices', semMediaDevices);
    }
  });

  it('🔴 [Right] a prosa volta ao rodapé depois de a lista ser reconstruída (CLAUDE.md §4, #109)', () => {
    // The category list is rebuilt on every render, and the new rows come back with the prose inside. Without this call
    // the menu becomes the manual the decision of 2026-08-25 forbade, from the first click on.
    const cartoes = [];
    const { ctx } = fullCtx({ ctxOver: { fillExplain: (card) => cartoes.push(card) } });
    initSettingsAudio(ctx).renderAudio();
    expect(cartoes.length, 'a prosa não foi devolvida ao rodapé depois do redesenho').toBeGreaterThan(0);
  });

  it('🔴 [Interface] e no rodapé do cartão QUE TEM A LISTA, não no primeiro da página (ADR-0151)', () => {
    // 📌 There are TWO panels (ADR-0151) — «Conforto auditivo» and «Áudio» —, and the other one's footer is not this
    // child's: writing in it leaves the explanation on a screen she is not looking at and the screen where she is mute.
    document.body.innerHTML = '<div class="overlay"><div class="overlay__card" id="outro"></div></div>'
      + '<div class="overlay"><div class="overlay__card" id="oDaLista">' + AUDIO_HTML + '</div></div>';
    const cartoes = [];
    const { ctx } = fullCtx({ ctxOver: { fillExplain: (card) => cartoes.push(card) } });
    initSettingsAudio(ctx).renderAudio();
    expect(cartoes.length).toBeGreaterThan(0);
    for (const card of cartoes) {
      expect(card?.id, 'a prosa foi para o cartão errado — o do outro painel').not.toBe('outro');
    }
    expect(cartoes.some((c) => c?.id === 'oDaLista'), 'nenhuma passagem escreveu no cartão que tem a lista').toBe(true);
  });

  it('🔴 [Right] o volume-mestre da navegação mostra onde está, e não zero', () => {
    const cat = freshAudioCat();
    for (const k of NAV_CATS) { cat[k].on = true; cat[k].vol = 0.4; }
    const { ctx } = fullCtx({ audioCat: cat });
    initSettingsAudio(ctx).renderAudio();
    const m = document.querySelector('#navsound-master');
    expect(m.value, 'o cursor do mestre da navegação não foi posto no valor de agora').toBe('40');
  });
});

// -----------------------------------------------------------------------------------------------------------
/*
 * 🔴 THE BROWSER ARRIVES THROUGH PORTS, AND THAT HAS TO BE OBSERVABLE (ADR-0227; the Dev, 23/09: «(a)»).
 *
 * 📏 This was the last module of step 7d with `globalReach 3` — `document`, `window.speechSynthesis` and
 * `navigator.mediaDevices` — against a ceiling of ZERO. The two cases below are the record's confirmation, and the
 * second is the property the ports exist to buy: if the module reached a global, it would BLOW UP.
 */
describe('as três portas do navegador (ADR-0227)', () => {
  it('⚠️ [Zero] um aparelho SEM vozes recebe a frase, e não um controle vazio', async () => {
    /*
     * 🎯 THIS IS THE DIFFERENCE BETWEEN OPTION (a) AND OPTION (c) OF THE RECORD. An EMPTY list is the host answering
     * «este aparelho não tem vozes», and the panel knows what to do with that since ADR-0185: say it in the child's
     * language. An ABSENT port would be the host keeping quiet, and a `<select>` with nothing inside looks like a broken
     * menu — which is §5 of ADR-0106.
     */
    const { ctx } = fullCtx({ ctxOver: { speech: { voices: () => [], speakSample: () => {}, whenVoicesChange: () => {} } } });
    initSettingsAudio(ctx).renderAudio();
    const sel = document.querySelector('#tts-voice');
    expect(sel, 'o painel não montou o selector de voz').toBeTruthy();
    expect(sel.options.length, 'uma lista vazia não pode virar um selector vazio').toBeGreaterThan(0);
    const dito = [...sel.options].map((o) => o.textContent).join(' | ');
    expect(dito, 'o painel não DISSE que não há vozes — ficou calado').toContain(tr('audio.noSystemVoices'));
  });

  it('🔴 [Right] o painel desenha com os globais a LANÇAR — se ele os alcançasse, rebentava', async () => {
    /*
     * ⚠️ THE SHAPE OF THE CASE IS WHAT MAKES IT A GATE. «Não alcança o global» cannot be observed by reading the module;
     * what can be observed is the module working when touching the global is an error. The three globals throw, the
     * ports answer without them, and what is required is the WHOLE panel drawn: the categories, the outputs sentence and
     * the voice selector.
     */
    const explode = () => { throw new Error('o módulo alcançou um global do navegador'); };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, get: explode });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: explode });

    /*
     * 🔴 AND THE SPIES ARE WHAT MAKE THIS A GATE, measured by mutation: making the globals THROW catches
     * `window.speechSynthesis` and `navigator.mediaDevices`, and nothing else — because `document` still exists in a
     * browser test, and because `enumerateSinks`'s `catch` swallows the difference between «a porta respondeu vazio» and
     * «o global rebentou». 📌 The property that matters is not «não rebenta»: it is the panel ASKING the port, and a spy
     * observes exactly that.
     */
    const asked = { elements: [], list: 0, voices: 0 };
    const { ctx } = fullCtx({
      ctxOver: {
        newElement: (tag) => { asked.elements.push(tag); return document.createElement(tag); },
        speech: {
          voices: () => { asked.voices++; return []; },
          speakSample: () => {},
          whenVoicesChange: () => {},
        },
        audioOutputs: {
          canList: () => true,
          canRoute: () => true,
          list: async () => { asked.list++; return []; },
          detect: async () => [],
        },
      },
    });
    const api = initSettingsAudio(ctx);
    expect(() => api.renderAudio(), 'o painel alcançou um global em vez de usar a porta').not.toThrow();
    await Promise.resolve();

    expect(document.querySelectorAll('#audio-list .ctrl-row').length, 'as categorias não foram desenhadas').toBeGreaterThan(0);
    expect(document.querySelector('#tts-voice'), 'o selector de voz não foi montado').toBeTruthy();
    const sinks = document.querySelector('#audio-sinks');
    expect(sinks && sinks.textContent, 'a secção das saídas ficou muda').toBeTruthy();

    expect(asked.elements, 'o `<option>` não saiu da porta — saiu do `document` global').toContain('option');
    expect(asked.voices, 'as vozes não foram pedidas à porta').toBeGreaterThan(0);
    expect(asked.list, 'as saídas não foram pedidas à porta — foram ao `navigator`').toBeGreaterThan(0);
  });
});
