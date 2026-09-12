// SPDX-License-Identifier: AGPL-3.0-or-later
// A RAIZ DE COMPOSIÇÃO CONTRA UM DOCUMENTO DE VERDADE (ADR-0106 etapa 2).
//
// ========================= POR QUE ESTE FICHEIRO EXISTE =========================
// Em 2026-09-08 uma varredura achou SEIS defeitos na montagem da barra e do cartão de pausa, e CINCO deles
// eram meus, introduzidos no próprio dia em que fiz a engine montá-los. Os cinco passaram pelo mesmo sítio: o
// `domFalso` do `boot-create-game.node.test.js`, que precisou de ser remendado TRÊS VEZES SEPARADAS por ser
// mais pobre do que a coisa real — primeiro sem `innerHTML`, depois sem `appendChild`, e por fim com
// `HTMLElement` a ser um global de navegador que, lido onde não existe, LANÇA em vez de devolver `false`.
//
// ⚠️ ISSO NÃO É UMA CRÍTICA AO DUPLO: é a definição dele. Um duplo só sabe o que quem o escreveu sabia, e por
// isso ele é forte exactamente onde a lógica decide e cego exactamente onde o DOM decide. O padrão não se
// conserta remendando o duplo pela quarta vez — conserta-se tendo um documento a sério onde a montagem mora.
//
// 🎯 A REGRA DE CADA CASO AQUI, e ela é o que impede este ficheiro de ser uma duplicata cara: **um caso só
// entra se o `domFalso` NÃO CONSEGUISSE fazê-lo.** Onde o duplo já responde — a ordem do mixer, o que entra em
// `problems`, declarar mal explodir —, o node continua a ser o sítio certo: corre em milissegundos e não
// precisa de navegador. O que fica para aqui é o que só um documento sabe: se a marcação PARSEIA, se o
// elemento está mesmo NA ÁRVORE, se dá para lá chegar com o teclado, e se um clique de verdade percorre o
// caminho todo.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

let createGame;
let repor;

/** O documento mínimo que um jogo oferece: a região do mundo e o hospedeiro da barra da primeira tela. */
function montarHospedeiro() {
  const raiz = document.createElement('div');
  raiz.id = 'raiz-de-teste';
  // ⚠️ AS DUAS REGIÕES DE LEITOR DE TELA ENTRARAM EM 2026-09-08, e a ausência delas era o motivo de o
  // ANÚNCIO nunca ter sido exercitado aqui: sem `#sr-status` no documento, o `srSay` não acha onde escrever
  // e falha em silêncio — que é precisamente a forma de defeito que ele existe para evitar. Um hospedeiro
  // sem elas também não é realista: a `MARCACAO_EXIGIDA` da raiz pede as duas.
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  return raiz;
}

const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  holdsAtOnce: () => 1,
  // Um fixture de hotspots não segura nada — o par do ADR-0115, ao lado do número que não o diz.
  seguraTeclas: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'primeira pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

const abrir = (extra = {}) => createGame({
  declaration: declaracaoValida(),
  host: { doc: document, win: window }, baixarPesados: false,
  ...extra,
});

