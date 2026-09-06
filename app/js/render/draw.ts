// SPDX-License-Identifier: AGPL-3.0-or-later
// render/draw.ts — O QUADRO. Onde a câmera para e o que é carimbado nela, uma vez por tick, depois que
// `update()` já simulou o mundo. Extraído verbatim do game.js (`placeCam` + `draw`), mais a aplicação da
// textura escolhida no sprite do jogador (a última linha do antigo `stepPlayer`).
//
// O QUE ENTROU
//   · `placeCam(pl)`     — a câmera: enquadra o jogador, CLAMPA nas bordas do mundo, aplica o tremor de tela
//                          (render/fx.shakeAmp) RE-CLAMPANDO (senão o tremor mostraria o vazio fora do mapa),
//                          arredonda para pixel inteiro (o jogo é 320×180: meio pixel é tremulação) e
//                          reposiciona o parallax. Devolve `{camX,camY}` PRÉ-arredondamento, que é o que o
//                          minimapa usa para marcar o que já foi visto.
//   · `drawFrame()`      — o quadro inteiro: transform dos sprites de jogador (squash&stretch com easing,
//                          ancorado nos pés + piscada de dano), elevadores, partículas, bengala, cadeira de
//                          rodas, hitbox tolerante do modo Fácil, e ENTÃO um dos DOIS caminhos de câmera
//                          (tela única direta vs. multi-tela com uma render-texture por viewport), clima e HUD.
//   · `animatePlayer()`  — chama a decisão de quadro (render/player-anim) e a aplica no sprite, passando pelo
//                          recolor do modo de visão (`playerVizTex`).
//
// POR QUE A FRONTEIRA CAIU AQUI
// `placeCam` e `draw` são inseparáveis: os DOIS caminhos de câmera do `draw` chamam `placeCam`, e o de
// multi-tela depende do efeito colateral dela (mover `camera` antes de cada `renderer.render`). Separá-los
// só produziria dois módulos que se importam. Já `animatePlayer` veio junto por outro motivo: a escolha do
// quadro é pura e mora em render/player-anim.ts, mas APLICÁ-LA toca um `PIXI.Sprite` e o cache de recolor de
// render/viewports — exatamente o tipo de coisa que este módulo já faz. Deixá-la no game.js manteria lá uma
// linha órfã de render dentro de uma função de lógica de jogo.
//
// O QUE FICOU DE FORA, E POR QUÊ
//   · `configureRender()` — a MONTAGEM do multi-tela (criar/destruir as render-textures, os sprites de
//     viewport, as molduras e as bolinhas). É ciclo de vida do render-graph, não desenho de quadro; e vive
//     colada ao `app.renderer.resize` e ao HUD. Fica no game.js para uma rodada própria.
//   · `updateParallax()` — mexe nos `TilingSprite` criados no game.js e na decor de tela da v3; entra
//     injetada.
//   · `applySharedTextures()` (render/viz-setters) e `renderVpOverlay()` (render/viewports) — já são módulos;
//     entram injetados porque suas instâncias são criadas no game.js.
//   · A coleta de moedas, os power-ups e o portão que precediam a animação no `stepPlayer`: são LÓGICA DE
//     JOGO (dependem de `coins`, `powerups`, `gate`, quiz e HUD) e continuam no game.js.
//
// INJEÇÃO — a regra e as EXCEÇÕES conscientes
// Vale a regra da casa: o que o game.js REATRIBUI entra por getter; o que é estável entra por valor. Daí
// `getVpTex` (o `let vpTex` que `configureRender` troca a cada mudança de nº de telas), `isWheelchair`
// (`let wheelchair`), `getFxClock` (`let fxClock`, o relógio do cintilar) e `getPowerups` (`let powerups`)
// serem GETTERS. `rm` (o objeto de Movimento Reduzido) é `const` e mutado IN PLACE → entra por valor.
//
// EXCEÇÃO (desvio consciente da instrução de recorte, que pedia getters também para `numPlayers`, `coins` e
// `players`): esses três são `export let` de core/state.ts, ou seja, BINDINGS VIVOS de ES Modules. Importá-los
// aqui já entrega o valor atual a cada leitura — `setNumPlayersValue`/`setCoins` são vistos na hora, sem
// getter. Getter aqui não acrescentaria correção, só uma indireção a mais e um ctx maior; e o precedente do
// repositório é este (game/coin-spawning.ts importa `coins`+`setCoins` direto; game/physics.ts importa
// `players`). A regra do getter vale para o que mora no ESCOPO PRIVADO do game.js, que módulo nenhum enxerga.
//
// PIXI POR INTERFACE ESTRUTURAL, não por `import * as PIXI` — mesmo precedente de render/viewports.ts e
// render/scene-sky.ts. `camera`, `renderer`, as camadas de `Graphics` e os sprites entram como interfaces com
// só os membros que este módulo toca, para o arquivo carregar no project `node` do Vitest.
// Pelo mesmo motivo, os colaboradores que importam PIXI (game/level-geometry.drawElevators,
// render/minimap.*) entram por closure em vez de import: o game.js já tem as camadas deles em mão.
// São importados direto só os módulos-folha node-safe: constantes, RNG, render/fx, render/wheelchair-sprites,
// render/viz-modes, game/powerups, game/coin-spawning e core/state.
//
// ORDEM DE BOOT: `initDraw` não faz I/O nem toca o render-graph — só fecha closures. Pode ser chamada em
// qualquer ponto do game.js posterior às camadas de `Graphics`, à `camera` e ao `app`; o resto do ctx é
// função e resolve tarde. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (C1).

