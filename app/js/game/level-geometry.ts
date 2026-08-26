// SPDX-License-Identifier: AGPL-3.0-or-later
// game/level-geometry — wheelchair-mode LEVEL GEOMETRY (Estágio 4, Tier 2): step→ramp detection, wc-only
// bridge platforms, floating rope anchors over water, the elevator-cabin draw, dark-region discovery, and the
// powerup/gate spawn+draw pass. Pure detection (node-testable, no PIXI) is split from the PIXI drawing, which
// reads layers injected once via initLevelGeometry(ctx). gate/gateTiles/powerups/wcSolid stay OWNED by game.js
// (core/collision + the key/gate touch logic also read them) — this module only computes new values for them
// and draws from read-only getters; W/H/isWheelchair/layers are injected like game/elevators.ts.
// See docs/5-Refactoring/plano-modularizacao-mapa.md.

import * as PIXI from 'pixi.js';
import { ehPerigo, ehTrampolim, ehAgua, ehEscada, ehSecreto } from '../core/constants.js';
import type { PlayerView } from '../core/entity.js';
import { tileAt, solidTile } from '../core/collision.js';
import { TILE } from '../core/constants.js';
import { getElevShafts, elevAt } from './elevators.js';
import { vizMode } from '../core/state.js';
import type { Powerup as PowerupBase } from './powerups.js';

/* ===================== tipos ===================== */

/** An item slot parsed from the map (super-jump/fly/key/turbo/ultra-jump/wall-cling). */
export interface MapItem { tx: number; ty: number; kind: string }
/** A gate tile parsed from the map (E12: dynamic gate, opens when the key-holder touches it). */
export interface MapGateTile { tx: number; ty: number }
/** A spawned power-up: `PowerupBase` (game/powerups.js) + the placement/render fields game.js needs. */
export interface Powerup extends PowerupBase { x: number; y: number; taken: boolean; by: number[]; sprite: PIXI.Sprite | null }
/** A single-tile step where the walkable surface rises/falls by 1 tile at `x+1` (ramp goes over it). */
export interface RampStep { x: number; y: number; dir: 'up' | 'down' }
/** A lava(9)/trampoline(5) tile that becomes flat ground in wheelchair mode (lava keeps a block border). */
export interface FloorOverlayTile { x: number; y: number; lava: boolean }
/** A water-surface tile (tile 3 with non-water above) where a floating rope anchor is drawn. */
export interface RopeAnchor { x: number; y: number }
/** A connected component of dark (tile 0) tiles — a secret region that lights up when entered. */
export type DarkRegion = [number, number][];
/** Result of (re)computing the powerup/gate state for a fresh level setup. */
export interface ExtrasSetup { powerups: Powerup[]; gateTiles: Set<string>; gate: MapGateTile[] | null; gateOpen: boolean }

/** Quem pode andar de elevador, mais o andar de destino que a geometria escreve. */
type RideablePlayer = PlayerView<'x' | 'y' | 'elevTarget'>;

/* ===================== DI (mirrors game/elevators.ts) ===================== */

export interface LevelGeometryCtx {
  W: number;
  H: number;
  isWheelchair: () => boolean;
  rampLayer: PIXI.Graphics;
  ropeLayer: PIXI.Graphics;
  extraLayer: PIXI.Container;
  // `ReadonlySet`, porque este módulo LÊ — o cabeçalho do arquivo já diz isso em palavras ("gate/gateTiles/
  // powerups/wcSolid stay OWNED by game.js"), e agora o tipo diz também. O `.add()` que existe aqui é no
  // `Set` LOCAL que `buildWcGeom` cria e devolve, não neste.
  /** Os jogadores. Estado de RODADA (ADR-0038) — instância da raiz, não `let` de módulo. */
  getPlayers: () => readonly unknown[];
  wcSolid: () => ReadonlySet<string>;
  // O `powerups` fica mutável aqui e SEGUE vermelho — por outro motivo: o `core/state` o declara
  // `readonly unknown[]`, e `unknown` não é `Powerup`. Isso é a decisão da issue #79 (quem descreve o
  // tipo de um campo), não este conserto; trocar só o `readonly` maquiaria o erro sem responder nada.
  powerups: () => readonly Powerup[];
  gateTiles: () => ReadonlySet<string>;
  gate: () => readonly MapGateTile[] | null;
  gateOpen: () => boolean;
  pupTexFor: (kind: string, mode: string) => PIXI.Texture;
  isDirectMode: (mode: string) => boolean;
  gateRoleColor: () => [number, number, number];
}

