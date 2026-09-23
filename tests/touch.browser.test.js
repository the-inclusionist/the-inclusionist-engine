// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de input/touch — render/DOM real (project BROWSER: usa document + querySelector). Injeção por closure
// (mesmo padrão de ui/settings-motion.browser.test.js): ctx com $/srSay/store/root/isMobile/viewport/
// frontOverlay/onPadDesignApplied FALSOS (spies), mas `players`/`numPlayers`/`phase` (core/state.js) são os módulos REAIS.
import { describe, it, expect, beforeEach } from 'vitest';
import { initTouch } from '../app/js/input/touch.js';
// A CENA é DO TESTE desde 2026-08-26. `phase` saiu de `core/state` — virou a pilha de `core/scenes`, e os
// três nomes moram na raiz de composição (ADR-0030 C3). Quem é engine recebe BOOLEANOS. Este `let` faz o
// papel que o binding vivo fazia, e os casos seguem escritos como estavam.
let faseFalsa = 'playing';
const setPhaseValue = (p) => { faseFalsa = p; };
/*
 * 🔴 A RODADA É UM DUPLO LOCAL desde o ADR-0228: `core/run-state` foi com a pilha de mundo-de-tiles para o
 * `game-platformer`. Este ficheiro nunca testou a rodada — ele PASSA uma ao que está a medir —, e os três
 * membros abaixo são exactamente os que ele lê. Fábrica e não literal: duas rodadas têm de ser dois objectos.
 */
const createRunState = () => ({ numPlayers: 1, players: [], setNumPlayers(n) { this.numPlayers = n; } });
// A RODADA é local a este arquivo desde 2026-08-26 (ADR-0038, Fase B): `players`/`numPlayers` deixaram de
// ser `let` de `core/state` e passaram a viver na instância que a raiz de composição possui. Aqui o teste
// cria a sua, e os apelidos abaixo mantêm o corpo dos casos escrito como sempre esteve.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);

const $ = (sel) => document.querySelector(sel);

function markup() {
  document.body.innerHTML = `
    <div id="touch-controls" hidden>
      <div id="touch-stick"></div>
      <div id="touch-cross" hidden></div>
      <div id="pad-diamond">
        <button class="pad-b" data-btn="0"></button>
        <button class="pad-b" data-btn="1"></button>
        <button class="pad-b" data-btn="2"></button>
        <button class="pad-b" data-btn="3"></button>
      </div>
    </div>
    <button id="opt-touchcfg" type="button"></button>
    <div id="touchcfg" hidden>
      <select id="pad-dir"><option value="stick">analógico</option><option value="cross">cruz</option></select>
      <input id="pad-size" type="range" min="11" max="16" step="0.5" value="12.5">
      <span id="pad-size-val"></span><span id="pad-size-tag"></span>
      <input id="pad-gap" type="range" min="2" max="6" step="0.5" value="3">
      <span id="pad-gap-val"></span><span id="pad-gap-tag"></span>
      <input id="pad-stick" type="range" min="15" max="22" step="0.5" value="18">
      <span id="pad-stick-val"></span><span id="pad-stick-tag"></span>
      <input id="pad-travel" type="range" min="3" max="7" step="0.5" value="4.5">
      <span id="pad-travel-val"></span><span id="pad-travel-tag"></span>
      <input id="pad-dpad" type="range" min="10" max="16" step="0.5" value="12">
      <span id="pad-dpad-val"></span><span id="pad-dpad-tag"></span>
      <button id="pad-preset-child" type="button"></button>
      <button id="pad-preset-adult" type="button"></button>
      <div id="touchmap-list"></div>
      <button id="touchcfg-close" type="button"></button>
    </div>`;
}

