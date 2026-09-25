// SPDX-License-Identifier: AGPL-3.0-or-later
// A PANEL THAT REBUILDS ROWS MUST PUT THE PROSE BACK IN THE FOOTER.
//
// ========================= THE RULE, AND IT WAS ALREADY WRITTEN =========================
// `CLAUDE.md` §4 carries the Dev's decision of 2026-08-25 and its mechanical consequence, in full:
//
//     «A explicação mora no RODAPÉ, e fica lá. […] Painel que re-renderiza precisa chamar `fillExplain` a
//      cada render, senão a prosa volta para dentro das linhas no primeiro clique.»
//
// `ui/settings-panel.fillExplain` runs ONCE when the overlay is brought to the front: it scans the rows, takes the
// `.opt-hint` out of each and moves the text to the `.opt-explain` footer. When a panel rebuilds its rows by
// `innerHTML`, the new rows come back with the `.opt-hint` INSIDE — because the builder emits them that way — and the
// prose appears twice: in the footer, from the first pass, and under each label, from the redraw.
//
// ========================= WHY A SOURCE GATE, AND NOT ONLY A BEHAVIOUR ONE =========================
// ⚠️ THIS DEFECT WAS FIXED TWICE AND CAME BACK. Issue #109 fixed it in `settings-visual` and `settings-empathy`, and later
// several panels had it again — one of them `settings-visual`. A one-off fix does not prevent the third time; what
// prevents it is the property being checked over ALL panels at once, including the ones that do not exist yet.
//
// The property is structural and is read without running anything: a panel module that rebuilds markup must know how
// to put the prose back. It does not check that the call is in the right place — that is the browser case under it.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const RAIZ_REPO = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const UI = join(RAIZ_REPO, 'app', 'js', 'ui');
const CR = String.fromCharCode(13);

/** The PANEL modules. `settings-panel` is the shell — it is the one that has `fillExplain`, not the one that calls it. */
const PAINEIS = readdirSync(UI)
  .filter((f) => f.startsWith('settings-') && f.endsWith('.ts') && f !== 'settings-panel.ts')
  .sort();

const fonte = (f) => readFileSync(join(UI, f), 'utf8').split(CR).join('');

/** CODE lines — this repository's prose talks about `innerHTML` and `fillExplain` all the time. */
function linhasDeCodigo(texto) {
  const out = [];
  let bloco = false;
  texto.split('\n').forEach((ln, i) => {
    const t = ln.trim();
    if (bloco) { if (t.includes('*/')) bloco = false; return; }
    if (t.startsWith('/*')) { if (!t.includes('*/')) bloco = true; return; }
    if (t.startsWith('//') || t.startsWith('*')) return;
    out.push([i + 1, ln.replace(/\/\/.*$/, '')]);
  });
  return out;
}

/**
 * ⚠️ REBUILDING IS ALSO DONE BY PROXY, and that is how this check once let a whole panel through.
 *
 * Asking only for `\.innerHTML\s*=` in the panel's file misses `settings-empathy`: it has none, and it rebuilds all the
 * same, because it calls `ctx.renderVizGroup('#empathy-list', …)`, which is injected and whose implementation
 * (`render/viz-setters.ts`) does `el.innerHTML = vizGroupHtml(t, modes, cur)`. The new rows come back with the `.opt-hint`
 * inside exactly like any other panel's; what changes is only WHO wrote them, and the check read by the author instead
 * of by the effect.
 *
 * `settings-empathy` was the only panel with ZERO `innerHTML =` — so it was the only one the exemption reached, and
 * precisely the one that needed the gate. A check that exempts exactly the sick case is not a loose check: it is a check
 * with its sign flipped.
 */
const RECONSTRUTORES_INJETADOS = ['renderVizGroup'];
const reconstroiPorMarkup = (f) => linhasDeCodigo(fonte(f)).some(([, l]) =>
  /\.innerHTML\s*=/.test(l) || RECONSTRUTORES_INJETADOS.some((n) => new RegExp(n + '\\s*\\(').test(l)));

