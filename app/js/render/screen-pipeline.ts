// SPDX-License-Identifier: AGPL-3.0-or-later
// render/screen-pipeline — QUANTAS TELAS EXISTEM, ONDE ELAS FICAM, E O QUE CADA UMA GANHA DE OBJETO PIXI.
//
// Este módulo é o antigo `configureRender()` do main.js. Ele roda toda vez que o número de jogadores muda
// (`setNumPlayers`) e no reinício da rodada (`restartGame`), e é a única função do jogo que troca a TOPOLOGIA
// do render: de "uma câmera desenhada direto no stage" para "N render-textures, uma por jogador, cada uma
// virando um sprite posicionado na grade" — e de volta.
//
// ======================= É ENGINE, E NÃO DESTE JOGO =======================
// "N jogadores em telas SEPARADAS, sem split-screen" é o pilar 7 do ADR-0010: vale para os 35+ jogos da
// coleção EdSP, não só para *The Inclusionist*. Um segundo jogo reusaria isto INTEIRO — nada aqui sabe o que
// é uma moeda, um power-up, um portão ou uma área secreta. O que o módulo conhece é: um stage, um renderer,
// uma câmera, e a conta de `core/screens.ts`. Por isso ele mora em `render/`, ao lado de `render/viewports.ts`,
// e por isso todo o resto (o HUD, os filtros de a11y, as bolinhas) entra por INJEÇÃO, como callback — quem
// troca o pipeline não precisa saber o que mais o jogo quer refazer quando o pipeline troca.
//
// ======================= POR QUE UM ARQUIVO IRMÃO, E NÃO DENTRO DE render/viewports.ts =======================
// Os dois falam de "viewport", mas respondem a perguntas diferentes, e a diferença é justamente a fronteira:
//   · `render/viewports.ts` é a FÁBRICA DE IMAGEM — dado um MODO de visão acessível, como o pixel sai
//     (matriz de daltonismo, névoa de catarata, contorno do alto contraste). Ele CONSOME `vpTex` por getter e
//     nunca o cria. É uma pergunta sobre COR e FILTRO.
//   · aqui é a TOPOLOGIA — quantas render-textures existem, de que tamanho é o canvas, onde cada sprite fica,
//     onde a moldura é traçada, onde a bolinha indicadora é ancorada. É uma pergunta sobre GEOMETRIA e CICLO
//     DE VIDA (destruir o conjunto anterior antes de montar o novo).
// Fundir os dois daria um módulo cujo `ctx` teria ~25 campos e cujo nome só poderia ser "coisas de viewport",
// que é um tema, não uma responsabilidade — exatamente o argumento do cabeçalho de `input/touch-bindings.ts`.
// Há ainda um motivo mecânico: `viewports.ts` é quem LÊ `vpTex` (`getVpTex()`); este módulo é quem o
// REATRIBUI. Deixar leitor e escritor no mesmo arquivo apagaria a única pista de que aquele array troca de
// identidade a cada mudança de nº de telas — e é essa troca que obriga metade dos getters do projeto.
// O elo real entre os dois é estreito e explícito: `applyVpFilters()` e `updateVpDots()`, dois callbacks de
// ré-aplicação chamados no fim do caminho multi-tela.
//
// ======================= A PARTE PURA: PLANEJAR ≠ CONSTRUIR =======================
// O bloco original trançava a conta da grade com as chamadas do PIXI. Aqui a conta saiu inteira para
// `planScreens(n)`, que devolve, sem tocar em nada: o tamanho do canvas, e para cada tela a sua posição, o
// retângulo da moldura e a âncora da bolinha. `configureRender()` vira execução de um plano.
// É `planScreens` que carrega as três regras que ninguém enxergava no meio dos `new PIXI.Sprite`:
//   · a grade vem de `core/screens.ts` (`screenGrid`) — a MESMA fonte do layout, do HUD e do CRT. A cópia que
//     vivia aqui era a quinta, e era a DIVERGENTE (`cols = n<=2 ? n : 2`, sem a guarda de `n<=1`);
//   · com 3 telas, a terceira é CENTRALIZADA na linha de baixo — `x = (LOGICAL_W*cols - LOGICAL_W)/2`;
//   · a moldura é traçada em meio pixel (`+0.5`) e 1px menor nos dois lados, senão a linha de 1px lógico sai
//     borrada ou comida pela borda do canvas quando a escala inteira multiplica tudo.
//
// ======================= O QUE FICOU DE FORA =======================
//  · `buildGameHud`, `applyVpFilters`, `updateVpDots` e `setMinimapVisible` são CALLBACKS. O HUD é DOM
//    sobreposto (ui/hud.ts), os filtros são política de a11y (render/viz-setters.ts) e o minimapa é outro
//    subsistema; este módulo só sabe QUANDO eles precisam rodar de novo, não COMO.
//  · quem cria `camera` e solda o z-order dela continua sendo o main.js. Daqui só se move a câmera entre
//    "filha do stage" (tela única) e "órfã, desenhada à mão nas render-textures" (multi-tela).
//  · o LAÇO de render por viewport (quem chama `renderer.render(camera,{renderTexture:vpTex[i]})` a cada
//    quadro) é de `render/draw.ts`. Aqui se monta a infraestrutura; lá ela é usada.
//
// ======================= ARMADILHAS DE ORDEM DE BOOT =======================
//  · `applyVpFilters` e `updateVpDots` são `const` desestruturados de `initVizSetters`, ~300 linhas ABAIXO do
//    ponto onde este init cabe. Por isso entram no `ctx` como SETAS PREGUIÇOSAS (`() => applyVpFilters()`):
//    passá-los por valor derrubaria o boot na TDZ. Isso é seguro porque `configureRender` NUNCA é chamado
//    durante o boot — só por `setNumPlayers`/`restartGame` (game/session.ts), que só rodam a partir de um
//    clique ou do início de partida, muito depois do módulo inteiro ter avaliado.
//  · `vpTex`/`vpSpr`/`vpFrames`/`vpDots` são `let` do main.js que ESTE módulo reatribui, e que outros três
//    módulos leem por getter (`viewports`, `viz-setters`, `draw`). Por isso o `ctx` traz o par getter+setter
//    de cada um, em vez de o módulo ser dono dos arrays: se ele fosse dono, o main.js teria de trocar os
//    quatro getters que já distribuiu, e a religação deixaria de ser local.
//  · SEM I/O no import: nada de `document`, nada de canvas no corpo. `planScreens` é aritmética pura e roda no
//    project `node`; tudo que toca PIXI só acontece dentro de `configureRender()`.
//
// PIXI entra por INTERFACE ESTRUTURAL, e não por `import * as PIXI` — mesmo precedente de render/viewports,
// render/scene-sky e game/traffic. Aqui o motivo é mais forte do que o de costume: este é o módulo que mais
// mexe em tipos concretos do engine (`RenderTexture`, `Sprite`, `Graphics`, `SCALE_MODES`), e é exatamente
// isso que o obrigaria a arrastar 445KB de PixiJS para dentro do project `node` do Vitest se importasse.