function makeCtx(over = {}) {
  const calls = { srSay: [], frontOverlay: [], set: [], onPadDesignApplied: 0 };
  const backing = new Map();
  const store = {
    get: (k, fb = null) => (backing.has(k) ? backing.get(k) : fb),
    set: (k, v) => { backing.set(k, String(v)); calls.set.push([k, v]); return true; },
    getNum: (k, fb = 0) => (backing.has(k) ? parseFloat(backing.get(k)) : fb),
    getJSON: (k, fb = null) => (backing.has(k) ? JSON.parse(backing.get(k)) : fb),
    setJSON: (k, obj) => backing.set(k, JSON.stringify(obj)),
  };
  const ctx = {
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    $,
    srSay: (t) => calls.srSay.push(t),
    // As posicoes que ESTE 'jogo' usa. O menu de cada slot oferecia nove opcoes fixas da engine; agora
    // oferece as do jogo, e num teste o jogo e o fixture.
    acoesDoJogo: () => [
      { acao: 'left', rotulo: 'Andar a esquerda' }, { acao: 'right', rotulo: 'Andar a direita' },
      { acao: 'up', rotulo: 'Subir' }, { acao: 'down', rotulo: 'Descer' },
      { acao: 'action2', rotulo: 'Pular' }, { acao: 'action1', rotulo: 'Correr' },
      { acao: 'action3', rotulo: 'Especial' }, { acao: 'action4', rotulo: 'Trocar poder' },
      { acao: 'start', rotulo: 'Pausar (START)' },
    ],
    store,
    root: document.documentElement,
    isMobile: () => false,
    viewport: () => ({ w: 1280, h: 800 }),
    frontOverlay: (el) => calls.frontOverlay.push(el),
    onPadDesignApplied: () => { calls.onPadDesignApplied++; },
    // A POLÍTICA do pad entra por ctx (item 19). O padrão é "pode": os casos que testam o CONTRÁRIO passam
    // `padAllowed: () => false` e dizem, no título, qual condição do jogo estão representando.
    padAllowed: () => true,
    ...over,
  };
  return { ctx, calls, store };
}

beforeEach(() => {
  markup();
  players.length = 0;
  players.push({}); // este módulo não lê mais jogador nenhum (item 19) — o array existe para o resto do estado
  setNumPlayersValue(1);
  setPhaseValue('playing');
});

describe('initTouch — boot', () => {
  it('[Right] roda applyPadDesign/applyPadPhysical/applyDirStyle sem lançar, mesmo com painel vazio de #pad-diamond', () => {
    document.body.innerHTML = ''; // sem NENHUM elemento do módulo — todo `if(el)` deve proteger
    const { ctx } = makeCtx();
    expect(() => initTouch(ctx)).not.toThrow();
  });
  it('[Right] escreve as custom properties --pad-* na raiz injetada', () => {
    const { ctx } = makeCtx();
    initTouch(ctx);
    expect(ctx.root.style.getPropertyValue('--pad-btn')).toMatch(/px$/);
    expect(ctx.root.style.getPropertyValue('--stick-base')).toMatch(/px$/);
    expect(ctx.root.style.getPropertyValue('--dpad-span')).toMatch(/px$/);
  });
});

