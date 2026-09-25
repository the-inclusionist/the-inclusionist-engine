// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-typo — render()/setFont() (BROWSER project: uses document). Contract: DI by closure
// (ctx.$/srSay/store/root), no access to globals outside the ctx. The pure logic (mapping/validation/view-model) is
// covered in settings-typo.node.test.js. Model: tests/a11y-sr.browser.test.js, tests/debug-panel.browser.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import cssDoJogo from '../app/css/style.css?raw'; // the game's stylesheet, so the spacing case measures the computed value
import { initSettingsTypo, mountTypoInside } from '../app/js/ui/settings-typo.js';
import { createTranslator } from '../app/js/core/i18n.js';
import { FONT_GROUPS, FONT_BY_KEY } from '../app/js/ui/fonts.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)

// A fake of platform/storage.ts (the same get/set shape), in memory.
function fakeStore(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { map: m, get: (k, fallback = null) => (m.has(k) ? m.get(k) : fallback), set: (k, v) => { m.set(k, String(v)); return true; } };
}

const $ = (sel) => document.querySelector(sel);

/**
 * A face planted in the catalogue that the device cannot have: `off`, with a key that resolves. The catalogue has none
 * since the ronde ended its stack in Cookie (ADR-0154), and the lock still has to be measured on a real list.
 */
const LOCKED = Object.freeze({ k: 'lockedtest', id: 'locked_test', fam: 'Locked Test Face', fb: 'sans', off: 'font.off.pending' });
function withLockedFace(fn) {
  const sans = FONT_GROUPS[0].items;
  sans.push(LOCKED);
  FONT_BY_KEY[LOCKED.k] = LOCKED;
  try { fn(); } finally {
    sans.splice(sans.indexOf(LOCKED), 1);
    delete FONT_BY_KEY[LOCKED.k];
  }
}

