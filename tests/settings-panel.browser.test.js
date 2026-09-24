// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-panel — o que SÓ o navegador prova (project BROWSER): foco de verdade
// (document.activeElement), z-index EFETIVO (getComputedStyle) e os seletores CSS reais (`:scope > span`,
// `#game-region .overlay`). A lógica pura e o registro estão cobertos em settings-panel.node.test.js.
//
// Aqui a casca é exercitada COMPOSTA com dois painéis REAIS que já trazem o seu próprio open/close
// (ui/settings-motion → #animation e ui/settings-empathy → #empathy): é assim que o game.js os usa, e é a
// única forma de provar de ponta a ponta o requisito de acessibilidade — abrir foca um controle DENTRO do
// diálogo, fechar devolve o foco ao botão que abriu, e Escape fecha UM diálogo só.
import { describe, it, expect, beforeEach } from 'vitest';
import { t } from '../app/js/core/i18n.js';
import { initSettingsPanel, EXPLAIN_IDLE } from '../app/js/ui/settings-panel.js';
import { initSettingsMotion, setSelectedPlayer } from '../app/js/ui/settings-motion.js';
import { initSettingsEmpathy } from '../app/js/ui/settings-empathy.js';
/*
 * 🔴 A RODADA É UM DUPLO LOCAL desde o ADR-0228: `core/run-state` foi com a pilha de mundo-de-tiles para o
 * `game-platformer`. Este ficheiro nunca testou a rodada — ele PASSA uma ao que está a medir —, e os três
 * membros abaixo são exactamente os que ele lê. Fábrica e não literal: duas rodadas têm de ser dois objectos.
 */
const createRunState = () => ({ numPlayers: 1, players: [], setNumPlayers(n) { this.numPlayers = n; } });
// A RODADA é local a este arquivo desde 2026-08-26 (ADR-0038, Fase B): `players`/`numPlayers` deixaram de
// ser `let` de `core/state` e passaram a viver na instância que a raiz de composição possui. Aqui o teste
// cria a sua, e os apelidos abaixo mantêm o corpo dos casos escrito como sempre esteve.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);


const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function panelCtx() {
  return { $, $$, doc: document, computedZ: (el) => Number(getComputedStyle(el).zIndex) || 0 };
}

// Marcação enxuta mas FIEL ao index.html no que importa aqui: os diálogos vivem dentro do #game-region
// (o inCanvasMenus() os reparenta pra lá), cada um tem um .overlay__card com role/aria-modal, e o botão que
// abre (#opt-*) fica FORA do diálogo — é para ele que o foco tem de voltar.
const MARKUP = `
  <div id="game-region">
    <div id="animation" class="overlay" hidden>
      <div class="overlay__card" role="dialog" aria-modal="true" aria-labelledby="animation-title">
        <h2 id="animation-title">Movimento</h2>
        <div id="animation-players"></div>
        <button id="motion-master" type="button">⏸ Parar todas as animações</button>
        <div id="motion-list"></div>
      </div>
    </div>
    <div id="empathy" class="overlay" hidden>
      <div class="overlay__card" role="dialog" aria-modal="true" aria-labelledby="empathy-title">
        <h2 id="empathy-title">Empatia</h2>
        <div id="empathy-players"></div>
        <div id="empathy-list"></div>
        <button id="opt-hearing" type="button" aria-pressed="false">▶ Desligado</button>
        <button id="opt-onebtn" type="button" aria-pressed="false">▶ Desligado</button>
        <button id="opt-wheelchair" type="button" aria-pressed="false">▶ Desligado</button>
        <button id="empathy-close" type="button">Fechar</button>
      </div>
    </div>
  </div>
  <button id="opt-animation" type="button">Movimento</button>
  <button id="opt-empathy" type="button">Empatia</button>
`;

const RM_KEYS = ['parallax', 'decor', 'items', 'particles'];
const RM_CHAR = [
  { prop: 'rmWalk', lbl: 'Personagem em movimento' },
  { prop: 'rmBreath', lbl: 'Respiração (parado)' },
  { prop: 'rmFlavor', lbl: 'Gracinhas' },
];

