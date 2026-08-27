// SPDX-License-Identifier: AGPL-3.0-or-later
// game/physics.ts — FÍSICA DO JOGADOR (um passo de simulação por jogador, por quadro). Extraída verbatim do
// monólito game.js (stepPlayer/sampleFeatures/resolveX/resolveY/triggerLava). Cobre: movimento horizontal
// (andar/correr/turbo/alternância/Fácil), pulo + buffer + cadeia (bunny-hop), escalada de escada, elevador
// (cadeirante), nado, ventosa-aranha (cling), voo, gravidade + tetos de queda, rampa 45°, colisão em X/Y,
// proteção de borda, cadência de passos/bengala, guarda de beirada e o respawn por queda.
//
// CORTE: a função para NO respawn por queda. Coleta de moedas/power-ups, portão e ANIMAÇÃO de sprite seguem
// no game.js — por isso stepPlayer devolve {ran, dir}: `ran=false` reproduz o `return` seco do original
// (quiz/abandono/espera) e `dir` é o único local do trecho de física que o trecho de animação ainda lê.
//
// DESIGN TESTÁVEL: zero alcance global. O que é do game.js (wheelchair/modoCego/caneOn, áudio, HUD, juice,
// leitor de tela, altura do mundo) entra por initPhysics(ctx) como CLOSURES — o módulo sempre lê o valor vivo
// e o teste passa um ctx falso. As dependências puras (colisão de grade, geometria do jogador, elevadores,
// constantes, RNG, held) são IMPORTADAS, nunca recriadas. Sem I/O no import.
//
// ÂNCORA: tests/physics-golden.node.test.js replaya 14 trajetórias capturadas do jogo rodando
// (tests/fixtures/physics-golden.json). Qualquer mudança de comportamento aqui aparece lá.
import { TILE, TUNE, EASY, COIN_TARGET } from '../core/constants.js';
import { ehTrampolim } from '../core/constants.js';
import { t } from '../core/i18n.js';
import type { ControlledGamePlayer } from './entity.js'; // ADR-0033: a fatia do JOGO — `quiz` mora aqui
import { tileAt, solidAt, surfTop, isWcRampRiser, rampSurfaceY, caneBlockPx } from '../core/collision.js';
import { correndoAgora, pularVaiGrudar, botaoDeGrude, usaTravaDeCorrer, botaoDeCorrerEngatado } from './run-toggle.js';
import { BOX, SPAWN_X, SPAWN_Y, jumpVel, isBouncyGroundBelow, clingSides, firstClingSide, spiderReattach } from './player.js';
import { ELEV_SPEED, elevAt } from './elevators.js';
import { held } from '../input/state.js';
import { nextLatchedDir, latchedDrive, type LatchDir } from '../input/latch.js';
import { rnd } from '../core/rng.js';

import { setCoins } from './state.js'; // item 19: `coins`/`quizLevel` sao estado do JOGO
import { pickCoins } from './coins.js';

/** Lado da ventosa-aranha (mesma nomenclatura de game/player.ts). */
/** Lados da ventosa-aranha. Reexportado sob o nome que este módulo sempre teve; a definição é uma só, em
 *  core/entity. Estava escrito por extenso aqui, em game/player e em core/entity — três cópias de uma união
 *  de quatro literais, que é pouco até divergir. */
export type { ClingSide as Side } from '../core/entity.js';

/** Os campos do jogador que a FÍSICA lê/escreve. O objeto real (makePlayer, ~45 campos) é um superconjunto. */
/**
 * O jogador visto pela FÍSICA — a fatia mais larga do programa, e agora DERIVADA de core/entity.
 *
 * `ControlledPlayer` e não `Player`: a física só roda durante a partida, quando `assignControls` já preencheu
 * o `ctrl`. Isto estava escrito aqui como `ctrl: Record<string, string[]>`, uma afirmação de não-nulidade
 * escondida dentro de uma interface redigitada; agora é o nome do tipo que a faz.
 *
 * Campos que já não são redigitados e portanto já não podem divergir: `elevTarget` (o destino do elevador do
 * cadeirante, ausente em makePlayer), `_fallV` (vy ANTES do resolve, para o juice de pouso) e `caneDist`
 * (distância pisada desde a última batida de bengala) — os três agora documentados uma vez só, em core/entity.
 */
