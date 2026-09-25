// SPDX-License-Identifier: AGPL-3.0-or-later
// WHICH RECOGNISER HEARS THE CHILD, AND WHAT A COMMAND IS (ADR-0200 and erratum, ADR-0194; issue #190): the browser only on the
// device and only with the language installed; the child's voice never goes to a server; the heard words become commands once.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { recognitionRoute, createOnDeviceRecognition, createCommandReader, spokenText } from '../app/js/platform/speech-recognition.js';

/** A fake `SpeechRecognition`: `local` says whether its objects know `processLocally`; `estado` what `available` answers. */
function apiFalsa({ local = true, status: estado = 'available', semAvailable = false } = {}) {
  const pedidos = [];
  class SR { constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; } }
  if (local) SR.prototype.processLocally = false;
  if (!semAvailable) SR.available = async (o) => { pedidos.push(o); return estado; };
  return { SR, pedidos };
}

describe('the route: the browser only on the device (ADR-0200 erratum)', () => {
  it('🔴 [Right] recognition installed on the device → the browser, asked with processLocally', async () => {
    const { SR, pedidos } = apiFalsa();
    expect(await recognitionRoute('pt-BR', SR)).toEqual({ route: 'webspeech-local', status: 'available' });
    expect(pedidos).toEqual([{ langs: ['pt-BR'], processLocally: true }]);
  });

  it('🎯 [Zero] a browser that cannot recognise on the device is never the route, even if it says «available»', async () => {
    const { SR } = apiFalsa({ local: false });
    expect(await recognitionRoute('pt-BR', SR)).toEqual({ route: 'recuo', status: 'sem-processamento-local' });
    expect(() => createOnDeviceRecognition(SR, 'pt-BR'), 'a server recogniser was created').toThrow(/leave the device/);
  });

  it('⚠️ [Boundary] a language still to download, no API, or no `available` → the engine\'s recogniser', async () => {
    expect(await recognitionRoute('es', apiFalsa({ status: 'downloadable' }).SR)).toEqual({ route: 'recuo', status: 'downloadable' });
    expect(await recognitionRoute('es', null)).toEqual({ route: 'recuo', status: 'sem-api' });
    expect((await recognitionRoute('es', apiFalsa({ semAvailable: true }).SR)).route).toBe('recuo');
  });

  it('🔴 [Right] the recognition object is set to the device, continuous, with partial hypotheses', () => {
    const rec = createOnDeviceRecognition(apiFalsa().SR, 'es-MX');
    expect([rec.lang, rec.processLocally, rec.continuous, rec.interimResults]).toEqual(['es-MX', true, true, true]);
  });
});

describe('what a command is in what was heard (ADR-0194)', () => {
  const leitor = () => { const l = createCommandReader(['acima', 'abaixo', 'confirmar', 'voltar', 'menu']); l.items(['Voltar ao jogo', 'Configurações de inclusão', 'Voltar']); return l; };

  it('🔴 [Right] direction words and whole item names, the longest name first', () => {
    expect(leitor().read(0, 'Acima, configurações de inclusão e abaixo', true)).toEqual([
      { kind: 'palavra', word: 'acima' }, { kind: 'item', name: 'configurações de inclusão' }, { kind: 'palavra', word: 'abaixo' },
    ]);
  });

  it('🔴 [Right] a growing partial hypothesis fires each command once, and the final one adds nothing new', () => {
    const l = leitor();
    expect(l.read(3, 'acima', false)).toEqual([{ kind: 'palavra', word: 'acima' }]);
    expect(l.read(3, 'acima abaixo', false)).toEqual([{ kind: 'palavra', word: 'abaixo' }]);
    expect(l.read(3, 'acima abaixo', true)).toEqual([]);
    expect(l.read(4, 'acima', true), 'the next utterance starts afresh').toEqual([{ kind: 'palavra', word: 'acima' }]);
  });

  it('⚠️ [Boundary] a partial «voltar» waits while «voltar ao jogo» may follow; the final one decides', () => {
    const l = leitor();
    expect(l.read(0, 'voltar', false)).toEqual([]);
    expect(l.read(0, 'voltar ao jogo', false)).toEqual([{ kind: 'item', name: 'voltar ao jogo' }]);
    const m = leitor();
    expect(m.read(1, 'voltar', true)).toEqual([{ kind: 'item', name: 'voltar' }]);
  });

  it('🔴 [Right] accents do not decide a match, and the command answers with the name as the language writes it', () => {
    // The grammar asks the model for «configurações» (it would drop the unaccented word); a recogniser that writes it back
    // without accents still heard the item — and the name returned is the one on screen, not the recogniser's spelling.
    expect(leitor().read(0, 'configuracoes de inclusao', true)).toEqual([{ kind: 'item', name: 'configurações de inclusão' }]);
    const l = createCommandReader(['ação']);
    expect(l.read(0, 'acao', true)).toEqual([{ kind: 'palavra', word: 'ação' }]);
  });

  it('[Zero] other words command nothing; punctuation and case do not matter', () => {
    expect(leitor().read(0, 'o gato subiu no telhado', true)).toEqual([]);
    expect(spokenText('Ajuda — Como jogar!')).toBe('ajuda como jogar');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   SR1 the route ignores processLocally support           🔴 never the route
//   SR2 «downloadable» taken as available                   🔴 still to download
//   SR3 processLocally not set on the object                🔴 set to the device
//   SR4 shortest phrase first                               🔴 voltar waits (a partial «voltar» fires before «voltar ao jogo»)
//   SR5 a partial re-fires what it fired                    🔴 fires each once
//   SR6 a continued name fires on the partial               🔴 voltar waits
//   SR7 the comparison keeps accents (compareKey = spokenText) 🔴 accents do not decide a match
//   SR8 an item answers with its comparison key, not its spoken form   🔴 accents do not decide a match
