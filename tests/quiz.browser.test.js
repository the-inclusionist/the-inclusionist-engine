// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de game/quiz.initQuiz — a camada de EFEITO (project BROWSER: precisa de `document` real —
// innerHTML/hidden/click/:scope). A geração e o markup puro são cobertos em tests/quiz.node.test.js.
// Aqui o que importa é o CONTRATO com o jogo: onde o overlay mora (solo × multi-tela), o que o leitor de
// tela ouve, quantas tentativas antes de revelar, e a regra "3 vitórias = 1 moeda" — inclusive a diferença
// pedagógica entre letramento (moeda FICA, próxima palavra) e matemática (figura re-sorteada).
// ZOMBIES + Right-BICEP. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (B3).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initQuiz, generateBrailleCells, cKey } from '../app/js/game/quiz.js';
import { reseed } from '../app/js/core/rng.js';
import { players, setNumPlayersValue, setCoins, coins, setActivityValue, setQuizLevelValue } from '../app/js/core/state.js';

const $ = (sel) => document.querySelector(sel);
const QL = { 1: 'Descobrindo palavras', 2: 'Descobrindo sílabas', 3: 'Montando palavras', 4: 'Escrevendo palavras', 5: 'Escrevendo em Braille' };

/** Jogador mínimo (o `players[]` real é `unknown[]`; o quiz só toca estes campos). */
function makePl(i = 0) { return { i, x: 10, y: 20, vx: 3, vy: -4, collected: 0, quiz: null }; }

/** ctx completo com espiões — o quiz nunca fala com o jogo a não ser por aqui. */
function makeCtx(over = {}) {
  const log = { srSay: [], srAlert: [], gameSay: [], narrate: [], sfx: [], puzzle: 0, sparkle: [], hideTouch: 0, updateHud: 0, win: [], respawn: [], sync: [] };
  const ctx = {
    $,
    getScreen: (i) => document.querySelector(`#screen-${i}`),
    disp: (s) => String(s).toLowerCase(),
    isBlindMode: () => false,
    isModoCego: () => false,
    actCat: () => 'mat',
    tabSel: [],
    fracNot: { v: 1, d: 1, dec: 0, pct: 0, mix: 0 },
    QL_NAME: QL,
    srSay: (t) => log.srSay.push(t),
    srAlert: (t) => log.srAlert.push(t),
    gameSay: (t) => log.gameSay.push(t),
    narrate: (t) => log.narrate.push(t),
    sfx: (n) => log.sfx.push(n),
    playPuzzleSolved: () => { log.puzzle++; },
    burstSparkle: (...a) => log.sparkle.push(a),
    hideTouchControls: () => { log.hideTouch++; },
    updateHud: () => { log.updateHud++; },
    win: (pl) => log.win.push(pl.i),
    respawnFigure: (i) => log.respawn.push(i),
    syncCollected: (pl) => log.sync.push(pl.collected),
    ...over,
  };
  return { ctx, log };
}

function mount(html = '<div id="quiz" hidden></div>') { document.body.innerHTML = html; }

/** Estado global do jogo como o game.js o entrega ao quiz. */
function setGame({ n = 1, level = 2, activity = 'mat1', nCoins = 3 } = {}) {
  players.length = 0;
  for (let i = 0; i < n; i++) players.push(makePl(i));
  setNumPlayersValue(n);
  setQuizLevelValue(level);
  setActivityValue(activity);
  setCoins(Array.from({ length: nCoins }, (_, i) => ({ x: i, y: 0, owner: 0, taken: false, shape: 'circulo', letter: 'g' })));
}

beforeEach(() => { mount(); setGame(); reseed(20260601); });
afterEach(() => { vi.useRealTimers(); });

