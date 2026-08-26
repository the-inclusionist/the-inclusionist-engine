// SPDX-License-Identifier: AGPL-3.0-or-later
// render/set-cenario — TROCAR DE CENÁRIO: a única porta por onde o jogo muda de mundo visual.
//
// `setCenario(tema)` é chamado de quatro lugares muito diferentes — o splash (a criança escolhe antes de
// começar), a demonstração automática (game/attract.ts sorteia), o console de testes (`window.__incl`) e o
// BOOT (restauração do tema salvo em `incl_cenario`) — e sempre faz a mesma sequência de cinco passos. Esta
// função é ORQUESTRAÇÃO: ela não desenha nada, não gera textura nenhuma e não sabe fórmula alguma. Ela decide
// QUEM é avisado, EM QUE ORDEM, e o que fazer quando a resposta demora.
//
// ======================= POR QUE ISTO É UM MÓDULO, E NÃO FIAÇÃO NO game.js =======================
// A tentação era deixá-la no monólito como cola: quase toda linha dela chama alguém de fora, e o contexto
// injetado aqui é largo. Três coisas decidiram o contrário, e nenhuma delas é estética:
//
//  1. A GUARDA DE CORRIDA. Os tiles do tema (`tile_fill.png`/`tile_surface.png`) chegam quando chegarem, e
//     entre o pedido e a chegada a pessoa pode ter trocado de cenário de novo — no splash isso é UM segundo
//     de distância, e na demonstração automática o troca-troca é o comportamento normal. Por isso o `.then`
//     abre com `if (getCenario() !== theme) return`: um tileset atrasado do Campo não pode repintar o chão da
//     Floresta. É a espécie de defeito que aparece uma vez a cada cem trocas, some quando alguém vai olhar, e
//     não tem como ser reproduzido de mão com confiança. Fora de um módulo, ele não tem como ter teste.
//  2. A ORDEM DOS AVISOS. `setCenarioValue` (core/state.js — valor, persistência e evento) vem ANTES de
//     qualquer trabalho de textura, e é isso que faz a guarda de corrida do item 1 funcionar: quem compara
//     `getCenario() !== theme` está comparando com o valor que ESTA chamada gravou. Inverter as duas linhas
//     não quebra nada visível e desarma a guarda inteira, silenciosamente.
//  3. A VALIDAÇÃO. "Tema desconhecido → 'cidade'" é a rede que segura um `incl_cenario` de uma versão antiga
//     (e o boot ainda migra a chave 'noite' → 'espaco', do lado do game.js). Ela virou
//     `normalizarCenario` em render/cenario-data.ts, com o comportamento atual PREGADO por teste, defeito de
//     herança de protótipo incluído — ver o cabeçalho de lá.
//
// ======================= OS CINCO PASSOS, E POR QUE NESTA ORDEM =======================
//   1. valida o tema           → `normalizarCenario`
//   2. grava e persiste        → `setCenarioValue` (core/state.js). ANTES do resto: arma as guardas de corrida.
//   3. veste o FUNDO           → `aplicarTemaParallax` (render/parallax.ts) — síncrono nos temas v3, PNG na Cidade
//   4. pede os TILES do tema   → assíncrono; ao chegar, refaz a textura do MUNDO e reaplica os modos de visão
//   5. avisa quem depende      → vida ambiente da Cidade (síncrono) e alto contraste (síncrono)
// O passo 5 roda ANTES de o passo 4 terminar, e isso é de propósito: a vida ambiente e o recolor não esperam
// download nenhum. O passo 4 reaplica o recolor DE NOVO quando os tiles chegam, porque aí a textura do mundo
// mudou — os dois `reapplyVizAll` não são duplicação, são dois momentos.
//
// ======================= O QUE FICOU DE FORA, E POR QUÊ =======================
//  · O DADO dos temas → render/cenario-data.ts (folha, sem dependência). Importado aqui, não injetado: é um
//    módulo sem efeito nenhum, então importá-lo não cria risco de ordem de boot.
//  · A geometria e a pintura das 3 camadas de fundo → render/parallax.ts. Este módulo só chama
//    `aplicarTemaParallax` e não sabe o que é `tilePosition`.
//  · As FÓRMULAS de céu/morros/placeholder → render/scene-parallax.ts (desde o Estágio 4).
//  · O BUILDER da textura do mundo (`worldCanvas`) → render/world-tex.ts. Aqui só entra o resultado.
//  · A migração da chave antiga ('noite' → 'espaco') e o `try/catch` do boot FICAM no game.js: são política de
//    persistência e rede de segurança do arranque, não regra de cenário.
//  · `worldCanvasNormal`/`worldTexNormal` continuam sendo `let` do game.js — são lidos por
//    render/high-contrast (por getter) e pelo render estático. Este módulo os ESCREVE por um único
//    `setWorldTextures(canvas, textura)`, para que a dupla nunca fique meio trocada.
//
// ======================= ⚠️ A ARMADILHA DE BOOT DESTA REGIÃO =======================
// O `setCenario` do boot é chamado MUITO cedo — logo depois de `initViewports`, e antes de metade do jogo
// existir. O monólito o embrulha num `try/catch` que cai para 'cidade' EM SILÊNCIO, e é por isso que uma
// dependência ausente aqui não vira erro: vira "o tema que a criança escolheu não voltou, e ninguém sabe por
// quê". Todas as dependências que ainda não existem naquele instante entram por GETTER ou por CALLBACK, nunca
// por valor, exatamente para que a montagem do ctx não toque em `const` em TDZ:
//   · `isVizReady`/`reapplyVizAll` — `vizReady` só vira `true` lá no fim do boot; no arranque as duas voltas
//     de `reapplyVizAll` são puladas, e quem pinta é o `else if (worldSprite)` do passo 4.
//   · `getWorldSprite` — o sprite do mundo nasce DEPOIS deste ponto no game.js. Só é tocado dentro do `.then`,
//     que é assíncrono, mas o getter garante que a montagem do ctx não o dereferencie.
//   · `isVidaReady`/`applyCenarioVida` — `sceneCity` nasce centenas de linhas depois; `_vidaReady` é `false`
//     no boot justamente para que esta chamada seja pulada, e o game.js chama `applyCenarioVida()` uma vez, à
//     mão, quando a cena da cidade fica pronta.
//   · `clearWorldTexCache` vem de render/high-contrast, que é um módulo de verdade e já existe no import.
//
// SEM I/O NO IMPORT, e agora sem I/O NENHUM: `carregarTilesDoTema` (a carga assíncrona dos PNG de tile, com a
// guarda de corrida que ela exigia) foi APAGADA no item 17 — os tiles da Cidade viraram dados em
// `render/city-tiles`. O corpo do módulo não pede nada, e a troca de cenário virou síncrona.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (D2-b).

