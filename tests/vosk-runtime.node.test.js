// SPDX-License-Identifier: AGPL-3.0-or-later
// THE RECOGNISER OF COMMANDS, OPENED FROM THE DELIVERY (ADR-0189, ADR-0193; issue #184).
//
// The rule this file guards is the one `platform/vision` already pays for the camera: nothing is loaded that the install did
// not fetch and CHECK, every address is the game's own origin, and a file that is not there is NAMED instead of failing in a
// way a child would read as «speaking is broken».
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { loadVoskRuntime, commandModelId, VOICE_RUNTIME_FILES } from '../app/js/platform/vosk-runtime.js';
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
     * 🔴 O DUBLE TEM A FORMA DO FICHEIRO SERVIDO, medida no navegador em 2026-09-21 e não suposta: o bundle é um MÓDULO que
     * exporta `createModel(modelUrl, resolver, logLevel)` e pede os dois vizinhos pelo nome lógico — a primeira versão deste
     * duble tinha a forma da minha crença («um script clássico que define um global e acha os vizinhos sozinho»), sete
     * mutações ficaram vermelhas contra ela, e o que o Dev teria encontrado na rodada era um 👄 aceso sobre silêncio.
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
    // 📌 A ENTREGA, e não o endereço de origem: `heavy/<host><path>` ao lado da página, que é o que o service worker responde
    // da cache conferida. Um endereço de terceiro aqui seria a criança a contactar um servidor para poder falar.
    expect(bundle[1]).toBe(BASE + deliveryPath(urlOf('commands:runtime')));
    expect(model[1]).toBe(BASE + deliveryPath(urlOf('commands:model:pt')));
    expect(String(bundle[1]).startsWith(BASE), 'o runtime veio de fora da origem do jogo').toBe(true);
    // 🔴 E OS DOIS VIZINHOS QUE O BUNDLE PEDE, pelos endereços da entrega: o worker que ele abre e o wasm que esse worker
    // carrega. Sem isto ele resolve-os contra o próprio endereço e, num dia em que a pasta mude, abre um worker que não existe.
    expect(model[3], 'o worker não veio da entrega').toBe(BASE + deliveryPath(urlOf('commands:runtime:worker')));
    expect(model[4], 'o wasm não veio da entrega').toBe(BASE + deliveryPath(urlOf('commands:runtime:wasm')));
  });

  it('🎯 [Zero] um ficheiro que a entrega não carrega é RECUSADO pelo nome, em vez de servir o que estiver à mão', async () => {
    // Um worker alimentado com o wasm (ou o contrário) falha lá dentro de uma thread, longe de qualquer frase que a criança ouça.
    const api = apiFalsa();
    let resolver = null;
    api.loadBundle = async () => ({ createModel: async (m, resolve) => { resolver = resolve; return api.modelo; } });
    // ⚠️ BASE PRÓPRIA: o memo é do módulo e vive o tempo da página — com a base dos outros casos este carregador nunca correria.
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
   * 🔴 O BUNDLE É CARREGADO UMA VEZ SÓ, e a promessa é do RUNTIME e não de uma forma de carregar: ela envolve também o
   * carregador injetado, senão este caso mediria o duble. O bundle abre um worker e compila um wasm; pedi-lo de novo paga as
   * duas coisas outra vez na máquina que menos pode.
   */
  it('🔴 [Right] o bundle é carregado UMA vez, mesmo pedido duas', async () => {
    const api = apiFalsa();
    const deps = { base: 'https://uma.exemplo/jogo/', language: 'pt-BR', hasFile: cacheCom(), ...api };
    const um = await loadVoskRuntime(deps);
    const dois = await loadVoskRuntime(deps);
    expect(um.ok && dois.ok, 'o carregador não abriu o modelo').toBe(true);
    expect(api.pedidos.filter((p) => p[0] === 'bundle').length, 'o bundle foi carregado duas vezes').toBe(1);
  });

  it('🎯 [Zero] um bundle sem `createModel` falha DIZENDO, em vez de devolver um modelo torto', async () => {
    // ⚠️ OUTRA BASE de propósito: o memo é do MÓDULO e vive o tempo da página, então o caso acima já deixou o endereço dele
    // carregado. Reusá-lo aqui mediria o memo, não o bundle — e foi assim que este caso falhou primeiro.
    const vazio = { loadBundle: async () => ({}) }; // carregou, e não exporta nada: a entrega tem o ficheiro errado
    // 🔴 A FRASE DA ENGINE, e não a palavra `createModel` — a primeira versão deste caso pedia `/createModel/` e uma mutação
    // sobreviveu por isso: sem o guarda, o que rebenta é «api.createModel is not a function», que TAMBÉM contém a palavra. A
    // asserção media o acidente em vez da exigência, e quem lê `problems` ficaria com um erro de JavaScript no lugar do motivo.
    await expect(loadVoskRuntime({ base: 'https://outra.exemplo/jogo/', language: 'pt-BR', hasFile: cacheCom(), ...vazio }))
      .rejects.toThrow(/the delivery has the wrong file/);
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-vosk-runtime.py`.
