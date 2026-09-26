// SPDX-License-Identifier: AGPL-3.0-or-later
// THE HEAVY THINGS COME DOWN ON THE FIRST LOAD — and what has nowhere to come from IS SAID (ADR-0110/0116/0119).
//
// ========================= WHAT THIS FILE GUARDS =========================
// 📏 The fetcher exists so the heavy things the engine promises are delivered (ADR-0119) — and the defect it can
// introduce is worse than the one it fixes: a fetcher that silently SKIPS what has no URL makes an unbuilt subsystem
// look handled, exactly the shape of false report this repository has caught three times.
//
// 🎯 So the central assertion is not «baixou»: it is that an entry WITH NO SOURCE returns `sem-fonte` with the reason.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import {
  downloadHeavy as downloadWith, bytesLeftToDownload, HEAVY_FILES, CACHE_HEAVY, sha256With, checkedCacheHas, deliveryPath, heavyAtBoot,
} from '../app/js/platform/heavy.js';
import { DELIVERY_LISTS, LIBRAS_AVATAR_FOLDER, LIBRAS_AVATAR_STAGE_CHUNK } from '../app/js/platform/heavy-catalogue.js';

/** The page the delivery is resolved against — REQUIRED since ADR-0232 D4, so every case names one. */
const BASE = 'https://escola.example/';
/** The download with the page named; a case that is about another page, or another port, overrides it. */
const downloadHeavy = (options) => downloadWith({ base: BASE, ...options });

/** A fake Cache Storage that COUNTS what it is asked for. */
function cacheFalsa(jaTem = []) {
  const guardados = new Set(jaTem);
  const postos = [];
  const cache = {
    match: async (u) => (guardados.has(u) ? { ok: true } : undefined),
    put: async (u) => { postos.push(u); guardados.add(u); },
  };
  return { abertos: [], postos, cacheStorage: { open: async (n) => { cache._nome = n; return cache; } }, cache };
}

/** A response whose body is the URL itself — so the fake digest below can recognise the RIGHT body of each entry. */
const corpo = (u) => new TextEncoder().encode(u).buffer;
const resposta = (u, dados = corpo(u)) => ({ ok: true, status: 200, statusText: 'OK', headers: new Headers(), arrayBuffer: async () => dados, clone: () => ({}) });
/** The upstream address a delivery path stands for (ADR-0177: the download asks the delivery, the body is still that file). */
const urlDe = (pedido) => {
  const naEntrega = pedido.slice(pedido.indexOf('heavy/')); // the download asks for an ABSOLUTE address, under the page
  return HEAVY_FILES.find((p) => p.url && deliveryPath(p.url) === naEntrega)?.url ?? pedido;
};
const buscarOk = () => async (u) => resposta(urlDe(u));
/** #168: the pinned hash of the entry whose URL the body spells; anything else hashes to garbage. */
const digestPelaUrl = async (buf) => {
  const texto = new TextDecoder().decode(buf);
  return HEAVY_FILES.find((p) => p.url === texto)?.sha256 ?? '0'.repeat(64);
};

describe('o buscador das coisas pesadas', () => {
  it('🎯 [Zero] o que NÃO tem fonte devolve `sem-fonte` COM a razão — nunca é saltado em silêncio', async () => {
    const f = cacheFalsa();
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscarOk(), digest: digestPelaUrl });
    const sem = r.filter((x) => x.outcome === 'sem-fonte');
    expect(sem.map((x) => x.id).sort(), 'só a arte continua sem acervo — a visão ganhou fonte no ADR-0124/0132, e o ADR-0133 fechou a lista de licenças sem escolher de onde a arte vem').toEqual(['arte:acervo']);
    for (const s of sem) {
      expect(s.error, `${s.id} não diz PORQUE não tem fonte`).toBeTruthy();
      expect(s.error.length, `${s.id} tem uma razão curta demais para servir a alguém`).toBeGreaterThan(40);
    }
  });

  it('📏 [Boundary] toda voz COM fonte tem peso MEDIDO — uma voz nova sem medição sub-reportaria em silêncio', () => {
    // ⚠️ A small, silent hole: a new voice with no measurement would leave `bytesLeftToDownload` under-reporting, and the notice telling
    // a school how much will come down would lie by omission. Nobody would see an error.
    const vozes = HEAVY_FILES.filter((p) => p.id.startsWith('voz:') && p.url);
    expect(vozes.length, 'no voice in the catalogue — the case would measure nothing').toBeGreaterThan(0);
    expect(vozes.filter((p) => !(p.bytes > 0)).map((p) => p.id), 'a voice with no measured size — measure it').toEqual([]);
  });

  it('📌 [Boundary] o que já está na cache não é buscado outra vez — isto corre em TODO arranque', async () => {
    const primeiro = HEAVY_FILES.find((p) => p.url).url;
    const f = cacheFalsa([primeiro]);
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscarOk(), digest: digestPelaUrl });
    expect(r.find((x) => x.outcome === 'ja-tinha'), 'não reconheceu o que já tinha').toBeTruthy();
    expect(f.postos.includes(primeiro), 'voltou a gravar o que já estava lá').toBe(false);
  });

  it('🔴 [Inverse] uma falha de rede é REPORTADA e a lista CONTINUA — não derruba o arranque', async () => {
    const f = cacheFalsa();
    let n = 0;
    const buscar = async (u) => { n += 1; if (n === 1) throw new Error('rede caiu'); return resposta(urlDe(u)); };
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscar, digest: digestPelaUrl });
    // the catalogue's files; this fake delivery serves no list, which is reported apart (`a delivery's list`, below)
    const doCatalogo = r.filter((x) => HEAVY_FILES.some((p) => p.id === x.id));
    expect(doCatalogo.filter((x) => x.outcome === 'falhou').length, 'a falha não foi reportada').toBe(1);
    expect(r.filter((x) => x.outcome === 'baixado').length, 'a lista parou na primeira falha').toBe(HEAVY_FILES.filter((p) => p.url).length - 1);
  });

  it('[Interface] `apenas` limita a lista — um consumidor pode querer só as vozes', async () => {
    const f = cacheFalsa();
    const id = HEAVY_FILES.find((p) => p.url).id;
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscarOk(), digest: digestPelaUrl, only: [id] });
    expect(r.map((x) => x.id)).toEqual([id]);
  });

  it('📏 o peso por baixar é o das que TÊM fonte e ainda não desceram', async () => {
    const semNada = bytesLeftToDownload([]);
    // The vision runtime and models, Kokoro (ADR-0198: the 325 532 232-byte model, its tokenizer and 34 voice tables of 522 240
    // bytes) and, since ADR-0216, the runtime that SPEAKS it — espeak-ng and onnxruntime-web, 45.5 MiB, which used to be a
    // dependency of each game — plus the three reading models, 850 MiB (pt 378, en 162, es 310). ADR-0207 took out the earlier
    // neural voices and their phonemizer (−258.9 MiB), ADR-0214 WebGazer (−1.8 MiB). What has no source adds nothing.
    //
    // ⚠️ THIS IS THE WHOLE CATALOGUE AND NOBODY EVER DOWNLOADS IT: it is the number a `problems` line would be lying about. What
    // a device actually fetches is `heavyAtBoot`, which asks for what the game declared and what the delivery serves.
    // The Libras player has no catalogue entry: its files are the delivery's own, kept by its list (ADR-0234, phase B3 took the
    // Unity build's 19.7 MiB out of this total).
    expect(Math.round(semNada / 1024 / 1024), 'the total changed — check the catalogue').toBe(1363);
    const f = cacheFalsa();
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscarOk(), digest: digestPelaUrl });
    expect(bytesLeftToDownload(r), 'depois de tudo descer não falta nada').toBe(0);
  });

  it('⚠️ [Zero] sem Cache Storage nada rebenta — reporta e devolve', async () => {
    const r = await downloadHeavy({ cacheStorage: undefined, fetch: buscarOk(), digest: digestPelaUrl });
    expect(r.every((x) => x.outcome === 'falhou' || x.outcome === 'sem-fonte')).toBe(true);
  });

  it('📌 o nome da cache é versionado', () => {
    expect(CACHE_HEAVY).toMatch(/-v\d+$/);
  });
});

