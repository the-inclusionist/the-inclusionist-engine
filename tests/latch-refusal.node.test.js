// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/latch-refusal — clause 3 of ADR-0113, the PURE half.
//
// «É impossível desligá-la em modos que não tem como funcionar sem ela (voz e câmera)» — the Dev's sentence. This file
// asserts the two halves that sentence carries and that are easy to implement by half:
//
//   · the control does NOT VANISH — it is disabled, and stays on screen;
//   · the reason is SAID, and it is a FACT about the device, not a reprimand.
//
// 📌 It is the sibling of `tests/simulation-refusal.node.test.js`, on purpose: same shape, same place in the layer.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  latchRefusal, showsEvenWhenRequired, REFUSAL_KEY, NEED_LATCH,
} from '../app/js/ui/latch-refusal.js';
import { ONE_COMMAND_AT_A_TIME } from '../app/js/input/latch-scope.js';
import { TRANSPORT_NAMES } from '../app/js/input/transport-in-use.js';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

describe('latch-refusal · onde há escolha, não se diz nada', () => {
  // ⚠️ `null` AND NOT AN EMPTY SENTENCE: a notice that always shows stops being read, and the interface must tell
  // «não há motivo» from «há um motivo que ainda não sei escrever».
  it('[Zero] nos três aparelhos de hoje a recusa é `null`', () => {
    for (const t of ['teclado', 'gamepad', 'toque']) {
      expect(latchRefusal(t), `${t} passou a recusar uma escolha legítima`).toBe(null);
    }
  });

  it('[Right] nos quatro assistidos há recusa, com chave e transporte', () => {
    for (const t of ['olhos', 'rosto', 'gestos', 'fala']) {
      const r = latchRefusal(t);
      expect(r, `${t} deixou de recusar`).not.toBe(null);
      expect(r.transport).toBe(t);
      expect(r.key).toBe(REFUSAL_KEY[t]);
    }
  });
});

describe('latch-refusal · a lista vem da REGRA, e não de uma cópia', () => {
  // 🎯 THE CASE THAT PREVENTS THE SECOND TABLE. This repository has paid for the defect three times (`DomQuery`, the
  // reduced-motion labels, the storage keys): two lists of the same fact drift apart, one entry at a time. Here the
  // cost would be a device that requires the latch while its button still turns it off.
  it('🎯 [Interface] os transportes que exigem alternância são EXACTAMENTE os da regra', () => {
    expect([...NEED_LATCH].sort()).toEqual([...ONE_COMMAND_AT_A_TIME].sort());
    expect(NEED_LATCH, 'a lista foi copiada em vez de reexportada').toBe(ONE_COMMAND_AT_A_TIME);
  });

  // ⚠️ AND THE PAIR: every transport the rule requires HAS a sentence. Without this, a new device would enter the rule
  // and its button would be disabled WITH NO reason — worse than the defect this module fixes, because the child no
  // longer knows there is a reason.
  it('⚠️ [Interface] todo transporte exigente tem chave, e nenhuma chave sobra', () => {
    expect(Object.keys(REFUSAL_KEY).sort()).toEqual([...ONE_COMMAND_AT_A_TIME].sort());
  });

  it('[Vácuo] os sete transportes do catálogo estão cobertos: ou há escolha, ou há motivo', () => {
    for (const t of TRANSPORT_NAMES) {
      const r = latchRefusal(t);
      expect(r === null || typeof r.key === 'string', `${t} caiu entre as duas respostas`).toBe(true);
    }
  });
});

describe('latch-refusal · as frases existem nos três idiomas, e dizem um FACTO', () => {
  it('[Interface] as quatro chaves estão nos três dicionários', () => {
    for (const chave of Object.values(REFUSAL_KEY)) {
      for (const [nome, dic] of [['pt', pt], ['en', en], ['es', es]]) {
        expect(dic[chave], `${chave} falta em ${nome} — o botão ficaria desabilitado sem motivo`).toBeTruthy();
      }
    }
  });

  // 🔴 WHAT THE SENTENCE CANNOT BE. ADR-0076 already paid for this distinction once, and the mutation that caught it
  // swapped the sentence for a shorter, clearer, more useful one — «Desligue o alto contraste para ver a simulação» —
  // that failed all the same, because it reprimands a child for the setting they need. Here the equivalent would be
  // «não desligue isto». The check looks for a command IMPERATIVE addressed to the child.
  it('🔴 [Zero] nenhuma frase manda a criança fazer nada — é facto, não repreensão', () => {
    const imperativos = /\b(não desligue|nao desligue|desligue|ligue|deixe|pare de|don't|do not|turn off|turn on|no apagues|apaga|enciende)\b/i;
    for (const chave of Object.values(REFUSAL_KEY)) {
      for (const [nome, dic] of [['pt', pt], ['en', en], ['es', es]]) {
        expect(imperativos.test(dic[chave]), `${chave} em ${nome} repreende: «${dic[chave]}»`).toBe(false);
      }
    }
  });
});

describe('latch-refusal · o controle não some', () => {
  // ⚠️ A FUNCTION WITH ITS OWN NAME AND NOT A `!recusa` AT THE CALL SITE, because it answers another question:
  // `latchRefusal` says WHY it cannot; this one says the row STAYS ON SCREEN. Merging them would make «não há motivo»
  // look like «não desenhe a linha» — which is how a control vanishes from a screen without anyone deciding.
  it('[Interface] mostrar é sempre — sumir ensinaria que a coisa não existe', () => {
    expect(showsEvenWhenRequired()).toBe(true);
  });
});

// ===== MUTATIONS CHECKED (2026-09-08, by script, with occurrence counts) =====
// 1. `latchRefusal` always returning `null`         → the case of the four assisted transports fails
// 2. removing the `latchIsOptional` guard from `latchRefusal` → SURVIVED, and it is a MEASURED EQUIVALENCE with a named
//    mechanism: without it, `REFUSAL_KEY['teclado']` is `undefined` and `chave ? … : null` already returns `null`. The
//    two paths agree by construction — and the case «todo exigente tem chave, e nenhuma chave sobra» is what forces
//    them to agree. ⚠️ Recorded, and the guard STAYS: it is the authoritative rule, and the table is the sentence.
//    Deleting it would let a key added by mistake refuse a device where there is a choice, and nothing in this suite
//    would see the difference until the table and the rule drifted apart
// 3. `NEED_LATCH` being a copy (`new Set([...])`) → 🎯 the identity case fails, and it is what prevents the second
//    table — the defect this repository has paid for three times
// 4. removing `alt.exigida.gestos` from `REFUSAL_KEY` → the pair «todo exigente tem chave» fails, and the vacuum case
//    stays green: the absence degrades to «não recuso», which keeps the control alive instead of disabling it with no
//    reason
// 5. the `pt` sentence swapped for «Não desligue as teclas de alternância.» → 🔴 the imperative check fails
//    📌 it is the mutation that matters: the sentence gets SHORTER and MORE DIRECT, and still reprimands
