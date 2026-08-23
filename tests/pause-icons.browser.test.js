// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/pause-icons — a CASCA de DOM (project BROWSER: buildScreenPause usa document.createElement +
// innerHTML, coisa que o project node não consegue exercitar). A lógica pura (rótulos, ciclos, plano do TEA,
// markup como string) está em pause-icons.node.test.js e NÃO é repetida aqui — aqui provamos só o que só o
// navegador prova: a árvore construída, a delegação de clique, e a legenda que segue o foco/mouse.
//
// `players`/`numPlayers`/`quizLevel` são os módulos REAIS (core/state.ts) — os mesmos bindings vivos que o
// game.js usa; o resto do ctx é falso (spies).
import { describe, it, expect, beforeEach } from 'vitest';
import { PAUSE_ICONS, initPauseIcons } from '../app/js/ui/pause-icons.js';
import { players, setNumPlayersValue } from '../app/js/core/state.js';

const PM_BTNS = [
  { act: 'resume', lbl: '▶ Continuar' },
  { act: 'letra', lbl: '🔠 ABC', letra: true },
  { act: 'quit', lbl: '🚪 Sair do jogo' },
];
const QL_NAME = { 1: 'pré-silábico', 2: 'silábico', 3: 'silábico-alfabético', 4: 'escritor', 5: 'escritor cego' };
const RM_KEYS = ['parallax', 'decor', 'items', 'particles'];
const RM_CHAR = [{ prop: 'rmWalk' }, { prop: 'rmBreath' }, { prop: 'rmFlavor' }];

function makeCtx(over = {}) {
  const said = [], alerted = [];
  const state = {
    modoCego: false, libras: false, pauseActor: -1, screens: [], ran: [],
    audioCat: { tts: { on: false, vol: 1 }, ambient: { on: true, vol: 1 }, music: { on: true, vol: 1 }, earcons: { on: true, vol: 1 }, other: { on: true, vol: 1 }, interact: { on: true, vol: 1 } },
    rm: { parallax: false, decor: false, items: false, particles: false },
  };
  const acts = {
    resume: () => state.ran.push('resume'),
    letra: () => state.ran.push('letra'),
    // 'quit' de propósito AUSENTE: prova que um data-act sem entrada na tabela não quebra o clique.
  };
  const ctx = {
    srSay: (m) => said.push(m),
    srAlert: (m) => alerted.push(m),
    pmButtons: PM_BTNS,
    qlName: QL_NAME,
    getPauseActs: () => acts,
    setPauseActor: (i) => { state.pauseActor = i; },
    getPauseScreens: () => state.screens,
    getModoCego: () => state.modoCego,
    setModoCego: (on) => { state.modoCego = on; },
    getAudioCat: () => state.audioCat,
    setCatGain: () => {},
    reflectTtsPanel: () => {},
    reflectTtsPanelEnabled: false,
    isLibrasOn: () => state.libras,
    toggleLibras: () => { state.libras = !state.libras; },
    rm: state.rm, rmKeys: RM_KEYS, rmChar: RM_CHAR, saveRM: () => {},
    setToggleMove: (i, on) => { if (players[i]) players[i].toggleMove = on; },
    setPlayerViz: (i, mode) => { if (players[i]) players[i].viz = mode; },
    ...over,
  };
  return { ctx, state, said, alerted };
}

function setPlayers(list) {
  players.length = 0;
  list.forEach((p) => players.push(p));
  setNumPlayersValue(list.length || 1);
}

beforeEach(() => {
  document.body.innerHTML = '';
  setPlayers([{ viz: 'normal', toggleMove: false }]);
});

// Monta uma tela de pausa e a PLUGA no documento (o clique precisa de árvore de verdade p/ o closest()).
function mount(i = 0, over = {}) {
  const { ctx, state, said, alerted } = makeCtx(over);
  const api = initPauseIcons(ctx);
  const sp = api.buildScreenPause(i);
  document.body.appendChild(sp);
  state.screens = [sp];
  return { api, sp, ctx, state, said, alerted };
}

