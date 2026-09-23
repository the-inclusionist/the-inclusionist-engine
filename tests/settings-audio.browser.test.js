// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-audio — render/wiring DOM (project BROWSER: usa document + navigator.mediaDevices +
// window.speechSynthesis). A lógica pura (rótulos/percentuais/validação) já é coberta no teste node; aqui só o
// que exige DOM real: renderAudio() recria as listas de categoria e refia os widgets estáticos; os cliques mutam
// o audioCat VIVO injetado e chamam setCatGain; modo cego/bengala delegam ao game.js via ctx; TTS e saídas de
// áudio populam <select> a partir de APIs de navegador (stubadas aqui). Ver docs/5-Refactoring/plano-
// modularizacao-mapa.md (Estágio 4, ui/settings-audio) e tests/a11y-sr.browser.test.js (modelo de injeção).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initSettingsAudio } from '../app/js/ui/settings-audio.js';
import { NAV_CATS, GEN_CATS } from '../app/js/ui/audio-choices.js';
import { defaultAudioCat } from '../app/js/platform/audio-mixer.js';
import { menuIndexOn, setMenuIndexOnValue, speechPpm, setSpeechPpmValue } from '../app/js/core/state.js';
import { SPEECH_RATES } from '../app/js/core/speech-rate.js';

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
 * O estado de FÁBRICA das categorias — pedido a `defaultAudioCat`, não recopiado.
 *
 * Era `{ on: k !== 'tts', vol: 0.8 }` escrito aqui, uma segunda cópia da regra. Ela divergiu no dia em que o
 * `guide` passou a nascer desligado (2026-08-26): a fixture continuou nascendo com ele LIGADO, e a marca de
 * "saiu do padrão" do ADR-0029 apareceu num menu que ninguém tinha tocado. O caso reprovou e estava certo —
 * era a cópia que estava errada, não o código.
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
  // O catálogo é do HOSPEDEIRO, e passou a ser sobreponível quando a lista virou nós: o que antes se media
  // dando uma lista de categorias à construtora de markup mede-se agora dizendo ao painel que o hospedeiro
  // nomeia outras — é a mesma pergunta, feita pelo caminho que existe.
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
    getModoCego: () => blindMode,
    setModoCego: (v) => { blindMode = v; },
    getCaneBlockDiv: () => caneBlockDiv,
    setCaneBlockDiv: (v) => { caneBlockDiv = v; },
    ...over.ctxOver,
  };
  return { ctx, said, store, catGainCalls, audioCat, players, tts, getSoundOn: () => soundOn, getVolume: () => volume, getModoCego: () => blindMode, getCaneBlockDiv: () => caneBlockDiv };
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
   * 🔴 AS CINCO AFIRMAÇÕES QUE VIVIAM SOBRE A CADEIA (BREAKING, nota BV). Eram casos de node sobre
   * `catRowHTML`/`catsListHTML`, que liam a marcação como TEXTO; a lista passou a ser montada em NÓS, e o que
   * elas exigiam passou a ser observável só num documento. Nenhuma exigência caiu: o rótulo, a percentagem do
   * cursor, o estado do interruptor, a ordem e a chave sem nome continuam presos, agora pelo caminho que existe.
   *
   * 🎯 E DUAS SÃO NOVAS, porque só a forma nova as torna possíveis: a linha que FICA é o MESMO nó entre dois
   * renders (que é o que impede o cursor de cair de quem está a mexer no volume) e a linha que perde o nome é
   * removida. Uma cadeia rebentava tudo a cada render e nenhuma das duas perguntas fazia sentido.
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
    // «Não se oferece o que não tem nome»: um interruptor sem rótulo é um botão que a criança não sabe o que faz.
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
    // ⚠️ COM BOLHA, como um `input` de verdade: a especificação diz que um `input` disparado por interacção
    // BORBULHA, e a escuta desta lista passou a ser por delegação quando o painel virou nós — as linhas de
    // categoria vêm e vão com o cartucho, e ligar controle a controle a cada render acumulava escutas. Um
    // despacho sem bolha era uma forma que nenhum caminho real usa.
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
    const { ctx, getModoCego } = fullCtx({ blindMode: false });
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
    // O índice "6 de 10" nasce LIGADO — quem precisa dele para se orientar não tem como descobrir que ele
    // existe se vier desligado. Este caso prova o caminho de DESLIGAR, que é o que a XAG 106 exige que exista.
    const inicial = menuIndexOn;
    try {
      const { ctx, said } = fullCtx();
      initSettingsAudio(ctx);
      const btn = document.querySelector('#opt-menuindex');
      btn.click();
      expect(menuIndexOn).toBe(!inicial);
      expect(btn.getAttribute('aria-pressed')).toBe(String(!inicial));
      expect(said.at(-1)).toBe(inicial ? 'Posição na lista desligada.' : 'Posição na lista ligada.');
      btn.click(); // inverso: volta ao que era, e o anúncio acompanha
      expect(menuIndexOn).toBe(inicial);
      expect(said.at(-1)).toBe(inicial ? 'Posição na lista ligada.' : 'Posição na lista desligada.');
    } finally {
      setMenuIndexOnValue(inicial); // `core/state` é módulo: o valor sobrevive ao caso e vazaria para os outros
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
  it('[Right] devolve modo cego, bengala, navegação e narração ao padrão — e NÃO a música, que é do «Áudio»', () => {
    const cat = freshAudioCat();
    cat.music.on = false; cat.music.vol = 0.1;   // mexido, mas no OUTRO painel desde o ADR-0151
    cat.sonar.vol = 0.2;                          // mexido, e deste painel
    cat.tts.on = true;                            // o TTS nasce DESLIGADO, então isto é desvio
    const { ctx, said, getModoCego, getCaneBlockDiv } = fullCtx({ audioCat: cat, blindMode: true, caneBlockDiv: 2 });
    initSettingsAudio(ctx);
    document.querySelector('#audio-reset').click();
    expect(getModoCego()).toBe(false);
    expect(getCaneBlockDiv()).toBe(1);
    expect(cat.sonar).toEqual(defaultAudioCat('sonar'));
    expect(cat.tts).toEqual({ on: false, vol: 0.8 }); // volta a DESLIGADO, o padrão dele
    // 🔴 O ESCOPO: repor a acessibilidade auditiva não alcança o painel ao lado.
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
    // Escolha de DISPOSITIVO não é preferência restaurável: zerar a saída tiraria da criança o fone que é
    // dela numa sala compartilhada, e trocar o motor de voz a deixaria sem a voz que ela entende.
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
    // ⚠️ A MARCA VAI AO MENU DE QUEM TEM A LINHA: a música é do «Áudio», e acender a acessibilidade auditiva
    // mandaria a criança procurar no painel errado.
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
    // cada «repor» limpa o que é seu; os dois juntos limpam o documento
    document.querySelector('#audio-reset').click();
    document.querySelector('#som-reset').click();
    expect(document.querySelectorAll('.is-changed')).toHaveLength(0);
  });
});

