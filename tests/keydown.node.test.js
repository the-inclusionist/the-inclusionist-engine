// SPDX-License-Identifier: AGPL-3.0-or-later
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
// ⚠️ O PAR VERDADEIRO, E NÃO UM DUPLO DELE (ADR-0109). Escrever um `marcarTecla` de mentira aqui seria uma
// SEGUNDA implementação da regra, e então o caso afirmaria que a minha cópia concorda com a minha asserção —
// as duas mexem-se juntas e nenhuma falha. Com o par a sério, o `heldKeys` que o caso lê é o conjunto que o
// jogo lê, e o mapa de origens ao lado dele é o que a alternância vai perguntar.
import {
  keys as keysReais, origemDaTecla, marcarTecla, marcarTeclaSemOrigem, soltarTecla, soltarTodas,
} from '../app/js/input/state.js';
import { carimbarOrigem } from '../app/js/input/origem-sintetica.js';
import {
  decideKeydown, initKeydown, isJumpKey, isGameKeyCode, isEasyShortcut,
  titleNavOf, hasTitleIntent, modalOwnerIndex, modalIntentOf, edgesFor,
  EASY_SHORTCUTS, PAUSE_KEYS, SCREEN_DIGITS, EDGE_BY_ACTION,
} from '../app/js/input/keydown.js';
// A CENA é do falso desde 2026-08-26. `phase` saiu de `core/state` (virou a pilha de `core/scenes`, ADR-0030
// C3) e chega ao teclado como dois BOOLEANOS no ctx. Este `let` é o que aqueles dois booleanos leem, e
// `setPhaseValue` continua existindo com o mesmo nome para os casos não mudarem de leitura.
let faseFalsa = 'playing';
const setPhaseValue = (p) => { faseFalsa = p; };

/* ===================== fixtures (esquemas de fábrica de input/keyboard.ts) ===================== */

const SOLO = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], action1: ['KeyU'], action2: ['KeyJ', 'Space'], action4: ['KeyI'], action3: ['KeyK'] };
const P2A = { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action1: ['KeyU'], action2: ['KeyJ'], action4: ['KeyI'], action3: ['KeyK'] };
const P2B = { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], action1: ['Numpad8'], action2: ['Numpad5'], action4: ['Numpad9'], action3: ['Numpad6'] };

// O JOGADOR NÃO CARREGA MAIS O DESAFIO (ADR-0033): `quiz` saiu de `core/entity`, e com ele saiu daqui. Quem
// diz se há modal aberto é o SNAPSHOT, por posição — `modal: [true, false]` nos casos abaixo. É a mudança que
// este arquivo inteiro mede, e ela encolheu o fixture: um objeto de desafio de mentira virou um booleano.
const mkPlayer = (i, ctrl, extra = {}) => ({ i, ctrl, waiting: false, easy: false, ...extra });

/** Reconstrói o `ControlsState` como input/keyboard-runtime.ts o computa: aliases SEMPRE do esquema solo,
 *  `gameKeys` = união de TODOS os esquemas ativos. (Repetir a conta aqui seria trapaça; a forma é copiada,
 *  mas os dados vêm dos esquemas de fábrica, iguais aos do jogo.) */
function controlsFrom(schemes) {
  const { action2, left, right, up, down, action1 } = SOLO;
  const set = new Set();
  schemes.forEach((s) => { for (const a in s) for (const c of s[a]) set.add(c); });
  return { action2, left, right, up, down, action1, gameKeys: [...set] };
}

