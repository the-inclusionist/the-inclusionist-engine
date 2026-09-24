// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE ↔ GAME BOUNDARY, as a TEST (ADR-0027, step 4). Node project: only reads files.
//
// ADR-0027 carries a heuristic and calls it decisive:
//
//   «Um teste de um módulo de ENGINE cujo fixture precisa de uma MOEDA é prova de que o corte não pegou. Não dá para ver
//    isso lendo o módulo — só lendo o teste dele.»
//
// And it makes step 4 the verdict: «se `createGame()` não puder ser escrito sem um parâmetro chamado `coinTarget`, a
// fronteira que este registro propõe está errada e os passos 5 a 7 NÃO PODEM COMEÇAR.»
//
// This is that heuristic as a gate. As prose in a document it depended on someone remembering to apply it; a document
// fails nobody. This does.
//
// THE FORM IS A LIST THAT CAN ONLY SHRINK. A test that simply failed would be deleted or loosened at the first rush. A
// known-debt list does three things at once: keeps the suite green, makes the debt COUNTABLE, and makes any NEW edge
// fail at once. Whoever fixes a line deletes the line; whoever creates one finds out the same minute.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ_REPO = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const RAIZ = join(RAIZ_REPO, 'app', 'js');

// `boot` (`createGame()`) is an ENGINE layer and is scanned like the others: a composition root importing from `game/`
// would carry the whole game inside the package, which is precisely what it exists not to do.
//
// ⚠️ The layer list comes from `tsconfig.pkg.json`, which decides what is published — for the reason `engine-package`
// gives for itself. A hand-written list once named an `audio` layer that never existed, and `if (!existsSync)` returned
// an empty list without a word.
function camadasPublicadas() {
  const bruto = readFileSync(join(RAIZ_REPO, 'tsconfig.pkg.json'), 'utf8').split(String.fromCharCode(13)).join('');
  return (JSON.parse(bruto).include ?? [])
    .map((p) => p.split('\\').join('/'))
    .filter((p) => p.startsWith('app/js/'))
    .map((p) => p.slice('app/js/'.length))
    .filter((c) => c && !c.includes('/'))
    .sort();
}

/**
 * Out of the EDGE scan, each for a different reason:
 *
 *   · `i18n` are the dictionaries — pure data, and what they import is the dictionary's type.
 *   · `educational` has its OWN, harder rule, measured at the end of this file: it imports NOTHING, not even from
 *     `core/`. Putting it here would only ask about `game/`, which is less than it promises.
 */
const FORA_DA_VARREDURA = new Set(['i18n', 'educational']);
const CAMADAS_ENGINE = camadasPublicadas().filter((c) => !FORA_DA_VARREDURA.has(c));

function modulosDe(camada) {
  const dir = join(RAIZ, camada);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => `${camada}/${f}`);
}
const MODULOS = CAMADAS_ENGINE.flatMap(modulosDe);
// LINE ENDINGS ARE NORMALISED on reading, and that is not hygiene: with CRLF each line ends in CR, and CR is a LINE
// TERMINATOR for a regex — `.` does not reach it, so the end anchor in /\/\/.*$/ never arrives and the comment stripper
// REMOVES NOTHING, and end-of-line comments get accused as dependencies. A filter that fails OPEN is worse than none: it
// produces a false debt list, and whoever goes to fix it finds nothing to fix.
const CR = String.fromCharCode(13);
const fonte = (m) => readFileSync(join(RAIZ, ...m.split('/')), 'utf8').split(CR).join('');

/** CODE lines: no block, line or end-of-line comments. Prose is not a dependency — a comment describing the game does
 *  not tie the module to it. */
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

// ---------------------------------------------------------------------------------------------------------
// 1. IMPORT EDGES — the hardest evidence, because it is not a name: it is a dependency the compiler follows. An engine
//    module importing from `game/` cannot be packaged without taking the game along.
// ---------------------------------------------------------------------------------------------------------

