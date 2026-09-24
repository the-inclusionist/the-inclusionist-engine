// SPDX-License-Identifier: AGPL-3.0-or-later
// NO VOICE MODEL TRAVELS IN THE PACKAGE — the first gate ADR-0110 owes.
//
// ========================= WHAT IT GUARDS =========================
// ADR-0110 measured two deliveries and the Dev chose (b): the engine GUARANTEES the neural voices and fetches them
// itself on first start, in the background. (a) — the models travelling in the tarball — was refused with a number:
// ~244 MB pulled by every `npm ci` of every consumer repository, most of which never open a browser.
//
// ⚠️ AND THE RECORD SAYS IN WRITING WHY THIS EXISTS: «written before the code so that the code cannot quietly choose D2
// by putting the models in the package "just for now"». A 61 MB «só por agora» is not undone — it is installed in
// every consumer before anyone notices.
//
// ⚠️ AND A SIZE ASSERTION DOES NOT SERVE, as the record itself anticipates: «aprovaria um build que embarca UMA voz e
// deriva». Worse — a ceiling on `vendor` that only goes down WOULD COLLIDE WITH ANOTHER ACCEPTED DECISION: ADR-0108 says
// the Playwrite faces are bundled, and the ceiling would fail their delivery. The right metric here is the file's
// NATURE, not its weight.
//
// 📌 And the sieve is by INVENTORY, not by word search, in the shape of `what-fonts-the-package-carries`: «isto foi empacotado» is
// not grepped in the code — it is seen in the tree the package carries.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const PKG = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));

/**
 * What a VOICE MODEL looks like, from the two sources ADR-0065 §5 knows and the one it forbids.
 *
 * ⚠️ `.wasm` IS HERE AND IT IS NOT OVERKILL: ADR-0094 measured 135 MB of sherpa runtime, and that number decided that a
 * game that never speaks cannot pay for it. A bundled runtime is the same decision reversed.
 * ⚠️ `.bin`/`.param` are the `ncnn` form, which ADR-0065 §5 refuses for being another inference engine.
 */
const EXTENSOES_DE_MODELO = new Set(['.onnx', '.wasm', '.bin', '.param', '.tflite']);
const NOMES_DE_MODELO = /(^|[\\/])(vits-piper|sherpa|piper|kokoro|espeak-ng-data)|(^|[\\/])(tokens|lexicon)\.txt$/i;

/** The `files` entries that exist on disk — the package is what they reach. */
function arvoreDoPacote() {
  const saida = [];
  const anda = (p) => {
    if (!existsSync(p)) return;
    if (statSync(p).isDirectory()) { for (const n of readdirSync(p)) anda(join(p, n)); return; }
    saida.push(p.slice(RAIZ.length + 1).split('\\').join('/'));
  };
  for (const entrada of PKG.files ?? []) anda(join(RAIZ, entrada));
  return saida;
}

const extensaoDe = (p) => { const i = p.lastIndexOf('.'); return i < 0 ? '' : p.slice(i).toLowerCase(); };