export type PhysicsPlayer = Pick<ControlledGamePlayer,
  'i' | 'x' | 'y' | 'vx' | 'vy' |
  'onGround' | 'onLadder' | 'inWater' |
  'facing' | 'jumpBuffer' | 'waterStroke' | 'hurtTimer' |
  'jumpEdge' | 'runEdge' | 'swapEdge' | 'specialEdge' | 'leftEdge' | 'rightEdge' | 'walkDir' |
  'toggleRun' | 'runLatch' |
  'activePower' | 'owned' |
  'jumpChain' | 'groundIdle' | 'airTime' |
  'clinging' | 'clingN' | 'flying' |
  'stepT' | 'guardT' | '_swapDown' | '_swapT' | '_swapSonar' |
  'easy' | 'toggleMove' | 'runCane' | 'collected' |
  'quiz' | 'quit' | 'waiting' | 'elevTarget' | '_fallV' | 'caneDist' |
  'ctrl' | 'pad' | 'viz' |
  // `sq`/`sqT` NÃO são lidos aqui — são ESCRITOS por `render/fx.setSquash`, que este módulo chama com o
  // próprio jogador. Fora da vista, o `Squashable` de lá (cujos campos são todos opcionais) recusava o
  // `PhysicsPlayer` pela regra de tipo fraco do TS: nenhuma propriedade em comum. A vista tem de incluir
  // o que a física ENTREGA, não só o que ela lê.
  'sq' | 'sqT'
>;

/** Pistas espaciais de a11y (platform/audio-nav) que a física dispara. */
export interface PhysicsNav {
  sonar(pl: PhysicsPlayer): void;
  caneTap(pl: PhysicsPlayer): void;
  waterNav(pl: PhysicsPlayer): void;
  needsAudioCues(pl: PhysicsPlayer): boolean;
  panFor(worldX: number, pl: PhysicsPlayer): number;
  playerCtx(pl: PhysicsPlayer): unknown;
}

/** Tudo que a física precisa e que ainda mora no game.js. Sem defaults implícitos: injeção explícita. */
export interface PhysicsCtx {
  isWheelchair(): boolean;      // empatia motora: sem pulo, rampa guia o Y, trampolim vira elevador
  isModoCego(): boolean;        // empatia cegueira: imunidade à lava (ela vira chão)
  caneOn(pl: PhysicsPlayer): boolean; // visão comprometida? (bengala) — muda correr e a cadência de passos
  WORLD_PX_H(): number;         // altura do mundo em px: teto do abismo que dispara o respawn
  sfx(name: string): void;      // earcons.sfx (pulo/poder/dano)
  srSay(msg: string): void;     // leitor de tela, "polite"
  srAlert(msg: string): void;   // leitor de tela, "assertive" (dano na lava)
  hideTips(): void;             // stub de dicas do game.js (mantido para não sumir o call-site)
  showPower(pl: PhysicsPlayer): void; // HUD do poder ativo
  nav: PhysicsNav;              // pistas espaciais (bengala/sonar/nado)
  /** Bipe da guarda de beirada. `OscillatorType` e não `string`: é a união de cinco valores que o Web Audio
   *  aceita, global de `lib.dom` (sem import). Com `string` aqui, o `tonePan` real — que pede a união — não
   *  cabia no ctx, e o erro caía no `main.ts` falando de osciladores (ADR-0039). */
  tonePan(f: number, d: number, cat: string, pan: number, g: number, type: OscillatorType, ctx: unknown): void;
  noiseHit(material: string): void;   // passo por superfície (madeira/parede/…)
  surfaceUnder(pl: PhysicsPlayer): string | null; // material sob os pés (depende do CENARIO)
  puffDust(x: number, y: number, n: number): void; // juice: poeira
  setSquash(pl: PhysicsPlayer, k: number): void;   // juice: esticar/achatar
  addShake(amp: number, t: number): void;          // juice: tremor de tela
  addHitstop(t: number): void;                     // juice: congela o mundo alguns ticks (dano)
  POWER_MSG: (kind: string, botao?: string) => string; // frase do poder, JÁ traduzida (função: o idioma muda). `botao` = chave do nome do botão que a frase cita
  coinPools(): { shapes: readonly string[]; letters: readonly string[] }; // pools por MODO (o sorteio da lava precisa)
  rebuildCoins(): void;         // re-materializa os sprites das moedas sorteadas
  /** Os jogadores. Estado de RODADA (ADR-0038) — instância da raiz, não `let` de módulo. */
  getPlayers(): readonly unknown[];
  updateHud(): void;            // HUD de contagem
}

