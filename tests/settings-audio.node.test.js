// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-audio — PURE logic (NODE project: no document). ZOMBIES + Right-BICEP.
// Covers: the category lists (NAV_CATS/GEN_CATS), volume->percentage (volPercent/navMasterVolume), the cane
// validation (parseCaneDiv/caneDivMessage), the TTS engine catalogue, the voice filter by language (pickVoicesFor)
// and the list of audio outputs (sinkOptionLabel/sinkSelectValue/sinksSupported). The render (DOM) is in the browser test.
// See docs/5-Refactoring/plan-modularization-map.md (Stage 4, ui/settings-audio).
import { describe, it, expect } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import {
  NAV_CATS, GEN_CATS, volPercent, navMasterVolume,
  parseCaneDiv, caneDivMessage, TTS_ENGINE_OPTIONS, voiceEngineOptions, pickVoicesFor, voiceLabel,
  sinksSupported, sinkOptionLabel, sinkSelectValue,
} from '../app/js/ui/audio-choices.js';

describe('ui/settings-audio — categorias (dados)', () => {
  it('[Zero] NAV_CATS e GEN_CATS não se sobrepõem e cobrem sonar/guard/guide + music/ambient/interact/earcons', () => {
    expect(NAV_CATS).toEqual(['sonar', 'guard', 'guide']);
    // `other` is gone (ADR-0151, erratum): it controlled no sound at all.
    expect(GEN_CATS).toEqual(['music', 'ambient', 'interact', 'earcons']);
    expect(NAV_CATS.some((k) => GEN_CATS.includes(k))).toBe(false);
  });
});

describe('ui/settings-audio — volPercent', () => {
  it('[Right] converte fração 0..1 em inteiro 0..100 arredondado', () => {
    expect(volPercent(0.8)).toBe(80);
    expect(volPercent(0.333)).toBe(33);
  });
  it('[Boundary] extremos 0 e 1', () => {
    expect(volPercent(0)).toBe(0);
    expect(volPercent(1)).toBe(100);
  });
});

/*
 * 🔴 THE `catRowHTML`/`catsListHTML` CASES LIVE IN THE BROWSER PROJECT (BREAKING, note BV). The category list is built
 * as NODES (ADR-0129), so what they assert is only observable in a document. They are whole in
 * `tests/settings-audio.browser.test.js`, with two assertions a string could not make: the row that stays is the SAME
 * node between two renders, and the one that loses its name is removed.
 */

describe('ui/settings-audio — navMasterVolume', () => {
  it('[Right] é o volume da categoria MAIS ALTA entre as de navegação, em %', () => {
    const state = { sonar: { on: true, vol: 0.4 }, guard: { on: true, vol: 0.9 }, guide: { on: false, vol: 0.2 } };
    expect(navMasterVolume(state)).toBe(90);
  });
  it('[Boundary] todas em 0 -> 0', () => {
    const state = { sonar: { on: false, vol: 0 }, guard: { on: false, vol: 0 }, guide: { on: false, vol: 0 } };
    expect(navMasterVolume(state)).toBe(0);
  });
});

describe('ui/settings-audio — parseCaneDiv / caneDivMessage', () => {
  it('[Right] "2" vira 2 (meio bloco); "1" vira 1 (bloco inteiro)', () => {
    expect(parseCaneDiv('2')).toBe(2);
    expect(parseCaneDiv('1')).toBe(1);
  });
  it('[Error] entrada inválida/vazia cai no padrão 1', () => {
    expect(parseCaneDiv('')).toBe(1);
    expect(parseCaneDiv('abacate')).toBe(1);
  });
  it('[Right] a mensagem muda só no valor 2 (meio bloco); qualquer outro fala "por bloco"', () => {
    expect(caneDivMessage(translate, 2)).toBe('Bengala: uma batida a cada meio bloco pisado.');
    expect(caneDivMessage(translate, 1)).toBe('Bengala: uma batida por bloco pisado.');
    expect(caneDivMessage(translate, 3)).toBe('Bengala: uma batida por bloco pisado.');
  });
});

