// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/settings-typo — render()/setFont() (project BROWSER: usa document). Contrato: DI por closure
// (ctx.$/srSay/store/root), nenhum acesso a globais fora do ctx. A lógica pura (mapeamento/validação/view-model)
// está coberta em settings-typo.node.test.js. Modelo: tests/a11y-sr.browser.test.js, tests/debug-panel.browser.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { initSettingsTypo } from '../app/js/ui/settings-typo.js';

// Fake de platform/storage.ts (mesma forma get/set), em memória.
function fakeStore(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { map: m, get: (k, fallback = null) => (m.has(k) ? m.get(k) : fallback), set: (k, v) => { m.set(k, String(v)); return true; } };
}

const $ = (sel) => document.querySelector(sel);

function fullCtx(over = {}) {
  const said = [];
  return {
    $,
    srSay: (msg) => said.push(msg),
    store: fakeStore(),
    root: document.documentElement,
    said,
    ...over,
  };
}

describe('ui/settings-typo', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="typo"><div id="typo-list"></div><span id="typo-preview"></span>' +
      '<button id="typo-reset" type="button">Restaurar</button></div>';
    document.documentElement.removeAttribute('data-fonte');
    document.documentElement.style.removeProperty('--font-custom');
  });

  it('[Zero] initSettingsTypo aplica a fonte padrão (atkinson) ao montar, sem anunciar', () => {
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);
    expect(api.getFontKey()).toBe('atkinson');
    expect(document.documentElement.dataset.fonte).toBe('padrao');
    expect(ctx.said).toHaveLength(0); // boot não fala (announce=false)
  });

  it('[Interface] respeita a fonte persistida no store injetado ao montar', () => {
    const ctx = fullCtx({ store: fakeStore({ incl_font_k: 'lexend' }) });
    const api = initSettingsTypo(ctx);
    expect(api.getFontKey()).toBe('lexend');
    expect(document.documentElement.dataset.fonte).toBe('dislexia');
  });

  it('[Interface] render() preenche #typo-list e marca a fonte ativa como is-on', () => {
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);
    api.render();
    const list = $('#typo-list');
    expect(list.children.length).toBeGreaterThan(0);
    const active = list.querySelector('button[data-font="atkinson"]');
    expect(active.classList.contains('is-on')).toBe(true);
    expect(active.getAttribute('aria-pressed')).toBe('true');
  });

  it('[Right] clicar num botão de fonte troca a seleção, aplica o CSS, persiste e anuncia', () => {
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);
    api.render();
    $('#typo-list').querySelector('button[data-font="andika"]').click();
    expect(api.getFontKey()).toBe('andika');
    expect(document.documentElement.dataset.fonte).toBe('alfabetizacao');
    expect(ctx.store.map.get('incl_font_k')).toBe('andika');
    expect(ctx.said).toEqual(['Tipografia: Andika.']);
  });

  it('[Right] clicar re-renderiza: o botão antigo perde is-on e o novo ganha', () => {
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);
    api.render();
    $('#typo-list').querySelector('button[data-font="andika"]').click();
    const list = $('#typo-list');
    expect(list.querySelector('button[data-font="atkinson"]').classList.contains('is-on')).toBe(false);
    expect(list.querySelector('button[data-font="andika"]').classList.contains('is-on')).toBe(true);
  });

  it('[Boundary] setFont numa chave .off (licença pendente) é no-op — nada muda', () => {
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);
    api.setFont('kindergarten', true);
    expect(api.getFontKey()).toBe('atkinson'); // não mudou
    expect(ctx.said).toHaveLength(0); // não anunciou
  });

  it('[Boundary] botão de fonte .off nasce disabled (não clicável)', () => {
    const ctx = fullCtx();
    initSettingsTypo(ctx).render();
    const btn = $('#typo-list').querySelector('button[data-font="kindergarten"]');
    expect(btn.disabled).toBe(true);
  });

  it('[Error] setFont com chave desconhecida é no-op e não lança', () => {
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);
    expect(() => api.setFont('nao-existe', true)).not.toThrow();
    expect(api.getFontKey()).toBe('atkinson');
  });

  it('[Edge-case] fonte custom (fora do trio canônico) grava --font-custom com o fallback certo', () => {
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);
    api.setFont('literata', false);
    expect(document.documentElement.dataset.fonte).toBe('custom');
    expect(document.documentElement.style.getPropertyValue('--font-custom')).toBe("'Literata',Georgia,serif");
  });

  it('[Cross-check] render() sincroniza a família do #typo-preview com a fonte ativa', () => {
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);
    api.setFont('lexend', false);
    api.render();
    expect($('#typo-preview').style.fontFamily).toBe('Lexend'); // o browser normaliza e tira as aspas do valor computado
  });

  it('[Zero] sem #typo-list no DOM, render() não lança (só não desenha)', () => {
    document.body.innerHTML = '';
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);
    expect(() => api.render()).not.toThrow();
  });
});

