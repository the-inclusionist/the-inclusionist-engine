// SPDX-License-Identifier: AGPL-3.0-or-later
// game/life — ambient life of the Cidade theme (pigeons/cats/dogs/adults): 100% procedural, purely cosmetic
// (no collision, no damage). spawnCreature decides WHO/WHERE spawns (pool of 10, near the camera);
// stepLife advances dt (walk/fly/peck, u-turn at ledge/lava, pigeon flees near a player, despawn out of
// range). Decision + dt-stepping logic is pure and lives directly here (project node). PIXI (the life layer,
// sprite creation, baked textures) is kept STRUCTURALLY typed and INJECTED via initLife — this module never
// imports PIXI nor touches the DOM. lifeSurfaceAt/lifeSurfaceLowAt/streetCols stay in game.js on purpose
// (buildCityDeco in render/scene-city also calls lifeSurfaceAt) and arrive here injected too; same for
// decoSprites (tree placements, used for the "dog near a tree" spawn bias) and darkRegions (indirectly, via
// the injected surface functions). rnd/randInt/tileAt/solidAt/players/numPlayers/cenario/TILE/LOGICAL_* are
// real leaves (core/*) → imported directly. Formulas are verbatim from game.js. See
// docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, game/life).

import { rnd, randInt } from '../core/rng.js';
import { ehPerigo } from '../core/constants.js';
import type { PlayerView } from '../core/entity.js';
import { players, numPlayers } from '../core/state.js';
import { cenario as CENARIO } from './state.js'; // GAME desde a Fase B (ADR-0038)
import { LOGICAL_W, LOGICAL_H, TILE } from '../core/constants.js';
import { tileAt, solidAt } from '../core/collision.js';

/** A fauna só precisa saber ONDE o jogador está (fugir/aproximar). */
type LifePlayer = PlayerView<'x' | 'y'>;

/** A pair of textures/frames [f0, f1] — the 2-frame walk-cycle every creature uses. */
type TexPair = [unknown, unknown];

export interface LifeKind {
  k: 'pombo' | 'gato' | 'cao' | 'adulto';
  tex: 'pombo' | 'gato' | 'cao' | null; // null = 'adulto' (silhouette, picks from adultTex instead)
  spd: number;
  peck?: boolean; // pigeons only: idle peck-at-the-ground state
  fly?: boolean;  // pigeons only: flee-flight when a player gets close
  alpha: number;
  street?: boolean; // dogs/adults: low-band "street" life, city-only
}

/** Kind catalog. spawnCreature weighs it 3× toward pigeons — "cadê os pombos no chão?" (José). */
export const LIFE_KINDS: LifeKind[] = [
  { k: 'pombo', tex: 'pombo', spd: 0.15, peck: true, fly: true, alpha: 0.95 },
  { k: 'gato', tex: 'gato', spd: 0.30, alpha: 0.9 },
  { k: 'cao', tex: 'cao', spd: 0.35, alpha: 0.9, street: true },
  { k: 'adulto', tex: null, spd: 0.25, alpha: 0.8, street: true },
];

/** A living creature instance (pushed onto `creatures`). */
export interface Creature {
  K: LifeKind;
  tex2: TexPair;
  s: LifeSprite;
  fade: number;
  x: number; y: number;
  dir: 1 | -1;
  animT: number;
  f: 0 | 1;
  state: 'walk' | 'fly' | 'peck';
  stateT: number;
  vy: number;
}

// ---- PIXI kept structural (no `import * as PIXI`), so this module stays node-testable with fakes. ----
export interface LifeSprite {
  anchor: { set(x: number, y: number): void };
  alpha: number;
  x: number;
  y: number;
  scale: { x: number };
  texture: unknown;
  destroy(): void;
}
export interface LifeLayer {
  addChild(s: LifeSprite): void;
  removeChild(s: LifeSprite): void;
  removeChildren(): void;
}
export interface LifeTexAtlas {
  pombo: TexPair;
  pomboFly: TexPair;
  gato: TexPair;
  cao: TexPair;
}
interface ReducedMotion { decor?: boolean }