describe('buildScreenPause — a árvore construída', () => {
  it('nasce ESCONDIDA, com a classe e o dono marcados (o menu é por tela, não global)', () => {
    const { sp } = mount(2);
    expect(sp.className).toBe('screen-pause');
    expect(sp.hidden).toBe(true);
    expect(sp.dataset.player).toBe('2');
  });

  it('o cartão é um diálogo MODAL nomeado pelo jogador dono', () => {
    const { sp } = mount(1);
    const card = sp.querySelector('.pause-card');
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-modal')).toBe('true');
    expect(card.getAttribute('aria-label')).toBe('Menu de pausa do jogador 2');
  });

  it('a barra de ícones é um group nomeado, com um botão por ícone declarado', () => {
    const { sp } = mount();
    const bar = sp.querySelector('.pause-icons');
    expect(bar.getAttribute('role')).toBe('group');
    expect(bar.getAttribute('aria-label')).toBe('Atalhos de acessibilidade');
    expect(bar.querySelectorAll('.pi-btn')).toHaveLength(PAUSE_ICONS.length);
  });

  it('INVARIANTE: todo .pi-btn tem aria-label NÃO-VAZIO, type=button e data-pi', () => {
    const { sp } = mount();
    const btns = [...sp.querySelectorAll('.pi-btn')];
    expect(btns).toHaveLength(PAUSE_ICONS.length);
    for (const b of btns) {
      expect((b.getAttribute('aria-label') || '').trim().length).toBeGreaterThan(0);
      expect(b.getAttribute('type')).toBe('button');
      expect(b.dataset.pi).toBeTruthy();
    }
  });

  it('os ícones EM CONSTRUÇÃO se declaram como tal — no rótulo e na classe', () => {
    const { sp } = mount();
    for (const ic of PAUSE_ICONS) {
      const b = sp.querySelector(`.pi-btn[data-pi="${ic.k}"]`);
      expect(b.classList.contains('pi-soon')).toBe(!!ic.soon);
      expect(b.getAttribute('aria-label').includes('(em construção)')).toBe(!!ic.soon);
    }
  });

  it('a legenda dos ícones é uma região aria-live "polite" e começa VAZIA', () => {
    const { sp } = mount();
    const cap = sp.querySelector('.pause-icons-cap');
    expect(cap.getAttribute('aria-live')).toBe('polite');
    expect(cap.textContent).toBe('');
  });

  it('o menu é um role=menu com um role=menuitem por entrada de PM_BTNS, na ordem', () => {
    const { sp } = mount();
    const menu = sp.querySelector('.pause-menu');
    expect(menu.getAttribute('role')).toBe('menu');
    const items = [...menu.querySelectorAll('.pm-btn')];
    expect(items.map((b) => b.dataset.act)).toEqual(['resume', 'letra', 'quit']);
    for (const b of items) expect(b.getAttribute('role')).toBe('menuitem');
  });

  it('o botão de rótulo DINÂMICO (ABC) não ganha data-i18n — senão o applyDom o apagaria', () => {
    const { sp } = mount();
    const letra = sp.querySelector('.pm-btn[data-act="letra"]');
    expect(letra.classList.contains('pm-letra')).toBe(true);
    expect(letra.hasAttribute('data-i18n')).toBe(false);
    expect(sp.querySelector('.pm-btn[data-act="quit"]').getAttribute('data-i18n')).toBe('pause.quit');
  });

  it('o título traduz pelo i18n REAL (pt) e é marcado para retradução', () => {
    const { sp } = mount();
    const h = sp.querySelector('h2 span[data-i18n="pause.title"]');
    expect(h.textContent).toBe('Pausado');
  });

  it('UM jogador: sem sufixo no título. MUITOS: com "· Jogador N"', () => {
    const um = mount().sp;
    expect(um.querySelector('h2').textContent).not.toContain('Jogador');
    setPlayers([{ viz: 'normal' }, { viz: 'normal' }]);
    const dois = mount(1).sp;
    expect(dois.querySelector('h2').textContent).toContain('· Jogador 2');
  });

  it('o rodapé de legenda de sim/não existe e é escondido do leitor (é dica visual de botão físico)', () => {
    const { sp } = mount();
    const lg = sp.querySelector('.pause-legend');
    expect(lg.getAttribute('aria-hidden')).toBe('true');
    expect(lg.textContent).toBe('');
  });
});

describe('buildScreenPause — delegação de clique nos .pm-btn', () => {
  it('clicar num item registra o jogador que agiu E roda a ação da tabela', () => {
    setPlayers([{ viz: 'normal' }, { viz: 'normal' }]);
    const { sp, state } = mount(1);
    sp.querySelector('.pm-btn[data-act="resume"]').click();
    expect(state.pauseActor).toBe(1);
    expect(state.ran).toEqual(['resume']);
  });

  it('EXCEÇÃO: item cujo data-act não existe na tabela registra o ator e não lança', () => {
    const { sp, state } = mount(0);
    expect(() => sp.querySelector('.pm-btn[data-act="quit"]').click()).not.toThrow();
    expect(state.pauseActor).toBe(0);
    expect(state.ran).toEqual([]);
  });

  it('clique fora de qualquer botão não faz nada', () => {
    const { sp, state } = mount();
    sp.querySelector('.pause-legend').click();
    expect(state.pauseActor).toBe(-1);
    expect(state.ran).toEqual([]);
  });
});

