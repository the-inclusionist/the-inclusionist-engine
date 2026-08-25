// SPDX-License-Identifier: AGPL-3.0-or-later
// render/minimap.ts — minimapa com FOG-OF-WAR (Estágio 4, Tier 1). Um container PixiJS no canto do stage: fundo
// + tiles JÁ VISTOS (revelados pela câmera) + ponto do jogador. O que já foi visto persiste até o fim da fase.
// initMinimap cria os objetos (import PURO — nada de PIXI no import); markSeen revela; redrawMinimapIfDirty
// repinta só quando mudou; drawMinimapPlayer põe o ponto; resetMinimap re-escurece (fim de fase). Cor do tile
// vem de core/collision (tileAt/isSolidType). Deps: PIXI (npm), constants (TILE/LOGICAL_*), collision.
import * as PIXI from 'pixi.js';
import { LOGICAL_W, LOGICAL_H, TILE } from '../core/constants.js';
import { tileAt, isSolidType } from '../core/collision.js';

const MM_SCALE = 0.8, MM_PAD = 4;
let _minimap: PIXI.Container | null = null;
let _mmTiles: PIXI.Graphics | null = null, _mmPlayer: PIXI.Graphics | null = null;
let _seen: Uint8Array[] = [];
let _dirty = false;
let _W = 0, _H = 0, _mmW = 0, _mmH = 0;

// Cria o container + graphics no stage e a grade de "visto" (W×H). Chamado uma vez no boot do game.js.
export function initMinimap(stage: PIXI.Container, W: number, H: number): void {
  _W = W; _H = H; _mmW = W * MM_SCALE; _mmH = H * MM_SCALE;
  _minimap = new PIXI.Container(); _minimap.x = MM_PAD; _minimap.y = LOGICAL_H - _mmH - MM_PAD; _minimap.alpha = 0.92;
  stage.addChild(_minimap);
  const mmBg = new PIXI.Graphics(); mmBg.beginFill(0x05070f, 0.72); mmBg.drawRect(-1, -1, _mmW + 2, _mmH + 2); mmBg.endFill();
  _mmTiles = new PIXI.Graphics(); _mmPlayer = new PIXI.Graphics();
  _minimap.addChild(mmBg, _mmTiles, _mmPlayer);
  _seen = Array.from({ length: H }, () => new Uint8Array(W));
  _dirty = false;
}

// Marca como visto todos os tiles dentro da janela da câmera (camX,camY = canto sup-esq do viewport, em px).
export function markSeen(camX: number, camY: number): void {
  const tx0 = Math.max(0, (camX / TILE) | 0), tx1 = Math.min(_W - 1, ((camX + LOGICAL_W) / TILE) | 0);
  const ty0 = Math.max(0, (camY / TILE) | 0), ty1 = Math.min(_H - 1, ((camY + LOGICAL_H) / TILE) | 0);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (!_seen[ty][tx]) { _seen[ty][tx] = 1; _dirty = true; }
}

// Repinta os tiles vistos SÓ se algo novo foi revelado (barato: o fog muda pouco por frame). Cor por tipo.
export function redrawMinimapIfDirty(): void {
  if (!_dirty || !_mmTiles) return;
  _mmTiles.clear();
  for (let ty = 0; ty < _H; ty++) for (let tx = 0; tx < _W; tx++) {
    if (!_seen[ty][tx]) continue;
    const t = tileAt(tx, ty);
    const col = isSolidType(t) ? 0x9a93b5 : (t === 3 ? 0x2f6fae : (t === 9 ? 0xff5b3a : 0x232038)); // sólido / água / lava / ar
    _mmTiles.beginFill(col, 1); _mmTiles.drawRect(tx * MM_SCALE, ty * MM_SCALE, MM_SCALE + 0.4, MM_SCALE + 0.4); _mmTiles.endFill();
  }
  _dirty = false;
}

// Ponto do jogador (worldX,worldY em px do mundo; o game.js passa o centro do corpo).
export function drawMinimapPlayer(worldX: number, worldY: number): void {
  if (!_mmPlayer) return;
  _mmPlayer.clear(); _mmPlayer.beginFill(0xffd23f, 1);
  _mmPlayer.drawRect((worldX / TILE) * MM_SCALE - 1, (worldY / TILE) * MM_SCALE - 1, 2.6, 2.6); _mmPlayer.endFill();
}

// Fim de fase: o fog-of-war volta a escurecer (o mapa some até ser revisto).
export function resetMinimap(): void { _seen.forEach((r) => r.fill(0)); _dirty = true; }

// Reposiciona o minimapa: no toque vai p/ o canto sup-dir (não briga com os controles); senão inf-esq.
export function setMinimapCorner(touch: boolean): void {
  if (!_minimap) return;
  if (touch) { _minimap.x = LOGICAL_W - _mmW - MM_PAD; _minimap.y = MM_PAD; }
  else { _minimap.x = MM_PAD; _minimap.y = LOGICAL_H - _mmH - MM_PAD; }
}

export function setMinimapVisible(v: boolean): void { if (_minimap) _minimap.visible = v; } // some no título / no multiplayer
export function getMinimap(): PIXI.Container | null { return _minimap; }                     // p/ o __incl (debug/teste)
export function minimapSeenCount(): number { let n = 0; for (const r of _seen) for (const v of r) n += v; return n; } // stat de fog revelado
