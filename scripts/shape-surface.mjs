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
//   · a member whose TYPE changes (`(a) => void` becoming `(a, b) => void`, `string` becoming `number`);
//   · a type parameter added or removed, or an `extends` clause that changes;
//   · a union NARROWING (`KeyScheme` closed over fourteen positions), which the name gate does not see because the
//     name `KeyScheme` is still there.
//
// ⚠️ AND THE ASYMMETRY HERE IS NOT THE NAME GATE'S. There, adding is always compatible. Here it is not: adding a
// REQUIRED member to an interface breaks everyone who builds it. So adding an OPTIONAL one passes silently, and adding a
// REQUIRED one asks for a declaration, as a removal does.
//
// ⚠️ WHAT THIS FILE IS NOT: a type checker. Both kinds of declaration are read by the TypeScript PARSER — an alias whole,
// an interface as its type parameters, its `extends` clause and each member's printed signature — so a brace inside a
// string literal or an object-literal member type no longer misaligns anything. But what is compared is the PRINTED
// SYNTAX, not the resolved type: renaming a parameter, or an alias a member refers to, reads as a change even when the
// resolved type is identical, and a change inside a type the member refers to by name is seen only at that type's own
// entry. That makes it
// a conservative sieve — it over-reports a rename rather than missing a break — and not a proof.
//
// Usage: runs through `snapshot-public-surface.mjs`, which writes both portraits at once.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

export const RETRATO_FORMA = 'docs/6-DevOps-SRE/public-shape.json';

/*
 * ⚠️ WHAT IS NORMALISED IS FORMATTING, AND ONLY IT: a node is PRINTED from its syntax tree, without comments, and the
 * printer's line breaks collapse to one space. So a line break, indentation, a comment, the leading `|` a formatter adds
 * when a union wraps, or `,` against `;` between the members of an object type is not a change of shape; a token is.
 * Aliases and interface members go through the same printer, so the two halves of the portrait normalise alike.
 */
const IMPRESSORA = ts.createPrinter({ removeComments: true });

function printed(node, sf) {
  return IMPRESSORA.printNode(ts.EmitHint.Unspecified, node, sf).replace(/\s+/g, ' ').trim();
}

const isExported = (st) => (ts.canHaveModifiers(st) ? ts.getModifiers(st) ?? [] : [])
  .some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

