// SPDX-License-Identifier: AGPL-3.0-or-later
// game/traffic — city street TRAFFIC: cars (obstacle) + the functional semáforo (accessibility signal, not
// decor — WCAG 2.3.1 no-flash cycle: 8s green → 2s yellow → 6s red). Pure cadence/spawn/physics/off-screen
// math is exported standalone (no PIXI) for deterministic node tests with the seeded `rnd`. The PIXI layer
// (`carLayer`, its z-order) is CREATED in game.js and INJECTED via initTraffic(ctx) — this module never
// reaches globals nor imports game.js. `applyCenarioVida` (show/hide by CENARIO + clear on leaving Cidade)
// stays in game.js — it also drives render/scene-city's decor/sky visibility, so it isn't this module's call;
// it gets `clearCars()` for the leaving-city case instead of touching `cars` directly.
// See docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4).

import { TILE } from '../core/constants.js';
import { rnd, randInt } from '../core/rng.js';
import type { Desenho, Camada } from '../render/port.js';
import type { CriarSprite, CriarDesenho } from '../render/port.js';
import { cenario } from './state.js'; // GAME desde a Fase B (ADR-0038)

export type LightState = 'green' | 'yellow' | 'red';

/* ===================== PURE (no PIXI) — testable with plain data + the seeded rnd ===================== */

/** Semáforo cadence from accumulated time: 16s cycle, no flashing. */
export function lightStateAt(t: number): LightState {
  const cyc = (t / 60) % 16;
  return cyc < 8 ? 'green' : cyc < 10 ? 'yellow' : 'red';
}

/** Where a car is born: random side + the matching off-screen start x. */
export function planCarSpawn(rndFn: () => number, worldPxW: number): { dir: 1 | -1; x: number } {
  const dir: 1 | -1 = rndFn() < 0.5 ? 1 : -1;
  return { dir, x: dir > 0 ? -90 : worldPxW + 90 };
}

/** Random threshold (420–720 frames) the spawn counter must reach before the next car is allowed. */
export function nextSpawnThreshold(randIntFn: (lo: number, hi: number) => number): number {
  return 420 + randIntFn(0, 300);
}

/** Hasn't reached the stop line yet (44px ahead of the car, signed by travel direction; car sprite is 78px @3x). */
export function isBeforeStopLine(carX: number, dir: 1 | -1, semX: number): boolean {
  return (semX - carX) * dir > 44;
}

/** Brakes only on yellow/red, before the line, inside the 44–140px braking window ahead. */
export function shouldBrake(carX: number, dir: 1 | -1, semX: number, state: LightState): boolean {
  return state !== 'green' && isBeforeStopLine(carX, dir, semX) && (semX - carX) * dir < 140;
}

/** One car's dt-step: eases (±0.08/frame) toward the target speed (0 when braking, else cruise), then integrates x. */
export function advanceCar(car: { x: number; dir: 1 | -1; vx: number }, dt: number, semX: number, state: LightState): { x: number; vx: number } {
  const want = shouldBrake(car.x, car.dir, semX, state) ? 0 : car.dir * 1.4;
  let vx = car.vx + Math.max(-0.08, Math.min(0.08, want - car.vx)) * dt;
  if (want === 0 && Math.abs(vx) < 0.03) vx = 0;
  return { x: car.x + vx * dt, vx };
}

/** Off the world (100px margin either side) → despawn candidate. */
export function isOffscreen(x: number, worldPxW: number): boolean {
  return x < -100 || x > worldPxW + 100;
}

/* ===================== PIXI-touching (injected via initTraffic(ctx)) ===================== */

// `Gfx` e `Layer` vêm de `render/port` (Fase D). `game/` pode importar de `render/`: a aresta proibida é
// a contrária — engine importando de `game/` —, e este é um tipo, apagado na compilação.
type Gfx = Desenho;
interface Dimmable { tint: number; alpha: number; }
interface CarSprite extends Dimmable { x: number; y: number; anchor: { set(x: number, y: number): void }; scale: { x: number }; destroy(): void; }
type Layer = Camada & { children: Dimmable[] };
// O construtor virou FÁBRICA (Fase D): `new (tex: unknown)` não recebe o `PIXI.Sprite` real, cujo
// construtor só aceita `Texture`. Por contravariância, prometer aceitar qualquer coisa é o que impede.
// Ver `CriarSprite` no cabeçalho de `render/port`.


export interface TrafficCtx {
  carLayer: Layer;             // PIXI.Container — created + z-ordered in game.js, injected here
  CAR_TEX: unknown[];          // car sprite textures (already built in game.js)
  criarSprite: CriarSprite<CarSprite>;   // era `SpriteCtor`
  criarDesenho: CriarDesenho<Gfx>;       // era `GraphicsCtor`
  WORLD_PX_W: number;
  WORLD_PX_H: number;          // → STREET_Y (the front street sits at the bottom of the world; R-cidade 2026-07-03)
  WORLD_W: number;
  getRm: () => { decor?: boolean }; // reduced-motion flags (game.js-local; not a module, must be injected)
}

