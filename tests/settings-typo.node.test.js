// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-typo — PURE logic (node project, no document). ZOMBIES + Right-BICEP.
// Covers: validation/migration of the persisted key, key→CSS mapping (data-fonte/--font-custom) and the view-model of
// the panel's rows (selection/disabled/note). render() itself (it touches the DOM) is in settings-typo.browser.test.js.
// See docs/5-Refactoring/plan-modularization-map.md.
import { describe, it, expect } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import { createTranslator as translatorOfThisFile } from '../app/js/core/i18n.js'; // the font catalogue holds KEYS (item 14)
const { t } = translatorOfThisFile(); // pt: `core/i18n` holds no state (ADR-0232 D3)
import { resolveFontKey, persistFontKey } from '../app/js/ui/settings-typo.js';
// 📌 The PURE half lives in `ui/typo-choices` (note BJ); the cases here were all about what a CHOICE is, none about a node.
import {
  isSelectableFont, fontCssTarget, typoGroups, fontRow, typoRowSpec, typoControlId,
} from '../app/js/ui/typo-choices.js';
import { FONT_BY_KEY, FONT_GROUPS, fontRole, faceScale, BASE_EM_PX } from '../app/js/ui/fonts.js';

// A fake of platform/storage.ts: an in-memory Map, the same shape (get/set) as the real module.
function fakeStore(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    map: m,
    get: (k, fallback = null) => (m.has(k) ? m.get(k) : fallback),
    set: (k, v) => { m.set(k, String(v)); return true; },
  };
}

describe('isSelectableFont', () => {
  it('[Right] verdadeiro para uma fonte do catálogo sem .off', () => {
    expect(isSelectableFont('atkinson')).toBe(true);
    expect(isSelectableFont('lexend')).toBe(true);
  });
  it('⚠️ [Boundary] falso para caligráfica e para chave que saiu do roster', () => {
    // ⚠️ A test that survives the removal of its own subject no longer measures it: asserting
    // `isSelectableFont('kindergarten') === false` kept passing after `kindergarten` left the roster (issue #87, item 3),
    // through the UNKNOWN KEY path, which is already the next case.
    //
    // What it measures is the rule that exists: a CALLIGRAPHIC face is not selectable, because the menu does not offer
    // it and ADR-0012's amendment says it cannot be the interface's face.
    expect(isSelectableFont('pinyon'), 'uma caligráfica virou selecionável').toBe(false);
    expect(isSelectableFont('ufmag'), 'uma caligráfica virou selecionável').toBe(false);
    // And the counterweight: Playwrite BR is in the same GROUP and is its general face (ADR-0176) — still selectable.
    expect(isSelectableFont('pwbr')).toBe(true);
  });
  it('[Zero/Error] falso para chave inexistente', () => {
    expect(isSelectableFont('')).toBe(false);
    expect(isSelectableFont('nao-existe')).toBe(false);
  });
});

describe('resolveFontKey — boot: persistida válida > migração legado > default', () => {
  it('[Right] usa a chave nova quando válida e selecionável', () => {
    const store = fakeStore({ incl_font_k: 'lexend' });
    expect(resolveFontKey(store)).toBe('lexend');
  });
  it('⚠️ [Boundary] uma CALIGRÁFICA guardada volta ao padrão — senão a criança fica presa nela', () => {
    // Before ADR-0012's amendment the menu offered the calligraphic faces, so there are children with `pinyon` stored.
    // The saved value is their choice and not ours to undo without reason — but the reason exists: a calligraphic face
    // cannot be the INTERFACE's face, and the menu no longer offers it. Letting it stand would give a whole interface in
    // cursive to someone who no longer has a way out of it through the menu.
    expect(resolveFontKey(fakeStore({ incl_font_k: 'pinyon' }))).toBe('atkinson');
    // And a key that left the roster falls in the same place, instead of being left with no face at all.
    expect(resolveFontKey(fakeStore({ incl_font_k: 'greatvibes' }))).toBe('atkinson');
  });
  it('[Boundary] ignora a chave nova quando desconhecida, cai no default', () => {
    const store = fakeStore({ incl_font_k: 'fonte-fantasma' });
    expect(resolveFontKey(store)).toBe('atkinson');
  });
  it('[Edge-case] migra a chave legada incl_fonte="alfabetizacao" → andika', () => {
    const store = fakeStore({ incl_fonte: 'alfabetizacao' });
    expect(resolveFontKey(store)).toBe('andika');
  });
  it('[Edge-case] migra a chave legada incl_fonte="dislexia" → lexend', () => {
    const store = fakeStore({ incl_fonte: 'dislexia' });
    expect(resolveFontKey(store)).toBe('lexend');
  });
  it('[Zero] sem nenhuma chave persistida, usa atkinson (padrão do jogo)', () => {
    expect(resolveFontKey(fakeStore())).toBe('atkinson');
  });
  it('[Right] a chave nova tem prioridade sobre a legada quando ambas presentes', () => {
    const store = fakeStore({ incl_font_k: 'lexend', incl_fonte: 'dislexia' });
    expect(resolveFontKey(store)).toBe('lexend');
  });
});