// =================================================================================================
describe('onde o desafio aparece', () => {
  it('no solo usa o #quiz global e o revela', () => {
    const { ctx } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    expect($('#quiz').hidden).toBe(true);
    api.openQuiz(pl, 0, 'circulo');
    expect($('#quiz').hidden).toBe(false);
    expect($('#quiz .quiz-box')).toBeTruthy();
  });

  it('em multi-tela cria UM overlay dentro da tela de CADA jogador', () => {
    mount('<div id="quiz" hidden></div><div id="screen-0"></div><div id="screen-1"></div>');
    setGame({ n: 2 });
    const { ctx } = makeCtx(); const api = initQuiz(ctx);
    api.openQuiz(players[0], 0, 'circulo');
    api.openQuiz(players[1], 1, 'circulo');
    expect(document.querySelectorAll('#screen-0 > .quiz')).toHaveLength(1);
    expect(document.querySelectorAll('#screen-1 > .quiz')).toHaveLength(1);
    expect($('#quiz').hidden).toBe(true); // o overlay global fica de fora no MP
  });

  it('em multi-tela reaproveita o mesmo overlay a cada render (não empilha)', () => {
    mount('<div id="quiz" hidden></div><div id="screen-0"></div>');
    setGame({ n: 2 });
    const { ctx } = makeCtx(); const api = initQuiz(ctx);
    api.openQuiz(players[0], 0, 'circulo');
    api.renderQuiz(players[0]); api.renderQuiz(players[0]);
    expect(document.querySelectorAll('#screen-0 > .quiz')).toHaveLength(1);
  });

  it('sem a tela do jogador, cai no #quiz global (não perde o desafio)', () => {
    setGame({ n: 2 }); // não há #screen-0 no DOM
    const { ctx } = makeCtx(); const api = initQuiz(ctx);
    api.openQuiz(players[0], 0, 'circulo');
    expect($('#quiz').hidden).toBe(false);
  });

  it('fechar esconde o overlay e zera o desafio do jogador', () => {
    const { ctx } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 0, 'circulo');
    api.closeQuiz(pl);
    expect(pl.quiz).toBeNull();
    expect($('#quiz').hidden).toBe(true);
  });

  it('renderizar sem desafio esconde o overlay', () => {
    const { ctx } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 0, 'circulo');
    pl.quiz = null; api.renderQuiz(pl);
    expect($('#quiz').hidden).toBe(true);
  });
});

// =================================================================================================
describe('abrir um desafio', () => {
  it('trava o jogador no lugar (não sai andando com o menu aberto)', () => {
    const { ctx } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 0, 'circulo');
    expect(pl.vx).toBe(0); expect(pl.vy).toBe(0);
  });

  it('esconde o controle de toque (quiz aberto = menu na tela)', () => {
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx);
    api.openQuiz(players[0], 0, 'circulo');
    expect(log.hideTouch).toBeGreaterThan(0);
  });

  it('anuncia a pergunta ao leitor de tela', () => {
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx);
    api.openQuiz(players[0], 0, 'circulo');
    expect(log.srSay[0]).toBe('Quantas bolinhas você vê?');
  });

  it('em multi-tela a fala vem prefixada com o jogador', () => {
    mount('<div id="quiz" hidden></div><div id="screen-1"></div>');
    setGame({ n: 2 });
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx);
    api.openQuiz(players[1], 0, 'circulo');
    expect(log.srSay[0]).toBe('Jogador 2: Quantas bolinhas você vê?');
  });

  it('guarda a figura da moeda que abriu o desafio', () => {
    const { ctx } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 2, 'losango');
    expect(pl.quiz.coinIndex).toBe(2);
    expect(pl.quiz.shape).toBe('losango');
  });
});

