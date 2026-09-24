// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of input/keydown — the keyboard's DECISION CHAIN, without a DOM (node project). ZOMBIES + Right-BICEP.
//
// What this file protects is not arithmetic: it is the PRECEDENCE ORDER of the guards. Every case answers the same
// question — "with this world and this key, which branch WINS?" — an answer that cannot be asserted while decision and
// effect are woven into the same `if`. So the most valuable cases here are the CONFLICTS (quiz open AND dialog visible;
// quiz open AND Alt+3; quiz open AND Enter), not the isolated branches: an isolated branch keeps passing even after
// someone swaps two guards.
//
// ROUTING BY OWNER is the other theme: with several screens, a key acts on the quiz of the player who OWNS it, and a
// generic key falls to Player 1. Getting it wrong breaks nothing visible — the game keeps responding — it simply makes
// the child of screen 2 drive screen 1's challenge.
//
// The shell (DOM, focus, real propagation, menu-nav's capture) is in keydown.browser.test.js and is NOT repeated here.
import { describe, it, expect, beforeEach } from 'vitest';
import { actionForCode } from '../app/js/input/keyboard-runtime.js';
// ⚠️ THE REAL PAIR, NOT A DOUBLE OF IT (ADR-0109). A fake `markKey` here would be a SECOND implementation of the rule,
// and the case would assert that a copy agrees with its own assertion — both move together and neither fails. With the
// real pair, the `heldKeys` the case reads is the set the game reads, and the origin map beside it is what the latch
// will ask.
import {
  keys as keysReais, keySource, markKey, markKeyWithoutSource, releaseKey, releaseAllKeys,
  // 📌 THE AUTOMATON IS REAL TOO, for the same reason: a fake `playerEdge` here would assert that a copy agrees with its
  // own assertion. With the real one, the `inputOf` the case reads is the one the latch will ask.
  playerEdge, inputOf, forgetInputs,
} from '../app/js/input/state.js';
import { stampSource } from '../app/js/input/synthetic-source.js';
import {
  decideKeydown, initKeydown, isJumpKey, isGameKeyCode, isEasyShortcut,
  titleNavOf, hasTitleIntent, modalOwnerIndex, modalIntentOf, edgesFor,
  EASY_SHORTCUTS, PAUSE_KEYS, SCREEN_DIGITS, EDGE_BY_ACTION,
} from '../app/js/input/keydown.js';
// The SCENE belongs to the fake: the phase is the `core/scenes` stack (ADR-0030 C3) and reaches the keyboard as two
// BOOLEANS in the ctx. This `let` is what those two booleans read, and `setPhaseValue` keeps the cases readable.
let faseFalsa = 'playing';
const setPhaseValue = (p) => { faseFalsa = p; };

/* ===================== fixtures (input/keyboard.ts factory schemes) ===================== */

const SOLO = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], action1: ['KeyU'], action2: ['KeyJ', 'Space'], action4: ['KeyI'], action3: ['KeyK'] };
const P2A = { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action1: ['KeyU'], action2: ['KeyJ'], action4: ['KeyI'], action3: ['KeyK'] };
const P2B = { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], action1: ['Numpad8'], action2: ['Numpad5'], action4: ['Numpad9'], action3: ['Numpad6'] };

// THE PLAYER DOES NOT CARRY THE CHALLENGE (ADR-0033): what says whether a modal is open is the SNAPSHOT, by position —
// `modal: [true, false]` in the cases below. A fake challenge object is a boolean.
const mkPlayer = (i, ctrl, extra = {}) => ({ i, ctrl, waiting: false, easy: false, ...extra });

/** Rebuilds the `ControlsState` as input/keyboard-runtime.ts computes it: aliases ALWAYS from the solo scheme,
 *  `gameKeys` = union of ALL active schemes. (Repeating the arithmetic here would be cheating; the shape is copied, but
 *  the data comes from the factory schemes, the same as the game's.) */
function controlsFrom(schemes) {
  const { action2, left, right, up, down, action1 } = SOLO;
  const set = new Set();
  schemes.forEach((s) => { for (const a in s) for (const c of s[a]) set.add(c); });
  return { action2, left, right, up, down, action1, gameKeys: [...set] };
}