/** Monta a casca + os dois painéis reais e os registra na MESMA ordem do encadeamento do game.js. */
function boot() {
  const panel = initSettingsPanel(panelCtx());
  const noop = () => {};
  const motion = initSettingsMotion({
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    $, srSay: noop, store: { setBool: noop }, frontOverlay: panel.frontOverlay, restoreFocus: panel.restoreFocus,
    toggleBtn: (el, on) => { el.classList.toggle('is-on', on); el.setAttribute('aria-pressed', String(on)); },
    rm: { parallax: false, decor: false, items: false, particles: false }, saveRM: noop,
    rmKeys: RM_KEYS, rmChar: RM_CHAR,
  });
  const empathy = initSettingsEmpathy({
    $, srSay: noop, store: { getBool: () => false },
    renderVizGroup: noop, reflectMobilityEmpathy: noop, reflectVizButtons: noop,
    frontOverlay: panel.frontOverlay, restoreFocus: panel.restoreFocus,
    setHearingLoss: noop, setOneButton: noop, setWheelchair: noop,
    getOneButton: () => false, getWheelchair: () => false,
    // Exigidos desde que o painel passou a marcar o que saiu do padrão (ADR-0029). `tsc` não pegou a falta
    // porque este arquivo é JavaScript — o mesmo motivo pelo qual o `main.js` já escapou de três contratos hoje.
    getPlayers: () => [], setPlayerViz: noop,
  });
  panel.register('animation', { close: motion.close, inEscapeChain: true });
  panel.register('empathy', { close: empathy.close, inEscapeChain: true });
  return { panel, motion, empathy };
}

beforeEach(() => {
  document.body.innerHTML = MARKUP;
  players.length = 0;
  players.push({ rmWalk: false, rmBreath: false, rmFlavor: false });
  setNumPlayersValue(1);
  setSelectedPlayer(0);
  $('#opt-animation').focus(); // um foco conhecido antes de cada cenário
});

