// SPDX-License-Identifier: AGPL-3.0-or-later
// NO HAND-WRITTEN EXTERNAL FETCH — the inventory that throttles where the engine touches the network.
//
// ========================= THE RULE (ADR-0116) =========================
// The Dev's premise: «NÃO FAZ SENTIDO BAIXAR ALGO VIA PWA, E CONSIDERAR QUE SE É PRA USAR VIA PWA OFFLINE NÃO É PRA
// BAIXAR NADA NO PRIMEIRO USO!» A PWA arrives through the network; that IS the installation. Pillar 8 says what it
// measures: **PWA on the first day ONLINE, then OFFLINE-FIRST.**
//
// 📌 THE RULE IS ABOUT TIME, NOT ORIGIN: **precached at installation, never lazily fetched on first use.** A runtime from
// a version-pinned CDN, listed in the precache manifest, is admissible — as the Dev asked from the start («se conseguir
// usar cdnjs/jsdelivr é ótimo»). What stays forbidden is the address fetched only when the child presses the button,
// because it was not there on installation day.
//
// 📌 THIS SIEVE IS THE SOURCE HALF. The other half — «e está mesmo no manifesto?» — can only be measured after a build,
// and lives in `scripts/check-precache.mjs`, which demands that an external entry be PINNED and have a declared weight.
// Neither answers alone: here one sees who writes an address, there whether it reached the installation.
//
// 📌 The SVG namespace (`http://www.w3.org/2000/svg`), which `createElementNS` requires, **never touches the network**.
// Excluding it is the difference between a sieve and an alarm someone switches off — and the exclusion is a written
// RULE, not a silence.
//
// ========================= ⚠️ THE DETECTOR CAN LIE =========================
// 🔴 A comment stripper written as `replace(/\/\/[^\n\r]*/g, '')` erases URLs — **every URL has `//` inside** — so the
// sieve eats exactly what it exists to hunt, and the scan returns ZERO. **A scan that returns zero proves the detector,
// not the tree.** The vacuum case below prevents that: it demands the scan find the code URLs, including the two
// namespaces it then refuses.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));

/**
 * THE HAND-WRITTEN EXTERNAL ADDRESSES THAT STILL EXIST, and why each one is still here.
 *
 * ⚠️ THE LIST MUST SHRINK. A new entry without a hand-written reason is the engine gaining a network dependency without
 * anyone deciding.
 */
/**
 * ⚠️ THE EXCUSE CARRIES A COUNT, NOT ONLY A REASON (measured 2026-09-09).
 *
 * ADR-0114 asks that «o host dos modelos seja nomeado NUM SÍTIO SÓ». A list keyed by FILE asserts that at the wrong
 * granularity: a second host planted in the module that named the models' host — an `export const ESPELHO` for a CDN,
 * exactly the move of whoever builds the fetcher and wants a mirror for the school — left all FIVE cases green. The
 * file was already excused, so everything that grew inside it was excused with it.
 *
 * 📌 With the number, «um sítio só» is asserted as ONE. It is a CEILING THAT ONLY GOES DOWN: going up requires touching
 * this and writing why; going down requires updating the number, which is how the inventory shrinks.
 */