const NOOP = (): void => { /* até initPhysics() */ };
const DEFAULT_CTX: PhysicsCtx = {
  isWheelchair: () => false, isModoCego: () => false, caneOn: () => false, WORLD_PX_H: () => Infinity,
  sfx: NOOP, srSay: NOOP, srAlert: NOOP, hideTips: NOOP, showPower: NOOP,
  nav: { sonar: NOOP, caneTap: NOOP, waterNav: NOOP, needsAudioCues: () => false, panFor: () => 0, playerCtx: () => null },
  tonePan: NOOP, noiseHit: NOOP, surfaceUnder: () => null,
  puffDust: NOOP, setSquash: NOOP, addShake: NOOP, addHitstop: NOOP,
  POWER_MSG: () => '',
  coinPools: () => ({ shapes: [], letters: [] }), rebuildCoins: NOOP, updateHud: NOOP,
  getPlayers: () => [],
};
let C: PhysicsCtx = DEFAULT_CTX;

/** Liga a física ao game.js. Chamada UMA vez no boot (depois do mundo/colisão). Idempotente. */
export function initPhysics(ctx: PhysicsCtx): void { C = ctx; }

/* ===================== consultas do ambiente + colisão do corpo ===================== */

/** Que ambientes a caixa do jogador está tocando AGORA (água/escada/lava)? */
export function sampleFeatures(pl: PhysicsPlayer): { water: boolean; ladder: boolean; lava: boolean } {
  const l = pl.x - BOX.w / 2, r = pl.x + BOX.w / 2, t = pl.y - BOX.h, b = pl.y;
  let water = false, ladder = false, lava = false;
  for (let ty = Math.floor(t / TILE); ty <= Math.floor((b - 0.01) / TILE); ty++)
    for (let tx = Math.floor(l / TILE); tx <= Math.floor((r - 0.01) / TILE); tx++) {
      const tt = tileAt(tx, ty); if (tt === 3) water = true; if (tt === 4) ladder = true; if (tt === 9) lava = true; if (tt === 5 && C.isWheelchair()) ladder = true; // cadeirante: trampolim = elevador (↑/↓)
    }
  if (C.isWheelchair() && elevAt(pl)) ladder = true; // cadeirante: toda a coluna do poço "segura" o jogador (plataforma), sem gravidade
  return { water, ladder, lava };
}

/** Colisão HORIZONTAL: encosta a caixa na 1ª parede achada e zera vx. */
export function resolveX(pl: PhysicsPlayer): void {
  const l = pl.x - BOX.w / 2, r = pl.x + BOX.w / 2, t = pl.y - BOX.h, b = pl.y;
  const c0 = Math.floor(l / TILE), c1 = Math.floor((r - 0.01) / TILE), r0 = Math.floor(t / TILE), r1 = Math.floor((b - 0.01) / TILE);
  for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
    if (!solidAt(col, row)) continue;
    if (C.isWheelchair() && isWcRampRiser(col, row)) continue; // cadeirante: degrau com rampa não é parede — a rampa guia o Y
    const tl = col * TILE;
    if (pl.vx > 0) pl.x = tl - BOX.w / 2 - 0.01; else if (pl.vx < 0) pl.x = tl + TILE + BOX.w / 2 + 0.01;
    pl.vx = 0; return;
  }
}

/** Colisão VERTICAL: pousa (ou quica no trampolim, tipo 5) descendo; bate a cabeça subindo. */
export function resolveY(pl: PhysicsPlayer): void {
  const l = pl.x - BOX.w / 2, r = pl.x + BOX.w / 2, t = pl.y - BOX.h, b = pl.y;
  const c0 = Math.floor(l / TILE), c1 = Math.floor((r - 0.01) / TILE), r0 = Math.floor(t / TILE), r1 = Math.floor((b - 0.01) / TILE);
  for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
    if (!solidAt(col, row)) continue;
    const tt = row * TILE, type = tileAt(col, row);
    if (pl.vy > 0) {
      pl.y = tt - 0.01;
      if (ehTrampolim(type) && !C.isWheelchair()) { pl.vy = pl.easy ? -EASY.tramp : -(held(pl, 'jump') ? TUNE.trampMax : TUNE.trampBase); } // Fácil: quique suave. Cadeirante: sem quique (é elevador)
      else { pl.vy = 0; pl.onGround = true; }
    } else if (pl.vy < 0) { pl.y = tt + TILE + BOX.h + 0.01; pl.vy = 0; }
    return;
  }
}

