// SPDX-License-Identifier: AGPL-3.0-or-later
// A RECORD THAT POINTS AT A DEAD GATE — the inventory, and the reason for each entry.
//
// ========================= WHAT THIS GUARDS =========================
// `scripts/validate-adr.py` already checks that every path listed in `confirmed-by` EXISTS, and its header says why:
// «apontavam para ficheiros que tinham saído com o cartucho, e nada dizia». But most records do not use that key.
// They name their gates in PROSE, and nobody checks prose.
//
// 📏 MEASURED ON 2026-09-08: only seven of 112 records used `confirmed-by`; 35 named a path (`tests/…` or `scripts/…`)
// without it, and SEVEN of those paths no longer existed anywhere in this tree.
//
// ⚠️ AND PROSE IS NOT FIXED, which is the decision of ADR-0057 and of the validator itself: «A PROSA DA `confirmation`
// NÃO SE REESCREVE. Ela é histórica e fica como estava; `confirmed-by` é o facto de hoje». An August record naming a
// test that later left was not wrong — it aged. The defect is not the old sentence; it is the lack, beside it, of a
// line saying what confirms the record NOW.
//
// 📌 THAT IS WHY THIS IS AN INVENTORY AND NOT A BAN, in the shape of `POR_MIGRAR` and `what-fonts-the-package-carries`: a ban
// would be born red with seven entries and be switched off at the first rush. The list freezes what already happened,
// demands a hand-written reason per entry, and SHRINKS as the records gain `confirmed-by`. A list that shrinks reports
// the real state; a tick reports the intention of whoever put it there.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * WHERE THE RECORDS' TREE LIVES — HERE, in `docs/2-Architecture/adr/`, since ADR-0242 brought the engine's records home.
 *
 * What this catches is a record naming a file of this tree that no longer exists: a break of the ENGINE, red where it
 * is fixed. The tree is local, so the sweep never skips and needs no checkout. The records that stayed in
 * `the-inclusionist-docs` belong to the whole project and cite the engine through `confirmed-by`, which the engine's
 * `adr` job opens with `--repo engine=.`.
 */
const ADR = fileURLToPath(new URL('../docs/2-Architecture/adr/', import.meta.url));
const RAIZ = process.cwd();

/** Does the cited path exist in this repository? */
const existeAlgures = (c) => existsSync(join(RAIZ, c));

/*
 * Repository paths a record cites: `tests/x.node.test.js`, `scripts/y.mjs`.
 *
 * ⚠️ THE EXTENSION HAS TO END THERE, and without that close the sieve INVENTS files: `scripts/rename-map.json` matched
 * as `scripts/rename-map.js` (the greedy part backs off, `.js` matches, and the `on` is left out), and the record was
 * accused of pointing at a file it never named. 📏 Found on 2026-09-21 through ADR-0219, which cites a `.json` map.
 */
const CAMINHO = /(?<![\w/])(?:tests|scripts)\/[A-Za-z0-9_.\-]+\.(?:m?js|py|ts)(?![\w.])/g;

/**
 * THE PATHS A RECORD CITES THAT DO NOT EXIST HERE, and the why of each.
 *
 * ⚠️ «NÃO EXISTE AQUI» IS NOT THE SAME AS «MORREU»: a path can be a test of the CONSUMER's repository, cited correctly
 * by the record that names it. A sieve only sees the absence; its cause is not greppable, and that is why each entry
 * has to carry a sentence.
 *
 * The causes found so far: left with the cartridge · retired on purpose · renamed · moved to another repository.
 */
