// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/pause-icons — a barra de ícones de acessibilidade da pausa (.pi-btn) e o menu por tela.
// Project NODE: lógica PURA (rótulos, ciclos, plano do modo TEA, markup) + as cascas de reflexo com DOM FALSO
// (objetos simples, no estilo de tests/gamepad.node.test.js — nenhum `document` real). A casca que só existe
// no navegador (buildScreenPause, que usa document.createElement/innerHTML) vive em pause-icons.browser.test.js.
//
// O QUE ESTES TESTES PROTEGEM, acima de tudo: o contrato de acessibilidade dos ícones. Um `.pi-btn` é um toggle
// de estado alheio (modo cego, TTS, Libras, TEA, teclas de alternância, contraste, daltonismo) — se o
// `aria-label` não disser o estado ATUAL, o botão é invisível para quem usa leitor de tela, e essa é a razão de
// `iconLabel`/`computeIconLabel` existirem. Daí os invariantes: todo ícone tem rótulo não-vazio, o rótulo muda
// quando o estado muda, e um ícone `em construção` nunca se declara ligado.
// ZOMBIES (Zero/One/Many/Boundary/Interface/Exception/Simple) + Right-BICEP.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import pt from '../app/js/i18n/pt.js';
import {
  PAUSE_ICONS, CALM_AUDIO_CATS, CVD_SEQ, CVD_NAMES,
  hasPrivateOutputIn, nextCalmMode, nextContrast, nextCvd, calmAudioPlan, calmMotionPlan,
  computeIconLabel, computeIconVisual, ICON_STATE_CLASSES,
  iconBtnMarkup, iconsMarkup, pmBtnMarkup, screenPauseMarkup,
  initPauseIcons,
} from '../app/js/ui/pause-icons.js';
import { CONTRAST_LEVELS } from '../app/js/ui/settings-visual.js';
import { createRunState } from '../app/js/core/run-state.js';
// A RODADA é local a este arquivo desde 2026-08-26 (ADR-0038, Fase B): `players`/`numPlayers` deixaram de
// ser `let` de `core/state` e passaram a viver na instância que a raiz de composição possui. Aqui o teste
// cria a sua, e os apelidos abaixo mantêm o corpo dos casos escrito como sempre esteve.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);
const numPlayers = () => rodada.numPlayers; // era binding vivo; virou função (o teste chama `numPlayers()`)


// SEM RÓTULO DINÂMICO: a resposta de um jogo cujo botão não tem rótulo próprio. Era `quizLevel` + `QL_NAME`,
// e o módulo montava a frase; agora ele recebe a frase ou `null` (item 19).
const SEM_DIN = () => null;

// ---------------------------------------------------------------------------------------------
// Fixtures — DOM falso (objetos simples) e um ctx falso que registra tudo o que foi chamado
// ---------------------------------------------------------------------------------------------

// classList mínimo: só o que reflectIconBtn usa (remove variádico, add, toggle com `force`, contains).
// `className` é derivado — reflectIconBtn no game.js original testava `/pi-cvd-/.test(b.className)`, então o
// fake precisa manter os dois em sincronia, senão o teste passaria por um motivo errado.
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
    _attrs: attrs,
  };
}

// "Tela de pausa" falsa: só precisa saber devolver seus .pi-btn.
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
  { act: 'letra', lbl: '🔠 ABC', letra: true },
  { act: 'quit', lbl: '🚪 Sair do jogo' },
];
const QL_NAME = { 1: 'pré-silábico', 2: 'silábico', 3: 'silábico-alfabético', 4: 'escritor', 5: 'escritor cego' };

