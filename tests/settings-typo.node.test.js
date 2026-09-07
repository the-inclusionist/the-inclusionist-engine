// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-typo — lógica PURA (project node, sem document). ZOMBIES + Right-BICEP.
// Cobre: validação/migração da chave persistida, mapeamento chave→CSS (data-fonte/--font-custom) e o
// view-model das linhas do painel (seleção/desabilitado/nota). O render() em si (toca DOM) fica no
// settings-typo.browser.test.js. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // o catálogo de fontes guarda CHAVE desde o item 14
import {
  isSelectableFont, resolveFontKey, persistFontKey, fontCssTarget, typoGroups, typoListHTML, linhaDaFonte,
} from '../app/js/ui/settings-typo.js';
import { FONT_BY_KEY, FONT_GROUPS, papelDaFonte } from '../app/js/ui/fonts.js';

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
  it('⚠️ [Boundary] falso para caligráfica e para chave que saiu do roster', () => {
    // ⚠️ ESTE CASO PASSOU A PASSAR PELO MOTIVO ERRADO em 2026-09-07 e por isso foi reescrito. Ele afirmava
    // `isSelectableFont('kindergarten') === false` por a face estar `.off`; a `kindergarten` saiu do roster
    // (issue #87, item 3), então a resposta continuou `false` — mas pelo caminho da CHAVE DESCONHECIDA, que
    // já é o caso seguinte. Um teste que sobrevive à remoção do seu próprio sujeito deixou de o medir.
    //
    // O que ele mede agora é a regra que passou a existir: uma CALIGRÁFICA não é selecionável, porque o
    // menu não a oferece e a emenda do ADR-0012 diz que ela não pode ser a face da interface.
    expect(isSelectableFont('pinyon'), 'uma caligráfica virou selecionável').toBe(false);
    expect(isSelectableFont('ufmag'), 'uma caligráfica virou selecionável').toBe(false);
    // E o contrapeso: a Comic Neue está no mesmo GRUPO e é de papel geral — continua selecionável.
    expect(isSelectableFont('comicneue')).toBe(true);
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
    // Antes da emenda do ADR-0012 o menu oferecia as sete caligráficas, então há crianças com `pinyon`
    // guardado. O valor salvo é escolha delas e não é nossa para desfazer sem motivo — mas o motivo existe:
    // uma caligráfica não pode ser a face da INTERFACE, e o menu deixou de a oferecer. Deixá-la valer daria
    // uma interface inteira em letra cursiva a quem já não tem como sair dela pelo menu.
    expect(resolveFontKey(fakeStore({ incl_font_k: 'pinyon' }))).toBe('atkinson');
    // E uma chave que saiu do roster cai no mesmo lugar, em vez de ficar sem face nenhuma.
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

// ===================================================================================================
// O PAPEL DA FACE, E O TAMANHO MÍNIMO DE UMA CALIGRÁFICA (ADR-0012 emendado, issue #87)
// ===================================================================================================
describe('as caligráficas: papel declarado e tamanho mínimo', () => {
  const TODAS = FONT_GROUPS.flatMap((g) => g.items);
  const CALIGRAFICAS = TODAS.filter((it) => papelDaFonte(it) === 'caligrafica');

  it('[Zero] há caligráficas no catálogo — senão os casos abaixo não medem nada', () => {
    expect(CALIGRAFICAS.length).toBeGreaterThan(0);
    expect(CALIGRAFICAS.map((it) => it.k).sort()).toEqual(['pinyon', 'ufmag']);
  });

  it('⚠️ [Right] toda caligráfica declara `minPx`, com os números do Dev', () => {
    // ⚠️ Abaixo do mínimo a face deixa de ser DIFÍCIL e passa a ser ILEGÍVEL, e as duas coisas são
    // diferentes: a dificuldade é o exercício — a criança está a aprender a ler cursiva —, a ilegibilidade é
    // a criança a desistir. É por isso que o item 2 da #87 diz «tem de ser gate, não recomendação».
    for (const it of CALIGRAFICAS) {
      expect(it.minPx, `${it.k} é caligráfica e não declara tamanho mínimo`).toBeTypeOf('number');
      expect(it.minPx, `${it.k}: mínimo abaixo de 20px`).toBeGreaterThanOrEqual(20);
    }
    expect(FONT_BY_KEY.pinyon.minPx, 'a Pinyon é a mais fina das quatro e pede 24').toBe(24);
    expect(FONT_BY_KEY.ufmag.minPx).toBe(20);
  });

  it('⚠️ [Interface] nenhuma GERAL declara `minPx` — o mínimo é a marca de quem é caligráfica', () => {
    // Se uma face geral ganhasse mínimo, o número deixaria de dizer «esta é difícil de ler em pequeno» e
    // passaria a ser um campo opcional qualquer. O papel e o mínimo andam juntos ou nenhum dos dois informa.
    const erradas = TODAS.filter((it) => papelDaFonte(it) === 'geral' && it.minPx !== undefined).map((it) => it.k);
    expect(erradas, 'face geral com tamanho mínimo: ' + erradas.join(', ')).toEqual([]);
  });

  it('[Boundary] a Comic Neue está no grupo `hand` e é GERAL — o corte é por papel, não por grupo', () => {
    const hand = FONT_GROUPS.find((g) => g.g === 'font.group.hand');
    expect(hand.items.map((it) => it.k)).toContain('comicneue');
    expect(papelDaFonte(FONT_BY_KEY.comicneue)).toBe('geral');
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
  it('⚠️ [Boundary] o MECANISMO `.off` continua vivo, mesmo sem nenhuma face a usá-lo hoje', () => {
    // Este caso apontava para a `kindergarten`, que saiu do roster em 2026-09-07 (issue #87, item 3) — era
    // uma entrada `.off` SEM FICHEIRO, isto é, o menu oferecia-a desabilitada e não havia nada por trás.
    //
    // ⚠️ O mecanismo NÃO saiu com ela, e não deve: o item 4 da mesma issue precisa dele para a **Ronde**, que
    // só pode ser oferecida se uma de três faces estiver instalada (`document.fonts.check()`), porque as
    // outras duas são gratuitas apenas para uso pessoal e não podem ser empacotadas.
    //
    // Por isso o caso passou a medir a FUNÇÃO com uma face de mentira, em vez de depender de o catálogo
    // continuar a ter uma desligada. Um teste que depende da composição do roster reprova sempre que o
    // roster muda — que foi exactamente o que aconteceu aqui.
    const falsa = { k: 'x', fam: 'Fonte de Mentira', fb: 'sans', d: 'font.desc.pinyon', off: 'font.off.pending' };
    const linha = linhaDaFonte(falsa, 'atkinson');
    expect(linha.disabled).toBe(true);
    expect(linha.note, 'a nota de uma face desligada tem de dizer o MOTIVO').not.toBe('');
    expect(linha.note).toContain('—'); // descrição — motivo, as duas metades
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
  // ⚠️ `?.[0] ?? null` e não `[0]`: desde a issue #87 há faces que o menu NÃO oferece (as caligráficas), e
// «não está lá» passou a ser uma resposta legítima a perguntar. Com o `[0]` cru, o caso que afirma a ausência
// rebentava com `TypeError` em vez de falhar com a sua própria mensagem.
const botaoDe = (html, chave) => html.match(new RegExp(`<button[^>]*data-font="${chave}"[^>]*>`))?.[0] ?? null;

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

  it('⚠️ [Boundary] nenhuma CALIGRÁFICA aparece no menu — a emenda do ADR-0012, aferida', () => {
    // As caligráficas existem para a criança APRENDER a ler letra cursiva, e isso é matéria: vive dentro das
    // atividades, em botões próprios. Oferecê-las aqui dá-lhe a matéria como obstáculo em todo lugar onde
    // ela só quer navegar o menu — e uma criança que escolhesse `ufmag` ficava com a interface inteira em
    // gótico, incluindo o menu de onde teria de sair.
    const html = typoListHTML('atkinson');
    for (const k of ['pinyon', 'ufmag']) {
      expect(botaoDe(html, k), `a caligráfica ${k} voltou ao menu`).toBe(null);
    }
    // E o contrapeso: `comicneue` está no MESMO grupo por aparência e é de propósito geral — tirá-la seria
    // remover uma opção legitimamente acessível pelo formato do grupo em vez de pelo papel.
    expect(botaoDe(html, 'comicneue'), 'a Comic Neue saiu do menu por estar no grupo `hand`').not.toBe(null);
  });

  it('[Error] chave desconhecida não derruba a geração (nenhuma linha fica selected)', () => {
    expect(() => typoListHTML('nao-existe')).not.toThrow();
    expect(typoListHTML('nao-existe')).not.toContain('is-on');
  });
});
