// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de game/physics — as partes PURAS da física do jogador (project node). Padrões: ZOMBIES + Right-BICEP.
// A física lê o mundo por core/collision → aqui montamos mundos FALSOS minúsculos (initCollision) e sondamos
// um jogador em coordenadas calculadas (BOX 10×30, TILE 16; pl.y = pés, pl.x = centro). O ctx do game.js entra
// todo no-op (initPhysics) — som/sprite/HUD não movem ninguém. O REPLAY das trajetórias reais mora em
// tests/physics-golden.node.test.js; aqui isolamos regra a regra, com números vindos de core/constants.
import { describe, it, expect, beforeEach } from 'vitest';
import * as COL from '../app/js/core/collision.js';
import { initElevators, buildElevators } from '../app/js/game/elevators.js';
import { makePlayer, BOX, SPAWN_X, SPAWN_Y, jumpVel } from '../app/js/game/player.js';
import { TILE, TUNE, EASY } from '../app/js/core/constants.js';
import { keys } from '../app/js/input/state.js';
import { KB_DEFAULTS } from '../app/js/input/keyboard.js';
import * as PHY from '../app/js/game/physics.js';

const noop = () => { /* stub */ };
const NAV = { sonar: noop, caneTap: noop, waterNav: noop, needsAudioCues: () => false, panFor: () => 0, playerCtx: () => null };
// ctx padrão: modo normal (sem cadeira, sem cegueira), mundo alto o bastante para o respawn não disparar.
const CTX = (over = {}) => ({
  isWheelchair: () => false, isModoCego: () => false, caneOn: () => false, WORLD_PX_H: () => 10000,
  sfx: noop, srSay: noop, srAlert: noop, hideTips: noop, showPower: noop, nav: NAV,
  tonePan: noop, noiseHit: noop, surfaceUnder: () => null,
  puffDust: noop, setSquash: noop, addShake: noop, addHitstop: noop, POWER_MSG: () => '',
  coinPools: () => ({ shapes: [], letters: [] }), rebuildCoins: noop, updateHud: noop, setCollected: noop,
  ...over,
});
const useWorld = (grid, colOver = {}) => COL.initCollision({
  world: grid, W: grid[0].length, H: grid.length,
  isWheelchair: () => false, isModoCego: () => false, caneDiv: () => 1,
  wcSolid: () => new Set(), gateTiles: () => new Set(), gateOpen: () => true, ...colOver,
});
// jogador limpo com o esquema SOLO (correr=KeyU, pulo=KeyJ/Space, especial=KeyK — armadilha documentada no fixture)
function novo(over = {}) {
  const pl = makePlayer(0);
  pl.ctrl = JSON.parse(JSON.stringify(KB_DEFAULTS.solo)); pl.pad = -1;
  return Object.assign(pl, over);
}
const AR = (w, h) => Array.from({ length: h }, () => new Array(w).fill(1)); // 1 = ar (não-sólido)
// chão de PEDRA(2) na última linha; 8 colunas × 6 linhas → topo do chão em y=80
function chao() { const g = AR(8, 6); g[5] = new Array(8).fill(2); return g; }

beforeEach(() => {
  keys.clear();
  initElevators({ W: 8, H: 6, isWheelchair: () => false }); buildElevators();
  PHY.initPhysics(CTX());
});

