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
// ⚠️ WHAT THIS FILE IS NOT: a type checker. Type ALIASES are read by the TypeScript parser, whole; INTERFACES are still
// read by counting braces over text without comments, and some shapes escape that (a brace inside a string literal in a
// type). That makes it a coarse sieve and not a proof — but what it catches, it catches before the major ships, and what
// escapes it today escaped the name gate entirely.
//
// Usage: runs through `snapshot-public-surface.mjs`, which writes both portraits at once.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

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
 * Type aliases are kept by the TEXT of their right-hand side, printed without formatting, because most of them are a
 * union or a function signature and have no members to list. That form is what catches a union narrowing — the
 * `KeyScheme` case.
 */
export function formaDoTexto(fonte) {
  const txt = semComentarios(fonte);
  const fora = {};

  const reIface = /(?:^|\n)export\s+interface\s+([A-Za-z_$][\w$]*)[^{]*\{/g;
  for (let m; (m = reIface.exec(txt)) !== null;) {
    const c = corpo(txt, txt.indexOf('{', m.index + m[0].length - 1));
    if (c !== null) fora[`interface ${m[1]}`] = membrosDe(c);
  }

  for (const [nome, texto] of aliasesExportados(fonte)) fora[`type ${nome}`] = texto;

  return fora;
}

/*
 * 🔴 AN ALIAS IS READ BY THE PARSER, TO ITS LAST TOKEN. It used to be read by a regex up to the first `;`, and a union of
 * object types has one inside its first member: `type FooterScrollPlan = | { readonly mode: 'glide'; … } | { … }` was
 * recorded as `| { readonly mode: 'glide'`, and a change anywhere after that semicolon kept the recorded shape identical —
 * this gate passed it green.
 *
 * ⚠️ WHAT IS NORMALISED IS FORMATTING, AND ONLY IT: the type is PRINTED from its syntax tree, without comments, and the
 * printer's line breaks collapse to one space. So a line break, indentation, a comment, the leading `|` a formatter adds
 * when a union wraps, or `,` against `;` between the members of an object type is not a change of shape; a token is.
 */
const IMPRESSORA = ts.createPrinter({ removeComments: true });

function aliasesExportados(fonte) {
  const sf = ts.createSourceFile('m.ts', fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const fora = [];
  for (const st of sf.statements) {
    if (!ts.isTypeAliasDeclaration(st)) continue;
    if (!(st.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    const texto = IMPRESSORA.printNode(ts.EmitHint.Unspecified, st.type, sf);
    fora.push([st.name.text, texto.replace(/\s+/g, ' ').trim()]);
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
 * The same name under the OTHER declaration kind: `interface X` ↔ `type X`. The key of each entry carries the kind, and
 * this is what reads it.
 */
function otherKindKey(key) {
  const [kind, name] = key.split(' ');
  return `${kind === 'interface' ? 'type' : 'interface'} ${name}`;
}

/**
 * What changed shape and BREAKS whoever consumes it.
 *
 * ⚠️ A type that disappeared entirely does NOT go in here: its name is already the name gate's case, and counting it in
 * both would make a list of six lines look like twelve. It is the same `continue` that gate has, for the same reason.
 *
 * 🔴 BUT A TYPE THAT CHANGED KIND DID NOT DISAPPEAR, and the name gate cannot see it: `X` is still exported. An `interface`
 * merges with a consumer's own declaration of the same name (module augmentation) and a `type` alias does not; an alias of
 * an object literal is assignable to an index signature and an interface is not. Either direction can break a consumer
 * with every member unchanged, so the kind is part of the shape.
 */
export function quebrasDeForma(antes, agora) {
  const fora = [];
  for (const [modulo, tipos] of Object.entries(antes)) {
    const hoje = agora[modulo];
    if (!hoje) continue; // the whole module left — the name gate's case
    for (const [tipo, forma] of Object.entries(tipos)) {
      const nova = hoje[tipo];
      if (nova === undefined) {
        const other = otherKindKey(tipo);
        if (hoje[other] !== undefined) fora.push(`${modulo}  ${tipo}  changed kind to «${other}»`);
        continue; // otherwise the type left — likewise
      }

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
