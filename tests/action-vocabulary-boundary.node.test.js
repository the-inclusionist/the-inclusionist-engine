// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BOUNDARY OF THE INPUT VOCABULARY, as a test. Node project: it only reads files.
//
// ========================= WHAT IT SEPARATES =========================
// The Dev drew the cut on 2026-09-06: *«deveríamos separar o que é do jogo, as ações com nome, do que é da
// engine, o nome abstrato e como é implementado nos diversos controles que programarmos.»*
//
//   ENGINE  →  the fourteen POSITIONS (`core/actions.ts`) and how each transport reaches them.
//   GAME    →  the WORDS: jump, run, swap, special — in an `ActionPreset`.
//
// ========================= WHY THIS IS A CEILING AND NOT A BAN =========================
// A test that simply failed would be deleted or loosened in the first hurry — the lesson
// `engine-boundary.node.test.js` already wrote and this file copies on purpose. A list that only shrinks does three
// things: it keeps the suite green today, it makes the debt COUNTABLE, and it makes any NEW coupling fail the same
// minute.
//
// ⚠️ AND THE DETECTOR MUST BE PRECISE OR THE LIST IS BORN LYING. `run` appears in `toggleRun`, `runState`, `running` and
// `runEdge`, and NONE of them is an action's name. The word is looked for as an IDENTIFIER, which in this code has two
// forms: a quoted literal (`A('jump')`) and an object key (`jump: b(0)`).
//
// ⚠️ COMMENTS ARE LEFT OUT OF THE COUNT, and that is a decision: an explanation that cites `jump` couples nothing, and
// counting it would create the incentive to DELETE THE EXPLANATION to lower the number.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'app', 'js');
// ⚠️ The list comes from `tsconfig.pkg.json`, which decides what is published — not a hand-written list: a hand copy
// named an `audio` layer that never existed (the audio modules live in `platform/`), and `existsSync` below returned an
// empty list without a word. `educational` and `i18n` stay out because they are DATA: one imports nothing (its own gate
// in `engine-boundary`) and the other is the dictionaries.
const CAMADAS_ENGINE = (() => {
  const cfg = JSON.parse(readFileSync(join(process.cwd(), 'tsconfig.pkg.json'), 'utf8')
    .split(String.fromCharCode(13)).join(''));
  return (cfg.include ?? [])
    .map((p) => p.split('\\').join('/'))
    .filter((p) => p.startsWith('app/js/'))
    .map((p) => p.slice('app/js/'.length))
    .filter((c) => c && !c.includes('/') && c !== 'educational' && c !== 'i18n')
    .sort();
})();

const CR = String.fromCharCode(13);
const COMENTARIO_LINHA = new RegExp('//[^\\n' + CR + ']*', 'g');
const COMENTARIO_BLOCO = /\/\*[\s\S]*?\*\//g;
const LITERAL = /['"](jump|run|swap|especial)['"]/g;
const CHAVE = /(?<![\w.])(jump|run|swap|especial)\s*:/g;

function modulosDe(camada) {
  const dir = join(RAIZ, camada);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => `${camada}/${f}`);
}
const MODULOS = CAMADAS_ENGINE.flatMap(modulosDe);

function ocorrencias(modulo) {
  const bruto = readFileSync(join(RAIZ, modulo), 'utf8').split(CR).join('');
  const semComentarios = bruto.replace(COMENTARIO_BLOCO, '').replace(COMENTARIO_LINHA, '');
  const a = semComentarios.match(LITERAL) || [];
  const b = semComentarios.match(CHAVE) || [];
  return a.length + b.length;
}

/**
 * ⚠️ THE NUMBERS COME FROM THIS FILE, not from an outside scan. It is the lesson the i18n gate learned the hard way: its
 * first table was filled by a separate script and counted FEWER in several modules. Whoever lowers a number lowers it by
 * what THIS test reports.
 */
