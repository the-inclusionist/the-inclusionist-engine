// SPDX-License-Identifier: AGPL-3.0-or-later
// NENHUM NOME ABSTRATO CHEGA A UMA PESSOA — o quarto gate que o ADR-0111 deve, e a regra mais afiada do
// ADR-0074: «a palavra que a CRIANÇA lê e ouve — no ecrã de remapeamento, na bolha de toque, no anúncio — é
// sempre a palavra do JOGO, nunca `action1`. Um nome abstrato que chega a uma pessoa é um defeito.»
//
// ⚠️ ELA JÁ FOI QUEBRADA DUAS VEZES, E NENHUMA DAS DUAS TINHA GATE GERAL. O `7742ac0` apanhou o leitor de tela
// a dizer «Essa tecla já é de action2» no ecrã de remapeamento; a varredura ao módulo ao lado apanhou
// «Botão 0 (baixo): action3.» na bolha de toque. Os dois consertos trouxeram casos DA SUA TELA — este ficheiro
// é a metade que nenhuma tela dá.
//
// ========================= O ALCANCE É DECLARADO, E É MENOR DO QUE A REGRA =========================
// 📏 Das catorze posições, este crivo cobre OITO — os verbos. As outras seis são `up`, `down`, `left`,
// `right`, `start` e `select`, que são PALAVRAS DE LÍNGUA: um dicionário inglês diz «start» com toda a razão,
// e um detector que as marcasse mentiria em cada segunda linha. Este projeto já pagou exactamente esse erro —
// o gate de i18n acusou a palavra inglesa «as» por ela estar na lista de palavras funcionais do pt-BR — e a
// saída foi apertar o detector, nunca afrouxar a regra.
// 📌 Os oito verbos não têm esse problema: `action1`..`action4` e os quatro `*Shoulder`/`*Trigger` em
// camelCase não ocorrem em prosa nenhuma dos três idiomas.
//
// ⚠️ E O QUE ESTE FICHEIRO NÃO ALCANÇA, dito para não parecer coberto: a frase COMPOSTA em tempo de execução
// — `t('...', { acao: umValorQualquer })` — não é visível a um crivo de texto. Essa metade só se apanha
// conduzindo a tela, e é por isso que os dois consertos acima trouxeram casos de comportamento em
// `tests/settings-controls.browser.test.js` e `tests/touch.browser.test.js`. Este ficheiro fecha a porta
// ESTÁTICA; aqueles fecham a dinâmica, tela a tela.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERBS, ACTIONS } from '../app/js/core/actions.js';

const RAIZ_JS = fileURLToPath(new URL('../app/js/', import.meta.url));
const RAIZ_I18N = join(RAIZ_JS, 'i18n');

/** ⚠️ A lista sai de `core/actions.VERBS` e NÃO é copiada à mão: uma cópia ao lado de uma união é o defeito
 *  que o `RM_KEYS` já custou a este repositório, e um verbo novo (o ADR-0085 já acrescentou quatro) passaria
 *  a escapar em silêncio. */
const ABSTRATOS = VERBS;

/** Os textos de um dicionário, sem as chaves — o que uma pessoa lê é o VALOR. */
function valoresDe(idioma) {
  const src = readFileSync(join(RAIZ_I18N, `${idioma}.ts`), 'utf8');
  const sem = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n\r]*/g, '');
  // `'chave': 'valor',` — só o lado direito.
  return [...sem.matchAll(/^\s*'[^']+':\s*'((?:[^'\\]|\\.)*)'/gm)].map((m) => m[1]);
}

const IDIOMAS = readdirSync(RAIZ_I18N)
  .filter((f) => /^(pt|en|es)\.ts$/.test(f))
  .map((f) => f.slice(0, -3));

/** Todo `.ts` da engine, para o crivo dos atributos. */
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
    // 📌 E as seis fora do alcance continuam a ser posições — o alcance é uma escolha do detector, não uma
    // afirmação de que elas deixaram de ser nomes abstratos.
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
  // 📌 `aria-label`, `title`, `placeholder` e `alt` são lidos em voz alta ou mostrados. `data-act="action1"` e
  // `value="${acao}"` NÃO entram: são maquinaria, e o comentário do `input/touch` já explica por que um é
  // seguro e o outro não.
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

// ===== MUTAÇÕES CONFERIDAS (2026-09-08, aplicadas por script com contagem de ocorrências) =====
// 1. plantar `'sr.debug.pos': 'A posição é action2.'` em `app/js/i18n/pt.ts`  → [Feliz] do pt reprova, e SÓ ele
// 2. plantar o mesmo em `en.ts`                                              → [Feliz] do en reprova
// 3. plantar `aria-label="leftTrigger"` num módulo de `ui/`                   → [Feliz] dos atributos reprova
// 4. `ABSTRATOS = VERBS` → lista à mão com sete (sem `rightTrigger`)          → [Vácuo] da lista reprova
// 5. `valoresDe` a devolver `[]`                                             → [Vácuo] dos dicionários reprova
//    🎯 é a mutação que importa: um crivo cego aprova tudo, e o [Feliz] ficaria verde para sempre