let W = 0, H = 0;
let isWheelchair: () => boolean = () => false;
let rampLayer: PIXI.Graphics | null = null;
let ropeLayer: PIXI.Graphics | null = null;
let extraLayer: PIXI.Container | null = null;
let getWcSolid: () => ReadonlySet<string> = () => new Set();
let getPlayers: () => readonly unknown[] = () => [];
let getPowerups: () => readonly Powerup[] = () => [];
let getGateTiles: () => ReadonlySet<string> = () => new Set();
let getGate: () => readonly MapGateTile[] | null = () => null;
let getGateOpen: () => boolean = () => true;
let pupTexFor: (kind: string, mode: string) => PIXI.Texture = () => PIXI.Texture.EMPTY;
let isDirectMode: (mode: string) => boolean = () => false;
let gateRoleColor: () => [number, number, number] = () => [0x8a, 0x5a, 0x2b];

/** Inject level dims, the wheelchair flag, the PIXI layers to draw into, and read-only getters for the
 * gate/powerup/wcSolid state that game.js owns (core/collision reads it too, so it is NOT ours to hold). */
export function initLevelGeometry(ctx: LevelGeometryCtx): void {
  W = ctx.W; H = ctx.H; isWheelchair = ctx.isWheelchair;
  rampLayer = ctx.rampLayer; ropeLayer = ctx.ropeLayer; extraLayer = ctx.extraLayer;
  getWcSolid = ctx.wcSolid; getPowerups = ctx.powerups; getPlayers = ctx.getPlayers;
  getGateTiles = ctx.gateTiles; getGate = ctx.gate; getGateOpen = ctx.gateOpen;
  pupTexFor = ctx.pupTexFor; isDirectMode = ctx.isDirectMode; gateRoleColor = ctx.gateRoleColor;
}

/* ===================== rampas: detecção pura (degrau de 1 tile) ===================== */

/** Every walkable single-tile step in the map: `dir:'up'` if the surface at `x+1` is 1 tile higher,
 * `'down'` if 1 tile lower. Pure — only needs core/collision (solidTile) wired. Verbatim from buildRamps. */
export function computeRampSteps(mapW: number, mapH: number): RampStep[] {
  const surf = (x: number, y: number): boolean => solidTile(x, y) && !solidTile(x, y - 1);
  const steps: RampStep[] = [];
  for (let y = 1; y < mapH; y++) for (let x = 0; x < mapW - 1; x++) {
    if (!surf(x, y)) continue;
    if (surf(x + 1, y - 1)) steps.push({ x, y, dir: 'up' });
    else if (surf(x + 1, y + 1)) steps.push({ x, y, dir: 'down' });
  }
  return steps;
}

/** Lava(9)/trampoline(5) tiles that wheelchair mode repaints as flat ground (lava keeps a block border,
 * trampoline does not — it is also the elevator's floor). Pure. Verbatim from buildRamps. */
export function computeFloorOverlay(mapW: number, mapH: number): FloorOverlayTile[] {
  const out: FloorOverlayTile[] = [];
  for (let y = 0; y < mapH; y++) for (let x = 0; x < mapW; x++) {
    const t = tileAt(x, y);
    // PERIGO e TRAMPOLIM recebem o mesmo overlay de chão; o campo `lava` é o que os separa no desenho.
    if (!ehPerigo(t) && !ehTrampolim(t)) continue;
    out.push({ x, y, lava: ehPerigo(t) });
  }
  return out;
}

/** Draws the wheelchair ramps (steps + lava/trampoline floor + wcSolid bridges) into the injected rampLayer.
 * Needs initLevelGeometry() first. Draw-only wrapper around computeRampSteps/computeFloorOverlay. */
