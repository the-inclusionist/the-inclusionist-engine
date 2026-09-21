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
import { migrarVisual, PADRAO } from '../app/js/render/viz-axes.js';
import pt from '../app/js/i18n/pt.js';
import {
  PAUSE_ICONS, CALM_AUDIO_CATS, CVD_SEQ, CVD_NAMES,
  hasPrivateOutputIn, nextCalmMode, nextContrast, nextCvd, calmAudioPlan, calmMotionPlan,
  computeIconLabel, computeIconVisual, ICON_STATE_CLASSES, inputModeOf, nextInputMode,
  iconBtnMarkup, iconsMarkup, pmBtnMarkup, screenPauseMarkup,
  iconesQueAccionam,
  initPauseIcons,
} from '../app/js/ui/pause-icons.js';
import { CONTRAST_LEVELS } from '../app/js/ui/settings-visual.js';
import { createRunState } from '../app/js/core/run-state.js';
// ☝️ keeps ONE value for the whole engine (ADR-0218), so it is read and reset here as the module state it is.
import * as estado from '../app/js/core/state.js';
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
    // ⚠️ O DUPLO FICOU CURTO PELA QUARTA VEZ NESTE FICHEIRO, e o conserto é DELE e não da engine — a lição já
    // está no cabeçalho duas vezes. Faltava `removeAttribute`, e faltava porque até hoje nada TIRAVA um
    // atributo: a issue #128 (`aria-disabled` a espelhar o `pi-dis`) é o primeiro caso que o faz. Um duplo
    // mais pobre do que a coisa real não reprova o código — rebenta ao lado dele, e o erro aponta para a
    // engine em vez de apontar para si próprio.
    removeAttribute(n) { delete attrs[n]; },
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
const PM_OPTS = [
  { act: 'pmback' },
  { act: 'caa' },
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
    optionsButtons: PM_OPTS,
    qlName: QL_NAME,
    getPauseActs: () => state.acts,
    // ⚠️ CAMPO OBRIGATÓRIO, e este fixture omitia-o. Em JS isso dava `undefined`, que é falso, e o ícone
    // `altmove` desaparecia em silêncio — «metade do defeito que este campo existe para não cometer», nas
    // palavras do próprio `ui/pause-icons`. Agora é função (ADR-0142) e a omissão passa a LANÇAR, que é o
    // que se quer: um ctx mal montado deixou de poder mentir baixinho.
    seguraTeclas: () => true,
    setPauseActor: (i) => { state.pauseActor = i; },
    getPauseScreens: () => state.screens,
    // As BARRAS RÁPIDAS (ADR-0044, item 7): desde que elas saíram do cartão, é aqui que os ícones vivem, e é
    // por aqui que `reflectPauseIcons` os encontra. Os testes que exercitam o reflexo alimentam `state.bars`;
    // os que só olham o markup do cartão deixam a lista vazia — e o reflexo então não faz nada, corretamente.
    getA11yBars: () => state.bars || state.screens,
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
    setPlayerViz: (i, mode) => { state.vizCalls.push([i, mode]); const p = players[i]; if (p) { p.viz = mode; p.visual = migrarVisual(mode); } },
    // Os escritores POR EIXO (#104): mexer num nao apaga o outro, e e' isso que os casos afirmam.
    setTemaDoJogador: (i, tema) => { state.vizCalls.push([i, 'tema:' + tema]); const p = players[i]; if (p) p.visual = { ...(p.visual ?? PADRAO), tema }; },
    setCorrecaoDoJogador: (i, correcao) => { state.vizCalls.push([i, 'correcao:' + correcao]); const p = players[i]; if (p) p.visual = { ...(p.visual ?? PADRAO), correcao }; },
    ...over,
  };
  return { ctx, state, said, alerted };
}

// Popula core/state.players IN PLACE (o módulo real lê o binding vivo; nunca reatribui o array).
function setPlayers(list) {
  players.length = 0;
  // ⚠️ DERIVA `visual` de `viz`, a mesma regra do espelho que a produção mantém (#104), para os casos
  // continuarem a declarar o modo pelo nome — que é como eles falam. Quem precisa dos DOIS eixos ao mesmo
  // tempo passa `visual` directamente, e é isso que o distingue.
  list.forEach((p) => players.push(
    p && p.visual === undefined && p.viz !== undefined ? { ...p, visual: migrarVisual(p.viz) } : p,
  ));
  setNumPlayersValue(list.length || 1);
}

// ⚠️ `switchScan` é estado de MÓDULO (uma chave para a engine toda, ADR-0218): sem o reposicionar, um caso que entra na
// varredura deixa o seguinte a começar dentro dela — e um caso que depende da ordem dos vizinhos não mede o que diz.
beforeEach(() => { setPlayers([{ viz: 'normal', visual: PADRAO }]); estado.setSwitchScanValue(false); });

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
    expect(calmAudioPlan(0, v1).vol).toBe(0.3); // e não 0.9 — ver o relatório
  });
});

// =============================================================================================
// PURO — o rótulo REFLETE o estado (o coração da acessibilidade destes botões)
// =============================================================================================
/**
 * ⚠️ O SNAPSHOT PASSOU A CARREGAR `visual` (#104), e este helper DERIVA-O de `viz` para os casos continuarem
 * a dizer o modo pelo nome — que é como eles falam. É a mesma regra do espelho que a produção mantém.
 *
 * Um caso que precise de um estado que a chave única NÃO exprime — `hc7` com `fix-deuter`, que é o ponto da
 * issue — passa `visual` directamente, e é isso que o distingue dos outros.
 */
