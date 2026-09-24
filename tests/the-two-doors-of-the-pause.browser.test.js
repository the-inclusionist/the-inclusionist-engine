// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TWO DOORS OF THE PAUSE: START is the QUICK PAUSE and SELECT opens the MENUS (ADR-0155, which partly supersedes
// ADR-0144 — and its erratum, the card with a way out, is still measured here).
//
// ========================= WHY THIS FILE EXISTS =========================
// 🔴 MEASURED on 2026-09-12: `createGame` mounted the pause card, the accessibility bar and four settings panels, and
// NOTHING revealed the card. ADR-0144 made `start` the door. The same day the Dev swapped the doors: «A barra sobre o
// jogo mais a palavra PAUSED no centro da tela. No entanto, esta deve passar a ser a opção do botão START, e o botão
// SELECT deve trazer à tona os diversos menus.» The file's name stays, because ADR-0144's `confirmed-by` points at it;
// what it measures is what ADR-0155 decided.
//
// 📌 IT HAS TO BE A BROWSER FILE: what is asserted is the PROPAGATION of a keyboard event through a real document, with
// `ui/menu-nav` listening in CAPTURE on the same window and these listeners in BUBBLE below it.
//
// ⚠️ AND IT HAS TO BE A FILE OF ITS OWN, with ONE root only. Each `createGame` hangs listeners on the `window` and nothing
// removes them; so the root is born once in `beforeAll` and the cartridge is swapped through `mount()` (ADR-0142).
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let motor;
let raiz;
/** The phases the GAME received — it is the cartridge's `setPhase`, not the engine's. */
let fases;

const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  holdsAtOnce: () => 1,
  holdsKeys: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'primeira pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});
const comGancho = () => ({ accommodations: SEM_ASSUNTO, setPhase: (p) => fases.push(p) });

/** The key as the child gives it: dispatched on the game region, bubbling up to whoever wants it. */
function apertar(code) {
  const alvo = raiz.querySelector('#game-region');
  const ev = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true });
  alvo.dispatchEvent(ev);
  return ev;
}

const cartao = () => document.getElementById('vp-pause-0');
const item = (act) => document.querySelector(`#vp-pause-0 .pm-btn[data-act="${act}"]`);
const pausado = () => document.querySelector('#game-region .pausa-rapida');
/** PAUSED in sight — by the layout, not only by the attribute: the layout is what the child asks. */
const pausadoAVista = () => !!pausado() && pausado().hidden === false && pausado().offsetParent !== null;
const cursorNaBarra = () => document.querySelectorAll('.pi-sel').length;

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  fases = [];
  motor = createGame({ declaration: declaracaoValida(), host: { doc: document, win: window }, downloadHeavy: false, ...comGancho() });
});

beforeEach(() => {
  // A panel a previous case opened must not decide the next: the listeners' first guard is exactly «há um painel aberto?».
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
  // ⚠️ AND A QUICK PAUSE a case left on has to leave through the DOOR — there is no public API that turns it off, on
  // purpose: the child also only has it through START.
  if (pausadoAVista()) apertar('KeyH');
  fases.length = 0;
});