export function buildRamps(): void {
  if (!rampLayer) return;
  rampLayer.clear();
  const wc = isWheelchair();
  rampLayer.visible = wc;
  if (!wc) return;
  const FILL = 0x7b7f8b, EDGE = 0x4a4e59, STRIPE = 0xf2c200;
  for (const step of computeRampSteps(W, H)) {
    if (step.dir === 'up') {
      const X = (step.x + 1) * TILE, yL = step.y * TILE, yU = (step.y - 1) * TILE;
      rampLayer.beginFill(FILL); rampLayer.moveTo(X - TILE, yL); rampLayer.lineTo(X, yU); rampLayer.lineTo(X, yL); rampLayer.closePath(); rampLayer.endFill();
      rampLayer.lineStyle(1, EDGE); rampLayer.moveTo(X - TILE, yL); rampLayer.lineTo(X, yU);
      rampLayer.lineStyle(2, STRIPE); rampLayer.moveTo(X - TILE, yL - 1); rampLayer.lineTo(X, yU - 1); rampLayer.lineStyle(0);
    } else {
      const X = (step.x + 1) * TILE, yL = step.y * TILE, yD = (step.y + 1) * TILE;
      rampLayer.beginFill(FILL); rampLayer.moveTo(X, yL); rampLayer.lineTo(X + TILE, yD); rampLayer.lineTo(X, yD); rampLayer.closePath(); rampLayer.endFill();
      rampLayer.lineStyle(1, EDGE); rampLayer.moveTo(X, yL); rampLayer.lineTo(X + TILE, yD);
      rampLayer.lineStyle(2, STRIPE); rampLayer.moveTo(X, yL - 1); rampLayer.lineTo(X + TILE, yD - 1); rampLayer.lineStyle(0);
    }
  }
  for (const tile of computeFloorOverlay(W, H)) {
    const X = tile.x * TILE, Y = tile.y * TILE;
    rampLayer.beginFill(0x6f7481); rampLayer.drawRect(X, Y, TILE, TILE); rampLayer.endFill();
    rampLayer.beginFill(0x8a8f9c); rampLayer.drawRect(X, Y, TILE, 3); rampLayer.endFill();
    if (tile.lava) { rampLayer.lineStyle(1, 0x4a4e59); rampLayer.drawRect(X + 0.5, Y + 0.5, TILE - 1, TILE - 1); rampLayer.lineStyle(0); }
  }
  for (const k of getWcSolid()) {
    const [x, y] = k.split(',').map(Number);
    const X = x * TILE, Y = y * TILE;
    rampLayer.beginFill(0x6f7481); rampLayer.drawRect(X, Y, TILE, TILE); rampLayer.endFill();
    rampLayer.beginFill(0x8a8f9c); rampLayer.drawRect(X, Y, TILE, 2); rampLayer.endFill();
    rampLayer.lineStyle(1, 0x4a4e59); rampLayer.drawRect(X + 0.5, Y + 0.5, TILE - 1, TILE - 1); rampLayer.lineStyle(0);
  }
}

/* ===================== geometria só-cadeirante (pontes) ===================== */

// Ponte do elevador do corredor: liga o poço do trampolim B (x20-22) ao topo da escada (x25). Fixa ao nível.
const WC_BRIDGES: { x: number; y: number }[] = [{ x: 23, y: 47 }, { x: 24, y: 47 }];

/** The wchair-only solid tiles ('x,y' keys) — empty outside wheelchair mode. Pure; game.js assigns the
 * result to its own `wcSolid` (core/collision reads that variable too, so it stays game.js-owned). */
export function buildWcGeom(wheelchair: boolean): Set<string> {
  const wcSolid = new Set<string>();
  if (!wheelchair) return wcSolid;
  for (const b of WC_BRIDGES) wcSolid.add(b.x + ',' + b.y);
  return wcSolid;
}

/* ===================== cordas flutuantes (água) ===================== */

/** Every water-surface tile (tile 3 with non-water above) — where a floating rope anchor sits. Pure. */
export function computeRopeAnchors(mapW: number, mapH: number): RopeAnchor[] {
  const anchors: RopeAnchor[] = [];
  for (let y = 1; y < mapH; y++) for (let x = 0; x < mapW; x++) {
    if (!ehAgua(tileAt(x, y)) || ehAgua(tileAt(x, y - 1))) continue; // superfície: água com NÃO-água em cima
    anchors.push({ x, y });
  }
  return anchors;
}

/** Draws the floating ropes into the injected ropeLayer (always on — the blind route crosses water by them,
 * not wheelchair-gated). Needs initLevelGeometry() first. */
export function buildRopes(): void {
  if (!ropeLayer) return;
  ropeLayer.clear();
  for (const a of computeRopeAnchors(W, H)) {
    const X = a.x * TILE, Y = a.y * TILE + 1;
    ropeLayer.lineStyle(1, 0xcaa96a, 0.85); ropeLayer.moveTo(X, Y); ropeLayer.lineTo(X + TILE, Y); ropeLayer.lineStyle(0);
    ropeLayer.beginFill(0x8a6f3a); ropeLayer.drawRect(X + TILE / 2 - 1, Y - 1, 2, 2); ropeLayer.endFill();
  }
}

