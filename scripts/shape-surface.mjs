#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// THE SHAPE PORTRAIT — the half the NAMES portrait cannot see.
//
// ⚠️ WHY THIS EXISTS. `snapshot-public-surface.mjs` keeps the names each module exports, and a name that disappears
// fails. It is BLIND to the biggest breaks, which keep every name as it was and change the SHAPE — the thing a consumer
// writes in their code:
//
//   · a member becoming REQUIRED (`GameDeclaration.holdsAtOnce()` did, and every game that builds a declaration stopped
//     compiling);
//   · a member leaving an interface that is still exported under the same name (`SonarPlayer.viz`);
//   · a union NARROWING (`KeyScheme` closed over fourteen positions), which the name gate does not see because the
//     name `KeyScheme` is still there.
//
// ⚠️ AND THE ASYMMETRY HERE IS NOT THE NAME GATE'S. There, adding is always compatible. Here it is not: adding a
// REQUIRED member to an interface breaks everyone who builds it. So adding an OPTIONAL one passes silently, and adding a
// REQUIRED one asks for a declaration, as a removal does.
//
// ⚠️ WHAT THIS FILE IS NOT: a TypeScript analyser. It counts braces over text without comments, and some shapes escape
// it (conditional generics, a brace inside a string literal in a type). That makes it a coarse sieve and not a proof —
// but what it catches, it catches before the major ships, and what escapes it today escaped the name gate entirely.
//
// Usage: runs through `snapshot-public-surface.mjs`, which writes both portraits at once.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const RETRATO_FORMA = 'docs/6-DevOps-SRE/public-shape.json';

/** Without comments. Done before counting braces, or a brace in a comment misaligns everything. */
function semComentarios(txt) {
  return txt.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** The body between the brace at `abre` and its match. `null` when it does not close. */
function corpo(txt, abre) {
  let d = 0;
  for (let i = abre; i < txt.length; i++) {
    if (txt[i] === '{') d++;
    else if (txt[i] === '}' && --d === 0) return txt.slice(abre + 1, i);
  }
  return null;
}

/** The level-1 members of an interface body, with `?` marking the optional ones. Sorted. */
export function membrosDe(corpoTxt) {
  const fora = [];
  let d = 0;
  for (const linha of corpoTxt.split('\n')) {
    if (d === 0) {
      // ⚠️ `[k: string]: X` is an index signature and not a member; it starts with `[` and is left out.
      const m = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(\?)?\s*[:(<]/.exec(linha);
      if (m) fora.push(m[1] + (m[2] ? '?' : ''));
    }
    for (const c of linha) { if (c === '{') d++; else if (c === '}') d--; }
    if (d < 0) d = 0;
  }
  return [...new Set(fora)].sort();
}

/**
 * The shape of ONE file: `{ 'interface Name': ['a', 'b?'], 'type Name': '<normalised right-hand side>' }`.
 *
 * Type aliases are kept by the TEXT of their right-hand side, with spaces collapsed, because most of them are a union
 * or a function signature and have no members to list. That form is what catches a union narrowing — the `KeyScheme`
 * case.
 */
export function formaDoTexto(fonte) {
  const txt = semComentarios(fonte);
  const fora = {};

  const reIface = /(?:^|\n)export\s+interface\s+([A-Za-z_$][\w$]*)[^{]*\{/g;
  for (let m; (m = reIface.exec(txt)) !== null;) {
    const c = corpo(txt, txt.indexOf('{', m.index + m[0].length - 1));
    if (c !== null) fora[`interface ${m[1]}`] = membrosDe(c);
  }

  const reAlias = /(?:^|\n)export\s+type\s+([A-Za-z_$][\w$]*)[^=]*=\s*([\s\S]*?);/g;
  for (let m; (m = reAlias.exec(txt)) !== null;) {
    fora[`type ${m[1]}`] = m[2].replace(/\s+/g, ' ').trim();
  }

  return fora;
}

function ficheiros(raiz, dir = raiz, fora = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) ficheiros(raiz, p, fora);
    else if (nome.endsWith('.ts')) fora.push(relative(raiz, p).split('\\').join('/'));
  }
  return fora;
}

/** The shape of the whole tree, by module. Modules with no exported type are left out. */
export function formaDe(raizAppJs) {
  const fora = {};
  for (const rel of ficheiros(raizAppJs).sort()) {
    const f = formaDoTexto(readFileSync(join(raizAppJs, rel), 'utf8'));
    if (Object.keys(f).length) fora[rel] = f;
  }
  return fora;
}

/**
 * What changed shape and BREAKS whoever consumes it.
 *
 * ⚠️ A type that disappeared entirely does NOT go in here: its name is already the name gate's case, and counting it in
 * both would make a list of six lines look like twelve. It is the same `continue` that gate has, for the same reason.
 */
export function quebrasDeForma(antes, agora) {
  const fora = [];
  for (const [modulo, tipos] of Object.entries(antes)) {
    const hoje = agora[modulo];
    if (!hoje) continue; // the whole module left — the name gate's case
    for (const [tipo, forma] of Object.entries(tipos)) {
      const nova = hoje[tipo];
      if (nova === undefined) continue; // the type left — likewise

      if (typeof forma === 'string' || typeof nova === 'string') {
        if (forma !== nova) fora.push(`${modulo}  ${tipo}  mudou de forma: «${forma}» → «${nova}»`);
        continue;
      }

      const antesNomes = new Map(forma.map((n) => [n.replace(/\?$/, ''), n.endsWith('?')]));
      const agoraNomes = new Map(nova.map((n) => [n.replace(/\?$/, ''), n.endsWith('?')]));

      for (const [n, opcional] of antesNomes) {
        if (!agoraNomes.has(n)) fora.push(`${modulo}  ${tipo}.${n}  SAIU`);
        else if (opcional && !agoraNomes.get(n)) fora.push(`${modulo}  ${tipo}.${n}  era opcional e passou a OBRIGATÓRIO`);
      }
      for (const [n, opcional] of agoraNomes) {
        // ⚠️ Adding an OPTIONAL member is compatible; adding a REQUIRED one breaks whoever builds the type — what
        // `holdsAtOnce` did to the games, without any name disappearing.
        if (!antesNomes.has(n) && !opcional) fora.push(`${modulo}  ${tipo}.${n}  ENTROU como obrigatório`);
      }
    }
  }
  return fora;
}