describe('casca + painéis reais — foco ao abrir e ao fechar', () => {
  it('[Right] abrir foca um controle DENTRO do diálogo (o hidden=false precisa vir antes do focus)', () => {
    const { motion } = boot();
    motion.open();
    expect($('#animation').hidden).toBe(false);
    expect($('#animation').contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe($('#motion-master'));
  });

  it('[Right] fechar devolve o foco ao botão que abriu (#opt-animation)', () => {
    const { motion } = boot();
    motion.open();
    motion.close();
    expect($('#animation').hidden).toBe(true);
    expect(document.activeElement).toBe($('#opt-animation'));
  });

  it('[Right] o mesmo vale para o painel irmão: #empathy devolve o foco a #opt-empathy', () => {
    const { empathy } = boot();
    // O `beforeEach` deixa o foco em #opt-animation; quem abre a Empatia é o botão DELA. Antes isto não
    // precisava ser dito, porque o close focava um id fixo e acertava por acaso mesmo tendo sido aberto de
    // outro lugar — o que é justamente o defeito que este arquivo passou a cobrir logo abaixo.
    $('#opt-empathy').focus();
    empathy.open();
    expect($('#empathy').contains(document.activeElement)).toBe(true);
    empathy.close();
    expect(document.activeElement).toBe($('#opt-empathy'));
  });

  // ⚠️ O caso que faltava, e que é o motivo de este defeito ter vivido tanto: a marcação acima INVENTA os
  // botões `#opt-animation`/`#opt-empathy`, e a página real NÃO os tem — dos nove destinos de foco que os
  // painéis usavam, só `#opt-touchcfg` existe em app/index.html. O teste construía o DOM que fazia o código
  // parecer certo, e por isso ficava verde enquanto quem jogava perdia o foco para o `<body>`.
  // Aqui os botões são removidos de propósito e o painel é aberto de outro lugar — que é o que acontece de
  // verdade, porque quem abre é o menu de pausa.
  describe('sem os botões #opt-* (a página real): o foco volta para QUEM ABRIU, não para um id fixo', () => {
    function semOptButtons() { $('#opt-animation').remove(); $('#opt-empathy').remove(); }

    it('[Right] abre a partir de um botão qualquer e o foco volta para ele ao fechar', () => {
      const { motion } = boot();
      semOptButtons();
      const abridor = document.createElement('button');
      abridor.textContent = 'Movimento'; document.body.appendChild(abridor); abridor.focus();
      motion.open();
      expect($('#animation').contains(document.activeElement)).toBe(true); // o foco entrou no diálogo
      motion.close();
      expect(document.activeElement).toBe(abridor);                        // e voltou para quem abriu
    });

    it('[Right] dois abridores diferentes para o MESMO painel: cada um recebe o foco de volta', () => {
      const { motion } = boot();
      semOptButtons();
      const a = document.createElement('button'); document.body.appendChild(a);
      const b = document.createElement('button'); document.body.appendChild(b);
      a.focus(); motion.open(); motion.close();
      expect(document.activeElement).toBe(a);
      b.focus(); motion.open(); motion.close();
      expect(document.activeElement).toBe(b); // um id fixo não conseguiria distinguir os dois
    });

    it('[Zero/Error] abridor que sumiu do documento: restoreFocus recusa em vez de estourar', () => {
      const { panel, motion } = boot();
      semOptButtons();
      const efemero = document.createElement('button'); document.body.appendChild(efemero); efemero.focus();
      motion.open();
      efemero.remove();               // o menu que abriu foi embora enquanto o painel estava aberto
      expect(() => motion.close()).not.toThrow();
      expect(panel.restoreFocus('animation')).toBe(false);
    });
  });

  it('[Interface] frontOverlay não mexe no aria-modal nem no role do card', () => {
    const { panel } = boot();
    panel.frontOverlay($('#animation'));
    const card = $('#animation .overlay__card');
    expect(card.getAttribute('aria-modal')).toBe('true');
    expect(card.getAttribute('role')).toBe('dialog');
  });
});

describe('empilhamento real (getComputedStyle)', () => {
  it('[Right] dois diálogos abertos: o último aberto fica por cima e é o topVisibleOverlay', () => {
    const { panel, motion, empathy } = boot();
    motion.open();
    empathy.open();
    const zA = Number(getComputedStyle($('#animation')).zIndex);
    const zE = Number(getComputedStyle($('#empathy')).zIndex);
    expect(zE).toBeGreaterThan(zA);
    expect(panel.topVisibleOverlay()).toBe($('#empathy'));
  });

  it('[Boundary] reabrir o de baixo o traz para a frente', () => {
    const { panel, motion, empathy } = boot();
    motion.open();
    empathy.open();
    motion.open();
    expect(panel.topVisibleOverlay()).toBe($('#animation'));
  });

  it('[Zero] com tudo fechado, topVisibleOverlay é null (os overlays estão hidden)', () => {
    const { panel } = boot();
    expect(panel.topVisibleOverlay()).toBe(null);
  });

  it('[Boundary] diálogo fora do #game-region não entra na pilha', () => {
    const { panel, motion } = boot();
    motion.open();
    const fora = document.createElement('div');
    fora.className = 'overlay';
    fora.style.zIndex = '999';
    document.body.appendChild(fora);
    expect(panel.topVisibleOverlay()).toBe($('#animation'));
  });
});

describe('Escape fecha UM diálogo — e é o primeiro da cadeia, não o de cima', () => {
  it('[Right] só #empathy aberto: o alvo é #empathy', () => {
    const { panel, empathy } = boot();
    empathy.open();
    expect(panel.escapeTarget()).toBe('empathy');
  });

  it('[Boundary] os dois abertos: o alvo é #animation (ordem de registro) mesmo com #empathy POR CIMA', () => {
    const { panel, motion, empathy } = boot();
    motion.open();
    empathy.open();
    expect(panel.topVisibleOverlay()).toBe($('#empathy')); // o de cima é o empathy…
    expect(panel.escapeTarget()).toBe('animation');        // …mas quem consome Escape é o 1º da cadeia
  });

  it('[Right] fechar o alvo fecha SÓ ele, devolve o foco ao seu botão, e o outro segue aberto', () => {
    const { panel, motion, empathy } = boot();
    motion.open();
    empathy.open();
    panel.closeById(panel.escapeTarget());
    expect($('#animation').hidden).toBe(true);
    expect($('#empathy').hidden).toBe(false);
    expect(document.activeElement).toBe($('#opt-animation'));
  });

  it('[Boundary] o Escape seguinte pega o que sobrou', () => {
    const { panel, motion, empathy } = boot();
    motion.open();
    empathy.open();
    panel.closeById(panel.escapeTarget());
    expect(panel.escapeTarget()).toBe('empathy');
    panel.closeById('empathy');
    expect($('#empathy').hidden).toBe(true);
    expect(document.activeElement).toBe($('#opt-empathy'));
    expect(panel.escapeTarget()).toBe(null);
  });

  it('[Zero/Error] diálogo escondido por fora não sequestra a tecla', () => {
    const { panel, motion, empathy } = boot();
    motion.open();
    empathy.open();
    $('#animation').hidden = true; // some sem passar pelo close(): visibilidade e a unica fonte, entao ele sai da vez
    expect(panel.escapeTarget()).toBe('empathy');
  });
});

describe('fillExplain no DOM real — ordem de leitura', () => {
  function cardWithRow(inner) {
    $('#animation').hidden = false; // um diálogo escondido é display:none — nada isInside dele é focável
    const card = $('#animation .overlay__card');
    const row = document.createElement('div');
    row.className = 'ctrl-row';
    row.innerHTML = inner;
    card.appendChild(row);
    return { card, row };
  }

  it('[Right] a descrição sai da linha e vai para o rodapé aria-live; sobra só o rótulo', () => {
    const { panel } = boot();
    const { card, row } = cardWithRow('<span><strong>♿ Modo Fácil</strong> — gravidade menor, pulo mais alto.</span><button type="button">on</button>');
    panel.fillExplain(card);
    const footer = card.querySelector('.opt-explain');
    expect(footer.getAttribute('aria-live')).toBe('polite');
    expect(footer.textContent).toBe(t(EXPLAIN_IDLE));
    expect(row.dataset.explain).toBe('gravidade menor, pulo mais alto.');
    expect(row.querySelector(':scope > span').textContent).toBe('♿ Modo Fácil');
  });

  it('[Right] FOCO de teclado num controle da linha atualiza o rodapé (focusin borbulha)', () => {
    const { panel } = boot();
    const { card, row } = cardWithRow('<span><strong>Contorno</strong> — em volta do personagem.</span><button type="button">on</button>');
    panel.fillExplain(card);
    const footer = card.querySelector('.opt-explain');
    row.querySelector('button').focus();
    expect(footer.textContent).toBe('em volta do personagem.');
  });

  it('[Boundary] mouseleave devolve o rodapé ao texto de repouso', () => {
    const { panel } = boot();
    const { card, row } = cardWithRow('<span><strong>Contorno</strong> — em volta do personagem.</span>');
    panel.fillExplain(card);
    const footer = card.querySelector('.opt-explain');
    row.dispatchEvent(new MouseEvent('mouseenter'));
    expect(footer.textContent).toBe('em volta do personagem.');
    row.dispatchEvent(new MouseEvent('mouseleave'));
    expect(footer.textContent).toBe(t(EXPLAIN_IDLE));
  });

  it('[Right] com .opt-hint dentro do span é o hint que vira a explicação', () => {
    const { panel } = boot();
    const { card, row } = cardWithRow('<span><strong>🎮 Desenho</strong> — texto solto que NÃO deve virar explicação<span class="opt-hint">escolha como rotular os botões.</span></span>');
    panel.fillExplain(card);
    expect(row.dataset.explain).toBe('escolha como rotular os botões.');
  });

  it('[Boundary] só o <span> FILHO DIRETO conta (:scope > span) — span aninhado não vira rótulo', () => {
    const { panel } = boot();
    const { card, row } = cardWithRow('<div><span><strong>Aninhado</strong> — não é filho direto.</span></div>');
    panel.fillExplain(card);
    expect(row.dataset.explainDone).toBe('1');
    expect(row.dataset.explain).toBe(undefined);
  });

  it('[Interface] abrir o painel já preenche o rodapé (frontOverlay → fillExplain no .overlay__card)', () => {
    const { motion } = boot();
    const card = $('#animation .overlay__card');
    const row = document.createElement('div');
    row.className = 'ctrl-row';
    row.innerHTML = '<span><strong>Rótulo</strong> — descrição.</span>';
    card.appendChild(row);
    motion.open();
    expect(card.querySelector('.opt-explain')).not.toBe(null);
    expect(row.dataset.explain).toBe('descrição.');
  });
});
