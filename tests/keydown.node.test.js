// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de input/keydown — a CADEIA DE DECISÃO do teclado, sem DOM (project node). ZOMBIES + Right-BICEP.
//
// O que este arquivo protege não é aritmética: é a ORDEM DE PRECEDÊNCIA de nove guardas. A pergunta que cada
// caso responde é sempre a mesma — "com este mundo e esta tecla, qual ramo VENCE?" — e é justamente essa
// resposta que o monólito não conseguia afirmar, porque decisão e efeito estavam trançados no mesmo `if`.
// Por isso os casos mais valiosos daqui são os de CONFLITO (quiz aberto E diálogo visível; quiz aberto E
// Alt+3; quiz aberto E Enter), e não os de ramo isolado: um ramo isolado continua passando mesmo depois de
// alguém trocar duas guardas de lugar.
//
// O ROTEAMENTO POR DONO é o outro tema: em multi-tela, a tecla age no quiz do jogador DONO dela, e a tecla
// genérica cai no Jogador 1. Errar isso não quebra nada visível — o jogo continua respondendo — e simplesmente
// faz a criança da tela 2 comandar o desafio da tela 1.
//
// A casca (DOM, foco, propagação real, a captura do menu-nav) está em keydown.browser.test.js e NÃO é
// repetida aqui.
import { describe, it, expect, beforeEach } from 'vitest';
import { actionForCode } from '../app/js/input/keyboard-runtime.js';
import {
  decideKeydown, initKeydown, isJumpKey, isGameKeyCode, isEasyShortcut,
  titleNavOf, hasTitleIntent, quizOwnerIndex, quizActOf, edgesFor,
  EASY_SHORTCUTS, PAUSE_KEYS, SCREEN_DIGITS, EDGE_BY_ACTION,
} from '../app/js/input/keydown.js';
import { setPhaseValue } from '../app/js/core/state.js';

/* ===================== fixtures (esquemas de fábrica de input/keyboard.ts) ===================== */

const SOLO = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], run: ['KeyU'], jump: ['KeyJ', 'Space'], swap: ['KeyI'], especial: ['KeyK'] };
const P2A = { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], run: ['KeyU'], jump: ['KeyJ'], swap: ['KeyI'], especial: ['KeyK'] };
const P2B = { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], run: ['Numpad8'], jump: ['Numpad5'], swap: ['Numpad9'], especial: ['Numpad6'] };

const mkPlayer = (i, ctrl, extra = {}) => ({ i, ctrl, quiz: null, waiting: false, easy: false, ...extra });

/** Reconstrói o `ControlsState` como input/keyboard-runtime.ts o computa: aliases SEMPRE do esquema solo,
 *  `gameKeys` = união de TODOS os esquemas ativos. (Repetir a conta aqui seria trapaça; a forma é copiada,
 *  mas os dados vêm dos esquemas de fábrica, iguais aos do jogo.) */
function controlsFrom(schemes) {
  const { jump, left, right, up, down, run } = SOLO;
  const set = new Set();
  schemes.forEach((s) => { for (const a in s) for (const c of s[a]) set.add(c); });
  return { jump, left, right, up, down, run, gameKeys: [...set] };
}

/** Um mundo. Tudo tem padrão de "jogando, solo, nada aberto"; cada caso muda só o que interessa. */
function snap(over = {}) {
  const players = over.players || [mkPlayer(0, SOLO)];
  const schemes = over.schemes || players.map((p) => p.ctrl || {});
  const numPlayers = over.numPlayers ?? players.length;
  const active = schemes.slice(0, numPlayers);
  const base = {
    phase: 'playing',
    numPlayers,
    players,
    controls: over.controls || controlsFrom(active),
    heldKeys: over.heldKeys || new Set(),
    oneButton: false,
    escapeTargetId: null,
    touchCfgVisible: false,
    padWizVisible: false,
    winVisible: false,
    actionOf: (code, i) => actionForCode(schemes[i] || {}, code),
    whichPlayer: (code) => { for (let i = 0; i < active.length; i++) if (actionForCode(active[i], code)) return i; return -1; },
  };
  const { players: _p, schemes: _s, ...rest } = over;
  return { ...base, ...rest, players, numPlayers };
}

const ev = (code, mods = {}) => ({ code, altKey: false, ctrlKey: false, ...mods });
const decide = (code, over = {}, mods = {}) => decideKeydown(ev(code, mods), snap(over));

