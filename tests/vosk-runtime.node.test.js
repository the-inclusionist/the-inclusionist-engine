// SPDX-License-Identifier: AGPL-3.0-or-later
// THE RECOGNISER OF COMMANDS, OPENED FROM THE DELIVERY (ADR-0189, ADR-0193; issue #184).
//
// The rule this file guards is the one `platform/vision` already pays for the camera: nothing is loaded that the install did
// not fetch and CHECK, every address is the game's own origin, and a file that is not there is NAMED instead of failing in a
// way a child would read as «speaking is broken».
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { loadVoskRuntime, commandModelId, createBundleLoader, VOICE_RUNTIME_FILES } from '../app/js/platform/vosk-runtime.js';
import { HEAVY_FILES, deliveryPath } from '../app/js/platform/heavy.js';

const BASE = 'https://escola.exemplo/jogo/';
const urlOf = (id) => HEAVY_FILES.find((p) => p.id === id).url;
/** A cache that holds everything the runtime asks for, unless a id is named as absent. */
const cacheCom = (semEstes = []) => async (url) => !semEstes.some((id) => urlOf(id) === url);

const apiFalsa = () => {
  const pedidos = [];
  const modelo = { KaldiRecognizer: function KaldiRecognizer() {} };
  return {
    pedidos,
    /*
     * 🔴 THE DOUBLE HAS THE SHAPE OF THE SERVED FILE, measured in the browser on 2026-09-21 and not assumed: the bundle is a
     * MODULE that exports `createModel(modelUrl, resolver, logLevel)` and asks for its two neighbours by logical name — a
     * double shaped by a belief («um script clássico que define um global e acha os vizinhos sozinho») had seven mutations
     * go red against it, and what the Dev would have found in the round was a 👄 lit over silence.
     */
    loadBundle: async (u) => {
      pedidos.push(['bundle', u]);
      return { createModel: async (m, resolve, n) => { pedidos.push(['model', m, n, resolve('npm/vosk/vosk.worker.js'), resolve('npm/vosk/vosk.wasm')]); return modelo; } };
    },
    modelo,
  };
};

describe('o modelo é escolhido pela língua da criança', () => {
  it('🔴 [Right] cada língua do projeto tem o seu, e a região não é a língua', () => {
    expect(commandModelId('pt-BR')).toBe('commands:model:pt');
    expect(commandModelId('es-MX')).toBe('commands:model:es');
    expect(commandModelId('en')).toBe('commands:model:en');
  });

  it('🎯 [Zero] uma língua que o projeto não fala não inventa modelo — diz que falta', async () => {
    expect(commandModelId('de-DE')).toBeNull();
    const r = await loadVoskRuntime({ base: BASE, language: 'de-DE', hasFile: cacheCom(), ...apiFalsa() });
    expect(r.ok, 'abriu um reconhecedor para uma língua sem modelo').toBe(false);
    expect(r.missing).toEqual(['language']);
  });
});