/* ===================== sampleFeatures: em que ambiente a caixa está ===================== */
describe('game/physics — sampleFeatures (água/escada/lava sob a caixa)', () => {
  // jogador em x=24,y=64 ocupa a coluna 1 (x 19..28,99) e as linhas 2..3 (y 34..63,99).
  const at = () => novo({ x: 24, y: 64 });
  it('[Zero] só ar → nenhum ambiente', () => {
    useWorld(AR(8, 6));
    expect(PHY.sampleFeatures(at())).toEqual({ water: false, ladder: false, lava: false });
  });
  it('[Right] água(3) dentro da caixa → water', () => {
    const g = AR(8, 6); g[3][1] = 3; useWorld(g);
    expect(PHY.sampleFeatures(at()).water).toBe(true);
  });
  it('[Right] escada(4) dentro da caixa → ladder', () => {
    const g = AR(8, 6); g[2][1] = 4; useWorld(g);
    expect(PHY.sampleFeatures(at()).ladder).toBe(true);
  });
  it('[Right] lava(9) dentro da caixa → lava', () => {
    const g = AR(8, 6); g[3][1] = 9; useWorld(g);
    expect(PHY.sampleFeatures(at()).lava).toBe(true);
  });
  it('[Boundary] a caixa a cavalo de DUAS colunas enxerga o tile da coluna vizinha', () => {
    const g = AR(8, 6); g[3][2] = 3; useWorld(g);
    expect(PHY.sampleFeatures(novo({ x: 24, y: 64 })).water).toBe(false); // x=24 fica só na coluna 1
    expect(PHY.sampleFeatures(novo({ x: 32, y: 64 })).water).toBe(true);  // x=32 pega as colunas 1 e 2
  });
  it('[Boundary] tile logo ABAIXO dos pés (linha 4) está fora da caixa → não conta', () => {
    const g = AR(8, 6); g[4][1] = 3; useWorld(g);
    expect(PHY.sampleFeatures(at()).water).toBe(false);
  });
  it('[Interface/cadeirante] trampolim(5) vira ESCADA (elevador) só no modo cadeirante', () => {
    const g = AR(8, 6); g[3][1] = 5;
    useWorld(g); PHY.initPhysics(CTX());
    expect(PHY.sampleFeatures(at()).ladder).toBe(false);
    useWorld(g, { isWheelchair: () => true }); PHY.initPhysics(CTX({ isWheelchair: () => true }));
    expect(PHY.sampleFeatures(at()).ladder).toBe(true);
  });
});

/* ===================== resolveX / resolveY: colisão da caixa ===================== */
describe('game/physics — resolveX (parede lateral)', () => {
  it('[Right] indo p/ a DIREITA encosta no bordo esquerdo do tile e zera vx', () => {
    const g = AR(8, 6); g[3][4] = 2; useWorld(g); // parede na coluna 4 (x 64..79), linha 3 (y 48..63)
    const pl = novo({ x: 62, y: 60, vx: 3 });
    PHY.resolveX(pl);
    expect(pl.x).toBe(4 * TILE - BOX.w / 2 - 0.01);
    expect(pl.vx).toBe(0);
  });
  it('[Inverse] indo p/ a ESQUERDA encosta no bordo direito do tile', () => {
    const g = AR(8, 6); g[3][1] = 2; useWorld(g);
    const pl = novo({ x: 34, y: 60, vx: -3 });
    PHY.resolveX(pl);
    expect(pl.x).toBe(1 * TILE + TILE + BOX.w / 2 + 0.01);
    expect(pl.vx).toBe(0);
  });
  it('[Zero] sem parede na varredura → nada muda', () => {
    useWorld(AR(8, 6));
    const pl = novo({ x: 40, y: 60, vx: 3 });
    PHY.resolveX(pl);
    expect(pl.x).toBe(40); expect(pl.vx).toBe(3);
  });
});

