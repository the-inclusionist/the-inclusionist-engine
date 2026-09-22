// SPDX-License-Identifier: AGPL-3.0-or-later
// render/scene-parallax — parallax background TEXTURE generators (Estágio 4, Tier 2). Pure builders: given a
// theme (or a city-placeholder index) they return a PIXI texture. Formulas verbatim from game.js (v3 drawBackdrop
// / drawHillBand). The per-frame scroll (`updateParallax`) stays in game.js — it is render-graph glue (moves the
// TilingSprites + the sky-deco layers). See docs/5-Refactoring/plano-modularizacao-mapa.md.

import { makeCanvas, tex } from './canvas.js';
import { LOGICAL_W, LOGICAL_H } from '../core/constants.js';
import type { SceneryTheme, HillsTheme, BuildingsTheme, BuildingBand } from './scenery-data.js';

/** Um sol baixo com leque de raios, assado na textura do céu. Ver `paintSun`. */
export interface Sol {
  cor: string;   // a cor dos raios e do disco (a mesma; o que os separa é a opacidade)
  x: number;     // centro do disco, em fração da LARGURA da textura
  y: number;     // centro do disco, em fração da ALTURA (0.5 = a linha do horizonte)
}

// `ParallaxTheme` SAIU (ADR-0039). Era uma redescrição de `SceneryTheme` — a terceira vítima do mesmo padrão
// no repositório —, e ela NARROWED em vez de generalizar: declarava `sky` e `hills` obrigatórios enquanto o
// dono os tinha opcionais, então o tema real não entrava na função que existia para desenhá-lo, e o erro
// caía no `main.ts` falando de duas funções em vez da causa. O dono agora é uma união discriminada e este
// módulo a importa: quem desenha morro pede `HillsTheme`, quem desenha prédio pede `BuildingBand`, e o
// compilador cobra o `fundo` no ponto de chamada.

/** Hill silhouette height at column `x` (v3 drawHillBand: double sine). `near` = the front (taller) band. */
export function hillHeight(x: number, near: boolean): number {
  const amp = near ? 9 : 5, freq = near ? 0.013 : 0.018, phase = near ? 0 : 140;
  return Math.sin((x + phase) * freq) * amp + Math.sin((x + phase) * freq * 2.3 + 1.7) * amp * 0.4;
}

/** City placeholder backdrop (the 4 v3 themes have their own sky/hills below). */
export function parallaxPlaceholder(i: number): unknown {
  const w = LOGICAL_W, h = LOGICAL_H, cv = makeCanvas(w, h), c = cv.getContext('2d')!;
  const pal = [['#0a1024', '#1b2350'], ['#13284a', '#22406e'], ['#1d3a52', '#356a86']][i]!;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, pal[0]!); g.addColorStop(1, pal[1]!); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = pal[1]!;
  for (let x = 0; x < w; x += 44 + i * 14) { const hh = 24 + ((x * 7 + i * 29) % (46 + i * 22)); c.fillRect(x, h - hh, 30 + i * 6, hh); }
  c.fillStyle = 'rgba(255,255,255,.18)'; for (let k = 0; k < 8; k++) c.fillRect((k * 53 + i * 17) % w, (k * 23 + i * 11) % (h - 40), 2, 2);
  return tex(cv);
}

/* ===================== o céu ===================== */
//
// O CÉU ERA DUAS CORES, e isso bastava enquanto todo tema era um céu liso. A Floresta pedida pelo Dev não é:
// é um PÔR DO SOL — vermelho junto ao horizonte, laranja acima, raios amarelos e nuvens brancas. Um gradiente
// de duas paradas não consegue dizer isso: interpolar do topo direto ao horizonte dá UMA transição, e um pôr
// do sol são três ou quatro empilhadas.
//
// Então `sky` virou uma LISTA de paradas em vez de um par, distribuídas por igual do topo ao rodapé. Duas
// paradas continuam significando exatamente o que significavam — é por isso que os outros três temas não
// mudaram de aparência nem de linha. Com N paradas, a de índice i fica em `i/(N-1)`, e como a textura tem a
// altura do viewport (180), a conta de onde uma cor cai é direta: y = 180 · i/(N-1). É essa previsibilidade
// que permite ESCOLHER a altura de uma cor pela quantidade de paradas, e é assim que o vermelho da Floresta
// foi posto na linha do horizonte (y=90) em vez de no rodapé invisível.