describe('ui/settings-audio — TTS_ENGINE_OPTIONS', () => {
  it('[Interface] 4 engines, webspeech first (the default), unique values (ADR-0207)', () => {
    expect(TTS_ENGINE_OPTIONS).toHaveLength(4);
    expect(TTS_ENGINE_OPTIONS[0][0]).toBe('webspeech');
    const values = TTS_ENGINE_OPTIONS.map(([v]) => v);
    expect(new Set(values).size).toBe(values.length);
  });

  // ⚠️ THE CATALOGUE IS THE ENGINE'S; WHAT CAN BE OFFERED IS THE ASSEMBLY'S (ADR-0094). The neural engine comes through the GAME's
  // Kokoro port (ADR-0198), and a panel offering it without the port leaves whoever picks it waiting for a download that never starts.
  it('[Right] without a neural engine Kokoro is not OFFERED, and the rest of the catalogue stays intact', () => {
    const sem = voiceEngineOptions(false).map(([v]) => v);
    expect(sem).not.toContain('kokoro');
    expect(sem[0]).toBe('webspeech');
    expect(sem).toEqual(['webspeech', 'kitten', 'espeak']);
  });

  it('[Right] com motor neural o catálogo sai inteiro — a porta ADICIONA, não substitui', () => {
    expect(voiceEngineOptions(true)).toEqual(TTS_ENGINE_OPTIONS);
  });

  it('[Zero] a filtragem não muda o catálogo original', () => {
    voiceEngineOptions(false);
    expect(TTS_ENGINE_OPTIONS).toHaveLength(4);
  });
});

describe('ui/settings-audio — pickVoicesFor', () => {
  // The filter receives the language (a fixed `/^pt/i` would offer an English game a list of PORTUGUESE voices to read
  // English text). The comparison is by PREFIX, so pt-BR can fall back on a pt-PT voice when it is the only one
  // installed, which is the common case on a school computer.
  it('[Right] filtra pelo prefixo de idioma pedido, ignorando a região e a caixa', () => {
    const voices = [{ name: 'A', lang: 'en-US' }, { name: 'B', lang: 'pt-BR' }, { name: 'C', lang: 'PT-PT' }];
    expect(pickVoicesFor(voices, 'pt-BR').map((v) => v.name)).toEqual(['B', 'C']);
    expect(pickVoicesFor(voices, 'en').map((v) => v.name)).toEqual(['A']);
  });
  it('[Right] o idioma pedido MANDA — pedir espanhol não devolve as portuguesas', () => {
    const voices = [{ name: 'B', lang: 'pt-BR' }, { name: 'D', lang: 'es-ES' }];
    expect(pickVoicesFor(voices, 'es').map((v) => v.name)).toEqual(['D']);
  });
  // 🔴 ADR-0185: the list offers ONLY the voices of the interface's language. It fell back to the whole list, so a device with
  // no Portuguese voice offered a Portuguese page English and Spanish voices to read Portuguese text (ADR-0243 §3: a wrong
  // voice is worse than none).
  it('🔴 [Boundary] with no voice of the language it offers NONE — never the voices of another language', () => {
    const voices = [{ name: 'A', lang: 'en-US' }, { name: 'D', lang: 'es-ES' }];
    expect(pickVoicesFor(voices, 'pt-BR')).toEqual([]);
  });
  it('[Zero] lista vazia -> lista vazia (não a lista inteira "de volta")', () => {
    expect(pickVoicesFor([], 'pt-BR')).toEqual([]);
  });
});

describe('ui/settings-audio — voiceLabel', () => {
  it('[Right] "<nome> (<lang>)"', () => {
    expect(voiceLabel({ name: 'Luciana', lang: 'pt-BR' })).toBe('Luciana (pt-BR)');
  });
});

describe('ui/settings-audio — sinksSupported', () => {
  it('[Right] só é suportado com enumerateDevices E algum construtor AudioContext', () => {
    expect(sinksSupported(true, true)).toBe(true);
    expect(sinksSupported(false, true)).toBe(false);
    expect(sinksSupported(true, false)).toBe(false);
    expect(sinksSupported(false, false)).toBe(false);
  });
});

describe('ui/settings-audio — sinkOptionLabel', () => {
  it('[Right] usa o label do dispositivo quando existe', () => {
    expect(sinkOptionLabel(translate, { deviceId: 'x', label: 'Fone USB' }, 0)).toBe('Fone USB');
  });
  it('[Boundary] sem label (sem permissão ainda) cai no "Saída N" 1-based', () => {
    expect(sinkOptionLabel(translate, { deviceId: 'x', label: '' }, 0)).toBe('Saída 1');
    expect(sinkOptionLabel(translate, { deviceId: 'y', label: '' }, 2)).toBe('Saída 3');
  });
});

describe('ui/settings-audio — sinkSelectValue', () => {
  it('[Right] devolve o audioSink do jogador', () => {
    expect(sinkSelectValue({ audioSink: 'dev-1' })).toBe('dev-1');
  });
  it('[Zero/Error] sem jogador ou sem sink -> string vazia (saída padrão)', () => {
    expect(sinkSelectValue(undefined)).toBe('');
    expect(sinkSelectValue({ audioSink: null })).toBe('');
    expect(sinkSelectValue({})).toBe('');
  });
});
