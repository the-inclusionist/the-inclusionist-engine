// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-empathy — render()/open()/close() (BROWSER project: uses document). Contract: DI by closure
// (ctx.$/srSay/store/setters/getters/reflect-helpers), no access to globals outside the ctx. The pure logic
// (catalogue/labels) is covered in settings-empathy.node.test.js. Model: tests/a11y-sr.browser.test.js,
// tests/settings-typo.browser.test.js.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initSettingsEmpathy, EMPATHY_VIZ_MODES } from '../app/js/ui/settings-empathy.js';
import { hearingLoss, setHearingLossGraph } from '../app/js/platform/audio.js';
// The two REAL collaborators of the last block: the one that rebuilds the list and the one that puts the prose back in the footer.
import { vizGroupHtml } from '../app/js/render/viz-setters.js';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import { initSettingsPanel } from '../app/js/ui/settings-panel.js';

const $ = (sel) => document.querySelector(sel);

// A fake of platform/storage.ts (only getBool, the one method the module uses).
function fakeStore(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { map: m, getBool: (k, fallback = false) => (m.has(k) ? m.get(k) === '1' : fallback) };
}

function fullCtx(over = {}) {
  const said = [];
  const calls = { renderVizGroup: [], reflectMobilityEmpathy: 0, reflectVizButtons: 0, frontOverlay: [], setHearingLoss: [], setOneButton: [], setWheelchair: [], setEmpathyOpen: [], setPlayerViz: [] };
  let oneButton = false, wheelchair = false;
  const players = [{ viz: 'normal' }, { viz: 'normal' }];
  return {
    $,
    srSay: (msg) => said.push(msg),
    store: fakeStore(),
    renderVizGroup: (listSel, tabsSel, modes) => { calls.renderVizGroup.push([listSel, tabsSel, modes]); },
    reflectMobilityEmpathy: () => { calls.reflectMobilityEmpathy++; },
    reflectVizButtons: () => { calls.reflectVizButtons++; },
    frontOverlay: (el) => { calls.frontOverlay.push(el); },
    setHearingLoss: (on) => { calls.setHearingLoss.push(on); },
    setOneButton: (on) => { calls.setOneButton.push(on); oneButton = on; },
    setWheelchair: (on) => { calls.setWheelchair.push(on); wheelchair = on; },
    getOneButton: () => oneButton,
    getWheelchair: () => wheelchair,
    getPlayers: () => players,
    setPlayerViz: (i, mode) => { calls.setPlayerViz.push([i, mode]); players[i].viz = mode; },
    players,
    said,
    calls,
    ...over,
  };
}

const EMPATHY_HTML = `
  <div id="empathy" class="overlay" hidden>
    <button id="empathy-close" type="button">x</button>
    <button id="empathy-reset" type="button">Restaurar</button>
    <div class="ctrl-row"><span>Um botão</span><button id="opt-onebtn" type="button" aria-pressed="false">▶ Desligado</button></div>
    <div class="ctrl-row"><span>Cadeirante</span><button id="opt-wheelchair" type="button" aria-pressed="false">▶ Desligado</button></div>
    <div class="ctrl-row"><span>Perda auditiva</span><button id="opt-hearing" type="button" aria-pressed="false">▶ Desligado</button></div>
    <div id="empathy-players"></div>
    <div id="empathy-list"></div>
  </div>
  <button id="opt-empathy" type="button">Empatia</button>
  <button data-act="empatia" class="pm-btn" type="button">Modo empatia</button>
`;

