// SPDX-License-Identifier: AGPL-3.0-or-later
// ONE TARGET RULER (plan phase 5b; ADR-0163): `--tap` and `--alvo-min` are the same floor, written by one function.
//
// 📏 Measured on 2026-09-13: `aplicarEscala` wrote `--tap` as 22·k and `--alvo-min` as 22·max(k, 2). With the Windows 110%
// display scale (device pixel ratio 1.1) `escalaDoPalco` gives k ≈ 1.82 CSS px per logical pixel, so `--tap` was 40 px —
// under ADR-0163's 44 px floor — while the engine's own stylesheet sized the quick bar's icons, its buttons and the pad's
// minimum from `--tap`. `--tap` stays written: three sibling games read it (`public-page-surface.json`).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { escalaDoPalco, aplicarEscala, alvoMinimo } from '../app/js/ui/layout.js';

function regiaoFalsa() {
  const vars = {};
  return { vars, style: { width: '', height: '', setProperty: (k, v) => { vars[k] = v; } } };
}

describe('one target ruler', () => {
  it('🔴 [Right] at a 110% display scale, `--tap` is not under the 44 px floor — it is `--alvo-min`', () => {
    const e = escalaDoPalco(640, 360, 1.1, 320, 180);
    expect(e.k, 'the case needs a scale under 2 CSS px per logical pixel').toBeLessThan(2);
    const r = regiaoFalsa();
    aplicarEscala(r, e);
    expect(parseFloat(r.vars['--tap']), 'the tap target fell under the floor').toBeGreaterThanOrEqual(44);
    expect(r.vars['--tap']).toBe(r.vars['--alvo-min']);
  });

  it('📌 [Right] above the floor both grow together with the scale', () => {
    for (const [w, h, dpr] of [[1280, 720, 1], [1920, 1080, 1], [1366, 768, 1.25]]) {
      const r = regiaoFalsa();
      const e = escalaDoPalco(w, h, dpr, 320, 180);
      aplicarEscala(r, e);
      expect(r.vars['--tap']).toBe(`${alvoMinimo(e.k)}px`);
      expect(r.vars['--alvo-min']).toBe(`${alvoMinimo(e.k)}px`);
    }
  });

  it('🔴 [Right] the engine\'s stylesheet reads one name for the target floor', () => {
    const css = readFileSync(join(process.cwd(), 'app', 'css', 'style.css'), 'utf8');
    const linhas = css.split(/\r?\n/).map((l, i) => [i + 1, l]).filter(([, l]) => /var\(--tap\b/.test(l));
    expect(linhas.map(([n]) => `style.css:${n}`), 'a rule sizes a target from `--tap` instead of `--alvo-min`').toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   R1 `--tap` back to 22·k                                 🔴 110% scale
//   R2 a rule back to `var(--tap)`                          🔴 one name
//   R3 `--alvo-min` without the floor (22·k)                🔴 110% scale
