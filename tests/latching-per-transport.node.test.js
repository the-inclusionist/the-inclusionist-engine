// SPDX-License-Identifier: AGPL-3.0-or-later
// THE LATCH MIGRATES TO THE PER-TRANSPORT KEY — the inventory ADR-0113 owes, in both directions.
//
// ========================= WHAT THE RECORD DECIDED =========================
// ADR-0113 decided the walking latch is a CAPS-LOCK stored **with the controller's mapping**: the value belongs to the
// TRANSPORT, and switching controllers switches the value as it switches the key map.
//
// The migration is in progress, and this file states where it stands:
//
//   · THE PER-PLAYER KEY — `KEYS.toggleMoveP(i)`, the old model — has **exactly ONE writer** in the whole engine:
//     `ui/settings-mobility.setToggleMove`. The inventory below lists who still touches it.
//   · THE NEW MODEL's participants are counted by the floor further down.
//
// ========================= WHY TWO HALVES, AND NOT A PROHIBITION =========================
// ⚠️ A prohibition («ninguém escreve a chave antiga») would be born RED and stay red until the wiring existed, which is
// not a gate but a reminder jamming the suite. And an inventory alone only looks back: it would say the debt did not
// grow without ever saying whether the work started.
//
// So there are two opposite, complementary assertions — the CEILING that only goes down (who touches the old model) and
// the FLOOR that only goes up (how many use the new one). It is the shape `tests/fontes-empacotadas.node.test.js` uses
// for the Playwrite faces, for the same reason: telling the truth about the state instead of hiding it behind a tick.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { latchNow } from '../app/js/input/transport-in-use.js';
import { latchOf } from '../app/js/input/latch-scope.js';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));

/**
 * THE ENGINE FILES THAT STILL TOUCH THE PER-PLAYER KEY, and why each one still does.
 *
 * ⚠️ THIS LIST CAN ONLY SHRINK. A new entry is the model ADR-0113 retired gaining a new consumer — and gaining it
 * silently, which is how it dug in the first time (ADR-0106 step 1b gave it an engine default the same day ADR-0109
 * retired it).
 */
const AINDA_NA_CHAVE_ANTIGA = {
  'platform/storage.ts':
    'declara `toggleMoveP(i)` e `toggleMoveLegacy`. ⚠️ O legado NÃO sai com a migração: o `latch-scope` lê-o ' +
    'de propósito, para que nenhuma criança perca o ajuste que já tem. O que sai é `toggleMoveP`',
  'ui/settings-mobility.ts':
    'o ÚNICO escritor — `setToggleMove` grava `toggleMoveKey(i)`, que é a chave por JOGADOR. É este ponto ' +
    'que passa a escrever `chaveDaAlternancia(base, jogador, transporte)`, e é por isso que o inventário ' +
    'tem um alvo e não uma intenção',
};

/**
 * ⚠️ THE FLOOR: the files that use the new model.
 *
 * 🎯 `input/latch-store`, the adapter between the rule and storage; `ui/settings-mobility`, the panel, which writes
 * through `writeLatch` (the right form — a detector counting only `latchKey(` callers would measure who improvises
 * instead of who migrated); and `input/latch-sync`, the first READER, which resolves the key for the transport in use
 * and puts the answer on the player (issue #127). 📌 The floor counts both halves because the key only carries real
 * behaviour when someone READS it.
 *
 * It CANNOT GO BACK: going back would mean the wiring was undone without the record changing.
 */
const CHAMADORES_DA_CHAVE_NOVA_HOJE = 3;

function ficheiros(dir = RAIZ, pref = '') {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { out.push(...ficheiros(p, `${pref}${n}/`)); continue; }
    if (n.endsWith('.ts') && !n.endsWith('.d.ts')) out.push(`${pref}${n}`);
  }
  return out;
}

// ⚠️ `(^|[^:])` in the line comment — a `//` preceded by `:` is a URL's scheme. Getting exactly this wrong made the
// sibling gate (no-hand-written-cdn) scan return zero.
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n\r]*/g, '$1');

const fonte = (f) => semComentarios(readFileSync(join(RAIZ, f), 'utf8'));

/** Files that name the PER-PLAYER key in code. Generous on purpose: mentioning counts. */
function tocamNaChaveAntiga() {
  return ficheiros().filter((f) => /toggleMoveP|toggleMoveKey/.test(fonte(f)));
}