/* ===================== 1. PRECEDÊNCIA — os casos que valem por dez ===================== */

describe('a ORDEM das guardas É a especificação', () => {
  const withQuiz = { players: [mkPlayer(0, SOLO, { quiz: { kind: 'shape' } })] };

  it('[precedência] diálogo REGISTRADO aberto vence o quiz aberto — o Escape fecha o diálogo, não confirma o desafio', () => {
    const d = decide('Escape', { ...withQuiz, escapeTargetId: 'audio' });
    expect(d.kind).toBe('overlay');
    expect(d.closeId).toBe('audio');
  });

  it('[precedência] com diálogo aberto, tecla de JOGO não chega ao jogo (é engolida, sem preventDefault)', () => {
    const d = decide('KeyJ', { ...withQuiz, escapeTargetId: 'audio' });
    expect(d.kind).toBe('overlay');
    expect(d.closeId).toBeNull();          // não é Escape: não fecha nada
    expect(d.preventDefault).toBe(false);  // o diálogo é DOM e quer o comportamento nativo por baixo
  });

  it('[precedência] #touchcfg vence #padwiz (ordem de registro do monólito, verbatim)', () => {
    const d = decide('Escape', { touchCfgVisible: true, padWizVisible: true });
    expect(d.kind).toBe('touchcfg');
  });

  it('[precedência] a cadeia de Escape vence #touchcfg', () => {
    const d = decide('Escape', { escapeTargetId: 'help', touchCfgVisible: true, padWizVisible: true });
    expect(d.kind).toBe('overlay');
  });

  it('[precedência] a tela de vitória vence a tela de título', () => {
    const d = decide('Space', { phase: 'title', winVisible: true });
    expect(d.kind).toBe('win');
    expect(d.again).toBe(true);
  });

  it('[precedência] com QUIZ aberto, Alt+2 NÃO troca o número de telas', () => {
    const d = decideKeydown(ev('Digit2', { altKey: true }), snap(withQuiz));
    expect(d.kind).not.toBe('screens');
  });

  it('[precedência] com QUIZ aberto, Enter CONFIRMA o desafio em vez de pausar', () => {
    // Enter não é tecla de nenhum esquema → genérica → cai no quiz do P1, onde não é nada
    const d = decide('Enter', withQuiz);
    expect(d.kind).toBe('quiz');
    expect(d.kind === 'quiz' && d.act).toBeNull();
    // e a tecla de PULO do P1 (que é `jump` no esquema) confirma de verdade
    const j = decide('KeyJ', withQuiz);
    expect(j.kind).toBe('quiz');
    expect(j.act).toEqual({ type: 'confirm' });
  });

  it('[precedência] SEM quiz, o mesmo Enter pausa', () => {
    expect(decide('Enter').kind).toBe('pause');
  });

  it('[precedência] o título vence a pausa e o Alt+N (no splash, Escape não pausa)', () => {
    expect(decide('Escape', { phase: 'title' }).kind).toBe('title');
    expect(decideKeydown(ev('Digit3', { altKey: true }), snap({ phase: 'title' })).kind).toBe('title');
  });
});

/* ===================== 2. diálogos abertos ===================== */

describe('diálogos abertos bloqueiam o jogo', () => {
  it('[Right] Escape fecha o diálogo registrado, e só ele', () => {
    expect(decide('Escape', { escapeTargetId: 'options' })).toEqual({ kind: 'overlay', closeId: 'options', preventDefault: false });
  });
  it('[Right] #touchcfg: Escape esconde; outra tecla é engolida', () => {
    expect(decide('Escape', { touchCfgVisible: true }).close).toBe(true);
    expect(decide('KeyA', { touchCfgVisible: true }).close).toBe(false);
  });
  it('[Right] #padwiz: Escape CANCELA o assistente; outra tecla é engolida', () => {
    expect(decide('Escape', { padWizVisible: true })).toEqual({ kind: 'padwiz', close: true, preventDefault: false });
    expect(decide('Numpad5', { padWizVisible: true }).close).toBe(false);
  });
  it('[Boundary] diálogo ESCONDIDO não bloqueia nada (a flag presa não trava mais o teclado)', () => {
    expect(decide('KeyJ', { escapeTargetId: null, touchCfgVisible: false, padWizVisible: false }).kind).toBe('play');
  });
});