describe('ADR-0114 · e ONDE o runtime vendorizado tem de ficar, que não é o sítio óbvio', () => {
  // 🔴 THE TRAP, written here because this is where someone will be when the gate above fires. ADR-0114 says a heavy
  // runtime is «vendorizado no `dist` da aplicação, não no pacote npm». The obvious place to put it is
  // `app/public/vendor/` — where the fonts already live — and that is exactly the place the package PUBLISHES.
  //
  // 📏 Proven by planting a `.wasm` there: the case above fails, naming the file. What it does not say, and this block
  // does, is WHERE to go instead.

  it('🔴 [Interface] `app/public/vendor` VIAJA no pacote — é por isso que vendorizar ali reprova', () => {
    expect(PKG.files, 'a lista de `files` mudou de forma; releia este bloco antes de confiar nele')
      .toContain('app/public/vendor');
  });

  // 🎯 AND THE RIGHT PATH: `app/public/` is Vite's `publicDir` (the build root is `app`), so everything there is copied
  // as is into `dist/` — and `files` publishes ONLY the `vendor` inside it. A runtime in `app/public/<any other folder>/`
  // reaches the PWA and the precache without entering every consumer's `npm ci`, which is both halves of what ADR-0114
  // asks.
  it('🎯 [Interface] `app/public` chega ao `dist` e NÃO é publicado, tirando o `vendor`', () => {
    const publicados = (PKG.files ?? []).filter((f) => f.startsWith('app/public'));
    expect(publicados, 'o `app/public` inteiro passou a ser publicado — um runtime ali iria no pacote')
      .toEqual(['app/public/vendor']);

    // ⚠️ And the other half of the claim is about the BUILD, not `package.json`: what is in `app/public` appears in
    //    `dist`. Asserted on the built tree, not the configuration — reading `vite.config`'s `publicDir` would measure the
    //    intention; reading `dist` measures what happened.
    const noPublic = readdirSync(join(RAIZ, 'app', 'public'));
    // ⚠️ THE VACUUM FIRST: with `app/public` empty the loop below would assert nothing and the case would stay green
    //    looking at nothing — which is how this claim would stop holding without anyone noticing.
    expect(noPublic.length, '`app/public` está vazio: o laço abaixo não mede nada').toBeGreaterThan(0);
    const noDist = existsSync(join(RAIZ, 'dist')) ? readdirSync(join(RAIZ, 'dist')) : null;
    if (noDist === null) return; // no build in this tree: the `files` claim above holds on its own
    for (const nome of noPublic) {
      expect(noDist, `${nome} está em app/public e não chegou ao dist`).toContain(nome);
    }
  });
});

describe('ADR-0110 · a engine BUSCA as vozes, não as embarca', () => {
  const ARVORE = arvoreDoPacote();

  it('🎯 [Zero] nenhum ficheiro de MODELO ou de RUNTIME de voz viaja no pacote', () => {
    // a module of CODE named after its engine (`platform/kokoro.js`, the pure half of ADR-0198) is not a model file
    const presos = ARVORE.filter((p) => EXTENSOES_DE_MODELO.has(extensaoDe(p)) || (NOMES_DE_MODELO.test(p) && !/\.(m?js|d\.ts)$/.test(p)));
    expect(
      presos,
      'modelo ou runtime de voz dentro do que o `npm pack` leva. O ADR-0110 escolheu a entrega (b) — a engine '
      + 'GARANTE as quatro vozes e busca-as no primeiro arranque —, e a (a) foi recusada com número: ~244 MB '
      + 'por cada `npm ci` de trezentos repositórios. Se a entrega tiver mesmo de mudar, o caminho é um '
      + 'registo que supersede o ADR-0110, não um ficheiro.',
    ).toEqual([]);
  });

  it('⚠️ [Interface] e a varredura está VIVA: ela lê a árvore que o pacote leva de verdade', () => {
    // Without this, a misread `files` or a wrong path would leave the case above green for having nothing to examine —
    // the kind of false green this repository has caught more than once.
    expect(PKG.files?.length, '`files` deixou de existir no package.json').toBeGreaterThan(0);
    expect(ARVORE.length, 'a varredura não achou ficheiro nenhum do pacote').toBeGreaterThan(20);
    // and the detector recognises the defect when it exists, instead of never matching anything
    expect(EXTENSOES_DE_MODELO.has(extensaoDe('app/public/vendor/vits-piper-pt_BR-faber-medium/model.onnx'))).toBe(true);
    expect(NOMES_DE_MODELO.test('app/public/vendor/sherpa-onnx-wasm-main.js')).toBe(true);
    expect(NOMES_DE_MODELO.test('app/public/vendor/andika-400.woff2')).toBe(false);
  });

  it('📌 [Right] o que o pacote LEVA hoje continua a ser fonte e folha de estilo', () => {
    // The other side of the sieve: without it, deleting `vendor` from `files` would make the case above pass vacuously —
    // and the fonts the child needs to read would vanish from the package with nothing failing.
    const woff2 = ARVORE.filter((p) => extensaoDe(p) === '.woff2');
    expect(woff2.length, 'as fontes empacotadas sumiram do pacote').toBeGreaterThan(10);
  });
});

/* ===================== ADR-0119 · ART does not travel in the package either =====================
 *
 * ADR-0119 decided the engine PROVIDES four heavy things — fonts, neural voice, vision runtime and ART — and that all of
 * them arrive through the PLATFORM, never through the npm package. A PROHIBITION does not need the feature to exist.
 *
 * ⚠️ And the trap is the same commit `6b13341` measured for the runtime: the obvious place for art is
 * `app/public/vendor/`, beside the fonts — and that directory IS in `files`. The case above already proves it travels;
 * what is missing is saying that art cannot come in through there.
 *
 * 📌 `art/` is not in `files`. This sieve exists so it stays that way when art arrives. */