// =================================================================================================
describe('letramento: o nível escolhe o desafio e a voz do jogo fala a palavra', () => {
  it('nível 1 abre o "descobrindo palavras" e fala a palavra', () => {
    setGame({ level: 1, activity: 'alf1' });
    const { ctx, log } = makeCtx({ actCat: () => 'alf' }); const api = initQuiz(ctx); const pl = players[0];
    api.openSilabas(pl, 0, 'g');
    expect(pl.quiz.kind).toBe('pre');
    expect(log.gameSay).toContain(pl.quiz.word);
    expect($('#quiz').innerHTML).toContain('nível 1 · Descobrindo palavras');
  });

  it('nível 2 abre as sílabas e fala a sílaba inteira; o 3 soletra', () => {
    setGame({ level: 2, activity: 'alf2' });
    let { ctx } = makeCtx({ actCat: () => 'alf' }); let api = initQuiz(ctx);
    api.openSilabas(players[0], 0, 'g');
    expect(players[0].quiz.kind).toBe('silabas');
    expect(players[0].quiz.hearSyl).toBe(true);

    setGame({ level: 3, activity: 'alf3' });
    ({ ctx } = makeCtx({ actCat: () => 'alf' })); api = initQuiz(ctx);
    api.openSilabas(players[0], 0, 'g');
    expect(players[0].quiz.hearSyl).toBe(false);
  });

  it('nível 4 escreve letra a letra; o 5 é o mesmo desafio com ditado de Braille', () => {
    setGame({ level: 4, activity: 'alf4' });
    let { ctx } = makeCtx({ actCat: () => 'alf' }); let api = initQuiz(ctx);
    api.openSilabas(players[0], 0, 'g');
    expect(players[0].quiz.kind).toBe('alf');
    expect(players[0].quiz.braille).toBe(false);
    expect(players[0].quiz.boxes).toHaveLength(players[0].quiz.word.length);

    setGame({ level: 5, activity: 'alf5' });
    ({ ctx } = makeCtx({ actCat: () => 'alf' })); api = initQuiz(ctx);
    api.openSilabas(players[0], 0, 'g');
    expect(players[0].quiz.braille).toBe(true);
    expect($('#quiz').innerHTML).toContain('nível 5 · Escrevendo em Braille');
  });

  it('modo cego troca QUALQUER nível pelo ditado de Braille (a11y vence)', () => {
    for (const cego of [{ isBlindMode: () => true }, { isModoCego: () => true }]) {
      setGame({ level: 3, activity: 'alf3' });
      const { ctx } = makeCtx({ actCat: () => 'alf', ...cego }); const api = initQuiz(ctx);
      api.openSilabas(players[0], 0, 'g');
      expect(players[0].quiz.kind).toBe('braille');
    }
  });

  it('o modo de visão "cegueira" do PRÓPRIO jogador também vira Braille (por tela, no MP)', () => {
    setGame({ level: 3, activity: 'alf3' });
    const { ctx } = makeCtx({ actCat: () => 'alf' }); const api = initQuiz(ctx);
    players[0].viz = 'blind'; // render/viz-modes: kind 'blind'
    api.openSilabas(players[0], 0, 'g');
    expect(players[0].quiz.kind).toBe('braille');
  });

  it('um modo de visão que NÃO é cegueira mantém o desafio do nível', () => {
    setGame({ level: 3, activity: 'alf3' });
    const { ctx } = makeCtx({ actCat: () => 'alf' }); const api = initQuiz(ctx);
    players[0].viz = 'lv-blur'; // baixa visão não é cegueira
    api.openSilabas(players[0], 0, 'g');
    expect(players[0].quiz.kind).toBe('silabas');
  });
});

// =================================================================================================
describe('navegar e ouvir', () => {
  it('o cursor anda e a alternativa sob ele é falada', () => {
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 0, 'circulo');
    log.srSay.length = 0;
    api.quizMove(pl, 1);
    expect(pl.quiz.sel).toBe(1);
    expect(log.srSay).toEqual(['2']); // grade fixa 1..9 da atividade Quantidade
  });

  it('o cursor não escapa dos limites da grade', () => {
    const { ctx } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 0, 'circulo');
    api.quizMove(pl, -3);
    expect(pl.quiz.sel).toBe(0); // matemática não tem palavra no topo (min = 0)
    for (let k = 0; k < 20; k++) api.quizMove(pl, 3);
    expect(pl.quiz.sel).toBe(8);
  });

  it('nas sílabas o cursor alcança a imagem do topo para repetir a fala', () => {
    setGame({ level: 2, activity: 'alf2' });
    const { ctx, log } = makeCtx({ actCat: () => 'alf' }); const api = initQuiz(ctx); const pl = players[0];
    api.openSilabas(pl, 0, 'g');
    log.gameSay.length = 0;
    api.quizMove(pl, -1);
    expect(pl.quiz.sel).toBe(-1);
    expect(log.gameSay).toContain(pl.quiz.word);
  });

  it('mover sem desafio aberto não faz nada', () => {
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.quizMove(pl, 1); api.quizConfirm(pl); api.quizErase(pl); api.announceBraille(pl);
    expect(log.srSay).toEqual([]); expect(log.sfx).toEqual([]);
  });
});