describe('ui/settings-audio — o painel ASSINA o modo cego (ADR-0106 §4)', () => {
  it('⚠️ [Interface] o botão #opt-modocego acompanha uma mudança feita FORA do painel', async () => {
    // O defeito que este caso impede é o controlo a MENTIR o estado para o leitor de tela: a criança liga o
    // modo cego pelo ícone da barra rápida, abre este painel, e o botão diz «Desligado» com
    // aria-pressed=false. É o gémeo exacto do defeito do `reflectTTS` já registado no `ui/pause-icons`, e a
    // saída é a que o `core/state` já tinha escrito ao lado do `setBlindModeValue`: quem reage assina o evento.
    const estado = await import('../app/js/core/state.js');
    let cego = estado.blindMode;
    const { ctx } = fullCtx({});
    ctx.getModoCego = () => cego;
    initSettingsAudio(ctx);

    const btn = document.querySelector('#opt-modocego');
    expect(btn.getAttribute('aria-pressed')).toBe(String(cego));

    cego = !cego;
    estado.setBlindModeValue(cego);          // ninguém tocou no painel — só no estado

    expect(btn.getAttribute('aria-pressed'), 'o painel não acompanhou o evento').toBe(String(cego));
    estado.setBlindModeValue(!cego);
  });
});

