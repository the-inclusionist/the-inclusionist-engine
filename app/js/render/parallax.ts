// SPDX-License-Identifier: AGPL-3.0-or-later
// render/parallax — AS TRÊS CAMADAS DE FUNDO: onde cada uma fica, e de que tema ela é feita.
//
// Camada 1 do jogo é o tileset + o personagem. Atrás dele vêm três `TilingSprite`, e é isso que este módulo
// governa: quanto cada uma se desloca quando a câmera anda (`updateParallax`), e qual textura cada uma veste
// quando o cenário muda (`aplicarTemaParallax`). Nada mais — o tileset do mundo, o céu vivo da v3, o clima e a
// Cidade têm cada um o seu módulo, e nenhum deles passa por aqui.
//
// ======================= A ENTREGA: A CONTA SAIU DE DENTRO DO EFEITO =======================
// `updateParallax` era MATEMÁTICA PURA DISFARÇADA DE EFEITO. Dado (camX, camY) e os fatores de profundidade,
// existe UMA posição determinada para cada camada — mas no monólito essa posição só existia como o lado
// esquerdo de quatro atribuições dentro de um `for`, e a única forma de conferi-la era subir o jogo inteiro e
// olhar. Aqui a conta é `parallaxPositions(camX, camY, camadas, reduzido)`, uma função pura que devolve
// `{x, y, tileX, tileY}` por camada, e o `updateParallax` virou o carimbo dela nos sprites.
//
// O que essa separação torna verificável — e o que quebraria em SILÊNCIO sem ela:
//  1. A CONTRA-POSIÇÃO. Os três sprites vivem DENTRO do container `camera` (têm de viver: é assim que também
//     aparecem nas render-textures do multi-tela). O `camera` anda `-camX` a cada quadro; cada camada é posta
//     em `+camX` para cancelar exatamente esse movimento e ficar PARADA na tela. É o cancelamento que faz o
//     fundo parecer fundo. Inverta o sinal e o céu passa a correr com o dobro da velocidade do mundo, na
//     direção errada — o jogo continua rodando, os testes de física continuam verdes, e só quem olhar percebe.
//  2. A PROPORCIONALIDADE. O `tilePosition` de cada camada rola por `-camX * fator`. Camada mais distante
//     (fator menor) se mexe MENOS. Ignorar o fator (ou trocá-lo entre duas camadas) achata a profundidade sem
//     erro nenhum em lugar nenhum.
//  3. O MOVIMENTO REDUZIDO. Com `rm.parallax` ligado (acessibilidade: gatilho vestibular), o `tilePosition`
//     trava em zero — o fundo vira papel de parede — MAS a contra-posição continua valendo. Trocar essa ordem
//     (travar `x`/`y` em vez do `tilePosition`) grudaria o fundo no mundo e produziria exatamente o
//     deslizamento que a opção existe para eliminar, para a pessoa que pediu para não ver deslizamento.
//
// ======================= POR QUE A FRONTEIRA CAIU AQUI, E NÃO ANTES NEM DEPOIS =======================
// ANTES (o dado dos temas) saiu para render/cenario-data.ts: as cores não são geometria de câmera, e são
// lidas por scene-sky e pelo attract, que não têm nada a ver com rolagem. `PARALLAX` FICOU aqui, e não lá,
// porque os fatores não variam por tema — são a definição de "o que é fundo" — e porque a conta que os
// consome é a deste arquivo.
// DEPOIS (a orquestração da troca de cenário) ficou em render/set-cenario.ts. `setCenario` faz TRÊS coisas:
// repinta o fundo, RECONSTRÓI A TEXTURA DO MUNDO a partir dos PNG de tile do tema, e avisa a vida ambiente e
// o alto contraste. Só a primeira é parallax. Trazer as outras duas para cá daria a este módulo a textura do
// tileset — que não é fundo, é a Camada 1 — e o ciclo de vida do alto contraste. Por isso `aplicarTemaParallax`
// mora aqui e é CHAMADO de lá: este módulo sabe vestir as três camadas e não sabe por quê.
//
// ======================= A PARTE IMPURA, E O QUE ELA GUARDA =======================
// `aplicarTemaParallax` tem duas metades assimétricas, e a assimetria é o ponto:
//  · Tema `v3` (Campo/Amanhecer/Noite/Floresta): as texturas são GERADAS na hora (render/scene-parallax), de
//    forma síncrona. Não há espera, logo não há corrida.
//  · Cidade (`v3:false`): as três texturas são PNG baixados, e chegam quando chegarem. Entre o pedido e a
//    chegada a pessoa pode ter trocado de cenário de novo — por isso cada callback abre com
//    `if (getCenario() !== theme) return`. Sem essa guarda, um PNG atrasado da Cidade sobrescreveria o céu do
//    tema recém-escolhido. É a corrida mais fácil de introduzir e a mais difícil de reproduzir de mão, e é
//    por ela, mais do que por qualquer outra coisa, que esta metade também entrou num módulo testável.
// Nos dois caminhos a ordem é a mesma e importa: grava em `texNormal` → invalida o cache de recolor
// (`clearParallaxTexCache`) → e SÓ pinta o sprite se o modo de visão for 'normal'. Nos modos acessíveis quem
// pinta é render/viz-setters, lendo a textura crua que acabamos de gravar; pintar aqui atropelaria o recolor.
//
// ======================= INJEÇÃO, INTERFACE ESTRUTURAL E ORDEM DE BOOT =======================
// Nada de `import * as PIXI`: declaramos só o que tocamos — um `TilingSprite` é, aqui, quatro campos
// (`x`, `y`, `texture`, `tilePosition`) e um construtor de três argumentos. É o precedente de
// render/scene-sky e render/viewports, e é o que deixa o módulo (e a factory INTEIRA, não só a parte pura)
// rodar no project `node`, com sprites de mentira e um `Image` falso.
// Pela mesma razão os três geradores de textura (`placeholderTex`/`skyTex`/`hillsTex`) entram INJETADOS em vez
// de importados de render/scene-parallax: eles chamam `makeCanvas`, e importá-los aqui obrigaria todo teste da
// factory a ter um `document`.
//  · `rm` entra por VALOR: é `const` no game.js, mutado in place pelo painel de movimento reduzido (mesma
//    decisão de render/draw.ts). Ler `rm.parallax` a cada quadro já vê o valor novo.
//  · `getCenario`/`getVizMode` entram por GETTER: são as mega-variáveis de core/state.js, REATRIBUÍDAS.
//  · `getDecorDeTela` é GETTER porque `starsG`/`skyDecoG`/`fogG` são declarados MUITO depois no game.js — o
//    monólito protegia isso com `typeof starsG!=='undefined'`. Aqui o game.js passa `() => [starsG, skyDecoG,
//    fogG]` (são `var`, logo içados) e a guarda por elemento fica deste lado.
//  · `createParallax` DEVOLVE `layers` e `texNormal` em vez de recebê-los: o game.js os mantém como `const`
//    desestruturados do retorno, e `texNormal` continua sendo o MESMO array que `initViewports` recebe por
//    VALOR — `aplicarTemaParallax` troca os ELEMENTOS in place, nunca o array.
//
// ⚠️ ORDEM DE BOOT: `createParallax` tem de rodar logo depois de `camera` existir e ANTES de qualquer coisa que
// dependa de `parallaxLayers` — o `camera.addChildAt(ts, i)` dá a ordem-z do fundo, e `starsG` é inserido
// relativamente a `parallaxLayers[1]`. E tem de rodar ANTES do `setCenario` do boot, que é quem veste as
// camadas com o tema salvo.
//
// SEM I/O NO IMPORT: o corpo do módulo declara `PARALLAX` e funções. Nenhum sprite é criado, nenhuma textura é
// gerada e nenhuma imagem é pedida até `createParallax`/`aplicarTemaParallax` serem chamados.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (D2-b).