import { LOGICAL_W, LOGICAL_H } from '../core/constants.js';
import { screenGrid } from '../core/screens.js';
import type { CriarSprite, CriarDesenho, ComFiltro, DesenhoComCirculo } from './port.js';

/* ===================== a parte PURA: o plano da grade ===================== */

/** Retângulo em pixels lógicos. */
export interface Rect { x: number; y: number; w: number; h: number }

/** Onde uma tela fica e o que se desenha em volta dela. */
export interface ViewportPlacement {
  /** Canto superior esquerdo do sprite da tela, no canvas. */
  x: number;
  y: number;
  /** Retângulo da moldura (meio pixel para dentro, 1px menor nos dois lados — ver o cabeçalho). */
  frame: Rect;
  /** Âncora da bolinha indicadora do modo de visão (canto superior DIREITO da tela, para dentro). */
  dot: { x: number; y: number };
}

/** O plano completo de render para `n` jogadores. */
export interface ScreenPlan {
  /** `true` = caminho de TELA ÚNICA: a câmera vai direto no stage, sem render-texture nenhuma. */
  single: boolean;
  cols: number;
  rows: number;
  /** Tamanho a que o renderer é redimensionado. */
  canvas: { w: number; h: number };
  /** Uma entrada por tela — VAZIO no caminho de tela única, que não tem viewport. */
  viewports: ViewportPlacement[];
}

/** Cor da moldura de tela (o mesmo cinza-azulado da borda do canvas em tela única). */
export const FRAME_COLOR = 0xcdd6f2;
/** Opacidade da moldura. */
export const FRAME_ALPHA = 0.95;
/** Espessura da moldura, em pixels LÓGICOS (escala junto com o canvas). */
export const FRAME_WIDTH = 1;
/** Recuo da bolinha indicadora a partir da borda direita da tela. */
export const DOT_INSET_X = 9;
/** Recuo da bolinha indicadora a partir do topo da tela. */
export const DOT_INSET_Y = 9;