/** Um mundo. Tudo tem padrão de "jogando, solo, nada aberto"; cada caso muda só o que interessa. */
function snap(over = {}) {
  const players = over.players || [mkPlayer(0, SOLO)];
  const schemes = over.schemes || players.map((p) => p.ctrl || {});
  const numPlayers = over.numPlayers ?? players.length;
  const active = schemes.slice(0, numPlayers);
  // 2026-08-26: o snapshot deixou de carregar `phase: string` e passou a carregar dois BOOLEANOS — a engine
  // não conhece mais o vocabulário de cenas deste jogo (ADR-0030 C3). Os casos seguem escrevendo
  // `{ phase: 'title' }`, que é como se lê melhor; a tradução é feita aqui, em UM lugar.
  const fase = over.phase || 'playing';
  const base = {
    telaDeTitulo: fase === 'title',
    emJogo: fase === 'playing' || fase === 'paused',
    numPlayers,
    players,
    controls: over.controls || controlsFrom(active),
    // `modal` no `over` é atalho de escrita: os casos dizem `{ modal: [true] }` e o snapshot recebe
    // `modalOpen`. Sem ele, cada caso teria de montar um array do tamanho de `players`, e o ruído esconderia
    // o que o caso mede.
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

/* ===================== 1. PRECEDÊNCIA — os casos que valem por dez ===================== */

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

  it('[precedência] com MODAL aberto, Alt+2 NÃO troca o número de telas', () => {
    const d = decideKeydown(ev('Digit2', { altKey: true }), snap(withQuiz));
    expect(d.kind).not.toBe('screens');
  });

  it('[precedência] com MODAL aberto, Enter CONFIRMA o desafio em vez de pausar', () => {
    // Enter não é tecla de nenhum esquema → genérica → cai no quiz do P1, onde não é nada
    const d = decide('Enter', withQuiz);
    expect(d.kind).toBe('modal');
    expect(d.kind === 'modal' && d.intent).toBeNull();
    // e a tecla de PULO do P1 (que é `jump` no esquema) confirma de verdade
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
    const remap = { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action1: ['KeyU'], action2: ['KeyJ'], action4: ['KeyI'], action3: ['KeyK'] };
    const s = snap({ phase: 'title', players: [mkPlayer(0, remap)], controls: { ...controlsFrom([remap]), up: remap.up, down: remap.down, left: remap.left, right: remap.right, action2: remap.action2, action1: remap.action1 } });
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
    // Este caso mudou de assunto no ADR-0033, e a mudança É o item: ele afirmava a GRADE
    // (`{type:'move', delta:-3}` para cima, `-1` para a esquerda) e o desvio de Braille. Isso é layout do
    // desafio DESTE jogo, e saiu para `game/quiz`. O que a engine entrega é a direção; o que ela significa
    // não é mais pergunta que este arquivo possa responder.
    const solo1 = { players: [mkPlayer(0, SOLO)], modal: [true] };
    expect(decide('KeyA', solo1).intent).toBe('left');
    expect(decide('KeyD', solo1).intent).toBe('right');
    expect(decide('KeyW', solo1).intent).toBe('up');
    expect(decide('KeyS', solo1).intent).toBe('down');
    expect(decide('KeyJ', solo1).intent).toBe('confirm');
    expect(decide('KeyK', solo1).intent).toBe('erase');
  });

  it('[Right] a ORDEM das seis é a especificação: uma tecla que é `left` E `jump` vale `left`', () => {
    // Este caso NASCEU de uma mutação que passou. Inverti a ordem no módulo — `confirm` antes de `left` — e
    // os 74 casos continuaram verdes, o que significa que a ordem estava escrita só num comentário. Uma
    // afirmação sem teste é uma afirmação que a próxima refatoração apaga sem avisar.
    //
    // O caminho GENÉRICO é onde a ordem pode ser exercida: sem dono, as seis leituras saem das listas de
    // `controls`, e um mesmo código pode estar em duas delas. Com dono, `actionOf` devolve UMA ação e o
    // conflito não existe.
    const s2 = snap({
      players: [mkPlayer(0, SOLO)], modal: [true],
      controls: { ...controlsFrom([SOLO]), left: ['Numpad0'], action2: ['Numpad0'], right: [], up: [], down: [], action1: [], gameKeys: ['Numpad0'] },
    });
    // `Numpad0` não pertence a esquema nenhum → genérica → as seis leituras vêm de `controls`
    expect(modalIntentOf('Numpad0', s2, 0, true)).toBe('left');
  });

  it('[Zero] tecla sem significado no esquema vira intenção NULA — e ainda assim é do modal', () => {
    // A distinção que o `preventDefault` depende: a tecla É do modal (o desafio a engole), mesmo quando não
    // exprime intenção nenhuma. Se este caso caísse para `play`, a tecla vazaria para o jogo por baixo do
    // desafio aberto.
    const solo1 = { players: [mkPlayer(0, SOLO)], modal: [true] };
    const d = decide('KeyZ', solo1);
    expect(d.kind).toBe('modal');
    expect(d.intent).toBeNull();
  });

  it('[Right] tecla de jogo sem significado no modal mesmo assim PREVINE o padrão (senão `run` rolaria a página)', () => {
    const solo1 = { players: [mkPlayer(0, SOLO)], modal: [true] };
    const d = decide('KeyU', solo1); // `run`: não é nenhuma das seis
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

/* ===================== 10. o wrapper: as sondas, a ordem e o efeito ===================== */

/** ctx de mentira: nada de DOM real (o `$` devolve objetos simples), tudo espionado. */
function mkCtx(over = {}) {
  const els = over.els || {};
  const players = over.players || [mkPlayer(0, SOLO)];
  const schemes = players.map((p) => p.ctrl || {});
  // O conjunto é o do módulo — `soltarTodas()` no `beforeEach` é o que o mantém limpo entre casos. As teclas
  // semeadas entram pelo par, com origem `'teclado'`: um caso que semeia está a dizer «isto já estava
  // segurado», e no mundo real algo o segurou.
  soltarTodas();
  for (const k of (over.heldKeys || [])) marcarTecla(k, 'teclado');
  const heldKeys = keysReais;
  const calls = [];
  const spy = (name) => (...args) => { calls.push([name, ...args]); };
  const ctx = {
    attractOnInput: over.attractOnInput || (() => false),
    handleCaptureKeydown: over.handleCaptureKeydown || (() => false),
    // Os dois fatos da cena (ADR-0030 C3). O falso guarda a string, como os casos se leem.
    isTelaDeTitulo: () => (over.phase || faseFalsa) === 'title',
    isEmJogo: () => { const f = over.phase || faseFalsa; return f === 'playing' || f === 'paused'; },
    getNumPlayers: () => players.length,
    getPlayers: () => players,
    getControls: () => controlsFrom(schemes),
    heldKeys,
    marcarTecla,
    marcarTeclaSemOrigem,
    soltarTecla,
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
    // UMA entrada onde havia quatro (ADR-0033): `quizMove`/`quizConfirm`/`quizErase`/`announceBraille` só
    // existiam porque a decisão de qual chamar morava no módulo. O espião registra a INTENÇÃO, que é o que
    // a engine passou a entregar.
    modalInput: spy('modalInput'),
    hasModal: (i) => !!(players[i] && players[i].modalAberto),
    clearWaitingBadge: spy('clearWaitingBadge'),
    win: { addEventListener: spy('addEventListener') },
  };
  return { ctx, calls, players, heldKeys, origens: origemDaTecla, names: () => calls.map((c) => c[0]) };
}

const fire = (api, code, mods = {}) => {
  const prevented = [];
  // ⚠️ `isTrusted: true` POR PADRÃO, e antes do `...mods` para um caso o poder contrariar: `fire` neste
  // ficheiro significa «uma criança carregou numa tecla», e é isso que `isTrusted` quer dizer. Deixá-lo de
  // fora faria todos estes casos exercitarem, sem o dizerem, o caminho do evento sintético não assinado.
  api.onKeydown({ code, altKey: false, ctrlKey: false, isTrusted: true, preventDefault: () => prevented.push(code), ...mods });
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

  it('modal: a INTENÇÃO chega com o ÍNDICE do jogador dono', () => {
    // Eram QUATRO funções no ctx (`quizMove`/`quizConfirm`/`quizErase`/`announceBraille`) e este caso as
    // afirmava uma a uma, com os deltas da grade. Virou uma, e o que resta a afirmar é o que a engine de
    // fato decide: QUEM é o dono e QUAL direção foi pedida (ADR-0033).
    //
    // E passou a ser o ÍNDICE e não o objeto: este módulo buscava o jogador só para repassá-lo, e o jogador
    // que ele sabe descrever não tem `quiz` — que é justamente o que o outro lado lê. Passar o índice tira
    // da engine a necessidade de saber o que é um jogador com desafio aberto.
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
    // O caso dizia "quiz braille: cima dita a cela", e a frase é verdadeira sobre o JOGO, não sobre a engine.
    // Ditar a cela é o que a atividade de alfabetização faz com `up`; o despacho de teclado só entrega `up`.
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
    fire(initKeydown(ctx), 'KeyJ'); // `fire` é uma criança a carregar: `isTrusted: true`
    expect(origens.get('KeyJ')).toBe('teclado');
  });

  it('⚠️ A TECLA DA WEBCAM NÃO É LIDA COMO TECLADO — o §C da #114, de ponta a ponta', () => {
    // ⚠️ ESTE É O CASO QUE A ISSUE ESPEROU DOIS MESES, e o defeito que ele prende não tem sintoma: a criança
    // que joga por olhar dependia da alternância, e um evento sintético carimbado `teclado` accionaria a regra
    // 3 do ADR-0109 («apertar uma tecla devolve o teclado SEM alternância») — desligando-a no meio da partida,
    // sem erro e sem nada na tela. O `ui/webcam` carimba, e é o carimbo que atravessa até aqui.
    const { ctx, heldKeys, origens } = mkCtx();
    const api = initKeydown(ctx);
    api.onKeydown(carimbarOrigem(
      { code: 'KeyJ', altKey: false, ctrlKey: false, isTrusted: false, preventDefault: () => {} },
      'olhos',
    ));
    expect(heldKeys.has('KeyJ')).toBe(true);
    expect(origens.get('KeyJ')).toBe('olhos');
  });

  it('⚠️ um sintético que NINGUÉM assinou funciona, mas não finge saber de onde veio', () => {
    // Código de consumidor que despacha teclas continua a jogar; o que ele não faz é herdar uma origem alheia.
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

  // Este caso mudou de FONTE em 2026-08-26 e não de garantia. A fase saiu de `core/state` (virou a pilha de
  // `core/scenes`) e chega por dois booleanos no ctx — mas a coisa que ele guarda é a mesma e continua sendo
  // a que importa: o snapshot PERGUNTA a cada tecla, em vez de copiar a cena no init. Um `const emJogo =
  // ctx.isEmJogo()` guardado no init faria este caso falhar, e o teclado do jogo pararia de responder à
  // pausa sem que nada ficasse vermelho.
  it('snapshot() PERGUNTA a cena a cada tecla, não a copia no init', () => {
    const { ctx } = mkCtx();
    const api = initKeydown(ctx);
    setPhaseValue('paused');
    expect(api.snapshot()).toMatchObject({ telaDeTitulo: false, emJogo: true });
    setPhaseValue('title');
    expect(api.snapshot()).toMatchObject({ telaDeTitulo: true, emJogo: false });
  });
});