/* ===================== elevador (cabine de vidro) ===================== */

/** Draws the elevator glass shafts + persistent cabin into `g` (consumes game/elevators.js's getElevShafts/
 * elevAt — it is the ONLY writer of `carY`, per that module's doc comment). Needs initLevelGeometry() first. */
export function drawElevators(g: PIXI.Graphics): void {
  g.clear();
  if (!isWheelchair()) return;
  const pls = getPlayers() as readonly RideablePlayer[]; // a lista vem da rodada (ADR-0038), não de um `let` de módulo
  for (const s of getElevShafts()) { if (s.carY == null) s.carY = s.yBottom; for (const pl of pls) { if (elevAt(pl) === s) s.carY = pl.y; } }
  const GLASS = 0x9fd0e6, FRAME = 0x8aa0b8, WHITE = 0xeaf2f8, BLUE = 0x4a78b0, INNER = 0x24384d;
  for (const s of getElevShafts()) {
    const x0 = s.xMin * TILE, x1 = (s.xMax + 1) * TILE, w = x1 - x0, yt = s.yTop - TILE, yb = s.yBottom, h = yb - yt;
    g.beginFill(GLASS, 0.14); g.drawRect(x0, yt, w, h); g.endFill();
    for (const cx of s.cols) for (let ry = Math.floor(yt / TILE); ry <= Math.floor((yb - 1) / TILE); ry++) {
      if (!ehEscada(tileAt(cx, ry))) continue;
      const X = cx * TILE, Y = ry * TILE;
      g.beginFill(INNER, 0.9); g.drawRect(X, Y, TILE, TILE); g.endFill(); g.beginFill(GLASS, 0.22); g.drawRect(X, Y, TILE, TILE); g.endFill();
    }
    g.lineStyle(1, BLUE, 0.45); for (let yy = yt + TILE; yy < yb; yy += TILE) { g.moveTo(x0, yy); g.lineTo(x1, yy); } for (let xx = x0 + TILE; xx < x1; xx += TILE) { g.moveTo(xx, yt); g.lineTo(xx, yb); }
    g.lineStyle(2, FRAME, 0.95); g.drawRect(x0, yt, w, h);
    g.lineStyle(2, WHITE, 0.22); g.moveTo(x0 + 2, yt + h * 0.6); g.lineTo(x0 + w * 0.55, yt + 2); g.lineStyle(0);
    const cy = Math.round(s.carY ?? s.yBottom); // carY was just seeded above; the ?? is only for TS (same shaft object)
    g.beginFill(INNER, 0.92); g.drawRect(x0 + 1, cy - 15, w - 2, 15); g.endFill();
    g.beginFill(GLASS, 0.35); g.drawRect(x0 + 2, cy - 14, w - 4, 13); g.endFill();
    g.lineStyle(2, FRAME); g.drawRect(x0 + 1, cy - 15, w - 2, 15); g.lineStyle(0);
    g.beginFill(0x2a3145); g.drawRect(x0, cy, w, 4); g.endFill();
    g.beginFill(WHITE, 0.85); g.drawRect(x0, cy - 1, w, 2); g.endFill();
  }
  for (const pl of pls) {
    if (pl.elevTarget == null) continue;
    const s = elevAt(pl); if (!s) continue;
    const y = Math.round(pl.y), up = pl.elevTarget < y, ax = (s.xMin * TILE + (s.xMax + 1) * TILE) / 2, ay = up ? y - 9 : y + 11;
    g.beginFill(0xf2c200); g.moveTo(ax, ay + (up ? -4 : 4)); g.lineTo(ax - 4, ay); g.lineTo(ax + 4, ay); g.closePath(); g.endFill();
  }
}

/* ===================== regiões escuras (segredos) ===================== */

/** Connected components of dark (tile 0) tiles, ≥2 tiles (ignores tiny pockets) — BFS flood-fill. Pure. */
export function buildDarkRegions(mapW: number, mapH: number): DarkRegion[] {
  const seen: boolean[][] = Array.from({ length: mapH }, () => new Array(mapW).fill(false));
  const regions: DarkRegion[] = [];
  for (let y = 0; y < mapH; y++) for (let x = 0; x < mapW; x++) {
    if (!ehSecreto(tileAt(x, y)) || seen[y]![x]) continue;
    const stack: [number, number][] = [[x, y]];
    const tiles: [number, number][] = [];
    seen[y]![x] = true;
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      tiles.push([cx, cy]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < mapW && ny >= 0 && ny < mapH && !seen[ny]![nx] && ehSecreto(tileAt(nx, ny))) { seen[ny]![nx] = true; stack.push([nx, ny]); }
      }
    }
    if (tiles.length >= 2) regions.push(tiles);
  }
  return regions;
}