describe('what the report SAYS when a file does not arrive (probed 2026-09-23)', () => {
  /*
   * 🔴 The probe before the cut found the same shape ten times: WHETHER a file enters the cache is held; what the report says
   * when it does not — and what travels with one that does — could be undone with the suite green. The report is what a school
   * reads to know if the delivery is missing a file, if the host cannot hash, or if the network failed, and each needs a
   * different fix.
   */
  const alvo = HEAVY_FILES.find((p) => p.url);

  it('🔴 [Zero] without Cache Storage EVERY file is reported, with the reason — the case above passed on an empty list', async () => {
    const r = await downloadHeavy({ cacheStorage: undefined, fetch: buscarOk(), digest: digestPelaUrl });
    expect(r.length, '`every` on an empty list is true: nothing was reported').toBe(HEAVY_FILES.length + DELIVERY_LISTS.length);
    expect(r.every((x) => x.outcome === 'falhou' && /Cache Storage/.test(x.error))).toBe(true);
  });

  it('🔴 [Zero] without fetch the same — and the cache is never opened', async () => {
    const f = cacheFalsa();
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: undefined, digest: digestPelaUrl, only: [alvo.id] });
    expect(r).toEqual([{ id: alvo.id, outcome: 'falhou', error: 'sem Cache Storage ou sem fetch' }]);
    expect(f.cache._nome, 'a cache was opened on a host that cannot fetch into it').toBeUndefined();
  });

  /*
   * 🔴 THE GLOBAL IS NEVER THE ANSWER (ADR-0232 D4): the host's `fetch` is what the download uses, and a global `fetch` that
   * would answer is not asked. Before D4 an absent port fell back to the global — a download that worked here and in no
   * second root of the same page.
   */
  it('🔴 [Right] only the INJECTED fetch is asked — the global one never is', async () => {
    const global = vi.fn(async () => { throw new Error('the global fetch was reached'); });
    vi.stubGlobal('fetch', global);
    try {
      const f = cacheFalsa();
      const pedidos = [];
      const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: async (u) => { pedidos.push(u); return resposta(urlDe(u)); },
        digest: digestPelaUrl, only: [alvo.id] });
      expect(global).not.toHaveBeenCalled();
      expect(pedidos).toEqual([`${BASE}${deliveryPath(alvo.url)}`]);
      expect(r[0].outcome).toBe('baixado');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('🔴 [Right] a file missing from the delivery says HTTP 404 — not a hash mismatch — and its body is never read', async () => {
    const f = cacheFalsa();
    let lido = false;
    const buscar = async () => ({ ok: false, status: 404, statusText: 'Not Found', headers: new Headers(),
      arrayBuffer: async () => { lido = true; return new ArrayBuffer(0); } });
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscar, digest: digestPelaUrl, only: [alvo.id] });
    expect(r[0]).toEqual({ id: alvo.id, outcome: 'falhou', error: 'HTTP 404' });
    expect(lido, 'the body of an error page was read and hashed').toBe(false);
    expect(f.postos).toEqual([]);
  });

  it('📌 [Right] a thrown error is reported by its MESSAGE, not by its class name', async () => {
    const f = cacheFalsa();
    const buscar = async () => { throw new Error('rede caiu'); };
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscar, digest: digestPelaUrl, only: [alvo.id] });
    expect(r[0].error).toBe('rede caiu');
  });

  it('📌 [Right] a downloaded file reports its measured size, and progress hears every report as it happens', async () => {
    const f = cacheFalsa();
    const ouvidos = [];
    const [a, b] = HEAVY_FILES.filter((p) => p.url);
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscarOk(), digest: digestPelaUrl,
      only: [a.id, b.id], onProgress: (x) => ouvidos.push(x) });
    expect(r[0]).toEqual({ id: a.id, outcome: 'baixado', bytes: a.bytes });
    expect(ouvidos, 'the progress callback did not hear every report, in order').toEqual(r);
  });

  it('🔴 [Right] what is kept keeps the delivery\'s headers — a WebAssembly file served offline needs its content type', async () => {
    const guardados = new Map();
    const cacheStorage = { open: async () => ({ match: async () => undefined, put: async (u, resp) => { guardados.set(u, resp); } }) };
    const buscar = async (u) => ({ ...resposta(urlDe(u)), headers: new Headers({ 'content-type': 'application/wasm' }) });
    await downloadHeavy({ cacheStorage, fetch: buscar, digest: digestPelaUrl, only: [alvo.id] });
    expect(guardados.get(alvo.url)?.headers.get('content-type')).toBe('application/wasm');
  });
});

