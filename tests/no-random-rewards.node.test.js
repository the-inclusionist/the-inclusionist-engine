// SPDX-License-Identifier: AGPL-3.0-or-later
// NO RANDOM ELEMENT IN ANY REWARD — the second half of the debt of issue #93 §5.
//
// ========================= THE ISSUE'S WORDS, AND WHAT THEY DEMAND =========================
// «Sem recompensa variável, lootbox ou caixa aleatória. **Nenhum elemento aleatório em recompensa alguma** —
// asseverado sobre o CÓDIGO DE RECOMPENSA, não prometido em documento.»
//
// The last clause is this file's specification: the issue refuses in advance the answer «está escrito no registo que
// não fazemos isso». What is asserted here is the code.
//
// ========================= WHY A SIEVE AND NOT A WORD SEARCH =========================
// The claim is an ABSENCE, and an absence is not proven by searching for «lootbox»: whoever wrote one would not call it
// that. What is proven is the INVENTORY — the whole engine is scanned for randomness, the list of users is frozen, and
// each entry says WHAT that module draws. A new module drawing forces someone to write that line by hand, and that is
// where «isto varia a recompensa» would have to be written instead of slipping in unnoticed.
//
// ⚠️ AND THE REASON IS NOT TASTE. A variable reward is the slot machine's mechanism, and ADR-0049 orders celebrations
// with a rule that excludes it: «nenhuma recompensa pode ser superior à percepção de crescimento pessoal». A draw puts
// surprise above the child's curve, which is exactly the forbidden inversion.
//
// ========================= WHAT THIS FILE DOES NOT REACH, SAID UP FRONT =========================
// ⚠️ It measures randomness WRITTEN in a module, not received by injection: `platform/audio-jingles` has no imports at
// all (the ctx brings everything), so a host could inject a primitive that draws. That is the host's and is not visible
// from here. What is visible, and what the issue asks for, is the code.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));

/** Every source of randomness a module can write. `crypto.*` is in because it is the obvious way out for whoever wants to
 *  get around `Math.random` without calling it a draw. */
const SORTEIA = /Math\.random\s*\(|crypto\.getRandomValues\s*\(|crypto\.randomUUID\s*\(/;

function ficheirosTs(dir = RAIZ) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...ficheirosTs(p));
    else if (nome.endsWith('.ts') && !nome.endsWith('.d.ts')) saida.push(p);
  }
  return saida;
}

/**
 * CODE lines (without line comments) that draw.
 *
 * ⚠️ THE COMMENT GUARD IS NOT WHAT PROTECTS TODAY — a SURVIVING mutation showed it. The comments that name `Math.random`
 * in this repository write it WITHOUT parentheses (`` `Math.random` ``), and the regex demands the `(`. The guard stays,
 * with a case of its own: the day someone writes a code example in a comment — the natural way to document what NOT to
 * do — is the day it becomes the only defence.
 */
export function contaSorteios(texto) {
  return texto.split(/\r?\n/)
    .filter((ln) => !/^\s*(\/\/|\*|\/\*)/.test(ln) && SORTEIA.test(ln)).length;
}

function sorteiosDe(p) {
  return contaSorteios(readFileSync(p, 'utf8'));
}

/**
 * The INVENTORY of randomness. Key = path from `app/js/`; value = WHAT that module draws.
 *
 * ⚠️ Each entry says what varies, because that is §5's question. The entries vary TIMBRE — the texture of a noise — and
 * none of them chooses what the child receives.
 */
const INVENTARIO = {
  'platform/audio-ambient.ts': 'timbre · ruído rosa do ambiente e a frequência do passa-baixo de cada rajada',
  'platform/audio.ts': 'timbre · o buffer de ruído branco que os efeitos usam como fonte',
};

/**
 * THE REWARD CODE — the modules the issue says to assert on.
 *
 * ⚠️ The list is hand-written on purpose, and the ORPHAN case just below keeps it from rotting: «que módulos são
 * recompensa» is judgement, not syntax, and a sieve that guessed it would be silently wrong.
 *
 * 📌 The §3 celebrations (mastery and overcoming) do not exist yet. When they do, they enter HERE — and the orphan case
 * is what keeps this list describing the repository instead of remembering it.
 */
const RECOMPENSA = [
  'platform/audio-jingles.ts',    // the SOUND rewards: victory, puzzle solved, fireworks
  'educational/adaptive-engine.ts', // the bands that decide going up and down a level
  'educational/segment-bar.ts',   // the bar that projects the verdict of ten questions
];

const sorteadores = ficheirosTs()
  .map((p) => [relative(RAIZ, p).split('\\').join('/'), sorteiosDe(p)])
  .filter(([, n]) => n > 0)
  .map(([m]) => m);