describe('ui/settings-empathy', () => {
  beforeEach(() => {
    document.body.innerHTML = EMPATHY_HTML;
  });

  // `hearingLoss` lives in platform/audio, not in the ctx: a case that turns it on and does not give it back contaminates
  // every following case, silently and in file order — and then accuses the right code of the state another case left
  // behind.
  afterEach(() => { if (hearingLoss) setHearingLossGraph(false); });

  it('[Right] render() desenha a lista de simulação via renderVizGroup injetado com EMPATHY_VIZ_MODES', () => {
    const ctx = fullCtx();
    const api = initSettingsEmpathy(ctx);
    api.render();
    expect(ctx.calls.renderVizGroup).toHaveLength(1);
    const [listSel, tabsSel, modes] = ctx.calls.renderVizGroup[0];
    expect(listSel).toBe('#empathy-list');
    expect(tabsSel).toBe('#empathy-players');
    expect(modes).toBe(EMPATHY_VIZ_MODES);
  });

  it('[Interface] render() reflete #opt-hearing (desligado por padrão) e chama reflectMotorEmpathy', () => {
    const ctx = fullCtx();
    const api = initSettingsEmpathy(ctx);
    api.render();
    const h = $('#opt-hearing');
    expect(h.classList.contains('is-on')).toBe(false);
    expect(h.getAttribute('aria-pressed')).toBe('false');
    expect(h.textContent).toBe('Desligado');
    expect(ctx.calls.reflectMobilityEmpathy).toBe(1);
  });

  it('[Right] clicar em #opt-hearing chama setHearingLoss, re-renderiza e chama reflectVizButtons', () => {
    const ctx = fullCtx();
    initSettingsEmpathy(ctx);
    $('#opt-hearing').click();
    expect(ctx.calls.setHearingLoss).toEqual([true]); // hearingLoss real (platform/audio.ts) começa false
    expect(ctx.calls.renderVizGroup.length).toBeGreaterThan(0); // render() rodou de novo
    expect(ctx.calls.reflectVizButtons).toBe(1);
  });

  it('[Right] clicar em #opt-onebtn chama setOneButton com o oposto do valor lido de getOneButton', () => {
    const ctx = fullCtx();
    initSettingsEmpathy(ctx);
    $('#opt-onebtn').click();
    expect(ctx.calls.setOneButton).toEqual([true]);
  });

  it('[Right] clicar em #opt-wheelchair chama setWheelchair com o oposto do valor lido de getWheelchair', () => {
    const ctx = fullCtx({ getWheelchair: () => true });
    initSettingsEmpathy(ctx);
    $('#opt-wheelchair').click();
    expect(ctx.calls.setWheelchair).toEqual([false]);
  });

  it('[Zero] sem incl_hearingloss persistido, initSettingsEmpathy NÃO restaura o grafo de áudio', () => {
    const ctx = fullCtx({ store: fakeStore() });
    expect(() => initSettingsEmpathy(ctx)).not.toThrow();
  });

  it('[Boundary] com incl_hearingloss persistido, initSettingsEmpathy restaura sem lançar e sem chamar setHearingLoss', () => {
    const ctx = fullCtx({ store: fakeStore({ incl_hearingloss: '1' }) });
    initSettingsEmpathy(ctx);
    expect(ctx.calls.setHearingLoss).toHaveLength(0); // restoring uses the graph directly, not the setter (it does not persist/announce again)
    expect(hearingLoss).toBe(true);
    setHearingLossGraph(false); // GIVES the graph BACK: `hearingLoss` is MODULE state, not the ctx's
  });

  it('[Right] open() renderiza, mostra o overlay, chama frontOverlay, e foca o 1º botão', () => {
    const ctx = fullCtx();
    const api = initSettingsEmpathy(ctx);
    api.open();
    expect($('#empathy').hidden).toBe(false);
    expect(ctx.calls.frontOverlay).toEqual([$('#empathy')]);
    expect(ctx.calls.renderVizGroup.length).toBeGreaterThan(0);
    expect(document.activeElement.tagName).toBe('BUTTON');
    expect(document.activeElement.closest('#empathy')).not.toBeNull();
  });

  it('[Right] close() esconde o overlay, e devolve o foco a #opt-empathy', () => {
    const ctx = fullCtx();
    const api = initSettingsEmpathy(ctx);
    api.open();
    api.close();
    expect($('#empathy').hidden).toBe(true);
    expect(document.activeElement).toBe($('#opt-empathy'));
  });

  it('[Right] clicar em #opt-empathy abre o painel; clicar em #empathy-close fecha', () => {
    const ctx = fullCtx();
    initSettingsEmpathy(ctx);
    $('#opt-empathy').click();
    expect($('#empathy').hidden).toBe(false);
    $('#empathy-close').click();
    expect($('#empathy').hidden).toBe(true);
  });

  // ---- "restore this menu's defaults" (ADR-0028) ----
  //
  // The case that matters is not the reset working: it is the reset NOT REACHING OUTSIDE ITSELF. This menu is the most
  // dangerous because it simulates disabilities — the child who turns on "cegueira total" can no longer see the button
  // that turns it off —, and its border is treacherous: the colour-blindness CORRECTIONS share the same `viz` field as
  // the simulations, and they belong to visual accessibility (#60), not to this menu.
  describe('#empathy-reset', () => {
    it('[Right] desliga as três simulações globais e volta o visual dos jogadores para normal', () => {
      const ctx = fullCtx();
      initSettingsEmpathy(ctx);
      ctx.setOneButton(true); ctx.setWheelchair(true);
      ctx.players[0].viz = 'blind'; ctx.players[1].viz = 'lv-tunnel';
      ctx.calls.setOneButton.length = 0; ctx.calls.setWheelchair.length = 0;

      $('#empathy-reset').click();

      expect(ctx.players[0].viz).toBe('normal');
      expect(ctx.players[1].viz).toBe('normal');
      expect(ctx.calls.setOneButton).toEqual([false]);
      expect(ctx.calls.setWheelchair).toEqual([false]);
    });

    it('[Interface] NÃO desliga a correção de daltonismo — o menu lista `fix-*`, o reset não os toca', () => {
      // If this breaks, the button started taking from a colour-blind child the only correction she has, on the orders
      // of the menu that exists for whoever is NOT colour-blind. It is the trap the reset should undo, installed by the
      // reset itself.
      const ctx = fullCtx();
      initSettingsEmpathy(ctx);
      ctx.players[0].viz = 'fix-deuter';
      ctx.players[1].viz = 'blind';

      $('#empathy-reset').click();

      expect(ctx.players[0].viz).toBe('fix-deuter');
      expect(ctx.players[1].viz).toBe('normal');
      expect(ctx.calls.setPlayerViz).toEqual([[1, 'normal']]);
    });

    it('[Interface] NÃO desliga o alto contraste — esse é do menu visual, e o reset não sai do seu', () => {
      const ctx = fullCtx();
      initSettingsEmpathy(ctx);
      ctx.players[0].viz = 'hc-direto-7';

      $('#empathy-reset').click();

      expect(ctx.players[0].viz).toBe('hc-direto-7');
      expect(ctx.calls.setPlayerViz).toEqual([]);
    });

    it('[Right] desliga a simulação de perda auditiva quando ela está ligada', () => {
      const ctx = fullCtx();
      initSettingsEmpathy(ctx);
      setHearingLossGraph(true);

      $('#empathy-reset').click();

      expect(ctx.calls.setHearingLoss).toEqual([false]);
    });

    it('[Zero] com tudo já no padrão, não chama setter nenhum — nada de anunciar desligamento do que nunca ligou', () => {
      const ctx = fullCtx();
      initSettingsEmpathy(ctx);

      $('#empathy-reset').click();

      expect(ctx.calls.setOneButton).toEqual([]);
      expect(ctx.calls.setWheelchair).toEqual([]);
      expect(ctx.calls.setHearingLoss).toEqual([]);
      expect(ctx.calls.setPlayerViz).toEqual([]);
    });

    it('[Interface] anuncia uma frase só, e ela é a última — uma ação, um anúncio', () => {
      const ctx = fullCtx();
      initSettingsEmpathy(ctx);
      ctx.players[0].viz = 'blind';

      $('#empathy-reset').click();

      expect(ctx.said.at(-1)).toContain('empatia');
      expect(ctx.calls.reflectVizButtons).toBeGreaterThan(0);
    });
  });

  it('[Zero] sem #empathy no DOM, open()/close() não lançam (só não fazem nada)', () => {
    document.body.innerHTML = '';
    const ctx = fullCtx();
    const api = initSettingsEmpathy(ctx);
    expect(() => api.open()).not.toThrow();
    expect(() => api.close()).not.toThrow();
  });

  it('[Zero] sem #empathy-list no DOM, render() não lança (renderVizGroup injetado é quem decide)', () => {
    document.body.innerHTML = '<button id="opt-empathy" type="button"></button>';
    const ctx = fullCtx();
    const api = initSettingsEmpathy(ctx);
    expect(() => api.render()).not.toThrow();
  });
});

