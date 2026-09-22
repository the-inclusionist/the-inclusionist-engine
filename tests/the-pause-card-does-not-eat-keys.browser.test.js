// SPDX-License-Identifier: AGPL-3.0-or-later
// O CARTÃO DE PAUSA MONTADO NÃO COME AS TECLAS DO JOGO — só o cartão ABERTO é dono do teclado.
//
// ========================= POR QUE ESTE FICHEIRO EXISTE, E É UMA HISTÓRIA DE MÉTODO =========================
// 🔴 Uma frase escrita no código de um consumidor tornou-se premissa de um registo aceite, sem nunca ter sido
// medida. O `pixi-15-puzzle` escreveu ao lado da própria declaração: «if `semMenuDePausa` were omitted, every
// arrow, Enter and Space would start being eaten the moment anything created an element with a pause id». Eu
// citei-a no ADR-0121 e revertí a aposentadoria do campo por causa dela.
//
// 📏 MEDIDA DEPOIS, ela é verdadeira do cartão ABERTO e falsa do cartão MONTADO:
//
//   · `ui/menu-nav.ts:485`   — `if (menu && !menu.hidden) { consumir(e); navPause(menu, pi, k); }`
//   · `input/gamepad.ts:619` — a mesma guarda, no outro transporte
//   · `ui/pause-icons.ts:1180` — `sp.hidden = true`, três linhas dentro do `buildScreenPause`
//
// ⚠️ E É ESSA A DIFERENÇA QUE DECIDIU O ADR-0122: com ela, adoptar a pausa da engine não tira as setas a um
// jogo que se joga com setas, e o menu de pausa passa a ser da engine em todo jogo — que é a regra do Dev.
//
// 📌 ISTO TEM DE SER UM CASO DE BROWSER e não de node, e a razão é o próprio defeito: o que se afirma é a
// PROPAGAÇÃO de um evento por um documento real — captura na `window`, `preventDefault`, e um ouvinte do jogo
// mais abaixo na árvore. Um DOM falso responde o que o duplo mandar responder, e este ficheiro nasceu de uma
// afirmação que ninguém tinha exercitado.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let createGame;
let raiz;
let motor;
let vistas;
let ouvinteDoJogo;

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

/** A tecla como o jogo a vê: despachada na região do jogo, a subir até quem quer que a escute. */
function apertar(code) {
  const alvo = raiz.querySelector('#game-region');
  const ev = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true });
  alvo.dispatchEvent(ev);
  return ev;
}

beforeEach(async () => {
  ({ createGame } = await import('../app/js/boot/create-game.js'));
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);

  // 📌 E A RAIZ LIGA A NAVEGAÇÃO SOZINHA — `create-game.ts:729`, desde `dfaec02` e contido no `v7.0.1`. Este
  // ficheiro tinha um `motor.nav.attach()` aqui, e a mutação 3 mostrou que ele não fazia nada: `attach` passa
  // sempre a MESMA função com a mesma bandeira de captura, e o DOM não regista o mesmo ouvinte duas vezes.
  motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc: document, win: window }, downloadHeavy: false });

  // O ouvinte DO JOGO: uma seta é comando de jogo, e é ele que a perde quando alguém a consome antes.
  vistas = [];
  ouvinteDoJogo = (e) => vistas.push(e.code);
  raiz.querySelector('#game-region').addEventListener('keydown', ouvinteDoJogo);
});

afterEach(() => {
  raiz.querySelector('#game-region')?.removeEventListener('keydown', ouvinteDoJogo);
  raiz.remove();
});