/** A world. Everything defaults to "playing, solo, nothing open"; each case changes only what matters to it. */
function snap(over = {}) {
  const players = over.players || [mkPlayer(0, SOLO)];
  const schemes = over.schemes || players.map((p) => p.ctrl || {});
  const numPlayers = over.numPlayers ?? players.length;
  const active = schemes.slice(0, numPlayers);
  // The snapshot carries two BOOLEANS, not a `phase: string` — the engine does not know this game's scene vocabulary
  // (ADR-0030 C3). The cases write `{ phase: 'title' }`, which reads best; the translation happens here, in ONE place.
  const fase = over.phase || 'playing';
  const base = {
    titleScreen: fase === 'title',
    inGame: fase === 'playing' || fase === 'paused',
    numPlayers,
    players,
    controls: over.controls || controlsFrom(active),
    // `modal` in `over` is a writing shortcut: the cases say `{ modal: [true] }` and the snapshot receives `modalOpen`.
    // Without it, each case would build an array the size of `players`, and the noise would hide what the case measures.
    modalOpen: over.modal || players.map(() => false),
    heldKeys: over.heldKeys || new Set(),
    oneButton: false,
    escapeTargetId: null,
    touchCfgVisible: false,
    padWizVisible: false,
    winVisible: false,
    actionOf: (code, i) => actionForCode(schemes[i] || {}, code),
    whichPlayer: (code) => { for (let i = 0; i < active.length; i++) if (actionForCode(active[i], code)) return i; return -1; },
  };
  const { players: _p, schemes: _s, modal: _m, phase: _f, ...rest } = over;
  return { ...base, ...rest, players, numPlayers };
}

const ev = (code, mods = {}) => ({ code, altKey: false, ctrlKey: false, ...mods });
const decide = (code, over = {}, mods = {}) => decideKeydown(ev(code, mods), snap(over));

/* ===================== 1. PRECEDENCE — the cases worth ten ===================== */

