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
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, setAttribute: () => {}, removeChild: () => {},
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
    // ⚠️ A porta da voz neural entra aqui em 2026-09-08 porque um jogo REAL a abre (ADR-0094, uma linha). Sem
    // ela, o `problems` acusaria — correctamente — e este caso deixaria de medir o que diz medir.
    const motor = createGame({
      declaration: declaracaoValida(), host: { doc, win },
      carregarVozNeural: () => Promise.resolve({}),
    });
    // O host de filtros não foi fornecido neste caso, e é a ÚNICA lacuna que deve sobrar.
    expect(motor.problems).toHaveLength(1);
    expect(motor.problems[0]).toMatch(/filtros/);
  });

  it('⚠️ [Zero] SEM voz neural declarada, a engine DIZ — e TRÊS dos seis jogos estão assim', async () => {
    // 📏 Medido em 2026-09-08: `carregarVozNeural` é declarado por `game-platformer`, `pixi-15-puzzle` e
    // `2048`, e NÃO por `game-soccer`, `whackwhack` e `game-chess`. Nesses três não há voz neural nenhuma, e
    // nada o dizia — `neuralDisponivel` é só `!!ctx.carregarVozNeural`.
    //
    // ⚠️ E ISSO CONTRADIZ UMA PROMESSA ESCRITA: o ADR-0065 §3 diz que as vozes «fazem parte da engine» e que
    // um cartucho «não tem de saber que existe». O ADR-0094 — com razão, por 135 MB de WASM — passou a exigir
    // uma linha do jogo. As duas coisas convivem, MAS só se quem esquece a linha for avisado.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({ declaration: declaracaoValida(), host: { doc, win } });
    const linha = motor.problems.find((p) => /voz neural/.test(p));
    expect(linha, 'sem voz neural e a engine não disse nada').toBeTruthy();
    expect(linha, 'não nomeia a saída').toMatch(/carregarVozNeural/);
    expect(linha, 'não nomeia o declínio').toMatch(/semVozNeural/);
    expect(linha, 'não diz o que a criança perde').toMatch(/não lê|português/);
  });

  it('⚠️ [Right] DECLARAR `semVozNeural` cala a linha — declinar é escolha, não declarar é omissão', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({
      declaration: declaracaoValida(), host: { doc, win }, declines: { semVozNeural: true },
    });
    expect(motor.problems.filter((p) => /voz neural/.test(p))).toEqual([]);
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
    const motor = createGame({
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
    const motor = createGame({
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
    const motor = createGame({
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
    const motor = createGame({ declaration: declaracaoValida(), host: { doc, win } });

    expect(barra.innerHTML, 'a engine não escreveu ícone nenhum na barra').toContain('pi-btn');
    expect(barra.innerHTML, 'o modo cego não está na primeira tela').toContain('data-pi="blind"');
    expect(barra.innerHTML, 'o TTS não está na primeira tela').toContain('data-pi="tts"');
    // ⚠️ E o §5 alcança a barra montada por AQUI também: sem escritor visual injectado, os dois ícones que
    // precisam dele não entram — em vez de entrarem e recusarem a criança que carregar neles.
    expect(barra.innerHTML, 'contraste montado sem quem o escreva').not.toContain('data-pi="contrast"');
    expect(barra.innerHTML, 'correção de cor montada sem quem a escreva').not.toContain('data-pi="cvd"');
    expect(motor.problems.filter((p) => /barra de acessibilidade/.test(p)), 'acusou uma barra que montou').toEqual([]);
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
    const motor = createGame({
      declaration: declaracaoValida(), host: { doc, win },
      carregarVozNeural: () => Promise.resolve({}),
    });
    // O `nav` é montado com as respostas da PRÓPRIA engine — não com no-ops. `menuNavKey` é o tradutor de
    // teclado, e é por ele que o direcional chega à barra.
    expect(motor.nav, 'a navegação de menu não foi montada').toBeTruthy();
    expect(typeof motor.nav.menuNavKey, 'o tradutor de teclado não existe').toBe('function');
    expect(typeof motor.nav.navPause, 'a navegação da pausa não existe').toBe('function');
    // ⚠️ E a prova de que os dois padrões deixaram de ser no-op: o código-fonte desta raiz responde com a
    // própria instância. Lido do ficheiro porque o `ctx` do `initMenuNav` não é observável de fora — e uma
    // afirmação que não se consegue fazer é melhor dita assim do que fingida com um duplo que aceita tudo.
    expect(FONTE, 'a barra montada voltou a ser inalcançável por teclado').toMatch(/naBarraDe:\s*o\.naBarraDe\s*\?\?\s*\(\(i\)\s*=>\s*pauseIcons\.naBarraDe\(i\)\)/);
    expect(FONTE).toMatch(/navBar:\s*o\.navBar\s*\?\?\s*\(\(i,\s*k\)\s*=>\s*pauseIcons\.navBar\(i,\s*k\)\)/);
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
    const regiao = {
      id: 'game-region', innerHTML: '', filhos: [],
      appendChild(n) { this.filhos.push(n); return n; },
      addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [],
    };
    const { doc, win } = domFalso({ mapa: { '#game-region': regiao } });
    createGame({ declaration: declaracaoValida(), host: { doc, win } });

    expect(regiao.filhos.length, 'a engine não pendurou cartão nenhum').toBe(1);
    const cartao = regiao.filhos[0];
    expect(cartao.id, 'montou sem o id que a própria engine procura — o laço fica aberto na mesma').toBe('vp-pause-0');
    expect(cartao.className).toBe('screen-pause');
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
    const regiao = {
      id: 'game-region', innerHTML: '', filhos: [],
      appendChild(n) { this.filhos.push(n); return n; },
      addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [],
    };
    const { doc, win } = domFalso({ mapa: { '#game-region': regiao, '#vp-pause-0': cartaoMapeado } });
    const motor = createGame({
      declaration: declaracaoValida(), host: { doc, win },
      carregarVozNeural: () => Promise.resolve({}),
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
    const regiao = {
      id: 'game-region', innerHTML: '', filhos: [],
      appendChild(n) { this.filhos.push(n); return n; },
      addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [],
    };
    const { doc, win } = domFalso({ mapa: { '#game-region': regiao } });
    const motor = createGame({
      declaration: declaracaoValida(), host: { doc, win }, declines: { semMenuDePausa: true },
    });
    expect(regiao.filhos.length, 'montou pausa a quem a declinou').toBe(0);
    expect(motor.problems.filter((p) => /menu de pausa/.test(p)), 'acusou quem declinou').toEqual([]);
  });

  it('⚠️ [Boundary] um hospedeiro que não aceita conteúdo nem clique NÃO derruba o boot', async () => {
    // Derrubar o jogo inteiro por causa da barra seria tirá-lo de toda a gente para não o dar a ninguém. A
    // lacuna vira `problems`, como as outras do hospedeiro.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const inutil = { id: 'title-icons', querySelector: () => null, querySelectorAll: () => [] };
    const { doc, win } = domFalso({ mapa: { '#title-icons': inutil } });
    let motor;
    expect(() => { motor = createGame({ declaration: declaracaoValida(), host: { doc, win } }); }).not.toThrow();
    expect(motor.problems.some((p) => /não aceita conteúdo nem clique/.test(p))).toBe(true);
  });

  it('⚠️ [Zero] com DOIS assentos e sem ator de pausa, a engine DIZ — o segundo não consegue remapear', async () => {
    // O achado 3 da auditoria do `game-soccer`. O painel de controle é parametrizado pelo ASSENTO
    // (`render(selPlayer)` desenha as posições daquele esquema) e não tem selector — quem escolhe é o
    // consumidor, passando o ator da pausa. ⚠️ E o `setPauseActor` desta raiz é `() => {}`, literal: um jogo
    // de dois assentos montado por `createGame` deixa a criança do SEGUNDO sem como remapear, em silêncio.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({
      declaration: declaracaoValida(),
      host: { doc, win },
      players: [{ ctrl: {} }, { ctrl: {} }],
    });
    const linha = motor.problems.find((p) => /ator da pausa/.test(p));
    expect(linha, 'dois assentos sem ator de pausa e a engine não disse nada').toBeTruthy();
    // ⚠️ A frase nomeia a SAÍDA e o que se perde, como as outras deste bloco fazem — uma linha que só diz
    // «faltou algo» manda procurar, e quem procura é quem já não sabia.
    expect(linha).toMatch(/remapear/);
    expect(linha).toMatch(/semAtorDePausa/);
  });

  it('[Right] UM assento não acusa nada — a frase é sobre o segundo, e não sobre existir', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({
      declaration: declaracaoValida(), host: { doc, win }, players: [{ ctrl: {} }],
    });
    expect(motor.problems.filter((p) => /ator da pausa/.test(p))).toEqual([]);
  });

  it('⚠️ [Right] DECLARAR `semAtorDePausa` cala a linha — ausência declarada é escolha', async () => {
    // A distinção que este caso guarda: declinar é uma escolha registada; não declinar é uma omissão. O
    // ADR-0106 §2 é inteiro sobre a diferença entre as duas, e um gate que as tratasse igual apagaria a
    // razão de os declínios existirem.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { doc, win } = domFalso();
    const motor = createGame({
      declaration: declaracaoValida(),
      host: { doc, win },
      players: [{ ctrl: {} }, { ctrl: {} }],
      declines: { semAtorDePausa: true },
    });
    expect(motor.problems.filter((p) => /ator da pausa/.test(p))).toEqual([]);
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
      const motor = createGame({ declaration: declaracaoValida(), host: { doc, win } });
      const linha = motor.problems.find((p) => /barra de acessibilidade/.test(p));
      expect(linha, 'a engine calou-se sobre a barra que falta').toBeTruthy();
      // A frase nomeia a SAÍDA e o que se PERDE — «falta uma coisa» manda procurar sem dizer o quê.
      expect(linha).toMatch(/a11yBarHost/);
      expect(linha).toMatch(/#title-icons/);
      expect(linha, 'não diz o que a criança perde').toMatch(/cego|TTS|contraste|Libras/);
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
      const motor = createGame({
        declaration: declaracaoValida(),
        host: { doc, win, a11yBarHost: meuSitio },
      });
      expect(motor.problems.some((p) => /barra de acessibilidade/.test(p)),
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
    const motor = createGame({ declaration: declaracaoValida(), host: { doc, win } });

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
