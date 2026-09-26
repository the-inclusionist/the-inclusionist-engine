// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-controls — render()/handleCaptureKeydown() (BROWSER project: uses document). Contract: DI by
// closure (ctx.$/srSay/srAlert/store/kb/setKB/kbFor/getNumPlayers/applyControls/assignControls), no access to globals
// outside the ctx. The pure logic (keyName/keyUsedByOther) is covered in settings-controls.node.test.js.
// Model: tests/a11y-sr.browser.test.js, tests/settings-typo.browser.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { initSettingsControls, drawKeys, ctrlControlId } from '../app/js/ui/settings-controls.js';
import { keyUsedByOther } from '../app/js/ui/control-choices.js';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)

const $ = (sel) => document.querySelector(sel);

// A test KB with 2 players (distinct schemes), like the real input/keyboard.ts (solo/p2/p3/p4).
function makeKB() {
  return {
    p2: [
      { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action1: ['KeyU'], action2: ['KeyJ'], action4: ['KeyI'], action3: ['KeyK'] },
      { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], action1: ['Numpad8'], action2: ['Numpad5'], action4: ['Numpad9'], action3: ['Numpad6'] },
    ],
  };
}

// The test ctx factory. `kb` is mutable in the closure (kbFor always reads the current value — the "setter" ctx.setKB
// swaps that reference, as a host reassigning its scheme would). said/alerted/applyCalls/store are exposed on the
// returned object for the tests to inspect the side effects.
function buildCtx(over = {}) {
  const said = [];
  const alerted = [];
  const applyCalls = { applyControls: 0, assignControls: 0 };
  let kb = makeKB();
  const store = {
    saved: [],
    saveKB(k) { this.saved.push(k); },
    reposicoes: 0,
    resetKB() { this.reposicoes++; return makeKB(); },
  };
  return {
    t: translate,
    $,
    // The positions THIS 'game' uses. In a test, the game is the fixture — and that is why the list lives here and not
    // in an engine table: that would be the engine deciding every game has four verbs.
    gameActions: () => [
      { action: 'left', label: 'Esquerda' }, { action: 'right', label: 'Direita' },
      { action: 'up', label: 'Subir' }, { action: 'down', label: 'Descer' },
      { action: 'action1', label: 'Correr' }, { action: 'action2', label: 'Pular' },
      { action: 'action4', label: 'Trocar' }, { action: 'action3', label: 'Especial' },
    ],
    srSay: (msg) => said.push(msg),
    srAlert: (msg) => alerted.push(msg),
    store,
    kb,
    kbFor: (i) => kb.p2[i] ?? kb.p2[0],
    // ⚠️ THIS SEAT'S FACTORY SCHEME, and it is INJECTED for the same reason as `kbFor`: the mapping «quantos jogadores →
    // que balde» (`p2`/`p3`/`p4`) belongs to the consumer, and duplicating it inside the engine would be a second copy
    // of a rule. The double uses the SAME `makeKB()` that seeds `kb`, which is what makes «igual ao padrão» mean here
    // what it means in the game.
    defaultSchemeFor: (i) => makeKB().p2[i] ?? makeKB().p2[0],
    getNumPlayers: () => 2,
    applyControls: () => { applyCalls.applyControls++; },
    assignControls: () => { applyCalls.assignControls++; },
    setKB: (next) => { kb = next; },
    said, alerted, applyCalls,
    ...over,
  };
}

