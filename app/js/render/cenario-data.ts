// SPDX-License-Identifier: AGPL-3.0-or-later
// render/cenario-data — O CATÁLOGO DE CENÁRIOS: os quatro temas do jogo como DADO, e nada além disso.
//
// Este é o módulo-FOLHA da etapa D2-b: zero imports, zero PIXI, zero DOM, zero I/O. Ele responde a uma única
// pergunta — "quais são os cenários, e de que cor é cada um?" — e é justamente por não responder a mais
// nenhuma que ele pode ser lido, importado e testado por qualquer um dos seus consumidores sem arrastar meio
// motor junto.
//
// ======================= POR QUE A FRONTEIRA CAIU AQUI =======================
// `CENARIOS` e `THEME_FLORA` são as duas tabelas mais LIDAS e menos PROTEGIDAS do monólito. Antes desta
// extração elas eram `const` no meio do `game.js` e chegavam aos módulos por INJEÇÃO — `render/scene-sky.ts`
// as recebe inteiras no `SceneSkyCtx` (`CENARIOS`, `THEME_FLORA`), `game/attract.ts` recebe `CENARIOS` para
// sortear o tema da demo, o splash recebe a lista reduzida a `{id,nome}`, e `setCenario` as consulta para
// validar e para pintar. Cinco leitores, nenhum teste, e nenhum lugar onde a FORMA de um tema estivesse
// escrita: cada leitor descobria por acidente que `T.cloud` só existe quando `T.v3` é verdadeiro, e que
// `THEME_FLORA` não tem entrada para 'cidade'.
//
// Separar o dado da máquina que o consome é o corte mais barato e mais duradouro desta região: um tema novo
// (uma estação, um bioma) passa a ser uma linha AQUI, e as invariantes que os leitores presumem viram
// asserção em `tests/cenario-data.node.test.js` — em particular a mais silenciosa de todas, "todo tema `v3`
// tem `sky`, `cloud`, `hills`, `decor` E uma entrada em `THEME_FLORA`". Quebrar essa correspondência não
// derruba nada: `scene-sky` faz `const fl = THEME_FLORA[cenario]` e simplesmente não desenha grama. O tema
// novo nasceria careca, e ninguém saberia dizer por quê.
//
// ======================= O QUE ESTÁ AQUI, E POR QUÊ ESTÁ JUNTO =======================
//  · `CENARIOS`     — os quatro temas + a Cidade. `v3:false` (Cidade) significa "meu fundo vem de PNG e eu
//                     tenho o céu/tráfego próprios de render/scene-city"; `v3:true` significa "meu fundo é
//                     GERADO pelas fórmulas da v3.1.100 (render/scene-parallax) a partir destas cores".
//                     Nenhum tema tem chuva — chuva é da Cidade, e é decisão de render/weather.
//  · `THEME_FLORA`  — grama e flores por tema. Tabela IRMÃ da de cima e SÓ dos temas `v3`: a Cidade não tem
//                     flora. Fica no mesmo arquivo porque as duas descrevem O MESMO tema por chaves iguais e
//                     precisam ser editadas no mesmo gesto; separá-las convidaria exatamente a divergência
//                     que o teste de correspondência existe para pegar.
//  · `hexN`         — '#rrggbb' → número, o tradutor entre o dado (string, legível na tabela acima) e o PIXI
//                     (`beginFill` quer inteiro). Ele vivia solto no meio do bloco de parallax do game.js e
//                     tinha UM chamador: o `SceneSkyCtx`. É função da TABELA, não do parallax — todas as
//                     cores que ele converte estão neste arquivo — e por isso veio para cá, e não para
//                     render/parallax.
//  · `normalizarCenario` — a validação de `setCenario` ("tema desconhecido → 'cidade'"), isolada do efeito.
//
// ======================= O QUE NÃO VEIO =======================
//  · As FÓRMULAS que transformam estas cores em pixel (`themeSkyTexture`, `themeHillsTexture`,
//    `parallaxPlaceholder`, `hillHeight`) já moram em render/scene-parallax.ts desde o Estágio 4. Este
//    arquivo é a entrada delas, não a implementação.
//  · O desenho da flora (`drawV3Grass`) e da decoração viva é de render/scene-sky.ts. Aqui só a paleta.
//  · Os FATORES de profundidade das 3 camadas (`PARALLAX`) NÃO estão aqui, apesar de também serem dado: eles
//    não variam por tema — descrevem a GEOMETRIA do fundo, e vivem ao lado da conta que os usa, em
//    render/parallax.ts. Uma tabela de tema aqui, uma tabela de câmera lá.
//
// ======================= ⚠️ COMPORTAMENTO PRESERVADO: `normalizarCenario` ACEITA CHAVE HERDADA =======================
// O monólito valida com `if(!CENARIOS[theme])theme='cidade'`. `CENARIOS` é um objeto literal, logo herda de
// `Object.prototype`: `CENARIOS['toString']` é uma FUNÇÃO, e portanto truthy, e portanto 'toString' passa na
// validação como se fosse um tema. O `setCenario` então persiste 'toString' em `incl_cenario`, tenta baixar
// `assets/cenarios/toString/c4.png` e o jogo fica sem fundo. Só é alcançável por um valor forjado (chave de
// localStorage adulterada; `window.__incl.setCenario('constructor')`), nunca pela UI — que monta o seletor a
// partir de `Object.keys(CENARIOS)`.
// ISTO É O COMPORTAMENTO ATUAL E FOI COPIADO TAL E QUAL, de propósito: esta etapa é uma EXTRAÇÃO, e trocar a
// checagem por `hasOwnProperty` aqui seria consertar às escondidas, dentro de um movimento cuja garantia é
// justamente "nada mudou". O teste PREGA a falha (`normalizarCenario('toString') === 'toString'`), para que o
// conserto — quando vier — seja uma mudança visível de asserção e não uma surpresa.
//
// SEM I/O NO IMPORT: o corpo do módulo só declara literais. Não há `init`, não há factory, não há efeito —
// e por isso não há armadilha de ordem de boot: importar este arquivo é sempre seguro, em qualquer ponto.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (D2-b).

