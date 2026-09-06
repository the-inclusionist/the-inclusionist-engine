// SPDX-License-Identifier: AGPL-3.0-or-later
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
import { describe, it, expect, beforeAll } from 'vitest';
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
function domFalso({ comMarcacao = true, ausentes = [], mapa = {}, listas = {} } = {}) {
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
    // ⚠️ `ausentes` existe porque um duplo que responde SIM a qualquer seletor não testa a pergunta —
    // testa apenas que ela foi feita. Foi o que deixou o caso do mundo inexistente passar verde.
    // ⚠️ `mapa` deixa um caso NOMEAR o elemento que um seletor devolve. Sem ele o duplo respondia
    // sempre um objeto novo, e nenhum teste conseguia observar o que foi escrito NAQUELE elemento.
    querySelector: (sel) => (mapa[sel] !== undefined ? mapa[sel]
      : (ausentes.includes(sel) ? null : (comMarcacao ? el(sel) : null))),
    // ⚠️ POR SELETOR, e nao uma lista so: devolver a mesma coisa a todo seletor fazia os overlays de
    // mentira chegarem tambem a `[data-i18n]`, e o `applyDom` chamava `getAttribute` num objeto que
    // nao o tem. Um duplo que nao distingue a pergunta acaba a responder a errada.
    querySelectorAll: (sel) => (listas[sel] ?? []),
  };
  // ⚠️ O `win` REGISTRA agora, e nao e zelo: um duplo que engole `addEventListener` nao consegue responder
  // "isto ficou LIGADO?", que e exatamente a pergunta da issue #109. Enquanto ele era um no-op, `createGame`
  // podia montar a navegacao de menu e nao a ligar sem que nada ficasse vermelho — e foi o que aconteceu.
  const ouvintes = [];
  const win = {
    addEventListener: (tipo, fn, captura) => { ouvintes.push({ tipo, fn, captura }); },
    getComputedStyle: () => ({ zIndex: '0' }),
  };
  return { doc, win, ouvintes };
}

/** Uma declaração de quiz conforme — sem espaço, só ordem. É o gênero que não pode fingir ser plataforma. */
const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'primeira pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

