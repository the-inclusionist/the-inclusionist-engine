// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/settings-audio — render/wiring DOM (project BROWSER: usa document + navigator.mediaDevices +
// window.speechSynthesis). A lógica pura (rótulos/percentuais/validação) já é coberta no teste node; aqui só o
// que exige DOM real: renderAudio() recria as listas de categoria e refia os widgets estáticos; os cliques mutam
// o audioCat VIVO injetado e chamam setCatGain; modo cego/bengala delegam ao game.js via ctx; TTS e saídas de
// áudio populam <select> a partir de APIs de navegador (stubadas aqui). Ver docs/5-Refactoring/plano-
// modularizacao-mapa.md (Estágio 4, ui/settings-audio) e tests/a11y-sr.browser.test.js (modelo de injeção).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initSettingsAudio, NAV_CATS, GEN_CATS } from '../app/js/ui/settings-audio.js';

const AUDIO_HTML = `
  <div id="audio">
    <div class="ctrl-row"><button id="opt-modocego" type="button" aria-pressed="false">▶ Desligado</button></div>
    <select id="cane-div"><option value="1">bloco</option><option value="2">meio bloco</option></select>
    <input id="navsound-master" type="range" min="0" max="100" step="5">
    <div id="navsound-list"></div>
    <button id="opt-tts" type="button" aria-pressed="false">▶ Desligado</button>
    <select id="tts-engine"></select>
    <select id="tts-voice"></select>
    <button id="opt-tts-test" type="button">Testar</button>
    <input id="tts-vol" type="range" min="0" max="100" step="5">
    <div id="audio-sinks"></div>
    <button id="audio-detect" type="button">Detectar</button>
    <button id="audio-master" type="button" aria-pressed="true">🔊 Ligado</button>
    <input id="audio-master-vol" type="range" min="0" max="100" step="5" value="60">
    <div id="audio-list"></div>
    <button id="opt-sound" type="button">Som</button>
    <button id="audio-reset" type="button">Restaurar padrões deste menu</button>
  </div>
  <button data-act="audio" class="pm-btn" type="button">Acessibilidade auditiva</button>`;

const AUDIO_CATS = [
  { k: 'music', lbl: 'Música' }, { k: 'ambient', lbl: 'Sons ambiente' }, { k: 'interact', lbl: 'Interação' },
  { k: 'earcons', lbl: 'Earcons' }, { k: 'other', lbl: 'Outros' }, { k: 'tts', lbl: 'Narração (TTS)' },
  { k: 'sonar', lbl: 'Sonar' }, { k: 'guard', lbl: 'Guarda' }, { k: 'guide', lbl: 'Guia' },
];

function freshAudioCat() {
  const cat = {};
  [...GEN_CATS, ...NAV_CATS, 'tts'].forEach((k) => { cat[k] = { on: k !== 'tts', vol: 0.8 }; });
  return cat;
}