/** DANO por lava (o "hurtPlayer" desta base chama-se triggerLava): re-sorteia as moedas e chuta o jogador. */
export function triggerLava(pl: PhysicsPlayer): void {
  if (pl.hurtTimer > 0) return;
  setCoins(pickCoins(COIN_TARGET, C.coinPools())); C.rebuildCoins();
  // `core/state.players` é `Player[]`: a visão da ENGINE. Este jogo sabe que os seus jogadores carregam mais
  // (ADR-0033), e o salto por `unknown` é o preço honesto disso — a engine não pode declarar o campo, e o
  // jogo não pode fingir que ela declara. É o mesmo caso de `coins: unknown[]` no estado compartilhado.
  (C.getPlayers() as readonly PhysicsPlayer[]).forEach((p) => { p.collected = 0; }); C.updateHud();
  C.sfx('hurt'); pl.hurtTimer = 60; pl.vy = -10; pl.vx = (rnd() < 0.5 ? -1 : 1) * 5;
  C.addShake(3, 14); C.addHitstop(4); // JUICE: dano é o impacto mais forte do jogo
  C.srAlert(t('sr.physics.lava'));
}

/* ===================== o passo, em pedaços ===================== */

/** Movimento HORIZONTAL: alternância (1 dedo) ou direita/esquerda; devolve a direção do INPUT (-1/0/1). */
function horizontalMove(pl: PhysicsPlayer, run: boolean, turbo: boolean): number {
  if (pl.toggleMove) { // movimento por alternância (1 dedo): a política é de ENTRADA e mora em input/latch
    const dir = nextLatchedDir(pl.walkDir as LatchDir, pl.leftEdge, pl.rightEdge);
    pl.walkDir = dir;
    pl.vx = TUNE.hWalk * latchedDrive(dir, held(pl, 'left'), held(pl, 'right'));
    return dir;
  }
  const dir = (held(pl, 'right') ? 1 : 0) - (held(pl, 'left') ? 1 : 0); // Fácil: sem correr
  pl.vx = dir * (pl.easy ? TUNE.hWalk * EASY.speed : (run ? (turbo ? TUNE.hTurbo : TUNE.hRun) : TUNE.hWalk)); // E18: super-corrida (turbo); Fácil: andar ×0.7
  return dir;
}

/**
 * A TRAVA DA CORRIDA: com a alternância ligada, a borda do Correr liga e desliga o estado.
 *
 * Fica antes de `updateCling` de propósito — é a mesma borda, e quem a consome primeiro decide o que ela
 * significa. Com a alternância, ela é da trava; sem, ela continua sendo do grude, exatamente como antes.
 */
function updateRunLatch(pl: PhysicsPlayer): void {
  if (!usaTravaDeCorrer(pl) || !pl.runEdge) return;
  pl.runLatch = !pl.runLatch;
  C.sfx('power');
  C.srSay(t(pl.runLatch ? 'sr.physics.runLatchOn' : 'sr.physics.runLatchOff'));
}

/** E18: ventosa (homem-aranha) — gruda na parede ao apertar Correr no ar; solta com Correr de novo. */
function updateCling(pl: PhysicsPlayer): void {
  if (pl.clinging && (pl.onLadder || pl.inWater || pl.activePower !== 'wallcling' || pl.onGround || clingSides(pl).D)) pl.clinging = false; // E18d: pés numa superfície estável (sólido logo abaixo) ENCERRAM; pendurado no teto (pés p/ cima) ou na parede alta continua
  // O GATILHO DO GRUDE muda de botão quando a alternância do correr está ligada: a borda do Correr virou a
  // trava da corrida, então grudar passa para o PULO EM CONTEXTO — no ar, encostado, com o poder. Quem NÃO
  // liga o ajuste não perde nada: `pularVaiGrudar` devolve `false` e o gatilho continua sendo o Correr.
  const grude = { noAr: !pl.onGround, encostado: !!firstClingSide(pl), temAranha: pl.activePower === 'wallcling', jaGrudado: !!pl.clinging };
  const gatilho = pl.runEdge || (!!pl.jumpEdge && pularVaiGrudar(pl, grude));
  if (pl.activePower === 'wallcling' && !pl.clinging && gatilho && !pl.onGround && !pl.onLadder && !pl.inWater && firstClingSide(pl)) {
    pl.clinging = true; pl.clingN = firstClingSide(pl); pl.vy = 0; pl.vx = 0; pl.jumpBuffer = 0; pl.jumpEdge = false; C.sfx('power'); C.srSay(t('sr.physics.spiderOn', { botao: t(botaoDeGrude(pl)) }));
  } else if (pl.clinging && gatilho) { pl.clinging = false; pl.jumpEdge = false; C.sfx('power'); C.srSay(t('sr.physics.spiderOff')); } // E18b: CANCELA só com Correr (não com Pular); a caixa não larga a superfície antes disso
  if (!pl.clinging) pl.clingN = null;
}