// =================================================================================================
describe('confirmar: acertar, errar e revelar', () => {
  /** Deixa o cursor na alternativa certa do desafio de matemática. */
  const apontarCerta = (pl) => { pl.quiz.sel = pl.quiz.choices.indexOf(pl.quiz.answer); };

  it('acertar toca o som de acerto e anuncia o progresso da moeda', () => {
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 0, 'circulo'); apontarCerta(pl);
    api.quizConfirm(pl);
    expect(log.sfx).toContain('correct');
    expect(log.srSay).toContain('Acertou! 1 de 3 para ganhar a moeda.');
    expect(pl.alfWins).toBe(1);
    expect(pl.quiz).toBeNull(); // fecha e espera a pessoa encostar de novo na figura
  });

  it('errar UMA vez só toca o som de erro (a resposta ainda não aparece)', () => {
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 0, 'circulo');
    pl.quiz.sel = (pl.quiz.choices.indexOf(pl.quiz.answer) + 1) % 9;
    api.quizConfirm(pl);
    expect(log.sfx).toContain('wrong');
    expect(pl.quiz.tries).toBe(1);
    expect(pl.quiz.revealed).toBe(false);
    expect(log.srAlert).toEqual([]);
  });

  it('errar DUAS vezes revela a resposta certa, em destaque', () => {
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 0, 'circulo');
    const errada = (pl.quiz.choices.indexOf(pl.quiz.answer) + 1) % 9;
    pl.quiz.sel = errada; api.quizConfirm(pl);
    pl.quiz.sel = errada; api.quizConfirm(pl);
    expect(pl.quiz.revealed).toBe(true);
    expect(log.srAlert.join(' ')).toContain('Pule para seguir.');
    expect($('#quiz').innerHTML).toContain('quiz-choice reveal');
  });

  it('depois de revelada, confirmar re-sorteia a figura na MATEMÁTICA', () => {
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 1, 'circulo');
    pl.quiz.revealed = true;
    api.quizConfirm(pl);
    expect(log.respawn).toEqual([1]);
    expect(pl.quiz).toBeNull();
  });

  it('depois de revelada, o LETRAMENTO não tem penalidade: a moeda fica onde está', () => {
    setGame({ level: 1, activity: 'alf1' });
    const { ctx, log } = makeCtx({ actCat: () => 'alf' }); const api = initQuiz(ctx); const pl = players[0];
    api.openSilabas(pl, 1, 'g');
    pl.quiz.revealed = true;
    api.quizConfirm(pl);
    expect(log.respawn).toEqual([]);
    expect(pl.quiz).toBeNull();
  });

  it('clicar numa alternativa confirma direto (mouse/toque)', () => {
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 0, 'circulo');
    const certa = pl.quiz.choices.indexOf(pl.quiz.answer);
    $(`#quiz .quiz-choice[data-i="${certa}"]`).click();
    expect(log.sfx).toContain('correct');
    expect(pl.alfWins).toBe(1);
  });
});

