// SPDX-License-Identifier: AGPL-3.0-or-later
// core/route — WHICH WAY TO GET THERE, not only where there is (#84, item 1).
//
// ========================= THE DEFECT THIS EXISTS TO FIX =========================
// Without it, every cue points in a STRAIGHT LINE at the target, and a straight line goes through walls: the guide
// tells the child to walk into a solid block, and they have no way to know why.
//
// ⚠️ AND THEY REALLY HAVE NO WAY TO KNOW. A child who can see ignores an arrow pointing at a wall without noticing they
// ignored it. A child who depends on the cue does what it says — and then does it again, because the cue keeps saying
// the same. A wrong cue is worse than none: no cue at least lets them explore.
//
// ========================= WHAT "CROSSABLE" IS, AND WHY IT IS NOT MY INVENTION =========================
// #84 asks for "the directions where there is AIR OR WATER". Those two words are already in the contract, and each
// `Role` says of itself whether it can be crossed — the set below is a READING of `core/contract`, not a new decision:
//
//   free       crossable, with no meaning of its own              → the air
//   water      crossed by swimming                                → the water
//   climb      height changes by interacting with it              → the ladder: it is BY it that one climbs
//   key        satisfies a gate                                   → an object lying there, not a barrier
//   structure  scenery: floor, wall, what holds things up         → NO
//   gate       bars until a condition                             → NO: barring is what it does
//   hazard     hurts on contact                                   → NO, and it is the only one I chose
//   goal       what the round asks for                            → a case apart, see `targets` below
//
// ⚠️ `hazard` IS THE CHOICE, and I declare it: its metric does not say whether it can be crossed, it says what it
// costs. A route over a spike is a route that sends the child into damage. A game where the spike is a compulsory
// passage will have to say so another way; none does today.
//
// ========================= THE TARGET IS ALWAYS STEPPABLE, THE PATH IS NOT =========================
// A `goal` may be declared on a cell that cannot be crossed (a flag inside a gate). Refusing to enter it would make
// the route never arrive anywhere. The rule is asymmetric on purpose: **the last step is always allowed; the ones in
// between obey the set.** It is the difference between "entering the gate" and "crossing the gate to go on".
//
// ========================= THE BUDGET, WHICH THE CONTRACT ITSELF ASKED FOR =========================
// ⚠️ `core/contract` warns, in its section 5, that in a CONTINUOUS space the spots cannot be enumerated, and on a large
// map enumerating would cost a frame. This module cannot ignore that because it is convenient. So it has a CEILING of
// visited cells and returns `null` when it is hit. `null` means **"I cannot say"**, not "there is no path" — a caller
// has to treat both alike, which is what an honest cue does: it goes quiet.
//
// And it imports nothing but the contract: pure logic, measured in the `node` project.

import type { Role, Spot, Topology } from './contract.js';
import { distance } from './contract.js';

/**
 * The roles a route crosses. A reading of `core/contract`, with `hazard` left out by the decision declared in the
 * header — and `goal` left out because it comes in by the last-step rule, not the in-between one.
 */
export const WALKABLE_ROLES: ReadonlySet<Role> = new Set<Role>(['free', 'water', 'climb', 'key']);

/** Does this role let one through? */
export function isWalkable(role: Role): boolean {
  return WALKABLE_ROLES.has(role);
}

export interface RouteCtx {
  /** Field 1 of the contract. The metric decides HOW MANY neighbours a spot has. */
  readonly topology: Topology;
  /** Field 2 of the contract: what is at this spot. Mandatory in `GameDeclaration`, so always available. */
  readonly roleAt: (at: Spot) => Role;
  /**
   * Ceiling of visited spots. Hit → `null`, which is "I cannot say".
   *
   * 4096 is ~64×64 on a grid and covers today's boards with room to spare; on a large platform map it cuts before the
   * search costs a frame. The number is a PARAMETER because the acceptable cost belongs to the caller: a cue every
   * frame tolerates far less than a calculation when a level loads.
   */
  readonly budget?: number;
}

export interface Route {
  /** The NEXT spot to step on — one step from where one is. This is what a cue points at. */
  readonly next: Spot;
  /** Which target the route reached. It may not be the nearest in a straight line, and that is the point. */
  readonly reached: Spot;
  /** How many steps along the path. ⚠️ NOT `distance()`, which measures the straight line through walls. */
  readonly steps: number;
}

const DEFAULT_BUDGET = 4096;

/** A spot's key in the queue. Rounded, because in continuous space spots are born from sums of `stride`. */
const key = (s: Spot, cells: number): string =>
  s.x.toFixed(cells) + '|' + s.y.toFixed(cells) + '|' + (s.z ?? 0).toFixed(cells);

/**
 * The offsets of ONE step, in the declared metric.
 *
 * ⚠️ `free` (L², continuous space with no discrete step) HAS NO NEIGHBOURS — and pretending it does is the
 * approximation this module makes and declares: it walks a GRID of side `unit`, in eight directions. The alternative
 * would be answering nothing in a platform game, which is exactly the issue's genre. Whoever reads a `free` route is
 * reading a sampling, not a trajectory — which is why `steps` is a count of cells and not a physical measure.
 */
