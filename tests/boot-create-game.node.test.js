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
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';
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
    // 🔴 ESTE CASO ESTEVE MORTO E NINGUÉM SABIA. A regex tinha um caractere de CONTROLO invisível no meio —
    // `/docu<VT>ment/` — injectado por uma edição via PowerShell, onde a crase é escape e `` `v `` é
    // tabulação vertical. Ela nunca podia casar com `document`, logo o caso passava sempre, e passava pela
    // pior razão possível: parecia guardar a fronteira e não guardava nada.
    // ⚠️ E RESSUSCITADO ELE ACUSOU UM FALSO POSITIVO, que é a segunda metade da lição: a palavra PORTUGUESA
    // «documento», dentro de uma linha de `problems` que fala a quem integra a engine, contém `document`. A
    // fronteira de palavra separa as duas — «documento» tem um `o` a seguir, logo `\b` falha ali.
    expect(CODIGO, 'nenhuma linha de código deste boot pode alcançar o document global').not.toMatch(/\bdocument\b/);
  });
});

/* ===================== a metade que EXECUTA ===================== */

/** Um documento de mentira: só o suficiente para `createGame` fazer o que faz sem navegador. */
function domFalso({ comMarcacao = true, ausentes = [], mapa = {}, listas = {} } = {}) {
  const feito = [];
  const el = (id) => ({
    id,
    hidden: true,
    /*
     * ⚠️ `style` COM OS DOIS MÉTODOS — a QUINTA vez que este duplo fica mais pobre que a coisa real, e a
     * primeira em que não é um método solto: `{}` parece um `style` e não é. Desde que a engine monta o painel
     * de tipografia (ADR-0106 §1), o `initSettingsTypo` aplica a fonte persistida no arranque e escreve
     * `--font-custom` na raiz do documento — com `{}` isso é um `TypeError` no meio do boot.
     */
    style: { setProperty() {}, removeProperty() {} },
    dataset: {},
    /*
     * ⚠️ `classList` QUE FUNCIONA, e não um que engole — a SEXTA vez que este duplo fica mais pobre que a
     * coisa real. Entrou com o painel de sensibilidade visual: `reflectMotionBtn` faz
     * `b.classList.toggle('is-on', …)` e o `ui/dom.toggleBtn` faz o mesmo em qualquer botão-mestre.
     *
     * 📌 Sobre um `Set` e não com métodos vazios, pela lição que este ficheiro já aprendeu cinco vezes: um
     * duplo que aceita a chamada e não guarda nada responde «sim» a qualquer pergunta sobre classe, e um
     * teste que pergunte «ficou ligado?» passa sem que nada tenha ficado.
     */
    classList: (() => {
      const s = new Set();
      return {
        add: (c) => s.add(c),
        remove: (c) => s.delete(c),
        contains: (c) => s.has(c),
        toggle: (c, forcar) => {
          const por = forcar ?? !s.has(c);
          if (por) s.add(c); else s.delete(c);
          return por;
        },
      };
    })(),
    // ⚠️ `innerHTML` ENTROU EM 2026-09-08, e é a mesma lição que o `ausentes` e o `mapa` já ensinaram neste
    // ficheiro: um duplo mais pobre do que a coisa real não testa a pergunta. Todo `Element` de verdade tem
    // `innerHTML`; sem ele aqui, a montagem da barra (etapa 2 do ADR-0106) recusava-se a correr e o duplo
    // fazia a engine parecer errada. O caso que isto destrava é o da barra montada, logo abaixo.
    innerHTML: '',
    // ⚠️ `appendChild` entrou na mesma volta e pela mesma razão: desde a etapa 2 o `createGame` PENDURA o
    // cartão de pausa no hospedeiro, e um duplo que não aceita filhos fazia a engine acusar uma lacuna que
    // só existia no duplo. Terceira vez que este ficheiro aprende a lição — ver `ausentes` e `mapa`.
    filhos: [],
    appendChild(n) { this.filhos.push(n); return n; },
    // ⚠️ `insertBefore` e `contains` entraram em 2026-09-11, com os painéis de ajustes. O `contains` é o que
    // responde à pergunta que a engine passou a fazer — «este hospedeiro está dentro de `#game-region`?» —, e
    // um duplo que respondesse sempre `false` faria a engine acusar uma lacuna que só existe no duplo, que é a
    // armadilha que este ficheiro já documentou quatro vezes. Recursivo porque a pergunta real também é.
    insertBefore(novo, ref) {
      const i = this.filhos.indexOf(ref);
      if (i < 0) this.filhos.push(novo); else this.filhos.splice(i, 0, novo);
      return novo;
    },
    contains(n) { return n === this || this.filhos.some((f) => f === n || (f.contains && f.contains(n))); },
    /*
     * ⚠️ `closest` — a SÉTIMA vez que este duplo fica mais pobre que a coisa real, e entrou com a retradução
     * do interior dos painéis: `montarInteriorDoAudio` sobe de um controle para a `.ctrl-row` dele para lhe
     * reescrever as palavras. 📌 Devolve `null` e não `this`: aqui os nós não têm pai, logo a resposta honesta
     * a «qual é o ancestral que casa» é «nenhum» — e quem chama já a trata (`if (linha)`).
     */
    closest() { return null; },
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, setAttribute: () => {}, removeAttribute: () => {}, removeChild: () => {},
    // ⚠️ `focus` ENTROU EM 2026-09-08 — a QUARTA vez que este duplo fica mais pobre que a coisa real, e vale
    // contar porquê: o cartão de alcance (`ui/reach-notice`) leva o foco ao próprio cartão e não ao botão,
    // «porque a criança tem de OUVIR o motivo antes de decidir». Ele só é montado quando o alcance REPROVA, e
    // até haver um jogo a declarar ponteiro nenhum caso deste ficheiro o fazia reprovar. A falha foi boa
    // notícia: só um aviso que dispara de verdade chega ao `focus()`.
    // 📌 As quatro juntas são a razão de existir o `boot-create-game.browser.test.js` — um duplo só sabe o que
    // quem o escreveu sabia, e a montagem mora onde o DOM decide.
    focus: () => {},
    get firstChild() { return null; },
    ownerDocument: null,
  });
  /*
   * 🔴 O MESMO SELETOR DEVOLVE O MESMO NÓ — e esta era a mentira mais cara do duplo.
   *
   * Num documento a sério, `$('#game-region')` chamado duas vezes devolve o MESMO elemento; aqui devolvia dois
   * objetos diferentes, e nenhum teste conseguia observar o que tinha sido escrito num deles. O `mapa` existe
   * precisamente por causa disso — é o remendo por caso de uma mentira que se conserta de uma vez.
   *
   * ⚠️ E DEIXOU DE SER FOLCLORE EM 2026-09-11: a engine pergunta se o hospedeiro da pausa está DENTRO de
   * `#game-region`, porque `ui/settings-panel.topVisibleOverlay` varre `'#game-region .overlay'` e é por ele
   * que as setas acham o painel aberto. Com dois objetos a responder ao mesmo id, a resposta é «não» sempre —
   * e a engine acusaria uma lacuna que só existe aqui.
   */
  const memo = new Map();
  const doc = {
    // A raiz onde a fonte escolhida é aplicada (`dataset.fonte` + `--font-custom`). UM objeto e não um getter
    // que fabrica: é a mesma razão do memo acima — quem escreve e quem lê têm de encontrar o mesmo nó.
    documentElement: el('html'),
    activeElement: null,
    createElement: (tag) => { feito.push(tag); return el(tag); },
    contains: () => false,
    // ⚠️ `ausentes` existe porque um duplo que responde SIM a qualquer seletor não testa a pergunta —
    // testa apenas que ela foi feita. Foi o que deixou o caso do mundo inexistente passar verde.
    // ⚠️ `mapa` deixa um caso NOMEAR o elemento que um seletor devolve. Sem ele o duplo respondia
    // sempre um objeto novo, e nenhum teste conseguia observar o que foi escrito NAQUELE elemento.
    querySelector: (sel) => {
      if (mapa[sel] !== undefined) return mapa[sel];
      if (ausentes.includes(sel) || !comMarcacao) return null;
      if (!memo.has(sel)) memo.set(sel, el(sel));
      return memo.get(sel);
    },
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

/**
 * O `#game-region` que um caso NOMEIA, para poder ver o que a engine pendurou nele.
 *
 * ⚠️ ERA QUATRO CÓPIAS DO MESMO LITERAL, e a duplicação cobrou em 2026-09-11: a engine passou a perguntar se o
 * hospedeiro da pausa está DENTRO de `#game-region` (é por `'#game-region .overlay'` que as setas acham o
 * painel aberto), e as quatro cópias precisavam da mesma resposta nova ao mesmo tempo. Uma função é o sítio
 * onde uma resposta dessas se escreve uma vez.
 */
function regiaoFalsa() {
  return {
    id: 'game-region', innerHTML: '', filhos: [],
    appendChild(n) { this.filhos.push(n); return n; },
    // `contains` diz a verdade sobre si mesmo e sobre os filhos — é a pergunta que a engine faz.
    contains(n) { return n === this || this.filhos.includes(n); },
    addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [],
  };
}

/** Uma declaração de quiz conforme — sem espaço, só ordem. É o gênero que não pode fingir ser plataforma. */
const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  holdsAtOnce: () => 1,
  // Um jogo de hotspots não segura nada — e declarar `1` acima e `false` aqui é a distinção do ADR-0115
  // escrita num fixture: os dois campos respondem a perguntas diferentes.
  seguraTeclas: () => false,
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
    expect(() => createGame({ acomodacoes: SEM_ASSUNTO, declaration: ruim, host: { doc, win } })).toThrow(/malformada/);
  });

  it('🔴 [Zero] um cartucho que declara «start» no preset é RECUSADO, com o motivo dito (ADR-0144 §4)', async () => {
    // 🔴 ESTE É O GATE QUE UMA IMPLEMENTAÇÃO DESCUIDADA PASSA POR ACIDENTE, e o próprio registo avisa disso:
    // HOJE nenhum cartucho declara «start», então afirmar só «nada partiu» ficaria verde com nada a valer.
    // Por isso o caso CONSTRÓI o cartucho proibido em vez de esperar por um.
    //
    // ⚠️ E A REGRA NÃO É ARRUMAÇÃO: desde o ADR-0122 a pausa não é declinável, e «start» é a única posição
    // por onde se lá chega. Um jogo que a tomasse para outra coisa declinava a pausa pela porta dos fundos —
    // com os quatro painéis montados, no documento, e inalcançáveis, sem uma linha vermelha em lado nenhum.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const base = () => ({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });

    expect(() => createGame({ acomodacoes: SEM_ASSUNTO, ...base(), preset: { start: { label: 'Turbo' } } }))
      .toThrow(/«start» is the position that opens the pause/);

    // O PAR QUE IMPEDE UM CRIVO QUE ACUSA SEMPRE: o mesmo preset sem «start» passa. Sem ele, uma recusa
    // escrita `if (preset) throw` ficaria verde acima e tiraria o vocabulário a todo o catálogo.
    expect(() => createGame({ acomodacoes: SEM_ASSUNTO, ...base(), preset: { action2: { label: 'Confirmar' } } })).not.toThrow();

    // E O `mount()` RECUSA PELA MESMA REGRA. `GanchosDoCartucho` carrega `preset`, logo um SEGUNDO cartucho
    // podia tomar o «start» que o primeiro respeitou — e a pausa ficava inalcançável a meio da sessão.
    const motor = createGame(base());
    expect(() => motor.mount(declaracaoValida(), { acomodacoes: SEM_ASSUNTO, preset: { start: { label: 'Turbo' } } }))
      .toThrow(/«start» is the position that opens the pause/);
  });

  it('🔴 [Right] the optional genre (ADR-0156): Casino game refused at createGame and mount; Horror game reported «avoid»', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const base = () => ({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    expect(() => createGame({ ...base(), genero: 'Casino game' })).toThrow(/Casino game.*prohibited/);
    expect(() => createGame({ ...base(), genero: 'Educational game' })).toThrow(/not in the engine's genre list/);
    // the pair: no genre, and a listed one, boot
    expect(() => createGame(base())).not.toThrow();
    const motor = createGame({ ...base(), genero: 'Horror game' });
    expect(motor.problems.join(' '), 'Horror game boots without its «avoid» mark said').toMatch(/Horror game.*avoid/);
    expect(createGame({ ...base(), genero: 'Platform games' }).problems.join(' ')).not.toMatch(/genre/i);
    expect(() => motor.mount(declaracaoValida(), { acomodacoes: SEM_ASSUNTO, genero: 'Casino game' })).toThrow(/Casino game.*prohibited/);
  });

  it('🔴 [Zero] e um cartucho que declara «select» também é RECUSADO — é a porta dos menus (ADR-0155 §4)', async () => {
    // Mesma construção do caso acima, e pela mesma razão: nenhum jogo declara «select» hoje (medido nos
    // repositórios dos jogos), então só um cartucho CONSTRUÍDO pode pôr este crivo vermelho.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const base = () => ({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    expect(() => createGame({ ...base(), preset: { select: { label: 'Mapa' } } }))
      .toThrow(/«select» is the position that opens the pause menus/);
    // o par: um preset sem posição de sistema passa
    expect(() => createGame({ ...base(), preset: { action1: { label: 'Mapa' } } })).not.toThrow();
    const motor = createGame(base());
    expect(() => motor.mount(declaracaoValida(), { acomodacoes: SEM_ASSUNTO, preset: { select: { label: 'Mapa' } } }))
      .toThrow(/«select» is the position that opens the pause menus/);
  });

  it('[Right] a exceção DIZ o que falta, em vez de "erro ao iniciar"', () => {
    // Quem escreve um preset lê esta mensagem no primeiro `npm run dev`; ela é o manual naquele momento.
    return import('../app/js/boot/create-game.js').then(({ createGame }) => {
      const { doc, win } = domFalso();
      const ruim = { ...declaracaoValida(), tick: 'turno', roleAt: undefined };
      let msg = '';
      try { createGame({ acomodacoes: SEM_ASSUNTO, declaration: ruim, host: { doc, win } }); } catch (e) { msg = String(e.message); }
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
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    expect(motor.problems.length).toBeGreaterThan(0);
    expect(motor.problems.join(' ')).toMatch(/game-region/);
    expect(motor.tts, 'a voz tem de existir mesmo com o documento incompleto').toBeTruthy();
    expect(motor.nav).toBeTruthy();
  });

  it('[Right] com o documento completo, `problems` só acusa o que de fato falta', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    // ⚠️ A declaração da voz neural entra aqui em 2026-09-08 porque um jogo REAL a abre (ADR-0094, uma linha). Sem
    // ela, o `problems` acusaria — correctamente — e este caso deixaria de medir o que diz medir.
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win },
      uses: { neuralVoice: true },
      // ⚠️ O `preset` ENTRA AQUI em 2026-09-12 pela mesma razão que a declaração da voz neural entrou em 08/09: a
      // ajuda passou a ser montada pela engine (ADR-0147 §4) e, sem as palavras do jogo, ela acusa — com
      // razão. Sem esta linha o caso deixaria de medir o que diz medir.
      preset: { action2: { label: 'Confirmar' } },
    });
    // O host de filtros não foi fornecido neste caso, e é a ÚNICA lacuna que deve sobrar.
    expect(motor.problems).toHaveLength(1);
    expect(motor.problems[0]).toMatch(/filter host/);
  });

  it('🔴 [Zero] SEM `preset` a AJUDA não é montada, e a engine DIZ porquê', async () => {
    // 🔴 A tela de ajuda lista POSIÇÃO ↔ tecla ↔ a palavra do jogo. Sem as palavras só restaria mostrar
    // `action2` a uma criança que abriu a ajuda precisamente por não saber o que o botão faz — o defeito que
    // o ADR-0074 proíbe. Então não se monta; e o §5 do ADR-0106 prefere a ausência ao botão morto.
    //
    // ⚠️ MAS A AUSÊNCIA TEM DE SER DITA, pelo precedente que o caso da voz neural fixou logo abaixo: uma
    // funcionalidade da engine que some por falta de UMA declaração, em silêncio, é a mesma classe de defeito.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win },
      uses: { neuralVoice: true },
    });
    const daAjuda = motor.problems.filter((p) => /help screen/.test(p));
    expect(daAjuda, 'sem `preset` a ajuda sumiu e nada o disse').toHaveLength(1);
    // 📌 E a linha tem de ser ACCIONÁVEL: diz o campo que falta e o registo que o define. Uma linha que só
    // dissesse «falta algo» seria a «lacuna que o consumidor lê como escolha» do ADR-0106 §2.
    expect(daAjuda[0]).toMatch(/preset/);
  });

  it('⚠️ [Zero] with NO neural voice declared, the engine SAYS so', async () => {
    // A game that does not ask for one (ADR-0216 §3) has only the browser's voice, and nothing said so: the line is the warning.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    const linha = motor.problems.find((p) => /neural voice/.test(p));
    expect(linha, 'sem voz neural e a engine não disse nada').toBeTruthy();
    expect(linha, 'the way out is not named').toMatch(/neuralVoice/);
    expect(linha, 'the decline is not named').toMatch(/semVozNeural/);
    expect(linha, 'what the child loses is not said').toMatch(/cannot read/);
  });

  it('⚠️ [Right] DECLARAR `semVozNeural` cala a linha — declinar é escolha, não declarar é omissão', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win }, declines: { semVozNeural: true },
    });
    expect(motor.problems.filter((p) => /neural voice/.test(p))).toEqual([]);
  });

  // ===================== O PONTEIRO DECLARADO (ADR-0112) =====================
  // ⚠️ SEM ESTA FIAÇÃO, A DECISÃO É UM PARÂMETRO QUE NINGUÉM CONSEGUE PÔR. O `alcance()` aceita a pergunta
  // desde `7ddb857` e tem gate próprio, mas o quarto argumento chegava sempre `false` porque a
  // `GameDeclaration` não tinha por onde dizê-lo — um jogo de desenho não conseguia declarar que desenha.
  const TRES_PALAVRAS = { up: { label: 'Subir' }, down: { label: 'Descer' }, action1: { label: 'Confirmar' } };
  const soTeclado = (rato) => ({
    gamepad: () => false, toque: () => false, teclado: () => true, rato: () => rato,
  });

  it('⚠️ [Zero] um jogo que DECLARA ponteiro é recusado por um aparelho que não aponta', async () => {
    // O cenário do ADR-0112: «Desenho livre» num aparelho sem rato nem toque. A recusa tem de acontecer AQUI,
    // antes de a criança começar, e não a meio do primeiro traço.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: { ...declaracaoValida(), needsPointer: () => true },
      host: { doc, win }, preset: TRES_PALAVRAS, disponibilidade: soTeclado(false),
    });
    expect(motor.alcance.pedePonteiro, 'a declaração não chegou ao alcance').toBe(true);
    expect(motor.alcance.ok, 'disse sim a um jogo que esta criança não consegue jogar').toBe(false);
    expect(motor.alcance.naoApontam).toEqual(['teclado']);
  });

  it('⚠️ [Right] o MESMO jogo com RATO passa — «no caso do teclado, o sinal contínuo é o mouse»', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: { ...declaracaoValida(), needsPointer: () => true },
      host: { doc, win }, preset: TRES_PALAVRAS, disponibilidade: soTeclado(true),
    });
    expect(motor.alcance.ok).toBe(true);
    expect(motor.alcance.naoApontam).toEqual([]);
  });

  it('⚠️ [Zero] quem NÃO declara nada não pede ponteiro — o campo é opcional de propósito', async () => {
    // ⚠️ E A OPCIONALIDADE É DECISÃO, não descuido. O `holdsAtOnce` é obrigatório porque não tem padrão seguro
    // e falha INVISIVELMENTE a quem escreve o jogo — ele tem teclado completo; quem descobre é a criança no
    // telemóvel de dois dedos. Este tem padrão seguro (`false`) e falha VISIVELMENTE: um jogo de desenho que
    // se esqueça de declarar é inoperável no próprio aparelho de quem o escreve. Obrigar trezentos jogos a
    // escrever `needsPointer: () => false` cobraria o preço do `holdsAtOnce` sem o motivo dele.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win }, preset: TRES_PALAVRAS, disponibilidade: soTeclado(false),
    });
    expect(motor.alcance.pedePonteiro).toBe(false);
    expect(motor.alcance.ok).toBe(true);
  });

  it('⚠️ [Right] a engine MONTA a barra de acessibilidade da primeira tela (ADR-0106 etapa 2)', async () => {
    // ⚠️ ESTE É O PEDIDO DO DEV EM FORMA DE AFIRMAÇÃO: «todo jogo da engine inclusionist deve ter os mesmos
    // ícones de acessibilidade desde a primeira tela». Até hoje o `createGame` só REPORTAVA a ausência — e o
    // próprio ADR dizia que reportar não é oferecer.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const barra = {
      id: 'title-icons', innerHTML: '', addEventListener: () => {},
      querySelector: () => null, querySelectorAll: () => [],
    };
    const { doc, win } = domFalso({ mapa: { '#title-icons': barra } });
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });

    expect(barra.innerHTML, 'a engine não escreveu ícone nenhum na barra').toContain('pi-btn');
    expect(barra.innerHTML, 'o modo cego não está na primeira tela').toContain('data-pi="blind"');
    expect(barra.innerHTML, 'o TTS não está na primeira tela').toContain('data-pi="tts"');
    // ⚠️ E o §5 alcança a barra montada por AQUI também: sem escritor visual injectado, os dois ícones que
    // precisam dele não entram — em vez de entrarem e recusarem a criança que carregar neles.
    expect(barra.innerHTML, 'contraste montado sem quem o escreva').not.toContain('data-pi="contrast"');
    expect(barra.innerHTML, 'correção de cor montada sem quem a escreva').not.toContain('data-pi="cvd"');
    expect(motor.problems.filter((p) => /accessibility bar/.test(p)), 'acusou uma barra que montou').toEqual([]);
  });

  it('⚠️ [Zero] a barra que a engine monta é NAVEGÁVEL sem o jogo dar nada (ADR-0106 §5)', async () => {
    // ⚠️ ESTE CASO GUARDA UM BURACO QUE A ETAPA 2 ABRIU. Antes dela, `naBarraDe`/`navBar` caírem em no-op era
    // inofensivo: sem barra montada, ninguém os chamava — e o comentário no `create-game` dizia exactamente
    // isso. Com a barra montada e os dois em no-op, ela existiria e só se alcançaria por PONTEIRO.
    //
    // Para uma criança cega, que navega por teclado, uma barra que ela não alcança é o mesmo que barra
    // nenhuma — é o «oferece o caminho e depois recusa-o» que o §5 proíbe, com a barra no papel de porta.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win },
      uses: { neuralVoice: true },
    });
    // O `nav` é montado com as respostas da PRÓPRIA engine — não com no-ops. `menuNavKey` é o tradutor de
    // teclado, e é por ele que o direcional chega à barra.
    expect(motor.nav, 'a navegação de menu não foi montada').toBeTruthy();
    expect(typeof motor.nav.menuNavKey, 'o tradutor de teclado não existe').toBe('function');
    expect(typeof motor.nav.navPause, 'a navegação da pausa não existe').toBe('function');
    // ⚠️ E a prova de que os dois padrões deixaram de ser no-op: o código-fonte desta raiz responde com a
    // própria instância. Lido do ficheiro porque o `ctx` do `initMenuNav` não é observável de fora — e uma
    // afirmação que não se consegue fazer é melhor dita assim do que fingida com um duplo que aceita tudo.
    // ⚠️ ESTES DOIS CRIVOS LEEM O TEXTO DA FONTE, logo estão presos ao NOME de quem guarda a metade do jogo.
    // Era `o.` até 2026-09-11 e passou a `cartucho.` quando essa metade ganhou um detentor próprio (ADR-0142).
    // Um rename futuro reprova aqui com a mensagem certa — o que se quer — mas a causa é o nome, não a regra.
    expect(FONTE, 'a barra montada voltou a ser inalcançável por teclado').toMatch(/naBarraDe:\s*cartucho\.naBarraDe\s*\?\?\s*\(\(i\)\s*=>\s*pauseIcons\.naBarraDe\(i\)\)/);
    expect(FONTE).toMatch(/navBar:\s*cartucho\.navBar\s*\?\?\s*\(\(i,\s*k\)\s*=>\s*pauseIcons\.navBar\(i,\s*k\)\)/);
    // ⚠️ E a barra montada tem de continuar a DIZER A VERDADE quando o modo cego muda noutro sítio (o painel
    // de áudio, a simulação de empatia). Sem esta assinatura o ícone ficaria a dizer «desligado» depois de a
    // criança o ligar — a família do `reflectTTS`, que este projeto já pagou duas vezes.
    expect(FONTE, 'a barra montada não se refaz quando o modo cego muda fora dela')
      .toMatch(/state\.on\('modoCego',\s*\(\)\s*=>\s*\{\s*pauseIcons\.reflectIconsIn\(a11yBar,\s*0\);\s*\}\)/);
  });

  it('⚠️ [Right] a engine monta o CARTÃO DE PAUSA — e com o id que ela própria procura', async () => {
    // 📏 O LAÇO QUE ISTO FECHA, medido nos seis jogos: `#vp-pause-0` é procurado pelo `getPauseMenu` desta
    // raiz e NENHUM jogo o cria (`git grep vp-pause` devolve zero nos seis). A engine inventou uma convenção,
    // procurou-a, não a achou, e concluiu em silêncio que nenhum jogo tem menu de pausa.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const regiao = regiaoFalsa();
    const { doc, win } = domFalso({ mapa: { '#game-region': regiao } });
    createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });

    // ⚠️ PELO ID E NÃO PELA CONTAGEM. Isto dizia `filhos.length === 1`, e a contagem nunca foi a exigência —
    // era um proxy, verdadeiro enquanto o cartão era a única coisa que a engine pendurava ali. Desde
    // 2026-09-11 ela pendura também os painéis de ajustes, e o proxy passou a medir «quantas coisas a engine
    // monta» em vez de «o cartão está lá»: um número que muda a cada etapa do ADR-0106 e reprova sem nada ter
    // partido. O que o caso afirma é o que ele sempre quis afirmar.
    const cartao = regiao.filhos.find((f) => f.id === 'vp-pause-0');
    expect(cartao, 'a engine não pendurou o cartão com o id que ela própria procura').toBeTruthy();
    expect(cartao.className).toBe('screen-pause');
  });

  it('🔴 [Inverse] NENHUMA declinação tira o cartão — nem a que existia e foi aposentada (ADR-0122)', async () => {
    // 🎯 O GATE QUE O ADR-0122 DEVIA, e ele afirma a decisão do Dev inteira: «o menu de pausa da engine e os
    // botões no hud para acessibilidade rápida deveriam estar em todos os jogos, por isso seriam
    // responsabilidade da engine». Não é oferecido; é da engine.
    //
    // ⚠️ O FIXTURE PASSA `semMenuDePausa: true` DE PROPÓSITO, e é isso que o torna um gate em vez de uma
    // repetição do caso acima. O campo saiu do contrato, logo em TypeScript isto nem compila — mas um objecto
    // vindo de um cartucho no `7.0.1` traz a chave à mesma, e o que se afirma é que ela deixou de ter efeito.
    // Repor a consulta (`declines.semMenuDePausa ? null : …`) faz este caso reprovar e o de cima passar.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const regiao = regiaoFalsa();
    const { doc, win } = domFalso({ mapa: { '#game-region': regiao } });
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win },
      declines: { semMenuDePausa: true, semAtorDePausa: true, semAssistenteDePad: true, semVozNeural: true },
    });

    // Pelo id e não pela contagem, pela razão escrita no caso acima.
    expect(regiao.filhos.some((f) => f.id === 'vp-pause-0'),
      'uma declinação aposentada voltou a tirar o cartão da criança').toBe(true);
    // 📌 E o silêncio não volta pela outra porta: com hospedeiro válido não há nada a acusar.
    expect(motor.problems.filter((p) => p.includes('pausa')), 'acusou pausa com hospedeiro válido').toEqual([]);
  });

  it('⚠️ [Right] MONTAR não é MOSTRAR — e a engine dá as duas, sem o jogo caçar id nenhum', async () => {
    // ⚠️ ESTA LACUNA ESTAVA SILENCIOSA NA MINHA PRÓPRIA ETAPA 2. O cartão nasce `hidden` — tem de nascer, uma
    // pausa abre-se — e quem o revela é o `ui/shell`, POR FASE, que esta raiz não monta de propósito. Sem
    // estas duas, um jogo montado por `createGame` ficava com um cartão que NADA mostrava, e a única saída
    // era procurar `#vp-pause-0` no documento: exactamente o conhecimento que este ficheiro existe para não
    // exigir.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const cartaoMapeado = {
      id: '', hidden: true, className: '', dataset: {}, innerHTML: '',
      appendChild: (n) => n, addEventListener: () => {},
      querySelector: () => null, querySelectorAll: () => [],
    };
    const regiao = regiaoFalsa();
    const { doc, win } = domFalso({ mapa: { '#game-region': regiao, '#vp-pause-0': cartaoMapeado } });
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win },
      uses: { neuralVoice: true },
    });

    expect(typeof motor.pausa.mostrar, 'a engine monta e não sabe mostrar').toBe('function');
    expect(cartaoMapeado.hidden, 'o cartão tem de nascer escondido — uma pausa ABRE-SE').toBe(true);
    motor.pausa.mostrar(0);
    expect(cartaoMapeado.hidden, 'mostrar não revelou o cartão').toBe(false);
    motor.pausa.esconder(0);
    expect(cartaoMapeado.hidden).toBe(true);
  });

  it('⚠️ [Right] quem DECLINA o menu de pausa não recebe cartão nem acusação', async () => {
    // Declinar é escolha registada; não ter é omissão. O ADR-0106 §2 é inteiro sobre a diferença, e um gate
    // que as tratasse igual apagaria a razão de os declínios existirem.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const regiao = regiaoFalsa();
    const { doc, win } = domFalso({ mapa: { '#game-region': regiao } });
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    // 🔴 VIRADO EM 2026-09-09 (ADR-0120), e o caso mudou de lado inteiro. Ele afirmava «montou pausa a quem a
    // declinou → 0 filhos», e essa era a verdade enquanto a pausa fosse declinável. O Dev aposentou o
    // declínio — «Aposentar.» — porque a razão dele foi construída fora pelo próprio ADR-0106: lista padrão
    // de botões (`001b185`) e montagem do cartão (`092a670`).
    // 📌 Agora a afirmação é a OPOSTA e mais forte: TODO jogo recebe o cartão, sem nada a declarar. Um jogo
    // que antes se calava passa a ter onde a criança alcança os ajustes durante a partida.
    expect(regiao.filhos.length, 'a engine deixou de montar a pausa que agora é de todos').toBeGreaterThan(0);
    expect(motor.problems.filter((p) => /menu de pausa/.test(p)), 'acusou um jogo com hospedeiro válido').toEqual([]);
  });

  it('⚠️ [Boundary] um hospedeiro que não aceita conteúdo nem clique NÃO derruba o boot', async () => {
    // Derrubar o jogo inteiro por causa da barra seria tirá-lo de toda a gente para não o dar a ninguém. A
    // lacuna vira `problems`, como as outras do hospedeiro.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const inutil = { id: 'title-icons', querySelector: () => null, querySelectorAll: () => [] };
    const { doc, win } = domFalso({ mapa: { '#title-icons': inutil } });
    let motor;
    expect(() => { motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } }); }).not.toThrow();
    expect(motor.problems.some((p) => /takes neither content nor clicks/.test(p))).toBe(true);
  });

  it('⚠️ [Zero] com DOIS assentos e sem ator de pausa, a engine DIZ — o segundo não consegue remapear', async () => {
    // O achado 3 da auditoria do `game-soccer`. O painel de controle é parametrizado pelo ASSENTO
    // (`render(selPlayer)` desenha as posições daquele esquema) e não tem selector — quem escolhe é o
    // consumidor, passando o ator da pausa. ⚠️ E o `setPauseActor` desta raiz é `() => {}`, literal: um jogo
    // de dois assentos montado por `createGame` deixa a criança do SEGUNDO sem como remapear, em silêncio.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: declaracaoValida(),
      host: { doc, win },
      players: [{ ctrl: {} }, { ctrl: {} }],
    });
    const linha = motor.problems.find((p) => /pause actor/.test(p));
    expect(linha, 'dois assentos sem ator de pausa e a engine não disse nada').toBeTruthy();
    // ⚠️ A frase nomeia a SAÍDA e o que se perde, como as outras deste bloco fazem — uma linha que só diz
    // «faltou algo» manda procurar, e quem procura é quem já não sabia.
    expect(linha).toMatch(/remap/);
    expect(linha).toMatch(/semAtorDePausa/);
  });

  it('[Right] UM assento não acusa nada — a frase é sobre o segundo, e não sobre existir', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win }, players: [{ ctrl: {} }],
    });
    expect(motor.problems.filter((p) => /pause actor/.test(p))).toEqual([]);
  });

  it('⚠️ [Right] DECLARAR `semAtorDePausa` cala a linha — ausência declarada é escolha', async () => {
    // A distinção que este caso guarda: declinar é uma escolha registada; não declinar é uma omissão. O
    // ADR-0106 §2 é inteiro sobre a diferença entre as duas, e um gate que as tratasse igual apagaria a
    // razão de os declínios existirem.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: declaracaoValida(),
      host: { doc, win },
      players: [{ ctrl: {} }, { ctrl: {} }],
      declines: { semAtorDePausa: true },
    });
    expect(motor.problems.filter((p) => /pause actor/.test(p))).toEqual([]);
  });

  it('⚠️ [Zero] SEM barra de acessibilidade na primeira tela, a engine DIZ — e cinco jogos não a têm', () => {
    // ⚠️ `ausentes` e não `comMarcacao: false`, e a razão está escrita no próprio `domFalso`: «um duplo que
    // responde SIM a qualquer seletor não testa a pergunta — testa apenas que ela foi feita». Sem isto o caso
    // ficaria verde sem nunca ter exercitado a ausência, que é como o caso do mundo inexistente passou verde
    // uma vez.
    //
    // O PEDIDO DO DEV (2026-09-07): «os ícones de acessibilidade que aparecem no jogo desde a primeira tela
    // devem ser oferecidos pela ENGINE e não pela programação do jogo. Todo jogo da engine inclusionist deve
    // ter o mesmo menu de pausa e ícones de acessibilidade desde a primeira.»
    //
    // ⚠️ E A MEDIÇÃO DE 2026-09-08 fez disto um ACHADO: dos seis jogos do catálogo local, CINCO não têm barra
    // nenhuma — `pixi-15-puzzle`, `game-chess`, `game-soccer`, `2048` e `whackwhack` não chamam
    // `initPauseIcons` nem montam HUD. Uma criança que depende do modo cego, do TTS ou do alto contraste abre
    // esses cinco e não tem por onde. Este caso não monta a barra; fecha o SILÊNCIO, que era a parte que
    // fazia cinco jogos parecerem completos.
    return import('../app/js/boot/create-game.js').then(({ createGame }) => {
      const { doc, win } = domFalso({ ausentes: ['#title-icons'] });
      const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
      const linha = motor.problems.find((p) => /accessibility bar/.test(p));
      expect(linha, 'a engine calou-se sobre a barra que falta').toBeTruthy();
      // A frase nomeia a SAÍDA e o que se PERDE — «falta uma coisa» manda procurar sem dizer o quê.
      expect(linha).toMatch(/a11yBarHost/);
      expect(linha).toMatch(/#title-icons/);
      expect(linha, 'não diz o que a criança perde').toMatch(/blind mode|narration|Libras/);
    });
  });

  // ========================= MUTACOES CONFERIDAS (a barra de a11y da primeira tela) =========================
  //   · `if (!a11yBar)` -> `if (false)` (a engine volta a calar-se) -> reprova o caso do Zero. E o estado do
  //     repositorio ate hoje, e e' o que faz cinco jogos parecerem completos.
  //   · tirando o `o.host.a11yBarHost ??` -> reprova o caso do jogo que declara o seu elemento. O gate
  //     passaria a exigir um ID em vez de uma barra, e um cartucho com outra marcacao ficaria acusado sem ter
  //     defeito nenhum.
  //   · encurtando a frase para «sem barra de acessibilidade na primeira tela» -> reprova, porque ela deixa
  //     de nomear a SAIDA (`a11yBarHost` / `#title-icons`). «Falta uma coisa» manda procurar sem dizer o que.
  //   · tirando a segunda metade da frase -> reprova: ela deixa de dizer o que a CRIANCA perde, que e' a
  //     parte que faz alguem consertar em vez de arquivar.

  it('[Right] e um jogo que DECLARA o seu elemento não é acusado — a barra não tem de se chamar assim', () => {
    // O id `#title-icons` é o que o jogo de plataforma usa desde sempre, e não é um requisito de nome: um
    // cartucho com outra marcação declara o elemento e fica servido. Sem este caso, o de cima estaria a
    // exigir um id em vez de uma barra.
    return import('../app/js/boot/create-game.js').then(({ createGame }) => {
      const { doc, win } = domFalso({ ausentes: ['#title-icons'] });
      // ⚠️ O duplo ganhou `innerHTML` e `addEventListener` em 2026-09-08: desde a etapa 2 do ADR-0106 a
      // engine MONTA a barra aqui dentro, e um elemento que não aceita conteúdo nem clique é acusado por uma
      // linha própria de `problems` — correctamente, mas não é o que este caso mede.
      const meuSitio = {
        id: 'outro-lugar', innerHTML: '', addEventListener: () => {},
        querySelector: () => null, querySelectorAll: () => [],
      };
      const motor = createGame({ acomodacoes: SEM_ASSUNTO,
        declaration: declaracaoValida(),
        host: { doc, win, a11yBarHost: meuSitio },
      });
      expect(motor.problems.some((p) => /accessibility bar/.test(p)),
        'acusou um jogo que declarou onde a barra entra').toBe(false);
    });
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
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: torto, host: { doc, win } });
    expect(motor.problems.join(' ')).toMatch(/declared world \S+ is not in the page/);
    expect(motor.tts, 'o jogo abre mesmo assim').toBeTruthy();
  });

  it('`none` NAO exige elemento nenhum — atividade sem espaco', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const paint = { ...declaracaoValida(), world: () => ({ kind: 'none' }) };
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: paint, host: { doc, win } });
    expect(motor.problems.join(' ')).not.toMatch(/declared world/);
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
    createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
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

    createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });

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
    // ⚠️ `#incl-parou` entra em `ausentes`: o aviso procura a caixa ANTES de criar, para nao empilhar duas.
    // Um duplo que devolvesse elemento para qualquer seletor faria o modulo achar que ela ja existe e nunca a
    // acrescentar — e este caso passaria a afirmar o contrario do que promete. E a quarta vez que o duplo
    // deste ficheiro tem de aprender a DISTINGUIR a pergunta.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const alerta = { textContent: '' };
    const regiao = { filhos: [], appendChild(f) { this.filhos.push(f); }, style: {}, contains: () => false };
    const { doc, win } = domFalso({
      mapa: { '#sr-alert': alerta, '#game-region': regiao },
      ausentes: ['#incl-parou'],
    });
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });

    expect(typeof motor.aoFalhar, 'a engine deixou de entregar o aviso').toBe('function');
    motor.aoFalhar(new Error('o quadro quebrou'));
    expect(alerta.textContent, 'quem nao ve a tela nao foi avisado').toBeTruthy();
    const caixa = regiao.filhos.find((f) => f.id === 'incl-parou');
    expect(caixa, 'quem ve a tela nao foi avisado').toBeTruthy();
    expect(caixa.textContent).toBe(alerta.textContent);
  });

  it('⚠️ o filtro de visao cai no MUNDO DECLARADO, e nao numa canvas assumida (ADR-0087)', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const mundo = { style: {}, contains: () => false };
    const { doc, win } = domFalso({ mapa: { '#meu-mundo': mundo } });
    const d = { ...declaracaoValida(), world: () => ({ kind: 'element', selector: '#meu-mundo' }) };
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: d, host: { doc, win } });
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
    createGame({ acomodacoes: SEM_ASSUNTO, declaration: d, host: { doc, win } }).aplicarFiltroDeVisao('brightness(0)', 'mundo');
    expect(dentro.style.filter, 'o menu dentro do mundo tem de sair da simulacao').toBe('');
    expect(fora.style.filter, 'um overlay fora do mundo nao e assunto desta funcao').toBe('brightness(0)');
  });

  it('com alcance `mundo-e-menus` o overlay de dentro MANTEM o filtro', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const dentro = { style: { filter: 'contrast(2)' } };
    const mundo = { style: {}, contains: () => true };
    const { doc, win } = domFalso({ mapa: { '#meu-mundo': mundo }, listas: { '#game-region .overlay': [dentro] } });
    const d = { ...declaracaoValida(), world: () => ({ kind: 'element', selector: '#meu-mundo' }) };
    createGame({ acomodacoes: SEM_ASSUNTO, declaration: d, host: { doc, win } }).aplicarFiltroDeVisao('contrast(2)', 'mundo-e-menus');
    expect(dentro.style.filter, 'melhoria alcanca os menus; so a EMPATIA os poupa').toBe('contrast(2)');
  });

  it('⚠️ `none` NAO pinta nada — atividade sem espaco nao tem mundo para simular', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const qualquer = { style: {}, contains: () => false };
    const { doc, win } = domFalso({ mapa: { '#meu-mundo': qualquer } });
    const d = { ...declaracaoValida(), world: () => ({ kind: 'none' }) };
    createGame({ acomodacoes: SEM_ASSUNTO, declaration: d, host: { doc, win } }).aplicarFiltroDeVisao('brightness(0)', 'mundo');
    expect(qualquer.style.filter, 'pintar um filtro sobre atividade sem espaco e a mentira ao contrario').toBeUndefined();
  });
  it('[Interface] declinar fica NO REGISTRO — um consumidor pode ser auditado pelo que recusou', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: declaracaoValida(), host: { doc, win },
      // ⚠️ ERA `semMenuDePausa` AQUI, e o campo saiu do contrato (ADR-0122). O caso é sobre a TRAVESSIA dos
      // declínios, não sobre qual deles existe — trocado por dois que continuam a descrever ausências que a
      // engine não pode preencher, para o caso não morrer com a decisão que ele nunca mediu.
      declines: { semVozNeural: true, semAssistenteDePad: true },
    });
    expect(motor.declines.semVozNeural).toBe(true);
    expect(motor.declines.semAssistenteDePad).toBe(true);
    expect(motor.declines.semAtorDePausa).toBeUndefined();
  });

  it('[Right] a declaração ATRAVESSA intacta — a engine carrega os sete campos, não uma cópia deles', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const d = declaracaoValida();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: d, host: { doc, win } });
    expect(motor.declaration).toBe(d);
    // E o objetivo é legível SEM a engine saber o que é uma moeda: é o campo 5 respondendo.
    expect(motor.declaration.objectiveOf(0)).toEqual({
      name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3,
    });
  });

  /**
   * 🎯 O QUE A DECLARAÇÃO CAUSA, e não só o que ela diz (ADR-0216 §3): a lista que o arranque baixa sai da resposta do jogo. Um
   * jogo que não pede voz neural não pode pagar 372 MB de modelo, vozes e runtime no link de uma escola — e o contrário é pior
   * de ver, porque ninguém repara num download que acontece.
   *
   * ⚠️ O `baixarPesados` é substituído aqui porque a lista só existe na CHAMADA: o que se mede é o argumento, que é a decisão.
   */
  it('🔴 [Right] o arranque só baixa a voz neural do jogo que a pediu', async () => {
    const pedidos = [];
    vi.doMock('../app/js/platform/pesados.js', async (original) => ({
      ...(await original()),
      baixarPesados: async ({ apenas }) => { pedidos.push(apenas); },
    }));
    vi.resetModules();
    try {
      const { createGame } = await import('../app/js/boot/create-game.js');
      createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { ...domFalso() } });
      createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { ...domFalso() }, uses: { neuralVoice: true } });
      const [semVoz, comVoz] = pedidos;
      expect(semVoz, 'a lista do arranque não foi pedida').toBeTruthy();
      expect(semVoz.some((id) => id.startsWith('voz:')), 'um jogo mudo baixou a voz neural que nunca vai usar').toBe(false);
      expect(comVoz.some((id) => id === 'voz:kokoro:modelo'), 'o jogo pediu a voz e o modelo dela não desce').toBe(true);
      expect(comVoz.some((id) => id === 'voz:runtime:onnx'), 'o modelo desce e quem o corre não').toBe(true);
      expect(semVoz.concat(comVoz).filter((id) => id.startsWith('reading:')),
        'nenhum destes dois jogos escuta, e um modelo de leitura desceu').toEqual([]);
    } finally {
      vi.doUnmock('../app/js/platform/pesados.js');
      vi.resetModules();
    }
  });

  /**
   * 🔴 E A LEITURA DESCE NA LÍNGUA DA CRIANÇA (ADR-0216 §3; ADR-0201 erratum). 📏 Os três modelos somam 850 MiB — pt 378, en 162,
   * es 310 —, então «este jogo escuta» não pode querer dizer «baixe os três». A língua não é uma pergunta nova: é a que a
   * interface arrancou (ADR-0031).
   */
  it('🔴 [Right] o jogo que ESCUTA baixa o modelo de uma língua só, e é a da interface', async () => {
    const pedidos = [];
    vi.doMock('../app/js/platform/pesados.js', async (original) => ({
      ...(await original()),
      baixarPesados: async ({ apenas }) => { pedidos.push(apenas); },
    }));
    vi.resetModules();
    try {
      const { createGame } = await import('../app/js/boot/create-game.js');
      const { bcp47 } = await import('../app/js/core/i18n.js');
      createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { ...domFalso() }, uses: { reading: true } });
      const leitura = pedidos[0].filter((id) => id.startsWith('reading:'));
      expect(leitura.length, 'o jogo declarou que escuta e nenhum modelo de leitura desce').toBeGreaterThan(0);
      const linguas = new Set(leitura.map((id) => id.split(':')[1]));
      expect([...linguas], 'desceu mais de uma língua, ou a língua errada').toEqual([bcp47().split('-')[0].toLowerCase()]);
    } finally {
      vi.doUnmock('../app/js/platform/pesados.js');
      vi.resetModules();
    }
  });

  it('[Right] um jogo SEM FASES não precisa inventar uma — `isNavigable` ausente vale `true`', async () => {
    // O achado 10 do segundo consumidor, virado padrão: o quiz precisava se declarar "pausado" para navegar
    // os próprios menus. O caso mais simples passou a ser o que não obriga a mentir.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    expect(() => createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } })).not.toThrow();
  });
});