/** TROCAR PODER / SONAR: tap curto no swap = troca poder; SEGURAR o swap ou o acorde swap+especial = SONAR (F3). */
function updatePowerSwap(pl: PhysicsPlayer, dt: number): void {
  const doSwap = (): void => {
    if (!pl.owned.length) return; const seq = ['off', ...pl.owned]; const idx = seq.indexOf(pl.activePower); pl.activePower = seq[(idx + 1) % seq.length]!;
    pl.clinging = false; pl.flying = false; C.sfx('power'); C.showPower(pl); C.srSay(C.POWER_MSG(pl.activePower, botaoDeGrude(pl)));
  };
  const swapNow = held(pl, 'swap');
  if (swapNow) {
    pl._swapT += dt;
    if (!pl._swapSonar && (pl._swapT > 18 || held(pl, 'especial'))) { pl._swapSonar = true; C.nav.sonar(pl); } // segurar ~0,3s OU acorde swap+especial
  } else { if (pl._swapDown && !pl._swapSonar) doSwap(); pl._swapT = 0; pl._swapSonar = false; } // soltou após tap curto → troca
  pl._swapDown = swapNow;
}

/** ELEVADOR (cadeirante): toque ↑/↓ = viaja sozinho até a parada segura; andar p/ L/R numa parada sai. */
function rideElevator(pl: PhysicsPlayer): void {
  const s = elevAt(pl);
  if (s) {
    if (pl.elevTarget == null && pl.y > s.yBottom + 0.5) pl.y = s.yBottom; // DESAFUNDA: parado, cola no topo (yBottom) — a rampa deixava uns px dentro do tile
    if (held(pl, 'up') && s.yTop < pl.y - 0.5) pl.elevTarget = s.yTop; else if (held(pl, 'down') && s.yBottom > pl.y + 0.5) pl.elevTarget = s.yBottom;
    if ((held(pl, 'left') || held(pl, 'right'))) { const col = held(pl, 'right') ? s.xMax + 1 : s.xMin - 1, row = Math.floor(pl.y / TILE); if (surfTop(col, row) || surfTop(col, row + 1)) pl.elevTarget = null; } // sai p/ o piso ao lado, mesmo 1 tile ABAIXO (trampolim-bloco sobre o chão)
  }
  if (pl.elevTarget != null) {
    const dy = pl.elevTarget - pl.y;
    if (Math.abs(dy) <= ELEV_SPEED) { pl.y = pl.elevTarget; pl.vy = 0; pl.elevTarget = null; } else pl.vy = Math.sign(dy) * ELEV_SPEED;
  }
}

/** E18c: movimento TANGENTE à face grudada; a caixa fica colada até cancelar com Correr. */
function moveClinging(pl: PhysicsPlayer): void {
  const sp = TUNE.climbSpeed;
  if (pl.clingN === 'R') pl.facing = 1; else if (pl.clingN === 'L') pl.facing = -1;   // E18e: ALPINISMO — vira de frente PARA a parede
  if (pl.clingN === 'U' || pl.clingN === 'D') { pl.vy = 0; const h = held(pl, 'left') ? -1 : held(pl, 'right') ? 1 : 0; pl.vx = h * sp; if (h) pl.facing = h; } // teto/chão: anda na horizontal
  else { pl.vx = 0; pl.vy = held(pl, 'up') ? -sp : held(pl, 'down') ? sp : 0; }       // parede: sobe/desce
}

/** ESCADA: sobe/desce a 1,5 px/quadro e pode saltar dela (cadeirante vira elevador). */
function moveOnLadder(pl: PhysicsPlayer): void {
  pl.vy = 0;
  if (C.isWheelchair()) { rideElevator(pl); return; }
  if (held(pl, 'up')) pl.vy = -TUNE.climbSpeed; else if (held(pl, 'down')) pl.vy = TUNE.climbSpeed;
  if (pl.jumpBuffer > 0) { pl.vy = (pl.activePower === 'ultrajump') ? -TUNE.ultraJumpVel : jumpVel(pl, pl.activePower === 'superjump' ? 9 : 5); pl.onLadder = false; pl.jumpBuffer = 0; C.sfx('jump'); C.hideTips(); }
}