// =================================================================================================
describe('montar a palavra (sílabas e letras)', () => {
  it('colocar sílaba preenche a caixa e toca o som de encaixe', () => {
    setGame({ level: 3, activity: 'alf3' });
    const { ctx, log } = makeCtx({ actCat: () => 'alf' }); const api = initQuiz(ctx); const pl = players[0];
    api.openSilabas(pl, 0, 'g');
    pl.quiz.sel = 0; api.quizConfirm(pl);
    expect(pl.quiz.boxes[0]).toBe(pl.quiz.options[0]);
    expect(log.sfx).toContain('place');
  });

  it('apagar tira a ÚLTIMA sílaba colocada', () => {
    setGame({ level: 3, activity: 'alf3' });
    const { ctx } = makeCtx({ actCat: () => 'alf' }); const api = initQuiz(ctx); const pl = players[0];
    api.openSilabas(pl, 0, 'g');
    pl.quiz.sel = 0; api.quizConfirm(pl);
    pl.quiz.sel = 1; api.quizConfirm(pl);
    api.quizErase(pl);
    expect(pl.quiz.boxes[1]).toBeNull();
    expect(pl.quiz.boxes[0]).not.toBeNull();
  });

  it('montar a palavra certa é acerto; errar duas vezes revela a palavra montada', () => {
    setGame({ level: 3, activity: 'alf3' });
    const { ctx, log } = makeCtx({ actCat: () => 'alf' }); const api = initQuiz(ctx); const pl = players[0];
    api.openSilabas(pl, 0, 'g');
    const N = pl.quiz.options.length, palavra = pl.quiz.word;
    // erra duas vezes: OK com as caixas vazias
    pl.quiz.sel = N + 1; api.quizConfirm(pl);
    expect(pl.quiz.tries).toBe(1);
    pl.quiz.sel = N + 1; api.quizConfirm(pl);
    expect(pl.quiz.revealed).toBe(true);
    expect(pl.quiz.boxes.join('')).toBe(palavra); // a resposta aparece montada nas caixas
    expect(log.srAlert.join(' ')).toContain(palavra);
  });

  it('errar UMA vez limpa as caixas para tentar de novo', () => {
    setGame({ level: 3, activity: 'alf3' });
    const { ctx } = makeCtx({ actCat: () => 'alf' }); const api = initQuiz(ctx); const pl = players[0];
    api.openSilabas(pl, 0, 'g');
    const N = pl.quiz.options.length;
    pl.quiz.sel = 0; api.quizConfirm(pl);
    pl.quiz.sel = N + 1; api.quizConfirm(pl);
    expect(pl.quiz.boxes).toEqual([null, null]);
  });

  it('nas letras (nível 4) apagar tira a última letra', () => {
    setGame({ level: 4, activity: 'alf4' });
    const { ctx } = makeCtx({ actCat: () => 'alf' }); const api = initQuiz(ctx); const pl = players[0];
    api.openSilabas(pl, 0, 'g');
    pl.quiz.sel = 0; api.quizConfirm(pl);
    pl.quiz.sel = 1; api.quizConfirm(pl);
    expect(pl.quiz.boxes.filter((b) => b !== null)).toHaveLength(2);
    api.quizErase(pl);
    expect(pl.quiz.boxes.filter((b) => b !== null)).toHaveLength(1);
  });

  it('a matemática não tem "apagar" (não há o que montar)', () => {
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 0, 'circulo');
    api.quizErase(pl);
    expect(log.sfx).toEqual([]);
  });
});

// =================================================================================================
describe('Braille: ditado passivo (modo pessoa cega)', () => {
  const abrir = () => {
    setGame({ level: 3, activity: 'alf5' });
    const { ctx, log } = makeCtx({ actCat: () => 'alf', isModoCego: () => true });
    const api = initQuiz(ctx); const pl = players[0];
    api.openSilabas(pl, 0, 'g');
    return { api, pl, log };
  };

  it('dita a palavra e a cela de cada letra, e diz como coletar', () => {
    const { pl, log } = abrir();
    const dito = log.srAlert.join(' ');
    expect(dito).toContain(pl.quiz.word);
    for (const c of pl.quiz.cells) expect(dito).toContain(`${c.l}: ${c.text}.`);
    expect(dito).toContain('Pule para coletar.');
  });

  it('repetir o ditado anuncia de novo (a tecla Cima)', () => {
    const { api, pl, log } = abrir();
    const antes = log.srAlert.length;
    api.announceBraille(pl);
    expect(log.srAlert).toHaveLength(antes + 1);
  });

  it('confirmar COLETA — não há resposta errada no ditado', () => {
    const { api, pl, log } = abrir();
    api.quizConfirm(pl);
    expect(log.sfx).toContain('coin');
    expect(log.srSay.join(' ')).toContain('Coletado!');
    expect(pl.alfWins).toBe(1);
  });

  it('o ditado não é anunciado para desafios que não são Braille', () => {
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 0, 'circulo');
    log.srAlert.length = 0;
    api.announceBraille(pl);
    expect(log.srAlert).toEqual([]);
  });
});

