// SPDX-License-Identifier: AGPL-3.0-or-later
// render/scene-city — city scenario decoration: sidewalk/streetlamp/signage facade band, water-tank walls,
// abandoned-interior clutter (darkRegions, drawn under the darkness layer), and the live water/lava tile fx
// (waves/coral/algae/fish, lava streaks). Extracted from game.js. The layers (cityDecoG/abandonG/lavaFxG/
// waterFxG/skyLayer) are CREATED in game.js — z-order stays soldered there — and INJECTED here; we move only
// the LOGIC. Formulas copied verbatim. `applyCenarioVida` is the thin scenario-toggle orchestrator: it flips
// only this module's own layers and calls an injected hook so the coordinator can wire game/life and
// game/traffic's own scenario reactions (see the module boundary note in the extraction report).

interface Gfx { visible: boolean; clear(): void; beginFill(color: number, alpha?: number): Gfx; drawRect(x: number, y: number, w: number, h: number): Gfx; endFill(): Gfx; }
interface VisibleLayer { visible: boolean; }
interface DarkRegion { set: Set<string>; }
interface Pl { x: number; y: number; quit?: boolean; }

export interface SceneCityCtx {
  cityDecoG: Gfx; abandonG: Gfx; lavaFxG: Gfx; waterFxG: Gfx; // camadas de deco/fx (criadas no game.js)
  skyLayer: VisibleLayer; // céu procedural da Cidade (render/scene-sky) — só a visibilidade é tocada aqui
  darkRegions: DarkRegion[]; // áreas secretas (core do mapa) — só .set é lido, p/ desenhar o entulho por baixo
  solidAt: (x: number, y: number) => boolean; tileAt: (x: number, y: number) => number; // consultas ao mundo (compartilhadas)
  lifeSurfaceAt: (tx: number) => number; // superfície ao ar livre mais alta da coluna — compartilhada com game/life (spawn de criaturas); fica no game.js, injetada
  WORLD_W: number; WORLD_H: number; TILE: number;
  WORLD_PX_W: number; WORLD_PX_H: number; LOGICAL_W: number; LOGICAL_H: number; BOX: { h: number };
  DIRECT_CFG: Record<string, unknown>; // modos de alto contraste (Renderização Direta) — chave = vizMode
  getCenario: () => string; getVizMode: () => string; getPlayers: () => Pl[]; getFxClock: () => number; getRm: () => { decor?: boolean };
  onCenarioChange?: (city: boolean) => void; // orquestração: o coordenador liga aqui os toggles próprios de game/life e game/traffic
}

export interface SceneCity { buildCityDeco: () => void; applyCenarioVida: () => void; stepTileFx: () => void; }

// ---- Seleção de tile/decoração por posição (lógica pura, determinística — hash em tx/ty, sem PIXI) ----

/** Coluna com poste de luz na fachada (a cada 11 tiles). */
export function isStreetlampColumn(tx: number): boolean { return tx % 11 === 4; }
/** Coluna com letreiro na fachada (a cada 9 tiles, exige parede 3 tiles acima — checado pelo chamador). */
export function isSignageColumn(tx: number): boolean { return tx % 9 === 2; }
export const SIGNAGE_COLORS = [0x37c9a0, 0xff8c5a, 0x64b0ff, 0xffd23f] as const;
/** Cor do letreiro daquela coluna (4 variações, cíclicas por tx). */
export function signageColor(tx: number): number { return SIGNAGE_COLORS[tx % 4]; }
/** Tipo de decoração da célula abandonada (entulho/viga/pichação/vazio) — hash determinístico em tx,ty. */
export function abandonedDecorKind(tx: number, ty: number): number { return (tx * 13 + ty * 7) % 10; }
export const GRAFFITI_COLORS = [0xc94fd6, 0x4fd67a, 0xd6c94f] as const;
/** Cor da pichação daquela coluna (3 variações, cíclicas por tx). */
export function graffitiColor(tx: number): number { return GRAFFITI_COLORS[tx % 3]; }