// Two mutations of the 2026-09-23 probe are EQUIVALENT today and have no case, by construction: the report for an entry with
// NO pinned sha256 (the guard, and the wording that names it). The catalogue is a constant, and «every entry with a URL carries
// a measured sha256» below refuses the only input that would reach it — the guard is the second line behind that one.

// ================================ MUTATIONS CHECKED ================================
// 1. `if (!p.url) continue;` (skipping silently instead of returning `sem-fonte`) → the [Zero] fails. It is the whole
//    mutation: an unbuilt subsystem would look handled, the defect ADR-0119 measured.
// 3. removing `cache.match` (always fetch) → the [Boundary] fails: everything again at every start.
// 4. letting the exception rise instead of catching it → the [Inverse] fails, and the real defect is bigger than the
//    case: a network failure would bring down a game's start over a resource it does not even use.

describe('what comes from outside is checked before it is kept (issue #168; STRIDE client pass)', () => {
  // 📏 Measured on 2026-09-13: `downloadHeavy` put the response into Cache Storage as it came — JavaScript and WebAssembly
  // from jsDelivr and Brown, models from Hugging Face and Google — and a pinned URL is not pinned content. What is cached
  // runs in the child's page and is served offline from then on.
  it('📏 [Boundary] every entry with a URL carries a measured sha256', () => {
    const sem = HEAVY_FILES.filter((p) => p.url && !/^[0-9a-f]{64}$/.test(p.sha256 ?? ''));
    expect(sem.map((p) => p.id), 'an entry with no pinned hash would be kept unchecked').toEqual([]);
  });

  it('🔴 [Right] an altered body is NOT kept — reported, and the list goes on', async () => {
    const f = cacheFalsa();
    const [alvo, outro] = HEAVY_FILES.filter((p) => p.url);
    const buscar = async (u) => (urlDe(u) === alvo.url ? resposta(u, new TextEncoder().encode('altered').buffer) : resposta(urlDe(u)));
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscar, digest: digestPelaUrl, only: [alvo.id, outro.id] });
    expect(f.postos.includes(alvo.url), 'the altered body entered the cache').toBe(false);
    const dele = r.find((x) => x.id === alvo.id);
    expect(dele.outcome).toBe('falhou');
    expect(dele.error, 'the report does not say it was the integrity check').toMatch(/sha256/);
    expect(r.find((x) => x.id === outro.id).outcome, 'one refusal stopped the list').toBe('baixado');
  });

  it('🔴 [Right] the digest `sha256With(crypto.subtle)` builds is the REAL one — a body that is not the file is refused', async () => {
    const f = cacheFalsa();
    const alvo = HEAVY_FILES.find((p) => p.url);
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscarOk(), digest: sha256With(webcrypto.subtle), only: [alvo.id] });
    expect(f.postos, 'the default path kept a body without hashing it').toEqual([]);
    // the hash it reports is the body's real SHA-256 — a broken default that hashed to anything would still refuse
    const real = createHash('sha256').update(alvo.url).digest('hex');
    expect(r[0].error, 'the reported hash is not the body\'s real SHA-256').toContain(`got ${real}`);
  });

  it('🎯 [Zero] a host that cannot hash keeps NOTHING — unverifiable is not verified', async () => {
    const f = cacheFalsa();
    const alvo = HEAVY_FILES.find((p) => p.url);
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscarOk(), digest: null, only: [alvo.id] });
    expect(f.postos).toEqual([]);
    expect(r[0].outcome).toBe('falhou');
    expect(r[0].error, 'the report does not say the host cannot hash').toMatch(/cannot compute a sha256/);
  });

  it('🔴 [Right] the digest `sha256With` builds IS SHA-256 — the FIPS 180-2 vector for «abc»', async () => {
    // The refusal case above passes with any wrong algorithm (SHA-1 refuses a wrong body too); this pins the real one.
    expect(await sha256With(webcrypto.subtle)(new TextEncoder().encode('abc').buffer))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('🎯 [Zero] a host with no `crypto.subtle` gets NO digest — and the download keeps nothing from it', async () => {
    // 📌 An insecure context has no `crypto.subtle`; `sha256With` answers `null` there, which is the download's «cannot hash».
    expect(sha256With(undefined)).toBeNull();
    expect(sha256With(null)).toBeNull();
    const f = cacheFalsa();
    const alvo = HEAVY_FILES.find((p) => p.url);
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscarOk(), digest: sha256With(undefined), only: [alvo.id] });
    expect(f.postos).toEqual([]);
    expect(r[0].error).toMatch(/cannot compute a sha256/);
  });

  it('🔴 [Right] the digest asks the subtle it was HANDED, for SHA-256 — never a global one', async () => {
    const pedidos = [];
    const subtle = { digest: async (alg, body) => { pedidos.push([alg, body.byteLength]); return new Uint8Array([0, 15, 255]).buffer; } };
    expect(await sha256With(subtle)(new ArrayBuffer(4))).toBe('000fff');
    expect(pedidos).toEqual([['SHA-256', 4]]);
  });

  it('📌 [Right] what was cached before the check is not trusted: the cache has a new name', () => {
    /*
     * 🔴 THE CACHE NAME STAYS IN PORTUGUESE, and it is a decision, not an oversight (ADR-0219): renaming the FOLDER changes a
     * path, but renaming the CACHE orphans everything inside it — 814 MiB a school has already downloaded and would download
     * again on the first start after the update. The record leaves stored keys out for exactly this reason, and a cache's
     * name is one of them.
     */
    expect(CACHE_HEAVY, 'a cache mudou de nome: a escola volta a baixar os 814 MiB').toBe('incl-pesados-v2');
  });
});