/** Grama e flores de um tema `v3` (render/scene-sky.drawV3Grass). Cores em '#rrggbb'. */
export interface Flora {
  base: string;     // faixa de base da grama (2px no topo do tile)
  top: string;      // 1px mais claro por cima da base
  bLt: string;      // tufo claro (alterna com bDk)
  bDk: string;      // tufo escuro — e o caule da flor
  center: string;   // miolo da flor
  petals: string[]; // pétalas sorteadas por hash do tile
}

/**
 * Um cenário.
 *
 * O CAMPO `v3` FOI SEPARADO EM DOIS (2026-08-25), e o motivo é um pedido que ele não conseguia atender.
 * Ele significava três coisas ao mesmo tempo — "meu fundo é gerado das cores", "tenho céu vivo compartilhado"
 * e "tenho flora" — e isso funcionava enquanto só existiam dois tipos de tema: a Cidade (PNG, cena própria,
 * sem flora) e os quatro gerados (cores, céu vivo, flora).
 *
 * O Dev pediu FUNDO RASTER PARA A FLORESTA, mantendo a floresta como floresta. Isso é uma combinação nova —
 * PNG **com** flora e céu vivo — e ela não cabia num booleano só: virar `v3` para false teria tirado a grama,
 * as flores e as borboletas dela junto com o fundo gerado.
 *
 * Agora são duas perguntas independentes, e cada leitor faz a sua:
 *   · `fundo`     — de onde vêm as três camadas de parallax. Lido por render/parallax.
 *   · `decor`     — que decoração viva o céu recebe. Lido por render/scene-sky, pela PRESENÇA, não por rótulo.
 * A flora segue a mesma regra: quem tem entrada em THEME_FLORA tem flora, e ponto.
 */
/**
 * UMA FAIXA DE PRÉDIOS de uma camada de parallax — o skyline da Cidade, como DADO (ADR-0042).
 *
 * TODO NÚMERO AQUI FOI MEDIDO nos três PNG que esta faixa substitui, não escolhido. O ADR-0042 registra por
 * que eles não podiam ser reproduzidos: os fundos precisam de 11.382 retângulos de cor uniforme (2.065 +
 * 2.899 + 6.418, cobertura gulosa 2D), duas a três ordens de grandeza acima do que a pipeline estimava,
 * porque 400×180 com 171 cores é arte desenhada à mão e não geometria.
 *
 * O que se salva medindo, então, não é o pixel — é a REGRA: onde a faixa fica sólida, quanto os topos
 * variam, quais são os dois tons do corpo e os dois da janela. Isso a torna RECOLORÍVEL, que é o que o
 * pilar 1 existe para comprar: o alto contraste repinta um dado e não repinta um PNG. E a Cidade é a maior
 * superfície da tela — sob PNG, era a única coisa que o modo de alto contraste jamais alcançava.
 */
