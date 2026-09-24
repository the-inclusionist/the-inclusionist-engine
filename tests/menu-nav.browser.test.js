// SPDX-License-Identifier: AGPL-3.0-or-later
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
// A CENA é DO TESTE desde 2026-08-26. `phase` saiu de `core/state` — virou a pilha de `core/scenes`, e os
// três nomes moram na raiz de composição (ADR-0030 C3). Quem é engine recebe BOOLEANOS. Este `let` faz o
// papel que o binding vivo fazia, e os casos seguem escritos como estavam.
let faseFalsa = 'playing';
const setPhaseValue = (p) => { faseFalsa = p; };

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
      <!-- A BARRA RÁPIDA é IRMÃ do cartão desde o item 7 do ADR-0044, não filha: ela vive no HUD. A fixture
           a põe aqui do lado para que pauseSetSel continue achando a legenda pelo escopo da tela. -->
      <div class="pause-icons">
        <button class="pi-btn" data-pi="cego" type="button" aria-label="Modo cego">A</button>
        <button class="pi-btn" data-pi="tts" type="button" aria-label="Narração">B</button>
        <button class="pi-btn" data-pi="libras" type="button" aria-label="Libras">C</button>
      </div>
      <p class="pause-icons-cap" aria-live="polite"></p>
      <div class="screen-pause" id="sp0"><div class="pause-card">
        <div class="pause-menu" role="menu" data-sub="raiz">
          <button class="pm-btn" data-act="resume" type="button">Continuar</button>
          <button class="pm-btn" data-act="letra" type="button">ABC</button>
          <button class="pm-btn" data-act="audio" type="button">Som</button>
          <button class="pm-btn" data-act="ajuda" type="button">Ajuda</button>
          <button class="pm-btn" data-act="quit" type="button">Sair</button>
        </div>
        <div class="pause-menu" role="menu" data-sub="opcoes" hidden>
          <button class="pm-btn" data-act="pmback" type="button">Voltar</button>
          <button class="pm-btn" data-act="caa" type="button">Comunicação</button>
        </div>
      </div></div>
      <div class="screen-pause" id="sp1"><div class="pause-card">
        <div class="pause-icons"><button class="pi-btn" data-pi="cego" type="button" aria-label="Modo cego">A</button></div>
        <p class="pause-icons-cap" aria-live="polite"></p>
        <div class="pause-menu" role="menu" data-sub="raiz">
          <button class="pm-btn" data-act="resume" type="button">Continuar</button>
          <button class="pm-btn" data-act="quit" type="button">Sair</button>
        </div>
      </div></div>
    </div>
  </div>
  <button id="opt-touchcfg" type="button">fora do #game-region (o botão que abriria um painel)</button>
