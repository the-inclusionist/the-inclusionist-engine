// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de platform/tts que só o NAVEGADOR prova: que a narração fala no IDIOMA DO JOGO.
//
// POR QUE NÃO NO project node. Trocar de idioma passa por `setLocale`, que reaplica o DOM (`applyDom`),
// escreve em `<html lang>` e dispara um CustomEvent — três coisas que não existem no node. O teste node já
// afere `spoke[0].lang`, mas contra o literal 'pt-BR': ele passaria idêntico com o valor CRAVADO que existia
// antes desta correção, porque o idioma padrão é o português. Um caso que não consegue falhar pelo motivo que
// declara é o que estes arquivos existem para não ter.
//
// O DEFEITO QUE ISTO PRENDE. `u.lang` era 'pt-BR' fixo. Com o jogo em inglês, isso pede ao navegador uma voz
// PORTUGUESA para um texto que não é português — e o resultado não é sotaque, é ininteligível: fonética de
// uma língua aplicada à ortografia de outra. Para quem depende da narração para jogar, equivale a não ter
// narração nenhuma.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTts } from '../app/js/platform/tts.js';
import { setLocale, getLocale, bcp47 } from '../app/js/core/i18n.js';

let spoke;
const ORIGINAL = { utter: globalThis.SpeechSynthesisUtterance, synth: window.speechSynthesis };

beforeEach(() => {
  spoke = [];
  // O SpeechSynthesis real do Chromium não fala em CI e não expõe a utterance; substituímos os dois pelo
  // mínimo que `speakWebSpeech` toca, para poder LER o que foi pedido ao navegador.
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    // one browser voice per language: a language with no voice at all has narration locked (ADR-0185 §4, ADR-0207)
    value: { cancel: () => {}, speak: (u) => spoke.push(u), getVoices: () => [{ name: 'A', lang: 'pt-BR' }, { name: 'B', lang: 'en-US' }, { name: 'C', lang: 'es-ES' }] },
  });
  globalThis.SpeechSynthesisUtterance = class {
    constructor(t) { this.text = t; this.lang = ''; this.rate = 0; this.volume = 0; this.voice = null; }
  };
});

afterEach(async () => {
  globalThis.SpeechSynthesisUtterance = ORIGINAL.utter;
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: ORIGINAL.synth });
  await setLocale('pt'); // o idioma é estado de MÓDULO: sem isto, o próximo arquivo herda o último locale
});

function tts() {
  return createTts({
    srSay: () => {}, srAlert: () => {},
    ensureAC: () => null, catNode: () => null, audioOut: () => null,
    getSoundOn: () => true, getVolume: () => 0.6,
    getAudioCat: () => ({ tts: { on: true, vol: 1 } }),
  });
}

describe('platform/tts — a narração fala o idioma do jogo', () => {
  it('[Right] o idioma da fala SEGUE o locale: pt-BR · en-US · es-MX', async () => {
    for (const [loc, esperado] of [['pt', 'pt-BR'], ['en', 'en-US'], ['es', 'es-MX']]) {
      await setLocale(loc);
      spoke.length = 0;
      tts().narrate('teste');
      expect(spoke.length, `nada foi falado em ${loc}`).toBe(1);
      expect(spoke[0].lang, `idioma da fala em ${loc}`).toBe(esperado);
    }
  });

  it('[Invariant] a etiqueta pedida ao navegador é SEMPRE a de core/i18n, nunca uma cópia', () => {
    // O que impede a regressão: se alguém voltar a cravar 'pt-BR', este caso fica vermelho em en e es —
    // e a asserção não repete a etiqueta, ela a busca na fonte única.
    tts().narrate('x');
    expect(spoke[0].lang).toBe(bcp47(getLocale()));
  });

  it('[Boundary] cada idioma leva a região da sua bandeira: pt-BR, en-US, es-MX', async () => {
    // English and Spanish went without a region, for the browser to pick the variant. The language button names a place
    // (the Dev, 2026-09-16: «Cada bandeira indica a localização para qual o app está configurado»), so the tag says it too.
    expect(bcp47('pt')).toBe('pt-BR');
    expect(bcp47('en')).toBe('en-US');
    expect(bcp47('es')).toBe('es-MX');
  });

  it('[Interface] `<html lang>` e a fala usam a MESMA etiqueta — uma regra, dois consumidores', async () => {
    await setLocale('es');
    tts().narrate('x');
    expect(document.documentElement.lang).toBe('es-MX');
    expect(spoke[0].lang).toBe(document.documentElement.lang);
  });
});