/**
 * A geometria de render para `n` jogadores, sem tocar em nada.
 *
 * `n <= 1` devolve `single: true` e NENHUM viewport: em tela única a câmera é filha do stage e o PIXI desenha
 * direto no canvas — não há render-texture, nem moldura, nem bolinha (o indicador de modo de visão de tela
 * única é outro, no DOM).
 *
 * `w`/`h` são parâmetros com o pixel canônico (320×180, ADR-0010) por padrão — não para o jogo trocá-los, mas
 * para a conta ser conferível com números pequenos no teste.
 */
export function planScreens(n: number, w: number = LOGICAL_W, h: number = LOGICAL_H): ScreenPlan {
  const { cols, rows } = screenGrid(n); // fonte única: core/screens.ts (era a 5ª cópia, e a divergente)
  if (n <= 1) return { single: true, cols, rows, canvas: { w, h }, viewports: [] };

  const viewports: ViewportPlacement[] = [];
  for (let i = 0; i < n; i++) {
    let x = (i % cols) * w;
    const y = Math.floor(i / cols) * h;
    if (n === 3 && i === 2) x = (w * cols - w) / 2; // 3 telas: a 3ª centralizada na linha de baixo
    viewports.push({
      x, y,
      frame: { x: x + 0.5, y: y + 0.5, w: w - 1, h: h - 1 },
      dot: { x: x + w - DOT_INSET_X, y: y + DOT_INSET_Y },
    });
  }
  return { single: false, cols, rows, canvas: { w: w * cols, h: h * rows }, viewports };
}

/* ===================== interfaces estruturais (PIXI sem importar PIXI) ===================== */

/** O que se toca de um `PIXI.BaseTexture`: só o modo de escala (NEAREST = pixel art sem borrar). */
interface BaseTextureLike { scaleMode: number }
/** O que se toca de uma `PIXI.RenderTexture`: o baseTexture e o descarte (`true` = destrói a base junto). */
export interface RenderTextureLike { baseTexture: BaseTextureLike; destroy(destroyBase?: boolean): void }
/** `PIXI.RenderTexture` como FÁBRICA — é `RenderTexture.create({width,height})`, não um construtor. */
export interface RenderTextureFactory { create(opts: { width: number; height: number }): RenderTextureLike }
/** O mínimo de um objeto de cena posicionável e descartável. */
export interface DisplayLike { x: number; y: number; visible: boolean; destroy(): void }
/** `PIXI.Sprite` — aqui ele só nasce de uma render-texture e é posicionado.
 *  O `filters` NÃO é tocado aqui: quem põe filtro de GPU por tela é `render/viz-setters`, e é para lá que
 *  estes sprites vão (`getVpSpr`). A INVERSÃO DA FATIA MÍNIMA de novo — em posição de entrega, a fatia que
 *  vale é a de quem RECEBE, não a de quem lê. Ver o cabeçalho de `render/port`. */
export type SpriteLike = DisplayLike & ComFiltro;
/** `PIXI.Graphics` — a moldura desenha; as bolinhas só são posicionadas (quem as pinta é viz-setters).
 *  E é por serem pintadas LÁ que a declaração inclui o desenho inteiro: as bolinhas saem daqui por
 *  `getVpDots` e o `viz-setters` chama `clear`/`beginFill`/`drawCircle` nelas. */
export interface GraphicsLike extends DisplayLike, DesenhoComCirculo {}
/** `PIXI.Container` no papel de pai de cena. */
export interface ContainerLike {
  addChild(child: unknown): unknown;
  addChildAt(child: unknown, index: number): unknown;
  removeChild(child: unknown): unknown;
}
/** A câmera, vista daqui: só a sua PATERNIDADE importa (filha do stage ou órfã). */
export interface CameraLike { parent: ContainerLike | null }
/** `app.renderer` — daqui só se redimensiona o canvas. */
export interface ResizableRenderer { resize(w: number, h: number): void }

export interface ScreenPipelineCtx {
  /* --- PIXI por interface estrutural --- */
  RenderTexture: RenderTextureFactory;                    // PIXI.RenderTexture
  /** Fábricas, não construtores (Fase D): `new (texture: unknown)` não recebe o `PIXI.Sprite` real, cujo
   *  construtor só aceita `Texture`. Ver `CriarSprite` no cabeçalho de `render/port`. */
  criarSprite: CriarSprite<SpriteLike>;
  criarDesenho: CriarDesenho<GraphicsLike>;
  NEAREST: number;                                         // PIXI.SCALE_MODES.NEAREST

  /* --- a cena --- */
  stage: ContainerLike;        // app.stage
  renderer: ResizableRenderer; // app.renderer
  camera: CameraLike;          // o container do mundo (`const` do main.js; só a paternidade muda)

