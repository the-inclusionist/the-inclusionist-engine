// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/menu-nav — what ONLY the browser proves (BROWSER project): real focus (document.activeElement), real
// visibility (`offsetParent`), the EFFECTIVE z-index stack (getComputedStyle) and what each key does end to end. The
// pure decision is in menu-nav.node.test.js and is NOT repeated here.
//
// The shell is exercised COMPOSED with the REAL ui/settings-panel, because that is how the composition root uses it: the
// panel keeps the overlay stack and the close registry, and `sharedDialogOpen` is an ALIAS of its `topVisibleOverlay`.
// Testing the two together is what proves the unification changed nothing.
//
// TWO KNOWN DEFECTS ARE PINNED HERE, ON PURPOSE, AS THEY ARE — not as they should be:
//   · the `#game-region .overlay` scope does NOT reach `.screen-pause`, so closing #typo/#help drops the focus;
//   · Escape is "back", resolved by the TOP OF THE STACK (z-index) and not by the registry chain.
// Both have a pending fix. These cases exist so the fix has a net: when someone fixes it, they fail, and the failure IS
// the warning that the behaviour changed where it had to.
import { describe, it, expect, beforeEach } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import { initMenuNav } from '../app/js/ui/menu-nav.js';
import { initSettingsPanel } from '../app/js/ui/settings-panel.js';
// The SCENE belongs to the TEST: the phase is the `core/scenes` stack and its three names live in the composition root
// (ADR-0030 C3); engine code receives BOOLEANS. This `let` plays that role.
let faseFalsa = 'playing';
const setPhaseValue = (p) => { faseFalsa = p; };

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// Lean markup, FAITHFUL to a real host in what matters: the dialogs live inside #game-region and are `.overlay` with
// `.overlay__card`; the pause menus live in the SAME #game-region but are `.screen-pause`/`.pause-card` — a different
// class. That difference is what produces defect 1.
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

/** Builds the overlay shell + menu-nav, wired as the composition root wires them. */
function boot(over = {}) {
  document.body.innerHTML = MARKUP;
  setPhaseValue('paused');
  const log = { phase: [], actor: [], padWiz: [], bar: [], said: [] };
  const naBarra = over.naBarra || new Set();
  const panel = initSettingsPanel({ t: translate, $, $$, doc: document, computedZ: (el) => Number(getComputedStyle(el).zIndex) || 0 });

  // The dialogs that matter here, registered in the Escape chain in this order — #help included, as the last case of
  // this file asserts.
  panel.register('audio', { close: () => closeAudio(), inEscapeChain: true });
  panel.register('typo', { close: () => closeTypo(), inEscapeChain: true });
  panel.register('help', { close: () => closeHelp(), inEscapeChain: true }); // in the chain

  function openOv(id) { const ov = $('#' + id); ov.hidden = false; panel.frontOverlay(ov); }
  function openTypo() { openOv('typo'); $('#font-a').focus(); }
  function closeTypo() { $('#typo').hidden = true; nav.menuFocus(nav.sharedDialogOpen()); }
  function openAudio() { openOv('audio'); $('#a-first').focus(); }
  function closeAudio() { $('#audio').hidden = true; }
  function openHelp() { openOv('help'); $('#help-close').focus(); }
  function closeHelp() { $('#help').hidden = true; nav.menuFocus(nav.sharedDialogOpen()); }

  const ctx = {
    t: translate, // the root's translator, played by the test (ADR-0232 D3)
    $,
    getActiveElement: () => document.activeElement,
    topVisibleOverlay: panel.topVisibleOverlay,
    closeById: panel.closeById,
    getPauseMenu: (i) => $('#sp' + i),
    setPhase: (p) => { log.phase.push(p); setPhaseValue(p); },
    setPauseActor: (i) => log.actor.push(i),
    // THE PLATFORMER answers in its own language: a menu is a pause thing. It is an injected question, not a phase
    // check inside the module, so a quiz can answer `true` without lying (finding 10).
    isNavigable: () => faseFalsa === 'paused',
    // The `accessibility` MODE (ADR-0044, item 7) is asked BEFORE the "navigable" guard, because it runs with the game
    // moving. By default nobody is in it; the cases that exercise it change `naBarra`.
    srSay: (texto) => log.said.push(texto),
    withIndex: () => true, // item 3's index is on by default; see `withIndex` in ui/menu-nav's ctx
    onBar: (i) => naBarra.has(i),
    navBar: (i, k) => log.bar.push([i, k]),
    isCapturing: () => false,
    closePadWiz: (save) => log.padWiz.push(save),
    whichPlayer: () => -1,        // only generic keys in these cases (routing by player belongs to another module)
    actionOf: () => null,
    win: { addEventListener: () => {} },
    ...over,
  };
  const nav = initMenuNav(ctx);
  return { nav, panel, log, naBarra, open, openTypo, openAudio, openHelp };
}