/* ===================== 3. tela de vitória ===================== */

describe('tela de vitória', () => {
  const win = { winVisible: true };
  it('[Right] o PULO de qualquer jogador aperta "Jogar de novo"', () => {
    const dois = { players: [mkPlayer(0, P2A), mkPlayer(1, P2B)], schemes: [P2A, P2B], numPlayers: 2 };
    expect(decide('KeyJ', { ...dois, ...win }).again).toBe(true);     // pulo do J1
    expect(decide('Numpad5', { ...dois, ...win }).again).toBe(true);  // pulo do J2
  });
  it('[Right] Escape e Enter também apertam', () => {
    expect(decide('Escape', win).again).toBe(true);
    expect(decide('Enter', win).again).toBe(true);
  });
  it('[Boundary] tecla sem função é engolida — sem preventDefault, para o Tab do navegador continuar valendo', () => {
    const d = decide('KeyQ', win);
    expect(d).toEqual({ kind: 'win', again: false, preventDefault: false });
  });
  it('[Right] quando aperta, PREVINE o padrão (Espaço rolaria a página por baixo do overlay)', () => {
    expect(decide('Space', win).preventDefault).toBe(true);
  });
});

/* ===================== 4. tela de título ===================== */

describe('tela de título', () => {
  const dois = { phase: 'title', players: [mkPlayer(0, P2A), mkPlayer(1, P2B)], schemes: [P2A, P2B], numPlayers: 2 };

  it('[Right] solo: as setas navegam e o pulo confirma', () => {
    expect(decide('ArrowUp', { phase: 'title' }).nav.up).toBe(true);
    expect(decide('KeyJ', { phase: 'title' }).nav.yes).toBe(true);
    expect(decide('Escape', { phase: 'title' }).nav.no).toBe(true);
  });

  it('[Right] multi-tela: SÓ o Jogador 1 comanda — a tecla do J2 vira aviso, não navegação', () => {
    const d = decide('ArrowUp', dois); // ArrowUp é `up` do J2
    expect(d).toEqual({ kind: 'title', wait: true, nav: null, preventDefault: true });
  });

  it('[Right] multi-tela: a tecla do J1 navega normalmente', () => {
    const d = decide('KeyW', dois); // `up` do J1
    expect(d.wait).toBe(false);
    expect(d.nav.up).toBe(true);
  });

  it('[Boundary] tecla GENÉRICA (de ninguém) não é do J2 — passa, mesmo em multi-tela', () => {
    const d = decide('Enter', dois);
    expect(d.wait).toBe(false);
    expect(d.nav.yes).toBe(true);
  });

  it('[Zero] tecla sem intenção nenhuma não é consumida (nav null, sem preventDefault)', () => {
    const d = decide('KeyQ', { phase: 'title' });
    expect(d).toEqual({ kind: 'title', wait: false, nav: null, preventDefault: false });
  });

  // ASSIMETRIA REAL, preservada verbatim do monólito — pinada como está HOJE, não como deveria ser.
  it('[Boundary] cima/baixo aceitam as setas ALÉM do remap; esquerda/direita NÃO (assimetria preservada)', () => {
    const remap = { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], run: ['KeyU'], jump: ['KeyJ'], swap: ['KeyI'], especial: ['KeyK'] };
    const s = snap({ phase: 'title', players: [mkPlayer(0, remap)], controls: { ...controlsFrom([remap]), up: remap.up, down: remap.down, left: remap.left, right: remap.right, jump: remap.jump, run: remap.run } });
    expect(decideKeydown(ev('ArrowUp'), s).nav.up).toBe(true);      // seta ainda sobe
    expect(decideKeydown(ev('ArrowLeft'), s).nav).toBeNull();       // seta NÃO anda para o lado
  });
});

/* ===================== 5. Alt+1..4 (número de telas) ===================== */