/** VOO ATIVO: Cima sobe / Baixo desce / plana parado (Pular alterna, tratado antes). */
function moveFlying(pl: PhysicsPlayer, turbo: boolean): void {
  pl.waterStroke = 0; const fs = turbo ? 3.9 : 2.6;
  if (held(pl, 'up')) pl.vy = -fs; else if (held(pl, 'down')) pl.vy = fs; else pl.vy *= 0.7;
  pl.vy = Math.max(-fs, Math.min(fs, pl.vy));
}

/** Gravidade + nado + pulo do chão (bunny-hop). Devolve `fired` (pulou NESTE quadro). */
function moveBallistic(pl: PhysicsPlayer, dt: number, run: boolean): boolean {
  let fired = false;
  const g = (pl.inWater ? 0.10 : TUNE.gravity) * (pl.easy ? EASY.grav : 1); // Fácil: gravidade ×2/3
  if (!(pl.onGround && pl.vy >= 0)) pl.vy += g * dt;
  if (pl.easy && held(pl, 'jump') && pl.vy > EASY.slowFall && !pl.inWater) pl.vy = EASY.slowFall; // Fácil: segurar pulo = flutua descendo
  if (pl.inWater) {
    if (held(pl, 'jump')) { if (pl.waterStroke <= 0) { pl.vy -= run ? TUNE.waterJumpRun : TUNE.waterJump; pl.waterStroke = TUNE.waterStrokeFrames; } }
    else pl.waterStroke = 0;
    if (pl.waterStroke > 0) pl.waterStroke -= dt;
    pl.vy = Math.min(pl.vy, TUNE.waterMaxFall);
    return fired;
  }
  pl.waterStroke = 0;
  if (pl.onGround && pl.jumpBuffer > 0 && !C.isWheelchair()) { // E18: pulo encadeado (bunny-hop). Cadeirante: sem pulo.
    if (run && isBouncyGroundBelow(pl) && pl.jumpChain > 0) pl.jumpChain = Math.min(pl.jumpChain + 1, 3); else pl.jumpChain = 1;
    pl.vy = (pl.activePower === 'ultrajump') ? -TUNE.ultraJumpVel : jumpVel(pl, pl.activePower === 'superjump' ? 9 : [0, 5, 8, 9][pl.jumpChain]!);
    pl.onGround = false; pl.jumpBuffer = 0; fired = true; C.sfx('jump'); C.hideTips();
    C.setSquash(pl, 0.16); C.puffDust(pl.x, pl.y, 3); // JUICE: estica ao saltar + poeira do impulso
  }
  pl.vy = Math.min(pl.vy, TUNE.maxFall);
  return fired;
}

/** Proteção de borda (Fácil/alternância/cadeirante): andar não derruba em fosso; só cai segurando ↓. */
function ledgeProtect(pl: PhysicsPlayer, dt: number): void {
  if (!((pl.easy || pl.toggleMove || C.isWheelchair()) && pl.onGround && pl.vx !== 0 && !held(pl, 'down') && !pl.inWater && !pl.onLadder && !pl.flying && !pl.clinging)) return;
  const dirX = pl.vx > 0 ? 1 : -1, leadX = pl.x + dirX * (BOX.w / 2) + pl.vx * dt, leadTx = Math.floor(leadX / TILE), belowTy = Math.floor((pl.y + 1) / TILE);
  const grounded = solidAt(leadTx, belowTy) || (C.isWheelchair() && solidAt(leadTx, belowTy + 1)); // cadeirante: rampa = chão a até 1 tile abaixo (não é fosso)
  if (!grounded) pl.vx = 0;
}

/** Integra a posição, resolve colisão em X e Y (ou cola na rampa de 45°, no modo cadeirante). */
function integrateAndCollide(pl: PhysicsPlayer, dt: number): void {
  const _preX = pl.x, _preY = pl.y;
  pl.x += pl.vx * dt; resolveX(pl);
  // Cadeirante: anda COLADO na superfície da rampa 45° (sobe e desce a diagonal desenhada), em vez do antigo empurrão
  const _ry = (C.isWheelchair() && !pl.onLadder && !pl.inWater && !pl.flying) ? rampSurfaceY(pl.x, pl.y) : null;
  if (_ry != null && Math.abs(_ry - pl.y) <= TILE + 4 && (_ry < pl.y || pl.onGround)) {
    pl.y = _ry; pl.vy = 0; pl.onGround = true;                 // superfície da rampa (subindo sempre; descendo só se já apoiado)
  } else {
    pl.onGround = false; pl._fallV = pl.vy; pl.y += pl.vy * dt; resolveY(pl); // _fallV: velocidade ANTES do resolve (p/ juice de pouso)
  }
  if (pl.clinging) spiderReattach(pl, _preX, _preY); // E18c: mantém contato e contorna quinas (parede↔teto↔topo)
}