describe('the heavy files come from the delivery\'s own origin (ADR-0177, issue #173)', () => {
  it('🔴 [Right] the download asks the page\'s origin for each file, and keeps it under the upstream address', async () => {
    const f = cacheFalsa();
    const pedidos = [];
    const buscar = async (u) => { pedidos.push(u); return resposta(urlDe(u.slice('https://escola.example/jogo/'.length))); };
    const alvo = HEAVY_FILES.find((p) => p.url);
    await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscar, digest: digestPelaUrl, only: [alvo.id], base: 'https://escola.example/jogo/' });
    expect(pedidos, 'the download asked a third party').toEqual([`https://escola.example/jogo/${deliveryPath(alvo.url)}`]);
    expect(f.postos, 'the file is not kept under the address the libraries ask for').toEqual([alvo.url]);
  });

  it('🎯 [Zero] no file is asked of a host outside the page\'s origin', async () => {
    const f = cacheFalsa();
    const hosts = new Set();
    const buscar = async (u) => { hosts.add(new URL(u).host); return resposta(urlDe(new URL(u).pathname.slice(1))); };
    await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscar, digest: digestPelaUrl, base: 'https://escola.example/' });
    expect([...hosts]).toEqual(['escola.example']);
  });

  it('📌 [Right] a delivery path keeps the upstream host and path, so two files never share one', () => {
    const caminhos = HEAVY_FILES.filter((p) => p.url).map((p) => deliveryPath(p.url));
    expect(new Set(caminhos).size).toBe(caminhos.length);
    for (const c of caminhos) expect(c).toMatch(/^heavy\/[\w.-]+\//);
  });
});

describe('whether a file is in the checked cache — the question the loaders ask (ADR-0232 D4)', () => {
  const alvo = HEAVY_FILES.find((p) => p.url);

  it('🔴 [Right] it opens THE checked cache, by its name, and answers what it holds', async () => {
    const abertas = [];
    const cacheStorage = { open: async (n) => { abertas.push(n); return { match: async (u) => (u === alvo.url ? { ok: true } : undefined) }; } };
    const has = checkedCacheHas(cacheStorage);
    expect(await has(alvo.url)).toBe(true);
    expect(await has('https://outro.example/x')).toBe(false);
    expect(abertas, 'another cache was asked — a file kept unchecked would count as present').toEqual([CACHE_HEAVY, CACHE_HEAVY]);
  });

  it('🎯 [Zero] a host with no Cache Storage holds nothing — every file is missing, nothing throws', async () => {
    expect(await checkedCacheHas(undefined)(alvo.url)).toBe(false);
  });
});

