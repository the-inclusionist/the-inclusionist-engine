// SPDX-License-Identifier: GPL-3.0-or-later
// game/attract — modo demonstração (attract): 60s parado no título → 30s de demo. Prefere uma GRAVAÇÃO do cenário
// (?record=1 grava o P1 em localStorage), senão um ROBÔ joga; qualquer entrada encerra e volta ao menu.
// Módulo com estado próprio via fábrica: createAttract(ctx) devolve o controlador. Injeção por closure — recebe
// GETTERS para os bindings vivos (players/CENARIO/phase são reatribuídos no game.js) + as funções que precisa.
// Extraído do game.js (modularização Tier 1). Ver docs/5-Refactoring/plano-modularizacao-mapa.md.

import * as store from '../platform/storage.js';

interface Player { x: number; y: number; facing: number; vx: number; vy: number; onGround: boolean; jumpEdge: boolean; }
interface Kb { right?: string[]; left?: string[] }
type Cenarios = Record<string, { nome?: string } | undefined>;

export interface AttractCtx {
  CENARIOS: Cenarios;
  keys: Set<string>;
  getPlayers: () => Player[];   // binding vivo (restartGame pode reatribuir)
  getCenario: () => string;     // binding vivo
  getPhase: () => string;       // binding vivo
  setCenario: (c: string) => void;
  setActivity: (a: string) => void;
  restartGame: () => void;
  setPhase: (p: string) => void;
  randInt: (a: number, b: number) => number;
  kbFor: (i: number) => Kb;
  srSay: (t: string) => void;
  srAlert: (t: string) => void;
  $: (sel: string) => HTMLElement | null;
  search?: string;              // override p/ testes; default location.search
}

interface Attract { t: number; rec: number[][] | null; bot: { dir: number; jt: number; wall: number }; cen: string }

export interface AttractCtl {
  isAttract: () => boolean;
  startAttract: () => void;
  stopAttract: () => void;
  stepAttract: (dt: number) => void;
  /** Chamar por frame quando o título está visível: incrementa o idle e inicia a demo aos 60s (3600 ticks). */
  titleIdleTick: (titleVisible: boolean) => void;
  /** Handler de entrada (tecla/clique/pad): zera o idle e encerra a demo. Retorna true se ESTAVA em demo. */
  onInput: () => boolean;
  /** Chamar por frame no loop: grava o P1 quando ?record=1 (fora da demo, jogando). */
  recordTick: () => void;
}

export function createAttract(ctx: AttractCtx): AttractCtl {
  const RECORDING = /[?&]record=1/.test(ctx.search ?? location.search);
  let idleT = 0;
  let attract: Attract | null = null;
  let recArr: number[][] | null = null;
  let recT = 0;

  const attractRecFor = (cen: string): number[][] | null => {
    const a = store.getJSON<number[][]>(store.KEYS.attract(cen), null);
    return Array.isArray(a) && a.length > 10 ? a : null;
  };

  function startAttract(): void {
    const ks = Object.keys(ctx.CENARIOS);
    const cen = ks[ctx.randInt(0, ks.length - 1)];
    ctx.setCenario(cen); ctx.setActivity('ludico'); ctx.restartGame();
    attract = { t: 0, rec: attractRecFor(cen), bot: { dir: 1, jt: 60, wall: 0 }, cen };
    const ov = ctx.$('#title-overlay'); if (ov) ov.hidden = true;
    ctx.setPhase('playing');
    const gr = ctx.$('#game-region');
    if (!ctx.$('#attract-banner')) {
      if (gr) gr.insertAdjacentHTML('beforeend', '<div id="attract-banner" class="game-subtitle" style="position:absolute;left:50%;bottom:44px;transform:translateX(-50%);z-index:70;background:rgba(13,13,26,.8);padding:.2em .9em;border-radius:6px">Modo Demonstração — Aperte qualquer botão para jogar</div>');
    } else {
      ctx.$('#attract-banner')!.hidden = false;
    }
    ctx.srSay('Demonstração.');
  }

  function stopAttract(): void {
    if (!attract) return;
    const K = ctx.kbFor(0);
    [(K.right ?? [])[0], (K.left ?? [])[0]].forEach((c) => { if (c) ctx.keys.delete(c); });
    attract = null;
    const b = ctx.$('#attract-banner'); if (b) b.hidden = true;
    idleT = 0;
    const ov = ctx.$('#title-overlay'); if (ov) ov.hidden = false;
    ctx.restartGame(); ctx.setPhase('title');
  }

  function stepAttract(dt: number): void {
    if (!attract) return;
    attract.t += dt;
    const p = ctx.getPlayers()[0];
    if (attract.t >= 1800) { stopAttract(); return; } // 30s
    if (attract.rec) { // replay cinemático da gravação
      const fr = attract.rec;
      const s = fr[Math.min(fr.length - 1, Math.floor((attract.t / 1800) * fr.length))];
      p.x = s[0]; p.y = s[1]; p.facing = s[2] || 1; p.vx = 0; p.vy = 0; p.onGround = true;
    } else { // robô
      const b = attract.bot, K = ctx.kbFor(0), R = (K.right ?? [])[0], L = (K.left ?? [])[0];
      const fwd = b.dir > 0 ? R : L, back = b.dir > 0 ? L : R;
      if (fwd) ctx.keys.add(fwd); if (back) ctx.keys.delete(back);
      if ((b.jt -= dt) <= 0) { p.jumpEdge = true; b.jt = 40 + ctx.randInt(0, 90); }
      if (Math.abs(p.vx) < 0.05 && p.onGround && b.wall++ > 8) { b.wall = 0; b.dir *= -1; }
      else if (Math.abs(p.vx) >= 0.05) b.wall = 0;
    }
  }

  return {
    isAttract: () => !!attract,
    startAttract,
    stopAttract,
    stepAttract,
    titleIdleTick: (titleVisible) => {
      if (titleVisible) { if (++idleT > 3600 && !attract) startAttract(); } // 60s parado → demo (José)
      else if (!attract) idleT = 0;
    },
    onInput: () => { idleT = 0; if (attract) { stopAttract(); return true; } return false; },
    recordTick: () => {
      if (!(RECORDING && !attract && ctx.getPhase() === 'playing')) return;
      recT++;
      if (recT % 10 !== 0) return;
      const p = ctx.getPlayers()[0];
      (recArr = recArr ?? []).push([Math.round(p.x), Math.round(p.y), p.facing]);
      if (recArr.length >= 180) {
        const cen = ctx.getCenario();
        store.setJSON(store.KEYS.attract(cen), recArr);
        ctx.srAlert('Demo de 30 segundos gravada para ' + (ctx.CENARIOS[cen]?.nome ?? cen) + '.');
        recArr = null; recT = 0;
      }
    },
  };
}
