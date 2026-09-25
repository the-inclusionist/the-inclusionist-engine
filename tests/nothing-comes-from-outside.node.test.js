// SPDX-License-Identifier: AGPL-3.0-or-later
// NOTHING ARRIVES FROM OUTSIDE AT RUN TIME — pillar 8 (offline/PWA), as an inventory.
//
// ========================= WHY THIS MATTERS IN A SCHOOL =========================
// Pillar 8 of ADR-0010 says this game works OFFLINE. In a public school with no network — the target, not the
// exception — a module that fetches code from a third-party server does not degrade: it simply does nothing. The child
// turns the button on and nothing happens, with no error and no explanation.
//
// ⚠️ The distinction this file makes is WHEN: a fetch at INSTALLATION honours pillar 8 («primeiro dia online, depois
// offline-first», the erratum the Dev dictated) — the heavy files come down with the delivery (ADR-0110 (b), ADR-0177);
// a LAZY fetch on first use violates it, because a machine that never turned that control on never made it.
//
// ⚠️ AND THE DISTINCTION THIS SIEVE MUST MAKE IS WHY IT IS AN INVENTORY AND NOT A PROHIBITION: not every URL in code is a
// fetch. `http://www.w3.org/2000/svg` is an XML NAMESPACE — an identifier `createElementNS` requires, which never leaves
// the machine. A gate that treated them alike would accuse false ones, and a gate that accuses false ones is switched
// off before it catches the true one.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));
const URL_QUALQUER = /https?:\/\/[^\s'"`)]+/g;

function ficheirosTs(dir = RAIZ) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...ficheirosTs(p));
    else if (nome.endsWith('.ts') && !nome.endsWith('.d.ts')) saida.push(p);
  }
  return saida;
}

/**
 * The URLs that live in CODE, per file.
 *
 * ⚠️ Comments are out: this engine explains itself a lot, and URLs in prose cite a source. Counting them would create
 * the incentive to DELETE THE EXPLANATION to lower the number — the lesson `action-vocabulary-boundary` already wrote.
 */
function urlsEmCodigo() {
  const fora = [];
  for (const p of ficheirosTs()) {
    const rel = relative(RAIZ, p).split('\\').join('/');
    readFileSync(p, 'utf8').split(/\r?\n/).forEach((ln) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
      for (const u of ln.match(URL_QUALQUER) ?? []) fora.push({ modulo: rel, url: u });
    });
  }
  return fora;
}

/**
 * WHAT MAY APPEAR, and what each thing is. ⚠️ The reasons are not of the same KIND, and that is what the list is for:
 * some are identifiers that do not travel, some are addresses the build fetches into the delivery.
 */