/** `'#rrggbb'` → o mesmo tom com alfa ZERO. É o fim de todo gradiente radial daqui — ver `paintSun`. */
function rgba0(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',0)';
}

/** Largura da textura do céu. 64 basta para um gradiente (ele é constante em x); um SOL precisa da tela toda. */
export function skyWidth(T: SceneryTheme): number { return T.sol ? LOGICAL_W : 64; }

/**
 * Onde cada cor do céu cai, em PIXELS de altura. Separado do desenho porque é a parte que se pode AFERIR: o
 * desenho precisa de um canvas, esta conta não, e é ela que decide se o vermelho do pôr do sol vai parar na
 * linha do horizonte ou atrás dos morros.
 */
export function skyStops(cores: readonly string[], h: number = LOGICAL_H): { y: number; cor: string }[] {
  const n = cores.length;
  return cores.map((cor, i) => ({ y: n === 1 ? 0 : (h * i) / (n - 1), cor }));
}

/**
 * Sol baixo e leque de raios, DENTRO da textura do céu (e não numa camada própria).
 *
 * Aqui e não em `render/scene-sky` de propósito: o sol pertence ao FUNDO mais distante, e é na textura do céu
 * que ele herda de graça as duas coisas que o fazem parecer distante — a rolagem de fator 0,10 (ele quase não
 * anda) e o recolor de alto contraste (viz-setters repinta a textura crua; um sol desenhado por fora ficaria
 * de fora do recolor e brilharia em amarelo no modo de contraste, que é exatamente o que a opção existe para
 * eliminar).
 *
 * O leque aponta para CIMA, com abertura de ±35°, e cada raio desbota até zero por um gradiente radial. As
 * duas coisas juntas mantêm o desenho longe das bordas da textura: um raio cortado na borda reapareceria do
 * outro lado a cada repetição do azulejo, e essa emenda é o defeito mais visível que um céu pode ter.
 */
export function paintSun(c: CanvasRenderingContext2D, w: number, h: number, sol: Sol): void {
  const sx = w * sol.x, sy = h * sol.y, reach = h * 0.85;
  // O fim do gradiente é A MESMA COR com alfa 0, e não `transparent`/branco transparente: o canvas interpola
  // os quatro canais, então desbotar para branco-transparente passa por um branco leitoso a meio caminho — um
  // halo pálido em volta do sol, que é o oposto do que um pôr do sol faz.
  const halo = c.createRadialGradient(sx, sy, 0, sx, sy, reach);
  halo.addColorStop(0, sol.cor); halo.addColorStop(1, rgba0(sol.cor));
  c.save();
  c.globalAlpha = 0.10; c.fillStyle = halo;
  for (let i = 0; i < 9; i++) {
    // Larguras alternadas (largo/estreito): raios de mesma espessura em leque regular leem como uma roda de
    // bicicleta. A irregularidade é o que os faz parecer luz atravessando nuvem.
    const meio = -Math.PI / 2 + (i - 4) * (Math.PI * 70 / 180) / 8, meia = (i % 2 ? 0.9 : 2.2) * Math.PI / 180;
    c.beginPath(); c.moveTo(sx, sy);
    c.lineTo(sx + Math.cos(meio - meia) * reach, sy + Math.sin(meio - meia) * reach);
    c.lineTo(sx + Math.cos(meio + meia) * reach, sy + Math.sin(meio + meia) * reach);
    c.closePath(); c.fill();
  }
  // Brilho em volta do disco e o disco: é o disco que ancora os raios: sem ele o leque não tem de onde sair.
  const brilho = c.createRadialGradient(sx, sy, 0, sx, sy, 26);
  brilho.addColorStop(0, sol.cor); brilho.addColorStop(1, rgba0(sol.cor));
  c.globalAlpha = 0.55; c.fillStyle = brilho; c.beginPath(); c.arc(sx, sy, 26, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 1; c.fillStyle = sol.cor; c.beginPath(); c.arc(sx, sy, 8, 0, Math.PI * 2); c.fill();
  c.restore();
}

/** Theme sky: vertical gradient over `T.sky` (evenly spaced stops), plus the theme's sun when it has one. */
export function themeSkyTexture(T: SceneryTheme): unknown {
  const w = skyWidth(T), h = LOGICAL_H, cv = makeCanvas(w, h), c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, h);
  for (const p of skyStops(T.sky, h)) g.addColorStop(p.y / h, p.cor);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  if (T.sol) paintSun(c, w, h, T.sol);
  return tex(cv);
}