const MORTOS = {
  'tests/main-i18n.node.test.js': 'SAIU COM O CARTUCHO (`b55b88e`, #111): testava o `main.js`, que deixou de viver aqui',
  'scripts/check-types.mjs': 'APOSENTADO DE PROPÓSITO (`f622221`) quando a dívida de tipos chegou a ZERO. Era um tecto que só descia; chegado ao fundo, um tecto deixa de ter função',
  'tests/barra-rapida-no-hud.node.test.js': 'MUDOU DE NOME NA FASE 3 (2026-09-22, ADR-0219): é hoje `tests/quick-bar-in-the-hud.node.test.js`',
  'tests/contract-topologia-e-funcao.node.test.js': 'MUDOU DE NOME NA FASE 3 (2026-09-22, ADR-0219): é hoje `tests/contract-topology-is-a-function.node.test.js`',
  'tests/storage-escopos.node.test.js': 'MUDOU DE NOME NA FASE 3 (2026-09-22, ADR-0219): é hoje `tests/storage-scopes.node.test.js`',
  'tests/storage-legado.node.test.js': 'MUDOU DE NOME NA FASE 3 (2026-09-22, ADR-0219): é hoje `tests/storage-legacy-keys.node.test.js`',
  'tests/validador-sem-deriva.node.test.js': 'MUDOU DE NOME NA FASE 3 (2026-09-22, ADR-0219): é hoje `tests/the-validator-does-not-drift.node.test.js`',
  'tests/vozes-fora-do-pacote.node.test.js': 'MUDOU DE NOME NA FASE 3 (2026-09-22, ADR-0219): é hoje `tests/no-voice-model-in-the-package.node.test.js`',
  'tests/modo-acessibilidade.node.test.js': 'MUDOU DE NOME NA FASE 3 (2026-09-22, ADR-0219): é hoje `tests/accessibility-mode.node.test.js`',
  'tests/nada-de-cdn-a-mao.node.test.js': 'MUDOU DE NOME NA FASE 3 (2026-09-22, ADR-0219): é hoje `tests/no-hand-written-cdn.node.test.js`',
  'tests/nada-vem-de-fora.node.test.js': 'MUDOU DE NOME NA FASE 3 (2026-09-22, ADR-0219): é hoje `tests/nothing-comes-from-outside.node.test.js`',
  'tests/pausa-44px.browser.test.js': 'MUDOU DE NOME NA FASE 3 (2026-09-22, ADR-0219): é hoje `tests/pause-target-44px.browser.test.js`',
  'tests/pausa-sete-itens.node.test.js': 'MUDOU DE NOME NA FASE 3 (2026-09-22, ADR-0219): é hoje `tests/the-pause-items-and-their-order.node.test.js`',
  'tests/actions-catorze.node.test.js': 'RENAMED IN PHASE 3 (2026-09-24, ADR-0219): today it is `tests/the-fourteen-actions.node.test.js`',
  'tests/catalogo-tipografico.node.test.js': 'RENAMED IN PHASE 3 (2026-09-24, ADR-0219): today it is `tests/faces-answer-to-the-type-catalogue.node.test.js`',
  'tests/contract-rumo.node.test.js': 'RENAMED IN PHASE 3 (2026-09-24, ADR-0219): today it is `tests/contract-bearing.node.test.js`',
  'tests/declinio-morto.node.test.js': 'RENAMED IN PHASE 3 (2026-09-24, ADR-0219): today it is `tests/no-decline-is-dead.node.test.js`',
  'tests/fontes-carregam.node.test.js': 'RENAMED IN PHASE 3 (2026-09-24, ADR-0219): today it is `tests/an-offered-font-loads.node.test.js`',
  'tests/fontes-empacotadas.node.test.js': 'RENAMED IN PHASE 3 (2026-09-24, ADR-0219): today it is `tests/what-fonts-the-package-carries.node.test.js`',
  'tests/lotes-passo5.node.test.js': 'RENAMED IN PHASE 3 (2026-09-24, ADR-0219): today it is `tests/step-5-batches-leaf-first.node.test.js`',
  'tests/z-order-css.node.test.js':'MUDOU DE REPOSITÓRIO (2026-09-23, ADR-0228): a ordem das camadas é `core/layers`, que descreve as camadas de UM jogo — foi com a pilha de mundo-de-tiles para o `game-platformer`, e o gate foi com ela',
};
/*
 * 🔴 THE `z-order-css` ENTRY HAS A CAUSE OF ITS OWN: the file did not die and was not renamed — it changed REPOSITORY.
 * ADR-0228 took out of the engine the modules that describe one game, and the gates about them went with them to
 * `game-platformer`. 📌 The distinction matters to whoever reads a record and looks for the gate: «morto» would send
 * them to the history, and the truth is it is alive in another tree.
 *
 * 🔴 THE PHASE-3 ENTRIES ARE RENAMES: the file did NOT die, it changed name. The prose of a record that cites it is still
 * right for the day it was written (ADR-0057), so it is not touched — what was missing is the place that says where it
 * went, and that place is this list. ⚠️ For that very reason this file is OUT of the sweep of
 * `scripts/apply-file-rename.mjs`: it is data ABOUT paths, and a tool rewriting it would turn «X virou Y» into «Y virou Y».
 * That happened twice on 22/09 before the exclusion went in.
 */
