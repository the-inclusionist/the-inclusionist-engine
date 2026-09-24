// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/pause-icons — the DOM SHELL (BROWSER project: buildScreenPause uses document.createElement + innerHTML,
// which the node project cannot exercise). The pure logic (labels, cycles, the ASD plan, markup as a string) is in
// pause-icons.node.test.js and is NOT repeated here — here we prove only what only the browser proves: the built tree,
// click delegation, and the caption that follows focus/mouse.
//
// `players`/`numPlayers` come from a local round double (below); the rest of the ctx is fake (spies).
import { describe, it, expect, beforeEach } from 'vitest';
import { initPauseIcons, showPauseOptions } from '../app/js/ui/pause-icons.js';
import { PAUSE_ICONS } from '../app/js/core/pause-icon-catalogue.js';
import { migrateVisual, DEFAULT_VISUAL } from '../app/js/render/viz-axes.js';
/*
 * 🔴 THE ROUND IS A LOCAL DOUBLE (ADR-0228: `core/run-state` moved to `game-platformer` with the tile-world stack). This
 * file never tests the round — it HANDS one to what it measures — and the three members below are exactly the ones it
 * reads. A factory and not a literal: two rounds must be two objects.
 */
const createRunState = () => ({ numPlayers: 1, players: [], setNumPlayers(n) { this.numPlayers = n; } });
// `players`/`numPlayers` live in the instance the composition root owns (ADR-0038, Phase B), not in `core/state`. Here
// the test creates its own, and the aliases below keep the cases' bodies short.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);


const PM_BTNS = [
  { act: 'resume', lbl: '▶ Continuar' },
  { act: 'letra', lbl: '🔠 ABC', dynamicLabel: true },
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
    blindMode: false, libras: false, pauseActor: -1, screens: [], ran: [],
    audioCat: { tts: { on: false, vol: 1 }, ambient: { on: true, vol: 1 }, music: { on: true, vol: 1 }, earcons: { on: true, vol: 1 }, other: { on: true, vol: 1 }, interact: { on: true, vol: 1 } },
    rm: { parallax: false, decor: false, items: false, particles: false },
  };
  const acts = {
    resume: () => state.ran.push('resume'),
    letra: () => state.ran.push('letra'),
    // 'quit' deliberately ABSENT: the menu must not offer it live (see the ADR-0161 case below).
  };
  const ctx = {
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    srSay: (m) => said.push(m),
    srAlert: (m) => alerted.push(m),
    pmButtons: PM_BTNS,
    optionsButtons: PM_OPTS,
    // The DYNAMIC LABEL comes ready from the game (item 19). This fixture has no level button, so `null` is the right
    // answer — and it exercises the static path, which is what the cases here measure.
    dynLabel: () => null,
    getPauseActs: () => acts,
    setPauseActor: (i) => { state.pauseActor = i; },
    getPauseScreens: () => state.screens,
    // The QUICK BARS (ADR-0044, item 7): the icons live here, not in the card, and this is where `reflectPauseIcons` finds
    // them. The tests that exercise the reflection feed `state.bars`; those that only look at the card's markup leave the
    // list empty — and the reflection then does nothing, correctly.
    getA11yBars: () => state.bars || state.screens,
    getBlindMode: () => state.blindMode,
    setBlindMode: (on) => { state.blindMode = on; },
    getAudioCat: () => state.audioCat,
    setCatGain: () => {},
    reflectTtsPanel: () => {},
    reflectTtsPanelEnabled: false,
    isLibrasOn: () => state.libras,
    toggleLibras: () => { state.libras = !state.libras; },
    rm: state.rm, rmKeys: RM_KEYS, rmChar: RM_CHAR, saveRM: () => {},
    matchMedia: () => ({ matches: false }), // the system asks for no reduction (ADR-0232: injected, not reached)
    setToggleMove: (i, on) => { if (players[i]) players[i].toggleMove = on; },
    setPlayerViz: (i, mode) => { if (players[i]) { players[i].viz = mode; players[i].visual = migrateVisual(mode); } },
    // The PER-AXIS writers (#104): each icon writes to its own, and the other stays where it was.
    setPlayerTheme: (i, tema) => { if (players[i]) players[i].visual = { ...(players[i].visual ?? DEFAULT_VISUAL), tema }; },
    setPlayerCorrection: (i, correcao) => { if (players[i]) players[i].visual = { ...(players[i].visual ?? DEFAULT_VISUAL), correcao }; },
    // This double has a PLATFORMER's shape — it holds direction — so its bar has the `altmove` (ADR-0115). The half that
    // proves the ABSENCE lives in the node project, where the rule lives.
    holdsKeys: () => true,
    // 📌 The 11th icon (ADR-0149) is only mounted for whoever can walk the typography cycle — the same rule as the two
    // visual writers above. This file measures the INVARIANTS of the mounted bar and not the filter, which lives in the
    // node project; without this line it would measure a bar with one icon fewer.
    cycleTypography: () => 'Atkinson Hyperlegible',
    clock: () => true, // the hourglass (ADR-0180) mounts only where time runs by itself
    camera: true, // the 📷 (ADR-0215) mounts only where the root has a camera to ask for
    microphone: true, // the 👄 (issue #184) mounts only where there is a microphone to ask for
    openMenus: (i) => state.ran.push('menus:' + i), // the ☰ mounts only where there is a card to open
    ...over,
  };
  return { ctx, state, said, alerted };
}

function setPlayers(list) {
  players.length = 0;
  // DERIVES the two-axis state from the old key — the same rule as the mirror production keeps (#104).
  list.forEach((p) => players.push(
    p && p.visual === undefined && p.viz !== undefined ? { ...p, visual: migrateVisual(p.viz) } : p,
  ));
  setNumPlayersValue(list.length || 1);
}

beforeEach(() => {
  document.body.innerHTML = '';
  setPlayers([{ viz: 'normal', toggleMove: false }]);
});