/**
 * Files that TAKE PART in the new model — the rule's definition does not count.
 *
 * ⚠️ It counts the new model's three entry points, not just `latchKey(`: counting only who calls the key's constructor
 * would miss `ui/settings-mobility`, which writes through `writeLatch` — the RIGHT form — and so measure the wrong
 * architecture, who improvises instead of who migrated. A file using any of them is on the new side of the migration,
 * which is what the floor claims to measure.
 */
function chamamAChaveNova() {
  const entradas = /latchKey\s*\(|writeLatch\s*\(|storedLatch\s*\(/;
  return ficheiros().filter((f) => f !== 'input/latch-scope.ts' && entradas.test(fonte(f)));
}

describe('a alternância migra para a chave por transporte · o tecto que só desce', () => {
  it('[Vácuo] a varredura lê a árvore e ainda acha o módulo da regra', () => {
    expect(ficheiros().length).toBeGreaterThan(100);
    expect(ficheiros()).toContain('input/latch-scope.ts');
    expect(fonte('input/latch-scope.ts')).toContain('export function latchKey');
  });

  it('[Feliz] nenhum ficheiro NOVO passou a tocar na chave por jogador', () => {
    const novos = tocamNaChaveAntiga().filter((f) => !(f in AINDA_NA_CHAVE_ANTIGA));
    expect(novos, `passou a usar o modelo que o ADR-0113 retirou: ${novos.join(', ')}`).toEqual([]);
  });

  // ⚠️ THE EXIT. Without it the inventory becomes a monument: a file already migrated would stay listed as debt.
  it('[Fronteira] ficheiro da lista que já largou a chave antiga sai daqui', () => {
    const migrados = Object.keys(AINDA_NA_CHAVE_ANTIGA).filter((f) => !tocamNaChaveAntiga().includes(f));
    expect(migrados, `já não toca na chave antiga; apague a entrada: ${migrados.join(', ')}`).toEqual([]);
  });

  // 📌 THE PAIR that keeps the detector from approving out of blindness: the writer the list NAMES must really be there.
  it('[Fronteira] o único escritor continua a ser o que o inventário nomeia', () => {
    const motor = fonte('ui/settings-mobility.ts');
    expect(motor, 'o escritor da chave por jogador mudou de forma — releia o inventário')
      .toMatch(/setBool\(\s*toggleMoveKey\(/);
  });
});

describe('a alternância migra para a chave por transporte · o piso que só sobe', () => {
  // 🎯 THIS IS THE HALF THAT SAYS WHETHER THE WORK STARTED. An inventory alone only looks back: it would forever approve a
  // migration that never began. Had this number been zero, the record would be decided and not delivered — and the file
  // would say so aloud instead of letting green suggest otherwise.
  it('🎯 [Zero] o piso dos chamadores da chave nova é EXACTAMENTE o declarado', () => {
    const chamadores = chamamAChaveNova();
    expect(chamadores.length, `o piso subiu para ${chamadores.length} (${chamadores.join(', ')}) — actualize `
      + 'CHAMADORES_DA_CHAVE_NOVA_HOJE e apague as entradas do inventário que já migraram')
      .toBe(CHAMADORES_DA_CHAVE_NOVA_HOJE);
  });

  it('[Interface] a regra que a fiação vai consumir continua exportada e completa', () => {
    const src = fonte('input/latch-scope.ts');
    for (const nome of ['latchKey', 'legacyLatchKey', 'latchOf',
      'latchAlwaysOn', 'latchIsOptional']) {
      expect(src, `${nome} deixou de ser exportado e a fiação ficaria sem alvo`).toContain(`export function ${nome}`);
    }
  });
});

describe('a alternância migra para a chave por transporte · o modelo superado não pode ser escolhido por engano', () => {
  // 🔴 THE CODE HAS TWO FUNCTIONS THAT ANSWER «há alternância?», AND ONE OF THEM IS THE ONE ADR-0113 RETIRED.
  // `transport-in-use.latchNow` decides ONLY BY THE DEVICE (ADR-0109's rule); `latch-scope.latchOf` reads what the child
  // stored (ADR-0113's rule), and `input/latch-store` is its consumer. `latchNow` has no consumer — but whoever wires
  // more of the chain picks one, and picking the first implements the retired model with nothing saying so.
  //
  // ⚠️ THIS BLOCK MAKES THE SUPERSESSION EXECUTABLE. A `@deprecated` is prose; prose does not fail.

  it('🔴 [Zero] a criança do TECLADO com alternância gravada: as duas funções DIVERGEM, e o registo diz qual vale', () => {
    const estado = { inUse: 'teclado', assistedOn: false };
    const gravado = { fromTransport: true, fromLegacy: null, byDefault: false };

    // ADR-0109's model: the keyboard has no latch of its own, so NO.
    expect(latchNow(estado), 'o modelo superado deixou de dizer o que dizia').toBe(false);
    // ADR-0113's model: she stored it, so YES. It is the control the literal reading took away from her.
    expect(latchOf(estado.inUse, gravado), 'a regra do ADR-0113 deixou de ler o valor gravado').toBe(true);
  });

  it('⚠️ [Fronteira] e no TOQUE também divergem — a cláusula do toque caiu com a mesma frase', () => {
    const estado = { inUse: 'toque', assistedOn: false };
    const desligadoPelaCrianca = { fromTransport: false, fromLegacy: null, byDefault: false };

    expect(latchNow(estado), 'o toque deixou de estar em COM_ALTERNANCIA_PROPRIA').toBe(true);
    expect(latchOf(estado.inUse, desligadoPelaCrianca), 'o toque deixou de ser escolha').toBe(false);
  });

  // 📌 AND WHERE THE TWO AGREE, which keeps this block from reading as a blanket accusation: on the four assisted
  // transports the latch is mandatory in BOTH models, for different reasons and with the same result.
  it('[Feliz] nos quatro assistidos as duas concordam — obrigatória, e ninguém a desliga', () => {
    for (const t of ['olhos', 'rosto', 'gestos', 'fala']) {
      expect(latchOf(t, { fromTransport: false, fromLegacy: false, byDefault: false }), `${t} pôde ser desligado`)
        .toBe(true);
      expect(latchNow({ inUse: t, assistedOn: true }), `${t} habilitado deixou de forçar`).toBe(true);
    }
  });

  // ⚠️ THE GUARD THAT KEEPS THIS HONEST: while the superseded function has no consumer, the divergence is documentation.
  // The day it gains one, it is a DECISION — and this case forces it to be taken instead of happening.
  it('🎯 [Zero] a função superada continua SEM CONSUMIDOR na engine', () => {
    const usam = ficheiros()
      .filter((f) => f !== 'input/transport-in-use.ts')
      .filter((f) => /latchNow\s*\(/.test(fonte(f)));
    expect(usam, `alguém passou a chamar o modelo que o ADR-0113 retirou: ${usam.join(', ')}`).toEqual([]);
  });
});

// ===== MUTATIONS CHECKED (2026-09-08, by script, with occurrence counts) =====
// 1. removing `ui/settings-mobility.ts` from the inventory → [Feliz] **and** the exit fail (the renamed key stops
//    appearing in the findings). Only [Feliz] was predicted; what was measured stays, as in the sibling gates
// 2. adding an already-migrated file to the inventory     → the exit [Fronteira] fails
// 3. `tocamNaChaveAntiga` returning `[]`                  → the exit [Fronteira] fails; [Feliz] stays GREEN, which is why
//    the exit exists — a blind sieve approves everything the rule alone sees
// 4. `chamamAChaveNova` returning one file                → 🎯 the FLOOR's [Zero] fails, the mutation that gives the file
//    its meaning: the day the wiring arrives, THIS case forces the inventory to be updated instead of left lying
// 5. `semComentarios` without the `(^|[^:])`              → none fails: MEASURED EQUIVALENCE, because none of these files
//    has a URL on a line with `toggleMoveP`. Recorded, not deleted — this exact defect made the sibling scan return
//    zero, and it does not bite here by luck
//
// ----- and those of the DIVERGENCE block, one per case with no overlap at all -----
// 6. `latchOf` no longer reading `doTransporte`   → the KEYBOARD child's case fails
// 7. `latchOf` no longer forcing the assisted ones → the agreement-on-the-four case fails
// 8. `input/keydown` calling `latchNow`           → 🎯 the consumer [Zero] fails, the guard that turns «documentação da
//    divergência» into «decisão obrigatória» the day someone wires it
// 9. the superseded model no longer answering for TOUCH → the touch-divergence case fails
//    📌 The four hit DIFFERENT cases and none overlaps — the measure that this block's four cases assert four things,
//    not the same thing written four times.