// ========================= MUTACOES CONFERIDAS (ADR-0106 §4, etapa 1b) =========================
//   · tirando o `state.on('blindMode', …)` do fim de `initSettingsAudio` -> reprova o caso acima. Sem ele, um
//     jogo que nao injecta o seu proprio `setModoCego` deixa este botao a mentir o estado.
//   · trocando a assinatura por `state.on('blindMode', () => {})` (assina e nao reage) -> reprova tambem, que
//     e a medida de que o caso afirma o EFEITO e nao a subscricao.

describe('ui/settings-audio — o modo cego ANUNCIA, como os cinco irmãos deste painel', () => {
  it('⚠️ [Interface] ligar pelo painel diz o estado NOVO — um alternador mudo é invisível a leitor de tela', () => {
    // 📏 Medido em 2026-09-08: os cinco irmãos deste painel anunciam (som, TTS, divisor da bengala, índice de
    // menu, saída de áudio) e o modo cego NÃO — ele parecia anunciar porque UM cartucho o fazia a partir do
    // próprio `setModoCego`, e o painel herdava o efeito de graça.
    //
    // ⚠️ E o silêncio ficou ALCANÇÁVEL no mesmo dia: com `setModoCego` a ganhar padrão da engine
    // (`setBlindModeValue`, que grava/persiste/avisa e não fala), um jogo que não injecta o seu setter ficava
    // com este botão mudo — a mesma família do `reflectTTS`, que já custou um controlo a mentir o estado.
    let cego = false;
    const { ctx, said } = fullCtx({});
    ctx.getModoCego = () => cego;
    ctx.setModoCego = (on) => { cego = on; };
    initSettingsAudio(ctx);

    document.querySelector('#opt-modocego').click();
    expect(cego, 'o botão não mexeu no estado').toBe(true);
    // O literal é pinado, e não lido por `t()`: afirmar pelo dicionário mediria a ida e a volta pela mesma
    // tabela, e as duas metades mover-se-iam juntas.
    expect(said.at(-1), 'ligou sem dizer nada').toBe('Modo cego ligado: bengala e pistas de áudio ativas. O 1º item de poder vira a bengala de corrida.');

    document.querySelector('#opt-modocego').click();
    expect(cego).toBe(false);
    // ⚠️ E o anúncio conta o estado NOVO, não o que a criança acabou de deixar — por isso ele vem DEPOIS do
    // `setModoCego`, e é o que esta segunda metade prende.
    expect(said.at(-1)).toBe('Modo cego desligado.');
  });
});

// ========================= MUTACOES CONFERIDAS (o anuncio do modo cego) =========================
//   · tirando o `ctx.srSay(...)` do clique -> reprova. E o defeito que existia ate hoje.
//   · movendo o `srSay` para ANTES do `setModoCego` -> reprova, porque passa a anunciar o estado que a
//     crianca acabou de deixar. E a mesma regra do icone da barra rapida, e nenhum dos dois a tinha escrita.

