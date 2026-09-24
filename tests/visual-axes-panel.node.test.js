// SPDX-License-Identifier: AGPL-3.0-or-later
// THE VISUAL MENU WITH TWO CONTROLS (#104, ADR-0076) — the pure half.
//
// ⚠️ WHAT AUTHORISES THIS: the single control was justified while `p.viz` held ONE value — two separate controls would
// have overwritten each other in silence. That reason no longer exists: the state holds two axes, and the per-axis
// writers touch one without touching the other. The single control told a REAL exclusivity; keeping it would tell one
// that no longer exists.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import {
  axesHtml, axisRows, buttonChoice, THEME_LABEL, CORRECTION_LABEL,
} from '../app/js/ui/visual-axes-panel.js';
import { THEMES, CORRECTIONS, DEFAULT_VISUAL } from '../app/js/render/viz-axes.js';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

const t = (k) => pt[k] ?? k;

describe('ui/visual-axes-panel · dois eixos, dois rádios', () => {
  it('⚠️ [Right] os DOIS grupos saem, e cada valor de cada eixo tem a sua linha', () => {
    const html = axesHtml(DEFAULT_VISUAL, t);
    for (const v of THEMES) expect(html, `falta o tema «${v}»`).toContain(`data-eixo="tema" data-valor="${v}"`);
    for (const v of CORRECTIONS) expect(html, `falta a correção «${v}»`).toContain(`data-eixo="correcao" data-valor="${v}"`);
  });

  it('⚠️ [Right] o marcado de um eixo é o do ESTADO daquele eixo, e não o do outro', () => {
    // It is the assertion proving the two radio groups are two. With a single field, checking `hc7` would force unchecking
    // `deuter` — and that is what the child lost with nothing said.
    const html = axesHtml({ tema: 'hc7', correcao: 'deuter', simulacao: null }, t);
    expect(html).toContain('data-eixo="tema" data-valor="hc7"');
    expect(html).toContain('data-eixo="correcao" data-valor="deuter"');
    const marcados = [...html.matchAll(/aria-checked="true"[\s\S]{0,80}?data-valor="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(marcados), 'os dois eixos não estão marcados ao mesmo tempo').toEqual(new Set(['hc7', 'deuter']));
  });

  it('[Right] cada eixo marca EXACTAMENTE um', () => {
    for (const tema of THEMES) {
      const html = axisRows('tema', THEMES, THEME_LABEL, tema, t);
      expect((html.match(/aria-checked="true"/g) ?? []).length, tema).toBe(1);
    }
  });

  it('[Right] mantém a forma de LINHA VISÍVEL, e não uma caixa fechada', () => {
    // `settings-visual` records the mistake the Dev caught on the first attempt: inside a `<select>`, a control whose reason
    // to exist is to be FOUND by whoever sees poorly is «quase o mesmo que não ter movido».
    const html = axesHtml(DEFAULT_VISUAL, t);
    expect(html).not.toContain('<select');
    expect(html).toContain('class="ctrl-row"');
    expect(html).toContain('role="radio"');
  });
});

describe('ui/visual-axes-panel · os nomes dos padrões', () => {
  it('⚠️ [Interface] NENHUM rótulo de padrão diagnostica quem lê', () => {
    // The last box of ADR-0076's definition of done: «modo sem deficiência visual» was offered and REFUSED — it tells the
    // child what she is NOT, in the menu she opened to be able to play. A default is named for what it IS.
    for (const dic of [pt, en, es]) {
      for (const chave of [THEME_LABEL.padrao, CORRECTION_LABEL.tricro]) {
        const txt = dic[chave];
        expect(txt, `«${chave}» falta`).toBeTruthy();
        expect(txt, `«${txt}» diagnostica quem lê`).not.toMatch(/sem defici|no defici|sin defici|normal/i);
      }
    }
  });

  it('⚠️ [Interface] os dois padrões têm nome PRÓPRIO, e não o neutro partilhado', () => {
    // «Modo padrão» (`viz.normal`) was the neutral of when the two axes were one. With two controls, a «padrão» that does
    // not say default of WHAT is ambiguous on both — the ADR names them for that reason.
    expect(THEME_LABEL.padrao).not.toBe('viz.normal');
    expect(CORRECTION_LABEL.tricro).not.toBe('viz.normal');
    expect(pt[THEME_LABEL.padrao]).not.toBe(pt[CORRECTION_LABEL.tricro]);
  });

  it('[Interface] todo rótulo dos dois eixos existe nos TRÊS idiomas', () => {
    for (const [nome, dic] of Object.entries({ pt, en, es })) {
      for (const chave of [...Object.values(THEME_LABEL), ...Object.values(CORRECTION_LABEL)]) {
        expect(dic[chave], `«${chave}» falta em ${nome}`).toBeTruthy();
      }
    }
  });
});

describe('ui/visual-axes-panel · o que um clique quer dizer', () => {
  it('[Right] lê o eixo e o valor do botão', () => {
    expect(buttonChoice({ eixo: 'tema', valor: 'hc7' })).toEqual({ axis: 'tema', value: 'hc7' });
    expect(buttonChoice({ eixo: 'correcao', valor: 'deuter' })).toEqual({ axis: 'correcao', value: 'deuter' });
  });

  it('⚠️ [Zero] botão de outro assunto, eixo inventado ou valor de OUTRO eixo devolvem `null`', () => {
    // The panel has other buttons (role colours, reset), and a `data-valor` with no `data-eixo` belongs to one of them.
    // ⚠️ And the crossed one is what matters most: `{eixo:'tema', valor:'deuter'}` would write a correction into the theme
    // field — a state the type does not admit, arriving through a DOM attribute anyone can edit.
    expect(buttonChoice({})).toBeNull();
    expect(buttonChoice({ eixo: 'roxo', valor: 'hc7' })).toBeNull();
    expect(buttonChoice({ eixo: 'tema' })).toBeNull();
    expect(buttonChoice({ eixo: 'tema', valor: 'deuter' }), 'aceitou uma correção no eixo do tema').toBeNull();
    expect(buttonChoice({ eixo: 'correcao', valor: 'hc7' }), 'aceitou um tema no eixo da correção').toBeNull();
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · removing the second group from `axesHtml` -> TWO fail. It is the old state: one control only, which with two axes
//     would leave the correction with nowhere to be chosen.
//   · `const sel = valor === valores[0]` (always checks the default, ignoring the state) -> fails the per-axis checked case.
//     The child would see the menu saying she is at the default while the game shows something else — and the menu she
//     opened to find her way would lose her.
//   · removing the crossed validation from `buttonChoice` -> fails the Zero case. `{eixo:'tema', valor:'deuter'}` would
//     write a correction into the THEME field: a state the type does not admit, arriving through a DOM attribute anyone
//     can edit.
//   · pointing the default theme's label back at `viz.normal` -> fails the proper-names case. «Modo padrao» was the SHARED
//     neutral of when the two axes were one; with two controls, a «padrao» that does not say default of WHAT is ambiguous
//     on both.
//
// ⚠️ AND ONE MUTATION OF MINE CAME OUT NULL, recorded because the lesson holds: wrapping `atual` in a `String()` when it
// is already a string changes nothing, so the green said nothing about the gate. A mutation that cannot fail is not proof
// of coverage — it is just an edit. It was replaced by the one above, which really changes behaviour.
