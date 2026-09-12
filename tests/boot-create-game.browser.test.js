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
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';

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

const abrir = (extra = {}) => createGame({ acomodacoes: SEM_ASSUNTO,
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
    it('⚠️ [Zero] sem `getPauseActs`, o item que SÓ o jogo acciona nasce TRAVADO (ADR-0161)', () => {
      // O `refrescarItensDaPausa` escondia o que não tem acção (§5 do ADR-0106); desde o ADR-0161 trava-o com o motivo.
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
      expect(item.hidden, 'the item vanished instead of being locked').toBe(false);
      expect(item.getAttribute('aria-disabled'), 'um item sem acção tem de estar travado').toBe('true');
    });

    it('🔴 [Right] the cursor NEVER lands on a hidden item — the ring walks only what the child sees', () => {
      // 📏 Measured in dist (quiz, 2026-09-12): ArrowDown from «Voltar ao jogo» put the cursor on «Ajuda», which is
      // hidden without a `preset`. `PM_ITENS_VISIVEIS` excluded hidden LISTS and not hidden ITEMS, so the child pressed
      // down and saw nothing selected; the count «N of M» counted the invisible ones too.
      // ⚠️ Since ADR-0161 the engine hides nothing, but a game may pass its own lists: the item is hidden by hand here.
      const motor = abrir();
      motor.pausa.mostrar(0);
      document.querySelector('#vp-pause-0 .pm-btn[data-act="ajuda"]').hidden = true;
      const visiveis = [...document.querySelectorAll('#vp-pause-0 .pause-menu:not([hidden]) .pm-btn')].filter((b) => !b.hidden);
      expect(visiveis.length, 'nothing is hidden — the case would measure nothing').toBeLessThan(
        document.querySelectorAll('#vp-pause-0 .pause-menu:not([hidden]) .pm-btn').length);
      const regiao = document.getElementById('game-region') ?? document.body;
      for (let i = 0; i < visiveis.length + 1; i++) {
        regiao.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true, cancelable: true }));
        const sel = document.querySelector('#vp-pause-0 .pm-sel');
        expect(sel, 'no item selected after a step').not.toBeNull();
        expect(sel.hidden, `the cursor landed on the hidden «${sel.dataset.act}»`).toBe(false);
      }
      document.querySelector('#vp-pause-0 .pm-btn[data-act="ajuda"]').hidden = false;
      motor.pausa.esconder(0);
    });

    it('🔴 [Right] opening the card puts the cursor on item 1 of the ROOT — even if it was closed inside the submenu (ADR-0158)', () => {
      // 📏 Measured in dist: opened by SELECT, no item was marked, and the first ArrowDown jumped to item 2.
      const motor = abrir();
      motor.pausa.mostrar(0);
      expect(document.querySelector('#vp-pause-0 .pm-sel')?.dataset.act, 'no cursor on open').toBe('resume');
      document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
      motor.pausa.esconder(0);
      motor.pausa.mostrar(0);
      expect(document.querySelector('#vp-pause-0 .pause-menu[data-sub="raiz"]').hidden, 'reopened inside the submenu').toBe(false);
      expect(document.querySelector('#vp-pause-0 .pm-sel')?.dataset.act).toBe('resume');
      motor.pausa.esconder(0);
    });

    it('🔴 [Right] a game that declares NOTHING still gets the six root items and the seven of the submenu, in order (ADR-0161)', () => {
      // The Dev found three items in the quiz and listed both menus in full. Order is literal, from his list.
      const motor = abrir();
      motor.pausa.mostrar(0);
      const lista = (sub) => [...document.querySelectorAll(`#vp-pause-0 .pause-menu[data-sub="${sub}"] .pm-btn`)]
        .filter((b) => !b.hidden).map((b) => b.dataset.act);
      expect(lista('raiz')).toEqual(['resume', 'ajuda', 'addplayer', 'options', 'opcoesdojogo', 'quit']);
      expect(lista('opcoes')).toEqual(['pmback', 'empatia', 'audio', 'som', 'motora', 'visual', 'anim']);
      // «Conforto auditivo (era Audio)» — the Dev's rename, on the item and on the panel it opens
      expect(document.querySelector('#vp-pause-0 .pm-btn[data-act="som"]').textContent).toContain('Conforto auditivo');
      motor.pausa.esconder(0);
    });

    it('🔴 [Right] a locked item SAYS WHY — reached by the cursor, and activated — and does nothing (ADR-0161)', async () => {
      const motor = abrir();
      motor.pausa.mostrar(0);
      const jogadores = document.querySelector('#vp-pause-0 .pm-btn[data-act="addplayer"]');
      expect(jogadores.getAttribute('aria-disabled'), '«Número de jogadores» is not locked in a game that does not act on it').toBe('true');
      // reached: the cursor stops on it, and the reason follows its name
      const regiao = document.getElementById('game-region') ?? document.body;
      const seta = () => regiao.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true, cancelable: true }));
      for (let i = 0; i < 6 && document.querySelector('#vp-pause-0 .pm-sel') !== jogadores; i++) seta();
      expect(document.querySelector('#vp-pause-0 .pm-sel'), 'the cursor skips the locked item').toBe(jogadores);
      await new Promise((r) => requestAnimationFrame(r)); // `srSay` writes on the next frame
      expect(document.querySelector('#sr-status')?.textContent, 'reaching it did not say the reason')
        .toContain('Quem decide quantos jogadores podem jogar é o jogo.');
      expect([...document.querySelectorAll('#game-region .barra-explicacao')].at(-1)?.textContent, 'the reason is not in the footer')
        .toBe('Quem decide quantos jogadores podem jogar é o jogo.');
      // activated: a locked DOOR does not open — «Opções do jogo» would switch to its (empty) list if the click passed
      const opcoes = document.querySelector('#vp-pause-0 .pm-btn[data-act="opcoesdojogo"]');
      expect(opcoes.getAttribute('aria-disabled')).toBe('true');
      opcoes.click();
      expect(document.querySelector('#vp-pause-0 .pause-menu[data-sub="raiz"]').hidden, 'the locked door opened').toBe(false);
      expect([...document.querySelectorAll('#game-region .barra-explicacao')].at(-1)?.textContent).toBe('Este jogo não tem opções próprias.');
      motor.pausa.esconder(0);
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

    it('🔴 [Zero] o PRINT SAIU da raiz (ADR-0151) — o item não está no cartão, nem escondido', () => {
      /*
       * ⚠️ ESTE CASO MEDIA O COMPORTAMENTO do print (esconder o cartão; qualquer tecla, depois de 80 ms, o traz
       * de volta), e a porta dele era o item da raiz. O Dev tirou-o de lá: «basta apertar SELECT que se tem a
       * visão apropriada pra print». O que o SELECT mostra para o print é pergunta em aberto no ADR-0151, e a
       * acção print da engine FICA no código à espera dessa resposta — sem porta, e por isso sem caso que a
       * exercite. Dito aqui para ninguém ler a ausência como cobertura.
       */
      const motor = abrir();
      motor.pausa.mostrar(0);
      expect(document.querySelector('#vp-pause-0 .pm-btn[data-act="print"]'), 'o print continua na raiz').toBeNull();
      expect(document.querySelector('#vp-pause-0 .pm-btn[data-act="quit"]'), 'o caso mediria um cartão vazio').not.toBeNull();
    });
    it('🔴 [Right] o jogo que escreve POR CIMA da barra é acusado, com o nó pelo nome', () => {
      /*
       * 🔴 O caso do Dev, no documento a sério. Medido no `dist/quiz.html`: `#title-icons` é absoluto DENTRO
       * do `#game-region` e o `H2.quiz-pergunta` ocupa os mesmos pixels. ⚠️ Nada falhava — sem erro, sem
       * tipo, sem consola —, e quem mais depende daqueles botões é quem não vê que eles estão tapados.
       *
       * 📌 TEM DE SER NO NAVEGADOR: o que se afirma é uma INTERSECÇÃO de rectângulos reais. Um duplo
       * devolveria o que o duplo quisesse, e a metade pura já está presa em `barra-a11y-e-hud.node`.
       */
      const regiao = raiz.querySelector('#game-region');
      regiao.style.position = 'relative';
      const titulo = document.createElement('h2');
      // ⚠️ Nome NEUTRO: o crivo `engine-boundary` reprova um fixture de engine que precise do vocabulário de
      // um género. O defeito foi medido num quiz, mas o que se afirma — um título por cima da barra — é de
      // qualquer jogo que desenhe um cabeçalho.
      titulo.className = 'titulo-da-atividade';
      titulo.textContent = 'Um título qualquer';
      titulo.style.cssText = 'position:absolute;left:0;top:0;width:400px;height:120px';
      regiao.appendChild(titulo);
      // A barra tem de estar DENTRO da região e a ocupar espaço, senão o caso mede a ausência dela.
      const barra = raiz.querySelector('#title-icons');
      regiao.appendChild(barra);
      barra.style.cssText = 'position:absolute;left:10px;top:10px;width:300px;height:44px';

      const motor = abrir({ host: { doc: document, win: window, a11yBarHost: barra } });

      const linha = motor.problems.filter((p) => /barra de acessibilidade/.test(p) && /por cima/.test(p));
      expect(linha, 'o jogo desenha por cima da barra e a engine cala-se').toHaveLength(1);
      expect(linha[0], 'a linha não nomeia o nó que invade — o consumidor fica a caçar').toMatch(/titulo-da-atividade/);
      expect(linha[0], 'a linha não diz por onde se conserta').toMatch(/--barra-a11y-h/);
    });

    it('🎯 [Zero] sem nada por cima, a engine NÃO acusa — e declara a faixa reservada', () => {
      // O par. Sem ele, um crivo que acusasse sempre passaria o caso acima sem provar nada.
      const motor = abrir();
      expect(motor.problems.filter((p) => /por cima da barra/.test(p)),
        'acusou sobreposição num jogo que não desenhou nada').toEqual([]);
      // 📌 E a faixa é DECLARADA onde o jogo a lê, ao lado do `--tap` e do `--alvo-min`.
      const regiao = document.querySelector('#game-region');
      expect(regiao.style.getPropertyValue('--barra-a11y-h'), 'a engine não disse que faixa reserva').toMatch(/^\d+px$/);
    });

    it('🔴 [Right] COM host de filtros, a engine acciona 🚥 sozinha — e 🌗 continua a ser do jogo', () => {
      /*
       * 📏 MEDIDO no `dist/quiz.html`: a barra servia sete ícones, três deles a dizer «em construção», e o 🚥
       * ficava de fora — com a engine a ter tudo à mão. `installCvdFilters` monta os seis `<filter>` e
       * `aplicarFiltroDeVisao` sabe pô-los no mundo; faltava ligá-los ao ícone.
       *
       * 🔴 E O PAR É O QUE IMPEDE ISTO DE SE TORNAR UMA PROMESSA A MAIS: o 🌗 NÃO aparece, porque
       * `setTemaDoJogador` não é um filtro — é um REPINTE de texturas (`render/textures`), e os níveis
       * `hc-direto-45`/`hc-direto-7` são os rácios 4,5:1 e 7:1 da WCAG. A engine não tem texturas, e
       * aproximá-lo com `filter: contrast()` seria anunciar um rácio que nada garante.
       */
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      raiz.appendChild(svg);
      abrir({ host: { doc: document, win: window, cvdHost: svg } });

      expect(document.querySelector('#title-icons [data-pi="cvd"]'),
        'a engine tem os filtros e o ícone de daltonismo continua a faltar').not.toBeNull();
      expect(document.querySelector('#title-icons [data-pi="contrast"]'),
        'o 🌗 apareceu, e a engine não sabe repintar as texturas de jogo nenhum').toBeNull();
    });

    it('🎯 [Right] carregar no 🚥 põe MESMO o filtro no mundo — não só anuncia', () => {
      // ⚠️ Sem isto o caso acima ficaria verde com um ícone inerte, que é o botão morto do §5 com outra roupa.
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      raiz.appendChild(svg);
      abrir({ host: { doc: document, win: window, cvdHost: svg } });
      const mundo = document.querySelector('#game-region');
      expect(mundo.style.filter, 'o mundo já nasceu com filtro').toBe('');

      document.querySelector('#title-icons [data-pi="cvd"]').click();

      // ⚠️ A asserção aceita aspas: o navegador normaliza `url(#x)` para `url("#x")` ao devolver o estilo, e a
      // primeira versão deste caso reprovou por causa disso — com o filtro JÁ aplicado. Medir o que o
      // navegador devolve, e não o que se escreveu.
      expect(mundo.style.filter, 'o ícone anunciou uma correcção que não aconteceu').toMatch(/url\(["']?#cvd-fix-/);
    });

    it('🔴 [Right] the contrast enhancement COMPOSES with the colour correction — one never switches the other off', async () => {
      // Two writers of one `style.filter`: written apart, the last one erased the first, and turning the enhancement on
      // would silently undo the correction a colour-blind child had chosen.
      const { setLq } = await import('../app/js/render/lq-filter.js');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      raiz.appendChild(svg);
      const motor = abrir({ host: { doc: document, win: window, cvdHost: svg } });
      const mundo = document.querySelector('#game-region');
      try {
        document.querySelector('#title-icons [data-pi="cvd"]').click();
        motor.pausa.mostrar(0);
        document.querySelector('#vp-pause-0 .pm-btn[data-act="visual"]').click();
        const passo = (d) => document.getElementById('opt-lq').dispatchEvent(new CustomEvent('passo', { detail: d }));
        passo(1);
        expect(mundo.style.filter, 'the enhancement erased the correction').toMatch(/cvd-fix-/);
        expect(mundo.style.filter, 'the enhancement is not on the world').toMatch(/lq-enh/);
        passo(-1);
        expect(mundo.style.filter, 'turning the enhancement off erased the correction').toMatch(/cvd-fix-/);
        expect(mundo.style.filter).not.toMatch(/lq-enh/);
      } finally {
        setLq(0);
        document.getElementById('visual-close')?.click();
        motor.pausa.esconder(0);
      }
    });

    it('🔴 [Right] the VISUAL panel offers the two rows the engine can drive — and none of a game it does not know', () => {
      const motor = abrir();
      motor.pausa.mostrar(0);
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="visual"]');
      expect(item.getAttribute('aria-disabled'), 'the visual item is still locked').toBeNull();
      item.click();
      expect(document.getElementById('visual').hidden, 'the panel did not open').toBe(false);
      expect(document.getElementById('opt-lq'), 'no contrast enhancement').not.toBeNull();
      const paleta = document.getElementById('opt-cbsafe');
      expect(paleta, 'no safe palette').not.toBeNull();
      // 🔴 the platformer's rows — item owners, and «lava, ladder, water, gate» — are not the engine's to offer
      expect(document.getElementById('opt-ownercolors')).toBeNull();
      expect(document.getElementById('opt-role-reset')).toBeNull();
      // the palette row does what it says: the menus and HUD switch palette
      const antes = document.documentElement.dataset.paleta;
      paleta.click();
      expect(document.documentElement.dataset.paleta, 'the safe palette did nothing').not.toBe(antes);
      document.getElementById('opt-cbsafe').click(); // back (the panel re-rendered the row)
      expect(document.documentElement.dataset.paleta).toBe(antes);
      document.getElementById('visual-close').click();
      motor.pausa.esconder(0);
    });

    it('🔴 [Boundary] o ciclo ANDA e LIMPA quando o jogo declara jogadores', () => {
      /*
       * 🔴 ESTE CASO NASCEU DE UMA MUTAÇÃO SOBREVIVENTE: «aplica sempre um filtro, nunca limpa» ficava verde,
       * porque o caso de cima carrega UMA vez. O ciclo tem quatro posições — tricromata, protan, deuter,
       * tritan — e a quarta volta ao início.
       *
       * ⚠️ E VOLTAR AO INÍCIO TEM DE LIMPAR DE FACTO. A criança que experimenta as três e decide que nenhuma
       * serve ficaria, sem isso, com a última por cima do jogo para sempre — e o ícone a anunciar «visão
       * tricromata». É o controle a mentir o estado na direcção mais cruel: ela mexeu para desfazer.
       *
       * 🔴 E O `players` AQUI É O CASO, não cenário. Sem ele o ciclo fica PRESO na primeira posição, porque
       * `initPauseIcons` recebe uma lista VAZIA (`create-game.ts`, nota do `getPlayers`) e o passo seguinte é
       * calculado a partir do estado do jogador. O defeito é dessa linha e não deste eixo; está nomeado lá,
       * medido, e o conserto é refactor de ordem de arranque.
       */
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      raiz.appendChild(svg);
      abrir({ host: { doc: document, win: window, cvdHost: svg }, players: [{ ctrl: {} }] });
      const mundo = document.querySelector('#game-region');
      const icone = document.querySelector('#title-icons [data-pi="cvd"]');

      const vistos = [];
      for (let n = 0; n < 4; n += 1) { icone.click(); vistos.push(mundo.style.filter); }

      expect(vistos.slice(0, 3).every((f) => /url\(["']?#cvd-fix-/.test(f)),
        `as três correcções não pintaram: ${JSON.stringify(vistos)}`).toBe(true);
      expect(new Set(vistos.slice(0, 3)).size, 'as três correcções pintaram o MESMO filtro').toBe(3);
      expect(vistos[3], 'a volta ao tricromata deixou a última correcção por cima do jogo').toBe('');
    });

    it('🔴 [Right] o `setCorrecaoDoJogador` do JOGO ganha ao padrão da engine', () => {
      // O padrão é piso, não tomada: um jogo que corrija a cor no seu próprio render — o `game-pinball`
      // fá-lo num framebuffer há semanas — entrega o seu e a engine sai da frente.
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      raiz.appendChild(svg);
      const vistas = [];
      abrir({
        host: { doc: document, win: window, cvdHost: svg },
        setCorrecaoDoJogador: (i, c) => vistas.push(c),
      });
      const mundo = document.querySelector('#game-region');

      document.querySelector('#title-icons [data-pi="cvd"]').click();

      expect(vistas.length, 'o padrão da engine atropelou o escritor do jogo').toBe(1);
      expect(mundo.style.filter, 'a engine pintou por cima de um jogo que já sabia corrigir').toBe('');
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
    motor.mount(declaracaoValida(), { acomodacoes: SEM_ASSUNTO });
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
    // ⚠️ ERA O ITEM `tipo`. Desde o ADR-0151 a tipografia não tem painel nem porta, e os casos que mediam a
    // MAQUINARIA dos painéis (o filtro do §5, o clique até ao foco, a cadeia do Escape, o cartucho que sobrepõe)
    // passaram a medi-la no painel de sensibilidade visual, que é da engine e continua na lista.
    const itemAnim = () => document.querySelector('#vp-pause-0 .pm-btn[data-act="anim"]');

    it('🎯 [Right] com ZERO campos opcionais, o painel de SENSIBILIDADE VISUAL está no documento e nasce escondido', () => {
      // O caso que carrega a etapa: nada de `getPauseActs`, nada de escritores. O jogo só chamou `createGame`.
      abrir();
      const painel = document.querySelector('#animation');
      expect(painel, 'a engine não montou painel nenhum — é o estado de antes').not.toBeNull();
      expect(painel.isConnected).toBe(true);
      expect(painel.hidden, 'um painel que nasce aberto é um painel que ninguém abriu').toBe(true);
      // Os ids que o `ui/settings-motion` exige e que ninguém declarava. O contrato agora é construído.
      for (const id of ['motion-list', 'animation-reset', 'animation-close']) {
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

    it('🔴 [Zero] SEM `preset` o item de ajuda fica TRAVADO — presente, e sem painel por trás (ADR-0161)', () => {
      // O par do caso acima. Sem as palavras do jogo a ajuda não se monta (ADR-0074); desde o ADR-0161 o item fica à
      // vista e travado com o motivo, em vez de sumir. Medir só a presença deixaria passar uma ajuda vazia.
      const motor = abrir();
      motor.pausa.mostrar(0);
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="ajuda"]');
      expect(item.hidden, 'the help item vanished — the card changes shape per game').toBe(false);
      expect(item.getAttribute('aria-disabled'), 'a ajuda acendeu sem o jogo declarar uma palavra sequer').toBe('true');
      expect(document.querySelector('#help'), 'o painel foi montado sem ter o que dizer').toBeNull();
    });

    it('🎯 [Right] o item `anim` SOBREVIVE ao filtro do §5 — a tabela da engine deixou de ser vazia', () => {
      // 📏 A cascata que produzia um cartão de um botão: sem `getPauseActs` a tabela é `{}`, `itensQueAccionam`
      // guarda só os três de `ITENS_DA_ENGINE`, e `raizQueAcciona` tira também o `options` porque seria «uma
      // porta para uma sala vazia». Com uma acção de verdade, a porta e a sala existem.
      const motor = abrir();
      motor.pausa.mostrar(0);
      expect(itemAnim(), 'o item de sensibilidade visual nem foi montado').not.toBeNull();
      expect(itemAnim().hidden, 'o item existe e está escondido: o filtro do §5 não o viu accionar').toBe(false);
      const porta = document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]');
      expect(porta.hidden, 'a porta de opções continua fechada sobre uma sala que agora tem gente').toBe(false);
    });

    it('🎯 [Right] UM CLIQUE DE VERDADE no item abre o painel, com as fontes desenhadas e o foco dentro', () => {
      // O caminho inteiro: botão da pausa -> despacho de `ui/pause-icons` -> tabela da engine -> `abrir()` ->
      // `render()` do painel. Nenhum duplo percorre isto; e é o percurso que a criança faz.
      const motor = abrir();
      motor.pausa.mostrar(0);
      itemAnim().click();

      const painel = document.querySelector('#animation');
      expect(painel.hidden, 'o clique não revelou o painel').toBe(false);
      const linhas = painel.querySelectorAll('#motion-list button');
      expect(linhas.length, 'o painel abriu VAZIO — é o achado 6, outra vez').toBeGreaterThan(0);
      expect(painel.querySelector('.overlay__card').contains(document.activeElement),
        'o foco ficou FORA de um diálogo `aria-modal`').toBe(true);
    });

    it('⚠️ [Right] o painel ENTRA na cadeia do Escape — o registo estava vazio sob o `createGame`', () => {
      const motor = abrir();
      motor.pausa.mostrar(0);
      expect(motor.overlays.escapeTarget(), 'com tudo fechado a cadeia não tem alvo').toBeNull();
      itemAnim().click();
      expect(motor.overlays.escapeTarget(), 'o painel abriu e nenhuma tecla o fecha — a armadilha do ADR-0044 §2')
        .toBe('animation');
    });

    it('⚠️ [Right] o CARTUCHO sobrepõe a acção da engine — não-declinável é a pausa, não cada item dela', () => {
      // ADR-0122 torna não-declinável a pausa EXISTIR; não faz da engine dona de cada item dentro dela. Um
      // jogo que já tenha o seu painel de sensibilidade visual continua a ser quem responde pelo item.
      let meu = 0;
      const motor = abrir({ getPauseActs: () => ({ anim: () => { meu += 1; } }) });
      motor.pausa.mostrar(0);
      itemAnim().click();
      expect(meu, 'a engine ganhou ao jogo na própria mesa dele').toBe(1);
      expect(document.querySelector('#animation').hidden,
        'abriu o painel da engine por cima do jogo — dois painéis para o mesmo ajuste').toBe(true);
    });

    it('🔴 [Zero] os painéis de COMUNICAÇÃO e de TIPOGRAFIA não são montados, nem têm porta (ADR-0151)', () => {
      // ⚠️ ESTES CASOS MEDIAM O PAINEL DE CAA (a caixa da letra, o dono do fechar, a cadeia do Escape) pela porta
      // «Comunicação». O Dev tirou-a das configurações de inclusão: a caixa da letra anda no ciclo do 11.º botão.
      // Um painel sem porta seria um diálogo no documento que ninguém alcança, e por isso a engine deixou de o
      // montar — os casos do comportamento dele saíram com a montagem, e o módulo tem os seus em
      // `settings-caa.browser.test.js`.
      const motor = abrir();
      motor.pausa.mostrar(0);
      expect(document.querySelector('#caa'), 'o painel de CAA continua montado sem porta').toBeNull();
      expect(document.querySelector('#vp-pause-0 .pm-btn[data-act="caa"]'), 'a porta «Comunicação» continua').toBeNull();
      expect(document.querySelector('#vp-pause-0 .pm-btn[data-act="tipo"]'), 'a porta «Tipografia» continua').toBeNull();
      // ⚠️ E OS DOIS CASOS QUE SÓ A TIPOGRAFIA TINHA — a amostra e o repor — saíram com a casca dela; o módulo
      // `ui/settings-typo` guarda os seus em `settings-typo.browser.test.js`.
      expect(document.querySelector('#typo'), 'o painel de tipografia continua no documento sem porta').toBeNull();
    });

    it('🔴 [Right] sem o painel, o ESCRITOR da tipografia continua vivo — o 11.º botão ainda troca a face', () => {
      // 📌 O par do caso de cima, e a razão de o `initSettingsTypo` continuar a correr: tirar a casca não pode
      // levar a escrita. Sem este caso, um `createGame` que deixasse de iniciar o módulo passaria em tudo.
      abrir();
      const botao = document.querySelector('#title-icons [data-pi="tipografia"]');
      expect(botao, 'o 11.º botão não montou — o caso mediria nada').not.toBeNull();
      const antes = document.documentElement.dataset.fonte;
      botao.click();
      expect(document.documentElement.dataset.fonte, 'o ciclo carregou e a face do documento não mudou').not.toBe(antes);
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
      expect(document.querySelector('#tts-vol').type, 'o volume da narração não é um cursor').toBe('range');
      // e a lista da navegação sonora foi PREENCHIDA pelo painel: um grupo vazio é o achado 6 outra vez
      expect([...document.querySelectorAll('#navsound-list [data-acat]')].map((b) => b.dataset.acat),
        'o painel abriu sem sonar, guarda e guia').toEqual(['sonar', 'guard', 'guide']);
      // 🔴 O QUE O ADR-0151 TIROU DESTE PAINEL, afirmado AUSENTE dentro dele
      const painel = document.querySelector('#audio');
      for (const sel of ['#audio-master', '#audio-master-vol', '#navsound-master', '[data-acat="music"]']) {
        expect(painel.querySelector(sel), `${sel} continua na acessibilidade auditiva`).toBeNull();
      }

      // ⚠️ E OS CONTROLES ESTÁTICOS ESTÃO LIGADOS — a regra de ordem, medida no que ela produz.
      // `initSettingsAudio` liga-os UMA VEZ, no arranque; com o interior montado DEPOIS, ficariam botões no
      // documento e sem escuta nenhuma. Sem este pedaço a mutação da ordem sobrevivia.
      const indice = document.querySelector('#opt-menuindex');
      const antes = indice.getAttribute('aria-pressed');
      indice.click();
      expect(document.querySelector('#opt-menuindex').getAttribute('aria-pressed'),
        'o clique no índice falado não fez nada — o interior montou DEPOIS do `init`').not.toBe(antes);
      indice.click(); // devolve: o índice é estado de módulo
    });

    it('🎯 [Right] o painel ÁUDIO abre pelo submenu, com o SOM GERAL e as quatro categorias de gosto (ADR-0151)', () => {
      const motor = abrir();
      motor.pausa.mostrar(0);
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="som"]');
      expect(item, 'o item «Áudio» nem foi montado').not.toBeNull();
      expect(item.hidden, 'o item «Áudio» está escondido: a engine não o acciona').toBe(false);
      item.click();
      expect(document.querySelector('#som').hidden, 'o clique não revelou o painel Áudio').toBe(false);
      expect([...document.querySelectorAll('#som #audio-list [data-acat]')].map((b) => b.dataset.acat),
        'as categorias de gosto não são as quatro — ou `other` voltou').toEqual(['music', 'ambient', 'interact', 'earcons']);
      // «toggle + barra para som geral voltam» — e LIGADOS antes do `init`, pela mesma regra de ordem
      expect(document.querySelector('#som #audio-master-vol')?.type, 'o volume geral não voltou').toBe('range');
      const mestre = document.querySelector('#som #audio-master');
      const antesDoSom = mestre.getAttribute('aria-pressed');
      mestre.click();
      expect(document.querySelector('#audio-master').getAttribute('aria-pressed'),
        'o clique no som geral não fez nada — o painel montou DEPOIS do `init`').not.toBe(antesDoSom);
      mestre.click();
    });

    it('🔴 [Right] EVERY panel of the submenu opens on «Voltar», item 1, and ends on its reset — no close after the rows (ADR-0158)', () => {
      // 📏 Measured in dist before this case: the hearing panel appended its rows AFTER the actions, so the reset sat
      // between «Voltar» and the first row. The shell alone cannot promise the order; the interiors can break it.
      const motor = abrir();
      for (const [act, id] of [['anim', 'animation'], ['audio', 'audio'], ['som', 'som'], ['motora', 'motora'], ['visual', 'visual']]) {
        motor.pausa.mostrar(0);
        const item = document.querySelector(`#vp-pause-0 .pm-btn[data-act="${act}"]`);
        expect(item?.hidden, `the «${act}» item is not live — the case would skip it`).toBe(false);
        item.click();
        const card = document.querySelector(`#${id} .overlay__card`);
        expect(card, `#${id} did not open`).not.toBeNull();
        const botoes = [...card.querySelectorAll('button')].filter((b) => !b.closest('.opt-explain'));
        expect(botoes[0]?.id, `#${id}: «Voltar» is not item 1`).toBe(`${id}-close`);
        expect(botoes.at(-1)?.id, `#${id}: something comes after the reset`).toBe(`${id}-reset`);
        expect(document.activeElement?.id, `#${id} opened with the cursor away from «Voltar»`).toBe(`${id}-close`);
        document.getElementById(`${id}-close`).click();
      }
    });

    it('🔴 [Zero] NO row of an engine panel carries an explanation in parentheses — it belongs to the footer (ADR-0158)', () => {
      // The Dev: «Você está colocando entre parênteses informações que deveriam ir para o rodapé.» Read as the child
      // sees it: after the panel's own render and `fillExplain`, the text left INSIDE each visible row, hints excluded
      // (a hint is in the footer by then, or hidden until it moves there).
      const motor = abrir();
      const achados = [];
      for (const [act, id] of [['anim', 'animation'], ['audio', 'audio'], ['som', 'som'], ['motora', 'motora'], ['visual', 'visual']]) {
        motor.pausa.mostrar(0);
        document.querySelector(`#vp-pause-0 .pm-btn[data-act="${act}"]`).click();
        for (const linha of document.querySelectorAll(`#${id} .ctrl-row`)) {
          if (!linha.offsetParent) continue;
          const copia = linha.cloneNode(true);
          copia.querySelectorAll('.opt-hint').forEach((h) => h.remove());
          const texto = copia.textContent.replace(/\s+/g, ' ').trim();
          if (/\(/.test(texto)) achados.push(`#${id}: «${texto}»`);
        }
        document.getElementById(`${id}-close`).click();
      }
      expect(achados, achados.join(' · ')).toEqual([]);
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
      // (Era `#typo`; a tipografia deixou de ter painel no ADR-0151 — o de sensibilidade visual mede o mesmo.)
      expect(fora.querySelector('#animation'), 'acusou e não montou — pior do que montar e calar').not.toBeNull();
    });

    it('🎯 [Zero] DOIS cartuchos em sequência deixam UM de cada — o terceiro gate do ADR-0139', () => {
      // ⚠️ O gate existia como frase e não como contagem, e até hoje ele não tinha o que contar: a engine
      // montava a barra e o cartão, e mais nada. Com quatro painéis montados, «uma barra» passou a ser
      // «uma barra, um cartão e quatro painéis» — e um `mount()` que um dia passasse a remontá-los deixaria
      // dois de cada, com o segundo a roubar os ids do primeiro.
      const motor = abrir();
      motor.mount(declaracaoValida(), { acomodacoes: SEM_ASSUNTO });
      motor.mount(declaracaoValida(), { acomodacoes: SEM_ASSUNTO });

      expect(document.querySelectorAll('#title-icons').length).toBe(1);
      expect(document.querySelectorAll('[id^="vp-pause-"]').length, 'sobrou mais de um cartão de pausa').toBe(1);
      for (const id of ['animation', 'audio']) {
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
      for (const id of ['animation', 'audio']) {
        expect(document.getElementById(id), `#${id} saiu com o cartucho`).not.toBeNull();
      }
      // e o que sobra ainda ABRE: um painel que fica no documento e deixa de responder é pior do que um que sai
      motor.pausa.mostrar(0);
      // Desde o ADR-0151 a tipografia não tem porta: o painel que ABRE a medir é o de acessibilidade auditiva.
      document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
      expect(document.querySelector('#audio').hidden, 'o painel sobreviveu ao `unmount` e deixou de abrir')
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
//  14. (2026-09-12, ADR-0158) the hearing panel's rows appended AFTER the actions again -> the «Voltar first» case
//      is red: the reset sits between «Voltar» and the first row again, as measured in dist.
//      ⚠️ The twin in the «Áudio» interior (its list appended after the actions) SURVIVES: under the shell the list
//      is already a child of the card, so that line only runs for a card without the shell.
