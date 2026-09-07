// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-typo — lógica PURA (project node, sem document). ZOMBIES + Right-BICEP.
// Cobre: validação/migração da chave persistida, mapeamento chave→CSS (data-fonte/--font-custom) e o
// view-model das linhas do painel (seleção/desabilitado/nota). O render() em si (toca DOM) fica no
// settings-typo.browser.test.js. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // o catálogo de fontes guarda CHAVE desde o item 14
import {
  isSelectableFont, resolveFontKey, persistFontKey, fontCssTarget, typoGroups, typoListHTML,
} from '../app/js/ui/settings-typo.js';
import { FONT_BY_KEY } from '../app/js/ui/fonts.js';

// Fake de platform/storage.ts: um Map em memória, mesma forma (get/set) do módulo real.
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
  it('[Boundary] falso para fonte marcada .off (licença pendente)', () => {
    expect(isSelectableFont('kindergarten')).toBe(false); // "licença em negociação"
    expect(isSelectableFont('learningcurve')).toBe(false); // "licença a confirmar"
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
  it('[Boundary] ignora a chave nova quando aponta p/ fonte .off, cai no default', () => {
    const store = fakeStore({ incl_font_k: 'kindergarten' });
    expect(resolveFontKey(store)).toBe('atkinson');
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
    const store = fakeStore({ incl_font_k: 'quattro', incl_fonte: 'dislexia' });
    expect(resolveFontKey(store)).toBe('quattro');
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
    expect(fontCssTarget('atkinson', FONT_BY_KEY.atkinson)).toEqual({ fonte: 'padrao', customFamily: null });
  });
  it('[Right] andika → data-fonte="alfabetizacao"', () => {
    expect(fontCssTarget('andika', FONT_BY_KEY.andika)).toEqual({ fonte: 'alfabetizacao', customFamily: null });
  });
  it('[Right] lexend → data-fonte="dislexia" (mantém o espaçamento BDA)', () => {
    expect(fontCssTarget('lexend', FONT_BY_KEY.lexend)).toEqual({ fonte: 'dislexia', customFamily: null });
  });
  it('[Edge-case] fonte sans genérica → custom sem fallback extra', () => {
    expect(fontCssTarget('inter', FONT_BY_KEY.inter)).toEqual({ fonte: 'custom', customFamily: "'Inter'" });
  });
  it('[Edge-case] fonte serifada → custom com fallback ,Georgia,serif', () => {
    expect(fontCssTarget('literata', FONT_BY_KEY.literata)).toEqual({ fonte: 'custom', customFamily: "'Literata',Georgia,serif" });
  });
  it('[Edge-case] fonte manuscrita → custom com fallback ,cursive', () => {
    expect(fontCssTarget('comicneue', FONT_BY_KEY.comicneue)).toEqual({ fonte: 'custom', customFamily: "'Comic Neue',cursive" });
  });
});

describe('typoGroups — view-model das linhas', () => {
  it('[Right] marca como selected apenas a linha da chave ativa', () => {
    const groups = typoGroups('lexend');
    const flat = groups.flatMap((g) => g.rows);
    const selected = flat.filter((r) => r.selected);
    expect(selected).toHaveLength(1);
    expect(selected[0].key).toBe('lexend');
  });
  it('[Boundary] fonte .off vem com disabled=true e a nota inclui o motivo', () => {
    const row = typoGroups('atkinson').flatMap((g) => g.rows).find((r) => r.key === 'kindergarten');
    expect(row.disabled).toBe(true);
    expect(row.note).toContain('licença em negociação');
  });
  it('[Right] fonte sem descrição e sem .off tem note vazia', () => {
    const row = typoGroups('atkinson').flatMap((g) => g.rows).find((r) => r.key === 'inter');
    expect(row.disabled).toBe(false);
    expect(row.note).toBe('');
  });
  it('[Right] preserva os 3 grupos do catálogo, TRADUZIDOS (a chave nunca chega à tela)', () => {
    const groups = typoGroups('atkinson');
    // Contra `t()` e não contra o português: o catálogo guarda CHAVE desde o item 14, e fixar as três
    // palavras aqui devolveria ao teste o texto que saiu do código. O que este caso guarda é que os três
    // grupos continuam existindo, na ordem, JÁ RESOLVIDOS.
    expect(groups.map((g) => g.g)).toEqual(['font.group.sans', 'font.group.serif', 'font.group.hand'].map(t));
    for (const g of groups) expect(g.g, 'chave crua na tela').not.toMatch(/^font\./);
  });
});