describe('Alt+1..4 = número de telas', () => {
  it('[Right] Alt+1..4 ativa 1..4 telas, jogando ou pausado', () => {
    for (const n of [1, 2, 3, 4]) {
      expect(decideKeydown(ev('Digit' + n, { altKey: true }), snap()).count).toBe(n);
    }
    expect(decideKeydown(ev('Digit2', { altKey: true }), snap({ phase: 'paused' })).kind).toBe('screens');
  });
  it('[Boundary] Digit5 não existe; Numpad1 não conta (é a FILEIRA de números, não o teclado numérico)', () => {
    expect(decideKeydown(ev('Digit5', { altKey: true }), snap()).kind).not.toBe('screens');
    expect(decideKeydown(ev('Numpad1', { altKey: true }), snap()).kind).not.toBe('screens');
    expect(SCREEN_DIGITS.test('Digit4')).toBe(true);
    expect(SCREEN_DIGITS.test('Digit0')).toBe(false);
  });
  it('[Error] Ctrl+Alt+1 NÃO conta (AltGr manda os dois; teclado latino digitaria um caractere)', () => {
    expect(decideKeydown(ev('Digit1', { altKey: true, ctrlKey: true }), snap()).kind).not.toBe('screens');
  });
  it('[Boundary] sem Alt, Digit2 é só uma tecla qualquer', () => {
    expect(decide('Digit2').kind).toBe('play');
  });
});

/* ===================== 6. pausa ===================== */

describe('Escape/Enter = pausa', () => {
  it('[Right] pausa jogando e despausa pausado', () => {
    expect(decide('Escape').kind).toBe('pause');
    expect(decide('Enter', { phase: 'paused' }).kind).toBe('pause');
  });
  it('[Boundary] NumpadEnter NÃO pausa (E14, verbatim)', () => {
    expect(PAUSE_KEYS.has('NumpadEnter')).toBe(false);
    expect(decide('NumpadEnter').kind).toBe('play');
  });
  it('[Right] pausar PREVINE o padrão (senão o Enter reativa o botão focado por baixo)', () => {
    expect(decide('Escape').preventDefault).toBe(true);
  });
});

/* ===================== 7. quiz — roteamento por DONO ===================== */

describe('quiz: a tecla age no quiz do DONO dela', () => {
  const quiz = { kind: 'shape' };
  const doisComQuizNoJ2 = () => ({
    players: [mkPlayer(0, P2A), mkPlayer(1, P2B, { quiz })],
    schemes: [P2A, P2B], numPlayers: 2,
  });
  const doisComQuizNoJ1 = () => ({
    players: [mkPlayer(0, P2A, { quiz }), mkPlayer(1, P2B)],
    schemes: [P2A, P2B], numPlayers: 2,
  });

  it('[Right] a tecla do J2 comanda o quiz do J2', () => {
    const d = decide('ArrowLeft', doisComQuizNoJ2());
    expect(d.kind).toBe('quiz');
    expect(d.playerIndex).toBe(1);
    expect(d.act).toEqual({ type: 'move', delta: -1 });
  });

  it('[Right] a tecla GENÉRICA cai no Jogador 1 (e em NINGUÉM mais)', () => {
    const d = decide('Enter', doisComQuizNoJ1());
    expect(d.kind).toBe('quiz');
    expect(d.playerIndex).toBe(0);
  });

  it('[Boundary] a tecla do J2 quando quem tem quiz é o J1 NÃO comanda o quiz do J1 — cai no jogo (a partida do J2 continua)', () => {
    const d = decide('ArrowLeft', doisComQuizNoJ1());
    expect(d.kind).toBe('play');
  });

  it('[Right] as quatro direções andam na grade de 3 colunas; pulo confirma; especial apaga', () => {
    const solo1 = { players: [mkPlayer(0, SOLO, { quiz })] };
    expect(decide('KeyA', solo1).act).toEqual({ type: 'move', delta: -1 });
    expect(decide('KeyD', solo1).act).toEqual({ type: 'move', delta: 1 });
    expect(decide('KeyW', solo1).act).toEqual({ type: 'move', delta: -3 });
    expect(decide('KeyS', solo1).act).toEqual({ type: 'move', delta: 3 });
    expect(decide('KeyJ', solo1).act).toEqual({ type: 'confirm' });
    expect(decide('KeyK', solo1).act).toEqual({ type: 'erase' });
  });

  it('[Right] braille tem caminho PRÓPRIO: cima DITA a cela, pulo confirma, e mais nada anda', () => {
    const cego = { players: [mkPlayer(0, SOLO, { quiz: { kind: 'braille' } })] };
    expect(decide('KeyW', cego).act).toEqual({ type: 'braille-announce' });
    expect(decide('KeyJ', cego).act).toEqual({ type: 'confirm' });
    expect(decide('KeyA', cego).act).toBeNull(); // esquerda NÃO move no braille
    expect(decide('KeyK', cego).act).toBeNull(); // especial NÃO apaga no braille
  });

  it('[Right] tecla de jogo sem significado no quiz mesmo assim PREVINE o padrão (senão `run` rolaria a página)', () => {
    const solo1 = { players: [mkPlayer(0, SOLO, { quiz })] };
    const d = decide('KeyU', solo1); // `run`: não é nenhuma das seis
    expect(d.act).toBeNull();
    expect(d.preventDefault).toBe(true);
  });

  it('[Boundary] tecla que NÃO é de jogo não previne o padrão dentro do quiz', () => {
    const solo1 = { players: [mkPlayer(0, SOLO, { quiz })] };
    expect(decide('Enter', solo1).preventDefault).toBe(false);
  });

  it('[Zero] ninguém com quiz aberto: o ramo do quiz nem é consultado', () => {
    expect(decide('KeyA').kind).toBe('play');
  });
});