function snap(over = {}) {
  const base = {
    modoCego: false, ttsOn: false, librasOn: false, calmMode: 0,
    toggleMove: false, viz: 'normal', privateOutput: true, ...over,
  };
  return { ...base, visual: base.visual ?? migrarVisual(base.viz) };
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
      ['blind', 'modoCego', 'Modo cego'],
      ['tts', 'ttsOn', 'Narração por voz'],
      ['libras', 'librasOn', 'Modo pessoa surda'],
      // ☝️ LEFT THIS LIST in 2026-09-21: it stopped being a boolean and became three positions (ADR-0218). Its own case is below.
    ];
    for (const [k, flag, prefix] of cases) {
      // 'on'/'off' eram palavras INGLESAS dentro de uma frase em portugues — o defeito exato que a passada
      // de i18n existe para remover. Agora o estado tambem passa pelo dicionario.
      expect(computeIconLabel(k, snap({ [flag]: false }))).toBe(prefix + ': desligado');
      expect(computeIconLabel(k, snap({ [flag]: true }))).toBe(prefix + ': ligado');
    }
  });

  /*
   * ☝️ SAYS WHICH OF THE THREE READINGS IS IN USE (ADR-0218), and the name is the SUBJECT while the value is the position —
   * the same shape as the camera's. A label of «on» would no longer answer the child's question, which is «on WHAT».
   */
  it('🔴 [Right] o ☝️ diz a POSIÇÃO — padrão, não precisa segurar, um botão só', () => {
    expect(computeIconLabel('altmove', snap({ toggleMove: false }))).toBe('Jeito de apertar: padrão');
    expect(computeIconLabel('altmove', snap({ toggleMove: true }))).toBe('Jeito de apertar: não precisa segurar');
    expect(computeIconLabel('altmove', snap({ switchScan: true }))).toBe('Jeito de apertar: um botão só');
    // 🔴 E A VARREDURA GANHA DA ADERÊNCIA: com um botão só não há o que segurar, e um valor guardado da aderência faria o
    // ícone anunciar uma posição em que a criança não está.
    expect(computeIconLabel('altmove', snap({ toggleMove: true, switchScan: true }))).toBe('Jeito de apertar: um botão só');
  });

  it('🔴 [Right] e ele só se acende fora do padrão — as outras duas posições são «ligado»', () => {
    expect(computeIconVisual('altmove', snap({ toggleMove: false })).on).toBe(false);
    expect(computeIconVisual('altmove', snap({ toggleMove: true })).on).toBe(true);
    expect(computeIconVisual('altmove', snap({ switchScan: true })).on).toBe(true);
    // 🔴 E NUNCA APAGADO: apagar o ícone num aparelho que exige a aderência levava «um botão só» junto, e quem joga com os
    // olhos é quem mais precisa dele. A trava vive no ciclo (caso abaixo), não no aspecto.
    expect(computeIconVisual('altmove', snap({ toggleMove: true, alternanciaExigida: true })).dis).toBe(false);
  });

  describe('nextInputMode — o ciclo de ☝️, e as duas coisas que lhe tiram uma posição (ADR-0218)', () => {
    it('🔴 [Right] num jogo que segura tecla são três, na ordem que o Dev pediu', () => {
      expect(nextInputMode('standard', true)).toBe('sticky');
      expect(nextInputMode('sticky', true)).toBe('scan');
      expect(nextInputMode('scan', true)).toBe('standard');
    });

    it('🔴 [Right] num jogo que NÃO segura tecla são duas: a aderência não teria o que segurar', () => {
      expect(nextInputMode('standard', false)).toBe('scan');
      expect(nextInputMode('scan', false)).toBe('standard');
      // e uma posição que não existe neste ciclo devolve a primeira, em vez de ficar presa fora dele
      expect(nextInputMode('sticky', false)).toBe('standard');
    });

    it('🔴 [Right] e num aparelho que EXIGE a aderência o «padrão» não aparece — mas a varredura continua lá', () => {
      expect(nextInputMode('sticky', true, true)).toBe('scan');
      expect(nextInputMode('scan', true, true)).toBe('sticky');
      expect(nextInputMode('standard', true, true), 'o ciclo parou numa posição que o aparelho não permite').toBe('sticky');
    });

    it('📌 [Right] e a leitura da posição dá a varredura como vencedora da aderência', () => {
      expect(inputModeOf({})).toBe('standard');
      expect(inputModeOf({ toggleMove: true })).toBe('sticky');
      expect(inputModeOf({ switchScan: true })).toBe('scan');
      expect(inputModeOf({ toggleMove: true, switchScan: true })).toBe('scan');
    });
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

  it('a quarta ESCOLHA nomeia a visão; o FALLBACK continua `desligado` — e não são a mesma chave', () => {
    expect(computeIconLabel('cvd', snap({ viz: 'fix-protan' }))).toBe('Correção de daltonismo: protanopia');
    expect(computeIconLabel('cvd', snap({ viz: 'fix-deuter' }))).toBe('Correção de daltonismo: deuteranopia');
    expect(computeIconLabel('cvd', snap({ viz: 'fix-tritan' }))).toBe('Correção de daltonismo: tritanopia');
    // ⚠️ AQUI É O FALLBACK, E ELE CONTINUA `desligado` DE PROPÓSITO. `hc-direto` é alto contraste: não há
    // correção de daltonismo ligada, e é só isso que o rótulo pode afirmar. Dizer `visão tricromática` seria
    // o software afirmando o que a criança ENXERGA — e o fallback cobre 13 dos 16 modos, incluindo as três
    // SIMULAÇÕES de daltonismo, a baixa visão e o modo cego. A quarta ESCOLHA do ciclo nomeia a visão
    // (`cvd.tricro`, no teste do invariante acima); o fallback nomeia o interruptor. São chaves diferentes.
    expect(computeIconLabel('cvd', snap({ viz: 'hc-direto' }))).toBe('Correção de daltonismo: desligado');
    // e a simulação é o caso que torna a distinção obrigatória, não uma sutileza:
    expect(computeIconLabel('cvd', snap({ viz: 'sim-deuter' }))).toBe('Correção de daltonismo: desligado');
  });

  it('ícone EM CONSTRUÇÃO diz que está em construção — e nunca diz on/off', () => {
    for (const ic of PAUSE_ICONS.filter((x) => x.soon)) {
      const lbl = computeIconLabel(ic.k, snap({ modoCego: true, ttsOn: true, calmMode: 2 }));
      expect(lbl).toBe(pt[ic.n] + ', em construção'); // `n` e a chave i18n; o rotulo e o texto dela
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

  it('🔴 [Right] tts is LOCKED when no voice speaks the language (ADR-0185), even with a private output', () => {
    expect(computeIconVisual('tts', snap({ ttsOn: true, semVoz: true }))).toMatchObject({ on: true, dis: true });
    expect(computeIconVisual('tts', snap({ ttsOn: true, semVoz: false })), 'locked with a voice for the language').toMatchObject({ dis: false });
    expect(computeIconVisual('blind', snap({ modoCego: true, semVoz: true })), 'blind mode needs no voice').toMatchObject({ dis: false });
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

  it('[Right] o ícone da alternância é ☝️ — o gesto de UM DEDO, não o braço mecânico', () => {
    // Pedido do Dev. 🦾 é prótese; a alternância de movimento não é sobre prótese, é sobre TOCAR com um dedo
    // em vez de manter pressionado — que é o que a linha do painel motor descreve com todas as letras: "para
    // quem não consegue manter pressionado (1 dedo)". O ícone passa a mostrar o gesto que o ajuste pede.
    const alt = PAUSE_ICONS.find((i) => i.k === 'altmove');
    expect(alt, 'o ícone da alternância sumiu da barra').toBeTruthy();
    expect(alt.e).toBe('☝️');
  });
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
      expect(h.includes(', em construção')).toBe(!!ic.soon);
    }
  });

  it('🔴 o sufixo do assento é CHAVE, e não português cru colado no markup', () => {
    // 🔴 A linha era `' · Jogador ' + (o.player + 1)`, dentro de um módulo de ENGINE. Num jogo em inglês
    // lia-se «Paused · Jogador 2» — a mesma família do «📚 Nível» que este ficheiro já apanhou uma vez, e o
    // crivo de prosa crua não a via porque ela nasce de uma concatenação e não de um literal inteiro.
    //
    // ⚠️ ESTE CASO MEDE A FORMA, E O IDIOMA MEDE-SE NOUTRO SÍTIO. Aqui o dicionário activo é o pt, onde a
    // chave e o literal antigo produzem a MESMA string — uma asserção «não contém Jogador» estaria a medir
    // o dicionário e não o mecanismo, e ficaria verde com o literal de volta. Quem distingue literal de
    // chave é o ARRANQUE EM `en`: `tests/barra-no-idioma-do-arranque.browser.test.js`.
    const h = screenPauseMarkup({ player: 1, numPlayers: 2, pmButtons: [], optionsButtons: [], dynLabel: SEM_DIN, t: (k) => k });
    // O `<span>` próprio é o que o `refrescarItensDaPausa` precisa para REPINTAR o sufixo quando a pausa
    // abre — sem um sítio nomeado, o conserto do idioma não tem onde pousar.
    expect(h, 'o sufixo do assento desapareceu em multijogador').toContain('class="pause-seat"');
    expect(h.match(/class="pause-seat">([^<]*)</)[1].trim().length,
      'o `<span>` do assento existe e está vazio com dois jogadores').toBeGreaterThan(0);
    // E com UM jogador ele fica vazio — o sufixo é informação de multijogador, não decoração.
    const solo = screenPauseMarkup({ player: 0, numPlayers: 1, pmButtons: [], optionsButtons: [], dynLabel: SEM_DIN, t: (k) => k });
    expect(solo).toContain('<span class="pause-seat"></span>');
  });

  it('ZERO botões de menu: o cartão, o título, as duas listas e o rodapé continuam lá', () => {
    const h = screenPauseMarkup({ player: 0, numPlayers: 1, pmButtons: [], optionsButtons: [], dynLabel: SEM_DIN, t: (k) => k });
    expect(h).toContain('class="pause-card" role="dialog" aria-modal="true"');
    // A BARRA e a LEGENDA saíram do cartão no item 7 do ADR-0044 — vivem no HUD, em `quickBarMarkup`. Este
    // caso passa a AFIRMAR a ausência: se elas voltarem para cá, a pausa volta a ser grade de duas zonas e o
    // anel do `passoNaPausa` volta a ser proibido pela XAG 106.
    expect(h).not.toContain('pause-icons');
    expect(h).not.toContain('pi-btn');
    // DUAS listas desde o item 5 do ADR-0044: a raiz visível e as opções escondidas.
    expect(h).toContain('<div class="pause-menu" role="menu" data-sub="raiz"></div>');
    expect(h).toContain('<div class="pause-menu" role="menu" data-sub="opcoes" hidden></div>');
    // O `aria-hidden` SAIU daqui no item 4 do ADR-0044: a legenda diz qual botão confirma, e era invisível
    // exatamente para quem não vê o glifo. Quem esconde agora são os CHIPS, e só eles — ver `pauseLegendHtml`.
    expect(h).toContain('class="pause-legend"');
    expect(h).not.toContain('class="pause-legend" aria-hidden');
  });

  it('UM jogador: o título NÃO ganha sufixo; MUITOS: ganha "· Jogador N" (1-based)', () => {
    const mk = (player, n) => screenPauseMarkup({ player, numPlayers: n, pmButtons: [], optionsButtons: [], dynLabel: SEM_DIN, t: (k) => k });
    expect(mk(0, 1)).not.toContain('· Jogador');
    expect(mk(1, 2)).toContain('· Jogador 2');
    expect(mk(3, 4)).toContain('aria-label="Menu de pausa do jogador 4"');
  });

  it('botão de rótulo ESTÁTICO é traduzido e ganha data-i18n; o dinâmico não ganha (senão o applyDom o apaga)', () => {
    const t = (k) => 'T:' + k;
    expect(pmBtnMarkup({ act: 'quit', lbl: 'x' }, SEM_DIN, t))
      .toBe('<button class="pm-btn" role="menuitem" type="button" data-act="quit" data-glifo="🚪" data-i18n="pause.quit">T:pause.quit</button>');
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

  it('o menu monta um .pm-btn por entrada de PM_BTNS, na ordem recebida — e o submenu depois dele', () => {
    // A ordem das DUAS listas no markup importa para quem lê o documento em sequência: a raiz vem primeiro,
    // e é ela que está visível. A ordem de NAVEGAÇÃO, essa, sai de `PM_ITENS_VISIVEIS` e nunca mistura as duas.
    const h = screenPauseMarkup({ player: 0, numPlayers: 1, pmButtons: PM_BTNS, optionsButtons: PM_OPTS, dynLabel: SEM_DIN, t: (k) => k });
    const acts = [...h.matchAll(/data-act="([^"]+)"/g)].map((m) => m[1]);
    // ⚠️ E a TERCEIRA lista vem no fim (ADR-0146): sem `jogoButtons` ela é o padrão, só o «voltar».
    expect(acts).toEqual(['resume', 'letra', 'quit', 'pmback', 'caa', 'pmback']);
  });
});

// =============================================================================================
// CASCA — initPauseIcons com DOM falso
// =============================================================================================
describe('initPauseIcons — ações dos ícones', () => {
  it('🔴 [Right] with no voice for the language, the narration icon says why and turns nothing on (ADR-0185)', () => {
    const { ctx, state, alerted } = buildCtx();
    ctx.semVoz = () => true;
    const antes = state.audioCat.tts.on;
    initPauseIcons(ctx).iconAct('tts', 0);
    expect(state.audioCat.tts.on, 'the locked icon still toggled narration').toBe(antes);
    expect(alerted.join(' '), 'refused in silence').toMatch(/voz|voice/i);
  });
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
  it('⚠️ [Right] SEM `setModoCego` injetado, o ícone continua a ligar o modo cego — e a PERSISTIR', async () => {
    // ADR-0106 §4, etapa 1b. Cinco jogos do catálogo nunca injectaram nada disto, e a consequência não é
    // «o botão não faz efeito»: é uma criança cega abrir o jogo e não ter por onde. O padrão é o
    // `setModoCegoValue` do `core/state`, que faz as três coisas que aquele registo diz que um setter faz —
    // grava, persiste, avisa — e NADA mais: refazer os extras do nível é reacção, e quem reage assina.
    const guardado = {};
    globalThis.localStorage = {
      getItem: (k) => (k in guardado ? guardado[k] : null),
      setItem: (k, v) => { guardado[k] = String(v); },
      removeItem: (k) => { delete guardado[k]; },
    };
    try {
      const estadoReal = await import('../app/js/core/state.js');
      const antes = estadoReal.modoCego;
      const { ctx, said } = buildCtx();
      delete ctx.setModoCego;                 // o jogo que não se lembrou
      ctx.getModoCego = () => estadoReal.modoCego;

      initPauseIcons(ctx).iconAct('blind', 0);

      expect(estadoReal.modoCego, 'o ícone não mexeu no estado real').toBe(!antes);
      // ⚠️ `'1'`/`'0'` e não `'true'`/`'false'`: é a codificação que o `store.setBool` grava, e é ela que o
      // armazenamento de uma criança que já jogou contém. Pinada pelo literal de propósito — afirmar isto
      // relendo pelo `store.getBool` mediria a ida e a volta pela mesma tabela, e as duas mover-se-iam juntas.
      expect(guardado['incl_modocego'], 'ligou mas não persistiu — no arranque seguinte volta a estar desligado')
        .toBe(antes ? '0' : '1');
      // ⚠️ E o anúncio NÃO se perde nem se duplica: quem o diz é este ícone, não o setter.
      expect(said).toEqual([antes ? 'Modo cego desligado.' : 'Modo cego ligado.']);

      estadoReal.setModoCegoValue(antes);      // devolve o estado do módulo a quem vier a seguir
    } finally {
      delete globalThis.localStorage;
    }
  });


  // 🎯 O GATE QUE O ADR-0113 PEDE PARA O ÍCONE: «pressioná-lo escreve a bandeira DO TRANSPORTE EM USO, e não
  // uma global». Este é o irmão do caso do modo cego logo acima — mesma forma, mesma razão: o ícone da barra
  // é a OUTRA superfície que escreve a alternância, e se ela e o painel escrevessem coisas diferentes as duas
  // divergiriam em silêncio.
  it('🎯 [Right] o ícone `altmove` escreve as DUAS chaves — a do aparelho em uso e a legada', async () => {
    const guardado = {};
    globalThis.localStorage = {
      getItem: (k) => (k in guardado ? guardado[k] : null),
      setItem: (k, v) => { guardado[k] = String(v); },
      removeItem: (k) => { delete guardado[k]; },
    };
    try {
      setPlayers([{ viz: 'normal', toggleMove: false, walkDir: 0 }]);
      const { ctx } = buildCtx();
      delete ctx.setToggleMove;                  // o jogo que não se lembrou
      ctx.transporteEmUso = () => 'gamepad';     // e a raiz que sabe o aparelho

      initPauseIcons(ctx).iconAct('altmove', 0);

      // ⚠️ Literais, e não `chaveDaAlternancia(...)`: afirmar a chave chamando a mesma função que a escreve
      // mediria a ida e a volta pela mesma tabela, e as duas mover-se-iam juntas. É a mesma nota que o caso
      // do modo cego já carrega sobre a codificação `1`/`0`.
      expect(guardado['incl_togglemove_p0_gamepad'], 'o ícone não escreveu a chave do aparelho em uso')
        .toBe('1');
      expect(guardado['incl_togglemove_p0'], 'o ícone deixou de escrever a legada e a criança perde a escolha')
        .toBe('1');
    } finally {
      delete globalThis.localStorage;
    }
  });

  // 📌 SEM A RAIZ A RESPONDER, o ícone faz exactamente o que já fazia — que é o que torna o campo opcional
  // seguro, e o que garante que este commit não muda nada para quem ainda não migrou.
  it('📌 [Zero] sem `transporteEmUso`, o ícone escreve só a legada', async () => {
    const guardado = {};
    globalThis.localStorage = {
      getItem: (k) => (k in guardado ? guardado[k] : null),
      setItem: (k, v) => { guardado[k] = String(v); },
      removeItem: (k) => { delete guardado[k]; },
    };
    try {
      setPlayers([{ viz: 'normal', toggleMove: false, walkDir: 0 }]);
      const { ctx } = buildCtx();
      delete ctx.setToggleMove;
      initPauseIcons(ctx).iconAct('altmove', 0);
      expect(Object.keys(guardado)).toEqual(['incl_togglemove_p0']);
    } finally {
      delete globalThis.localStorage;
    }
  });

  // ========================= A CLÁUSULA 3 DO ADR-0113, NO ÍCONE DA BARRA =========================
  // ⚠️ O ÍCONE E O `#opt-altmove` ESCREVEM O MESMO VALOR. Um a aceitar o clique enquanto o outro recusa
  // daria à criança dois botões que discordam sobre o mesmo ajuste — e o que ela veria era o painel a dizer
  // «não dá» e a barra a fingir que deu.
  it('🔴 [Zero] com o olhar em uso, o ícone `altmove` recusa DIZENDO, e não mexe em nada', () => {
    setPlayers([{ viz: 'normal', toggleMove: false, walkDir: 0 }]);
    const { ctx, alerted } = buildCtx();
    delete ctx.setToggleMove;
    ctx.transporteEmUso = () => 'olhos';

    initPauseIcons(ctx).iconAct('altmove', 0);

    expect(rodada.players[0].toggleMove, 'o ícone mexeu num ajuste que este aparelho exige').toBe(false);
    expect(alerted.join(' '), 'recusou em silêncio — a criança fica sem saber por quê')
      .toContain('precisa das teclas de alternância');
  });

  it('📌 [Zero] sem `transporteEmUso`, o ícone continua a alternar', () => {
    setPlayers([{ viz: 'normal', toggleMove: false, walkDir: 0 }]);
    const { ctx, state } = buildCtx();
    initPauseIcons(ctx).iconAct('altmove', 0);
    expect(state.toggleMoveCalls, 'o ícone deixou de accionar quando não há recusa nenhuma').toHaveLength(1);
  });

  /*
   * 🔴 REESCRITO EM 2026-09-21, E A MUDANÇA É A DECISÃO (ADR-0218). Este caso nasceu de uma mutação sobrevivente e media o
   * ASPECTO: com o olhar em uso, o ícone aparecia APAGADO, porque a alternância não se pode desligar nesse aparelho.
   *
   * Com três posições isso passou a custar caro demais: apagar o ícone inteiro tiraria a varredura de «um botão só» — e quem
   * joga com os olhos é justamente quem mais precisa dela. A trava do ADR-0113 cláusula 3 continua inteira, dita pelo CICLO:
   * o «padrão» simplesmente não aparece, e a criança nunca alcança uma posição em que o aparelho não a deixaria ficar.
   */
  it('🔴 [Right] com o olhar em uso, o ciclo PULA o padrão — e o ícone continua accionável', () => {
    setPlayers([{ viz: 'normal', toggleMove: true, walkDir: 0 }]);
    const { ctx, state } = buildCtx();
    ctx.transporteEmUso = () => 'olhos';
    ctx.seguraTeclas = () => true; // senão a aderência não teria o que travar e o ciclo seria outro (o de duas posições)
    const api = initPauseIcons(ctx);
    const b = fakeIconBtn('altmove');
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-dis'), 'o ícone foi apagado e levou a varredura com ele').toBe(false);

    // De «não precisa segurar» vai para «um botão só»…
    api.iconAct('altmove', 0);
    expect(estado.switchScan, 'não entrou na varredura').toBe(true);
    // …e de lá volta para a aderência, nunca para o padrão: o aparelho manda um comando de cada vez e a aderência fica.
    api.iconAct('altmove', 0);
    expect(estado.switchScan).toBe(false);
    expect(state.toggleMoveCalls, 'o padrão foi alcançado num aparelho que exige a alternância').toEqual([]);
  });

  // 🔴 A ISSUE #128, E ELA É DE UMA LINHA. `pi-dis` é CLASSE CSS: a criança que enxerga vê o ícone apagado,
  // a que navega por leitor de tela não recebe nada — o botão anuncia-se accionável e não responde.
  it('🔴 [Right] `pi-dis` passa a ter par em `aria-disabled` — e sai quando o motivo sai', () => {
    const { ctx } = buildCtx();
    const api = initPauseIcons(ctx);
    const b = fakeIconBtn('blind');

    setPlayers([{ audioSink: 'x' }, { audioSink: 'x' }]);   // dois no mesmo sink: sem saída privada
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-dis'), 'o cenário não desabilitou o ícone').toBe(true);
    expect(b.getAttribute('aria-disabled'), 'a criança cega não sabe que o botão não responde').toBe('true');

    setPlayers([{ audioSink: 'x' }]);                        // sozinha: a saída volta a ser privada
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

  /*
   * 🔴 O CICLO INTEIRO PELO ACTO, num jogo que segura tecla e num aparelho que não exige nada — que é o caso comum, o teclado,
   * e o único que nenhum caso media. `nextInputMode` é puro e está medido; o que falta provar é que APERTAR o ícone três vezes
   * percorre as três posições e volta. 📌 Escrito depois de o Dev relatar «só cicla entre padrão e não precisa segurar».
   */
  it('🔴 [Right] três toques no ☝️ percorrem as TRÊS posições e voltam ao padrão', () => {
    setPlayers([{ viz: 'normal', toggleMove: false, walkDir: 0 }]);
    const { ctx, state } = buildCtx();
    ctx.seguraTeclas = () => true;
    const api = initPauseIcons(ctx);
    const posicao = () => api.iconLabel('altmove', 0);

    expect(posicao()).toBe('Jeito de apertar: padrão');
    api.iconAct('altmove', 0);
    expect(state.toggleMoveCalls, 'o primeiro toque não escreveu a aderência').toEqual([[0, true]]);
    rodada.players[0].toggleMove = true; // o escritor do ctx é um espião; o assento que ele escreveria é este
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
    // 📌 Os dois assentos partem do PADRÃO: desde o ADR-0218 uma pressão sobre um assento que já está na aderência leva-o para
    // «um botão só», que não escreve aderência nenhuma — e o caso deixaria de medir o assento, que é o que ele existe para medir.
    setPlayers([{ toggleMove: false }, { toggleMove: false }]);
    const { ctx, state } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('altmove', 1);
    expect(state.toggleMoveCalls).toEqual([[1, true]]);
  });

  it('⚠️ contraste e daltonismo ciclam CADA UM NO SEU EIXO, e um não apaga o outro (#104)', () => {
    // ⚠️ ESTE CASO ERA A DEMONSTRAÇÃO DO DEFEITO, escrita como se fosse comportamento: ele afirmava que,
    // depois do contraste, o ícone de daltonismo saltava para o índice 1 «porque `hc-direto` não está na
    // sequência CVD». Não estava porque as duas sequências dividiam UM campo — a criança ligava o contraste
    // e o daltonismo perdia o lugar dela.
    //
    // Agora cada ícone escreve no seu eixo, e a asserção que interessa é a última: depois de mexer nos DOIS,
    // os DOIS continuam ligados.
    setPlayers([{ visual: PADRAO }, { visual: PADRAO }]);
    const { ctx, state, said } = buildCtx();
    const api = initPauseIcons(ctx);
    api.iconAct('contrast', 1);
    expect(state.vizCalls).toEqual([[1, 'tema:hc3']]);
    expect(said).toEqual(['Alto contraste: 3:1.']);
    api.iconAct('cvd', 1);
    expect(state.vizCalls[1]).toEqual([1, 'correcao:protan']);
    expect(said[1]).toBe('Correção de daltonismo: protanopia.');
    // ⚠️ E O TEMA SOBREVIVEU AO SEGUNDO CLIQUE. É a linha que o modelo antigo não conseguia produzir.
    expect(players[1].visual).toEqual({ tema: 'hc3', correcao: 'protan', simulacao: null });
  });

  it('EXCEÇÃO: ícone em construção só ALERTA — nenhum estado é tocado', () => {
    const { ctx, state, said, alerted } = buildCtx();
    initPauseIcons(ctx).iconAct('voice', 0); // the 🧑 left construction (ADR-0212 §3); the 👄 is still there
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
  // 🔴 O RÓTULO DE UM ÍCONE `soon` TAMBÉM TEM DE SER REESCRITO PELO REFLEXO, e a razão de isto não ser
  // zelo é uma premissa que DEIXOU DE SER VERDADE. O guarda que existia aqui dizia: «`soon` buttons keep
  // the label the markup gave them (same string) — no state to report». A segunda metade continua certa —
  // não há estado a reportar —, mas «same string» era verdade só enquanto a marcação e o reflexo corressem
  // no MESMO idioma.
  //
  // ⚠️ MEDIDO NUM NAVEGADOR EM 2026-09-08, na barra que o `createGame` passou a montar: o `initI18n` carrega
  // en/es de forma ASSÍNCRONA (são chunks próprios), a marcação da barra é gerada ANTES de o dicionário
  // chegar, e depois só os rótulos COM ESTADO se corrigem. Resultado servido pela página: cinco ícones a
  // dizer «Blind mode… / Voice narration…» e três ainda a dizer «Webcam — rosto (em construção)».
  //
  // 📌 É a MESMA forma do ACHADO 15: uma premissa que valia enquanto toda raiz fosse um `main.ts` que
  // montava depois do i18n, e que a engine invalidou ao passar a montar ela própria.
  it('🔴 [Zero] um ícone `soon` recebe rótulo do reflexo — «mesma string» deixou de ser verdade', () => {
    const { ctx } = buildCtx();
    const api = initPauseIcons(ctx);
    const b = fakeIconBtn('voice');
    api.reflectIconBtn(b, 0);
    expect(b.getAttribute('aria-label'), 'o reflexo saltou o ícone e o rótulo ficou como a marcação o deixou')
      .toBe('Comando de voz, em construção');
    expect(b.getAttribute('aria-pressed'), 'um `soon` nunca se declara ligado').toBe('false');
  });

  it('UM botão: recebe classe, aria-pressed e aria-label coerentes com o estado', () => {
    const { ctx, state } = buildCtx();
    state.modoCego = true;
    const api = initPauseIcons(ctx);
    const b = fakeIconBtn('blind');
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-on')).toBe(true);
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.getAttribute('aria-label')).toBe('Modo cego: ligado');
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
    expect(b.getAttribute('aria-label')).toBe('Modo cego: desligado');
  });

  it('BORDA: sair do daltonismo LIMPA a classe bicolor anterior (o remove roda antes do add)', () => {
    setPlayers([{ viz: 'fix-protan' }]);
    const { ctx } = buildCtx();
    const api = initPauseIcons(ctx);
    const b = fakeIconBtn('cvd');
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-cvd-protan')).toBe(true);
    players[0].visual = migrarVisual('fix-tritan');
    api.reflectIconBtn(b, 0);
    expect(b.classList.contains('pi-cvd-protan')).toBe(false);
    expect(b.classList.contains('pi-cvd-tritan')).toBe(true);
  });

  // ⚠️ ESTE CASO FOI VIRADO EM 2026-09-08, e o que ele afirmava era o DEFEITO ESCRITO COMO GARANTIA — a
  // terceira vez que este repositório encontra essa forma. O título antigo era «ícone EM CONSTRUÇÃO não
  // recebe aria-label do reflexo — o rótulo do markup fica de pé», e ele prendia a premissa «mesma string»
  // que a medição num navegador desmentiu: com a engine a montar a barra antes de o dicionário assíncrono
  // chegar, o rótulo da marcação e o do reflexo estão em IDIOMAS diferentes.
  //
  // 📌 O que fica afirmado é o que não regride: quando o idioma NÃO mudou, o reflexo escreve exactamente a
  // string que a marcação escreveria. A escrita passou a ser garantida em vez de dispensada.
  it('⚠️ [Right] um ícone EM CONSTRUÇÃO recebe do reflexo a MESMA string que a marcação lhe daria', () => {
    const { ctx } = buildCtx();
    const b = fakeIconBtn('voice');
    initPauseIcons(ctx).reflectIconBtn(b, 0);
    expect(b.getAttribute('aria-label')).toBe('Comando de voz, em construção');
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
      // ⚠️ SEM RAMO POR `soon`: o título deste caso sempre disse «TODO .pi-btn», e o ramo que aqui estava
      // dizia o contrário dele. Agora os dois concordam — e é essa concordância que apanha um ícone
      // encalhado no idioma da marcação.
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

describe('iconesQueAccionam — nenhuma etapa entrega botão morto (ADR-0106 §5)', () => {
  it('⚠️ [Right] SEM escritor visual, o contraste e a cor NÃO entram na barra', () => {
    // O registo decide isto por escrito: «uma barra que oferece a uma criança um caminho e depois o recusa é
    // pior do que uma barra que ela vê que não está lá, porque a primeira ensina-lhe que o caminho não é
    // para ela». Os outros oito ícones continuam — perder a barra inteira por causa de dois seria a troca
    // errada.
    // 📌 	ipografia: true desde 2026-09-12 (ADR-0149): o 11.o icone tem a mesma regra dos dois visuais, e
    // deixa-lo de fora aqui mediria DUAS ausencias em vez da que o caso nomeia.
    // `relogio: () => true` from ADR-0180 on: the hourglass mounts only in a clock game, and each case here measures its own absence.
    const chaves = iconesQueAccionam({ relogio: () => true, tema: false, correcao: false, seguraTeclas: () => true, tipografia: true, camera: true, menus: true }).map((ic) => ic.k);
    expect(chaves).not.toContain('contrast');
    expect(chaves).not.toContain('cvd');
    expect(chaves).toContain('blind');
    expect(chaves).toContain('tts');
    expect(chaves).toHaveLength(PAUSE_ICONS.length - 2);
  });

  it('[Right] COM escritor visual, a barra é a lista inteira e na mesma ordem', () => {
    expect(iconesQueAccionam({ relogio: () => true, tema: true, correcao: true, seguraTeclas: () => true, tipografia: true, camera: true, menus: true })).toEqual(PAUSE_ICONS);
  });

  it('⚠️ [Boundary] com UM escritor só, aparece UM ícone só — e é o que funciona', () => {
    // ⚠️ ESTE CASO NASCEU DE UMA MUTAÇÃO SOBREVIVENTE, e ela apontava um defeito de DESENHO e não um buraco
    // de cobertura. Enquanto a pergunta era uma bandeira só («este jogo tem escritores visuais»), trocar
    // `&&` por `||` não reprovava nada — porque todos os casos tiravam os DOIS. E os dois operadores erram,
    // em direcções opostas: o `&&` esconde um ícone que FUNCIONA, o `||` mostra um que NÃO funciona. A
    // pergunta certa é por ÍCONE.
    const soTema = iconesQueAccionam({ tema: true, correcao: false, seguraTeclas: () => true, tipografia: true }).map((ic) => ic.k);
    expect(soTema).toContain('contrast');
    expect(soTema).not.toContain('cvd');

    const soCor = iconesQueAccionam({ tema: false, correcao: true, seguraTeclas: () => true }).map((ic) => ic.k);
    expect(soCor).not.toContain('contrast');
    expect(soCor).toContain('cvd');
  });

  it('⚠️ [Right] os ícones que sobram NÃO viram `soon` — «este jogo não tem» não é «em breve»', () => {
    // `soon` diz «ainda não construímos isto», e um botão a dizê-lo sobre o alto contraste mentiria: o alto
    // contraste está construído. O que falta é este jogo ter por onde o aplicar.
    for (const ic of iconesQueAccionam({ tema: false, correcao: false, seguraTeclas: () => true })) {
      if (ic.k === 'voice') continue; // esse É `soon`, e continua (o 👀 e o 🧑 deixaram de ser: ADR-0213, ADR-0212)
      expect(ic.soon, `${ic.k} passou a soon`).toBeFalsy();
    }
  });

  /* ===================== ADR-0115 · um jogo que não segura nada não OFERECE a alternância =====================
   *
   * 🔴 O defeito tem uma criança dentro: a alternância existe para quem não consegue MANTER uma tecla premida.
   * Num quiz, num tabuleiro ou num puzzle de peças não há nada a travar — e o controle, oferecido na mesma,
   * é uma opção que não faz nada. A criança liga o ajuste de que depende e não acontece nada; ela aprende que
   * o ajuste está partido.
   *
   * ⚠️ E É UMA AUSÊNCIA DIFERENTE DA DO ADR-0113 cláusula 3, que vive no mesmo ficheiro: lá o controle fica
   * DESABILITADO com o motivo, porque o aparelho EXIGE a alternância. Aqui não há nada a travar, e explicar
   * por que um controle não faz nada continua a ser entregar um controle que não faz nada. */
  it('🎯 [Zero] um jogo que não segura teclas NEM declara posição não recebe o ícone `altmove`', () => {
    const chaves = iconesQueAccionam({ relogio: () => true, tema: true, correcao: true, seguraTeclas: () => false, tipografia: true, camera: true, menus: true }).map((ic) => ic.k);
    expect(chaves, 'o `altmove` foi montado num jogo que não segura nada').not.toContain('altmove');
    expect(chaves).toHaveLength(PAUSE_ICONS.length - 1);
  });

  /*
   * 🔴 E A OUTRA METADE, QUE ENTROU COM O ADR-0218 e que uma mutação sobrevivente mostrou não estar medida: o ícone existe
   * também onde o jogo DECLARA POSIÇÃO sem segurar tecla nenhuma — que é o quiz, e que era o jogo sem ☝️ nenhum. A aderência
   * não tem o que segurar lá; «um botão só» tem o que varrer.
   */
  it('🔴 [Right] mas um jogo que DECLARA POSIÇÃO recebe-o, mesmo sem segurar tecla — é o caso do quiz', () => {
    const chaves = iconesQueAccionam({
      relogio: () => true, tema: true, correcao: true, seguraTeclas: () => false, declaredPositions: () => 5,
      tipografia: true, camera: true, menus: true,
    }).map((ic) => ic.k);
    expect(chaves, 'o jogo que declara cinco posições ficou sem «um botão só»').toContain('altmove');
    expect(chaves).toHaveLength(PAUSE_ICONS.length);
  });

  it('⚠️ [Right] e o PAR: um jogo que segura recebe-o — senão «ausente» passaria por nunca montar nada', () => {
    // Sem este caso, uma implementação que devolvesse lista vazia satisfaria o de cima. É a mesma razão pela
    // qual o [Zero] dos escritores visuais tem o seu par logo acima.
    const chaves = iconesQueAccionam({ tema: true, correcao: true, seguraTeclas: () => true, tipografia: true }).map((ic) => ic.k);
    expect(chaves).toContain('altmove');
  });

  it('⚠️ [Boundary] a ausência do `altmove` é INDEPENDENTE dos escritores visuais', () => {
    // Os três ramos do filtro são perguntas separadas, e uma implementação que colapsasse duas delas numa
    // bandeira só passaria nos casos de cima — foi exactamente o defeito que a mutação `&&`/`||` expôs para
    // o par tema/correcção.
    // ⚠️ 	ipografia FICA DE FORA aqui de propósito, e o número abaixo conta QUATRO ausências: este caso mede
    // que os ramos do filtro sao INDEPENDENTES, e o quarto ramo entrou em 2026-09-12 (ADR-0149).
    const semNada = iconesQueAccionam({ relogio: () => true, tema: false, correcao: false, seguraTeclas: () => false }).map((ic) => ic.k);
    expect(semNada).not.toContain('contrast');
    expect(semNada).not.toContain('cvd');
    expect(semNada).not.toContain('altmove');
    expect(semNada).not.toContain('tipografia');
    expect(semNada).not.toContain('camera');
    expect(semNada).not.toContain('menu');
    expect(semNada).toHaveLength(PAUSE_ICONS.length - 6);

    const soAlternancia = iconesQueAccionam({ tema: false, correcao: false, seguraTeclas: () => true, tipografia: true }).map((ic) => ic.k);
    expect(soAlternancia).toContain('altmove');
    expect(soAlternancia).not.toContain('contrast');
  });

  it('📌 [Interface] e o `altmove` que sobra NÃO vira `soon` — «este jogo não tem» não é «em breve»', () => {
    for (const ic of iconesQueAccionam({ tema: true, correcao: true, seguraTeclas: () => true })) {
      if (ic.k !== 'altmove') continue;
      expect(ic.soon, 'a alternância passou a anunciar-se como em construção').toBeFalsy();
    }
  });

  // ⚠️ A BARRA MONTADA é caso do project BROWSER (`buildQuickBar` chama `document.createElement`), e está lá:
  // «a barra montada não tem os dois botões quando não há escritor». Aqui fica a metade pura, que é onde a
  // REGRA vive; lá fica a prova de que ela alcança o DOM.

  it('[Zero] e chamar `iconAct` por chave, sem escritor, não rebenta nem anuncia', () => {
    // `iconAct` é EXPORTADO: a barra já não monta o botão, mas um consumidor pode chamá-lo pela chave.
    const { ctx, said } = buildCtx();
    delete ctx.setTemaDoJogador;
    delete ctx.setCorrecaoDoJogador;
    const api = initPauseIcons(ctx);
    expect(() => { api.iconAct('contrast', 0); api.iconAct('cvd', 0); }).not.toThrow();
    expect(said).toEqual([]);
  });
});

describe('PauseIconsCtx — o campo que ninguém lia (ADR-0106)', () => {
  it('⚠️ [Zero] a barra e o cartão montam-se SEM `getPauseScreens` — ele era obrigatório e morto', () => {
    // 📏 Medido nos três lados antes de sair: zero leitores em `ui/pause-icons`, nos testes só os fixtures o
    // forneciam, e o `game-platformer` passava-o para nada. 📌 O homónimo do `ui/shell` é de OUTRO ctx e tem
    // cinco leitores a sério — é ele que esconde e mostra os cartões por fase.
    const { ctx, said } = buildCtx();
    delete ctx.getPauseScreens;
    const api = initPauseIcons(ctx);

    expect(() => api.reflectPauseIcons()).not.toThrow();
    expect(() => api.iconAct('libras', 0)).not.toThrow();
    expect(said.length, 'o ícone deixou de anunciar sem um campo que ele não lê').toBeGreaterThan(0);
    expect(typeof api.iconLabel('blind', 0)).toBe('string');
  });
});
