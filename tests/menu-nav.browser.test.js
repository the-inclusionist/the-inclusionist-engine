// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/menu-nav — o que SÓ o navegador prova (project BROWSER): foco de verdade
// (document.activeElement), visibilidade de verdade (`offsetParent`), a pilha de z-index EFETIVA
// (getComputedStyle) e o que cada tecla faz de ponta a ponta. A decisão pura está em menu-nav.node.test.js e
// NÃO é repetida aqui.
//
// A casca é exercitada COMPOSTA com o ui/settings-panel REAL, porque é assim que o game.js a usa: é ele que
// mantém a pilha de overlays e o registro de fechamento, e `sharedDialogOpen` é hoje um ALIAS do
// `topVisibleOverlay` dele. Testar as duas juntas é o que prova que a unificação não mudou nada.
//
// DOIS DEFEITOS CONHECIDOS SÃO PINADOS AQUI, DE PROPÓSITO, COMO ESTÃO HOJE — não como deveriam ser:
//   · o escopo `#game-region .overlay` NÃO alcança `.screen-pause`, então fechar #typo/#help larga o foco;
//   · Escape é "voltar", resolvido pelo TOPO DA PILHA (z-index) e não pela cadeia de registro.
// Os dois têm conserto pendente. Estes casos existem para que o conserto tenha rede: quando alguém arrumar,
// eles falham, e a falha É o aviso de que o comportamento mudou onde tinha de mudar.
import { describe, it, expect, beforeEach } from 'vitest';
import { initMenuNav } from '../app/js/ui/menu-nav.js';
import { initSettingsPanel } from '../app/js/ui/settings-panel.js';
import { setPhaseValue } from '../app/js/core/state.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// Marcação enxuta mas FIEL ao index.html no que importa: os diálogos vivem dentro do #game-region (o
// inCanvasMenus() os reparenta pra lá) e são `.overlay` com `.overlay__card`; os menus de pausa vivem no MESMO
// #game-region mas são `.screen-pause`/`.pause-card` — classe diferente. É essa diferença que produz o defeito 1.
const MARKUP = `
  <div id="game-region" tabindex="-1">
    <div id="padwiz" class="overlay" hidden><div class="overlay__card"><button id="padwiz-cancel">Cancelar</button></div></div>

    <div id="typo" class="overlay" hidden><div class="overlay__card">
      <button id="font-a" type="button">Fonte A</button>
      <button id="typo-close" type="button">Fechar</button>
    </div></div>

    <div id="help" class="overlay" hidden><div class="overlay__card">
      <div id="help-content"><div class="ctrl-row"><span>sem controle nenhum</span></div></div>
      <button id="help-close" type="button">Fechar</button>
    </div></div>

    <div id="audio" class="overlay" hidden><div class="overlay__card">
      <button id="a-first" type="button">Primeiro</button>
      <select id="a-voz"><option value="0">um</option><option value="1">dois</option><option value="2">três</option></select>
      <input id="a-vol" type="range" min="0" max="10" step="2" value="4">
      <button id="a-off" type="button" disabled>Desabilitado</button>
      <button id="a-invis" type="button" style="display:none">Invisível</button>
      <button id="a-close" type="button">Fechar</button>
    </div></div>

    <div class="player-screen">
      <div class="screen-pause" id="sp0"><div class="pause-card">
        <div class="pause-icons">
          <button class="pi-btn" data-pi="cego" type="button" aria-label="Modo cego">A</button>
          <button class="pi-btn" data-pi="tts" type="button" aria-label="Narração">B</button>
          <button class="pi-btn" data-pi="libras" type="button" aria-label="Libras">C</button>
        </div>
        <p class="pause-icons-cap" aria-live="polite"></p>
        <button class="pm-btn" data-act="resume" type="button">Continuar</button>
        <button class="pm-btn" data-act="letra" type="button">ABC</button>
        <button class="pm-btn" data-act="audio" type="button">Som</button>
        <button class="pm-btn" data-act="ajuda" type="button">Ajuda</button>
        <button class="pm-btn" data-act="quit" type="button">Sair</button>
      </div></div>
      <div class="screen-pause" id="sp1"><div class="pause-card">
        <div class="pause-icons"><button class="pi-btn" data-pi="cego" type="button" aria-label="Modo cego">A</button></div>
        <p class="pause-icons-cap" aria-live="polite"></p>
        <button class="pm-btn" data-act="resume" type="button">Continuar</button>
        <button class="pm-btn" data-act="quit" type="button">Sair</button>
      </div></div>
    </div>
  </div>
  <button id="opt-touchcfg" type="button">fora do #game-region (o botão que abriria um painel)</button>
`;

