// SPDX-License-Identifier: GPL-3.0-or-later
// O VEREDITO DO ADR-0027 (passo 4), como teste — item 13 da pipeline.
//
// O registro não deixou a pergunta vaga, e não deixou a consequência vaga tampouco:
//
//     "se `createGame()` não puder ser escrito sem um parâmetro chamado `coinTarget`, a fronteira que este
//      registro propõe está errada e os passos 5 a 7 NÃO PODEM COMEÇAR."
//
// Este arquivo tem DUAS metades, e elas medem coisas diferentes.
//
// A primeira lê a FONTE. Ela existe porque o veredito é sobre o que a assinatura EXIGE, e uma assinatura se
// lê — não se executa. Um teste que só chamasse `createGame()` com um argumento válido nunca perceberia um
// `coinTarget` opcional dormindo no tipo.
//
// A segunda EXECUTA, num DOM de mentira. Ela existe porque a primeira metade é cega para o que importa
// depois: se a ordem obrigatória é mesmo obrigatória, se declarar mal explode, se faltar marcação não explode.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FONTE = readFileSync(join(process.cwd(), 'app', 'js', 'boot', 'create-game.ts'), 'utf8');

/** Linhas de CÓDIGO da fonte: sem comentário. A prosa deste módulo CITA `coinTarget` para explicar o
 *  veredito, e um filtro que confundisse a citação com a exigência reprovaria o próprio registro. */