import { LOGICAL_W, LOGICAL_H, EASY } from '../core/constants.js';
import type { PlayerView } from '../core/entity.js';
// A corrente da DECORACAO, nao a do jogo: uma particula sorteada aqui nao pode mover o sorteio
// das moedas. Ver o cabecalho de core/rng.ts (issue #107).
import { rngDecoracao } from '../core/rng.js';
const rnd = rngDecoracao.rnd;
import { JUICE, easeOut3, shakeAmp, drawFx } from './fx.js';
import { criarCamera, type CameraObj } from './camera.js';
import { drawCane, drawRunCane, drawChair } from './wheelchair-sprites.js';
import { VIZ_BY_KEY } from './viz-modes.js';
// (`game/powerups` e `game/coin-spawning` SAÍRAM daqui no item 19 — ver o bloco "ITENS DECLARADOS" abaixo.)
import { drawWeather } from './weather.js';

import { choosePlayerFrame, type AnimPlayer, type Frame, type PlayerTextures } from './player-anim.js';
import type { RenderizarEm } from './port.js';

/* ===================== interfaces estruturais (PIXI sem importar PIXI) ===================== */

/** O que este módulo toca de um `PIXI.Graphics`. Superconjunto do `DrawGraphics` de wheelchair-sprites. */
export interface GraphicsLike {
  clear(): unknown;
  lineStyle(width: number, color?: number, alpha?: number): unknown;
  beginFill(color: number, alpha?: number): unknown;
  endFill(): unknown;
  drawRect(x: number, y: number, w: number, h: number): unknown;
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  drawCircle(x: number, y: number, r: number): unknown;
}

/** O sprite do personagem — só posição, escala, alpha, visibilidade e textura. */
export interface PlayerSprite {
  x: number; y: number; alpha: number; visible: boolean;
  scale: { set(x: number, y: number): void };
  texture: unknown;
}

/** `camera` (PIXI.Container): daqui só a posição importa; ela é passada opaca ao renderer. */
export interface CameraLike { x: number; y: number }

/** `app.renderer` — só a passada em render-texture do caminho multi-tela. */
// `RendererLike` SAIU (Fase D). A porta pede a CAPACIDADE `RenderizarEm`, não o objeto renderizador:
// o `render` do PixiJS pede `IRenderableObject`, e um parâmetro declarado `unknown` não cabe ali por
// contravariância. Ver o cabeçalho de `render/port`.

// O `CoinSprite` de game/coin-spawning declara o que AQUELE módulo toca (x/y/tint/visible) e não inclui
// `alpha` — quem escreve alpha na moeda é só o desenho (o cintilar e o esmaecer do item alheio). Widening
// local em vez de mexer no módulo vizinho; ver o relatório da extração (C1).
/* ===================== ITENS DECLARADOS (item 19) =====================
 *
 * Este módulo importava DUAS coisas de `game/` — as duas últimas arestas de importação da engine para o jogo:
 *
 *   · `getCoinSprites()` de `game/coin-spawning` — os sprites das moedas;
 *   · `puTaken(pu, pi)` de `game/powerups` — "a chave some para todos, os demais são por jogador".
 *
 * E o pior não eram as arestas: eram as REGRAS. Três linhas deste desenho decidiam, por conta própria, coisas
 * que são do jogo — que item coletado some (`!cn.taken`), que item de outro jogador fica esmaecido
 * (`cn.owner === i`), e que a chave é global enquanto o resto é por jogador. Um segundo jogo com outra ideia
 * de posse — cooperativo, sem dono; ou com item que reaparece — não tinha como dizer isso ao desenho.
 *
 * Agora ele PERGUNTA. O ADR-0030 chama isto de "draw recebe entidades declaradas", e é literalmente o que a
 * assinatura passou a dizer: uma lista de sprites e duas perguntas por (item, jogador). O desenho continua
 * dono do que é dele — o CINTILAR, que é juice da engine e vale em qualquer jogo. */