export interface FaixaDePredios {
  /** y a partir do qual a faixa é SÓLIDA: abaixo desta linha é tudo prédio, sem buraco. */
  base: number;
  /**
   * Os DOIS TONS DE PROFUNDIDADE, `[fundo, frente]`, desenhados nessa ordem.
   *
   * Cada camada de parallax tem duas fileiras no original, não uma — é o que dá o ar de cidade. A primeira
   * versão deste gerador tinha só uma, e por isso a Cidade saiu chapada.
   */
  corpo: readonly [string, string];
  /** Topos possíveis da fileira da FRENTE, `[mais alto, mais baixo]` — em y, o primeiro é o MENOR. */
  topo: readonly [number, number];
  /** Idem para a fileira do FUNDO, que é mais alta e mais simples. */
  topoFundo: readonly [number, number];
  /** As larguras possíveis de um prédio, em px. */
  largura: readonly [number, number];
  /**
   * As cores da LUZ — janela ACESA, e só ela.
   *
   * ⚠️ NÃO EXISTE COR DE JANELA APAGADA, e essa foi a lição mais cara desta arte: a apagada é a parede. A
   * primeira versão declarava um par "acesa/apagada" com dois tons quase idênticos, pintava TODA célula, e
   * o resultado foi um quadriculado cinza. Pior: os dois tons que ela chamava de janela eram, na verdade, o
   * segundo tom de MASSA — os prédios de trás.
   *
   * As luzes são QUENTES (R > B). Ausente = distante demais para acender.
   */
  luz?: readonly string[];
  /** Fração média de janelas acesas. Varia por prédio em torno dela — uns quase escuros, outros cheios. */
  aceso?: number;
}

/** O que todo tema tem, independentemente de como o fundo dele nasce. */
interface TemaBase {
  /** CHAVE i18n do nome exibido. Chave e não texto: tabela de módulo resolvida no import congelaria o idioma
   *  no boot (ver a nota em input/devices). Quem exibe resolve com `t()`. */
  nome: string;
  /** Paradas do gradiente vertical do céu, do TOPO ao rodapé, distribuídas por igual. DUAS ou MAIS: com N
   *  paradas, a de índice i cai em y = 180·i/(N-1) — é assim que se escolhe a ALTURA de uma cor. */
  sky: readonly string[];
  cloud?: [string, string]; // nuvem de tela: corpo + sombra
  /** Sol baixo com leque de raios, assado na textura do céu. Ausente = céu de puro gradiente. */
  sol?: { cor: string; x: number; y: number };
  /** Este tema tem CHUVA (ciclo do clima em render/weather). Ausente = sempre seco. */
  chuva?: true;
  /** Quantos cúmulos na MANTA de tela, que fecha e abre com a chuva. Múltiplo de 3 (são 3 fileiras), e só a
   *  de cima aparece no tempo bom. Ausente = as 3 lajes fixas da v3. */
  nuvens?: number;
  decor?: string[];         // decoração viva ligada neste tema (render/scene-sky.stepV3Decor)
}

/** Fundo de MORROS: céu em gradiente + duas bandas de morro. Os quatro temas da v3. */
export interface TemaMorros extends TemaBase {
  fundo: 'morros';
  /** As duas bandas de morro: `[fundo, frente]`. */
  hills: readonly [string, string];
}

/** Fundo de PRÉDIOS: céu em gradiente + três faixas de skyline. A Cidade, e só ela por enquanto. */
export interface TemaPredios extends TemaBase {
  fundo: 'predios';
  /** Uma faixa por camada de parallax, do mais distante ao mais próximo. */
  predios: readonly [FaixaDePredios, FaixaDePredios, FaixaDePredios];
}

/**
 * O tema, e ele é uma UNIÃO DISCRIMINADA de propósito.
 *
 * Antes eram `fundo: 'gerado' | 'png'` com `sky?` e `hills?` opcionais, e o invariante de verdade — *quem é
 * gerado TEM céu e morros* — não morava em lugar nenhum: era uma frase num comentário e um `if` em
 * `render/parallax`. Quem lesse o tipo via quatro campos que podiam faltar; quem lesse o código via que
 * nunca faltavam. Agora o compilador cobra, e `render/scene-parallax` deixou de precisar redescrever isto
 * como `ParallaxTheme` — o que era o defeito do ADR-0039 outra vez, numa terceira vítima.
 */