/*
 * MONTAR E DESMONTAR — uma raiz de composição, vários cartuchos (ADR-0142).
 *
 * ⚠️ O caso que decide é o PRIMEIRO: sem ele, `mount()` seria uma função que troca um campo e o diagnóstico
 * continuaria a falar do jogo que arrancou — que é exactamente a dívida que o ADR-0139 §5 registou e que
 * este registo veio pagar. Um teste que só verificasse que `mount` não lança não provaria nada disso.
 */
describe('mount / unmount — uma raiz, vários cartuchos (ADR-0142)', () => {
  // ⚠️ O DUPLO DEVOLVE ELEMENTO PARA QUALQUER SELETOR, então «um mundo que não existe» só existe se o
  // dissermos ao duplo — é para isso que `ausentes` está lá. Sem ele estes casos passavam a verde sem nunca
  // terem exercitado a linha que dizem exercitar, que é a forma mais cara de um teste mentir.
  const SELETOR_AUSENTE = '#mundo-que-nao-existe';
  const semDom = () => domFalso({ ausentes: [SELETOR_AUSENTE] });
  const semMundo = () => ({
    ...declaracaoValida(),
    world: () => ({ kind: 'element', selector: SELETOR_AUSENTE }),
  });

  it('🎯 [Right] `problems` passa a descrever o cartucho MONTADO, e não o que arrancou', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = semDom();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: semMundo(), host: { doc, win } });
    expect(motor.problems.join(' '), 'o arranque devia acusar o mundo que não existe').toMatch(/declared world/);

    motor.mount(declaracaoValida(), { acomodacoes: SEM_ASSUNTO });
    expect(motor.problems.join(' '), 'o diagnóstico ficou a falar do cartucho anterior').not.toMatch(/declared world/);
  });

  it('⚠️ [Right] e o PAR: montar um cartucho sem mundo ACUSA — senão «sumiu» passaria por nunca olhar', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = semDom();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    expect(motor.problems.join(' ')).not.toMatch(/declared world/);

    motor.mount(semMundo(), { acomodacoes: SEM_ASSUNTO });
    expect(motor.problems.join(' '), 'montou um mundo inexistente e não disse nada').toMatch(/declared world/);
  });

  it('🔴 [Zero] um cartucho que NÃO RESPONDE às suas acomodações é RECUSADO no arranque e no mount (ADR-0153)', async () => {
    // «Gênero não precisa responder todas as acomodações, mas sim o cartucho, obrigatoriamente.» Recusa, e não
    // `problems`: sem a resposta a engine não sabe que linhas montar, e montar todas é a cadeira de rodas no xadrez.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    expect(() => createGame({ declaration: declaracaoValida(), host: { doc, win } })).toThrow(/ADR-0153/);
    // UMA chave em falta também — o silêncio de uma só é o mesmo defeito
    const { caneSpacing: _fora, ...incompleta } = SEM_ASSUNTO;
    expect(() => createGame({ acomodacoes: incompleta, declaration: declaracaoValida(), host: { doc, win } }))
      .toThrow(/caneSpacing is not answered/);
    // 📌 O PAR: a resposta completa passa — senão um crivo que recusasse sempre ficaria verde acima
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    // e o mount() recusa pela mesma regra: um SEGUNDO cartucho não pode entrar sem responder
    expect(() => motor.mount(declaracaoValida(), {})).toThrow(/ADR-0153/);
  });

  it('🔴 [Zero] `mount` LANÇA numa declaração malformada — contrato é pré-condição, não diagnóstico', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    expect(() => motor.mount({ ...declaracaoValida(), topology: undefined }, { acomodacoes: SEM_ASSUNTO })).toThrow(/malformada/);
    // ⚠️ E O CARTUCHO BOM CONTINUA MONTADO: uma recusa não pode deixar a raiz a meio caminho.
    expect(motor.problems.join(' ')).not.toMatch(/declared world/);
  });

  it('[Right] `declaration` devolve o cartucho corrente', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const primeira = declaracaoValida();
    const segunda = declaracaoValida();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: primeira, host: { doc, win } });
    expect(motor.declaration).toBe(primeira);
    motor.mount(segunda, { acomodacoes: SEM_ASSUNTO });
    expect(motor.declaration, 'a engine devolveu a declaração do cartucho anterior').toBe(segunda);
  });

  it('⚠️ [Zero] `unmount` esvazia a pilha de cenas, e cada `exit()` corre — é ele o teardown', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc, win } });
    const saiu = [];
    motor.cenas.push({ nome: 'a', exit: () => saiu.push('a') });
    motor.cenas.push({ nome: 'b', exit: () => saiu.push('b') });
    expect(motor.cenas.nomes()).toEqual(['a', 'b']);

    // ⚠️ `push` JÁ CORRE O `exit()` DA CENA DE BAIXO — medido aqui, e não suposto: empilhar `b` sobre `a`
    // produz um `'a'` antes de o `unmount` existir. Medir só a CAUDA é o que separa o que este caso afirma
    // do que a pilha já fazia sozinha.
    const antes = saiu.length;
    motor.unmount();
    expect(motor.cenas.nomes(), 'a pilha guardou cenas do cartucho anterior').toEqual([]);
    // A ORDEM É DE CIMA PARA BAIXO: `pop()` desfaz o que foi empilhado por último, que é a única ordem em
    // que uma cena pode contar com o que empilhou por baixo dela ainda estar lá.
    expect(saiu.slice(antes), 'uma cena saiu sem correr o seu `exit()`').toEqual(['b', 'a']);
  });

  /*
   * OS DOIS MAPEAMENTOS DEPOIS DO `unmount()`.
   *
   * ⚠️ ESTE PAR QUASE NÃO FOI ESCRITO, e vale contar porquê: a confirmação do ADR-0142 afirmava que ele era
   * impossível sem alargar a superfície pública, porque `registrarMapeamentoDoTeclado` e
   * `registrarMapeamentoDoPad` são só de escrita e não há leitor do campo. A primeira metade é verdade e a
   * conclusão não era: não há leitor do CAMPO, mas há duas funções exportadas cujo RESULTADO muda conforme
   * ele esteja registado — `fabricaComOJogo()` e `tabelaDoPad()`.
   *
   * 🎯 E o crivo por comportamento é o melhor dos dois: «o campo interno está nulo» mede a implementação;
   * «depois de soltar o cartucho, as teclas voltam a ser as da engine» mede o que a criança encontra.
   */
  const comTeclas = () => ({
    ...declaracaoValida(),
    mapeamentoDoTeclado: () => ({ up: ['KeyZ'] }),
    mapeamentoDoPad: () => ({ up: 99 }),
  });

  it('🎯 [Right] `unmount` devolve o TECLADO à fábrica da engine — o mapa do cartucho sai com ele', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { fabricaComOJogo } = await import('../app/js/input/keyboard.js');
    const { doc, win } = domFalso();

    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: comTeclas(), host: { doc, win } });
    expect(fabricaComOJogo().solo.up, 'o mapa do jogo nem chegou a valer').toEqual(['KeyZ']);

    motor.unmount();
    expect(fabricaComOJogo().solo.up, 'as teclas do cartucho anterior ficaram a valer depois de ele sair')
      .toEqual(['KeyW', 'ArrowUp']);
  });

  it('🎯 [Right] e o PAD volta à tabela padrão — inclusive a memória que o registo limpa', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { tabelaDoPad } = await import('../app/js/input/pad-defaults.js');
    // 📌 A constante mora em `default-bindings`, e o `pad-defaults` importa-a — não a reexporta.
    const { GAMEPAD_STANDARD } = await import('../app/js/input/default-bindings.js');
    const { doc, win } = domFalso();

    const motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: comTeclas(), host: { doc, win } });
    expect(tabelaDoPad(1, 0).up, 'o mapa de pad do jogo nem chegou a valer').not.toEqual(GAMEPAD_STANDARD.up);

    motor.unmount();
    // ⚠️ IDENTIDADE E NÃO IGUALDADE: sem mapeamento registado a função devolve a PRÓPRIA constante, e é isso
    // que prova também que a memória por `jogadores:assento` foi limpa — uma tabela fundida em cache seria
    // igual em valor a nada e diferente em identidade da constante.
    expect(tabelaDoPad(1, 0), 'o pad ficou com a tabela do cartucho anterior em cache').toBe(GAMEPAD_STANDARD);
  });
});

