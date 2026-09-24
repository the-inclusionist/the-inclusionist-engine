// SPDX-License-Identifier: AGPL-3.0-or-later
// THE USER STORIES MUST NOT POINT AT FILES THAT NO LONGER EXIST (issue #3).
//
// ========================= WHAT THIS FILE PREVENTS, AND IT WAS MEASURED =========================
// On 2026-09-07 the issue board was swept for bodies citing non-existent paths. Three pointed at files that had left with
// the cartridge (#111) — #62 said to edit six lines of an `app/index.html` that no longer exists, #77 cited an
// `app/js/game/progress.ts` that changed repository, and #14 pointed at a plan that had moved folder. **Nothing said so.**
//
// `User-Stories.md` is the document with the highest density of paths in this repository, and what #3 asks of it —
// *«mark which stories are already implemented; audit against app/js»* — is exactly the claim that rots first. A story
// marked ✅ that names a deleted module is not an imprecision: it is the document saying something is done and guarded
// when the guard has left.
//
// ⚠️ WHAT IT DOES NOT CHECK, and it is honest to say so: whether the story is TRUE. That a module exists does not prove a
// child plays with her eyes. This checks what a machine can check — that the named proof exists — and that is why the ✅
// column demands a GATE and not only a module: whoever wants to know whether the story holds goes on to the named test,
// which is where the question has an answer.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const REL = join('docs', '1-Discovery', 'User-Stories.md');
const DOC = readFileSync(join(RAIZ, REL), 'utf8');

/** A repository path cited between backticks. `package.json` counts; `../educational/` is not a file. */
const RE_CAMINHO = /`((?:app|tests|scripts|docs)\/[A-Za-z0-9_\-./]+\.[a-z]+|package\.json)`/g;

/**
 * The stories: list items carrying one of the four status markers.
 *
 * ⚠️ A STORY IS AN ITEM, NOT A LINE. The stories are wrapped at 110 columns, so the ⬜ marker is on the first line and
 * the `**#92**` that justifies it is on the second — reading line by line failed all SEVEN pending stories by mistake.
 * Joining the continuations (indented lines) before splitting is what makes the sieve see the whole item.
 */
const MARCADORES = ['✅', '🟡', '⬜', '🎮'];
/**
 * ⚠️ THE MARKER HAS TO OPEN THE LINE, not just appear in it. Accepting any item that CONTAINED a marker caught a line of
 * the «Status» section that says «três delas agora ✅ com o gate nomeado» — prose about the stories read as a story. A
 * broad sieve does not err by excess of zeal: it accuses text that never promised anything.
 */
const RE_HISTORIA = new RegExp('^- (?:' + MARCADORES.join('|') + ') ');
const historias = DOC
  .replace(/\r?\n\s{2,}(?=\S)/g, ' ')  // a list item's continuation → same line
  .split(/\r?\n/)
  .filter((l) => RE_HISTORIA.test(l));

/**
 * The ✅ stories proved ONLY by a gate, because what they assert is an ABSENCE.
 *
 * «A engine não fala o vocabulário do meu jogo» has no module: its subject is that there is none. Requiring a module
 * would force inventing a citation, and an invented citation is worse than a declared exception. This list only shrinks,
 * and the `[Interface]` case below stops it from growing to accommodate laziness.
 */
const PROVAM_SE_POR_AUSENCIA = [
  'not speak my game',
];

/** The paths cited on a line. */
const caminhosDe = (linha) => [...linha.matchAll(RE_CAMINHO)].map((m) => m[1]);