describe('o START é a PAUSA RÁPIDA', () => {
  it('🔴 [Zero] nada estava pausado, e o START congela: PAUSADO ao centro, a barra no direccional, NENHUM cartão', () => {
    expect(pausadoAVista(), 'PAUSADO já estava à vista; o caso não mediria nada').toBe(false);
    expect(cartao().hidden, 'o cartão já estava aberto').toBe(true);

    const ev = apertar('KeyH');

    expect(pausadoAVista(), 'o START não mostrou PAUSADO').toBe(true);
    expect(cursorNaBarra(), 'o direccional não foi para a barra').toBe(1);
    expect(cartao().hidden, 'o START abriu o cartão de menus — isso é do SELECT agora').toBe(true);
    // ⚠️ AND THE KEY IS CONSUMED: `Enter` is `start` by default, and without this the same press would pause AND activate
    // whatever was focused behind. The pair is the `KeyD` case.
    expect(ev.defaultPrevented, 'a engine pausou e deixou a tecla seguir para o que estava focado').toBe(true);
  });

  it('📌 a palavra é do IDIOMA, e não o identificador da chave', () => {
    apertar('KeyH');
    const texto = pausado().textContent.trim();
    expect(texto, 'PAUSADO saiu vazio').not.toBe('');
    expect(texto, 'a criança leu o nome da chave').not.toMatch(/pause\.quick/);
  });

  it('⚠️ a tecla é a que a CRIANÇA tem — `Enter` também é `start` no esquema solo', () => {
    apertar('Enter');
    expect(pausadoAVista(), '`Enter` está em `start` no esquema solo e não pausou').toBe(true);
  });

  it('⚠️ uma tecla que NÃO é `start` não pausa nada — o guarda é a acção, não «uma tecla qualquer»', () => {
    const ev = apertar('KeyD'); // `right` in the solo scheme: a game command, not a system one
    expect(pausadoAVista(), 'uma tecla de movimento pausou').toBe(false);
    expect(ev.defaultPrevented, 'a engine cancelou uma tecla que não é dela').toBe(false);
  });

  it('🎯 o JOGO é pedido para pausar — `setPhase(\'paused\')`, UMA vez', () => {
    apertar('KeyH');
    expect(fases).toEqual(['paused']);
  });

  it('🔴 o START OUTRA VEZ sai: PAUSADO some, o cursor sai da barra, e o jogo é pedido para retomar', () => {
    apertar('KeyH');
    apertar('KeyH');
    expect(pausadoAVista(), 'o segundo START não saiu da pausa rápida').toBe(false);
    expect(cursorNaBarra(), 'o direccional ficou preso na barra').toBe(0);
    expect(fases, 'a saída não pediu a retoma, ou pediu a pausa outra vez').toEqual(['paused', 'playing']);
  });

  it('🔴 o VOLTAR dentro da barra também sai — e também DESCONGELA (a saída é uma só, por qualquer porta)', () => {
    // ⚠️ IT IS THE HOOK'S CASE. Escape is handled by the BAR (`navBar` → `leaveBar`), not by the START listener; without
    // `onLeaveBar` the child would go back to her character with the world stopped and PAUSED written on top.
    apertar('KeyH');
    apertar('Escape');
    expect(cursorNaBarra(), 'o Escape não saiu da barra').toBe(0);
    expect(pausadoAVista(), 'saiu da barra e PAUSADO ficou').toBe(false);
    expect(fases, 'saiu da barra e o jogo continuou parado').toEqual(['paused', 'playing']);
  });

  it('🔴 [Zero] um cartucho SEM `setPhase` pausa na mesma — e o START tira-o de lá', () => {
    motor.mount(declaracaoValida(), { accommodations: SEM_ASSUNTO });
    try {
      apertar('KeyH');
      expect(pausadoAVista(), 'sem `setPhase` a pausa rápida não apareceu').toBe(true);
      apertar('KeyH');
      expect(pausadoAVista(), 'sem `setPhase` o START não saiu').toBe(false);
      expect(fases, 'o gancho do cartucho ANTERIOR foi chamado depois de ele sair').toEqual([]);
    } finally {
      motor.mount(declaracaoValida(), comGancho());
    }
  });
});