// =================================================================================================
describe('3 vitórias = 1 moeda (a regra vale para TODOS os minijogos)', () => {
  /** Acerta o desafio de matemática `n` vezes seguidas. */
  function acertarN(api, pl, n) {
    for (let k = 0; k < n; k++) {
      api.openQuiz(pl, 0, 'circulo');
      pl.quiz.sel = pl.quiz.choices.indexOf(pl.quiz.answer);
      api.quizConfirm(pl);
    }
  }

  it('as duas primeiras vitórias NÃO dão a moeda', () => {
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    acertarN(api, pl, 2);
    expect(pl.alfWins).toBe(2);
    expect(pl.collected).toBe(0);
    expect(coins[0].taken).toBe(false);
    expect(log.puzzle).toBe(0);
  });

  it('a terceira comemora, acende as 3 luzes e SÓ ENTÃO entrega a moeda', () => {
    vi.useFakeTimers();
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    acertarN(api, pl, 3);
    expect(log.puzzle).toBe(1);
    expect(log.sparkle).toHaveLength(1);
    expect(log.srSay).toContain('Muito bem! Você ganhou a moeda!');
    expect($('#quiz .quiz-wins').classList.contains('celebrate')).toBe(true);
    expect($('#quiz').querySelectorAll('.qw-dot.on')).toHaveLength(3);
    expect(pl.collected).toBe(0); // ainda não — a animação roda primeiro
    vi.advanceTimersByTime(900);
    expect(pl.collected).toBe(1);
    expect(coins[0].taken).toBe(true);
    expect(pl.alfWins).toBe(0); // o contador reinicia para a próxima moeda
    expect(log.updateHud).toBeGreaterThan(0);
    expect(log.sync).toContain(1);
  });

  it('durante a comemoração o desafio ignora entrada (não dá para acertar 2× no mesmo)', () => {
    vi.useFakeTimers();
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    acertarN(api, pl, 3);
    const antes = log.sfx.length;
    api.quizConfirm(pl); api.quizConfirm(pl);
    expect(log.sfx).toHaveLength(antes);
  });

  it('as luzes de progresso aparecem no desafio seguinte', () => {
    const { ctx } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    acertarN(api, pl, 1);
    api.openQuiz(pl, 0, 'circulo');
    expect($('#quiz').querySelectorAll('.qw-dot.on')).toHaveLength(1);
    expect($('#quiz').querySelectorAll('.qw-dot')).toHaveLength(3);
  });

  it('no LETRAMENTO a vitória refala a palavra e dá uma pausa antes de fechar', () => {
    vi.useFakeTimers();
    setGame({ level: 1, activity: 'alf1' });
    const { ctx, log } = makeCtx({ actCat: () => 'alf' }); const api = initQuiz(ctx); const pl = players[0];
    api.openSilabas(pl, 0, 'g');
    const palavra = pl.quiz.word;
    pl.quiz.sel = pl.quiz.choices.indexOf(palavra);
    log.gameSay.length = 0;
    api.quizConfirm(pl);
    expect(log.gameSay).toContain(palavra); // refala a palavra acertada
    expect(pl.quiz).not.toBeNull();          // ainda na tela, comemorando
    vi.advanceTimersByTime(1200);
    expect(pl.quiz).toBeNull();
  });

  it('a moeda coletada fecha a partida quando bate o alvo', () => {
    vi.useFakeTimers();
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    pl.collected = 9; // COIN_TARGET é 10
    acertarN(api, pl, 3);
    vi.advanceTimersByTime(900);
    expect(pl.collected).toBe(10);
    expect(log.win).toEqual([0]);
  });
});