import { LOGICAL_W, LOGICAL_H } from '../core/constants.js';
import type { SceneryTheme, HillsTheme, BuildingsTheme, BuildingBand } from './cenario-data.js';
import type { CreateTile } from './port.js';

/* ===================== os fatores de profundidade (dado) ===================== */

/** Uma camada de fundo: `factor` = quanto do movimento horizontal da câmera ela reproduz; `fy`, o vertical. */
export interface ParallaxLayer {
  key: string;    // nome de leitura ('sky'/'far'/'near') — documentação, não é usado no cálculo
  factor: number; // 0 = imóvel (infinitamente distante) · 1 = colada no mundo
  fy: number;     // 0 = parallax horizontal clássico (a textura tem a altura do viewport → sem repetição vertical)
}

/* Parallax: 3 camadas de FUNDO atrás do tileset (Camada 1 = tileset+personagem).
   Camada 4 (fator 0.10) é a mais distante e "quase não se mexe" — receberá a maior imagem possível do
   PixelLab. Vivem DENTRO do camera (contra-posicionadas p/ ficarem fixas na tela) para também aparecerem nas
   render-textures do multiplayer. tilePosition faz o scroll fracionado → ilusão de profundidade.
   A ORDEM do array é a ordem-z: índice 0 no fundo. */
