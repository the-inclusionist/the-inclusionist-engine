// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-typo — render()/setFont() (project BROWSER: usa document). Contrato: DI por closure
// (ctx.$/srSay/store/root), nenhum acesso a globais fora do ctx. A lógica pura (mapeamento/validação/view-model)
// está coberta em settings-typo.node.test.js. Modelo: tests/a11y-sr.browser.test.js, tests/debug-panel.browser.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import cssDoJogo from '../app/css/style.css?raw'; // a folha do jogo, para o caso do espaçamento medir o computado
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
    expect(active.getAttribute('aria-checked')).toBe('true');
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
    // ⚠️ ESTE CASO PERDEU O SUJEITO em 2026-09-07: apontava para a `kindergarten`, uma entrada `.off` sem
    // ficheiro que saiu do roster (issue #87, item 3). O que ele mede agora é a outra metade da mesma regra,
    // que passou a existir: nenhuma CALIGRÁFICA é desenhada no menu — não desabilitada, AUSENTE.
    //
    // A diferença importa para quem navega por leitor de tela: um botão desabilitado ainda é anunciado e
    // ainda ocupa uma parada na travessia. Uma face que a criança não pode usar como interface não deve
    // custar-lhe uma parada.
    for (const k of ['pinyon', 'ufmag']) {
      expect($('#typo-list').querySelector(`button[data-font="${k}"]`), `${k} apareceu no menu`).toBe(null);
    }
    expect($('#typo-list').querySelector('button[data-font="pwbr"]'), 'a Playwrite BR sumiu do menu').not.toBe(null);
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

  it('🔴 [Right] o espaçamento PADRÃO do documento é o da BDA — e a cursiva devolve-o a `normal`', () => {
    /*
     * 🔴 ESTE CASO NASCEU DE UMA MUTAÇÃO SOBREVIVENTE, e é a mais importante desta mudança: repor o `--ls`
     * em 0.12em — o piso da WCAG §1.4.12, que era o valor de antes — não reprovava NADA. O número que a
     * decisão inteira do Dev move não estava preso em lado nenhum.
     *
     * 📏 A regra: 0.18em de letra e 0.63em de palavra, que é a recomendação da British Dyslexia Association
     * (palavra ≥ 3,5× letra). Antes eles viviam só em `[data-fonte="dislexia"]`, e a face PADRÃO — a que
     * todos os jogos desenham — ficava no piso mais baixo dos dois.
     *
     * ⚠️ MEDIDO PELO COMPUTADO e não pelo texto do ficheiro: o que importa é o que o navegador resolve na
     * raiz, que é onde a cascata acaba. Ler o CSS como string mediria o que eu escrevi, não o que se aplica.
     */
    // 📌 A FOLHA ENTRA À MÃO, pelo precedente de `palco-tem-prioridade.browser.test.js`: o ambiente do vitest
    // não carrega o `style.css` do jogo, e sem ela tudo responde `normal` — o caso do vácuo abaixo apanhou
    // exactamente isso na primeira volta.
    const folha = document.createElement('style');
    folha.textContent = cssDoJogo;
    document.head.appendChild(folha);
    const raiz = document.documentElement;
    const espaco = () => {
      const c = getComputedStyle(raiz);
      return { ls: c.letterSpacing, ws: c.wordSpacing };
    };
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);

    api.setFont('atkinson', false);
    const padrao = espaco();
    // O caso do vácuo: sem a folha carregada, tudo seria `normal` e as duas metades passariam de graça.
    expect(padrao.ls, 'a folha de estilo não foi aplicada; o caso mediria o nada').not.toBe('normal');
    // 16px de base × 0.18em = 2.88px; × 0.63em = 10.08px. Comparado em px porque é o que o computado devolve.
    expect(parseFloat(padrao.ls) / 16, 'o espaçamento de LETRA não é o da BDA').toBeCloseTo(0.18, 2);
    expect(parseFloat(padrao.ws) / 16, 'o espaçamento de PALAVRA não é o da BDA').toBeCloseTo(0.63, 2);

    // 🔴 E a cursiva devolve os dois a `normal` — espaçar uma face ligada parte-a nas junções.
    api.setFont('pwbr', false);
    // ⚠️ O COMPUTADO É ASSIMÉTRICO, e é do navegador e não da regra: para `normal`, o Chromium devolve
    // `'normal'` em `letterSpacing` e `'0px'` em `wordSpacing`. Escrito à espera de `'normal'` nos dois, o
    // caso reprovava com o CSS certo. O que se afirma é «não há espaçamento extra», e é isso que se mede.
    const cursiva = espaco();
    expect(cursiva.ls, 'a face ligada ficou com espaçamento de letra a partir-lhe os conectores').toBe('normal');
    expect(parseFloat(cursiva.ws) || 0, 'a face ligada ficou com espaçamento de palavra').toBe(0);

    /*
     * 🔴 E A ESCALA DA MÃO DO PAÍS, no mesmo sítio e pelo mesmo motivo: uma mutação que tirava o `calc()` do
     * `font-size` de `html,body` não reprovava NADA — a regra que faz a posição (e) ser 25% maior estava
     * escrita e não estava presa.
     *
     * 📏 16 px × 1,25 = 20 px, que é exactamente o `minPx` das Playwrite. O número não é gosto: abaixo do
     * piso a face deixa de ser DIFÍCIL e passa a ser ILEGÍVEL, e a dificuldade é o exercício enquanto a
     * ilegibilidade é a criança a desistir (emenda do ADR-0012).
     */
    // 📌 Since ADR-0176 the menu itself draws a face at its floor: choosing Playwrite BR (20 px) makes the game's TEXT 25%
    // larger, and going back to a reading face gives the base back. Since issue #172 the scale is the region's, never the
    // document's: the root stays 16 px, so `rem` spacing does not grow with the hand (interface log 2026-09-13).
    const regiao = document.createElement('div');
    regiao.id = 'game-region';
    document.body.appendChild(regiao);
    try {
      expect(parseFloat(getComputedStyle(regiao).fontSize), 'the menu did not draw Playwrite BR at its floor').toBe(20);
      expect(parseFloat(getComputedStyle(raiz).fontSize), 'the whole document grew with the hand').toBe(16);
      api.setFont('atkinson', false);
      expect(parseFloat(getComputedStyle(regiao).fontSize), 'a base do texto não é 16 px').toBe(16);
      raiz.style.setProperty('--fonte-escala', '1.25');
      expect(parseFloat(getComputedStyle(regiao).fontSize),
        'a escala foi escrita e o texto não a multiplicou — a mão do país fica abaixo do piso').toBe(20);
    } finally {
      regiao.remove();
    }

    raiz.style.removeProperty('--fonte-escala');
    folha.remove();
    delete raiz.dataset.cursiva;
  });

  it('🔴 [Right] uma face LIGADA marca `data-cursiva`, e voltar a uma de leitura APAGA a marca', () => {
    /*
     * 🔴 É a excepção do ADR-0149 §3, e a marca é o que tira o espaçamento da BDA: espaçar uma cursiva
     * parte-a nas junções que a fazem cursiva — «para manter os conectores», palavras do Dev.
     *
     * ⚠️ E O SEGUNDO METADE DO CASO É QUE IMPORTA. Escrever a marca sem a APAGAR deixaria uma criança que
     * experimentou uma cursiva e voltou para a Atkinson com a face de LEITURA sem espaçamento nenhum — o
     * defeito na direcção mais cara, porque quem volta para a face de leitura é exactamente quem precisa
     * dele. Um caso que só medisse a ida ficaria verde com essa metade partida.
     */
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);

    api.setFont('pwbr', false);
    expect(document.documentElement.dataset.cursiva, 'a face ligada não marcou a excepção').toBe('1');

    api.setFont('atkinson', false);
    expect(document.documentElement.dataset.cursiva,
      'voltou para a face de leitura e ficou sem o espaçamento da BDA').toBeUndefined();
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
    expect($('#typo-list').querySelector('button[data-font="atkinson"]').getAttribute('aria-checked')).toBe('true');
  });

  it('[Interface] limpa o --font-custom que uma fonte de catálogo tinha deixado no root', () => {
    // A volta tem que apagar o rastro da ida. Uma fonte "custom" escreve a propriedade; se o reset trocasse só
    // o data-fonte, a criança ficaria com o padrão declarado e a fonte anterior ainda desenhada na tela.
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);
    api.setFont('pwbr', true); // fonte de catálogo → passa pelo --font-custom, não por um data-fonte próprio
    api.render();
    const antes = document.documentElement.style.getPropertyValue('--font-custom');

    $('#typo-reset').click();

    expect(antes).toContain('Playwrite BR');
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

// ============================================================================================
// A EXPLICAÇÃO APARECIA DUAS VEZES — achado do Dev, 2026-08-27.
//
// "a explicação está duplicada no menu fonte, aparece no rodapé, o que é certo, mas também está aparecendo
//  embaixo do nome da fonte."
//
// O MECANISMO, e ele está escrito no CLAUDE.md como AVISO desde 2026-08-25: `fillExplain` tira o `.opt-hint`
// de dentro da linha e o move para o rodapé, reescrevendo o `<span>` para conter só o rótulo curto. Ele roda
// uma vez, quando o overlay é frontalizado.
//
// `render()` reconstrói o `#typo-list` inteiro — e é chamado DE NOVO a cada clique numa fonte. As linhas novas
// voltam com o `.opt-hint` dentro, e ninguém o move outra vez. Rodapé com a descrição (da primeira passada) E
// descrição sob o nome da fonte (do redesenho). Exatamente o que ele viu.
//
// "Painel que re-renderiza precisa chamar `fillExplain` a cada render, senão a prosa volta para dentro das
//  linhas no primeiro clique." — CLAUDE.md §4, escrito ANTES deste defeito existir. O aviso estava certo e o
// painel de tipografia era o que faltava obedecê-lo.
//
// MUTAÇÃO CONFERIDA: tirar a chamada do fim do `render()` faz este caso reprovar.
describe('ui/settings-typo · a explicação FICA no rodapé, inclusive depois de escolher uma fonte', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="typo"><div class="overlay__card"><div id="typo-list"></div>' +
      '<span id="typo-preview"></span><button id="typo-reset" type="button">Restaurar</button></div></div>';
  });

  /** Um `fillExplain` mínimo com o comportamento que importa: tira o `.opt-hint` de dentro da linha. */
  const moverParaORodape = (card) => {
    card?.querySelectorAll('.ctrl-row').forEach((row) => {
      const span = row.querySelector(':scope > span');
      const strong = span?.querySelector('strong');
      if (span && strong) span.innerHTML = strong.outerHTML;
    });
  };

  it('[Right] depois de trocar de fonte, nenhuma linha volta a carregar a prosa dentro dela', () => {
    const chamadas = [];
    const ctx = fullCtx({ fillExplain: (card) => { chamadas.push(card); moverParaORodape(card); } });
    const api = initSettingsTypo(ctx);
    api.render();
    expect($('#typo-list').querySelectorAll('.opt-hint').length, 'a primeira passada limpa as linhas').toBe(0);

    const alvo = $('#typo-list').querySelector('button[data-font]:not([disabled])');
    alvo.click();

    expect($('#typo-list').querySelectorAll('.opt-hint').length,
      'depois do clique a prosa NÃO pode ter voltado para dentro das linhas').toBe(0);
    expect(chamadas.length, '`render()` tem de pedir a mudança para o rodapé toda vez').toBeGreaterThan(1);
  });

  it('[Zero] sem `fillExplain` injetado, o painel continua desenhando — a dependência é opcional', () => {
    const api = initSettingsTypo(fullCtx());
    expect(() => api.render()).not.toThrow();
  });
});