describe('game/physics — resolveY (pouso, teto e trampolim)', () => {
  it('[Right] caindo sobre o chão: cola 0,01px acima do tile, zera vy e fica onGround', () => {
    useWorld(chao());
    const pl = novo({ x: 40, y: 81, vy: 4 });
    PHY.resolveY(pl);
    expect(pl.y).toBe(5 * TILE - 0.01);
    expect(pl.vy).toBe(0);
    expect(pl.onGround).toBe(true);
  });
  it('[Inverse] subindo bate a cabeça: desce para logo abaixo do teto e zera vy', () => {
    const g = AR(8, 6); g[1] = new Array(8).fill(2); useWorld(g); // teto na linha 1 (y 16..31)
    const pl = novo({ x: 40, y: 61, vy: -4 });
    PHY.resolveY(pl);
    expect(pl.y).toBe(1 * TILE + TILE + BOX.h + 0.01);
    expect(pl.vy).toBe(0);
    expect(pl.onGround).toBe(false);
  });
  it('[Exception] TRAMPOLIM(5) quica com trampBase e NÃO marca onGround', () => {
    const g = AR(8, 6); g[5] = new Array(8).fill(5); useWorld(g);
    const pl = novo({ x: 40, y: 81, vy: 4 });
    PHY.resolveY(pl);
    expect(pl.vy).toBe(-TUNE.trampBase);
    expect(pl.onGround).toBe(false);
  });
  it('[Exception] segurar PULAR no trampolim quica mais alto (trampMax)', () => {
    const g = AR(8, 6); g[5] = new Array(8).fill(5); useWorld(g);
    const pl = novo({ x: 40, y: 81, vy: 4 });
    keys.add('KeyJ');
    PHY.resolveY(pl);
    expect(pl.vy).toBe(-TUNE.trampMax);
  });
  it('[Exception/Fácil] no modo Fácil o quique é o suave EASY.tramp, mesmo segurando Pular', () => {
    const g = AR(8, 6); g[5] = new Array(8).fill(5); useWorld(g);
    const pl = novo({ x: 40, y: 81, vy: 4, easy: true });
    keys.add('KeyJ');
    PHY.resolveY(pl);
    expect(pl.vy).toBe(-EASY.tramp);
  });
  it('[Exception/cadeirante] cadeirante NÃO quica no trampolim — ele é chão (elevador)', () => {
    const g = AR(8, 6); g[5] = new Array(8).fill(5);
    useWorld(g, { isWheelchair: () => true }); PHY.initPhysics(CTX({ isWheelchair: () => true }));
    const pl = novo({ x: 40, y: 81, vy: 4 });
    PHY.resolveY(pl);
    expect(pl.vy).toBe(0);
    expect(pl.onGround).toBe(true);
  });
});

/* ===================== stepPlayer: movimento horizontal ===================== */
describe('game/physics — stepPlayer: velocidade horizontal por modo', () => {
  beforeEach(() => useWorld(chao()));
  const noChao = (over) => novo({ x: 40, y: 5 * TILE - 0.01, onGround: true, ...over });
  it('[Zero] sem tecla → parado', () => {
    const pl = noChao();
    expect(PHY.stepPlayer(pl, 1).dir).toBe(0);
    expect(pl.vx).toBe(0);
  });
  it('[Right] ANDAR (só direção) = TUNE.hWalk', () => {
    const pl = noChao(); keys.add('KeyD');
    expect(PHY.stepPlayer(pl, 1).dir).toBe(1);
    expect(pl.vx).toBe(TUNE.hWalk);
  });
  it('[Right] CORRER (direção + KeyU) = TUNE.hRun — e KeyU é mesmo a tecla de correr', () => {
    const pl = noChao(); keys.add('KeyD'); keys.add('KeyU');
    PHY.stepPlayer(pl, 1);
    expect(pl.vx).toBe(TUNE.hRun);
    expect(TUNE.hRun).not.toBe(TUNE.hWalk); // se fossem iguais o teste não discriminaria (armadilha do fixture)
  });
  it('[Interface] KeyK é o ESPECIAL, não o correr: com ele a velocidade segue a de andar', () => {
    const pl = noChao(); keys.add('KeyD'); keys.add('KeyK');
    PHY.stepPlayer(pl, 1);
    expect(pl.vx).toBe(TUNE.hWalk);
  });
  it('[Right] TURBO (poder ativo + correr) = TUNE.hTurbo', () => {
    const pl = noChao({ activePower: 'turbo' }); keys.add('KeyD'); keys.add('KeyU');
    PHY.stepPlayer(pl, 1);
    expect(pl.vx).toBe(TUNE.hTurbo);
  });
  it('[Inverse] esquerda espelha a direita e vira o facing', () => {
    const pl = noChao(); keys.add('KeyA');
    expect(PHY.stepPlayer(pl, 1).dir).toBe(-1);
    expect(pl.vx).toBe(-TUNE.hWalk);
    expect(pl.facing).toBe(-1);
  });
  it('[Zero] as duas direções juntas se cancelam (dir=0) e o facing NÃO muda', () => {
    const pl = noChao({ facing: -1 }); keys.add('KeyA'); keys.add('KeyD');
    expect(PHY.stepPlayer(pl, 1).dir).toBe(0);
    expect(pl.vx).toBe(0);
    expect(pl.facing).toBe(-1);
  });
  it('[Exception/Fácil] modo Fácil anda a hWalk×EASY.speed e IGNORA a tecla de correr', () => {
    const pl = noChao({ easy: true }); keys.add('KeyD'); keys.add('KeyU');
    PHY.stepPlayer(pl, 1);
    expect(pl.vx).toBeCloseTo(TUNE.hWalk * EASY.speed, 10);
  });
  it('[Exception/cego] sem a bengala de corrida o cego NÃO corre; com ela, corre', () => {
    PHY.initPhysics(CTX({ caneOn: () => true }));
    const sem = noChao(); keys.add('KeyD'); keys.add('KeyU');
    PHY.stepPlayer(sem, 1);
    expect(sem.vx).toBe(TUNE.hWalk);
    const com = noChao({ runCane: true });
    PHY.stepPlayer(com, 1);
    expect(com.vx).toBe(TUNE.hRun);
  });
  it('[Many/alternância] toggleMove: toque trava 1/3 da velocidade; segurando vai a 2/3', () => {
    const travado = noChao({ toggleMove: true, rightEdge: true });
    PHY.stepPlayer(travado, 1);
    expect(travado.vx).toBeCloseTo(TUNE.hWalk / 3, 10);
    const segurando = noChao({ toggleMove: true, walkDir: 1 }); keys.add('KeyD');
    PHY.stepPlayer(segurando, 1);
    expect(segurando.vx).toBeCloseTo(TUNE.hWalk * 2 / 3, 10);
  });
  it('[Many/alternância] tocar de novo na MESMA direção para o jogador', () => {
    const pl = noChao({ toggleMove: true, walkDir: 1, rightEdge: true });
    expect(PHY.stepPlayer(pl, 1).dir).toBe(0);
    expect(pl.vx).toBe(0);
  });
  it('[Cross-check] andar 10 quadros no plano percorre exatamente 10×hWalk px', () => {
    const pl = noChao(); keys.add('KeyD');
    const x0 = pl.x;
    for (let i = 0; i < 10; i++) PHY.stepPlayer(pl, 1);
    expect(pl.x - x0).toBeCloseTo(10 * TUNE.hWalk, 10);
  });
});

