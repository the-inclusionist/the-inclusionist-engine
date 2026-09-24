// SPDX-License-Identifier: AGPL-3.0-or-later
// NO DECLINATION MAY BE DEAD — the inventory of `Declinios` fields nobody reads.
//
// ========================= THE DISTINCTION THIS PROJECT CLAIMS TO MAKE =========================
// `create-game` states it: declining is a choice; not declaring is an omission. It is the heart of ADR-0106 §2 and has
// paid for four fixes — the a11y bar (`44a7ba3`), the pause actor, the pause card and the neural voice (`7212479`). But
// it is only true while **declining changes something**. A field the type declares and no code reads makes declaring
// and not declaring give exactly the same result — and a case asserting only that the field crosses the root intact
// would make an inert field look alive.
//
// ========================= WHY AN INVENTORY AND NOT A PROHIBITION =========================
// The obvious way out — «acuse em `problems` quem não declina» — was MEASURED AND REFUSED: the consumer has no way to
// fix a field the engine does not read. A line in `problems` its reader cannot resolve is the same as a gate with no
// exit: it gets switched off.
//
// So what is asserted is the INVENTORY — every dead field must carry a hand-written reason — and it SHRINKS: the day a
// field gains a reader, its entry leaves, and the exit case forces it out. The inventory is empty today (ADR-0231).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_JS = fileURLToPath(new URL('../app/js/', import.meta.url));
const CREATE_GAME = 'boot/create-game.ts';

/**
 * THE `Declinios` FIELDS THE ENGINE DOES NOT READ, and why each one stays in the type.
 *
 * ⚠️ THE LIST MUST SHRINK. A new entry without a hand-written reason is a declination that declines nothing, and a
 * consumer who thinks they decided.
 */
// Empty since ADR-0231: `noPadAssistant`, the last entry, left the type instead of gaining a reader — the
// controller-mapping wizard is accessibility the engine offers every game, and that is not declinable (ADR-0122).
const SEM_LEITOR = {};

const fonte = (rel) => readFileSync(join(RAIZ_JS, rel), 'utf8');

/** The `interface Declinios { … }` block, which is where the fields are DECLARED and not read. */
function blocoDosDeclinios(src) {
  const i = src.indexOf('export interface Declinios {');
  if (i === -1) return null;
  const fim = src.indexOf('\n}', i);
  return fim === -1 ? null : src.slice(i, fim + 2);
}

/** The field names, from the block itself — never a hand copy beside a union. */
function camposDeclarados(bloco) {
  return [...bloco.matchAll(/readonly\s+(\w+)\??\s*:/g)].map((m) => m[1]);
}

/** Every `.ts` of the engine except the example consumer — the quiz DECLARES, it does not read. */
function ficheirosDaEngine(dir = RAIZ_JS, prefixo = '') {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    if (prefixo === '' && nome === 'consumer-quiz') continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) { saida.push(...ficheirosDaEngine(caminho, `${prefixo}${nome}/`)); continue; }
    if (nome.endsWith('.ts') && !nome.endsWith('.d.ts')) saida.push(`${prefixo}${nome}`);
  }
  return saida;
}

const SRC_CG = fonte(CREATE_GAME);
const BLOCO = blocoDosDeclinios(SRC_CG);
const CAMPOS = BLOCO ? camposDeclarados(BLOCO) : [];

/**
 * How many times the engine MENTIONS the field outside the declaration.
 *
 * ⚠️ THE COUNT IS GENEROUS ON PURPOSE — the name anywhere counts, including inside a comment or a destructuring. A tight
 * check here would accuse a LIVE field read by `const { semX } = declines`, and a false accusation gets the gate
 * switched off before it catches the true one. Failing towards «vivo» is the right direction for this error.
 */
function leitores(campo) {
  let n = 0;
  for (const f of ficheirosDaEngine()) {
    const src = f === CREATE_GAME ? SRC_CG.split(BLOCO).join('') : fonte(f);
    n += src.split(campo).length - 1;
  }
  return n;
}