/** O sprite de um item declarado: o mínimo que o desenho toca. */
export interface ItemSprite { visible: boolean; alpha: number }

/**
 * Um power-up, do ponto de vista do DESENHO: um sprite, e nada mais.
 *
 * Era `extends Powerup`, importado de `game/powerups` — e esse `import type` era a ÚLTIMA aresta deste módulo
 * para o jogo. Tipo apagado em tempo de compilação não entra no pacote, é verdade; mas ele obriga o arquivo a
 * existir para o `tsc`, e obriga QUALQUER jogo a ter um power-up com aquela forma. O desenho toca `sprite` e
 * mais nada — declarar só isso é a fatia mínima, a mesma regra de `core/entity`.
 */
interface PowerupWithSprite {
  sprite?: { visible: boolean } | null;
  /**
   * ⚠️ `kind` NÃO é lido aqui — e entrou mesmo assim, em 2026-08-26. O desenho ENTREGA o power-up ao
   * `powerupVisibleTo` injetado, e é ele que lê o `kind` (a chave do portão é global; o resto é por
   * jogador). Uma fatia mínima descreve o que o módulo CONSOME; em posição de parâmetro ela precisa
   * descrever também o que ele ENTREGA, senão o callback real não cabe no ctx.
   *
   * É a quinta vez que esta forma aparece na árvore — `held` em audio-nav, `setSquash` na física, o
   * menu de pausa no gamepad, o `navPause` — e a lição é a mesma: repassar é uma exigência, não uma
   * leitura. A fatia continua mínima: dois campos, e nenhum tipo de `game/` importado.
   */
  kind: string;
}

/** O jogador, do ponto de vista do DESENHO (a animação usa `AnimPlayer`, do qual este é superconjunto). */
/**
 * O jogador visto pelo DESENHO: tudo o que a animação lê, mais posição, dano e apresentação.
 * `sq`/`sqT` são o squash&stretch (amplitude e relógio, escritos por render/fx.setSquash); `easy` desenha a
 * hitbox de coleta tolerante translúcida; `viz` é o modo de visão, que recolore por viewport.
 */
export type DrawPlayer = AnimPlayer & PlayerView<
  'i' | 'x' | 'y' | 'facing' | 'hurtTimer' | 'sq' | 'sqT' | 'easy' | 'viz' | 'sprite'
>;

/** Flags de Movimento Reduzido que o DESENHO consulta (o objeto `rm` do game.js tem mais chaves). */
export interface ReducedMotion { items?: boolean }

export interface DrawCtx {
  /** Quantos jogadores/telas. Estado de RODADA (ADR-0038): vem da instância que a raiz possui.
   *  Era `numPlayers`, um `let` de `core/state` importado como binding vivo — e um `let` de módulo
   *  é compartilhado por qualquer segundo jogo que a mesma página carregue (D13 do `demos`). */
  getNumPlayers: () => number;
  /** Os jogadores. Estado de RODADA, pelo mesmo motivo. `readonly unknown[]` porque cada consumidor
   *  estreita para a SUA fatia — o tipo real é do jogo, não da engine (ADR-0033). */
  getPlayers: () => readonly unknown[];
  /* --- render-graph criado no game.js (estável: entra por valor) --- */
  camera: CameraLike;           // container do mundo; `placeCam` o move, o multi-tela o renderiza N vezes
  renderizarEm: RenderizarEm;       // `app.renderer`
  caneLayer: GraphicsLike;      // bengala (modo cego)
  chairLayer: GraphicsLike;     // cadeira de rodas (empatia motora)
  /**
   * CAIXA DE COLISÃO do jogador (largura × altura, em px). ENTRA em vez de ser importada de `game/player`, e
   * isso não é política nova: `render/scene-city`, `render/scene-sky` e `platform/audio-nav` já a recebem
   * assim — este módulo é que tinha ficado para trás, sozinho na camada de render importando do jogo.
   *
   * Ela aparece em três lugares e sempre pela mesma razão: `pl.y` é o PÉ do jogador, e meia caixa acima é o
   * meio do corpo. É conhecimento de gênero — um top-down não ancora no pé, um quiz não tem corpo — e por
   * isso pertence a quem tem corpo, não a quem desenha.
   */
  BOX: { w: number; h: number };
  easyHitbox: GraphicsLike;     // retângulo translúcido do modo Fácil

