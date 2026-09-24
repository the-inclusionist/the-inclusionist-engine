// SPDX-License-Identifier: AGPL-3.0-or-later
// A CALLIGRAPHIC FACE'S MINIMUM BECOMES A GATE WHEN IT MEETS THE SIZE THE SCREEN USES (#87, item 2).
//
// ========================= WHY =========================
// Item 2 of #87 says, in these words: «Abaixo disso a face deixa de ser difícil e vira ilegível — tem de ser gate, não
// recomendação.» `ui/fonts` declares `minPx` (Pinyon 24, UnifrakturMaguntia 20, Fondamento 20), and a minimum only the
// test reads is a recommendation dressed as a gate — precisely what the issue refuses. So the number is measured here
// against the size the screen USES.
//
// ========================= THE NUMBER ON THE OTHER SIDE =========================
// The smallest `font-size` declared in PIXELS in `app/css/style.css` (including a `var(--x, Npx)` fallback). The rules
// in `em` cannot be computed statically.
//
// ⚠️ AND THE DIRECTION OF THE IGNORANCE IS WHAT SAVES THE ARGUMENT. The smallest size REALLY drawn is unknown — but the
// relative rules can only go down from what they inherit. So the smallest px size is a CEILING of the floor: the real
// smallest size is that number or less. That is enough, because the conclusion is «não desça abaixo de». Since ADR-0163
// every size is 16 px or more and nothing relative goes under 1em (`texto-nunca-abaixo-de-16`), so the ceiling is 16.
//
// ========================= THE CONSEQUENCE, WHICH STOPS BEING TASTE =========================
// Every calligraphic face asks for more than 16. So **none of them can be offered in this interface's menu** — and
// `OFERECIVEIS` excludes them by ROLE, which is a design rule. Here the exclusion is also tied to a NUMBER: if someone
// puts a calligraphic face in the menu, or gives an offered face a `minPx` its scale does not reach, or lowers the
// screen's floor, this fails.
//
// ⚠️ What this file does NOT assert: that the smallest px size is the real floor. It asserts it is a ceiling of it, and
// the assertion uses it only in that direction. A case saying «o piso é 16» would invent precision the measurement
// does not have.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FONT_GROUPS, OFERECIVEIS, fontRole, faceScale, BASE_EM_PX } from '../app/js/ui/fonts.js';

const RAIZ = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const CSS = readFileSync(join(RAIZ, 'app', 'css', 'style.css'), 'utf8');

/** The `font-size`s in px, including the fallback of a `var(--x, Npx)` — which is what the HUD really uses. */
const EM_PX = [...CSS.matchAll(/font-size:\s*(?:var\([^,)]+,\s*)?(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]);
/** The relative rules. They do not enter the arithmetic; they enter the ARGUMENT, because they only go down. */
const RELATIVAS = [...CSS.matchAll(/font-size:\s*\.?\d+(?:\.\d+)?r?em/g)].length;

const TETO_DO_PISO = Math.min(...EM_PX);

describe('o tamanho mínimo de uma face é aferido contra o que a tela usa (#87 item 2)', () => {
  it('⚠️ [Cross-check] a leitura do CSS acha tamanhos — senão tudo abaixo seria vazio', () => {
    // A regex that stopped matching would give `Math.min()` = Infinity, and every comparison below would stay green
    // forever. This case keeps the gate from dying silently, which has happened in this repository with another regex.
    expect(EM_PX.length, 'nenhum font-size em px encontrado no style.css').toBeGreaterThan(0);
    expect(Number.isFinite(TETO_DO_PISO)).toBe(true);
    expect(RELATIVAS, 'nenhuma regra relativa; rever a prosa do cabeçalho').toBeGreaterThan(0);
  });

  it('[Right] o teto do piso é um número de tela plausível, e não um acidente de leitura', () => {
    // Wide on purpose: the case does not exist to pin the value — it exists to catch an absurd reading (0, or 200) that
    // would make the following assertions say anything.
    expect(TETO_DO_PISO).toBeGreaterThanOrEqual(8);
    expect(TETO_DO_PISO).toBeLessThanOrEqual(24);
  });

  it('⚠️ [Zero] NENHUMA face oferecida no menu pede mais do que a tela dá', () => {
    // The whole rule, and the only one that needs to exist. `minPx` absent = the face declares no minimum.
    // 📌 Since ADR-0176 a face offered with a floor above the screen's is drawn LARGER, by its own scale: what is measured is the
    // size the child gets, the screen's base times that scale.
    const grandes = OFERECIVEIS
      .filter((it) => typeof it.minPx === 'number' && it.minPx > TETO_DO_PISO * faceScale(it) && it.minPx > BASE_EM_PX * faceScale(it))
      .map((it) => `${it.k} pede ${it.minPx}px e a tela desce a ${TETO_DO_PISO}px ou menos`);
    expect(grandes, 'face oferecida que a interface desenharia abaixo do legível').toEqual([]);
  });

  it('⚠️ [Interface] e a exclusão das caligráficas deixa de ser só desenho — passa a ter número', () => {
    // `OFERECIVEIS` filters by ROLE. This case asserts the second reason, independent of the first: every calligraphic
    // face asks for MORE than this interface guarantees. If the screen ever raises its floor, this case fails — asking
    // for a rereading, not a fix: by then the exclusion would be design alone again, and ADR-0012 decides that.
    const CALIGRAFICAS = FONT_GROUPS.flatMap((g) => g.items).filter((it) => fontRole(it) === 'caligrafica');
    expect(CALIGRAFICAS.length, 'não há caligráficas; este caso não mede nada').toBeGreaterThan(0);
    for (const it of CALIGRAFICAS) {
      expect(it.minPx, `${it.k} não declara mínimo`).toBeTypeOf('number');
      expect(it.minPx, `${it.k} pede ${it.minPx}px, que a tela já garante — reler o ADR-0012 emendado`)
        .toBeGreaterThan(TETO_DO_PISO);
      expect(OFERECIVEIS.includes(it), `${it.k} está no menu e a tela desenha-a ilegível`).toBe(false);
    }
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · removing the role filter from `OFERECIVEIS` (`ui/fonts`) → the [Zero] case of offered faces fails, naming
//     `pinyon` and `ufmag` with the two numbers side by side. It is #87 item 2 measured instead of written.
//   · adding to the catalogue a GENERAL face (no role, so offered) with `minPx: 20` → the [Zero] case fails with
//     «pede 20px e a tela desce a 14px ou menos». The gate does not depend on the face being calligraphic: it depends
//     on the number not fitting the screen.
//   · raising ALL SEVEN px `font-size` declarations of `style.css` to 26px → the [Interface] case of the calligraphic
//     exclusion fails on both, asking for a rereading of ADR-0012. ⚠️ Recorded as a WANTED failure and not a defect:
//     raising the screen's floor changes the exclusion's premise.
//
//     ⚠️ AND RECORDED TOO WHAT WENT WRONG, because it is the lesson and not the result: it was first tried by
//     replacing ONE occurrence of `var(--hud-fs,14px)`. There are two, and five more px declarations in other rules —
//     among them the `font-size:16px` of `html,body`. The suite stayed green and it was about to be recorded as a
//     «mutação que não falha», when what had happened was that the mutation was NOT APPLIED to the number the gate
//     reads. Counting occurrences before replacing is what tells the two apart.
//   · replacing the `px` regex with one that does not match → the [Cross-check] case of reading the CSS fails. Without
//     it, `Math.min()` would give Infinity and the next two cases would stay green forever.
