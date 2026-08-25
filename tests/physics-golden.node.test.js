// SPDX-License-Identifier: AGPL-3.0-or-later
// REPLAY DAS TRAJETÓRIAS-OURO da física do jogador (project node) — âncora de caracterização da extração
// game/physics. tests/fixtures/physics-golden.json foi capturado do JOGO RODANDO (build index-CUzRAHot.js,
// commit a437845) dirigindo __incl.update(1) quadro a quadro; cada quadro é [x,y,vx,vy,onGround,inWater,onLadder].
// Aqui montamos o MESMO mundo (clarity.map.txt + a limpeza de itens/portão do boot do game.js), ligamos a
// colisão/elevadores e replayamos cada cenário contra game/physics.stepPlayer. O fixture é a ESPECIFICAÇÃO:
// divergiu, o erro é do módulo — nunca se edita o JSON. Inclui de propósito a verruga do onGround piscando
// 1/0 com o jogador parado (ver _avisos no fixture): caracterização grava o que É, não o que deveria ser.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildWorldFromText } from '../app/js/core/world.js';
import * as COL from '../app/js/core/collision.js';
import { initElevators, buildElevators } from '../app/js/game/elevators.js';
import { makePlayer } from '../app/js/game/player.js';
import { keys } from '../app/js/input/state.js';
import { KB_DEFAULTS } from '../app/js/input/keyboard.js';
import { initPhysics, stepPlayer } from '../app/js/game/physics.js';

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const GOLDEN = JSON.parse(readFileSync(here('./fixtures/physics-golden.json'), 'utf8'));

// ---- mundo REAL, montado como o boot do game.js monta ----------------------------------------------------
// buildWorldFromText → depois o game.js varre o grid tirando os ITENS (7/8/11/12/13/14 → ar 1) e os tiles do
// PORTÃO (10 → ar 1, guardados em gateTiles). Sem essa limpeza a colisão vê sólidos que o jogo não tem.
function buildLevel() {
  const world = buildWorldFromText(readFileSync(here('../app/public/assets/levels/clarity.map.txt'), 'utf8'));
  const H = world.length, W = world[0].length;
  const gateTiles = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = world[y][x];
    if (t === 7 || t === 8 || t === 11 || t === 12 || t === 13 || t === 14) world[y][x] = 1;
    else if (t === 10) { gateTiles.add(x + ',' + y); world[y][x] = 1; }
  }
  return { world, W, H, gateTiles, gateOpen: gateTiles.size === 0 }; // portão nasce FECHADO quando existe
}

const LEVEL = buildLevel();
const WORLD_PX_H = LEVEL.H * 16;

// ---- teclado: a captura pressionou/soltou teclas de VERDADE, então as BORDAS (jumpEdge/runEdge/…) precisam
// nascer no press, exatamente como o handler de keydown do game.js (linhas 300-309) as cria. -----------------
function press(pl, code) {
  if (!keys.has(code)) {
    if (pl.ctrl.jump.includes(code)) pl.jumpEdge = true;
    if (pl.ctrl.run.includes(code) && !pl.easy) pl.runEdge = true; // Fácil: sem correr
    if (pl.ctrl.left.includes(code)) pl.leftEdge = true;
    if (pl.ctrl.right.includes(code)) pl.rightEdge = true;
    if (pl.ctrl.swap && pl.ctrl.swap.includes(code)) pl.swapEdge = true;
    if (pl.ctrl.especial && pl.ctrl.especial.includes(code)) pl.specialEdge = true;
  }
  keys.add(code);
}

// ctx de física com TUDO no-op: nada aqui (áudio, sprite, HUD, leitor de tela) move o jogador. Se algum campo
// passar a mexer no estado, o replay quebra — que é o objetivo.
const noop = () => { /* stub */ };
const NAV_STUB = { sonar: noop, caneTap: noop, waterNav: noop, needsAudioCues: () => false, panFor: () => 0, playerCtx: () => null };
function wireCtx(over = {}) {
  initPhysics({
    isWheelchair: () => false, isModoCego: () => false, caneOn: () => false,
    WORLD_PX_H: () => WORLD_PX_H,
    sfx: noop, srSay: noop, srAlert: noop, hideTips: noop, showPower: noop,
    nav: NAV_STUB, tonePan: noop, noiseHit: noop, surfaceUnder: () => null,
    puffDust: noop, setSquash: noop, addShake: noop, addHitstop: noop,
    POWER_MSG: () => '',
    coinPools: () => ({ shapes: [], letters: [] }), rebuildCoins: noop, updateHud: noop, setCollected: noop,
    ...over,
  });
}