describe('persistFontKey', () => {
  it('[Interface] grava sob a chave incl_font_k (== KEYS.fontKey do platform/storage.ts)', () => {
    const store = fakeStore();
    persistFontKey(store, 'andika');
    expect(store.map.get('incl_font_k')).toBe('andika');
  });
});

describe('fontCssTarget', () => {
  it('[Right] atkinson → data-fonte="padrao", sem --font-custom', () => {
    expect(fontCssTarget('atkinson', FONT_BY_KEY.atkinson)).toEqual({ font: 'padrao', customFamily: null, cursive: false });
  });
  it('[Right] andika → data-fonte="alfabetizacao"', () => {
    expect(fontCssTarget('andika', FONT_BY_KEY.andika)).toEqual({ font: 'alfabetizacao', customFamily: null, cursive: false });
  });
  it('[Right] lexend → data-fonte="dislexia" (mantém o espaçamento BDA)', () => {
    expect(fontCssTarget('lexend', FONT_BY_KEY.lexend)).toEqual({ font: 'dislexia', customFamily: null, cursive: false });
  });
  it('[Edge-case] fonte sans genérica → custom sem fallback extra', () => {
    expect(fontCssTarget('inter', FONT_BY_KEY.inter)).toEqual({ font: 'custom', customFamily: "'Inter'", cursive: false });
  });
  it('[Edge-case] fonte serifada → custom com fallback ,Georgia,serif', () => {
    expect(fontCssTarget('literata', FONT_BY_KEY.literata)).toEqual({ font: 'custom', customFamily: "'Literata',Georgia,serif", cursive: false });
  });
  it('[Edge-case] fonte manuscrita → custom com fallback ,cursive', () => {
    expect(fontCssTarget('pwbr', FONT_BY_KEY.pwbr)).toEqual({ font: 'custom', customFamily: "'Playwrite BR',cursive", cursive: true });
  });
  it('🔴 [Right] the ronde\'s STACK quotes each family, so it can reach Cookie (ADR-0154)', () => {
    // Quoted as ONE string it would be a single family named «Ronde Script, …, Cookie», which no browser has: the child
    // would get the generic `cursive` and never the packaged fallback. The browser half measures the glyphs.
    expect(fontCssTarget('ronde', FONT_BY_KEY.ronde).customFamily)
      .toBe("'Ronde Script','OPTIFrench-Script','Merveille','Cookie',cursive");
  });
});