function buildCtx(over = {}) {
  const said = [], alerted = [];
  const state = {
    modoCego: false, libras: false, pauseActor: -1,
    audioCat: makeAudioCat(),
    rm: { parallax: false, decor: false, items: false, particles: false },
    saved: 0, catGains: [], ttsPanelRefreshes: 0, toggleMoveCalls: [], vizCalls: [], librasToggles: 0,
    screens: [],
    acts: {},
  };
  const ctx = {
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    srSay: (m) => said.push(m),
    srAlert: (m) => alerted.push(m),
    pmButtons: PM_BTNS,
    qlName: QL_NAME,
    getPauseActs: () => state.acts,
    setPauseActor: (i) => { state.pauseActor = i; },
    getPauseScreens: () => state.screens,
    getModoCego: () => state.modoCego,
    setModoCego: (on) => { state.modoCego = on; },
    getAudioCat: () => state.audioCat,
    setCatGain: (k) => state.catGains.push(k),
    reflectTtsPanel: () => { state.ttsPanelRefreshes++; },
    reflectTtsPanelEnabled: false, // VERBATIM do game.js — ver o bug do `typeof reflectTTS` no relatório
    isLibrasOn: () => state.libras,
    toggleLibras: () => { state.librasToggles++; state.libras = !state.libras; },
    rm: state.rm,
    rmKeys: RM_KEYS,
    rmChar: RM_CHAR,
    saveRM: () => { state.saved++; },
    setToggleMove: (i, on) => { state.toggleMoveCalls.push([i, on]); const p = players[i]; if (p) p.toggleMove = on; },
    setPlayerViz: (i, mode) => { state.vizCalls.push([i, mode]); const p = players[i]; if (p) p.viz = mode; },
    ...over,
  };
  return { ctx, state, said, alerted };
}

// Popula core/state.players IN PLACE (o módulo real lê o binding vivo; nunca reatribui o array).
function setPlayers(list) {
  players.length = 0;
  list.forEach((p) => players.push(p));
  setNumPlayersValue(list.length || 1);
}

beforeEach(() => { setPlayers([{ viz: 'normal' }]); });

// =============================================================================================
// PURO — saída privada de áudio (o portão dos ícones de som)
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
// PURO — os três ciclos (TEA, contraste, daltonismo)
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
    expect(nextContrast('hc-direto')).toBe('hc-direto-45'); // este ESTÁ na lista; a assimetria é só p/ os de fora
  });

  it('INVARIANTE: os nomes de anúncio estão alinhados por índice com a sequência de modos', () => {
    expect(CVD_NAMES).toHaveLength(CVD_SEQ.length);
    // CVD_NAMES guarda CHAVES i18n desde a Fase 5; a assercao atravessa o dicionario para continuar
    // afirmando o que a pessoa ouve, e nao apenas que ha alguma chave la.
    expect(pt[CVD_NAMES[nextCvd('normal').idx]]).toBe('protanopia');
    expect(pt[CVD_NAMES[nextCvd('fix-tritan').idx]]).toBe('desligado');
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
    expect(calmAudioPlan(0, v1).vol).toBe(0.3); // e não 0.9 — ver o relatório
  });
});

// =============================================================================================
// PURO — o rótulo REFLETE o estado (o coração da acessibilidade destes botões)
// =============================================================================================
function snap(over = {}) {
  return {
    modoCego: false, ttsOn: false, librasOn: false, calmMode: 0,
    toggleMove: false, viz: 'normal', privateOutput: true, ...over,
  };
}