interface Car { s: CarSprite; x: number; dir: 1 | -1; vx: number; }

let ctx: TrafficCtx | null = null;
let cars: Car[] = [];
let _carT = 0;
let _frontDim = false;
let _streetY = 0;
export const SEM = { x: 0, y: 0, state: 'green' as LightState, t: 0, pole: null as Gfx | null };

/** Draws the pole + the 3 lamps (only the active one is lit; colors are WCAG-distinct for color-blind legibility). */
export function drawSemaforo(): void {
  const g = SEM.pole; if (!g) return; g.clear();
  const x = SEM.x, y = SEM.y; // 2× (proportion of the 3× cars)
  g.beginFill(0x3a4152).drawRect(x - 2, y - 52, 4, 52).endFill();
  g.beginFill(0x20242e).drawRect(x - 8, y - 86, 16, 36).endFill();
  const on: Record<LightState, number> = { red: 0xff4b3a, yellow: 0xffd23f, green: 0x37e15b };
  const ys: Record<LightState, number> = { red: -82, yellow: -71, green: -60 };
  (['red', 'yellow', 'green'] as LightState[]).forEach((k) => {
    g.beginFill(SEM.state === k ? on[k] : 0x11141c).drawRect(x - 4, y + ys[k], 8, 8).endFill();
  });
}

/** Injects the PIXI layer + textures/ctors + world geometry, and builds the semáforo + the street's STOP signs. */
export function initTraffic(injected: TrafficCtx): void {
  ctx = injected; _streetY = ctx.WORLD_PX_H;
  SEM.x = Math.round(ctx.WORLD_PX_W / 2); SEM.y = _streetY;
  SEM.pole = ctx.criarDesenho(); ctx.carLayer.addChild(SEM.pole); drawSemaforo();
  const g = ctx.criarDesenho(); ctx.carLayer.addChild(g); // STOP signs along the front street (2×)
  for (let tx = 6; tx < ctx.WORLD_W - 6; tx += 14) {
    const X = tx * TILE; if (Math.abs(X - SEM.x) < 48) continue;
    g.beginFill(0x8a919f).drawRect(X, _streetY - 28, 2, 28).endFill();
    g.beginFill(0xd23a2e).drawRect(X - 5, _streetY - 42, 12, 14).endFill();
    g.beginFill(0xffffff).drawRect(X - 3, _streetY - 37, 8, 3).endFill();
  }
}

/** Spawns 1 car (cap 3) from a random side; dimmed on the spot if front-dim (HC) is currently on. */
export function spawnCar(): boolean {
  if (!ctx || cars.length >= 3) return false;
  const { dir, x } = planCarSpawn(rnd, ctx.WORLD_PX_W);
  const s = ctx.criarSprite(ctx.CAR_TEX[randInt(0, ctx.CAR_TEX.length - 1)]); // texture is already 3× native
  s.anchor.set(0.5, 1); s.scale.x = dir; s.y = _streetY; s.x = x;
  if (_frontDim) { s.tint = 0x4a5058; s.alpha = 0.55; }
  ctx.carLayer.addChild(s);
  cars.push({ s, x, dir, vx: dir * 1.4 });
  return true;
}

// High contrast: cars/signs/semáforo are in FRONT but are AMBIENT — they dim like the background so they
// don't compete with platforms/items (José 2026-07-03 request).
export function setFrontDim(on: boolean): void {
  if (!ctx) return;
  _frontDim = !!on;
  const t = on ? 0x4a5058 : 0xffffff, a = on ? 0.55 : 1;
  ctx.carLayer.children.forEach((ch) => { ch.tint = t; ch.alpha = a; });
}

/** Destroys + empties all cars (semáforo/signs stay — signage survives, only the moving traffic leaves). */
export function clearCars(): void {
  if (!ctx || !cars.length) return;
  cars.forEach((c) => { ctx!.carLayer.removeChild(c.s); c.s.destroy(); });
  cars = [];
}

export function stepTraffic(dt: number): void {
  if (!ctx || cenario !== 'cidade') return; // L6: traffic is a Cidade-only peculiarity
  SEM.t += dt;
  const st = lightStateAt(SEM.t);
  if (st !== SEM.state) { SEM.state = st; drawSemaforo(); }
  if (ctx.getRm().decor) { clearCars(); return; }
  if (++_carT >= nextSpawnThreshold(randInt)) { _carT = 0; spawnCar(); }
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i]!;
    const { x, vx } = advanceCar(c, dt, SEM.x, SEM.state); c.x = x; c.vx = vx; c.s.x = Math.round(c.x);
    if (isOffscreen(c.x, ctx.WORLD_PX_W)) { c.s.destroy(); ctx.carLayer.removeChild(c.s); cars.splice(i, 1); }
  }
}

export const getCars = (): Car[] => cars;
export const getStreetY = (): number => _streetY;