/** A fake KeyboardEvent — `menuNavKey` is exported separately precisely so it can be called directly. */
function key(code) {
  const e = { code, defaults: 0, stops: 0, preventDefault() { this.defaults++; }, stopPropagation() { this.stops++; } };
  return e;
}

/** Shows the pauses (ui/shell's setPhase would; here only navigation matters). */
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
    $('#audio').hidden = true;                 // close the top one: the one below remains
    expect(nav.sharedDialogOpen().id).toBe('typo');
  });

  // ⚠️ DEFECT 1, PINNED. Do not fix here: the scope is `#game-region .overlay` and the pause menus are `.screen-pause`. The
  // day the scope is fixed, this case fails — which is what it exists to say.
  it('DEFEITO 1 (pinado): o escopo NÃO enxerga os menus de pausa (.screen-pause não é .overlay)', () => {
    const { nav } = boot();
    showPauses();
    expect($$('.screen-pause').length).toBe(2);
    expect($$('#game-region .overlay').length).toBe(4); // padwiz, typo, help, audio — and NO pause
    expect(nav.sharedDialogOpen()).toBe(null);          // with two pause menus VISIBLE on screen
  });

  // ⚠️ DEFECT 1, PINNED — the accessibility consequence (WCAG 2.4.3: focus is lost on closing).
  it('DEFEITO 1 (pinado): fechar #typo com a pausa aberta larga o foco no <body>', () => {
    const { nav, openTypo } = boot();
    showPauses();
    openTypo();
    expect(document.activeElement.id).toBe('font-a');
    nav.dialogBack($('#typo'));                          // = what Escape does
    expect($('#typo').hidden).toBe(true);
    // menuFocus(sharedDialogOpen()) received null → left by the guard → nobody gave the focus back.
    // The a11y requirement is "focus returns to whoever opened": here it does NOT return to the pause menu.
    const ae = document.activeElement;
    expect(ae && ae.closest ? ae.closest('.screen-pause') : null).toBe(null);
    expect($$('.pm-sel, .pi-sel').length).toBe(0); // neither by focus nor by the pause menu's own selection
  });

  it('fechar o de cima com OUTRO diálogo aberto devolve o foco — o caminho que funciona hoje', () => {
    const { nav, openTypo, openAudio } = boot();
    openTypo(); openAudio();
    nav.dialogBack($('#audio'));
    expect(document.activeElement.id).toBe('font-a'); // back on #typo, which stayed underneath
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
    expect(nav.menuItems($('#audio'))).toEqual([]); // #audio still hidden
  });
});