export const PARALLAX: readonly ParallaxLayer[] = [
  { key: 'sky',  factor: 0.10, fy: 0 }, // Layer 4 — mais distante (céu/horizonte), maior imagem
  { key: 'far',  factor: 0.28, fy: 0 }, // Layer 3
  { key: 'near', factor: 0.52, fy: 0 }, // Layer 2 — mais próxima do tileset
];

/** Índice da camada → número do arquivo PNG da Cidade (`c4.png`, `c3.png`, `c2.png`). */
export const FILE_PER_LAYER: readonly number[] = [4, 3, 2];

/* ===================== a conta (pura) ===================== */

/** Onde uma camada fica neste quadro. `x`/`y` = posição DENTRO do camera; `tileX`/`tileY` = rolagem da textura. */
export interface ParallaxPosition { x: number; y: number; tileX: number; tileY: number }

/**
 * A matemática do parallax, sem sprite nenhum.
 *
 * `x`/`y` = `camX`/`camY` porque o container `camera` está em `-camX`/`-camY`: a soma dá ZERO, e a camada
 * fica parada na tela. É esse cancelamento que faz o fundo parecer fundo.
 * `tileX`/`tileY` = `-cam * fator`: quanto MENOR o fator, menos a textura rola, mais distante a camada parece.
 * Com `reduzido` (movimento reduzido — `rm.parallax`), a rolagem trava em zero e o fundo vira papel de
 * parede; a contra-posição CONTINUA valendo, senão o fundo passaria a deslizar junto com o mundo — o oposto
 * exato do que a opção existe para dar.
 */
export function parallaxPositions(
  camX: number,
  camY: number,
  camadas: readonly ParallaxLayer[] = PARALLAX,
  reduzido = false,
): ParallaxPosition[] {
  return camadas.map((p) => ({
    x: camX,
    y: camY,
    tileX: reduzido ? 0 : -camX * p.factor,
    tileY: reduzido ? 0 : -camY * p.fy,
  }));
}

/* ===================== interfaces estruturais (PIXI sem importar PIXI) ===================== */

/** `tilePosition` de um `TilingSprite` — só o `set`, que é como o original o escreve. */
interface PontoObservavel { set(x: number, y: number): void }
/** O que tocamos de um `PIXI.TilingSprite`, e só isso. */
export interface TilingSpriteLike {
  x: number; y: number; texture: unknown; tilePosition: PontoObservavel;
  /**
   * A ordem-z. Este módulo NÃO a lê — quem a escreve é a raiz de composição, ao encaixar as três camadas
   * no registro canônico do ADR-0020. Está aqui porque a interface é EXPORTADA: ela não descreve só o que
   * o parallax toca, descreve o que ele DEVOLVE, e o consumidor precisa deste campo para posicionar.
   */
  zIndex: number;
}
// O construtor virou FÁBRICA (Fase D): `new (tex: unknown)` não recebe o `PIXI.Azulejo` real, cujo
// construtor só aceita `Texture`. Por contravariância, prometer aceitar qualquer coisa é o que impede.
// Ver `CreateTile` no cabeçalho de `render/port`.
/** `camera` — só a inserção em posição de z fixa. */
interface ContainerLike { addChildAt(child: unknown, index: number): unknown }
/** `starsG`/`skyDecoG`/`fogG`: contra-posicionados junto com o parallax. */
interface PosicionavelLike { position: { set(x: number, y: number): void } }

export interface ParallaxCtx {
  /* --- render-graph (criados no game.js; a ordem-z é soldada lá) --- */
  camera: ContainerLike;          // container do mundo — as 3 camadas entram nos índices 0,1,2
  criarAzulejo: CreateTile<TilingSpriteLike>; // era `TilingSprite: TilingSpriteCtor`

  /* --- geradores de textura (render/scene-parallax): injetados, não importados, p/ rodar no project node --- */
  placeholderTex: (i: number) => unknown;                       // parallaxPlaceholder — fundo da Cidade sem PNG
  skyTex: (T: SceneryTheme) => unknown;                          // themeSkyTexture — gradiente do céu do tema
  /** themeHillsTexture — banda de morros. O `tema` escolhe a SILHUETA plantada em cima (árvores, cerca). */
  hillsTex: (T: HillsTheme, near: boolean, tema: string) => unknown;

