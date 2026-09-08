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

// ========================= O PONTEIRO COMO CAPACIDADE DECLARADA (ADR-0112) =========================
// ⚠️ A METADE QUE IMPORTA, na frase do registo: a declaração é o que deixa um aparelho RECUSAR-SE ANTES de a
// criança começar. Sem ela, a criança escolhe «Desenho livre» num Chromebook sem rato e descobre a meio.
//
// 📌 E ELE ENTRA PELA MÁQUINA QUE JÁ EXISTE — o alcance por CONJUNTO do ADR-0079 — em vez de por um mecanismo
// próprio. Dois mecanismos para a mesma pergunta seriam duas respostas, e elas divergem.
//
// 📌 `aponta` É UMA FUNÇÃO e não um booleano, pela MESMA razão escrita no campo `available` ao lado: um rato é
// ligado no meio da partida, tal como um controle.
const tp = (id, slots, available = true, aponta = undefined) => ({
  id, slots, available: () => available, ...(aponta === undefined ? {} : { aponta: () => aponta }),
});

describe('ADR-0112 · um jogo que pede PONTEIRO é recusado por quem não tem', () => {
  const TRES = ['up', 'down', 'action1'];

  it('[Right] o TOQUE aponta por natureza — a superfície é o ponteiro', () => {
    const r = alcance([tp('toque', 9, true, true)], TRES, 1, true);
    expect(r.ok).toBe(true);
    expect(r.pedePonteiro).toBe(true);
    expect(r.naoApontam).toEqual([]);
  });

  it('🔴 [Zero] TECLADO SEM RATO não serve um jogo que pede ponteiro, e diz qual é o problema', () => {
    // 🔴 O caso que este ficheiro existe para prender. O teclado carrega as três ações e segura-as todas —
    // pela aritmética antiga, `ok` dizia SIM. Mas «Desenho livre» não se joga com teclas, e a criança só
    // descobriria isso depois de escolher.
    const r = alcance([tp('teclado', 40, true, false)], TRES, 1, true);
    expect(r.ok, 'o alcance disse sim a um jogo que esta criança não consegue jogar').toBe(false);
    expect(r.naoApontam, 'a frase precisa de saber QUEM chegou perto e falhou só nisto').toEqual(['teclado']);
    // ⚠️ e NÃO aparece nas outras listas: ele não é curto de lugares nem falha em segurar. Um transporte em
    // duas listas faria o cartão dizer dois problemas onde há um — a mesma regra que o `naoSeguram` já segue.
    expect(r.curtos).toEqual([]);
    expect(r.naoSeguram).toEqual([]);
  });

  it('⚠️ [Right] o MESMO teclado COM RATO serve — «no caso do teclado, o sinal contínuo é o rato»', () => {
    // A cláusula do Dev, como caso. É ela que dá fundação aos transportes 8 e 9 do ADR-0074, que aquele
    // registo declarava como «sem fundação nenhuma».
    const r = alcance([tp('teclado', 40, true, true)], TRES, 1, true);
    expect(r.ok).toBe(true);
    expect(r.naoApontam).toEqual([]);
  });

  it('⚠️ [Zero] um jogo que NÃO pede ponteiro não é afectado por nada disto', () => {
    // A garantia de aditividade: os trezentos jogos que não desenham não podem sentir esta mudança.
    const r = alcance([tp('teclado', 40, true, false)], TRES, 1);
    expect(r.ok).toBe(true);
    expect(r.pedePonteiro).toBe(false);
    expect(r.naoApontam).toEqual([]);
  });

  it('[Boundary] «ligue um controle» não é oferecido quando o controle também não aponta', () => {
    // `serviriamSeLigados` é informação ACIONÁVEL; oferecer uma saída que não resolve é pior que não oferecer.
    const r = alcance([tp('gamepad', 17, false, false), tp('teclado', 40, true, false)], TRES, 1, true);
    expect(r.ok).toBe(false);
    expect(r.serviriamSeLigados, 'mandou ligar um controle que também não desenha').toEqual([]);
  });

  it('[Right] mas É oferecido quando o que está desligado aponta', () => {
    const r = alcance([tp('toque', 9, false, true), tp('teclado', 40, true, false)], TRES, 1, true);
    expect(r.ok).toBe(false);
    expect(r.serviriamSeLigados).toEqual(['toque']);
  });

  it('⚠️ [Zero] quem OMITE o campo não aponta — ausência é «não oferece», e é a forma do gamepad', () => {
    // ⚠️ CASO ACHADO POR MUTAÇÃO SOBREVIVENTE, e o buraco era real: todos os outros casos DECLARAM `aponta`,
    // então ler a ausência como «sim» passava despercebido. É precisamente a forma do gamepad no
    // `transportesPadrao`, que não declara o campo — e o ADR-0112 diz que aqui a ausência significa «não
    // oferece», ao contrário do `holds`, onde ela significa «não há tecto conhecido».
    const semCampo = { id: 'gamepad', slots: 17, available: () => true };
    const r = alcance([semCampo], TRES, 1, true);
    expect(r.ok).toBe(false);
    expect(r.naoApontam).toEqual(['gamepad']);
  });

  it('⚠️ [Boundary] quem falha por LUGARES não entra também na lista de quem não aponta', () => {
    // Um transporte em duas listas faria o cartão dizer dois problemas onde há um. Sem este caso, a guarda
    // que o impede podia cair sem nada reprovar — foi o que a mutação mostrou.
    const estreito = tp('acionador', 2, true, false); // dois lugares para três acções, e sem ponteiro
    const r = alcance([estreito], TRES, 1, true);
    expect(r.curtos).toEqual([{ id: 'acionador', slots: 2 }]);
    expect(r.naoApontam, 'o mesmo transporte acusado duas vezes').toEqual([]);
  });
});