/* ===================== stepPlayer: gravidade, tetos de queda e pulo ===================== */
describe('game/physics — stepPlayer: queda', () => {
  it('[Right] em queda livre vy cresce de TUNE.gravity por quadro', () => {
    useWorld(AR(8, 60));
    const pl = novo({ x: 40, y: 100 });
    PHY.stepPlayer(pl, 1);
    expect(pl.vy).toBeCloseTo(TUNE.gravity, 10);
    PHY.stepPlayer(pl, 1);
    expect(pl.vy).toBeCloseTo(2 * TUNE.gravity, 10);
  });
  it('[Boundary] a queda satura no teto TUNE.maxFall e não passa dele', () => {
    useWorld(AR(8, 200));
    const pl = novo({ x: 40, y: 100 });
    for (let i = 0; i < 80; i++) PHY.stepPlayer(pl, 1);
    expect(pl.vy).toBe(TUNE.maxFall);
  });
  it('[Boundary/água] dentro da água a gravidade é 0,10 e o teto é TUNE.waterMaxFall', () => {
    const g = AR(8, 60); for (let y = 0; y < 60; y++) g[y].fill(3); useWorld(g);
    const pl = novo({ x: 40, y: 100 });
    PHY.stepPlayer(pl, 1);
    expect(pl.inWater).toBe(true);
    expect(pl.vy).toBeCloseTo(0.10, 10);
    for (let i = 0; i < 80; i++) PHY.stepPlayer(pl, 1);
    expect(pl.vy).toBe(TUNE.waterMaxFall);
  });
  it('[Exception/Fácil] Fácil: gravidade ×EASY.grav e segurar Pular limita a descida a EASY.slowFall', () => {
    useWorld(AR(8, 60));
    const pl = novo({ x: 40, y: 100, easy: true });
    PHY.stepPlayer(pl, 1);
    expect(pl.vy).toBeCloseTo(TUNE.gravity * EASY.grav, 10);
    keys.add('KeyJ');
    for (let i = 0; i < 60; i++) PHY.stepPlayer(pl, 1);
    expect(pl.vy).toBe(EASY.slowFall);
  });
});