/** Monta a casca de overlays + o menu-nav, ligados como no game.js. */
function boot(over = {}) {
  document.body.innerHTML = MARKUP;
  setPhaseValue('paused');
  const log = { phase: [], actor: [], padWiz: [] };
  const panel = initSettingsPanel({ $, $$, doc: document, computedZ: (el) => Number(getComputedStyle(el).zIndex) || 0 });

  // MESMA ordem de registro do game.js para os diálogos que importam aqui. #typo entra na cadeia de Escape;
  // #help NAO entra — verbatim, e é justamente o que o defeito 2 (b) explora.
  panel.register('audio', { close: () => closeAudio(), inEscapeChain: true });
  panel.register('typo', { close: () => closeTypo(), inEscapeChain: true });
  panel.register('help', { close: () => closeHelp(), inEscapeChain: false });

  function openOv(id) { const ov = $('#' + id); ov.hidden = false; panel.frontOverlay(ov); }
  function openTypo() { openOv('typo'); $('#font-a').focus(); }
  function closeTypo() { $('#typo').hidden = true; nav.menuFocus(nav.sharedDialogOpen()); }
  function openAudio() { openOv('audio'); $('#a-first').focus(); }
  function closeAudio() { $('#audio').hidden = true; }
  function openHelp() { openOv('help'); $('#help-close').focus(); }
  function closeHelp() { $('#help').hidden = true; nav.menuFocus(nav.sharedDialogOpen()); }

  const ctx = {
    $,
    getActiveElement: () => document.activeElement,
    topVisibleOverlay: panel.topVisibleOverlay,
    closeById: panel.closeById,
    getPauseMenu: (i) => $('#sp' + i),
    setPhase: (p) => { log.phase.push(p); setPhaseValue(p); },
    setPauseActor: (i) => log.actor.push(i),
    isCapturing: () => false,
    closePadWiz: (save) => log.padWiz.push(save),
    whichPlayer: () => -1,        // só teclas genéricas nestes casos (o roteamento por jogador é de outro módulo)
    actionOf: () => null,
    win: { addEventListener: () => {} },
    ...over,
  };
  const nav = initMenuNav(ctx);
  return { nav, panel, log, open, openTypo, openAudio, openHelp };
}

/** Um KeyboardEvent falso — `menuNavKey` é exportado à parte justamente para poder ser chamado direto. */
function key(code) {
  const e = { code, defaults: 0, stops: 0, preventDefault() { this.defaults++; }, stopPropagation() { this.stops++; } };
  return e;
}

/** Mostra as pausas (o setPhase de ui/shell faria isso; aqui interessa só a navegação). */
function showPauses() { $$('.screen-pause').forEach((sp) => { sp.hidden = false; }); }

beforeEach(() => { document.body.innerHTML = ''; setPhaseValue('title'); });