describe('o SELECT abre os MENUS', () => {
  it('🔴 [Zero] o cartão estava escondido, e o SELECT abre-o e pede a pausa UMA vez', () => {
    expect(cartao().hidden).toBe(true);
    const ev = apertar('KeyF');
    expect(cartao().hidden, 'o SELECT não abriu o cartão').toBe(false);
    expect(cartao().offsetParent, '`hidden` saiu e o cartão continua sem ocupar espaço').not.toBeNull();
    expect(pausadoAVista(), 'o cartão abriu com PAUSADO por baixo').toBe(false);
    expect(fases).toEqual(['paused']);
    expect(ev.defaultPrevented, 'o SELECT foi nosso e seguiu para trás').toBe(true);
  });

  it('🔴 DA PAUSA RÁPIDA para o cartão, o jogo NÃO descongela pelo caminho', () => {
    // ⚠️ The pair that catches SELECT written as «sair da pausa rápida e depois abrir»: leaving through the normal door
    // asks for `playing`, and the world would move for the instant between the two — with the child asking for menus, not
    // the game.
    apertar('KeyH');
    apertar('KeyF');
    expect(cartao().hidden, 'o SELECT na pausa rápida não abriu o cartão').toBe(false);
    expect(pausadoAVista(), 'PAUSADO ficou por baixo do cartão').toBe(false);
    expect(cursorNaBarra(), 'a barra ficou com o direccional por baixo do cartão').toBe(0);
    expect(fases, 'o jogo foi retomado (ou pausado duas vezes) no caminho para os menus').toEqual(['paused']);
  });

  it('🔴 com o cartão ABERTO, o START não entra na pausa rápida por baixo dele', () => {
    apertar('KeyF');
    fases.length = 0;
    apertar('KeyH');
    expect(pausadoAVista(), 'a pausa rápida entrou por baixo do cartão').toBe(false);
    expect(fases).toEqual([]);
  });

  it('🔴 o item «Voltar ao jogo» está VIVO e FECHA o cartão, pedindo a retoma', () => {
    // 🔴 The engine's own acts define `resume` (ADR-0144 erratum): the card always has a way out.
    apertar('KeyF');
    expect(item('resume')?.hidden, 'o «Voltar ao jogo» falta ou está escondido').toBe(false);
    fases.length = 0;
    item('resume').click();
    expect(cartao().hidden, 'o «Voltar ao jogo» não fechou o cartão').toBe(true);
    expect(fases).toEqual(['playing']);
  });

  it('🔴 o Escape na raiz do cartão também sai — e SEM `setPhase` do jogo ele também tem de sair', () => {
    motor.mount(declaracaoValida(), { accommodations: SEM_ASSUNTO });
    try {
      apertar('KeyF');
      expect(cartao().hidden).toBe(false);
      apertar('Escape');
      expect(cartao().hidden, 'o Escape não fechou a pausa de um jogo sem `setPhase`').toBe(true);
    } finally {
      motor.mount(declaracaoValida(), comGancho());
    }
  });
});