describe('game/physics — stepPlayer: pulo e buffer', () => {
  beforeEach(() => useWorld(chao()));
  const noChao = (over) => novo({ x: 40, y: 5 * TILE - 0.01, onGround: true, ...over });
  it('[Right] pulo do chão sai com jumpVel(5 tiles) = -TUNE.jumpVel e tira o pé do chão', () => {
    const pl = noChao({ jumpEdge: true });
    PHY.stepPlayer(pl, 1);
    expect(pl.vy).toBeCloseTo(jumpVel(pl, 5), 10);
    expect(pl.vy).toBeCloseTo(-TUNE.jumpVel, 10);
    expect(pl.jumpBuffer).toBe(0);
  });
  it('[Right] ULTRA-pulo ignora a fórmula e sai com -TUNE.ultraJumpVel', () => {
    const pl = noChao({ jumpEdge: true, activePower: 'ultrajump' });
    PHY.stepPlayer(pl, 1);
    expect(pl.vy).toBe(-TUNE.ultraJumpVel);
  });
  it('[Right] SUPER-pulo usa sempre a altura máxima (9 tiles)', () => {
    const pl = noChao({ jumpEdge: true, activePower: 'superjump' });
    PHY.stepPlayer(pl, 1);
    expect(pl.vy).toBeCloseTo(jumpVel(pl, 9), 10);
  });
  it('[Boundary] o buffer nasce em 7 no ar e decai 1 por quadro', () => {
    useWorld(AR(8, 60));
    const pl = novo({ x: 40, y: 100, jumpEdge: true });
    PHY.stepPlayer(pl, 1);
    expect(pl.jumpBuffer).toBe(7);
    PHY.stepPlayer(pl, 1);
    expect(pl.jumpBuffer).toBe(6);
  });
  it('[Boundary] o buffer guardado no ar dispara o pulo ao TOCAR o chão (coyote invertido)', () => {
    const g = AR(8, 6); g[5] = new Array(8).fill(2); useWorld(g);
    const pl = novo({ x: 40, y: 5 * TILE - 0.5, vy: 1, jumpEdge: true }); // meio pixel acima do chão, caindo
    PHY.stepPlayer(pl, 1);                                               // pousa neste quadro; buffer=7
    expect(pl.onGround).toBe(true);
    expect(pl.jumpBuffer).toBe(7);
    PHY.stepPlayer(pl, 1);                                               // no chão com buffer>0 → PULA
    expect(pl.vy).toBeLessThan(0);
    expect(pl.jumpBuffer).toBe(0);
  });
  it('[Exception/cadeirante] cadeirante não pula: o buffer fica, a velocidade não', () => {
    PHY.initPhysics(CTX({ isWheelchair: () => true }));
    const pl = noChao({ jumpEdge: true });
    PHY.stepPlayer(pl, 1);
    expect(pl.vy).toBe(0);
    expect(pl.jumpBuffer).toBe(7);
  });
});

/* ===================== stepPlayer: escada, proteção de borda, respawn, portas de saída ===================== */
describe('game/physics — stepPlayer: escada', () => {
  const escada = () => { const g = AR(8, 20); for (let y = 0; y < 20; y++) g[y][2] = 4; return g; };
  it('[Right] segurando ↑ sobe a TUNE.climbSpeed, sem gravidade', () => {
    useWorld(escada());
    const pl = novo({ x: 40, y: 160 }); keys.add('KeyW');
    PHY.stepPlayer(pl, 1);
    expect(pl.onLadder).toBe(true);
    expect(pl.vy).toBe(-TUNE.climbSpeed);
    expect(pl.y).toBe(160 - TUNE.climbSpeed);
  });
  it('[Inverse] segurando ↓ desce à mesma velocidade', () => {
    useWorld(escada());
    const pl = novo({ x: 40, y: 160 }); keys.add('KeyS');
    PHY.stepPlayer(pl, 1);
    expect(pl.vy).toBe(TUNE.climbSpeed);
  });
  it('[Zero] na escada sem tecla o jogador FICA parado (a escada segura)', () => {
    useWorld(escada());
    const pl = novo({ x: 40, y: 160 });
    PHY.stepPlayer(pl, 1);
    expect(pl.vy).toBe(0);
    expect(pl.y).toBe(160);
  });
  it('[Right] pular da escada solta o jogador dela', () => {
    useWorld(escada());
    const pl = novo({ x: 40, y: 160, jumpEdge: true });
    PHY.stepPlayer(pl, 1);
    expect(pl.onLadder).toBe(false);
    expect(pl.vy).toBeCloseTo(jumpVel(pl, 5), 10);
  });
});