describe('sharedDialogOpen — quem está por cima', () => {
  it('sem diálogo aberto, ninguém está por cima', () => {
    const { nav } = boot();
    expect(nav.sharedDialogOpen()).toBe(null);
  });

  it('o ÚLTIMO aberto vence, porque frontOverlay o põe no topo da pilha de z-index', () => {
    const { nav, openTypo, openAudio } = boot();
    openTypo(); openAudio();
    expect(nav.sharedDialogOpen().id).toBe('audio');
    $('#audio').hidden = true;                 // fecha o de cima: sobra o de baixo
    expect(nav.sharedDialogOpen().id).toBe('typo');
  });

  // ⚠️ DEFEITO 1, PINADO. Não conserte: o escopo é `#game-region .overlay` e os menus de pausa são
  // `.screen-pause`. O dia em que o escopo for corrigido, este caso falha — e é isso que ele existe para dizer.
  it('DEFEITO 1 (pinado): o escopo NÃO enxerga os menus de pausa (.screen-pause não é .overlay)', () => {
    const { nav } = boot();
    showPauses();
    expect($$('.screen-pause').length).toBe(2);
    expect($$('#game-region .overlay').length).toBe(4); // padwiz, typo, help, audio — e NENHUMA pausa
    expect(nav.sharedDialogOpen()).toBe(null);          // com dois menus de pausa VISÍVEIS na tela
  });

  // ⚠️ DEFEITO 1, PINADO — a consequência de acessibilidade (WCAG 2.4.3: o foco se perde ao fechar).
  it('DEFEITO 1 (pinado): fechar #typo com a pausa aberta larga o foco no <body>', () => {
    const { nav, openTypo } = boot();
    showPauses();
    openTypo();
    expect(document.activeElement.id).toBe('font-a');
    nav.dialogBack($('#typo'));                          // = o que Escape faz
    expect($('#typo').hidden).toBe(true);
    // menuFocus(sharedDialogOpen()) recebeu null → saiu pelo guarda → ninguém devolveu o foco.
    // O requisito de a11y é "o foco volta para quem abriu": aqui ele NÃO volta para o menu de pausa.
    const ae = document.activeElement;
    expect(ae && ae.closest ? ae.closest('.screen-pause') : null).toBe(null);
    expect($$('.pm-sel, .pi-sel').length).toBe(0); // nem por foco, nem pela seleção própria do menu de pausa
  });

  it('fechar o de cima com OUTRO diálogo aberto devolve o foco — o caminho que funciona hoje', () => {
    const { nav, openTypo, openAudio } = boot();
    openTypo(); openAudio();
    nav.dialogBack($('#audio'));
    expect(document.activeElement.id).toBe('font-a'); // voltou para o #typo, que ficou por baixo
  });
});

describe('menuItems — quem conta como item navegável', () => {
  it('desabilitado e invisível ficam DE FORA; o resto entra na ordem do DOM', () => {
    const { nav, openAudio } = boot();
    openAudio();
    const ids = nav.menuItems($('#audio')).map((el) => el.id);
    expect(ids).toEqual(['a-first', 'a-voz', 'a-vol', 'a-close']);
    expect(ids).not.toContain('a-off');   // [disabled]
    expect(ids).not.toContain('a-invis'); // offsetParent === null
  });

  it('diálogo inteiro escondido: nenhum item é navegável (offsetParent nulo em cascata)', () => {
    const { nav } = boot();
    expect(nav.menuItems($('#audio'))).toEqual([]); // #audio ainda hidden
  });
});

describe('navDialog — andar dentro de um diálogo', () => {
  const K = (o) => ({ yes: false, no: false, up: false, down: false, left: false, right: false, ...o });

  it('baixo/cima andam entre os itens e prendem nas pontas', () => {
    const { nav, openAudio } = boot();
    openAudio();
    const dlg = $('#audio');
    expect(document.activeElement.id).toBe('a-first');
    nav.navDialog(dlg, K({ down: true }));
    expect(document.activeElement.id).toBe('a-voz');
    nav.navDialog(dlg, K({ up: true }));
    expect(document.activeElement.id).toBe('a-first');
    nav.navDialog(dlg, K({ up: true }));
    expect(document.activeElement.id).toBe('a-first'); // preso no primeiro
  });

  it('num select, esquerda/direita AJUSTAM o valor (e não andam de item) e disparam change', () => {
    const { nav, openAudio } = boot();
    openAudio();
    const dlg = $('#audio'), sel = $('#a-voz');
    let changes = 0; sel.addEventListener('change', () => { changes++; });
    sel.focus();
    nav.navDialog(dlg, K({ right: true }));
    expect(sel.selectedIndex).toBe(1);
    expect(document.activeElement.id).toBe('a-voz'); // continua no mesmo controle
    expect(changes).toBe(1);
  });

  it('num select, "sim" dá a volta na lista (é como se confirma sem enxergar as opções)', () => {
    const { nav, openAudio } = boot();
    openAudio();
    const sel = $('#a-voz'); sel.selectedIndex = 2; sel.focus();
    nav.navDialog($('#audio'), K({ yes: true }));
    expect(sel.selectedIndex).toBe(0);
  });

  it('num slider, esquerda/direita andam um step e disparam input; "sim" não faz nada', () => {
    const { nav, openAudio } = boot();
    openAudio();
    const dlg = $('#audio'), vol = $('#a-vol');
    let inputs = 0; vol.addEventListener('input', () => { inputs++; });
    vol.focus();
    nav.navDialog(dlg, K({ right: true }));
    expect(vol.value).toBe('6');
    nav.navDialog(dlg, K({ left: true }));
    expect(vol.value).toBe('4');
    expect(inputs).toBe(2);
    nav.navDialog(dlg, K({ yes: true }));
    expect(vol.value).toBe('4');
  });

  it('"sim" num botão clica o botão', () => {
    const { nav, openAudio } = boot();
    openAudio();
    let clicks = 0; $('#a-close').addEventListener('click', () => { clicks++; });
    $('#a-close').focus();
    nav.navDialog($('#audio'), K({ yes: true }));
    expect(clicks).toBe(1);
  });

  it('com o foco FORA do diálogo, o primeiro item recebe o foco antes de qualquer coisa', () => {
    const { nav, openAudio } = boot();
    openAudio();
    document.body.focus();
    nav.navDialog($('#audio'), K({ down: true }));
    expect(document.activeElement.id).toBe('a-voz'); // entrou no primeiro e desceu um
  });
});