function parse(source) {
  return ts.createSourceFile('m.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/**
 * The shape of ONE file: `{ 'interface Name': { typeParameters?, extends?, members }, 'type Name': '<printed right-hand side>' }`.
 *
 * Type aliases are kept by the TEXT of their right-hand side, because most of them are a union or a function signature
 * and have no members to list. That form is what catches a union narrowing — the `KeyScheme` case.
 */
export function formaDoTexto(source) {
  const sf = parse(source);
  const out = {};
  for (const st of sf.statements) {
    if (!isExported(st)) continue;
    if (ts.isTypeAliasDeclaration(st)) out[`type ${st.name.text}`] = printed(st.type, sf);
    else if (ts.isInterfaceDeclaration(st)) {
      const key = `interface ${st.name.text}`;
      // Declaration merging: a second `export interface X` in the same file adds to the first, as it does for the compiler.
      out[key] = mergeInterface(out[key], interfaceShape(st, sf));
    }
  }
  return out;
}

/*
 * 🔴 AN INTERFACE IS READ BY THE PARSER, MEMBER BY MEMBER. It used to be read by a regex that took everything up to the
 * first `{` and then read one member per line, counting braces — and 📏 49 of the 420 exported interfaces had a wrong list
 * of names: several members on one line kept only the first (`Spot { readonly x; readonly y; readonly z? }` was `['x']`),
 * a `{` in a type-parameter constraint opened the body early (`CameraStartDeps<T extends { close(): void }, F>` was
 * `['close']`), the parameters of a signature wrapped over lines were read as members, and a construct signature became a
 * member called `new`. Worse, only the member NAMES were kept, so a member whose type changed, a type parameter added or
 * an `extends` that changed kept the recorded shape identical and this gate passed them green.
 *
 * ⚠️ THE KEY OF A MEMBER CARRIES ITS NAME AND ITS OPTIONALITY (`name` or `name?`), exactly as the old list did, so a
 * reader asking «is `x` optional?» reads the keys. The VALUE is the member's printed signature WITHOUT the `?`, so
 * optional → required is reported once, by the key, and not a second time as a type change. Signatures without a name
 * get a key of their own kind: `()` for call, `new()` for construct, `[K]` for an index signature over key type `K`.
 * Overloads of one name are joined in source order with `; `.
 */
function interfaceShape(decl, sf) {
  const shape = {};
  if (decl.typeParameters?.length) shape.typeParameters = decl.typeParameters.map((p) => printed(p, sf)).join(', ');
  const heritage = (decl.heritageClauses ?? []).flatMap((h) => h.types.map((t) => printed(t, sf)));
  if (heritage.length) shape.extends = heritage.join(', ');

  const byName = new Map();
  for (const m of decl.members) {
    const [name, optional, signature] = memberOf(m, sf);
    const seen = byName.get(name);
    if (seen) seen.signatures.push(signature);
    else byName.set(name, { optional, signatures: [signature] });
  }
  shape.members = {};
  for (const [name, { optional, signatures }] of [...byName].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    shape.members[name + (optional ? '?' : '')] = signatures.join('; ');
  }
  return shape;
}

function nameOf(name, sf) {
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return printed(name, sf); // a computed name, `[Symbol.iterator]`
}

/** `[bare name, optional, printed signature without the question token]` for one member of an interface body. */
function memberOf(m, sf) {
  const f = ts.factory;
  const strip = (s) => s.replace(/;$/, '');
  if (ts.isPropertySignature(m)) {
    const bare = f.updatePropertySignature(m, m.modifiers, m.name, undefined, m.type);
    return [nameOf(m.name, sf), Boolean(m.questionToken), strip(printed(bare, sf))];
  }
  if (ts.isMethodSignature(m)) {
    const bare = f.updateMethodSignature(m, m.modifiers, m.name, undefined, m.typeParameters, m.parameters, m.type);
    return [nameOf(m.name, sf), Boolean(m.questionToken), strip(printed(bare, sf))];
  }
  if (ts.isCallSignatureDeclaration(m)) return ['()', false, strip(printed(m, sf))];
  if (ts.isConstructSignatureDeclaration(m)) return ['new()', false, strip(printed(m, sf))];
  if (ts.isIndexSignatureDeclaration(m)) {
    return [`[${printed(m.parameters[0]?.type ?? m.parameters[0], sf)}]`, false, strip(printed(m, sf))];
  }
  if ((ts.isGetAccessorDeclaration(m) || ts.isSetAccessorDeclaration(m)) && m.name) {
    return [nameOf(m.name, sf), false, strip(printed(m, sf))];
  }
  // Any other kind the grammar may add: the whole member is its own key, so it can only leave or enter, never vanish.
  const whole = strip(printed(m, sf));
  return [whole, false, whole];
}

function mergeInterface(first, second) {
  if (!first) return second;
  const joined = (a, b) => [a, b].filter(Boolean).join(', ') || undefined;
  const merged = { ...first, members: { ...first.members } };
  const ext = joined(first.extends, second.extends);
  if (ext) merged.extends = ext;
  for (const [k, sig] of Object.entries(second.members)) {
    merged.members[k] = merged.members[k] === undefined ? sig : `${merged.members[k]}; ${sig}`;
  }
  return merged;
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
 * The member names of one interface entry, with `?` on the optional ones — the question most readers of the portrait ask
 * («is `setBlindMode` still optional?»). Reads both the current form and the older plain list.
 */
export function memberKeys(entry) {
  if (Array.isArray(entry)) return [...entry];
  return Object.keys(entry?.members ?? {});
}

/**
 * The same name under the OTHER declaration kind: `interface X` ↔ `type X`. The key of each entry carries the kind, and
 * this is what reads it.
 */
function otherKindKey(key) {
  const [kind, name] = key.split(' ');
  return `${kind === 'interface' ? 'type' : 'interface'} ${name}`;
}

/*
 * 📌 A PORTRAIT WRITTEN BEFORE THE PARSER READ INTERFACES keeps each one as a plain list of names (`['a', 'b?']`), and a
 * published tag's portrait is that form — `Breaking-Changes.md` compares a tag with `HEAD`. So a plain list is still read:
 * it has no signatures, no type parameters and no `extends`, and what it cannot say is simply not compared.
 */
function readInterface(entry) {
  const legacy = Array.isArray(entry);
  const pairs = legacy ? entry.map((k) => [k, undefined]) : Object.entries(entry.members ?? {});
  return {
    legacy,
    typeParameters: legacy ? undefined : entry.typeParameters ?? '',
    extends: legacy ? undefined : entry.extends ?? '',
    members: new Map(pairs.map(([k, sig]) => [k.replace(/\?$/, ''), { optional: k.endsWith('?'), signature: sig }])),
  };
}

// A name the old list could have held: the signature keys (`()`, `new()`, `[K]`) it never recorded.
const NAMED = /^[A-Za-z_$][\w$]*$/;

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
 *
 * ⚠️ ANY CHANGE TO A PUBLISHED MEMBER'S SIGNATURE, TYPE PARAMETERS OR `extends` COUNTS, on purpose. Whether a given
 * change is assignable in the direction a consumer uses it (they build the type, or the engine hands it to them) is a
 * question for a type checker, and this gate's job is only to force a written note — a note that says «nothing to do» is
 * cheap, a break nobody wrote down is not.
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

      const before = readInterface(forma);
      const now = readInterface(nova);
      const bothRecorded = !before.legacy && !now.legacy;
      if (bothRecorded && before.typeParameters !== now.typeParameters) {
        fora.push(`${modulo}  ${tipo}  type parameters changed: «${before.typeParameters}» → «${now.typeParameters}»`);
      }
      if (bothRecorded && before.extends !== now.extends) {
        fora.push(`${modulo}  ${tipo}  extends changed: «${before.extends}» → «${now.extends}»`);
      }

      for (const [n, was] of before.members) {
        const is = now.members.get(n);
        if (!is) fora.push(`${modulo}  ${tipo}.${n}  SAIU`);
        else if (was.optional && !is.optional) fora.push(`${modulo}  ${tipo}.${n}  era opcional e passou a OBRIGATÓRIO`);
        else if (was.signature !== undefined && is.signature !== undefined && was.signature !== is.signature) {
          fora.push(`${modulo}  ${tipo}.${n}  changed type: «${was.signature}» → «${is.signature}»`);
        }
      }
      for (const [n, is] of now.members) {
        // ⚠️ Adding an OPTIONAL member is compatible; adding a REQUIRED one breaks whoever builds the type — what
        // `holdsAtOnce` did to the games, without any name disappearing. A call, construct or index signature that
        // arrives is required by nature: an implementer must now satisfy it.
        if (before.members.has(n) || is.optional) continue;
        if (before.legacy && !NAMED.test(n)) continue; // the old list never recorded signatures; it cannot say they are new
        fora.push(`${modulo}  ${tipo}.${n}  ENTROU como obrigatório`);
      }
    }
  }
  return fora;
}