// ========================= WHAT HAS ALREADY LEFT, AND HOW =========================
// Of the entries the list was born with, three have left. None was deleted; each left by a different route, and the
// routes are the subject.
//
// ✅ THREE LEFT ON 2026-09-26, BY A ROUTE OF THEIR OWN: the records citing them stayed in `the-inclusionist-docs` when
//    the engine's records came home (ADR-0242). `alternancia-do-correr` and `instrucao-do-botao-falada` are cited by
//    ADR-0045 and ADR-0060, which read as `game-platformer`'s; `lcp-quarantine` by ADR-0133, which is the project's
//    art licensing. This sweep reads the engine's own tree, and their prose is history in that repository.
//
// ✅ `tests/carregar-e-arremessar.node.test.js` — cited ONLY by ADR-0045, which is `superseded` (by 0060).
//    ⚠️ A FALSE POSITIVE OF THIS SIEVE: a record that no longer governs owes no CURRENT gate, and demanding one would be
//    asking enforcement of a revoked decision. The `aindaGoverna` filter corrects it.
//
// ✅ `tests/progress.node.test.js` — ADR-0037 gained `confirmed-by` pointing at the TWO halves it still asserts: the
//    sieve that nothing stores a child's performance, and the exhaustive check of the hand-copied password. The prose
//    citing the dead file stays: it was right on the day, and the commit that killed it (`809bc01`) was the one that
//    ABOLISHED the save — the gate was not lost, what it guarded stopped existing.
//    📌 ADR-0034 cites the same file and did NOT gain the key: it is superseded, and leaves by the other route.
//
// ✅ `tests/docs.node.test.ts` — its story is worth more than the entry was.
//
// ⚠️ It came in with the WRONG reason: «nunca existiu — o ADR-0093 afirma uma verificação que não foi construída»,
// because there is no removal record under any extension. The sentence citing it proved that wrong — it says
// «(`tests/docs.node.test.ts`, DO LADO DELE)»: it is a test of the CONSUMER's repository, cited correctly. The gate on
// this side is `tests/engine-package.node.test.js`, and it exists.
//
// 📌 THE ERROR SHOWED UP WHILE WRITING THE REASON. A sieve counting «sete caminhos ausentes» would have treated two
// different causes as one; the absence of a file is greppable, its cause is not. That is the work a hand-written
// sentence does and a number does not.
//
// ✅ AND THE DEBT WAS PAID, not erased: ADR-0093 gained `confirmed-by` pointing at the real gate, `validate-adr.py`
// checks it, and the entry left because the way out works — which is exactly what needed proving.

function registos() {
  return readdirSync(ADR).filter((n) => n.startsWith('ADR-') && n.endsWith('.yaml'))
    .map((n) => ({ id: n.replace(/^(ADR-\d+).*/, '$1'), text: readFileSync(join(ADR, n), 'utf8') }));
}

/** Does the record declare, under a checked key, what confirms it TODAY? */
const temChaveConferida = (r) => /^\s{2}confirmed-by:/m.test(r.text);

/**
 * Does the record still GOVERN?
 *
 * ⚠️ A `superseded` record owes no CURRENT gate, because it no longer decides anything — its prose is history whole,
 * not half. Demanding a confirmation of today from it would be asking enforcement of a revoked decision, and the
 * `confirmed-by` answering it would point at a gate guarding the SUCCESSOR's decision.
 *
 * 📌 Measured: of the seven records that cited a dead path, TWO were superseded — ADR-0034 (by 0037) and ADR-0045
 * (by 0060). `carregar-e-arremessar` was cited only by 0045, and leaves by this rule.
 */
const aindaGoverna = (r) => !/^\s{2}status:\s*"?(superseded|deprecated)"?/m.test(r.text);

/**
 * Every path cited in PROSE by a record that does NOT yet have `confirmed-by`.
 *
 * ⚠️ AND THE FILTER IS THE WAY OUT OF THIS DEBT, without which the file would be a monument. Reading the prose of ALL
 * records — and prose is history and is not rewritten (ADR-0057) — no entry could ever leave the list. An inventory
 * that only grows does not report progress: it reports accumulation.
 *
 * 📌 With the filter, the way out is what the repository already decided: the record gains `confirmed-by`,
 * `validate-adr.py` checks that path, and the old prose no longer needs watching — because there is, beside it, a
 * checked line saying what confirms the record now.
 */
function citados() {
  const fora = new Set();
  for (const r of registos()) {
    if (temChaveConferida(r) || !aindaGoverna(r)) continue;
    for (const c of r.text.match(CAMINHO) ?? []) fora.add(c);
  }
  return [...fora];
}

describe('the records tree lives in this repository (ADR-0242)', () => {
  it('🔴 [Vacuum] the tree is here, so this sweep cannot skip — a sieve with nothing to read is green for the worst reason', () => {
    expect(existsSync(ADR), `the engine's records tree is not at ${ADR}; ADR-0242 put it there`).toBe(true);
  });
});