export interface LifeCtx {
  layer: LifeLayer;                              // lifeLayer (PIXI.Container) — camera.addChild'd in game.js
  makeSprite: (texture: unknown) => LifeSprite;   // `(t) => new PIXI.Sprite(t)` in game.js
  lifeTex: LifeTexAtlas;                          // LIFE_TEX (baked canvases) — stays baked in game.js
  adultTex: TexPair[];                            // ADULT_TEX (6 silhouette shapes) — idem
  lifeSurfaceAt: (tx: number) => number;          // shared w/ render/scene-city's buildCityDeco → stays in game.js
  lifeSurfaceLowAt: (tx: number) => number;       // life-only, but paired w/ lifeSurfaceAt/inDark → stays in game.js
  streetCols: () => [number, number][];           // memoized open street columns — stays in game.js (see below)
  decoSprites: { x: number }[];                   // tree sprites (scene-city) — read-only, live reference
  rm: ReducedMotion;                              // reduced-motion flags (live reference, mutated in place)
  W: number;                                      // WORLD_W (tiles)
  pxW: number;                                    // WORLD_PX_W (px)
  pxH: number;                                    // WORLD_PX_H (px)
}

let layer: LifeLayer | null = null;
let makeSprite: (texture: unknown) => LifeSprite = () => { throw new Error('game/life: initLife() not called'); };
let lifeTex: LifeTexAtlas | null = null;
let adultTex: TexPair[] = [];
let lifeSurfaceAt: (tx: number) => number = () => -1;
let lifeSurfaceLowAt: (tx: number) => number = () => -1;
let streetCols: () => [number, number][] = () => [];
let decoSprites: { x: number }[] = [];
let rm: ReducedMotion = {};
let W = 0, pxW = 0, pxH = 0;

/** Wire game.js's PIXI layer/textures + shared world queries into this module. Idempotent. */
export function initLife(ctx: LifeCtx): void {
  layer = ctx.layer; makeSprite = ctx.makeSprite; lifeTex = ctx.lifeTex; adultTex = ctx.adultTex;
  lifeSurfaceAt = ctx.lifeSurfaceAt; lifeSurfaceLowAt = ctx.lifeSurfaceLowAt; streetCols = ctx.streetCols;
  decoSprites = ctx.decoSprites; rm = ctx.rm; W = ctx.W; pxW = ctx.pxW; pxH = ctx.pxH;
}

let creatures: Creature[] = [];
let _lifeSpawnT = 0;
/** The live pool (mutable ref — window.__incl reads it for debug). */
export const getCreatures = (): Creature[] => creatures;

/** Try to spawn one creature (pool cap 10). Returns false when the pool is full or no valid spot was found.
 *  NOTE: `force` is accepted (mirrors the original game.js signature, still exposed on window.__incl for
 *  manual debug spawns) but is never read by the body — surfaced as-is, not "fixed" (verbatim behavior). */
export function spawnCreature(force?: boolean): boolean {
  void force;
  if (creatures.length >= 10) return false;
  const pl = (players[randInt(0, Math.max(0, numPlayers - 1))] || players[0]) as LifePlayer;
  const ptx = Math.floor(pl.x / TILE);
  const K = LIFE_KINDS[[0, 0, 0, 1, 2, 3][randInt(0, 5)]!]!;
  if (K.street && CENARIO !== 'cidade') return false; // dogs/adults are URBAN life; field/forest keep critters + butterflies
  let tx: number, ty: number, fade = 0;
  if (K.street) { // dogs and adults: low band; DOG preferably near a TREE (José's request)
    if (K.k === 'cao' && decoSprites.length && rnd() < 0.8) {
      const tr = decoSprites[randInt(0, decoSprites.length - 1)]!;
      tx = Math.floor(tr.x / TILE) + (rnd() < 0.5 ? -1 : 1) * randInt(1, 3);
      if (tx < 1 || tx >= W - 1) return false;
      ty = lifeSurfaceLowAt(tx); if (ty < 0) return false; fade = 30;
    } else {
      const open = streetCols().filter(([cx]) => Math.abs(cx - ptx) <= 22);
      if (!open.length) return false;
      [tx, ty] = open[randInt(0, open.length - 1)]!; fade = 30;
    } // street: open column of the facade (may be visible → FADE-IN)
  } else {
    tx = ptx + (rnd() < 0.5 ? -1 : 1) * (Math.floor(LOGICAL_W / TILE / 2) + 2 + randInt(0, 5));
    if (tx < 1 || tx >= W - 1) return false;
    ty = lifeSurfaceAt(tx); if (ty < 0) return false;
    if (CENARIO === 'cidade' && ty * TILE >= pxH * 0.55) return false; // city: cats/pigeons ONLY on the high parts
  }
  const tex2: TexPair = K.k === 'adulto' ? adultTex[randInt(0, adultTex.length - 1)]! : lifeTex![K.tex as 'pombo' | 'gato' | 'cao'];
  const s = makeSprite(tex2[0]); s.anchor.set(0.5, 1); s.alpha = fade ? 0 : K.alpha; layer!.addChild(s);
  creatures.push({ K, tex2, s, fade, x: tx * TILE + 8, y: ty * TILE, dir: rnd() < 0.5 ? -1 : 1, animT: 0, f: 0, state: 'walk', stateT: 0, vy: 0 });
  return true;
}