describe('ui/settings-typo — restaurar padrões DESTE menu (ADR-0028)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="typo"><div id="typo-list"></div><span id="typo-preview"></span>' +
      '<button id="typo-reset" type="button">Restaurar</button></div>';
    document.documentElement.removeAttribute('data-fonte');
    document.documentElement.style.removeProperty('--font-custom');
  });

  it('[Right] volta para a Atkinson — persistida, aplicada ao root e refletida na lista', () => {
    const ctx = fullCtx({ store: fakeStore({ incl_font_k: 'lexend' }) });
    const api = initSettingsTypo(ctx);
    api.render();
    expect(api.getFontKey()).toBe('lexend');

    $('#typo-reset').click();

    expect(api.getFontKey()).toBe('atkinson');
    expect(document.documentElement.dataset.fonte).toBe('padrao');
    expect(ctx.store.map.get('incl_font_k')).toBe('atkinson');
    expect($('#typo-list').querySelector('button[data-font="atkinson"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('[Interface] limpa o --font-custom que uma fonte de catálogo tinha deixado no root', () => {
    // A volta tem que apagar o rastro da ida. Uma fonte "custom" escreve a propriedade; se o reset trocasse só
    // o data-fonte, a criança ficaria com o padrão declarado e a fonte anterior ainda desenhada na tela.
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);
    api.setFont('comicneue', true); // fonte de catálogo → passa pelo --font-custom, não por um data-fonte próprio
    api.render();
    const antes = document.documentElement.style.getPropertyValue('--font-custom');

    $('#typo-reset').click();

    expect(antes).toContain('Comic Neue');
    expect(document.documentElement.style.getPropertyValue('--font-custom')).toBe('');
    expect(document.documentElement.dataset.fonte).toBe('padrao');
  });

  it('[Interface] anuncia NOMEANDO a fonte — a mudança é visível para quem enxerga e muda para quem não', () => {
    const ctx = fullCtx({ store: fakeStore({ incl_font_k: 'lexend' }) });
    initSettingsTypo(ctx);
    $('#typo-reset').click();
    expect(ctx.said.at(-1)).toContain('Atkinson');
  });

  it('[Zero] já no padrão, clicar o reset não quebra nem muda a chave', () => {
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);
    expect(() => $('#typo-reset').click()).not.toThrow();
    expect(api.getFontKey()).toBe('atkinson');
  });
});

describe('ui/settings-typo — marca o que saiu do padrão (ADR-0029)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button data-act="tipo" class="pm-btn" type="button">Tipografia</button>' +
      '<div id="typo"><div id="typo-list"></div><span id="typo-preview"></span>' +
      '<button id="typo-reset" type="button">Restaurar</button></div>';
    document.documentElement.removeAttribute('data-fonte');
  });

  const linhaDe = (k) => $(`#typo-list button[data-font="${k}"]`).closest('.ctrl-row');

  it('[Right] a fonte escolhida fora do padrão é marcada, e o botão do menu junto', () => {
    const ctx = fullCtx({ store: fakeStore({ incl_font_k: 'lexend' }) });
    initSettingsTypo(ctx).render();
    expect(linhaDe('lexend').classList.contains('is-changed')).toBe(true);
    expect($('[data-act="tipo"]').classList.contains('is-changed')).toBe(true);
  });

  it('[Boundary] as outras quinze NÃO são marcadas — elas foram oferecidas, não alteradas', () => {
    const ctx = fullCtx({ store: fakeStore({ incl_font_k: 'lexend' }) });
    initSettingsTypo(ctx).render();
    expect($('#typo-list').querySelectorAll('.is-changed')).toHaveLength(1);
    expect(linhaDe('atkinson').classList.contains('is-changed')).toBe(false);
  });

  it('[Right] voltar ao padrão APAGA a marca, na linha e no botão do menu', () => {
    // O caso que mantém a marca honesta: uma marca que só soubesse aparecer acabaria em tudo.
    const ctx = fullCtx({ store: fakeStore({ incl_font_k: 'lexend' }) });
    const api = initSettingsTypo(ctx);
    api.render();
    $('#typo-reset').click();
    expect($('#typo-list').querySelectorAll('.is-changed')).toHaveLength(0);
    expect($('[data-act="tipo"]').classList.contains('is-changed')).toBe(false);
    expect(api.getFontKey()).toBe('atkinson');
  });

  it('[Interface] a marca também sai no NOME acessível — quem não enxerga a moldura ouve o sufixo', () => {
    const ctx = fullCtx({ store: fakeStore({ incl_font_k: 'lexend' }) });
    initSettingsTypo(ctx).render();
    expect($('#typo-list button[data-font="lexend"]').getAttribute('aria-label')).toContain('alterado');
  });
});