describe('nada é carregado sem ter sido conferido', () => {
  it('🔴 [Right] com tudo na cache, abre o modelo da língua — e só pelos endereços da ENTREGA', async () => {
    const api = apiFalsa();
    const r = await loadVoskRuntime({ base: BASE, language: 'pt-BR', hasFile: cacheCom(), ...api });
    expect(r.ok).toBe(true);
    expect(r.model).toBe(api.modelo);
    const [bundle, model] = api.pedidos;
    // 📌 THE DELIVERY, not the origin address: `heavy/<host><path>` beside the page, which is what the service worker
    // answers from the checked cache. A third-party address here would be the child contacting a server in order to speak.
    expect(bundle[1]).toBe(BASE + deliveryPath(urlOf('commands:runtime')));
    expect(model[1]).toBe(BASE + deliveryPath(urlOf('commands:model:pt')));
    expect(String(bundle[1]).startsWith(BASE), 'o runtime veio de fora da origem do jogo').toBe(true);
    // 🔴 AND THE TWO NEIGHBOURS THE BUNDLE ASKS FOR, by the delivery's addresses: the worker it opens and the wasm that
    // worker loads. Without this it resolves them against its own address and, the day the folder changes, opens a worker
    // that does not exist.
    expect(model[3], 'o worker não veio da entrega').toBe(BASE + deliveryPath(urlOf('commands:runtime:worker')));
    expect(model[4], 'o wasm não veio da entrega').toBe(BASE + deliveryPath(urlOf('commands:runtime:wasm')));
  });

  it('🎯 [Zero] um ficheiro que a entrega não carrega é RECUSADO pelo nome, em vez de servir o que estiver à mão', async () => {
    // A worker fed with the wasm (or the other way round) fails inside a thread, far from any sentence the child hears.
    const api = apiFalsa();
    let resolver = null;
    api.loadBundle = async () => ({ createModel: async (m, resolve) => { resolver = resolve; return api.modelo; } });
    await loadVoskRuntime({ base: 'https://terceira.exemplo/jogo/', language: 'pt-BR', hasFile: cacheCom(), ...api });
    expect(() => resolver('npm/vosk/outra-coisa.js')).toThrow(/outra-coisa/);
  });

  it('🔴 [Right] um ficheiro que não está na cache conferida NÃO é carregado, e é nomeado', async () => {
    const api = apiFalsa();
    const r = await loadVoskRuntime({ base: BASE, language: 'pt-BR', hasFile: cacheCom(['commands:runtime:wasm']), ...api });
    expect(r.ok).toBe(false);
    expect(r.missing, 'o que falta tem de ser dito pelo nome, senão ninguém sabe o que fazer').toEqual(['commands:runtime:wasm']);
    expect(api.pedidos, 'carregou alguma coisa mesmo com ficheiro por conferir').toEqual([]);
  });

  it('🔴 [Right] e o MODELO conta como ficheiro em falta, como os três do runtime', async () => {
    const api = apiFalsa();
    const r = await loadVoskRuntime({ base: BASE, language: 'pt-BR', hasFile: cacheCom(['commands:model:pt']), ...api });
    expect(r.missing).toEqual(['commands:model:pt']);
    expect(api.pedidos).toEqual([]);
  });

  it('📌 [Boundary] os três ficheiros do runtime são pedidos, e estão no catálogo', () => {
    expect(VOICE_RUNTIME_FILES.length).toBe(3);
    for (const id of VOICE_RUNTIME_FILES) {
      expect(HEAVY_FILES.find((p) => p.id === id), `${id} não está no catálogo`).toBeTruthy();
      expect(urlOf(id), `${id} sem endereço`).toBeTruthy();
    }
  });

  /*
   * 🔴 THE BUNDLE IS LOADED ONLY ONCE, and the promise belongs to the LOADER the root builds once (ADR-0232 D4) — not to a
   * module-level memo every root on the page would share. The bundle opens a worker and compiles a wasm; asking for it again
   * pays both again on the machine that can least afford it.
   */
  it('🔴 [Right] o bundle é carregado UMA vez, mesmo pedido duas — pelo carregador que a raiz constrói', async () => {
    const api = apiFalsa();
    const deps = { base: 'https://uma.exemplo/jogo/', language: 'pt-BR', hasFile: cacheCom(), loadBundle: createBundleLoader(api.loadBundle) };
    const um = await loadVoskRuntime(deps);
    const dois = await loadVoskRuntime(deps);
    expect(um.ok && dois.ok, 'o carregador não abriu o modelo').toBe(true);
    expect(api.pedidos.filter((p) => p[0] === 'bundle').length, 'o bundle foi carregado duas vezes').toBe(1);
  });

  it('📌 [Right] once PER ADDRESS: another address is its own load, and the same one answers the same promise', async () => {
    const pedidos = [];
    const load = createBundleLoader(async (u) => { pedidos.push(u); return { createModel: async () => ({}) }; });
    const a = load('https://a.example/x.js');
    expect(load('https://a.example/x.js'), 'a second ask made a second promise').toBe(a);
    await load('https://b.example/x.js');
    expect(pedidos).toEqual(['https://a.example/x.js', 'https://b.example/x.js']);
  });

  it('⚠️ [Error] a load that FAILED is forgotten — the next ask tries again instead of answering the old failure', async () => {
    let vezes = 0;
    const load = createBundleLoader(async () => { vezes += 1; if (vezes === 1) throw new Error('bad minute'); return { createModel: async () => ({}) }; });
    await expect(load('https://a.example/x.js')).rejects.toThrow(/bad minute/);
    await expect(load('https://a.example/x.js')).resolves.toBeTruthy();
    expect(vezes).toBe(2);
  });

  it('📌 [Right] two loaders share nothing — two roots on one page each load their own (ADR-0142)', async () => {
    let vezes = 0;
    const carregar = async () => { vezes += 1; return { createModel: async () => ({}) }; };
    await createBundleLoader(carregar)('https://a.example/x.js');
    await createBundleLoader(carregar)('https://a.example/x.js');
    expect(vezes).toBe(2);
  });

  it('🎯 [Zero] um bundle sem `createModel` falha DIZENDO, em vez de devolver um modelo torto', async () => {
    const vazio = { loadBundle: async () => ({}) }; // it loaded, and exports nothing: the delivery has the wrong file
    // 🔴 THE ENGINE'S SENTENCE, and not the word `createModel` — asking for `/createModel/` let a mutation survive: without
    // the guard, what blows up is «api.createModel is not a function», which ALSO contains the word. The assertion would
    // measure the accident instead of the requirement, and whoever reads `problems` would get a JavaScript error instead of
    // the reason.
    await expect(loadVoskRuntime({ base: 'https://outra.exemplo/jogo/', language: 'pt-BR', hasFile: cacheCom(), ...vazio }))
      .rejects.toThrow(/the delivery has the wrong file/);
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-vosk-runtime.py`.