describe('navPause — andar no menu de pausa (seleção por classe, não por foco)', () => {
  const K = (o) => ({ yes: false, no: false, up: false, down: false, left: false, right: false, ...o });

  it('a seleção é EXCLUSIVA e a legenda narra o ícone sob o cursor', () => {
    const { nav } = boot();
    showPauses();
    const menu = $('#sp0');
    nav.pauseSetSel(menu, menu.querySelectorAll('.pm-btn')[0]);
    expect(menu.querySelectorAll('.pm-sel, .pi-sel').length).toBe(1);
    expect(menu.querySelector('.pause-icons-cap').textContent).toBe(''); // item comum limpa a legenda
    nav.pauseSetSel(menu, menu.querySelectorAll('.pi-btn')[1]);
    expect(menu.querySelectorAll('.pm-sel, .pi-sel').length).toBe(1);
    expect(menu.querySelector('.pi-btn:nth-of-type(2)').classList.contains('pi-sel')).toBe(true);
    expect(menu.querySelector('.pause-icons-cap').textContent).toBe('Narração'); // aria-label do ícone
  });

  it('a FRONTEIRA é atravessável nos dois sentidos e volta para onde saiu', () => {
    const { nav } = boot();
    showPauses();
    const menu = $('#sp0');
    const items = [...menu.querySelectorAll('.pm-btn')], icons = [...menu.querySelectorAll('.pi-btn')];
    nav.pauseSetSel(menu, items[1]);                     // 1ª linha, 2ª coluna
    nav.navPause(menu, 0, K({ up: true }));
    expect(icons[1].classList.contains('pi-sel')).toBe(true); // subiu para o ícone de MESMO índice
    nav.navPause(menu, 0, K({ down: true }));
    expect(items[0].classList.contains('pm-sel')).toBe(true); // desceu para o PRIMEIRO item (Continuar)
  });

  it('"sim" marca quem agiu como pauseActor e clica o item selecionado', () => {
    const { nav, log } = boot();
    showPauses();
    const menu = $('#sp1');
    let clicks = 0;
    menu.querySelectorAll('.pm-btn')[1].addEventListener('click', () => { clicks++; });
    nav.pauseSetSel(menu, menu.querySelectorAll('.pm-btn')[1]);
    nav.navPause(menu, 1, K({ yes: true }));
    expect(log.actor).toEqual([1]);
    expect(clicks).toBe(1);
  });

  it('sem nada selecionado, o cursor começa no primeiro item (Continuar)', () => {
    const { nav } = boot();
    showPauses();
    const menu = $('#sp0');
    nav.navPause(menu, 0, K({ right: true }));
    expect(menu.querySelectorAll('.pm-btn')[1].classList.contains('pm-sel')).toBe(true);
  });

  it('"não" na raiz do menu de pausa volta ao jogo (= Continuar)', () => {
    const { nav, log } = boot();
    showPauses();
    nav.navPause($('#sp0'), 0, K({ no: true }));
    expect(log.phase).toEqual(['playing']);
  });
});