export type CenarioTema = TemaMorros | TemaPredios;

/** O tema para o qual todo valor desconhecido cai. */
export const CENARIO_PADRAO = 'cidade';

/* L6 (REFEITO — fiel à v3.1.100): os 4 temas usam EXATAMENTE o céu, as nuvens, as montanhas, a grama
   e a decoração viva de lá (fórmulas copiadas). BLOCOS = Clarity SEM recolor (a v3 não recoloria tiles
   por tema). A CHUVA deixou de ser privilégio da Cidade: é o campo `chuva` abaixo que a concede, e a
   Floresta também a tem (decisão do Dev, 2026-08-25). */
// ⚠️ TRÊS IDS MENTEM, e o rótulo é que está certo. `cemiterio` é "Amanhecer no Campo" e `espaco` é "Noite no
// Campo" (ver `cen.*` nos dicionários): os temas mudaram, os ids ficaram. Com `campo` = "Dia no Campo", os três
// são o MESMO lugar em três horas do dia, e é por isso que compartilham a silhueta em render/scene-parallax.
// Renomear os ids é migração de dado persistido (`incl_cenario` e as gravações de demonstração os guardam),
// então fica para uma rodada própria — e este aviso é a rede até lá. Quem ler só o id planta a arte errada;
// foi o que quase aconteceu.
//
// SE UM DIA HOUVER TEMA DE ESPAÇO OU DE HALLOWEEN (decisão do Dev, 2026-08-25): no de espaço, os BLOCOS do
// nível viram partes de estação espacial — não é só trocar o céu. E o de Halloween é uma FESTA de Halloween,
// não um cemitério: abóboras, fantasias e doces, não túmulos.
export const CENARIOS: Record<string, CenarioTema> = {
  // `chuva` estava ESCRITA NO CÓDIGO do clima, como `cenario === 'cidade'`. Era verdade e virou mentira no dia
  // em que o Dev pediu chuva na Floresta — e o pior de uma condição dessas é que ela não avisa: quem lê
  // `render/weather` não tem como saber que existe uma lista de temas, porque não existe lista, existe um `if`.
  // Aqui a capacidade é DADO, e um tema novo declara a sua ao nascer.
  // A CIDADE (ADR-0042), medida nos três PNG que ela substitui — e MEDIDA DE NOVO depois que a primeira
  // versão saiu chapada na tela. O que a segunda medição corrigiu:
  //
  //   · as cores que eu tinha listado como "janela acesa/apagada" eram o SEGUNDO TOM DE MASSA (os prédios
  //     de trás). Separando por temperatura, a luz é o que tem R > B — e ela é rara: 5,4% da área na
  //     camada próxima, 0,28% na média, 0,04% na distante;
  //   · cada camada tem DUAS fileiras de profundidade, não uma;
  //   · as janelas são 2 px de largura por 3 a 5 de altura (263 na camada próxima), não pontos 2x2.
  cidade: {
    nome: 'cen.cidade', fundo: 'predios', chuva: true,
    sky: ['#5d6f8e', '#5d6f8e', '#5d6f8e', '#374866'],
    predios: [
      // Camada 0 — a bruma. Duas profundidades quase iguais ao céu, e quase nenhuma luz.
      { base: 144, topo: [96, 128], topoFundo: [71, 108], largura: [16, 40],
        corpo: ['#4a5c7c', '#374866'], luz: ['#a5ac93', '#adb599'], aceso: 0.006 },
      // Camada 1 — o meio. Os de trás são visivelmente mais claros (#6b7e98).
      { base: 139, topo: [64, 122], topoFundo: [44, 100], largura: [14, 38],
        corpo: ['#6b7e98', '#465164'], luz: ['#c2c0be', '#baada6', '#bfbdb9'], aceso: 0.022 },
      // Camada 2 — a de perto, e a que carrega a cidade acesa. `base` 158 é a linha em que o original fica
      // 100% sólido; acima dela a fileira da frente cobre ~70% das colunas e o resto é vão e fileira de trás.
      { base: 158, topo: [88, 134], topoFundo: [66, 108], largura: [18, 44],
        corpo: ['#637980', '#2b3e49'], luz: ['#c8c3b7', '#bdac8e', '#ccc4b5', '#d0ccc9'], aceso: 0.85 },
    ],
  },
  campo:     { nome: 'cen.campo',          fundo: 'morros', sky: ['#86c5e8', '#cfeecb'], cloud: ['#ffffff', '#d4e6f5'], hills: ['#9fd47e', '#6fb84e'], decor: ['nuvens', 'passaros', 'borboletas'] },
  cemiterio: { nome: 'cen.cemiterio',      fundo: 'morros', sky: ['#2b2540', '#5a4f6b'], cloud: ['#d9c4dd', '#a98fb6'], hills: ['#4a5f55', '#33473d'], decor: ['nuvens', 'passaros', 'sparkles', 'minhocas', 'nevoa'] },
  espaco:    { nome: 'cen.espaco',         fundo: 'morros', sky: ['#05030f', '#161033'], cloud: ['#3a3550', '#262238'], hills: ['#1e3030', '#142024'], decor: ['nuvens', 'sparkles', 'vagalumes'] },
  // A FLORESTA É UM PÔR DO SOL, e antes era um céu VERDE (`#3f6b50`→`#8fbf73`) com nuvens verdes por cima.
  // Verde no céu não é só feio: com os morros em `#2f5e35`, a silhueta das coníferas ficava a um passo da cor
  // do fundo e sumia — plantei árvores que ninguém via, e só depois de ver na tela é que a causa apareceu.
  //
  // As sete paradas caem de 30 em 30 px (y = 180·i/6), e é por isso que são sete: é o que põe o AMARELO em
  // y=60 e o VERMELHO em y=90, que é a linha do horizonte. O laranja entre eles não é declarado — ele nasce da
  // interpolação, como o violeta nasce entre o índigo do topo e o rosa. As três últimas paradas ficam ATRÁS
  // dos morros; existem para o degradê não terminar num corte seco na beira da tela.
  floresta:  { nome: 'cen.floresta', fundo: 'morros',
               sky: ['#231a52', '#a34a6e', '#ffd166', '#e0392c', '#8e2320', '#5a1a1c', '#3a1418'],
               sol: { cor: '#ffe9a8', x: 0.30, y: 0.46 },
               cloud: ['#ffffff', '#e9a06a'], // corpo branco, sombra alaranjada: é a luz baixa batendo por baixo
               chuva: true, nuvens: 27, // 3 fileiras de 9: a de cima sempre, as outras duas ao fechar o tempo
               hills: ['#2f5e35', '#1f4226'], decor: ['nuvens', 'passaros', 'borboletas'] },
};

