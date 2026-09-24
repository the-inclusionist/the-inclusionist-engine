// SPDX-License-Identifier: AGPL-3.0-or-later
// NO ABSTRACT NAME REACHES A PERSON — the fourth gate ADR-0111 owes, and ADR-0074's sharpest rule: «a palavra que a
// CRIANÇA lê e ouve — no ecrã de remapeamento, na bolha de toque, no anúncio — é sempre a palavra do JOGO, nunca
// `action1`. Um nome abstrato que chega a uma pessoa é um defeito.»
//
// ⚠️ IT HAS BEEN BROKEN TWICE, NEITHER TIME WITH A GENERAL GATE: `7742ac0` caught the screen reader saying
// «Essa tecla já é de action2» on the remapping screen, and a sweep of the neighbouring module caught
// «Botão 0 (baixo): action3.» in the touch bubble. Both fixes brought cases for THEIR screen — this file is the half no
// screen gives.
//
// ========================= THE REACH IS DECLARED, AND IT IS SMALLER THAN THE RULE =========================
// 📏 Of the fourteen positions, this check covers EIGHT — the verbs. The other six are `up`, `down`, `left`, `right`,
// `start` and `select`, which are WORDS OF A LANGUAGE: an English dictionary says «start» quite rightly, and a detector
// that flagged them would lie on every other line. This project has paid for exactly that mistake — the i18n gate
// flagged the English word «as» for being on the pt-BR function-word list — and the way out was tightening the
// detector, never loosening the rule.
// 📌 The eight verbs have no such problem: `action1`..`action4` and the four camelCase `*Shoulder`/`*Trigger` occur in no
// prose of the three languages.
//
// ⚠️ AND WHAT THIS FILE DOES NOT REACH, said so it does not look covered: the sentence COMPOSED at run time —
// `t('...', { acao: umValorQualquer })` — is invisible to a text check. That half is only caught by driving the screen,
// which is why the two fixes above brought behaviour cases in `tests/settings-controls.browser.test.js` and
// `tests/touch.browser.test.js`. This file closes the STATIC door; those close the dynamic one, screen by screen.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERBS, ACTIONS } from '../app/js/core/actions.js';

const RAIZ_JS = fileURLToPath(new URL('../app/js/', import.meta.url));
const RAIZ_I18N = join(RAIZ_JS, 'i18n');

/** ⚠️ The list comes from `core/actions.VERBS` and is NOT copied by hand: a copy beside a union is the defect `RM_KEYS`
 *  already cost this repository, and a new verb (ADR-0085 added four) would slip through silently. */
const ABSTRATOS = VERBS;

/** A dictionary's texts, without the keys — what a person reads is the VALUE. */
function valoresDe(idioma) {
  const src = readFileSync(join(RAIZ_I18N, `${idioma}.ts`), 'utf8');
  const sem = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n\r]*/g, '');
  // `'key': 'value',` — only the right-hand side.
  return [...sem.matchAll(/^\s*'[^']+':\s*'((?:[^'\\]|\\.)*)'/gm)].map((m) => m[1]);
}

const IDIOMAS = readdirSync(RAIZ_I18N)
  .filter((f) => /^(pt|en|es)\.ts$/.test(f))
  .map((f) => f.slice(0, -3));

/** Every `.ts` of the engine, for the attributes check. */
function modulos(dir = RAIZ_JS, prefixo = '') {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) { saida.push(...modulos(caminho, `${prefixo}${nome}/`)); continue; }
    if (nome.endsWith('.ts') && !nome.endsWith('.d.ts')) saida.push(`${prefixo}${nome}`);
  }
  return saida;
}

describe('nenhum nome abstrato chega a uma pessoa · os dicionários', () => {
  it('[Vácuo] a varredura lê mesmo os três dicionários', () => {
    expect(IDIOMAS.sort()).toEqual(['en', 'es', 'pt']);
    for (const idioma of IDIOMAS) expect(valoresDe(idioma).length).toBeGreaterThan(100);
  });

  it('[Vácuo] a lista de verbos vem de `core/actions` e tem os oito', () => {
    expect(ABSTRATOS).toHaveLength(8);
    expect(ABSTRATOS).toContain('action1');
    expect(ABSTRATOS).toContain('rightTrigger');
    // 📌 And the six out of reach are still positions — the reach is the detector's choice, not a claim that they
    // stopped being abstract names.
    expect(ACTIONS.length - ABSTRATOS.length).toBe(6);
  });

  for (const idioma of IDIOMAS) {
    it(`[Feliz] nenhum texto de \`${idioma}\` contém um nome abstrato`, () => {
      const maus = [];
      for (const v of valoresDe(idioma)) {
        for (const a of ABSTRATOS) if (v.includes(a)) maus.push(`${a} em «${v}»`);
      }
      expect(maus, `um id interno chegaria a uma pessoa em ${idioma}: ${maus.join(' · ')}`).toEqual([]);
    });
  }
});

describe('nenhum nome abstrato chega a uma pessoa · os atributos escritos à mão', () => {
  // 📌 `aria-label`, `title`, `placeholder` and `alt` are read aloud or shown. `data-act="action1"` and `value="${acao}"`
  // do NOT count: they are machinery, and the `input/touch` comment explains why one is safe and the other is not.
  const ATRIBUTOS = /(?:aria-label|title|placeholder|alt)\s*=\s*["']([^"'`]*)["']/g;

  it('[Feliz] nenhum atributo visível ou falado traz um nome abstrato', () => {
    const maus = [];
    for (const m of modulos()) {
      const src = readFileSync(join(RAIZ_JS, m), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n\r]*/g, '');
      for (const achado of src.matchAll(ATRIBUTOS)) {
        for (const a of ABSTRATOS) if (achado[1].includes(a)) maus.push(`${m}: ${achado[0]}`);
      }
    }
    expect(maus, `um id interno num atributo que uma pessoa lê: ${maus.join(' · ')}`).toEqual([]);
  });
});

// ===== MUTATIONS CHECKED (2026-09-08, applied by script with occurrence counts) =====
// 1. planting `'sr.debug.pos': 'A posição é action2.'` in `app/js/i18n/pt.ts` → pt's [Feliz] fails, and ONLY it
// 2. planting the same in `en.ts`                                            → en's [Feliz] fails
// 3. planting `aria-label="leftTrigger"` in a `ui/` module                   → the attributes' [Feliz] fails
// 4. `ABSTRATOS = VERBS` → a hand list of seven (without `rightTrigger`)      → the list's [Vácuo] fails
// 5. `valoresDe` returning `[]`                                              → the dictionaries' [Vácuo] fails
//    🎯 it is the mutation that matters: a blind check approves everything, and [Feliz] would stay green forever
