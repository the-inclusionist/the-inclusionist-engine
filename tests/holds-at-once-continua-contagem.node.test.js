// SPDX-License-Identifier: AGPL-3.0-or-later
// `holdsAtOnce` CONTINUA A SER UMA CONTAGEM — o gate protector que o ADR-0115 deve.
//
// ========================= POR QUE ESTE FICHEIRO EXISTE =========================
// 🔴 O ADR-0115 nasceu de uma correcção do Dev — «nem todo jogo precisa de alternância, somente os que
// precisam de tecla segurando» — e ao escrevê-lo a medição apanhou uma armadilha que estava montada há
// semanas: **o `holdsAtOnce()` PARECE responder «este jogo segura teclas?» e não responde.**
//
//   · O `conformanceProblems` RECUSA zero, com uma razão escrita que é sobre a ARITMÉTICA DO ALCANCE —
//     «a game that holds nothing cannot be played» — e não sobre alternância;
//   · o `consumer-quiz` declara **1 enquanto não segura nada**, porque o contrato o obriga a ≥ 1.
//
// Ou seja: «um de cada vez» e «um SEGURADO» são o mesmo número. Quem chegar a seguir para construir o
// ADR-0115 vai olhar para este campo — eu olhei — e a leitura errada não dá erro nenhum: ela faz o alcance
// passar por vacuidade e o cartão da #112 nunca aparecer, que é exactamente o defeito que o `holdsAtOnce`
// existe para consertar (ADR-0104 §A).
//
// ⚠️ ESTE GATE NÃO IMPEDE A DECISÃO — impede a decisão ACIDENTAL. Se um dia o campo for cindido em dois, o
// registo que o cindir apaga este ficheiro e escreve o dele; o que não pode acontecer é o significado mudar
// porque alguém leu depressa.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { conformanceProblems } from '../app/js/core/contract.js';

/** A declaração mínima válida, com o `holdsAtOnce` como parâmetro — é o que este ficheiro faz variar. */
function declaracao(segura) {
  return {
    topology: () => ({ kind: 'hotspots', order: ['a', 'b', 'c'] }),
    holdsAtOnce: () => segura,
    tick: 'player',
    world: () => ({ kind: 'none' }),
    roleAt: () => 'goal',
    nameAt: () => ({ text: 'alvo', gender: 'm', plural: false }),
    focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
    objectiveOf: () => ({ name: { text: 'alvos', gender: 'm', plural: true }, have: 0, need: 3 }),
    targetsOf: () => [{ x: 0, y: 0 }],
  };
}

const problemasDoCampo = (segura) => conformanceProblems(declaracao(segura)).filter((p) => p.startsWith('holdsAtOnce'));

describe('`holdsAtOnce` é uma CONTAGEM e o piso é 1', () => {
  it('[Right] um, dois e três são declarações válidas', () => {
    for (const n of [1, 2, 3, 9]) {
      expect(problemasDoCampo(n), `${n} deixou de ser uma contagem válida`).toEqual([]);
    }
  });

  // 🔴 ZERO CONTINUA RECUSADO, e a razão importa mais do que a recusa: ela é sobre a aritmética do alcance.
  // Deixar zero passar faria `alcance()` aprovar por VACUIDADE — o mesmo defeito que o `reachable` recusa —
  // e o cartão que avisa a criança de que o aparelho dela não carrega o jogo nunca apareceria.
  it('🔴 [Zero] zero é RECUSADO, e não passa a significar «não segura nada»', () => {
    expect(problemasDoCampo(0), 'zero passou a ser aceite — o alcance passa a aprovar por vacuidade').toHaveLength(1);
  });

  it('[Fronteira] negativo e fraccionário também são recusados', () => {
    expect(problemasDoCampo(-1)).toHaveLength(1);
    expect(problemasDoCampo(1.5)).toHaveLength(1);
  });

  // ⚠️ A MENSAGEM É PARTE DO CONTRATO, e é ela que ensina o próximo autor. «How many» e não «whether»: quem
  // lê a acusação tem de perceber que o campo pede um NÚMERO de dedos, não um sim/não.
  it('⚠️ [Interface] a acusação diz QUANTAS, e não SE', () => {
    const [msg] = conformanceProblems({ ...declaracao(1), holdsAtOnce: undefined })
      .filter((p) => p.startsWith('holdsAtOnce'));
    expect(msg, 'a mensagem deixou de pedir uma contagem').toContain('how many');
    expect(msg.toLowerCase(), 'a mensagem passou a sugerir uma pergunta de sim/não').not.toContain('whether');
  });
});

describe('o número é usado como MAGNITUDE, e não como bandeira', () => {
  // 🎯 O CASO QUE DISTINGUE AS DUAS LEITURAS, e nenhum outro o faz. Se alguém passar a ler este campo como
  // «segura / não segura», 1 e 3 comportam-se igual — e nada mais nesta suíte nota. Aqui a diferença é
  // observável: um aparelho que segura DOIS serve quem pede dois e não serve quem pede três.
  it('🎯 [Right] pedir 3 e pedir 1 dão respostas DIFERENTES no alcance', async () => {
    const { alcance } = await import('../app/js/input/transports.js');
    const acoes = ['up', 'down', 'left', 'right'];
    // Um transporte com lugares de sobra e um tecto de DOIS ao mesmo tempo — a forma do toque (SEGURA_TOQUE).
    const doisDedos = [{ id: 'toque', slots: 14, holds: 2, available: () => true }];

    expect(alcance(doisDedos, acoes, 1).ok, 'quem pede um deixou de ser servido por dois dedos').toBe(true);
    expect(alcance(doisDedos, acoes, 2).ok, 'quem pede dois deixou de ser servido por dois dedos').toBe(true);
    expect(alcance(doisDedos, acoes, 3).ok, 'quem pede TRÊS passou a ser servido por dois dedos').toBe(false);
  });

  // 📌 E o par: a recusa nomeia o transporte que não segura, em vez de dizer só «não». É o que a tela da #112
  // mostra à criança, e sem ele o `ok: false` seria um beco.
  it('📌 [Right] quem não segura o bastante é NOMEADO, com o número dele', async () => {
    const { alcance } = await import('../app/js/input/transports.js');
    const a = alcance([{ id: 'toque', slots: 14, holds: 2, available: () => true }], ['up', 'down'], 3);
    expect(a.naoSeguram).toEqual([{ id: 'toque', holds: 2 }]);
  });
});

// ===== MUTAÇÕES CONFERIDAS (2026-09-08, por script, com contagem de ocorrências) =====
// 1. `conformanceProblems` a aceitar zero            → 🔴 o caso do ZERO reprova
// 2. a mensagem a dizer «whether the game holds»     → ⚠️ o caso da acusação reprova, nas duas metades
// 3. `holds()` do `input/transports` a devolver
//    sempre `true` (o tecto deixa de contar)         → 🎯 o caso da MAGNITUDE reprova, e é o único que o
//    apanha: nada mais nesta suíte distingue «lê como número» de «lê como bandeira»
// 4. `naoSeguram` a não nomear o transporte          → o par reprova
