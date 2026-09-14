// SPDX-License-Identifier: AGPL-3.0-or-later
// AS COISAS PESADAS DESCEM NO PRIMEIRO CARREGAMENTO — e o que não tem de onde vir DIZ-SE (ADR-0110/0116/0119).
//
// ========================= O QUE ESTE FICHEIRO GUARDA =========================
// 📏 O ADR-0119 mediu que, das quatro coisas pesadas que a engine promete, só UMA era entregue. O buscador
// existe para mudar isso — e o defeito que ele pode introduzir é pior do que o que conserta: um buscador que
// SALTA em silêncio o que não tem URL faz um subsistema por fazer parecer tratado, que é exactamente a forma
// do falso relatório que este repositório já apanhou três vezes.
//
// 🎯 Por isso a asserção central não é «baixou»: é que uma entrada SEM FONTE devolve `sem-fonte` com a razão.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { baixarPesados, pesoPorBaixar, PESADOS, CACHE_PESADOS, sha256Hex, caminhoNaEntrega, pesadosDoArranque } from '../app/js/platform/pesados.js';

/** Uma Cache Storage de mentira, que CONTA o que lhe pedem. */
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
const urlDe = (pedido) => PESADOS.find((p) => p.url && caminhoNaEntrega(p.url) === pedido)?.url ?? pedido;
const buscarOk = () => async (u) => resposta(urlDe(u));
/** #168: the pinned hash of the entry whose URL the body spells; anything else hashes to garbage. */
const digestPelaUrl = async (buf) => {
  const texto = new TextDecoder().decode(buf);
  return PESADOS.find((p) => p.url === texto)?.sha256 ?? '0'.repeat(64);
};

describe('o buscador das coisas pesadas', () => {
  it('🎯 [Zero] o que NÃO tem fonte devolve `sem-fonte` COM a razão — nunca é saltado em silêncio', async () => {
    const f = cacheFalsa();
    const r = await baixarPesados({ cacheStorage: f.cacheStorage, buscar: buscarOk(), digest: digestPelaUrl });
    const sem = r.filter((x) => x.estado === 'sem-fonte');
    expect(sem.map((x) => x.id).sort(), 'só a arte continua sem acervo — a visão ganhou fonte no ADR-0124/0132, e o ADR-0133 fechou a lista de licenças sem escolher de onde a arte vem').toEqual(['arte:acervo']);
    for (const s of sem) {
      expect(s.erro, `${s.id} não diz PORQUE não tem fonte`).toBeTruthy();
      expect(s.erro.length, `${s.id} tem uma razão curta demais para servir a alguém`).toBeGreaterThan(40);
    }
  });

  it('📏 [Boundary] toda voz COM fonte tem peso MEDIDO — uma voz nova sem medição sub-reportaria em silêncio', () => {
    // ⚠️ A small, silent hole: a new voice with no measurement would leave `pesoPorBaixar` under-reporting, and the notice telling
    // a school how much will come down would lie by omission. Nobody would see an error.
    const vozes = PESADOS.filter((p) => p.id.startsWith('voz:') && p.url);
    expect(vozes.length, 'no voice in the catalogue — the case would measure nothing').toBeGreaterThan(0);
    expect(vozes.filter((p) => !(p.bytes > 0)).map((p) => p.id), 'a voice with no measured size — measure it').toEqual([]);
  });

  it('📌 [Boundary] o que já está na cache não é buscado outra vez — isto corre em TODO arranque', async () => {
    const primeiro = PESADOS.find((p) => p.url).url;
    const f = cacheFalsa([primeiro]);
    const r = await baixarPesados({ cacheStorage: f.cacheStorage, buscar: buscarOk(), digest: digestPelaUrl });
    expect(r.find((x) => x.estado === 'ja-tinha'), 'não reconheceu o que já tinha').toBeTruthy();
    expect(f.postos.includes(primeiro), 'voltou a gravar o que já estava lá').toBe(false);
  });

  it('🔴 [Inverse] uma falha de rede é REPORTADA e a lista CONTINUA — não derruba o arranque', async () => {
    const f = cacheFalsa();
    let n = 0;
    const buscar = async (u) => { n += 1; if (n === 1) throw new Error('rede caiu'); return resposta(urlDe(u)); };
    const r = await baixarPesados({ cacheStorage: f.cacheStorage, buscar, digest: digestPelaUrl });
    expect(r.filter((x) => x.estado === 'falhou').length, 'a falha não foi reportada').toBe(1);
    expect(r.filter((x) => x.estado === 'baixado').length, 'a lista parou na primeira falha').toBe(PESADOS.filter((p) => p.url).length - 1);
  });

  it('[Interface] `apenas` limita a lista — um consumidor pode querer só as vozes', async () => {
    const f = cacheFalsa();
    const id = PESADOS.find((p) => p.url).id;
    const r = await baixarPesados({ cacheStorage: f.cacheStorage, buscar: buscarOk(), digest: digestPelaUrl, apenas: [id] });
    expect(r.map((x) => x.id)).toEqual([id]);
  });

  it('📏 o peso por baixar é o das que TÊM fonte e ainda não desceram', async () => {
    const semNada = pesoPorBaixar([]);
    // The vision runtime and models, WebGazer, and Kokoro (ADR-0198: the 325 532 232-byte model, its tokenizer and 34 voice tables
    // of 522 240 bytes); ADR-0207 took out the earlier neural voices and their phonemizer (−258.9 MiB). What has no source adds nothing.
    expect(Math.round(semNada / 1024 / 1024), 'the total changed — check the catalogue').toBe(360);
    const f = cacheFalsa();
    const r = await baixarPesados({ cacheStorage: f.cacheStorage, buscar: buscarOk(), digest: digestPelaUrl });
    expect(pesoPorBaixar(r), 'depois de tudo descer não falta nada').toBe(0);
  });

  it('⚠️ [Zero] sem Cache Storage nada rebenta — reporta e devolve', async () => {
    const r = await baixarPesados({ cacheStorage: undefined, buscar: buscarOk() });
    expect(r.every((x) => x.estado === 'falhou' || x.estado === 'sem-fonte')).toBe(true);
  });

  it('📌 o nome da cache é versionado', () => {
    expect(CACHE_PESADOS).toMatch(/-v\d+$/);
  });
});

