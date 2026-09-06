// SPDX-License-Identifier: AGPL-3.0-or-later
// O gate do REGISTRO DE TRANSPORTES (ADR-0079), a última peça da issue #103.
//
// ⚠️ O CASO QUE ESTE FICHEIRO EXISTE PARA APANHAR NÃO É HIPOTÉTICO: o controle de tela tem NOVE slots desde
// sempre, e o conjunto de ações passou a CATORZE em 2026-09-06. Um jogo que use doze é uma combinação real,
// e a resposta honesta é uma frase ANTES de começar — não meia tela jogável. A criança que descobre no meio
// que não alcança uma ação conclui que o jogo está partido, e ela não tem como saber que não está.
import { describe, it, expect } from 'vitest';
import { carries, carriedBy, reachable, alcance } from '../app/js/input/transports.js';
import { LUGARES, transportesPadrao } from '../app/js/input/transports.js';
import { ACTIONS } from '../app/js/core/actions.js';
import { TOUCH_DEFAULT } from '../app/js/input/devices.js';

const t = (id, slots, available = true) => ({ id, slots, available: () => available });

// Os transportes de hoje, com os números que eles de facto têm.
const GAMEPAD = t('gamepad', 17);   // a Gamepad API "standard" declara 17 botões
const TECLADO = t('keyboard', 40);  // o esquema por jogador não é o limite; o teclado é largo
const TOQUE = t('touch', 9);        // `TOUCH_DEFAULT` nomeia nove slots
const ACIONADOR = t('switch', 2);   // um acionador de dois toques — o transporte estreito do ADR-0079

const NOVE = ['up', 'down', 'left', 'right', 'action1', 'action2', 'action3', 'action4', 'start'];
const DOZE = [...NOVE, 'leftShoulder', 'leftTrigger', 'rightShoulder'];

describe('um transporte carrega um conjunto quando tem lugares para ele', () => {
  it('aritmética, e nada mais', () => {
    expect(carries(TOQUE, NOVE)).toBe(true);
    expect(carries(TOQUE, DOZE)).toBe(false);
    expect(carries(GAMEPAD, DOZE)).toBe(true);
  });

  it('⚠️ o caso REAL: nove slots de toque contra doze ações', () => {
    // Não é exemplo inventado — é o controle de tela de hoje contra o conjunto de hoje.
    expect(carries(TOQUE, DOZE)).toBe(false);
    expect(carriedBy([TOQUE], DOZE)).toEqual([]);
  });

  it('o acionador de dois toques carrega um jogo de um botão, e é para isso que ele existe', () => {
    // O ADR-0079 §3 diz que a garantia mudou de forma justamente para um transporte estreito poder existir
    // sem reprovar o produto: ele carrega os jogos que cabem nele.
    expect(carries(ACIONADOR, ['action1'])).toBe(true);
    expect(carries(ACIONADOR, ['action1', 'action2'])).toBe(true);
    expect(carries(ACIONADOR, NOVE)).toBe(false);
  });
});

describe('a garantia é sobre o CONJUNTO, não sobre cada transporte', () => {
  it('basta UM disponível que carregue', () => {
    // O toque não carrega doze, e a garantia continua satisfeita porque o controle carrega.
    expect(reachable([TOQUE, GAMEPAD], DOZE)).toBe(true);
  });

  it('⚠️ um transporte que CABERIA mas está desligado NÃO satisfaz a garantia', () => {
    // A ordem — disponibilidade antes de capacidade — é decisão: um controle guardado na gaveta não é
    // resposta para uma criança que está à frente do aparelho agora.
    expect(reachable([TOQUE, t('gamepad', 17, false)], DOZE)).toBe(false);
  });

  it('nenhum disponível que caiba → a garantia falha, que é o ponto', () => {
    expect(reachable([TOQUE, ACIONADOR], DOZE)).toBe(false);
  });

  it('⚠️ conjunto de ações VAZIO devolve false, e não true por vacuidade', () => {
    // «Todo transporte serve» seria tecnicamente verdade e praticamente uma mentira: um jogo sem ação
    // nenhuma não é um jogo que qualquer transporte serve, é um que ninguém consegue jogar. Devolver
    // `true` aqui esconderia esse defeito atrás desta função.
    expect(reachable([GAMEPAD, TECLADO], [])).toBe(false);
  });
});

describe('o que a tela de seleção precisa saber ANTES de a criança começar', () => {
  it('quando serve, diz que serve', () => {
    const a = alcance([TOQUE, GAMEPAD], NOVE);
    expect(a.ok).toBe(true);
    expect(a.pedidas).toBe(9);
  });

  it('⚠️ quando NÃO serve, diz o número e diz o que ligar', () => {
    // A informação tem de ser ACIONÁVEL: «faltam lugares» não ajuda ninguém; «o toque tem 9 e este jogo
    // pede 12; um controle resolveria» diz o que fazer.
    const a = alcance([TOQUE, t('gamepad', 17, false)], DOZE);
    expect(a.ok).toBe(false);
    expect(a.pedidas).toBe(12);
    expect(a.curtos).toEqual([{ id: 'touch', slots: 9 }]);
    expect(a.serviriamSeLigados).toEqual(['gamepad']);
  });

  it('devolve DADO e não texto', () => {
    // A frase é da interface e tem de passar por `t()`. Devolver português daqui repetiria o defeito que
    // o `PADWIZ_STEPS` acabou de deixar de cometer.
    const a = alcance([TOQUE], DOZE);
    for (const v of Object.values(a)) expect(typeof v).not.toBe('string');
  });

  it('um transporte disponível que CABE não aparece como curto', () => {
    const a = alcance([TOQUE, GAMEPAD], DOZE);
    expect(a.curtos.map((c) => c.id)).toEqual(['touch']);
    expect(a.ok).toBe(true);
  });
});