describe('createGame em execução', () => {
  // AQUECE O MÓDULO UMA VEZ, FORA DA JANELA DE 5s DE CADA CASO.
  //
  // Os seis `await import()` deste bloco são de propósito: a primeira metade do arquivo lê a FONTE, e um
  // import estático faria um `create-game` quebrado derrubar também os casos que só leem texto — que é
  // exatamente o que se quer medindo separado.
  //
  // O preço disso era um teste INTERMITENTE: o primeiro `import` paga a transformação a frio do grafo de boot
  // inteiro (engine + i18n + áudio + overlays), e isso passa dos 5s padrão do vitest quando a máquina está
  // carregada ou quando uma edição invalidou o cache de transformação — foi o que aconteceu ao mudar o padrão
  // de `ui/dom`. Falhava com "Test timed out in 5000ms", que lê como teste lento e é, na verdade, um teste
  // medindo a compilação. Aquecendo aqui, os seis imports seguintes saem do cache e medem só o que deviam.
  beforeAll(async () => { await import('../app/js/boot/create-game.js'); }, 30000);

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


  it('⚠️ o MUNDO declarado que NAO existe no documento vira `problems` (ADR-0087)', async () => {
    // A falha que a conformidade nao alcanca: `conformanceProblems` confere a FORMA — que ha um seletor e
    // que ele nao esta vazio — e nao tem como conferir se ele CASA alguma coisa, porque `core/contract` e
    // puro e nao ve DOM.
    //
    // Um erro de digitacao passa na conformidade e produz exatamente o defeito que o ADR-0087 existe para
    // eliminar: a simulacao de empatia aplicada a NADA, e um adulto informado de que sentiu algo que nao
    // sentiu. E lacuna do HOSPEDEIRO, entao entra em `problems` — o jogo abre e quem o integrou le.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso({ ausentes: ['#gaem-region'] });
    const torto = { ...declaracaoValida(), world: () => ({ kind: 'element', selector: '#gaem-region' }) };
    const motor = createGame({ declaration: torto, host: { doc, win } });
    expect(motor.problems.join(' ')).toMatch(/mundo declarado nao encontrado|mundo declarado não encontrado/);
    expect(motor.tts, 'o jogo abre mesmo assim').toBeTruthy();
  });

  it('`none` NAO exige elemento nenhum — atividade sem espaco', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const paint = { ...declaracaoValida(), world: () => ({ kind: 'none' }) };
    const motor = createGame({ declaration: paint, host: { doc, win } });
    expect(motor.problems.join(' ')).not.toMatch(/mundo declarado/);
  });

  it('⚠️ a navegacao de menu fica LIGADA, e nao so montada (issue #109)', async () => {
    // `MenuNavApi.attach()` existia e `createGame` nunca a chamava. Num jogo que arranque pela engine, os
    // dialogos de acessibilidade e o menu de pausa respondiam so ao RATO — o pilar 2 a falhar por inteiro.
    // O `consumer-quiz` tinha de a chamar a mao logo depois do `createGame`, o que e o sintoma.
    //
    // A FASE DE CAPTURA faz parte da assercao: o menu tem de ver a tecla ANTES de quem quer que esteja
    // por baixo, senao o jogo consome a seta e o dialogo aberto nao navega.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win, ouvintes } = domFalso();
    createGame({ declaration: declaracaoValida(), host: { doc, win } });
    const nav = ouvintes.filter((o) => o.tipo === 'keydown' && o.captura === true);
    expect(nav.length, 'a navegacao de menu voltou a ficar desligada').toBeGreaterThan(0);
  });

  it('⚠️ a ARMADILHA DE FOCO fica instalada, e prende de verdade (issue #109)', async () => {
    // ⚠️ ESTE CASO NASCEU DE UMA MUTACAO QUE SOBREVIVEU. A primeira versao aferia "ha ouvinte de keydown em
    // captura", e a navegacao de menu ja instalava um — tirar a armadilha inteira do `createGame` deixava a
    // contagem intacta e o teste verde. Contar ouvintes responde "alguem se registou", nao "a armadilha
    // existe". Entao este caso DISPARA um Tab pelos ouvintes instalados e afere o que aconteceu ao foco.
    const { createGame } = await import('../app/js/boot/create-game.js');

    const focados = [];
    const botao = (n) => ({ n, hidden: false, getClientRects: () => [{}], focus() { focados.push(n); } });
    const dentro = [botao('primeiro'), botao('ultimo')];
    const overlay = {
      hidden: false, style: { zIndex: '61' },
      querySelectorAll: () => dentro,
    };
    const { doc, win, ouvintes } = domFalso({ listas: { '#game-region .overlay': [overlay] } });
    doc.activeElement = { n: 'o tabuleiro por baixo' }; // o foco esta FORA do dialogo: o caso realista

    createGame({ declaration: declaracaoValida(), host: { doc, win } });

    let impedido = false;
    const tab = { key: 'Tab', shiftKey: false, preventDefault: () => { impedido = true; } };
    for (const o of ouvintes) if (o.tipo === 'keydown' && o.captura === true) o.fn(tab);

    expect(focados, 'o Tab saiu do dialogo para o jogo por baixo').toEqual(['primeiro']);
    expect(impedido, 'sem preventDefault o navegador move o foco logo a seguir').toBe(true);
  });

  it('⚠️ a engine ENTREGA o aviso de que o laco parou (ADR-0054, issue #109)', async () => {
    // O `createGame` montava tres fios e nao ligava nenhum, e este era o pior: `core/loop` ja parava quando um
    // quadro lancava, e parava EM SILENCIO. Tela congelada e sintoma VISUAL — no modo cego, um jogo parado e
    // um jogo pensando produzem a mesma coisa.
    //
    // ⚠️ ENTREGUE E NAO INSTALADO, e o caso afere essa forma de proposito: quem chama `startLoop` e o JOGO,
    // dono do ticker. A engine nao pode instalar o que nao possui — o que ela pode e nao obrigar cada jogo a
    // escrever a propria mensagem, que divergiria em silencio entre jogos.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const alerta = { textContent: '' };
    const regiao = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, style: {}, contains: () => false };
    const { doc, win } = domFalso({ mapa: { '#sr-alert': alerta, '#game-region': regiao } });
    const motor = createGame({ declaration: declaracaoValida(), host: { doc, win } });

    expect(typeof motor.aoFalhar, 'a engine deixou de entregar o aviso').toBe('function');
    motor.aoFalhar(new Error('o quadro quebrou'));
    expect(alerta.textContent, 'quem nao ve a tela nao foi avisado').toBeTruthy();
    expect(regiao.attrs['data-incl-parou'], 'quem ve a tela nao foi avisado').toBe(alerta.textContent);
  });

  it('⚠️ o filtro de visao cai no MUNDO DECLARADO, e nao numa canvas assumida (ADR-0087)', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const mundo = { style: {}, contains: () => false };
    const { doc, win } = domFalso({ mapa: { '#meu-mundo': mundo } });
    const d = { ...declaracaoValida(), world: () => ({ kind: 'element', selector: '#meu-mundo' }) };
    const motor = createGame({ declaration: d, host: { doc, win } });
    motor.aplicarFiltroDeVisao('brightness(0)', 'mundo');
    expect(mundo.style.filter).toBe('brightness(0)');
  });

  it('⚠️ um overlay DENTRO do mundo perde o filtro — e um de fora nao e tocado', async () => {
    // A generalizacao que substitui a regra escrita a mao do `main.ts`: ele limpava `#dom-layer` porque ele
    // esta DENTRO de `#game-region` e o filtro CSS herda. Aqui o codigo PERGUNTA ao DOM em vez de assumir a
    // forma, e por isso serve tanto a marcacao da engine quanto a de um jogo que nao aninha nada.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const dentro = { style: { filter: 'brightness(0)' } };
    const fora = { style: { filter: 'brightness(0)' } };
    const mundo = { style: {}, contains: (el) => el === dentro };
    const { doc, win } = domFalso({ mapa: { '#meu-mundo': mundo }, listas: { '#game-region .overlay': [dentro, fora] } });
    const d = { ...declaracaoValida(), world: () => ({ kind: 'element', selector: '#meu-mundo' }) };
    createGame({ declaration: d, host: { doc, win } }).aplicarFiltroDeVisao('brightness(0)', 'mundo');
    expect(dentro.style.filter, 'o menu dentro do mundo tem de sair da simulacao').toBe('');
    expect(fora.style.filter, 'um overlay fora do mundo nao e assunto desta funcao').toBe('brightness(0)');
  });

  it('com alcance `mundo-e-menus` o overlay de dentro MANTEM o filtro', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const dentro = { style: { filter: 'contrast(2)' } };
    const mundo = { style: {}, contains: () => true };
    const { doc, win } = domFalso({ mapa: { '#meu-mundo': mundo }, listas: { '#game-region .overlay': [dentro] } });
    const d = { ...declaracaoValida(), world: () => ({ kind: 'element', selector: '#meu-mundo' }) };
    createGame({ declaration: d, host: { doc, win } }).aplicarFiltroDeVisao('contrast(2)', 'mundo-e-menus');
    expect(dentro.style.filter, 'melhoria alcanca os menus; so a EMPATIA os poupa').toBe('contrast(2)');
  });

  it('⚠️ `none` NAO pinta nada — atividade sem espaco nao tem mundo para simular', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const qualquer = { style: {}, contains: () => false };
    const { doc, win } = domFalso({ mapa: { '#meu-mundo': qualquer } });
    const d = { ...declaracaoValida(), world: () => ({ kind: 'none' }) };
    createGame({ declaration: d, host: { doc, win } }).aplicarFiltroDeVisao('brightness(0)', 'mundo');
    expect(qualquer.style.filter, 'pintar um filtro sobre atividade sem espaco e a mentira ao contrario').toBeUndefined();
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