describe('computeIconLabel — o rótulo tem de dizer o estado', () => {
  it('INTERFACE: todo ícone com estado produz rótulo não-vazio nas duas pontas do toggle', () => {
    const on = snap({ modoCego: true, ttsOn: true, librasOn: true, calmMode: 2, toggleMove: true, viz: 'hc-direto' });
    for (const ic of PAUSE_ICONS) {
      expect(computeIconLabel(ic.k, snap()).length).toBeGreaterThan(0);
      expect(computeIconLabel(ic.k, on).length).toBeGreaterThan(0);
    }
  });

  it('os 5 toggles booleanos dizem on/off e MUDAM quando o estado muda', () => {
    const cases = [
      ['blind', 'modoCego', 'Modo cego (navegação sonora)'],
      ['tts', 'ttsOn', 'Narração por voz (TTS)'],
      ['libras', 'librasOn', 'Modo pessoa surda (Libras)'],
      ['altmove', 'toggleMove', 'Teclas de alternância'],
    ];
    for (const [k, flag, prefix] of cases) {
      // 'on'/'off' eram palavras INGLESAS dentro de uma frase em portugues — o defeito exato que a passada
      // de i18n existe para remover. Agora o estado tambem passa pelo dicionario.
      expect(computeIconLabel(k, snap({ [flag]: false }))).toBe(prefix + ': desligado');
      expect(computeIconLabel(k, snap({ [flag]: true }))).toBe(prefix + ': ligado');
    }
  });

  it('TEA tem TRÊS estados no rótulo — não é booleano', () => {
    expect([0, 1, 2].map((c) => computeIconLabel('tea', snap({ calmMode: c }))))
      .toEqual(['Modo TEA: desligado', 'Modo TEA: calmo', 'Modo TEA: silencioso']);
  });

  it('contraste diz a RAZÃO de contraste do nível, e "off" fora da lista', () => {
    expect(computeIconLabel('contrast', snap({ viz: 'normal' }))).toBe('Alto contraste: desligado');
    expect(computeIconLabel('contrast', snap({ viz: 'hc-direto' }))).toBe('Alto contraste: 3:1');
    expect(computeIconLabel('contrast', snap({ viz: 'hc-direto-45' }))).toBe('Alto contraste: 4,5:1');
    expect(computeIconLabel('contrast', snap({ viz: 'hc-direto-7' }))).toBe('Alto contraste: 7:1');
    expect(computeIconLabel('contrast', snap({ viz: 'fix-protan' }))).toBe('Alto contraste: desligado');
  });

  it('daltonismo nomeia a deficiência corrigida, e "off" fora da lista', () => {
    expect(computeIconLabel('cvd', snap({ viz: 'fix-protan' }))).toBe('Correção de daltonismo: protanopia');
    expect(computeIconLabel('cvd', snap({ viz: 'fix-deuter' }))).toBe('Correção de daltonismo: deuteranopia');
    expect(computeIconLabel('cvd', snap({ viz: 'fix-tritan' }))).toBe('Correção de daltonismo: tritanopia');
    expect(computeIconLabel('cvd', snap({ viz: 'hc-direto' }))).toBe('Correção de daltonismo: desligado');
  });

  it('ícone EM CONSTRUÇÃO diz que está em construção — e nunca diz on/off', () => {
    for (const ic of PAUSE_ICONS.filter((x) => x.soon)) {
      const lbl = computeIconLabel(ic.k, snap({ modoCego: true, ttsOn: true, calmMode: 2 }));
      expect(lbl).toBe(pt[ic.n] + ' (em construção)'); // `n` e a chave i18n; o rotulo e o texto dela
      expect(lbl).not.toMatch(/: on$/);
    }
  });

  it('EXCEÇÃO: chave desconhecida devolve string vazia (não lança, não inventa rótulo)', () => {
    expect(computeIconLabel('nao-existe', snap())).toBe('');
  });
});