/* ===================== 8. jogo normal ===================== */

describe('jogo normal: bordas, espera e empatia motora', () => {
  it('[Right] tecla de jogo previne o padrão (e é ela que esconde os botões de toque)', () => {
    const d = decide('KeyA');
    expect(d.kind).toBe('play');
    expect(d.gameKey).toBe(true);
    expect(d.preventDefault).toBe(true);
  });

  it('[Boundary] tecla que não é de ninguém não previne nada', () => {
    const d = decide('KeyQ');
    expect(d.gameKey).toBe(false);
    expect(d.preventDefault).toBe(false);
  });

  it('[Right] a BORDA só sobe quando a tecla ainda NÃO estava segurada (auto-repeat não vira dez pulos)', () => {
    expect(decide('KeyJ').edges).toEqual([{ playerIndex: 0, edge: 'jumpEdge' }]);
    expect(decide('KeyJ', { heldKeys: new Set(['KeyJ']) }).edges).toEqual([]);
  });

  it('[Right] cada jogador levanta a SUA borda, pela sua própria tecla', () => {
    const dois = { players: [mkPlayer(0, P2A), mkPlayer(1, P2B)], schemes: [P2A, P2B], numPlayers: 2 };
    expect(decide('Numpad5', dois).edges).toEqual([{ playerIndex: 1, edge: 'jumpEdge' }]);
  });

  it('[Right] Fácil não corre: a borda de corrida não sobe para quem está no modo Fácil', () => {
    const facil = { players: [mkPlayer(0, SOLO, { easy: true })] };
    expect(decide('KeyU', facil).edges).toEqual([]);
    expect(decide('KeyU').edges).toEqual([{ playerIndex: 0, edge: 'runEdge' }]); // e sobe para quem não está
  });

  it('[Right] Fácil SOLO ganha os atalhos: Ctrl = Especial, Shift = Trocar poder', () => {
    const facil = { players: [mkPlayer(0, SOLO, { easy: true })] };
    expect(decide('ControlLeft', facil).edges).toEqual([{ playerIndex: 0, edge: 'specialEdge' }]);
    expect(decide('ShiftRight', facil).edges).toEqual([{ playerIndex: 0, edge: 'swapEdge' }]);
    expect(decide('ControlLeft', facil).gameKey).toBe(true); // e contam como tecla de jogo
  });

  it('[Boundary] os atalhos do Fácil NÃO valem em multi-tela (Ctrl/Shift voltam a ser teclas de sistema)', () => {
    const dois = { players: [mkPlayer(0, P2A, { easy: true }), mkPlayer(1, P2B)], schemes: [P2A, P2B], numPlayers: 2 };
    expect(decide('ControlLeft', dois).edges).toEqual([]);
    expect(decide('ControlLeft', dois).gameKey).toBe(false);
  });

  it('[Right] tela em ESPERA acorda com a tecla DAQUELE jogador — e não com a de outro', () => {
    const dois = {
      players: [mkPlayer(0, P2A), mkPlayer(1, P2B, { waiting: true })],
      schemes: [P2A, P2B], numPlayers: 2,
    };
    expect(decide('Numpad5', dois).wake).toEqual([1]); // tecla do J2 acorda o J2
    expect(decide('KeyJ', dois).wake).toEqual([]);     // tecla do J1 não acorda ninguém
  });

  it('[Right] empatia "um botão por vez": a tecla nova solta as OUTRAS teclas de jogo', () => {
    const held = new Set(['KeyA', 'KeyQ']); // KeyA é de jogo, KeyQ não
    const d = decide('KeyD', { heldKeys: held, oneButton: true });
    expect(d.releaseKeys).toEqual(['KeyA']);
  });

  it('[Zero] sem a empatia ligada, nada é solto', () => {
    expect(decide('KeyD', { heldKeys: new Set(['KeyA']) }).releaseKeys).toEqual([]);
  });

  it('[Boundary] com a empatia ligada, tecla que NÃO é de jogo não solta nada', () => {
    expect(decide('KeyQ', { heldKeys: new Set(['KeyA']), oneButton: true }).releaseKeys).toEqual([]);
  });
});

