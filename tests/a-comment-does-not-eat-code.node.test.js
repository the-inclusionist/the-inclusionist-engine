// SPDX-License-Identifier: AGPL-3.0-or-later
// A COMMENT MUST NOT EAT CODE — the gate that was missing, written after a real defect.
//
// ========================= WHAT HAPPENED =========================
// An explanatory comment was inserted IN THE MIDDLE of a line (commit `d889254`):
//
//   ti.addEventListener('click',(e)=>{ … if(!ib)return; // (an explanation) … setPauseActorValue(0); pauseIcons.iconAct(ib.dataset.pi,0);
//
// A `//` runs to the end of the line. The two calls after it — which were THE ACTION of the click — became comments,
// and the ten accessibility icons of the title screen stopped DOING ANYTHING: blindness, voice narration, Libras, ASD
// mode, toggle keys, high contrast and four more.
//
// And the worst detail is what stayed ALIVE on the next line: `srSay(ib.getAttribute('aria-label'))`. The child using a
// screen reader pressed high contrast and HEARD `High contrast: off` — an immediate answer, no action. A dead button that
// speaks is worse than a silent dead one: it confirms what it did not do.
//
// It stayed that way for dozens of commits. Nothing accused it, and nothing could:
//   · `tsc` does not read comments — not with `strict`, not with `noUnusedLocals`;
//   · no test covered the splash dispatcher (it lived in the composition root, which was not importable);
//   · `setPauseActorValue`, the function called there, STOPPED EXISTING in a later refactor — and not even that showed,
//     because a call inside a comment is not a call.
//
// The visible symptom was another and looked harmless: the bundle shrank 33 bytes in a "type-only" change (issue #80).
// The 33 bytes were the two calls vanishing from the emitted code.
//
// ========================= HOW THIS GATE TELLS PROSE FROM CODE =========================
// The rule must let a legitimate comment with parentheses and semicolons through — the tree has comments like
// `trampolim = CHÃO sólido (para EM CIMA); escada = desce ao chão de baixo`.
//
// What separates the two is the SPACE: prose writes `mixer (dados);`, a call writes `iconAct(0);`. Requiring the
// identifier GLUED to the parenthesis drops the false positives and keeps the defect.
//
// MUTATION CHECKED: reinserting such a comment in the middle of a line of code makes this case fail, naming the file
// and line (`comentário engoliu chamada — <file>:<line>`).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'app', 'js');

function fontes(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) fontes(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

/** A terminated CALL: an identifier glued to the `(`, and `;` after the `)`. */
const CHAMADA = /[A-Za-z_$][\w$]*\([^()]*\)\s*;/;

/** Lines with CODE before the `//` whose comment holds a terminated call. */
function engolidas(arquivo) {
  const achados = [];
  readFileSync(arquivo, 'utf8').split('\n').forEach((ln, i) => {
    const k = ln.indexOf('//');
    if (k <= 0) return;                        // no `//`, or the `//` opens the line (a whole-line comment)
    const antes = ln.slice(0, k).trim();
    if (!antes) return;                        // only space before: an indented comment, legitimate
    if (/[,*]$/.test(antes)) return;           // continuation of a list or a `/** … */` block
    if (/https?:$/.test(antes)) return;        // a URL is not a comment
    if (CHAMADA.test(ln.slice(k + 2))) achados.push(`${arquivo}:${i + 1}`);
  });
  return achados;
}

describe('comentário de fim de linha não engole código', () => {
  it('[Zero] o gate está olhando arquivos de verdade', () => {
    // Without this, moving the folder would leave the case below green for measuring nothing.
    expect(fontes(RAIZ).length).toBeGreaterThan(60);
  });

  it('[Right] nenhuma linha da árvore tem uma CHAMADA dentro do comentário', () => {
    const todas = fontes(RAIZ).flatMap(engolidas);
    expect(todas, 'comentário engoliu chamada — ' + todas.join(', ')).toEqual([]);
  });

  it('[Interface] a regra deixa PASSAR prosa com parêntese e ponto-e-vírgula', () => {
    // The case that keeps the gate from becoming noise. There are lines like this in the tree, and a gate that failed on
    // them would be switched off in the first hurry — and would not be there on the day it matters.
    expect(CHAMADA.test('trampolim = CHÃO sólido (para EM CIMA); escada desce')).toBe(false);
    expect(CHAMADA.test('Fase 2: categorias do mixer (dados); audioCat vem de audio.js')).toBe(false);
    expect(CHAMADA.test('TEX_IDLE — respiração (4 quadros); [0] é a pose neutra')).toBe(false);
  });

  it('[Right] e PEGA a forma exata do defeito de 2026-08-25', () => {
    expect(CHAMADA.test(' genérico: é o `dataset` dele que se lê setPauseActorValue(0); pauseIcons.iconAct(x,0);')).toBe(true);
  });
});
