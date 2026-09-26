// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT SURVIVES `tsc` AND LIES ON THE OTHER SIDE — the gate of ADR-0072 §4.
//
// ========================= WHAT THIS FILE EXISTS TO PREVENT =========================
// A package build (`tsc -p tsconfig.pkg.json`) can exit 0 and still emit code no consumer can run. Two Vite-only
// constructs did exactly that:
//
//   · `import.meta.glob('../i18n/*.ts')`, COPIED INTACT. `tsc` is not Vite: it does not know the construct and treats it
//     as an ordinary call. In a consumer that does not transform it, `import.meta.glob` is `undefined` and blows up on
//     load; in one that does, the `*.ts` pattern matches ZERO files beside an output that only has `.js`, and every
//     language other than pt would turn into Portuguese with no error at all.
//   · `import { ATLAS_URL, FRAMES } from 'virtual:sprite-atlas'`, a module that exists only inside one repository's
//     build plugin.
//
// ========================= WHY THE SIEVE IS ON THE SOURCE AND NOT THE OUTPUT =========================
// Testing `dist-pkg/` would require the build to have run, and a gate that only works after a step someone can forget
// is a gate that fails OPEN — the worst kind, because it looks green. The property that matters belongs to the SOURCE:
// a module that only compiles under Vite cannot be published, and that is read without compiling.
//
// ========================= AND THE LAYER LIST COMES FROM THE CONFIG ITSELF =========================
// `tsconfig.pkg.json` is read here instead of the list being copied. Copying would be the classic drift: someone adds a
// layer to the package, the gate keeps watching the old ones, and the new module travels with nobody looking.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { specifiersOf } from '../scripts/lib/module-specifiers.mjs';
import { sourceText, specifiersOfFile } from './fixtures/parsed-sources.js';

const RAIZ_REPO = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const CR = String.fromCharCode(13);

/** `tsconfig.pkg.json`, without the `//N` comments TypeScript tolerates and `JSON.parse` does not. */
function lerConfigDoPacote() {
  const bruto = readFileSync(join(RAIZ_REPO, 'tsconfig.pkg.json'), 'utf8').split(CR).join('');
  return JSON.parse(bruto);
}

const CFG = lerConfigDoPacote();
const EXCLUIDOS = new Set((CFG.exclude ?? []).map((p) => p.split('\\').join('/')));

/** The `.ts` files the package actually SHIPS: what `include` reaches, minus what `exclude` removes. */
function modulosDoPacote() {
  const out = [];
  for (const entrada of CFG.include ?? []) {
    const abs = join(RAIZ_REPO, entrada);
    if (!existsSync(abs)) continue;
    if (statSync(abs).isDirectory()) {
      for (const f of readdirSync(abs)) {
        if (!f.endsWith('.ts')) continue;
        const rel = `${entrada}/${f}`.split('\\').join('/');
        if (!EXCLUIDOS.has(rel)) out.push(rel);
      }
    } else if (!EXCLUIDOS.has(entrada.split('\\').join('/'))) {
      out.push(entrada.split('\\').join('/'));
    }
  }
  return out.sort();
}

const MODULOS = modulosDoPacote();
// ⚠️ Each shipped module is READ ONCE AND PARSED ONCE for the whole file (`tests/fixtures/parsed-sources.js`): three cases
// below ask the package's specifiers, and parsing it once per case is what pushed them past the 5 s ceiling under the load
// of several suites at once. The sample lines of the `[Cross-check]` cases are still parsed on the spot.
const fonte = (rel) => sourceText(join(RAIZ_REPO, rel));
const especificadoresDe = (rel) => specifiersOfFile(join(RAIZ_REPO, rel));

/** CODE lines. Prose that MENTIONS `import.meta.glob` is not `import.meta.glob` — and this file and `core/i18n` are full of
 *  prose mentioning it, precisely to explain why it left. */
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

/** Constructs ONLY Vite understands. Each survives `tsc` with no warning, which is what makes them dangerous. These two are
 *  TEXT, read on code lines. */