/* ===================== 9. os predicados, isolados ===================== */

describe('predicados puros', () => {
  it('isJumpKey: o alias do J1 OU a ação `jump` de qualquer jogador', () => {
    const dois = snap({ players: [mkPlayer(0, P2A), mkPlayer(1, P2B)], schemes: [P2A, P2B], numPlayers: 2 });
    expect(isJumpKey('Numpad5', dois)).toBe(true);
    expect(isJumpKey('KeyQ', dois)).toBe(false);
  });
  it('isGameKeyCode NÃO inclui os atalhos do Fácil (por isso `easyKey` é somado à parte)', () => {
    const facil = snap({ players: [mkPlayer(0, SOLO, { easy: true })] });
    expect(isGameKeyCode('ControlLeft', facil)).toBe(false);
    expect(isEasyShortcut('ControlLeft', facil)).toBe(true);
    expect([...EASY_SHORTCUTS].sort()).toEqual(['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight']);
  });
  it('hasTitleIntent: sem intenção, a tecla não é consumida', () => {
    const s = snap({ phase: 'title' });
    expect(hasTitleIntent(titleNavOf('KeyQ', s, false))).toBe(false);
    expect(hasTitleIntent(titleNavOf('Enter', s, false))).toBe(true);
  });
  it('quizOwnerIndex: -1 quando o dono da tecla não tem quiz aberto', () => {
    const s = snap({ players: [mkPlayer(0, P2A, { quiz: { kind: 'shape' } }), mkPlayer(1, P2B)], schemes: [P2A, P2B], numPlayers: 2 });
    expect(quizOwnerIndex('KeyJ', s)).toBe(0);
    expect(quizOwnerIndex('Numpad5', s)).toBe(-1);
    expect(quizOwnerIndex('Enter', s)).toBe(0); // genérica → J1
  });
  it('quizActOf: jogador inexistente não estoura', () => {
    expect(() => quizActOf('KeyJ', snap(), 9, true)).not.toThrow();
    expect(quizActOf('KeyJ', snap(), 9, true)).toBeNull();
  });
  it('edgesFor: esquema sem a ação não estoura (guarda NOVA, declarada no cabeçalho)', () => {
    const torto = snap({ players: [mkPlayer(0, { left: ['KeyA'] })] });
    expect(() => edgesFor('KeyA', torto)).not.toThrow();
    expect(edgesFor('KeyA', torto)).toEqual([{ playerIndex: 0, edge: 'leftEdge' }]);
  });
  it('a tabela de bordas cobre as seis ações, nesta ordem', () => {
    expect(EDGE_BY_ACTION.map(([a]) => a)).toEqual(['jump', 'run', 'left', 'right', 'swap', 'especial']);
  });
});

/* ===================== 10. o wrapper: as sondas, a ordem e o efeito ===================== */