describe('ui/settings-controls', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ctrl-players"></div><div id="ctrl-list"></div><button id="ctrl-reset"></button>';
  });

  it('[Zero] render() sem #ctrl-list no DOM não lança (só não desenha)', () => {
    document.body.innerHTML = '';
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    expect(() => api.render(0)).not.toThrow();
  });

  it('[Interface] render(0) preenche #ctrl-list com uma linha por ação e o hint de #ctrl-players', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const rows = $('#ctrl-list').querySelectorAll('.ctrl-row');
    expect(rows.length).toBe(8); // the 8 actions of ACT_LABEL
    expect($('#ctrl-players').innerHTML).toContain('2 jogadores');
    expect($('#ctrl-list').innerHTML).toContain('<kbd>A</kbd>'); // KeyA do jogador 0 -> "A"
  });

  it('🔴 [Boundary] uma posição INVENTADA não inicia captura — e o comentário já dizia porquê', () => {
    // The module writes it beside the guard: a capture started on an invented position would store a key under a name no
    // transport reads — the child would press the new key and nothing would happen. The value comes from a DOM
    // ATTRIBUTE, and the scheme accepts only the fourteen positions (#118).
    //
    // ⚠️ HONESTY ABOUT WHAT THIS CASE PINS, measured by a probe on 22/09: there are TWO guards on this path — `isAction`
    // and the lack of a WORD for an action the game does not declare — and deleting either alone still passes here. It
    // pins the BEHAVIOUR, not a specific guard; each guard alone has its own case in the block of the 23/09 probe, at the
    // end of this file.
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const falso = $('#ctrl-list').querySelector('button[data-act]');
    const rotuloAntes = falso.textContent;
    falso.dataset.act = 'action99';
    falso.click();
    expect(api.isCapturing(), 'a captura começou sobre uma posição que não existe').toBe(false);
    expect(ctx.alerted, 'nada foi anunciado: não há acção a mapear').toHaveLength(0);
    expect(falso.textContent, 'o botão não pode dizer «aperte» sem estar a capturar').toBe(rotuloAntes);
  });

  it('🔴 [Right] a linha «você edita o SEU controle» aparece — um painel que não diz de quem é confunde', () => {
    // Found by a probe on 22/09: keeping `#ctrl-players` hidden passed green. In a two-player game, whoever opens this
    // menu needs to know they are changing their own controller and not their mate's — without that the child remaps,
    // tests on the wrong controller and concludes the menu does not work.
    const ctx = buildCtx();
    initSettingsControls(ctx).render(0);
    const linha = $('#ctrl-players');
    expect(linha.hidden, 'a linha existe no documento mas ninguém a vê').toBe(false);
    expect(linha.textContent).toContain('2 jogadores');
  });

  it('[Right] ⚠️ a PALAVRA DO JOGO entra por texto, nunca por markup (issue #106)', () => {
    // `gameActions()` returns the PRESET's labels — this game's words —, and a game lives in another repository and
    // consumes the engine as a package (ADR-0083). This tree does not review that text.
    //
    // ⚠️ AND THE ASYMMETRY WITH `data-act` IS THE PROOF THAT ADR-0086'S SEPARATION IS GOOD FOR SOMETHING: the ABSTRACT
    // name (`action2`) belongs to the engine, enumerated in `core/actions`, and still goes into the attribute safely; the
    // WORD (`Pular`) belongs to the game, and it is what has to stay out of the markup.
    // ⚠️ THE PAYLOAD ESCAPES THE CONTAINER, and the choice cost two surviving mutations to get right.
    //
    // An `<img onerror>` does not work here: `onerror` is ASYNCHRONOUS and the case ends before it fires. And checking the
    // final DOM does not work either — restoring the interpolation and leaving `textContent` on top produces the SAME
    // DOM, even though `innerHTML` has already parsed the markup on the way.
    //
    // What discriminates is what an attacker actually does: CLOSE the tags and get out. The injected element lands
    // OUTSIDE `.ctrl-nome`, so no later `textContent` erases it — and it stays visible to the case.
    const ctx = buildCtx();
    const FUGA = '</b></span></div><i id="fugiu-do-jogo"></i>';
    ctx.gameActions = () => [{ action: 'action2', label: FUGA }];
    initSettingsControls(ctx).render(0);

    const lista = $('#ctrl-list');
    expect(lista.querySelector('#fugiu-do-jogo'), 'a palavra do jogo foi ANALISADA como marcação').toBe(null);
    expect(lista.querySelector('.ctrl-row strong').textContent).toBe(FUGA);
    expect(lista.querySelector('button[data-act]').dataset.act).toBe('action2'); // the abstract name stays
  });

  it('[Interface] render(0) x render(1) mostram os esquemas de cada jogador (não compartilham)', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(1);
    expect($('#ctrl-list').innerHTML).toContain('←'); // ArrowLeft do jogador 1
  });

  it('[Right] clicar em "Alterar" inicia a captura: isCapturing()=true, texto vira "Pressione…" e srAlert soa', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const btn = $('#ctrl-list').querySelector('button[data-act="action2"]');
    btn.click();
    expect(api.isCapturing()).toBe(true);
    expect(btn.textContent).toBe('Pressione…');
    expect(ctx.alerted).toEqual(['Pressione a nova tecla para Pular do Jogador 1, ou Esc para cancelar.']);
  });

  it('[Right] handleCaptureKeydown com Escape cancela a captura e re-renderiza', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    const e = { code: 'Escape', preventDefault: () => {} };
    const consumed = api.handleCaptureKeydown(e);
    expect(consumed).toBe(true);
    expect(api.isCapturing()).toBe(false);
    // 📌 The button's face is the CURRENT KEY again, not the word «Alterar» — the Dev's decision on 22/09, choosing
    // option B: the value lives inside the control, as in the steps. Player 0's `action2` is `KeyJ`.
    expect($('#ctrl-list').querySelector('button[data-act="action2"]').textContent).toBe('J');
  });

  it('[Right] handleCaptureKeydown com tecla livre associa, persiste e propaga', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    const e = { code: 'KeyP', preventDefault: () => {} };
    const consumed = api.handleCaptureKeydown(e);
    expect(consumed).toBe(true);
    expect(api.isCapturing()).toBe(false);
    expect(ctx.kbFor(0).action2).toEqual(['KeyP']);
    expect(ctx.store.saved).toHaveLength(1);
    expect(ctx.applyCalls.applyControls).toBe(1);
    expect(ctx.applyCalls.assignControls).toBe(1);
    // 🎯 AND THE NEW KEY SHOWS ON THE BUTTON WITH NOTHING ELSE HAPPENING: its face IS the value, so a remap shows in the
    // same place where it is made, with no need to read the row beside it to know whether it took.
    expect($('#ctrl-list').querySelector('button[data-act="action2"]').innerHTML).toBe('<kbd>P</kbd>');
  });

  it('🔴 [Many] a cara do botão é REESCRITA, não acrescentada — duas teclas não viram quatro', () => {
    // `drawKeys` is called on every render and every capture. If it appended instead of rewriting, the button would pile
    // up the keys of every time the child opened the menu — and the target would grow until it broke the row.
    const b = document.createElement('button');
    drawKeys(translate, b, ['KeyA', 'ArrowLeft']);
    expect([...b.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['A', '←']);
    drawKeys(translate, b, ['KeyP']);
    expect([...b.querySelectorAll('kbd')].map((k) => k.textContent), 'as teclas antigas ficaram').toEqual(['P']);
  });

  it('[Right] o id de um botão sai do nome ABSTRATO da posição, e é o mesmo que a lista usa', () => {
    const ctx = buildCtx();
    initSettingsControls(ctx).render(0);
    expect(ctrlControlId('action2')).toBe('ctrl-act-action2');
    expect($('#ctrl-list').querySelector(`#${ctrlControlId('action2')}`).dataset.act).toBe('action2');
  });

  it('🔴 [Zero] uma posição SEM tecla mostra a palavra — um botão sem cara é um alvo que não diz nada', () => {
    // The button's face is the current key; with none, it would be 44 px of nothing. That is where «Alterar» comes back,
    // where the word still means something: there is no key to show, there is one to set.
    const ctx = buildCtx();
    ctx.kbFor = () => ({ action2: [] });
    ctx.gameActions = () => [{ action: 'action2', label: 'Pular' }];
    initSettingsControls(ctx).render(0);
    const b = $('#ctrl-list').querySelector('button[data-act="action2"]');
    expect(b.textContent).toBe('Alterar');
    expect(b.querySelector('kbd'), 'sem tecla não há caixinha para desenhar').toBeNull();
  });

  it('🔴 [Right] o nome acessível diz A ACÇÃO E O JOGADOR — e não só a palavra do jogo', () => {
    // 🔴 A HOLE THE CONVERSION CREATED, found by a probe on 22/09: without `ariaLabel`, the kit falls back on `label`, and
    // the button announces itself «Pular» — plausible and wrong. Whoever listens no longer knows it CHANGES the key, and
    // with two players no longer knows WHOSE. Worse than before the conversion, when the attribute was written by hand,
    // and the same family as #125: a wrong `aria-label` OVERRIDES the visible text.
    const ctx = buildCtx();
    initSettingsControls(ctx).render(1);
    const b = $('#ctrl-list').querySelector('button[data-act="action2"]');
    expect(b.getAttribute('aria-label')).toBe('Alterar tecla de Pular do Jogador 2');
    expect(b.getAttribute('aria-label'), 'o rótulo nu não diz o que o botão faz').not.toBe('Pular');
  });

  it('🔴 [Zero] cada botão tem um id PRÓPRIO — dois nós com o mesmo id é um documento inválido', () => {
    // Found by a probe: replacing the id with a constant passed green, leaving eight nodes with `id="ctrl-act"`.
    // The id comes from the position's ABSTRACT name, which `core/actions` guarantees unique.
    const ctx = buildCtx();
    initSettingsControls(ctx).render(0);
    const ids = [...$('#ctrl-list').querySelectorAll('button[data-act]')].map((b) => b.id);
    expect(ids.filter(Boolean), 'algum botão ficou sem id').toHaveLength(ids.length);
    expect(new Set(ids).size, 'dois botões partilham o mesmo id').toBe(ids.length);
  });

  it('🔴 [Right] o `fillExplain` não come a linha — o `<span>` traz o nome e mais nada', () => {
    // 📏 The collision that decided this row's shape, measured in a probe on 22/09: with the keys INSIDE the `<span>`,
    // `fillExplain` does `span.innerHTML = strong.outerHTML` and of the two `<kbd>` ZERO survive — the remapping panel
    // would stop showing what is mapped. With the value in the CONTROL, the description it computes is empty and the row
    // stays intact. This case is what stops the value from going back into the `<span>`.
    const ctx = buildCtx();
    initSettingsControls(ctx).render(0);
    for (const linha of $('#ctrl-list').querySelectorAll('.ctrl-row')) {
      const span = linha.querySelector(':scope > span');
      expect(span.querySelectorAll('kbd'), 'a tecla voltou para dentro do rótulo').toHaveLength(0);
      expect(span.textContent, 'o span traz o nome e mais nada').toBe(span.querySelector('strong').textContent);
    }
  });

  it('[Boundary] handleCaptureKeydown com tecla já usada por OUTRO jogador alerta e mantém a captura', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0); // editando o jogador 0
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    const e = { code: 'ArrowLeft', preventDefault: () => {} }; // it belongs to player 1 (index 1)
    const consumed = api.handleCaptureKeydown(e);
    expect(consumed).toBe(true);
    expect(api.isCapturing()).toBe(true); // segue capturando
    expect(ctx.kbFor(0).action2).toEqual(['KeyJ']); // unchanged
    expect(ctx.alerted.at(-1)).toBe('Essa tecla já é do Jogador 2. Escolha outra, ou Esc para cancelar.');
    expect(ctx.store.saved).toHaveLength(0);
  });

  it('🔴 [Boundary] NENHUM nome abstracto chega à criança — nem quando a tecla está numa posição sem palavra', () => {
    // 🔴 ADR-0074'S SHARPEST RULE, and it never had a gate: «o nome que a CRIANÇA lê e ouve — na tela de
    // remapeamento, na bolha de toque, no anúncio — é sempre a palavra do jogo, nunca `action1`. Um nome
    // abstracto que chega a uma pessoa é um defeito.»
    //
    // ⚠️ AND IT WAS ONE PRESS AWAY, with the engine's own DEFAULT scheme. It binds EIGHT positions
    // (`left/right/up/down` + `action1..action4`); a quiz names three. The child opens the screen — which only shows the
    // three named rows —, picks «Confirmar», and presses a key the default has on `action2`. `actionAlreadyBound` looks
    // in the SCHEME and not in the game's list, so it returned a position with no word, and the screen reader said
    // «Essa tecla já é de action2» — to the blind child, who is whom the rule protects.
    //
    // 📌 `core/actions.labellerFrom` had already decided the right way out — return `null` and let the caller handle the
    // absence — and this file had decided another. Two answers to the same question, and one contradicted an accepted ADR.
    const ctx = buildCtx({
      gameActions: () => [
        { action: 'up', label: 'Subir' }, { action: 'down', label: 'Descer' },
        { action: 'action1', label: 'Confirmar' },
      ],
    });
    const api = initSettingsControls(ctx);
    api.render(0);
    const tomada = ctx.kbFor(0).action2[0]; // the key the default scheme already gave to a position with NO word
    $('#ctrl-list').querySelector('button[data-act="action1"]').click();
    const consumed = api.handleCaptureKeydown({ code: tomada, preventDefault: () => {} });

    expect(consumed).toBe(true);
    expect(api.isCapturing(), 'recusar tem de manter a captura, senão a criança perde o passo').toBe(true);
    const dito = ctx.alerted.at(-1);
    expect(dito, 'o anúncio tem de existir — recusar em silêncio é o defeito gémeo').toBeTruthy();
    expect(dito, 'nome abstracto de posição falado a uma criança (ADR-0074)').not.toMatch(/action[1-8]|leftShoulder|rightShoulder|leftTrigger|rightTrigger/);
  });

  it('[Right] e quando o jogo NOMEIA a posição, o anúncio diz a palavra dele', () => {
    // The other side of the same pair: without this case, silencing the announcement entirely would pass the case above.
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const tomada = ctx.kbFor(0).action2[0];
    $('#ctrl-list').querySelector('button[data-act="action1"]').click();
    api.handleCaptureKeydown({ code: tomada, preventDefault: () => {} });
    expect(ctx.alerted.at(-1)).toContain('Pular'); // the word THIS game gives `action2`
  });

  // ===================== THE «SAIU DO PADRÃO» MARK IN REMAPPING (ADR-0029 · #61) =====================
  // ⚠️ A remapped key IS «saiu do padrão» — and this is the menu the child has most likely changed, because it is the
  // only one whose reason to exist is changing things. Without the mark she walks the menu, hears the names of the
  // actions, and nothing tells her where she herself made a change.
  const linhaDe = (act) => $(`#ctrl-list button[data-act="${act}"]`)?.closest('.ctrl-row') ?? null;
  const marcada = (el) => !!el && el.classList.contains('is-changed');

  it('🎯 [Zero] com o esquema de FÁBRICA, nada fica marcado', () => {
    const ctx = buildCtx();
    initSettingsControls(ctx).render(0);
    for (const a of ['action1', 'action2', 'left']) expect(marcada(linhaDe(a)), `${a} marcado sem ter mudado`).toBe(false);
    // 📌 The mark of the BUTTON that opens this screen is not from here: `ui/settings-mobility` draws `#map-hub`, and
    // marking it from two places would be a second answer to the same question. Here the ROWS are marked.
  });

  it('🎯 [Right] só a acção REMAPEADA fica marcada', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    api.handleCaptureKeydown({ code: 'KeyP', preventDefault: () => {} });
    expect(marcada(linhaDe('action2')), 'a acção remapeada não foi marcada').toBe(true);
    expect(marcada(linhaDe('action1')), 'marcou uma acção que ninguém tocou').toBe(false);
  });

  it('🎯 [Right] a marca é a do jogador ABERTO — o remapeamento do Jogador 2 marca-se no controle dele', () => {
    // Found by the cut's re-probe (23/09): every mark case drew Player 1, so comparing another seat's scheme passed.
    // Player 2 remapped and their list did not say where.
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(1);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    api.handleCaptureKeydown({ code: 'KeyP', preventDefault: () => {} });
    expect(marcada(linhaDe('action2')), 'o remapeamento do Jogador 2 não foi marcado na lista dele').toBe(true);
    api.render(0);
    expect(marcada(linhaDe('action2')), 'a marca do Jogador 2 apareceu no controle do Jogador 1').toBe(false);
  });

  it('⚠️ [Boundary] a MESMA tecla do padrão, reatribuída, NÃO é uma mudança', () => {
    // The case that separates «mexeu» from «mexeu e voltou». A comparison by object identity, or a flag raised on the
    // click, would say it changed — and the child would hear «alterado» about the factory key.
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const original = ctx.kbFor(0).action2[0];
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    api.handleCaptureKeydown({ code: original, preventDefault: () => {} });
    expect(marcada(linhaDe('action2')), 'reatribuir a MESMA tecla contou como mudança').toBe(false);
  });

  it('⚠️ [Boundary] perder a tecla ALTERNATIVA é uma mudança, mesmo mantendo a primeira', () => {
    // ⚠️ A CASE FOUND BY A SURVIVING MUTATION, and the scenario is real: the factory scheme has actions with TWO keys
    // (`input/keyboard.ts` gives `action3: ['Semicolon','Slash']`), and remapping always writes ONE (`mapRef[act] =
    // [e.code]`). A child remapping to the FIRST of the two is left with `['Semicolon']` where the factory had
    // `['Semicolon','Slash']`.
    //
    // 🎯 Without the LENGTH check, `every` walks only the short array, answers `true`, and the mark does not light — she
    // lost the alternative key and nothing tells her. `every` alone compares prefixes, not lists.
    const ctx = buildCtx();
    const comDuas = { ...ctx.kbFor(0), action3: ['Semicolon', 'Slash'] };
    ctx.defaultSchemeFor = () => comDuas;
    ctx.kbFor = () => ({ ...comDuas, action3: ['Semicolon'] });
    initSettingsControls(ctx).render(0);
    expect(marcada(linhaDe('action3')), 'perdeu a tecla alternativa e não foi marcado').toBe(true);
    expect(marcada(linhaDe('action1')), 'marcou uma acção intacta').toBe(false);
  });

  it('⚠️ [Zero] ler o padrão NÃO apaga as teclas guardadas', () => {
    // 🎯 The trap this case closes: `input/keyboard.resetKB()` looks like a reader of the factory scheme and is
    // DESTRUCTIVE — it does `store.remove(CKEY)` before returning the copy. Using it to draw the mark would erase the
    // child's remapping on every render, and the defect would only show at the next boot.
    const ctx = buildCtx();
    initSettingsControls(ctx).render(0);
    expect(ctx.store.saved, 'desenhar a marca gravou por cima do esquema').toHaveLength(0);
    expect(ctx.store.reposicoes ?? 0, 'desenhar a marca chamou `resetKB`').toBe(0);
  });

  it('[Zero] handleCaptureKeydown sem captura em andamento retorna false e não toca no DOM', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const html = $('#ctrl-list').innerHTML;
    expect(api.handleCaptureKeydown({ code: 'KeyP', preventDefault: () => {} })).toBe(false);
    expect($('#ctrl-list').innerHTML).toBe(html);
  });

  it('[Interface] cancelCapture() encerra a captura sem re-renderizar (fechamento do diálogo)', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    expect(api.isCapturing()).toBe(true);
    api.cancelCapture();
    expect(api.isCapturing()).toBe(false);
  });

  it('[Right] clicar em #ctrl-reset restaura os padrões, propaga, re-renderiza e anuncia', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    // moves player 0's scheme away from the default, as if it had been remapped before
    ctx.kbFor(0).jump = ['KeyZ'];
    api.render(0);
    $('#ctrl-reset').click();
    expect(ctx.kbFor(0).action2).toEqual(['KeyJ']); // setKB swapped the whole KB for the default
    expect(ctx.applyCalls.applyControls).toBe(1);
    expect(ctx.applyCalls.assignControls).toBe(1);
    expect(ctx.said).toEqual(['Controles restaurados ao padrão.']);
    expect($('#ctrl-list').innerHTML).toContain('<kbd>J</kbd>'); // back to the default (KeyJ)
  });

  it('[Cross-check] setKB injetado recebe exatamente o retorno de store.resetKB()', () => {
    const received = [];
    const ctx = buildCtx({ setKB: (next) => received.push(next) });
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-reset').click();
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(makeKB());
  });

  it('[Error] captureMapRef aponta pro objeto do jogador certo mesmo após um render de outro jogador antes', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(1); // edita jogador 1 primeiro
    api.render(0); // depois troca p/ jogador 0
    $('#ctrl-list').querySelector('button[data-act="left"]').click();
    api.handleCaptureKeydown({ code: 'KeyQ', preventDefault: () => {} });
    expect(ctx.kbFor(0).left).toEqual(['KeyQ']);
    expect(ctx.kbFor(1).left).toEqual(['ArrowLeft']); // jogador 1 intocado
  });
});