  /** themeCitySkyTexture — céu + prédios distantes da Cidade, a única camada opaca dela. */
  citySkyTex: (T: BuildingsTheme) => unknown;
  /** themeSkylineTexture — uma faixa de prédios sobre transparência. */
  skylineTex: (faixa: BuildingBand, semente: number) => unknown;

  /* --- estado vivo --- */
  rm: { parallax?: boolean };        // `const` mutado in place (movimento reduzido) → VALOR
  getCenario: () => string;          // core/state.js — REATRIBUÍDO → getter (guarda de corrida do PNG)
  getVizMode: () => string;          // core/state.js — REATRIBUÍDO → getter
  clearParallaxTexCache: () => void; // render/viewports: invalida o recolor de alto contraste

  /* --- decor de TELA da v3, contra-posicionada junto (declarada DEPOIS no game.js → getter) --- */
  getDecorDeTela: () => ReadonlyArray<PosicionavelLike | null | undefined>;
}

export interface ParallaxApi {
  layers: TilingSpriteLike[];  // os 3 TilingSprite, na ordem-z
  texNormal: unknown[];        // as texturas CRUAS (fonte do recolor) — array ESTÁVEL, elementos trocados in place
  updateParallax(camX: number, camY: number): void;
  aplicarTemaParallax(theme: string, T: SceneryTheme): void;
}

/* ===================== a montagem + o carimbo (impuro) ===================== */

/** Cria as 3 camadas dentro do `camera` e devolve a API que as move e as veste. */
export function createParallax(ctx: ParallaxCtx): ParallaxApi {
  const layers: TilingSpriteLike[] = PARALLAX.map((_p, i) => {
    const ts = ctx.criarAzulejo(ctx.placeholderTex(i), LOGICAL_W, LOGICAL_H);
    ctx.camera.addChildAt(ts, i); // i=0 (sky) fica no fundo; depois far, near; tileset entra por cima
    return ts;
  });
  // texturas normais (recoloridas p/ o fundo no alto contraste). Array `const` no game.js: os ELEMENTOS mudam.
  const texNormal: unknown[] = layers.map((ts) => ts.texture);

  function updateParallax(camX: number, camY: number): void {
    const pos = parallaxPositions(camX, camY, PARALLAX, !!ctx.rm.parallax);
    for (let i = 0; i < layers.length; i++) {
      const ts = layers[i]!, q = pos[i]!;
      ts.x = q.x; ts.y = q.y;              // anula o camera → fixa na tela
      ts.tilePosition.set(q.tileX, q.tileY); // rolagem fracionada → profundidade (0,0 no movimento reduzido)
    }
    // L6: decor de TELA da v3 (estrelas atrás dos morros · nuvens/pássaros à frente · névoa na frente de tudo).
    // Guarda por elemento: no boot elas ainda não existem (eram o `typeof starsG!=='undefined'` do monólito).
    for (const g of ctx.getDecorDeTela()) { if (g) g.position.set(camX, camY); }
  }

  /** Grava a textura crua da camada `i`, invalida o recolor e — só no modo 'normal' — pinta o sprite. */
  function vestir(i: number, t: unknown): void {
    texNormal[i] = t;
    ctx.clearParallaxTexCache();
    if (ctx.getVizMode() === 'normal') layers[i]!.texture = t; // nos modos acessíveis quem pinta é viz-setters
  }

  /**
   * TODA TROCA DE TEMA É SÍNCRONA AGORA (ADR-0042), e isso é mais que uma simplificação.
   *
   * Enquanto a Cidade vinha de PNG, este caminho era assíncrono e carregava a corrida junto: três `Image`
   * baixando, e cada `onload` tendo de perguntar `getCenario() !== theme` antes de pintar, porque a criança
   * podia ter trocado de cenário no meio. Isso sumiu com os arquivos — não há mais o que baixar, e portanto
   * não há mais corrida que possa perder.
   */
  function aplicarTemaParallax(theme: string, T: SceneryTheme): void {
    const texs = T.fundo === 'predios'
      ? [ctx.citySkyTex(T), ctx.skylineTex(T.predios[1], 977), ctx.skylineTex(T.predios[2], 131)]
      : [ctx.skyTex(T), ctx.hillsTex(T, false, theme), ctx.hillsTex(T, true, theme)];
    layers.forEach((_ts, i) => vestir(i, texs[i]));
  }

  return { layers, texNormal, updateParallax, aplicarTemaParallax };
}