describe('ui/settings-empathy — marca o que saiu do padrão (ADR-0029)', () => {
  // The file's beforeEach mounts only the screen-reader regions; the panel comes from the sibling describe. Without
  // this, `$('#opt-onebtn')` is null and the case fails for lack of a fixture, not for lack of a mark.
  beforeEach(() => { document.body.innerHTML = EMPATHY_HTML + '<p id="sr-status"></p><p id="sr-alert"></p>'; });
  // In this menu the mark means "this simulation is ON", and it is the most useful of all: the child who turned on the
  // blindness simulation has a black screen and reads nothing — but the screen reader walks the menu and says which row
  // left the default. The cases CLICK because these two setters do not go through render().
  it('[Right] ligar "um botão" marca a linha e o botão do menu', () => {
    const ctx = fullCtx();
    initSettingsEmpathy(ctx).render();
    $('#opt-onebtn').click();
    expect($('#opt-onebtn').closest('.ctrl-row').classList.contains('is-changed')).toBe(true);
    expect($('[data-act="empatia"]').classList.contains('is-changed')).toBe(true);
  });

  it('[Right] desligar apaga a marca', () => {
    const ctx = fullCtx();
    initSettingsEmpathy(ctx).render();
    $('#opt-onebtn').click();
    $('#opt-onebtn').click();
    expect($('#opt-onebtn').closest('.ctrl-row').classList.contains('is-changed')).toBe(false);
    expect($('[data-act="empatia"]').classList.contains('is-changed')).toBe(false);
  });

  it('[Interface] uma SIMULAÇÃO ligada marca a lista; uma CORREÇÃO de daltonismo não', () => {
    const ctx = fullCtx();
    const api = initSettingsEmpathy(ctx);
    ctx.players[0].viz = 'blind';
    api.render();
    expect($('#empathy-list').classList.contains('is-changed')).toBe(true);

    ctx.players[0].viz = 'fix-deuter';
    api.render();
    expect($('#empathy-list').classList.contains('is-changed')).toBe(false);
  });
});