describe('game/physics — stepPlayer: proteção de borda (Fácil/alternância/cadeirante)', () => {
  // chão só até a coluna 3; a partir da 4 é fosso. Jogador no último tile firme, andando p/ a direita.
  const beirada = () => { const g = AR(8, 6); for (let x = 0; x <= 3; x++) g[5][x] = 2; return g; };
  it('[Right/Fácil] andar em direção ao fosso zera vx (não derruba)', () => {
    useWorld(beirada());
    const pl = novo({ x: 58, y: 5 * TILE - 0.01, onGround: true, easy: true }); keys.add('KeyD');
    PHY.stepPlayer(pl, 1);
    expect(pl.vx).toBe(0);
    expect(pl.x).toBe(58);
  });
  it('[Exception] segurando ↓ a proteção sai do caminho e o jogador cai', () => {
    useWorld(beirada());
    const pl = novo({ x: 58, y: 5 * TILE - 0.01, onGround: true, easy: true }); keys.add('KeyD'); keys.add('KeyS');
    PHY.stepPlayer(pl, 1);
    expect(pl.x).toBeGreaterThan(58);
  });
  it('[Inverse] fora do Fácil/alternância/cadeirante NÃO há proteção — o jogador anda para o fosso', () => {
    useWorld(beirada());
    const pl = novo({ x: 58, y: 5 * TILE - 0.01, onGround: true }); keys.add('KeyD');
    PHY.stepPlayer(pl, 1);
    expect(pl.x).toBeGreaterThan(58);
  });
});

describe('game/physics — stepPlayer: respawn por queda no abismo', () => {
  it('[Boundary] passou de WORLD_PX_H+40 (medido pela CABEÇA) → volta ao spawn com velocidade zerada', () => {
    useWorld(AR(8, 200));
    PHY.initPhysics(CTX({ WORLD_PX_H: () => 100 }));
    const pl = novo({ x: 40, y: 100 + 40 + BOX.h + 1, vy: 5 });
    PHY.stepPlayer(pl, 1);
    expect(pl.x).toBe(SPAWN_X); expect(pl.y).toBe(SPAWN_Y);
    expect(pl.vx).toBe(0); expect(pl.vy).toBe(0);
  });
  it('[Boundary] logo ACIMA do limite ainda não respawna', () => {
    useWorld(AR(8, 200));
    PHY.initPhysics(CTX({ WORLD_PX_H: () => 100 }));
    const pl = novo({ x: 40, y: 100 + 40 + BOX.h - 1, vy: 0 });
    PHY.stepPlayer(pl, 1);
    expect(pl.y).not.toBe(SPAWN_Y);
  });
});