/**
 * ⚠️ REBUILDING IS ALSO DONE IN NODES — AND THAT IS HOW THIS SIEVE QUIETLY STOPPED WATCHING FIVE OF EIGHT PANELS.
 *
 * 📏 Measured on 2026-09-23, with the kit adoption of ADR-0129 closed: the question above asks only for
 * `.innerHTML =`, and the conversion replaced exactly that. `-aac`, `-typo`, `-visual`, `-motion` and `-audio`
 * now build their rows as NODES, so the answer for all five became `false` — and the `[Zero]` case walked past
 * them asserting nothing, GREEN. Nothing ever went red: the gate simply stopped covering the very panels the
 * conversion touched, one commit at a time. It is the shape this repository has already met three times in
 * ledgers — a key that stops matching stops requiring — and the first time it has bitten a PREDICATE.
 *
 * 📌 And the requirement did not leave with the markup. A row BORN as a node after `fillExplain` has already run
 * carries its `.opt-hint` visible exactly like a row born from a string; what changed is only who wrote it,
 * which is the same mistake the injected-rebuilder note above was written to fix.
 */
const CRIADORES_DO_KIT = ['controlRow', 'sectionHeader', 'mountSteps'];
const constroiNos = (f) => linhasDeCodigo(fonte(f)).some(([, l]) =>
  /\bcreateElement\s*\(|\bcreate\s*\(/.test(l) || CRIADORES_DO_KIT.some((n) => new RegExp('\\b' + n + '\\s*\\(').test(l)));

const reconstroi = (f) => reconstroiPorMarkup(f) || constroiNos(f);

/**
 * ⚠️ THE CALL, NOT THE MENTION — and the difference was measured, not assumed.
 *
 * Looking for the word `fillExplain` in any code line let through a mutation that DELETED the call from
 * `settings-visual`: the `fillExplain?:` field in the `ctx` interface was enough to satisfy the regex. The gate measured
 * that the panel KNEW the name, not that it used it — exactly the kind of green that proves nothing.
 *
 * So it demands the shape of the invocation: `fillExplain(` or `fillExplain?.(`. Declaring the field no longer counts.
 */
const reexplica = (f) => linhasDeCodigo(fonte(f)).some(([, l]) => /fillExplain\s*\??\.?\s*\(/.test(l));

describe('painel que reconstrói linhas repõe a prosa no rodapé (CLAUDE.md §4, issue #109)', () => {
  it('[Interface] a varredura acha os painéis, e a casca fica de fora', () => {
    expect(PAINEIS.length).toBeGreaterThanOrEqual(7);
    expect(PAINEIS).not.toContain('settings-panel.ts');
  });

  it('⚠️ [Zero] NENHUM painel reconstrói markup sem saber repor a prosa', () => {
    const mudos = PAINEIS.filter((f) => reconstroi(f) && !reexplica(f));
    expect(mudos, 'reconstrói as linhas e a explicação volta para dentro delas no primeiro clique').toEqual([]);
  });

  it('⚠️ [Interface] o reconstrutor injetado da lista RECONSTRÓI MESMO — a isenção era sobre ele', () => {
    // The `RECONSTRUTORES_INJETADOS` list is a claim about ANOTHER module, and a claim about another module is the one
    // that rots with nobody noticing: if `renderVizGroup` one day updated by `textContent`, the name would stay on the
    // list forcing panels into a call no longer needed — and the gate would become the ceremony it exists not to be.
    //
    // This case reads the other side. It is the lesson of a test that reads through the binding: naming the literal is
    // not enough, one must demand that what it names goes on being what it was.
    const VIZ = join(RAIZ_REPO, 'app', 'js', 'render', 'viz-setters.ts');
    const corpo = readFileSync(VIZ, 'utf8').split(CR).join('');
    const isInside = corpo.slice(corpo.indexOf('function renderVizGroup('));
    expect(isInside, 'renderVizGroup deixou de reconstruir; rever RECONSTRUTORES_INJETADOS')
      .toMatch(/\.innerHTML\s*=/);
  });

  it('⚠️ [Interface] os construtores do KIT criam nós mesmo — a segunda afirmação sobre outro módulo', () => {
    // Same lesson as the case above, applied to the list this commit added: `CRIADORES_DO_KIT` is a claim about
    // `ui/panel-widgets`, and a claim about another module is the one that rots unnoticed. `labelRow` and
    // `updateSteps` are deliberately NOT here — they rewrite rows that already exist, and a panel that only
    // relabels does not undo `fillExplain`.
    // ⚠️ AND THE BODY COMES FROM THE PARSER, not from an `indexOf` up to the next `export`. Slicing that way, `labelRow`'s
    // slice swallowed the private `criarControle` that follows it — a mutation that listed `labelRow` as a creator passed
    // GREEN. A hand-made scanner that does not know where a construct ends has erred here before, and this house's answer
    // is already written: the one who knows is `typescript`.
    const KIT = join(UI, 'panel-widgets.ts');
    const fonteDoKit = readFileSync(KIT, 'utf8');
    const arvore = ts.createSourceFile(KIT, fonteDoKit, ts.ScriptTarget.Latest, true);
    const corpos = new Map();
    arvore.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name) corpos.set(node.name.text, node.getText(arvore));
    });
    for (const n of CRIADORES_DO_KIT) {
      expect(corpos.has(n), `${n} deixou de ser uma função do kit; rever CRIADORES_DO_KIT`).toBe(true);
      expect(corpos.get(n), `${n} deixou de criar nós; rever CRIADORES_DO_KIT`).toMatch(/\bcreate\s*\(/);
    }
  });

  it('⚠️ [Zero] o crivo ALCANÇA os oito painéis — nenhum sai da vigilância em silêncio', () => {
    // 📏 This case exists because coverage once shrank from 8 panels to 3 without a single failure, as the conversion to
    // nodes deleted the `innerHTML` the check looked for. Measuring coverage is what turns that shrinking into a failure
    // instead of a silence.
    const forade = PAINEIS.filter((f) => !reconstroi(f));
    expect(forade, 'painel que nenhuma das duas formas de reconstrução alcança').toEqual([]);
  });

  it('[Boundary] e um painel que NÃO reconstrói não é obrigado a nada', () => {
    // The exemption still exists and is still right: a panel that only changes `textContent` on elements that already
    // exist does not undo `fillExplain`'s work, and demanding the call of it would be ceremony — which is what makes a
    // gate get worked around instead of kept.
    //
    // ⚠️ `settings-empathy` does not belong here: it delegates rebuilding its list to `renderVizGroup`. Today the set is
    // EMPTY, and an empty set is a legitimate answer: every panel rebuilds, in one of the two ways.
    const soTexto = PAINEIS.filter((f) => !reconstroi(f));
    for (const f of soTexto) {
      expect(reconstroi(f), `${f} passou a reconstruir e este caso não notou`).toBe(false);
    }
  });

  it('⚠️ [Cross-check] o crivo PEGA o defeito real, e não conta prosa que o menciona', () => {
    // Without this, the `[Zero]` case could be green because the regex matches nothing. The two samples are the exact
    // shapes the repository uses.
    const comoOsCinco = 'el.innerHTML = catsListHTML(keys, ctx.audioCats, state);';
    const comoOConserto = "ctx.fillExplain?.(ctx.$('#typo .overlay__card'));";
    expect(/\.innerHTML\s*=/.test(comoOsCinco)).toBe(true);
    expect(/fillExplain/.test(comoOConserto)).toBe(true);
    expect(linhasDeCodigo('// o painel chama fillExplain a cada innerHTML = ...'),
      'prosa que menciona as duas coisas não pode contar como código').toEqual([]);
  });
});