describe('createGame num documento de verdade', () => {
  let raiz;

  beforeEach(async () => {
    // `await import` e não estático, pela mesma razão do ficheiro node: o grafo de boot é grande e um módulo
    // partido não deve derrubar a colecção inteira antes de o primeiro caso correr.
    if (!createGame) ({ createGame } = await import('../app/js/boot/create-game.js'));
    // ⚠️ O MODO CEGO É ESTADO DE MÓDULO E PERSISTE — em `core/state` e no armazenamento. Sem esta reposição,
    // um caso que o liga deixa o seguinte a começar ligado, e o seguinte mede o contrário do que diz. Foi o
    // que aconteceu na primeira volta, e apanhá-lo aqui é mais barato do que voltar a caçá-lo.
    if (!repor) ({ setModoCegoValue: repor } = await import('../app/js/core/state.js'));
    repor(false);
    raiz = montarHospedeiro();
  });

  afterEach(() => { raiz.remove(); document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove()); });

  it('⚠️ [Right] a marcação da barra PARSEIA — o duplo só sabia que uma string foi atribuída', () => {
    // ⚠️ O `domFalso` guarda `innerHTML` como texto. Num documento a sério, atribuir `innerHTML` ANALISA a
    // marcação, e uma que não fecha uma tag produz ZERO elementos — sem erro, sem aviso, e com o duplo verde.
    // A criança que depende do modo cego abre o jogo e a barra simplesmente não está lá.
    abrir();
    const barra = document.querySelector('#title-icons');
    const botoes = barra.querySelectorAll('[data-pi]');
    expect(botoes.length, 'a barra montou marcação que o navegador não conseguiu ler').toBeGreaterThan(0);
    // e são ELEMENTOS na árvore, não texto: cada um responde ao documento que o contém
    expect(botoes[0].isConnected).toBe(true);
  });

  it('⚠️ [Right] os ícones da primeira tela são ALCANÇÁVEIS PELO TECLADO', () => {
    // ⚠️ É O ARGUMENTO DA ETAPA 2 VIRADO AFIRMAÇÃO, e nenhum duplo o alcança. A montagem deliberadamente NÃO
    // usa `buildQuickBar`, que põe `tabIndex = -1` porque durante a partida dez paradas separam a criança do
    // jogo. Na PRIMEIRA tela ninguém está a jogar, e tirar os ícones da ordem de tabulação ali seria
    // escondê-los de quem navega por teclado — exactamente a pessoa para quem eles existem.
    abrir();
    const alvo = document.querySelector('#title-icons [data-pi]');
    expect(alvo.tabIndex, 'ícone fora da ordem de tabulação na tela onde ninguém está a jogar').toBeGreaterThanOrEqual(0);
    // e focar de verdade: `tabIndex` é uma promessa, `activeElement` é o cumprimento dela
    alvo.focus();
    expect(document.activeElement).toBe(alvo);
  });

  it('⚠️ [Right] o cartão de pausa é ENCONTRÁVEL pelo id que a própria engine procura', () => {
    // ⚠️ ESTE É O CASO MAIS FORTE DO FICHEIRO, e é o único que fecha o laço de verdade. O `getPauseMenu` da
    // engine procura `#vp-pause-0` no DOCUMENTO. Pôr `cartao.id = 'vp-pause-0'` satisfaz qualquer duplo — mas
    // um cartão com id certo pendurado num hospedeiro DESLIGADO da árvore é invisível a `querySelector`, e a
    // engine voltaria a concluir, em silêncio, que este jogo não tem menu de pausa. Só um documento sabe a
    // diferença entre «tem o id» e «está lá».
    abrir();
    expect(document.querySelector('#vp-pause-0'), 'a engine monta o cartão e depois não o encontra').not.toBeNull();
  });

  it('⚠️ [Right] MONTAR não é MOSTRAR, e `pausa.mostrar` mostra DE FACTO', () => {
    // O cartão nasce escondido — uma pausa ABRE. O duplo só consegue ver a propriedade `hidden` mudar; aqui
    // pergunta-se ao layout, que é quem a criança consulta.
    const motor = abrir();
    const cartao = document.querySelector('#vp-pause-0');
    expect(cartao.offsetParent, 'o cartão nasceu visível — uma pausa ABRE, não está sempre aberta').toBeNull();
    motor.pausa.mostrar(0);
    expect(cartao.hidden).toBe(false);
    expect(cartao.offsetParent, '`hidden` saiu mas o cartão continua sem ocupar espaço nenhum').not.toBeNull();
    motor.pausa.esconder(0);
    expect(cartao.offsetParent).toBeNull();
  });

  it('⚠️ [Right] um clique DE VERDADE num ícone percorre o caminho todo', () => {
    // ⚠️ O duplo regista que `addEventListener` foi chamado; ele não pode disparar o ouvinte com um evento que
    // BORBULHA a partir de um filho, que é como um clique real chega. O `iconAct` lê `e.target.closest(...)`,
    // e um alvo que não é elemento — ou um ouvinte pendurado no sítio errado — só falha aqui.
    // 📌 O ÍCONE ESCOLHIDO É O MODO CEGO de propósito: é o que a etapa 1b deu à engine por padrão
    // (`setModoCegoValue`), logo um jogo que não injecta nada tem de o ver funcionar — e foi exactamente ali
    // que o botão ficou mudo em 2026-09-08. O caminho medido é o inteiro: clique real → `iconAct` →
    // `setModoCego` → evento de estado → `reflectIconsIn` → o DOM diz o estado novo.
    abrir();
    const barra = document.querySelector('#title-icons');
    const alvo = barra.querySelector('[data-pi="blind"]');
    expect(alvo, 'o modo cego não está na primeira tela').not.toBeNull();
    alvo.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // ⚠️ Relê do DOCUMENTO e não da referência: reflectir pode ter REESCRITO a barra, e um nó guardado antes
    // do clique seria um órfão a dizer o estado velho — a forma de defeito do `reflectTTS`.
    const depois = document.querySelector('#title-icons [data-pi="blind"]');
    expect(depois.getAttribute('aria-pressed'), 'o clique chegou mas o ícone não diz o estado novo').toBe('true');
  });

  // 🔴 O ANÚNCIO, e ele nunca tinha sido exercitado — foi o que a verificação no navegador de 2026-09-08 não
  // conseguiu medir: o painel estava OCULTO, o `requestAnimationFrame` congelado (medido: zero quadros em
  // 600 ms) e o `srSay` escreve dentro de um. «O `#sr-status` não mudou» não era prova de silêncio, e eu
  // declarei-o por verificar em vez de o reportar como regressão. Aqui a página renderiza, e dá para medir.
  //
  // ⚠️ E O QUE ESTE CASO PRENDE É A ORDEM, que é onde mora o defeito interessante: o anúncio lê o
  // `aria-label` DEPOIS do reflexo, porque é ele que carrega o estado NOVO. Anunciar antes diria à criança o
  // estado que ela acabou de DEIXAR — e o botão ficaria a mentir para quem só o ouve, que é a família do
  // `reflectTTS`: uma saída cujo único destino é o leitor de tela não tem quem note quando ela mente.
  //
  // 📏 O ÍCONE É O `tea` E NÃO O MODO CEGO, e a escolha foi MEDIDA por uma mutação que sobreviveu. Com o
  // modo cego, inverter a ordem não muda nada: `create-game` subscreve `state.on('modoCego')` e o reflexo
  // já aconteceu DENTRO do `iconAct`, então o rótulo lido já é o novo de qualquer maneira. Era equivalência
  // e não cobertura — e um caso que só passa por causa de uma subscrição não mede a linha que diz medir.
  // Medido: essa é a ÚNICA subscrição de estado desta raiz, logo o `tea` percorre o caminho de todos os
  // outros sete ícones.
  it('🔴 [Zero] o clique ANUNCIA, e anuncia o estado NOVO — não o que a criança deixou', async () => {
    abrir();
    // 🔴 ESPERAR O IDIOMA É O QUE FALTAVA, e foi a CI que o mostrou — verde aqui, vermelho lá:
    // «expected 'Modo TEA: calmo' to be 'Autism mode: calm'». Este caso compara DUAS leituras feitas em
    // instantes diferentes — o anúncio, composto no clique, e o rótulo, lido depois. O `initI18n` aplica pt
    // de forma síncrona e pede en/es em chunks ASSÍNCRONOS; num runner mais lento o chunk aterra ENTRE as
    // duas, e a comparação passa a medir o relógio da máquina em vez do comportamento.
    //
    // ⚠️ E É A CLASSE DE DEFEITO QUE ESTE REPOSITÓRIO CATALOGOU ESTA SEMANA — «um teste que mede a MÁQUINA».
    // Não reproduz localmente nem isolado nem emparelhado; só num runner com outro tempo.
    //
    // 📌 O QUE ELE DESTAPA NO PRODUTO, e fica dito em vez de consertado às cegas: uma criança que carregue no
    // ícone ANTES de o dicionário aterrar ouve o idioma de recuo enquanto o rótulo já mudou. É a mesma
    // fronteira do `424ee36` (a barra bilingue), do lado do ANÚNCIO em vez do rótulo — e ali a resposta foi
    // reflectir depois do `idiomaPronto()`. Aqui o anúncio é composto uma vez e não se reflecte.
    const { idiomaPronto } = await import('../app/js/core/i18n.js');
    await idiomaPronto();
    const alvo = document.querySelector('#title-icons [data-pi="tea"]');
    const rotuloAntes = alvo.getAttribute('aria-label');
    alvo.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // O `srSay` limpa e escreve no quadro seguinte (é assim que força o leitor a reanunciar texto repetido).
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const dito = document.querySelector('#sr-status').textContent;
    expect(dito.trim().length, 'o clique não anunciou nada a quem navega por ouvido').toBeGreaterThan(0);

    // ⚠️ A AFIRMAÇÃO É IGUALDADE COM O RÓTULO, e a primeira versão deste caso usava
    // `toContain('ligado')` — que é EXACTAMENTE o mesmo defeito que este caso existe para apanhar, cometido
    // dentro dele: «desligado» CONTÉM «ligado». A mutação que inverte a ordem sobreviveu por isso e só por
    // isso. Igualdade com o rótulo pós-clique apanha as três: sem anúncio, anúncio antes do reflexo, e
    // anúncio do id interno.
    const rotulo = document.querySelector('#title-icons [data-pi="tea"]').getAttribute('aria-label');
    expect(dito, 'o que se ouve não é o que o ícone diz').toBe(rotulo);
    expect(dito, 'anunciou o estado que a criança acabou de deixar').not.toBe(rotuloAntes);
  });

  // 🎯 A RAIZ RESPONDE PELO APARELHO EM USO (ADR-0113), e este é o único caso que o mede de ponta a ponta.
  // Os casos do `ui/pause-icons` injectam o `transporteEmUso` deles, então a LINHA DA RAIZ — a que lê o
  // `input/state.entradaDe(i)` — ficava sem ninguém a afirmar. Duas mutações sobreviveram por isso, e é este
  // caso que as mata: sem ele, a raiz podia responder «teclado» a toda a gente e nada reprovava.
  it('🎯 [Right] a raiz lê o aparelho do jogador, e o ícone escreve na chave DELE', async () => {
    const { arestaDoJogador, esquecerEntradas } = await import('../app/js/input/state.js');
    esquecerEntradas();
    try {
      arestaDoJogador(0, 'gamepad');           // a criança pegou no controle
      // ⚠️ `seguraTeclas: true` E A RAZÃO É O PONTO DO CASO: desde o ADR-0115 a raiz só monta o `altmove`
      // num jogo que segura alguma tecla, e o fixture padrão daqui é de hotspots (declara `false`). Sem esta
      // linha o caso passaria a medir a ausência do ícone em vez da fiação do aparelho — verde pela razão
      // errada, que é o defeito que este ficheiro inteiro existe para não cometer.
      abrir({
        declaration: { ...declaracaoValida(), seguraTeclas: () => true },
        players: [{ toggleMove: false, walkDir: 0, viz: 'normal' }],
      });

      const alvo = document.querySelector('#title-icons [data-pi="altmove"]');
      expect(alvo, 'o ícone da alternância não está na barra').not.toBeNull();
      alvo.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // ⚠️ Literal, e não a função que escreve a chave: afirmar pela mesma tabela mediria a ida e a volta.
      expect(localStorage.getItem('incl_togglemove_p0_gamepad'),
        'a raiz não levou o aparelho em uso até à escrita').toBe('1');
    } finally {
      esquecerEntradas();
      localStorage.removeItem('incl_togglemove_p0_gamepad');
      localStorage.removeItem('incl_togglemove_p0');
    }
  });

  // 📌 O PAR: com OUTRO aparelho, a chave é outra. Sem ele, «escrever sempre no gamepad» passaria no caso
  // acima — que é exactamente a forma da mutação que sobreviveu antes de este bloco existir.
  it('📌 [Right] com outro aparelho, a chave é a desse aparelho', async () => {
    const { arestaDoJogador, esquecerEntradas } = await import('../app/js/input/state.js');
    esquecerEntradas();
    try {
      arestaDoJogador(0, 'toque');
      // `seguraTeclas: true` pela mesma razão do caso acima — sem o ícone não há clique para medir.
      abrir({
        declaration: { ...declaracaoValida(), seguraTeclas: () => true },
        players: [{ toggleMove: false, walkDir: 0, viz: 'normal' }],
      });
      document.querySelector('#title-icons [data-pi="altmove"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(localStorage.getItem('incl_togglemove_p0_toque'), 'escreveu na chave do aparelho errado').toBe('1');
      expect(localStorage.getItem('incl_togglemove_p0_gamepad'), 'escreveu numa chave que ninguém usou').toBeNull();
    } finally {
      esquecerEntradas();
      localStorage.removeItem('incl_togglemove_p0_toque');
      localStorage.removeItem('incl_togglemove_p0');
    }
  });

  it('🔴 [Zero] o modo cego DESLIGA — sem isto ele liga uma vez e a criança fica lá dentro', () => {
    // 🔴 ESTE CASO EXISTE POR CAUSA DE UM DEFEITO REAL QUE SÓ UM DOM REAL PODIA MOSTRAR, e ele era meu.
    //
    // O par do modo cego ganhou os dois padrões em dias diferentes e eles não se falavam: o ESCRITOR ficou
    // com `setModoCegoValue` (etapa 1b do ADR-0106), que escreve no `core/state`; o LEITOR ficou com
    // `() => false`, uma CONSTANTE que já lá estava. Com um jogo que não injecta `isBlindMode`:
    //
    //   1. a criança carrega → `setModoCego(!false)` → o modo LIGA de verdade;
    //   2. o reflexo lê `false` → o ícone continua a dizer «desligado» e o anúncio também;
    //   3. ela carrega outra vez → `setModoCegoValue(!false)` = `true` OUTRA VEZ → a guarda de igualdade
    //      devolve cedo → nada acontece.
    //
    // ⚠️ Ou seja: o modo cego ligava uma vez e NÃO HAVIA COMO DESLIGAR. Para quem não depende dele, é um jogo
    // que de repente descreve tudo em voz alta e não se cala. Não há erro em lado nenhum.
    //
    // 📌 E o `domFalso` não podia apanhá-lo NUNCA: o `addEventListener` dele é um stub, então o corpo do
    // ouvinte — onde o par é exercitado — jamais correu em teste algum.
    abrir();
    const q = () => document.querySelector('#title-icons [data-pi="blind"]');
    q().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(q().getAttribute('aria-pressed'), 'não ligou').toBe('true');
    q().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(q().getAttribute('aria-pressed'), 'ligou e não há como voltar').toBe('false');
  });

  /*
   * ⚠️ O QUE UM CONSUMIDOR NÃO TINHA COMO ENTREGAR, E QUE POR ISSO NENHUM JOGO TINHA.
   *
   * O `initPauseIcons` aceita `getPauseActs`, `setPauseActor`, `setTemaDoJogador` e `setCorrecaoDoJogador`
   * desde que existem — todos opcionais, todos documentados. O `createGame` simplesmente não os passava e o
   * `CreateGameOptions` não tinha campo para eles, então **nenhum jogo montado por esta raiz** conseguia
   * ligar um item do cartão de pausa nem fazer aparecer os ícones de alto contraste e correcção de cor.
   *
   * Medido de fora, pelo `game-pinball`, que é o consumidor externo: ele lia a ausência dos dois ícones como
   * «este jogo tem os seus próprios», o que é verdade sobre o resultado e falso sobre a causa — ele não
   * PODIA entregar um escritor. Uma lacuna que o consumidor lê como escolha é a pior forma de lacuna.
   */
  describe('o que o jogo pode entregar ao cartão e à barra', () => {
    it('⚠️ [Zero] sem `getPauseActs`, o item que SÓ o jogo acciona nasce escondido', () => {
      // O `refrescarItensDaPausa` esconde o que não tem acção — o §5 do ADR-0106, que proíbe botão morto.
      //
      // ⚠️ O EXEMPLO MUDOU DE `quit` PARA `addplayer` em 2026-09-12, e a troca é a notícia: a engine passou a
      // accionar `resume`, `ajuda`, `print` e `quit` sozinha (ADR-0144 errata, ADR-0147 §4 e §5), logo `quit`
      // deixou de servir como exemplo de «item que só o jogo acciona» — ele aparece agora sem o jogo dizer
      // nada. `addplayer` continua a ser do jogo: entrar um segundo jogador é uma decisão que só ele sabe
      // tomar. 📌 Um caso cujo exemplo deixa de ser exemplo mede o oposto do que diz.
      const motor = abrir();
      motor.pausa.mostrar(0);

      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="addplayer"]');
      expect(item, 'o cartão nem sequer desenha o item').not.toBeNull();
      expect(item.hidden, 'um item sem acção tem de estar escondido').toBe(true);
    });

    it('⚠️ [Right] com `getPauseActs`, o item APARECE e o clique chega ao jogo', () => {
      let entrou = 0;
      const motor = abrir({ getPauseActs: () => ({ addplayer: () => { entrou += 1; } }) });
      motor.pausa.mostrar(0);

      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="addplayer"]');
      expect(item.hidden, 'o jogo ligou o item e ele continua escondido').toBe(false);

      item.click();
      expect(entrou, 'o clique percorreu o caminho todo até à função do jogo').toBe(1);
    });

    it('🔴 [Right] o `quit` do JOGO ganha ao da engine — o padrão não é uma tomada', () => {
      /*
       * 🎯 A engine passou a oferecer um `quit` («voltar à tela de press start», decisão do Dev), e este caso
       * é o que impede isso de virar confisco: `getPauseActs` espalha a tabela do JOGO POR CIMA da da engine,
       * então um jogo que precise de guardar alguma coisa, confirmar, ou desligar uma ligação antes de sair
       * continua a mandar. 📌 É a mesma forma do `resume` na errata do ADR-0144.
       */
      let saiuPeloJogo = 0;
      let fase = null;
      const motor = abrir({
        getPauseActs: () => ({ quit: () => { saiuPeloJogo += 1; } }),
        setPhase: (p) => { fase = p; },
      });
      motor.pausa.mostrar(0);

      document.querySelector('#vp-pause-0 .pm-btn[data-act="quit"]').click();

      expect(saiuPeloJogo, 'o `quit` da engine atropelou o do jogo').toBe(1);
      expect(fase, 'a engine pediu a fase por cima do jogo, que já tinha decidido como sair').toBeNull();
    });

    it('🎯 [Right] sem `quit` do jogo, a engine leva à TELA DE PRESS START', () => {
      // A outra metade: o jogo que não declara nada recebe uma saída na mesma (errata do ADR-0144 §5).
      // ⚠️ O crivo afirma a CHAMADA e não os pixels, porque quem desenha essa tela é o `ui/shell`, que esta
      // raiz recusa montar de propósito — a engine esconde o cartão dela e PEDE a fase.
      const fases = [];
      const motor = abrir({ setPhase: (p) => fases.push(p) });
      motor.pausa.mostrar(0);
      const sair = document.querySelector('#vp-pause-0 .pm-btn[data-act="quit"]');
      expect(sair.hidden, 'a engine oferece `quit` e o item continua escondido').toBe(false);

      sair.click();

      expect(fases, 'a saída não pediu a tela de press start').toEqual(['title']);
      expect(document.querySelector('#vp-pause-0').hidden, 'saiu do jogo e o cartão ficou aberto').toBe(true);
    });

    it('🔴 [Right] o PRINT esconde o cartão, e qualquer tecla o traz de volta', async () => {
      /*
       * 🔴 «Ver a tela sem menus» é um item que a engine nunca soube accionar. O `ui/shell.printMode` fazia-o
       * no monólito e não vem com o `ui/shell`, que esta raiz recusa montar — mas ele não precisa da máquina
       * de fases, só dos cartões, da janela e do anúncio.
       *
       * ⚠️ E O ADIAMENTO DE 80 ms É O CASO, não um detalhe: sem ele o próprio evento que ACCIONOU o print é o
       * que o desfaz, e a criança carrega uma vez e vê a tela limpa piscar. Por isso o caso ESPERA — e a
       * espera é o que o prende.
       */
      const motor = abrir();
      motor.pausa.mostrar(0);
      const cartao = document.querySelector('#vp-pause-0');
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="print"]');
      expect(item.hidden, 'a engine oferece `print` e o item continua escondido').toBe(false);

      item.click();
      expect(cartao.hidden, 'o print não escondeu o cartão').toBe(true);

      // ⚠️ ANTES dos 80 ms a tecla NÃO devolve — é exactamente o evento que o print existe para ignorar.
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
      expect(cartao.hidden, 'o print desfez-se com o próprio evento que o accionou').toBe(true);

      await new Promise((r) => setTimeout(r, 140));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
      expect(cartao.hidden, 'depois do adiamento, qualquer tecla tinha de trazer o cartão de volta').toBe(false);
    });

    it('⚠️ [Zero] sem escritores visuais, os ícones de contraste e cor NÃO são montados', () => {
      // `iconesQueAccionam` monta `contrast` e `cvd` só para quem entrega quem os escreve. É a regra certa:
      // um ícone que não acciona é pior que um ícone a menos. O que faltava era a PORTA.
      abrir();

      expect(document.querySelector('#title-icons [data-pi="contrast"]')).toBeNull();
      expect(document.querySelector('#title-icons [data-pi="cvd"]')).toBeNull();
    });

    it('⚠️ [Right] com eles, os dois ícones aparecem — e o §4 do ADR-0044 fica alcançável', () => {
      abrir({ setTemaDoJogador: () => {}, setCorrecaoDoJogador: () => {} });

      expect(document.querySelector('#title-icons [data-pi="contrast"]'), 'alto contraste').not.toBeNull();
      expect(document.querySelector('#title-icons [data-pi="cvd"]'), 'correcção de cor').not.toBeNull();
    });

    it('⚠️ [Right] e UM escritor só monta UM ícone, porque são duas perguntas diferentes', () => {
      // O par não é um botão de dois estados: um jogo pode saber repintar para alto contraste e não ter
      // como corrigir daltonismo, ou o contrário — que é exactamente o caso do `game-pinball`, cuja imagem
      // é um framebuffer de 320x180 sem textura para repintar, mas que aplica um filtro de cor há semanas.
      abrir({ setCorrecaoDoJogador: () => {} });

      expect(document.querySelector('#title-icons [data-pi="cvd"]'), 'o que ele sabe fazer').not.toBeNull();
      expect(document.querySelector('#title-icons [data-pi="contrast"]'), 'o que ele não sabe').toBeNull();
    });
  });

  it('⚠️ [Boundary] a barra monta no hospedeiro DECLARADO, e não caça um id fixo', () => {
    // O jogo diz onde ela cabe no desenho dele; a engine não adivinha. Num documento a sério isto prova-se
    // pelo sítio onde os nós ficaram, que é a única coisa que um duplo com um mapa de ids não distingue.
    const meu = document.createElement('nav');
    meu.id = 'a-minha-barra';
    raiz.appendChild(meu);
    abrir({ host: { doc: document, win: window, a11yBarHost: meu } });
    expect(meu.querySelectorAll('[data-pi]').length).toBeGreaterThan(0);
    expect(document.querySelector('#title-icons').children.length, 'montou nos DOIS sítios').toBe(0);
  });

  /*
   * O AVISO DE ALCANCE ENTRE CARTUCHOS (ADR-0142).
   *
   * ⚠️ ESTE CASO SÓ PODE VIVER AQUI, e a regra do cabeçalho deste ficheiro é que o diz: o `domFalso` do
   * projeto node devolve um elemento para QUALQUER seletor que não esteja em `ausentes`, logo
   * `#reach-notice` responde «existe» quer tenha sido criado quer não; e o `removeChild` dele é uma função
   * vazia. As duas metades da pergunta — apareceu? saiu? — são invisíveis ao duplo. Aqui há árvore a sério.
   *
   * 🎯 E o que se mede não é o aviso APARECER: é ele SAIR quando o cartucho seguinte não tem o que avisar.
   * `retirarAvisoDeAlcance()` corre sempre, e não só quando há o que mostrar, exactamente por isto — um
   * cartucho calado tem de apagar o barulho do anterior, e é esse o caso que se esquece.
   */
  it('🎯 [Zero] um cartucho sem nada a avisar APAGA o aviso de alcance do anterior', () => {
    // ⚠️ UM APARELHO SEM NADA, e não «só com toque», que foi a primeira tentativa e passou: o `ok` do
    // alcance é `acoes.length > 0 && disponiveis.some(serve)`, e o toque APONTA — logo servia ao jogo que
    // pede ponteiro, e o aviso não chegava a existir. Sem transporte nenhum disponível, `some` é falso e a
    // engine tem o que dizer, que é a pré-condição deste caso.
    const semNada = {
      gamepad: () => false, toque: () => false, teclado: () => false, rato: () => false,
    };
    const motor = abrir({
      declaration: { ...declaracaoValida(), needsPointer: () => true },
      disponibilidade: semNada,
      preset: { up: { label: 'Cima' }, down: { label: 'Baixo' }, action1: { label: 'Agir' } },
    });
    expect(document.querySelector('#reach-notice'), 'o aviso nem chegou a aparecer — o caso não mede nada')
      .not.toBeNull();

    // Sem ganchos: o cartucho novo não declara `preset`, logo não tem ações a avisar.
    motor.mount(declaracaoValida());
    expect(document.querySelector('#reach-notice'), 'o aviso do cartucho anterior ficou na página')
      .toBeNull();
  });

  /*
   * ===================== OS PAINÉIS DE AJUSTES (ADR-0106 §1) =====================
   *
   * 🔴 O QUE ESTES CASOS MEDEM JÁ FOI MEDIDO A VALER, e o número é o argumento: um jogo que chama só
   * `createGame` recebia ZERO painéis. `ui/panel-shell.montarCasca` existe desde 07/09 e nenhum módulo da
   * engine a chamava — o único chamador da árvore era o quiz. Cada `ui/settings-*` preenchia o interior de ids
   * que ninguém criava, e o quiz registou o sintoma como achado 6: «o painel abre VAZIO, sem erro».
   *
   * 🎯 E TÊM DE VIVER AQUI, pela regra do cabeçalho: a pergunta é se o painel está NA ÁRVORE, se um clique de
   * verdade o abre, se as opções de fonte PARSEIAM e se o foco pousa dentro do cartão. Um duplo responde «sim»
   * às quatro sem que nenhuma seja verdade.
   */
  describe('os painéis de ajustes, que a engine passou a montar', () => {
    const itemTipo = () => document.querySelector('#vp-pause-0 .pm-btn[data-act="tipo"]');

    it('🎯 [Right] com ZERO campos opcionais, o painel de TIPOGRAFIA está no documento e nasce escondido', () => {
      // O caso que carrega a etapa: nada de `getPauseActs`, nada de escritores. O jogo só chamou `createGame`.
      abrir();
      const painel = document.querySelector('#typo');
      expect(painel, 'a engine não montou painel nenhum — é o estado de antes').not.toBeNull();
      expect(painel.isConnected).toBe(true);
      expect(painel.hidden, 'um painel que nasce aberto é um painel que ninguém abriu').toBe(true);
      // Os cinco ids que o `ui/settings-typo` exige e que ninguém declarava. O contrato agora é construído.
      for (const id of ['typo-title', 'typo-list', 'typo-reset', 'typo-close']) {
        expect(document.getElementById(id), `a casca não criou #${id}`).not.toBeNull();
      }
    });

    it('🔴 [Right] a AJUDA abre por um clique e diz POSIÇÃO ↔ tecla ↔ a palavra do jogo', () => {
      /*
       * 🔴 O item `ajuda` está na lista desde o ADR-0044 e a engine nunca o soube accionar — a tela que o
       * preenchia saiu com o cartucho (#111). Este caso é o percurso inteiro da criança: item da pausa →
       * despacho → tabela da engine → `abrir()` → `render()` → as linhas no documento.
       *
       * 📌 E TEM DE VIVER AQUI e não no ficheiro `node`: lá a metade pura já está presa (`helpRows`), mas
       * «o painel está NA ÁRVORE», «um clique de verdade o abre» e «a lista foi preenchida» são as três
       * coisas que só um documento sabe — é a regra do cabeçalho deste ficheiro.
       */
      const motor = abrir({
        preset: {
          action2: { label: 'Confirmar', hint: 'Escolhe a alternativa em que está o cursor.' },
          left: { label: 'Alternativa anterior' },
        },
      });
      motor.pausa.mostrar(0);

      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="ajuda"]');
      expect(item, 'o item de ajuda nem foi montado').not.toBeNull();
      expect(item.hidden, 'o item existe e está escondido: o filtro do §5 não o viu accionar').toBe(false);

      item.click();

      const painel = document.querySelector('#help');
      expect(painel, 'a engine não montou o painel de ajuda').not.toBeNull();
      expect(painel.hidden, 'o clique não abriu a ajuda').toBe(false);
      const linhas = [...document.querySelectorAll('#help-list .ctrl-row')];
      expect(linhas.length, 'a ajuda abriu vazia').toBe(2);
      // A ordem é a canónica de `ACTIONS`: `left` antes de `action2`, e não a ordem do objeto do jogo.
      expect(linhas.map((l) => l.dataset.act)).toEqual(['left', 'action2']);
      // 🔴 A PALAVRA É A DO JOGO, e nenhuma célula mostra um identificador.
      expect(painel.textContent).toContain('Confirmar');
      expect(painel.textContent, 'a ajuda mostrou um identificador a uma criança').not.toContain('action2');
      // A tecla é a do esquema desta criança, resolvida pelo runtime de teclado e não inventada aqui.
      expect(linhas[1].querySelector('.help-key').textContent.trim().length).toBeGreaterThan(0);
    });

    it('🔴 [Zero] SEM `preset` o item de ajuda fica ESCONDIDO — afirmar a ausência', () => {
      // O par do caso acima. Sem as palavras do jogo a ajuda não se monta (ADR-0074), logo a tabela da engine
      // não ganha `ajuda` e o filtro do §5 esconde o item. Medir só a presença deixaria isto passar.
      const motor = abrir();
      motor.pausa.mostrar(0);
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="ajuda"]');
      expect(item.hidden, 'a ajuda acendeu sem o jogo declarar uma palavra sequer').toBe(true);
      expect(document.querySelector('#help'), 'o painel foi montado sem ter o que dizer').toBeNull();
    });

    it('🎯 [Right] o item `tipo` SOBREVIVE ao filtro do §5 — a tabela da engine deixou de ser vazia', () => {
      // 📏 A cascata que produzia um cartão de um botão: sem `getPauseActs` a tabela é `{}`, `itensQueAccionam`
      // guarda só os três de `ITENS_DA_ENGINE`, e `raizQueAcciona` tira também o `options` porque seria «uma
      // porta para uma sala vazia». Com uma acção de verdade, a porta e a sala existem.
      const motor = abrir();
      motor.pausa.mostrar(0);
      expect(itemTipo(), 'o item de tipografia nem foi montado').not.toBeNull();
      expect(itemTipo().hidden, 'o item existe e está escondido: o filtro do §5 não o viu accionar').toBe(false);
      const porta = document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]');
      expect(porta.hidden, 'a porta de opções continua fechada sobre uma sala que agora tem gente').toBe(false);
    });

    it('🎯 [Right] UM CLIQUE DE VERDADE no item abre o painel, com as fontes desenhadas e o foco dentro', () => {
      // O caminho inteiro: botão da pausa -> despacho de `ui/pause-icons` -> tabela da engine -> `abrir()` ->
      // `render()` do painel. Nenhum duplo percorre isto; e é o percurso que a criança faz.
      const motor = abrir();
      motor.pausa.mostrar(0);
      itemTipo().click();

      const painel = document.querySelector('#typo');
      expect(painel.hidden, 'o clique não revelou o painel').toBe(false);
      const fontes = painel.querySelectorAll('button[data-font]');
      expect(fontes.length, 'o painel abriu VAZIO — é o achado 6, outra vez').toBeGreaterThan(0);
      expect(painel.querySelector('.overlay__card').contains(document.activeElement),
        'o foco ficou FORA de um diálogo `aria-modal`').toBe(true);
    });

    it('⚠️ [Right] o painel ENTRA na cadeia do Escape — o registo estava vazio sob o `createGame`', () => {
      const motor = abrir();
      motor.pausa.mostrar(0);
      expect(motor.overlays.escapeTarget(), 'com tudo fechado a cadeia não tem alvo').toBeNull();
      itemTipo().click();
      expect(motor.overlays.escapeTarget(), 'o painel abriu e nenhuma tecla o fecha — a armadilha do ADR-0044 §2')
        .toBe('typo');
    });

    it('⚠️ [Right] a AMOSTRA existe e veste a fonte escolhida — é a pergunta que o painel responde', () => {
      // «Consigo ler isto?» é a única pergunta que um menu de fontes responde, e ela não se responde por nome.
      const motor = abrir();
      motor.pausa.mostrar(0);
      itemTipo().click();
      const amostra = document.querySelector('#typo-preview');
      expect(amostra, 'o painel de tipografia abriu sem amostra nenhuma').not.toBeNull();
      expect(amostra.textContent.length, 'a amostra está vazia: não mostra letra nenhuma').toBeGreaterThan(10);
      expect(amostra.style.fontFamily, 'a amostra não vestiu a fonte — é texto a fingir que é amostra').not.toBe('');
    });

    it('⚠️ [Right] o CARTUCHO sobrepõe a acção da engine — não-declinável é a pausa, não cada item dela', () => {
      // ADR-0122 torna não-declinável a pausa EXISTIR; não faz da engine dona de cada item dentro dela. Um
      // jogo que já tenha o seu painel de tipografia continua a ser quem responde pelo item.
      let meu = 0;
      const motor = abrir({ getPauseActs: () => ({ tipo: () => { meu += 1; } }) });
      motor.pausa.mostrar(0);
      itemTipo().click();
      expect(meu, 'a engine ganhou ao jogo na própria mesa dele').toBe(1);
      expect(document.querySelector('#typo').hidden,
        'abriu o painel da engine por cima do jogo — dois painéis para o mesmo ajuste').toBe(true);
    });

    it('🔴 [Right] o REPOR está LIGADO — a casca entra no documento ANTES do `init` do painel', async () => {
      // ⚠️ A ORDEM DAS DUAS CHAMADAS É A DECISÃO, e este é o caso que a prende. `initSettingsTypo` liga o
      // `#typo-reset` UMA VEZ, no arranque (`ui/settings-typo:279`): montar a casca DEPOIS do `init` deixa o
      // botão no documento e sem escuta nenhuma — um botão morto com aparência de vivo, que é o que o
      // ADR-0106 §5 proíbe. E o repor não volta para uma fonte qualquer: volta para a Atkinson Hyperlegible,
      // que é o padrão por ter sido desenhada para quem tem baixa visão.
      const { DEFAULT_FONT_KEY, FONT_BY_KEY } = await import('../app/js/ui/fonts.js');
      const padrao = FONT_BY_KEY[DEFAULT_FONT_KEY].fam;
      const motor = abrir();
      motor.pausa.mostrar(0);
      itemTipo().click();
      const amostra = document.querySelector('#typo-preview');

      const outra = [...document.querySelectorAll('#typo-list button[data-font]:not([disabled])')]
        .find((b) => b.dataset.font !== DEFAULT_FONT_KEY);
      expect(outra, 'não há segunda fonte escolhível: o caso não conseguiria medir o repor').toBeTruthy();
      outra.click();
      expect(amostra.style.fontFamily, 'escolher outra fonte não mudou a amostra').not.toContain(padrao);

      document.querySelector('#typo-reset').click();
      expect(amostra.style.fontFamily, 'o REPOR não faz nada — a casca montou DEPOIS do `init`')
        .toContain(padrao);
    });

    it('🎯 [Right] o painel de COMUNICAÇÃO também está lá, e o clique abre-o com a caixa da letra', () => {
      // O segundo dos oito, e o que ele mede é a generalização: o `montarPainel` serve um painel que tem
      // `open()`/`close()` próprios tão bem como um que não tem. 📌 O estado já era da engine desde a Fase 2
      // (`core/state.letterCase`) — o que faltava era alguém ligar duas peças da mesma casa.
      const motor = abrir();
      motor.pausa.mostrar(0);
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="caa"]');
      expect(item, 'o item de comunicação nem foi montado').not.toBeNull();
      expect(item.hidden, 'o item existe e está escondido: a engine não o acciona').toBe(false);

      item.click();
      const painel = document.querySelector('#caa');
      expect(painel.hidden, 'o clique não revelou o painel').toBe(false);
      expect(document.querySelector('#caa-caixa-alta'), 'abriu sem a escolha da caixa da letra').not.toBeNull();
    });

    it('🔴 [Right] o interruptor da CAIXA ALTA diz a verdade depois de a criança lhe tocar', async () => {
      // ⚠️ ESTE CASO NASCEU DE UMA MUTAÇÃO SOBREVIVENTE. Congelar o `getLetterCase` no arranque não reprovava
      // nada, e o defeito que ele produz é o pior desta casa: o estado MUDA e o controle continua a dizer o
      // contrário. É a família do `reflectTTS` e do `#opt-modocego`, que este projeto já pagou duas vezes.
      // 📌 As duas metades juntas, e é isso que o torna um portão: o `core/state` mudou E o botão conta-o.
      const state = await import('../app/js/core/state.js');
      const motor = abrir();
      motor.pausa.mostrar(0);
      document.querySelector('#vp-pause-0 .pm-btn[data-act="caa"]').click();

      const antes = state.letterCase;
      document.querySelector('#caa-caixa-alta').click();
      expect(state.letterCase, 'o clique não mudou o estado da engine').not.toBe(antes);
      // ⚠️ RELIDO DO DOCUMENTO: o `render()` reconstrói a lista inteira, então o nó de antes do clique está
      // fora da árvore e responderia pelo estado velho sem ninguém reparar.
      expect(document.querySelector('#caa-caixa-alta').getAttribute('aria-pressed'),
        'o estado mudou e o interruptor continua a anunciar o anterior').toBe(String(state.letterCase === 'upper'));

      // e devolve ao padrão, para não deixar a caixa trocada aos casos seguintes
      document.querySelector('#caa-reset').click();
    });

    it('🔴 [Right] o FECHAR do CAA tem UM dono — e o Escape passa pelo mesmo caminho', () => {
      // ⚠️ `settings-caa` liga o `#caa-close` sozinho no init. Se a casca ligasse um segundo ouvinte, o botão
      // teria dois donos; e se ela registasse o SEU closer na cadeia do Escape, o botão e a tecla fariam o
      // mesmo trabalho por caminhos diferentes — que é como um deles fica para trás.
      const motor = abrir();
      motor.pausa.mostrar(0);
      document.querySelector('#vp-pause-0 .pm-btn[data-act="caa"]').click();
      expect(motor.overlays.escapeTarget(), 'o painel abriu fora da cadeia do Escape').toBe('caa');

      document.querySelector('#caa-close').click();
      expect(document.querySelector('#caa').hidden, 'o botão de fechar não fechou').toBe(true);
      expect(motor.overlays.escapeTarget(), 'fechou à vista e continua a ser o alvo do Escape').toBeNull();
    });

    it('🎯 [Right] o painel de SENSIBILIDADE VISUAL abre, e a lista dele é `#motion-list`', () => {
      // ⚠️ A ÚNICA DIVERGÊNCIA DE ID DOS OITO, e ela é silenciosa: `settings-motion` vive em `#animation` — com
      // `#animation-reset` e `#animation-close`, que casam — e lê a lista em `#motion-list`. A casca que
      // criasse `#animation-list` devolveria um painel que abre VAZIO, sem erro, que é o achado 6 outra vez.
      const motor = abrir();
      motor.pausa.mostrar(0);
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="anim"]');
      expect(item, 'o item de sensibilidade visual nem foi montado').not.toBeNull();
      expect(item.hidden).toBe(false);

      item.click();
      expect(document.querySelector('#animation').hidden, 'o clique não revelou o painel').toBe(false);
      const lista = document.querySelector('#motion-list');
      expect(lista, 'a casca criou a lista com o id errado — o painel abre vazio e ninguém sabe').not.toBeNull();
      expect(lista.querySelectorAll('button').length, 'a lista existe e está vazia').toBeGreaterThan(0);
      // e não sobrou uma lista órfã com o id que a convenção daria
      expect(document.querySelector('#animation-list'), 'ficaram DUAS listas no cartão').toBeNull();
    });

    it('🔴 [Right] o BOTÃO-MESTRE congela tudo de um gesto — e existe antes do `init`, ou é morto', () => {
      // ⚠️ Mesma regra de ordem do `#typo-reset`: `initSettingsMotion` liga o clique dele UMA VEZ, no arranque.
      // E ele não é conveniência — é a saída de quem sentiu enjoo com a tela a mexer e precisa de parar TUDO
      // num gesto, em vez de percorrer sete linhas uma a uma.
      const motor = abrir();
      motor.pausa.mostrar(0);
      document.querySelector('#vp-pause-0 .pm-btn[data-act="anim"]').click();

      const mestre = document.querySelector('#motion-master');
      expect(mestre, 'o painel abriu sem o botão de parar tudo').not.toBeNull();
      expect(mestre.textContent.length, 'o botão-mestre está sem rótulo: ninguém sabe o que ele faz')
        .toBeGreaterThan(0);
      const antes = mestre.getAttribute('aria-pressed');
      mestre.click();
      expect(document.querySelector('#motion-master').getAttribute('aria-pressed'),
        'o clique não fez nada — a casca montou DEPOIS do `init` e o botão ficou sem escuta').not.toBe(antes);

      // devolve ao padrão para não deixar tudo congelado aos casos seguintes
      document.querySelector('#animation-reset').click();
    });

    it('🎯 [Right] o painel AUDITIVO abre com os seus controles, cada um com a tag certa', () => {
      // O maior dos oito: quinze nós que o painel alcançava e nunca criava. Aqui o que se mede é o percurso
      // inteiro — item da pausa, tabela da engine, `abrir()`, `renderAudio()` — e que a tag sobreviveu a ele.
      const motor = abrir();
      motor.pausa.mostrar(0);
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]');
      expect(item, 'o item de acessibilidade auditiva nem foi montado').not.toBeNull();
      expect(item.hidden).toBe(false);

      item.click();
      expect(document.querySelector('#audio').hidden, 'o clique não revelou o painel').toBe(false);
      expect(document.querySelector('#cane-div').tagName, 'a bengala não é uma escolha').toBe('SELECT');
      expect(document.querySelector('#audio-master-vol').type, 'o volume não é um cursor').toBe('range');
      // e a lista de categorias foi PREENCHIDA pelo painel: um grupo vazio é o achado 6 outra vez
      expect(document.querySelectorAll('#audio-list [data-acat]').length,
        'o painel abriu com a lista de sons vazia').toBeGreaterThan(0);

      // ⚠️ E OS TREZE CONTROLES ESTÁTICOS ESTÃO LIGADOS — a regra de ordem, medida no que ela produz.
      // `initSettingsAudio` liga-os UMA VEZ, no arranque; com o interior montado DEPOIS, ficariam treze
      // botões no documento e sem escuta nenhuma. Sem este pedaço a mutação da ordem sobrevivia.
      const mestre = document.querySelector('#audio-master');
      const antesDoSom = mestre.getAttribute('aria-pressed');
      mestre.click();
      expect(document.querySelector('#audio-master').getAttribute('aria-pressed'),
        'o clique no som não fez nada — o interior montou DEPOIS do `init`').not.toBe(antesDoSom);
      mestre.click(); // devolve ao estado anterior, que é global ao módulo de áudio
    });

    it('🔴 [Right] ligar o TTS pelo ÍCONE refresca o painel — o guarda morto do monólito voltou a valer', () => {
      // ⚠️ `ui/pause-icons` documenta o defeito e preservou-o verbatim: no monólito esta chamada estava atrás
      // de `typeof reflectTTS === 'function'`, um símbolo que já não existia, «so it never fires». O campo
      // `reflectTtsPanelEnabled` existe para o ligar de volta, e só agora há um painel para refrescar.
      //
      // 📌 Sem isto, a criança liga a narração pelo ícone 🗣 e o painel continua a dizer que está desligada —
      // a família do controlo a mentir o estado, que este repositório já pagou com o `#opt-modocego`.
      const motor = abrir();
      motor.pausa.mostrar(0);
      document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
      const botao = document.querySelector('#opt-tts');
      const antes = botao.getAttribute('aria-pressed');

      // o ícone da barra da primeira tela, que é outra superfície da MESMA engine
      const icone = document.querySelector('#title-icons [data-pi="tts"]');
      expect(icone, 'o ícone de narração não está na barra: o caso não mede nada').not.toBeNull();
      icone.click();

      expect(document.querySelector('#opt-tts').getAttribute('aria-pressed'),
        'o ícone mudou o estado e o painel continua a anunciar o anterior').not.toBe(antes);
    });

    it('🔴 [Boundary] hospedeiro FORA de `#game-region` vira linha em `problems`, e não silêncio', () => {
      // ⚠️ ESTE É O CASO DO SILÊNCIO. `ui/settings-panel.topVisibleOverlay` varre `'#game-region .overlay'`, e é
      // por ele que o `ui/menu-nav` acha o diálogo de cima para andar com as setas. Um painel pendurado fora
      // desse escopo ABRE e fecha com Escape — e as setas não andam dentro dele, sem erro em lado nenhum.
      const fora = document.createElement('div');
      fora.id = 'fora-da-regiao';
      raiz.appendChild(fora); // irmão do #game-region, não filho
      const motor = abrir({ host: { doc: document, win: window, pauseHost: fora } });

      const linha = motor.problems.find((p) => p.includes('#game-region'));
      expect(linha, 'a engine montou fora do escopo dos overlays e calou-se').toBeTruthy();
      expect(linha, 'a linha tem de nomear a saída, ou é queixa em vez de conserto').toMatch(/pauseHost/);
      // E a lacuna é DITA, não fingida: o painel foi mesmo montado onde o jogo mandou.
      expect(fora.querySelector('#typo'), 'acusou e não montou — pior do que montar e calar').not.toBeNull();
    });

    it('🎯 [Zero] DOIS cartuchos em sequência deixam UM de cada — o terceiro gate do ADR-0139', () => {
      // ⚠️ O gate existia como frase e não como contagem, e até hoje ele não tinha o que contar: a engine
      // montava a barra e o cartão, e mais nada. Com quatro painéis montados, «uma barra» passou a ser
      // «uma barra, um cartão e quatro painéis» — e um `mount()` que um dia passasse a remontá-los deixaria
      // dois de cada, com o segundo a roubar os ids do primeiro.
      const motor = abrir();
      motor.mount(declaracaoValida());
      motor.mount(declaracaoValida());

      expect(document.querySelectorAll('#title-icons').length).toBe(1);
      expect(document.querySelectorAll('[id^="vp-pause-"]').length, 'sobrou mais de um cartão de pausa').toBe(1);
      for (const id of ['typo', 'caa', 'animation', 'audio']) {
        expect(document.querySelectorAll('#' + id).length, `#${id} ficou duplicado`).toBe(1);
      }
      // e a barra não ganhou uma segunda fiada de ícones dentro de si
      const porIcone = [...document.querySelectorAll('#title-icons [data-pi]')].map((b) => b.dataset.pi);
      expect(new Set(porIcone).size, 'a barra remontou por cima de si mesma').toBe(porIcone.length);
    });

    it('🔴 [Inverse] `unmount` NÃO leva a acessibilidade — ela é da PÁGINA, não do cartucho (ADR-0038)', () => {
      // ⚠️ ESTE CASO AFIRMA UMA AUSÊNCIA DE EFEITO, e é a metade que um teardown esquece. O ADR-0038 corta o
      // estado em PÁGINA / RODADA / JOGO, e a barra, o cartão e os painéis são da PÁGINA: uma criança que
      // trocou de jogo não pode perder o modo cego, a tipografia e a pausa no caminho.
      //
      // 📌 O que `unmount` solta é o que é do cartucho — mapeamentos, aviso de alcance, pilha de cenas —, e
      // isso já tem casos no ficheiro node. O que se guarda aqui é o que ele NÃO pode tocar.
      const motor = abrir();
      motor.unmount();

      expect(document.querySelector('#title-icons [data-pi]'), 'a barra de acessibilidade saiu com o cartucho')
        .not.toBeNull();
      expect(document.querySelector('#vp-pause-0'), 'o cartão de pausa saiu com o cartucho').not.toBeNull();
      for (const id of ['typo', 'caa', 'animation', 'audio']) {
        expect(document.getElementById(id), `#${id} saiu com o cartucho`).not.toBeNull();
      }
      // e o que sobra ainda ABRE: um painel que fica no documento e deixa de responder é pior do que um que sai
      motor.pausa.mostrar(0);
      document.querySelector('#vp-pause-0 .pm-btn[data-act="tipo"]').click();
      expect(document.querySelector('#typo').hidden, 'o painel sobreviveu ao `unmount` e deixou de abrir')
        .toBe(false);
    });

    it('🎯 [Zero] com hospedeiro DENTRO da região, `problems` não inventa a lacuna', () => {
      // O par do caso acima, e sem ele o crivo aprovaria uma engine que acusa sempre.
      const motor = abrir();
      expect(motor.problems.filter((p) => p.includes('#game-region') && p.includes('setas')),
        'acusou o escopo dos overlays com o hospedeiro no sítio certo').toEqual([]);
    });
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Seis, aplicadas por script ao ficheiro e sempre com contagem de ocorrencias.
//
//   1. ⚠️ `getModoCego` a voltar a ser `() => false` -> reprovam DOIS. E ela nao e uma mutacao inventada: e o
//      ESTADO EM QUE O CODIGO ESTAVA quando este ficheiro nasceu. Todo o resto da suite continua verde com
//      ela aplicada, que e a medida exacta de quanto o duplo nao alcancava.
//   2. a barra a montar marcacao VAZIA -> reprovam CINCO. E o caso do vacuo deste ficheiro: sem barra, quase
//      tudo o que ele afirma deixa de ter sujeito, e um crivo que nao acha nada nao prova ausencia nenhuma.
//   3. o cartao com outro id -> reprovam DOIS. A engine procura `#vp-pause-0`; montar com outro nome reabre
//      o laco que a etapa 2 fechou, e em silencio.
//   4. `mostrar` a nao revelar -> reprova UM. Montar nao e mostrar, e a distincao tem de custar alguma coisa.
//   5. o hospedeiro DECLARADO ignorado -> reprova UM. A engine nao adivinha onde a barra cabe num jogo alheio.
//   6. `tabindex="-1"` nos icones -> reprova UM. E o argumento da etapa 2 a pagar-se: na primeira tela ninguem
//      esta a jogar, e tirar os icones da tabulacao esconde-os de quem navega por teclado.
//
// ========================= E MAIS SETE, PELOS PAINEIS (2026-09-11) =========================
//   7. a accao do painel nunca entrar na tabela da engine (`acoesDaEngine.tipo` apagado) -> reprovam QUATRO.
//      E o ESTADO EM QUE O CODIGO ESTAVA: sem accao, a cascata do §5 esconde o item, a porta `options` fecha
//      sobre uma sala vazia, e a crianca chega a pausa e encontra um botao.
//   8. a tabela da engine nao se juntar a do cartucho (`...acoesDaEngine` fora do merge) -> os mesmos quatro.
//      Duas maneiras de a mesma ligacao morrer, e as duas tinham de custar.
//   9. o CARTUCHO deixar de sobrepor a engine (ordem do merge trocada) -> reprova UM, e so um. O ADR-0122
//      torna nao-declinavel a pausa EXISTIR; nao faz da engine dona de cada item dentro dela.
//  10. o `init` do painel correr ANTES de a casca entrar no documento -> reprova UM: o repor. `initSettingsTypo`
//      liga o `#typo-reset` uma vez, no arranque, e a ordem invertida deixa um botao no documento sem escuta
//      nenhuma — morto com aparencia de vivo (ADR-0106 §5). A ORDEM das duas chamadas e a decisao.
//  11. a amostra nao entrar no cartao -> reprovam DOIS. Um menu de fontes sem amostra nao responde a unica
//      pergunta que ele existe para responder, e ela nao se responde por nome de fonte.
//  12. `dentroDoEscopo` sempre VERDADEIRO -> reprova o caso do hospedeiro fora da regiao: a engine volta a
//      calar-se sobre um painel onde as setas nao andam.
//  13. `dentroDoEscopo` sempre FALSO -> reprova o par dele. Sem este, o crivo aprovaria uma engine que acusa
//      sempre, que e tao inutil quanto uma que nunca acusa.