/** ctx de mentira: nada de DOM real (o `$` devolve objetos simples), tudo espionado. */
function mkCtx(over = {}) {
  const els = over.els || {};
  const players = over.players || [mkPlayer(0, SOLO)];
  const schemes = players.map((p) => p.ctrl || {});
  const heldKeys = over.heldKeys || new Set();
  const calls = [];
  const spy = (name) => (...args) => { calls.push([name, ...args]); };
  const ctx = {
    attractOnInput: over.attractOnInput || (() => false),
    handleCaptureKeydown: over.handleCaptureKeydown || (() => false),
    getNumPlayers: () => players.length,
    getPlayers: () => players,
    getControls: () => controlsFrom(schemes),
    heldKeys,
    isOneButton: () => !!over.oneButton,
    actionOf: (code, i) => actionForCode(schemes[i] || {}, code),
    whichPlayer: (code) => { for (let i = 0; i < schemes.length; i++) if (actionForCode(schemes[i], code)) return i; return -1; },
    $: (sel) => els[sel] || null,
    escapeTarget: () => over.escapeTargetId || null,
    closeOverlayById: spy('closeOverlayById'),
    closePadWiz: spy('closePadWiz'),
    hideTouchControls: spy('hideTouchControls'),
    srSay: spy('srSay'),
    navTitle: spy('navTitle'),
    activateScreens: spy('activateScreens'),
    togglePause: spy('togglePause'),
    quizMove: spy('quizMove'),
    quizConfirm: spy('quizConfirm'),
    quizErase: spy('quizErase'),
    announceBraille: spy('announceBraille'),
    clearWaitingBadge: spy('clearWaitingBadge'),
    win: { addEventListener: spy('addEventListener') },
  };
  return { ctx, calls, players, heldKeys, names: () => calls.map((c) => c[0]) };
}

const fire = (api, code, mods = {}) => {
  const prevented = [];
  api.onKeydown({ code, altKey: false, ctrlKey: false, preventDefault: () => prevented.push(code), ...mods });
  return prevented.length > 0;
};

describe('initKeydown — as sondas vêm ANTES de tudo', () => {
  beforeEach(() => setPhaseValue('playing'));

  it('[Right] a demo (attract) come a tecla: nada mais roda, nem com diálogo aberto', () => {
    const { ctx, names } = mkCtx({ attractOnInput: () => true, escapeTargetId: 'audio' });
    const api = initKeydown(ctx);
    expect(fire(api, 'Escape')).toBe(true);     // preventDefault
    expect(names()).toEqual([]);                // e NENHUM efeito da cadeia
  });

  it('[Right] a demo vem ANTES da captura: com as duas ativas, a captura nem é consultada', () => {
    let capturas = 0;
    const { ctx, names } = mkCtx({ attractOnInput: () => true, handleCaptureKeydown: () => { capturas++; return true; } });
    expect(fire(initKeydown(ctx), 'KeyZ')).toBe(true);
    expect(capturas).toBe(0);
    expect(names()).toEqual([]);
  });

  it('[Right] a captura de remapeamento vem depois da demo e antes da cadeia', () => {
    const seen = [];
    const { ctx, names } = mkCtx({
      handleCaptureKeydown: (e) => { seen.push(e.code); return true; },
      escapeTargetId: 'options',
    });
    const api = initKeydown(ctx);
    expect(fire(api, 'KeyZ')).toBe(false);      // a captura NÃO passa por preventDefault daqui
    expect(seen).toEqual(['KeyZ']);
    expect(names()).toEqual([]);
  });

  it('[Right] com a captura recusando, a cadeia segue', () => {
    const { ctx, names } = mkCtx({ escapeTargetId: 'options' });
    const api = initKeydown(ctx);
    fire(api, 'Escape');
    expect(names()).toEqual(['closeOverlayById']);
  });
});