  /* --- estado vivo do main.js --- */
  getNumPlayers: () => number;                       // core/state.ts (reatribuído por setNumPlayers)
  getVpTex: () => RenderTextureLike[]; setVpTex: (a: RenderTextureLike[]) => void; // `let` do main.js: par getter+setter
  getVpSpr: () => SpriteLike[]; setVpSpr: (a: SpriteLike[]) => void;
  getVpFrames: () => GraphicsLike | null; setVpFrames: (g: GraphicsLike | null) => void;
  getVpDots: () => GraphicsLike[]; setVpDots: (a: GraphicsLike[]) => void;

  /* --- o que precisa rodar de novo quando a topologia muda (callbacks, não conhecimento) --- */
  setMinimapVisible: (on: boolean) => void; // render/minimap.ts — o minimapa só existe em tela única
  buildGameHud: () => void;                 // ui/hud.ts — um HUD em DOM por tela
  applyVpFilters: () => void;               // render/viz-setters.ts — SETA PREGUIÇOSA (TDZ; ver o cabeçalho)
  updateVpDots: () => void;                 // render/viz-setters.ts — idem
}

export interface ScreenPipelineApi {
  /** Remonta o pipeline de render para o nº de jogadores ATUAL. Idempotente: destrói o conjunto anterior. */
  configureRender(): void;
}

export function initScreenPipeline(ctx: ScreenPipelineCtx): ScreenPipelineApi {
  function configureRender(): void {
    // 1) descarte do conjunto anterior — SEMPRE, inclusive ao voltar para tela única, senão as render-textures
    //    da configuração passada ficariam na GPU sem ninguém para desenhá-las.
    ctx.getVpSpr().forEach((s) => s.destroy()); ctx.setVpSpr([]);
    ctx.getVpTex().forEach((t) => t.destroy(true)); ctx.setVpTex([]);
    const frames = ctx.getVpFrames();
    if (frames) { frames.destroy(); ctx.setVpFrames(null); }
    ctx.getVpDots().forEach((g) => g.destroy()); ctx.setVpDots([]);

    const plan = planScreens(ctx.getNumPlayers());

    // 2) tela única: a câmera volta a ser filha do stage (no fundo de tudo) e o PIXI desenha direto no canvas.
    if (plan.single) {
      if (ctx.camera.parent !== ctx.stage) ctx.stage.addChildAt(ctx.camera, 0);
      ctx.setMinimapVisible(true);
      ctx.renderer.resize(plan.canvas.w, plan.canvas.h);
      ctx.buildGameHud();
      return;
    }

    // 3) multi-tela: a câmera SAI da cena — passa a ser desenhada à mão, uma vez por viewport, dentro da
    //    render-texture de cada jogador (o laço em si é de render/draw.ts).
    if (ctx.camera.parent) ctx.camera.parent.removeChild(ctx.camera);
    ctx.setMinimapVisible(false); // minimapa é de tela única (não cabe replicado em 4 telas de 320×180)
    ctx.renderer.resize(plan.canvas.w, plan.canvas.h);

    const vpTex: RenderTextureLike[] = [], vpSpr: SpriteLike[] = [];
    for (const vp of plan.viewports) {
      const rt = ctx.RenderTexture.create({ width: LOGICAL_W, height: LOGICAL_H });
      rt.baseTexture.scaleMode = ctx.NEAREST; // pixel art: ampliar sem interpolar
      const s = ctx.criarSprite(rt); s.x = vp.x; s.y = vp.y;
      ctx.stage.addChild(s); vpTex.push(rt); vpSpr.push(s);
    }
    ctx.setVpTex(vpTex); ctx.setVpSpr(vpSpr);

    // moldura: uma linha por tela, num único Graphics (separa e enquadra como a borda da tela única)
    const vpFrames = ctx.criarDesenho();
    for (const vp of plan.viewports) {
      vpFrames.lineStyle(FRAME_WIDTH, FRAME_COLOR, FRAME_ALPHA);
      vpFrames.drawRect(vp.frame.x, vp.frame.y, vp.frame.w, vp.frame.h);
    }
    ctx.stage.addChild(vpFrames); ctx.setVpFrames(vpFrames);

    // bolinhas indicadoras do modo de visão: ACIMA de tudo e FORA da render-texture, portanto fora do filtro
    // do viewport — é por isso que elas continuam visíveis no modo cegueira (ver updateVpDots em viz-setters).
    ctx.setVpDots(plan.viewports.map((vp) => {
      const g = ctx.criarDesenho();
      g.x = vp.dot.x; g.y = vp.dot.y; g.visible = false;
      ctx.stage.addChild(g);
      return g;
    }));

    ctx.buildGameHud(); ctx.applyVpFilters(); ctx.updateVpDots();
  }

  return { configureRender };
}
