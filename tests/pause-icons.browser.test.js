// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/pause-icons — a CASCA de DOM (project BROWSER: buildScreenPause usa document.createElement +
// innerHTML, coisa que o project node não consegue exercitar). A lógica pura (rótulos, ciclos, plano do TEA,
// markup como string) está em pause-icons.node.test.js e NÃO é repetida aqui — aqui provamos só o que só o
// navegador prova: a árvore construída, a delegação de clique, e a legenda que segue o foco/mouse.
//
// `players`/`numPlayers` são os módulos REAIS (core/state.ts) — os mesmos bindings vivos que o
// game.js usa; o resto do ctx é falso (spies).
import { describe, it, expect, beforeEach } from 'vitest';
import { PAUSE_ICONS, initPauseIcons } from '../app/js/ui/pause-icons.js';
import { createRunState } from '../app/js/core/run-state.js';
// A RODADA é local a este arquivo desde 2026-08-26 (ADR-0038, Fase B): `players`/`numPlayers` deixaram de
// ser `let` de `core/state` e passaram a viver na instância que a raiz de composição possui. Aqui o teste
// cria a sua, e os apelidos abaixo mantêm o corpo dos casos escrito como sempre esteve.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);


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
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    srSay: (m) => said.push(m),
    srAlert: (m) => alerted.push(m),
    pmButtons: PM_BTNS,
    optionsButtons: PM_OPTS,
    // O RÓTULO DINÂMICO chega pronto do jogo (item 19). Este fixture não tem botão de nível, então `null` é
    // a resposta certa — e é a que exercita o caminho estático, que é o que os casos daqui medem.
    dynLabel: () => null,
    getPauseActs: () => acts,
    setPauseActor: (i) => { state.pauseActor = i; },
    getPauseScreens: () => state.screens,
    // As BARRAS RÁPIDAS (ADR-0044, item 7): desde que elas saíram do cartão, é aqui que os ícones vivem, e é
    // por aqui que `reflectPauseIcons` os encontra. Os testes que exercitam o reflexo alimentam `state.bars`;
    // os que só olham o markup do cartão deixam a lista vazia — e o reflexo então não faz nada, corretamente.
    getA11yBars: () => state.bars || state.screens,
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
/**
 * Monta a tela `i` INTEIRA: a barra rápida e o cartão de pausa, irmãos, como o `ui/hud` os pendura.
 *
 * Desde o item 7 do ADR-0044 os ícones NÃO moram mais dentro do cartão — montar só a pausa deixaria metade
 * dos casos deste arquivo medindo uma árvore que a produção não tem.
 */
function mount(i = 0, over = {}) {
  const { ctx, state, said, alerted } = makeCtx(over);
  const api = initPauseIcons(ctx);
  const bar = api.buildQuickBar(i);
  const sp = api.buildScreenPause(i);
  document.body.append(bar, sp);
  state.screens = [sp];
  state.bars = [bar];
  return { api, sp, bar, ctx, state, said, alerted };
}