describe('what a game\'s start fetches (ADR-0216 §3)', () => {
  const doIdioma = (lingua) => HEAVY_FILES.map((p) => p.id).filter((id) => id.startsWith(`reading:${lingua}:`));

  it('🔴 [Zero] without the neural voice declared, neither its model NOR the runtime that speaks it — and nothing else is left out', () => {
    // ADR-0216: the runtime moved from each game's dependencies into the catalogue, so it travels by the SAME answer as the
    // model. A game of shapes that downloaded 45.5 MiB of phonemizer would be the cost this filter exists to refuse.
    const ids = heavyAtBoot({ kokoro: false });
    expect(ids.filter((id) => id.startsWith('voz:')), 'a game that cannot speak Kokoro downloads its model or its runtime').toEqual([]);
    expect(ids).toEqual(HEAVY_FILES.map((p) => p.id).filter((id) => !id.startsWith('voz:') && !id.startsWith('reading:') && !id.startsWith('commands:')
      && !id.startsWith('libras:')));
    expect(ids.length).toBeGreaterThan(0);
  });

  it('🔴 [Right] with the neural voice declared, the whole voice — the model, the tokenizer and every voice', () => {
    expect(heavyAtBoot({ kokoro: true }))
      .toEqual(HEAVY_FILES.map((p) => p.id).filter((id) => !id.startsWith('reading:') && !id.startsWith('commands:') && !id.startsWith('libras:')));
  });

  /**
   * 🔴 THE READING MODELS OF EVERY LANGUAGE ASKED, THE FIRST ONE'S FIRST (ADR-0225 erratum; the Dev: «Negativo, baixar os três.
   * Toda criança vai experimentar as três línguas imediatamente.»). The root asks with the page's languages, so a child who
   * switches finds her new language's model kept; and each language comes WHOLE, in the order asked, because the download is
   * one file at a time and the first language named is hers.
   */
  it('🔴 [Right] a list asks for every listed language\'s reading model, whole, in the list\'s order', () => {
    const ids = heavyAtBoot({ kokoro: false, reading: ['es-MX', 'pt', 'en', 'es'] });
    expect(doIdioma('en').length, 'the fixture has no English model: the case would pass empty').toBeGreaterThan(0);
    expect(ids.filter((id) => id.startsWith('reading:')), 'the reading models are not the three, each whole, in the order asked')
      .toEqual([...doIdioma('es'), ...doIdioma('pt'), ...doIdioma('en')]);
  });

  /**
   * 📌 ONE LANGUAGE STILL ASKS FOR ONE, which is what `inclusionist-heavy --reading pt` builds its delivery by: a school that
   * narrows its delivery writes the same bytes it wrote before the three became the start's default.
   */
  it('🔴 [Right] one language asks for that language\'s model, and of no other', () => {
    const ids = heavyAtBoot({ kokoro: false, reading: 'pt-BR' });
    expect(ids.filter((id) => id.startsWith('reading:')), 'the named language\'s model is not asked for').toEqual(doIdioma('pt'));
    for (const outra of ['en', 'es']) {
      expect(ids.some((id) => id.startsWith(`reading:${outra}:`)), `one language asked, and the ${outra} model came too`).toBe(false);
    }
  });

  /**
   * 🔴 THE ORDER IS WHO WAITS (rule 1: one file at a time). A file of a language takes its language's position, a file of no
   * language (the runtimes, vision) the first, and the sort is stable — so everything of the child's language comes first, then
   * each other language whole. 📏 What it prevents: in the catalogue's order the reading models sit before the command models, and
   * a Spanish child's 38 MiB command model would wait behind 850 MiB of reading, 540 of it in languages she is not using.
   */
  it('🔴 [Right] everything of the child\'s language comes first — her command model never waits behind another language\'s reading', () => {
    const idiomas = ['es', 'pt', 'en'];
    const ids = heavyAtBoot({ kokoro: false, reading: idiomas, commands: idiomas });
    const lingua = (id) => (id.startsWith('reading:') ? id.split(':')[1] : id.startsWith('commands:model:') ? id.split(':')[2] : null);
    const posicoes = ids.map((id) => (lingua(id) ? idiomas.indexOf(lingua(id)) : 0));
    expect(posicoes, `a file came before a language asked earlier than its own: ${ids.join(' ')}`)
      .toEqual([...posicoes].sort((a, b) => a - b));
    const primeiraDeOutra = ids.findIndex((id) => lingua(id) && lingua(id) !== 'es');
    expect(ids.indexOf('commands:model:es'), 'her command model waits behind another language\'s file').toBeLessThan(primeiraDeOutra);
    expect(ids.indexOf('reading:es:encoder'), 'her reading model waits behind another language\'s file').toBeLessThan(primeiraDeOutra);
    for (const id of ids.filter((x) => !lingua(x))) {
      expect(ids.indexOf(id), `${id}, which every language needs, waits behind another language`).toBeLessThan(primeiraDeOutra);
    }
    // stable: within the child's language, the catalogue's order — the runtime that opens a model before the model
    const doCatalogo = HEAVY_FILES.map((p) => p.id);
    const primeiros = ids.slice(0, primeiraDeOutra);
    expect(primeiros, 'the first position is not in the catalogue\'s order').toEqual(doCatalogo.filter((id) => primeiros.includes(id)));
  });

  // MUTATIONS CHECKED for the reading list and the order (ADR-0225 erratum, 2026-09-26), all red: the catalogue's order kept (no
  // rank) · a list read as its first language alone · the files of no language ranked last · the reading ranked by the commands'
  // list · the command models ranked flat. The root asking for the boot language alone again is red in
  // `boot-create-game.node.test.js`, the case that watches what the start asks for when a game listens.

  it('🔴 [Zero] a game that does not listen downloads no reading model, in any language', () => {
    for (const portas of [{ kokoro: false }, { kokoro: true }, { kokoro: false, reading: null }, { kokoro: false, reading: [] },
      { kokoro: false, commands: ['pt', 'en', 'es'] }]) {
      expect(heavyAtBoot(portas).filter((id) => id.startsWith('reading:')), `asked with ${JSON.stringify(portas)}`).toEqual([]);
    }
  });

  /**
   * 🔴 A GAME THAT ONLY LISTENS STILL NEEDS SOMETHING TO OPEN THE MODEL WITH. The graph runtime is named `voz:runtime:onnx`
   * because the voice asked for it first, and that name made the filter treat it as the voice's: a delivery built for a game
   * that only listens carried 378 MiB of Whisper and nothing able to run it, and the first `listen()` asked for a file the
   * build had never written. Measured on 2026-09-21 while building the delivery for the Dev's round.
   */
  it('🔴 [Right] a game that only LISTENS gets the graph runtime — and neither the phonemizer nor the voice', () => {
    const ids = heavyAtBoot({ kokoro: false, reading: 'pt-BR' });
    const grafos = HEAVY_FILES.map((p) => p.id).filter((id) => id.startsWith('voz:runtime:onnx'));
    expect(grafos.length, 'the catalogue has no graph runtime: the case would pass empty').toBeGreaterThan(0);
    for (const id of grafos) expect(ids, `${id} left out — the reading would ask the delivery for a file nobody wrote`).toContain(id);
    expect(ids.filter((id) => id.startsWith('voz:runtime:fonemas')),
      'the phonemizer came along: 18.7 MiB of turning letters into sounds, which a game that only listens never runs').toEqual([]);
    expect(ids.filter((id) => id.startsWith('voz:kokoro:')), 'the voice model came with a game that does not speak').toEqual([]);
  });

  /**
   * 🔴 THE COMMAND MODELS ARE NOT A GAME'S TO DECLARE (issue #184; ADR-0111). Saying «menu» instead of pressing it is a way INTO
   * the controller, like the camera and the gaze, and a cartridge does not get to close one. What decides is the LANGUAGES
   * asked: one, as below, or the list the root asks for (the case after).
   */
  it('🔴 [Right] the command model of the child\'s language, with the runtime that loads it, and no other language', () => {
    const ids = heavyAtBoot({ kokoro: false, commands: 'pt-BR' });
    expect(ids).toContain('commands:model:pt');
    for (const outra of ['en', 'es']) expect(ids, `a child commanding in Portuguese downloaded the ${outra} model`).not.toContain(`commands:model:${outra}`);
    const runtime = HEAVY_FILES.map((p) => p.id).filter((id) => id.startsWith('commands:runtime'));
    expect(runtime.length, 'the catalogue has no command runtime: the case would pass empty').toBeGreaterThan(0);
    for (const id of runtime) expect(ids, `${id} left out — 32 MiB of model and nothing to load it with`).toContain(id);
  });

  /**
   * 🔴 A LIST OF LANGUAGES, THE FIRST ONE'S MODEL FIRST (ADR-0225 erratum; the Dev: «A entrega leva as três línguas.»). The root
   * asks for every language the page can switch to, so a switch mid-game finds its model kept; and the download is one file at a
   * time, so the order of the list is who waits — the child's language is named first, and her model must come first.
   */
  it('🔴 [Right] a list asks for every listed language\'s model, in the list\'s order, with the runtime once', () => {
    const ids = heavyAtBoot({ kokoro: false, commands: ['es-MX', 'pt', 'en', 'es'] });
    expect(ids.filter((id) => id.startsWith('commands:model:')), 'the models are not the three, in the order asked')
      .toEqual(['commands:model:es', 'commands:model:pt', 'commands:model:en']);
    const runtime = HEAVY_FILES.map((p) => p.id).filter((id) => id.startsWith('commands:runtime'));
    expect(ids.filter((id) => id.startsWith('commands:runtime')), 'the runtime is not there, once').toEqual(runtime);
    expect(heavyAtBoot({ kokoro: false, commands: ['en'] }).filter((id) => id.startsWith('commands:model:')))
      .toEqual(['commands:model:en']);
  });

  it('🔴 [Right] the download follows the order it is given — the child\'s model is fetched before the others', async () => {
    const f = cacheFalsa();
    const pedidos = [];
    const buscar = async (u) => { pedidos.push(urlDe(u)); return resposta(urlDe(u)); };
    const ordem = ['commands:model:es', 'commands:model:pt', 'commands:model:en'];
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscar, digest: digestPelaUrl, only: ordem });
    expect(r.map((x) => x.id), 'the reports are not in the order asked').toEqual(ordem);
    expect(pedidos, 'the fetches are not in the order asked').toEqual(ordem.map((id) => HEAVY_FILES.find((p) => p.id === id).url));
  });

  // MUTATIONS CHECKED for the list (ADR-0225 erratum), both red: the models left in catalogue order (the child's language no
  // longer first) · `downloadHeavy` going back to the catalogue's order instead of the order `only` gives. The root asking for
  // the boot language alone again is red in `kokoro-in-the-voice.browser.test.js`, the case that watches what the start fetches.

  it('🔴 [Zero] a delivery that serves no spoken language downloads neither a model nor the runtime', () => {
    // The runtime alone is 3.1 MiB that could never hear a word: it is only useful beside a model.
    for (const portas of [{ kokoro: false }, { kokoro: true }, { kokoro: false, commands: null }, { kokoro: false, commands: [] },
      { kokoro: false, reading: 'pt' }]) {
      expect(heavyAtBoot(portas).filter((id) => id.startsWith('commands:')), `asked with ${JSON.stringify(portas)}`).toEqual([]);
    }
  });

  // MUTATIONS CHECKED for the command models (2026-09-21) — `scratchpad/mutar-comandos-no-catalogo.py`, 7 of 8 red: the child's
  // model left out · all three languages fetched at once (112 MiB instead of 32) · the runtime left out · the runtime fetched
  // with no language at all · the language read at `id.split(':')[1]`, which calls the runtime a language · the mirror folder
  // removed · `--commands` not consuming its value, so the language was taken for the delivery folder (the trap `--base`
  // already had, and it needed the case with the flag FIRST to see it).
  // ⚠️ THE EIGHTH SURVIVED AND IS NOT COVERED HERE: one digit changed in a sha256. No case can see it, because what checks a
  // hash is the thing that USES it — the delivery run refuses to write bytes that do not match. 📏 So it was measured instead:
  // on 2026-09-21 all six files were written into `dist` from the staging tree, which is the six hashes proved against the
  // real bytes. A case that asserted the constant against itself would be the gate reading its own answer.
  /**
   * 🔴 THE LIBRAS PLAYER ONLY WHILE DEAF MODE IS ON (ADR-0234): a device whose child never asks for signing pays nothing of it.
   * Since phase B3 no catalogue file is the player's — the Unity build left — so what `libras` adds is the delivery's list alone.
   */
  it('🔴 [Right] with `libras` the start asks for the Libras list alone — no catalogue file is the player\'s, and nothing of it without `libras`', () => {
    expect(HEAVY_FILES.filter((p) => p.id.startsWith('libras:')), 'a catalogue file is the Libras player\'s again').toEqual([]);
    expect(heavyAtBoot({ kokoro: false, libras: true }).filter((id) => id.startsWith('libras:'))).toEqual(['libras:avatar:delivery']);
    for (const portas of [{ kokoro: false }, { kokoro: true }, { kokoro: false, libras: false }, { kokoro: false, commands: 'pt', reading: 'pt' }]) {
      expect(heavyAtBoot(portas).filter((id) => id.startsWith('libras:')), `asked with ${JSON.stringify(portas)}`).toEqual([]);
    }
  });

  it('📌 [Boundary] the region is not the language: `es-MX` asks for the Spanish model', () => {
    expect(heavyAtBoot({ kokoro: false, reading: 'es-MX' }).filter((id) => id.startsWith('reading:'))).toEqual(doIdioma('es'));
  });
});

