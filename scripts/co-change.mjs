// SPDX-License-Identifier: AGPL-3.0-or-later
//
// CO-CHANGE — WHICH MODULES KEEP CHANGING TOGETHER, which is the closing criterion of ADR-0221 (step 7e).
//
// 🎯 WHY THIS IS THE CRITERION AND NOT A SCORE. The health ratchet measures size, branches, depth, coupling and reach, and
// ADR-0221 says plainly what it CANNOT measure: cohesion. LCOM and its family assume classes with fields and this tree is
// modules of functions, and a number that means nothing gets obeyed anyway. What stands in its place is this: files edited in
// the same commit are the honest evidence of what belongs together. An abstraction that worked makes the files it unified
// STOP changing together; one that only moved code leaves them exactly as they were.
//
// ⚠️ AND THE CRITERION IS FIXED BEFORE THE ANSWER EXISTS, which is the only way a measurement like this proves anything: each
// group below names the commit where its abstraction landed, and the script reports BEFORE and AFTER that commit. Choosing
// the window after seeing the numbers would be choosing the answer.
//
// 📌 A HIGH NUMBER IS NOT A VERDICT. The three dictionaries are here as the control: they were 100% together before and after,
// and that is what an IRREDUCIBLE spread looks like — pt, en and es are one decision written three times BY DESIGN (pillar 3
// of ADR-0010). A group that stays together may be a missing abstraction or may be that.
//
// Use: `node scripts/co-change.mjs` · `node scripts/co-change.mjs --group panels` · `--files a.ts,b.ts --since <rev>`

import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });

/**
 * The hypotheses of `docs/ARCHITECTURE.md` §3.4, as groups this script can answer.
 *
 * `landed` is the commit that introduced the abstraction meant to end the spread — the line the BEFORE/AFTER is drawn at.
 * A group with `landed: null` has no abstraction yet: its number is the baseline whoever builds one will be measured against.
 */
export const GROUPS = {
  transports: {
    what: 'the transports that should speak one virtual controller (ADR-0111 erratum, ADR-0223)',
    /*
     * 🔴 THE LINE MOVED ON 2026-09-22, and the reason is that the abstraction did. `de2e77a` is where
     * `input/virtual-controller` was BORN, and reading against it measured a door that four of six transports did
     * not use: the touch pad wrote keys, the gamepad raised edges, and the window listener delivered on its own.
     * 📏 What that line said before it moved, so nothing is lost: 20 of 55 commits before (36%), 2 of 7 after (29%),
     * and the script itself called the window too short.
     * The line is now where the door became SINGLE — the keyboard half, after which `deliver` is called from one
     * place. ⚠️ And the first readings after it will be pessimistic by construction: the three commits of the
     * unification touch several of these files at once, which is exactly what the abstraction exists to stop.
     */
    landed: '04b61db6', // one `deliver`, called from one place (ADR-0223 item 2)
    files: ['input/keydown.ts', 'input/gamepad.ts', 'input/touch-bindings.ts', 'input/touch.ts'],
  },
  panels: {
    what: 'the settings panels that should share one row builder (ADR-0129, issue #135)',
    landed: null, // four of nine use the kit; the adoption is not finished, so there is no line to draw yet
    files: ['ui/settings-audio.ts', 'ui/settings-mobility.ts', 'ui/settings-motion.ts', 'ui/settings-visual.ts',
      'ui/settings-controls.ts', 'ui/settings-typo.ts', 'ui/settings-caa.ts', 'ui/settings-empathy.ts'],
  },
  dictionaries: {
    what: 'THE CONTROL GROUP: one decision written in three languages, irreducible by design (ADR-0010 pillar 3)',
    landed: null,
    files: ['i18n/pt.ts', 'i18n/en.ts', 'i18n/es.ts'],
  },
  /*
   * 🔴 UM CORTE NÃO SE MEDE COMO UMA ADOPÇÃO, e escrever isto aqui é mais barato do que voltar a ler a tabela errado: num
   * grupo nascido de um CORTE, o «ANTES» é sempre 0% — os módulos novos não existiam, e um ficheiro que não existe não muda
   * com ninguém. A pergunta certa é outra, e é o `splitFrom`: o ficheiro que foi partido passou a mudar MENOS vezes?
   */
  pause: {
    what: 'the pause card after the cuts of step 7c: catalogue, markup and the module that wires them',
    landed: 'c7af7a4', // `core/pause-icon-catalogue` landed here, the first of the three cuts
    splitFrom: 'ui/pause-icons.ts',
    files: ['ui/pause-icons.ts', 'core/pause-icon-catalogue.ts', 'ui/pause-markup.ts'],
  },
  audio: {
    what: 'the hearing panel after its two cuts: choices, voice section and the wiring that is left',
    landed: '3039d1a7', // `ui/audio-choices` landed here
    splitFrom: 'ui/settings-audio.ts',
    files: ['ui/settings-audio.ts', 'ui/audio-choices.ts', 'ui/voice-settings.ts'],
  },
  root: {
    what: 'THE ROOT: it should change when the WIRING changes, and it changes with the dictionaries instead',
    landed: null,
    splitFrom: 'boot/create-game.ts',
    files: ['boot/create-game.ts', 'i18n/pt.ts', 'i18n/en.ts', 'i18n/es.ts'],
  },
};