describe('ADR-0119 · a arte chega pela plataforma, e por isso NÃO pelo pacote', () => {
  const ARVORE = arvoreDoPacote();

  /**
   * ⚠️ THE EXCLUSIONS ARE A WRITTEN RULE, NOT SILENCE — and the two left out are left out for opposite reasons:
   *
   *   · `.svg` is NOT in. Here it is MARKUP, not artwork: `render/cvd-matrices` builds colour-correction filters with it,
   *     and an interface icon is interface. Accusing it would make the sieve fail something right, and a gate that fails
   *     something right is switched off before it catches the wrong thing.
   *   · `.tsx` is NOT in, and it is a COLLISION, not a choice: it is the extension of a Tiled tileset **and** of a
   *     TypeScript file with JSX. A false positive on a module is the same switching-off through another door.
   */
  const EXTENSOES_DE_ARTE = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif',
    '.aseprite', '.ase', '.tmx', '.pyxel', '.psd', '.xcf',
  ]);

  /** The LCP by NAME too, because art renamed to `.dat` is still third-party art. */
  const NOMES_DE_ARTE = /(^|[\\/])(art|lcp|liberated[-_]?pixel|sprites?|tilesets?)([\\/]|$)/i;

  it('🎯 [Zero] nenhum ficheiro de ARTE viaja no pacote', () => {
    const presos = ARVORE.filter((p) => EXTENSOES_DE_ARTE.has(extensaoDe(p)) || NOMES_DE_ARTE.test(p));
    expect(
      presos,
      'arte no pacote npm: cada `npm ci` de trezentos repositórios paga por ela, e o ADR-0119 manda-a pela ' +
        `plataforma. Ficheiros: ${presos.join(', ')}`,
    ).toEqual([]);
  });

  it('⚠️ [Interface] `art/` NÃO está no `files` — a proibição é estrutural, não sorte', () => {
    // 📌 The case above scans what `files` reaches; this one says WHY it does not reach the quarantine. Without it,
    // adding `art` to `files` and putting a `.png` there would fail — but adding `art` with no art yet would pass, and the
    // door would stay open, waiting.
    const declarados = PKG.files ?? [];
    const arte = declarados.filter((e) => /^art([\\/]|$)/i.test(e));
    expect(arte, `o \`files\` passou a publicar a quarentena de arte: ${arte.join(', ')}`).toEqual([]);
  });

  it('⚠️ [Interface] e a árvore da arte continua a existir, com o seu livro-razão', () => {
    // The pair that keeps this block from becoming a vacuum: if `art/` disappears, the [Zero] case stays green looking at
    // nothing and the prohibition stops describing anything.
    // 📌 `art/` and not `art/lcp/`: ADR-0133 refused share-alike. What the case asserts is that a declared place exists
    // where outside art lives.
    expect(existsSync(join(RAIZ, 'art', 'ATTRIBUTION.csv')), 'a árvore da arte sumiu').toBe(true);
  });
});

// ========================= MUTATIONS CHECKED =========================
// Three, all killed. ⚠️ And the first is NOT A CODE EDIT: it PLANTS the defect in the tree —
// `app/public/vendor/vits-piper-pt_BR-faber-medium/model.onnx` — and deletes it afterwards. An inventory sieve is only
// proven that way; mutating the regex proves the detector is alive, not that it catches the real thing.
//
//   1. a voice model appearing in `vendor` -> the [Zero] fails. It is the 61 MB «so por agora», exactly as ADR-0110
//      describes it.
//   2. the extension detector killed -> the [Interface] fails. Without that case, a blind detector would pass for finding
//      nothing, the false green of this kind of gate.
//   3. `package.json`'s `files` losing `vendor` -> the FONTS case fails. ⚠️ It exists because of the asymmetry: without it,
//      deleting `vendor` from the package would make the [Zero] pass VACUOUSLY, and the fonts the child needs to READ
//      would vanish from the package with nothing failing. An absence sieve always needs the sibling that asserts what
//      MUST stay.