// ==========================================================================================================
// ⚠️ THE SAME KEY ON TWO ACTIONS OF THE SAME SCHEME (#126) — AND THE DEFECT ONLY EXISTS WITH ONE PLAYER
//
// Measured while building `game-soccer`, the first consumer to use the fourteen positions. The remapping screen
// guarded with `keyUsedByOther(code, mapRef, schemes)`, which excludes the scheme being edited **by reference**. With
// one player, `schemesFor()` returns exactly that scheme — the guard sweeps an empty list and CAN NEVER FIRE.
//
// ⚠️ The guard between PLAYERS was not broken: it was UNREACHABLE. With two seats it refuses correctly, and the cases
// below assert both things side by side, because that distinction is what delayed the diagnosis.
//
// ⚠️ AND THE SHAPE OF THE DEFECT IS THE WORST THIS PRODUCT HAS. The header of `input/default-bindings` describes it: the
// two actions fire together, and the child sees an intermittent double action nobody can reproduce on purpose. On a
// screen she opened BECAUSE she could not use the default controls.
//
// MUTATIONS CHECKED (at the end of the file).
// ==========================================================================================================
describe('ui/settings-controls — uma tecla, uma ação, dentro do mesmo esquema (#126)', () => {
  const UM_JOGADOR = { p2: [{ left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action1: ['KeyU'], action2: ['KeyJ'], action4: ['KeyI'], action3: ['KeyK'] }] };

  function soloCtx(over = {}) {
    let kb = JSON.parse(JSON.stringify(UM_JOGADOR));
    return buildCtx({ kb, kbFor: () => kb.p2[0], getNumPlayers: () => 1, setKB: (n) => { kb = n; }, ...over });
  }

  beforeEach(() => {
    document.body.innerHTML = '<div id="ctrl-players"></div><div id="ctrl-list"></div><button id="ctrl-reset"></button>';
  });

  it('⚠️ [Cross-check] com UM jogador a guarda antiga é cega — sem isto, nada abaixo prova o defeito', () => {
    // `KeyW` is on `up` of the only scheme. `keyUsedByOther` answers -1, because it excludes that scheme by reference and
    // no other is left. It is the defect in one line.
    const ctx = soloCtx();
    expect(keyUsedByOther('KeyW', ctx.kbFor(0), [ctx.kbFor(0)]),
      'a guarda entre jogadores viu a tecla; entao o defeito e outro').toBe(-1);
  });

  it('⚠️ [Right] remapear para uma tecla que JA e de outra acao e RECUSADO, e o anuncio diz qual', () => {
    const ctx = soloCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    ctx.alerted.length = 0;
    const consumed = api.handleCaptureKeydown({ code: 'KeyW', preventDefault: () => {} });
    expect(consumed).toBe(true);
    expect(api.isCapturing(), 'associou e fechou a captura').toBe(true);
    expect(ctx.kbFor(0).action2, 'a tecla foi presa a duas acoes').toEqual(['KeyJ']);
    expect(ctx.kbFor(0).up, 'a acao antiga perdeu a tecla').toEqual(['KeyW']);
    expect(ctx.alerted, 'anunciou mais do que uma coisa').toHaveLength(1);
    expect(ctx.alerted[0], 'o anuncio nao nomeia a acao que ja tem a tecla').toContain('Subir');
    expect(ctx.alerted[0], 'nao e a frase de conflito').toContain('Escolha outra');
  });

  it('⚠️ [Interface] o nome vem do JOGO, nao da tabela do jogo de plataforma (#125)', () => {
    // `ACT_LABEL` says «Subir» because it is THAT game's word. A game that calls the position something else has to hear
    // its own word — and this case is what stops the shortcut from coming back.
    const ctx = soloCtx({ gameActions: () => [{ action: 'up', label: 'Cabecear' }, { action: 'action2', label: 'Chutar' }] });
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    ctx.alerted.length = 0;
    api.handleCaptureKeydown({ code: 'KeyW', preventDefault: () => {} });
    expect(ctx.alerted[0]).toContain('Cabecear');
  });

  it('[Boundary] reapertar a tecla que a PROPRIA acao ja tem nao e conflito', () => {
    // It is already its own. Refusing here would be the screen saying «essa tecla e sua» to whoever was confirming it.
    const ctx = soloCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    api.handleCaptureKeydown({ code: 'KeyJ', preventDefault: () => {} });
    expect(api.isCapturing(), 'recusou a propria tecla da acao').toBe(false);
    expect(ctx.kbFor(0).action2).toEqual(['KeyJ']);
  });

  it('[Right] uma tecla LIVRE continua a ser aceite — a guarda nova nao fecha a tela', () => {
    const ctx = soloCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    api.handleCaptureKeydown({ code: 'KeyP', preventDefault: () => {} });
    expect(api.isCapturing()).toBe(false);
    expect(ctx.kbFor(0).action2).toEqual(['KeyP']);
  });

  it('⚠️ [Interface] com DOIS assentos a guarda antiga continua a valer, e diz o JOGADOR', () => {
    // The regression I could introduce: making the new check eat the old one. The messages differ on purpose —
    // «e de outra crianca» and «e de outra acao tua» are not solved the same way.
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    ctx.alerted.length = 0;
    api.handleCaptureKeydown({ code: 'ArrowLeft', preventDefault: () => {} });
    expect(api.isCapturing()).toBe(true);
    expect(ctx.alerted[0]).toContain('Jogador 2');
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · removing the `const aqui = actionAlreadyBound(...)` block from `handleCaptureKeydown` → TWO cases fail:
//     `[Right] remapear para uma tecla que JA e de outra acao` (the capture closes and `KeyW` ends up on `action2` AND
//     on `up`) and `[Interface] o nome vem do JOGO`. It is #126's defect reproduced.
//   · replacing the `if (a === exceto) continue;` of `actionAlreadyBound` with nothing → "[Boundary] reapertar a tecla
//     que a PROPRIA acao ja tem" fails: the screen refuses the key to whoever already had it.
//   · replacing `ctx.acoesDoJogo()...rotulo` with `t(ACT_LABEL[aqui])` → `[Interface] o nome vem do JOGO`
//     fails, which is #125 not coming back in through this door.
//
// ⚠️ AND ONE THING THAT IS NOT A CHECKED MUTATION, said so it does not pass for one: the ORDER between the two guards is
// not checked. I would expect swapping them to change nothing — they look at disjoint sets —, but I did not run that
// mutation, and an expectation is not a measurement. It stays as a known hole: if one day a key can be in two schemes
// at the same time, the order decides WHICH of the two sentences the child hears, and then it deserves its own case.

// ==========================================================================================================
// ⚠️ THE `aria-label` SAYS THE GAME'S WORD, OR IT LIES TO WHOEVER CANNOT SEE (#125)
//
// Measured while building `game-soccer`: the screen announced **«Alterar tecla de undefined do Jogador 1» on six of
// twelve buttons**, while a sighted child read «Conter» on the same row. On the other six it said the words of the
// PLATFORM game.
//
// The cause: the VISIBLE label came from the game (#106) while the `aria-label` was still built from `ACT_LABEL`, this
// file's table of eight positions. ⚠️ And an `aria-label` OVERRIDES the visible text, so whoever depends on the screen
// reader heard the wrong word — worse than having no `aria-label` at all, and invisible from inside the engine, because
// the platform game is the only consumer for which the table is right.
//
// ⚠️ The `undefined` came from the SIX positions `ACT_LABEL` does not have: it knows eight, and the vocabulary closed on
// fourteen (#118). `t(undefined)` returns the key, and the frame interpolates it as text.
//
// MUTATIONS CHECKED (at the end of the block).
// ==========================================================================================================
describe('ui/settings-controls — o que o leitor de tela ouve e a palavra DESTE jogo (#125)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ctrl-players"></div><div id="ctrl-list"></div><button id="ctrl-reset"></button>';
  });

  it('⚠️ [Right] o aria-label de cada botao usa o rotulo do jogo, nao a tabela da engine', () => {
    const ctx = buildCtx({ gameActions: () => [{ action: 'up', label: 'Cabecear' }, { action: 'action2', label: 'Chutar' }] });
    initSettingsControls(ctx).render(0);
    const rotulos = [...$('#ctrl-list').querySelectorAll('button[data-act]')].map((b) => b.getAttribute('aria-label'));
    expect(rotulos).toHaveLength(2);
    expect(rotulos[0]).toContain('Cabecear');
    expect(rotulos[1]).toContain('Chutar');
  });

  it('⚠️ [Zero] NENHUM aria-label da tela contem "undefined"', () => {
    // The case that would have caught #125 on the day. The fourteen positions, of which `ACT_LABEL` knew only eight.
    const TODAS = ['left', 'right', 'up', 'down', 'action1', 'action2', 'action3', 'action4',
      'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger', 'start', 'select'];
    const ctx = buildCtx({ gameActions: () => TODAS.map((a) => ({ action: a, label: 'W' + a })) });
    initSettingsControls(ctx).render(0);
    const maus = [...$('#ctrl-list').querySelectorAll('button[data-act]')]
      .map((b) => b.getAttribute('aria-label') ?? '')
      .filter((s) => s.includes('undefined') || s.trim() === '');
    expect(maus, 'aria-label sem palavra: a crianca ouve isto em vez do nome da acao').toEqual([]);
  });

  it('⚠️ [Interface] o rotulo do jogo entra por API do DOM, e nao por interpolacao em markup', () => {
    // The label is text from OUTSIDE. If it went into the `aria-label` template, a preset could close the attribute and
    // open another. The case passes a quote and an `<img>` and requires that none of it becomes markup.
    const VENENO = '" onmouseover="alert(1)" x="<img src=x onerror=alert(1)>';
    const ctx = buildCtx({ gameActions: () => [{ action: 'up', label: VENENO }] });
    initSettingsControls(ctx).render(0);
    const lista = $('#ctrl-list');
    expect(lista.querySelector('img'), 'o rotulo foi ANALISADO como marcacao').toBe(null);
    const b = lista.querySelector('button[data-act]');
    expect(b.getAttribute('onmouseover'), 'o rotulo abriu um atributo novo').toBe(null);
    expect(b.getAttribute('aria-label')).toContain('onmouseover');
  });

  it('⚠️ [Right] a frase de captura e a do modo passam por t(), sem portugues cravado', () => {
    // Two sentences could be raw Portuguese inside the engine: the button's text while capturing, and the whole
    // `#ctrl-players` line. Both against pillar 3, on the screen the child opens BECAUSE she cannot play.
    // The fixture's `kbFor` already falls back to `p2[0]`, so a single player needs nothing more.
    const ctx = buildCtx({ getNumPlayers: () => 1 });
    const api = initSettingsControls(ctx);
    api.render(0);
    expect($('#ctrl-players').textContent, 'a linha do modo nao foi montada').toContain('1 jogador');
    expect($('#ctrl-players').querySelector('strong'), 'o realce do modo desapareceu').not.toBe(null);
    const btn = $('#ctrl-list').querySelector('button[data-act]');
    btn.click();
    expect(btn.textContent).toBe('Pressione…');
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · giving the `aria-label` back to the template with `t(ACT_LABEL[a]!)` → THREE cases fail: "[Zero] NENHUM
//     aria-label contem undefined" (with the six positions `ACT_LABEL` does not know), "[Right] o aria-label usa o
//     rotulo do jogo" and also the `[Interface]` one — because the template interpolates again. It is #125 reproduced,
//     with the same number the audit measured.
//   · putting the label inside the template (`aria-label="${rotulo}"`) instead of `setAttribute` → "[Interface] o
//     rotulo entra por API do DOM" fails with the `<img>` mounted and the `onmouseover` on the button.
//   · replacing `t('ctrl.pressing')` with a hard-coded `'Pressione…'` again → NO case fails, because the hard-coded
//     Portuguese and the pt translation are the SAME string. ⚠️ Recorded as a mutation that does not fail: what catches
//     it is the `engine-i18n` prose gate, and only because the sentence has an accent. A case pinning it would have to
//     switch language at test time, and `setLocale` is not wired in this file.
//
// --- 2026-09-08 · the abstract name that reached a child (ADR-0074) ---
//   · 🔴 `palavraDaAcao` falling back to `?? a` — THE DEFECT RESTORED, not an invented mutation: it was the code that was
//     here, defended by a comment. It fails the new case, and only it. The whole rest of the file stays green with it
//     applied, which is the measure of how much this went unseen.
//   · the inverted branch (`ctx.srAlert(!palavra`) → THREE fail: whoever has a word hears the generic sentence and
//     whoever has none hears the id. It is the pair of cases working as a pair — one alone would not catch the inversion.
//   · the generic sentence becoming EMPTY → fails the new case through the `toBeTruthy` assertion. Refusing in silence
//     is the TWIN defect of saying `action2`, and without that line the gate would reward silencing the announcement.
//   · `if (!palavra) return;` at the start of the capture was declared UNREACHABLE here, and it is not: the value comes
//     from a DOM ATTRIBUTE, and the invented-position case already edits it. A VALID position the game does not name
//     reaches it by the same path — its own case is in the block below.

// ============================== what the 23/09 probe found blind in `render` ==============================
// `scratchpad/sonda-ctrl.py`: twenty-two decisions of `render` and of the click switched off one by one, and ELEVEN
// stayed green. The cases below pin nine. The other two are declared at the end of the block.
describe('ui/settings-controls — o que a sonda achou sem caso (23/09)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ctrl-players"></div><div id="ctrl-list"></div><button id="ctrl-reset"></button>';
  });

  it('🔴 [Boundary] um jogador que ja nao existe volta ao PRIMEIRO — nunca um controle que ninguem segura', () => {
    // The panel remembers the last player opened; if the game goes from four seats to two, that number is out of range.
    // Without the fallback, the list and the accessible name would talk about a Player 6 who is not playing.
    const ctx = buildCtx();
    initSettingsControls(ctx).render(5);
    expect($('#ctrl-list').innerHTML).toContain('<kbd>A</kbd>');
    const botao = $('#ctrl-list').querySelector('button[data-act]');
    expect(botao.getAttribute('aria-label')).toContain('Jogador 1');
  });

  it('🔴 [Right] a linha «editando o seu controle» deixa de estar ESCONDIDA quando a lista se desenha', () => {
    // The sibling case above starts from a row already visible, so deleting `hidden = false` passed. A page that
    // brings it hidden until the panel opens is the case the code exists to serve.
    document.body.innerHTML = '<div id="ctrl-players" hidden></div><div id="ctrl-list"></div>';
    initSettingsControls(buildCtx()).render(0);
    expect($('#ctrl-players').hidden).toBe(false);
  });

  it('🔴 [Right] a frase do modo diz-se INTEIRA — antes, o modo e depois — e com um jogador diz «1 jogador»', () => {
    // The sentence is split at the `{modo}` marker so the mode goes in a `<strong>` without the dictionary carrying
    // markup. No case read the whole sentence, so each piece could vanish; and «1 jogadores» contains «1 jogador».
    initSettingsControls(buildCtx({ getNumPlayers: () => 1 })).render(0);
    expect($('#ctrl-players').textContent).toBe('Editando o seu controle — modo 1 jogador.');
    initSettingsControls(buildCtx()).render(0);
    expect($('#ctrl-players').textContent).toBe('Editando o seu controle — modo 2 jogadores.');
  });

  it('🔴 [Boundary] uma posicao que o JOGO declara mas o esquema nao conhece nao inicia captura', () => {
    // The other side of the invented-position case: here the position has a WORD, so the only guard on the path is
    // `isAction`. Without it, the new key would be stored under a name no transport reads.
    const ctx = buildCtx();
    ctx.gameActions = () => [{ action: 'action99', label: 'Voar' }];
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action99"]').click();
    expect(api.isCapturing(), 'a captura comecou sobre uma posicao fora do esquema').toBe(false);
    expect(ctx.alerted).toHaveLength(0);
  });

  it('🔴 [Boundary] uma posicao VALIDA que o jogo nao nomeia nao inicia captura — sem palavra, nao se pergunta', () => {
    // It is `labellerFrom`'s rule where it is visible: a request with no subject would be «Pressione a nova tecla para
    // undefined». This is reached by the same path as the invented-position case — a DOM attribute.
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const botao = $('#ctrl-list').querySelector('button[data-act]');
    botao.dataset.act = 'leftShoulder';
    botao.click();
    expect(api.isCapturing(), 'a captura comecou sobre uma posicao que o jogo nao nomeia').toBe(false);
    expect(ctx.alerted).toHaveLength(0);
  });

  it('🔴 [Right] a prosa volta ao rodape do cartao QUE TEM a lista, a cada desenho (CLAUDE.md §4, #109)', () => {
    document.body.innerHTML = '<div class="overlay__card" id="cartao"><div id="ctrl-players"></div><div id="ctrl-list"></div></div>';
    const chamados = [];
    const api = initSettingsControls(buildCtx({ fillExplain: (card) => chamados.push(card) }));
    api.render(0);
    api.render(1);
    // by IDENTITY: `toEqual` compares DOM nodes with `isEqualNode`, and a copy of the card passes it
    expect(chamados).toHaveLength(2);
    for (const c of chamados) expect(c, 'the prose went to a card that is not the one with the list').toBe($('#cartao'));
  });

  it('🔴 [Right] cancelar a captura redesenha o jogador que estava ABERTO, e nao o primeiro', () => {
    // Whoever remaps Player 2 and gives up with Esc has to keep seeing their keys.
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(1);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    api.handleCaptureKeydown({ code: 'Escape', preventDefault() {} });
    expect($('#ctrl-list').innerHTML).toContain('←');
    expect($('#ctrl-list').querySelector('button[data-act]').getAttribute('aria-label')).toContain('Jogador 2');
  });

  // DECLARED, not pinned:
  //   · the `isAction` of the loop that marks «saiu do padrao» is EQUIVALENT: a position outside the scheme has no key
  //     in the current scheme nor in the factory one, so it compares equal and is not marked either way.
  //   · the capture carries no player: it writes into its `mapRef`, and the redraw uses the last player opened.
});