// -----------------------------------------------------------------------------------------------------------
describe('A LISTA REAL de transportes — os números saem do aparelho, não de um teste (issue #112)', () => {
  // ⚠️ Estes casos aferem PROPRIEDADES e não os literais. `expect(LUGARES.teclado).toBe(ACTIONS.length)` seria
  // tautológico — o código É `ACTIONS.length` —, e um caso que se move junto com a implementação não falha
  // nunca. O que interessa é o que cada número FAZ quando a aritmética o usa.
  const sempre = () => true, nunca = () => false;
  const todos = (v) => transportesPadrao({ gamepad: v, teclado: v, toque: v });
  const acha = (lista, id) => lista.find((x) => x.id === id);

  it('[Right] ⚠️ o TOQUE não carrega as catorze — é a combinação que a issue #112 existe para avisar', () => {
    // Nove slots desde sempre; o vocabulário passou a catorze em 2026-09-06. Uma criança num tablet de escola
    // pública não tem caminho alternativo: o toque é o único.
    expect(carries(acha(todos(sempre), 'toque'), ACTIONS)).toBe(false);
  });

  it('[Right] e o TECLADO carrega — é isso que «o teclado é largo» quer dizer em aritmética', () => {
    // A propriedade, não o número: um transporte que cobre todas as posições que a engine sabe nomear não tem
    // como ser o curto. Se o vocabulário crescer e este caso reprovar, o teclado deixou de ser largo.
    expect(carries(acha(todos(sempre), 'teclado'), ACTIONS)).toBe(true);
  });

  it('[Right] o GAMEPAD carrega, e sobra — dezassete botões da Gamepad API «standard»', () => {
    expect(carries(acha(todos(sempre), 'gamepad'), ACTIONS)).toBe(true);
    expect(LUGARES.gamepad).toBeGreaterThan(ACTIONS.length);
  });

  it('[Interface] ⚠️ o número do toque vem da TABELA de toque, e não de um literal repetido aqui', () => {
    // Se alguém acrescentar um décimo slot a `TOUCH_DEFAULT` e esquecer o `LUGARES`, este caso reprova. Sem
    // ele, os dois números divergiriam em silêncio e a garantia passaria a mentir a favor do produto.
    expect(LUGARES.toque).toBe(Object.keys(TOUCH_DEFAULT).length);
  });

  it('[Zero] ⚠️ num tablet SEM controle ligado, o conjunto de catorze NÃO é alcançável', () => {
    // O caso da issue, inteiro: só o toque disponível, e ele é curto. É este `false` que faz a tela aparecer.
    const tablet = transportesPadrao({ gamepad: nunca, teclado: nunca, toque: sempre });
    expect(reachable(tablet, ACTIONS)).toBe(false);

    const a = alcance(tablet, ACTIONS);
    expect(a.ok).toBe(false);
    // ⚠️ E a informação tem de ser ACIONÁVEL: «faltam lugares» não ajuda ninguém. Quem está curto, com quantos
    // lugares tem, e o que resolveria se fosse ligado — é isso que vira frase.
    expect(a.curtos).toEqual([{ id: 'toque', slots: 9 }]);
    expect(a.serviriamSeLigados).toEqual(['gamepad', 'teclado']);
    expect(a.pedidas).toBe(ACTIONS.length);
  });

  it('[Right] e ligar um controle resolve — a mesma lista, com o gamepad disponível', () => {
    const comPad = transportesPadrao({ gamepad: sempre, teclado: nunca, toque: sempre });
    expect(reachable(comPad, ACTIONS)).toBe(true);
    expect(alcance(comPad, ACTIONS).ok).toBe(true);
  });

  it('[Boundary] um jogo de NOVE ações cabe no toque, e a tela não tem por que aparecer', () => {
    // A tela avisa quando é preciso, e cala quando não é. Um aviso que aparece sempre deixa de ser lido.
    const tablet = transportesPadrao({ gamepad: nunca, teclado: nunca, toque: sempre });
    expect(reachable(tablet, NOVE)).toBe(true);
  });

  it('[Interface] a disponibilidade é PERGUNTADA a cada vez — um controle liga-se no meio da partida', () => {
    let ligado = false;
    const lista = transportesPadrao({ gamepad: () => ligado, teclado: nunca, toque: sempre });
    expect(reachable(lista, ACTIONS)).toBe(false);
    ligado = true;
    expect(reachable(lista, ACTIONS), 'a lista memorizou a resposta de antes').toBe(true);
  });
});
