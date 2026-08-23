// SPDX-License-Identifier: GPL-3.0-or-later
// render/crt.ts — estética CRT (menu Sensibilidade visual): scanlines/vinheta/cantos, só CSS (classes em
// #game-region). Extraído do game.js (Estágio 4, Tier 1). CRT = config {scan,vig,round} (0=off,1,2; scan/vig são
// on/off) carregada do localStorage com migração do formato antigo booleano. crtScanVars ancora a scanline em
// PIXELS REAIS (recomputa da altura real do #game-region + dpr → 1 linha por pixel de arte, espaçamento regular).
// Auto-contido: depende de ui/dom ($) + core/state (numPlayers). O applyCrt() de boot é chamado pelo game.js.
import { $ } from '../ui/dom.js';
import { numPlayers } from '../core/state.js';
import { screenGrid } from '../core/screens.js';
import * as store from '../platform/storage.js';

type CrtCfg = { scan: number; vig: number; round: number };
// scanline LIGADA por padrão (decisão do José 2026-07-03). Migra incl_crt (booleano) → incl_crt2 (níveis 0..2).
export const CRT: CrtCfg = (() => {
  const d: CrtCfg = { scan: 1, vig: 0, round: 1 };
  try {
    const s = JSON.parse(store.get(store.KEYS.crt, null) || store.get(store.KEYS.crtLegacy, null) || 'null');
    const fresh = !store.get(store.KEYS.crt, null); // migração p/ crt2: herda vig/round; scan volta ao padrão ON uma vez
    if (s && typeof s === 'object') for (const k in d) if (k in s) {
      const v = s[k];
      if (fresh && k === 'scan') continue;
      (d as Record<string, number>)[k] = v === true ? (k === 'round' ? 2 : 1) : v === false ? (k === 'round' ? 1 : 0) : Math.max(0, Math.min(2, v | 0));
    }
  } catch (e) { /* noop: file:// / modo privado */ }
  d.scan = d.scan ? 1 : 0; d.vig = d.vig ? 1 : 0; // scanlines/vinheta são ON/OFF (só cantos têm 3 níveis)
  return d;
})();

// Ancora a scanline em px REAIS: 1 linha por pixel de ARTE (kDev inteiro) → espaçamento SEMPRE regular em qualquer dpr.
export function crtScanVars(): void {
  const g = $<HTMLElement>('#game-region'); if (!g || !CRT.scan) return;
  const { rows } = screenGrid(numPlayers), dpr = window.devicePixelRatio || 1;
  const perDev = Math.max(2, Math.round((g.clientHeight || 360) * dpr / (180 * rows))); // kDev = px REAIS por linha de arte (INTEIRO)
  g.style.setProperty('--scan-per', (perDev / dpr) + 'px'); // período = kDev px reais (1 linha de arte)
  g.style.setProperty('--scan-line', (Math.max(1, Math.round(dpr)) / dpr) + 'px'); // linha = 1 px REAL
}

// Aplica as classes CSS de CRT ao #game-region e persiste. Chamado no boot e ao mexer no menu.
export function applyCrt(): void {
  const g = $<HTMLElement>('#game-region'); if (!g) return;
  ['crt-scan-1', 'crt-vig-1', 'crt-round-0', 'crt-round-2'].forEach((c) => g.classList.remove(c));
  if (CRT.scan) { g.classList.add('crt-scan-' + CRT.scan); crtScanVars(); }
  if (CRT.vig) g.classList.add('crt-vig-' + CRT.vig);
  if (CRT.round !== 1) g.classList.add('crt-round-' + CRT.round); // 1 = visual padrão (8px), sem classe
  store.setJSON(store.KEYS.crt, CRT);
}