/* ===================== silhuetas por tema ===================== */
//
// AS DUAS FAIXAS DE MORRO ERAM LISAS. Elas já parallaxavam — o que faltava era CONTEÚDO: uma floresta e um
// cemitério tinham exatamente o mesmo desenho, só que em cores diferentes. Isto acrescenta a silhueta que
// distingue um do outro, na MESMA cor da faixa: é recorte contra o céu, não pintura.
//
// PURO E DETERMINÍSTICO, e isso não é preferência. Sem `Math.random`, a mesma fase desenha o mesmo horizonte
// em toda partida e em toda máquina — o que a torna testável (dá para AFERIR a silhueta) e o que impede a
// arte de tremer entre dois quadros do mesmo cenário. A variação vem de `hash(x)`, que é sujeira reprodutível.

/** Ruído reprodutível em [0,1) a partir de um inteiro. Substitui `Math.random` onde a arte precisa variar. */
export function hash01(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Desenha UM elemento de silhueta. `topo` é a linha do morro naquele x; tudo cresce para cima a partir dela. */
type Elemento = (c: CanvasRenderingContext2D, x: number, topo: number, alt: number) => void;

/** Conífera: tronco fino e três saias triangulares. Lê como "mata fechada" mesmo com 6 px de largura. */
const conifera: Elemento = (c, x, topo, alt) => {
  c.fillRect(x - 1, topo - alt * 0.25, 2, alt * 0.25);
  for (let i = 0; i < 3; i++) {
    const y = topo - alt * (0.25 + i * 0.25), meia = (alt * 0.30) * (1 - i * 0.22);
    c.beginPath(); c.moveTo(x, y - alt * 0.30); c.lineTo(x + meia, y); c.lineTo(x - meia, y); c.closePath(); c.fill();
  }
};

/** Árvore redonda: tronco curto e copa em bloco arredondado — o campo, não a mata. */
const frondosa: Elemento = (c, x, topo, alt) => {
  c.fillRect(x - 1, topo - alt * 0.45, 2, alt * 0.45);
  c.beginPath(); c.arc(x, topo - alt * 0.68, alt * 0.34, 0, Math.PI * 2); c.fill();
};

/** Poste de cerca com duas travessas — dá escala humana ao campo, que é o que o diferencia da mata. */
const cerca: Elemento = (c, x, topo, alt) => {
  c.fillRect(x - 1, topo - alt, 2, alt);
  c.fillRect(x - 1, topo - alt * 0.75, 14, 1);
  c.fillRect(x - 1, topo - alt * 0.45, 14, 1);
};

interface Silhueta { el: Elemento; passo: number; alt: [number, number] }

/**
 * O MESMO CAMPO EM TRÊS HORAS DO DIA. `campo`, `cemiterio` e `espaco` são "Dia no Campo", "Amanhecer no Campo"
 * e "Noite no Campo" — é o que a criança lê, e é a decisão do Dev. Os IDS MENTEM: sobraram de quando os temas
 * eram cemitério e espaço, e ninguém que leia só o código adivinha isso. (Eu quase plantei lápides num
 * amanhecer por causa deles; a correção veio do Dev, não do arquivo.) Renomear os ids é migração de dado
 * persistido — `incl_cenario` e as gravações de demonstração guardam esses nomes —, então fica para uma
 * rodada própria, e este comentário é a rede até lá.
 *
 * Consequência de desenho, e ela simplifica: os três compartilham A MESMA SILHUETA, porque é a mesma terra.
 * O que muda entre o dia, o amanhecer e a noite é a LUZ, e a luz já está nas cores que cada tema declara.
 * Silhuetas diferentes fariam parecer três lugares; iguais, fazem parecer um lugar e três horários.
 *
 * `passo` é o espaçamento médio; `alt` a faixa de altura em px. A faixa da FRENTE leva elementos maiores e
 * mais juntos — é a que passa mais rápido, e esse contraste de densidade é o que dá profundidade sem custar
 * uma terceira camada.
 */
const CAMPO = { far: { el: frondosa, passo: 96, alt: [10, 16] as [number, number] },
                near: { el: cerca, passo: 46, alt: [7, 9] as [number, number] } };

export const SILHOUETTES: Readonly<Record<string, { far?: Silhueta; near?: Silhueta }>> = {
  campo: CAMPO,      // Dia no Campo
  cemiterio: CAMPO,  // Amanhecer no Campo — mesmo campo, outra luz
  espaco: CAMPO,     // Noite no Campo — idem
  // AJUSTADO DEPOIS DE VER NA TELA. Os números antigos (far 14–22, near 22–34) faziam as DUAS faixas
  // terminarem no mesmo y: com `baseY` 12 px mais baixo na da frente, as duas silhuetas encostavam no mesmo
  // topo e liam como UMA. A conta confirmou o que a imagem mostrou — topo 72 nas duas.
  // Agora a de trás é uma MATA FECHADA distante (baixa e densa) e a da frente são TRONCOS individuais
  // (altos e esparsos). A profundidade vem do contraste entre parede e indivíduo, não de 12 px de deslocamento.
  floresta:  { far: { el: conifera, passo: 18, alt: [8, 13] }, near: { el: conifera, passo: 46, alt: [30, 46] } },
};

/**
 * Theme hills band (v3 drawHillBand): double sine, transparent above the silhouette. `near` = the front band.
 * `tema` escolhe a silhueta plantada em cima da faixa; sem tema conhecido, sai a faixa lisa de antes.
 */
/* ===================== os prédios (a Cidade) ===================== */
//
// O SKYLINE, POR REGRA (ADR-0042) — e esta é a SEGUNDA versão, porque a primeira estava errada de três
// jeitos que só apareceram na tela. Vale registrar os três, porque cada um é uma lição sobre medir:
//
//   1. LI DUAS CORES DE PRÉDIO COMO "JANELA". As duas que chamei de acesa/apagada (`#6b7e98` e `#6e809b`,
//      na camada do meio) são o SEGUNDO TOM DE MASSA — os prédios que ficam ATRÁS. As luzes de verdade são
//      QUENTES (R > B) e somam 5,4% da camada próxima, 0,28% da média e 0,04% da distante. Eu contei
//      frequência e nunca perguntei o que a cor ERA.
//   2. DESENHEI TODAS AS CÉLULAS. No original não existe janela apagada: a apagada é a parede. Pintar toda
//      célula em dois tons quase iguais produz exatamente o dither cinza que a primeira versão produziu.
//   3. ASSUMI TOPO RETO. O perfil da camada próxima tem 97 eventos em 400 px — agulhas, recuos, escadas,
//      caixas de água. Um retângulo por prédio joga a silhueta inteira fora.
//
// Janelas medidas: 2 px de largura por 3 a 5 de altura (263 delas na camada próxima), não pontos 2x2.
//
// Determinístico por `hash01`: a mesma semente devolve o mesmo skyline, e é isso que deixa testar a imagem
// sem olhar para ela.

/** Um estilo de topo. Desenha ACIMA de `topo`, na cor que já está em `c.fillStyle`. */
type Telhado = (c: CanvasRenderingContext2D, x: number, larg: number, topo: number, r: (n: number) => number) => void;

/**
 * O vocabulário de topos, como TABELA — mesma forma do `SILHOUETTES` dos morros.
 *
 * A distribuição importa mais que os desenhos: `reto` precisa ser o comum, senão a linha do horizonte vira
 * uma serra de brinquedo. Ver `TELHADO_POR_SORTE` abaixo.
 */
const TELHADOS: Record<string, Telhado> = {
  /** Laje. O caso comum, e é ele que faz os outros lerem como evento. */
  reto: () => { /* nada acima da laje */ },

  /** Recuo: um bloco mais estreito em cima. O prédio afina no último terço. */
  recuo: (c, x, larg, topo, r) => {
    const ins = 2 + Math.floor(r(1) * 3);
    if (larg - ins * 2 < 4) return;
    const alt = 5 + Math.floor(r(2) * 9);
    c.fillRect(x + ins, topo - alt, larg - ins * 2, alt);
  },

  /** Escada: dois a quatro degraus estreitando para cima — o topo piramidal do art déco. */
  escada: (c, x, larg, topo, r) => {
    let ins = 0, y = topo;
    const degraus = 2 + Math.floor(r(3) * 3), passo = Math.max(1, Math.round(larg * 0.13));
    for (let i = 0; i < degraus; i++) {
      ins += passo;
      const lg = larg - ins * 2;
      if (lg < 2) break;
      const alt = 2 + Math.floor(r(4 + i) * 3);
      c.fillRect(x + ins, y - alt, lg, alt);
      y -= alt;
    }
  },

  /** Mastro: a agulha fina, às vezes com travessa. É o evento mais alto da silhueta. */
  mastro: (c, x, larg, topo, r) => {
    const alt = 9 + Math.floor(r(5) * 15), mx = x + Math.floor(larg / 2);
    c.fillRect(mx, topo - alt, 1, alt);
    if (r(6) < 0.5) c.fillRect(mx - 2, topo - alt + 3 + Math.floor(r(7) * 4), 5, 1);
  },

  /** Antenas: duas ou três hastes de alturas diferentes, agrupadas. */
  antenas: (c, x, larg, topo, r) => {
    const n = 2 + Math.floor(r(8) * 2);
    for (let i = 0; i < n; i++) {
      const ax = x + 2 + Math.floor(r(9 + i) * Math.max(1, larg - 4));
      const alt = 4 + Math.floor(r(12 + i) * 9);
      c.fillRect(ax, topo - alt, 1, alt);
    }
  },

  /** Caixa de água: a caixinha sobre pernas, deslocada do centro. */
  caixa: (c, x, larg, topo, r) => {
    const cl = 4 + Math.floor(r(15) * 4), ca = 3 + Math.floor(r(16) * 3);
    if (larg < cl + 4) return;
    const cx = x + 2 + Math.floor(r(17) * (larg - cl - 3));
    c.fillRect(cx, topo - ca - 2, cl, ca);
    c.fillRect(cx + 1, topo - 2, 1, 2);
    c.fillRect(cx + cl - 2, topo - 2, 1, 2);
  },

  /** Cúpula: fatias estreitando, arredondando a laje. */
  domo: (c, x, larg, topo, r) => {
    const raio = Math.min(5, Math.floor(larg / 3));
    void r;
    if (raio < 2) return;
    for (let i = 0; i < raio; i++) {
      c.fillRect(x + Math.floor(larg / 2) - (raio - i), topo - 1 - i, (raio - i) * 2, 1);
    }
  },
};

/**
 * A sorte para o estilo. `reto` fica com 44% porque a linha do horizonte precisa de descanso entre eventos;
 * `mastro` e `domo` são raros de propósito — são os que a vista procura, e um a cada dez prédios já lê como
 * "aquela torre".
 */
const TELHADO_POR_SORTE: readonly (readonly [number, string])[] = [
  [0.44, 'reto'], [0.62, 'recuo'], [0.74, 'escada'], [0.84, 'caixa'], [0.93, 'antenas'], [0.97, 'mastro'], [1.01, 'domo'],
];

function telhadoDe(sorte: number): Telhado {
  for (const [ate, nome] of TELHADO_POR_SORTE) if (sorte < ate) return TELHADOS[nome]!;
  return TELHADOS.reto!;
}

/**
 * UMA BANDA de prédios — uma profundidade dentro de uma camada de parallax.
 *
 * DUAS COISAS AQUI VIERAM DE OLHAR A TELA, não de medir o arquivo, e é honesto dizer qual é qual:
 *
 *   · A TORRE MARCANTE. Uma em cada onze sobe MUITO acima da multidão e ganha um topo dramático. O original
 *     tem três ou quatro dessas — a agulha, a torre escalonada, a cúpula —, e são elas que a vista procura.
 *     Sem isso a linha do horizonte fica plana mesmo com os topos variando, que foi o que a 2a versão fez.
 *   · O PAINEL DE JANELAS. As janelas do original não cobrem a fachada: formam BLOCOS pequenos e densos, em
 *     parte dos prédios. Espalhar luz por toda a fachada com probabilidade baixa dá ruído; concentrá-la em
 *     painéis dá prédio. A 2a versão fez o primeiro e virou parede de luz.
 */
function desenharBanda(
  c: CanvasRenderingContext2D, w: number, h: number,
  cor: string, topos: readonly [number, number], largs: readonly [number, number],
  base: number, semente: number, luz: readonly string[] | undefined, aceso: number,
): void {
  // A LINHA SÓLIDA, de uma vez só e ANTES dos prédios: abaixo dela o original não tem vão nenhum — é onde a
  // cidade some na bruma do chão. Desenhá-la por prédio, como a versão anterior fazia, tapava os vãos e
  // matava a profundidade que eles dão.
  c.fillStyle = cor;
  c.fillRect(0, base, w, h - base);

  const [topoAlto, topoBaixo] = topos;
  const [largMin, largMax] = largs;
  let x = 0;
  while (x < w) {
    const r = (k: number): number => hash01(x * 131 + k * 7919 + semente);
    const marcante = r(35) < 0.09;
    const larg = Math.round(largMin + r(0) * (largMax - largMin));
    const largura = x + larg > w - largMin ? w - x : larg;
    const topo = marcante
      ? Math.max(6, Math.round(topoAlto - 8 - r(36) * 26))
      : Math.round(topoAlto + r(30) * (topoBaixo - topoAlto));

    c.fillStyle = cor;
    c.fillRect(x, topo, largura, h - topo);
    // A torre marcante nunca recebe laje reta: ela existe para ser o evento da silhueta.
    telhadoDe(marcante ? 0.74 + r(37) * 0.27 : r(31))(c, x, largura, topo, r);

    if (luz && luz.length > 0) desenharPaineis(c, h, x, largura, topo, base, semente, luz, aceso, r);

    // O VÃO, e ele é o que separa prédio de parede. A versão anterior encostava tudo, e por isso a fileira
    // da frente cobria a de trás por inteiro: abaixo da metade a camada virava um bloco só, com as janelas
    // boiando nele. A medição do original diz o contrário — em `c2.png`, na linha y=148, a fileira da frente
    // ocupa 279 das 400 colunas, a de trás aparece em 76 e 45 ficam vazias. É por esses vãos que a cidade
    // ganha profundidade.
    x += largura + (r(38) < 0.55 ? 0 : 3 + Math.floor(r(39) * 10));
  }
}

/**
 * Os PAINÉIS de janela de um prédio: de zero a três blocos densos, e não uma fachada peneirada.
 *
 * Dentro de um painel a maioria das células acende — é assim que o original lê, e é o que faz um prédio
 * parecer um prédio com gente dentro em vez de uma textura.
 */
function desenharPaineis(
  c: CanvasRenderingContext2D, h: number,
  x: number, largura: number, topo: number, base: number,
  semente: number, luz: readonly string[], aceso: number, r: (n: number) => number,
): void {
  if (largura < 8) return;
  // A DENSIDADE É CALIBRADA, não escolhida: a fração de pixel QUENTE de cada camada do original foi medida
  // (5,41% na de perto, 0,28% na do meio, 0,04% na bruma) e `aceso` é ajustado até a textura gerada bater.
  // A primeira calibragem saiu INVERTIDA — luz demais nas distantes e de menos na de perto —, e uma cidade
  // com o brilho no lugar errado perde a profundidade inteira, que é o que a luz está ali para dar.
  const quantos = aceso <= 0.06
    ? (r(40) < aceso * 14 ? 1 : 0)                       // bruma e camada média: um painel raro, ou nenhum
    : 1 + Math.floor(r(40) * (1 + aceso * 4));           // de perto: um a quatro
  const ja = 3 + Math.floor(r(41) * 3);                  // 3..5 px de altura, como no original
  const passoX = 4 + Math.floor(r(42) * 2);              // 4 ou 5 — muda por prédio
  const passoY = ja + 2;
  const colunas = Math.floor((largura - 4) / passoX);
  if (colunas < 1) return;

  for (let p = 0; p < quantos; p++) {
    const cw = 1 + Math.floor(r(43 + p) * Math.min(colunas, 1 + aceso * 7));
    const ch = 2 + Math.floor(r(46 + p) * (2 + aceso * 9));
    const c0 = Math.floor(r(49 + p) * (colunas - cw + 1));
    const topoPainel = Math.max(topo + 3, base - 58);
    const linhas = Math.max(1, Math.floor((h - 4 - topoPainel) / passoY));
    const l0 = Math.floor(r(52 + p) * Math.max(1, linhas - ch + 1));
    // Densidade ALTA dentro do painel: é o contrário de espalhar pouca luz por toda a fachada.
    const densidade = 0.55 + r(55 + p) * 0.4;
    for (let l = l0; l < Math.min(l0 + ch, linhas); l++) {
      for (let k = c0; k < Math.min(c0 + cw, colunas); k++) {
        const jx = x + 2 + k * passoX, jy = topoPainel + l * passoY;
        if (jy + ja > h - 2) continue;
        if (hash01(jx * 3571 + jy * 97 + semente) >= densidade) continue;
        c.fillStyle = luz[Math.floor(hash01(jx * 17 + jy * 31 + semente) * luz.length) % luz.length]!;
        c.fillRect(jx, jy, 2, ja);
      }
    }
  }
}

/**
 * Uma camada inteira: a banda do FUNDO (tom claro, mais alta, mais simples) e a da FRENTE por cima.
 *
 * As duas profundidades são o que o original tem e a primeira versão não tinha — sem elas a camada é uma
 * fileira só, e a cidade perde o ar de cidade.
 *
 * Exportada para o teste: o contexto entra por parâmetro, como em `paintSun`, e um contexto falso que grava
 * os `fillRect` deixa afirmar as propriedades da faixa sem navegador nenhum.
 */
export function drawBuildings(c: CanvasRenderingContext2D, w: number, h: number, faixa: BuildingBand, semente: number): void {
  desenharBanda(c, w, h, faixa.corpo[0]!, faixa.topoFundo, faixa.largura, faixa.base,
    semente + 4517, faixa.luz, (faixa.aceso ?? 0) * 0.45);
  desenharBanda(c, w, h, faixa.corpo[1]!, faixa.topo, faixa.largura, faixa.base,
    semente, faixa.luz, faixa.aceso ?? 0);
}

/**
 * Camada 0 da Cidade: o céu inteiro E os prédios distantes assados nele.
 *
 * É a única camada OPACA das três, e é assim no original — o `c4.png` não tinha transparência nenhuma.
 */
export function themeCitySkyTexture(T: BuildingsTheme): unknown {
  const w = 1280, h = LOGICAL_H, cv = makeCanvas(w, h), c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, h);
  for (const p of skyStops(T.sky, h)) g.addColorStop(p.y / h, p.cor);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  drawBuildings(c, w, h, T.predios[0], 311);
  return tex(cv);
}

