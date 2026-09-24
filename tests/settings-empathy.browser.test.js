// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-empathy — render()/open()/close() (project BROWSER: usa document). Contrato: DI por
// closure (ctx.$/srSay/store/setters/getters/reflect-helpers), nenhum acesso a globais fora do ctx. A lógica pura
// (catálogo/rótulos) está coberta em settings-empathy.node.test.js. Modelo: tests/a11y-sr.browser.test.js,
// tests/settings-typo.browser.test.js.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initSettingsEmpathy, EMPATHY_VIZ_MODES } from '../app/js/ui/settings-empathy.js';
import { hearingLoss, setHearingLossGraph } from '../app/js/platform/audio.js';
// Os dois colaboradores REAIS do último bloco: quem reconstrói a lista e quem repõe a prosa no rodapé.
import { vizGroupHtml } from '../app/js/render/viz-setters.js';
import { initSettingsPanel } from '../app/js/ui/settings-panel.js';

const $ = (sel) => document.querySelector(sel);

// Fake de platform/storage.ts (só getBool, único método que o módulo usa).
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

  // `hearingLoss` vive em platform/audio, não no ctx: um caso que o liga e não devolve contamina todos os
  // seguintes, em silêncio e na ordem do arquivo. Foi assim que o [Zero] do reset abaixo falhou pela primeira
  // vez — acusando o código certo pelo estado que outro caso tinha deixado para trás.
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
    expect(ctx.calls.setHearingLoss).toHaveLength(0); // restauração usa o grafo direto, não o setter (não persiste/anuncia de novo)
    expect(hearingLoss).toBe(true);
    setHearingLossGraph(false); // DEVOLVE o grafo: `hearingLoss` é estado de MÓDULO, não do ctx
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

  // ---- "restaurar padrões deste menu" (ADR-0028) ----
  //
  // O caso que importa não é o reset funcionar: é ele NÃO ALCANÇAR FORA DE SI. Este menu é o mais perigoso dos
  // oito porque simula deficiências — a criança que liga "cegueira total" fica sem ver o botão que desliga —,
  // e é também o que tem a fronteira mais traiçoeira, porque a lista dele inclui três CORREÇÕES de daltonismo
  // que não têm outro lugar onde morar.
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
      // Se isto quebrar, o botão passou a tirar de uma criança daltônica a única correção que ela tem, a
      // mando do menu que existe para quem NÃO é daltônico. É a armadilha que o reset deveria desfazer,
      // instalada pelo próprio reset.
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
  // O beforeEach do arquivo monta só as regiões do leitor de tela; o painel vem do describe irmão. Sem isto,
  // `$('#opt-onebtn')` é null e o caso falha por falta de fixture, não por falta de marca.
  beforeEach(() => { document.body.innerHTML = EMPATHY_HTML + '<p id="sr-status"></p><p id="sr-alert"></p>'; });
  // Neste menu a marca quer dizer "esta simulação está LIGADA", e é a mais útil dos sete: a criança que ligou
  // a simulação de cegueira está com a tela preta e não lê nada — mas o leitor de tela percorre o menu e diz
  // qual linha saiu do padrão. Os casos CLICAM porque estes dois setters não passam por render().
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
// ⚠️ A PROSA FICA NO RODAPÉ MESMO QUANDO A LISTA É RECONSTRUÍDA POR PROCURAÇÃO (CLAUDE.md §4, #109, #62)
//
// Os casos acima injetam um `renderVizGroup` que só ANOTA a chamada — e é por isso que nenhum deles podia ver
// este defeito: um dublê que não reconstrói não desfaz nada. Aqui o reconstrutor é o `vizGroupHtml` DE
// VERDADE e o `fillExplain` é o do `ui/settings-panel` DE VERDADE, porque o defeito vive exatamente no
// encontro dos dois.
//
// A sequência é a da criança: abre o painel (o `frontOverlay` limpa as linhas), clica numa simulação — e o
// clique chama `render()` outra vez, que manda o `renderVizGroup` reescrever a lista com `innerHTML`. As
// linhas novas vêm com o `.opt-hint` lá dentro e SEM o `data-explain-done`, então a prosa reaparece sob cada
// rótulo e o menu volta a ser o manual que a decisão de 2026-08-25 proibiu.
//
// ⚠️ É o pior painel para isso acontecer: quem acabou de ligar "Simular cegueira total" está com a tela preta
// e depende do rodapé `aria-live` para saber onde está.
//
// MUTAÇÕES CONFERIDAS (no fim do bloco).
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

  /** O painel com os DOIS colaboradores reais: quem reconstrói e quem repõe. */
  function bootReal() {
    document.body.innerHTML = COM_CARTAO;
    const painel = initSettingsPanel({
      $, $$: (sel) => [...document.querySelectorAll(sel)],
      doc: document,
      computedZ: (el) => +getComputedStyle(el).zIndex || 0,
    });
    const ctx = fullCtx({
      // O reconstrutor DE VERDADE, na forma exata do `render/viz-setters`: `el.innerHTML = vizGroupHtml(…)`.
      renderVizGroup: (listSel, _tabsSel, modes) => {
        const el = $(listSel);
        if (el) el.innerHTML = vizGroupHtml(modes, 'normal');
      },
      frontOverlay: (el) => painel.frontOverlay(el),
      fillExplain: (card) => painel.fillExplain(card),
    });
    return { api: initSettingsEmpathy(ctx), ctx, painel };
  }

  /**
   * As dicas VISÍVEIS dentro da lista.
   *
   * 📌 Contava TODAS até 2026-09-23, quando o `fillExplain` deixou de APAGAR a dica e passou a ESCONDÊ-LA: guardar o nó é o
   * que dá ao produtor onde escrever a língua nova (ADR-0225), e `hidden` é o que a tira da árvore de acessibilidade. A
   * regra que estes casos sempre mediram é «a prosa não volta para JUNTO do rótulo», e é essa que fica aqui.
   */
  const dicasNaLista = () => [...document.querySelectorAll('#empathy-list .opt-hint')].filter((d) => !d.hidden).length;

  it('⚠️ [Cross-check] o construtor da lista EMITE `.opt-hint` — sem isto, tudo abaixo seria vazio', () => {
    // Um caso que conta zero `.opt-hint` fica verde de graça se o construtor nunca emitir nenhum. Este ancora
    // a premissa no gerador de verdade, e é ele que reprova se o `vizGroupHtml` mudar de forma.
    const html = vizGroupHtml(EMPATHY_VIZ_MODES, 'normal');
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
    api.render(); // o caminho do clique: setPlayerViz → renderEmpathyPanel → render()
    expect(dicasNaLista(), 'a prosa voltou para dentro das linhas no primeiro clique').toBe(0);
    // E a linha continua a saber a sua descrição — quem foi limpo foi o markup, não a informação.
    const primeira = $('#empathy-list .ctrl-row');
    expect(primeira?.dataset.explain, 'a linha nova ficou sem descrição no rodapé').toBeTruthy();
  });

  it('[Boundary] as linhas que este painel NÃO reconstrói continuam limpas depois do redesenho', () => {
    // As três de perda auditiva/um botão/cadeirante vivem no cartão e só mudam de `textContent`: elas
    // atravessam o redesenho reduzidas ao rótulo curto, como o `fillExplain` as deixou na abertura.
    //
    // O que este caso separa é o ALCANCE do conserto. `render()` chama o `fillExplain` sobre o CARTÃO
    // inteiro, e não só sobre `#empathy-list` — o que é certo, porque o `.opt-explain` é do cartão. Se essa
    // segunda passada mexesse nas linhas que ninguém reconstruiu, o conserto teria efeito fora do sítio,
    // e é isso que aqui se afere.
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

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · apagando `ctx.fillExplain?.(…)` do fim de `render()` em `ui/settings-empathy` → "[Exercise]
//     RE-RENDERIZAR" reprova com 9 `.opt-hint` de volta dentro das linhas (uma por simulação do catálogo).
//     É o defeito da #109 pela terceira vez, e é o que o gate de fonte `painel-reexplica` deixava passar.
//   · movendo a chamada para ANTES de `ctx.renderVizGroup(…)` → "[Exercise]" reprova igual: o `fillExplain`
//     limpa linhas que o reconstrutor ainda vai substituir. A ordem é a asserção.
//   · tirando o `class="opt-hint"` do `vizGroupHtml` (`render/viz-setters`) → "[Cross-check]" reprova, que é
//     o ponto dele: um caso que conta zero não pode ficar verde por não haver o que contar.
//   · ⚠️ trocando `if (row.dataset.explainDone) return;` por `if (false) return;` no `fillExplain`
//     (`ui/settings-panel`) → NENHUM caso reprova, e a previsão de que o "[Boundary]" reprovaria estava
//     ERRADA. Medido: o `fillExplain` é idempotente DUAS vezes — pela bandeira e pelo conteúdo. Na segunda
//     passada a linha já teve o `<span>` reduzido ao `<strong>`, então `rowExplainText` devolve cadeia vazia
//     e o `if (!desc) return;` guarda o resto. A bandeira poupa trabalho; não é ela que preserva a linha.
//     Fica registado em vez de escondido: quem quiser prender a bandeira precisa de um caso que conte
//     PASSAGENS, e nenhum aqui conta.