// ===================================================================================================
// O MENU É UMA ESCOLHA, NÃO UM INTERRUPTOR (ADR-0012, emenda de 27/08)
// ===================================================================================================
// ⚠️ O CASO QUE ESTAVA AQUI CONGELAVA O DEFEITO. Ele afirmava `aria-pressed="true"` e `is-on`, ou seja
// descrevia o que o código FAZIA em vez do que o registro DECIDE — e a emenda do ADR-0012 é literal:
//
//     «THE MENU IS A CHOICE, NOT A TOGGLE: the selected font is shown with a yellow background, like a
//      pressed button. One font is active; the others are alternatives, not switches.»
//
// O que estava no código era o oposto: `class="mode-btn switch"` (que o `style.css:427` desenha como um
// interruptor de 52×28 px com bolinha), `aria-pressed`, e o rótulo `toggleLabel(selected)` — que devolve
// «Ligado»/«Desligado». Oito interruptores para escolher UMA fonte, anunciados como oito estados
// independentes a quem escuta.
//
// ⚠️ E O ESTADO VAI EM DUAS FORMAS, NENHUMA DELAS COR — é a regra que `ui/activities-menu.ts:656` já
// carrega por escrito: `aria-checked` para quem escuta, uma marca para quem vê. O fundo amarelo do
// `.mode-btn.is-on` continua, porque é o que a emenda pede; o que ele não pode ser é o ÚNICO sinal.
describe('typoListHTML — uma escolha exclusiva, não oito interruptores', () => {
  const botaoDe = (html, chave) => html.match(new RegExp(`<button[^>]*data-font="${chave}"[^>]*>`))[0];

  it('⚠️ [Right] a fonte ativa é `aria-checked=true`, e NENHUM botão é um interruptor', () => {
    const html = typoListHTML('andika');
    const btn = botaoDe(html, 'andika');
    expect(btn).toContain('aria-checked="true"');
    expect(btn, 'aria-pressed é vocabulário de INTERRUPTOR').not.toContain('aria-pressed');
    expect(html, 'a classe `switch` desenha um interruptor (style.css:427)').not.toContain('switch');
  });

  it('⚠️ [Right] as outras são `aria-checked=false` — alternativas, não desligadas', () => {
    const html = typoListHTML('andika');
    expect(botaoDe(html, 'atkinson')).toContain('aria-checked="false"');
  });

  it('[Interface] a lista é UM grupo de rádio — uma fonte activa no total, não uma por secção', () => {
    // Sem o grupo, um leitor de tela anuncia rádios soltos e não diz «1 de 17». E o grupo é ÚNICO
    // atravessando as três secções, porque a exclusividade é do menu inteiro e não de cada família.
    const html = typoListHTML('andika');
    expect((html.match(/role="radiogroup"/g) || []).length).toBe(1);
    expect((html.match(/role="radio"/g) || []).length).toBeGreaterThan(5);
  });

  it('[Interface] o fundo amarelo FICA — a emenda pede-o por extenso', () => {
    expect(botaoDe(typoListHTML('andika'), 'andika')).toContain('is-on');
  });

  it('⚠️ [Interface] e o estado também é VISÍVEL sem cor — a marca de seleção', () => {
    // `.mode-btn.is-on` pinta com `var(--accent)`. Cor sozinha falha para quem não a distingue, e é a
    // razão de `activities-menu` já emitir ☑/☐ ao lado do `aria-checked`.
    const html = typoListHTML('andika');
    const conteudo = html.match(/data-font="andika"[^>]*>([^<]*)</)[1];
    expect(conteudo.trim(), 'o botão da fonte activa não mostra marca nenhuma').not.toBe('');
  });

  it('[Boundary] fonte .off gera botão disabled', () => {
    expect(botaoDe(typoListHTML('atkinson'), 'kindergarten')).toContain('disabled');
  });

  it('[Error] chave desconhecida não derruba a geração (nenhuma linha fica selected)', () => {
    expect(() => typoListHTML('nao-existe')).not.toThrow();
    expect(typoListHTML('nao-existe')).not.toContain('is-on');
  });
});