describe('menuNavKey — o tradutor de teclado', () => {
  it('fora da pausa, não faz nada (nem consome a tecla)', () => {
    const { nav } = boot();
    setPhaseValue('playing');
    const e = key('Escape');
    nav.menuNavKey(e);
    expect(e.stops).toBe(0);
  });

  it('com um remap em andamento, a tecla é do remap — o menu não a rouba', () => {
    const { nav } = boot({ isCapturing: () => true });
    showPauses();
    const e = key('ArrowDown');
    nav.menuNavKey(e);
    expect(e.stops).toBe(0);
  });

  it('tecla sem função nenhuma NÃO é consumida (não vira preventDefault gratuito)', () => {
    const { nav } = boot();
    showPauses();
    const e = key('KeyQ');
    nav.menuNavKey(e);
    expect([e.defaults, e.stops]).toEqual([0, 0]);
  });

  it('com o assistente de gamepad aberto, só Escape passa — e cancela', () => {
    const { nav, log } = boot();
    showPauses();
    $('#padwiz').hidden = false;
    const down = key('ArrowDown'); nav.menuNavKey(down);
    expect([down.defaults, log.padWiz]).toEqual([0, []]); // consumido pelo wizard, sem efeito
    const esc = key('Escape'); nav.menuNavKey(esc);
    expect(log.padWiz).toEqual([false]);
    expect(esc.stops).toBe(1);
  });

  it('sem diálogo aberto, as setas navegam o menu de pausa DO PRÓPRIO jogador', () => {
    const { nav } = boot({ whichPlayer: () => 1 });
    showPauses();
    const e = key('ArrowRight');
    nav.menuNavKey(e);
    expect($('#sp1').querySelectorAll('.pm-btn')[1].classList.contains('pm-sel')).toBe(true);
    expect($('#sp0').querySelector('.pm-sel')).toBe(null); // a tela do outro jogador não se mexeu
  });

  // ⚠️ DEFEITO 2, PINADO. Hoje quem decide é o TOPO DA PILHA (z-index), e não a cadeia de registro do
  // ui/settings-panel (ordem: audio → typo → help, neste teste). Com #typo por cima, é #typo que fecha —
  // mesmo com #audio antes dele na cadeia. Se alguém trocar a resolução para a cadeia registrada, este
  // caso falha, e é esse o aviso.
  it('DEFEITO 2 (pinado): Escape fecha o de cima por z-index, NÃO o primeiro da cadeia registrada', () => {
    const { nav, panel, openTypo, openAudio } = boot();
    showPauses();
    openAudio(); openTypo();                    // #typo por cima; na CADEIA, #audio vem antes
    expect(panel.escapeTarget()).toBe('audio'); // é isto que o ouvinte de BOLHA do game.js faria…
    nav.menuNavKey(key('Escape'));
    expect($('#typo').hidden).toBe(true);       // …e é isto que de fato acontece: fecha o de cima
    expect($('#audio').hidden).toBe(false);
  });

  // ⚠️ DEFEITO 2, PINADO — a parte que é rede de segurança acidental. #help está registrado SEM flag
  // `inEscapeChain:false`, logo está FORA da cadeia de Escape; só não despausa o jogo porque menuNavKey o cobre por
  // z-index e dá stopPropagation. Este caso pina as DUAS metades ao mesmo tempo.
  it('DEFEITO 2 (pinado): #help está fora da cadeia de Escape, e só a captura o salva de despausar', () => {
    const { nav, panel, log, openHelp } = boot();
    showPauses();
    openHelp();
    expect(panel.escapeTarget()).toBe(null);    // fora da cadeia: o ouvinte de bolha cairia no togglePause()
    const e = key('Escape');
    nav.menuNavKey(e);
    expect($('#help').hidden).toBe(true);       // a captura fechou o diálogo…
    expect(e.stops).toBe(1);                    // …e impediu a tecla de chegar ao ouvinte de bolha
    expect(log.phase).toEqual([]);              // por isso o jogo NÃO despausou
  });

  it('Escape com o menu de pausa na raiz (nenhum diálogo) volta ao jogo', () => {
    const { nav, log } = boot();
    showPauses();
    nav.menuNavKey(key('Escape'));
    expect(log.phase).toEqual(['playing']);
  });
});