function fullCtx(over = {}) {
  const said = [];
  return {
    t: translate,
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
    expect(ctx.said).toHaveLength(0); // boot does not speak (announce=false)
  });

  it('[Interface] respeita a fonte persistida no store injetado ao montar', () => {
    const ctx = fullCtx({ store: fakeStore({ incl_font_k: 'lexend' }) });
    const api = initSettingsTypo(ctx);
    expect(api.getFontKey()).toBe('lexend');
    expect(document.documentElement.dataset.fonte).toBe('dislexia');
  });

  it('🔴 [Right] render() writes the list in the language of the ctx\'s `t`, never as a key (ADR-0232 D3)', () => {
    // The literal, so the case cannot pass by reading the same table the code reads: the group's name in pt.
    initSettingsTypo(fullCtx()).render();
    const list = $('#typo-list');
    const named = [...list.querySelectorAll('[aria-label]')].map((n) => n.getAttribute('aria-label'));
    expect(named, 'the group of faces has no name in the language of the ctx').toContain('Família de letra');
    expect([list.textContent, ...named].join(' | '), 'a raw key reached the list').not.toMatch(/\b(font|typo)\.[a-zA-Z]/);
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
    expect(api.getFontKey()).toBe('atkinson'); // unchanged
    expect(ctx.said).toHaveLength(0); // did not announce
  });

  it('[Boundary] botão de fonte .off nasce disabled (não clicável)', () => {
    const ctx = fullCtx();
    initSettingsTypo(ctx).render();
    // ⚠️ `kindergarten`, the `.off` entry with no file this case pointed at, left the roster (issue #87, item 3). What it
    // measures is the other half of the same rule: no CALLIGRAPHIC face is drawn in the menu — not disabled, ABSENT.
    //
    // The difference matters to whoever navigates by screen reader: a disabled button is still announced and still takes
    // a stop in the traversal. A face the child cannot use as the interface must not cost her a stop.
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
     * 🔴 THIS CASE WAS BORN FROM A SURVIVING MUTATION, and it is the most important of this change: putting `--ls` back at
     * 0.12em — WCAG §1.4.12's floor, the previous value — failed NOTHING. The number the Dev's whole decision moves was
     * pinned nowhere.
     *
     * 📏 The rule: 0.18em of letter and 0.63em of word spacing, the British Dyslexia Association's recommendation (word
     * ≥ 3.5× letter), on the DEFAULT face — the one every game draws —, not only under `[data-fonte="dislexia"]`.
     *
     * ⚠️ MEASURED ON THE COMPUTED VALUE and not on the file's text: what matters is what the browser resolves at the root,
     * which is where the cascade ends. Reading the CSS as a string would measure what I wrote, not what applies.
     */
    // 📌 THE SHEET GOES IN BY HAND, following the precedent of `the-stage-has-priority.browser.test.js`: the vitest
    // environment does not load the game's `style.css`, and without it everything answers `normal` — the vacuum case
    // below caught exactly that on the first round.
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
    // The vacuum case: without the sheet loaded, everything would be `normal` and both halves would pass for free.
    expect(padrao.ls, 'a folha de estilo não foi aplicada; o caso mediria o nada').not.toBe('normal');
    // 16px base × 0.18em = 2.88px; × 0.63em = 10.08px. Compared in px because that is what the computed value returns.
    expect(parseFloat(padrao.ls) / 16, 'o espaçamento de LETRA não é o da BDA').toBeCloseTo(0.18, 2);
    expect(parseFloat(padrao.ws) / 16, 'o espaçamento de PALAVRA não é o da BDA').toBeCloseTo(0.63, 2);

    // 🔴 And the cursive gives both back to `normal` — spacing a joined face breaks it at the joins.
    api.setFont('pwbr', false);
    // ⚠️ THE COMPUTED VALUE IS ASYMMETRIC, and that is the browser's, not the rule's: for `normal`, Chromium returns
    // `'normal'` in `letterSpacing` and `'0px'` in `wordSpacing`. Written expecting `'normal'` on both, the case failed
    // with the right CSS. What is asserted is «não há espaçamento extra», and that is what is measured.
    const cursiva = espaco();
    expect(cursiva.ls, 'a face ligada ficou com espaçamento de letra a partir-lhe os conectores').toBe('normal');
    expect(parseFloat(cursiva.ws) || 0, 'a face ligada ficou com espaçamento de palavra').toBe(0);

    /*
     * 🔴 AND THE SCALE OF THE COUNTRY'S HAND, in the same place and for the same reason: a mutation removing the `calc()`
     * from the `font-size` failed NOTHING — the rule that makes position (e) 25% larger was written and not pinned.
     *
     * 📏 16 px × 1.25 = 20 px, which is exactly the Playwrite faces' `minPx`. The number is not taste: below the floor the
     * face stops being DIFFICULT and becomes ILLEGIBLE, and the difficulty is the exercise while the illegibility is the
     * child giving up (ADR-0012 amendment).
     */
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
     * 🔴 It is the exception of ADR-0149 §3, and the mark is what removes the BDA spacing: spacing a cursive face breaks
     * it at the joins that make it cursive — «para manter os conectores», the Dev's words.
     *
     * ⚠️ AND THE SECOND HALF OF THE CASE IS WHAT MATTERS. Writing the mark without ERASING it would leave a child who
     * tried a cursive and went back to Atkinson with the READING face and no spacing at all — the defect in the costliest
     * direction, because whoever goes back to the reading face is exactly who needs it. A case measuring only the way
     * there would stay green with that half broken.
     */
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);

    api.setFont('pwbr', false);
    expect(document.documentElement.dataset.cursiva, 'a face ligada não marcou a excepção').toBe('1');

    api.setFont('atkinson', false);
    expect(document.documentElement.dataset.cursiva,
      'voltou para a face de leitura e ficou sem o espaçamento da BDA').toBeUndefined();
  });

  it('🔴 [Right] cada linha é desenhada NA PRÓPRIA face — é assim que se escolhe uma tipografia', () => {
    // Found by a probe on 22/09: deleting the label's `font-family` left the whole suite green. It is this menu's central
    // behaviour — a list of NAMES lets nobody choose a face, and whoever most needs to choose is whoever does not read
    // the current one well.
    const api = initSettingsTypo(fullCtx());
    api.render();
    for (const linha of $('#typo-list').querySelectorAll('.ctrl-row')) {
      const nome = linha.querySelector('strong').textContent;
      const rotulo = linha.querySelector('span');
      expect(rotulo.style.fontFamily.replace(/["']/g, ''), nome).toBe(nome);
    }
  });

  it('🔴 [Right] a escolhida traz ● e as outras ○ — porque COR não é estado', () => {
    // The module argues this in full (ADR-0012 amendment: the state in TWO forms, neither of them a colour), and nothing
    // pinned it: putting the same mark on every row passed green. Whoever cannot tell `is-on`'s yellow apart is left not
    // knowing which font is active.
    const api = initSettingsTypo(fullCtx());
    api.render();
    const botoes = [...$('#typo-list').querySelectorAll('button[data-font]')];
    const escolhida = botoes.filter((b) => b.dataset.font === api.getFontKey());
    expect(escolhida).toHaveLength(1);
    expect(escolhida[0].textContent.trim()).toBe('●');
    for (const b of botoes.filter((b) => b.dataset.font !== api.getFontKey())) {
      expect(b.textContent.trim(), b.dataset.font).toBe('○');
    }
  });

  it('🔴 [Right] uma face que a lista mostra cinzenta vem TRAVADA, e a nota vai no nome acessível', () => {
    // Two things the probe found green on the same row. A locked button that does not come `disabled` is a button that
    // does nothing while looking alive (ADR-0106 §5); and the note is what tells the educator WHOM that face serves —
    // without it in the `aria-label`, whoever cannot see the row hears only a strange name.
    // 📌 No catalogue face is `off` since the ronde ended its stack in Cookie (ADR-0154), so the lock is measured on a
    // PLANTED face: the mechanism stays for a face that cannot ship with a fallback.
    withLockedFace(() => {
      const api = initSettingsTypo(fullCtx());
      api.render();
      const cinzenta = $('#typo-list').querySelector(`button[data-font="${LOCKED.k}"]`);
      expect(cinzenta, 'the locked face must be on the list, grey and not hidden').not.toBeNull();
      expect(cinzenta.disabled).toBe(true);
    });
    const api = initSettingsTypo(fullCtx());
    api.render();
    const comNota = [...$('#typo-list').querySelectorAll('.ctrl-row')]
      .find((l) => l.querySelector('.opt-hint'));
    expect(comNota, 'alguma linha tem nota — senão este caso não mede nada').toBeTruthy();
    const nota = comNota.querySelector('.opt-hint').textContent;
    expect(comNota.querySelector('button').getAttribute('aria-label')).toContain(nota);
  });

  it('🔴 [Right] the ronde row is ENABLED, and its label draws in the whole stack down to Cookie (ADR-0154)', () => {
    const api = initSettingsTypo(fullCtx());
    api.render();
    const botao = $('#typo-list').querySelector('button[data-font="ronde"]');
    expect(botao, 'the ronde left the list').not.toBeNull();
    expect(botao.disabled, 'the ronde is locked again — Cookie answers on every device').toBe(false);
    const rotulo = botao.closest('.ctrl-row').querySelector(':scope > span');
    // the browser normalises the quotes; what matters is that each family is its own entry and Cookie is the last
    const valor = rotulo.style.fontFamily;
    expect(valor.replace(/["']/g, '')).toBe('Ronde Script, OPTIFrench-Script, Merveille, Cookie');
    expect(valor, 'the stack is ONE quoted name with commas inside — a family no browser has').not.toMatch(/["'][^"']*,[^"']*["']/);
  });

  it('[Many] montar duas vezes REETIQUETA em vez de duplicar — e os nós ficam os MESMOS', () => {
    // ⚠️ The reason is not thrift: redoing the row would leave a control in the document WITHOUT a listener — a dead
    // button that looks alive (ADR-0106 §5). This panel's listener is wired once, on the list, by delegation; if the nodes
    // were swapped it would survive, but the focus would drop at every click.
    const kit = { find: (s) => document.querySelector(s), create: (tag) => document.createElement(tag) };
    const lista = $('#typo-list');
    mountTypoInside(translate, kit, lista, 'atkinson');
    const antes = lista.querySelectorAll('.ctrl-row').length;
    const primeiro = lista.querySelector('button[data-font]');
    mountTypoInside(translate, kit, lista, 'andika');
    expect(lista.querySelectorAll('.ctrl-row')).toHaveLength(antes);
    expect(lista.querySelectorAll('[role="radiogroup"]')).toHaveLength(1);
    expect(lista.querySelector('button[data-font]'), 'o MESMO nó, ou a escuta perde o foco').toBe(primeiro);
  });

  it('⚠️ [Right] nenhum botão da lista é um INTERRUPTOR — o vocabulário todo é de escolha', () => {
    // 📌 The question moved here from `settings-typo.node.test.js` when the list became nodes: it is the same question,
    // answered where there is a document. `aria-pressed` is switch vocabulary, and the `switch` class draws a 52×28 px
    // toggle with a knob — the drawing of a state that does not exist here (ADR-0012 amendment).
    const api = initSettingsTypo(fullCtx());
    api.render();
    const lista = $('#typo-list');
    const activa = lista.querySelector(`button[data-font="${api.getFontKey()}"]`);
    expect(activa.getAttribute('aria-checked')).toBe('true');
    for (const b of lista.querySelectorAll('button[data-font]')) {
      expect(b.hasAttribute('aria-pressed'), b.dataset.font).toBe(false);
      expect(b.classList.contains('switch'), b.dataset.font).toBe(false);
      expect(b.getAttribute('role')).toBe('radio');
      if (b !== activa) expect(b.getAttribute('aria-checked'), b.dataset.font).toBe('false');
    }
  });

  it('🔴 [Right] as três famílias anunciam-se, e o grupo de rádio é UM só através delas', () => {
    // The heading vanishes without anyone noticing (probe of 22/09), and with it the information that the list has
    // families. ⚠️ And the radiogroup is ONE on purpose: the exclusivity belongs to the whole menu — one active font —,
    // and three groups would tell whoever listens that a sans AND a serif can be on at the same time.
    initSettingsTypo(fullCtx()).render();
    expect($('#typo-list').querySelectorAll('.panel-sub').length).toBeGreaterThanOrEqual(3);
    expect($('#typo-list').querySelectorAll('[role="radiogroup"]')).toHaveLength(1);
  });

  it('🔴 [Boundary] uma face que a lista recusa também é recusada por setFont — uma resposta, não três', () => {
    // The module says so: three answers to the same question drift. Deleting the `faceAvailable` from `setFont` passed
    // green, and the child would end up with a chosen face the device does not have. (A planted `off` face: no catalogue
    // face is `off` since ADR-0154.)
    withLockedFace(() => {
      const ctx = fullCtx();
      const api = initSettingsTypo(ctx);
      const antes = api.getFontKey();
      api.setFont(LOCKED.k, true);
      expect(api.getFontKey(), 'a face indisponível não pode virar a escolha').toBe(antes);
      expect(ctx.store.map.get('incl_font_k') ?? antes).toBe(antes);
    });
  });

  it('[Cross-check] render() sincroniza a família do #typo-preview com a fonte ativa', () => {
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);
    api.setFont('lexend', false);
    api.render();
    expect($('#typo-preview').style.fontFamily).toBe('Lexend'); // the browser normalises and strips the quotes from the computed value
  });

  it('[Boundary] `setFont` SOZINHO já move a pré-visualização — quem cicla pela barra não chama render', () => {
    // 📏 The preview's two writes (in `setFont` and in `render`) covered each other in the suite, and each looked like
    // the inert one while the other ran. Neither is: the bar's typography button cycles through `setFont` without
    // redrawing the panel, and this line is what makes the sample follow the choice.
    const api = initSettingsTypo(fullCtx());
    api.setFont('lexend', false);
    expect($('#typo-preview').style.fontFamily.replace(/["']/g, '')).toBe('Lexend');
  });

  it('[Boundary] a pré-visualização que NASCE depois do arranque também é alcançada pelo render', () => {
    // 📌 A probe of 22/09 left this line green, which made it look inert — `setFont` already writes the preview, and the
    // case above calls `setFont` before `render`. Measured: it is NOT inert. When the node is born after boot — which is
    // how a panel mounted in two steps behaves — `setFont` has already run against a document where it did not exist,
    // and `render` is the only one that still reaches it.
    document.body.innerHTML = '<div id="typo"><div id="typo-list"></div></div>';
    const api = initSettingsTypo(fullCtx());
    api.setFont('lexend', false);
    const pv = document.createElement('span');
    pv.id = 'typo-preview';
    $('#typo').appendChild(pv);
    api.render();
    expect(pv.style.fontFamily.replace(/["']/g, '')).toBe('Lexend');
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
    // The way back has to erase the trace of the way there. A "custom" font writes the property; if the reset swapped only
    // the data-fonte, the child would have the default declared and the previous font still drawn on screen.
    const ctx = fullCtx();
    const api = initSettingsTypo(ctx);
    api.setFont('pwbr', true); // a catalogue font → goes through --font-custom, not through a data-fonte of its own
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
    // The case that keeps the mark honest: a mark that only knew how to appear would end up on everything.
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
// THE EXPLANATION APPEARED TWICE — found by the Dev, 2026-08-27.
//
// «a explicação está duplicada no menu fonte, aparece no rodapé, o que é certo, mas também está aparecendo
//  embaixo do nome da fonte.»
//
// THE MECHANISM, and CLAUDE.md warns about it (§4): `fillExplain` takes the `.opt-hint` out of the row and moves it to
// the footer, rewriting the `<span>` to hold only the short label. It runs once, when the overlay is brought to the
// front.
//
// `render()` rebuilds the whole `#typo-list` — and is called AGAIN on every click on a font. The new rows come back with
// the `.opt-hint` inside, and nobody moves it again. Footer with the description (from the first pass) AND description
// under the font's name (from the redraw). Exactly what the Dev saw.
//
// CLAUDE.md §4 says it: a panel that re-renders has to call `fillExplain` on every render, or the prose goes back
// inside the rows at the first click. The warning was right and the typography panel was the one not obeying it.
//
// MUTATION CHECKED: removing the call at the end of `render()` makes this case fail.
describe('ui/settings-typo · a explicação FICA no rodapé, inclusive depois de escolher uma fonte', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="typo"><div class="overlay__card"><div id="typo-list"></div>' +
      '<span id="typo-preview"></span><button id="typo-reset" type="button">Restaurar</button></div></div>';
  });

  /** A minimal `fillExplain` with the behaviour that matters: it takes the `.opt-hint` out of the row. */
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