/**
 * 🔴 WHAT A DELIVERY MAKES IS KEPT BY ITS LIST (ADR-0234, pillar 8). 📏 Measured on a served delivery (2026-09-25): the player's
 * files came from the network on every use — no precache entry, no route — and offline the interpreter told the child signing
 * was unavailable. The delivery lists them with their sha256, and the start keeps each, checked, under its own address, while
 * deaf mode is on. These cases hold the list-keeping rule itself, over the Libras player's list (the only one since phase B3).
 */
describe('a delivery\'s list: the Libras player\'s files, kept checked (ADR-0234, pillar 8)', () => {
  const LIST = DELIVERY_LISTS.find((l) => l.id === 'libras:avatar:delivery');
  const digest = sha256With(webcrypto.subtle);
  const hex = (text) => createHash('sha256').update(text).digest('hex');
  const FILES = { 'libras/avatar/manifest.json': '{"format":1}', 'libras/avatar/clips/AÇÃO.json': '{"tracks":[]}', 'libras/avatar/glosses.json': '[]' };
  const listOf = (files, extra = []) => ({ format: 1, files: [...Object.entries(files).map(([path, text]) => ({ path, sha256: hex(text), bytes: text.length })), ...extra] });
  /** A Cache Storage holding real `Response`s, so the listed hash a kept file carries can be read back. */
  function cacheWithResponses(held = new Map()) {
    const put = [];
    const cache = { match: async (u) => held.get(u), put: async (u, r) => { put.push(u); held.set(u, r); } };
    return { held, put, cacheStorage: { open: async () => cache } };
  }
  /** The delivery, served: the list, and each file under the list's hash query; `served` overrides a file's bytes. */
  function delivery(list, served = FILES) {
    const asked = [];
    const fetch = async (u, init) => {
      asked.push({ u, init });
      const url = new URL(u);
      const path = decodeURIComponent(url.pathname.slice(1));
      if (path === LIST.path) return new Response(JSON.stringify(list));
      return path in served ? new Response(served[path], { headers: { 'content-type': 'application/json' } }) : new Response('', { status: 404 });
    };
    return { asked, fetch };
  }
  const keep = (c, d, only = [LIST.id]) => downloadHeavy({ cacheStorage: c.cacheStorage, fetch: d.fetch, digest, only });

  it('🔴 [Right] each listed file is fetched from the page\'s origin, checked, and kept under its OWN address — the one the player asks', async () => {
    const c = cacheWithResponses();
    const d = delivery(listOf(FILES));
    const [r] = await keep(c, d);
    expect(r).toEqual({ id: LIST.id, outcome: 'baixado', bytes: Object.values(FILES).reduce((s, t) => s + Buffer.byteLength(t), 0) });
    // the player asks a clip at its address as a URL spells it: the key is that address
    expect(c.put).toEqual(Object.keys(FILES).map((p) => new URL(p, BASE).href));
    expect(c.put).toContain(`${BASE}libras/avatar/clips/A%C3%87%C3%83O.json`);
    expect(d.asked[0], 'the list may come from a stale HTTP cache').toEqual({ u: `${BASE}${LIST.path}`, init: { cache: 'no-store' } });
    expect(d.asked.slice(1).map((a) => new URL(a.u).origin)).toEqual(Object.keys(FILES).map(() => new URL(BASE).origin));
    const kept = c.held.get(`${BASE}libras/avatar/manifest.json`);
    expect(await kept.text()).toBe('{"format":1}');
    expect(kept.headers.get('content-type'), 'a file kept without its type is not read as what it is').toBe('application/json');
  });

  it('🔴 [Right] a body that is not the listed one is NOT kept — the others are, and the report says which and why', async () => {
    const c = cacheWithResponses();
    const [r] = await keep(c, delivery(listOf(FILES), { ...FILES, 'libras/avatar/clips/AÇÃO.json': '{"tracks":["other"]}' }));
    expect(r.outcome).toBe('falhou');
    expect(r.error).toMatch(/1 of 3 files of libras\/offline-avatar\.json not kept: libras\/avatar\/clips\/AÇÃO\.json: sha256 mismatch: expected [0-9a-f]{64}, got [0-9a-f]{64}/);
    expect(c.put, 'the altered clip was kept').not.toContain(`${BASE}libras/avatar/clips/A%C3%87%C3%83O.json`);
    expect(c.put.length, 'one bad file stopped the good ones').toBe(2);
  });

  it('📌 [Boundary] a file kept with the listed hash is not fetched again; one the list CHANGED is — and the old copy stays until the new one is checked', async () => {
    const c = cacheWithResponses();
    await keep(c, delivery(listOf(FILES)));
    const again = delivery(listOf(FILES));
    expect((await keep(c, again))[0]).toEqual({ id: LIST.id, outcome: 'ja-tinha' });
    expect(again.asked.map((a) => a.u), 'a kept file was fetched again').toEqual([`${BASE}${LIST.path}`]);
    // a new delivery changed the manifest, and a service worker would answer its old address from the cache: the hash is in the query
    const changed = { ...FILES, 'libras/avatar/manifest.json': '{"format":1,"commit":"2"}' };
    const refreshed = delivery(listOf(changed), { ...changed, 'libras/avatar/manifest.json': 'truncated' });
    await keep(c, refreshed);
    expect(refreshed.asked[1].u).toBe(`${BASE}libras/avatar/manifest.json?sha256=${hex(changed['libras/avatar/manifest.json'])}`);
    expect(await c.held.get(`${BASE}libras/avatar/manifest.json`).text(), 'the old manifest was lost to a body that failed its check').toBe('{"format":1}');
    expect((await keep(c, delivery(listOf(changed), changed)))[0].outcome).toBe('baixado');
    expect(await c.held.get(`${BASE}libras/avatar/manifest.json`).text()).toBe(changed['libras/avatar/manifest.json']);
  });

  it('🔴 [Right] a list naming anything outside the player\'s folders is refused WHOLE — nothing of it is kept', async () => {
    for (const path of ['quiz.html', 'libras/avatar/../../quiz.html', 'https://other.example/libras/avatar/x.json', 'libras/avatar/x.json?y=1', 'libras/avatar/', 'heavy/a/b.js']) {
      const c = cacheWithResponses();
      const [r] = await keep(c, delivery(listOf(FILES, [{ path, sha256: hex('x'), bytes: 1 }])));
      expect(r.outcome, path).toBe('falhou');
      expect(r.error, path).toMatch(/is refused: it names/);
      expect(c.put, `${path}: a file of a refused list was kept`).toEqual([]);
    }
    const c = cacheWithResponses();
    expect((await keep(c, delivery({ files: [{ path: 'libras/avatar/X.json', sha256: 'abc' }] })))[0].error).toMatch(/is refused: a listed file is malformed/);
    expect((await keep(c, delivery({ nothing: [] })))[0].error).toMatch(/is refused: its `files` is missing/);
  });

  it('🎯 [Zero] a host that cannot hash keeps nothing of the list — and does not even ask for it', async () => {
    const c = cacheWithResponses();
    const d = delivery(listOf(FILES));
    const [r] = await downloadHeavy({ cacheStorage: c.cacheStorage, fetch: d.fetch, digest: null, only: [LIST.id] });
    expect(r.outcome).toBe('falhou');
    expect(c.put).toEqual([]);
    expect(d.asked).toEqual([]);
  });
});