describe('nenhuma declinação está morta · o inventário encolhe', () => {
  it('[Vácuo] o bloco `Declinios` foi mesmo encontrado, e tem campos', () => {
    expect(BLOCO, 'a interface mudou de nome ou de forma e o crivo ficou cego').not.toBeNull();
    // No `semMenuDePausa` (ADR-0120): the reason it existed — the engine having nothing to serve a game without its own
    // pause — was built by ADR-0106. 📌 The inventory shrank by a DELIVERY, not a clean-up, the only way of shrinking
    // this file cares about.
    // Two since ADR-0231, which took `noPadAssistant` out of the type: the wizard is not declinable.
    expect(CAMPOS.length).toBeGreaterThanOrEqual(2);
    expect(CAMPOS, 'a pausa voltou a ser declinável sem registo').not.toContain('semMenuDePausa');
    expect(CAMPOS, 'the controller-mapping wizard became declinable again without a record (ADR-0231)')
      .not.toContain('noPadAssistant');
  });

  it('[Feliz] todo campo sem leitor está declarado, com a razão escrita à mão', () => {
    const mortos = CAMPOS.filter((c) => leitores(c) === 0);
    const novos = mortos.filter((c) => !(c in SEM_LEITOR));
    expect(novos, `declinação que não declina nada e ninguém declarou: ${novos.join(', ')}`).toEqual([]);
  });

  // ⚠️ THE EXIT. Without it the list becomes a monument: a field already wired would go on saying it is dead, and the
  // next person would read the inventory as history instead of state.
  it('[Fronteira] campo da lista que ganhou leitor sai daqui', () => {
    const ressuscitados = Object.keys(SEM_LEITOR).filter((c) => leitores(c) > 0);
    expect(ressuscitados, `já é lido pela engine; apague a entrada: ${ressuscitados.join(', ')}`).toEqual([]);
  });

  // 📌 THE PAIR THAT PROVES THE DETECTOR MEASURES SOMETHING: the declared fields ARE read, and the check must see them
  // alive. Without this case, a detector always returning zero would pass [Feliz] while the list covered it — and would
  // go on accusing everything silently.
  it('[Fronteira] os que a engine lê aparecem como vivos', () => {
    // `semMenuDePausa` left the contract entirely (ADR-0120), so it is not asserted here — a check that demands a
    // non-existent field fails forever.
    for (const vivo of ['noPauseActor', 'noNeuralVoice']) {
      expect(CAMPOS, `${vivo} deixou de ser um declínio`).toContain(vivo);
      expect(leitores(vivo), `${vivo} passou a ser letra morta`).toBeGreaterThan(0);
    }
  });
});

// ===== MUTATIONS CHECKED (2026-09-08, by script, with occurrence counts) =====
// 1. removing `semAssistenteDePad` from `SEM_LEITOR` → [Feliz] fails (the dead field goes silent again)
// 2. adding `semMenuDePausa` to `SEM_LEITOR`         → the exit [Fronteira] fails (the list would lie)
// 3. `leitores()` always returning 0                 → [Feliz] **and** the living-fields [Fronteira] fail
//    📌 and the second half is the one that matters: [Feliz] catches it only because the other fields start to look
//    dead. If the list ever covered them all, it would stay green and the check would be blind — what would catch it
//    then is the PAIR, which is why it exists instead of trusting the rule.
// 4. `leitores()` always returning 1                 → the exit [Fronteira] fails
// 5. `blocoDosDeclinios` returning `null`            → the [Vácuo], the exit and the pair fail
//
// 📌 Two of the five failed cases that had not been predicted. What was measured stays.
//
// ===== MUTATIONS CHECKED (2026-09-24, ADR-0231: the inventory is empty) =====
// 6. put `readonly noPadAssistant?: boolean;` back into `Declinios` → [Vácuo] fails on the absence, and [Feliz]
//    fails too, because the field would again be a declination nobody reads
// 7. `leitores()` returning always 0 → the pair of the living fields fails (mutation 3 still holds with an empty list)
