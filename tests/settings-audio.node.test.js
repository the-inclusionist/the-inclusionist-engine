// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-audio — lógica PURA (project NODE: sem document). ZOMBIES + Right-BICEP.
// Cobre: as listas de categorias (NAV_CATS/GEN_CATS), volume->percentual (volPercent/navMasterVolume),
// validação da bengala (parseCaneDiv/caneDivMessage), catálogo de motores TTS, filtro de vozes pt-BR e a lista
// de saídas de áudio (sinkOptionLabel/sinkSelectValue/sinksSupported). O render (DOM) fica no teste browser.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, ui/settings-audio).
import { describe, it, expect } from 'vitest';
import {
  NAV_CATS, GEN_CATS, volPercent, navMasterVolume,
  parseCaneDiv, caneDivMessage, TTS_ENGINE_OPTIONS, voiceEngineOptions, pickVoicesFor, voiceLabel,
  sinksSupported, sinkOptionLabel, sinkSelectValue,
} from '../app/js/ui/audio-choices.js';

describe('ui/settings-audio — categorias (dados)', () => {
  it('[Zero] NAV_CATS e GEN_CATS não se sobrepõem e cobrem sonar/guard/guide + music/ambient/interact/earcons', () => {
    expect(NAV_CATS).toEqual(['sonar', 'guard', 'guide']);
    // `other` SAIU (ADR-0151, errata): não controlava som nenhum.
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
 * 🔴 OS CINCO CASOS DE `catRowHTML`/`catsListHTML` MUDARAM DE PROJECTO (BREAKING, nota BV). Eles liam a linha
 * como TEXTO, e a lista de categorias passou a ser montada em NÓS (ADR-0129) — o que afirmavam só é observável
 * num documento. Estão inteiros em `tests/settings-audio.browser.test.js`, com duas afirmações A MAIS que a
 * cadeia não conseguia fazer: a linha que fica é o MESMO nó entre dois renders, e a que perde o nome é removida.
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
    expect(caneDivMessage(2)).toBe('Bengala: uma batida a cada meio bloco pisado.');
    expect(caneDivMessage(1)).toBe('Bengala: uma batida por bloco pisado.');
    expect(caneDivMessage(3)).toBe('Bengala: uma batida por bloco pisado.');
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
  // Era `pickPtVoices`, com o `/^pt/i` fixo — o jogo em inglês oferecia uma lista de vozes PORTUGUESAS para
  // ler texto em inglês. Agora recebe o idioma; a comparação é por PREFIXO, para que pt-BR possa cair numa
  // voz pt-PT quando é a única instalada, que é o caso comum num computador de escola.
  it('[Right] filtra pelo prefixo de idioma pedido, ignorando a região e a caixa', () => {
    const voices = [{ name: 'A', lang: 'en-US' }, { name: 'B', lang: 'pt-BR' }, { name: 'C', lang: 'PT-PT' }];
    expect(pickVoicesFor(voices, 'pt-BR').map((v) => v.name)).toEqual(['B', 'C']);
    expect(pickVoicesFor(voices, 'en').map((v) => v.name)).toEqual(['A']);
  });
  it('[Right] o idioma pedido MANDA — pedir espanhol não devolve as portuguesas', () => {
    const voices = [{ name: 'B', lang: 'pt-BR' }, { name: 'D', lang: 'es-ES' }];
    expect(pickVoicesFor(voices, 'es').map((v) => v.name)).toEqual(['D']);
  });
  it('[Boundary] sem nenhuma voz no idioma cai de volta na lista inteira', () => {
    const voices = [{ name: 'A', lang: 'en-US' }, { name: 'D', lang: 'es-ES' }];
    expect(pickVoicesFor(voices, 'pt-BR')).toEqual(voices);
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
    expect(sinkOptionLabel({ deviceId: 'x', label: 'Fone USB' }, 0)).toBe('Fone USB');
  });
  it('[Boundary] sem label (sem permissão ainda) cai no "Saída N" 1-based', () => {
    expect(sinkOptionLabel({ deviceId: 'x', label: '' }, 0)).toBe('Saída 1');
    expect(sinkOptionLabel({ deviceId: 'y', label: '' }, 2)).toBe('Saída 3');
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