const CODIGO = FONTE.split('\n')
  .filter((ln) => { const t = ln.trim(); return t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*'); })
  .join('\n');

describe('o veredito: a fronteira passa ou não passa', () => {
  it('[Right] `createGame()` NÃO pede coinTarget — nem alvo de moeda com outro nome', () => {
    // É a frase do ADR virada gate. Se um dia alguém precisar do número de moedas aqui, o caso reprova e a
    // conversa volta a ser sobre a FRONTEIRA, não sobre um parâmetro a mais.
    expect(CODIGO).not.toMatch(/coinTarget/);
    expect(CODIGO).not.toMatch(/\bcoins?\b/i);
    expect(CODIGO).not.toMatch(/\bmoedas?\b/i);
  });

  it('[Right] o alvo vem do CONTRATO, e é assim que `coinTarget` deixou de ser preciso', () => {
    // Não basta a ausência: uma engine que simplesmente não soubesse do objetivo também passaria no caso
    // acima, e teria perdido a funcionalidade em vez de tê-la generalizado. `objectiveOf` é o campo 5.
    expect(CODIGO).toMatch(/GameDeclaration/);
    expect(CODIGO).toMatch(/conformanceProblems/);
  });

  it('[Right] a raiz de composição NÃO importa de game/', () => {
    expect(CODIGO).not.toMatch(/from '\.\.\/game\//);
  });

  it('[Right] nem de educational/ — currículo é da plataforma, e um boot genérico não o conhece', () => {
    expect(CODIGO).not.toMatch(/from '\.\.\/educational\//);
  });

  it('[Interface] o mixer é ligado ANTES da voz — a ordem do achado 3, na ordem do arquivo', () => {
    // O achado 3 do segundo consumidor: sem `initAudioMixer()` antes, `audioCat` é null e o `narrate` cala
    // sem erro. Aqui a ordem é do arquivo, e este caso é o que impede uma reordenação distraída.
    const mixer = CODIGO.indexOf('initAudioMixer()');
    const voz = CODIGO.indexOf('createTts(');
    expect(mixer, 'initAudioMixer() precisa ser chamado').toBeGreaterThan(-1);
    expect(voz, 'createTts() precisa ser chamado').toBeGreaterThan(-1);
    expect(mixer, 'mixer depois da voz = narração muda, sem erro nenhum').toBeLessThan(voz);
  });

  it('[Interface] o idioma é ligado com o documento do HOSPEDEIRO, não com o global', () => {
    // Achado 15, e o motivo de ele ser um caso e não uma nota: `initI18n()` alcançava o `document` global por
    // baixo de quem a chamasse. Num navegador dá no mesmo, e é por isso que sobreviveu tanto tempo.
    expect(CODIGO).toMatch(/initI18n\(doc\)/);
    expect(CODIGO, 'nenhuma linha de código deste boot pode alcançar o document global').not.toMatch(/document/);
  });
});

/* ===================== a metade que EXECUTA ===================== */

/** Um documento de mentira: só o suficiente para `createGame` fazer o que faz sem navegador. */
function domFalso({ comMarcacao = true } = {}) {
  const feito = [];
  const el = (id) => ({
    id, hidden: true, style: {}, dataset: {},
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, setAttribute: () => {}, removeChild: () => {},
    get firstChild() { return null; },
    ownerDocument: null,
  });
  const doc = {
    activeElement: null,
    createElement: (tag) => { feito.push(tag); return el(tag); },
    contains: () => false,
    querySelector: (sel) => (comMarcacao ? el(sel) : null),
    querySelectorAll: () => [],
  };
  const win = {
    addEventListener: () => {},
    getComputedStyle: () => ({ zIndex: '0' }),
  };
  return { doc, win };
}

/** Uma declaração de quiz conforme — sem espaço, só ordem. É o gênero que não pode fingir ser plataforma. */
const declaracaoValida = () => ({
  topology: { kind: 'hotspots', order: ['q1', 'q2', 'q3'] },
  tick: 'player',
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'primeira pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3 }),
});

describe('createGame em execução', () => {
  it('[Zero] declaração MALFORMADA explode — um jogo meio declarado é pior que um que não abre', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const ruim = { ...declaracaoValida(), topology: undefined };
    expect(() => createGame({ declaration: ruim, host: { doc, win } })).toThrow(/malformada/);
  });

  it('[Right] a exceção DIZ o que falta, em vez de "erro ao iniciar"', () => {
    // Quem escreve um preset lê esta mensagem no primeiro `npm run dev`; ela é o manual naquele momento.
    return import('../app/js/boot/create-game.js').then(({ createGame }) => {
      const { doc, win } = domFalso();
      const ruim = { ...declaracaoValida(), tick: 'turno', roleAt: undefined };
      let msg = '';
      try { createGame({ declaration: ruim, host: { doc, win } }); } catch (e) { msg = String(e.message); }
      expect(msg).toMatch(/tick/);
      expect(msg).toMatch(/roleAt/);
    });
  });

  it('[Boundary] marcação AUSENTE não explode: vira `problems`, e o resto da engine liga', async () => {
    // A assimetria é a decisão do módulo, e este par de casos é o que a prende. Declaração errada é defeito
    // de PROGRAMA; id faltando é lacuna do HOSPEDEIRO, e o segundo consumidor provou que ligar só a parte
    // que serve é legítimo — foi assim que ele recusou o pad e o sonar sem mentir.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso({ comMarcacao: false });
    const motor = createGame({ declaration: declaracaoValida(), host: { doc, win } });
    expect(motor.problems.length).toBeGreaterThan(0);
    expect(motor.problems.join(' ')).toMatch(/game-region/);
    expect(motor.tts, 'a voz tem de existir mesmo com o documento incompleto').toBeTruthy();
    expect(motor.nav).toBeTruthy();
  });

  it('[Right] com o documento completo, `problems` só acusa o que de fato falta', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ declaration: declaracaoValida(), host: { doc, win } });
    // O host de filtros não foi fornecido neste caso, e é a ÚNICA lacuna que deve sobrar.
    expect(motor.problems).toHaveLength(1);
    expect(motor.problems[0]).toMatch(/filtros/);
  });

  it('[Interface] declinar fica NO REGISTRO — um consumidor pode ser auditado pelo que recusou', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({
      declaration: declaracaoValida(), host: { doc, win },
      declines: { semMenuDePausa: true, semAssistenteDePad: true },
    });
    expect(motor.declines.semMenuDePausa).toBe(true);
    expect(motor.declines.semAssistenteDePad).toBe(true);
    expect(motor.declines.semAtorDePausa).toBeUndefined();
  });

  it('[Right] a declaração ATRAVESSA intacta — a engine carrega os sete campos, não uma cópia deles', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const d = declaracaoValida();
    const motor = createGame({ declaration: d, host: { doc, win } });
    expect(motor.declaration).toBe(d);
    // E o objetivo é legível SEM a engine saber o que é uma moeda: é o campo 5 respondendo.
    expect(motor.declaration.objectiveOf(0)).toEqual({
      name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3,
    });
  });

  it('[Right] um jogo SEM FASES não precisa inventar uma — `isNavigable` ausente vale `true`', async () => {
    // O achado 10 do segundo consumidor, virado padrão: o quiz precisava se declarar "pausado" para navegar
    // os próprios menus. O caso mais simples passou a ser o que não obriga a mentir.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    expect(() => createGame({ declaration: declaracaoValida(), host: { doc, win } })).not.toThrow();
  });
});