/* ===================== power-ups + portão (E12) ===================== */

/** Spawns the powerup list from the map's item slots: wheelchair mode keeps only fly/turbo/key (the key
 * still opens the gate); blind mode swaps the super-jump slot for the run-cane. Pure. Verbatim from setupExtras. */
export function buildPowerupList(mapItems: MapItem[], opts: { wheelchair: boolean; blind: boolean }): Powerup[] {
  const list: Powerup[] = mapItems
    .filter((it) => !opts.wheelchair || it.kind === 'fly' || it.kind === 'turbo' || it.kind === 'key')
    .map((it) => ({ x: it.tx * TILE + 2, y: it.ty * TILE + 2, kind: it.kind, taken: false, by: [] as number[], sprite: null }));
  if (opts.blind) { const sj = list.find((pu) => pu.kind === 'superjump'); if (sj) sj.kind = 'runcane'; }
  return list;
}

/** The gate's solid tiles as 'x,y' keys (core/collision reads this — empty when there is no gate). Pure. */
export function computeGateTiles(mapGate: MapGateTile[]): Set<string> {
  return new Set(mapGate.map((g) => g.tx + ',' + g.ty));
}
/** The gate's tile list, or null when the level has no gate. Pure. */
export function computeGate(mapGate: MapGateTile[]): MapGateTile[] | null {
  return mapGate.length ? mapGate : null;
}
/** A gate starts CLOSED (opens when the key-holder touches it) — true only when there is no gate at all. Pure. */
export function isGateInitiallyOpen(mapGate: MapGateTile[]): boolean {
  return mapGate.length === 0;
}

/** Recomputes the powerup + gate state for a (re)start. Pure — game.js assigns the result to its own
 * `powerups`/`gateTiles`/`gate`/`gateOpen` (all read elsewhere: collision, the key/gate touch logic, HUD,
 * window.__incl) and then calls rebuildExtras() to draw. `decorSeed`/`modoCego` stay game.js's job. */
export function setupExtras(mapItems: MapItem[], mapGate: MapGateTile[], opts: { wheelchair: boolean; blind: boolean }): ExtrasSetup {
  return {
    powerups: buildPowerupList(mapItems, opts),
    gateTiles: computeGateTiles(mapGate),
    gate: computeGate(mapGate),
    gateOpen: isGateInitiallyOpen(mapGate),
  };
}

/** Draws the powerup sprites + the (closed) gate graphic into the injected extraLayer, from the current
 * powerups/gateTiles/gate/gateOpen getters. Needs initLevelGeometry() first. game.js's wrapper still resets
 * `_lastSharedViz` afterwards (that flag is shared with the world/parallax/coin texture caches, not ours). */
export function rebuildExtras(): void {
  if (!extraLayer) return;
  extraLayer.removeChildren().forEach((s) => s.destroy());
  for (const pu of getPowerups()) {
    const s = new PIXI.Sprite(pupTexFor(pu.kind, vizMode));
    s.x = pu.x; s.y = pu.y; s.visible = !pu.taken;
    extraLayer.addChild(s);
    pu.sprite = s;
  }
  const gate = getGate();
  if (gate && !getGateOpen()) {
    const g = new PIXI.Graphics();
    const hc = isDirectMode(vizMode);
    const [gr, gg, gb] = gateRoleColor();
    const base = hc ? ((gr << 16) | (gg << 8) | gb) : 0x8a5a2b;
    const plank = hc ? ((((gr * 0.38) | 0) << 16) | (((gg * 0.38) | 0) << 8) | ((gb * 0.38) | 0)) : 0x5a3a1b;
    for (const k of getGateTiles()) {
      const [tx, ty] = k.split(',').map(Number);
      const X = tx * TILE, Y = ty * TILE;
      g.beginFill(base).drawRect(X, Y, TILE, TILE).endFill();
      g.beginFill(plank);
      for (let i = 2; i < TILE; i += 5) g.drawRect(X + i, Y + 1, 2, TILE - 2);
      g.endFill();
    }
    extraLayer.addChild(g);
  }
}