import { CENARIOS, normalizarCenario, type CenarioTema } from './cenario-data.js';
import type { Tileset } from './world-tex.js';

/* ===================== interfaces estruturais (DOM/PIXI sem importá-los) ===================== */

/** `HTMLImageElement`, reduzido ao que o carregamento usa. */
/** O tileset de um tema: interior + topo. Corresponde ao `Tileset` de render/world-tex. */
/**
 * Os dois tiles do tema. `Tileset` vem de `render/world-tex`, que é o dono — ele os desenha, e por isso
 * sabe que são `CanvasImageSource`. A versão que estava aqui dizia `unknown` nos dois campos: uma
 * descrição que apenas SE PARECE com a real, que é o que o ADR-0039 proíbe. O `unknown` não protegia
 * nada — só empurrava a conversão para quem recebesse.
 */
export type TilesDoTema = Tileset;
/** `worldSprite` — só a troca de textura. */
interface SpriteComTextura { texture: unknown }

/**
 * Baixa `tile_fill.png` + `tile_surface.png` do tema. Resolve com os dois, ou com `null` se QUALQUER um falhar.
 *
 * Verbatim do `loadTileImages` do monólito, `fail` inclusive: quando uma das imagens erra, o `res(null)` sai na
 * hora e a outra, ao chegar, encontra `fail` ligado e não resolve por cima. A promessa nunca REJEITA — tema sem
 * arte é um caminho normal (a Cidade não tem tileset próprio), não um erro, e uma rejeição aqui derrubaria a
 * troca de cenário inteira. Nunca pendura: os dois lados de cada imagem estão cobertos.
 */
export interface SetCenarioCtx {
  /* --- estado (core/state.js) --- */
  setCenarioValue: (theme: string) => void; // grava + persiste `incl_cenario` + dispara o evento
  getCenario: () => string;                 // REATRIBUÍDO → getter; é o que arma a guarda de corrida

