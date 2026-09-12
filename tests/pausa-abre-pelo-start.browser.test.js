// SPDX-License-Identifier: AGPL-3.0-or-later
// AS DUAS PORTAS DA PAUSA: o START é a PAUSA RÁPIDA e o SELECT abre os MENUS (ADR-0155, que supersede em parte
// o ADR-0144 — e a errata dele, a do cartão com saída, continua medida aqui).
//
// ========================= POR QUE ESTE FICHEIRO EXISTE =========================
// 🔴 MEDIDO em 2026-09-12: `createGame` montava o cartão de pausa, a barra de acessibilidade e quatro painéis
// de ajustes, e NADA revelava o cartão. O ADR-0144 fez do `start` a porta. No mesmo dia o Dev trocou as portas:
// «A barra sobre o jogo mais a palavra PAUSED no centro da tela. No entanto, esta deve passar a ser a opção do
// botão START, e o botão SELECT deve trazer à tona os diversos menus.» O nome do ficheiro fica, porque o
// `confirmed-by` do ADR-0144 aponta para ele; o que ele mede é o que o ADR-0155 decidiu.
//
// 📌 TEM DE SER UM FICHEIRO DE NAVEGADOR: o que se afirma é a PROPAGAÇÃO de um evento de teclado por um documento
// a sério, com `ui/menu-nav` a ouvir em CAPTURA na mesma janela e estes ouvintes em BOLHA por baixo dele.
//
// ⚠️ E TEM DE SER UM FICHEIRO SEU, com UMA raiz só. Cada `createGame` pendura ouvintes na `window` e nada os
// tira; por isso a raiz nasce uma vez no `beforeAll` e o cartucho troca-se por `mount()` (ADR-0142).
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';

let motor;
let raiz;
/** As fases que o JOGO recebeu — é o `setPhase` do cartucho, não o da engine. */
let fases;

const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  holdsAtOnce: () => 1,
  seguraTeclas: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'primeira pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});
const comGancho = () => ({ acomodacoes: SEM_ASSUNTO, setPhase: (p) => fases.push(p) });

/** A tecla como a criança a dá: despachada na região do jogo, a subir até quem a quiser. */
function apertar(code) {
  const alvo = raiz.querySelector('#game-region');
  const ev = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true });
  alvo.dispatchEvent(ev);
  return ev;
}

const cartao = () => document.getElementById('vp-pause-0');
const item = (act) => document.querySelector(`#vp-pause-0 .pm-btn[data-act="${act}"]`);
const pausado = () => document.querySelector('#game-region .pausa-rapida');
/** PAUSADO à vista — pelo layout, não só pelo atributo: é ao layout que a criança pergunta. */
const pausadoAVista = () => !!pausado() && pausado().hidden === false && pausado().offsetParent !== null;
const cursorNaBarra = () => document.querySelectorAll('.pi-sel').length;

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  fases = [];
  motor = createGame({ declaration: declaracaoValida(), host: { doc: document, win: window }, baixarPesados: false, ...comGancho() });
});

beforeEach(() => {
  // Um painel que um caso anterior tenha aberto não pode decidir o seguinte: o primeiro guarda dos ouvintes é
  // exactamente «há um painel aberto?».
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pausa.esconder(0);
  // ⚠️ E UMA PAUSA RÁPIDA que um caso deixou ligada tem de sair pela PORTA — não há API pública que a desligue,
  // e é de propósito: a criança também só a tem pelo START.
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
    // ⚠️ E A TECLA É CONSUMIDA: `Enter` é `start` por omissão, e sem isto o mesmo carregar pausava E accionava o
    // que estivesse focado por trás. O par é o caso do `KeyD`.
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
    const ev = apertar('KeyD'); // `right` no esquema solo: comando de jogo, não de sistema
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
    // ⚠️ É O CASO DO GANCHO. O Escape é tratado pela BARRA (`navBar` → `sairDaBarra`), não pelo ouvinte do START;
    // sem `aoSairDaBarra` a criança voltava ao personagem com o mundo parado e PAUSADO escrito por cima.
    apertar('KeyH');
    apertar('Escape');
    expect(cursorNaBarra(), 'o Escape não saiu da barra').toBe(0);
    expect(pausadoAVista(), 'saiu da barra e PAUSADO ficou').toBe(false);
    expect(fases, 'saiu da barra e o jogo continuou parado').toEqual(['paused', 'playing']);
  });

  it('🔴 [Zero] um cartucho SEM `setPhase` pausa na mesma — e o START tira-o de lá', () => {
    motor.mount(declaracaoValida(), { acomodacoes: SEM_ASSUNTO });
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
    // ⚠️ O par que apanha o SELECT escrito como «sair da pausa rápida e depois abrir»: sair pela porta normal
    // pede `playing`, e o mundo andaria o instante entre as duas — com a criança a pedir menus, não o jogo.
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
    // 🔴 ANTES DA ERRATA DO ADR-0144 ELE NÃO ESTAVA: `acoesDaEngine` não definia `resume`.
    apertar('KeyF');
    expect(item('resume')?.hidden, 'o «Voltar ao jogo» falta ou está escondido').toBe(false);
    fases.length = 0;
    item('resume').click();
    expect(cartao().hidden, 'o «Voltar ao jogo» não fechou o cartão').toBe(true);
    expect(fases).toEqual(['playing']);
  });

  it('🔴 o Escape na raiz do cartão também sai — e SEM `setPhase` do jogo ele também tem de sair', () => {
    motor.mount(declaracaoValida(), { acomodacoes: SEM_ASSUNTO });
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

describe('o guarda comum: com um PAINEL aberto, nenhuma das portas é nossa', () => {
  it('⚠️ nem o START nem o SELECT abrem nada por baixo de um painel', () => {
    // 📌 ESTE ESTADO É O DO QUIZ: um jogo cujos ajustes estão sempre disponíveis tem painéis abertos com o cartão
    // fechado. Sem o guarda, a pausa abria POR BAIXO do painel em que a criança está.
    apertar('KeyF');
    item('options').click();
    item('audio').click();
    motor.pausa.esconder(0);
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

// ============================== MUTAÇÕES CONFERIDAS ==============================
// Aplicadas por script ao ficheiro, com a contagem de ocorrências conferida ANTES de cada uma.
// As do ADR-0155 (este ficheiro):
//   S1  o ouvinte do START não é registado                                   🔴 nada pausa
//   S2  `assentoDaPosicao` ignora a acção                                    🔴 `KeyD` pausa
//   S3  o guarda do painel aberto sai (START)                                🔴 pausa por baixo do painel
//   S4  o START outra vez não sai                                            🔴 preso na pausa rápida
//   S5  `aoSairDaBarra` não é passado                                        🔴 Escape deixa o mundo parado
//   S6  o SELECT da pausa rápida sai pela porta normal (`'jogo'`)            🔴 retoma a caminho dos menus
//   S7  o guarda do cartão aberto sai (START)                                🔴 pausa rápida por baixo do cartão
//   S8  `e.preventDefault()` sai do START                                    🔴 a tecla segue para trás
//   S9  o SELECT abre com `mudarDeFase` antes de `pausa.mostrar` só com gancho 🔴 cartucho sem `setPhase`
// E as da errata do ADR-0144, que continuam a valer para o cartão:
//   M8  `acoesDaEngine.resume` sai                                           🔴 cartão sem «Voltar ao jogo»
//   M9  `setPhase: mudarDeFase` → `cartucho.setPhase ?? (() => {})`          🔴 Escape não fecha
//   M10 `if (p !== 'paused') pausa.esconder(0)` nunca corre                  🔴 «Voltar» não fecha