/** Deriva horizontal (0..3) dos tracinhos de lava — avança 1 tile a cada 8 ticks do fxClock. */
export function lavaStreakOffset(fxClock: number, worldX: number): number { return (Math.floor(fxClock / 8) + worldX) % 4; }
/** Hash determinístico por coluna, usado p/ escolher o "leito" da água (coral/algas/vazio). */
export function waterBedHash(tx: number): number { return (tx * 2654435761) >>> 0; }
/** Tipo de leito da coluna: 0=coral, 1=algas, 2=vazio. */
export function waterBedKind(tx: number): number { return waterBedHash(tx) % 3; }
export const CORAL_COLORS = [0xe8743b, 0xf2c14e, 0x8c2f39] as const;
/** Cor do coral daquela coluna (3 variações, derivadas do mesmo hash do leito). */
export function coralColor(tx: number): number { return CORAL_COLORS[(waterBedHash(tx) >>> 3) % 3]; }
/** Hash determinístico por célula, usado p/ decidir se há peixe nadando ali (água aberta). */
export function fishHash(tx: number, ty: number): number { return (tx * 40503 + ty * 12289) >>> 0; }
/** ~1/7 das células de água aberta recebe um peixe. */
export function fishSpawnsAt(tx: number, ty: number): boolean { return fishHash(tx, ty) % 7 === 0; }
export const FISH_COLORS = [0xe5484d, 0x3a6ea5, 0x48b06a] as const;
/** Cor do peixe daquela célula (3 variações, derivadas do hash de peixe). */
export function fishColor(tx: number, ty: number): number { return FISH_COLORS[fishHash(tx, ty) % 3]; }