/** Every commit as the set of `app/js` modules it touched, newest first. */
export function commitsWithModules(range = []) {
  const saida = git('log', ...range, '--name-only', '--pretty=format:%H');
  return saida.split('\n\n').map((bloco) => {
    const linhas = bloco.split('\n').filter(Boolean);
    return {
      sha: linhas[0],
      modules: linhas.slice(1)
        .filter((f) => f.startsWith('app/js/') && f.endsWith('.ts'))
        .map((f) => f.slice('app/js/'.length)),
    };
  }).filter((c) => c.sha);
}

/**
 * How often a group changes TOGETHER: of the commits that touch any of its files, how many touch more than one.
 *
 * ⚠️ «More than one» and not «all»: a group of eight is never all touched at once, and asking for that would answer «never»
 * for any group big enough to matter. What the question is about is whether ONE subject drags a SECOND file.
 */
export function togetherness(commits, files) {
  const set = new Set(files);
  let tocam = 0, juntos = 0;
  const pares = new Map();
  for (const c of commits) {
    const meus = c.modules.filter((m) => set.has(m));
    if (!meus.length) continue;
    tocam += 1;
    if (meus.length < 2) continue;
    juntos += 1;
    for (let i = 0; i < meus.length; i += 1) {
      for (let j = i + 1; j < meus.length; j += 1) {
        const chave = [meus[i], meus[j]].sort().join(' + ');
        pares.set(chave, (pares.get(chave) ?? 0) + 1);
      }
    }
  }
  return { tocam, juntos, fracao: tocam ? juntos / tocam : 0, pares };
}

/** The window `--last N` adds to every `git log` below; empty means the whole history. */
const JANELA = [];

const relatar = (nome, g) => {
  const antes = g.landed ? commitsWithModules([...JANELA, `${g.landed}~1`]) : [];
  const depois = g.landed ? commitsWithModules([...JANELA, `${g.landed}..HEAD`]) : commitsWithModules([...JANELA]);
  const linha = (rotulo, r) => `   ${rotulo.padEnd(7)} ${String(r.juntos).padStart(3)} de ${String(r.tocam).padStart(3)} commits `
    + `(${(r.fracao * 100).toFixed(0)}%)${r.tocam < 10 ? '  ⚠️ poucos commits para concluir' : ''}`;
  console.log(`\n${nome} — ${g.what}`);
  if (g.splitFrom) {
    // 📏 The share of commits the split file itself is in: a file that was cut should be dragged into fewer of them.
    const parte = (cs) => {
      if (!cs.length) return 'sem commits';
      const n = cs.filter((c) => c.modules.includes(g.splitFrom)).length;
      // ⚠️ O mesmo aviso da linha de baixo, e aqui ele importa mais: uma percentagem sobre uma dúzia de commits é ruído, e
      // uma percentagem sobre a história inteira dilui o que mudou esta semana. Nenhuma das duas responde sozinha.
      return `${n} de ${cs.length} commits (${(n / cs.length * 100).toFixed(0)}%)${cs.length < 30 ? ' ⚠️ janela curta' : ''}`;
    };
    if (g.landed) console.log(`   ${g.splitFrom}: ANTES ${parte(antes)} · DEPOIS ${parte(depois)}`);
    else console.log(`   ${g.splitFrom}: ${parte(depois)}`);
  }
  if (g.landed) {
    console.log(linha('ANTES', togetherness(antes, g.files)));
    console.log(linha('DEPOIS', togetherness(depois, g.files)));
    console.log(`   (a abstração aterrou em ${g.landed})`);
  } else {
    const r = togetherness(depois, g.files);
    console.log(linha('SEMPRE', r));
    console.log('   (sem abstração ainda: este número é a linha de base de quem a construir)');
    for (const [par, n] of [...r.pares].sort((a, b) => b[1] - a[1]).slice(0, 3)) console.log(`      ${String(n).padStart(3)}  ${par}`);
  }
};

if (process.argv[1] && process.argv[1].endsWith('co-change.mjs')) {
  const arg = (nome) => { const i = process.argv.indexOf(nome); return i > 0 ? process.argv[i + 1] : null; };
  const ficheiros = arg('--files');
  if (ficheiros) {
    const since = arg('--since');
    relatar('à mão', { what: 'os ficheiros pedidos', landed: since, files: ficheiros.split(',').map((f) => f.trim()) });
  } else {
    const so = arg('--group');
    const ultimos = arg('--last');
    // 📌 `--last N` é o que torna a pergunta respondível para um grupo sem abstração: «a raiz muda com os dicionários» é 10%
    // na história inteira e 40% nos últimos 300 commits, e a segunda é a que descreve o trabalho de hoje.
    if (ultimos) JANELA.push(`-${Number(ultimos)}`);
    for (const [nome, g] of Object.entries(GROUPS)) if (!so || so === nome) relatar(nome, g);
  }
  console.log('');
}