describe('a ORDEM das guardas É a especificação', () => {
  const withQuiz = { players: [mkPlayer(0, SOLO)], modal: [true] };

  it('[precedência] diálogo REGISTRADO aberto vence o quiz aberto — o Escape fecha o diálogo, não confirma o desafio', () => {
    const d = decide('Escape', { ...withQuiz, escapeTargetId: 'audio' });
    expect(d.kind).toBe('overlay');
    expect(d.closeId).toBe('audio');
  });

  it('[precedência] com diálogo aberto, tecla de JOGO não chega ao jogo (é engolida, sem preventDefault)', () => {
    const d = decide('KeyJ', { ...withQuiz, escapeTargetId: 'audio' });
    expect(d.kind).toBe('overlay');
    expect(d.closeId).toBeNull();          // not Escape: closes nothing
    expect(d.preventDefault).toBe(false);  // the dialog is DOM and wants the native behaviour underneath
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

  it('[precedência] com MODAL aberto, Alt+2 NÃO troca o número de telas', () => {
    const d = decideKeydown(ev('Digit2', { altKey: true }), snap(withQuiz));
    expect(d.kind).not.toBe('screens');
  });

  it('[precedência] com MODAL aberto, Enter CONFIRMA o desafio em vez de pausar', () => {
    // Enter is in no scheme → generic → falls to P1's quiz, where it is nothing
    const d = decide('Enter', withQuiz);
    expect(d.kind).toBe('modal');
    expect(d.kind === 'modal' && d.intent).toBeNull();
    // and P1's JUMP key (`jump` in the scheme) really confirms
    const j = decide('KeyJ', withQuiz);
    expect(j.kind).toBe('modal');
    expect(j.intent).toBe('confirm');
  });

  it('[precedência] SEM modal, o mesmo Enter pausa', () => {
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

/* ===================== 3. victory screen ===================== */

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

/* ===================== 4. title screen ===================== */

describe('tela de título', () => {
  const dois = { phase: 'title', players: [mkPlayer(0, P2A), mkPlayer(1, P2B)], schemes: [P2A, P2B], numPlayers: 2 };

  it('[Right] solo: as setas navegam e o pulo confirma', () => {
    expect(decide('ArrowUp', { phase: 'title' }).nav.up).toBe(true);
    expect(decide('KeyJ', { phase: 'title' }).nav.yes).toBe(true);
    expect(decide('Escape', { phase: 'title' }).nav.no).toBe(true);
  });

  it('[Right] multi-tela: SÓ o Jogador 1 comanda — a tecla do J2 vira aviso, não navegação', () => {
    const d = decide('ArrowUp', dois); // ArrowUp is P2's `up`
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

  // A REAL ASYMMETRY, preserved verbatim — pinned as it IS, not as it should be.
  it('[Boundary] cima/baixo aceitam as setas ALÉM do remap; esquerda/direita NÃO (assimetria preservada)', () => {
    const remap = { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action1: ['KeyU'], action2: ['KeyJ'], action4: ['KeyI'], action3: ['KeyK'] };
    const s = snap({ phase: 'title', players: [mkPlayer(0, remap)], controls: { ...controlsFrom([remap]), up: remap.up, down: remap.down, left: remap.left, right: remap.right, action2: remap.action2, action1: remap.action1 } });
    expect(decideKeydown(ev('ArrowUp'), s).nav.up).toBe(true);      // the arrow still goes up
    expect(decideKeydown(ev('ArrowLeft'), s).nav).toBeNull();       // the arrow does NOT move sideways
  });
});

/* ===================== 5. Alt+1..4 (number of screens) ===================== */

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

/* ===================== 7. modal — roteamento por DONO ===================== */

describe('modal: a tecla age no modal do DONO dela', () => {
  const doisComModalNoJ2 = () => ({
    players: [mkPlayer(0, P2A), mkPlayer(1, P2B)], modal: [false, true],
    schemes: [P2A, P2B], numPlayers: 2,
  });
  const doisComModalNoJ1 = () => ({
    players: [mkPlayer(0, P2A), mkPlayer(1, P2B)], modal: [true, false],
    schemes: [P2A, P2B], numPlayers: 2,
  });

  it('[Right] a tecla do J2 comanda o modal do J2', () => {
    const d = decide('ArrowLeft', doisComModalNoJ2());
    expect(d.kind).toBe('modal');
    expect(d.playerIndex).toBe(1);
    expect(d.intent).toBe('left');
  });

  it('[Right] a tecla GENÉRICA cai no Jogador 1 (e em NINGUÉM mais)', () => {
    const d = decide('Enter', doisComModalNoJ1());
    expect(d.kind).toBe('modal');
    expect(d.playerIndex).toBe(0);
  });

  it('[Boundary] a tecla do J2 quando quem tem modal é o J1 NÃO comanda o modal do J1 — cai no jogo (a partida do J2 continua)', () => {
    const d = decide('ArrowLeft', doisComModalNoJ1());
    expect(d.kind).toBe('play');
  });

  it('[Right] as seis intenções saem do esquema de teclas — e SÓ isso sai daqui', () => {
    // The engine delivers the direction (ADR-0033); a grid's deltas and a Braille detour are the layout of one game's
    // challenge, which belongs to the game. What a direction means is not a question this file can answer.
    const solo1 = { players: [mkPlayer(0, SOLO)], modal: [true] };
    expect(decide('KeyA', solo1).intent).toBe('left');
    expect(decide('KeyD', solo1).intent).toBe('right');
    expect(decide('KeyW', solo1).intent).toBe('up');
    expect(decide('KeyS', solo1).intent).toBe('down');
    expect(decide('KeyJ', solo1).intent).toBe('confirm');
    expect(decide('KeyK', solo1).intent).toBe('erase');
  });

  it('[Right] a ORDEM das seis é a especificação: uma tecla que é `left` E `jump` vale `left`', () => {
    // This case CAME from a mutation that passed: swapping the order in the module — `confirm` before `left` — left every
    // other case green, so the order was written only in a comment. A claim without a test is one the next refactor
    // erases without warning.
    //
    // The GENERIC path is where the order can be exercised: with no owner, the six readings come from `controls`' lists,
    // and one code can be in two of them. With an owner, `actionOf` returns ONE action and there is no conflict.
    const s2 = snap({
      players: [mkPlayer(0, SOLO)], modal: [true],
      controls: { ...controlsFrom([SOLO]), left: ['Numpad0'], action2: ['Numpad0'], right: [], up: [], down: [], action1: [], gameKeys: ['Numpad0'] },
    });
    // `Numpad0` belongs to no scheme → generic → the six readings come from `controls`
    expect(modalIntentOf('Numpad0', s2, 0, true)).toBe('left');
  });

  it('[Zero] tecla sem significado no esquema vira intenção NULA — e ainda assim é do modal', () => {
    // The distinction `preventDefault` depends on: the key IS the modal's (the challenge swallows it), even when it
    // expresses no intent. If this case fell to `play`, the key would leak into the game under the open challenge.
    const solo1 = { players: [mkPlayer(0, SOLO)], modal: [true] };
    const d = decide('KeyZ', solo1);
    expect(d.kind).toBe('modal');
    expect(d.intent).toBeNull();
  });

  it('[Right] tecla de jogo sem significado no modal mesmo assim PREVINE o padrão (senão `run` rolaria a página)', () => {
    const solo1 = { players: [mkPlayer(0, SOLO)], modal: [true] };
    const d = decide('KeyU', solo1); // `run`: none of the six
    expect(d.intent).toBeNull();
    expect(d.preventDefault).toBe(true);
  });

  it('[Boundary] tecla que NÃO é de jogo não previne o padrão dentro do modal', () => {
    const solo1 = { players: [mkPlayer(0, SOLO)], modal: [true] };
    expect(decide('Enter', solo1).preventDefault).toBe(false);
  });

  it('[Zero] ninguém com modal aberto: o ramo do modal nem é consultado', () => {
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
    expect(decide('KeyU').edges).toEqual([{ playerIndex: 0, edge: 'runEdge' }]); // and it rises for whoever is not
  });

  it('[Right] Fácil SOLO ganha os atalhos: Ctrl = Especial, Shift = Trocar poder', () => {
    const facil = { players: [mkPlayer(0, SOLO, { easy: true })] };
    expect(decide('ControlLeft', facil).edges).toEqual([{ playerIndex: 0, edge: 'specialEdge' }]);
    expect(decide('ShiftRight', facil).edges).toEqual([{ playerIndex: 0, edge: 'swapEdge' }]);
    expect(decide('ControlLeft', facil).gameKey).toBe(true); // and they count as game keys
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
    expect(decide('Numpad5', dois).wake).toEqual([1]); // P2's key wakes P2
    expect(decide('KeyJ', dois).wake).toEqual([]);     // P1's key wakes nobody
  });

  it('[Right] empatia "um botão por vez": a tecla nova solta as OUTRAS teclas de jogo', () => {
    const held = new Set(['KeyA', 'KeyQ']); // KeyA is a game key, KeyQ is not
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
  it('modalOwnerIndex: -1 quando o dono da tecla não tem modal aberto', () => {
    const s = snap({ players: [mkPlayer(0, P2A), mkPlayer(1, P2B)], modal: [true, false], schemes: [P2A, P2B], numPlayers: 2 });
    expect(modalOwnerIndex('KeyJ', s)).toBe(0);
    expect(modalOwnerIndex('Numpad5', s)).toBe(-1);
    expect(modalOwnerIndex('Enter', s)).toBe(0); // genérica → J1
  });
  it('modalIntentOf: jogador inexistente não estoura', () => {
    expect(() => modalIntentOf('KeyJ', snap(), 9, true)).not.toThrow();
    expect(modalIntentOf('KeyJ', snap(), 9, true)).toBeNull();
  });
  it('edgesFor: esquema sem a ação não estoura (guarda NOVA, declarada no cabeçalho)', () => {
    const torto = snap({ players: [mkPlayer(0, { left: ['KeyA'] })] });
    expect(() => edgesFor('KeyA', torto)).not.toThrow();
    expect(edgesFor('KeyA', torto)).toEqual([{ playerIndex: 0, edge: 'leftEdge' }]);
  });
  it('a tabela de bordas cobre as seis ações, nesta ordem', () => {
    expect(EDGE_BY_ACTION.map(([a]) => a)).toEqual(['action2', 'action1', 'left', 'right', 'action4', 'action3']);
  });
});

/* ===================== 9b. what the chain refuses when there is no game (probed 2026-09-23) ===================== */

describe('the guards nothing was holding', () => {
  it('⚠️ with no title on top AND no game in play, neither Alt+digit nor Escape acts', () => {
    /*
     * 🎯 Both rows carry `inGame`, and the header explains the OTHER half of each condition (a modal must be
     * closed) while this half went unmeasured. The scene reaches this module as two independent booleans, so
     * «neither» is a state it has to answer for — and answering it with a pause or a screen reconfiguration
     * would act on a game that is not there.
     */
    const idle = { phase: 'loading' };
    expect(decide('Digit3', idle, { altKey: true }).kind, 'Alt+3 reconfigured the screens of a game that is not running').toBe('play');
    expect(decide('Escape', idle).kind, 'Escape paused a game that is not running').toBe('play');
  });

  it('⚠️ a key that only a seat\'s OWN scheme carries is still a game key', () => {
    /*
     * 📏 `controls.gameKeys` is the union of the schemes of the ACTIVE screens, while `p.ctrl` is assigned to
     * every player object there is. With one screen open, seat 2 still holds its scheme — and a key of it has
     * to be swallowed like any other game key, or it types into the page behind the game.
     */
    const s = snap({ players: [mkPlayer(0, P2A), mkPlayer(1, P2B)], numPlayers: 1 });
    expect(s.controls.gameKeys.includes('Numpad5'), 'the flattened list covers only the active screen').toBe(false);
    expect(isGameKeyCode('Numpad5', s), 'a key held by a seat stopped counting as a game key').toBe(true);
  });

  it('⚠️ Ctrl and Shift are the Easy shortcuts only when Easy mode is ON', () => {
    expect(isEasyShortcut('ControlLeft', snap({ players: [mkPlayer(0, SOLO)] })),
      'Ctrl became Special for a child who never asked for Easy mode').toBe(false);
    expect(isEasyShortcut('ControlLeft', snap({ players: [mkPlayer(0, SOLO, { easy: true })] })),
      'and with Easy mode on it is the shortcut').toBe(true);
  });

  it('⚠️ inside a modal, a key with NO owner still erases by the player\'s OWN scheme', () => {
    /*
     * 📌 There is no `action3` alias in `ControlsSnapshot` — the other five are there and this one is not — so a
     * generic key has nowhere else to be read from, and the module reaches into `pl.ctrl.action3`. That
     * asymmetry is argued in the module's header and was held by nothing.
     * ⚠️ `whichPlayer` is an injected FACT, so the case states it: «this key has no owner». That is the
     * question the module asks, and the answer is what selects this path.
     */
    const s = snap({ players: [mkPlayer(0, SOLO)], modal: [true], whichPlayer: () => -1 });
    expect(modalOwnerIndex('KeyK', s), 'a key with no owner falls on the modal of seat 1').toBe(0);
    expect(modalIntentOf('KeyK', s, 0, true), 'a generic Special key stopped erasing inside the modal').toBe('erase');
  });
});

/* ===================== 10. the wrapper: the probes, the order and the effect ===================== */

/** A fake ctx: no real DOM (`$` returns plain objects), everything spied. */
function mkCtx(over = {}) {
  const els = over.els || {};
  const players = over.players || [mkPlayer(0, SOLO)];
  const schemes = players.map((p) => p.ctrl || {});
  // The set is the module's — `releaseAllKeys()` in the `beforeEach` keeps it clean between cases. Seeded keys enter
  // through the pair, with origin `'teclado'`: a case that seeds is saying «isto já estava segurado», and in the real
  // world something held it.
  releaseAllKeys();
  for (const k of (over.heldKeys || [])) markKey(k, 'teclado');
  const heldKeys = keysReais;
  const calls = [];
  const spy = (name) => (...args) => { calls.push([name, ...args]); };
  const ctx = {
    attractOnInput: over.attractOnInput || (() => false),
    handleCaptureKeydown: over.handleCaptureKeydown || (() => false),
    // The scene's two facts (ADR-0030 C3). The fake keeps the string, as the cases read.
    isTitleScreen: () => (over.phase || faseFalsa) === 'title',
    isInGame: () => { const f = over.phase || faseFalsa; return f === 'playing' || f === 'paused'; },
    getNumPlayers: () => players.length,
    getPlayers: () => players,
    getControls: () => controlsFrom(schemes),
    heldKeys,
    markKey,
    markKeyWithoutSource,
    playerEdge,
    releaseKey,
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
    // ONE entry (ADR-0033): the spy records the INTENT, which is what the engine delivers — not one callback per action,
    // which would put the decision of which to call inside the module.
    modalInput: spy('modalInput'),
    hasModal: (i) => !!(players[i] && players[i].modalAberto),
    clearWaitingBadge: spy('clearWaitingBadge'),
    win: { addEventListener: spy('addEventListener') },
  };
  return { ctx, calls, players, heldKeys, origens: keySource, names: () => calls.map((c) => c[0]) };
}

const fire = (api, code, mods = {}) => {
  const prevented = [];
  // ⚠️ `isTrusted: true` BY DEFAULT, and before `...mods` so a case can override it: `fire` in this file means «uma
  // criança carregou numa tecla», which is what `isTrusted` means. Leaving it out would make all these cases exercise,
  // without saying so, the path of an unsigned synthetic event.
  api.onKeydown({ code, altKey: false, ctrlKey: false, isTrusted: true, preventDefault: () => prevented.push(code), ...mods });
  return prevented.length > 0;
};

describe('initKeydown — as sondas vêm ANTES de tudo', () => {
  beforeEach(() => setPhaseValue('playing'));

  it('[Right] a demo (attract) come a tecla: nada mais roda, nem com diálogo aberto', () => {
    const { ctx, names } = mkCtx({ attractOnInput: () => true, escapeTargetId: 'audio' });
    const api = initKeydown(ctx);
    expect(fire(api, 'Escape')).toBe(true);     // preventDefault
    expect(names()).toEqual([]);                // and NO effect of the chain
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
    expect(fire(api, 'KeyZ')).toBe(false);      // the capture does NOT go through preventDefault here
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

  it('modal: a INTENÇÃO chega com o ÍNDICE do jogador dono', () => {
    // What is asserted is what the engine actually decides: WHO the owner is and WHICH direction was asked (ADR-0033).
    //
    // And it is the INDEX, not the object: the player this module can describe has no `quiz` — which is exactly what the
    // other side reads. Passing the index spares the engine from knowing what a player with an open challenge is.
    const players = [mkPlayer(0, P2A), mkPlayer(1, P2B, { modalAberto: true })];
    const { ctx, calls } = mkCtx({ players });
    const api = initKeydown(ctx);
    fire(api, 'ArrowLeft'); fire(api, 'Numpad5'); fire(api, 'Numpad6');
    expect(calls).toEqual([
      ['modalInput', 1, 'left'],
      ['modalInput', 1, 'confirm'],
      ['modalInput', 1, 'erase'],
    ]);
  });

  it('modal: CIMA é uma intenção como as outras — o Braille deixou de ser caso especial AQUI', () => {
    // "Up dictates the Braille cell" is true about a GAME, not the engine. Dictating the cell is what a literacy activity
    // does with `up`; the keyboard dispatch only delivers `up`.
    const players = [mkPlayer(0, SOLO, { modalAberto: true })];
    const { ctx, calls } = mkCtx({ players });
    fire(initKeydown(ctx), 'KeyW');
    expect(calls).toEqual([['modalInput', 0, 'up']]);
  });

  it('jogo: a tecla entra em `keys`, a borda sobe e os botões de toque somem com motivo "teclado"', () => {
    const { ctx, calls, players, heldKeys } = mkCtx();
    fire(initKeydown(ctx), 'KeyJ');
    expect(heldKeys.has('KeyJ')).toBe(true);
    expect(players[0].jumpEdge).toBe(true);
    expect(calls).toEqual([['hideTouchControls', 'teclado']]);
  });

  it('⚠️ a tecla premida chega ao mapa carimbada `teclado` (ADR-0109)', () => {
    const { ctx, origens } = mkCtx();
    fire(initKeydown(ctx), 'KeyJ'); // `fire` is a child pressing: `isTrusted: true`
    expect(origens.get('KeyJ')).toBe('teclado');
  });

  it('⚠️ A TECLA DA WEBCAM NÃO É LIDA COMO TECLADO — o §C da #114, de ponta a ponta', () => {
    // ⚠️ The defect this holds has no symptom: the child who plays by gaze depends on the latch, and a synthetic event
    // stamped `teclado` would trigger rule 3 of ADR-0109 («apertar uma tecla devolve o teclado SEM alternância») —
    // turning it off mid-game, with no error and nothing on screen. The assisted transport stamps its keys, and the stamp
    // is what crosses to here.
    const { ctx, heldKeys, origens } = mkCtx();
    const api = initKeydown(ctx);
    api.onKeydown(stampSource(
      { code: 'KeyJ', altKey: false, ctrlKey: false, isTrusted: false, preventDefault: () => {} },
      'olhos',
    ));
    expect(heldKeys.has('KeyJ')).toBe(true);
    expect(origens.get('KeyJ')).toBe('olhos');
  });

  it('🎯 [Sequência] o carimbo ALIMENTA o autómato: olhar vira o transporte em uso, e uma tecla premida devolve o teclado', () => {
    // 🔴 THE CASE THE WHOLE WIRING NEEDS: with no `playerEdge` caller in production, `inputOf(i).inUse` would answer
    // `teclado` to everyone, forever, and the refusal of ADR-0113 clause 3 would NEVER fire — the child who plays by
    // camera could turn off the latch their input depends on, and nothing would say so (the state measured before
    // 2026-09-09).
    //
    // ⚠️ IT IS A SEQUENCE AND NOT A CALL: «apertar uma tecla devolve o teclado» (rule 3 of ADR-0109) means nothing without
    // having left it.
    forgetInputs();
    const { ctx } = mkCtx();
    const api = initKeydown(ctx);

    api.onKeydown(stampSource(
      { code: 'KeyJ', altKey: false, ctrlKey: false, isTrusted: false, preventDefault: () => {} },
      'olhos',
    ));
    expect(inputOf(0).inUse, 'o carimbo não chegou ao autómato: a webcam continua a ser lida como teclado').toBe('olhos');

    fire(api, 'KeyJ');
    expect(inputOf(0).inUse, 'uma tecla premida a sério tinha de devolver o teclado').toBe('teclado');
    forgetInputs();
  });

  it('⚠️ o sintético SEM assinatura não move o autómato — inventar-lhe `teclado` desligaria a alternância de quem joga por olhar', () => {
    forgetInputs();
    const { ctx } = mkCtx();
    const api = initKeydown(ctx);
    api.onKeydown(stampSource(
      { code: 'KeyJ', altKey: false, ctrlKey: false, isTrusted: false, preventDefault: () => {} },
      'olhos',
    ));
    fire(api, 'KeyJ', { isTrusted: false });     // ninguém assinou: origem desconhecida
    expect(inputOf(0).inUse, 'uma aresta sem origem foi contada como teclado').toBe('olhos');
    forgetInputs();
  });

  it('⚠️ a key that belongs to NO seat feeds the automaton of seat 1 — the same convention as ui/menu-nav', () => {
    // 📌 The module says it in a comment: «quem carrega numa tecla que não é de assento nenhum está a jogar no
    // primeiro assento». Passing the raw −1 through would feed nobody, and the switching refusal of ADR-0113
    // clause 3 would go on answering `teclado` for a child who plays by looking.
    forgetInputs();
    const { ctx } = mkCtx();
    const api = initKeydown(ctx);
    api.onKeydown(stampSource(
      { code: 'KeyZ', altKey: false, ctrlKey: false, isTrusted: false, preventDefault: () => {} },
      'olhos',
    ));
    expect(inputOf(0).inUse, 'a key of no seat left the automaton of seat 1 untouched').toBe('olhos');
    forgetInputs();
  });

  it('⚠️ um sintético que NINGUÉM assinou funciona, mas não finge saber de onde veio', () => {
    // Consumer code that dispatches keys still plays; what it does not do is inherit someone else's origin.
    const { ctx, heldKeys, origens } = mkCtx();
    fire(initKeydown(ctx), 'KeyJ', { isTrusted: false });
    expect(heldKeys.has('KeyJ')).toBe(true);
    expect(origens.has('KeyJ')).toBe(false);
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
    fire(initKeydown(ctx), 'KeyD'); // the key itself was on the list: it leaves in the clean-up and comes back at the end
    expect([...heldKeys]).toEqual(['KeyD']);
  });

  it('keyup tira a tecla de `keys`; attach instala os DOIS ouvintes, em bolha', () => {
    const { ctx, calls, heldKeys } = mkCtx({ heldKeys: new Set(['KeyJ']) });
    const api = initKeydown(ctx);
    api.onKeyup({ code: 'KeyJ' });
    expect(heldKeys.has('KeyJ')).toBe(false);
    api.attach();
    expect(calls.map((c) => c[1])).toEqual(['keydown', 'keyup']);
    expect(calls[0].length).toBe(3); // (type, fn) — without the third CAPTURE argument
  });

  // The phase arrives by two booleans in the ctx (the `core/scenes` stack), and what this case guards is that the
  // snapshot ASKS on every key instead of copying the scene at init. A `const emJogo = ctx.isEmJogo()` stored at init
  // would make this case fail, and the game's keyboard would stop responding to the pause with nothing turning red.
  it('snapshot() PERGUNTA a cena a cada tecla, não a copia no init', () => {
    const { ctx } = mkCtx();
    const api = initKeydown(ctx);
    setPhaseValue('paused');
    expect(api.snapshot()).toMatchObject({ titleScreen: false, inGame: true });
    setPhaseValue('title');
    expect(api.snapshot()).toMatchObject({ titleScreen: true, inGame: false });
  });
});

// 🔴 PROBED DECISION BY DECISION ON 2026-09-23, before `decideKeydown` (28 paths against McCabe's 10) is cut:
// fifty-five decisions of this module disabled one at a time, against every node file that imports it.
// **Forty-four went red**, which is the portrait of a module whose ORDER has been the point since it was written
// — and eleven did not. One of the eleven is held by `keydown.browser.test.js` (the decision's `preventDefault`
// reaching the event, measured there), six became the cases above, and **four cannot be held, for one reason**:
//   · 🟡 the title wait also asking `numPlayers > 1` — 📏 measured in `input/keyboard-runtime`: `whichPlayer`
//     scans `schemesForActivePlayers()`, which is `Array.from({length: getNumPlayers()})`. With one screen it
//     can only answer 0 or −1, so the extra half can never be the one that decides.
//   · 🟡 `isJumpKey` also reading the player 1 alias — the second half already walks every player, seat 1
//     included, and `actionOf` and the alias list are built from the same schemes.
//   · 🟡 the modal's `generic` flag — forcing it false makes `act = actionOf(code, pl.i)`, which is `null` for
//     exactly the keys that have no owner, so both paths end in the same aliases.
//   · 🟡 `if (!p.ctrl) return;` in `edgesFor` — the line below it already reads `p.ctrl?.[act] || []`, so the
//     guard is a fast path and not a rule.
// 🎯 And the four share a shape worth naming: each is a SECOND question whose answer the first already implies.
// They are not decoration — they hold if the two injected facts ever disagree — but no case can distinguish
// them today, and writing one would be dressing a double's inconsistency up as a rule.