describe('game/physics — stepPlayer: portas de saída e contadores', () => {
  beforeEach(() => useWorld(chao()));
  it('[Zero/Interface] em quiz/abandono/espera a física NÃO roda (ran=false) e nada se move', () => {
    for (const flag of ['quiz', 'quit', 'waiting']) {
      const pl = novo({ x: 40, y: 40, [flag]: flag === 'quiz' ? {} : true });
      const r = PHY.stepPlayer(pl, 1);
      expect(r.ran, flag).toBe(false);
      expect(pl.y, flag).toBe(40);
      expect(pl.vy, flag).toBe(0);
    }
  });
  it('[Right] airTime cresce de dt a cada quadro no ar', () => {
    useWorld(AR(8, 60));
    const pl = novo({ x: 40, y: 100, airTime: 0 });
    PHY.stepPlayer(pl, 1);
    expect(pl.airTime).toBe(1);
    PHY.stepPlayer(pl, 2);
    expect(pl.airTime).toBe(3);
  });
  it('[Exception] VERRUGA caracterizada: parado em chão sólido, onGround alterna 1/0 com y CONSTANTE', () => {
    // Comportamento atual do jogo (documentado em _avisos no fixture e visível no cenário "parado-no-chao"):
    // pousado, a caixa fica 0,01px acima do tile, o resolveY do quadro seguinte não reencontra o chão e o
    // onGround pisca. Consertar isso é trabalho SEPARADO — aqui a caracterização grava o que É.
    const pl = novo({ x: 40, y: 5 * TILE - 0.01, onGround: true });
    const y0 = pl.y, flags = [];
    for (let i = 0; i < 6; i++) { PHY.stepPlayer(pl, 1); flags.push(pl.onGround ? 1 : 0); }
    expect(pl.y).toBe(y0);            // não afunda nem sobe
    expect(flags).toEqual([0, 1, 0, 1, 0, 1]);
  });
  it('[Right] hurtTimer decai de dt e não é tocado quando já está em zero', () => {
    const pl = novo({ x: 40, y: 5 * TILE - 0.01, onGround: true, hurtTimer: 3 });
    PHY.stepPlayer(pl, 1);
    expect(pl.hurtTimer).toBe(2);
    const inteiro = novo({ x: 40, y: 5 * TILE - 0.01, onGround: true, hurtTimer: 0 });
    PHY.stepPlayer(inteiro, 1);
    expect(inteiro.hurtTimer).toBe(0);
  });
});

/* ===================== triggerLava (o "hurtPlayer" desta base) ===================== */
describe('game/physics — triggerLava (dano da lava)', () => {
  const lava = () => { const g = AR(8, 6); g[3] = new Array(8).fill(9); return g; };
  it('[Right] tocar lava chuta o jogador para cima (vy=-10), com |vx|=5 e 60 quadros de invencibilidade', () => {
    useWorld(lava());
    const chamadas = [];
    PHY.initPhysics(CTX({ sfx: (n) => chamadas.push(n), rebuildCoins: () => chamadas.push('coins') }));
    const pl = novo({ x: 40, y: 60 });
    PHY.stepPlayer(pl, 1);
    expect(pl.hurtTimer).toBeGreaterThan(0);
    expect(pl.vy).toBeLessThan(0);        // já integrado no mesmo quadro, mas ainda subindo
    expect(Math.abs(pl.vx)).toBe(5);
    expect(chamadas).toContain('hurt');
    expect(chamadas).toContain('coins');  // o dano re-sorteia as moedas
  });
  it('[Zero] com hurtTimer ainda correndo o dano NÃO se repete', () => {
    useWorld(lava());
    const chamadas = [];
    PHY.initPhysics(CTX({ sfx: (n) => chamadas.push(n) }));
    const pl = novo({ x: 40, y: 60, hurtTimer: 30 });
    PHY.triggerLava(pl);
    expect(chamadas).toEqual([]);
    expect(pl.vy).toBe(0);
  });
  it('[Exception] Fácil, cadeirante e modo cego são IMUNES à lava', () => {
    for (const [nome, pl, ctx] of [
      ['facil', novo({ x: 40, y: 60, easy: true }), CTX()],
      ['cadeirante', novo({ x: 40, y: 60 }), CTX({ isWheelchair: () => true })],
      ['cego', novo({ x: 40, y: 60 }), CTX({ isModoCego: () => true })],
    ]) {
      useWorld(lava()); PHY.initPhysics(ctx);
      PHY.stepPlayer(pl, 1);
      expect(pl.hurtTimer, nome).toBe(0);
    }
  });
});