// =================================================================================================
describe('a11y do markup montado', () => {
  it('o desafio é um diálogo modal rotulado', () => {
    const { ctx } = makeCtx(); const api = initQuiz(ctx);
    api.openQuiz(players[0], 0, 'circulo');
    const box = $('#quiz .quiz-box');
    expect(box.getAttribute('role')).toBe('dialog');
    expect(box.getAttribute('aria-modal')).toBe('true');
    expect(box.getAttribute('aria-label')).toBe('Desafio de matemática');
  });

  it('as luzes de progresso têm rótulo textual', () => {
    const { ctx } = makeCtx(); const api = initQuiz(ctx);
    api.openQuiz(players[0], 0, 'circulo');
    expect($('#quiz .quiz-wins').getAttribute('aria-label')).toBe('0 de 3 acertos para a moeda');
  });

  it('a imagem do topo diz que serve para ouvir a palavra de novo', () => {
    setGame({ level: 1, activity: 'alf1' });
    const { ctx } = makeCtx({ actCat: () => 'alf' }); const api = initQuiz(ctx);
    api.openSilabas(players[0], 0, 'g');
    expect($('#quiz .quiz-word').getAttribute('aria-label')).toMatch(/^Ouvir a palavra .+ de novo$/);
  });

  it('as celas Braille marcam só os pontos da letra', () => {
    setGame({ level: 3, activity: 'alf5' });
    const { ctx } = makeCtx({ actCat: () => 'alf', isModoCego: () => true }); const api = initQuiz(ctx);
    api.openSilabas(players[0], 0, 'g');
    const esperados = generateBrailleCells(players[0].quiz.word).reduce((n, c) => n + c.dots.length, 0);
    expect($('#quiz').querySelectorAll('.bdot.on')).toHaveLength(esperados);
    expect($('#quiz').querySelectorAll('.bdot')).toHaveLength(players[0].quiz.word.length * 6);
  });
});

// =================================================================================================
describe('errar na matemática: o que a criança OUVE em cada tentativa', () => {
  // O `else` deste ramo estava sem chaves, então o "Tente de novo." ficava FORA dele e era dito TAMBÉM na
  // tentativa que revela a resposta. A criança ouvia "A resposta é X. Pule para seguir." e, logo depois,
  // "Tente de novo." — duas instruções que se contradizem, e a segunda manda fazer o que já não dá.
  // Quem depende do áudio para jogar recebe só isso; não há tela para desempatar.
  function erra(api, pl) {
    // escolhe deliberadamente uma alternativa ERRADA
    const q = pl.quiz;
    q.sel = q.choices.findIndex((c) => cKey(c) !== q.answer);
    api.quizConfirm(pl);
  }

  it('[Right] 1ª tentativa errada: diz "Tente de novo." e NÃO revela', () => {
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 0, 'circulo');
    erra(api, pl);
    expect(pl.quiz.revealed).toBe(false);
    expect(log.srSay.some((t) => /Tente de novo/.test(t))).toBe(true);
    expect(log.srAlert.some((t) => /A resposta é/.test(t))).toBe(false);
  });

  it('[Right] 2ª tentativa errada: revela a resposta e NÃO manda tentar de novo', () => {
    const { ctx, log } = makeCtx(); const api = initQuiz(ctx); const pl = players[0];
    api.openQuiz(pl, 0, 'circulo');
    erra(api, pl);
    log.srSay.length = 0; log.srAlert.length = 0; // só o que for dito na SEGUNDA
    erra(api, pl);
    expect(pl.quiz.revealed).toBe(true);
    expect(log.srAlert.some((t) => /A resposta é/.test(t))).toBe(true);
    expect(log.srSay.some((t) => /Tente de novo/.test(t))).toBe(false); // ERA AQUI o defeito
  });
});
