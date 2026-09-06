// SPDX-License-Identifier: AGPL-3.0-or-later
// A FRONTEIRA ENGINE ↔ JOGO, como TESTE (ADR-0027, passo 4). Project node: só lê arquivos.
//
// O ADR-0027 traz uma heurística e a chama de decisiva:
//
//   "Um teste de um módulo de ENGINE cujo fixture precisa de uma MOEDA é prova de que o corte não pegou. Não
//    dá para ver isso lendo o módulo — só lendo o teste dele."
//
// E põe o passo 4 como o veredito: "se `createGame()` não puder ser escrito sem um parâmetro chamado
// `coinTarget`, a fronteira que este registro propõe está errada e os passos 5 a 7 NÃO PODEM COMEÇAR."
//
// Isto aqui é essa heurística virando gate. Enquanto era prosa num documento, ela dependia de alguém lembrar
// de aplicá-la; e um documento não reprova ninguém. Agora reprova.
//
// A FORMA É UMA LISTA QUE SÓ PODE ENCOLHER. Um teste que simplesmente falhasse seria apagado ou afrouxado na
// primeira pressa. Uma lista de dívida conhecida faz três coisas de uma vez: deixa a suíte verde hoje, torna a
// dívida CONTÁVEL, e faz qualquer aresta NOVA falhar na hora. Quem consertar uma linha apaga a linha; quem
// criar uma, descobre no mesmo minuto.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'app', 'js');
// `boot` entrou em 2026-08-25 com o `createGame()` (item 13). É camada de ENGINE e por isso é varrida como
// as outras: uma raiz de composição que importasse de `game/` levaria o jogo inteiro dentro do pacote, que é
// precisamente o que ela existe para não fazer.
const CAMADAS_ENGINE = ['core', 'input', 'render', 'platform', 'ui', 'audio', 'boot'];

function modulosDe(camada) {
  const dir = join(RAIZ, camada);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => `${camada}/${f}`);
}
const MODULOS = CAMADAS_ENGINE.flatMap(modulosDe);
// NORMALIZA A QUEBRA DE LINHA ao ler, e isso nao e higiene: sem ela este arquivo ja mentiu uma vez. Com CRLF
// cada linha termina em CR, e CR e TERMINADOR DE LINHA para uma regex — o ponto nao o alcanca, entao o ancora
// de fim em /\/\/.*$/ nunca chegava e o removedor de comentarios NAO REMOVIA NADA. O teste entao acusava dois
// comentarios de fim de linha em core/layers como se fossem dependencia. Um filtro que falha ABERTO e pior que
// filtro nenhum: ele produz uma lista de divida falsa, e quem for conserta-la nao acha o que consertar.
const CR = String.fromCharCode(13);
const fonte = (m) => readFileSync(join(RAIZ, ...m.split('/')), 'utf8').split(CR).join('');

/** Linhas de CÓDIGO: sem comentário de bloco, de linha, nem de fim de linha. Prosa não é dependência —
 *  "moedas no chão" dentro do anúncio do Modo Fácil descreve o jogo, não amarra o módulo a ele. */
