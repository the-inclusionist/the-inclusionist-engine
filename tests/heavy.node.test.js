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
import { createHash } from 'node:crypto';
import { downloadHeavy, bytesLeftToDownload, HEAVY_FILES, CACHE_HEAVY, sha256Hex, deliveryPath, heavyAtBoot } from '../app/js/platform/heavy.js';

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
const urlDe = (pedido) => HEAVY_FILES.find((p) => p.url && deliveryPath(p.url) === pedido)?.url ?? pedido;
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
    expect(r.filter((x) => x.outcome === 'falhou').length, 'a falha não foi reportada').toBe(1);
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
    // a device actually fetches is `heavyAtBoot`, which asks for one language and for what the game declared.
    expect(Math.round(semNada / 1024 / 1024), 'the total changed — check the catalogue').toBe(1363);
    const f = cacheFalsa();
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscarOk(), digest: digestPelaUrl });
    expect(bytesLeftToDownload(r), 'depois de tudo descer não falta nada').toBe(0);
  });

  it('⚠️ [Zero] sem Cache Storage nada rebenta — reporta e devolve', async () => {
    const r = await downloadHeavy({ cacheStorage: undefined, fetch: buscarOk() });
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
    const r = await downloadHeavy({ cacheStorage: undefined, fetch: buscarOk() });
    expect(r.length, '`every` on an empty list is true: nothing was reported').toBe(HEAVY_FILES.length);
    expect(r.every((x) => x.outcome === 'falhou' && /Cache Storage/.test(x.error))).toBe(true);
  });

  it('🔴 [Zero] without fetch the same — and the cache is never opened', async () => {
    vi.stubGlobal('fetch', undefined);
    try {
      const f = cacheFalsa();
      const r = await downloadHeavy({ cacheStorage: f.cacheStorage, only: [alvo.id] });
      expect(r).toEqual([{ id: alvo.id, outcome: 'falhou', error: 'sem Cache Storage ou sem fetch' }]);
      expect(f.cache._nome, 'a cache was opened on a host that cannot fetch into it').toBeUndefined();
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

  it('🔴 [Right] with no injected digest, the REAL one runs — a body that is not the file is refused', async () => {
    const f = cacheFalsa();
    const alvo = HEAVY_FILES.find((p) => p.url);
    const r = await downloadHeavy({ cacheStorage: f.cacheStorage, fetch: buscarOk(), only: [alvo.id] });
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

  it('🔴 [Right] the default digest IS SHA-256 — the FIPS 180-2 vector for «abc»', async () => {
    // The refusal case above passes with any wrong algorithm (SHA-1 refuses a wrong body too); this pins the real one.
    expect(await sha256Hex(new TextEncoder().encode('abc').buffer))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
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

describe('what a game\'s start fetches (ADR-0216 §3)', () => {
  const doIdioma = (lingua) => HEAVY_FILES.map((p) => p.id).filter((id) => id.startsWith(`reading:${lingua}:`));

  it('🔴 [Zero] without the neural voice declared, neither its model NOR the runtime that speaks it — and nothing else is left out', () => {
    // ADR-0216: the runtime moved from each game's dependencies into the catalogue, so it travels by the SAME answer as the
    // model. A game of shapes that downloaded 45.5 MiB of phonemizer would be the cost this filter exists to refuse.
    const ids = heavyAtBoot({ kokoro: false });
    expect(ids.filter((id) => id.startsWith('voz:')), 'a game that cannot speak Kokoro downloads its model or its runtime').toEqual([]);
    expect(ids).toEqual(HEAVY_FILES.map((p) => p.id).filter((id) => !id.startsWith('voz:') && !id.startsWith('reading:') && !id.startsWith('commands:')));
    expect(ids.length).toBeGreaterThan(0);
  });

  it('🔴 [Right] with the neural voice declared, the whole voice — the model, the tokenizer and every voice', () => {
    expect(heavyAtBoot({ kokoro: true }))
      .toEqual(HEAVY_FILES.map((p) => p.id).filter((id) => !id.startsWith('reading:') && !id.startsWith('commands:')));
  });

  /**
   * 🔴 THE READING MODEL IS ASKED FOR BY LANGUAGE, not by a yes (ADR-0216 §3; ADR-0201 erratum). 📏 The three are 850 MiB —
   * pt 378, en 162, es 310 — so «the game listens» cannot mean «download all of them»: the child reads in one language, and
   * it is the one the interface booted in.
   */
  it('🔴 [Right] the start asks for the model of the child\'s language, and of no other', () => {
    const ids = heavyAtBoot({ kokoro: false, reading: 'pt-BR' });
    expect(ids.filter((id) => id.startsWith('reading:')), 'the child\'s language model is not asked for').toEqual(doIdioma('pt'));
    expect(doIdioma('en').length, 'the fixture has no English model to leave out: the case would pass empty').toBeGreaterThan(0);
    for (const outra of ['en', 'es']) {
      expect(ids.some((id) => id.startsWith(`reading:${outra}:`)), `a child reading in Portuguese downloaded the ${outra} model`).toBe(false);
    }
  });

  it('🔴 [Zero] a game that does not listen downloads no reading model, in any language', () => {
    for (const portas of [{ kokoro: false }, { kokoro: true }, { kokoro: false, reading: null }]) {
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
   * the controller, like the camera and the gaze, and a cartridge does not get to close one. What decides is the DELIVERY, which
   * says which languages it serves — 31–39 MiB each, so not all three.
   */
  it('🔴 [Right] the command model of the child\'s language, with the runtime that loads it, and no other language', () => {
    const ids = heavyAtBoot({ kokoro: false, commands: 'pt-BR' });
    expect(ids).toContain('commands:model:pt');
    for (const outra of ['en', 'es']) expect(ids, `a child commanding in Portuguese downloaded the ${outra} model`).not.toContain(`commands:model:${outra}`);
    const runtime = HEAVY_FILES.map((p) => p.id).filter((id) => id.startsWith('commands:runtime'));
    expect(runtime.length, 'the catalogue has no command runtime: the case would pass empty').toBeGreaterThan(0);
    for (const id of runtime) expect(ids, `${id} left out — 32 MiB of model and nothing to load it with`).toContain(id);
  });

  it('🔴 [Zero] a delivery that serves no spoken language downloads neither a model nor the runtime', () => {
    // The runtime alone is 3.1 MiB that could never hear a word: it is only useful beside a model.
    for (const portas of [{ kokoro: false }, { kokoro: true }, { kokoro: false, commands: null }, { kokoro: false, reading: 'pt' }]) {
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
  it('📌 [Boundary] the region is not the language: `es-MX` asks for the Spanish model', () => {
    expect(heavyAtBoot({ kokoro: false, reading: 'es-MX' }).filter((id) => id.startsWith('reading:'))).toEqual(doIdioma('es'));
  });
});

// MUTATIONS CHECKED for ADR-0198 §5 (2026-09-14): Kokoro always fetched · every entry filtered out with the port · the start
// passing no `apenas` (🔴 kokoro-na-voz.browser «a game without the port»).

// MUTATIONS CHECKED for issue #168 (2026-09-13), 6 of 6 red: the check removed · an unverifiable body kept · SHA-1 for
// SHA-256 · the cache name back to v1 · one entry without its hash · a broken default digest. Two first SURVIVED (an
// unverifiable body, a broken default): the cases asserted a refusal and not its reason, nor the real hash reported.