describe('initTouch — renderTouchMap / config de toque', () => {
  it('[Right] popula #touchmap-list com 13 linhas (uma por slot) e persiste ao trocar', () => {
    const { ctx, calls, store } = makeCtx();
    const api = initTouch(ctx);
    api.renderTouchMap();
    const selects = document.querySelectorAll('#touchmap-list select[data-slot]');
    expect(selects.length).toBe(13); // nove até os quatro ombros do ADR-0160
    const b0 = document.querySelector('#tm-b0');
    b0.value = 'action1';
    b0.dispatchEvent(new Event('change'));
    expect(api.getTouchMap().b0).toBe('action1');
    expect(JSON.parse(store.get('incl_touchmap')).b0).toBe('action1');
    expect(calls.srSay.some((s) => s.includes('Correr'))).toBe(true);
  });

  it('[Right] ⚠️ a PALAVRA DO JOGO entra por texto, nunca por markup (issue #106)', () => {
    // Terceiro sink da mesma classe — os três consomem o MESMO `acoesDoJogo()`, que devolve as palavras do
    // preset. Um jogo vive hoje noutro repositório (ADR-0083) e esta árvore não revê o texto dele.
    //
    // ⚠️ E O `value="${acao}"` FICA, o que parece incoerente e não é: `acao` é o nome ABSTRATO, enumerado pela
    // engine em `core/actions`. É a separação do ADR-0086 — o que é do jogo é a palavra, não a posição — e é
    // ela que torna um dos dois seguro e o outro não.
    // ⚠️ O PAYLOAD FECHA A `<option>` E SAI. Ver o caso irmão em `settings-controls.browser`: um `onerror` é
    // assíncrono e não dispara a tempo, e aferir o DOM final não distingue nada, porque o `textContent`
    // posterior escreve por cima do que o `innerHTML` já analisou. O que discrimina é o elemento que aterra
    // FORA do alvo do `textContent` e por isso sobrevive.
    const { ctx } = makeCtx();
    const FUGA = '</option><option id="fugiu-do-jogo"></option>';
    ctx.acoesDoJogo = () => [{ acao: 'action1', rotulo: FUGA }];
    initTouch(ctx).renderTouchMap();

    const lista = document.querySelector('#touchmap-list');
    expect(lista.querySelector('#fugiu-do-jogo'), 'a palavra do jogo foi ANALISADA como marcação').toBe(null);
    const op = lista.querySelector('select[data-slot] option');
    expect(op.textContent).toBe(FUGA);
    expect(op.value).toBe('action1'); // o nome abstrato continua no atributo
  });

  // 🔴 O IRMÃO DO `7742ac0`, NO MÓDULO AO LADO. Aquele conserto disse que o leitor de tela nunca pode dizer
  // `action2` a uma criança, e é a regra mais afiada do ADR-0074 — o quarto gate que o ADR-0111 deve. Aqui o
  // anúncio do slot recuava para `sel.value`, que É o nome abstrato:
  //
  //     acao: escolhida ? escolhida.rotulo : sel.value
  //
  // ⚠️ E O RECUO É ALCANÇÁVEL PELA FORMA QUE ESTE PROJETO PERSEGUE, não por acidente: `acoesDoJogo()` é uma
  // FUNÇÃO do cartucho, chamada de novo a cada `change`. Num jogo de uma tela só ela devolve sempre o mesmo;
  // num hub de atividades — que é o desenho da #101 e do menu de atividades — a lista muda quando a criança
  // troca de atividade, e a `<option>` desenhada antes fica órfã. Aí o `find` falha e a frase sai com o id.
  it('[Fronteira] com a lista do jogo trocada por baixo, o anúncio NÃO diz o nome abstrato', () => {
    const { ctx, calls } = makeCtx();
    const api = initTouch(ctx);
    api.renderTouchMap();

    const b0 = document.querySelector('#tm-b0');
    b0.value = 'action3'; // a posição existia no desenho anterior

    // A criança troca de atividade: o preset novo nomeia outras posições.
    ctx.acoesDoJogo = () => [{ acao: 'action1', rotulo: 'Responder' }];
    b0.dispatchEvent(new Event('change'));

    const ditos = calls.srSay.join(' | ');
    for (const abstrato of ['action1', 'action2', 'action3', 'action4', 'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger']) {
      expect(ditos, `o leitor de tela disse o id interno «${abstrato}»`).not.toContain(abstrato);
    }
    // 📌 O GÉMEO SILENCIOSO tem de ficar fechado: calar o anúncio inteiro passaria no laço acima. A criança
    // que navega por ouvido precisa de saber que a escolha dela aterrou.
    expect(calls.srSay.length, 'o anúncio sumiu em vez de perder o id').toBeGreaterThan(0);
  });
});