function fullCtx(over = {}) {
  const said = [];
  const store = new Map();
  const catGainCalls = [];
  const audioCat = over.audioCat || freshAudioCat();
  let soundOn = over.soundOn ?? true;
  let volume = over.volume ?? 0.6;
  let modoCego = over.modoCego ?? false;
  let caneBlockDiv = over.caneBlockDiv ?? 1;
  const players = over.players || [{ audioSink: null }];
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
    audioCats: AUDIO_CATS,
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
    getModoCego: () => modoCego,
    setModoCego: (v) => { modoCego = v; },
    getCaneBlockDiv: () => caneBlockDiv,
    setCaneBlockDiv: (v) => { caneBlockDiv = v; },
    ...over.ctxOver,
  };
  return { ctx, said, store, catGainCalls, audioCat, players, tts, getSoundOn: () => soundOn, getVolume: () => volume, getModoCego: () => modoCego, getCaneBlockDiv: () => caneBlockDiv };
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
    slider.dispatchEvent(new Event('input'));
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
    expect(btn.textContent).toBe('🔇 Desligado');
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
    const { ctx, getModoCego } = fullCtx({ modoCego: false });
    initSettingsAudio(ctx);
    const btn = document.querySelector('#opt-modocego');
    btn.click();
    expect(getModoCego()).toBe(true);
    expect(btn.textContent).toBe('❚❚ Ligado');
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
  it('[Interface] renderAudio() preenche #tts-engine com os 5 motores e seleciona o atual', () => {
    const { ctx } = fullCtx();
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    const sel = document.querySelector('#tts-engine');
    expect(sel.options.length).toBe(5);
    expect(sel.value).toBe('webspeech');
  });

  it('[Interface] renderAudio() só preenche #tts-engine UMA vez (dataset.filled trava novas chamadas)', () => {
    const { ctx } = fullCtx();
    const api = initSettingsAudio(ctx);
    api.renderAudio();
    api.renderAudio();
    expect(document.querySelector('#tts-engine').options.length).toBe(5);
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
    expect([...rows[0].options].map((o) => o.textContent)).toEqual(['Padrão (compartilhado)', 'Fone USB']); // só audiooutput
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
  // O caso que importa mais não é o de o reset funcionar: é o de ele NÃO alcançar fora de si. Um reset que
  // apagasse em silêncio a configuração motora seria pior que a armadilha que ele existe para desfazer — a
  // criança desfaz um ajuste de som e perde o que a deixava jogar, sem relação visível entre uma coisa e outra.
  it('[Right] devolve modo cego, bengala e as categorias do mixer ao padrão de fábrica', () => {
    const cat = freshAudioCat();
    cat.music.on = false; cat.music.vol = 0.1;   // mexido
    cat.tts.on = true;                            // o TTS nasce DESLIGADO, então isto é desvio
    const { ctx, said, getModoCego, getCaneBlockDiv } = fullCtx({ audioCat: cat, modoCego: true, caneBlockDiv: 2 });
    initSettingsAudio(ctx);
    document.querySelector('#audio-reset').click();
    expect(getModoCego()).toBe(false);
    expect(getCaneBlockDiv()).toBe(1);
    expect(cat.music).toEqual({ on: true, vol: 0.8 });
    expect(cat.tts).toEqual({ on: false, vol: 0.8 }); // volta a DESLIGADO, o padrão dele
    expect(said.at(-1)).toContain('auditiva');
  });

  it('[Interface] NÃO toca no que não é deste menu — motor de voz e saída de áudio ficam', () => {
    // Escolha de DISPOSITIVO não é preferência restaurável: zerar a saída tiraria da criança o fone que é
    // dela numa sala compartilhada, e trocar o motor de voz a deixaria sem a voz que ela entende.
    const players = [{ audioSink: 'fone-da-crianca' }];
    const { ctx, tts } = fullCtx({ players });
    tts.setEngineSel('piper');
    initSettingsAudio(ctx);
    document.querySelector('#audio-reset').click();
    expect(tts.getEngineSel()).toBe('piper');
    expect(players[0].audioSink).toBe('fone-da-crianca');
  });
});

describe('ui/settings-audio — marca o que saiu do padrão (ADR-0029)', () => {
  // `#audio-list` nasce vazio: quem o preenche é `renderAudio()`, como no jogo ao abrir o painel.
  const montar = (over) => { const { ctx } = fullCtx(over); initSettingsAudio(ctx).renderAudio(); return ctx; };
  // Estes casos existem porque os primeiros não existiam. Eu tinha pendurado a marca no `renderAudio()`, e os
  // testes chamavam `render()` explicitamente — então passavam. No jogo a marca não aparecia: mexer numa
  // categoria atualiza a linha sozinha, sem redesenhar o painel. Por isso aqui se CLICA, como a criança faz.
  it('[Right] clicar uma categoria marca a linha dela e o botão do menu', () => {
    montar();
    document.querySelector('#audio-list button[data-acat="music"]').click();
    const linha = document.querySelector('#audio-list button[data-acat="music"]').closest('.ctrl-row');
    expect(linha.classList.contains('is-changed')).toBe(true);
    expect(document.querySelector('[data-act="audio"]').classList.contains('is-changed')).toBe(true);
  });

  it('[Right] clicar de volta APAGA a marca — a música volta ao padrão, e a marca some com ela', () => {
    montar();
    const b = () => document.querySelector('#audio-list button[data-acat="music"]');
    b().click();
    b().click();
    expect(b().closest('.ctrl-row').classList.contains('is-changed')).toBe(false);
    expect(document.querySelector('[data-act="audio"]').classList.contains('is-changed')).toBe(false);
  });

  it('[Right] o reset limpa todas as marcas do menu', () => {
    montar({ modoCego: true });
    document.querySelector('#audio-list button[data-acat="music"]').click();
    expect(document.querySelectorAll('.is-changed').length).toBeGreaterThan(0);
    document.querySelector('#audio-reset').click();
    expect(document.querySelectorAll('.is-changed')).toHaveLength(0);
  });
});