/** v3 exato — grama/flores por tema. SÓ dos temas `v3`: a Cidade não tem flora (por isso o `| undefined`). */
export const THEME_FLORA: Record<string, Flora | undefined> = {
  campo:     { base: '#52933c', top: '#7cc35a', bLt: '#8fd968', bDk: '#46822f', center: '#ffe14d', petals: ['#ffe14d', '#ff7eb6', '#ffffff', '#ff6b6b'] },
  cemiterio: { base: '#46624f', top: '#5e7d68', bLt: '#6f9079', bDk: '#3a5244', center: '#f0e6d0', petals: ['#c9b6e8', '#e7c9dd', '#b6c9e8'] },
  espaco:    { base: '#2d4650', top: '#40606a', bLt: '#557f88', bDk: '#26404a', center: '#fff6c0', petals: ['#d6ecff', '#ffffff', '#cfffe8'] },
  floresta:  { base: '#3a7a34', top: '#5fa84a', bLt: '#6fc255', bDk: '#2f6329', center: '#ffe14d', petals: ['#c98ce0', '#ffffff', '#ffd166', '#ff7eb6'] },
};

/** '#rrggbb' → 0xrrggbb, para o `beginFill` do PIXI. Verbatim do `hexN` do game.js. */
export const hexN = (s: string): number => parseInt(String(s).slice(1), 16);

/**
 * A validação de `setCenario`, sem o efeito: tema conhecido passa, o resto vira 'cidade'.
 * ⚠️ Cópia FIEL do monólito, herança do `Object.prototype` inclusive — ver o cabeçalho.
 */
export function normalizarCenario(theme: string): string {
  if (!CENARIOS[theme]) return CENARIO_PADRAO;
  return theme;
}
