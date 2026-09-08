// SPDX-License-Identifier: AGPL-3.0-or-later
// AS FRASES DO AVISO DE ALCANCE (issue #112). A tela é aferida no project browser; aqui é o TEXTO, que é a
// parte que precisa de ser lida com cuidado e traduzida para três idiomas.
//
// ⚠️ O QUE ESTE AVISO EXISTE PARA IMPEDIR: o controle de tela tem NOVE lugares e o vocabulário passou a
// CATORZE. Num tablet de escola pública o toque não é o caminho alternativo — é o único. Sem a frase, a
// criança descobre no meio da partida que não alcança uma ação e conclui que o jogo está partido, sem ter
// como saber que não está.
import { describe, it, expect } from 'vitest';
import { linhasDoAviso } from '../app/js/ui/reach-notice.js';
// ⚠️ `presetActions` e o preset do jogo SAÍRAM destes imports em 2026-09-07 (issue #111): as duas asserções
// que os usavam eram sobre o JOGO — liam o fonte de `main.ts` e afirmavam que o preset da plataforma tem
// nove ações — e mudaram para `game-platformer`. `alcance`/`transportesPadrao` FICAM: são da engine, e é
// com elas que se monta o alcance de que este ficheiro fala.
import { alcance, transportesPadrao } from '../app/js/input/transports.js';
import { ACTIONS } from '../app/js/core/actions.js';
import pt from '../app/js/i18n/pt.js';

/** Um tradutor de teste que devolve a CHAVE e os parâmetros — assim os casos falam de estrutura, não de prosa. */
const cru = (k, p) => (p ? `${k}(${Object.entries(p).map(([a, b]) => `${a}=${b}`).join(',')})` : k);

/** E um que usa o dicionário de verdade, para os casos que precisam de afirmar a frase. */
const real = (k, p) => {
  let s = pt[k];
  if (s === undefined) throw new Error(`chave i18n ausente: ${k}`);
  for (const [a, b] of Object.entries(p ?? {})) s = s.split(`{${a}}`).join(String(b));
  return s;
};

const sempre = () => true, nunca = () => false;
const TABLET = transportesPadrao({ gamepad: nunca, teclado: nunca, toque: sempre });
const DESKTOP = transportesPadrao({ gamepad: nunca, teclado: sempre, toque: nunca });

describe('quando NÃO há o que dizer, não se diz nada', () => {
  it('[Zero] alcance ok devolve zero linhas — um aviso que aparece sempre deixa de ser lido', () => {
    expect(linhasDoAviso(alcance(DESKTOP, ACTIONS, 1), cru)).toEqual([]);
  });

  it('[Boundary] e um jogo cujas ações CABEM no toque, e que segura UMA de cada vez, também não avisa', () => {
    const nove = ACTIONS.slice(0, 9);
    expect(linhasDoAviso(alcance(TABLET, nove, 1), cru)).toEqual([]);
  });
});

describe('⚠️ O PONTO CEGO DO ADR-0104: cabe nas ações e ainda assim não dá para jogar', () => {
  // Este bloco é a razão de existir do segundo eixo, e o caso acima é o que ele corrige. Enquanto o
  // `alcance` só media «chega às ações», a plataforma passava: nove ações, nove lugares no controle de tela,
  // `ok` verdadeiro, cartão nunca mostrado. Mas correr, andar e pular ao mesmo tempo são TRÊS DEDOS, e o
  // aparelho barato reconhece dois — a criança tentava, não acontecia nada, e não havia nada em lado nenhum
  // a dizer porquê. O `ok` estava a afirmar «dá para jogar» sobre um jogo que não dava.
  const nove = ACTIONS.slice(0, 9);

  it('⚠️ [Right] nove ações cabem nos nove lugares do toque, e SEGURAR três reprova na mesma', () => {
    const a = alcance(TABLET, nove, 3);
    expect(a.curtos, 'apareceu como curto de LUGARES — não é esse o defeito').toEqual([]);
    expect(a.ok, 'o `ok` continua a dizer que dá para jogar').toBe(false);
    expect(a.naoSeguram).toEqual([{ id: 'toque', holds: 2 }]);
  });

  it('⚠️ [Right] e a frase diz os DOIS números, que é o que a torna acionável', () => {
    const linhas = linhasDoAviso(alcance(TABLET, nove, 3), real);
    expect(linhas).toContain('O controle de tela segura 2 botões de cada vez, e este jogo pede 3 ao mesmo tempo.');
  });

  it('[Boundary] segurar DOIS ainda passa — o piso é dois, e o piso é para ser usado', () => {
    expect(alcance(TABLET, nove, 2).ok).toBe(true);
    expect(alcance(TABLET, nove, 2).naoSeguram).toEqual([]);
  });

  it('⚠️ [Interface] um transporte SEM tecto declarado não reprova por falta de medida', () => {
    // O teclado e o controle não declaram `holds`. Ausente quer dizer «não medimos isto», e recusar por falta
    // de medida transformaria uma ignorância numa acusação: eles reprovariam TODOS os jogos.
    expect(alcance(DESKTOP, nove, 9).ok, 'o teclado reprovou por não ter número').toBe(true);
    expect(alcance(DESKTOP, nove, 9).naoSeguram).toEqual([]);
  });

  it('⚠️ [Interface] o transporte que já está CURTO de lugares não aparece duas vezes', () => {
    // Um transporte nas duas listas faria o cartão dizer dois problemas onde há um, e a criança leria uma
    // parede em vez de uma diferença.
    const a = alcance(TABLET, ACTIONS, 3); // 14 ações num transporte de 9 lugares, e ainda pede 3 dedos
    expect(a.curtos.map((c) => c.id)).toEqual(['toque']);
    expect(a.naoSeguram, 'o toque foi acusado duas vezes pelo mesmo aparelho').toEqual([]);
  });
});

