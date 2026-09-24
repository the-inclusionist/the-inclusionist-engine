// SPDX-License-Identifier: AGPL-3.0-or-later
// A PANEL THAT RE-RENDERS HAS TO MOVE THE PROSE AGAIN — the rule of `CLAUDE.md` §4, which has already failed once.
//
// ========================= THE RULE, AND WHY IT NEEDS A GATE =========================
// The Dev's decision of 2026-08-25 puts the explanation in the FOOTER and not inside the rows: «Em vez de colocar no
// rodapé como dica, está explicando item a item dentro do menu e transformando-os em manuais!». The mechanism is
// `fillExplain` in `ui/settings-panel`, which MOVES the `.opt-hint` from inside each row to the footer.
//
// ⚠️ AND IT RUNS ONCE, when the overlay is brought to the front. A panel that REBUILDS its rows gives them back with the
// prose inside — so the explanation shows up TWICE, in the footer and under the label, from the first click on. It is
// the defect issue #109 fixed in `settings-visual` and `settings-empathy`.
//
// 📌 THE RULE IS HONOURED IN EVERY PANEL TODAY, and that is why this file is a sieve and not a fix: what it prevents is
// the NEXT panel. The rule lives in a comment of each ctx and in `CLAUDE.md`; while it is remembered by hand, it fails
// exactly as it failed — and it fails silently, because nothing breaks: the child just reads the same sentence twice,
// on a screen she opened to understand something.
//
// ⚠️ AND WHAT IT DOES NOT CATCH, said so nobody trusts it too much: it proves the CALL exists, not that it is on every
// render path of a panel with several. A panel with two `render`s and the call in only one of them passes. What would
// catch that is a behaviour case per panel — and those live in each panel's own file, where #109 left them.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const UI = fileURLToPath(new URL('../app/js/ui/', import.meta.url));

/**
 * ⚠️ `settings-panel` IS THE SHELL and stays out: it is the one that OFFERS `fillExplain`. Requiring the provider to
 * call what it provides would be the gate not knowing which side of the boundary it is on.
 */
const A_CASCA = 'settings-panel.ts';

const paineis = () => readdirSync(UI)
  .filter((n) => n.startsWith('settings-') && n.endsWith('.ts') && n !== A_CASCA);

const fonte = (n) => readFileSync(join(UI, n), 'utf8');
/**
 * CODE lines: a comment explaining the rule is not the call that fulfils it.
 *
 * ⚠️ AND THE END-OF-LINE COMMENT GOES TOO. Every ctx in this engine explains the `fillExplain` rule in prose — a
 * `const x = 1; // ver fillExplain(card)` would make a panel pass for fulfilling something it only mentions. This file's
 * liveness case is what caught it, and that is why it exists.
 *
 * 📌 The `[^:]` before the two slashes spares `https://…`: an address inside a string is not a comment, and cutting it
 * there would break the line in half with nothing saying why.
 */
const codigo = (n) => fonte(n).split(/\r?\n/)
  .filter((ln) => !/^\s*(\/\/|\*|\/\*)/.test(ln))
  .map((ln) => ln.replace(/(^|[^:])\/\/.*$/, '$1'))
  .join('\n');

const RECONSTROI = /\.innerHTML\s*=|function render\b|render\s*\(\s*\)\s*[:{]/;
const CHAMA = /\bfillExplain\s*(\?\.)?\(/;

describe('CLAUDE.md §4 · a prosa fica no rodapé, também depois de re-renderizar', () => {
  it('🎯 [Zero] todo painel que RECONSTRÓI linhas volta a mover a prosa', () => {
    const faltam = paineis().filter((n) => {
      const c = codigo(n);
      return RECONSTROI.test(c) && !CHAMA.test(c);
    });
    expect(
      faltam,
      'painel que reconstrói as suas linhas sem voltar a chamar `fillExplain`. O `.opt-hint` volta para DENTRO '
      + 'da linha no primeiro clique e a criança lê a mesma frase duas vezes — no rodapé e sob o rótulo. É o '
      + 'defeito que a issue #109 já consertou uma vez, e ele não quebra nada: só duplica.',
    ).toEqual([]);
  });

  it('⚠️ [Interface] e a varredura está VIVA: acha os painéis e vê a casca do lado certo', () => {
    // A sieve reading the wrong folder, or whose regex died, would stay green for having nothing to examine.
    const lista = paineis();
    expect(lista.length, 'a varredura não achou painel nenhum').toBeGreaterThan(5);
    expect(lista, 'a casca entrou na lista — ela PROVÊ o `fillExplain`, não o consome').not.toContain(A_CASCA);
    // the detector recognises both halves when they exist
    expect(RECONSTROI.test('el.innerHTML = html;')).toBe(true);
    expect(CHAMA.test('ctx.fillExplain?.(card);')).toBe(true);
    // ⚠️ AND THIS IS WHY COMMENTS ARE REMOVED FIRST: one that CITES the call — and every ctx in this engine cites it —
    // would match the detector, and a panel that only explained the rule without fulfilling it would pass for fulfilling it.
    expect(CHAMA.test('// lembre-se de chamar `fillExplain(card)` a cada render')).toBe(true);
    expect(codigo(A_CASCA).includes('//'), 'a limpeza de comentários deixou passar uma linha de comentário').toBe(false);
  });

  it('📌 [Right] a casca continua a OFERECER o mecanismo — sem ela a regra não tem como ser cumprida', () => {
    // If `fillExplain` leaves `settings-panel`, the panels end up calling something that does not exist and this
    // sieve would stay green. It is the case that pins the other side of the boundary.
    expect(fonte(A_CASCA), 'a casca deixou de oferecer o `fillExplain`').toMatch(/fillExplain/);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// (preenchido pelo arnes)