/** JUICE do pouso após queda real + contadores de chão/ar (airTime estabiliza a animação). */
function landingAndTimers(pl: PhysicsPlayer, dt: number, fired: boolean): void {
  if (pl.onGround && pl.airTime > 6 && !pl.inWater) { // airTime ainda é o valor do ar
    const v = pl._fallV || 0;
    if (v > 1.2) { C.puffDust(pl.x, pl.y, Math.min(8, 2 + Math.round(v))); C.setSquash(pl, -0.08 - 0.03 * v); if (v >= TUNE.maxFall * 0.85) C.addShake(2.5, 10); }
  }
  if (pl.onGround && !fired) { if (++pl.groundIdle > 10) pl.jumpChain = 0; } else pl.groundIdle = 0; // zera cadeia parado
  if (pl.onGround) pl.airTime = 0; else pl.airTime += dt; // E16: tempo no ar (estabiliza anim — onGround pisca ao repousar)
}

/**
 * F2: passos por superfície · escada (madeira) · escalada (parede) · bengala. Cadência = ritmo do andar/correr.
 *
 * EXPORTADA pelo mesmo motivo de sampleFeatures/resolveX/resolveY: o teste alcança a peça em vez de repetir o
 * quadro inteiro. E aqui isso importa mais que nas outras — a cadeia de `else if` daqui já esteve errada por
 * meses sem que nada acusasse, porque som não aparece em trajetória e a fixture-ouro só olha posição.
 */
export function stepSounds(pl: PhysicsPlayer, dt: number, dir: number, run: boolean): void {
  // A ORDEM aqui e a especificacao. Antes, `escada` e `parede` eram `else if` pendurados em `if (!pl.inWater)`
  // — ou seja, so eram alcancaveis DENTRO da agua. Fora dela, subir escada e escalar parede nao faziam som
  // nenhum, e som de passo nao e enfeite: e por onde quem joga sem ver sabe que esta se movendo e em que
  // superficie. Agora as duas vem primeiro, valendo dentro e fora da agua.
  if (pl.onLadder && pl.vy !== 0) { pl.stepT += dt; if (pl.stepT >= 20) { pl.stepT = 0; C.noiseHit('madeira'); } }
  else if (pl.clinging && (pl.vx !== 0 || pl.vy !== 0)) { pl.stepT += dt; if (pl.stepT >= 16) { pl.stepT = 0; C.noiseHit('parede'); } }
  else if (!pl.inWater) {
    if (C.caneOn(pl)) {
      if (pl.airTime <= 5) { // modo cego: chão ESTÁVEL (coyote) evita o flicker do onGround
        if (dir !== 0) { pl.caneDist = (pl.caneDist || 0) + Math.abs(pl.vx * dt); if (pl.caneDist >= caneBlockPx()) { pl.caneDist = 0; C.nav.caneTap(pl); } } // ANDANDO: batida por DISTÂNCIA
        else { pl.caneDist = 0; if (botaoDeCorrerEngatado(pl, held(pl, 'run'))) { pl.stepT += dt; if (pl.stepT >= 25) { pl.stepT = 0; C.nav.caneTap(pl); } } else pl.stepT = 99; } // PARADO: sem batida; correr ENGATADO = sondagem (com a alternância, a trava; sem ela, segurar)
      }
    } else if (pl.onGround && dir !== 0) {
      const cad = correndoAgora(pl, held(pl, 'run')) ? 11 : 17; pl.stepT += dt; // a cadência do passo segue a corrida, trava inclusive
      if (pl.stepT >= cad) { pl.stepT = 0; const m = C.surfaceUnder(pl); if (m) C.noiseHit(m); if (run) C.puffDust(pl.x - pl.facing * 5, pl.y, 2); }
    }
  }
  else if (C.caneOn(pl)) { C.nav.waterNav(pl); } // NADO CEGO: guia por contato (paredes/chao/superficie-cordas)
  else pl.stepT = 99; // parado -> proximo passo soa logo ao recomecar
}