/* ===================== stepSounds: a pista de audio de quem nao ve ===================== */
describe('game/physics — stepSounds (escada, parede, chao, agua)', () => {
  // Por que este bloco existe: a cadeia de `else if` daqui pendurava em `if (!pl.inWater)`, entao ESCADA e
  // PAREDE so soavam DENTRO da agua. Fora dela, subir escada e escalar parede eram silencio — e som de passo
  // nao e enfeite: e por onde quem joga sem ver sabe que esta se movendo e sobre o que. Nada acusava porque
  // som nao aparece em trajetoria, e a fixture-ouro so compara posicao.
  const bateu = () => { const sons = []; PHY.initPhysics(CTX({ noiseHit: (m) => sons.push(m) })); return sons; };

  it('[Right] FORA da agua, subindo escada: bate madeira', () => {
    const sons = bateu();
    const pl = novo({ onLadder: true, vy: -1.5, inWater: false, stepT: 99 });
    PHY.stepSounds(pl, 1, 0, false);
    expect(sons).toEqual(['madeira']);
  });
  it('[Right] FORA da agua, escalando parede: bate parede', () => {
    const sons = bateu();
    const pl = novo({ clinging: true, vy: -1, inWater: false, stepT: 99 });
    PHY.stepSounds(pl, 1, 0, false);
    expect(sons).toEqual(['parede']);
  });
  it('[Invariant] o mesmo som sai DENTRO da agua — a correcao nao tirou o caminho que ja funcionava', () => {
    const sons = bateu();
    PHY.stepSounds(novo({ onLadder: true, vy: -1.5, inWater: true, stepT: 99 }), 1, 0, false);
    PHY.stepSounds(novo({ clinging: true, vy: -1, inWater: true, stepT: 99 }), 1, 0, false);
    expect(sons).toEqual(['madeira', 'parede']);
  });
  it('[Boundary] parado na escada (vy=0) nao bate nada', () => {
    const sons = bateu();
    PHY.stepSounds(novo({ onLadder: true, vy: 0, inWater: false, stepT: 99 }), 1, 0, false);
    expect(sons).toEqual([]);
  });
  it('[Boundary] a cadencia e respeitada: so bate quando stepT alcanca o limiar (20 na escada)', () => {
    const sons = bateu();
    const pl = novo({ onLadder: true, vy: -1.5, inWater: false, stepT: 0 });
    for (let i = 0; i < 19; i++) PHY.stepSounds(pl, 1, 0, false);
    expect(sons).toEqual([]);          // 19 ticks: ainda nao
    PHY.stepSounds(pl, 1, 0, false);
    expect(sons).toEqual(['madeira']); // o 20o bate, e zera
    expect(pl.stepT).toBe(0);
  });
  it('[Right] no chao, andando: bate o material sob os pes', () => {
    const sons = [];
    PHY.initPhysics(CTX({ noiseHit: (m) => sons.push(m), surfaceUnder: () => 'pedra' }));
    PHY.stepSounds(novo({ onGround: true, inWater: false, stepT: 99 }), 1, 1, false);
    expect(sons).toEqual(['pedra']);
  });
  it('[Right] escada VENCE o chao: quem esta na escada ouve madeira, nao o piso', () => {
    const sons = [];
    PHY.initPhysics(CTX({ noiseHit: (m) => sons.push(m), surfaceUnder: () => 'pedra' }));
    PHY.stepSounds(novo({ onLadder: true, vy: -1.5, onGround: true, inWater: false, stepT: 99 }), 1, 1, false);
    expect(sons).toEqual(['madeira']);
  });
  it('[Right] na agua, modo cego e sem escada/parede: guia por contato, sem passo', () => {
    const sons = []; const nav = [];
    PHY.initPhysics(CTX({ noiseHit: (m) => sons.push(m), caneOn: () => true,
      nav: { ...NAV, waterNav: () => nav.push('waterNav') } }));
    PHY.stepSounds(novo({ inWater: true, stepT: 99 }), 1, 0, false);
    expect(sons).toEqual([]);
    expect(nav).toEqual(['waterNav']);
  });
  it('[Zero] parado fora da agua e fora de tudo: rearma o proximo passo (stepT=99)', () => {
    bateu();
    const pl = novo({ inWater: true, stepT: 5 }); // o ramo do rearme so e alcancado dentro da agua, verbatim
    PHY.stepSounds(pl, 1, 0, false);
    expect(pl.stepT).toBe(99);
  });
});
