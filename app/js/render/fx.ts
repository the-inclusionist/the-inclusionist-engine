// SPDX-License-Identifier: AGPL-3.0-or-later
// render/fx — Juice / micro-feedback (Estágio 4, Tier 2): particles (dust/sparkle), screen shake, hit-stop,
// squash&stretch, + the JUICE toggles. Formulas are verbatim from game.js (behavior-preserving). The reduce-
// motion flags (`rm`), the PIXI graphics layer (`fxG`) and the round's player list are INJECTED via initFx.
// `fxClock` is NOT here — it is a general animation clock (coin shimmer reads it) and stays in game.js.
// Shake/hit-stop state is read by the camera/update/__incl via getters. See docs/5-Refactoring/plano-modularizacao-mapa.md.

// A corrente da DECORACAO, nao a do jogo: uma particula sorteada aqui nao pode mover o sorteio
// das moedas. Ver o cabecalho de core/rng.ts (issue #107).
import { rngDecoracao } from '../core/rng.js';
const rnd = rngDecoracao.rnd;

import * as store from '../platform/storage.js';

export interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number; g: number;
}
export interface JuiceFlags {
  dust: boolean; sparkle: boolean; squash: boolean; hitstop: boolean; shake: boolean; shimmer: boolean;
}

/** Juice toggles (persisted in localStorage; edited in the ?debug panel + Sensibilidade → Movimento). */
export const JUICE: JuiceFlags = (() => {
  const d: JuiceFlags = { dust: true, sparkle: true, squash: true, hitstop: true, shake: true, shimmer: true };
  const s = store.getJSON<Partial<Record<keyof JuiceFlags, boolean>>>(store.KEYS.juice, null);
  if (s && typeof s === 'object') for (const k of Object.keys(d) as (keyof JuiceFlags)[]) if (k in s) d[k] = !!s[k];
  return d;
})();
export function saveJuice(): void {
  store.setJSON(store.KEYS.juice, JUICE);
}

/** Standard easing (squash recovery, particle fade). Shared → exported (game.js render reads it too). */
export const easeOut3 = (t: number): number => 1 - Math.pow(1 - t, 3);

let particles: Particle[] = [];
let hitstopT = 0, shakeT = 0, shakeDur = 1, shakeMag = 0;

/** Minimal PIXI.Graphics surface drawFx needs (kept structural so the module stays PIXI-free for node tests). */
interface FxGraphics {
  clear(): void;
  beginFill(color: number, alpha?: number): unknown;
  drawRect(x: number, y: number, w: number, h: number): unknown;
  endFill(): unknown;
}
interface ReducedMotion { particles?: boolean; parallax?: boolean }
interface Squashable { rmWalk?: boolean; sq?: number; sqT?: number }

let fxG: FxGraphics | null = null;
let rm: ReducedMotion = {};
// A LISTA DE JOGADORES entra por injeção desde 2026-08-26. Era `numPlayers`, um `let` de `core/state`
// importado como binding vivo — e um `let` de módulo é compartilhado por qualquer segundo jogo que a
// mesma página carregue (D13 do `demos`, ADR-0038). O que entra aqui é o GETTER da rodada que a raiz
// possui; o `let` que sobra guarda a função, não a lista.
let getPlayers: () => readonly unknown[] = () => [];
export function initFx(deps: { fxG: FxGraphics; rm: ReducedMotion; getPlayers: () => readonly unknown[] }): void {
  fxG = deps.fxG;
  rm = deps.rm;
  getPlayers = deps.getPlayers;
}

export function spawnParticle(x: number, y: number, vx: number, vy: number, life: number, color: number, size: number, grav?: number): void {
  if (particles.length >= 160) particles.shift();
  particles.push({ x, y, vx, vy, life, max: life, color, size, g: grav || 0 });
}
export function puffDust(x: number, y: number, n: number): void {
  if (!JUICE.dust || rm.particles) return;
  for (let i = 0; i < n; i++)
    spawnParticle(x + (rnd() - 0.5) * 8, y - 1 - rnd() * 2, (rnd() - 0.5) * 0.9, -0.2 - rnd() * 0.4, 14 + rnd() * 10, 0xcfc6b8, rnd() < 0.4 ? 2 : 1, 0.02);
}
export function burstSparkle(x: number, y: number, color?: number, n?: number): void {
  if (!JUICE.sparkle || rm.particles) return;
  const N = n || 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rnd() * 0.5, sp = 0.5 + rnd() * 0.9;
    spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 0.3, 18 + rnd() * 12, color || 0xffd23f, rnd() < 0.5 ? 2 : 1, 0.015);
  }
}
export function addShake(mag: number, dur: number): void {
  if (!JUICE.shake || rm.parallax) return;
  shakeMag = Math.max(shakeMag, mag); shakeDur = dur; shakeT = Math.max(shakeT, dur);
}
export function addHitstop(t: number): void {
  if (!JUICE.hitstop) return;
  hitstopT = Math.max(hitstopT, t);
}
export function setSquash(pl: Squashable, amt: number): void {
  if (!JUICE.squash || pl.rmWalk) return;
  pl.sq = Math.max(-0.28, Math.min(0.2, amt)); pl.sqT = 8;
}
/** Advance particles + decay shake/squash. (fxClock is stepped by game.js — see header.) */
export function stepFx(dt: number): void {
  if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  for (const pl of getPlayers() as readonly Squashable[]) if (pl.sqT && pl.sqT > 0) pl.sqT = Math.max(0, pl.sqT - dt);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
export function drawFx(): void {
  if (!fxG) return;
  fxG.clear();
  for (const p of particles) {
    const f = p.life / p.max;
    fxG.beginFill(p.color, 0.9 * easeOut3(f));
    fxG.drawRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    fxG.endFill();
  }
}

/** Decrement hit-stop and report whether the world is still frozen (game.js early-returns on true). */
export function tickHitstop(dt: number): boolean {
  if (hitstopT > 0) { hitstopT = Math.max(0, hitstopT - dt); return true; }
  return false;
}
/** Current screen-shake amplitude (0 = none); the camera applies the random jitter. */
export function shakeAmp(): number {
  return shakeT > 0 && shakeMag > 0 ? shakeMag * (shakeT / shakeDur) : 0;
}
export const getParticles = (): Particle[] => particles;
export const getHitstopT = (): number => hitstopT;
export const getShakeT = (): number => shakeT;