const DIVIDA = {
  /* --- ⚠️ THE TRANSPORTS ARE NOT HERE: every point where they said a game's word was migrated to `action1`..`action4`
   *     (issue #103). No dead line stays: the [Zero] case below fails whoever has a ceiling and zero debt. --- */

  /* --- ⚠️ THE QUARANTINE, of a different nature from everything else in this table. --- */
  'input/voice-map.ts': 4,
  // 🔴 THESE FOUR ARE NOT POSITIONS — they are WORDS A CHILD SAYS. «jump», «swap», «drop» and «special» are what the Dev
  // chose in English for buttons 2, 4 and 3 (ADR-0204 erratum), and they happen to be the same strings as the positions'
  // OLD names, which is all this check can see. The boundary it guards stays whole: the module MAPS word → `Action` of
  // `core/actions`, and none of these strings crosses into a cartridge or into a sentence anyone reads.
  // ⚠️ Taking them out of the vocabulary to please the check would decide, on the test's behalf, that an English child
  // cannot say «jump» — exactly the inversion this file exists to prevent.
  'input/vocabulary-migration.ts': 4,
  // This module MUST say `jump`: translating the old name is its job. When the table was born inside
  // `input/keyboard.ts`, this gate failed — and it was right. The way out was NOT raising the keyboard's ceiling, the
  // loosening this file exists to prevent; it was quarantining the whole coupling in a module whose name says it is
  // historical, with its own ceiling and a death date.
  // ⚠️ IT DELETES ITSELF when no saved data in the old format remains — which cannot be known from the code side, because
  // the data is in each child's browser. While there is some, deleting it deletes the remapping of whoever made it.

  /* --- WHAT REMAINS. 📌 A check by FORM does not tell the two senses the same word has in this repository apart —
     `jump` as a tile's flag and `jump` as an action's name: the migration's renamer once swapped one for the other and
     the test broke with `Cannot read properties of undefined`. --- */
};

// ========================= THE MIRROR OF THIS BOUNDARY =========================
// The block above counts the engine saying the GAME's words. This one counts the opposite: the engine's ABSTRACT name
// reaching a PERSON, which ADR-0074 calls a defect in so many words — «o nome que a criança lê e ouve é sempre a palavra
// do jogo, nunca `action1`».
//
// ⚠️ AND IT IS NOT HYPOTHETICAL: `ui/settings-controls` once fell back to the abstract id and the screen reader said
// `Essa tecla já é de action2` — one press away, with the engine's DEFAULT scheme, and said precisely to the child who
// navigates by ear. Fixed in `7742ac0`; this case guards the OTHER path.
//
// 📌 WHY THE DICTIONARIES AND NOT THE CODE. The `Action → word` conversions (`labellerFrom`, `shortLabellerFrom`,
// `gameWordFor`, and the game's `gameActions`) all return `null` for a position with no word, and each has its own case.
// What the type does NOT reach is someone writing `action1` inside a sentence by hand — and the dictionary is the only
// place in this repository where text for people is written that way.
const POSICOES_ABSTRATAS = /\b(action[1-8]|leftShoulder|rightShoulder|leftTrigger|rightTrigger)\b/;