describe('the shape of a line of `problems` (ADR-0169, issue #163)', () => {
  it('🔴 [Right] every line is in English and says what it costs the child', async () => {
    // 📏 Measured on 2026-09-13: of the lines this root pushed, the older were Portuguese («sem sítio para o menu de
    // pausa…») and the newer English; several named the fix and not the child. A host that lacks almost everything
    // gives the most lines at once: no markup, no bar, two seats with no pause actor, no preset, a world not in the page.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso({ comMarcacao: false, ausentes: ['#title-icons', '#missing-world'] });
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: { ...declaracaoValida(), world: () => ({ kind: 'element', selector: '#missing-world' }) },
      host: { doc, win }, players: [{ ctrl: 'kb' }, { ctrl: 'kb' }],
    });
    const linhas = motor.problems;
    expect(linhas.length, 'too few lines — the case would measure little').toBeGreaterThanOrEqual(5);
    // Portuguese by its accents and its words that are not English words too («no», «do», «as» are left out)
    const PORTUGUES = /[áàâãéêíóôõúüç]|\b(de|da|das|dos|para|com|sem|em|na|nos|nas|um|uma|ou|que|ao|aos|pelo|pela|seu|sua|mais|não)\b/i;
    for (const l of linhas) {
      expect(PORTUGUES.test(l), `a line in Portuguese: «${l.slice(0, 80)}»`).toBe(false);
      expect(l, `a line that does not say what the child loses: «${l.slice(0, 80)}»`).toMatch(/\bchild\b/);
    }
  });
  // MUTATIONS CHECKED (2026-09-13): the neural-voice line back in Portuguese 🔴 · «child» taken out of the pause-actor
  // line 🔴. ⚠️ Browser-only lines (stylesheet, bar, resolution, floor, storage, flashes, dictionaries) are not reached by
  // this node host; their Portuguese is still counted by `engine-i18n`, their «child» by review.
});