export function initSceneCity(ctx: SceneCityCtx): SceneCity {
  // buildCityDeco v3: desenhado UMA vez (mapa é estático) — calçada+postes+letreiros na fachada mais baixa,
  // paredes/linha d'água da caixa d'água (bounding box dos tiles de água, tipo 3), e entulho/viga/pichação
  // sob a escuridão das áreas secretas (abandonG, camada abaixo de darkLayer no game.js).
  function buildCityDeco(): void {
    const g = ctx.cityDecoG; g.clear(); const a = ctx.abandonG; a.clear();
    const TILE = ctx.TILE;
    // ---- FACHADA (banda mais baixa, por onde o personagem anda): calçada + postes + letreiros.
    // Placas de PARE ficam na rua da frente (game/traffic), junto dos carros.
    const BASE_TY = ctx.WORLD_H - 9;
    for (let tx = 1; tx < ctx.WORLD_W - 1; tx++) {
      const ty = ctx.lifeSurfaceAt(tx); if (ty < BASE_TY) continue;
      const X = tx * TILE, y = ty * TILE;
      g.beginFill(0x9aa0ad, 0.9).drawRect(X, y, TILE, 2).endFill();            // calçada clara
      g.beginFill(0x565e70, 1).drawRect(X, y + 2, TILE, 1).endFill();          // meio-fio
      if (isStreetlampColumn(tx)) {
        g.beginFill(0x3a4152).drawRect(X + 7, y - 30, 2, 30).endFill(); g.beginFill(0x3a4152).drawRect(X + 7, y - 30, 8, 2).endFill(); // poste + braço
        g.beginFill(0xffe9a8, 1).drawRect(X + 13, y - 29, 3, 3).endFill(); g.beginFill(0xffe9a8, 0.18).drawRect(X + 9, y - 31, 11, 8).endFill(); // lâmpada + halo FIXO (sem piscar)
      }
      if (isSignageColumn(tx) && ctx.solidAt(tx, ty - 3)) {
        const c = signageColor(tx); // letreiro na fachada
        g.beginFill(0x141824).drawRect(X + 2, y - 3.5 * TILE, 12, 6).endFill(); g.beginFill(c, 1).drawRect(X + 3, y - 3.5 * TILE + 1, 10, 4).endFill();
        g.beginFill(c, 0.15).drawRect(X, y - 3.5 * TILE - 2, 16, 10).endFill(); // brilho estável
      }
    }
    // ---- CAIXA D'ÁGUA: paredes metálicas nas bordas do corpo d'água (tile 3) + linha d'água no topo
    let wx0 = 1e9, wx1 = -1, wy0 = 1e9, wy1 = -1;
    for (let ty = 0; ty < ctx.WORLD_H; ty++) for (let tx = 0; tx < ctx.WORLD_W; tx++) {
      if (ctx.tileAt(tx, ty) === 3) { wx0 = Math.min(wx0, tx); wx1 = Math.max(wx1, tx); wy0 = Math.min(wy0, ty); wy1 = Math.max(wy1, ty); }
    }
    if (wx1 >= 0) {
      const X0 = wx0 * TILE, X1 = (wx1 + 1) * TILE, Y0 = wy0 * TILE, Y1 = (wy1 + 1) * TILE;
      g.beginFill(0x6a7486, 0.85).drawRect(X0 - 3, Y0 - 6, 3, Y1 - Y0 + 6).drawRect(X1, Y0 - 6, 3, Y1 - Y0 + 6).endFill(); // paredes do tanque
      for (let ry = Y0; ry < Y1; ry += 12) { g.beginFill(0x49515f).drawRect(X0 - 3, ry, 3, 2).drawRect(X1, ry, 3, 2).endFill(); } // rebites
      g.beginFill(0xbfe6ff, 0.5).drawRect(X0, Y0, X1 - X0, 1.5).endFill(); // linha d'água
    }
    // ---- ABANDONADO (darkRegions): entulho, viga e pichação — desenhado sob a escuridão
    for (const reg of ctx.darkRegions) {
      for (const key of reg.set) {
        const [tx, ty] = key.split(',').map(Number) as [number, number];
        const X = tx * TILE, Y = ty * TILE, h = abandonedDecorKind(tx, ty);
        if (ctx.solidAt(tx, ty + 1) && h < 3) { a.beginFill(0x555b66).drawRect(X + 2, Y + TILE - 5, 7, 5).endFill(); a.beginFill(0x434955).drawRect(X + 7, Y + TILE - 3, 6, 3).endFill(); } // entulho
        else if (h === 4) { a.beginFill(0x6b4e2e, 0.9).drawRect(X, Y + 3, TILE, 3).endFill(); } // viga exposta
        else if (h === 7) { const c = graffitiColor(tx); a.beginFill(c, 0.55).drawRect(X + 3, Y + 6, 9, 2).drawRect(X + 5, Y + 9, 6, 2).endFill(); } // pichação
      }
    }
  }

  // applyCenarioVida: orquestrador FINO do troca-de-cenário. Só liga/desliga as camadas que este módulo possui
  // (deco da cidade + o céu procedural da cidade); trânsito (carLayer + cars) e vida (criaturas) são de outros
  // dois módulos e reagem via onCenarioChange — nunca tocados diretamente daqui.
  function applyCenarioVida(): void {
    const city = ctx.getCenario() === 'cidade';
    ctx.cityDecoG.visible = city; ctx.skyLayer.visible = city; // deco/céu da cidade SÓ na Cidade
    ctx.onCenarioChange?.(city);
  }

  // stepTileFx v3: água (ondas de superfície + leito coral/algas + peixes esparsos) e lava (tracinhos claros à
  // deriva) — só perto de cada jogador (câmera), com dedupe por célula entre jogadores em tela dividida.
  function stepTileFx(): void {
    ctx.lavaFxG.clear(); ctx.waterFxG.clear();
    if (ctx.DIRECT_CFG[ctx.getVizMode()] || ctx.getRm().decor) return; // HC repinta o mundo; viewDecor off na v3 = só a base estática
    const TILE = ctx.TILE, t = ctx.getFxClock(), seen = new Set<string>();
    for (const pl of ctx.getPlayers()) {
      if (pl.quit) continue;
      const camX = Math.max(0, Math.min(pl.x - ctx.LOGICAL_W / 2, ctx.WORLD_PX_W - ctx.LOGICAL_W));
      const camY = Math.max(0, Math.min((pl.y - ctx.BOX.h / 2) - ctx.LOGICAL_H / 2, ctx.WORLD_PX_H - ctx.LOGICAL_H));
      const tx0 = Math.max(0, Math.floor(camX / TILE) - 1), tx1 = Math.min(ctx.WORLD_W - 1, Math.floor((camX + ctx.LOGICAL_W) / TILE) + 1);
      const ty0 = Math.max(0, Math.floor(camY / TILE) - 1), ty1 = Math.min(ctx.WORLD_H - 1, Math.floor((camY + ctx.LOGICAL_H) / TILE) + 1);
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const tt = ctx.tileAt(tx, ty); if (tt !== 3 && tt !== 9) continue; // só água(3)/lava(9)
        const k = tx + ',' + ty; if (seen.has(k)) continue; seen.add(k);
        const X = tx * TILE, Y = ty * TILE;
        if (tt === 9) { const off = lavaStreakOffset(t, X); // lava v3: tracinhos claros que derivam
          ctx.lavaFxG.beginFill(0xff7755).drawRect(X + off, Y + 3, 3, 1).drawRect(X + ((off + 6) % TILE), Y + 8, 3, 1).endFill(); continue; }
        // ÁGUA v3: ondulação verde sutil que deriva
        ctx.waterFxG.beginFill(0x46a078, 0.12).drawRect(X, Y + 7 + Math.round(2 * Math.sin(tx * 1.3 + t * 0.04)), TILE, 2).endFill();
        if (ctx.tileAt(tx, ty - 1) !== 3) { const off = Math.sin(t * 0.05 + X * 0.1) > 0 ? 1 : 0; // linha de superfície SÓ na borda de cima
          ctx.waterFxG.beginFill(0xffffff, 0.35).drawRect(X + off, Y + 1, TILE - off, 1).endFill(); }
        if (ctx.solidAt(tx, ty + 1)) { const kind = waterBedKind(tx); // leito: coral / algas (determinísticos por coluna)
          if (kind === 0) { ctx.waterFxG.beginFill(coralColor(tx))
            .drawRect(X + 6, Y + 9, 2, 7).drawRect(X + 4, Y + 10, 2, 4).drawRect(X + 9, Y + 8, 2, 5).drawRect(X + 3, Y + 12, 1, 2).drawRect(X + 11, Y + 11, 1, 2).endFill(); }
          else if (kind === 1) { ctx.waterFxG.beginFill(0x3fae6a); const sway = 2 * Math.sin(t * 0.06 + tx); // algas balançando
            for (let a2 = 0; a2 < 9; a2++) { ctx.waterFxG.drawRect(X + 7 + Math.round(sway * (a2 / 9)), Y + 15 - a2, 1, 1);
              if (a2 % 2 === 0) ctx.waterFxG.drawRect(X + 9 + Math.round(sway * (a2 / 9)), Y + 15 - a2, 1, 1); } ctx.waterFxG.endFill(); }
        } else if (fishSpawnsAt(tx, ty)) { // água aberta: peixinho esparso nadando (com olho!)
          const fx2 = X + 6 + Math.round(5 * Math.sin(t * 0.04 + tx + ty)), fy2 = Y + 7 + Math.round(2 * Math.sin(t * 0.07 + ty));
          const dir = Math.cos(t * 0.04 + tx + ty) >= 0 ? 1 : -1;
          ctx.waterFxG.beginFill(fishColor(tx, ty)).drawRect(fx2, fy2, 3, 2).drawRect(fx2 - dir, fy2, 1, 2).endFill();
          ctx.waterFxG.beginFill(0xffffff, 1).drawRect(fx2 + (dir > 0 ? 2 : 0), fy2, 1, 1).endFill();
        }
      }
    }
  }

  return { buildCityDeco, applyCenarioVida, stepTileFx };
}
