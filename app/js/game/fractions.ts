// SPDX-License-Identifier: GPL-3.0-or-later
// game/fractions — the fraction MATH + rendering for the math activities (Estágio 4). Pure string/number:
// simplify, format per notation, build the circle/square SVG graphic, and speak a fraction in pt-BR. Verbatim
// from game.js. The notation TOGGLES (fracNot) + their menu labels stay in game.js (fraction settings panel).
// See docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, game/quiz — frações).

import { rnd } from '../core/rng.js';

/** Greatest common divisor. */
export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Simplified fraction as a plain string ("0", "3", "2/5"). */
export function fracStr(n: number, D: number): string {
  if (n === 0) return '0';
  const g = gcd(n, D) || 1, a = n / g, d = D / g;
  return d === 1 ? String(a) : a + '/' + d;
}

const DEN_NAME: Record<number, string> = { 2: 'meio', 3: 'terço', 4: 'quarto', 5: 'quinto', 6: 'sexto', 7: 'sétimo', 8: 'oitavo', 9: 'nono', 10: 'décimo', 12: 'doze avos' };

/** Format n/D in a notation: '' or 'v' vertical (HTML), 'd' diagonal, 'dec' decimal, 'pct' percent, 'mix' mixed. */
export function fmtFrac(n: number, D: number, not: string): string {
  if (n === 0) return not === 'dec' ? '0,0' : '0';
  const g = gcd(n, D) || 1, a = n / g, d = D / g;
  if (not === 'dec') return (Math.round((n / D) * 10) / 10).toFixed(1).replace('.', ','); // SEMPRE 1 casa decimal
  if (not === 'pct') { const r = Math.round((n / D) * 1000) / 10; return (Number.isInteger(r) ? r : String(r).replace('.', ',')) + '%'; }
  if (d === 1) return String(a);
  if (not === 'mix' && a > d) { const i = Math.floor(a / d), r = a % d; return r ? (i + ' ' + r + '/' + d) : String(i); }
  if (not === 'v') return `<span class="fv"><b>${a}</b><b>${d}</b></span>`;
  return a + '/' + d; // diagonal (inline)
}

// GRÁFICOS de fração: círculo (radial) e/ou quadrado por denominador (2→ao meio · 3→3 faixas · 4→2×2 · 5→só círculo · 6→2×3).
const FRAC_GFX: Record<number, { cols: number; rows: number } | null> = { 2: { cols: 2, rows: 1 }, 3: { cols: 3, rows: 1 }, 4: { cols: 2, rows: 2 }, 5: null, 6: { cols: 2, rows: 3 } };

function _pieUnit(k: number, d: number): string {
  const R = 18, C = 20, seg: string[] = []; // círculo RADIAL: d setores, k preenchidos (do topo, horário)
  const pt = (deg: number): [string, string] => { const a = (deg - 90) * Math.PI / 180; return [(C + R * Math.cos(a)).toFixed(2), (C + R * Math.sin(a)).toFixed(2)]; };
  if (d === 1) { seg.push(`<circle cx="${C}" cy="${C}" r="${R}" fill="${k ? 'var(--frac-fill)' : '#fff'}" stroke="#0d0d1a" stroke-width="1.6"/>`); }
  else for (let i = 0; i < d; i++) {
    const [x0, y0] = pt(i * 360 / d), [x1, y1] = pt((i + 1) * 360 / d), large = 360 / d > 180 ? 1 : 0;
    seg.push(`<path d="M${C} ${C} L${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} Z" fill="${i < k ? 'var(--frac-fill)' : '#fff'}" stroke="#0d0d1a" stroke-width="1.3"/>`);
  }
  return `<svg class="frac-svg" viewBox="0 0 40 40" aria-hidden="true">${seg.join('')}<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="#0d0d1a" stroke-width="1.6"/></svg>`;
}
function _sqGrid(k: number, cols: number, rows: number): string {
  const S = 40, cw = S / cols, ch = S / rows, seg: string[] = []; // quadrado em grade cols×rows, k células preenchidas
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const idx = r * cols + c;
    seg.push(`<rect x="${(c * cw).toFixed(2)}" y="${(r * ch).toFixed(2)}" width="${cw.toFixed(2)}" height="${ch.toFixed(2)}" fill="${idx < k ? 'var(--frac-fill)' : '#fff'}" stroke="#0d0d1a" stroke-width="1.2"/>`);
  }
  return `<svg class="frac-svg" viewBox="0 0 40 40" aria-hidden="true">${seg.join('')}<rect x=".8" y=".8" width="38.4" height="38.4" fill="none" stroke="#0d0d1a" stroke-width="1.6"/></svg>`;
}

/** A proper-fraction (1..d) graphic as an HTML span (circle or square). Zero/improper → '' (caller shows a number). */
export function fracGraphic(n: number, d: number, shape?: string): string {
  if (d < 2 || d > 6 || n < 1 || n > d) return '';
  const sq = FRAC_GFX[d];
  const useSq = shape === 'square' || (shape == null && sq && rnd() < 0.5);
  const svg = (useSq && sq) ? _sqGrid(n, sq.cols, sq.rows) : _pieUnit(n, d);
  return `<span class="frac-fig" data-frac="${n}/${d}" role="img" aria-label="${fracSpeak(n + '/' + d)}">${svg}</span>`;
}

/** Speak a bare "n/d" fraction in pt-BR ("um meio", "3 quartos", "5 doze avos"…). */
export function fracSpeak(s: string): string {
  const m = /^(\d+)\/(\d+)$/.exec(String(s));
  if (!m) return String(s);
  const n = +m[1]!, d = +m[2]!, nm = DEN_NAME[d] || (d + ' avos');
  const plural = nm.endsWith('avos') ? nm : nm + 's'; // "avos" é invariável (não "avoss")
  return n === 1 ? ('um ' + nm) : (n + ' ' + plural);
}

/** Speak any NOTATION: vertical HTML → a/b, mixed → "N inteiros e a/b", the graphic SVG → its fraction. */
export function speakChoice(s: string): string {
  s = String(s);
  const fig = /data-frac="(\d+)\/(\d+)"/.exec(s);
  if (fig) return fracSpeak(fig[1] + '/' + fig[2]); // pizza/quadrado (SVG): lê a fração
  if (/</.test(s)) s = s.replace(/<\/b><b>/, '/').replace(/<[^>]+>/g, '');
  const m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (m) return m[1] + (m[1] === '1' ? ' inteiro e ' : ' inteiros e ') + fracSpeak(m[2] + '/' + m[3]);
  return fracSpeak(s);
}