describe('navDialog — andar dentro de um diálogo', () => {
  const K = (o) => ({ yes: false, no: false, up: false, down: false, left: false, right: false, ...o });

  // THE RING (ADR-0044), and the reason is use: whoever cannot see does not scan the list looking for its end — they ask
  // "and before the first?" and must get an answer. It is what puts the least wanted item ONE key from the most urgent
  // without the two being near each other.
  //
  // MUTATION CHECKED: with `stepInRing` back to the old clamp, the last assertion fails with
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
    // The top end: before the first is the LAST navigable item. `a-off` (disabled) and `a-invis` (hidden) do not count —
    // `menuItems` already filters them, and the ring walks over what is left.
    nav.navDialog(dlg, K({ up: true }));
    expect(document.activeElement.id, 'antes do primeiro vem o último').toBe('a-close');
    // And the bottom end closes the ring back to the start.
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
    expect(document.activeElement.id).toBe('a-voz'); // stays on the same control
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
    // and the arrows inside it are not cursor stops: going down from the control leaves it at once
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
    // 🔴 not `document.body.focus()`, which moves nothing (the <body> is not focusable): with it the case never put the
    // focus OUTSIDE, and passed with the focus already on the first item (measured 2026-09-23).
    document.activeElement.blur();
    expect(document.activeElement).toBe(document.body);
    nav.navDialog($('#audio'), K({ down: true }));
    expect(document.activeElement.id).toBe('a-voz'); // entered at the first and went down one
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
    // The icon bar lives in the HUD, with ITS OWN cursor (ADR-0044 item 7), so the pause cursor never crosses into it.
    // What this case holds: there are never two items selected at the same time.
    const { nav } = boot();
    showPauses();
    const menu = $('#sp0');
    const itens = [...menu.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')];
    nav.pauseSetSel(menu, itens[0]);
    expect(menu.querySelectorAll('.pm-sel').length).toBe(1);
    nav.pauseSetSel(menu, itens[2]);
    expect(menu.querySelectorAll('.pm-sel').length).toBe(1);
    expect(itens[2].classList.contains('pm-sel')).toBe(true);
    // And the pause cursor does not write to the icons' caption: that would be one module touching another's screen.
    expect(document.querySelector('.pause-icons-cap').textContent).toBe('');
  });

  it('[Right] a navegação NÃO enxerga a lista escondida (ADR-0044, item 5)', () => {
    // The card has TWO lists in the markup, and only one visible. If navigation scanned raw `.pm-btn`, the cursor would
    // enter the options submenu's items — and the child would hear items of a menu that is not on screen. That is why
    // `PM_VISIBLE_ITEMS` is a constant and not a loose selector.
    //
    // AND THE RING WRAPS — item 7: with the bar in the HUD the pause is a list, and XAG 106 RECOMMENDS wrapping instead of
    // forbidding it. The wrap must land on the first of the VISIBLE list, never on the first in the markup, which is an
    // item of the hidden submenu.
    const { nav } = boot();
    showPauses();
    const menu = $('#sp0');
    const visiveis = [...menu.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')];
    const escondidos = [...menu.querySelectorAll('.pause-menu[hidden] .pm-btn')];
    expect(escondidos.length).toBeGreaterThan(0); // there really is a hidden list to cross
    nav.pauseSetSel(menu, visiveis[visiveis.length - 1]);
    nav.navPause(menu, 0, K({ down: true }));
    expect(escondidos.some((b) => b.classList.contains('pm-sel')), 'o cursor entrou na lista escondida').toBe(false);
    expect(visiveis[0].classList.contains('pm-sel'), 'a volta tem de cair no primeiro VISÍVEL').toBe(true);
  });

  it('[Right] "não" dentro do submenu de opções volta à RAIZ, e não ao jogo', () => {
    // The trap ADR-0044 undoes, one level down: whoever enters Options without seeing could only leave by unpausing —
    // losing the whole pause to undo one step.
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
    // ADR-0159 rule 1, the Dev's: «On focus, an item is spoken as label, control type, value or state, "N de M"» — in
    // panels too. Without it, inside a panel the cursor moved and `#sr-status` said nothing, so a child playing by ear
    // heard no item. The cost is written down rather than hidden: with an external screen reader the label is heard from
    // the focus AND from the live region.
    //
    // ⚠️ THE INDEX IS SPOKEN, NOT PUT IN `aria-posinset`: `aria-posinset`/`aria-setsize` only hold for roles such as
    // `listitem`, `menuitem`, `option`, `radio`, `row`, `tab`, and a panel's controls are `button`/`select`/`input` inside
    // `role="group"` — putting the attributes there would be invalid ARIA (the same reason `role='menu'` was refused: it
    // would demand `menuitem` children and an ARIA arrow pattern not implemented, violating WCAG 1.3.1).
    const { nav, log, openTypo } = boot(); // `openTypo` comes from boot, not from the file's scope
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
      expect(controlParts(translate, linha('<button aria-pressed="true">Ligado</button>'))).toEqual({ label: 'Som, interruptor', state: 'ligado' });
      expect(controlParts(translate, linha('<select><option>Baixo</option><option selected>Alto</option></select>'))).toEqual({ label: 'Som, lista', state: 'Alto' });
      expect(controlParts(translate, linha('<input type="range" min="0" max="10" value="4" aria-label="Volume">'))).toEqual({ label: 'Volume, controle deslizante', state: '40%' });
      expect(controlParts(translate, linha('<div data-passos aria-label="Tamanho" aria-valuetext="adulto"></div>'))).toEqual({ label: 'Tamanho, seletor', state: 'adulto' });
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
      expect(controlParts(translate, chosen)).toEqual({ label: 'Andika, opção', state: 'selecionada' });
      expect(controlParts(translate, other)).toEqual({ label: 'Andika, opção', state: '' });
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
      const [a, b, c] = holders.map((h) => controlParts(translate, h.firstElementChild).state);
      expect(a, 'a third was said as 33.333…%').toBe('33%');
      expect(b, 'a slider with no max was read against another scale').toBe('40%');
      expect(c, 'a range of zero width divided by zero').toBe('0%');
    } finally {
      for (const h of holders) h.remove();
    }
  });

  it('[Right] andar na lista de pausa FALA o item — senão o menu é mudo para quem o navega por escuta', () => {
    // The pause selects by CLASS, not by browser focus, and has no `aria-activedescendant` and no live region inside the
    // card — so without `srSay` nothing anywhere tells the child the cursor moved (measured in the built game before this
    // case existed: the arrow moved from `resume` to `acessibilidade` and `#sr-status` stayed EMPTY).
    //
    // Item 3 of ADR-0044: every navigable item announces position and total everywhere — pause, title, options,
    // activities. The pause list is the menu item 5 rebuilt, the most important place for that promise.
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
    // Only MOVING announces. Confirming has its own consequence (the panel that opens, the game that resumes), and going
    // back has its own; repeating the label on those two would talk over what matters.
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
    // "Up" on the first item goes to the LAST item of the list — `quit` in production. Far in reading, neighbours under the
    // finger.
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

describe('consumed — what a listener after the menus, on the same window, asks (ADR-0111 erratum of 2026-09-26)', () => {
  // `stopPropagation()` does not reach a sibling listener on the window's capture, and the keyboard conductor is one: it asks
  // this, so a key that moved, confirmed or CLOSED a menu is not also played. `a-delivered-key-does-not-also-click` has the real keys.
  it('🔴 [Right] a key the pause card consumed is marked; one it let through is not', () => {
    const { nav } = boot({ isNavigable: () => true });
    showPauses();
    const moved = key('ArrowDown');
    nav.menuNavKey(moved);
    expect(nav.consumed(moved), 'the card moved and the key is not marked consumed').toBe(true);
    const other = key('KeyZ');
    nav.menuNavKey(other);
    expect(nav.consumed(other), 'a key with no intent was marked consumed').toBe(false);
  });

  it('🔴 [Right] «yes» that closes the card is marked too — the mark is the key, not whether a menu is left open', () => {
    const { nav } = boot({ isNavigable: () => true });
    showPauses();
    const sp = $('#sp0');
    sp.querySelector('[data-act]')?.addEventListener('click', () => { sp.hidden = true; });
    const yes = key('Space');
    nav.menuNavKey(yes);
    expect(sp.hidden, 'the first item did not act: the case would measure nothing').toBe(true);
    expect(nav.consumed(yes)).toBe(true);
  });

  it('🔴 [Boundary] a key on the quick bar and Escape on the controller-mapping panel are marked', () => {
    const { nav, naBarra, log } = boot();
    naBarra.add(0);
    const onBar = key('ArrowRight');
    nav.menuNavKey(onBar);
    expect(nav.consumed(onBar), 'the bar consumed the key and it is not marked').toBe(true);
    naBarra.delete(0);
    $('#padwiz').hidden = false;
    const esc = key('Escape');
    nav.menuNavKey(esc);
    expect(log.padWiz, 'Escape did not reach the mapping panel: the case would measure another branch').toEqual([false]);
    expect(nav.consumed(esc), 'Escape closed the mapping panel and is not marked').toBe(true);
  });

  it('🔴 [Zero] with nothing open, no key is marked', () => {
    const { nav } = boot({ isNavigable: () => true, getPauseMenu: () => null });
    const e = key('Space');
    nav.menuNavKey(e);
    expect(nav.consumed(e)).toBe(false);
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
    // The second consumer's finding 10 as a test: a quiz must not have to declare itself "paused" to navigate its own
    // menus. Here the phase is 'title' — no pause anywhere — and navigation works, because the consumer answers.
    setPhaseValue('title');
    const { nav } = boot({ isNavigable: () => true });
    showPauses();
    const e = key('ArrowDown');
    nav.menuNavKey(e);
    expect(e.stops).toBe(1);
  });

  it('e o contrário também: em plena pausa, `isNavigable` falso cala tudo', () => {
    // The pair of the case above. Without it, `isNavigable` could be IGNORED and the one above would pass anyway — it
    // would be enough for the module to look at the phase again and the phase to be 'paused' here.
    const { nav } = boot({ isNavigable: () => false });
    setPhaseValue('paused');
    showPauses();
    const e = key('ArrowDown');
    nav.menuNavKey(e);
    expect(e.stops).toBe(0);
  });

  it('[Right] navegável, mas SEM diálogo e SEM menu aberto: a tecla NÃO é consumida', () => {
    // Issue #72 as a test: `menuNavKey` must not kill the event (preventDefault + stopPropagation, in CAPTURE) BEFORE
    // finding out whether there is anything to navigate. In a platformer that would be invisible, because pausing OPENS
    // the menu; in a quiz whose settings are always available (`isNavigable(): true`) it would take away the arrows that
    // choose an answer and the sonar key.
    setPhaseValue('title');
    const { nav } = boot({ isNavigable: () => true, getPauseMenu: () => null });
    const e = key('ArrowDown');
    nav.menuNavKey(e);
    expect(e.stops, 'sem nada aberto, a tecla é de outro dono').toBe(0);
    expect(e.defaults).toBe(0);
  });

  it('[Right] com MENU DE PAUSA aberto, a tecla continua sendo consumida', () => {
    // The pair of the case above, which keeps the fix from becoming "menu-nav stopped working".
    setPhaseValue('paused');
    const { nav } = boot({ isNavigable: () => true });
    showPauses();
    const e = key('ArrowDown');
    nav.menuNavKey(e);
    expect(e.stops).toBe(1);
    expect(e.defaults).toBe(1);
  });

  it('[Right] com DIÁLOGO aberto, a tecla continua sendo consumida — a rede do Escape fica de pé', () => {
    // The case the #72 fix must NOT break. The module header's block (b) records that `#help` and `#touchcfg` depend on the
    // `stopPropagation()` to keep the key from reaching the bubble listener, which would unpause the game with the dialog
    // open. They come in through `sharedDialogOpen()` — there is a dialog, so the key is consumed.
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
    expect([down.defaults, log.padWiz]).toEqual([0, []]); // consumed by the wizard, with no effect
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
    expect($('#sp0').querySelector('.pm-sel')).toBe(null); // the other player's screen did not move
  });

  // ⚠️ DEFECT 2, PINNED. What decides is the TOP OF THE STACK (z-index), not ui/settings-panel's registry chain (order:
  // audio → typo → help, in this test). With #typo on top, #typo closes — even with #audio before it in the chain. If
  // someone switches the resolution to the registered chain, this case fails, and that is the warning.
  it('DEFEITO 2 (pinado): Escape fecha o de cima por z-index, NÃO o primeiro da cadeia registrada', () => {
    const { nav, panel, openTypo, openAudio } = boot();
    showPauses();
    openAudio(); openTypo();                    // #typo on top; in the CHAIN, #audio comes first
    expect(panel.escapeTarget()).toBe('audio'); // this is what the composition root's BUBBLE listener would do…
    nav.menuNavKey(key('Escape'));
    expect($('#typo').hidden).toBe(true);       // …and this is what actually happens: the top one closes
    expect($('#audio').hidden).toBe(false);
  });

  // Both halves hold: the chain KNOWS about #help, and the capture keeps doing its job (menuNavKey covers it by z-index and
  // calls stopPropagation). With #help outside the chain, the capture would be an accidental net, and whoever touched it
  // would create the bug of Escape unpausing the game under the dialog.
  it('[Right] #help está na cadeia de Escape E a captura impede a tecla de despausar o jogo', () => {
    const { nav, panel, log, openHelp } = boot();
    showPauses();
    openHelp();
    expect(panel.escapeTarget()).toBe('help');  // in the chain: the fallback would also close Help
    const e = key('Escape');
    nav.menuNavKey(e);
    expect($('#help').hidden).toBe(true);       // the capture closed the dialog…
    expect(e.stops).toBe(1);                    // …and kept the key from reaching the bubble listener
    expect(log.phase).toEqual([]);              // so the game did NOT unpause
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

/* ===================== AN ITEM SAID BY NAME (ADR-0194 §1–§2) ===================== */
// The voice asks this module two things: which names can be said NOW, and to put the cursor on one. The answer has to be the
// menu a CONFIRM would reach — the confirm the voice then presses through the virtual controller — so both are asked under the
// same guards `menuNavKey` applies before moving a menu.
describe('itemNames / pointAt — the names a child can say, and the cursor put on one', () => {
  it('🔴 [Right] with the pause card open: its visible items, by name; pointAt SELECTS and does not activate', () => {
    const { nav, log } = boot();
    showPauses();
    expect(nav.itemNames(0)).toEqual(['Continuar', 'ABC', 'Som', 'Ajuda', 'Sair']);
    let clicked = 0;
    $('#sp0 [data-act="audio"]').addEventListener('click', () => { clicked += 1; });
    expect(nav.pointAt('Som', 0)).toBe(true);
    expect($('#sp0 .pm-sel')?.dataset.act, 'the cursor is not on the item said').toBe('audio');
    expect(clicked, 'putting the cursor there activated the item — the confirm is the caller\'s').toBe(0);
    expect(log.said, 'pointing announced the item: the confirm that follows speaks for it').toEqual([]);
  });

  it('🔴 [Right] with a panel on top: the panel\'s stops, not the card\'s; pointAt FOCUSES', () => {
    const { nav, openAudio } = boot();
    showPauses();
    openAudio();
    const names = nav.itemNames(0);
    expect(names).toContain('Fechar');
    expect(names, 'the card underneath answered for the panel on top').not.toContain('Continuar');
    expect(names, 'a disabled or hidden control is not a stop').not.toContain('Desabilitado');
    expect(names).not.toContain('Invisível');
    expect(nav.pointAt('Fechar', 0)).toBe(true);
    expect(document.activeElement?.id).toBe('a-close');
  });

  // 📌 ADR-0194 §5: a locked item is a stop of the cursor (ADR-0161), so its name is sayable and the cursor goes to it; the
  // confirm that follows is the item's own press, which says the reason — held end to end in `a-name-said-activates-its-item`.
  it('🔴 [Boundary] a LOCKED item is offered and can be pointed at — the cursor stops there, as the arrows would', () => {
    const { nav } = boot();
    showPauses();
    $('#sp0 [data-act="ajuda"]').setAttribute('aria-disabled', 'true');
    expect(nav.itemNames(0), 'a locked item cannot be said, so the child never hears why it is locked').toContain('Ajuda');
    expect(nav.pointAt('Ajuda', 0)).toBe(true);
    expect($('#sp0 .pm-sel')?.dataset.act, 'the cursor is not on the locked item said').toBe('ajuda');
  });

  it('🎯 [Zero] where a key would move no menu, there is no name and no cursor to move', () => {
    const onBar = boot({ naBarra: new Set([0]) });
    showPauses();
    expect(onBar.nav.itemNames(0), 'on the quick bar, a confirm reaches the bar and not the card').toEqual([]);
    expect(onBar.nav.pointAt('Som', 0)).toBe(false);
    const playing = boot();
    showPauses();
    setPhaseValue('playing');
    expect(playing.nav.itemNames(0), 'not navigable now: the confirm would go to the game').toEqual([]);
    const capturing = boot({ isCapturing: () => true });
    showPauses();
    expect(capturing.nav.itemNames(0), 'a remap in progress owns the keys').toEqual([]);
  });

  it('[Zero] a name that is not there moves nothing', () => {
    const { nav } = boot();
    showPauses();
    nav.pointAt('Som', 0);
    expect(nav.pointAt('Elefante', 0)).toBe(false);
    expect($('#sp0 .pm-sel')?.dataset.act, 'an unknown name moved the cursor').toBe('audio');
  });
});

// MUTATIONS CHECKED (2026-09-25, ADR-0194) on `itemNames`/`pointAt`, one at a time:
//   MN1 names offered while the seat is on the quick bar        🔴 «where a key would move no menu»
//   MN2 names offered while no menu is navigable                 🔴 «where a key would move no menu»
//   MN3 names offered during a remap                             🔴 «where a key would move no menu»
//   MN4 locked items left out (the filter §5 retired)             🔴 «a LOCKED item is offered and can be pointed at»
//   MN5 the card answers under a panel (shared with the keys)    🔴 «with a panel on top» (and two DEFECT-2 cases)
//   (the cursor itself — W4, W4b — is held end to end by `a-name-said-activates-its-item.browser.test.js`)

/*
 * ===================== AN INTENT WITH NO KEY — `navIntent` (ADR-0218 erratum of 2026-09-26) =====================
 * One-button scanning offers a menu's own steps and takes one with a press that is not a menu key: the switch's key is stopped
 * before any listener, so `menuNavKey` never sees it. It asks `navIntent`, and the step must go where a key's would, under the
 * same guards — or scanning moves a menu a key could not, or none at all.
 */
describe('navIntent — a menu step with no key goes the way a key\'s would', () => {
  it('🔴 [Right] on the quick bar the step goes to the BAR, and the answer is «taken»', () => {
    const { nav, log } = boot({ naBarra: new Set([0]) });
    showPauses();
    expect(nav.navIntent(0, { down: true })).toBe(true);
    expect(log.bar, 'the step did not reach the bar').toEqual([[0, { down: true }]]);
    expect($('#sp0 .pm-sel'), 'the step moved the card under the bar').toBeNull();
  });

  it('🔴 [Right] with a PANEL on top, «next» moves its focus and «back» closes it', () => {
    const { nav, openAudio } = boot();
    openAudio();
    expect(nav.navIntent(0, { down: true })).toBe(true);
    expect(document.activeElement?.id, '«next» did not move the panel\'s focus').toBe('a-voz');
    expect(nav.navIntent(0, { no: true })).toBe(true);
    expect($('#audio').hidden, '«back» did not close the panel').toBe(true);
  });

  it('🔴 [Right] on the player\'s open CARD, «next» moves the cursor and «confirm» presses the item, for that player', () => {
    const { nav, log } = boot();
    showPauses();
    expect(nav.navIntent(0, { down: true })).toBe(true);
    expect($('#sp0 .pm-sel')?.dataset.act, '«next» did not move the card\'s cursor').toBe('letra');
    let clicked = null;
    $('#sp0 [data-act="letra"]').addEventListener('click', () => { clicked = 'letra'; });
    expect(nav.navIntent(0, { yes: true })).toBe(true);
    expect(clicked, '«confirm» did not press the item under the cursor').toBe('letra');
    expect(log.actor, 'the item was pressed for nobody').toEqual([0]);
  });

  it('🔴 [Zero] with NO menu to move, nothing moves and the answer is «not taken»', () => {
    const { nav, log } = boot();
    setPhaseValue('playing'); // no card shown, no panel, and not navigable
    expect(nav.navIntent(0, { down: true })).toBe(false);
    expect(nav.navIntent(0, {}), 'an empty intent was taken').toBe(false);
    expect(log.bar).toEqual([]);
    expect(log.phase).toEqual([]);
  });

  it('🔴 [Boundary] a card shown while menus are NOT navigable is not moved — the key\'s guard, not a second rule', () => {
    const { nav } = boot();
    showPauses();
    setPhaseValue('playing');
    expect(nav.navIntent(0, { down: true })).toBe(false);
    expect($('#sp0 .pm-sel'), 'the step moved a card no key could move now').toBeNull();
  });

  it('🔴 [Boundary] a remap in progress owns the input: the step is not taken', () => {
    const { nav, log } = boot({ isCapturing: () => true, naBarra: new Set([0]) });
    expect(nav.navIntent(0, { down: true })).toBe(false);
    expect(log.bar).toEqual([]);
  });

  it('🔴 [Right] the controller-mapping panel on top takes only «back», which cancels it without saving', () => {
    const { nav, log } = boot();
    $('#padwiz').hidden = false;
    expect(nav.navIntent(0, { down: true }), 'a step under the mapping panel reached a menu beneath it').toBe(true);
    expect(log.padWiz).toEqual([]);
    expect(nav.navIntent(0, { no: true })).toBe(true);
    expect(log.padWiz, '«back» did not cancel the mapping').toEqual([false]);
  });
});

/*
 * ===================== WHAT A SIDEWAYS STEP WOULD DO — `underCursor` (ADR-0218 erratum; interface log, the sideways step) ====
 * One-button scanning offers «increase» and «decrease» only on a control they act on. The question is answered HERE, by the rule
 * the left and right keys follow, so the scan and the keys cannot disagree about which controls have a value.
 */
describe('underCursor — the kind of control a sideways step would reach', () => {
  it('🔴 [Right] in a panel: a button is an item, a list is a list, a slider is a value', () => {
    const { nav, openAudio } = boot();
    openAudio();
    $('#a-first').focus();
    expect(nav.underCursor(0)).toBe('item');
    $('#a-voz').focus();
    expect(nav.underCursor(0)).toBe('list');
    $('#a-vol').focus();
    expect(nav.underCursor(0)).toBe('value');
  });

  it('🔴 [Right] a ⯇ ⯈ steps control is a value (ADR-0151)', async () => {
    const { mountSteps } = await import('../app/js/ui/panel-widgets.js');
    const { nav, openAudio } = boot();
    openAudio();
    const passos = mountSteps({ find: (s) => $(s), create: (t) => document.createElement(t) },
      { label: 'Cantos', values: ['off', 'small', 'large'], current: 1 });
    $('#a-voz').after(passos);
    passos.focus();
    expect(nav.underCursor(0)).toBe('value');
  });

  it('🔴 [Boundary] with the focus OUTSIDE the panel it answers for the first item — where a step enters — and moves nothing', () => {
    const { nav, openAudio } = boot();
    openAudio();
    // the first item a step would enter by is a slider, so the answer can only come from where the step would land
    $('#a-vol').parentElement.prepend($('#a-vol'));
    document.activeElement.blur();
    expect(nav.underCursor(0), 'the answer is not the first item\'s').toBe('value');
    expect(document.activeElement, 'asking moved the cursor').toBe(document.body);
  });

  it('🔴 [Zero] the quick bar, a pause card, no menu, a remap and the mapping panel have nothing a sideways step adjusts', () => {
    let r = boot({ naBarra: new Set([0]) });
    r.openAudio(); $('#a-vol').focus();
    expect(r.nav.underCursor(0), 'on the quick bar').toBe('item');
    r = boot();
    showPauses();
    expect(r.nav.underCursor(0), 'on a pause card').toBe('item');
    r = boot();
    setPhaseValue('playing');
    expect(r.nav.underCursor(0), 'with no menu').toBe('item');
    r = boot({ isCapturing: () => true });
    r.openAudio(); $('#a-vol').focus();
    expect(r.nav.underCursor(0), 'during a remap').toBe('item');
    r = boot();
    r.openAudio(); $('#a-vol').focus();
    $('#padwiz').hidden = false;
    expect(r.nav.underCursor(0), 'under the controller-mapping panel').toBe('item');
  });

  it('🔴 [Right] and the scan\'s «increase» and «decrease» go the right and left keys\' way: the slider moves one step each', () => {
    const { nav, openAudio } = boot();
    openAudio();
    const vol = $('#a-vol');
    vol.focus();
    expect(nav.navIntent(0, { right: true })).toBe(true);
    expect(vol.value, '«increase» did not move the slider one step up').toBe('6');
    expect(nav.navIntent(0, { left: true })).toBe(true);
    expect(nav.navIntent(0, { left: true })).toBe(true);
    expect(vol.value, '«decrease» did not move it down').toBe('2');
    expect(document.activeElement, 'the step left the slider').toBe(vol);
  });
});

// MUTATIONS CHECKED (2026-09-26, `scratchpad/scan-doors/mutate.mjs`, restored and checked by SHA-256) on `navIntent`:
//   NI1 the bar not asked first (the card is moved under it)          🔴 «on the quick bar», and the two key cases of the bar (shared path)
//   NI2 no «navigable» guard (a card is moved that no key could move) 🔴 «with NO menu to move», and three key cases (shared path)
//   NI3 the remap guard removed                                       🔴 «a remap in progress»
//   NI4 the mapping panel's guard removed                             🔴 «the controller-mapping panel»
//   NI5 the answer always «taken»                                     🔴 «with NO menu to move», «a card shown while … NOT navigable»
// And (2026-09-26, `underCursor`, the sideways step) — `scratchpad/scan-rest/mutate.mjs`, same discipline:
//   P5 a slider taken for an item                         🔴 5 here (and the slider case of `one-button-only.browser`)
//   P6 the focus ignored (always the first item)          🔴 «in a panel», «a ⯇ ⯈ steps control is a value»
//   P7 no guards (only the panel on top asked)            🔴 «the quick bar, a pause card, no menu, a remap and the mapping panel»
//   P11 left/right on a button no longer walk the ring    🔴 «esquerda/direita num BOTÃO andam no anel»