const SO_NO_VITE = [
  { nome: 'import.meta.glob', re: /import\s*\.\s*meta\s*\.\s*glob\s*[<(]/ },
  { nome: '__BUILD__ (define do Vite)', re: /\b__BUILD__\b/ },
];
/** And these two are SPECIFIERS, read by the TypeScript parser in every import form: a side-effect `import 'virtual:…'`
 *  and an `import('./x?raw')` escaped a pattern over `from '…'`. Type-only imports count — the emitted `.d.ts` keeps
 *  them, and a consumer's `tsc` cannot resolve a `virtual:` module either. */
const SO_NO_VITE_ESPECIFICADOR = [
  { nome: "import de 'virtual:'", casa: (s) => s.startsWith('virtual:') },
  { nome: 'import com sufixo ?raw/?url/?worker', casa: (s) => /\?(raw|url|worker|inline)$/.test(s) },
];

/** [line, construct] for everything the sieve catches in a source text (whose specifiers are parsed unless handed in). */
function construcoesDoVite(texto, especificadores = specifiersOf(texto)) {
  const achados = [];
  for (const [n, linha] of linhasDeCodigo(texto)) {
    for (const { nome, re } of SO_NO_VITE) if (re.test(linha)) achados.push([n, nome]);
  }
  for (const { spec, line } of especificadores) {
    for (const { nome, casa } of SO_NO_VITE_ESPECIFICADOR) if (spec && casa(spec)) achados.push([line, nome]);
  }
  return achados;
}

/** [module, line, construct] for everything the sieve catches. */
function ocorrencias(modulos = MODULOS) {
  return modulos.flatMap((m) => construcoesDoVite(fonte(m), especificadoresDe(m)).map(([n, nome]) => [m, n, nome]));
}

describe('o pacote publicável não carrega construção que só o Vite entende (ADR-0072 §4)', () => {
  it('[Interface] o config nomeia camadas que EXISTEM, e alcança módulos', () => {
    for (const entrada of CFG.include ?? []) {
      expect(existsSync(join(RAIZ_REPO, entrada)), `tsconfig.pkg.json inclui ${entrada}, que não existe`).toBe(true);
    }
    expect(MODULOS.length).toBeGreaterThan(50);
  });

  it('[Zero] NENHUM módulo embarcado usa construção exclusiva do Vite', () => {
    const achados = ocorrencias();
    const legivel = achados.map(([m, n, nome]) => `${m}:${n} — ${nome}`);
    expect(legivel, 'sobrevive ao tsc e quebra (ou mente) do outro lado').toEqual([]);
  });

  // ⚠️ `render/sprites` (the `virtual:sprite-atlas` importer) is not in this repository (issue #111): what is not in the
  // tree cannot enter the package, so the property is guaranteed by CONSTRUCTION.

  it('[Cross-check] o crivo ainda pega o que os DOIS achados de 05/09 eram', () => {
    const amostras = [
      "const loaders = import.meta.glob<{ default: LocaleDict }>('../i18n/*.ts');",
      "import { ATLAS_URL, FRAMES } from 'virtual:sprite-atlas';",
      "const v = String(__BUILD__.version);",
      // and the forms without `from`, which load the same module
      "import 'virtual:sprite-atlas';",
      "const atlas = await import('virtual:sprite-atlas');",
      "const svg = await import('./icon.svg?raw');",
    ];
    for (const linha of amostras) {
      expect(construcoesDoVite(linha), `o crivo deixaria passar: ${linha}`).toHaveLength(1);
    }
  });

  it('[Exception] prosa que MENCIONA a construção não conta — senão o gate proibiria explicar-se', () => {
    const comentada = '// os locales entram por import.meta.glob(...), e foi por isso que saíram';
    expect(linhasDeCodigo(comentada)).toEqual([]);
  });
});

// ===================================================================================================
// THE SECOND SIEVE: WHAT THE PACKAGE NAMES MUST BE WHAT IT DECLARES
// ===================================================================================================
// ⚠️ WHAT THIS BLOCK EXISTS TO PREVENT came from OUTSIDE: a real consumer installed
// `@the-inclusionist/engine@6.36.1` from the registry and its build stopped at
//
//     Rolldown failed to resolve import "@example/neural-voice"
//     from ".../@the-inclusionist/engine/dist-pkg/platform/tts.js"
//
// `platform/tts` was SHIPPED code naming that package, and `package.json` declared it in `devDependencies`, which npm
// does NOT install for a consumer. So the published version could not be built by anyone — and nothing in here could
// know, because in this repository the package is present (a devDependency of this very tree) and everything resolves.
//
// ⚠️ AND THE DEFECT HID IN THE DYNAMIC FORM: `import('@example/neural-voice')` inside a function, not a top-level `from`.
// A sieve written only for `from '...'` would stay green over it forever. That is why the `[Right]` below holds BOTH
// forms by name.
//
// WHY THIS IS A `[Zero]` AND NOT A SHRINKING CEILING: the honest residue is empty, so any entry is a defect — there is no
// legitimate debt to tolerate.
describe('todo pacote que o código embarcado NOMEIA é declarado como dependência de execução', () => {
  const PKG = JSON.parse(readFileSync(join(RAIZ_REPO, 'package.json'), 'utf8'));
  const DECLARADOS = new Set([
    ...Object.keys(PKG.dependencies ?? {}),
    ...Object.keys(PKG.peerDependencies ?? {}),
  ]);


  /** The PACKAGE NAME, not the path: `@scope/nome/sub.js` → `@scope/nome`; `foo/bar` → `foo`. */
  function nomeDoPacote(spec) {
    const p = spec.split('/');
    return spec.startsWith('@') ? p.slice(0, 2).join('/') : p[0];
  }

  /** Third-party names, as [line, package]. Relative, absolute, `node:` and `virtual:` are not npm packages — and
   *  `virtual:` is already failed by the sieve above, so failing it here again would only duplicate the error.
   *  📌 Read by the TypeScript parser, in every form a module names another: `from`, side-effect `import`, re-export,
   *  literal `import()`, `require()`. A pattern had missed `require()`, and the parser also skips comments and strings. */
  function pacotesNomeados(especificadores) {
    const out = [];
    for (const { spec: s, line } of especificadores) {
      if (!s || s.startsWith('.') || s.startsWith('/') || s.startsWith('node:') || s.startsWith('virtual:')) continue;
      out.push([line, nomeDoPacote(s)]);
    }
    return out;
  }
  const especificadoresNus = (texto) => pacotesNomeados(specifiersOf(texto)).map(([, nome]) => nome);

  /** [module, line, package] for everything the shipped modules name — over the parse the first sieve already made. */
  function nomeados(modulos = MODULOS) {
    return modulos.flatMap((m) => pacotesNomeados(especificadoresDe(m)).map(([n, nome]) => [m, n, nome]));
  }

  it('[Zero] NENHUM módulo embarcado nomeia pacote fora de dependencies/peerDependencies', () => {
    const orfaos = nomeados()
      .filter(([, , nome]) => !DECLARADOS.has(nome))
      .map(([m, n, nome]) => `${m}:${n} — ${nome}`);
    expect(orfaos, 'devDependency não é instalada para quem consome: o pacote publicado não compila').toEqual([]);
  });

  it('[Right] o crivo enxerga a forma DINÂMICA, que é a forma em que o defeito veio', () => {
    const dinamica = "    import('@example/neural-voice').then(async (mod) => {";
    const estatica = "import { Application } from 'pixi.js';";
    const lateral = "import 'algum-polyfill';";
    const exigido = "const pad = require('left-pad');";
    const reexportado = "export * from '@scope/utilidades';";
    expect(especificadoresNus(dinamica)).toEqual(['@example/neural-voice']);
    expect(especificadoresNus(estatica)).toEqual(['pixi.js']);
    expect(especificadoresNus(lateral)).toEqual(['algum-polyfill']);
    expect(especificadoresNus(exigido)).toEqual(['left-pad']);
    expect(especificadoresNus(reexportado)).toEqual(['@scope/utilidades']);
  });

  it('[Right] o NOME do pacote sobrevive ao subcaminho — senão um `pixi.js/lib/x` viraria órfão', () => {
    expect(nomeDoPacote('@scope/nome/sub/coisa.js')).toBe('@scope/nome');
    expect(nomeDoPacote('pixi.js/lib/environment.mjs')).toBe('pixi.js');
    expect(nomeDoPacote('pixi.js')).toBe('pixi.js');
  });

  it('[Boundary] relativo, `node:` e `virtual:` NÃO são pacotes do npm', () => {
    expect(especificadoresNus("import * as store from './storage.js';")).toEqual([]);
    expect(especificadoresNus("import { readFileSync } from 'node:fs';")).toEqual([]);
    expect(especificadoresNus("import { FRAMES } from 'virtual:sprite-atlas';")).toEqual([]);
  });

  it('[Zero] e a recíproca: nada é declarado como dependência de execução sem alguém embarcado o nomear', () => {
    const usados = new Set(nomeados().map(([, , nome]) => nome));
    const naoUsados = [...DECLARADOS].filter((d) => !usados.has(d));
    expect(naoUsados, 'dependência de quem CONSOME que ninguém embarcado importa — se é só do app, é devDependency').toEqual([]);
  });

  it('[Exception] prosa que MENCIONA o pacote não conta — este arquivo o menciona sete vezes', () => {
    const comentada = "// a lib vem do npm: import('@example/neural-voice'), code-split pelo Vite";
    expect(especificadoresNus(comentada)).toEqual([]);
  });
});

/* ===================================================================================================
 * THE FOURTH SIEVE: THE ENGINE GAINS NO RUN-TIME DEPENDENCY — the POLICY, which the three above do not see
 * ===================================================================================================
 *
 * 🎯 THE HOLE IS ONE OF CONSTRUCTION, not coverage. The sieves above measure COHERENCE — that what the code names is
 * declared, and that what is declared someone names. Both stay GREEN if someone adds `onnxruntime-web` to
 * `dependencies` **and** imports it: the two halves agree, and 135 MB enter every consumer's `npm ci`.
 *
 * ⚠️ And ADR-0093 unintentionally pushes the same way: «o que o código embarcado NOMEIA, o pacote tem de declarar». Read
 * alone, it says the way out for a new import is adding the dependency. The two rules together say something else, and
 * that is what is written here: **the engine imports nothing heavy**.
 *
 * 📏 THE POLICY COMES FROM FOUR RECORDS SAYING THE SAME BY DIFFERENT ROUTES: ADR-0094 measured the 135 MB and refused them
 * to the cartridge; ADR-0114 took runtime and models out of the package; ADR-0117 put delivery on the PLATFORM because
 * Cache Storage is per origin; and ADR-0119 extended the list to art. The `dependencies` door is where the decision
 * would be reversed without anyone taking it, and this is its gate. */
describe('ADR-0119 · a engine não ganha dependência de execução, e cada `peer` diz porquê', () => {
  const PKG = JSON.parse(readFileSync(join(RAIZ_REPO, 'package.json'), 'utf8'));

  /**
   * The dependencies of whoever CONSUMES, each with a hand-written reason.
   *
   * ⚠️ THE LIST MUST SHRINK and cannot grow silently: a new entry without a reason fails, and so does a reason whose
   * dependency no longer exists — or it would excuse in advance whatever came to occupy the same name.
   */
  const PEERS_COM_RAZAO = {
    'pixi.js':
      'O RENDERIZADOR É DO CONSUMIDOR, e tem de ser: duas cópias de PIXI no mesmo documento são dois ' +
      'contextos de WebGL e duas caches de textura. `peer` é a forma de dizer «traz o teu», e é por isso ' +
      'que ele não é uma dependência normal. Sai daqui no dia em que a engine deixar de desenhar.',
  };

  /**
   * THE RUN-TIME DEPENDENCIES A RECORD DECIDED, each with its reason — and nothing else. The list was empty, and the door
   * stays narrow: an entry here is a decision the Dev took, not a convenience.
   */
  const DEPENDENCIAS_COM_RAZAO = {
    three:
      'THE FREE LIBRAS PLAYER DRAWS WITH IT (ADR-0234 errata, route B): three.js 0.186.1, MIT, decided by the Dev on 2026-09-25. ' +
      'It is reached ONLY by the dynamic `import()` of `ui/libras-avatar-stage` at the first sign in deaf mode, so a game ' +
      'whose child never turns deaf mode on never downloads it — the gate below holds that reach.',
  };

  it('🎯 [Zero] a engine não ganha dependência de execução que um registo não decidiu', () => {
    const deps = Object.keys(PKG.dependencies ?? {});
    expect(
      deps.filter((d) => !(d in DEPENDENCIAS_COM_RAZAO)),
      'a engine ganhou uma dependência de execução: cada `npm ci` de quem a consome passa a pagá-la, ' +
        'e é por essa porta que o ADR-0094 seria revertido sem ninguém decidir. Coisa pesada vai pela ' +
        `PLATAFORMA (ADR-0117/0119), nunca pelo pacote. Achado: ${deps.join(', ')}`,
    ).toEqual([]);
    expect(Object.keys(DEPENDENCIAS_COM_RAZAO).filter((d) => !deps.includes(d)), 'razão sem dependência; apague a entrada')
      .toEqual([]);
  });

  it('🔴 [Right] a dependência decidida vai FIXA na versão exacta — sem `^` nem `~`, o `npm ci` de quem consome traz outra', () => {
    expect(PKG.dependencies?.three, 'three.js was declared with a range, not the exact version ADR-0234 decided').toBe('0.186.1');
  });

  it('⚠️ [Interface] cada `peerDependency` carrega a razão, e a lista não cresce sozinha', () => {
    const peers = Object.keys(PKG.peerDependencies ?? {});
    const semRazao = peers.filter((p) => !(p in PEERS_COM_RAZAO));
    expect(semRazao, `\`peer\` novo sem razão escrita: ${semRazao.join(', ')}`).toEqual([]);
  });

  it('[Fronteira] razão cuja dependência já não existe SAI daqui', () => {
    // The exit half. Without it the list becomes a monument — the PIXI entry would go on explaining a `peer` that no
    // longer exists, and the next person would read history as state.
    const peers = new Set(Object.keys(PKG.peerDependencies ?? {}));
    const orfas = Object.keys(PEERS_COM_RAZAO).filter((p) => !peers.has(p));
    expect(orfas, `razão sem \`peer\` correspondente; apague a entrada: ${orfas.join(', ')}`).toEqual([]);
  });

  /* 🎯 AND THE CIRCLE CLOSES WITH THE SIEVE ABOVE, without repeating it. It asserts «nenhum módulo embarcado nomeia
   * pacote fora de `dependencies`/`peerDependencies`»; with `dependencies` held to the ones a record decided here, the
   * declarable set is those and the `peers` — and importing something heavy has no legal way out without a decision, exactly
   * what the four records want. (three.js is the one the Dev decided, ADR-0234 errata: reached late, by one module.) 📌 A third
   * copy of `nomeados()` would be the duplication this file refuses; the pair lives in reading the two sieves together,
   * and is written here. */
});

// ===================================================================================================
// THE THIRD SIEVE: WHAT THE PACKAGE EMITS, IT MUST LET CONSUMERS REACH
// ===================================================================================================
// ⚠️ The finding came from the CARTRIDGE SEPARATION (issue #111), not from reading: a game test, in the new repository,
// did `import pt from '@the-inclusionist/engine/i18n/pt.js'` and got
//
//     "./i18n/pt.js" is not exported under the conditions ["node","development","import"]
//
// `tsconfig.pkg.json` INCLUDES `app/js/i18n` — the dictionaries are emitted and travel in the tarball — and `exports` had
// no entry for them. Emitted and unreachable: weight in the package nobody can use, and a closed door for the consumer
// who wants to check a sentence against the dictionary instead of a copy.
//
// ⚠️ AND THE SIEVES ABOVE DO NOT SEE IT, by construction: that one looks at what the code NAMES, this one at what the
// package OFFERS. Different questions about the same `package.json`, and the first was green.
//
// THE EXCEPTION IS `boot`, and it is declared: its entry module is `create-game`, the package's `.` entry. An entry layer
// does not need a subpath — it needs to be reachable, and it is.
describe('toda camada EMITIDA é alcançável pelo `exports` (achado da issue #111)', () => {
  const PKG = JSON.parse(readFileSync(join(RAIZ_REPO, 'package.json'), 'utf8'));
  const SUBCAMINHOS = Object.keys(PKG.exports ?? {});

  /** The layers `tsconfig.pkg.json` says to emit: `app/js/<layer>` → `<layer>`. */
  const CAMADAS_EMITIDAS = (CFG.include ?? [])
    .filter((e) => e.startsWith('app/js/'))
    .map((e) => e.slice('app/js/'.length));

  /** `boot` enters through the `.` root (create-game), and is the ONLY layer that may have no subpath of its own. */
  const PELA_RAIZ = new Set(['boot']);

  it('[Interface] o `exports` tem uma raiz `.`, e ela aponta para dentro de `boot`', () => {
    const raiz = PKG.exports?.['.'];
    const alvo = typeof raiz === 'string' ? raiz : raiz?.default;
    expect(alvo, 'sem raiz não há `import { createGame } from "@the-inclusionist/engine"`').toBeTruthy();
    expect(alvo).toContain('/boot/');
  });

  it('[Zero] NENHUMA camada emitida fica sem porta — emitido e inalcançável é peso morto', () => {
    const semPorta = CAMADAS_EMITIDAS
      .filter((c) => !PELA_RAIZ.has(c))
      .filter((c) => !SUBCAMINHOS.some((s) => s.startsWith(`./${c}/`)));
    expect(semPorta, 'camada que o tarball carrega e o consumidor não consegue importar').toEqual([]);
  });

  it('[Right] e o crivo PEGA a lacuna real que a separação encontrou', () => {
    // `i18n` was exactly this case: included in the build, absent from `exports`. Without this proof, the `[Zero]` above
    // could be green for looking at nothing.
    const semI18n = SUBCAMINHOS.filter((s) => !s.startsWith('./i18n/'));
    const faltando = CAMADAS_EMITIDAS
      .filter((c) => !PELA_RAIZ.has(c))
      .filter((c) => !semI18n.some((s) => s.startsWith(`./${c}/`)));
    expect(faltando, 'o crivo deixaria a lacuna do i18n passar').toEqual(['i18n']);
  });

  /**
   * ⚠️ PORTS THAT PROMISE MORE THAN THEY DELIVER, exempted by name with a reason. The list is EMPTY: the wide
   * `"./assets/*": "./app/public/*"` port — which matched the whole folder while `files` ships only `app/public/vendor` —
   * was removed (#119, recorded in `docs/6-DevOps-SRE/Breaking-Changes.md`). The narrow `./assets/vendor/*` promises
   * exactly what travels, and `engine/assets/vendor/fonts.css` matches it.
   *
   * What is right is the ABSENCE: art is NOT FOSS (pillar 10 of ADR-0010) and cannot travel in an AGPL package.
   *
   * ⚠️ An exemption must also point at a port that still EXISTS: an orphan exemption makes the list lie about the size of
   * the exception, the rule every other ledger in this tree follows.
   */
  const PORTA_LARGA_DE_PROPOSITO = new Map([]);

  it('[Boundary] toda porta do `exports` aponta para algo que o pacote realmente EMBARCA', () => {
    // The converse: a port to a folder `files` does not carry is a 404 promised to the consumer.
    const FILES = new Set(PKG.files ?? []);
    const problemas = [];
    for (const [sub, alvo] of Object.entries(PKG.exports ?? {})) {
      if (PORTA_LARGA_DE_PROPOSITO.has(sub)) continue;
      const destino = typeof alvo === 'string' ? alvo : alvo?.default;
      if (!destino) { problemas.push(`${sub}: sem destino`); continue; }
      // ⚠️ The sieve reads the LITERAL PREFIX (what comes before the `*`) and asks whether `files` ships that prefix, or an
      // ancestor of it — not just the first segment, which cannot tell an HONEST port from a wide one:
      // `./app/public/vendor/*` has root `app`, which is not in `files`, but `app/public/vendor` is. So the narrow port
      // PASSES for being true, and a wide one fails for not being — the difference the issue exists to name.
      const limpo = destino.replace(/^\.\//, '');
      const prefixo = limpo.includes('*') ? limpo.slice(0, limpo.indexOf('*')).replace(/\/$/, '') : limpo;
      const embarcado = prefixo === 'package.json'
        || FILES.has(prefixo)
        || [...FILES].some((f) => prefixo === f || prefixo.startsWith(f + '/'));
      if (!embarcado) problemas.push(`${sub} -> ${destino} (fora de \`files\`)`);
    }
    expect(problemas).toEqual([]);
  });

  it('[Interface] a lista de portas largas NÃO cresce, e cada uma carrega o motivo', () => {
    // It is this sieve's last way out. An exception without a reason is loosening in disguise, and a list that grows is the
    // sieve being switched off slowly. ZERO: the wide port left with #119.
    expect(PORTA_LARGA_DE_PROPOSITO.size).toBeLessThanOrEqual(1);
    for (const [, motivo] of PORTA_LARGA_DE_PROPOSITO) expect(motivo.length).toBeGreaterThan(20);

    // ⚠️ AND NO EXEMPTION IS AN ORPHAN: without this, removing a port from `package.json` would leave every case passing,
    // because nothing asked whether what the list exempts still exists.
    for (const sub of PORTA_LARGA_DE_PROPOSITO.keys()) {
      expect(Object.keys(PKG.exports ?? {}), `isenta \`${sub}\`, que já não é porta nenhuma`).toContain(sub);
    }
  });

  it('⚠️ [Right] a porta ESTREITA existe, e e a que diz a verdade (#119)', () => {
    // `./assets/vendor/*` promises exactly what `files` ships, and whoever writes `engine/assets/vendor/...` matches it —
    // which is why removing the wide port broke nobody.
    const exp = PKG.exports ?? {};
    expect(exp['./assets/vendor/*'], 'a porta estreita sumiu; a promessa volta a ser so a larga')
      .toBe('./app/public/vendor/*');
    expect((PKG.files ?? [])).toContain('app/public/vendor');
  });

  it('⚠️ [Cross-check] e a porta LARGA continua a reprovar sem a isencao — senao a excecao nao mede nada', () => {
    // Without this, someone could widen the sieve until a wide port passed by itself, and a named exemption would become
    // decoration. Here the sieve runs WITH a wide port and WITHOUT the exemption list.
    const FILES = new Set(PKG.files ?? []);
    const cabe = (destino) => {
      const limpo = destino.replace(/^\.\//, '');
      const prefixo = limpo.includes('*') ? limpo.slice(0, limpo.indexOf('*')).replace(/\/$/, '') : limpo;
      return prefixo === 'package.json' || FILES.has(prefixo) || [...FILES].some((f) => prefixo === f || prefixo.startsWith(f + '/'));
    };
    expect(cabe('./app/public/*'), 'a porta larga passou a caber no `files`; reler a #119').toBe(false);
    expect(cabe('./app/public/vendor/*'), 'a porta estreita deixou de caber').toBe(true);
  });

  it('⚠️ [Interface] `app/public` so tem uma pasta que viaja — e o que torna a remocao segura', () => {
    // The measurement behind #119. If something new appears in `app/public` that `files` ships, the conclusion «remover a
    // larga nao quebra ninguem» stops holding, and this case warns.
    const publico = readdirSync(join(RAIZ_REPO, 'app', 'public'));
    const embarcados = publico.filter((n) => (PKG.files ?? []).includes('app/public/' + n));
    expect(embarcados, 'algo novo em app/public viaja no pacote; reler a #119').toEqual(['vendor']);
  });
});