// ===================================================================================================
// THE FACE'S ROLE, AND THE MINIMUM SIZE OF A CALLIGRAPHIC ONE (ADR-0012 amended, issue #87)
// ===================================================================================================
describe('as caligráficas: papel declarado e tamanho mínimo', () => {
  const TODAS = FONT_GROUPS.flatMap((g) => g.items);
  const CALIGRAFICAS = TODAS.filter((it) => fontRole(it) === 'caligrafica');

  it('[Zero] há caligráficas no catálogo — senão os casos abaixo não medem nada', () => {
    expect(CALIGRAFICAS.length).toBeGreaterThan(0);
    // ⚠️ The Playwrite hands are calligraphic (ADR-0108 §2, #87 item 3) — so they stay OUT of the menu, which is the
    // division of item 1 of this issue: they are the hand one learns to write, for the buttons INSIDE the activities,
    // not an interface option.
    // 📌 The list is written out in full on purpose — a face gaining `papel:'caligrafica'` without anyone noticing leaves
    // the menu, and that is a product decision, not a label.
    //
    // 🔴 They enter by a RULE (ADR-0150): some are the fallback by LANGUAGE (`pwes`, `pwpt`, `pwgbj`: a country with no
    // hand of its own gets the coloniser's), some were asked for by name (`pwcu`, `pwpe`) and some are the second hand of
    // a country that teaches two (`pwesdeco`, `pwgbs`, as with `pwustrad`/`pwusmod`).
    // ⚠️ AND THEY STAY OUT OF THE FONT MENU, which is what this case measures. What ADR-0149 §4 opened is a NARROW door
    // elsewhere: position (e) of the quick bar's cycle, where the child picks HER country's hand. That does not put them
    // back in this list — and if someone does, this case fails.
    // 📌 `pwbr` is not on this list: it is the GENERAL face of the handwriting group (ADR-0176, the Dev), in the menu and
    // scaled up to the floor.
    expect(CALIGRAFICAS.map((it) => it.k).sort()).toEqual([
      'fondamento', 'pinyon',
      'pwar', 'pwca', 'pwcl', 'pwco', 'pwcu', 'pwes', 'pwesdeco', 'pwgbj', 'pwgbs',
      'pwmx', 'pwpe', 'pwpt', 'pwusmod', 'pwustrad', 'ufmag',
    ]);
  });

  it('⚠️ [Right] toda caligráfica declara `minPx`, com os números do Dev', () => {
    // ⚠️ Below the minimum the face stops being DIFFICULT and becomes ILLEGIBLE, and the two are different: the
    // difficulty is the exercise — the child is learning to read cursive —, the illegibility is the child giving up.
    // That is why item 2 of #87 says «tem de ser gate, não recomendação».
    for (const it of CALIGRAFICAS) {
      expect(it.minPx, `${it.k} é caligráfica e não declara tamanho mínimo`).toBeTypeOf('number');
      expect(it.minPx, `${it.k}: mínimo abaixo de 20px`).toBeGreaterThanOrEqual(20);
    }
    expect(FONT_BY_KEY.pinyon.minPx, 'a Pinyon é a mais fina das quatro e pede 24').toBe(24);
    expect(FONT_BY_KEY.ufmag.minPx).toBe(20);
  });

  it('⚠️ [Interface] uma GERAL que declara `minPx` é desenhada nele — a escala da face leva a base até lá (ADR-0176 §4)', () => {
    // The catalogue's floor replaced the old mark («only a calligraphic face declares a minimum»): seven sans and serif faces
    // of the menu ask 20 px, and so does Playwrite BR. They stay offered, drawn at their floor, never under it.
    const gerais = TODAS.filter((it) => fontRole(it) === 'geral' && it.minPx !== undefined);
    expect(gerais.length, 'no general face with a floor — the case measures nothing').toBeGreaterThan(0);
    for (const it of gerais) expect(BASE_EM_PX * faceScale(it), `${it.k} is drawn under its floor`).toBeGreaterThanOrEqual(it.minPx);
    expect(faceScale(FONT_BY_KEY.atkinson), 'a face with no floor above the base is drawn larger').toBe(1);
  });

  it('[Boundary] a Playwrite BR está no grupo `hand` e é GERAL — o corte é por papel, não por grupo', () => {
    const hand = FONT_GROUPS.find((g) => g.g === 'font.group.hand');
    expect(hand.items.map((it) => it.k)).toContain('pwbr');
    expect(fontRole(FONT_BY_KEY.pwbr)).toBe('geral');
  });
});