  /* --- fundo (render/parallax.ts) --- */
  aplicarTemaParallax: (theme: string, T: CenarioTema) => void;

  /* --- textura do MUNDO (render/world-tex + render/canvas + render/high-contrast) --- */
  /**
   * Os tiles do tema, SÍNCRONOS. Eram dois PNG baixados por `carregarTilesDoTema`; hoje a Cidade os desenha
   * (render/city-tiles) e os outros temas devolvem `null`, que é o caminho dos blocos v3 — o mesmo `null` de
   * antes, agora imediato em vez de prometido.
   */
  getTiles: (tema: string) => TilesDoTema | null;
  /** Builder da canvas do nível. `HTMLCanvasElement` e não `unknown`: é o que o `render/world-tex`
   *  devolve, e o `unknown` só adiava a conversão até o `main.ts`, onde ela virava erro (ADR-0039). */
  worldCanvas: (tiles: TilesDoTema | null) => HTMLCanvasElement;
  // `HTMLCanvasElement` e não `unknown`: o único argumento que passa por aqui é o retorno de
  // `worldCanvas()`, logo acima. Declarar o parâmetro mais LARGO do que se usa era o que impedia a
  // raiz de entregar o `tex` real dela — por contravariância, quem promete aceitar tudo não cabe.
  tex: (canvas: HTMLCanvasElement) => unknown;                   // canvas → PIXI.Texture
  clearWorldTexCache: () => void;                                // invalida o recolor de alto contraste
  /** Escreve `worldCanvasNormal`/`worldTexNormal` (os dois `let` do composition root), sempre em par. A
   *  TEXTURA segue `unknown` de propósito — é objeto do PixiJS, e este módulo roda no project `node`. */
  setWorldTextures: (canvas: HTMLCanvasElement, textura: unknown) => void;

  /* --- consequências (todas nascem DEPOIS deste ponto no boot → getter/callback) --- */
  isVizReady: () => boolean;                              // `vizReady`: só no fim do boot
  reapplyVizAll: () => void;                              // render/viz-setters
  getWorldSprite: () => SpriteComTextura | null | undefined; // nasce depois; só tocado no `.then`
  isVidaReady: () => boolean;                             // `_vidaReady`: camadas de vida/tráfego já existem
  applyCenarioVida: () => void;                           // render/scene-city
}

export interface SetCenarioApi {
  /** Troca o cenário. Valida, persiste, repinta o fundo, refaz o mundo e avisa quem depende. */
  setCenario(theme: string): void;
}

export function createSetCenario(ctx: SetCenarioCtx): SetCenarioApi {
  function setCenario(theme: string): void {
    const tema = normalizarCenario(theme);
    ctx.setCenarioValue(tema); // ANTES do trabalho de textura: é o valor com que as guardas de corrida comparam
    const T = CENARIOS[tema]!;
    ctx.aplicarTemaParallax(tema, T); // as 3 camadas de fundo (render/parallax.ts)

    // TILES do tema: SÍNCRONOS. v3: blocos Clarity SEM recolor (o `worldCanvas` cai no desenho da v3 com null).
    //
    // A GUARDA DE CORRIDA MORREU JUNTO COM A CORRIDA. Havia um `if (getCenario() !== tema) return` aqui, e ele
    // estava certo enquanto os tiles chegavam por `Promise`: trocar de cenário durante o download deixava a
    // resposta antiga pintar por cima da nova. Sem download não há "durante", e guarda contra corrida que não
    // existe mais é código que só pode confundir quem o ler depois.
    const tiles = ctx.getTiles(tema);
    const cv = ctx.worldCanvas(tiles), t = ctx.tex(cv);
    ctx.setWorldTextures(cv, t);
    ctx.clearWorldTexCache();
    if (ctx.isVizReady()) ctx.reapplyVizAll();
    else {
      const sprite = ctx.getWorldSprite(); // no boot o recolor ainda não existe: pinta o sprite direto
      if (sprite) sprite.texture = t;
    }

    // (o Cenário saiu do menu de pausa — a escolha é do J1 no splash, antes de começar)
    if (ctx.isVidaReady()) ctx.applyCenarioVida(); // liga/desliga carros/deco da cidade e semeia o tema
    if (ctx.isVizReady()) ctx.reapplyVizAll();     // reaplica o cenário recolorido (só após o init montar tudo)
    // incl_cenario é persistido por setCenarioValue (core/state.js)
  }

  return { setCenario };
}