/** F3: guarda de beirada — bipa ao caminhar em direção a um fosso (só com a visão comprometida). */
function ledgeGuardBeep(pl: PhysicsPlayer, dt: number, dir: number): void {
  if (C.nav.needsAudioCues(pl) && pl.onGround && dir !== 0 && !pl.inWater && !pl.onLadder && !pl.flying && !pl.clinging) {
    const leadTx = Math.floor((pl.x + dir * (BOX.w / 2 + TILE * 0.5)) / TILE), belowTy = Math.floor((pl.y + 1) / TILE);
    if (!solidAt(leadTx, belowTy)) { pl.guardT += dt; if (pl.guardT >= 9) { pl.guardT = 0; C.tonePan(760, 0.06, 'guard', C.nav.panFor((leadTx + 0.5) * TILE, pl), 0.16, 'square', C.nav.playerCtx(pl)); } } else pl.guardT = 99;
  } else pl.guardT = 99;
}

/** O que a física devolve ao game.js: `ran=false` = o `return` seco do original; `dir` alimenta a animação. */
export interface StepResult { ran: boolean; dir: number }

/**
 * UM quadro de física para UM jogador. Ordem e efeitos idênticos ao stepPlayer do monólito (linhas 905-1023),
 * até o respawn por queda — coleta/portão/animação continuam no game.js.
 */
export function stepPlayer(pl: PhysicsPlayer, dt: number): StepResult {
  if (pl.quiz || pl.quit || pl.waiting) return { ran: false, dir: 0 }; // em desafio; abandonou; ou ESPERANDO apertar um botão para entrar
  // A TRAVA entra aqui: com `toggleRun`, correr é ESTADO e a tecla segurada não conta (ver game/run-toggle).
  // A guarda da bengala fica de fora da decisão pura porque ela pergunta ao JOGO (`caneOn`), e o módulo puro
  // não conhece jogo nenhum.
  const run = correndoAgora(pl, held(pl, 'run')) && (!C.caneOn(pl) || !!pl.runCane), turbo = pl.activePower === 'turbo'; // cego só corre com a bengala de corrida
  const dir = horizontalMove(pl, run, turbo);
  if (dir !== 0) pl.facing = dir; pl.leftEdge = false; pl.rightEdge = false;
  const feat = sampleFeatures(pl); pl.inWater = feat.water; pl.onLadder = feat.ladder;
  if (pl.hurtTimer > 0) pl.hurtTimer -= dt;
  if (feat.lava && !pl.easy && !C.isWheelchair() && !C.isModoCego()) triggerLava(pl); // Fácil, cadeirante e CEGO: imunidade (lava vira chão)
  if (pl.jumpEdge) pl.jumpBuffer = 7; else if (pl.jumpBuffer > 0) pl.jumpBuffer--;
  updateRunLatch(pl); // ANTES do grude: com a alternância, a borda do Correr é da trava
  updateCling(pl);
  updatePowerSwap(pl, dt);
  if (pl.specialEdge) { /* TODO: ação especial por poder/contexto (stub — apenas registra o gatilho) */ }
  pl.jumpEdge = false; pl.runEdge = false; pl.swapEdge = false; pl.specialEdge = false;
  // E16c: voo é ALTERNADO pelo Pulo NO AR (com o poder ativo): pula no ar → liga; pula voando → desliga.
  // Tocar o solo ou a água também encerra. (Antes ligava ao coletar; agora exige o pulo no ar.)
  if (pl.activePower === 'fly' && pl.jumpBuffer > 0 && !pl.onGround) { pl.flying = !pl.flying; pl.jumpBuffer = 0; C.sfx('power'); C.srSay(pl.flying ? 'Voo ativado! Cima/Baixo sobem e descem; Pular encerra.' : 'Voo encerrado.'); }
  if (pl.flying && (pl.onGround || pl.inWater || pl.activePower !== 'fly')) pl.flying = false;
  let fired = false;
  if (pl.clinging) moveClinging(pl);
  else if (pl.onLadder) moveOnLadder(pl);
  else if (pl.flying) moveFlying(pl, turbo);
  else fired = moveBallistic(pl, dt, run);
  ledgeProtect(pl, dt);
  integrateAndCollide(pl, dt);
  landingAndTimers(pl, dt, fired);
  stepSounds(pl, dt, dir, run);
  ledgeGuardBeep(pl, dt, dir);
  if (pl.y - BOX.h > C.WORLD_PX_H() + 40) { pl.x = SPAWN_X; pl.y = SPAWN_Y; pl.vx = pl.vy = 0; }
  return { ran: true, dir };
}