beforeAll(() => {
  COL.initCollision({
    world: LEVEL.world, W: LEVEL.W, H: LEVEL.H,
    isWheelchair: () => false, isModoCego: () => false, caneDiv: () => 1,
    wcSolid: () => new Set(), gateTiles: () => LEVEL.gateTiles, gateOpen: () => LEVEL.gateOpen,
  });
  initElevators({ W: LEVEL.W, H: LEVEL.H, isWheelchair: () => false });
  buildElevators(); // modo normal: nenhum poço (elevAt → null) — mesma condição da captura
  wireCtx();
});

// Arredondamento IDÊNTICO ao da captura, inclusive o `-0 → 0`: o fixture passou por JSON.stringify, e
// JSON.stringify(-0) === "0". Não é tolerância — é a mesma serialização (resíduo de ponto flutuante como
// vy=-1.66e-16 no topo da escada vira "-0.000" no toFixed e 0 no JSON). O NÚMERO comparado segue exato.
const r2 = (v) => { const n = Number(v.toFixed(2)); return n === 0 ? 0 : n; };
const r3 = (v) => { const n = Number(v.toFixed(3)); return n === 0 ? 0 : n; };
const snap = (pl) => [r2(pl.x), r2(pl.y), r3(pl.vx), r3(pl.vy), pl.onGround ? 1 : 0, pl.inWater ? 1 : 0, pl.onLadder ? 1 : 0];

// Roda um cenário do fixture e devolve os N quadros gravados (mesmo formato do JSON).
function replay(sc) {
  keys.clear();
  const pl = makePlayer(0);
  pl.ctrl = JSON.parse(JSON.stringify(KB_DEFAULTS.solo)); // esquema SOLO: correr=KeyU, especial=KeyK (armadilha do fixture)
  pl.pad = -1;
  pl.x = sc.x; pl.y = sc.y; pl.vx = 0; pl.vy = 0;
  pl.onGround = false; pl.inWater = false; pl.onLadder = false;
  if (sc.power) pl.activePower = sc.power;
  if (sc.easy) pl.easy = true;
  const out = [];
  for (let f = 0; f < sc.n; f++) {
    const step = sc.script && sc.script[String(f)];
    if (step) {
      for (const k of step.up || []) keys.delete(k);
      for (const k of step.down || []) press(pl, k);
    }
    stepPlayer(pl, 1);
    out.push(snap(pl));
  }
  keys.clear();
  return out;
}

describe('game/physics — replay das trajetórias-ouro (14 cenários, 600 quadros)', () => {
  for (const sc of GOLDEN.scenarios) {
    it(`[Ouro] "${sc.name}" reproduz os ${sc.n} quadros capturados do jogo`, () => {
      const esperado = GOLDEN.frames[sc.name];
      expect(esperado, `cenário ${sc.name} sem quadros no fixture`).toBeTruthy();
      const obtido = replay(sc);
      // compara quadro a quadro para o erro apontar o PRIMEIRO ponto de divergência
      for (let f = 0; f < esperado.length; f++) {
        expect(obtido[f], `${sc.name}: divergiu no quadro ${f}`).toEqual(esperado[f]);
      }
      expect(obtido.length).toBe(esperado.length);
    });
  }
  it('[Interface] o fixture tem os 14 cenários e 600 quadros que a extração precisa cobrir', () => {
    expect(GOLDEN.scenarios).toHaveLength(14);
    const total = GOLDEN.scenarios.reduce((s, sc) => s + GOLDEN.frames[sc.name].length, 0);
    expect(total).toBe(600);
  });
});