/** Advance every creature by dt: fade-in, 2-frame walk anim, per-state motion, despawn out of range.
 *  `rm.decor` (reduced-motion "scene decor") clears the whole pool instead of animating it. */
export function stepLife(dt: number): void {
  if (rm.decor) {
    if (creatures.length) { creatures.forEach((c) => c.s.destroy()); layer!.removeChildren(); creatures = []; }
    return;
  }
  if (++_lifeSpawnT >= 60) { _lifeSpawnT = 0; spawnCreature(); }
  for (let i = creatures.length - 1; i >= 0; i--) {
    const c = creatures[i]!, K = c.K;
    if (c.fade > 0) { c.fade = Math.max(0, c.fade - dt); c.s.alpha = K.alpha * (1 - c.fade / 30); } // fade-in (street spawn can be visible)
    c.animT += dt; if (c.animT >= 12) { c.animT = 0; c.f = (1 - c.f) as 0 | 1; }
    if (c.state === 'fly') {
      c.y += c.vy * dt; c.x += c.dir * 0.9 * dt; c.vy = Math.max(-1.6, c.vy - 0.04 * dt);
      c.s.texture = lifeTex!.pomboFly[c.f];
    } else if (c.state === 'peck') {
      if ((c.stateT -= dt) <= 0) c.state = 'walk';
      c.s.texture = lifeTex!.pombo[1];
    } else {
      c.x += c.dir * K.spd * dt;
      const ty = Math.floor(c.y / TILE), nx = Math.floor((c.x + c.dir * 6) / TILE);
      if (nx < 1 || nx >= W - 1 || !solidAt(nx, ty) || solidAt(nx, ty - 1) || ehPerigo(tileAt(nx, ty - 1))) c.dir = (c.dir * -1) as 1 | -1; // beirada/parede/PERIGO à frente: meia-volta
      if (K.peck && rnd() < 0.004) { c.state = 'peck'; c.stateT = 30; }
      c.s.texture = c.tex2[c.f];
    }
    if (K.fly && c.state !== 'fly') { // cosmetic flee-flight
      for (const p of players as LifePlayer[]) {
        if (Math.abs(p.x - c.x) < 34 && Math.abs(p.y - c.y) < 26) { c.state = 'fly'; c.vy = -1.2; c.dir = c.x < p.x ? -1 : 1; break; }
      }
    }
    c.s.x = Math.round(c.x); c.s.y = Math.round(c.y); c.s.scale.x = c.dir < 0 ? -1 : 1;
    let near = false;
    for (const p of players as LifePlayer[]) { if (Math.abs(p.x - c.x) < LOGICAL_W * 1.6 && Math.abs(p.y - c.y) < LOGICAL_H * 1.6) { near = true; break; } }
    if (!near || c.y < -30 || c.x < 8 || c.x > pxW - 8) { c.s.destroy(); layer!.removeChild(c.s); creatures.splice(i, 1); }
  }
}
