// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GATE OF THE CUT BY LIFETIME (ADR-0038, step 4 of the plan's Phase B).
//
// ========================= WHY THIS IS A GATE, NOT A TEST =========================
// ADR-0038 cut state by LIFETIME and deliberately chose a MECHANICAL criterion, not a definition:
//
//     persisted under a shared `incl_*` key = PAGE · under `gameKey()` = GAME · not persisted = ROUND
//
// A mechanical criterion exists so it can become a machine. While it lives only in the record's text, the next
// `export let` enters `core/state` without anything asking which lifetime it has — which is how values of every
// lifetime once ended up in the same file.
//
// The assertion: EVERY setter of `core/state` PERSISTS. That is what makes that module the PAGE's: a value that does not
// survive closing the game has no business there. A new `export let` without persistence fails here. (The other half,
// that no round field persists, left with its subject — see the note at the end.)
//
// ========================= WHERE THE FAKE GOES IN =========================
// BELOW `platform/storage`, at the browser API, not in its place. It is the same choice as `tests/state.node.test.js`,
// for the same reason: the real storage is exception-proof (it swallows everything in `file://` and private mode), so
// replacing it would measure the fake. With a fake `localStorage` underneath, what is measured is that the setter ASKS
// to persist, with the real persistence module in the path.
//
// As MUTAÇÕES CONFERIDAS estão no fim do arquivo.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as state from '../app/js/core/state.js';

/**
 * The `core/state` setters that do NOT persist, each with its reason. The list is short on purpose: it is the cut's
 * visible debt, and each line here is something that is still to leave.
 */
const SEM_PERSISTIR: Record<string, string> = {
  // (No `setPhaseValue`: the phase is the `core/scenes` stack, so no ROUND lives in `core/state`.)
  // `initVizMode` is NOT a setter: it is the boot load, and it does not persist ON PURPOSE — the default comes from
  // `prefers-contrast`, and storing it would stop following the system preference (see the comment there).
  initVizMode: 'boot: o padrão de mídia deve seguir o sistema a cada abertura',
};

/**
 * TWO values per setter, and the pair is not excess — it fixes a vacuity the mutation caught.
 *
 * Almost every setter here starts with `if (valorAtual === novo) return;`. `core/state` is a module, loaded ONCE per
 * test process: the second case calling `setWheelchairValue(true)` finds the value already `true`, leaves by the guard
 * and writes NOTHING. The case would pass for having nothing to fail.
 *
 * Called with both values, at least one call crosses the guard, whatever state the module is in — and the order of the
 * cases stops mattering.
 */
const ARGUMENTOS: Record<string, readonly [unknown, unknown]> = {
  setVizModeValue: ['sim-deuter', 'normal'], setBlindModeValue: [true, false],
  setLetterCaseValue: ['lower', 'upper'], setCaptionsOnValue: [false, true],
  setCbSafeValue: [true, false], setOwnerColorsValue: [false, true],
  setOutlineFgValue: [2, 0], setOutlineBgValue: [2, 0], setCaneBlockDivValue: [4, 2],
  setWheelchairValue: [true, false], setOneButtonValue: [true, false], setGameSpeedValue: [0.5, 1], setNoGripStrengthValue: [true, false], setCameraControlValue: ['eyes', 'off'], setCaptionPpmValue: [175, 125],
  setSpeechPpmValue: [404, 254], setInputCooldownValue: [500, 0],
  setMenuIndexOnValue: [false, true], setSwitchScanValue: [true, false], setVoiceControlValue: [true, false],
};

let localAntigo: unknown;
let escritas: string[] = [];

beforeEach(() => {
  localAntigo = (globalThis as { localStorage?: unknown }).localStorage;
  const mapa = new Map<string, string>();
  escritas = [];
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (mapa.has(k) ? mapa.get(k)! : null),
    setItem: (k: string, v: string) => { escritas.push(k); mapa.set(k, String(v)); },
    removeItem: (k: string) => { mapa.delete(k); },
  };
});
afterEach(() => {
  if (localAntigo === undefined) delete (globalThis as { localStorage?: unknown }).localStorage;
  else (globalThis as { localStorage?: unknown }).localStorage = localAntigo;
});

/** Every setter `core/state` exports, DISCOVERED — not a hand-written list. */
function settersDoModulo(): string[] {
  const m = state as unknown as Record<string, unknown>;
  return Object.keys(state).filter((k) => /^(set|init)/.test(k) && typeof m[k] === 'function');
}