// ===================================================================================================
// THE VOICE CHOICE AND THE LOCK (ADR-0185; issue #180)
// ===================================================================================================
const DORA = { locale: 'pt-BR', engine: 'kokoro', voice: 'pf_dora' };
const OUTRA = { locale: 'pt-BR', engine: 'kokoro', voice: 'pm_alex' };
function comVozes(vozes) {
  const r = fullCtx({});
  let escolhida = null;
  Object.assign(r.tts, {
    vozes: () => vozes,
    vozAtual: () => vozes.find((v) => v.voice === escolhida) ?? vozes[0] ?? null,
    setVoz: (id) => { if (!vozes.some((v) => v.voice === id)) return false; escolhida = id; return true; },
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
    const HEART = { locale: 'en-US', engine: 'kokoro', voice: 'af_heart', boa: true };
    const { ctx, said, tts } = comVozes([HEART, { locale: 'en-US', engine: 'kokoro', voice: 'am_adam' }]);
    initSettingsAudio(ctx).renderAudio();
    const sel = document.querySelector('#tts-voz');
    expect([...sel.options].map((o) => o.textContent)).toEqual(['❤️ Heart', 'Adam']);
    sel.value = 'af_heart';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(tts.vozAtual().voice).toBe('af_heart');
    expect(said.at(-1) ?? '', 'the heart is spoken').not.toMatch(/❤️/);
  });

  it('🔴 [Right] the list opens on the voice in use, even when it is not the first', () => {
    // a <select> opens on its first option by itself, so only a pick further down shows the list was set
    const { ctx, tts } = comVozes([DORA, OUTRA]);
    tts.setVoz('pm_alex');
    initSettingsAudio(ctx).renderAudio();
    expect(document.querySelector('#tts-voz').value).toBe('pm_alex');
  });

  it('🔴 [Right] picking a voice sets it and says it', () => {
    const { ctx, tts, said } = comVozes([DORA, OUTRA]);
    initSettingsAudio(ctx).renderAudio();
    const sel = document.querySelector('#tts-voz');
    sel.value = 'pm_alex';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(tts.vozAtual().voice).toBe('pm_alex');
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
 * ============== AS DUAS PEÇAS DA VOZ QUE NINGUÉM VIA (2026-09-22, ADR-0221 passo 7c) ==============
 *
 * 🔴 MEDIDO ANTES DE MEXER, como no `pollPads`: as sete peças do bloco da voz foram desligadas, uma de cada vez, e a suíte
 * respondeu por cinco delas. Ficaram VERDES o `reflectTts` — o espelho do interruptor da narração e do motor escolhido, que
 * a barra de ícones chama de fora por `reflectTtsPanel` — e o `renderRitmo`, a lista de ritmo da fala.
 *
 * ⚠️ E O SEGUNDO ESTAVA CEGO POR UM MOTIVO QUE VALE ESCREVER: a fixture desta suíte não tinha `#tts-ppm`, logo o
 * `renderRitmo` saía no primeiro `if (!sel) return` e não havia o que medir. Um controle que o painel constrói e que o
 * cenário de teste não tem é um buraco que nenhuma contagem de casos mostra.
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
// OS CINCO RAMOS QUE A SONDA ACHOU CEGOS (ADR-0221 passo 7c, 2026-09-23)
//
// 📏 As treze decisões deste painel desligadas uma a uma, contra os dez ficheiros que lhe tocam: oito ficaram
// vermelhas e CINCO verdes. Três das cinco tinham, ao lado, um comentário a argumentar exactamente o que nada
// segurava — e um comentário que declara uma regra não é um portão.
// ==========================================================================================================
describe('ui/settings-audio — o que a sonda achou cego', () => {
  it('🔴 [Right] trocar a saída FECHA o contexto de áudio antigo — senão o som continua no aparelho anterior', async () => {
    // 🔴 O MAIS CARO DOS CINCO, e é o que a criança sente sem ver: a linha que fecha o contexto podia ser apagada
    // com a suíte inteira verde. Sem ela, a escolha aparece feita na lista e o som continua a sair pelo aparelho
    // de antes — o controle responde e o mundo não, que é a forma mais frustrante de defeito para quem depende
    // de um fone próprio para ouvir o seu jogo numa sala com outras vinte pessoas.
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
    // O par do caso acima: `close()` pode lançar num contexto já fechado, e a criança não pode perder a escolha
    // por causa disso. É por essa razão que o `try` existe, e sem este caso ele podia ser apagado.
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
    // 📌 São duas frases no dicionário porque são duas situações: «ainda não procurei» pede uma acção à criança,
    // «este navegador não faz isso» diz-lhe que não há acção nenhuma. Saíam como uma só, e nada reparava — a
    // fixture estuba sempre o `mediaDevices`, logo o caminho do «não consegue» nunca era percorrido.
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
    // A lista de categorias é refeita a cada render, e as linhas novas voltam com a prosa lá dentro. Sem esta
    // chamada o menu vira o manual que a decisão de 2026-08-25 proibiu, a partir do primeiro clique.
    const cartoes = [];
    const { ctx } = fullCtx({ ctxOver: { fillExplain: (card) => cartoes.push(card) } });
    initSettingsAudio(ctx).renderAudio();
    expect(cartoes.length, 'a prosa não foi devolvida ao rodapé depois do redesenho').toBeGreaterThan(0);
  });

  it('🔴 [Interface] e no rodapé do cartão QUE TEM A LISTA, não no primeiro da página (ADR-0151)', () => {
    // 📌 São DOIS painéis desde o ADR-0151 — «Conforto auditivo» e «Áudio» —, e o rodapé do outro não é o desta
    // criança: escrever nele deixa a explicação numa tela que ela não está a ver e a tela onde ela está muda.
    // O comentário ao lado desta linha dizia isto desde o dia em que foi escrita; nada o segurava.
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