const BUSCAS_A_MAO = {
  'platform/kokoro.ts': {
    urls: 1,
    porque:
      'ENDEREÇO DECLARADO, not a fetch: the Kokoro model repository (ADR-0186, ADR-0198), named once so the catalogue and a game\'s '
      + 'port build the same paths; the module is pure. The build fetches the files into the delivery (ADR-0177); the page asks for '
      + 'them at `heavy/`. A second host here would be a mirror chosen in silence',
  },
  'platform/heavy-mirror.ts': {
    // 8 → 10 with the command models and their runtime (issue #184): two more FOLDERS of the same mirror, not two more suppliers.
    // 🔴 10 → 11 on 2026-09-22 and the extra one is the SAME address twice, which is the point: `espeak-ng@1.0.2` is in the
    // mirror table AND in `NOT_MIRRORED`, because the folder exists in the staging tree and is ON HOLD until the GPL source is
    // published beside the build. The duplicate IS the decision — mirrored in principle, upstream until the obligation is met.
    // 11 → 12 with the Libras player (ADR-0234, route A), and 12 → 11 when it left (phase B3): the Unity build's folder went with it.
    // 11 → 10 when the engine pinned its own eSpeak NG build (issue #192): the jsDelivr address left BOTH lists, and the build's
    // folder on the project's mirror took one line.
    urls: 10,
    porque:
      'ENDEREÇOS DECLARADOS, not fetches: the table that maps each address the catalogue already names to the folder a mirror '
      + 'serves it under (the Dev, 2026-09-21: a base for local testing, for the project\'s bucket, or for a school\'s own '
      + 'server). The module is pure — it returns a string. Every one is already in `pesados-catalogo`, and an address here that '
      + 'is not there would be a mirror of something nobody catalogued. 📌 THREE are the reading models (ADR-0201 erratum, issue '
      + '#185), folder by folder, and their upstream IS the project\'s own mirror because both exports were made here — listing '
      + 'them is what lets a build read 850 MiB from the staging tree instead of over a school\'s link. 📌 THREE more have no '
      + 'upstream either, being builds and repacks made here: the Vosk runtime and its models, and eSpeak NG built from a pinned '
      + 'commit so its GPL source can be named (issue #192)',
  },
  'platform/heavy-catalogue.ts': {
    urls: 5,
    porque:
      'OS RUNTIMES QUE A ENGINE PASSOU A DESCER NA INSTALAÇÃO (ADR-0124, ADR-0132, decisões do Dev ' +
      'de 2026-09-09). ⚠️ CDN FIXADA É PERMITIDA e o ADR-0116 diz porquê: o pilar 8 proíbe depender da rede ' +
      'DEPOIS do primeiro dia, e isto desce com tudo o resto na instalação. ' +
      '📌 The `2` is TWO ORIGINS, each defensible on its own: (1) `@mediapipe/tasks-vision` ' +
      'em jsDelivr — o runtime de visão; (2) `storage.googleapis.com/mediapipe-models` — os modelos `.task`, ' +
      'que vivem noutro host porque o Google os publica assim, e sem eles o runtime não reconhece nada. ' +
      'WebGazer (`webgazer.cs.brown.edu`) left with ADR-0214. ' +
      '📌 ONE is the voice runtime\'s graph runner (ADR-0216): onnxruntime-web on jsDelivr — the ' +
      'same origin already defended above, and written here so the engine imports nothing from npm at run time. ' +
      '📌 The FOURTH is the project\'s own mirror (ADR-0203), which is not a third party: the reading models live there because ' +
      'both ONNX exports were made by this project and have no upstream to point at (ADR-0201 erratum, issue #185), and so does ' +
      'the Vosk runtime built here. 📌 The FIFTH is a folder of that same mirror, written whole: eSpeak NG, the voice\'s ' +
      'phonemizer, built here from a pinned commit so its GPL source can be named (issue #192). Its constant sits above the ' +
      'reading models\' and cannot borrow theirs, and it is not a new supplier. ' +
      'The VLibras Unity player (ADR-0234, route A) was a sixth and left in phase B3: the Libras player is the project\'s own ' +
      'export now, pinned outside this catalogue. ' +
      'A SIXTH address, or a new origin, is a supplier entering without a decision. They leave this list when the bytes are ' +
      'servidos de origem própria',
  },
};

/**
 * ⚠️ XML NAMESPACES ARE NOT FETCHES, and the exclusion is by PREFIX with a written reason, not case by case.
 * `http://www.w3.org/2000/svg` is `createElementNS`'s mandatory argument; the browser never resolves it. Accusing them
 * would make the gate fail correct lines and get switched off before it catches the real one.
 */
const NAO_E_BUSCA = 'http://www.w3.org/';

function ficheiros(dir = RAIZ, pref = '') {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { out.push(...ficheiros(p, `${pref}${n}/`)); continue; }
    if (n.endsWith('.ts') && !n.endsWith('.d.ts')) out.push(`${pref}${n}`);
  }
  return out;
}