describe('issue #93 §5 · nenhum elemento aleatório em recompensa alguma', () => {
  it('⚠️ [Zero] NENHUM módulo de RECOMPENSA sorteia', () => {
    // The case the issue names. It passes because the three draw nothing — and the vacuum case below is what keeps it
    // from passing because the scan died.
    const culpados = RECOMPENSA.filter((m) => sorteadores.includes(m));
    expect(
      culpados,
      'código de recompensa a sortear. Recompensa variável é o mecanismo do caça-níqueis, e o ADR-0049 '
      + 'ordena as comemorações com a regra que a exclui: nenhuma recompensa acima da percepção de crescimento.',
    ).toEqual([]);
  });

  it('⚠️ [Zero] a camada de CURRÍCULO não sorteia — é ela que decide o que a criança vê a seguir', () => {
    // The narrowest sieve: `educational/` is where the adaptive engine and the bar live. A draw there does not vary a
    // prize — it varies the PROGRESSION, which is worse.
    expect(sorteadores.filter((m) => m.startsWith('educational/'))).toEqual([]);
  });

  it('⚠️ [Interface] nenhum sorteador NOVO entrou sem ser declarado', () => {
    const novos = sorteadores.filter((m) => !(m in INVENTARIO));
    expect(
      novos,
      'módulo novo a sortear. Acrescente-o ao INVENTARIO dizendo O QUE ele sorteia — e se a resposta for '
      + '«o que a criança recebe», o §5 da #93 diz que não pode.',
    ).toEqual([]);
  });

  it('[Interface] o inventário não tem ÓRFÃOS — entrada que nomeia quem já não sorteia', () => {
    const vivos = new Set(sorteadores);
    expect(Object.keys(INVENTARIO).filter((m) => !vivos.has(m))).toEqual([]);
  });

  it('[Interface] a lista de RECOMPENSA não tem órfãos — senão descreve um repositório que não existe', () => {
    const todos = new Set(ficheirosTs().map((p) => relative(RAIZ, p).split('\\').join('/')));
    expect(RECOMPENSA.filter((m) => !todos.has(m)), 'módulo de recompensa que já não existe').toEqual([]);
  });

  it('⚠️ [Interface] e o crivo CONTINUA VIVO: ele acha o sorteio que existe de verdade', () => {
    // Without this, the three cases above would pass because the regex or the path died — «um crivo que não acha nada
    // não prova ausência nenhuma, prova que o crivo morreu». And the proof is not a fixture: it is REAL code of this
    // repository, the white-noise buffer `platform/audio` builds.
    expect(sorteadores, 'a varredura não achou sorteio nenhum — a regex ou o caminho morreram')
      .toContain('platform/audio.ts');
    expect(sorteadores.length).toBeGreaterThan(1);
  });

  it('[Right] os módulos que NOMEIAM `Math.random` para dizer que não o usam não são acusados', () => {
    // ⚠️ `render/scene-parallax.ts`, a module that named `Math.random` to say it does not use it, has left the engine: this
    // assertion names a file that no longer exists and cannot fail. Accusing such modules would accuse precisely those
    // who obey the rule.
    expect(sorteadores).not.toContain('render/scene-parallax.ts');
    expect(sorteadores).not.toContain('render/camera.ts');
  });

  it('⚠️ [Right] e um EXEMPLO DE CÓDIGO dentro de um comentário também não conta', () => {
    // ⚠️ THIS CASE CAME FROM A SURVIVING MUTATION. Removing the comment guard failed nothing, because this repository's
    // comments write `` `Math.random` `` without parentheses and the regex demands the `(`. The case above passed, but not
    // for the reason it gave. The natural way to document a prohibition is to show the forbidden code — and that is when
    // the guard becomes the only defence.
    expect(contaSorteios('// nunca faça isto: const premio = Math.random();')).toBe(0);
    expect(contaSorteios(' * @example const x = crypto.randomUUID();')).toBe(0);
    // And the other side, which keeps the guard from becoming a hole: real code still counts.
    expect(contaSorteios('const premio = Math.random();')).toBe(1);
    expect(contaSorteios('const id = crypto.randomUUID(); // com comentário no FIM da linha')).toBe(1);
  });
});

// ========================= MUTATIONS CHECKED =========================
// Seven, each applied by script to the file with occurrence counts (=1 in all seven).
//   · ⚠️ THE REAL THREAT — putting `Math.random()` inside `educational/segment-bar` -> THREE fail, by independent paths:
//     the REWARD-module case, the CURRICULUM-draws-nothing case and the NEW-drawer case. A draw there does not vary a
//     prize: it varies the PROGRESSION, which is worse.
//   · putting `Math.random()` in `platform/audio-jingles` (the SOUND rewards) -> TWO fail.
//   · killing the `SORTEIA` regex -> TWO fail, and the one that matters is the VACUUM one: without it, the three absence
//     cases would pass for having nothing to examine. A sieve that finds nothing proves no absence — it proves the sieve
//     died. And the proof of life is NOT a fixture: it is the white-noise buffer `platform/audio` really builds.
//   · removing an INVENTORY entry -> TWO fail (the NEW-drawer case and the ORPHAN), the measure that the list must follow
//     the repository both ways.
//   · putting a module that does not exist on the REWARD list -> its orphan case fails. Without that case the list rots:
//     it would describe a repository that no longer exists, and look as if it covered more than it does.
//   · ⚠️ removing the COMMENT guard -> SURVIVED on the first round, and the survival was information: the comments that
//     named `Math.random` wrote it WITHOUT parentheses, and the regex demands the `(`. The existing case passed, but not
//     for the reason it gave. Once the CODE-EXAMPLE-in-a-comment case was written — the natural way to document a
//     prohibition — the same mutation started to fail.
//   · removing the regex's `crypto.*` branch -> the same case fails. It is there because `crypto.randomUUID` is the
//     obvious way out for whoever wants to draw without writing the word `random` next to `Math`.