  /* --- estado REATRIBUÍDO no game.js → getters (ver o cabeçalho) --- */
  getVpTex(): unknown[];        // `let vpTex`: configureRender REATRIBUI a cada troca de nº de telas
  isWheelchair(): boolean;      // `let wheelchair`
  getFxClock(): number;         // `let fxClock`: relógio geral de animação (fase do cintilar dos itens)
  getPowerups(): readonly PowerupWithSprite[]; // `let powerups` — só LIDO: o módulo muta o `sprite` de cada um, nunca a lista
  /**
   * Os sprites dos ITENS declarados, na ordem em que o jogo os declara. Era `getCoinSprites()`, importado de
   * `game/coin-spawning` — o desenho sabia que os itens são moedas.
   */
  getItemSprites(): readonly (ItemSprite | null | undefined)[];
  /** O item `j` aparece para o jogador `i`? Era `!cn.taken` — a regra "coletado some" é do jogo. */
  itemVisibleTo(j: number, playerIndex: number): boolean;
  /**
   * O item `j` é DESTE jogador? Era `cn.owner === i`, e o que o desenho faz com a resposta é esmaecer o item
   * alheio (lote C). A ideia de POSSE é do jogo: um cooperativo responde `true` sempre e ninguém esmaece nada.
   */
  itemOwnedBy(j: number, playerIndex: number): boolean;
  /**
   * O power-up `pu` aparece para o jogador `i`? Era `!puTaken(pu, i)`, que trazia a regra "chave é global,
   * o resto é por jogador" — uma frase sobre ESTE jogo, dentro do desenho.
   */
  powerupVisibleTo(pu: PowerupWithSprite, playerIndex: number): boolean;

  /* --- estado estável do game.js --- */
  rm: ReducedMotion;            // `const rm`, mutado in place pelos toggles de Movimento Reduzido
  WORLD_PX_W(): number;         // limites do mundo p/ o clamp da câmera (getters: mesmo padrão de game/physics)
  WORLD_PX_H(): number;

  /* --- predicados e colaboradores que moram no game.js ou importam PIXI --- */
  caneOn(pl: DrawPlayer): boolean;              // visão comprometida? decide se a bengala é desenhada
  updateParallax(camX: number, camY: number): void; // scroll das 3 camadas de fundo + decor de tela da v3
  drawElevators(): void;                        // game/level-geometry.drawElevators(elevLayer) — importa PIXI
  markSeen(camX: number, camY: number): void;   // render/minimap — importa PIXI
  redrawMinimapIfDirty(): void;
  drawMinimapPlayer(worldX: number, worldY: number): void;
  applySharedTextures(viz: string): void;       // render/viz-setters (instância criada no game.js)
  renderVpOverlay(i: number, viz: string): void; // render/viewports (idem)
  playerVizTex(base: Frame, viz: string): unknown; // idem — recolor do quadro por modo de visão
  updateGameHud(): void;                        // ui/hud (DOM sobreposto)

  /* --- animação --- */
  playerTextures(): PlayerTextures; // os TEX_* de render/sprites, que só existem após initCharacterSprites()
  held(pl: AnimPlayer, act: string): boolean;   // input/state.held
}

export interface DrawApi {
  /** Enquadra `pl`, aplica clamp+tremor+arredondamento e reposiciona o parallax.
   *  `i` é o índice do jogador, e existe porque CADA JOGADOR TEM A SUA CÂMERA (ver `camDe`). */
  placeCam(pl: DrawPlayer, i?: number): { camX: number; camY: number };
  /** Desenha o quadro inteiro (era `draw()` no game.js). */
  drawFrame(): void;
  /** Escolhe o quadro de animação de `pl` e o aplica no sprite (era a cauda do `stepPlayer`). */
  animatePlayer(pl: DrawPlayer, dt: number, dir: number): Frame;
}