/**
 * ⚠️ THE `(^|[^:])` IS THE FIX, and without it this file measures nothing. A `//` preceded by `:` is a scheme's double
 * slash (`https://`), never the start of a comment.
 */
function semComentarios(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n\r]*/g, '$1');
}

const URL_EM_LITERAL = /['"`](https?:\/\/[^'"`]+)['"`]/g;

/** Every absolute URL that appears in a string literal, in code — including those that are not fetches. */
function urlsEmCodigo() {
  const achados = [];
  for (const f of ficheiros()) {
    const src = semComentarios(readFileSync(join(RAIZ, f), 'utf8'));
    for (const m of src.matchAll(URL_EM_LITERAL)) achados.push({ f, url: m[1] });
  }
  return achados;
}

const TODAS = urlsEmCodigo();
const BUSCAS = TODAS.filter((a) => !a.url.startsWith(NAO_E_BUSCA));

describe('nenhum CDN escrito à mão · o inventário encolhe', () => {
  // 🎯 THE VACUUM CASE, first because it catches the stripper defect: if the detector eats the URLs again, TODAS is empty
  // and the happy case stays green looking at nothing.
  it('🎯 [Vácuo] a varredura acha as três URLs de código, os dois espaços de nomes incluídos', () => {
    expect(TODAS.length, 'o tira-comentários voltou a comer as URLs — ver o cabeçalho').toBeGreaterThanOrEqual(3);
    expect(TODAS.filter((a) => a.url.startsWith(NAO_E_BUSCA)).length, 'os espaços de nomes do SVG sumiram').toBe(2);
  });

  it('[Feliz] nenhuma busca externa nova, e as que há estão declaradas', () => {
    const novas = BUSCAS.filter((a) => !(a.f in BUSCAS_A_MAO));
    const desc = novas.map((a) => `${a.f} → ${a.url}`);
    expect(desc, `busca externa que ninguém declarou: ${desc.join(' · ')}`).toEqual([]);
  });

  /* 🎯 The defect this catches was INSIDE the excuse. «Num sítio só» asserted per FILE lets a second URL in an excused
   * file pass. Proven by planting a jsDelivr `ESPELHO` beside `HOST_DOS_MODELOS` — five green cases, and ADR-0114's clause
   * dead.
   *
   * ⚠️ And where it bites is where this will happen: whoever wires the #129 fetcher has a real problem of a school without
   * network, and a mirror is the obvious answer. The gate does not forbid it — it makes it come through here, with the
   * number and the reason, instead of appearing as one more line in a pure file. */
  it('🎯 [Fronteira] um ficheiro desculpado não pode ganhar uma SEGUNDA URL', () => {
    const aMais = [];
    for (const [f, { urls }] of Object.entries(BUSCAS_A_MAO)) {
      const suas = BUSCAS.filter((a) => a.f === f).map((a) => a.url);
      if (suas.length > urls) aMais.push(`${f}: ${urls} declarada(s), ${suas.length} achada(s) → ${suas.join(' · ')}`);
    }
    expect(aMais, `a new URL inside a file already excused: ${aMais.join(' | ')}`).toEqual([]);
  });

  // ⚠️ THE EXIT, with TWO halves. Without them the list becomes a monument: an entry would go on saying a network
  // dependency exists after it was removed, and the next person would read history as state. The second half is the
  // number: a ceiling left above the real count excuses in advance the URL that does not exist yet.
  it('[Fronteira] entrada da lista que já não busca nada sai daqui, e o número acompanha a descida', () => {
    const resolvidas = Object.keys(BUSCAS_A_MAO).filter((f) => !BUSCAS.some((a) => a.f === f));
    expect(resolvidas, `já não faz busca externa; apague a entrada: ${resolvidas.join(', ')}`).toEqual([]);

    const inchadas = Object.entries(BUSCAS_A_MAO)
      .filter(([f, { urls }]) => BUSCAS.some((a) => a.f === f) && BUSCAS.filter((a) => a.f === f).length < urls)
      .map(([f, { urls }]) => `${f}: declara ${urls}, tem ${BUSCAS.filter((a) => a.f === f).length}`);
    expect(inchadas, `o tecto ficou acima do real e desculpa por antecipação: ${inchadas.join(' | ')}`).toEqual([]);
  });

  // 📌 THE PAIR that proves the exclusion is a RULE and not a hole: a namespace is accepted, and any other URL in the SAME
  // file would not be.
  it('[Fronteira] o espaço de nomes do SVG é aceite; qualquer outra URL do mesmo ficheiro não seria', () => {
    const svg = TODAS.filter((a) => a.url === 'http://www.w3.org/2000/svg');
    expect(svg.length, 'o `createElementNS` deixou de usar o espaço de nomes').toBe(2);
    for (const a of svg) expect(BUSCAS.some((b) => b.f === a.f && b.url === a.url)).toBe(false);
    expect(NAO_E_BUSCA.startsWith('http://www.w3.org/'), 'a exclusão é por prefixo do W3C, não uma lista').toBe(true);
  });

  /* 🎯 ADR-0116'S RULE MADE STRUCTURAL: an ADDRESS is not a FETCH, and that is the difference between what is precached
   * and what is lazily fetched. `platform/kokoro` NAMES the host and never asks it — a pure module, and that purity is
   * what lets the fetcher choose the moment.
   *
   * ⚠️ If `kokoro` gains a `fetch`, it stops being a declared address and becomes the lazy fetch its excuse says it is
   * not. (The case's other side was `ui/webcam`, which left with WebGazer — ADR-0214.)
   *
   * 📌 The regex is DUPLICATED from nothing-comes-from-outside on purpose, for the reason that file writes: one gate must
   * be able to disagree with the other. */
  const REDE = /\bfetch\s*\(|\bimport\s*\(|\.src\s*=|XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket|new\s+EventSource/;
  const pede = (f) => REDE.test(semComentarios(readFileSync(join(RAIZ, f), 'utf8')));

  it('🎯 [Fronteira] endereço DECLARADO e busca PREGUIÇOSA são coisas diferentes, e o crivo sabe qual é qual', () => {
    expect(pede('platform/kokoro.ts'), 'platform/kokoro gained a fetch — it is no longer a declared address').toBe(false);
  });

  it('[Interface] `import()` dinâmico não traz especificador não-relativo', () => {
    const maus = [];
    for (const f of ficheiros()) {
      const src = semComentarios(readFileSync(join(RAIZ, f), 'utf8'));
      for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        if (!m[1].startsWith('.')) maus.push(`${f} → ${m[1]}`);
      }
    }
    expect(maus, `a engine passou a importar de fora por caminho dinâmico: ${maus.join(' · ')}`).toEqual([]);
  });
});

// ===== MUTATIONS CHECKED (2026-09-08, by script, with occurrence counts) =====
// 1. renaming the `platform/kokoro.ts` key of `BUSCAS_A_MAO` → [Feliz] fails, naming the Kokoro URL, and the exit
//    [Fronteira] fails on the key that no longer fetches anything (re-measured on 2026-09-24: the entry first used here,
//    `ui/webcam.ts`, left with its module, ADR-0214)
// 2. adding an already-resolved entry to the list       → the exit [Fronteira] fails
// 3. `semComentarios` without the `(^|[^:])` (the stripper defect) → the [Vácuo], the EXIT and the pair fail. 🎯 And what
//    matters is which does NOT fail: **[Feliz] stays green**, because an empty list has no new entries — exactly how a
//    «não há CDN escrito à mão» report nearly went out. The rule alone does not catch a blind sieve; the vacuum does.
//    Measured, and different from the prediction (which said only the vacuum would fail).
// 4. `NAO_E_BUSCA` → exactly 'http://www.w3.org/2000/svg' → survives: MEASURED EQUIVALENCE, because both occurrences are
//    exactly that. Recorded instead of deleted — the prefix covers `1999/xlink` and the other W3C namespaces the day one
//    appears, and tightening it now fails nothing.
// 5. `NAO_E_BUSCA` → 'http://'                          → the pair's [Fronteira] fails, as it should: excluding every
//    `http://` would let a plain-text CDN through, which is worse than what this gate hunts.