describe('typoGroups — view-model das linhas', () => {
  it('[Right] marca como selected apenas a linha da chave ativa', () => {
    const groups = typoGroups(translate, 'lexend');
    const flat = groups.flatMap((g) => g.rows);
    const selected = flat.filter((r) => r.selected);
    expect(selected).toHaveLength(1);
    expect(selected[0].key).toBe('lexend');
  });
  it('⚠️ [Boundary] o MECANISMO `.off` continua vivo, mesmo sem nenhuma face a usá-lo hoje', () => {
    // ⚠️ The `.off` mechanism stays with no face using it today: the ronde used it until its stack ended in the packaged
    // Cookie (ADR-0154), and a face that cannot ship with a fallback would need it again.
    //
    // So the case measures the FUNCTION with a fake face, instead of depending on the catalogue still having a
    // disabled one. A test that depends on the roster's composition fails whenever the roster changes.
    const falsa = { k: 'x', fam: 'Fonte de Mentira', fb: 'sans', d: 'font.desc.pinyon', off: 'font.off.pending' };
    const linha = fontRow(translate, falsa, 'atkinson');
    expect(linha.disabled).toBe(true);
    expect(linha.note, 'a nota de uma face desligada tem de dizer o MOTIVO').not.toBe('');
    expect(linha.note).toContain('—'); // descrição — motivo, as duas metades
    // both halves are TRANSLATED with the `t` the row is handed (ADR-0232 D3), not keys
    expect(linha.note).toBe(`${translate('font.desc.pinyon')} — ${translate('font.off.pending')}`);
    expect(linha.note, 'the row carries a raw key').not.toMatch(/font\.(desc|off)\./);
  });
  it('[Right] fonte sem descrição e sem .off tem note vazia', () => {
    // Inter is a LIBRARY face (ADR-0255): offered where its game declared the family, which the detector says.
    const row = typoGroups(translate, 'atkinson', (f) => f === 'Inter').flatMap((g) => g.rows).find((r) => r.key === 'inter');
    expect(row.disabled).toBe(false);
    expect(row.note).toBe('');
  });
  it('🔴 [Right] a LIBRARY face whose family nobody declared is disabled; an engine face never is (ADR-0255)', () => {
    // The row that would otherwise be offered and then drawn in the system font: the page has no `@font-face` for Inter.
    const rows = typoGroups(translate, 'atkinson').flatMap((g) => g.rows);
    expect(rows.find((r) => r.key === 'inter').disabled, 'a library face is offered with nothing that draws it').toBe(true);
    expect(rows.find((r) => r.key === 'lexend').disabled, 'an engine face was locked').toBe(false);
    expect(isSelectableFont('inter'), 'a library face is selectable with no family declared').toBe(false);
    expect(isSelectableFont('inter', (f) => f === 'Inter')).toBe(true);
  });
  it('[Right] preserva os 3 grupos do catálogo, TRADUZIDOS (a chave nunca chega à tela)', () => {
    const groups = typoGroups(translate, 'atkinson');
    // Against `t()` and not against the Portuguese: the catalogue holds KEYS (item 14), and pinning the three words here
    // would bring back into the test the text that left the code. What this case guards is that the three groups still
    // exist, in order, ALREADY RESOLVED.
    expect(groups.map((g) => g.g)).toEqual(['font.group.sans', 'font.group.serif', 'font.group.hand'].map(t));
    for (const g of groups) expect(g.g, 'chave crua na tela').not.toMatch(/^font\./);
  });
});