/**
 * 🔴 THE PLAYER'S AVATAR, CLIPS AND STAGE CHUNK ARE ALL IN THE LIST (ADR-0234, phase B3). 📏 Measured on a served delivery built
 * with `--libras --libras-avatar` (2026-09-25): with deaf mode on the start kept route A's 636 files and none of route B's — no
 * avatar, no clip, no three.js chunk in the checked cache — so offline the free player had nothing to draw. `--libras` writes
 * `libras/offline-avatar.json`, and the start keeps it by the list rule above.
 */
describe('a delivery\'s list: the free Libras player\'s avatar, clips and stage, kept checked (ADR-0234, phase B3)', () => {
  const LIST = DELIVERY_LISTS.find((l) => l.id === 'libras:avatar:delivery');
  const digest = sha256With(webcrypto.subtle);
  const hex = (text) => createHash('sha256').update(text).digest('hex');
  const STAGE = 'assets/libras-avatar-stage-fyxZVSPc.js';
  const FILES = {
    'libras/avatar/manifest.json': '{"format":1}', 'libras/avatar/avatar.glb': 'glTF', 'libras/avatar/clips/GATO.json': '{"tracks":[]}',
    'libras/avatar/clips/PRIMEIRO&ORDINAL.json': '{"tracks":[1]}', [STAGE]: 'export const three = 1;',
  };
  const listOf = (files, extra = []) => ({ format: 1, files: [...Object.entries(files).map(([path, text]) => ({ path, sha256: hex(text), bytes: text.length })), ...extra] });
  function cacheWithResponses() {
    const held = new Map();
    const put = [];
    return { held, put, cacheStorage: { open: async () => ({ match: async (u) => held.get(u), put: async (u, r) => { put.push(u); held.set(u, r); } }) } };
  }
  function delivery(list, served = FILES) {
    const asked = [];
    const fetch = async (u) => {
      asked.push(u);
      const path = decodeURIComponent(new URL(u).pathname.slice(1));
      if (path === LIST.path) return new Response(JSON.stringify(list));
      return path in served ? new Response(served[path]) : new Response('', { status: 404 });
    };
    return { asked, fetch };
  }
  const keep = (c, d, only = [LIST.id]) => downloadHeavy({ cacheStorage: c.cacheStorage, fetch: d.fetch, digest, only });

  it('🔴 [Right] the list names the avatar\'s folder and the stage chunk\'s name, and lies outside both', () => {
    expect(LIST, 'no list keeps the free player: offline it has nothing to draw').toBeTruthy();
    expect(LIST.folders).toEqual([LIBRAS_AVATAR_FOLDER, LIBRAS_AVATAR_STAGE_CHUNK]);
    // the chunk's start is the bundler's name for `ui/libras-avatar-stage`, under Vite's `assets/`: the delivery finds it by it
    expect([LIBRAS_AVATAR_FOLDER, LIBRAS_AVATAR_STAGE_CHUNK]).toEqual(['libras/avatar/', 'assets/libras-avatar-stage-']);
    for (const folder of LIST.folders) expect(LIST.path.startsWith(folder), `${LIST.path} is inside ${folder}`).toBe(false);
  });

  it('🔴 [Right] the avatar, every clip and the stage chunk are fetched, checked, and kept under the address the player asks', async () => {
    const c = cacheWithResponses();
    const [r] = await keep(c, delivery(listOf(FILES)));
    expect(r).toEqual({ id: LIST.id, outcome: 'baixado', bytes: Object.values(FILES).reduce((s, t) => s + Buffer.byteLength(t), 0) });
    expect(c.put).toEqual(Object.keys(FILES).map((p) => new URL(p, BASE).href));
    // the stage chunk is asked by the page's `import()` at this very address
    expect(c.put).toContain(`${BASE}${STAGE}`);
  });

  it('🔴 [Right] a tampered clip is NOT kept — the rest are, and the report names it', async () => {
    const c = cacheWithResponses();
    const [r] = await keep(c, delivery(listOf(FILES), { ...FILES, 'libras/avatar/clips/GATO.json': '{"tracks":["other"]}' }));
    expect(r.outcome).toBe('falhou');
    expect(r.error).toMatch(/1 of 5 files of libras\/offline-avatar\.json not kept: libras\/avatar\/clips\/GATO\.json: sha256 mismatch/);
    expect(c.put, 'the tampered clip was kept').not.toContain(`${BASE}libras/avatar/clips/GATO.json`);
    expect(c.put.length).toBe(4);
  });

  it('📌 [Boundary] the chunk\'s name admits only the stage: another asset, the chunk\'s bare start or the game\'s page refuse the list whole', async () => {
    for (const path of ['assets/pixi-BlYJRVmO.js', 'assets/libras-avatar-stage-', 'assets/libras-avatar-stage-x/../../quiz.html', 'quiz.html',
      'libras/avatar/../offline.json', 'libras/player/index.html']) {
      const c = cacheWithResponses();
      const [r] = await keep(c, delivery(listOf(FILES, [{ path, sha256: hex('x'), bytes: 1 }])));
      expect(r.error, path).toMatch(/is refused: it names/);
      expect(c.put, `${path}: a file of a refused list was kept`).toEqual([]);
    }
  });

  it('🎯 [Zero] a delivery built without `--libras` answers 404 for the list: reported, and nothing else is asked', async () => {
    const c = cacheWithResponses();
    const d = delivery(null, {});
    d.fetch = async (u) => { d.asked.push(u); return new Response('', { status: 404 }); };
    expect((await keep(c, d))[0]).toEqual({ id: LIST.id, outcome: 'falhou', error: `HTTP 404 — ${LIST.path}` });
    expect(d.asked).toEqual([`${BASE}${LIST.path}`]);
  });

  it('🔴 [Zero] without deaf mode the list is not asked for — a child who never asks for signing downloads none of it', async () => {
    expect(heavyAtBoot({ kokoro: false, libras: true })).toContain(LIST.id);
    for (const portas of [{ kokoro: false }, { kokoro: true, reading: 'pt', commands: ['pt', 'en', 'es'] }, { kokoro: false, libras: false }]) {
      expect(heavyAtBoot(portas), JSON.stringify(portas)).not.toContain(LIST.id);
    }
    const d = delivery(listOf(FILES));
    await downloadHeavy({ cacheStorage: cacheWithResponses().cacheStorage, fetch: d.fetch, digest, only: heavyAtBoot({ kokoro: false, commands: 'pt' }) });
    expect(d.asked.filter((u) => /libras|libras-avatar-stage/.test(u)), 'the free player\'s files came down with deaf mode off').toEqual([]);
  });
});

