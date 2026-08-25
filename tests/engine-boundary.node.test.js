// SPDX-License-Identifier: GPL-3.0-or-later
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
const CAMADAS_ENGINE = ['core', 'input', 'render', 'platform', 'ui', 'audio'];

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
  'render/draw.ts': ['game/powerups.js', 'game/coin-spawning.js'],
  // `render/textures.ts` SAIU DAQUI (2026-08-25): importava `SOMASUB_SHAPES` por causa de UMA linha do
  // `initTextures`, e agora recebe os ids das formas pelo ctx. A aresta era pequena e o efeito não: era
  // também a única razão de `render/viz-setters` arrastar `game/` por transitividade — duas de quatro.
  'ui/activities-menu.ts': ['game/activities-registry.js'],
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

  it('[Boundary] a dívida cabe em DOIS módulos — o número é o que diz quão perto a fronteira está', () => {
    // Não é decoração: é a diferença entre "a fronteira está errada" e "a fronteira está a dois módulos de
    // valer". O ADR-0027 pergunta se o passo 5 pode começar, e é este número que responde. Era três.
    expect(Object.keys(IMPORTS_CONHECIDOS)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------------------------------------
// 2. O NOME QUE O ADR ESCOLHEU. `coinTarget` é o exemplo do registro, e ele existe: `ui/hud.vphudHtml` recebe
//    um alvo de moedas. Um jogo sem moedas não tem o que passar ali, e o HUD é engine.
// ---------------------------------------------------------------------------------------------------------

const MOEDA = /\b(coin|coins|coinTarget|moeda|moedas)\b/i;

/** Dívida CONHECIDA de VOCABULÁRIO em 2026-08-25 — só encolhe, mesma regra. */
const MOEDA_CONHECIDA = new Set([
  'ui/hud.ts',              // vphudHtml(coinTarget) + o campo `coins` do view-model: o caso do ADR, ao pé da letra
  'platform/audio-nav.ts',  // o sonar aponta para a `Coin` mais próxima; o PROPÓSITO é engine, o TIPO é do jogo
  'render/draw.ts',         // já contado acima pelas importações
  'core/state.ts',          // `coins: unknown[]` — estado do jogo morando no estado compartilhado
  'platform/audio.ts',      // earcon de chave 'coin': conteúdo sonoro do jogo na tabela da engine
  // `ui/settings-motion.ts` SAIU (2026-08-25): a única menção era o rótulo 'Animação de itens (moedas)', que
  // foi para o dicionário no item 14. Ganho lateral da i18n — texto que sai do código sai também da fronteira.
  'platform/audio-mixer.ts', 'ui/settings-motor.ts', // rótulos/anúncios, não dependência
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

  it('[Right] `ui/hud` NÃO importa mais a constante do jogo — o veredito do passo 4 mudou de lado', () => {
    // Este caso já foi o contrário. Enquanto `vphudHtml(coinTarget = COIN_TARGET)` existia, o ADR-0027 dizia
    // que a fronteira estava errada e o passo 5 não podia começar. O alvo virou parâmetro obrigatório,
    // injetado pelo consumidor como `powerShort` já era — e a aresta morreu.
    //
    // O que SOBRA em ui/hud é vocabulário: o ícone 🪙, a classe `vphud-coins`, o campo `coins` do view-model.
    // É dívida menor e de outra natureza: nomes não são seguidos pelo compilador, e não impedem um pacote de
    // se separar. Por isso o módulo continua na lista de vocabulário abaixo, e saiu da de importações.
    expect(fonte('ui/hud.ts')).not.toMatch(/from '\.\.\/core\/constants\.js'/);
    expect(fonte('ui/hud.ts')).toMatch(/vphudHtml\(alvo: number\)/);
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
// ---------------------------------------------------------------------------------------------------------

const T_DIR = join(process.cwd(), 'tests');
const VOCAB_JOGO = /\b(coin|coins|coinTarget|coinTex\w*|coinCanvas\w*|moeda|moedas|quiz|quizLevel|quizlevel)\b/i;
const IMPORTA_ENGINE = /from '\.\.\/app\/js\/(core|input|render|platform|ui|audio|i18n)\//;
const IMPORTA_JOGO = /from '\.\.\/app\/js\/game\//;
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
  'high-contrast.browser.test.js': 17, // `coinTexFor`/`coinTexNormal` — o alto contraste tem caminho de moeda
  'high-contrast.node.test.js': 6,
  'audio-nav.node.test.js': 7,         // o sonar pede `getCoins` (achado 9 do segundo consumidor)
  'hud.node.test.js': 3,               // o campo `coins` do view-model: o caso do ADR ao pé da letra
  'viewports.browser.test.js': 1,      // passa `coinCanvasNormal: null` só para satisfazer o ctx
  'render.browser.test.js': 1,         // `render/props.coinCanvas()`: a engine tem um pintor de MOEDA
  // O jogador da engine tem um campo `quiz`: a camada de ENTRADA sabe que existe atividade de alfabetização.
  'keydown.node.test.js': 17,
  'keydown.browser.test.js': 1,
  'gamepad.node.test.js': 2,
  'touch.browser.test.js': 2,
  // Nível de quiz atravessando menus e pausa.
  'pause-icons.node.test.js': 3,
  'activities-menu.browser.test.js': 2,
  // Conteúdo do jogo em tabelas da engine.
  'audio-earcons.node.test.js': 4,     // earcon de chave 'coin'
  'i18n-dicts.node.test.js': 3,        // `sr.quiz.*`: 253 chaves das quais um 2º jogo usa um punhado (achado 2)
  'storage-escopos.node.test.js': 2,   // `quizlevel` no registro de chaves — é a chave que o namespace isola
};

/**
 * NÃO É DÍVIDA, e a distinção é a mesma que o topo deste arquivo já faz para os módulos: "moedas no chão"
 * dentro do anúncio do Modo Fácil é uma FRASE EM PORTUGUÊS que descreve o jogo para a criança. O teste
 * compara o texto do anúncio; ele não precisa de moeda nenhuma para rodar.
 */
const PROSA_EM_STRING = new Set(['settings-motor.node.test.js', 'settings-motor.browser.test.js']);

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
    // parar de olhá-lo. Aqui ele tem de continuar sendo o que a exceção diz que é — uma FRASE, e não um ctx.
    for (const f of PROSA_EM_STRING) {
      const linhas = linhasDeFixture(f).filter(([, ln]) => VOCAB_JOGO.test(ln));
      expect(linhas.length, `${f}: a exceção não se aplica mais`).toBeGreaterThan(0);
      for (const [n, ln] of linhas) {
        expect(ln, `${f}:${n} não é mais uma frase — reveja a exceção`).toMatch(/moedas no chão/);
      }
    }
  });

  it('[Interface] a dívida dos fixtures cai nos MESMOS subsistemas que a dos módulos', () => {
    // É o que faz esta seção valer a pena existir ao lado das outras duas: se os testes acusassem um conjunto
    // DIFERENTE de subsistemas, uma das duas medidas estaria errada. Elas concordam — alto contraste, sonar,
    // HUD e entrada —, e essa concordância é o que dá confiança de que o passo 5 sabe onde mexer.
    const porSubsistema = new Set(Object.keys(FIXTURES_CONHECIDOS).map((f) => f.split('.')[0]));
    for (const esperado of ['high-contrast', 'audio-nav', 'hud', 'keydown']) {
      expect(porSubsistema, esperado).toContain(esperado);
    }
  });
});