// ================================ MUTAÇÕES CONFERIDAS ================================
// 1. `if (!p.url) continue;` (saltar em silêncio em vez de devolver `sem-fonte`) → o [Zero] reprova. É a
//    mutação inteira: um subsistema por fazer passaria a parecer tratado, que é o defeito que o ADR-0119 mediu.
// 3. removing `cache.match` (always fetch) → the [Boundary] fails: everything again at every start.
// 4. deixar a excepção subir em vez de a apanhar → o [Inverse] reprova, e o defeito real é maior do que o
//    caso: uma falha de rede derrubaria o arranque de um jogo por causa de um recurso que ele nem usa hoje.

describe('what comes from outside is checked before it is kept (issue #168; STRIDE client pass)', () => {
  // 📏 Measured on 2026-09-13: `baixarPesados` put the response into Cache Storage as it came — JavaScript and WebAssembly
  // from jsDelivr and Brown, models from Hugging Face and Google — and a pinned URL is not pinned content. What is cached
  // runs in the child's page and is served offline from then on.
  it('📏 [Boundary] every entry with a URL carries a measured sha256', () => {
    const sem = PESADOS.filter((p) => p.url && !/^[0-9a-f]{64}$/.test(p.sha256 ?? ''));
    expect(sem.map((p) => p.id), 'an entry with no pinned hash would be kept unchecked').toEqual([]);
  });

  it('🔴 [Right] an altered body is NOT kept — reported, and the list goes on', async () => {
    const f = cacheFalsa();
    const [alvo, outro] = PESADOS.filter((p) => p.url);
    const buscar = async (u) => (urlDe(u) === alvo.url ? resposta(u, new TextEncoder().encode('altered').buffer) : resposta(urlDe(u)));
    const r = await baixarPesados({ cacheStorage: f.cacheStorage, buscar, digest: digestPelaUrl, apenas: [alvo.id, outro.id] });
    expect(f.postos.includes(alvo.url), 'the altered body entered the cache').toBe(false);
    const dele = r.find((x) => x.id === alvo.id);
    expect(dele.estado).toBe('falhou');
    expect(dele.erro, 'the report does not say it was the integrity check').toMatch(/sha256/);
    expect(r.find((x) => x.id === outro.id).estado, 'one refusal stopped the list').toBe('baixado');
  });

  it('🔴 [Right] with no injected digest, the REAL one runs — a body that is not the file is refused', async () => {
    const f = cacheFalsa();
    const alvo = PESADOS.find((p) => p.url);
    const r = await baixarPesados({ cacheStorage: f.cacheStorage, buscar: buscarOk(), apenas: [alvo.id] });
    expect(f.postos, 'the default path kept a body without hashing it').toEqual([]);
    // the hash it reports is the body's real SHA-256 — a broken default that hashed to anything would still refuse
    const real = createHash('sha256').update(alvo.url).digest('hex');
    expect(r[0].erro, 'the reported hash is not the body\'s real SHA-256').toContain(`got ${real}`);
  });

  it('🎯 [Zero] a host that cannot hash keeps NOTHING — unverifiable is not verified', async () => {
    const f = cacheFalsa();
    const alvo = PESADOS.find((p) => p.url);
    const r = await baixarPesados({ cacheStorage: f.cacheStorage, buscar: buscarOk(), digest: null, apenas: [alvo.id] });
    expect(f.postos).toEqual([]);
    expect(r[0].estado).toBe('falhou');
    expect(r[0].erro, 'the report does not say the host cannot hash').toMatch(/cannot compute a sha256/);
  });

  it('🔴 [Right] the default digest IS SHA-256 — the FIPS 180-2 vector for «abc»', async () => {
    // The refusal case above passes with any wrong algorithm (SHA-1 refuses a wrong body too); this pins the real one.
    expect(await sha256Hex(new TextEncoder().encode('abc').buffer))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('📌 [Right] what was cached before the check is not trusted: the cache has a new name', () => {
    expect(CACHE_PESADOS).toBe('incl-pesados-v2');
  });
});

describe('the heavy files come from the delivery\'s own origin (ADR-0177, issue #173)', () => {
  it('🔴 [Right] the download asks the page\'s origin for each file, and keeps it under the upstream address', async () => {
    const f = cacheFalsa();
    const pedidos = [];
    const buscar = async (u) => { pedidos.push(u); return resposta(urlDe(u.slice('https://escola.example/jogo/'.length))); };
    const alvo = PESADOS.find((p) => p.url);
    await baixarPesados({ cacheStorage: f.cacheStorage, buscar, digest: digestPelaUrl, apenas: [alvo.id], base: 'https://escola.example/jogo/' });
    expect(pedidos, 'the download asked a third party').toEqual([`https://escola.example/jogo/${caminhoNaEntrega(alvo.url)}`]);
    expect(f.postos, 'the file is not kept under the address the libraries ask for').toEqual([alvo.url]);
  });

  it('🎯 [Zero] no file is asked of a host outside the page\'s origin', async () => {
    const f = cacheFalsa();
    const hosts = new Set();
    const buscar = async (u) => { hosts.add(new URL(u).host); return resposta(urlDe(new URL(u).pathname.slice(1))); };
    await baixarPesados({ cacheStorage: f.cacheStorage, buscar, digest: digestPelaUrl, base: 'https://escola.example/' });
    expect([...hosts]).toEqual(['escola.example']);
  });

  it('📌 [Right] a delivery path keeps the upstream host and path, so two files never share one', () => {
    const caminhos = PESADOS.filter((p) => p.url).map((p) => caminhoNaEntrega(p.url));
    expect(new Set(caminhos).size).toBe(caminhos.length);
    for (const c of caminhos) expect(c).toMatch(/^pesados\/[\w.-]+\//);
  });
});

describe('what a game\'s start fetches (ADR-0198 §5)', () => {
  it('🔴 [Zero] without a Kokoro port, no Kokoro file — and nothing else is left out', () => {
    const ids = pesadosDoArranque({ kokoro: false });
    expect(ids.filter((id) => id.startsWith('voz:kokoro:')), 'a game that cannot speak Kokoro downloads its model').toEqual([]);
    expect(ids).toEqual(PESADOS.map((p) => p.id).filter((id) => !id.startsWith('voz:kokoro:')));
    expect(ids.length).toBeGreaterThan(0);
  });

  it('🔴 [Right] with the port, the whole catalogue — the model, the tokenizer and every voice', () => {
    expect(pesadosDoArranque({ kokoro: true })).toEqual(PESADOS.map((p) => p.id));
  });
});

// MUTATIONS CHECKED for ADR-0198 §5 (2026-09-14): Kokoro always fetched · every entry filtered out with the port · the start
// passing no `apenas` (🔴 kokoro-na-voz.browser «a game without the port»).

// MUTATIONS CHECKED for issue #168 (2026-09-13), 6 of 6 red: the check removed · an unverifiable body kept · SHA-1 for
// SHA-256 · the cache name back to v1 · one entry without its hash · a broken default digest. Two first SURVIVED (an
// unverifiable body, a broken default): the cases asserted a refusal and not its reason, nor the real hash reported.