// =============================================================================================
// PURO — o estado VISUAL (classes + aria-pressed)
// =============================================================================================
describe('computeIconVisual — o visual e o aria-pressed andam juntos', () => {
  it('ZERO estado: nenhum ícone se declara ativo', () => {
    for (const ic of PAUSE_ICONS) expect(computeIconVisual(ic.k, snap()).active).toBe(false);
  });

  it('ícone EM CONSTRUÇÃO nunca mente dizendo que está ligado, nem com todo o resto ligado', () => {
    const tudoLigado = snap({ modoCego: true, ttsOn: true, librasOn: true, calmMode: 2, toggleMove: true, viz: 'fix-protan', privateOutput: false });
    for (const ic of PAUSE_ICONS.filter((x) => x.soon)) {
      expect(computeIconVisual(ic.k, tudoLigado)).toEqual({ on: false, dis: false, calm: false, cvd: '', active: false });
    }
  });

  it('blind/tts ficam DESABILITADOS sem saída de áudio privada — mas o `on` continua verdadeiro', () => {
    const s = snap({ modoCego: true, ttsOn: true, privateOutput: false });
    expect(computeIconVisual('blind', s)).toMatchObject({ on: true, dis: true });
    expect(computeIconVisual('tts', s)).toMatchObject({ on: true, dis: true });
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
    const estados = [snap({ calmMode: 1 }), snap({ viz: 'fix-tritan' }), snap({ modoCego: true }), snap()];
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
  it('a barra tem um botão por ícone declarado', () => {
    expect(iconsMarkup().match(/class="pi-btn/g)).toHaveLength(PAUSE_ICONS.length);
  });

  it('INVARIANTE DE ACESSIBILIDADE: todo .pi-btn nasce com aria-label NÃO-VAZIO', () => {
    const labels = [...iconsMarkup().matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
    expect(labels).toHaveLength(PAUSE_ICONS.length);
    for (const l of labels) expect(l.trim().length).toBeGreaterThan(0);
  });

  it('todo .pi-btn é type="button" (não submete formulário) e carrega seu data-pi', () => {
    const html = iconsMarkup();
    expect(html.match(/type="button"/g)).toHaveLength(PAUSE_ICONS.length);
    for (const ic of PAUSE_ICONS) expect(html).toContain('data-pi="' + ic.k + '"');
  });

  it('ícone em construção ganha .pi-soon E o sufixo no rótulo; os demais, nenhum dos dois', () => {
    for (const ic of PAUSE_ICONS) {
      const h = iconBtnMarkup(ic);
      expect(h.includes('pi-soon')).toBe(!!ic.soon);
      expect(h.includes('(em construção)')).toBe(!!ic.soon);
    }
  });

  it('ZERO botões de menu: o cartão, a barra, a legenda e o rodapé continuam lá', () => {
    const h = screenPauseMarkup({ player: 0, numPlayers: 1, pmButtons: [], dynLabel: SEM_DIN, t: (k) => k });
    expect(h).toContain('class="pause-card" role="dialog" aria-modal="true"');
    expect(h).toContain('class="pause-icons" role="group"');
    expect(h).toContain('class="pause-icons-cap" aria-live="polite"');
    expect(h).toContain('<div class="pause-menu" role="menu"></div>');
    // O `aria-hidden` SAIU daqui no item 4 do ADR-0044: a legenda diz qual botão confirma, e era invisível
    // exatamente para quem não vê o glifo. Quem esconde agora são os CHIPS, e só eles — ver `pauseLegendHtml`.
    expect(h).toContain('class="pause-legend"');
    expect(h).not.toContain('class="pause-legend" aria-hidden');
  });

  it('UM jogador: o título NÃO ganha sufixo; MUITOS: ganha "· Jogador N" (1-based)', () => {
    const mk = (player, n) => screenPauseMarkup({ player, numPlayers: n, pmButtons: [], dynLabel: SEM_DIN, t: (k) => k });
    expect(mk(0, 1)).not.toContain('· Jogador');
    expect(mk(1, 2)).toContain('· Jogador 2');
    expect(mk(3, 4)).toContain('aria-label="Menu de pausa do jogador 4"');
  });

  it('botão de rótulo ESTÁTICO é traduzido e ganha data-i18n; o dinâmico não ganha (senão o applyDom o apaga)', () => {
    const t = (k) => 'T:' + k;
    expect(pmBtnMarkup({ act: 'quit', lbl: 'x' }, SEM_DIN, t))
      .toBe('<button class="pm-btn" role="menuitem" type="button" data-act="quit" data-i18n="pause.quit">T:pause.quit</button>');
    const letra = pmBtnMarkup({ act: 'letra', lbl: '🔠 ABC', letra: true }, SEM_DIN, t);
    expect(letra).toContain('pm-letra');
    expect(letra).not.toContain('data-i18n');
    expect(letra).toContain('>🔠 ABC<');
  });

  it('BORDA: o botão de NÍVEL (dormente hoje) monta o rótulo com o nível vigente', () => {
    // O RÓTULO chega PRONTO (item 19): montá-lo era da engine e passou a ser do jogo, que sabe o que é um
    // nível, como ele se chama e em que idioma dizê-lo. O que este caso ainda mede — e é o que importa — é
    // que o botão dinâmico usa o rótulo entregue e NÃO ganha `data-i18n` (senão o `applyDom` o apagaria).
    const h = pmBtnMarkup({ act: 'nivel', lbl: 'ignorado', nivel: true }, () => 'RÓTULO DO JOGO', (k) => k);
    expect(h).toContain('pm-nivel');
    expect(h).toContain('RÓTULO DO JOGO');
    expect(h).not.toContain('ignorado'); // o `lbl` estático é ignorado quando há rótulo dinâmico
    expect(h).not.toContain('data-i18n');
  });

  it('o menu monta um .pm-btn por entrada de PM_BTNS, na ordem recebida', () => {
    const h = screenPauseMarkup({ player: 0, numPlayers: 1, pmButtons: PM_BTNS, dynLabel: SEM_DIN, t: (k) => k });
    const acts = [...h.matchAll(/data-act="([^"]+)"/g)].map((m) => m[1]);
    expect(acts).toEqual(['resume', 'letra', 'quit']);
  });
});

// =============================================================================================
// CASCA — initPauseIcons com DOM falso
// =============================================================================================
describe('initPauseIcons — ações dos ícones', () => {
  it('SIMPLES: o modo cego liga e o anúncio conta o estado NOVO', () => {
    const { ctx, state, said } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('blind', 0);
    expect(state.modoCego).toBe(true);
    expect(said).toEqual(['Modo cego ligado.']);
    api.iconAct('blind', 0);
    expect(state.modoCego).toBe(false);
    expect(said[1]).toBe('Modo cego desligado.');
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

  // `audioCat` nasce NULL em platform/audio e só vira objeto em `initAudioMixer()`, chamado no boot do
  // main.ts. O invariante está escrito em TRÊS comentários (audio.ts:44, boot/create-game.ts:18,
  // consumer-quiz/main-quiz.ts:31) e não é imposto em lugar nenhum — e das três leituras deste arquivo,
  // duas se protegem com `cat && …` e esta era a única sem guarda. O `tsc` apontou para ela quando o
  // main.ts virou TypeScript: o ctx pedia não-nulo e a fonte é nula.
  // MUTAÇÃO: removida a guarda do conserto, este caso falha com
  // `TypeError: Cannot read properties of null (reading 'tts')` — conferido antes de valer.
  it('o ícone de TTS não quebra quando o mixer ainda não foi inicializado', () => {
    const { ctx, state, said } = buildCtx({ getAudioCat: () => null });
    expect(() => initPauseIcons(ctx).iconAct('tts', 0)).not.toThrow();
    expect(state.catGains).toEqual([]);   // não mexe no ganho de um mixer que não existe
    expect(said).toEqual([]);             // e não anuncia um estado que não leu
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

  it('teclas de alternância invertem a flag do jogador CERTO', () => {
    setPlayers([{ toggleMove: false }, { toggleMove: true }]);
    const { ctx, state } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('altmove', 1);
    expect(state.toggleMoveCalls).toEqual([[1, false]]);
  });

  it('contraste e daltonismo escrevem no viz do jogador que agiu e anunciam o rótulo do novo valor', () => {
    setPlayers([{ viz: 'normal' }, { viz: 'normal' }]);
    const { ctx, state, said } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('contrast', 1);
    expect(state.vizCalls).toEqual([[1, 'hc-direto']]);
    expect(said).toEqual(['Alto contraste: 3:1.']);
    api.iconAct('cvd', 1);
    expect(state.vizCalls[1]).toEqual([1, 'fix-protan']); // hc-direto não está na sequência CVD → índice 1
    expect(said[1]).toBe('Correção de daltonismo: protanopia.');
  });

  it('EXCEÇÃO: ícone em construção só ALERTA — nenhum estado é tocado', () => {
    const { ctx, state, said, alerted } = buildCtx();
    initPauseIcons(ctx).iconAct('face', 0);
    expect(alerted).toHaveLength(1);
    expect(alerted[0]).toContain('em construção');
    expect(said).toEqual([]);
    expect(state.modoCego).toBe(false);
    expect(state.vizCalls).toEqual([]);
  });

  it('EXCEÇÃO: sem saída de áudio privada, blind e tts são RECUSADOS com alerta', () => {
    setPlayers([{ audioSink: 'A' }, { audioSink: 'A' }]);
    const { ctx, state, alerted } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('blind', 0);
    api.iconAct('tts', 0);
    expect(alerted).toHaveLength(2);
    expect(state.modoCego).toBe(false);
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
    expect(state.vizCalls).toEqual([[0, 'hc-direto']]);
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
      expect(state.audioCat[k].on).toBe(true);          // calmo REDUZ, não silencia
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
  it('UM botão: recebe classe, aria-pressed e aria-label coerentes com o estado', () => {
    const { ctx, state } = buildCtx();
    state.modoCego = true;
    const api = initPauseIcons(ctx);
    const b = fakeIconBtn('blind');
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-on')).toBe(true);
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.getAttribute('aria-label')).toBe('Modo cego (navegação sonora): ligado');
  });

  it('o reflexo é IDEMPOTENTE e reversível: desligar limpa a classe e corrige o rótulo', () => {
    const { ctx, state } = buildCtx();
    state.modoCego = true;
    const api = initPauseIcons(ctx);
    const b = fakeIconBtn('blind');
    api.reflectIconBtn(b, 0); api.reflectIconBtn(b, 0);
    expect(b.className.split(' ').filter((c) => c === 'pi-on')).toHaveLength(1);
    state.modoCego = false;
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-on')).toBe(false);
    expect(b.getAttribute('aria-label')).toBe('Modo cego (navegação sonora): desligado');
  });

  it('BORDA: sair do daltonismo LIMPA a classe bicolor anterior (o remove roda antes do add)', () => {
    setPlayers([{ viz: 'fix-protan' }]);
    const { ctx } = buildCtx();
    const api = initPauseIcons(ctx);
    const b = fakeIconBtn('cvd');
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-cvd-protan')).toBe(true);
    players[0].viz = 'fix-tritan';
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-cvd-protan')).toBe(false);
    expect(b.classList.contains('pi-cvd-tritan')).toBe(true);
  });

  it('ícone EM CONSTRUÇÃO não recebe aria-label do reflexo — o rótulo do markup fica de pé', () => {
    const { ctx } = buildCtx();
    const b = fakeIconBtn('face');
    initPauseIcons(ctx).reflectIconBtn(b, 0);
    expect(b.getAttribute('aria-label')).toBe(null);
    expect(b.getAttribute('aria-pressed')).toBe('false');
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
    state.modoCego = true; state.libras = true;
    state.screens = [fakeScreen()];
    const api = initPauseIcons(ctx);
    api.setCalmMode(1);
    api.reflectPauseIcons();
    for (const b of state.screens[0]._btns) {
      const lbl = b.getAttribute('aria-label');
      const isSoon = !!PAUSE_ICONS.find((ic) => ic.k === b.dataset.pi).soon;
      if (isSoon) expect(lbl).toBe(null); // o markup já pôs o dele; o reflexo não sobrescreve
      else expect(lbl.trim().length).toBeGreaterThan(0);
      expect(['true', 'false']).toContain(b.getAttribute('aria-pressed'));
    }
  });

  it('reflectIconsIn com raiz nula é no-op (não lança)', () => {
    const { ctx } = buildCtx();
    expect(() => initPauseIcons(ctx).reflectIconsIn(null, 0)).not.toThrow();
  });

  it('CRUZAMENTO: iconLabel do módulo bate com computeIconLabel puro sobre o mesmo snapshot', () => {
    setPlayers([{ viz: 'hc-direto-7', toggleMove: true }]);
    const { ctx, state } = buildCtx();
    state.modoCego = true; state.audioCat.tts.on = true; state.libras = true;
    const api = initPauseIcons(ctx);
    api.setCalmMode(2);
    const s = api.iconState(0);
    for (const ic of PAUSE_ICONS) expect(api.iconLabel(ic.k, 0)).toBe(computeIconLabel(ic.k, s));
  });

  it('o snapshot lê os bindings VIVOS de core/state (mutar players muda o rótulo sem re-init)', () => {
    setPlayers([{ viz: 'normal', toggleMove: false }]);
    const { ctx } = buildCtx();
    const api = initPauseIcons(ctx);
    expect(api.iconLabel('altmove', 0)).toBe('Teclas de alternância: desligado');
    players[0].toggleMove = true;
    expect(api.iconLabel('altmove', 0)).toBe('Teclas de alternância: ligado');
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
    expect(spy).not.toHaveBeenCalled(); // pauseActs é LAZY — nunca lido no init (TDZ no game.js)
  });

  // Antes de 2026-08-26 este caso dizia "vem de core/state (binding vivo)". A fonte mudou — hoje é o getter
  // da rodada injetado no ctx — mas a garantia é a MESMA e continua valendo: o módulo PERGUNTA a cada uso,
  // em vez de copiar a contagem no init. Um `const n = ctx.getNumPlayers()` guardado no init faria a segunda
  // metade deste caso falhar.
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
