// SPDX-License-Identifier: AGPL-3.0-or-later
// THE LANGUAGE BUTTON, LAST ON THE QUICK BAR (the Dev, 2026-09-16: «Adicione um último botão à barra de acessibilidade rápida e coloque três
// bandeiras que se intercalam cada vez que o botão é apertado: Brasil, Estados Unidos e México. Cada bandeira indica a localização para qual o
// app está configurado, influenciando o conteúdo da faixa de explicação, menus, TTS e ASR»).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { iconsThatAct, computeIconLabel } from '../app/js/ui/pause-icons.js';
import { quickBarMarkup } from '../app/js/ui/pause-markup.js';
import { PAUSE_ICONS } from '../app/js/core/pause-icon-catalogue.js';
import { getLocale } from '../app/js/core/i18n.js';
import { LOCALE_CYCLE, nextLocale, FLAG_SVG, flagOf, LANGUAGE_NAME } from '../app/js/ui/locale-flags.js';
import { bcp47 } from '../app/js/core/i18n.js';
import { PADRAO } from '../app/js/core/visual-state.js';

const snap = (over = {}) => ({ blindMode: false, ttsOn: false, librasOn: false, calmMode: 0, toggleMove: false, visual: PADRAO, privateOutput: true, ...over });

describe('the language button', () => {
  it('is the last button, and mounts in every game', () => {
    expect(PAUSE_ICONS.at(-1).k).toBe('idioma');
    expect(iconsThatAct({ tema: false, correcao: false, seguraTeclas: () => false }).map((ic) => ic.k)).toContain('idioma');
  });
  it('cycles Brazil → United States → Mexico → Brazil, and a locale outside the cycle starts it again', () => {
    expect(LOCALE_CYCLE).toEqual(['pt', 'en', 'es']);
    expect(['pt', 'en', 'es'].map(nextLocale)).toEqual(['en', 'es', 'pt']);
    expect(nextLocale('fr')).toBe('pt');
  });
  it('draws a flag, not an emoji — flag emoji are letters on Windows — and a different one per locale', () => {
    for (const l of LOCALE_CYCLE) expect(flagOf(l)).toMatch(/^<svg class="pi-flag"/);
    expect(new Set(Object.values(FLAG_SVG)).size).toBe(3);
    expect(FLAG_SVG.pt).toContain('#009c3b'); expect(FLAG_SVG.en).toContain('#3c3b6e'); expect(FLAG_SVG.es).toContain('#006847');
    expect(flagOf('fr')).toBe(FLAG_SVG.pt);
  });
  it('the bar itself draws the flag of the current locale, and no flag emoji', () => {
    const b = quickBarMarkup();
    const botao = b.slice(b.indexOf('data-pi="idioma"'));
    expect(botao.slice(0, botao.indexOf('</button>'))).toContain(flagOf(getLocale()));
    expect(b).not.toContain('🇧🇷');
  });
  it('its name says the language in itself, with its place', () => {
    expect(computeIconLabel('idioma', snap({ idioma: 'en' }))).toMatch(/English \(United States\)/);
    expect(computeIconLabel('idioma', snap({ idioma: 'es' }))).toMatch(/Español \(México\)/);
    expect(LANGUAGE_NAME.pt).toBe('Português (Brasil)');
  });
});

describe('the place each flag stands for reaches speech and recognition', () => {
  it('the tag carries the region: pt-BR, en-US, es-MX', () => {
    expect(['pt', 'en', 'es'].map((l) => bcp47(l))).toEqual(['pt-BR', 'en-US', 'es-MX']);
  });
});

// MUTATIONS CHECKED (2026-09-16):
//   · the cycle order changed (pt → es)          → «cycles Brazil → United States → Mexico»
//   · en and es without region again             → «pt-BR, en-US, es-MX»
//   · the emoji glyph instead of the drawn flag  → «draws a flag, not an emoji»
//   · the bar markup back to `ic.e`               → «the bar itself draws the flag» (survived the three above)
//   · the button out of PAUSE_ICONS               → «is the last button»
//   · a locale outside the cycle given as-is      → «draws a flag, not an emoji»
