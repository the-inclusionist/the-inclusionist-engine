// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FOURTEEN STAY DISCRETE — the gate ADR-0112 owes, and it guards the REFUSED option.
//
// ========================= WHAT IT PREVENTS, AND WHY IT IS A GATE AND NOT A NOTE =========================
// ADR-0112 measured three ways out and chose the third: the POINTER as a capability declared beside the fourteen
// positions, which stay discrete. The second — magnitude on the fourteen, each position carrying 0..1 — was refused for a
// measured reason: **it does not unlock drawing** (drawing is POSITION, not magnitude) and it would impose a second grammar
// on all the accessibility already built — what does one-button do with a half-pressed action? what does the toggle
// keep? what does the reach screen say of a half-reached position? — paid by every game, to serve a case no game of
// the catalogue asks for.
//
// ⚠️ AND A REFUSED OPTION DOES NOT ARRIVE BY DECISION: it arrives one convenient field at a time. An `analogico` in one
// place, a `Record<Action, number>` in another, and six months later the second grammar exists without anyone having
// chosen it. It is the same road by which the single-valued `viz` settled in and then cost the whole of #104 to undo.
//
// ========================= WHAT IT DOES NOT CATCH, said so nobody trusts it too much =========================
// It is not type analysis. It catches the LITERAL shape of the arrival — a per-action structure with a numeric value, and
// an action that stops being a string — and `held`'s answer, which is the question every transport asks. It does not
// catch someone inventing an `intensidade(pl, act)` in a new module under another name. What would catch that is the
// inventory check of `input/**` growing, and it is recorded here as a known limit instead of an implicit one.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIONS } from '../app/js/core/actions.js';
import { held, padCur } from '../app/js/input/state.js';

const RAIZ_INPUT = fileURLToPath(new URL('../app/js/input/', import.meta.url));

function ficheirosTs(dir = RAIZ_INPUT) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...ficheirosTs(p));
    else if (nome.endsWith('.ts') && !nome.endsWith('.d.ts')) saida.push(p);
  }
  return saida;
}

/** CODE lines: a comment that QUOTES the forbidden shape to explain it is not the forbidden shape. */
const codigoDe = (p) => readFileSync(p, 'utf8').split(/\r?\n/)
  .filter((ln) => !/^\s*(\/\/|\*|\/\*)/.test(ln));

describe('ADR-0112 · as catorze posições continuam DISCRETAS', () => {
  it('⚠️ [Right] `held` responde SIM ou NÃO, e não «quanto»', () => {
    // It is the question every transport asks, and the place magnitude would enter first. `toBe(true)` would already
    // demand the boolean, but `typeof` states the RULE instead of assuming it — and it is what fails if someone returns
    // `1`/`0`, which is how magnitude usually disguises itself as compatible.
    const jogador = { ctrl: { action1: ['KeyZ'] }, pad: -1 };
    expect(typeof held(jogador, 'action1')).toBe('boolean');
    expect(typeof held(jogador, 'action2')).toBe('boolean');
    // and through the gamepad, the transport that HAS analogue input and throws it away at the source
    padCur[0] = { action1: true };
    expect(typeof held({ ctrl: {}, pad: 0 }, 'action1')).toBe('boolean');
    expect(held({ ctrl: {}, pad: 0 }, 'action1')).toBe(true);
    delete padCur[0];
  });

  it('⚠️ [Interface] uma posição é um NOME e não um descritor com campos', () => {
    // The other way for magnitude to arrive: `ACTIONS` going from strings to objects, and one of them gaining
    // `analog: true`. Fourteen names, fourteen strings.
    expect(ACTIONS.length, 'o tamanho do conjunto mudou — ver ADR-0085').toBe(14);
    for (const a of ACTIONS) expect(typeof a, `posição ${String(a)} deixou de ser um nome`).toBe('string');
  });

  it('🎯 [Zero] nenhuma estrutura de `input/` guarda um NÚMERO por acção', () => {
    // The literal shape of the arrival. `Record<string, boolean>` is today's `PadState`; swapping `boolean` for `number`
    // would be ADR-0112's option 2 settling in without any record.
    const NUMERO_POR_ACAO = /Record<\s*(?:Action|string)\s*,\s*number\s*>|Partial<\s*Record<\s*Action\s*,\s*number\s*>/;
    const presos = [];
    for (const p of ficheirosTs()) {
      codigoDe(p).forEach((ln, i) => {
        if (NUMERO_POR_ACAO.test(ln)) presos.push(`${p.split(/[\\/]/).pop()}:${i + 1}  ${ln.trim().slice(0, 60)}`);
      });
    }
    expect(
      presos,
      'magnitude por acção — é a opção 2 do ADR-0112, que foi MEDIDA E RECUSADA porque não desbloqueia '
      + 'desenhar e impõe uma segunda gramática a toda a acessibilidade. Se ela for mesmo precisa, o caminho '
      + 'é um registo que supersede o ADR-0112, não um campo.',
    ).toEqual([]);
  });

  it('⚠️ [Interface] e a varredura está VIVA: ela lê os módulos de entrada a sério', () => {
    // Without this a dead regex or a wrong path would leave the case above green for having nothing to examine — the kind
    // of false green this repository has caught more than once.
    const ficheiros = ficheirosTs();
    expect(ficheiros.length, 'a varredura não achou módulo nenhum em `input/`').toBeGreaterThan(5);
    expect(codigoDe(join(RAIZ_INPUT, 'state.ts')).join('\n'), 'o `PadState` de hoje é BOOLEANO')
      .toMatch(/Record<string,\s*boolean>/);
  });
});

// ========================= MUTATIONS CHECKED =========================
// Four, by script and with an occurrence count, all killed. And all four are ADR-0112's OPTION 2 arriving by different
// roads, which is the point: a refused option does not arrive by decision.
//
//   1. `PadState` storing `number` -> TWO fail (the check and the liveness case, which anchors on today's
//      `Record<string, boolean>`). It is the most direct shape of the arrival.
//   2. `held` returning `1`/`0` -> the `typeof` case fails. ⚠️ It is the most realistic of the four: in JavaScript `1` and
//      `0` pass every `if`, so magnitude disguised as compatible would break nothing — it would pass as a harmless
//      refactor and change the answer EVERY transport gets.
//   3. a position becoming a descriptor (`{ nome: 'up', analog: true }`) -> the [Interface] fails. The other door: not
//      changing the answer, changing the QUESTION.
//   4. the scan pointed at another folder -> TWO fail. An absence check that reads the wrong tree is green for the
//      worst reason possible.