const DECLARADAS = {
  'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main': 'KOKORO (ADR-0186, ADR-0198): the fp32 model, its tokenizer '
    + 'and the voice tables, named once in `platform/kokoro` and fetched by the BUILD into the delivery with their sha256 (ADR-0177); '
    + 'the page asks for them at `heavy/` on its own origin. An address, not a fetch: the module is pure',
  'http://www.w3.org/2000/svg': 'NAMESPACE XML, não um endereço: o `createElementNS` exige-o para criar nós SVG, e ele nunca sai da máquina. Aparece no `render/cvd-matrices` e no `render/lq-filter`, que montam os filtros de daltonismo',
  'https://cdn.jsdelivr.net/npm/espeak-ng@1.0.2': 'THE PHONEMIZER OF THE NEURAL VOICE (ADR-0216, issue #200): espeak-ng turns a '
    + 'sentence into phonemes in every language the project speaks. Fetched at BUILD time into the delivery like the vision runtime '
    + '(ADR-0177) — the engine imports nothing from npm at run time, so a game that does not declare the neural voice carries none '
    + 'of it. GPL-3.0-or-later, compatible with the AGPL (LICENSES.md)',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0': 'WHAT RUNS KOKORO\'S GRAPH (ADR-0216, issue #200), fetched the same way. '
    + 'The `jsep` pair is what onnxruntime\'s own threads load: a worker that cannot find them answers nothing and the child hears '
    + 'silence (measured in the quiz demo, #181)',
  'https://lfs-oinclusionista.jrocha.dev.br': 'THE PROJECT\'S OWN MIRROR (ADR-0203), and the one supplier here that is not a third '
    + 'party: the reading models (ADR-0201 erratum, issue #185) — Whisper small for pt, Moonshine streaming small for en and es. '
    + 'Both ONNX exports were made by this project, so there is no upstream to point at: the ready-made Whisper export states no '
    + 'licence and the Spanish Moonshine ships no ONNX. Fetched by the BUILD into the delivery with their sha256, and only for the '
    + 'languages the build is told to carry; the page asks for them at `heavy/` on its own origin, never here. 850 MiB for the '
    + 'three, which is why nothing downloads more than one',
  // The same supplier, written folder by folder in `platform/heavy-mirror`: that is what lets a build read the 850 MiB from the
  // staging tree on disk instead of over the link (`--base`), and each folder is one model.
  'https://lfs-oinclusionista.jrocha.dev.br/whisper-small-onnx': 'THE MIRROR ABOVE, the Portuguese model\'s folder — the path a '
    + 'local base serves it under, never a fetch: `heavy-mirror` is pure',
  'https://lfs-oinclusionista.jrocha.dev.br/moonshine-streaming-small-onnx': 'THE MIRROR ABOVE, the English model\'s folder, same '
    + 'reason',
  'https://lfs-oinclusionista.jrocha.dev.br/moonshine-streaming-small-es-onnx': 'THE MIRROR ABOVE, the Spanish model\'s folder, '
    + 'same reason',
  'https://lfs-oinclusionista.jrocha.dev.br/vosk-browser-dynamic-execution-0': 'THE MIRROR ABOVE, and it holds a build that '
    + 'exists NOWHERE ELSE (issue #184): every published `vosk-browser` evaluates text as code, which this engine\'s policy '
    + 'refuses (ADR-0193 — never `unsafe-eval`, never a patch), so it was rebuilt with `-s DYNAMIC_EXECUTION=0`. Fetched by the '
    + 'BUILD into the delivery with its sha256',
  'https://lfs-oinclusionista.jrocha.dev.br/vosk-models': 'THE MIRROR ABOVE, the three command models — alphacephei\'s small '
    + 'ones (Apache-2.0) repacked deterministically as the `.tar.gz` that build loads. 31–39 MiB a language, and a device asks '
    + 'for the child\'s',
  'https://raw.githubusercontent.com/spbgovbr-vlibras/vlibras-web-browsers/9d093f259ac732d755a19e80cd03c8233c70435d/public/unity':
    'THE LIBRAS PLAYER (ADR-0234, route A): the VLibras Unity build at a pinned commit of its repository, named in '
    + '`platform/heavy-catalogue` and mapped to a local folder in `platform/heavy-mirror`. Fetched by the BUILD with '
    + '`inclusionist-heavy --libras` into the delivery with its sha256 (ADR-0177); the page opens the player from `heavy/` and '
    + '`libras/player/` on its own origin, and no VLibras host is ever contacted by the device',
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1': 'O RUNTIME DE VISÃO (ADR-0124), fixado na versão e descido na INSTALAÇÃO pelo `platform/heavy`. Não é busca preguiçosa: é a instalação do PWA, que o ADR-0116 declarou ser um acto de rede legítimo. 📏 Medido: os três ficheiros respondem 200 com CORS aberto',
  'https://storage.googleapis.com/mediapipe-models': 'OS MODELOS `.task` do MediaPipe — rosto+íris, gestos e mãos. ⚠️ Host diferente do runtime porque é assim que o Google os publica, e sem eles os 11,7 MB de WebAssembly não reconhecem coisa nenhuma: é o `.onnx` sem o `.onnx.json` outra vez. 📏 Medidos em 2026-09-09, `float16`',
};

/**
 * DOES THIS MODULE TOUCH THE NETWORK? — the question that separates an ADDRESS from a FETCH.
 *
 * ⚠️ Structural and not by name: it looks for the PRIMITIVE that leaves the machine. A module can name an address
 * (ADR-0114 requires one to) without ever asking for it, and treating them alike would accuse a false one — which is how
 * a gate gets switched off before it catches the true one.
 */