function neighbours(shape: Topology, stride: number): Spot[] {
  if (shape.kind === 'hotspots') return [];
  const dims = shape.size.length;
  const orthogonal = shape.move === 'orthogonal';
  const out: Spot[] = [];
  const axes = [-1, 0, 1];
  for (const dx of axes) for (const dy of axes) {
    for (const dz of dims > 2 ? axes : [0]) {
      const n = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      if (n === 0) continue;
      if (orthogonal && n > 1) continue; // L¹: there is no diagonal
      out.push({ x: dx * stride, y: dy * stride, z: dz * stride });
    }
  }
  return out;
}

/** Does the spot fit the declared extent? A grid counts cells 0..n−1; continuous space counts units 0..n. */
function isInside(shape: Topology, s: Spot): boolean {
  if (shape.kind === 'hotspots') return false;
  const axis = [s.x, s.y, s.z ?? 0];
  for (let i = 0; i < shape.size.length; i++) {
    const lim = shape.size[i] as number;
    if (axis[i]! < 0) return false;
    if (shape.kind === 'grid' ? axis[i]! > lim - 1 : axis[i]! > lim) return false;
  }
  return true;
}

/**
 * The route from `de` to the nearest REACHABLE of the `targets` — breadth first, over what can be crossed.
 *
 * `null` when there is no target, when none is reachable, when the topology has no space (`hotspots`), or when the
 * budget ran out. The four cases are one for the caller: **I cannot say which way**.
 *
 * ⚠️ "NEAREST" HERE IS ALONG THE PATH, and that is the whole difference. A target three cells away in a straight line
 * on the other side of a wall is FARTHER than one eight cells down an open corridor — and it is the second one the
 * child can reach.
 */
export function routeTo(ctx: RouteCtx, de: Spot, targets: readonly Spot[]): Route | null {
  const shape = ctx.topology;
  if (shape.kind === 'hotspots' || targets.length === 0) return null;
  const walk = walkOf(shape);
  // a unit of zero would make the queue go nowhere, and a negative one would walk exactly like a positive one
  if (!(walk.step > 0)) return null;
  const arrived = (s: Spot): Spot | null => targets.find((a) => distance(shape, s, a) <= walk.tolerance) ?? null;

  const targetHere = arrived(de);
  if (targetHere) return { next: de, reached: targetHere, steps: 0 };

  const search: Search = {
    ctx, space: shape, arrived, keyDecimals: walk.keyDecimals, jumps: neighbours(shape, walk.step),
    budget: ctx.budget ?? DEFAULT_BUDGET, seen: new Set<string>([key(de, walk.keyDecimals)]),
  };
  let level: Step[] = [{ at: de, first: de, steps: 0 }];
  while (level.length) {
    const next = nextLevel(search, level);
    if (!Array.isArray(next)) return next;
    level = next;
  }
  return null;
}

/** How a space is walked: the step, the decimals a point's key keeps, and how close counts as arrived. On a grid it is the
 *  same cell; in a continuous space half a step, because the sampling grid does not fall on the target. */
function walkOf(space: Exclude<Topology, { kind: 'hotspots' }>): { step: number; keyDecimals: number; tolerance: number } {
  return space.kind === 'continuous' ? { step: space.unit, keyDecimals: 4, tolerance: 0.5 } : { step: 1, keyDecimals: 0, tolerance: 0 };
}

/** One point of the search, carrying the FIRST step that led to it — all the guide needs to know at the end. */
interface Step { readonly at: Spot; readonly first: Spot; readonly steps: number }

/** What a search holds while it widens: the world, where it may step, how it recognises a target, and what it has seen. */
interface Search {
  readonly ctx: RouteCtx;
  readonly space: Topology;
  readonly arrived: (s: Spot) => Spot | null;
  readonly keyDecimals: number;
  readonly jumps: readonly Spot[];
  readonly budget: number;
  readonly seen: Set<string>;
}

/** Where one jump from a point lands, on every axis the space has. */
const stepFrom = (at: Spot, d: Spot): Spot => ({ x: at.x + d.x, y: at.y + d.y, z: (at.z ?? 0) + (d.z ?? 0) });

/** One ring further out. A route when a target is reached, `null` when the budget ran out («I cannot say», which is an
 *  answer), or the next ring. */
function nextLevel(s: Search, level: readonly Step[]): Route | null | Step[] {
  const next: Step[] = [];
  for (const item of level) {
    for (const d of s.jumps) {
      const neighbour = stepFrom(item.at, d);
      if (!isInside(s.space, neighbour)) continue;
      const k = key(neighbour, s.keyDecimals);
      if (s.seen.has(k)) continue;
      s.seen.add(k);
      if (s.seen.size > s.budget) return null;
      const first = item.steps === 0 ? neighbour : item.first;
      // THE LAST STEP IS ALWAYS ALLOWED: a target may be declared on a cell that cannot be crossed.
      const target = s.arrived(neighbour);
      if (target) return { next: first, reached: target, steps: item.steps + 1 };
      if (isWalkable(s.ctx.roleAt(neighbour))) next.push({ at: neighbour, first, steps: item.steps + 1 });
    }
  }
  return next;
}
