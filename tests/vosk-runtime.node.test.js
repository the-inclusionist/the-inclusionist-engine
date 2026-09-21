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
import { PESADOS, caminhoNaEntrega } from '../app/js/platform/pesados.js';

const BASE = 'https://escola.exemplo/jogo/';
const urlOf = (id) => PESADOS.find((p) => p.id === id).url;
/** A cache that holds everything the runtime asks for, unless a id is named as absent. */
const cacheCom = (semEstes = []) => async (url) => !semEstes.some((id) => urlOf(id) === url);

const apiFalsa = () => {
  const pedidos = [];
  const modelo = { KaldiRecognizer: function KaldiRecognizer() {} };
  return {
    pedidos,
    loadScript: async (u) => { pedidos.push(['script', u]); return { createModel: async (m, n) => { pedidos.push(['model', m, n]); return modelo; } }; },
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
    const [script, model] = api.pedidos;
    // 📌 A ENTREGA, e não o endereço de origem: `pesados/<host><path>` ao lado da página, que é o que o service worker responde
    // da cache conferida. Um endereço de terceiro aqui seria a criança a contactar um servidor para poder falar.
    expect(script[1]).toBe(BASE + caminhoNaEntrega(urlOf('commands:runtime')));
    expect(model[1]).toBe(BASE + caminhoNaEntrega(urlOf('commands:model:pt')));
    expect(String(script[1]).startsWith(BASE), 'o runtime veio de fora da origem do jogo').toBe(true);
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
      expect(PESADOS.find((p) => p.id === id), `${id} não está no catálogo`).toBeTruthy();
      expect(urlOf(id), `${id} sem endereço`).toBeTruthy();
    }
  });

  /*
   * 🔴 ESTE CASO MEDE O CARREGADOR DE VERDADE, com um DOCUMENTO de mentira em vez de um `loadScript` injetado — e a diferença
   * é o caso: a promessa de «uma vez só» mora no carregador padrão, e um duble no lugar dele mediria o duble. O bundle regista
   * um worker e compila um wasm; pô-lo na página de novo paga as duas coisas outra vez na máquina que menos pode.
   */
  it('🔴 [Right] o bundle entra na página UMA vez, mesmo pedido duas', async () => {
    const postos = [];
    const modelo = { KaldiRecognizer: function KaldiRecognizer() {} };
    const janela = { Vosk: { createModel: async () => modelo } };
    const docFalso = {
      defaultView: janela,
      createElement: () => { const el = {}; postos.push(el); return el; },
      head: { appendChild: (el) => { setTimeout(() => el.onload(), 0); } },
    };
    const deps = { base: BASE, language: 'pt-BR', hasFile: cacheCom(), doc: docFalso };
    const um = await loadVoskRuntime(deps);
    const dois = await loadVoskRuntime(deps);
    expect(um.ok && dois.ok, 'o carregador de verdade não abriu o modelo').toBe(true);
    expect(postos.length, 'o bundle foi posto na página duas vezes').toBe(1);
    expect(postos[0].src, 'o script foi posto sem endereço').toBe(BASE + caminhoNaEntrega(urlOf('commands:runtime')));
  });

  it('🎯 [Zero] um bundle que carrega e não define o global falha DIZENDO, em vez de devolver um modelo torto', async () => {
    const docFalso = {
      defaultView: {}, // carregou, e não há `Vosk`: a entrega tem o ficheiro errado
      createElement: () => ({}),
      head: { appendChild: (el) => { setTimeout(() => el.onload(), 0); } },
    };
    // ⚠️ OUTRA BASE de propósito: o memo do carregador é do MÓDULO e vive o tempo da página, então o caso acima já deixou
    // este endereço carregado. Reusá-lo aqui mediria o memo, não o bundle — e foi assim que este caso falhou primeiro.
    await expect(loadVoskRuntime({ base: 'https://outra.exemplo/jogo/', language: 'pt-BR', hasFile: cacheCom(), doc: docFalso }))
      .rejects.toThrow(/global/);
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-vosk-runtime.py`.