// 🔴 `\bfetch\b`, not `\bfetch\s*\(`: `platform/heavy.ts` RECEIVES `fetch` (`readonly buscar?: typeof fetch`, with
// `opcoes.buscar ?? fetch`) and calls it by another name — `buscar(p.url)`. The primitive is there; its name is gone
// from where it is used.
// ⚠️ AND THAT IS NOT EVASION, IT IS GOOD DESIGN: injecting the primitive is what makes the fetcher testable without a
// network. A discriminator defeated by RIGHT DESIGN is worse than one defeated by carelessness: nobody did anything
// wrong, so nobody goes looking.
// 📌 `\bfetch\b` catches the name in VALUE position (`typeof fetch`, `?? fetch`), not only as a call — with no false
// positives in the tree when it was measured (2026-09-09).
const REDE = /\bfetch\b|\bimport\s*\(|\.src\s*=|XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket|new\s+EventSource/;
/**
 * THE MODULES THAT TOUCH A NETWORK PRIMITIVE, and what each one does with it.
 *
 * ⚠️ TOUCHING THE PRIMITIVE IS NOT LEAVING THE MACHINE, and that is the distinction the list exists to write. Most of
 * these load a LOCAL resource — a chunk of this same package, a file at `heavy/` on the page's own origin — and counting
 * them as network dependencies would be the same mistake as counting the W3C namespace as a fetch.
 *
 * 📌 The list is asserted by EQUALITY, not inclusion: a new module with `fetch` fails, and so does a module that stops
 * touching the network — which is how the inventory SHRINKS.
 */
const TOCAM_NA_REDE = {
  'boot/create-game.ts': 'LOCAL. `import(\'../platform/reading-runtime.js\')` — a chunk of this same package, cut by Vite and '
    + 'loaded at the FIRST `listen()` of a game that declared `uses: { reading: true }` (ADR-0216 §5). It is here and not inside '
    + 'the reading because the root is what knows the page\'s address and the game\'s answers; the module it loads is what names '
    + 'the model files, so a game that never listens never reaches them. 📌 AND, since ADR-0232 D4, the `import(url)` of the '
    + 'command recogniser\'s bundle, which `platform/vosk-runtime` used to hold: the root builds the once-per-address loader '
    + '(`createBundleLoader`) and the runtime receives it. The address is `heavy/` on the page\'s own origin, built by '
    + '`deliveryPath` in the runtime and loaded only after the install checked every file by sha256 (ADR-0177, ADR-0193). '
    + 'And the host\'s `fetch`, lent to the heavy-files download and to the reading that runs without a worker. 📌 AND, since '
    + 'ADR-0232 D4-B4, `import(\'../platform/kokoro-runtime.js\')`, which `platform/tts` used to hold: loaded at the FIRST neural '
    + 'utterance (ADR-0216 §5), with the host\'s `fetch` and WebAssembly lent to it — a game that never speaks neurally never '
    + 'reaches the module that names espeak-ng',
  'platform/kokoro-port.ts': 'LOCAL. `fetch` of the model, the tokenizer and the voice tables at `heavy/` on the page\'s own '
    + 'origin (ADR-0177) — paths built by `deliveryPath`, never an upstream host. It was the quiz demo\'s port until ADR-0216 '
    + 'moved it into the engine, so no game has to copy it',
  'platform/kokoro-runtime.ts': 'LOCAL. `import()` of espeak-ng and `fetch` of its wasm, at `heavy/` on the page\'s own origin '
    + '(ADR-0216): the addresses come from the catalogue, the build put the files in the delivery, and a school with no network '
    + 'has them or the voice refuses. Nothing is imported from npm, so a game that never speaks neurally carries none of it. The '
    + 'graph runner is `platform/onnx-runtime`\'s, below',
  'platform/reading-runtime.ts': 'LOCAL. `fetch` of the reading model of ONE language — the encoder, the decoders, the tokenizer '
    + 'and the two configs — at `heavy/` on the page\'s own origin (ADR-0216 §2): the addresses come from the catalogue, the '
    + 'build put them in the delivery, and a school with no network has them or the reading refuses by name. The child\'s voice '
    + 'never becomes a request: it is heard here, on her machine (ADR-0200 erratum)',
  'platform/reading-worker.ts': 'LOCAL. The worker realm\'s own `fetch`, lent by its scope to `platform/reading-runtime` above '
    + '(ADR-0232 D4), which fetches the reading model with it at `heavy/` on the page\'s own origin. The thread asks for nothing '
    + 'the runtime would not; it is here because the primitive is named where it is handed over, not where it is called',
  'platform/onnx-runtime.ts': 'LOCAL. `import()` of onnxruntime-web at `heavy/` on the page\'s own origin, and the ONE place '
    + 'that points its worker threads at the delivery too (ADR-0216): a worker left to itself asks the CDN the library was '
    + 'published at, finds nothing in a school with no network, and the session never opens — measured in the quiz demo (#181). '
    + 'The voice and the reading both load it from here, so the rule is written once',
  'platform/vosk-runtime.ts': 'LOCAL. The host\'s `fetch`, lent by the root (ADR-0232 D4), reads the command MODEL\'S archive — '
    + 'the same `heavy/` address on the page\'s own origin the recogniser\'s worker opens, answered from the checked cache — only '
    + 'to learn the words the model knows (ADR-0194 §4, `platform/vosk-vocabulary`); the read stops once the word list is read',
  'ui/voice-control.ts': 'LOCAL. It names the host\'s `fetch` only to hand it on to `platform/vosk-runtime` above, which reads '
    + 'the model\'s vocabulary with it at `heavy/` on the page\'s own origin (ADR-0194 §4) — here because the primitive is named '
    + 'where it is handed over, like the reading worker\'s',
  'platform/vision.ts': 'LOCAL. `import()` of MediaPipe\'s `vision_bundle.mjs` (and, inside it, its wasm and the face model) at `heavy/` '
    + 'on the page\'s own origin (ADR-0177, ADR-0213, #196) — addresses built by `deliveryPath`, never an upstream host, and only '
    + 'after the checked cache holds every file',
  'platform/tts.ts': 'LOCAL. `el.src = som.url`, a `blob:` URL of the WAV the neural voice just synthesised here, played '
    + 'through a media element so the speech rate keeps the pitch (ADR-0183 §1); it never leaves the machine. The '
    + '`import()` of the neural runtime moved into the root with ADR-0232 D4',
  'core/i18n.ts': 'LOCAL. `import(\'../i18n/en.js\')` — os dicionários de en/es são chunks do próprio pacote, '
    + 'cortados pelo Vite e servidos pelo service worker. Nada sai da máquina; o `import()` está no crivo '
    + 'porque com um especificador absoluto ele SAI, e é por isso que o discriminador o inclui',
  'platform/heavy.ts': '🎯 A SEGUNDA BUSCA EXTERNA DA ENGINE, e é DECIDIDA — ADR-0110 (b): os quatro '
    + 'modelos de voz não viajam no pacote e descem no primeiro carregamento. ⚠️ NÃO VIOLA O PILAR 8, e a '
    + 'diferença é a errata que o próprio Dev ditou: «primeiro uso não pode ser considerado rede porque o '
    + 'próprio sistema está sendo baixado». O que o pilar proíbe é depender da rede DEPOIS do primeiro dia — '
    + 'e é precisamente isso que este módulo conserta, porque hoje a voz nunca desce e a criança chega ao '
    + 'segundo dia sem ela. 📌 Ele não tem URL em código: os endereços vêm do `platform/voice-plan`, o sítio '
    + 'único do ADR-0114',
};

function tocaNaRede(modulo) {
  const src = readFileSync(join(RAIZ, modulo), 'utf8')
    .split(/\r?\n/).filter((ln) => !/^\s*(\/\/|\*|\/\*)/.test(ln)).join('\n');
  return REDE.test(src);
}

describe('pilar 8 · nada chega de fora sem estar declarado', () => {
  it('🎯 [Zero] nenhuma URL nova entrou em código sem uma razão escrita', () => {
    const novas = urlsEmCodigo().filter(({ url }) => !(url in DECLARADAS));
    expect(
      novas.map(({ modulo, url }) => `${modulo}  ${url}`),
      'URL nova em código de execução. O pilar 8 diz que este jogo funciona OFFLINE — numa escola sem rede, '
      + 'uma busca externa não degrada, ela simplesmente não acontece. Se for um NAMESPACE (não viaja), '
      + 'declare-o aqui a dizê-lo; se for uma busca, ela precisa de decisão antes de código (ver #129).',
    ).toEqual([]);
  });

  it('[Interface] a lista não tem órfãos — uma URL que saiu do código sai dela', () => {
    // This is how the list SHRINKS: when a fetch leaves the code, its entry leaves too, or the inventory would report a debt
    // already paid — as with WebGazer (ADR-0214).
    const presentes = new Set(urlsEmCodigo().map((u) => u.url));
    expect(Object.keys(DECLARADAS).filter((u) => !presentes.has(u)), 'entrada de uma URL que já não existe').toEqual([]);
  });

  it('⚠️ [Interface] e a varredura está VIVA: ela lê a árvore e o detector reconhece uma URL', () => {
    expect(ficheirosTs().length, 'a varredura não achou módulo nenhum').toBeGreaterThan(50);
    expect(urlsEmCodigo().length, 'nenhuma URL achada — o detector morreu').toBeGreaterThan(0);
    expect('const s = "https://exemplo.org/x.js";'.match(URL_QUALQUER)).toEqual(['https://exemplo.org/x.js']);
  });

  it('📌 [Right] TODO módulo que toca numa primitiva de rede está declarado — o inventário é o assunto', () => {
    // ⚠️ This file's strong claim is not «há uma lista»: it is that the network dependencies of this engine are known, one
    // by one, with what each does. One more must cost a written line.
    //
    // 🎯 THE DISCRIMINATOR IS STRUCTURAL: a module is a fetch when it contains a network primitive. "Not the W3C namespace,
    //    so a fetch" assumes only two categories; ADR-0114 created a third — an ADDRESS declared in a pure module. A list
    //    of names would miss a fetcher born IN THAT file; this form catches it, because the primitive gives it away, not
    //    the address.
    // 🔴 AND THE PRIMITIVE IS COUNTED WHEREVER IT IS, not only among modules with a URL in code: the heavy-files fetcher
    //    has none — its addresses arrive by import from the catalogue. Separating CATALOGUE from FETCHER is good design
    //    (the list is data, the fetcher is rule), and it is exactly what opens the door: the literal on one side, the
    //    primitive on the other, and a sieve demanding both in one file sees neither.
    const naRede = ficheirosTs()
      .map((p) => relative(RAIZ, p).split('\\').join('/'))
      .filter((m) => tocaNaRede(m));
    expect(naRede.sort(), 'módulo novo a tocar numa primitiva de rede — declare-o em TOCAM_NA_REDE com o que ele faz')
      .toEqual(Object.keys(TOCAM_NA_REDE).sort());
  });

  // 📌 THE PAIR THAT KEEPS THE NEW CATEGORY FROM BECOMING A BACK DOOR: the module that NAMES the host must stay off the
  // network. The day it gains a `fetch`, the case above accuses it — and this one says why, before anyone has to find
  // out.
  it('📌 [Zero] o módulo que NOMEIA o host dos modelos não toca na rede', () => {
    expect(tocaNaRede('platform/voice-plan.ts'), 'o catálogo passou a buscar — deixou de ser um endereço').toBe(false);
  });
});

// ========================= MUTATIONS CHECKED =========================
// (Recorded while WebGazer was still in the engine; it left with ADR-0214.)
//
//   1. a SECOND external fetch appearing in a real module (`platform/tts`) -> TWO fail: the declared-URLs case and the one
//      asserting the external fetch is still ONE. It is this file's likeliest defect: not someone deleting the sieve,
//      someone adding a CDN to solve a problem.
//   2. the URL detector killed -> THREE fail. An absence sieve that finds nothing is green for the worst possible reason.
//   4. WebGazer becoming local (`/vendor/webgazer.js`) -> TWO fail, and ⚠️ THIS FAILS ON GOOD NEWS: it is #129 resolved.
//      When it happens, the WebGazer entry leaves this list. Written so nobody reads the red as a regression.
//
//   5. 🎯 THE DISCRIMINATOR BACK TO `\bfetch\s*\(` (2026-09-09) -> the inventory fails, the mutation that proves that
//      day's fix: with it, `platform/heavy` — which RECEIVES `fetch` and calls it by another name — vanishes from the
//      measured set. ⚠️ It does not catch carelessness: it catches GOOD DESIGN blinding a sieve, the most expensive hole
//      because nobody did anything wrong.
//   6. a new module gaining `fetch(` with no `TOCAM_NA_REDE` entry -> fails on the same assertion, the half the list
//      exists for. ⚠️ And EQUALITY (not inclusion) is what makes the list SHRINK: when a fetch goes, its entry must LEAVE,
//      or the inventory reports a debt already paid.
//
//   3. ⚠️ comments counting again -> SURVIVES, an equivalence by VACUITY: measured, there were ZERO URLs in comments in
//      all of `app/js`, so the filter removed nothing. It STAYS all the same, and stops being equivalent at the first
//      comment that cites a source — «ver https://…» would be accused as a new fetch. The lesson
//      `action-vocabulary-boundary` already wrote: counting prose creates the incentive to DELETE THE EXPLANATION to lower
//      the number.