/** KNOWN debt. This list only shrinks. Each line is an issue waiting. */
const IMPORTS_CONHECIDOS = {
  // EMPTY: the last edges left by INJECTION and by CONTRACT — rules of the game that lived in engine code (an item
  // collected vanishes, another owner's item is dimmed, the key holds for everyone) entered through the ctx.
  //
  // 📌 A type-only import counts too: an erased type does not enter the package, but it forces the file to exist for
  // `tsc` and forces every game to have that shape.
};

/** CURRICULUM debt (ADR-0032). Same rule: it only shrinks.
 *
 *  An engine importing curriculum is less wrong than one importing the game — the curriculum is the same in any game that
 *  teaches the same thing, and `educational/` travels with the platform, not with one title. Less wrong is not right: an
 *  engine module would still know a catalogue's name, when the platform should hand it in by injection. This list is
 *  where such a debt would be COUNTABLE instead of invisible. */
const IMPORTS_CURRICULO = {
};

function importsDeJogo(m) {
  return [...fonte(m).matchAll(/from '\.\.\/(game\/[\w.-]+)'/g)].map((x) => x[1]);
}

describe('fronteira engine↔jogo — arestas de importação (ADR-0027 passo 4)', () => {
  it('[Right] NENHUM módulo de engine importa de game/ além da dívida conhecida', () => {
    const novas = {};
    for (const m of MODULOS) {
      const extras = importsDeJogo(m).filter((i) => !(IMPORTS_CONHECIDOS[m] || []).includes(i));
      if (extras.length) novas[m] = extras;
    }
    expect(novas, 'aresta NOVA de engine para game/ — some com ela ou registre o porquê').toEqual({});
  });

  it('[Interface] a dívida conhecida ainda EXISTE — linha consertada é linha apagada daqui', () => {
    // Without this case the list would become a graveyard: entries for edges already gone would keep allowing them back,
    // and nobody would know the test had stopped protecting that file.
    for (const [m, esperados] of Object.entries(IMPORTS_CONHECIDOS)) {
      const atuais = importsDeJogo(m);
      for (const e of esperados) {
        expect(atuais, `${m}: '${e}' não existe mais — apague-o de IMPORTS_CONHECIDOS`).toContain(e);
      }
    }
  });

  it('[Zero] NENHUM módulo de engine importa de game/ — a lista esvaziou em 2026-08-25', () => {
    // What zero MEANS: the engine layer does not drag the game through the compiler — no module needs `game/` to exist
    // to be packaged. It is ADR-0027 step 4's literal question.
    //
    // What it does NOT mean: that the boundary is finished. VOCABULARY is measured separately (section 2): a name is not
    // followed by the compiler and does not stop a package from separating, so it is a lesser debt, counted on its own.
    //
    // The list stays HERE, empty, not deleted: it is where the next edge will have to declare itself, and an absent list
    // invites adding the import without a second thought.
    expect(Object.keys(IMPORTS_CONHECIDOS)).toHaveLength(0);
  });
});