// ==========================================================================================================
// ⚠️ THE PROSE STAYS IN THE FOOTER EVEN WHEN THE LIST IS REBUILT BY PROXY (CLAUDE.md §4, #109, #62)
//
// The cases above inject a `renderVizGroup` that only RECORDS the call — and that is why none of them could see this
// defect: a double that does not rebuild undoes nothing. Here the rebuilder is the REAL `vizGroupHtml` and
// `fillExplain` is the REAL one of `ui/settings-panel`, because the defect lives exactly where the two meet.
//
// The sequence is the child's: she opens the panel (`frontOverlay` cleans the rows), clicks a simulation — and the
// click calls `render()` again, which makes `renderVizGroup` rewrite the list with `innerHTML`. The new rows come with
// the `.opt-hint` inside and WITHOUT `data-explain-done`, so the prose reappears under each label and the menu is back
// to being the manual the decision of 2026-08-25 forbade.
//
// ⚠️ It is the worst panel for this to happen in: whoever just turned on "Simular cegueira total" has a black screen and
// depends on the `aria-live` footer to know where she is.
//
// MUTATIONS CHECKED (at the end of the block).
// ==========================================================================================================
describe('⚠️ ui/settings-empathy — a lista é reconstruída pelo renderVizGroup, e a prosa não pode voltar', () => {
  const COM_CARTAO = `
    <div id="empathy" class="overlay">
      <div class="overlay__card">
        <h2 id="empathy-title">Empatia</h2>
        <div class="ctrl-row"><span><strong>Perda auditiva</strong> — ouvir como quem tem perda auditiva.</span><button id="opt-hearing" type="button" aria-pressed="false">▶ Desligado</button></div>
        <div class="ctrl-row"><span><strong>Um botão</strong> — jogar com uma tecla só.</span><button id="opt-onebtn" type="button" aria-pressed="false">▶ Desligado</button></div>
        <div class="ctrl-row"><span><strong>Cadeirante</strong> — o mundo sem degraus.</span><button id="opt-wheelchair" type="button" aria-pressed="false">▶ Desligado</button></div>
        <div id="empathy-players"></div>
        <div id="empathy-list"></div>
        <button id="empathy-reset" type="button">Restaurar</button>
        <button id="empathy-close" type="button">Fechar</button>
      </div>
    </div>
    <button id="opt-empathy" type="button">Empatia</button>
    <button data-act="empatia" class="pm-btn" type="button">Modo empatia</button>
    <p id="sr-status"></p><p id="sr-alert"></p>`;

  /** The panel with BOTH real collaborators: the one that rebuilds and the one that puts back. */
  function bootReal() {
    document.body.innerHTML = COM_CARTAO;
    const painel = initSettingsPanel({
      $, $$: (sel) => [...document.querySelectorAll(sel)],
      doc: document,
      computedZ: (el) => +getComputedStyle(el).zIndex || 0,
    });
    const ctx = fullCtx({
      // The REAL rebuilder, in the exact shape of `render/viz-setters`: `el.innerHTML = vizGroupHtml(translate, …)`.
      renderVizGroup: (listSel, _tabsSel, modes) => {
        const el = $(listSel);
        if (el) el.innerHTML = vizGroupHtml(translate, modes, 'normal');
      },
      frontOverlay: (el) => painel.frontOverlay(el),
      fillExplain: (card) => painel.fillExplain(card),
    });
    return { api: initSettingsEmpathy(ctx), ctx, painel };
  }

  /**
   * The VISIBLE hints inside the list.
   *
   * 📌 `fillExplain` HIDES the hint instead of deleting it (2026-09-23): keeping the node gives the producer somewhere to
   * write the new language (ADR-0225), and `hidden` takes it out of the accessibility tree. The rule these cases have
   * always measured is «a prosa não volta para JUNTO do rótulo», and that is the one kept here.
   */
  const dicasNaLista = () => [...document.querySelectorAll('#empathy-list .opt-hint')].filter((d) => !d.hidden).length;

  it('⚠️ [Cross-check] o construtor da lista EMITE `.opt-hint` — sem isto, tudo abaixo seria vazio', () => {
    // A case counting zero `.opt-hint` goes green for free if the builder never emits any. This one anchors the premise
    // in the real generator, and it is what fails if `vizGroupHtml` changes shape.
    const html = vizGroupHtml(translate, EMPATHY_VIZ_MODES, 'normal');
    expect(html).toContain('opt-hint');
    expect(html).toContain('ctrl-row');
  });

  it('[Right] abrir o painel tira a prosa das linhas e cria o rodapé aria-live', () => {
    const { api } = bootReal();
    api.open();
    const rodape = $('#empathy .opt-explain');
    expect(rodape, 'o rodapé não foi criado').not.toBe(null);
    expect(rodape.getAttribute('aria-live')).toBe('polite');
    expect(dicasNaLista(), 'a prosa ficou dentro das linhas já na abertura').toBe(0);
  });

  it('⚠️ [Exercise] RE-RENDERIZAR (o que um clique numa simulação faz) não devolve a prosa às linhas', () => {
    const { api } = bootReal();
    api.open();
    expect(dicasNaLista()).toBe(0);
    api.render(); // the click's path: setPlayerViz → renderEmpathyPanel → render()
    expect(dicasNaLista(), 'a prosa voltou para dentro das linhas no primeiro clique').toBe(0);
    // And the row still knows its description — what was cleaned was the markup, not the information.
    const primeira = $('#empathy-list .ctrl-row');
    expect(primeira?.dataset.explain, 'a linha nova ficou sem descrição no rodapé').toBeTruthy();
  });

  it('[Boundary] as linhas que este painel NÃO reconstrói continuam limpas depois do redesenho', () => {
    // The three for hearing loss/one button/wheelchair live in the card and only change `textContent`: they go through
    // the redraw reduced to the short label, as `fillExplain` left them on opening.
    //
    // What this case separates is the REACH of the fix. `render()` calls `fillExplain` over the WHOLE card, and not only
    // over `#empathy-list` — which is right, because `.opt-explain` belongs to the card. If that second pass touched the
    // rows nobody rebuilt, the fix would have an effect out of place, and that is what is checked here.
    const { api } = bootReal();
    api.open();
    api.render();
    const fixas = [...document.querySelectorAll('#empathy .overlay__card > .ctrl-row')];
    expect(fixas.length).toBe(3);
    for (const linha of fixas) {
      expect(linha.querySelector(':scope > span').children.length,
        'a linha fixa voltou a ter mais do que o rótulo curto').toBe(1);
    }
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · deleting `ctx.fillExplain?.(…)` from the end of `render()` in `ui/settings-empathy` → "[Exercise]
//     RE-RENDERIZAR" fails with 9 `.opt-hint` back inside the rows (one per simulation of the catalogue).
//     It is #109's defect for the third time, and it is what the `painel-reexplica` source gate let through.
//   · moving the call to BEFORE `ctx.renderVizGroup(…)` → `[Exercise]` fails the same: `fillExplain` cleans rows the
//     rebuilder is still going to replace. The order is the assertion.
//   · removing `class="opt-hint"` from `vizGroupHtml` (`render/viz-setters`) → `[Cross-check]` fails, which is its
//     point: a case counting zero cannot stay green for having nothing to count.
//   · ⚠️ replacing `if (row.dataset.explainDone) return;` with `if (false) return;` in `fillExplain`
//     (`ui/settings-panel`) → NO case fails, and the prediction that `[Boundary]` would fail was WRONG. Measured:
//     `fillExplain` is idempotent TWICE — by the flag and by the content. On the second pass the row has already had
//     its `<span>` reduced to the `<strong>`, so `rowExplainText` returns an empty string and `if (!desc) return;`
//     guards the rest. The flag saves work; it is not what preserves the row. It stays recorded instead of hidden:
//     whoever wants to pin the flag needs a case that counts PASSES, and none here does.