/** Calls the setter with BOTH values. See the `ARGUMENTOS` note: with one, the equality guard makes the case depend on
 *  order — and an order-dependent case is a case that one day passes for nothing. */
function chamar(nome: string): void {
  const f = (state as unknown as Record<string, (v: unknown) => void>)[nome];
  for (const v of ARGUMENTOS[nome]) f(v);
}

describe('ADR-0038 · PÁGINA — o que mora em core/state sobrevive a fechar o jogo', () => {
  it('a descoberta é MECÂNICA: a lista de setters sai do módulo, não de um array daqui', () => {
    // Without this the gate would measure only what someone remembered to list — and the forgotten binding is exactly
    // what it exists to catch.
    const achados = settersDoModulo();
    expect(achados.length).toBeGreaterThanOrEqual(11);
    expect(achados).toContain('setBlindModeValue');
    expect(achados).toContain('setOneButtonValue');
  });

  it('[Right] TODO setter persiste — um binding novo sem persistência reprova aqui', () => {
    const semGravar: string[] = [];
    for (const nome of settersDoModulo()) {
      if (nome in SEM_PERSISTIR) continue;
      escritas = [];
      expect(ARGUMENTOS[nome], 'setter novo sem par de valores em ARGUMENTOS: ' + nome).toBeDefined();
      chamar(nome);
      if (!escritas.length) semGravar.push(nome);
    }
    expect(semGravar, 'PÁGINA sem persistência: ' + semGravar.join(', ')).toEqual([]);
  });

  it('[Right] e persiste em chave COMPARTILHADA, nunca no escopo do jogo', () => {
    // The distinction is accessibility, not tidiness: prefixing by game would make a blind child reconfigure blind mode,
    // cane and voice in every game. `tests/storage-scopes` guards the key TABLE; this case guards the PATH — what the
    // setter actually writes when it runs.
    const foraDeEscopo: string[] = [];
    for (const nome of settersDoModulo()) {
      if (nome in SEM_PERSISTIR) continue;
      escritas = [];
      chamar(nome);
      for (const k of escritas) if (!/^incl_/.test(k)) foraDeEscopo.push(k);
    }
    expect(foraDeEscopo, 'PÁGINA em chave de JOGO: ' + foraDeEscopo.join(', ')).toEqual([]);
  });

  it('[Interface] as exceções são NOMEADAS, com motivo — a lista é a dívida visível do corte', () => {
    for (const [nome, motivo] of Object.entries(SEM_PERSISTIR)) {
      expect(settersDoModulo(), 'exceção obsoleta: ' + nome).toContain(nome);
      expect(motivo.length).toBeGreaterThan(20);
    }
  });
});

/*
 * 🔴 THE SECOND HALF OF THIS GATE LEFT WITH ITS SUBJECT (ADR-0228). It asserted that NO field of `core/run-state`
 * persists — the half that prevents the reverse path, a match state gaining a `store.set()` «só para não perder ao
 * recarregar» and becoming, without discussion, a child's preference.
 *
 * ⚠️ `core/run-state` moved to `game-platformer` with the tile-world stack, and a claim about a module this repository
 * no longer has is a claim about nothing. It has to be rewritten THERE, and until it is, ADR-0038's rule is guarded on
 * one side only. 📌 This stays written here because the remaining half looks like the whole rule, and that is how
 * coverage shrinks without anything turning red.
 */
// ========================= MUTATIONS CHECKED =========================
// Each was applied, the case was seen RED with the annotated message, and the mutation was undone:
//
//   · removing the `store.setBool` from `setCaptionsOnValue` (core/state)
//       → the page-without-persistence message, naming setCaptionsOnValue
//   · making `setGrassDensity` write `incl_grass` (core/run-state — the half that has since left, see above)
//       → "RODADA persistiu: incl_grass"
//   · changing `setWheelchairValue`'s key to `store.KEYS.cenario`, which is GAME-scoped
//       → the page-in-a-game-key message, naming incl.inclusionist.cenario
//
// The THIRD was the one worth it: in this file's first version it passed GREEN, because the case was empty — the
// `if (valorAtual === novo) return;` guard made the second case calling the setter write nothing. That is what brought
// the pair of values in `ARGUMENTOS`. A gate that is not mutated is a gate taken on faith.