describe('fronteira engine↔currículo — a aresta que a mudança de endereço criou (ADR-0032)', () => {
  const importsDeCurriculo = (m) =>
    [...fonte(m).matchAll(/from '\.\.\/(educational\/[\w.-]+)'/g)].map((x) => x[1]);

  it('[Right] NENHUM módulo de engine importa de educational/ além da dívida conhecida', () => {
    const novas = {};
    for (const m of MODULOS) {
      const extras = importsDeCurriculo(m).filter((i) => !(IMPORTS_CURRICULO[m] || []).includes(i));
      if (extras.length) novas[m] = extras;
    }
    expect(novas, 'aresta NOVA de engine para educational/ — o currículo é da plataforma, não da engine').toEqual({});
  });

  it('[Interface] a dívida de currículo ainda EXISTE — linha consertada é linha apagada daqui', () => {
    for (const [m, esperados] of Object.entries(IMPORTS_CURRICULO)) {
      const atuais = importsDeCurriculo(m);
      for (const e of esperados) {
        expect(atuais, `${m}: '${e}' não existe mais — apague-o de IMPORTS_CURRICULO`).toContain(e);
      }
    }
  });

  it('[Boundary] o currículo NÃO importa da engine nem do jogo — é DADO, e dado não chama ninguém', () => {
    // The half of ADR-0032 the address alone does not guarantee. A catalogue that imported `core/` or `game/` could not
    // travel to the platform without taking this title along.
    const dir = join(RAIZ, 'educational');
    const arquivos = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.ts')) : [];
    expect(arquivos.length, 'a camada de currículo sumiu — se foi de propósito, apague este caso').toBeGreaterThan(0);
    for (const f of arquivos) {
      const alheias = linhasDeCodigo(fonte(`educational/${f}`))
        .filter(([, ln]) => /from '\.\.\//.test(ln))
        .map(([n, ln]) => `${f}:${n} ${ln.trim()}`);
      expect(alheias, 'currículo importando de fora de si — ver ADR-0032').toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
// 2. THE NAME THE ADR CHOSE. `coinTarget` is the record's example: a HUD that took a coin target would leave a game with
//    no coins nothing to pass there, and the HUD is engine. `ui/hud.vphudHtml` takes an `Objective`.
// ---------------------------------------------------------------------------------------------------------

// ⚠️ ONE MATCHER FOR BOTH SECTIONS (modules and fixtures). Two matchers with the same name measured different things: the
// module one lacked `coinTex`, `coinCanvas` and `quiz`, and engine modules carried vocabulary it could not see. A gate
// weaker than the test it should protect is worse than none: it declares resolved a boundary nobody measured.
// (`VOCAB_JOGO` is declared here, in section 2, and is the SAME matcher in section 3.)
// ⚠️ `quiz.html` AND `consumer-quiz` DO NOT COUNT, and the distinction is of OWNER, not of word. They name the SECOND
// CONSUMER — the measuring instrument this very gate exists to serve, which lives in this repository (`app/quiz.html`,
// `app/js/consumer-quiz/`). An engine test naming them points at the ruler, not at a dependency on a game (e.g.
// `an-offered-font-loads.node.test.js` reads the engine's host to prove it loads the font sheet).
//
// The exception is NARROW on purpose: it erases only those names before matching, so `quiz` alone, `quizLevel` and
// `quizlevel` are still accused — and a case at the end of this file proves it. The THREE names the second consumer has
// on disk, and nothing else: the folder, the page and the module. `main-quiz` is there because `\bquiz\b` matches after
// the hyphen.
const CONSUMIDOR_DE_PROVA = /quiz\.html|consumer-quiz|main-quiz/gi;
const VOCAB_JOGO_RE = /\b(coin|coins|coinTarget|coinTex\w*|coinCanvas\w*|moeda|moedas|quiz|quizLevel|quizlevel)\b/i;
const VOCAB_JOGO = { test: (linha) => VOCAB_JOGO_RE.test(String(linha).replace(CONSUMIDOR_DE_PROVA, '')) };
const MOEDA = VOCAB_JOGO;

/** KNOWN VOCABULARY debt — it only shrinks, same rule. */
const MOEDA_CONHECIDA = new Set([
  // Modules leave this list by removing the SUBJECT, not by renaming: the HUD counter receives an `Objective` (contract
  // field 5) with an injected icon; sonar navigation (`platform/audio-sonar`) receives the contract's topology, targets
  // and names; a state that cannot declare its own type (`coins: unknown[]`) belongs to the game.
  //
  // 📌 Removing only the accused line is not the fix: the gate would go green with the problem in place. A table of one
  // game's events belongs to the game; the engine keeps the SYNTHESIS. The engine delivers an INTENT
  // (`left`/`right`/`up`/`down`/`confirm`/`erase`) and a boolean `modalOpen[i]`, not the challenge (ADR-0033); it asks
  // for a BOOLEAN (`ctx.padAllowed()`), not the state.
  /**
   * `platform/storage-keys.ts` STAYS, and the reason is the opposite of debt — written so nobody "cleans it up". (The key
   * table left `platform/storage` for it, ADR-0232; the entry moved with the table.)
   *
   * The entry is `quizlevel: gameKey('quizlevel')`, and `gameKey()` is exactly the engine's mechanism for GAME-SCOPED
   * keys (ADR-0028, two scopes). The other game-scoped keys live in the same registry for the same reason and nobody
   * accuses them — they just contain no word of the matcher.
   *
   * That is: this line is the matcher noticing a WORD, not the boundary noticing a leak. Removing it while leaving the
   * others would be fooling the gate, the opposite of what it exists for.
   */
  'platform/storage-keys.ts',
  // 📌 A sprite id comes from the game (`ctx.itemTexId`): the texture cache keys by `(id, modo)` and does not know what the
  // id means.
]);

describe('fronteira engine↔jogo — o vocabulário do ADR', () => {
  it('[Right] nenhum módulo de engine NOVO passa a falar de moeda no código', () => {
    // The failure QUOTES the line. A boundary test that says only "this file" sends the person looking for what they
    // would look for anyway — and the line is often an end-of-line comment, a false positive that would take ten minutes
    // to recognise as such.
    const novos = MODULOS.filter((m) => !MOEDA_CONHECIDA.has(m))
      .flatMap((m) => linhasDeCodigo(fonte(m)).filter(([, ln]) => MOEDA.test(ln)).map(([n, ln]) => `${m}:${n}  ${ln.trim()}`));
    expect(novos, 'módulo de engine falando de moeda — o corte não pegou aqui').toEqual([]);
  });

  it('[Right] `ui/hud` não conhece a constante do jogo NEM o assunto dele — os dois tempos do conserto', () => {
    // ADR-0027's literal case: a `vphudHtml(coinTarget = COIN_TARGET)` would mean the boundary is wrong. Three assertions,
    // one per layer: no DEPENDENCY on the game's constant, no SUBJECT (a whole `Objective` enters, the icon is injected),
    // and the HUD does not read the player's `collected`.
    expect(fonte('ui/hud.ts'), 'a dependência').not.toMatch(/from '\.\.\/core\/constants\.js'/);
    expect(fonte('ui/hud.ts'), 'o assunto').toMatch(/vphudHtml\(objective: Objective, icon: string\)/);
    // Against the CODE ROWS, not the file: this module's prose may explain that `collected` left, and a sieve confusing the
    // explanation with the use would fail precisely whoever documented the fix. The same trap `getPhase` once set.
    const usaCollected = linhasDeCodigo(fonte('ui/hud.ts')).some(([, ln]) => /collected/.test(ln));
    expect(usaCollected, 'o progresso vinha do jogador e agora vem do objetivo').toBe(false);
  });

  it('[Zero] a lista de dívida de vocabulário não guarda módulo que já se limpou', () => {
    for (const m of MOEDA_CONHECIDA) {
      const sujo = linhasDeCodigo(fonte(m)).some(([, ln]) => MOEDA.test(ln));
      expect(sujo, `${m} já não fala de moeda — apague-o de MOEDA_CONHECIDA`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
// 3. THE TESTS' FIXTURES — the proof ADR-0027 calls decisive.
//
//    «Um teste de um módulo de ENGINE cujo fixture precisa de uma MOEDA é prova de que o corte não pegou. Não dá para
//     ver isso lendo o módulo — só lendo o teste dele.» (ADR-0027)
//
//    The sections above read MODULES. This one reads TESTS, and the difference is not symmetry: a module can look
//    generic and only reveal its coupling when someone tries to build its ctx. That is how the second consumer
//    (`consumer-quiz`) found the sonar asking for `getCoins` — not by reading it, but by trying to use it. The fixture is
//    where the demand appears in writing.
//
//    THE RULE IS NARROW ON PURPOSE: only COIN and QUIZ. "Cenário" is not in, and here is why — a scenery catalogue is real
//    engine work, while the VALUE chosen persists under a `gameKey()` and travels with the cartridge: two things with
//    the same name in different layers. Putting `cenario` in the rule would produce a "debt" list nobody can pay because
//    nothing is wrong with it — and a gate pointing at the right place for the wrong reason trains people to ignore it.
// ---------------------------------------------------------------------------------------------------------

const T_DIR = join(process.cwd(), 'tests');
// (`VOCAB_JOGO` is declared in section 2 — the SAME matcher, of which there is only one.)
// STATIC **AND** DYNAMIC IMPORT. Seeing only `from '…'` is BLIND to every test that loads the module with
// `await import('…')` — which some do by necessity, to install a `localStorage` shim BEFORE the module touches
// persistence. A gate blind in silence is what this whole file exists not to be.
const DE = String.raw`(?:from |await import\()'\.\./app/js/`;
const IMPORTA_ENGINE = new RegExp(DE + '(core|input|render|platform|ui|audio|i18n)/');
const IMPORTA_JOGO = new RegExp(DE + 'game/');
/** A case title: `it('… moeda …')` is PROSE, and prose describes the game without tying the test to it. */
const TITULO_DE_CASO = /^\s*(it|describe|test)\s*\(/;

/**
 * KNOWN debt: how many CODE lines of each test talk about coin/quiz. It is a CEILING — it only shrinks. Adding vocabulary
 * to one of these files fails; a new file on the list fails.
 */
// ⚠️ THE NUMBERS COME FROM HERE, not from a separate measurement: an outside script once counted LESS (it forgot
// `coinCanvas`), and the gate rightly failed. Whoever updates this table, update it by what THIS file reports.
const FIXTURES_CONHECIDOS = {
  // The core of the debt would be a module's ctx DEMANDING a coin or a quiz to be built. Fixtures leave this list when the
  // coupling does: a sprite registry by id (`sprites()`, the engine caches by `(id, modo)`, fixtures declare a sprite
  // named 'alvo'), an OBJECTIVE instead of `collected`/`coins` (default name 'itens'), a boolean per position instead of
  // a fake challenge object (ADR-0033), a declared policy instead of `core/state` pokes. A fixture that said "coin" on
  // every line would reaffirm out of habit what the cut took from the module.

  // 📌 A dynamic label arrives ready (the fixture passes `() => null` or any string), and a fixture earcon is 'alvo' with a
  // key that does not exist in the dictionary — `t()` returns the key itself, so the case asserts the caption comes out
  // without depending on any language.
  'i18n-dicts.node.test.js': 3,        // `sr.quiz.*`: keys a second game mostly does not use (finding 2)
  'storage-scopes.node.test.js': 2,   // `quizlevel` in the key registry — the key the namespace isolates
};

/**
 * Tests whose vocabulary is PROSE or an assertion, not a dependency on the game: prose that describes the game (or a test
 * proving a name is absent) is not coupling to it. Each entry carries its reason, and the case below forbids an entry
 * that no longer applies.
 */
const PROSA_EM_STRING = new Set([
  /*
   * ⚠️ THIS FILE NAMES `coinTarget` TO ASSERT IT DOES NOT EXIST: `expect(CODIGO).not.toMatch(/coinTarget/)` — ADR-0027's
   * verdict as a sieve. Counting it as a dependency would invert the record: it would accuse of dirt exactly the test
   * that proves the cleanliness.
   *
   * 📌 Not a loosening: `IMPORTA_ENGINE` matches `core|input|render|platform|ui|audio|i18n` and NOT `boot`, so the file
   * only qualifies as an engine test because it also imports `input/` modules (to measure mapping by behaviour) — which
   * is how the sieve came to see a line that was always there.
   */
  'boot-create-game.node.test.js',
]);

/** A test's CODE lines, without comments and without case titles. */
function linhasDeFixture(arquivo) {
  const txt = readFileSync(join(T_DIR, arquivo), 'utf8').split(CR).join('');
  return linhasDeCodigo(txt).filter(([, ln]) => !TITULO_DE_CASO.test(ln));
}

/** Tests that exercise an ENGINE module and none of `game/`. A `game/` test talks about the game by duty. */
function testesDeEngine() {
  return readdirSync(T_DIR).filter((f) => f.endsWith('.test.js')).sort().filter((f) => {
    const s = readFileSync(join(T_DIR, f), 'utf8').split(CR).join('');
    return IMPORTA_ENGINE.test(s) && !IMPORTA_JOGO.test(s);
  });
}

/** How many code lines of this test talk about coin/quiz. */
function sujeira(arquivo) {
  return linhasDeFixture(arquivo).filter(([, ln]) => VOCAB_JOGO.test(ln)).length;
}

describe('fronteira engine↔jogo — os FIXTURES dos testes (ADR-0027, a prova decisiva)', () => {
  it('[Right] nenhum teste de engine NOVO precisa de moeda ou de quiz para rodar', () => {
    const novos = testesDeEngine()
      .filter((f) => !(f in FIXTURES_CONHECIDOS) && !PROSA_EM_STRING.has(f))
      .flatMap((f) => linhasDeFixture(f).filter(([, ln]) => VOCAB_JOGO.test(ln))
        .map(([n, ln]) => `${f}:${n}  ${ln.trim().slice(0, 90)}`));
    expect(novos, 'fixture de engine exigindo moeda/quiz — o corte não pegou aqui').toEqual([]);
  });

  it('[Boundary] a dívida de cada teste é um TETO: só encolhe', () => {
    // A ceiling, not equality: a test gains and loses lines for a thousand reasons unrelated to coins, and a case failing
    // at every innocent edit would be loosened at the first rush. What it forbids is the one thing that matters — the
    // coupling GROWING.
    const cresceram = {};
    for (const [f, teto] of Object.entries(FIXTURES_CONHECIDOS)) {
      const agora = sujeira(f);
      if (agora > teto) cresceram[f] = `${teto} → ${agora}`;
    }
    expect(cresceram, 'fixture ficou MAIS acoplado ao jogo').toEqual({});
  });

  it('[Zero] a lista não guarda teste que já se limpou', () => {
    for (const f of Object.keys(FIXTURES_CONHECIDOS)) {
      expect(sujeira(f), `${f} já não fala de moeda/quiz — apague-o de FIXTURES_CONHECIDOS`).toBeGreaterThan(0);
    }
  });

  it('⚠️ [Interface] a exceção do CONSUMIDOR DE PROVA é estreita — `quiz` sozinho continua acusado', () => {
    // Without this case the exception would be a hole any mention could pass through by writing `quiz.html`. What it
    // forgives is the NAME of a file of this repository; the game's concept still counts.
    expect(VOCAB_JOGO.test("const host = ler('app', 'quiz.html');"), 'o host da engine não é dívida').toBe(false);
    expect(VOCAB_JOGO.test("import x from '../app/js/consumer-quiz/main-quiz.js';")).toBe(false);
    expect(VOCAB_JOGO.test('const q = { quiz: null };'), '`quiz` sozinho tem de continuar acusado').toBe(true);
    expect(VOCAB_JOGO.test('const n = quizLevel;')).toBe(true);
    expect(VOCAB_JOGO.test('const alvo = coinTarget;')).toBe(true);
    // ⚠️ AND A KNOWN LIMIT OF THE MATCHER, measured: `setQuizLevel(3)` is NOT caught, because `\b` demands a boundary and
    // there is none between `set` and `Quiz`. Not a regression of this exception — the sieve was always like this, written
    // so the next reader does not rediscover it.
    expect(VOCAB_JOGO.test('setQuizLevel(3);'), 'limite conhecido: sem fronteira, não casa').toBe(false);
    // ⚠️ And the case that separates the two: the same line with both things is still accused.
    expect(VOCAB_JOGO.test("ler('app','quiz.html'); const c = coins;")).toBe(true);
  });

  it('[Interface] a exceção de prosa é REAL — se o texto sumir, a exceção some junto', () => {
    // Without this case, `PROSA_EM_STRING` would become an escape hatch: putting a file there would be enough for the gate
    // to stop looking at it. When an entry's text leaves (as a sentence moved to the dictionary once did), this case
    // fails and the entry must leave too.
    for (const f of PROSA_EM_STRING) {
      const linhas = linhasDeFixture(f).filter(([, ln]) => VOCAB_JOGO.test(ln));
      expect(linhas.length, `${f}: a exceção não se aplica mais`).toBeGreaterThan(0);
    }
    expect(PROSA_EM_STRING.size, 'lista de exceções cresceu — cada entrada precisa do motivo escrito').toBeLessThan(3);
  });

  it('[Interface] a dívida dos fixtures cai nos MESMOS subsistemas que a dos módulos', () => {
    // What this section guards is the WAY BACK: the subsystems whose fixtures left must not need coin/quiz again.
    // Each left by a mechanism worth repeating: `hud` changed the QUESTION (an `Objective`); `audio-sonar` received the
    // contract; `high-contrast` lost the game object's SHAPE (sprites by id); `viewports` followed it; `keydown`/`gamepad`
    // deliver an INTENT and the game decides (ADR-0033); `pause-icons` receives the LABEL ready.
    //
    // The TWO left are not the same kind as those, written because a number alone invites "zeroing the list", which is how
    // a gate starts lying:
    //   · `i18n-dicts` (3)       — the `sr.quiz.*` keys. The second consumer's FINDING 2 (dead weight in the dictionary),
    //     not coupling.
    //   · `storage-scopes` (2)   — the `quizlevel` key, for the same reason as `platform/storage`: `gameKey()` IS the
    //     game-scope mechanism, and the word is what catches the matcher's eye.
    // Both are the matcher noticing a WORD, not the boundary noticing a leak.
    expect(Object.keys(FIXTURES_CONHECIDOS)).toHaveLength(2);
    const porSubsistema = new Set(Object.keys(FIXTURES_CONHECIDOS).map((f) => f.split('.')[0]));
    for (const limpo of ['hud', 'audio-nav', 'audio-sonar', 'high-contrast', 'viewports', 'keydown', 'gamepad', 'pause-icons']) {
      expect(porSubsistema, `${limpo} voltou a precisar de moeda/quiz no fixture — o item 19 andou para trás`)
        .not.toContain(limpo);
    }
  });
});

// -----------------------------------------------------------------------------------------------------------
describe('A RAIZ DE COMPOSICAO SAIU — e este ficheiro mudou de assunto, como ele proprio previu', () => {
  // The cartridge left this repository (issue #111). What is asserted is the property after that, stronger than any
  // ceiling: no root file imports from `game/`, there is no `game/` folder, and so no edge to one. The boundary needs no
  // ceiling because it has no door.
  const RAIZ_TS = readdirSync(RAIZ).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
  const arestasDeJogo = (ficheiro) =>
    (readFileSync(join(RAIZ, ficheiro), 'utf8').split(CR).join('').match(/from '\.\/game\//g) || []).length;

  it('[Zero] ⚠️ NENHUM ficheiro de raiz importa de `game/` — a porta fechou-se saindo', () => {
    const portas = RAIZ_TS.filter((f) => arestasDeJogo(f) > 0);
    expect(portas, 'nasceu uma raiz que importa um jogo: o cartucho esta a voltar').toEqual([]);
  });

  it('[Zero] e nao ha `app/js/game/` para importar', () => {
    // The other half. Without it, the case above would stay green forever for having nothing to match — the gate failing
    // OPEN, the kind this repository names in writing in other files.
    expect(existsSync(join(RAIZ, 'game')), 'o cartucho voltou para dentro da engine').toBe(false);
  });

  it('[Interface] e a raiz de composicao que sobra e' + "'" + ' a do CONSUMIDOR DE PROVA, nao a de um jogo', () => {
    // `consumer-quiz` stays: it exists to measure the engine↔game boundary from outside, with a fake game the engine
    // controls. It is the difference between having a consumer and being a game.
    expect(existsSync(join(RAIZ, 'consumer-quiz')), 'o consumidor de prova tambem foi embora').toBe(true);
  });
});

// ==========================================================================================================
// ⚠️ `educational/` IMPORTS NOTHING — and «nada» includes a package, which the sibling case does not see
//
// The `CLAUDE.md` rule («`educational/` … e DADO: nao importa nada») is also measured by the `[Boundary]` case above, the
// curriculum importing neither engine nor game. WHAT THIS BLOCK ADDS, measured: that case looks for `from '../`, a
// RELATIVE import out of the folder. An `import { Application } from 'pixi.js'` — a bare specifier — goes right past it.
// Checked by mutation: with the package import, only this block's case fails.
//
// And the difference matters because of the layer's destination. `educational/` exists to travel to
// `the-inclusionist-knowledge-tree` (ADR-0058) WITHOUT dragging code behind it; a `pixi.js` in there breaks that as well
// as a `../core/`. So the question here is the widest possible: is there an `import`, an `import()` or a `require()` on
// a code line? If so, the layer stopped being data.
// ==========================================================================================================
describe('educational/ e DADO: nao importa nada (CLAUDE.md, ADR-0032)', () => {
  const FICHEIROS = existsSync(join(RAIZ, 'educational'))
    ? readdirSync(join(RAIZ, 'educational')).filter((f) => f.endsWith('.ts'))
    : [];

  it('[Interface] a camada existe e tem ficheiros — senao o caso abaixo nao mede nada', () => {
    expect(FICHEIROS.length, 'nao ha `app/js/educational/`; a regra ficou sem sujeito').toBeGreaterThan(0);
  });

  it('⚠️ [Zero] NENHUM ficheiro de educational/ tem um import', () => {
    const comImport = [];
    for (const f of FICHEIROS) {
      for (const [n, ln] of linhasDeCodigo(fonte('educational/' + f))) {
        if (/(^|[^\w$])(import\s|import\(|require\()/.test(ln)) comImport.push(`educational/${f}:${n}: ${ln.trim()}`);
      }
    }
    expect(comImport, 'o curriculo passou a depender de codigo; ele deixa de viajar sozinho').toEqual([]);
  });

  it('⚠️ [Cross-check] o crivo APANHA um import — senao o [Zero] estaria verde por nao olhar nada', () => {
    // The two forms that exist, plus the dynamic one. Without this proof, a broken regex would leave the rule with no
    // owner.
    const amostras = [
      "import { ACTIONS } from '../core/actions.js';",
      "import type { Role } from '../core/contract.js';",
      "const m = await import('../core/tiles.js');",
      "const x = require('node:fs');",
    ];
    for (const ln of amostras) {
      expect(/(^|[^\w$])(import\s|import\(|require\()/.test(ln), `deixaria passar: ${ln}`).toBe(true);
    }
    // And it must not confuse the WORD with the construct: that layer's header says «importa» in prose.
    expect(/(^|[^\w$])(import\s|import\(|require\()/.test('a que importa mais e acertar de primeira')).toBe(false);
  });
});

// ========================= MUTATIONS CHECKED (the `educational` block) =========================
//   · `import { ACTIONS } from '../core/actions.js';` in `adaptive-engine` → TWO fail: the sibling `[Boundary]` (which
//     sees the `from '../`) and this block's `[Zero]`. Useful redundancy: the property has two owners.
//   · ⚠️ `import { Application } from 'pixi.js';` → ONLY this block's `[Zero]` fails. It is why it exists: the sibling
//     case looks for relative imports and a bare specifier goes right past it.
//   · replacing the regex with one that demands `from` → the [Cross-check] fails on the `import()` and `require()`
//     samples, the two forms without `from`.