function linhasDeCodigo(texto) {
  const out = [];
  let bloco = false;
  texto.split('\n').forEach((ln, i) => {
    const t = ln.trim();
    if (bloco) { if (t.includes('*/')) bloco = false; return; }
    if (t.startsWith('/*')) { if (!t.includes('*/')) bloco = true; return; }
    if (t.startsWith('//') || t.startsWith('*')) return;
    out.push([i + 1, ln.replace(/\/\/.*$/, '')]);
  });
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// 1. ARESTAS DE IMPORTAÇÃO — a evidência mais dura, porque não é um nome: é uma dependência que o compilador
//    segue. Um módulo de engine que importa de `game/` não pode ser empacotado sem levar o jogo junto.
// ---------------------------------------------------------------------------------------------------------

/** Dívida CONHECIDA em 2026-08-25. Esta lista só encolhe. Cada linha é uma issue esperando. */
const IMPORTS_CONHECIDOS = {
  // `game/player.js` SAIU (2026-08-25): era só `BOX`, a caixa de colisão, e três módulos de engine
  // (`render/scene-city`, `render/scene-sky`, `platform/audio-nav`) já a recebiam por injeção — o `draw` era
  // o único da camada de render ainda importando-a do jogo. Não foi política nova, foi alinhar o retardatário.
  // `render/draw.ts` SAIU (2026-08-25, item 19), e com ele a lista inteira ESVAZIOU — ver o caso do contador
  // logo abaixo. Eram `game/powerups` (o predicado `puTaken`) e `game/coin-spawning` (`getCoinSprites`), e o
  // que atravessou não foram as funções: foram TRÊS REGRAS do jogo que moravam no desenho — item coletado
  // some, item de outro dono fica esmaecido, e a chave vale para todos enquanto os demais poderes são por
  // jogador. As três entraram por ctx, e o desenho ficou com o que é dele: o cintilar.
  //
  // O `import type { Powerup }` saiu junto, e vale dizer por quê: tipo apagado em compilação não entra no
  // pacote, mas obriga o arquivo a existir para o `tsc` e obriga qualquer jogo a ter um power-up com aquela
  // forma. O desenho toca `sprite` e mais nada.
  // `render/textures.ts` SAIU DAQUI (2026-08-25): importava `SOMASUB_SHAPES` por causa de UMA linha do
  // `initTextures`, e agora recebe os ids das formas pelo ctx. A aresta era pequena e o efeito não: era
  // também a única razão de `render/viz-setters` arrastar `game/` por transitividade — duas de quatro.
  // `ui/activities-menu.ts` SAIU (2026-08-25, ADR-0032): o catálogo de atividades era CURRÍCULO arquivado
  // em `game/`, e foi para `educational/`. A aresta morreu por MUDANÇA DE ENDEREÇO, não por conserto — e é
  // por isso que ela reaparece logo abaixo, na sua lista própria. Contar isto como fronteira resolvida seria
  // a forma mais barata de o gate mentir: o menu continua conhecendo UM catálogo.
};

/** Dívida de CURRÍCULO — a aresta que nasceu quando a de `game/` morreu (ADR-0032). Mesma regra: só encolhe.
 *
 *  Uma engine que importa currículo está menos errada do que uma que importa o jogo — o currículo é o mesmo
 *  em qualquer jogo que ensine a mesma coisa, e o `educational/` viaja com a plataforma, não com este título.
 *  Menos errada não é certa: o menu ainda sabe o nome de um catálogo. O conserto final é a EdSP entregá-lo por
 *  injeção, e enquanto ela não existe esta lista é o lugar onde a dívida fica CONTÁVEL em vez de invisível. */
const IMPORTS_CURRICULO = {
  'ui/activities-menu.ts': ['educational/activities-registry.js'],
};

function importsDeJogo(m) {
  return [...fonte(m).matchAll(/from '\.\.\/(game\/[\w.-]+)'/g)].map((x) => x[1]);
}

describe('fronteira engine↔jogo — arestas de importação (ADR-0027 passo 4)', () => {
  it('[Right] NENHUM módulo de engine importa de game/ além da dívida conhecida', () => {
    const novas = {};
    for (const m of MODULOS) {
      const extras = importsDeJogo(m).filter((i) => !(IMPORTS_CONHECIDOS[m] || []).includes(i));
      if (extras.length) novas[m] = extras;
    }
    expect(novas, 'aresta NOVA de engine para game/ — some com ela ou registre o porquê').toEqual({});
  });

  it('[Interface] a dívida conhecida ainda EXISTE — linha consertada é linha apagada daqui', () => {
    // Sem este caso a lista viraria um cemitério: entradas de arestas que já sumiram continuariam permitindo
    // que elas voltassem, e ninguém saberia que o teste tinha parado de proteger aquele arquivo.
    for (const [m, esperados] of Object.entries(IMPORTS_CONHECIDOS)) {
      const atuais = importsDeJogo(m);
      for (const e of esperados) {
        expect(atuais, `${m}: '${e}' não existe mais — apague-o de IMPORTS_CONHECIDOS`).toContain(e);
      }
    }
  });

  it('[Zero] NENHUM módulo de engine importa de game/ — a lista esvaziou em 2026-08-25', () => {
    // O número que este caso guarda foi TRÊS, depois dois, depois um, e agora é zero. Vale dizer o que isso
    // significa e o que NÃO significa.
    //
    // SIGNIFICA que a camada de engine não arrasta o jogo pelo compilador: nenhum dos 89 módulos precisa que
    // `game/` exista para ser empacotado. É a pergunta literal do passo 4 do ADR-0027, e a resposta virou sim.
    //
    // NÃO SIGNIFICA que a fronteira está pronta. Sobra VOCABULÁRIO — nove módulos ainda dizem `quiz` ou
    // `coin` no código, e o maior deles (`input/keydown`) carrega a grade do desafio deste jogo. Nome não é
    // seguido pelo compilador e não impede um pacote de se separar; por isso é dívida menor, e por isso ela
    // continua contada na seção 2 em vez de sumir junto.
    //
    // A lista fica AQUI, vazia, e não é apagada: ela é o lugar onde a próxima aresta terá de se declarar, e
    // uma lista ausente convida a acrescentar o import sem pensar duas vezes.
    expect(Object.keys(IMPORTS_CONHECIDOS)).toHaveLength(0);
  });
});

describe('fronteira engine↔currículo — a aresta que a mudança de endereço criou (ADR-0032)', () => {
  const importsDeCurriculo = (m) =>
    [...fonte(m).matchAll(/from '\.\.\/(educational\/[\w.-]+)'/g)].map((x) => x[1]);

  it('[Right] NENHUM módulo de engine importa de educational/ além da dívida conhecida', () => {
    const novas = {};
    for (const m of MODULOS) {
      const extras = importsDeCurriculo(m).filter((i) => !(IMPORTS_CURRICULO[m] || []).includes(i));
      if (extras.length) novas[m] = extras;
    }
    expect(novas, 'aresta NOVA de engine para educational/ — o currículo é da plataforma, não da engine').toEqual({});
  });

  it('[Interface] a dívida de currículo ainda EXISTE — linha consertada é linha apagada daqui', () => {
    for (const [m, esperados] of Object.entries(IMPORTS_CURRICULO)) {
      const atuais = importsDeCurriculo(m);
      for (const e of esperados) {
        expect(atuais, `${m}: '${e}' não existe mais — apague-o de IMPORTS_CURRICULO`).toContain(e);
      }
    }
  });

  it('[Boundary] o currículo NÃO importa da engine nem do jogo — é DADO, e dado não chama ninguém', () => {
    // A metade do ADR-0032 que o endereço sozinho não garante. Um catálogo que importasse `core/` ou `game/`
    // não caberia na EdSP sem levar este título junto — que é exatamente o defeito que a mudança consertou.
    const dir = join(RAIZ, 'educational');
    const arquivos = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.ts')) : [];
    expect(arquivos.length, 'a camada de currículo sumiu — se foi de propósito, apague este caso').toBeGreaterThan(0);
    for (const f of arquivos) {
      const alheias = linhasDeCodigo(fonte(`educational/${f}`))
        .filter(([, ln]) => /from '\.\.\//.test(ln))
        .map(([n, ln]) => `${f}:${n} ${ln.trim()}`);
      expect(alheias, 'currículo importando de fora de si — ver ADR-0032').toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
// 2. O NOME QUE O ADR ESCOLHEU. `coinTarget` é o exemplo do registro, e ele existe: `ui/hud.vphudHtml` recebe
//    um alvo de moedas. Um jogo sem moedas não tem o que passar ali, e o HUD é engine.
// ---------------------------------------------------------------------------------------------------------

// ⚠️ ESTE CASADOR ERA MAIS ESTREITO QUE O DOS FIXTURES, E O GATE FALHAVA ABERTO.
//
// Ele nao tinha `coinTex`, nem `coinCanvas`, nem `quiz`. O casador da secao 3 tem os tres, e o comentario
// de la ate registra a licao: "eu tinha esquecido `coinCanvas` no casador... o gate reprovou e estava
// certo". A licao foi aplicada LA e nunca voltou para ca, e as duas secoes ficaram medindo coisas
// diferentes com o mesmo nome.
//
// O preco, MEDIDO ao unificar: OITO modulos de engine carregavam vocabulario que este gate nao via, sete
// deles fora da lista de divida. `input/keydown` com oito linhas de `quiz`, `render/props` com
// `coinCanvas`, `ui/pause-icons` com `quizLevel`. E a assimetria explicava um misterio da secao 3: a
// divida de FIXTURE tinha `keydown`, `gamepad`, `touch` e `pause-icons` enquanto os MODULOS deles
// pareciam limpos. Nao eram.
//
// Um gate mais fraco que o teste que ele deveria proteger e pior que gate nenhum: ele da por resolvida uma
// fronteira que ninguem mediu. Agora e UM casador so, usado nas duas secoes, e drift vira impossivel.
// (`VOCAB_JOGO` e declarado na secao 2 - e o MESMO casador, e agora so existe um.)
const VOCAB_JOGO = /\b(coin|coins|coinTarget|coinTex\w*|coinCanvas\w*|moeda|moedas|quiz|quizLevel|quizlevel)\b/i;
const MOEDA = VOCAB_JOGO;

/** Dívida CONHECIDA de VOCABULÁRIO em 2026-08-25 — só encolhe, mesma regra. */
const MOEDA_CONHECIDA = new Set([
  // `ui/hud.ts` SAIU (2026-08-25, item 19). Era o caso do ADR ao pé da letra, e saiu em dois tempos: o passo
  // 4 matou a DEPENDÊNCIA (`coinTarget` virou parâmetro obrigatório) e este item matou o ASSUNTO — o contador
  // recebe um `Objective` (campo 5 do contrato) e o ícone entra por injeção. O módulo não tem mais linha de
  // código que fale de moeda, e a lista não guarda quem já se limpou.
  // `platform/audio-nav.ts` SAIU (2026-08-25, item 19). Era "o sonar aponta para a `Coin` mais próxima; o
  // PROPÓSITO é engine, o TIPO é do jogo" — e a saída não foi uma renomeação: o módulo VIROU DOIS. A
  // navegação sonora está em `platform/audio-sonar` e recebe o contrato (topologia, alvos, nome); aqui
  // ficaram a bengala e o nado cego, que leem tile e chão porque é isso que eles são.
  // `core/state.ts` SAIU (2026-08-25, item 19). Eram `coins: unknown[]` e `quizLevel`, e o `unknown` era o
  // SINTOMA e não a solução: um estado que não consegue declarar o próprio tipo está na camada errada. Os
  // dois foram para `game/state`, com a mesma forma (binding vivo + setter que persiste e emite) e pelos
  // mesmos canais — `emit` passou a ser exportado justamente para que o barramento continue sendo UM.
  //
  // `ui/pause-icons` saiu junto, e por injeção: ele importava `quizLevel` para desenhar o rótulo do nível.
  // O nome do nível (`qlName`) já vinha do jogo; faltava o número vir pelo mesmo caminho.
  // `platform/audio.ts` SAIU (2026-08-25, item 19). O gate acusava UMA linha — a do `coin` — e ela era a
  // menos interessante das dez: `key`, `gate`, `power` são objetos deste mundo e `correct`, `wrong`, `place`
  // são eventos da atividade. Tirar só a linha acusada teria deixado o gate verde com o problema no lugar.
  // A tabela inteira foi para `game/earcons`; a SÍNTESE (oscilador, envelope, ruído, roteamento) ficou.
  // `ui/settings-motion.ts` SAIU (2026-08-25): a única menção era o rótulo 'Animação de itens (moedas)', que
  // foi para o dicionário no item 14. Ganho lateral da i18n — texto que sai do código sai também da fronteira.
  // `ui/settings-motor.ts` SAIU (2026-08-25): a única menção era 'moedas no chão', dentro do anúncio do Modo
  // Fácil, que foi para o dicionário no item 14. Segundo módulo que a i18n tira daqui de carona.
  'platform/audio-mixer.ts', // rótulos/anúncios, não dependência
  // ---- OITO MÓDULOS que só ficaram VISÍVEIS quando o casador foi unificado (2026-08-25). A dívida deles é
  //      antiga; o que era novo é o gate conseguir vê-la. A maioria já tinha o par dela na lista de FIXTURES
  //      abaixo — a correspondência que a seção 3 afirma só passou a ser verdadeira agora.
  // `input/keydown.ts` e `input/gamepad.ts` SAÍRAM (2026-08-25, ADR-0033), e `core/entity.ts` com eles — os
  // três eram o MESMO campo. Não foi renomeação: a engine parou de rotear a tecla para dentro do desafio e
  // passou a entregar uma INTENÇÃO (`left`/`right`/`up`/`down`/`confirm`/`erase`), com a grade de três
  // colunas e o caso do Braille indo para `game/quiz`, de quem sempre foram. Sem precisar do significado, a
  // entrada também deixou de precisar do objeto: a pergunta virou `modalOpen[i]`, um booleano no snapshot
  // que o módulo já montava.
  // `input/touch.ts` SAIU (2026-08-25, item 19) — na mesma rodada em que ENTRAU nesta lista, porque foi a
  // unificação do casador que o revelou. Era `PlayerView<'quiz'>` a serviço de UMA linha, que lia `numPlayers`,
  // `phase` e `players[].quiz` por importação de `core/state`. Virou `ctx.padAllowed()`: injeta-se o BOOLEANO,
  // não o estado — o mesmo movimento do achado 10. O módulo deixou de importar `core/state`.
  // `render/props.ts` SAIU (2026-08-25, item 19) — por MUDANÇA DE ENDEREÇO, e vale dizer com todas as letras
  // porque as duas saídas se parecem no gate e não se parecem em nada mais. O código é o mesmo, byte por
  // byte: uma moeda de 11×11, uma árvore de rua e sete ícones de poder. Nada disso é de engine, e o módulo
  // foi para `game/props`. O que a mudança REALMENTE consertou está do outro lado: `render/textures`
  // importava `powerupCanvas` de lá e trazia `PUP_KINDS` cravado, e essa era a única aresta que a mudança de
  // pasta teria criado — some por INJEÇÃO (`ctx.powerups`), como `shapes` já fazia.
  /**
   * `platform/storage.ts` FICA, e o motivo é o contrário de dívida — vale escrever para ninguém "limpar".
   *
   * A entrada é `quizlevel: kJogo('quizlevel')`, e `kJogo()` é exatamente o mecanismo da engine para chaves
   * de ESCOPO DE JOGO (ADR-0028, dois escopos). `activity`, `cenario`, `tabsel` e `fracnot` moram no mesmo
   * registro pelo mesmo motivo e ninguém as acusa — elas só não contêm nenhuma palavra do casador.
   *
   * Ou seja: esta linha é o casador notando uma PALAVRA, não a fronteira notando um vazamento. Tirá-la
   * daqui deixando as outras quatro seria enganar o gate, que é o oposto do que ele existe para fazer.
   */
  'platform/storage.ts',
  // `render/viz-setters.ts` SAIU (2026-08-25, item 19). Era `spriteTexFor('coin', mode)` — o cache já não
  // tinha forma de moeda (chaveia por `(id, modo)`), e quem ainda nomeava uma era este módulo. O id virou
  // `ctx.itemTexId`, declarado pelo jogo. O vizinho de baixo mostra que essa sempre foi a forma certa: os
  // power-ups carregam o próprio `kind` desde sempre, e a engine só o repassa.
]);

describe('fronteira engine↔jogo — o vocabulário do ADR', () => {
  it('[Right] nenhum módulo de engine NOVO passa a falar de moeda no código', () => {
    // A falha CITA a linha. Um teste de fronteira que só diz "este arquivo" manda a pessoa procurar o que ela
    // já procuraria — e a linha costuma ser um comentário de fim de linha, ou seja, um falso positivo que
    // custaria dez minutos para ser reconhecido como tal.
    const novos = MODULOS.filter((m) => !MOEDA_CONHECIDA.has(m))
      .flatMap((m) => linhasDeCodigo(fonte(m)).filter(([, ln]) => MOEDA.test(ln)).map(([n, ln]) => `${m}:${n}  ${ln.trim()}`));
    expect(novos, 'módulo de engine falando de moeda — o corte não pegou aqui').toEqual([]);
  });

  it('[Right] `ui/hud` não conhece a constante do jogo NEM o assunto dele — os dois tempos do conserto', () => {
    // Este caso já foi o contrário. Enquanto `vphudHtml(coinTarget = COIN_TARGET)` existia, o ADR-0027 dizia
    // que a fronteira estava errada e o passo 5 não podia começar.
    //
    // O primeiro tempo matou a DEPENDÊNCIA: o alvo virou parâmetro obrigatório, injetado como `powerShort` já
    // era. Sobrou VOCABULÁRIO — o ícone cravado, a classe `vphud-coins`, o campo `coins` do view-model —, que
    // é dívida menor porque nome não é seguido pelo compilador e não impede um pacote de se separar.
    //
    // O segundo tempo (item 19) matou o ASSUNTO: entra um `Objective` inteiro, o ícone é injetado, e o HUD
    // deixou até de ler `collected` do jogador. Três asserções, uma por camada da mudança.
    expect(fonte('ui/hud.ts'), 'a dependência').not.toMatch(/from '\.\.\/core\/constants\.js'/);
    expect(fonte('ui/hud.ts'), 'o assunto').toMatch(/vphudHtml\(objetivo: Objective, icone: string\)/);
    // Contra as LINHAS DE CÓDIGO, e não contra o arquivo: a prosa deste módulo explica que `collected` saiu,
    // e um crivo que confundisse a explicação com o uso reprovaria justamente quem documentou o conserto. É a
    // mesma armadilha que o `getPhase` já tinha armado uma vez.
    const usaCollected = linhasDeCodigo(fonte('ui/hud.ts')).some(([, ln]) => /collected/.test(ln));
    expect(usaCollected, 'o progresso vinha do jogador e agora vem do objetivo').toBe(false);
  });

  it('[Zero] a lista de dívida de vocabulário não guarda módulo que já se limpou', () => {
    for (const m of MOEDA_CONHECIDA) {
      const sujo = linhasDeCodigo(fonte(m)).some(([, ln]) => MOEDA.test(ln));
      expect(sujo, `${m} já não fala de moeda — apague-o de MOEDA_CONHECIDA`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
// 3. OS FIXTURES DOS TESTES — a prova que o ADR-0027 chama de decisiva, e a única que faltava aqui.
//
//    "Um teste de um módulo de ENGINE cujo fixture precisa de uma MOEDA é prova de que o corte não pegou.
//     Não dá para ver isso lendo o módulo — só lendo o teste dele."
//
//    As duas seções acima leem MÓDULOS. Esta lê TESTES, e a diferença não é simetria: um módulo pode parecer
//    genérico e só se revelar acoplado quando alguém tenta montar o ctx dele. Foi assim que o segundo
//    consumidor (`consumer-quiz`) descobriu que o sonar pede `getCoins` — não lendo `platform/audio-nav`, mas
//    tentando usá-lo. O fixture é onde a exigência aparece escrita.
//
//    A REGRA É ESTREITA DE PROPÓSITO: só MOEDA e QUIZ. Não entra "cenário", e vale dizer por quê — o catálogo
//    de temas (`render/cenario-data` e quem o consome) é engine de verdade, e pôr `cenario` na regra produziria
//    uma lista de "dívida" que ninguém pode pagar porque não há nada de errado com ela. Um gate que aponta
//    para o lugar certo pela razão errada é pior que gate nenhum: ele treina a pessoa a ignorá-lo.
//
//    ISSO CONTINUA VALENDO DEPOIS DA FASE B (2026-08-26), e a distinção ficou mais nítida: o VALOR escolhido
//    (`cenario`) mudou-se para `game/state`, porque é persistido em chave `kJogo()` e viaja com o cartucho;
//    o CATÁLOGO (`render/cenario-data.CENARIOS`) ficou onde estava, porque descrever céus e morros é trabalho
//    de motor. Duas coisas com o mesmo nome e camadas diferentes — e é por isso que a regra fala de moeda e
//    quiz, que não têm essa ambiguidade.
// ---------------------------------------------------------------------------------------------------------

const T_DIR = join(process.cwd(), 'tests');
// (`VOCAB_JOGO` e declarado na secao 2 - e o MESMO casador, e agora so existe um.)
// IMPORT ESTÁTICO **E** DINÂMICO. A primeira versão só via `from '…'`, e por isso era CEGA para todo teste
// que carrega o módulo com `await import('…')` — coisa que alguns fazem por necessidade, para instalar um
// shim de `localStorage` ANTES de o módulo tocar em persistência. Eram quatro arquivos fora do alcance, e o
// buraco só apareceu quando um deles ganhou um import estático por outro motivo e o gate acordou acusando
// dívida que sempre esteve lá. Um gate cego em silêncio é o que este arquivo inteiro existe para não ser.
const DE = String.raw`(?:from |await import\()'\.\./app/js/`;
const IMPORTA_ENGINE = new RegExp(DE + '(core|input|render|platform|ui|audio|i18n)/');
const IMPORTA_JOGO = new RegExp(DE + 'game/');
/** Título de caso: `it('… moeda …')` é PROSA, e prosa descreve o jogo sem amarrar o teste a ele. */
const TITULO_DE_CASO = /^\s*(it|describe|test)\s*\(/;

/**
 * Dívida CONHECIDA em 2026-08-25: quantas linhas de CÓDIGO de cada teste falam de moeda/quiz. É um TETO —
 * só encolhe. Acrescentar vocabulário a um destes arquivos reprova; um arquivo novo na lista reprova.
 */
// ⚠️ OS NÚMEROS SAEM DAQUI, e não de uma medição à parte. A primeira versão desta tabela foi preenchida com
// um script meu de fora, e ele contou MENOS: eu tinha esquecido `coinCanvas` no casador. O gate reprovou e
// estava certo — `render/props.coinCanvas()` é um pintor de moeda dentro da engine, dívida legítima que a
// minha conta de fora não viu. Quem for atualizar esta tabela, atualize-a pelo que ESTE arquivo reporta.
const FIXTURES_CONHECIDOS = {
  // O núcleo da dívida: o ctx do módulo EXIGE uma moeda ou um quiz para ser montado.
  // `high-contrast.browser.test.js` e `high-contrast.node.test.js` SAÍRAM (2026-08-25, item 19). Eram 23
  // linhas, a maior dívida de fixture da lista, e todas diziam a mesma coisa: o ctx do alto contraste pedia
  // `coinCanvasNormal` + `coinTexNormal`, um par cravado para UM sprite de UM jogo. Virou `sprites()`, um
  // registro por id — a engine cacheia por `(id, modo)` e não sabe o que o id significa. Os fixtures passaram
  // a declarar um sprite chamado 'alvo', e a dívida não foi reescrita: deixou de existir.
  // `audio-nav.node.test.js` SAIU (2026-08-25, item 19) e o fixture que sobrou é de PLATAFORMA de propósito:
  // a bengala sonda material à frente, o nado procura parede e fundo. Declarar tiles para testá-los não é
  // dívida — é a descrição correta. A metade que precisava de moeda foi para `audio-sonar.node.test.js`, e
  // lá o fixture declara topologia e alvos, sem uma moeda sequer.
  // `hud.node.test.js` SAIU (2026-08-25, item 19): o fixture declarava um jogador com `collected` e um
  // view-model com `coins`. Agora declara um OBJETIVO, cujo nome padrão é 'itens' — de propósito, porque um
  // teste de HUD dizendo "moedas" a cada linha reafirmaria por hábito o que o módulo acabou de largar.
  // `viewports.browser.test.js` SAIU (2026-08-25): a única linha era `coinCanvasNormal: null`, passada só
  // para satisfazer o ctx do alto contraste. O ctx deixou de ter forma de moeda (`sprites: () => ({})`), e
  // com isso a linha não precisou ser reescrita — ela deixou de existir.
  // `render.browser.test.js` SAIU (2026-08-25, item 19): a única linha era `render/props.coinCanvas()`, e ela
  // foi com o módulo para `tests/props.browser.test.js` — que a varredura agora pula, por importar de `game/`.
  // NÃO é a dívida sumindo: é ela mudando de lado da fronteira, que é onde ela sempre pertenceu. O pintor de
  // moeda continua existindo; ele deixou de estar na engine.
  // Estes três só ficaram visíveis quando o crivo passou a enxergar `await import()` — a dívida deles é a
  // mesma dos de cima (o ctx do alto contraste exige um canvas/textura de moeda), não é dívida nova.
  // `viz-setters.node.test.js` SAIU (2026-08-25, item 19): o fixture declarava `coinSprites` e a textura
  // `TEX_COIN_NORMAL`. Agora declara ITENS com o id 'alvo' — de propósito, porque um fixture que dissesse
  // 'coin' reafirmaria por hábito o que o corte acabou de tirar do módulo.
  // `viz-setters.browser.test.js` SAIU (2026-08-25, item 19), fechando o subsistema: o irmão node tinha saído
  // no mesmo item, e este ficou por eu ter parado na metade. O fixture declara o item como 'alvo' — o id vem
  // do jogo por `ctx.itemTexId`, e um teste dizendo "coin" a cada linha reafirmaria o que o corte tirou.
  // (`city-tex.node.test.js` também estava invisível e saiu LIMPO — por isso não entra aqui. O caso
  //  "a lista não guarda teste que já se limpou" me obrigou a conferir em vez de supor.)
  // O jogador da engine tem um campo `quiz`: a camada de ENTRADA sabe que existe atividade de alfabetização.
  // `keydown.node.test.js` (17 linhas, o maior fixture da lista), `keydown.browser.test.js` e
  // `gamepad.node.test.js` SAÍRAM (2026-08-25, ADR-0033). O fixture ENCOLHEU junto com o acoplamento: um
  // objeto de desafio de mentira (`{ kind: 'shape' }`, `{ kind: 'braille' }`) virou um booleano por posição,
  // e quatro espiões (`quizMove`/`quizConfirm`/`quizErase`/`announceBraille`) viraram um.
  // `touch.browser.test.js` SAIU (2026-08-25, item 19): três casos que mexiam em `core/state` para exercitar
  // uma linha viraram um que declara a política, mais um novo que prende que ela é lida A CADA chamada.

  // Nível de quiz atravessando menus e pausa.
  // `pause-icons.node.test.js` SAIU (2026-08-25, item 19): o fixture passava `quizLevel: 2` e a tabela
  // `QL_NAME` para o módulo MONTAR a frase do botão de nível. Agora a frase chega pronta e o fixture passa
  // `() => null` ou uma string qualquer — o que ele afirma deixou de ser o texto e passou a ser o que a
  // engine de fato decide: usar o rótulo entregue e NÃO pôr `data-i18n` no botão dinâmico.
  'activities-menu.browser.test.js': 2,
  // `activities-menu.node.test.js` FICOU VISÍVEL em 2026-08-25 (ADR-0032), e a dívida não é nova: ela estava
  // aqui o tempo todo, escondida pelo próprio filtro. `testesDeEngine()` pula quem importa de `game/`, e este
  // teste importava o catálogo de atividades de lá — então nunca foi varrido. O catálogo mudou para
  // `educational/`, o teste virou "teste de engine puro" aos olhos da varredura, e as 5 linhas apareceram.
  //
  // A saída barata seria fazer `IMPORTA_JOGO` casar `educational/` também: o caso ficaria verde na hora e a
  // cegueira voltaria com outro nome. Currículo não é jogo — a lista é o lugar certo para isto.
  'activities-menu.node.test.js': 5,
  // Conteúdo do jogo em tabelas da engine.
  // `audio-earcons.node.test.js` SAIU junto: o fixture declarava um earcon chamado 'coin' com a legenda em
  // texto. Agora declara 'alvo' com uma CHAVE que nem existe no dicionário — `t()` devolve a própria chave
  // quando não acha, então o caso afirma o que interessa (a legenda sai) sem depender de idioma nenhum.
  'i18n-dicts.node.test.js': 3,        // `sr.quiz.*`: 253 chaves das quais um 2º jogo usa um punhado (achado 2)
  'storage-escopos.node.test.js': 2,   // `quizlevel` no registro de chaves — é a chave que o namespace isola
};

/**
 * ESTA LISTA ESVAZIOU, e o caminho até aqui é o registro. Ela existia para um único caso: "moedas no chão",
 * dentro do anúncio do Modo Fácil, era uma FRASE EM PORTUGUÊS que descrevia o jogo para a criança — os dois
 * testes de `settings-motor` comparavam o texto do anúncio e não precisavam de moeda nenhuma para rodar.
 *
 * O item 14 levou a frase para o dicionário, os testes passaram a comparar contra `t()`, e a exceção deixou
 * de ter do que excetuar. Fica VAZIA em vez de apagada porque a distinção continua valendo: prosa que
 * descreve o jogo não é dependência do jogo, e o próximo a encontrar um caso desses precisa achar o lugar.
 */
const PROSA_EM_STRING = new Set([]);

/** Linhas de CÓDIGO de um teste, sem comentários e sem títulos de caso. */
function linhasDeFixture(arquivo) {
  const txt = readFileSync(join(T_DIR, arquivo), 'utf8').split(CR).join('');
  return linhasDeCodigo(txt).filter(([, ln]) => !TITULO_DE_CASO.test(ln));
}

/** Testes que exercitam um módulo de ENGINE e nenhum de `game/`. Um teste de `game/` fala do jogo por dever. */
function testesDeEngine() {
  return readdirSync(T_DIR).filter((f) => f.endsWith('.test.js')).sort().filter((f) => {
    const s = readFileSync(join(T_DIR, f), 'utf8').split(CR).join('');
    return IMPORTA_ENGINE.test(s) && !IMPORTA_JOGO.test(s);
  });
}

/** Quantas linhas de código deste teste falam de moeda/quiz. */
function sujeira(arquivo) {
  return linhasDeFixture(arquivo).filter(([, ln]) => VOCAB_JOGO.test(ln)).length;
}

describe('fronteira engine↔jogo — os FIXTURES dos testes (ADR-0027, a prova decisiva)', () => {
  it('[Right] nenhum teste de engine NOVO precisa de moeda ou de quiz para rodar', () => {
    const novos = testesDeEngine()
      .filter((f) => !(f in FIXTURES_CONHECIDOS) && !PROSA_EM_STRING.has(f))
      .flatMap((f) => linhasDeFixture(f).filter(([, ln]) => VOCAB_JOGO.test(ln))
        .map(([n, ln]) => `${f}:${n}  ${ln.trim().slice(0, 90)}`));
    expect(novos, 'fixture de engine exigindo moeda/quiz — o corte não pegou aqui').toEqual([]);
  });

  it('[Boundary] a dívida de cada teste é um TETO: só encolhe', () => {
    // Teto e não igualdade: um teste ganha e perde linhas por mil razões que não têm nada a ver com moeda, e
    // um caso que reprovasse a cada edição inocente seria afrouxado na primeira pressa. O que ele proíbe é a
    // única coisa que importa — que o acoplamento CRESÇA.
    const cresceram = {};
    for (const [f, teto] of Object.entries(FIXTURES_CONHECIDOS)) {
      const agora = sujeira(f);
      if (agora > teto) cresceram[f] = `${teto} → ${agora}`;
    }
    expect(cresceram, 'fixture ficou MAIS acoplado ao jogo').toEqual({});
  });

  it('[Zero] a lista não guarda teste que já se limpou', () => {
    for (const f of Object.keys(FIXTURES_CONHECIDOS)) {
      expect(sujeira(f), `${f} já não fala de moeda/quiz — apague-o de FIXTURES_CONHECIDOS`).toBeGreaterThan(0);
    }
  });

  it('[Interface] a exceção de prosa é REAL — se o texto sumir, a exceção some junto', () => {
    // Sem este caso, `PROSA_EM_STRING` viraria uma porta de fuga: bastaria pôr um arquivo ali para o gate
    // parar de olhá-lo. Ele já cobrou uma vez: quando a frase 'moedas no chão' foi para o dicionário, o caso
    // reprovou e a entrada teve de sair. Hoje a lista está vazia e ele guarda a regra para a próxima.
    for (const f of PROSA_EM_STRING) {
      const linhas = linhasDeFixture(f).filter(([, ln]) => VOCAB_JOGO.test(ln));
      expect(linhas.length, `${f}: a exceção não se aplica mais`).toBeGreaterThan(0);
    }
    expect(PROSA_EM_STRING.size, 'lista de exceções cresceu — cada entrada precisa do motivo escrito').toBeLessThan(3);
  });

  it('[Interface] a dívida dos fixtures cai nos MESMOS subsistemas que a dos módulos', () => {
    // Esta seção existia para conferir que as duas medidas concordam — e a concordância virou trivial: as
    // duas listas encolheram até quase nada. O que ela guarda agora é o CAMINHO DE VOLTA.
    //
    // SETE subsistemas saíram, por SEIS mecanismos diferentes, e a distinção é o que torna cada saída
    // repetível em vez de anedótica:
    //   · `hud`            — trocou a PERGUNTA (o contador recebe um `Objective`).
    //   · `audio-nav`      — PARTIU EM DOIS; a metade genérica viajou com o contrato.
    //   · `high-contrast`  — a API perdeu a FORMA do objeto do jogo (sprites por id).
    //   · `viewports`      — saiu de carona no anterior: a linha dele era um campo que sumiu.
    //   · `keydown`/`gamepad` — a engine entrega INTENÇÃO e o jogo decide (ADR-0033).
    //   · `pause-icons`    — o RÓTULO passa pronto; montá-lo era da engine e trazia pt-BR cru junto.
    //
    // SOBRAM SEIS, e elas não são todas da mesma natureza — escrevo a separação porque um número sozinho
    // convida a "zerar a lista", que é como um gate passa a mentir:
    //   · `activities-menu.*` (7)   — o menu do CURRÍCULO. Sai com a EdSP (ADR-0032), não antes.
    //   · `i18n-dicts` (3)          — as chaves `sr.quiz.*`. É o ACHADO 2 do segundo consumidor (peso morto
    //     no dicionário), e não acoplamento: um segundo jogo herda 253 chaves e usa um punhado.
    //   · `storage-escopos` (2)     — a chave `quizlevel`, pelo mesmo motivo de `platform/storage`: `kJogo()`
    //     É o mecanismo de escopo de jogo, e a palavra é que chama a atenção do casador.
    // As duas últimas são o casador notando uma PALAVRA, não a fronteira notando um vazamento.
    expect(Object.keys(FIXTURES_CONHECIDOS)).toHaveLength(4);
    const porSubsistema = new Set(Object.keys(FIXTURES_CONHECIDOS).map((f) => f.split('.')[0]));
    for (const limpo of ['hud', 'audio-nav', 'audio-sonar', 'high-contrast', 'viewports', 'keydown', 'gamepad', 'pause-icons']) {
      expect(porSubsistema, `${limpo} voltou a precisar de moeda/quiz no fixture — o item 19 andou para trás`)
        .not.toContain(limpo);
    }
  });
});

// -----------------------------------------------------------------------------------------------------------
describe('A RAIZ DE COMPOSICAO — o ponto cego que a issue #111 tem de fechar', () => {
  // ⚠️ ATE AQUI, O ZERO ACIMA ERA VERDADEIRO E INCOMPLETO. `CAMADAS_ENGINE` varre PASTAS, e `app/js/main.ts`
  // nao esta em pasta nenhuma — nunca entrou em `MODULOS`, e por isso nunca foi contado. O plano da #111
  // dizia «por `main.ts` no escopo do engine-boundary»; POR NO MESMO ESCOPO SERIA ERRADO, e vale escrever por
  // que: `main.ts` e a raiz de composicao do JOGO, nao camada de engine. Importar de `game/` e o que ele
  // existe para fazer, e exigir-lhe zero seria exigir que o jogo nao se monte.
  //
  // O que faltava aferir e OUTRA COISA, e e ela que a #111 precisa: que ele seja a UNICA porta, e que a porta
  // seja MEDIDA. Sem isso, uma segunda raiz podia nascer sem ninguem reparar, e a extracao do cartucho nao
  // teria numero nenhum a que se agarrar.
  const RAIZ_TS = readdirSync(RAIZ).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
  const arestasDeJogo = (ficheiro) =>
    (readFileSync(join(RAIZ, ficheiro), 'utf8').split(CR).join('').match(/from '\.\/game\//g) || []).length;

  /** ⚠️ TETO, e so encolhe. E o MEDIDOR da #111: cada peca do cartucho que sai baixa este numero. */
  const TETO_DA_RAIZ = 29;

  it('[Right] ⚠️ `main.ts` e a UNICA porta para `game/` — nenhuma segunda raiz nasceu', () => {
    // A propriedade que torna a #111 possivel de todo: se as arestas estivessem espalhadas por varios
    // ficheiros de raiz, mover o cartucho seria caca ao tesouro em vez de mover uma pasta e um ficheiro.
    const portas = RAIZ_TS.filter((f) => arestasDeJogo(f) > 0);
    expect(portas, 'apareceu uma segunda raiz que importa do jogo').toEqual(['main.ts']);
  });

  it('[Boundary] e as arestas dela sao um TETO que so encolhe', () => {
    // ⚠️ O NUMERO SUBIU HOJE, de 28 para 29, por uma linha minha (`game/save-id.ts`, do ADR-0088) — e foi
    // subir sem nada reparar que mostrou que este caso faltava. Um teto que ninguem baixa e divida; um teto
    // que ninguem MEDE e divida invisivel.
    expect(arestasDeJogo('main.ts'), 'a raiz ficou MAIS acoplada ao jogo').toBeLessThanOrEqual(TETO_DA_RAIZ);
  });

  it('[Interface] e o teto NAO e zero — a raiz do jogo importa o jogo, por definicao', () => {
    // A metade honesta. Um zero aqui nao seria vitoria: seria o cartucho ja fora (e ai este ficheiro inteiro
    // muda de assunto) ou o gate a ter parado de medir. Dizer isso numa assercao impede que o proximo leitor
    // leia o teto como defeito a consertar no lugar errado.
    expect(arestasDeJogo('main.ts')).toBeGreaterThan(0);
  });
});