describe('o cartão de pausa que a engine monta', () => {
  it('🔴 [Zero] MONTADO e escondido: a seta chega ao jogo e ninguém a cancela', () => {
    const cartao = document.getElementById('vp-pause-0');
    expect(cartao, 'o cartão não montou; o caso mediria a ausência dele e não a guarda').not.toBeNull();
    // 📌 E ele montou SEM declínio nenhum — o `semMenuDePausa` saiu do contrato (ADR-0122), e com um
    // `#game-region` presente a raiz não tem do que se queixar.
    expect(motor.problems.filter((p) => p.includes('pausa')), 'a pausa acusou com hospedeiro válido').toEqual([]);
    expect(cartao.hidden, 'o cartão tem de NASCER escondido — é essa a metade que a citação ignorava').toBe(true);

    const ev = apertar('ArrowRight');

    expect(vistas, 'a seta não chegou ao jogo: o cartão montado comeu-a').toContain('ArrowRight');
    expect(ev.defaultPrevented, 'alguém cancelou a seta com o menu fechado').toBe(false);
  });

  it('⚠️ ABERTO: a MESMA seta é consumida — um menu aberto é dono do teclado, e isso é o certo', () => {
    const cartao = document.getElementById('vp-pause-0');
    cartao.hidden = false;

    const ev = apertar('ArrowRight');

    expect(ev.defaultPrevented, 'com o menu ABERTO a seta tinha de ser consumida pela navegação').toBe(true);
    expect(vistas, 'a seta desceu ao jogo por baixo de um menu aberto').not.toContain('ArrowRight');
  });

  it('📌 [Boundary] as teclas de JOGO que a citação nomeia — seta e Space — passam com o cartão fechado', () => {
    for (const code of ['ArrowLeft', 'ArrowUp', 'Space']) {
      const ev = apertar(code);
      expect(ev.defaultPrevented, `${code} foi cancelada com o menu fechado`).toBe(false);
      expect(vistas, `${code} não chegou ao jogo`).toContain(code);
    }
  });

  it('⚠️ `Enter` SAIU dessa lista por DECISÃO e não por regressão — ele é `start` (ADR-0144, ADR-0155)', () => {
    /*
     * 🔴 ESTE CASO ERA A QUARTA TECLA DO CASO ACIMA, e vale a pena dizer porque saiu, em vez de o número
     * mudar em silêncio. A citação que fundou este ficheiro nomeava «every arrow, Enter and Space», e o que
     * ela acusava era o cartão MONTADO a comer teclas pela navegação de menu. Isso continua verdade e
     * continua medido — a seta e o `Space` acima.
     *
     * 🎯 O QUE MUDOU É OUTRA COISA, E É UMA DECISÃO: desde o ADR-0144 a engine ouve a ACÇÃO `start` e pausa com
     * ela — desde o ADR-0155, a PAUSA RÁPIDA (PAUSADO e a barra), e já não o cartão. O esquema solo põe `start` em `KeyH` E `Enter` (`input/default-bindings:89`), e a nota
     * de lá explica que `Enter` foi escolhido porque JÁ pausava no monólito (`PAUSE_KEYS = {Escape, Enter}`)
     * — declará-lo descrevia o que a tecla fazia há anos, não lhe dava trabalho novo.
     *
     * ⚠️ E A CAUSA NÃO É O DEFEITO QUE ESTE FICHEIRO GUARDA, que é o ponto de o caso viver aqui: o cartão
     * estava ESCONDIDO quando a tecla chegou. Quem a consumiu foi o gancho da pausa, de propósito, e não a
     * navegação de menu a correr sobre um cartão que ninguém abriu.
     */
    const cartao = document.getElementById('vp-pause-0');
    expect(cartao.hidden, 'o cartão já estava aberto: o caso mediria a navegação e não o gancho').toBe(true);

    const ev = apertar('Enter');

    const pausado = document.querySelector('#game-region .pausa-rapida');
    expect(pausado?.hidden, '`Enter` está em `start` e não pausou').toBe(false);
    expect(cartao.hidden, 'o START abriu o cartão de menus, que é do SELECT desde o ADR-0155').toBe(true);
    expect(ev.defaultPrevented, 'a engine pausou e deixou a tecla seguir para o jogo por baixo').toBe(true);
  });
});

// ================================ MUTAÇÕES CONFERIDAS ================================
// 1. tirar `&& !menu.hidden` do `ui/menu-nav.ts:485`  → [Zero] e [Boundary] reprovam (2 de 3): o cartão
//    montado passa a comer as quatro teclas, que é EXACTAMENTE a frase do 15-puzzle a tornar-se verdadeira.
//    É a mutação que prova que este ficheiro mede a guarda, e não o acaso.
// 2. `sp.hidden = true` → `false` no `buildScreenPause`  → [Zero] e [Boundary] reprovam: nascer escondido é a
//    outra metade da mesma promessa, e sem ela a guarda da mutação 1 nunca chega a proteger nada.
// 3. 🔴 SOBREVIVEU, E ACHOU UM FACTO EM VEZ DE UM BURACO. A primeira versão deste ficheiro chamava
//    `motor.nav.attach()` no `beforeEach`, com um comentário a dizer que a raiz não liga a navegação sozinha
//    — copiado do `pixi-15-puzzle`, que escreve `engine.nav.attach(); // createGame does not`. Tirá-lo
//    deixava os três casos VERDES. Medido: a raiz LIGA (`create-game.ts:729`, `dfaec02`, contido no
//    `v7.0.1`), e uma segunda chamada não regista ouvinte nenhum — mesma função, mesma bandeira de captura.
//    A linha saiu, e a linha equivalente no 15-puzzle é ruído que a migração para o 8.0.0 pode limpar.
//    ⚠️ Uma mutação que não pode reprovar não é prova de cobertura; fica registada por ter medido outra
//    coisa, que é o que a mutação 1 do `viz-setters` já ensinou neste repositório.