describe('quando há, a informação é ACIONÁVEL — não «faltam lugares»', () => {
  it('[Right] diz quantas o jogo pede, quem está curto com quantos lugares, e o que resolveria', () => {
    const linhas = linhasDoAviso(alcance(TABLET, ACTIONS, 1), cru);
    expect(linhas).toEqual([
      `reach.titulo(pedidas=${ACTIONS.length})`,
      'reach.curto(transporte=reach.nome.toque,lugares=9)',
      'reach.ligue(saida=reach.nome.gamepadreach.oureach.nome.teclado)',
    ]);
  });

  it('[Right] e em português sai uma frase que uma criança consegue seguir', () => {
    const linhas = linhasDoAviso(alcance(TABLET, ACTIONS, 1), real);
    expect(linhas[0]).toBe('Este jogo usa 14 ações.');
    expect(linhas[1]).toBe('O controle de tela tem 9 lugares — não chegam para todas.');
    expect(linhas[2]).toBe('Ligue controle ou teclado e você joga com todas.');
  });

  it('[Zero] ⚠️ quando NADA resolveria, a frase é OUTRA — mandar ligar um controle seria mentir', () => {
    // O jogo pede mais posições do que qualquer transporte deste aparelho oferece. Aqui o problema é do JOGO,
    // e dizer «ligue um controle» mandaria a criança procurar uma coisa que não conserta nada.
    const demais = [...ACTIONS, ...ACTIONS, ...ACTIONS]; // 42 posições: acima até do gamepad
    const linhas = linhasDoAviso(alcance(transportesPadrao({ gamepad: sempre, teclado: sempre, toque: sempre }), demais), cru);
    expect(linhas).toContain('reach.semSaida');
    expect(linhas.some((l) => l.startsWith('reach.ligue'))).toBe(false);
  });

  it('[Interface] todas as chaves usadas EXISTEM no dicionário base', () => {
    // O tradutor `real` lança em chave ausente, então isto é a asserção. Uma chave que falta não dá erro no
    // navegador — dá a chave crua na tela, ou uma frase vazia num leitor de tela, que é pior.
    expect(() => linhasDoAviso(alcance(TABLET, ACTIONS, 1), real)).not.toThrow();
    expect(() => linhasDoAviso(alcance(transportesPadrao({ gamepad: sempre, teclado: sempre, toque: sempre }),
      [...ACTIONS, ...ACTIONS, ...ACTIONS]), real)).not.toThrow();
  });
});

// -----------------------------------------------------------------------------------------------------------
// ⚠️ O DESCRIBE `as DUAS raizes mostram o aviso` SAIU DAQUI na separacao do cartucho (issue #111), e nao
// foi apagado: ele mudou para `game-platformer/tests/reach-notice-plataforma.node.test.js`. As duas
// asseercoes dele nao eram sobre a engine — liam o fonte de `main.ts` e afirmavam que o preset REAL do
// jogo de plataforma tem NOVE acoes. Com o cartucho fora, nenhuma das duas e' aferivel aqui, e falsificar
// o preset apagaria justamente o que elas provam. O que fica neste ficheiro e' o TEXTO do aviso, que e'
// comportamento da engine e nao depende de jogo nenhum.

// ========================= MUTACOES CONFERIDAS (o segundo eixo, ADR-0104) =========================
//   · `holds()` a devolver sempre `true` (o tecto deixa de valer, e volta o modelo em que «chega» era a
//     unica pergunta) -> reprovam DOIS, os dois do ponto cego. E o estado do repositorio ate hoje.
//   · `holds()` a ler a ausencia como ZERO -> reprovam QUATRO, e tres deles sao casos ANTIGOS: o teclado e o
//     controle, que nao declaram tecto, passariam a reprovar TODOS os jogos. Ausencia de medida nao pode
//     virar acusacao, e o estrago de a ler assim e' muito maior do que o caso novo que a nomeia.
//   · `SEGURA_TOQUE` de 2 para 5 — que e' exactamente o que o `maxTouchPoints` costuma anunciar -> reprovam
//     DOIS. E a mutacao que representa a decisao inteira do ADR-0104 §B: cinco e' o numero que o aparelho
//     DIZ, dois e' o que ele FAZ.
//   · `ok` de volta a `reachable(lista, acoes)` -> reprovam DOIS. Ele voltaria a dizer «da para jogar» sobre
//     um jogo que nao da.
//   · `naoSeguram` sem o filtro `carries` -> reprova o caso da acusacao dupla: o mesmo aparelho apareceria
//     nas duas listas e a crianca leria dois problemas onde ha um.
//   · tirando o laco da terceira frase do `ui/reach-notice` -> reprova a frase em portugues. O `ok`
//     reprovaria e ninguem diria porque, que e' a versao pior do defeito original.
//
// E no `tests/contract.node.test.js`, sobre o campo obrigatorio:
//   · aceitar `holdsAtOnce` ausente -> reprovam TRES, incluindo a contagem dos nove campos.
//   · aceitar zero -> reprova o caso do zero. Um jogo que nao segura nada nao e' jogavel, e aceita-lo faria
//     a aritmetica do alcance passar por vacuidade.