describe('ADR-0074 · nenhum nome abstrato de posição chega a uma pessoa', () => {
  const DICIONARIOS = ['pt', 'en', 'es']
    .map((l) => join(RAIZ, 'i18n', `${l}.ts`))
    .filter((p) => existsSync(p));

  /** The sentences: each key's value, without the comments that cite names to explain. */
  const frasesDe = (p) => readFileSync(p, 'utf8')
    .replace(COMENTARIO_BLOCO, '')
    .replace(COMENTARIO_LINHA, '')
    .split(/\r?\n/)
    .map((ln) => /:\s*(['"])((?:\\.|(?!\1).)*)\1/.exec(ln))
    .filter(Boolean)
    .map((m) => m[2]);

  it('⚠️ [Zero] nenhuma frase de dicionário nomeia uma posição abstrata', () => {
    const presos = [];
    for (const p of DICIONARIOS) {
      for (const f of frasesDe(p)) {
        if (POSICOES_ABSTRATAS.test(f)) presos.push(`${p.split(/[\\/]/).pop()}: ${f.slice(0, 70)}`);
      }
    }
    expect(
      presos,
      'nome abstrato de posição dentro de uma frase que uma criança lê ou ouve. A palavra é do JOGO '
      + '(`acoesDoJogo`/`labellerFrom`); quando ele não a nomeia, a frase diz o que INTERESSA sem o id '
      + 'interno — ver `sr.ctrl.keyTakenHereUnnamed`.',
    ).toEqual([]);
  });

  it('⚠️ [Interface] e a varredura está VIVA: ela lê frases a sério nos três idiomas', () => {
    // Without this the case above would pass for having nothing to examine — and a dead regex in an absence check is the
    // kind of false green this repository has caught more than once.
    expect(DICIONARIOS.length, 'os três dicionários têm de existir').toBe(3);
    for (const p of DICIONARIOS) {
      expect(frasesDe(p).length, `${p} não devolveu frase nenhuma`).toBeGreaterThan(100);
    }
    // and the detector recognises the defect when it exists, instead of never matching anything
    expect(POSICOES_ABSTRATAS.test('Essa tecla já é de action2. Escolha outra.')).toBe(true);
    expect(POSICOES_ABSTRATAS.test('Essa tecla já está em uso neste controle.')).toBe(false);
  });

  // ===================== MUTATIONS CHECKED (this block) =====================
  //   · adding to the pt dictionary a sentence with `action2` -> fails the [Zero]. It is the defect fixed in `7742ac0`
  //     coming back through the other door: not a code fallback, but someone writing the id inside a sentence by hand —
  //     the only path the TYPE does not reach.
  //   · replacing `action[1-8]` with `zzzz[1-8]` (dead detector) -> fails the [Interface], and ONLY it. It is the measure
  //     that the liveness case pays for itself: without it, a blind check would pass for finding nothing.
  //   · `frasesDe` returning zero -> fails the [Interface] by the floor of 100 sentences. An ABSENCE check that reads
  //     nothing is a false green, and this file already carries that lesson in its header.
});

describe('a engine não fala as palavras do jogo (o corte do Dev, 2026-09-06)', () => {
  it('[Right] NENHUM módulo NOVO passa a nomear uma ação do jogo', () => {
    const novos = MODULOS.filter((m) => !(m in DIVIDA))
      .flatMap((m) => (ocorrencias(m) > 0 ? [`${m}:${ocorrencias(m)}`] : []));
    expect(novos, 'módulo de engine nomeando ação do jogo — use `core/actions` e o preset do jogo').toEqual([]);
  });

  it('[Boundary] a dívida de cada módulo é um TETO: só encolhe', () => {
    const cresceram = {};
    for (const [m, teto] of Object.entries(DIVIDA)) {
      const n = ocorrencias(m);
      if (n > teto) cresceram[m] = `${teto} → ${n}`;
    }
    expect(cresceram, 'módulo ganhou acoplamento novo ao vocabulário do jogo').toEqual({});
  });

  it('[Zero] a lista não guarda módulo que já se limpou', () => {
    // Without this, a dead entry would say there is debt where there is none, and the next person would look for
    // something to fix without finding it.
    const limpos = Object.keys(DIVIDA).filter((m) => ocorrencias(m) === 0);
    expect(limpos, 'módulo com teto e sem dívida — apague a linha').toEqual([]);
  });

  it('⚠️ o total A PAGAR desce, e a quarentena não conta nele', () => {
    // ⚠️ THIS ASSERTION WAS ONCE WRONG, and the error is worth more written than silently fixed: it added
    // `input/vocabulary-migration.ts` to the total, so creating the migration module made the number RISE and the gate
    // failed a change that was right.
    //
    // The quarantine is not debt the migration pays — it IS the migration. Debt is what the transports must stop saying;
    // the translator must say it, and disappears by another path (when there is no old data left), not by someone
    // fixing it.
    const APAGA_SE_SOZINHO = ['input/vocabulary-migration.ts'];
    const aPagar = Object.keys(DIVIDA)
      .filter((m) => !APAGA_SE_SOZINHO.includes(m))
      .reduce((s, m) => s + ocorrencias(m), 0);
    expect(aPagar).toBeGreaterThan(0);
    expect(aPagar).toBeLessThanOrEqual(132);
  });

  it('os dois módulos NOVOS do vocabulário estão limpos, e é isso que prova que o corte é possível', () => {
    expect(ocorrencias('core/actions.ts')).toBe(0);
    expect(ocorrencias('input/default-bindings.ts')).toBe(0);
  });
});