describe('buildScreenPause — a árvore construída', () => {
  it('nasce ESCONDIDA, com a classe e o dono marcados (o menu é por tela, não global)', () => {
    const { sp, bar } = mount(2);
    expect(sp.className).toBe('screen-pause');
    expect(sp.hidden).toBe(true);
    expect(sp.dataset.player).toBe('2');
  });

  it('o cartão é um diálogo MODAL nomeado pelo jogador dono', () => {
    const { sp, bar } = mount(1);
    const card = sp.querySelector('.pause-card');
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-modal')).toBe('true');
    expect(card.getAttribute('aria-label')).toBe('Menu de pausa do jogador 2');
  });

  it('a barra de ícones é um group nomeado, com um botão por ícone declarado', () => {
    const { bar } = mount();
    const grupo = bar.querySelector('.pause-icons');
    expect(grupo.getAttribute('role')).toBe('group');
    expect(grupo.getAttribute('aria-label')).toBe('Atalhos de acessibilidade');
    expect(grupo.querySelectorAll('.pi-btn')).toHaveLength(PAUSE_ICONS.length);
  });

  it('INVARIANTE: todo .pi-btn tem aria-label NÃO-VAZIO, type=button e data-pi', () => {
    const { sp, bar } = mount();
    const btns = [...bar.querySelectorAll('.pi-btn')];
    expect(btns).toHaveLength(PAUSE_ICONS.length);
    for (const b of btns) {
      expect((b.getAttribute('aria-label') || '').trim().length).toBeGreaterThan(0);
      expect(b.getAttribute('type')).toBe('button');
      expect(b.dataset.pi).toBeTruthy();
    }
  });

  it('os ícones EM CONSTRUÇÃO se declaram como tal — no rótulo e na classe', () => {
    const { sp, bar } = mount();
    for (const ic of PAUSE_ICONS) {
      const b = bar.querySelector(`.pi-btn[data-pi="${ic.k}"]`);
      expect(b.classList.contains('pi-soon')).toBe(!!ic.soon);
      expect(b.getAttribute('aria-label').includes('(em construção)')).toBe(!!ic.soon);
    }
  });

  it('a legenda dos ícones é uma região aria-live "polite" e começa VAZIA', () => {
    const { sp, bar } = mount();
    const cap = bar.querySelector('.pause-icons-cap');
    expect(cap.getAttribute('aria-live')).toBe('polite');
    expect(cap.textContent).toBe('');
  });

  it('o menu é um role=menu com um role=menuitem por entrada de PM_BTNS, na ordem', () => {
    const { sp, bar } = mount();
    const menu = sp.querySelector('.pause-menu');
    expect(menu.getAttribute('role')).toBe('menu');
    const items = [...menu.querySelectorAll('.pm-btn')];
    expect(items.map((b) => b.dataset.act)).toEqual(['resume', 'letra', 'quit']);
    for (const b of items) expect(b.getAttribute('role')).toBe('menuitem');
  });

  it('o botão de rótulo DINÂMICO (ABC) não ganha data-i18n — senão o applyDom o apagaria', () => {
    const { sp, bar } = mount();
    const letra = sp.querySelector('.pm-btn[data-act="letra"]');
    expect(letra.classList.contains('pm-letra')).toBe(true);
    expect(letra.hasAttribute('data-i18n')).toBe(false);
    expect(sp.querySelector('.pm-btn[data-act="quit"]').getAttribute('data-i18n')).toBe('pause.quit');
  });

  it('o título traduz pelo i18n REAL (pt) e é marcado para retradução', () => {
    const { sp, bar } = mount();
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

  it('o rodapé de legenda de sim/não existe e NÃO é mais escondido do leitor (ADR-0044, item 4)', () => {
    // A versão anterior deste caso afirmava o contrário, e afirmava com um motivo escrito — "é dica visual de
    // botão físico". O motivo estava errado pela metade: a dica é visual, mas a INFORMAÇÃO ("qual botão
    // confirma") é de todo mundo, e a XAG 106 manda narrá-la. Quem fica mudo agora são os chips, porque `✕`
    // lido em voz alta é "sinal de multiplicação"; a frase equivalente em palavras vive num `.sr-only`.
    const { sp, bar } = mount();
    const lg = sp.querySelector('.pause-legend');
    expect(lg.getAttribute('aria-hidden')).toBe(null);
    expect(lg.textContent).toBe(''); // nasce vazia: quem a preenche é o `renderPauseLegend` da raiz
  });
});

describe('buildScreenPause — delegação de clique nos .pm-btn', () => {
  it('clicar num item registra o jogador que agiu E roda a ação da tabela', () => {
    setPlayers([{ viz: 'normal' }, { viz: 'normal' }]);
    const { sp, bar, state } = mount(1);
    sp.querySelector('.pm-btn[data-act="resume"]').click();
    expect(state.pauseActor).toBe(1);
    expect(state.ran).toEqual(['resume']);
  });

  it('EXCEÇÃO: item cujo data-act não existe na tabela registra o ator e não lança', () => {
    const { sp, bar, state } = mount(0);
    expect(() => sp.querySelector('.pm-btn[data-act="quit"]').click()).not.toThrow();
    expect(state.pauseActor).toBe(0);
    expect(state.ran).toEqual([]);
  });

  it('clique fora de qualquer botão não faz nada', () => {
    const { sp, bar, state } = mount();
    sp.querySelector('.pause-legend').click();
    expect(state.pauseActor).toBe(-1);
    expect(state.ran).toEqual([]);
  });
});

/**
 * O que a legenda de um ícone deve dizer AGORA: o `aria-label` (que já conta o estado) seguido da POSIÇÃO na
 * barra — item 3 do ADR-0044, XAG 106, e o número vai no FIM.
 *
 * A posição é recontada AQUI, a partir do DOM, e não lida da implementação: se as duas contas divergirem, é
 * porque uma delas está errada, e é justamente isso que o caso existe para descobrir.
 */
function legendaEsperada(bar, b) {
  const icones = [...bar.querySelectorAll('.pi-btn')];
  return b.getAttribute('aria-label') + ', ' + (icones.indexOf(b) + 1) + ' de ' + icones.length;
}

describe('buildScreenPause — delegação de clique nos .pi-btn', () => {
  it('clicar num ícone age, REFLETE e escreve na legenda o estado NOVO (não o antigo)', () => {
    const { sp, bar, state } = mount(0);
    const b = bar.querySelector('.pi-btn[data-pi="blind"]');
    expect(b.getAttribute('aria-label')).toBe('Modo cego (navegação sonora)'); // rótulo cru do markup
    b.click();
    expect(state.modoCego).toBe(true);
    expect(state.pauseActor).toBe(0);
    expect(b.getAttribute('aria-label')).toBe('Modo cego (navegação sonora): ligado');
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('Modo cego (navegação sonora): ligado');
  });

  it('clicar de novo desliga e a legenda acompanha (Right-BICEP: inverso)', () => {
    const { sp, bar } = mount(0);
    const b = bar.querySelector('.pi-btn[data-pi="blind"]');
    b.click(); b.click();
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('Modo cego (navegação sonora): desligado');
  });

  it('BORDA do TEA: 3 cliques passam por .pi-calm → .pi-on → base, com a legenda certa em cada passo', () => {
    const { sp, bar } = mount(0);
    const b = bar.querySelector('.pi-btn[data-pi="tea"]');
    b.click();
    expect(b.classList.contains('pi-calm')).toBe(true);
    expect(b.classList.contains('pi-on')).toBe(false);
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('Modo TEA: calmo');
    b.click();
    expect(b.classList.contains('pi-calm')).toBe(false);
    expect(b.classList.contains('pi-on')).toBe(true);
    b.click();
    expect(b.classList.contains('pi-calm')).toBe(false);
    expect(b.classList.contains('pi-on')).toBe(false);
    expect(b.getAttribute('aria-pressed')).toBe('false');
  });

  it('EXCEÇÃO: clicar num ícone EM CONSTRUÇÃO alerta e NÃO o marca como ligado', () => {
    const { sp, bar, alerted } = mount(0);
    const b = bar.querySelector('.pi-btn[data-pi="voice"]');
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
    // Desde o item 7 do ADR-0044 os ícones vivem na BARRA de cada tela, e não no cartão — o que este caso
    // mede (o daltonismo é por jogador) continua sendo exatamente o mesmo, um nível de árvore ao lado.
    const b0 = api.buildQuickBar(0), b1 = api.buildQuickBar(1);
    const s0 = api.buildScreenPause(0), s1 = api.buildScreenPause(1);
    document.body.append(b0, s0, b1, s1);
    state.screens = [s0, s1];
    state.bars = [b0, b1];
    b0.querySelector('.pi-btn[data-pi="cvd"]').click();
    expect(b0.querySelector('.pi-btn[data-pi="cvd"]').classList.contains('pi-cvd-protan')).toBe(true);
    expect(b1.querySelector('.pi-btn[data-pi="cvd"]').classList.contains('pi-cvd-protan')).toBe(false);
    expect(b1.querySelector('.pi-btn[data-pi="cvd"]').getAttribute('aria-label')).toBe('Correção de daltonismo: desligado');
  });
});

describe('buildScreenPause — a legenda segue o foco e o mouse', () => {
  it('focar um ícone copia o aria-label para a legenda (mesma verdade p/ quem vê e p/ quem ouve)', () => {
    const { sp, bar } = mount();
    const b = bar.querySelector('.pi-btn[data-pi="contrast"]');
    b.dispatchEvent(new FocusEvent('focus'));
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent.startsWith(b.getAttribute('aria-label'))).toBe(true);
  });

  it('passar o mouse faz o mesmo', () => {
    const { sp, bar } = mount();
    const b = bar.querySelector('.pi-btn[data-pi="libras"]');
    b.dispatchEvent(new MouseEvent('mouseenter'));
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('Modo pessoa surda (Libras)');
  });

  it('depois de um reflexo, o foco mostra o estado ATUAL — não o rótulo cru do markup', () => {
    const { api, sp, bar, state } = mount();
    state.modoCego = true;
    api.reflectPauseIcons();
    const b = bar.querySelector('.pi-btn[data-pi="blind"]');
    b.dispatchEvent(new FocusEvent('focus'));
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('Modo cego (navegação sonora): ligado');
  });
});

describe('reflectIconsIn — a barra do SPLASH (#title-icons) usa a mesma casca', () => {
  it('a mesma marcação de ícones reflete no escopo do jogador 1', () => {
    setPlayers([{ viz: 'fix-tritan', toggleMove: true }]);
    const { ctx } = makeCtx();
    const api = initPauseIcons(ctx);
    document.body.innerHTML = '<div id="title-icons"></div>';
    const ti = document.querySelector('#title-icons');
    ti.innerHTML = api.buildQuickBar(0).querySelector('.pause-icons').innerHTML;
    api.reflectIconsIn(ti, 0);
    expect(ti.querySelector('.pi-btn[data-pi="cvd"]').classList.contains('pi-cvd-tritan')).toBe(true);
    expect(ti.querySelector('.pi-btn[data-pi="altmove"]').getAttribute('aria-pressed')).toBe('true');
    expect(ti.querySelector('.pi-btn[data-pi="face"]').getAttribute('aria-pressed')).toBe('false');
  });
});