describe('initTouch — openTouchCfg / closeTouchCfg', () => {
  it('[Right] abre: desoculta #touchcfg, chama frontOverlay, foca o 1º select/botão', () => {
    const { ctx, calls } = makeCtx();
    const api = initTouch(ctx);
    api.openTouchCfg();
    expect($('#touchcfg').hidden).toBe(false);
    expect(calls.frontOverlay.length).toBe(1);
  });
  it('[Right] fecha: oculta #touchcfg e devolve o foco a #opt-touchcfg', () => {
    const { ctx } = makeCtx();
    const api = initTouch(ctx);
    api.openTouchCfg();
    api.closeTouchCfg();
    expect($('#touchcfg').hidden).toBe(true);
    expect(document.activeElement).toBe($('#opt-touchcfg'));
  });
  it('[Right] o botão #opt-touchcfg já vem ligado a openTouchCfg() (wiring interno do initTouch)', () => {
    const { ctx } = makeCtx();
    initTouch(ctx);
    $('#opt-touchcfg').click();
    expect($('#touchcfg').hidden).toBe(false);
  });
});

describe('initTouch — hideTouchControls / showTouchControls', () => {
  it('[Right] showTouchControls: desoculta #touch-controls, marca body.touch-mode, avisa a raiz', () => {
    const { ctx } = makeCtx();
    const avisos = [];
    const api = initTouch({ ...ctx, onTouchControlsShown: () => avisos.push('shown'), onTouchControlsHidden: () => avisos.push('hidden') });
    api.showTouchControls();
    expect($('#touch-controls').hidden).toBe(false);
    expect(document.body.classList.contains('touch-mode')).toBe(true);
    expect(avisos).toEqual(['shown']);
    api.hideTouchControls();
    expect(avisos, 'the root is not told the pad left — a minimap moved out of its way stays there').toEqual(['shown', 'hidden']);
  });
  it('[Inverse] hideTouchControls desfaz o showTouchControls', () => {
    const { ctx } = makeCtx();
    const api = initTouch(ctx);
    api.showTouchControls();
    api.hideTouchControls();
    expect($('#touch-controls').hidden).toBe(true);
    expect(document.body.classList.contains('touch-mode')).toBe(false);
  });
  it('[Boundary] o jogo dizendo NÃO cala o pad, e é a ÚNICA coisa que este módulo consulta', () => {
    // Eram TRÊS casos aqui — mais de um jogador, fora de "playing", e quiz aberto —, e os três mexiam em
    // `core/state` para exercitar uma linha do módulo. Viraram um: o módulo pergunta `padAllowed()` e nada
    // mais. As três condições continuam existindo, no `main.js`, onde a política do jogo mora.
    //
    // O que se perdeu ao juntar: os três títulos documentavam POR QUE o pad some. Isso não some do projeto —
    // muda de lugar, para o comentário do ctx no `main.js`. O que se ganhou: este fixture parou de precisar
    // de um jogador com `quiz` para testar a camada de TOQUE.
    const { ctx } = makeCtx({ padAllowed: () => false });
    const api = initTouch(ctx);
    api.showTouchControls();
    expect($('#touch-controls').hidden).toBe(true);
  });

  it('[Interface] a resposta é lida A CADA chamada, não guardada no init', () => {
    // Sem isto, um módulo que lesse `padAllowed()` uma vez no init passaria em tudo acima e ficaria preso à
    // resposta do primeiro instante — e o pad nunca mais apareceria depois de uma pausa.
    let pode = false;
    const { ctx } = makeCtx({ padAllowed: () => pode });
    const api = initTouch(ctx);
    api.showTouchControls();
    expect($('#touch-controls').hidden).toBe(true);
    pode = true;
    api.showTouchControls();
    expect($('#touch-controls').hidden).toBe(false);
  });
  it('[Right] o parâmetro `reason` de hideTouchControls é aceito mas ignorado (fachada — mesmo comportamento do original)', () => {
    const { ctx } = makeCtx();
    const api = initTouch(ctx);
    api.showTouchControls();
    api.hideTouchControls('teclado');
    expect($('#touch-controls').hidden).toBe(true);
  });
});