// MUTATIONS CHECKED for the free player's list (2026-09-25, scripted, each applied, this describe run, the file restored from a
// copy and checked by hash), 6 of 6 red: the list removed from `DELIVERY_LISTS` · the list asked for without deaf mode · the
// chunk's name widened to `assets/` · the list written inside the folder it names · a listed body kept unchecked · the chunk's
// bare name admitted.

// MUTATIONS CHECKED for a delivery's list (2026-09-25), 12 of 12 red, each on `platform/heavy.ts` and restored from a copy: the
// folder check removed · a query or fragment admitted · a folder admitted as a file · the body kept unchecked · a kept file
// fetched on every start · the hash left out of the address asked · the kept file without its listed hash · the lists fetched
// whatever `only` says · the start asking for the list without deaf mode · the list read without `no-store` · a malformed
// sha256 admitted · the list read by a host that cannot hash.

// (2026-09-26, phase B3: the list cases above moved from route A's list to the player's, and the 12 were run again against them,
// scripted, each restored from a copy and checked by sha256 — 12 of 12 red.) The two cases of the patched VLibras framework left
// with route A's catalogue entries; in their place, 2 of 2 red: a `libras:` file back in the catalogue (C1) · route A's list back
// in `DELIVERY_LISTS` (C2) — both 🔴 «the start asks for the Libras list alone».

// MUTATIONS CHECKED for ADR-0198 §5 (2026-09-14): Kokoro always fetched · every entry filtered out with the port · the start
// passing no `apenas` (🔴 kokoro-na-voz.browser «a game without the port»).

// MUTATIONS CHECKED for issue #168 (2026-09-13), 6 of 6 red: the check removed · an unverifiable body kept · SHA-1 for
// SHA-256 · the cache name back to v1 · one entry without its hash · a broken default digest. Two first SURVIVED (an
// unverifiable body, a broken default): the cases asserted a refusal and not its reason, nor the real hash reported.