describe('initKeydown — o efeito de cada ramo', () => {
  beforeEach(() => setPhaseValue('playing'));

  it('#touchcfg: Escape esconde o elemento de verdade', () => {
    const el = { hidden: false };
    const { ctx } = mkCtx({ els: { '#touchcfg': el } });
    const api = initKeydown(ctx);
    fire(api, 'Escape');
    expect(el.hidden).toBe(true);
  });

  it('#padwiz: Escape CANCELA (save=false)', () => {
    const { ctx, calls } = mkCtx({ els: { '#padwiz': { hidden: false } } });
    initKeydown(ctx).onKeydown({ code: 'Escape', altKey: false, ctrlKey: false, preventDefault: () => {} });
    expect(calls).toEqual([['closePadWiz', false]]);
  });

  it('vitória: o pulo clica o botão "Jogar de novo"', () => {
    let clicked = 0;
    const { ctx } = mkCtx({ els: { '#win-overlay': { hidden: false }, '#btn-again': { click: () => { clicked++; } } } });
    fire(initKeydown(ctx), 'KeyJ');
    expect(clicked).toBe(1);
  });

  it('vitória sem o botão no documento: não estoura', () => {
    const { ctx } = mkCtx({ els: { '#win-overlay': { hidden: false } } });
    expect(() => fire(initKeydown(ctx), 'KeyJ')).not.toThrow();
  });

  it('título: esconde os controles de toque ANTES do aviso, e o aviso é o do Jogador 1', () => {
    setPhaseValue('title');
    const { ctx, calls, names } = mkCtx({ players: [mkPlayer(0, P2A), mkPlayer(1, P2B)] });
    fire(initKeydown(ctx), 'ArrowUp'); // tecla do J2
    expect(names()).toEqual(['hideTouchControls', 'srSay']);
    expect(calls[1][1]).toMatch(/Jogador 1/);
  });

  it('título: a tecla do J1 vai para navTitle com a intenção montada', () => {
    setPhaseValue('title');
    const { ctx, calls } = mkCtx();
    fire(initKeydown(ctx), 'ArrowUp');
    expect(calls[1][0]).toBe('navTitle');
    expect(calls[1][1].up).toBe(true);
  });

  it('Alt+3 chama activateScreens(3); Escape chama togglePause()', () => {
    const a = mkCtx(); fire(initKeydown(a.ctx), 'Digit3', { altKey: true });
    expect(a.calls).toEqual([['activateScreens', 3]]);
    const b = mkCtx(); fire(initKeydown(b.ctx), 'Escape');
    expect(b.calls).toEqual([['togglePause']]);
  });

  it('quiz: as quatro funções são chamadas com o OBJETO do jogador dono', () => {
    const players = [mkPlayer(0, P2A), mkPlayer(1, P2B, { quiz: { kind: 'shape' } })];
    const { ctx, calls } = mkCtx({ players });
    const api = initKeydown(ctx);
    fire(api, 'ArrowLeft'); fire(api, 'Numpad5'); fire(api, 'Numpad6');
    expect(calls).toEqual([['quizMove', players[1], -1], ['quizConfirm', players[1]], ['quizErase', players[1]]]);
  });

  it('quiz braille: cima dita a cela', () => {
    const players = [mkPlayer(0, SOLO, { quiz: { kind: 'braille' } })];
    const { ctx, calls } = mkCtx({ players });
    fire(initKeydown(ctx), 'KeyW');
    expect(calls).toEqual([['announceBraille', players[0]]]);
  });

  it('jogo: a tecla entra em `keys`, a borda sobe e os botões de toque somem com motivo "teclado"', () => {
    const { ctx, calls, players, heldKeys } = mkCtx();
    fire(initKeydown(ctx), 'KeyJ');
    expect(heldKeys.has('KeyJ')).toBe(true);
    expect(players[0].jumpEdge).toBe(true);
    expect(calls).toEqual([['hideTouchControls', 'teclado']]);
  });

  it('jogo: a tela em espera entra, o selo some e o leitor de tela anuncia', () => {
    const players = [mkPlayer(0, P2A), mkPlayer(1, P2B, { waiting: true })];
    const { ctx, calls } = mkCtx({ players });
    fire(initKeydown(ctx), 'Numpad5');
    expect(players[1].waiting).toBe(false);
    expect(calls).toContainEqual(['clearWaitingBadge', 1]);
    expect(calls).toContainEqual(['srSay', 'Jogador 2 entrou!']);
  });

  it('empatia "um botão por vez": solta as outras E MANTÉM a recém-chegada', () => {
    const { ctx, heldKeys } = mkCtx({ oneButton: true, heldKeys: new Set(['KeyA', 'KeyD']) });
    fire(initKeydown(ctx), 'KeyD'); // a própria tecla estava na lista: sai na limpeza e volta no fim
    expect([...heldKeys]).toEqual(['KeyD']);
  });

  it('keyup tira a tecla de `keys`; attach instala os DOIS ouvintes, em bolha', () => {
    const { ctx, calls, heldKeys } = mkCtx({ heldKeys: new Set(['KeyJ']) });
    const api = initKeydown(ctx);
    api.onKeyup({ code: 'KeyJ' });
    expect(heldKeys.has('KeyJ')).toBe(false);
    api.attach();
    expect(calls.map((c) => c[1])).toEqual(['keydown', 'keyup']);
    expect(calls[0].length).toBe(3); // (tipo, fn) — sem o terceiro argumento de CAPTURA
  });

  it('snapshot() lê a fase VIVA de core/state', () => {
    const { ctx } = mkCtx();
    const api = initKeydown(ctx);
    setPhaseValue('paused');
    expect(api.snapshot().phase).toBe('paused');
  });
});