describe('initTouch — applyDirStyle (analógico × cruz)', () => {
  it('[Right] padrão "stick": mostra o analógico, esconde a cruz', () => {
    const { ctx } = makeCtx();
    initTouch(ctx);
    expect($('#touch-stick').hidden).toBe(false);
    expect($('#touch-cross').hidden).toBe(true);
  });
  it('[Right] trocar #pad-dir para "cross" via UI esconde o analógico e mostra a cruz', () => {
    const { ctx, calls } = makeCtx();
    initTouch(ctx);
    const sel = $('#pad-dir');
    sel.value = 'cross';
    sel.dispatchEvent(new Event('change'));
    expect($('#touch-stick').hidden).toBe(true);
    expect($('#touch-cross').hidden).toBe(false);
    expect(calls.srSay.some((s) => s.includes('cruz'))).toBe(true);
  });
});

describe('initTouch — setPadMm / presets (mm reais, WCAG 2.5.5)', () => {
  it('[Right] mover o slider #pad-size chama setPadMm e persiste incl_padbtnmm', () => {
    const { ctx, store } = makeCtx();
    initTouch(ctx);
    const s = $('#pad-size');
    s.value = '14';
    s.dispatchEvent(new Event('input'));
    expect(store.get('incl_padbtnmm')).toBe('14');
    expect($('#pad-size-val').textContent).toBe('14,0 mm');
  });
  it('[Right] preset "mão de criança" ajusta os 5 valores de uma vez e persiste todos', () => {
    const { ctx, store, calls } = makeCtx();
    initTouch(ctx);
    $('#pad-preset-child').click();
    expect(store.get('incl_padbtnmm')).toBe('12');
    expect(store.get('incl_padstickmm')).toBe('16.5');
    expect(calls.srSay.some((s) => s.includes('criança'))).toBe(true);
  });
  it('[Right] preset "mão de adulto" idem, valores maiores', () => {
    const { ctx, store } = makeCtx();
    initTouch(ctx);
    $('#pad-preset-adult').click();
    expect(store.get('incl_padbtnmm')).toBe('14');
    expect(store.get('incl_paddpadmm')).toBe('14');
  });
  it('[Boundary] tag "mão de criança/adulto/intermediário" reflete a faixa do valor atual', () => {
    const { ctx } = makeCtx();
    initTouch(ctx);
    $('#pad-preset-child').click();
    expect($('#pad-size-tag').dataset.who).toBe('crianca');
    $('#pad-preset-adult').click();
    expect($('#pad-size-tag').dataset.who).toBe('adulto');
  });
});

describe('initTouch — applyPadDesign (rótulos físicos dos botões)', () => {
  it('[Right] repinta os 4 botões de #pad-diamond conforme PAD_DESIGNS[design]', () => {
    const { ctx, calls } = makeCtx();
    const api = initTouch(ctx);
    api.applyPadDesign('sony');
    const btn0 = document.querySelector('.pad-b[data-btn="0"]');
    expect(btn0.textContent).toBe('✕');
    expect(api.getPadDesign()).toBe('sony');
    expect(calls.onPadDesignApplied).toBeGreaterThan(0); // hook p/ a legenda Sim/Não da pausa (fora deste módulo)
  });
  it('[Inverse] design desconhecido não muda nada (mantém o atual)', () => {
    const { ctx } = makeCtx();
    const api = initTouch(ctx);
    api.applyPadDesign('sony');
    const before = api.getPadDesign();
    api.applyPadDesign('nao-existe');
    expect(api.getPadDesign()).toBe(before);
  });
  it('[Right] persiste incl_paddesign', () => {
    const { ctx, store } = makeCtx();
    const api = initTouch(ctx);
    api.applyPadDesign('microsoft');
    expect(store.get('incl_paddesign')).toBe('microsoft');
  });
});