// ===================================================================================================
// THE MENU IS A CHOICE, NOT A SWITCH (ADR-0012, amendment of 27/08)
// ===================================================================================================
// ⚠️ ADR-0012's amendment is literal:
//
//     «THE MENU IS A CHOICE, NOT A TOGGLE: the selected font is shown with a yellow background, like a
//      pressed button. One font is active; the others are alternatives, not switches.»
//
// A switch per font (`class="mode-btn switch"`, `aria-pressed`, a «Ligado»/«Desligado» label) would announce eight
// independent states to whoever listens, to choose ONE font. A case asserting that shape would freeze the defect.
//
// ⚠️ AND THE STATE GOES IN TWO FORMS, NEITHER OF THEM COLOUR: `aria-checked` for whoever listens, a mark for whoever
// sees. The yellow background of `.mode-btn.is-on` stays, because it is what the amendment asks; what it cannot be is the
// ONLY signal.
describe('o menu de fontes é uma escolha exclusiva, não dezassete interruptores', () => {
  // 📌 The markup half of this block lives in `settings-typo.browser.test.js`, where there is a document (the list is
  // built as NODES with the kit); the CATALOGUE half — who is on the list and who is not — stays here, where it has
  // always belonged.
  const chaves = (fontKey) => typoGroups(translate, fontKey).flatMap((g) => g.rows.map((r) => r.key));

  it('[Interface] a linha é uma ESCOLHA, e diz isso na forma antes de virar nó nenhum', () => {
    const spec = typoRowSpec(fontRow(translate, FONT_BY_KEY.andika, 'atkinson'));
    expect(spec.shape, 'aria-pressed é vocabulário de interruptor; isto é um rádio').toBe('radio');
    expect(spec.id).toBe(typoControlId('andika'));
    expect(spec.label).toBe('Andika');
  });

  it('[Interface] a nota entra na DICA e também no nome acessível', () => {
    // The hint goes to the footer through `fillExplain`; the accessible name stays on the button. Whoever cannot see the
    // row hears whom that face serves without hunting for the footer — the two halves say the same thing on two channels.
    const spec = typoRowSpec(fontRow(translate, FONT_BY_KEY.ronde, 'atkinson'));
    expect(spec.hint, 'a ronde traz a mensagem do que instalar').toBeTruthy();
    expect(spec.ariaLabel).toContain(spec.hint);
  });

  it('🔴 [Right] the ronde row is ENABLED where its game declared Cookie, and its note still names the three faces to install (ADR-0154, ADR-0255)', () => {
    // The notice is not an `off` reason any more: it speaks on an enabled row, because the child who picks the ronde on a
    // device without the three sees Cookie, and the notice is the only thing that says it is not the ronde. Cookie is a
    // library family since ADR-0255, so the row is enabled where the game declared it.
    const row = fontRow(translate, FONT_BY_KEY.ronde, 'atkinson', (f) => f === 'Cookie');
    expect(row.disabled, 'the ronde is disabled although its game declared Cookie').toBe(false);
    expect(fontRow(translate, FONT_BY_KEY.ronde, 'atkinson').disabled, 'the ronde is offered with no face to draw it').toBe(true);
    expect(row.note).toBe(`${translate('font.desc.ronde')} — ${translate('font.notice.ronde')}`);
    for (const face of ['Ronde Script', 'OPTIFrench-Script', 'Merveille']) expect(row.note).toContain(face);
  });

  it('[Right] o id sai da CHAVE do catálogo, que é única por construção', () => {
    const ids = typoGroups(translate, 'atkinson').flatMap((g) => g.rows.map((r) => typoRowSpec(r).id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('⚠️ [Boundary] nenhuma CALIGRÁFICA aparece no menu — a emenda do ADR-0012, aferida', () => {
    // Calligraphic faces exist for the child to LEARN to read cursive, and that is subject matter: it lives inside the
    // activities, on buttons of their own. Offering them here gives her the subject as an obstacle everywhere she only
    // wants to navigate the menu — and a child choosing `ufmag` would get the whole interface in blackletter, including
    // the menu she would have to get out of.
    const oferecidas = chaves('atkinson');
    for (const k of ['pinyon', 'ufmag']) {
      expect(oferecidas, `a caligráfica ${k} voltou ao menu`).not.toContain(k);
    }
    // And the counterweight: `pwbr` is in the SAME group and is its general face (ADR-0176) — removing it would be cutting
    // by group, not by role.
    expect(oferecidas, 'a Playwrite BR saiu do menu por estar no grupo `hand`').toContain('pwbr');
  });

  it('[Right] uma face da lista é a escolhida, e SÓ uma', () => {
    const escolhidas = typoGroups(translate, 'andika').flatMap((g) => g.rows.filter((r) => r.selected));
    expect(escolhidas.map((r) => r.key)).toEqual(['andika']);
  });

  it('[Error] chave desconhecida não derruba a lista — ela sai inteira, sem nenhuma escolhida', () => {
    expect(() => typoGroups(translate, 'nao-existe')).not.toThrow();
    expect(chaves('nao-existe').length).toBe(chaves('atkinson').length);
    expect(typoGroups(translate, 'nao-existe').flatMap((g) => g.rows.filter((r) => r.selected))).toHaveLength(0);
  });
});

describe('FONT_BY_KEY — the catalogue by key, built in one expression (ADR-0232 D4)', () => {
  it('holds every item of every group under its key, the last one winning, and nothing else', () => {
    const expected = new Map();
    for (const g of FONT_GROUPS) for (const it of g.items) expected.set(it.k, it);
    expect(Object.keys(FONT_BY_KEY).sort()).toEqual([...expected.keys()].sort());
    for (const [k, it] of expected) expect(FONT_BY_KEY[k], `${k} is not the catalogue's item`).toBe(it);
  });
});