describe('ADR-0112 · a cláusula do Dev, na FÁBRICA e não num fixture', () => {
  // ⚠️ ESTE BLOCO EXISTE PORQUE DUAS MUTAÇÕES SOBREVIVERAM: os casos acima constroem transportes à mão, então
  // apagar `aponta: d.rato` do `transportesPadrao` não reprovava nada — e essa linha É o commit. «No caso do
  // teclado, o sinal contínuo passa a ser o mouse» tem de ser afirmado sobre a lista que o jogo recebe.
  const disp = (over) => ({
    gamepad: () => false, toque: () => false, teclado: () => true, rato: () => false, ...over,
  });
  const acha = (lista, id) => lista.find((x) => x.id === id);

  it('⚠️ [Right] o TECLADO aponta quando há rato, e não aponta quando não há', () => {
    expect(acha(transportesPadrao(disp({ rato: () => true })), 'teclado').aponta()).toBe(true);
    expect(acha(transportesPadrao(disp({ rato: () => false })), 'teclado').aponta()).toBe(false);
  });

  it('⚠️ [Right] o TOQUE aponta por natureza — a mesma sonda que o torna disponível', () => {
    const lista = transportesPadrao(disp({ toque: () => true }));
    expect(acha(lista, 'toque').aponta()).toBe(true);
    expect(acha(lista, 'toque').available()).toBe(true);
  });

  it('⚠️ [Zero] o GAMEPAD não declara ponteiro, e a ausência é medida e não esquecimento', () => {
    // O stick tem o sinal contínuo e a engine deita-o fora na fonte (`PAD_DEAD = 0.5`). Ligá-lo é possível e
    // traz de volta a pergunta que o ADR-0112 já deixou nomeada — meio curso morto serve a um BOTÃO e não a
    // um CURSOR. Enquanto não for ligado, declarar que ele aponta seria mentir para o cartão da #112.
    expect(acha(transportesPadrao(disp({ gamepad: () => true })), 'gamepad').aponta).toBeUndefined();
  });

  // ===================== MUTACOES CONFERIDAS (o ponteiro, ADR-0112) =====================
  // Cinco, por script e com contagem de ocorrencias. ⚠️ QUATRO SOBREVIVERAM NA PRIMEIRA VOLTA, e as quatro
  // eram BURACOS DE COBERTURA e nao equivalencias — foi o arnes a achar o que a leitura nao acha:
  //
  //   1. o ponteiro fora do `serve` (o `ok` volta a mentir) -> reprovam QUATRO. Era a unica que ja morria.
  //   2. a ausencia de `aponta` lida como SIM -> sobreviveu porque TODOS os fixtures declaravam o campo.
  //      Nunca havia um que o OMITISSE, que e exactamente a forma do gamepad. Caso novo; agora reprova.
  //   3. e 4. apagar `aponta` do `transportesPadrao` -> sobreviviam porque os casos construiam transportes a
  //      mao e nunca exercitavam a FABRICA. ⚠️ E aquela linha E o commit: «no caso do teclado, o sinal
  //      continuo passa a ser o mouse». Um bloco novo afirma-a sobre a lista que o jogo recebe de verdade.
  //   5. `naoApontam` sem excluir quem ja falhou por lugares -> sobreviveu por nao existir caso de transporte
  //      que falhasse por DUAS razoes. A regra «um problema, uma lista» nao estava medida; agora esta.
});

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

  it('[Zero] ⚠️ um transporte CURTO e DESLIGADO não entra na frase — ela falaria de um aparelho ausente', () => {
    // `curtos` existe para dizer «o que você TEM não chega». Um acionador de dois toques que não está ligado
    // não é o que ela tem, e nomeá-lo faria a frase apontar para um objeto que não está na sala — o oposto
    // de acionável. É a linha que separa «o toque tem 9 lugares» de uma lista de tudo o que existe no mundo.
    const acionador = { id: 'acionador', slots: 2, available: () => false };
    const lista = [...transportesPadrao({ gamepad: nunca, teclado: nunca, toque: sempre }), acionador];
    const a = alcance(lista, ACTIONS);
    expect(a.curtos.map((c) => c.id), 'a frase citou um aparelho desligado').toEqual(['toque']);
    // E ele também não entra em «serviria se ligado», porque não serviria: dois lugares para catorze ações.
    expect(a.serviriamSeLigados).not.toContain('acionador');
  });

  it('[Interface] a disponibilidade é PERGUNTADA a cada vez — um controle liga-se no meio da partida', () => {
    let ligado = false;
    const lista = transportesPadrao({ gamepad: () => ligado, teclado: nunca, toque: sempre });
    expect(reachable(lista, ACTIONS)).toBe(false);
    ligado = true;
    expect(reachable(lista, ACTIONS), 'a lista memorizou a resposta de antes').toBe(true);
  });
});