describe('User-Stories.md · o que ele afirma sobre o código tem de existir (#3)', () => {
  it('[Zero] o crivo está mesmo a ler histórias — senão tudo passaria por vacuidade', () => {
    // This file's failure mode is the regex matching zero lines and every case going green over nothing.
    expect(DOC.length).toBeGreaterThan(3000);
    expect(historias.length, 'nenhuma linha de história reconhecida').toBeGreaterThanOrEqual(25);
    const comCaminho = historias.filter((l) => caminhosDe(l).length > 0);
    expect(comCaminho.length, 'nenhuma história cita caminho').toBeGreaterThanOrEqual(20);
  });

  it('⚠️ [Right] todo caminho citado EXISTE', () => {
    const mortos = [];
    for (const linha of historias) {
      for (const c of caminhosDe(linha)) {
        if (!existsSync(join(RAIZ, c))) mortos.push(`${c}  (em: ${linha.slice(0, 70)}…)`);
      }
    }
    expect(mortos, 'história a apontar para ficheiro inexistente:\n  ' + mortos.join('\n  ')).toEqual([]);
  });

  it('⚠️ [Right] toda história ✅ nomeia um MÓDULO e um GATE — a marca de feito custa prova', () => {
    // The rule that gives ✅ its meaning. Without it, «feito e guardado» would be an opinion, and the document would go
    // back to what #3 found: a list with the note «many of the seed items above are already implemented; audit against
    // code when formalizing», which nobody audited for a month.
    const fracas = [];
    for (const linha of historias.filter((l) => l.startsWith('- ✅'))) {
      const cs = caminhosDe(linha);
      const temModulo = cs.some((c) => c.startsWith('app/js/') || c === 'package.json');
      const temGate = cs.some((c) => /^tests\/.+\.test\.js$/.test(c));
      const porAusencia = PROVAM_SE_POR_AUSENCIA.some((m) => linha.includes(m));
      if (!temGate || (!temModulo && !porAusencia)) {
        fracas.push(`${linha.slice(0, 80)}…  (módulo: ${temModulo}, gate: ${temGate})`);
      }
    }
    expect(fracas, 'história ✅ sem módulo ou sem gate:\n  ' + fracas.join('\n  ')).toEqual([]);
  });

  it('[Interface] a lista de excepções não guarda entrada morta nem cresce sem razão', () => {
    // The half that makes the exception shrink: an entry that no longer matches any story — because the story changed its
    // text or gained a module — is a gap left open for the next laziness.
    const orfas = PROVAM_SE_POR_AUSENCIA.filter((m) => !historias.some((l) => l.startsWith('- ✅') && l.includes(m)));
    expect(orfas, 'excepção que já não descreve história nenhuma: ' + orfas.join(', ')).toEqual([]);
    expect(PROVAM_SE_POR_AUSENCIA.length, 'a excepção deixou de ser excepção').toBeLessThanOrEqual(2);
  });

  it('[Interface] toda história ⬜ nomeia a issue que a segue — dívida sem número é dívida perdida', () => {
    const semIssue = historias
      .filter((l) => l.includes('⬜'))
      .filter((l) => !/\*\*#\d+\*\*/.test(l))
      .map((l) => l.slice(0, 80) + '…');
    expect(semIssue, 'história por fazer e sem issue:\n  ' + semIssue.join('\n  ')).toEqual([]);
  });

  it('[Error] o crivo APANHA um caminho inventado — senão os casos acima não provam nada', () => {
    const falsa = '- ⬜ As a **player**, I want nothing. `app/js/core/nao-existe.ts` · **#1**';
    const mortos = caminhosDe(falsa).filter((c) => !existsSync(join(RAIZ, c)));
    expect(mortos).toEqual(['app/js/core/nao-existe.ts']);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · replacing `app/js/ui/webcam.ts` with `app/js/ui/webcam-x.ts` in the document → "[Right] todo caminho citado
//     EXISTE" fails naming the file and the line.
//   · removing the gate from a ✅ line (leaving only the module) → `[Right] toda história ✅` fails with
//     `(módulo: true, gate: false)`.
//   · removing the `**#92**` from a ⬜ line → `[Interface] toda história ⬜` fails.
//   · removing the entry from `PROVAM_SE_POR_AUSENCIA` → `[Right] toda história ✅` fails on the boundary story, which is
//     the only one proved by a gate alone. It is the case that stops the exception from being deleted by someone who
//     does not understand why it exists.
//   · replacing `RE_CAMINHO` with one that matches nothing → THREE fail: `[Zero]` («nenhuma história cita caminho»),
//     `[Right] toda história ✅` and `[Error] o crivo apanha um caminho inventado`.
//     ⚠️ This is the one that matters. Without `[Zero]`, a broken sieve would leave `[Right] todo caminho EXISTE` green
//     measuring an empty set — and that is the file's main case. It is the silent failure mode this repository has
//     already paid for with a dead regex.
//
// ⚠️ AND TWO THINGS THIS GATE CAUGHT IN ITSELF, when it was born, are worth writing down:
//   1. a story is a list ITEM, not a LINE — the stories are wrapped at 110 columns, and the first version failed the
//      seven ⬜ stories because their `**#N**` was on the second line;
//   2. the marker has to OPEN the line: the version that accepted «contém ✅» read as a story a sentence of the «Status»
//      section that talks ABOUT the stories.