// Mounts a pause screen and PLUGS it into the document (the click needs a real tree for closest()).
/**
 * Mounts screen `i` WHOLE: the quick bar and the pause card, siblings, as `ui/hud` hangs them.
 *
 * The icons do NOT live inside the card (ADR-0044 item 7) — mounting only the pause would leave half of this file's
 * cases measuring a tree production does not have.
 */
/**
 * The card's LIVE items — the .pm-btn that are neither hidden nor locked.
 *
 * ⚠️ LIVE and not PRESENT: the card mounts the whole list and decides at each opening, instead of filtering at start-up
 * with a table the field itself declares arrives LATE (an item whose action existed only after boot would never
 * appear). Since ADR-0161 no item hides: what the game does not action stays LOCKED (`aria-disabled`) and says why.
 * §5's question («este item faz alguma coisa?») is the same; «live» means «not hidden AND not locked».
 */
const actsVisiveis = (sp) => [...sp.querySelectorAll('.pm-btn')]
  .filter((b) => !b.hidden && b.getAttribute('aria-disabled') !== 'true').map((b) => b.dataset.act);

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

  it('🔴 [Right] the ☰ is the FIRST icon: it opens the menus of ITS seat and does not announce itself as a toggle', () => {
    const { bar, state } = mount(1);
    const menu = bar.querySelector('.pi-btn');
    expect(menu.dataset.pi).toBe('menu');
    menu.click();
    expect(state.ran).toContain('menus:1');
    expect(menu.hasAttribute('aria-pressed'), 'the ☰ reads as a toggle').toBe(false);
  });

  it('🔴 [Zero] without a card to open there is no ☰ — a button that opens nothing is the dead button of ADR-0106 §5', () => {
    const { bar } = mount(0, { openMenus: undefined });
    expect(bar.querySelector('.pi-btn[data-pi="menu"]')).toBeNull();
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

  // 🔴 THE MOUNTED BAR HAS NO «EM CONSTRUÇÃO» (issue #184): the whole mechanism is gone — the field, the `.pi-soon` class,
  // the label suffix and the `style.css` rule. This case guards the absence ON SCREEN, where it counts: a button dimmed to
  // 55% with «em construção» in its name, over an icon that acts, teaches the child not to try.
  it('🔴 [Zero] nenhum ícone da barra montada se declara em construção — nem na classe, nem no rótulo', () => {
    const { sp, bar } = mount();
    for (const ic of PAUSE_ICONS) {
      const b = bar.querySelector(`.pi-btn[data-pi="${ic.k}"]`);
      expect(b.classList.contains('pi-soon'), `${ic.k} nasceu com \`pi-soon\``).toBe(false);
      expect(b.getAttribute('aria-label'), `${ic.k} nasceu «em construção»`).not.toMatch(/em constru|under construction|en construcci/i);
    }
  });

  it('a legenda dos ícones é uma região aria-live "polite" e começa VAZIA', () => {
    const { sp, bar } = mount();
    const cap = bar.querySelector('.pause-icons-cap');
    expect(cap.getAttribute('aria-live')).toBe('polite');
    expect(cap.textContent).toBe('');
  });

  it('🔴 `quit` sem tabela FICA no menu, travado e com o motivo — não escondido (ADR-0161, supersede o §5 aqui)', () => {
    const { sp } = mount();
    const quit = sp.querySelector('.pause-menu .pm-btn[data-act="quit"]');
    expect(quit.hidden, 'the locked item vanished: the card changes shape per game again').toBe(false);
    expect(quit.getAttribute('aria-disabled')).toBe('true');
    expect((quit.dataset.motivo ?? '').length, 'a locked item without its reason').toBeGreaterThan(0);
  });

  // ============ found by the probe of 2026-09-24 (`scratchpad/sonda-pausa.py`): three answers of the card's click ============
  const visibleList = (sp) => sp.querySelector('.pause-menu:not([hidden])')?.dataset.sub;

  it('🔴 [Right] pressing a LOCKED item SAYS its reason — the footer is not the channel of a child who cannot see', () => {
    const { sp, said, state } = mount();
    const quit = sp.querySelector('.pause-menu .pm-btn[data-act="quit"]');
    said.length = 0;
    quit.click();
    expect(said).toEqual([quit.dataset.motivo]);
    expect(state.ran, 'a locked item did something').toEqual([]);
  });

  it('🔴 [Right] «Back» in a sub-list returns to the ROOT — also in a game with its own options panel', () => {
    // Two holes in one sentence: nothing held where «Back» goes, and with a game options PANEL declared, every item of the
    // card was read as the door with a panel — «Back» and «Settings» stopped switching lists, with every case green.
    for (const over of [{}, { getPauseActs: () => ({ resume: () => {}, opcoesdojogo: () => {} }) }]) {
      const { sp } = mount(0, over);
      showPauseOptions(sp, 'opcoes');
      sp.querySelector('.pause-menu[data-sub="opcoes"] .pm-btn[data-act="pmback"]').click();
      expect(visibleList(sp)).toBe('raiz');
    }
  });

  it('🔴 [Right] «Accessibility», where a game lists it, closes the card and puts the cursor on the quick bar', () => {
    // Both halves: entering the bar no longer resumes by itself (ADR-0155), so this item resumes explicitly — without it
    // the child would be on the bar with the card still open over the game.
    const { api, sp, state } = mount(0, { pmButtons: [...PM_BTNS, { act: 'acessibilidade', lbl: '♿ Acessibilidade' }] });
    sp.querySelector('.pm-btn[data-act="acessibilidade"]').click();
    expect(state.ran, 'the card stayed open').toContain('resume');
    expect(api.onBar(0)).toBe(true);
  });

  it('⚠️ o menu só OFERECE vivo o que o jogo ACCIONA — `quit` sem tabela fica travado (ADR-0106 §5 → ADR-0161)', () => {
    // ⚠️ The fixture omits `quit` from the table on purpose. The dispatch's `if (fn) fn()` means a click would not break —
    // but a menu that SHOWS a live button that does nothing makes a screen-reader user hear an item that does not exist.
    // So `quit` must not be offered live.
    const { sp } = mount();
    const menu = sp.querySelector('.pause-menu');
    expect(menu.getAttribute('role')).toBe('menu');
    const items = [...menu.querySelectorAll('.pm-btn')].filter((b) => !b.hidden && b.getAttribute('aria-disabled') !== 'true');
    expect(items.map((b) => b.dataset.act)).toEqual(['resume', 'letra']);
    for (const b of items) expect(b.getAttribute('role')).toBe('menuitem');
  });

  it('o botão de rótulo DINÂMICO (ABC) não ganha data-i18n — senão o applyDom o apagaria', () => {
    const { sp } = mount();
    const letra = sp.querySelector('.pm-btn[data-act="letra"]');
    expect(letra.classList.contains('pm-letra')).toBe(true);
    expect(letra.hasAttribute('data-i18n')).toBe(false);
    // The contrast is still made, with an item the game DOES action.
    expect(sp.querySelector('.pm-btn[data-act="resume"]').getAttribute('data-i18n')).toBe('pause.resume');
  });

  it('🔴 [Right] o PRIMEIRO item diz a mesma coisa em todo nível — sair daqui é uma palavra só', () => {
    // 🔴 The Dev, 22/09: «Não seria melhor usar "↩ Voltar" para o primeiro item do menu pausado também, ao invés de
    // "Voltar ao Jogo"?» ADR-0158 made «Voltar» item 1 of every panel, and the card follows. From the child's point of view
    // it is one word — leave here and go back to what I was doing — and the destination is always the previous level:
    // from a panel, the card; from the submenu, the root; from the root, the game. «Voltar ao jogo» named the DESTINATION
    // instead of the action.
    //
    // ⚠️ THE CASE HOLDS THE RULE, NOT THE STRING: it compares the two exits with each other, so a new translation that
    // changes only one of them fails. A case written against the text would pass the day someone changed the two
    // differently, which is exactly the defect.
    const { sp } = mount();
    const saidaDaRaiz = sp.querySelector('.pm-btn[data-act="resume"]');
    const saidaDoSubmenu = sp.querySelector('.pm-btn[data-act="pmback"]');
    expect(saidaDoSubmenu, 'sem submenu não há com que comparar').toBeTruthy();
    const palavra = (b) => (b.textContent ?? '').replace(/[^\p{L} ]/gu, '').trim();
    expect(palavra(saidaDaRaiz), 'a saída da raiz deixou de dizer o mesmo que a do submenu')
      .toBe(palavra(saidaDoSubmenu));
    // 📌 The glyph lives in a `data-glifo` and is drawn by the stylesheet, outside the name (ADR-0159 rule 12) — so THAT is
    // where it is measured, not in the text. ⚠️ Reading `textContent` stayed GREEN with the ▶ back: the glyph is not
    // there, and comparing two absences is comparing nothing.
    expect(saidaDaRaiz.dataset.glifo, 'os dois voltares não mostram o mesmo sinal')
      .toBe(saidaDoSubmenu.dataset.glifo);
    expect(saidaDaRaiz.dataset.glifo, 'a saída da raiz ficou sem sinal nenhum').toBeTruthy();
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
    // The hint is visual, but the INFORMATION ("which button confirms") is everyone's, and XAG 106 says to narrate it.
    // What stays mute are the chips, because `✕` read aloud is "multiplication sign"; the equivalent sentence in words lives
    // in a `.sr-only`.
    const { sp, bar } = mount();
    const lg = sp.querySelector('.pause-legend');
    expect(lg.getAttribute('aria-hidden')).toBe(null);
    expect(lg.textContent).toBe(''); // born empty: the root's `renderPauseLegend` fills it
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

  it('⚠️ EXCEÇÃO: um `data-act` desconhecido NO DOM registra o ator e não lança', () => {
    // Robustness still holds and is asserted, in this SCENARIO: the menu offers no live item without an action (the case
    // above), so an orphan `data-act` only arrives from outside — a host's markup, an extension, a test. Then the pause
    // must not fall: it records who pressed and does nothing more.
    const { sp, state } = mount(0);
    const menu = sp.querySelector('.pause-menu');
    const intruso = document.createElement('button');
    intruso.className = 'pm-btn';
    intruso.dataset.act = 'inexistente';
    menu.appendChild(intruso);
    expect(() => intruso.click()).not.toThrow();
    expect(state.pauseActor).toBe(0);
    expect(state.ran).toEqual([]);
  });

  it('⚠️ [Zero] sem tabela de ações NENHUMA, o cartão não oferece porta que não abre', () => {
    // §5's extreme case, and what it protects is `options`: it is actioned by the ENGINE, so it survives an item-by-item
    // filter — and would open an empty submenu whose only exit (`pmback`) went with it.
    //
    // ⚠️ AND IT USES THE ENGINE'S DEFAULT LIST on purpose (`pmButtons: undefined`). The fixture's list has no `options` at
    // all, so a case on it passed by VACUUM and the mutation removing the door rule SURVIVED. A case about an item the list
    // does not contain asserts nothing.
    const { sp } = mount(0, { pmButtons: undefined, optionsButtons: undefined, getPauseActs: () => ({}) });
    const actsMontados = actsVisiveis(sp);
    expect(actsMontados, 'a porta para o submenu vazio ficou').not.toContain('options');
    expect(actsMontados.filter((a) => a !== 'acessibilidade' && a !== 'pmback')).toEqual([]);
  });

  it('⚠️ [Right] uma acção que chega DEPOIS do boot faz o item APARECER na abertura seguinte', () => {
    // ⚠️ `getPauseActs` is a getter precisely because the table arrives LATE — «`pauseActs` is a `const` declared far below
    // the init site», says the field itself. `createGame` mounts during `createGame(...)` itself, so filtering in
    // `buildScreenPause` would make a consumer following that documented pattern lose FOREVER every item whose action
    // existed only after boot.
    //
    // 📌 `ui/shell` calls `reflectPauseIcons()` when the phase becomes `pause-menu` — when the pause OPENS — and that is
    // where the decision is made: the last possible instant before the child sees the card.
    let acts = {};                       // empty at start-up, as in the cartridge
    const { api, sp } = mount(0, { getPauseActs: () => acts });
    expect(actsVisiveis(sp), 'com a tabela vazia, só o que a engine acciona').not.toContain('quit');

    acts = { quit: () => {} };           // the table arrives LATER — which is what the laziness exists to allow
    api.reflectPauseIcons();             // what the shell does when the pause opens

    expect(actsVisiveis(sp), 'a acção chegou e o item continuou escondido para sempre').toContain('quit');
  });

  it('⚠️ [Right] e o inverso também: uma acção que DESAPARECE esconde o item outra vez', () => {
    // The other direction, and it matters: a game may withdraw «sair» during a tutorial. If the refresh only knew how to
    // show, the dead button would come back through the back door.
    let acts = { quit: () => {} };
    const { api, sp } = mount(0, { getPauseActs: () => acts });
    expect(actsVisiveis(sp)).toContain('quit');
    acts = {};
    api.reflectPauseIcons();
    expect(actsVisiveis(sp)).not.toContain('quit');
  });

  it('⚠️ [Right] com UM painel accionável, a porta `options` volta — a regra não é «esconder sempre»', () => {
    // The other side, which keeps the rule from costing the submenu to whoever has one: one live panel is enough for the
    // door to be worth it. Without this case, filtering `options` ALWAYS would also pass.
    const { sp } = mount(0, {
      pmButtons: undefined, optionsButtons: undefined,
      getPauseActs: () => ({ audio: () => {} }),
    });
    const actsMontados = actsVisiveis(sp);
    expect(actsMontados).toContain('options');
    expect(actsMontados).toContain('audio');
  });

  it('⚠️ [Right] a LISTA PADRÃO da engine existe — um jogo que não contribui com nada tem menu', () => {
    // ADR-0106 §4 closes with this sentence: «a engine entrega uma lista padrão, para que um jogo que não contribui com
    // nada tenha uma». A mandatory `pmButtons` is how games end up with no pause menu at all: nobody passes it.
    const { sp } = mount(0, {
      pmButtons: undefined, optionsButtons: undefined,
      getPauseActs: () => ({ resume: () => {}, ajuda: () => {} }),
    });
    const actsMontados = actsVisiveis(sp);
    expect(actsMontados.length, 'a lista padrão não montou nada').toBeGreaterThan(1);
    expect(actsMontados, 'sem `resume` a pausa é uma armadilha — ADR-0044 §2').toContain('resume');
    expect(actsMontados).toContain('ajuda');
  });

  it('clique fora de qualquer botão não faz nada', () => {
    const { sp, bar, state } = mount();
    sp.querySelector('.pause-legend').click();
    expect(state.pauseActor).toBe(-1);
    expect(state.ran).toEqual([]);
  });
});

/**
 * What an icon's caption should say NOW: the `aria-label` (which already tells the state) followed by the POSITION on the
 * bar — item 3 of ADR-0044, XAG 106, and the number goes at the END.
 *
 * The position is recounted HERE, from the DOM, not read from the implementation: if the two counts diverge, one of them
 * is wrong, and that is exactly what the case exists to find out.
 */
// ADR-0167: the VISIBLE name is the accessible name alone — «N de M» is spoken, never written under the bar.
function legendaEsperada(bar, b) {
  return b.getAttribute('aria-label');
}

describe('buildScreenPause — delegação de clique nos .pi-btn', () => {
  it('clicar num ícone age, REFLETE e escreve na legenda o estado NOVO (não o antigo)', () => {
    const { sp, bar, state } = mount(0);
    const b = bar.querySelector('.pi-btn[data-pi="blind"]');
    expect(b.getAttribute('aria-label')).toBe('Modo cego'); // rótulo cru do markup
    b.click();
    expect(state.blindMode).toBe(true);
    expect(state.pauseActor).toBe(0);
    expect(b.getAttribute('aria-label')).toBe('Modo cego: ligado');
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('Modo cego: ligado');
  });

  it('clicar de novo desliga e a legenda acompanha (Right-BICEP: inverso)', () => {
    const { sp, bar } = mount(0);
    const b = bar.querySelector('.pi-btn[data-pi="blind"]');
    b.click(); b.click();
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('Modo cego: desligado');
  });

  it('BORDA do TEA: 3 cliques passam por .pi-calm → .pi-on → base, com a legenda certa em cada passo', () => {
    // ⚠️ THE ASD LEVEL PERSISTS, and a browser's `localStorage` is shared by the files running in parallel: this case
    // failed under the whole suite (the first click did not give `.pi-calm`) and passed alone — the starting level came
    // from another file. It starts from level 0, written before mounting.
    try { localStorage.setItem('incl_tea', '0'); } catch { /* no storage: the default is already 0 */ }
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

  // 🔴 THE 👄 COMMANDS (issue #184): the click turns voice command on, and the button must SAY it turned on — who refuses,
  // and why, is `ui/voice-control`, which turns it back off with the reason spoken.
  it('🔴 [Right] clicar no 👄 liga o comando de voz, e o botão diz que ligou', () => {
    const { sp, bar, said } = mount(0);
    const b = bar.querySelector('.pi-btn[data-pi="voice"]');
    b.click();
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.classList.contains('pi-on')).toBe(true);
    expect(b.getAttribute('aria-label')).toBe('Comando de voz: ligado');
    expect(said.at(-1)).toBe('Comando de voz: ligado.');
    b.click();
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(b.getAttribute('aria-label')).toBe('Comando de voz: desligado');
  });

  it('MUITAS telas: o clique numa tela reflete TODAS (o estado de daltonismo é por jogador)', () => {
    setPlayers([{ viz: 'normal' }, { viz: 'normal' }]);
    const { ctx, state } = makeCtx();
    const api = initPauseIcons(ctx);
    // The icons live in each screen's BAR, not the card (ADR-0044 item 7) — what this case measures (colour blindness is
    // per player) is the same, one tree level over.
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
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('Modo pessoa surda');
  });

  it('depois de um reflexo, o foco mostra o estado ATUAL — não o rótulo cru do markup', () => {
    const { api, sp, bar, state } = mount();
    state.blindMode = true;
    api.reflectPauseIcons();
    const b = bar.querySelector('.pi-btn[data-pi="blind"]');
    b.dispatchEvent(new FocusEvent('focus'));
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('Modo cego: ligado');
  });
});

describe('modo `accessibility` — entrar, andar e SAIR (ADR-0044, item 7)', () => {
  // The ADR listed this mode among its own decision's NEGATIVE consequences: «um modo em que se entra e não se sabe sair é
  // a própria armadilha de que este registro trata». So the EXIT cases outnumber the entry ones, and the first of them is
  // the announcement — the sentence saying how to leave, said on entering, is the only thing separating the mode from the
  // trap for whoever cannot see the screen.

  it('[Right] entrar ANUNCIA como sair, põe o cursor no 1º ícone — e NÃO retoma o jogo (ADR-0155)', () => {
    const { api, bar, said, ctx } = mount();
    let retomou = 0;
    ctx.getPauseActs = () => ({ resume: () => { retomou++; } });
    api.enterBar(0);
    expect(api.onBar(0)).toBe(true);
    // 🔴 The bar is half of the QUICK PAUSE (ADR-0155), so resuming on entry would unfreeze the world the child stopped.
    expect(retomou, 'entrar na barra retomou o jogo que a pausa rápida acabou de congelar').toBe(0);
    expect(said.some((f) => /volt|back/i.test(f)), 'o anúncio de entrada tem de dizer como sair: ' + said.join(' | ')).toBe(true);
    expect(bar.querySelectorAll('.pi-sel')).toHaveLength(1);
  });

  it('[Right] VOLTAR sai do modo, limpa o cursor e anuncia a devolução', () => {
    const { api, bar, said } = mount();
    api.enterBar(0);
    said.length = 0;
    api.navBar(0, { no: true });
    expect(api.onBar(0)).toBe(false);
    expect(bar.querySelectorAll('.pi-sel')).toHaveLength(0);
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe('');
    expect(said.length, 'a devolução do controle também é informação').toBeGreaterThan(0);
  });

  it('[Right] START sai também — a segunda porta, e é ela que a pausa ensinou', () => {
    const { api } = mount();
    api.enterBar(0);
    api.navBar(0, {}, true);
    expect(api.onBar(0)).toBe(false);
  });

  it('🔴 TODA saída chama `aoSairDaBarra` — e a silenciosa não diz «de volta ao jogo» (ADR-0155)', () => {
    // ⚠️ It is the hook through which the root unfreezes the game. An exit that did not call it would leave the world
    // stopped with the child back on the character; and SELECT leaves silently because it goes to the card, not the game.
    const { api, said, ctx } = mount();
    const saidas = [];
    ctx.onLeaveBar = (i, silencioso) => saidas.push([i, silencioso]);
    api.enterBar(0);
    api.navBar(0, { no: true });
    api.enterBar(0);
    said.length = 0;
    api.leaveBar(0, true);
    expect(saidas, 'uma das saídas não avisou a raiz').toEqual([[0, false], [0, true]]);
    expect(said, 'a saída silenciosa anunciou a volta ao jogo').toEqual([]);
    api.leaveBar(0);
    expect(saidas, 'sair de um modo em que não se estava avisou a raiz').toHaveLength(2);
  });

  it('[Boundary] depois de sair, a direção NÃO mexe mais na barra', () => {
    // The case that proves the exit EXITS. Without it, `sairDaBarra` could clear the cursor and leave the mode on — and the
    // child would have "left" for a game where the character still does not walk.
    const { api, bar } = mount();
    api.enterBar(0);
    api.navBar(0, { no: true });
    api.navBar(0, { right: true });
    expect(bar.querySelectorAll('.pi-sel')).toHaveLength(0);
  });

  it('[Right] a direção anda na barra, em ANEL', () => {
    const { api, bar } = mount();
    api.enterBar(0);
    const icones = [...bar.querySelectorAll('.pi-btn')];
    api.navBar(0, { right: true });
    expect(icones[1].classList.contains('pi-sel')).toBe(true);
    api.navBar(0, { left: true });
    api.navBar(0, { left: true });
    expect(icones[icones.length - 1].classList.contains('pi-sel'), 'antes do primeiro está o último').toBe(true);
  });

  it('🔴 [Right] down and up walk the bar too, and every step starts from where the cursor IS', () => {
    // Found by re-probing the cut (2026-09-24): the ring case walks right once and left twice, which a walk from the
    // FIRST icon also passes, and no case pressed down or up — the directions a child on a d-pad reaches first.
    const { api, bar } = mount();
    api.enterBar(0);
    const icones = [...bar.querySelectorAll('.pi-btn')];
    api.navBar(0, { down: true });
    api.navBar(0, { down: true });
    expect(icones[2].classList.contains('pi-sel'), 'two steps down did not reach the third icon').toBe(true);
    api.navBar(0, { up: true });
    expect(icones[1].classList.contains('pi-sel'), 'a step up did not go back one').toBe(true);
  });

  it('🔴 [Boundary] a bar that EMPTIES while the child is on it: a step does nothing and throws nothing', () => {
    // Found by the probe of 2026-09-24: entering refuses a bar with no icon, but nothing held what happens when the icons
    // go AFTER entering (a remount, a game answering differently). Without the guard a step selects an icon that is not
    // there, and the exception lands in the frame that routes the direction.
    const { api, bar } = mount();
    api.enterBar(0);
    bar.querySelectorAll('.pi-btn').forEach((b) => b.remove());
    expect(() => api.navBar(0, { right: true })).not.toThrow();
    expect(() => api.navBar(0, { yes: true })).not.toThrow();
  });

  it('🔴 [Boundary] a bar that GOES while the child is on it: a step does nothing and throws nothing', () => {
    const { api, state } = mount();
    api.enterBar(0);
    state.bars = [];
    expect(() => api.navBar(0, { right: true })).not.toThrow();
  });

  it('[Right] confirmar ATIVA o ícone sob o cursor, e a legenda conta o estado NOVO', () => {
    const { api, bar, state } = mount();
    api.enterBar(0);
    // walk to blind mode to have a toggle with an observable state
    const icones = [...bar.querySelectorAll('.pi-btn')];
    const alvo = icones.findIndex((b) => b.dataset.pi === 'blind');
    for (let i = 0; i < alvo; i++) api.navBar(0, { right: true });
    api.navBar(0, { yes: true });
    expect(state.blindMode).toBe(true);
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('ligado');
  });

  it('[Zero] fora do modo, `navBar` não faz nada — nem cursor, nem clique', () => {
    // Routing asks every frame; a call acting without the mode on would be the d-pad moving the bar during normal play.
    const { api, bar } = mount();
    api.navBar(0, { right: true });
    expect(bar.querySelectorAll('.pi-sel')).toHaveLength(0);
  });

  it('[Interface] os ícones do HUD ficam FORA da ordem de tabulação', () => {
    // A stop per icon between the child and the game would be the price of leaving them there. Keyboard reach is not lost:
    // it is this mode, opened from the pause.
    const { bar } = mount();
    for (const b of bar.querySelectorAll('.pi-btn')) expect(b.tabIndex).toBe(-1);
  });
});

describe('a legenda da barra do HUD · aparece ao apontar e SOME ao sair', () => {
  // The Dev saw the bar on the game screen and said what was wrong: «é para aparecer somente os botões, nada de
  // explicação». A caption left hanging until someone pointed at something else is a band of text parked over the match.
  // On a bar that lives on the GAME SCREEN that is not help, it is obstruction.

  it('[Right] apontar mostra, tirar o mouse limpa', () => {
    const { bar } = mount();
    const b = bar.querySelector('.pi-btn[data-pi="contrast"]');
    const cap = bar.querySelector('.pause-icons-cap');
    b.dispatchEvent(new MouseEvent('mouseenter'));
    expect(cap.textContent).not.toBe('');
    b.dispatchEvent(new MouseEvent('mouseleave'));
    expect(cap.textContent, 'a explicação ficou parada em cima do jogo').toBe('');
  });

  it('[Boundary] com o cursor do modo pousado num ícone, a legenda NÃO some', () => {
    // The exception that keeps the fix from blinding the `accessibility` mode: there the caption is the ONLY thing saying
    // where the cursor is. Erasing it because the mouse passed nearby would take orientation from whoever does not use a
    // mouse.
    const { api, bar } = mount();
    api.enterBar(0);
    const cap = bar.querySelector('.pause-icons-cap');
    const antes = cap.textContent;
    expect(antes).not.toBe('');
    bar.querySelector('.pi-btn[data-pi="contrast"]').dispatchEvent(new MouseEvent('mouseleave'));
    expect(cap.textContent, 'o mouse apagou a orientação de quem navega sem ele').toBe(antes);
  });
});

describe('MUITAS TELAS · a barra e o modo são POR JOGADOR (ADR-0044, item 7)', () => {
  // The Dev's rule, older than this ADR: «Nunca unificar multi tela. Correções / melhorias são por tela. Modos multi são
  // por tela.» The only one that forces solo is blind mode, because of the audio channel limit — this is not it.
  //
  // The bar is the card's sibling, found by index (`getA11yBars()[i]`), with a mode indexed by the same number. An index
  // error at any of those points would only show with two players — and would show as "my sister's setting changed my
  // screen", the most confusing possible form of an accessibility defect.
  //
  // MEASURED in the built game (1600×900, two players): turning on the colour-blindness correction on screen 2 did not
  // touch screen 1, and entering the mode from screen 2's pause put the cursor only on its bar. These cases hold both.

  function duasTelas() {
    setPlayers([{ viz: 'normal' }, { viz: 'normal' }]);
    const { ctx, state, said } = makeCtx();
    const api = initPauseIcons(ctx);
    const bars = [api.buildQuickBar(0), api.buildQuickBar(1)];
    const sps = [api.buildScreenPause(0), api.buildScreenPause(1)];
    document.body.append(bars[0], sps[0], bars[1], sps[1]);
    state.screens = sps;
    state.bars = bars;
    return { api, bars, sps, state, said, ctx };
  }

  it('[Right] entrar no modo pela tela 1 NÃO põe cursor na tela 0', () => {
    const { api, bars } = duasTelas();
    api.enterBar(1);
    expect(api.onBar(1)).toBe(true);
    expect(api.onBar(0), 'o modo de uma tela não pode ligar o da outra').toBe(false);
    expect(bars[1].querySelectorAll('.pi-sel')).toHaveLength(1);
    expect(bars[0].querySelectorAll('.pi-sel'), 'a tela 0 ficou com cursor sem ninguém o ter pedido').toHaveLength(0);
  });

  it('[Right] com AS DUAS no modo, a direção de cada jogador anda só na barra dele', () => {
    // The case that stages the index defect, and it needs BOTH in the mode to bite. With only one inside, the
    // `naBarra.has(i)` guard would already block the other's call and the case would pass without ever looking at the bar
    // LOOKUP's index — green for the wrong reason.
    //
    // And the step must come from SCREEN 1, not 0: a step asked for screen 0 PASSED with the mutation applied — with
    // `getA11yBars()[0]` fixed in place of `[i]`, it lands on the right bar by accident. Recorded because a mutation that
    // does not fail is worse than none — it gives the feeling of rigour without the rigour.
    const { api, bars } = duasTelas();
    api.enterBar(0);
    api.enterBar(1);
    const inicio = bars.map((b) => b.querySelector('.pi-sel').dataset.pi);
    // Player 1 moves TWO places; player 0, none. If the bar lookup ignored the index, both steps would land on the same
    // bar and the two assertions below would swap sides at once.
    api.navBar(1, { right: true });
    api.navBar(1, { right: true });
    expect(bars[1].querySelector('.pi-sel').dataset.pi, 'a barra de quem andou ficou parada').not.toBe(inicio[1]);
    expect(bars[0].querySelector('.pi-sel').dataset.pi, 'a barra da OUTRA tela andou junto').toBe(inicio[0]);
  });

  it('[Zero] a direção de quem NÃO está no modo não mexe em barra nenhuma', () => {
    const { api, bars } = duasTelas();
    api.enterBar(1);
    const antes = bars[1].querySelector('.pi-sel').dataset.pi;
    api.navBar(0, { right: true }); // player 0 did not enter
    expect(bars[1].querySelector('.pi-sel').dataset.pi).toBe(antes);
    expect(bars[0].querySelectorAll('.pi-sel')).toHaveLength(0);
  });

  it('[Right] sair numa tela deixa a outra como estava', () => {
    const { api, bars } = duasTelas();
    api.enterBar(0);
    api.enterBar(1);
    api.navBar(1, { no: true });
    expect(api.onBar(1)).toBe(false);
    expect(api.onBar(0), 'sair de uma tela derrubou o modo da outra').toBe(true);
    expect(bars[0].querySelectorAll('.pi-sel'), 'a tela que continua no modo perdeu o cursor').toHaveLength(1);
  });

  it('[Interface] cada barra se declara da SUA tela, e reflete o estado do SEU jogador', () => {
    // `data-player` is not decoration: it is how an audit (and a human reading the DOM) knows which bar is whose. And
    // colour blindness is per player — the setting that exposes an index swap at once.
    const { api, bars } = duasTelas();
    expect(bars.map((b) => b.dataset.player)).toEqual(['0', '1']);
    bars[1].querySelector('.pi-btn[data-pi="cvd"]').click();
    expect(bars[1].querySelector('.pi-btn[data-pi="cvd"]').classList.contains('pi-cvd-protan')).toBe(true);
    expect(bars[0].querySelector('.pi-btn[data-pi="cvd"]').classList.contains('pi-cvd-protan')).toBe(false);
    expect(bars[0].querySelector('.pause-icons-cap').textContent, 'a legenda da outra tela falou sem ser chamada').toBe('');
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
    expect(ti.querySelector('.pi-btn[data-pi="camera"]').getAttribute('aria-pressed')).toBe('false');
  });
});

// ---------------------------------------------------------------------------------------------
// ⚠️ THE ASD LEVEL PERSISTS (issue #61) — and it is proven here, because it needs a real `localStorage`
// ---------------------------------------------------------------------------------------------
//
// ADR-0028 says every menu setting persists. The cost of not persisting falls on the child who needs it most: whoever
// uses the SILENT mode would set it again every session, and unexpected noise costs them most. A setting that forgets
// is not a setting, it is a daily chore.
describe('o nível TEA sobrevive ao fecho da aba (#61, ADR-0028)', () => {
  const CHAVE = 'incl_tea';

  it('⚠️ [Right] o ciclo do ícone GRAVA, e o arranque seguinte LÊ', () => {
    localStorage.removeItem(CHAVE);
    setPlayers([{ viz: '', toggleMove: false }]);

    // session 1: the child sets «calmo» and then «silencioso»
    const primeira = initPauseIcons(makeCtx().ctx);
    expect(primeira.getCalmMode(), 'não começou no padrão').toBe(0);
    primeira.iconAct('tea', 0);
    primeira.iconAct('tea', 0);
    expect(primeira.getCalmMode()).toBe(2);
    expect(localStorage.getItem(CHAVE), 'o nível não foi gravado').toBe('2');

    // session 2: another instance, like a page reload
    const segunda = initPauseIcons(makeCtx().ctx);
    expect(segunda.getCalmMode(), 'o nível não sobreviveu ao recarregamento').toBe(2);
  });

  it('[Interface] o `setCalmMode` também grava — é a outra porta para o mesmo valor', () => {
    // If only the icon's cycle stored it, a level set through here would live for the session and die when the tab closed
    // — the worse half of the defect: the setting seems to have taken and vanishes later.
    localStorage.removeItem(CHAVE);
    setPlayers([{ viz: '', toggleMove: false }]);
    const api = initPauseIcons(makeCtx().ctx);
    api.setCalmMode(1);
    expect(localStorage.getItem(CHAVE)).toBe('1');
    expect(initPauseIcons(makeCtx().ctx).getCalmMode()).toBe(1);
  });

  it('⚠️ [Error] um nível inválido guardado no navegador não chega ao anúncio', () => {
    // The screen-reader announcement is `t(CALM_NAMES[calmMode])`. A stored `3` — corrupted data, a future version, a
    // finger in devtools — would give `undefined`, and the blind child would press the button and hear nothing. It falls
    // back to the default, which is audible.
    localStorage.setItem(CHAVE, '3');
    setPlayers([{ viz: '', toggleMove: false }]);
    expect(initPauseIcons(makeCtx().ctx).getCalmMode()).toBe(0);
    localStorage.removeItem(CHAVE);
  });
});

describe('a barra montada obedece ao §5 do ADR-0106 — nenhum botão morto', () => {
  it('⚠️ [Interface] SEM escritor visual, o contraste e a cor não são MONTADOS', () => {
    // The pure half (`iconsThatAct`) lives in the node project; this case proves the rule reaches the real DOM — which is
    // where a child finds, or does not find, the button.
    const { bar } = mount(0, { setPlayerTheme: undefined, setPlayerCorrection: undefined });
    const chaves = [...bar.querySelectorAll('.pi-btn')].map((b) => b.dataset.pi);
    expect(chaves).not.toContain('contrast');
    expect(chaves).not.toContain('cvd');
    // ⚠️ And the rest of the bar stays WHOLE: losing the others because of two would be the wrong trade.
    expect(chaves).toContain('blind');
    expect(chaves).toContain('tts');
    expect(chaves).toContain('libras');
  });

  it('[Right] COM escritor visual, os dois estão lá — é o caso de hoje e continua a ser', () => {
    const { bar } = mount(0);
    const chaves = [...bar.querySelectorAll('.pi-btn')].map((b) => b.dataset.pi);
    expect(chaves).toContain('contrast');
    expect(chaves).toContain('cvd');
  });
});

// ========================= MUTATIONS CHECKED (ADR-0106 §5) =========================
//   · making `iconsThatAct` always return `PAUSE_ICONS` -> the NO-writer cases fail, in node and here. It is the mutation
//     that brings the defect back: the bar again offers a path that leads nowhere.
//   · filtering the two ALWAYS (ignoring the boolean) -> the WITH-visual-writer case fails, the half that keeps the fix
//     from costing the icons to whoever had them.
// ========================= MUTATIONS OF THE DEFAULT `.pm-btn` LIST (ADR-0106 §4/§5) =========================
//   · removing the ACTION filter (`itemsThatAct` returning everything) -> TWO fail. It is the defect that was
//     institutionalised: the menu showed `quit` with no table, and the fixture omitted it ON PURPOSE with a comment saying
//     that «prova que um data-act sem entrada nao quebra o clique». It did not break — it just did nothing, and a
//     screen-reader user heard an item that does not exist.
//   · ⚠️ removing the EMPTY-DOOR rule -> SURVIVED on the first round, and the survival was an empty case, not a logic hole:
//     the `[Zero]` used the FIXTURE's list, which has no `options`, so it asserted about an item the list did not
//     contain. Redone with the ENGINE's DEFAULT list (which has `options`), the same mutation fails.
//   · hiding `options` ALWAYS -> the single-panel case fails. The half that keeps the fix from costing the submenu to
//     whoever has it: ONE live panel is enough for the door to be worth it.
//   · replacing the default list with `[]` -> TWO fail. The proof that the engine's default exists: before this change
//     `pmButtons` was MANDATORY, and games without a pause menu are the result of nobody passing it.
//
//   · ⚠️ replacing `&&` with `||` in the detection -> SURVIVED, and the survival pointed at a DESIGN defect instead of a
//     coverage hole: with ONE flag for the two icons, both operators give the same result whenever both writers are
//     missing — and err in opposite directions when only one is (`&&` hides an icon that works; `||` shows one that does
//     not). The question became per ICON (`VisualWriters`), and the `[Boundary]` one-writer case lives in the node project.

describe('o ctx MÍNIMO — o que o `createGame` conseguiria responder sozinho (ADR-0106 etapa 2)', () => {
  /** Only fields the ENGINE can answer. No `rm`, `dynLabel`, `getPauseActs` or `setPauseActor`. */
  function ctxMinimo(over = {}) {
    const bars = [];
    return {
      getPlayers: () => [{ visual: DEFAULT_VISUAL, toggleMove: false, walkDir: 0 }],
      getNumPlayers: () => 1,
      srSay: () => {}, srAlert: () => {},
      getA11yBars: () => bars,
      getBlindMode: () => false,
      // ⚠️ THIS FIELD BELONGS TO THE MINIMUM. The engine CAN answer it — it reads it from the declaration — so omitting it
      // would not be «mínimo», it would be forgetting. And forgetting would prop up a case: with `undefined`, which is
      // falsy, the `altmove` vanishes and the §5 test passes BY ACCIDENT. The answer is declared — a minimal game holds no
      // keys — and the case passes for the reason it claims.
      holdsKeys: () => false,
      getAudioCat: () => ({ tts: { on: false, vol: 1 } }),
      setCatGain: () => {},
      reflectTtsPanel: () => {}, reflectTtsPanelEnabled: false,
      isLibrasOn: () => false, toggleLibras: () => {},
      // Mandatory (ADR-0232): without `rm`, the reduced-motion default is asked through it.
      matchMedia: () => ({ matches: false }),
      ...over,
    };
  }

  it('⚠️ [Zero] com o ctx MÍNIMO a pausa monta — é a pré-condição da etapa 2', () => {
    // ⚠️ THIS CASE IS STEP 2 AS AN ASSERTION. With `rm`, `dynLabel`, `getPauseActs` and `setPauseActor` MANDATORY,
    // `createGame` could not mount the pause without inventing answers for a game it does not know. It can.
    const api = initPauseIcons(ctxMinimo());
    const sp = api.buildScreenPause(0);
    const bar = api.buildQuickBar(0);
    expect(sp.querySelector('.pause-card'), 'o cartão não montou').toBeTruthy();
    expect(bar.querySelectorAll('.pi-btn').length, 'a barra montou vazia').toBeGreaterThan(0);

    // ⚠️ AND THE ASD MODE MUST RUN, which is where `rm` is really read. Without this line the case built the tree and never
    // touched the four reduced-motion fields — a mutation demanding them from the game again would survive it. (That is
    // what happened on the first round.)
    expect(() => api.applyCalm(), 'o modo TEA rebentou sem `rm` injetado').not.toThrow();
    expect(typeof api.getCalmMode()).toBe('number');
  });

  it('⚠️ [Zero] e o cartão mínimo NÃO oferece item que não acciona (§5)', () => {
    // With no action table, what is left is what the engine actions by itself — and nothing more. A card with a `quit`
    // that does not quit, or an `ajuda` that does not open, would be worse than a short card.
    const api = initPauseIcons(ctxMinimo());
    const sp = api.buildScreenPause(0);
    const acts = actsVisiveis(sp);
    expect(acts).not.toContain('quit');
    expect(acts).not.toContain('options'); // the door falls because the room is empty
    expect(acts.every((a) => a === 'acessibilidade' || a === 'pmback'), 'sobrou item sem acção: ' + acts.join(',')).toBe(true);
  });

  it('⚠️ [Interface] trocar `getPauseActs` DEPOIS do init continua a valer — a ligação é tardia', () => {
    // ⚠️ Resolving `ctx.getPauseActs` ONCE at start-up (while giving the fields defaults) freezes the reference and breaks
    // whoever swaps the table later — a test caught exactly that. Swapping later is legitimate: this field's laziness
    // exists because the table arrives late (in a cartridge, a `const` far below the `init`). A default cannot cost the late
    // binding.
    const ctx = ctxMinimo();
    const api = initPauseIcons(ctx);
    let saiu = 0;
    ctx.getPauseActs = () => ({ quit: () => { saiu++; } });
    const sp = api.buildScreenPause(0);
    const botao = sp.querySelector('.pm-btn[data-act="quit"]');
    expect(botao, 'a tabela trocada depois do init não foi lida').toBeTruthy();
    botao.click();
    expect(saiu).toBe(1);
  });
});