describe('a SEGUNDA porta dos menus: a legenda no rodapé e o `action4` (ADR-0155, errata «Ambos»)', () => {
  const legenda = () => document.querySelector('#game-region .pausa-legenda');

  it('🎯 a pausa rápida mostra a legenda com as QUATRO teclas — e ela some ao sair', () => {
    apertar('KeyH');
    expect(legenda()?.hidden, 'a tela congelada não diz como chegar aos menus').toBe(false);
    const texto = legenda().textContent;
    for (const pedaco of [/2/, /3/, /4/, /START/]) expect(texto, 'a legenda perdeu uma das quatro').toMatch(pedaco);
    expect(texto, 'a criança leu o nome da chave').not.toMatch(/pause\.quick/);
    apertar('KeyH');
    expect(legenda().hidden, 'saiu da pausa rápida e a legenda ficou por cima do jogo').toBe(true);
  });

  it('🔴 o `action4` NA PAUSA RÁPIDA abre o cartão — sem descongelar pelo caminho', () => {
    apertar('KeyH');
    const ev = apertar('KeyI'); // `action4` no esquema solo
    expect(cartao().hidden, 'o `action4` da legenda não abriu os menus').toBe(false);
    expect(pausadoAVista(), 'PAUSADO ficou por baixo do cartão').toBe(false);
    // ADR-0164 rule 3: on the card the legend CHANGES to the menu's functions — the quick pause's START line is gone
    expect(legenda().textContent, 'a legenda da pausa rápida ficou por baixo do cartão').not.toMatch(/START/);
    expect(fases, 'o jogo foi retomado a caminho dos menus').toEqual(['paused']);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('🔴 [Right] on the pause card (SELECT) the button legend shows the MENU\'s functions, and leaves with the card (ADR-0164 rule 3)', async () => {
    // The Dev: «explicação de botões deve aparecer em toda tela de pausa (START), com a função dos botões sendo
    // alteradas na tela de menu (SELECT)». In the card, 2 confirms and 3 goes back; SELECT and START do nothing there.
    const nomes = () => [...legenda().querySelectorAll('.lg-nome')].map((n) => n.textContent);
    apertar('KeyF');
    expect(cartao().hidden, 'SELECT did not open the card').toBe(false);
    expect(legenda()?.hidden, 'the card has no button legend').toBe(false);
    expect(nomes()).toEqual(['2: confirmar', '3: voltar']);
    // closed through the engine's own door, the legend goes with it
    motor.pause.hide(0);
    expect(legenda().hidden, 'the card closed and its legend stayed over the game').toBe(true);
    // and closed by a path that calls nothing of the engine (the print mode hides the card by its attribute)
    apertar('KeyF');
    expect(legenda().hidden).toBe(false);
    cartao().hidden = true;
    await new Promise((r) => setTimeout(r, 0));
    expect(legenda().hidden, 'a card hidden by its attribute left its legend on screen').toBe(true);
  });

  it('🔴 [Zero] FORA da pausa rápida o `action4` é do JOGO — não abre nada e não é consumido', () => {
    // The pair that stops the door from stealing a verb mid-game.
    const ev = apertar('KeyI');
    expect(cartao().hidden, 'o `action4` abriu os menus com o jogo a correr').toBe(true);
    expect(fases).toEqual([]);
    expect(ev.defaultPrevented, 'a engine consumiu um verbo do jogo').toBe(false);
  });
});

describe('o guarda comum: com um PAINEL aberto, nenhuma das portas é nossa', () => {
  it('⚠️ nem o START nem o SELECT abrem nada por baixo de um painel', () => {
    // 📌 THIS STATE IS THE QUIZ'S: a game whose settings are always available has panels open with the card closed.
    // Without the guard, the pause would open UNDER the panel the child is in.
    apertar('KeyF');
    item('options').click();
    item('audio').click();
    motor.pause.hide(0);
    const painel = document.querySelector('#audio');
    expect(painel.hidden, 'o painel não abriu; o caso mediria a ausência do painel').toBe(false);

    fases.length = 0;
    const start = apertar('KeyH');
    const select = apertar('KeyF');

    expect(pausadoAVista(), 'a pausa rápida entrou por baixo de um painel aberto').toBe(false);
    expect(cartao().hidden, 'o cartão abriu por baixo de um painel aberto').toBe(true);
    expect(fases).toEqual([]);
    expect(start.defaultPrevented || select.defaultPrevented, 'a engine cancelou uma tecla que decidiu não usar').toBe(false);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Applied by script to the file, with the occurrence count checked BEFORE each one.
// Those of ADR-0155 (this file):
//   S1  the START listener is not registered                                 🔴 nothing pauses
//   S2  `assentoDaPosicao` ignores the action                                🔴 `KeyD` pauses
//   S3  the open-panel guard leaves (START)                                  🔴 pauses under the panel
//   S4  START again does not leave                                           🔴 stuck in the quick pause
//   S5  `aoSairDaBarra` is not passed                                        🔴 Escape leaves the world stopped
//   S6  the quick pause's SELECT leaves through the normal door (`'jogo'`)   🔴 resumes on the way to the menus
//   S7  the open-card guard leaves (START)                                   🔴 quick pause under the card
//   S8  `e.preventDefault()` leaves START                                    🔴 the key goes on behind
//   S9  SELECT opens with `mudarDeFase` before `pausa.mostrar` only with a hook 🔴 cartridge with no `setPhase`
//   L1  the legend is not created                                            🔴 the screen does not say how to reach the menus
//   L2  the legend does not hide on leaving                                  🔴 legend on top of the game
//   L3  `action4` also opens outside the quick pause                         🔴 steals a verb from the game
//   L4  the `action4` listener is not registered                             🔴 the second door does not open
// And those of ADR-0144's erratum, which still hold for the card:
//   M8  `acoesDaEngine.resume` leaves                                         🔴 card with no «Voltar ao jogo»
//   M9  `setPhase: mudarDeFase` → `cartucho.setPhase ?? (() => {})`          🔴 Escape does not close
//   M10 `if (p !== 'paused') pausa.esconder(0)` never runs                   🔴 «Voltar» does not close

// ---- the button legend on the pause card (ADR-0164 rule 3, 2026-09-12) ----
//   L1 opening the card does not refresh the legend      🔴 action4 case and the card-legend case
//   L2 closing the card does not refresh the legend      🔴 card-legend case
//   L3 no observer for paths that only set `hidden`       🔴 card-legend case
//   L4 the card shows the quick-pause legend             🔴 two cases
//   L5 leaving the quick pause refreshes nothing itself   ✅ SURVIVED: `mudarDeFase` → `pausa.esconder` already refreshes — the call was removed