export function initDraw(ctx: DrawCtx): DrawApi {

  /* ===================== câmera ===================== */

  // A CONTA saiu para `render/camera` (item 22: M1 extraiu as fórmulas, M2 as embrulhou num OBJETO). Aqui
  // ficou o CARIMBO dela no render-graph: o sorteio do tremor, a escrita no container e o aviso ao parallax.
  //
  // ========================= UMA CÂMERA POR JOGADOR, E POR QUÊ AGORA =========================
  // O caminho multi-tela chama `placeCam(PLS[i])` para CADA jogador dentro do MESMO quadro. Com uma câmera
  // só, a posição do jogador i entraria como ponto de partida da do jogador i+1. Hoje isso não daria em
  // nada — com zona-morta 0×0 a câmera é sem memória e `seguir` equivale a `enquadrar`, letra por letra
  // (`tests/camera.node.test.js` prende essa igualdade). No dia em que a zona deixar de ser zero, daria: as
  // câmeras dos jogadores se puxariam. É mais barato separar antes de o defeito existir do que depois, e
  // separar agora não muda um pixel do que a criança vê.
  //
  // ⚠️ `pular()` AINDA NÃO TEM CHAMADOR. Ele é para nascer/renascer/trocar de fase, e enquanto a zona é zero
  // não faz falta nenhuma — `seguir` já centra. Quando o Dev escolher uma zona, o nascimento sem `pular`
  // aparece como um deslize da câmera até o jogador no primeiro quadro da fase. Fica anotado aqui, e não
  // fingido de resolvido.
  const cams = new Map<number, CameraObj>();
  const camDe = (i: number): CameraObj => {
    let c = cams.get(i);
    if (!c) { c = criarCamera({ w: ctx.WORLD_PX_W(), h: ctx.WORLD_PX_H() }, { w: LOGICAL_W, h: LOGICAL_H }); cams.set(i, c); }
    // O mundo muda de tamanho ao trocar de fase, e a câmera não é avisada por ninguém — reprender todo quadro
    // custa duas contas e dispensa um evento que hoje não existe.
    else c.redimensionar({ w: ctx.WORLD_PX_W(), h: ctx.WORLD_PX_H() }, { w: LOGICAL_W, h: LOGICAL_H });
    return c;
  };

  function placeCam(pl: DrawPlayer, i = 0): { camX: number; camY: number } {
    const c = camDe(i);
    // `pl.y` é o PÉ do jogador; o meio do corpo fica meia caixa acima. Esta conversão é a única coisa de
    // PLATAFORMA que havia no enquadramento, e agora ela mora aqui, onde o corpo existe — e não na câmera.
    c.seguir(pl.x, pl.y - ctx.BOX.h / 2);
    const k = shakeAmp(); // JUICE: tremor decai linearmente (render/fx)
    // Os dois sorteios ficam DENTRO do `if`, como no original: com `k === 0` ele não chamava `rnd()`, e
    // chamá-lo duas vezes por quadro deslocaria o fluxo do gerador COMPARTILHADO — mesma semente, outro jogo.
    const cam = k > 0 ? c.quadro(k, rnd() * 2 - 1, rnd() * 2 - 1) : c.base;
    ctx.camera.x = -Math.round(cam.camX); ctx.camera.y = -Math.round(cam.camY);
    ctx.updateParallax(cam.camX, cam.camY);
    return cam;
  }

  /* ===================== animação do personagem ===================== */

  function animatePlayer(pl: DrawPlayer, dt: number, dir: number): Frame {
    const tx = choosePlayerFrame(pl, {
      dt, dir, wheelchair: ctx.isWheelchair(), held: ctx.held, rnd, tex: ctx.playerTextures(),
    });
    // solo/default; no MP o drawFrame troca a textura por viewport (applySharedTextures)
    if (pl.sprite) pl.sprite.texture = ctx.playerVizTex(tx, pl.viz);
    return tx;
  }

  /* ===================== o quadro ===================== */

  function drawFrame(): void {
    const PLS = ctx.getPlayers() as readonly DrawPlayer[];
    for (const pl of PLS) {
      if (!pl.sprite) continue;
      pl.sprite.x = pl.x; pl.sprite.y = pl.y + 1;
      // JUICE: squash&stretch com easing, ancorado nos pés
      const q = (JUICE.squash && !pl.rmWalk && (pl.sqT || 0) > 0) ? (pl.sq || 0) * easeOut3((pl.sqT || 0) / 8) : 0;
      // sem escala procedural de respiração (parecia mastigar) — respiração é por FRAMES
      pl.sprite.scale.set((pl.facing < 0 ? -1 : 1) * (1 - q * 0.7), 1 + q);
      pl.sprite.alpha = pl.hurtTimer > 0 ? (Math.floor(pl.hurtTimer / 4) % 2 ? 0.4 : 1) : 1;
    }
    ctx.drawElevators();      // cadeirante: plataforma do elevador sob os pés (largo/fino)
    drawFx();                 // JUICE: partículas (poeira/brilhos) na camada acima dos players
    const shimOn = JUICE.shimmer && !ctx.rm.items; // JUICE: cintilar dos itens (respeita Movimento Reduzido)
    const fxClock = ctx.getFxClock();

    // modo cego: bengala SÓ andando (corrida = bengala de roda); nada parado/nadando/voando/escada
    ctx.caneLayer.clear();
    for (const pl of PLS) {
      if (!ctx.caneOn(pl) || !pl.sprite || !pl.sprite.visible) continue;
      if (pl.running) drawRunCane(ctx.caneLayer, pl); else if (pl.walking) drawCane(ctx.caneLayer, pl);
    }
    // cadeirante: desenha a cadeira nos jogadores (exceto nadando/voando)
    ctx.chairLayer.clear();
    if (ctx.isWheelchair()) { for (const pl of PLS) { if (pl.sprite && pl.sprite.visible && !pl.inWater && !pl.flying) drawChair(ctx.chairLayer, pl); } }
    // Fácil: hitbox de coleta tolerante (retângulo translúcido) — só para os jogadores em Fácil
    ctx.easyHitbox.clear();
    const pad = EASY.pad;
    for (const pl of PLS) {
      if (!pl.easy) continue;
      ctx.easyHitbox.lineStyle(1, 0xffffff, 0.45); ctx.easyHitbox.beginFill(0xffffff, 0.10);
      ctx.easyHitbox.drawRect(pl.x - ctx.BOX.w / 2 - pad, pl.y - ctx.BOX.h - pad, ctx.BOX.w + 2 * pad, ctx.BOX.h + 2 * pad); ctx.easyHitbox.endFill();
    }

    if (ctx.getNumPlayers() <= 1) {
      // O CINTILAR fica: é juice da engine (render/fx), e vale para moeda, estrela ou peça de tabuleiro.
      const itens = ctx.getItemSprites();
      for (let j = 0; j < itens.length; j++) { const s = itens[j]; if (s) s.alpha = shimOn ? 0.8 + 0.2 * Math.sin(fxClock * 0.12 + j * 1.7) : 1; }
      const { camX, camY } = placeCam(PLS[0]);
      ctx.markSeen(camX, camY); ctx.redrawMinimapIfDirty();
      ctx.drawMinimapPlayer(PLS[0].x, PLS[0].y - ctx.BOX.h / 2);
    } else {
      // Otimização: se TODOS estão no mesmo modo (caso comum), troca as texturas UMA vez; senão, por viewport.
      const v0 = PLS[0].viz, allSame = PLS.every((p) => p.viz === v0);
      const anyOverlay = PLS.some((p) => { const m = VIZ_BY_KEY[p.viz]; return !!m && m.kind === 'lowvision'; });
      if (allSame) ctx.applySharedTextures(v0);
      for (let i = 0, n = ctx.getNumPlayers(); i < n; i++) {
        const viz = PLS[i].viz;
        if (!allSame) ctx.applySharedTextures(viz);            // só troca por viewport quando os modos diferem
        const itens2 = ctx.getItemSprites();
        for (let j = 0; j < itens2.length; j++) {
          const s = itens2[j]; if (!s) continue;
          s.visible = ctx.itemVisibleTo(j, i);
          // Lote C: item alheio esmaecido — quem é "alheio" é o jogo que diz; JUICE: cintilar multiplicativo
          s.alpha = (ctx.itemOwnedBy(j, i) ? 1 : 0.4) * (shimOn ? 0.8 + 0.2 * Math.sin(fxClock * 0.12 + j * 1.7) : 1);
        }
        for (const pu of ctx.getPowerups()) { if (pu.sprite) pu.sprite.visible = ctx.powerupVisibleTo(pu, i); }
        placeCam(PLS[i], i); ctx.renderizarEm(ctx.camera, ctx.getVpTex()[i], true); // LIMPA: cada quadro é um quadro, não um acúmulo
        if (anyOverlay) ctx.renderVpOverlay(i, viz);           // passada extra só se algum jogador está em baixa visão
      }
    }
    drawWeather();       // chuva/clarão em tela-espaço, sobre tudo
    ctx.updateGameHud(); // HUD por jogador (moedas + poder) em DOM sobreposto (alta definição)
  }

  return { placeCam, drawFrame, animatePlayer };
}
