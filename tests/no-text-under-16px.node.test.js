// SPDX-License-Identifier: AGPL-3.0-or-later
// NO TEXT UNDER 16 px AT 640×360, AND NONE THAT STOPS GROWING WITH THE SCALE (ADR-0163 rule 3).
//
// 🔴 The Dev: «Só faz sentido fonte de no mínimo tamanho 16 a partir desta resolução.» Measured in the study of the rules
// the engine does not impose (item A3): the quick bar's name caption drew at 13.6 px and the panel hints at 14.4 px, and
// on 2026-09-12 `style.css` held 28 `font-size` declarations under 1em, 1rem or 16 px.
//
// 📌 WHY STATIC, and why it is enough for THIS half. The region's base is `--ui-fs` (16 px at 640×360, growing with k —
// `texto-cresce-com-a-escala` proves that in a browser). Under that base, a declaration below 1em is the ONLY way text
// gets smaller than 16 px, and a `rem` is the only way it stops following the region: `rem` reads the document root,
// which never scales. So both are read off the stylesheet, one declaration at a time, and named when they fail.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const CSS = readFileSync(join(RAIZ, 'app', 'css', 'style.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, '')); // comments out, line numbers kept

/** Every size a rule declares for text: `font-size`, a `var()` fallback inside it, and the size in a `font` shorthand. */
function tamanhos() {
  const achados = [];
  const linha = (i) => CSS.slice(0, i).split('\n').length;
  for (const m of CSS.matchAll(/font-size:\s*([^;}]+)/g)) {
    for (const v of m[1].matchAll(/(\d*\.?\d+)(px|rem|em)\b/g)) achados.push({ valor: +v[1], unidade: v[2], text: m[0].trim(), linha: linha(m.index) });
    if (/\b(small|smaller|x-small|xx-small)\b/.test(m[1])) achados.push({ valor: 0, unidade: 'keyword', text: m[0].trim(), linha: linha(m.index) });
  }
  for (const m of CSS.matchAll(/(?<![-\w])font:\s*([^;}]+)/g)) {
    const v = m[1].match(/(?:^|\s)(\d*\.?\d+)(px|rem|em)(?=\/|\s)/);
    if (v) achados.push({ valor: +v[1], unidade: v[2], text: m[0].trim(), linha: linha(m.index) });
  }
  return achados;
}

const TODOS = tamanhos();
const nomear = (l) => l.map((a) => `line ~${a.linha}: ${a.text}`);

describe('text is never under 16 px and always follows the scale (ADR-0163 rule 3)', () => {
  it('⚠️ [Cross-check] the reading finds sizes in all three forms — or every case below would pass on nothing', () => {
    expect(TODOS.filter((a) => a.unidade === 'em').length).toBeGreaterThan(10);
    expect(TODOS.filter((a) => a.unidade === 'px').length).toBeGreaterThan(0);
    expect(TODOS.some((a) => a.text.startsWith('font:')), 'the `font` shorthand is not read').toBe(true);
  });

  it('🔴 [Boundary] no declaration under 1em, and no px size under 16', () => {
    const baixos = TODOS.filter((a) => a.unidade === 'keyword'
      || ((a.unidade === 'em' || a.unidade === 'rem') && a.valor < 1)
      || (a.unidade === 'px' && a.valor < 16));
    expect(nomear(baixos), 'text drawn under 16 px at 640×360').toEqual([]);
  });

  it('🔴 [Right] no size in rem — it reads the document root, which does not grow with the scale', () => {
    expect(nomear(TODOS.filter((a) => a.unidade === 'rem')), 'text that stays the same size at 1280×720').toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   S1 the bar caption back to .85em             🔴 [Boundary]
//   S2 a size of 1.6 in rem                      🔴 [Right]
//   S3 the HUD fallback back to 14px             🔴 [Boundary]
//   S4 the crash banner's shorthand at 15px      🔴 [Boundary]
//   S5 the keyword `small`                       🔴 [Boundary]
//   S6 the reading stops seeing the shorthand    🔴 [Cross-check]