describe('um registo não aponta para um gate que não existe', () => {
  it('⚠️ [Interface] nenhum ponteiro morto NOVO entrou sem ser declarado', () => {
    const novos = citados().filter((c) => !existeAlgures(c) && !(c in MORTOS));
    expect(
      novos,
      'um registo nomeia um gate que não existe nesta árvore. Se ele saiu, declare-o aqui com o motivo — e se '
      + 'o registo ainda TEM um gate, o sítio certo para o dizer é a chave `confirmed-by`, que o '
      + '`validate-adr.py` confere. A prosa é história e não se reescreve (ADR-0057).',
    ).toEqual([]);
  });

  it('⚠️ [Interface] a lista ENCOLHE: quem já não é apanhado sai dela', () => {
    // ⚠️ An entry can stop being debt by TWO routes: the file comes back, OR the record citing it gains `confirmed-by`
    // and declares, under a checked key, what confirms it today. Asking only whether the file came back, the second
    // route would never empty the list, and an inventory that does not shrink is a monument.
    //
    // 📌 That is how `tests/docs.node.test.ts` left: ADR-0093 gained the key pointing at
    // `tests/engine-package.node.test.js`, which is the gate on this side. The debt was not erased — it was paid.
    const apanhados = new Set(citados().filter((c) => !existeAlgures(c)));
    expect(
      Object.keys(MORTOS).filter((c) => !apanhados.has(c)),
      'entrada que já não é dívida: ou o ficheiro voltou, ou o registo que o cita ganhou `confirmed-by`',
    ).toEqual([]);
  });

  it('⚠️ [Interface] e a varredura está VIVA: ela lê os registos e acha caminhos a sério', () => {
    // An absence sieve that reads nothing is green for the worst reason. Anchored in two facts: there are records, and
    // among the cited paths at least one EXISTS — otherwise the detector would be finding rubbish.
    const todos = registos();
    expect(todos.length, 'a varredura não achou registo nenhum').toBeGreaterThan(100);
    const vivos = citados().filter((c) => existsSync(join(RAIZ, c)));
    expect(vivos.length, 'nenhum caminho citado existe — o detector está a casar com outra coisa').toBeGreaterThan(5);
  });

  it('🔴 [Zero] um `.json` citado NÃO é lido como um `.js` — o crivo não inventa ficheiros', () => {
    // 🔴 It happened with ADR-0219, which cites `scripts/rename-map.json`: the extension matched up to `.js` and the record
    // was accused of pointing at `scripts/rename-map.js`, a file nobody wrote and that it does not name. A sieve that
    // invents the defect is worse than one that misses it: whoever reads it goes looking for what does not exist.
    const achados = [...'cita scripts/rename-map.json e tests/x.node.test.js e scripts/y.jsonl'.matchAll(CAMINHO)]
      .map((m) => m[0]);
    expect(achados, 'o casador leu uma extensão pela metade').toEqual(['tests/x.node.test.js']);
  });

  it('📌 [Right] e o mecanismo que resolve isto EXISTE e é conferido', () => {
    // `confirmed-by` is the decided answer, and `validate-adr.py` already fails when one of its paths does not exist.
    // This case pins the mechanism: if it disappears, this list has nowhere left to shrink to.
    const validador = readFileSync(join(RAIZ, 'scripts', 'validate-adr.py'), 'utf8');
    expect(validador, 'o validador deixou de conferir os caminhos de `confirmed-by`').toMatch(/os\.path\.exists/);
    const comChave = registos().filter((r) => /^\s{2}confirmed-by:/m.test(r.text));
    expect(comChave.length, 'nenhum registo usa a chave — o caminho de saída desta dívida fechou-se').toBeGreaterThan(0);
  });
});

// ========================= MUTATIONS CHECKED =========================
// Four, all killed. ⚠️ And the first IS NOT A CODE EDIT: it ADDS to a real record a citation of
// `tests/gate-que-nunca-existiu.node.test.js` and undoes it afterwards. An inventory is only proved that way — mutating
// the regex proves the detector is alive, not that it catches the thing.
//
//   1. a record citing a non-existent gate -> fails the declared [Interface]. It is the exact defect: a pointer born
//      dead that nobody notices, because nobody checks prose.
//   2. an ORPHAN in the list (a file name that exists) -> fails the orphans case. Without it the list could keep debts
//      already paid and look bigger than it is — the opposite of what a list that SHRINKS is for.
//   3. the paths regex dead -> fails the liveness case, through the floor of LIVE paths. ⚠️ Note that it does not fail
//      the declared case: with no detector, «nenhum ponteiro morto novo» stays green by finding nothing, which is
//      precisely the false green the liveness case exists to prevent.
//   4. `validate-adr.py` no longer checking the `confirmed-by` paths -> fails the MECHANISM case.
//   5. the SUPERSEDED filter removed -> fails the shrinking case: the two revoked records are charged again by a
//      current gate they do not owe, because they no longer decide anything.
//      📌 That case is the only one that looks not at the debt but at the WAY OUT of it: if the key stops being
//      checked, this list has nowhere to shrink to, and an inventory with no way out becomes a monument.