`;

/** Monta a casca de overlays + o menu-nav, ligados como no game.js. */
function boot(over = {}) {
  document.body.innerHTML = MARKUP;
  setPhaseValue('paused');
  const log = { phase: [], actor: [], padWiz: [], bar: [], said: [] };
  const naBarra = over.naBarra || new Set();
  const panel = initSettingsPanel({ $, $$, doc: document, computedZ: (el) => Number(getComputedStyle(el).zIndex) || 0 });

  // MESMA ordem de registro do game.js para os diálogos que importam aqui. #typo entra na cadeia de Escape;
  // #help NAO entra — verbatim, e é justamente o que o defeito 2 (b) explora.
  panel.register('audio', { close: () => closeAudio(), inEscapeChain: true });
  panel.register('typo', { close: () => closeTypo(), inEscapeChain: true });
  panel.register('help', { close: () => closeHelp(), inEscapeChain: true }); // como o main.js registra

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
    // A PLATAFORMA responde na língua dela: menu é coisa de pausa. Era `if (phase !== 'paused')` DENTRO do
    // módulo; virou pergunta injetada, e por isso os casos abaixo — que já mexiam na fase —
    // continuam medindo exatamente o mesmo comportamento. Um quiz responderia `true` e não mentiria (achado 10).
    isNavigable: () => faseFalsa === 'paused',
    // O MODO `accessibility` (ADR-0044, item 7) é perguntado ANTES do guarda de "navegável", porque ele roda
    // com o jogo andando. Por padrão ninguém está nele; os casos que o exercitam mexem em `naBarra`.
    srSay: (texto) => log.said.push(texto),
    withIndex: () => true, // o índice do item 3 nasce ligado; ver `withIndex` no ctx de ui/menu-nav
    onBar: (i) => naBarra.has(i),
    navBar: (i, k) => log.bar.push([i, k]),
    isCapturing: () => false,
    closePadWiz: (save) => log.padWiz.push(save),
    whichPlayer: () => -1,        // só teclas genéricas nestes casos (o roteamento por jogador é de outro módulo)
    actionOf: () => null,
    win: { addEventListener: () => {} },
    ...over,
  };
  const nav = initMenuNav(ctx);
  return { nav, panel, log, naBarra, open, openTypo, openAudio, openHelp };
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

  // O ANEL, e este caso mudou de assunto com o ADR-0044. Ele afirmava "prendem nas pontas"; a regra virou a
  // oposta, e o motivo é de uso: quem não enxerga não varre a lista à procura do fim — ela pergunta "e antes
  // do primeiro?" e tem de receber uma resposta. É o que põe o item mais indesejado a UMA tecla do mais
  // urgente sem os dois estarem perto um do outro.
  //
  // MUTAÇÃO CONFERIDA: com `stepInRing` de volta ao limite antigo, a última asserção falha em
  // "expected 'a-first' to be 'a-close'".
  it('baixo/cima andam entre os itens, e as pontas DÃO A VOLTA', () => {
    const { nav, openAudio } = boot();
    openAudio();
    const dlg = $('#audio');
    expect(document.activeElement.id).toBe('a-first');
    nav.navDialog(dlg, K({ down: true }));
    expect(document.activeElement.id).toBe('a-voz');
    nav.navDialog(dlg, K({ up: true }));
    expect(document.activeElement.id).toBe('a-first');
    // A ponta de cima: antes do primeiro está o ÚLTIMO item navegável. O `a-off` (desabilitado) e o
    // `a-invis` (escondido) não contam — `menuItems` já os filtra, e o anel anda sobre o que sobrou.
    nav.navDialog(dlg, K({ up: true }));
    expect(document.activeElement.id, 'antes do primeiro vem o último').toBe('a-close');
    // E a ponta de baixo fecha o anel de volta ao começo.
    nav.navDialog(dlg, K({ down: true }));
    expect(document.activeElement.id, 'depois do último vem o primeiro').toBe('a-first');
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

  it('🔴 nos PASSOS ⯇ ⯈, esquerda/direita emitem `passo` e NÃO andam de item; e o controle é UM item só (ADR-0151)', async () => {
    const { mountSteps } = await import('../app/js/ui/panel-widgets.js');
    const { nav, openAudio } = boot();
    openAudio();
    const dlg = $('#audio');
    const passos = mountSteps({ find: (s) => $(s), create: (t) => document.createElement(t) },
      { label: 'Cantos', values: ['off', 'small', 'large'], current: 1 });
    $('#a-voz').after(passos);
    const vistos = []; passos.addEventListener('passo', (e) => vistos.push(e.detail));
    passos.focus();
    nav.navDialog(dlg, K({ right: true }));
    nav.navDialog(dlg, K({ left: true }));
    expect(vistos).toEqual([1, -1]);
    expect(document.activeElement, 'esquerda/direita tiraram o foco do controle').toBe(passos);
    // e as setas lá dentro não são paragens do cursor: descer a partir do controle sai dele de uma vez
    nav.navDialog(dlg, K({ down: true }));
    expect(passos.contains(document.activeElement), 'o cursor parou numa seta').toBe(false);
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
    // 🔴 era `document.body.focus()`, que não move nada (o <body> não é focável): o caso nunca pôs o foco FORA, e passava
    // com o foco já no primeiro item. Medido em 2026-09-23, ao escrever o caso de baixo.
    document.activeElement.blur();
    expect(document.activeElement).toBe(document.body);
    nav.navDialog($('#audio'), K({ down: true }));
    expect(document.activeElement.id).toBe('a-voz'); // entrou no primeiro e desceu um
  });

  /*
   * 🔴 Probed 2026-09-23: six of twenty decisions of `navDialog` could be undone with this file green. Four are cases below. The
   * other two are EQUIVALENT with today's kit, measured, and have no case: «yes» on a slider and on a steps control does nothing,
   * and without the guards it would CLICK them — a native range ignores a click, and the steps control's clicks live on its two
   * arrows (`ui/panel-widgets`), not on the element itself.
   */
  it('🔴 com o foco FORA, o primeiro item é focado E DITO — mesmo sem tecla de direcção', () => {
    const { nav, log, openAudio } = boot();
    openAudio();
    // ⚠️ `document.body.focus()` moves nothing — the body is not focusable — so the focus has to be LET GO to be outside
    document.activeElement.blur();
    expect(document.activeElement, 'the case never put the focus outside').toBe(document.body);
    nav.navDialog($('#audio'), K({}));
    expect(document.activeElement.id).toBe('a-first');
    expect(log.said.at(-1), 'the child was put on an item nobody named').toMatch(/^Primeiro/);
  });

  it('🔴 um quadro SEM intenção nenhuma não clica o item — só o «sim» confirma', () => {
    // found by re-probing the cut: with the `yes` guard gone, every frame with no key would press the button under the cursor
    const { nav, openAudio } = boot();
    openAudio();
    let clicks = 0; $('#a-close').addEventListener('click', () => { clicks++; });
    $('#a-close').focus();
    nav.navDialog($('#audio'), K({}));
    expect(clicks).toBe(0);
  });

  it('🔴 um diálogo SEM itens não rebenta com uma seta — não há onde pôr o cursor, e é tudo', () => {
    const { nav } = boot();
    document.body.insertAdjacentHTML('beforeend', '<div id="vazio" class="overlay"><div class="overlay__card"><p>só texto</p></div></div>');
    expect(() => nav.navDialog($('#vazio'), K({ right: true }))).not.toThrow();
  });

  it('🔴 esquerda/direita num BOTÃO andam no anel, como cima/baixo', () => {
    const { nav, openAudio } = boot();
    openAudio();
    $('#a-first').focus();
    nav.navDialog($('#audio'), K({ right: true }));
    expect(document.activeElement.id).toBe('a-voz');
  });

  it('🔴 «sim» numa lista dá a volta E diz a opção nova — quem confirma de ouvido não tem outra forma de saber onde parou', () => {
    const { nav, log, openAudio } = boot();
    openAudio();
    const sel = $('#a-voz'); sel.selectedIndex = 2; sel.focus();
    nav.navDialog($('#audio'), K({ yes: true }));
    expect(log.said.at(-1)).toMatch(/\bum\b/);
  });
});

describe('navPause — andar no menu de pausa (seleção por classe, não por foco)', () => {
  const K = (o) => ({ yes: false, no: false, up: false, down: false, left: false, right: false, ...o });

  it('a seleção é EXCLUSIVA — e o cursor da pausa não alcança mais os ícones', () => {
    // ESTE CASO MUDOU DE FORMA no item 7 do ADR-0044. Ele afirmava que o cursor atravessava a fronteira entre
    // a barra de ícones e a lista, e que a legenda narrava o ícone sob ele. A fronteira não existe mais: a
    // barra vive no HUD, com o cursor DELA. O que sobra aqui é a metade que continua sendo verdade e continua
    // importando — nunca há dois itens selecionados ao mesmo tempo.
    const { nav } = boot();
    showPauses();
    const menu = $('#sp0');
    const itens = [...menu.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')];
    nav.pauseSetSel(menu, itens[0]);
    expect(menu.querySelectorAll('.pm-sel').length).toBe(1);
    nav.pauseSetSel(menu, itens[2]);
    expect(menu.querySelectorAll('.pm-sel').length).toBe(1);
    expect(itens[2].classList.contains('pm-sel')).toBe(true);
    // E o cursor da pausa não escreve mais na legenda dos ícones: seria um módulo mexendo na tela de outro.
    expect(document.querySelector('.pause-icons-cap').textContent).toBe('');
  });

  it('[Right] a navegação NÃO enxerga a lista escondida (ADR-0044, item 5)', () => {
    // O cartão passou a ter DUAS listas no markup, e só uma visível. Se a navegação varresse `.pm-btn` cru,
    // o cursor entraria nos itens do submenu de opções — e a criança ouviria itens de um menu que não está na
    // tela. É por isso que `PM_VISIBLE_ITEMS` existe como constante e não como seletor solto.
    //
    // E AGORA O ANEL DÁ A VOLTA — item 7: com a barra no HUD a pausa virou lista, e a XAG 106 passa a
    // RECOMENDAR o laço em vez de proibi-lo. A volta tem de cair no primeiro da lista VISÍVEL, nunca no
    // primeiro do markup, que é um item do submenu escondido.
    const { nav } = boot();
    showPauses();
    const menu = $('#sp0');
    const visiveis = [...menu.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')];
    const escondidos = [...menu.querySelectorAll('.pause-menu[hidden] .pm-btn')];
    expect(escondidos.length).toBeGreaterThan(0); // há mesmo lista escondida para atravessar
    nav.pauseSetSel(menu, visiveis[visiveis.length - 1]);
    nav.navPause(menu, 0, K({ down: true }));
    expect(escondidos.some((b) => b.classList.contains('pm-sel')), 'o cursor entrou na lista escondida').toBe(false);
    expect(visiveis[0].classList.contains('pm-sel'), 'a volta tem de cair no primeiro VISÍVEL').toBe(true);
  });

  it('[Right] "não" dentro do submenu de opções volta à RAIZ, e não ao jogo', () => {
    // A armadilha que o ADR-0044 desfaz, um nível abaixo: quem entra em Opções sem enxergar só sairia
    // despausando — perderia a pausa inteira para desfazer um passo.
    const { nav, log } = boot();
    showPauses();
    const menu = $('#sp0');
    menu.querySelector('.pause-menu[data-sub="raiz"]').hidden = true;
    menu.querySelector('.pause-menu[data-sub="opcoes"]').hidden = false;
    nav.navPause(menu, 0, K({ no: true }));
    expect(menu.querySelector('.pause-menu[data-sub="raiz"]').hidden, 'a raiz tinha de voltar').toBe(false);
    expect(menu.querySelector('.pause-menu[data-sub="opcoes"]').hidden).toBe(true);
    expect(log.phase, 'o jogo NÃO pode ter sido retomado').not.toContain('playing');
  });

  it('[Boundary] "não" na RAIZ continua saindo da pausa — o nível a mais não muda o de cima', () => {
    const { nav, log } = boot();
    showPauses();
    nav.navPause($('#sp0'), 0, K({ no: true }));
    expect(log.phase).toContain('playing');
  });

  it('🔴 [Right] moving inside a settings PANEL speaks the item reached — label, type, «N de M» (ADR-0159 rule 1)', () => {
    // A FRONTEIRA do item 3 do ADR-0044, e ela é decisão e não esquecimento.
    //
    // O item diz que todo item navegável anuncia posição e total "em todo lugar — pausa, título, opções,
    // atividades". A lista de PAUSA precisou de `srSay` porque ela seleciona por CLASSE: nada dispara anúncio
    // sozinho. Os diálogos de ajuste são o contrário — `navDialog` move o FOCO do navegador, e o leitor de
    // tela já anuncia o controle focado.
    //
    // Acrescentar `srSay` aqui criaria exatamente a divergência que o commit anterior consertou: o leitor
    // dizendo o controle e o jogo dizendo outra versão dele, por cima.
    //
    // E O ÍNDICE NÃO CABE POR ARIA: `aria-posinset`/`aria-setsize` só valem em papéis como `listitem`,
    // `menuitem`, `option`, `radio`, `row`, `tab`. MEDIDO no jogo: os 13 controles do painel de áudio são
    // `button`/`select`/`input` dentro de `role="group"` — pôr os atributos ali seria ARIA inválida. Este
    // projeto já recusou essa troca no menu do título, com o motivo escrito: "role='menu' exigiria filhos
    // 'menuitem' + padrão de setas ARIA que não implementamos → violaria WCAG 1.3.1".
    //
    // Indexar os diálogos exige mudar os papéis e implementar o padrão ARIA inteiro. É trabalho de verdade e
    // não cabe aqui; o que cabe é que ninguém o faça pela metade sem perceber.
    //
    // ⚠️ SUPERSEDED on 2026-09-12 by ADR-0159 rule 1, the Dev's: «On focus, an item is spoken as label, control type,
    // value or state, "N de M"» — in panels too. Measured in the dist: inside a panel the cursor moved and `#sr-status`
    // said nothing, so a child playing by ear heard no item. The cost is written down rather than hidden: with an
    // external screen reader the label is heard from the focus AND from the live region. The ARIA reason above still
    // holds — the index is spoken, not put in `aria-posinset`.
    const { nav, log, openTypo } = boot(); // `openTypo` vem do boot, não do escopo do arquivo
    openTypo();
    log.said.length = 0;
    nav.navDialog($('#typo'), K({ down: true }));
    const itens = $$('#typo .overlay__card button, #typo .overlay__card select, #typo .overlay__card input').filter((e) => e.offsetParent !== null);
    expect(log.said.length, 'moving inside a panel said nothing').toBe(1);
    expect(log.said[0], 'label, control type and position, in that order').toMatch(/^.+, botão, \d+ de \d+$/);
    expect(document.activeElement.textContent.trim() || document.activeElement.getAttribute('aria-label'), 'the item spoken is not the one focused')
      .toBe(log.said[0].split(', ')[0]);
    expect(itens.length).toBeGreaterThan(0);
  });

  it('🔴 [Right] adjusting a list or a slider speaks its NEW value — whoever adjusts by ear has no other way to know', () => {
    const { nav, log, openAudio } = boot();
    openAudio();
    $('#a-voz').focus();
    log.said.length = 0;
    nav.navDialog($('#audio'), K({ right: true }));
    expect(log.said.at(-1), 'the list changed and said nothing').toMatch(/, lista, dois, \d+ de \d+$/);
    $('#a-vol').focus();
    nav.navDialog($('#audio'), K({ right: true }));
    expect(log.said.at(-1), 'the slider changed and said nothing').toMatch(/controle deslizante, 60%, \d+ de \d+$/);
  });

  it('🔴 [Right] each control says its TYPE and VALUE after its label (ADR-0159 rule 1, XAG 106)', async () => {
    const { controlParts } = await import('../app/js/ui/menu-nav.js');
    const linha = (html) => {
      const row = document.createElement('div');
      row.className = 'ctrl-row';
      row.innerHTML = `<span><strong>Som</strong></span>${html}`;
      document.body.appendChild(row);
      return row.lastElementChild;
    };
    try {
      expect(controlParts(linha('<button aria-pressed="true">Ligado</button>'))).toEqual({ label: 'Som, interruptor', state: 'ligado' });
      expect(controlParts(linha('<select><option>Baixo</option><option selected>Alto</option></select>'))).toEqual({ label: 'Som, lista', state: 'Alto' });
      expect(controlParts(linha('<input type="range" min="0" max="10" value="4" aria-label="Volume">'))).toEqual({ label: 'Volume, controle deslizante', state: '40%' });
      expect(controlParts(linha('<div data-passos aria-label="Tamanho" aria-valuetext="adulto"></div>'))).toEqual({ label: 'Tamanho, seletor', state: 'adulto' });
    } finally {
      for (const r of document.querySelectorAll('body > .ctrl-row')) r.remove();
    }
  });

  it('🔴 [Right] the OPTION a panel offers says «option» and whether it is the chosen one — probed 2026-09-23, it had no case', async () => {
    // The typography panel's faces are `role="radio"` (ADR-0149): its whole row — label, role and «selected» — could be undone
    // with every file green, and a child choosing a face by ear would hear which one is chosen from nothing but the words.
    const { controlParts } = await import('../app/js/ui/menu-nav.js');
    const row = document.createElement('div');
    row.className = 'ctrl-row';
    row.innerHTML = '<span><strong>Andika</strong></span><button role="radio" aria-checked="true" aria-label="Andika, caixa alta">●</button>'
      + '<button role="radio" aria-checked="false">○</button>';
    document.body.appendChild(row);
    try {
      const [chosen, other] = row.querySelectorAll('[role="radio"]');
      expect(controlParts(chosen)).toEqual({ label: 'Andika, opção', state: 'selecionada' });
      expect(controlParts(other)).toEqual({ label: 'Andika, opção', state: '' });
    } finally {
      row.remove();
    }
  });

  // ⚠️ One more decision of the same probe is EQUIVALENT and has no case: the switch row is read before the option row, and it
  // would only matter for an element carrying both `aria-pressed` and `role="radio"` — which the kit never builds
  // (`ui/panel-widgets` gives a radio `aria-checked` INSTEAD of `aria-pressed`, and says why).
  it('🔴 [Boundary] a slider says a WHOLE percentage, reads a missing maximum as 100, and an empty range as 0% — probed 2026-09-23', async () => {
    const { controlParts } = await import('../app/js/ui/menu-nav.js');
    const make = (html) => { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d); return d; };
    const holders = [
      make('<input type="range" min="0" max="3" value="1" aria-label="A">'),
      make('<input type="range" value="40" aria-label="B">'),
      make('<input type="range" min="5" max="5" value="5" aria-label="C">'),
    ];
    try {
      const [a, b, c] = holders.map((h) => controlParts(h.firstElementChild).state);
      expect(a, 'a third was said as 33.333…%').toBe('33%');
      expect(b, 'a slider with no max was read against another scale').toBe('40%');
      expect(c, 'a range of zero width divided by zero').toBe('0%');
    } finally {
      for (const h of holders) h.remove();
    }
  });

  it('[Right] andar na lista de pausa FALA o item — senão o menu é mudo para quem o navega por escuta', () => {
    // MEDIDO no jogo construído antes de este caso existir (`?x=84`): a seta movia o cursor de `resume` para
    // `acessibilidade` e o `#sr-status` continuava VAZIO. Não havia foco (a pausa seleciona por CLASSE, não
    // por foco do navegador), não havia `aria-activedescendant` e não havia região viva dentro do cartão —
    // ou seja, nada em lugar nenhum contava para a criança que o cursor tinha andado.
    //
    // O item 3 do ADR-0044 diz "todo item navegável anuncia posição e total... em todo lugar — pausa, título,
    // opções, atividades". Ele tinha chegado ao título e à barra de ícones e NÃO à lista de pausa, que é
    // justamente o menu que o item 5 reconstruiu. A promessa mais visível do registro estava muda no lugar
    // mais importante dele.
    const { nav, log } = boot();
    showPauses();
    const menu = $('#sp0');
    const itens = [...menu.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')];
    nav.pauseSetSel(menu, itens[0]);
    log.said.length = 0;
    nav.navPause(menu, 0, K({ down: true }));
    expect(itens[1].classList.contains('pm-sel')).toBe(true);
    expect(log.said.at(-1), 'o item novo tem de ser falado').toContain(itens[1].textContent.trim());
    expect(log.said.at(-1), 'e com a posição no fim, como todo item de menu deste jogo').toContain('2 de ' + itens.length);
  });

  it('[Zero] confirmar e voltar NÃO falam item nenhum', () => {
    // Só o ANDAR anuncia. Confirmar já tem a consequência dele (o painel que abre, o jogo que volta), e
    // voltar já tem a dele; repetir o rótulo nesses dois seria falar por cima do que interessa.
    const { nav, log } = boot();
    showPauses();
    const menu = $('#sp0');
    nav.pauseSetSel(menu, [...menu.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')][0]);
    log.said.length = 0;
    nav.navPause(menu, 0, K({ yes: true }));
    nav.navPause(menu, 0, K({ no: true }));
    expect(log.said).toEqual([]);
  });

  it('[Right] a PROMESSA do ADR-0044, no DOM: `quit` a uma tecla de `resume`', () => {
    // ESTE CASO SUBSTITUI o da FRONTEIRA ícones↔itens, que não existe mais. E a substituição é o desfecho:
    // enquanto havia fronteira, "para cima" no primeiro item subia para a barra de ícones. Agora sobe para o
    // ÚLTIMO item da lista — que é `quit` na produção. Longe na leitura, vizinho no dedo.
    const { nav } = boot();
    showPauses();
    const menu = $('#sp0');
    const itens = [...menu.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')];
    nav.pauseSetSel(menu, itens[0]);
    nav.navPause(menu, 0, K({ up: true }));
    expect(itens[itens.length - 1].classList.contains('pm-sel'), 'para cima no primeiro tem de cair no último').toBe(true);
    nav.navPause(menu, 0, K({ down: true }));
    expect(itens[0].classList.contains('pm-sel'), 'e para baixo no último volta ao primeiro').toBe(true);
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

  it('QUEM DECIDE É `isNavigable`, e não a fase — um jogo sem pausa navega os menus dele', () => {
    // É o achado 10 do segundo consumidor virando teste. O quiz precisava se declarar "pausado" para poder
    // navegar os próprios menus, porque `menu-nav` lia `phase` por IMPORTAÇÃO. Aqui a fase é 'title' — nada
    // de pausa em lugar nenhum — e a navegação funciona, porque quem responde é o consumidor.
    setPhaseValue('title');
    const { nav } = boot({ isNavigable: () => true });
    showPauses();
    const e = key('ArrowDown');
    nav.menuNavKey(e);
    expect(e.stops).toBe(1);
  });

  it('e o contrário também: em plena pausa, `isNavigable` falso cala tudo', () => {
    // O par do caso acima. Sem ele, `isNavigable` poderia estar sendo IGNORADO e o de cima passaria assim
    // mesmo — bastaria o módulo ter voltado a olhar a fase e a fase ser 'paused' aqui.
    const { nav } = boot({ isNavigable: () => false });
    setPhaseValue('paused');
    showPauses();
    const e = key('ArrowDown');
    nav.menuNavKey(e);
    expect(e.stops).toBe(0);
  });

  it('[Right] navegável, mas SEM diálogo e SEM menu aberto: a tecla NÃO é consumida', () => {
    // A issue #72, virada teste. `menuNavKey` matava o evento (preventDefault + stopPropagation, em CAPTURA)
    // ANTES de descobrir se havia o que navegar — e depois saía sem fazer nada. Na plataforma era invisível,
    // porque pausar ABRE o menu; no segundo consumidor era total: um quiz cujos ajustes estão sempre
    // disponíveis responde `isNavigable(): true`, e com isso perdia as setas de escolher alternativa e a
    // tecla do sonar. Duas funcionalidades que existiam e não chegavam à criança.
    setPhaseValue('title');
    const { nav } = boot({ isNavigable: () => true, getPauseMenu: () => null });
    const e = key('ArrowDown');
    nav.menuNavKey(e);
    expect(e.stops, 'sem nada aberto, a tecla é de outro dono').toBe(0);
    expect(e.defaults).toBe(0);
  });

  it('[Right] com MENU DE PAUSA aberto, a tecla continua sendo consumida', () => {
    // O par do caso acima, e o que impede o conserto de virar "o menu-nav parou de funcionar".
    setPhaseValue('paused');
    const { nav } = boot({ isNavigable: () => true });
    showPauses();
    const e = key('ArrowDown');
    nav.menuNavKey(e);
    expect(e.stops).toBe(1);
    expect(e.defaults).toBe(1);
  });

  it('[Right] com DIÁLOGO aberto, a tecla continua sendo consumida — a rede do Escape fica de pé', () => {
    // Este é o caso que o conserto NÃO podia quebrar. O bloco (b) do cabeçalho do módulo registra que `#help`
    // e `#touchcfg` dependem do `stopPropagation()` para a tecla não cair no ouvinte de bolha, que
    // despausaria o jogo com o diálogo aberto. Eles entram por `sharedDialogOpen()` — há diálogo, logo a
    // tecla é consumida, exatamente como antes.
    const { nav, openHelp } = boot({ isNavigable: () => true });
    openHelp();
    const e = key('Escape');
    nav.menuNavKey(e);
    expect(e.stops).toBe(1);
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

  it('🔴 [Right] on the quick bar the key is the BAR\'s: an open pause card does not move with it, even where every page is navigable', () => {
    // A quiz answers `isNavigable()` true always, so the one thing keeping a bar key off an open card is that the bar branch
    // ENDS the key. Without it, one arrow moved the bar's cursor and the card's, and was consumed twice.
    const { nav, log, naBarra } = boot({ isNavigable: () => true });
    naBarra.add(0);
    showPauses();
    const e = key('ArrowDown');
    nav.menuNavKey(e);
    expect(log.bar, 'the bar did not get the key').toHaveLength(1);
    expect($('#sp0').querySelector('.pm-sel'), 'the pause card moved under the bar').toBe(null);
    expect(e.stops, 'consumed once, by the bar').toBe(1);
  });

  it('🔴 [Right] and the bar that moves is the one of the player whose key it is', () => {
    const { nav, log, naBarra } = boot({ whichPlayer: () => 1 });
    naBarra.add(1);
    nav.menuNavKey(key('ArrowRight'));
    expect(log.bar.map(([jogador]) => jogador), 'Player 2\'s key moved another bar').toEqual([1]);
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

  // A #help já esteve FORA da cadeia de Escape, e o jogo só não despausava com ela aberta porque o menuNavKey
  // a cobre por z-index e dá stopPropagation — uma rede acidental. Quem mexesse na captura sem antes pôr a
  // #help na cadeia criaria o bug. Agora as duas metades existem, e este caso cobre as duas: a cadeia SABE da
  // #help, e a captura continua fazendo o seu trabalho.
  it('[Right] #help está na cadeia de Escape E a captura impede a tecla de despausar o jogo', () => {
    const { nav, panel, log, openHelp } = boot();
    showPauses();
    openHelp();
    expect(panel.escapeTarget()).toBe('help');  // na cadeia: o recuo também fecharia a Ajuda
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

// ---- ADR-0159 rule 1 in panels (2026-09-12) ----
//   R1 moving in a panel focuses and says nothing       🔴
//   R2 no control type after the label                  🔴 three cases
//   R3 a list change says nothing                        🔴
//   R4 a slider change says nothing                      🔴
//   R5 the slider's percentage from the raw value        🔴 two cases
//   R6 a switch's state not read                         🔴

// MUTATIONS CHECKED (2026-09-23) on `menuNavKey`, seventeen decisions disabled one at a time against the nine files that drive
// this module — `scratchpad/sonda-navkey.py`. Four were green; two were holes, now held by the quick-bar cases above: the bar
// branch ENDING the key (without it, on a page that is always navigable, one arrow moved the bar and an open card), and the
// bar moved being its owner's. The other two are EQUIVALENT and declared rather than caught: asking the action of a key NO
// player owns, on the bar or in a menu, answers null anyway — `whichPlayer` is −1 only when no active player's scheme has the
// key, Player 1's included.