describe('buildScreenPause — delegação de clique nos .pi-btn', () => {
  it('clicar num ícone age, REFLETE e escreve na legenda o estado NOVO (não o antigo)', () => {
    const { sp, state } = mount(0);
    const b = sp.querySelector('.pi-btn[data-pi="blind"]');
    expect(b.getAttribute('aria-label')).toBe('Modo cego (navegação sonora)'); // rótulo cru do markup
    b.click();
    expect(state.modoCego).toBe(true);
    expect(state.pauseActor).toBe(0);
    expect(b.getAttribute('aria-label')).toBe('Modo cego (navegação sonora): on');
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(sp.querySelector('.pause-icons-cap').textContent).toBe('Modo cego (navegação sonora): on');
  });

  it('clicar de novo desliga e a legenda acompanha (Right-BICEP: inverso)', () => {
    const { sp } = mount(0);
    const b = sp.querySelector('.pi-btn[data-pi="blind"]');
    b.click(); b.click();
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(sp.querySelector('.pause-icons-cap').textContent).toBe('Modo cego (navegação sonora): off');
  });

  it('BORDA do TEA: 3 cliques passam por .pi-calm → .pi-on → base, com a legenda certa em cada passo', () => {
    const { sp } = mount(0);
    const b = sp.querySelector('.pi-btn[data-pi="tea"]');
    b.click();
    expect(b.classList.contains('pi-calm')).toBe(true);
    expect(b.classList.contains('pi-on')).toBe(false);
    expect(sp.querySelector('.pause-icons-cap').textContent).toBe('Modo TEA: calmo');
    b.click();
    expect(b.classList.contains('pi-calm')).toBe(false);
    expect(b.classList.contains('pi-on')).toBe(true);
    b.click();
    expect(b.classList.contains('pi-calm')).toBe(false);
    expect(b.classList.contains('pi-on')).toBe(false);
    expect(b.getAttribute('aria-pressed')).toBe('false');
  });

  it('EXCEÇÃO: clicar num ícone EM CONSTRUÇÃO alerta e NÃO o marca como ligado', () => {
    const { sp, alerted } = mount(0);
    const b = sp.querySelector('.pi-btn[data-pi="voice"]');
    b.click();
    expect(alerted).toHaveLength(1);
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(b.classList.contains('pi-on')).toBe(false);
    expect(b.getAttribute('aria-label')).toBe('Comando de voz (em construção)'); // o reflexo não sobrescreve
  });

  it('MUITAS telas: o clique numa tela reflete TODAS (o estado de daltonismo é por jogador)', () => {
    setPlayers([{ viz: 'normal' }, { viz: 'normal' }]);
    const { ctx, state } = makeCtx();
    const api = initPauseIcons(ctx);
    const s0 = api.buildScreenPause(0), s1 = api.buildScreenPause(1);
    document.body.append(s0, s1);
    state.screens = [s0, s1];
    s0.querySelector('.pi-btn[data-pi="cvd"]').click();
    expect(s0.querySelector('.pi-btn[data-pi="cvd"]').classList.contains('pi-cvd-protan')).toBe(true);
    expect(s1.querySelector('.pi-btn[data-pi="cvd"]').classList.contains('pi-cvd-protan')).toBe(false);
    expect(s1.querySelector('.pi-btn[data-pi="cvd"]').getAttribute('aria-label')).toBe('Correção de daltonismo: off');
  });
});

describe('buildScreenPause — a legenda segue o foco e o mouse', () => {
  it('focar um ícone copia o aria-label para a legenda (mesma verdade p/ quem vê e p/ quem ouve)', () => {
    const { sp } = mount();
    const b = sp.querySelector('.pi-btn[data-pi="contrast"]');
    b.dispatchEvent(new FocusEvent('focus'));
    expect(sp.querySelector('.pause-icons-cap').textContent).toBe(b.getAttribute('aria-label'));
  });

  it('passar o mouse faz o mesmo', () => {
    const { sp } = mount();
    const b = sp.querySelector('.pi-btn[data-pi="libras"]');
    b.dispatchEvent(new MouseEvent('mouseenter'));
    expect(sp.querySelector('.pause-icons-cap').textContent).toBe('Modo pessoa surda (Libras)');
  });

  it('depois de um reflexo, o foco mostra o estado ATUAL — não o rótulo cru do markup', () => {
    const { api, sp, state } = mount();
    state.modoCego = true;
    api.reflectPauseIcons();
    const b = sp.querySelector('.pi-btn[data-pi="blind"]');
    b.dispatchEvent(new FocusEvent('focus'));
    expect(sp.querySelector('.pause-icons-cap').textContent).toBe('Modo cego (navegação sonora): on');
  });
});

describe('reflectIconsIn — a barra do SPLASH (#title-icons) usa a mesma casca', () => {
  it('a mesma marcação de ícones reflete no escopo do jogador 1', () => {
    setPlayers([{ viz: 'fix-tritan', toggleMove: true }]);
    const { ctx } = makeCtx();
    const api = initPauseIcons(ctx);
    document.body.innerHTML = '<div id="title-icons"></div>';
    const ti = document.querySelector('#title-icons');
    ti.innerHTML = api.buildScreenPause(0).querySelector('.pause-icons').innerHTML;
    api.reflectIconsIn(ti, 0);
    expect(ti.querySelector('.pi-btn[data-pi="cvd"]').classList.contains('pi-cvd-tritan')).toBe(true);
    expect(ti.querySelector('.pi-btn[data-pi="altmove"]').getAttribute('aria-pressed')).toBe('true');
    expect(ti.querySelector('.pi-btn[data-pi="face"]').getAttribute('aria-pressed')).toBe('false');
  });
});