/** Camadas 1 e 2 da Cidade: prédios sobre TRANSPARÊNCIA, para o céu da camada 0 aparecer atrás. */
export function themeSkylineTexture(faixa: BuildingBand, semente: number): unknown {
  const w = 1280, h = LOGICAL_H, cv = makeCanvas(w, h), c = cv.getContext('2d')!;
  drawBuildings(c, w, h, faixa, semente);
  return tex(cv);
}

export function themeHillsTexture(T: HillsTheme, near: boolean, tema = ''): unknown {
  const w = 1280, h = LOGICAL_H, cv = makeCanvas(w, h), c = cv.getContext('2d')!;
  const horizon = Math.round(h * 0.5), baseY = horizon + (near ? 16 : 4);
  const linha = (x: number): number => Math.round(baseY - hillHeight(x, near));
  c.fillStyle = T.hills[near ? 1 : 0];
  for (let x = 0; x < w; x++) { const top = linha(x); c.fillRect(x, top, 1, h - top); }

  const sil = SILHOUETTES[tema]?.[near ? 'near' : 'far'];
  if (!sil) return tex(cv);
  // Planta na MESMA cor da faixa: o elemento não é um objeto pintado, é o próprio morro subindo.
  for (let x = 0; x < w; x += sil.passo) {
    const r = hash01(x + (near ? 977 : 131));
    const px = Math.round(x + r * sil.passo * 0.6);
    if (px < 4 || px > w - 20) continue; // margem: nada atravessa a emenda do azulejo horizontal
    const alt = sil.alt[0] + hash01(px * 31 + (near ? 7 : 3)) * (sil.alt[1] - sil.alt[0]);
    sil.el(c, px, linha(px) + 1, alt);
  }
  return tex(cv);
}
