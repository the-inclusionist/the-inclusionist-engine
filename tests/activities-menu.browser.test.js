// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/activities-menu — casca de DOM REAL (project BROWSER: document + parsing de innerHTML + foco de
// verdade + eventos que borbulham). Complementa tests/activities-menu.node.test.js, que cobre a lógica pura com
// elementos falsos: aqui provamos o que o fake NÃO consegue provar — que o markup gerado por buildTitleMenus
// vira botão clicável, que o rodapé de descrição escreve no `.tm-desc` do PRÓPRIO submenu (via closest), que
// navTitle move o document.activeElement, e que o rótulo abreviado anima no hover. Injeção por closure (mesmo
// padrão de ui/settings-motion): ctx com spies; `core/state.ts`, `educational/activities-registry.ts` e
// `platform/storage.ts` são os módulos REAIS, que initActivitiesMenu importa direto.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initActivitiesMenu, attachAbbr, TITLE_MENU_ORDER } from '../app/js/ui/activities-menu.js';
import { createRunState } from '../app/js/core/run-state.js';
// A RODADA é local a este arquivo desde 2026-08-26 (ADR-0038, Fase B): `players`/`numPlayers` deixaram de
// ser `let` de `core/state` e passaram a viver na instância que a raiz de composição possui. Aqui o teste
// cria a sua, e os apelidos abaixo mantêm o corpo dos casos escrito como sempre esteve.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);

import { activity as ACTIVITY, setActivityValue } from '../app/js/game/state.js'; // GAME desde a Fase B (ADR-0038)
import { modeForActivity } from '../app/js/educational/activities-registry.js';
import * as store from '../app/js/platform/storage.js';

const $ = (sel) => document.querySelector(sel);

function markup() {
  // Espelha o index.html: um overlay com os 6 submenus (só o tm-main visível) — os 5 dinâmicos são escritos
  // por buildTitleMenus(); o tm-main é estático, com o seletor de nº de jogadores.
  document.body.innerHTML = `
    <div id="title-overlay">
      ${TITLE_MENU_ORDER.map((id) => `<div id="${id}" class="title-menu"${id === 'tm-main' ? '' : ' hidden'}></div>`).join('')}
    </div>`;
  $('#tm-main').innerHTML = `
    <button class="title-btn" data-tm="ludico" type="button">Lúdico</button>
    <button class="title-btn" data-tm="alf" type="button">Alfabetização</button>
    <button class="title-btn" data-tm="mat" type="button">Matemática</button>
    <button class="title-btn" id="np-btn" type="button">◀ Jogadores: 1 ▶</button>`;
}

function makeCtx(over = {}) {
  const calls = { said: [], alerted: [], shown: [], mode: [], quizLevel: [], cenario: [], numPlayers: [], restart: 0, phase: [], hideTips: 0, fullscreen: 0 };
  const ctx = {
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    $,
    getActiveElement: () => document.activeElement,
    srSay: (t) => calls.said.push(t),
    srAlert: (t) => calls.alerted.push(t),
    titleShow: (w) => { calls.shown.push(w); for (const id of TITLE_MENU_ORDER) $('#' + id).hidden = id !== w; },
    cenarios: [{ id: 'cidade', nome: 'Cidade' }, { id: 'floresta', nome: 'Floresta' }],
    setCenario: (c) => calls.cenario.push(c),
    // `activity` chega por INJEÇÃO desde 2026-08-26: ele é estado do JOGO (`game/state`), e este módulo é
    // engine — o gate de fronteira proíbe engine importar de `game/`. O fake usa o `core/state` ainda
    // porque é lá que o binding mora HOJE; quando ele mudar de casa, muda só esta linha.
    getActivityId: () => ACTIVITY, setActivityId: setActivityValue,
    setQuizLevel: (n, a) => calls.quizLevel.push([n, a]),
    isMobile: () => false,
    fitsN: () => true,
    setNumPlayers: (n) => calls.numPlayers.push(n),
    restartGame: () => { calls.restart++; },
    setPhase: (p) => calls.phase.push(p),
    hideTips: () => { calls.hideTips++; },
    enterFullscreen: () => { calls.fullscreen++; },
    ...over,
  };
  return { ctx, calls };
}

/** Aciona o clique e deixa a animação de ativação (230ms) terminar. */
function clickAndSettle(el) { el.click(); vi.advanceTimersByTime(230); }

beforeEach(() => {
  markup();
  store.remove(store.KEYS.tabsel); store.remove(store.KEYS.fracnot);
  setActivityValue('ludico');
  players.length = 0; players.push({ alfWins: 3 });
  setNumPlayersValue(1);
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); });

describe('markup gerado vira menu de verdade', () => {
  it('os 5 submenus dinâmicos ganham botões reais, na ordem do catálogo', () => {
    const { ctx } = makeCtx();
    initActivitiesMenu(ctx);
    const alf = [...$('#tm-alf').querySelectorAll('button[data-act-id]')].map((b) => b.dataset.actId);
    expect(alf).toEqual(['alf1', 'alf2', 'alf3', 'alf4', 'alf5']);
    expect($('#tm-tab').querySelectorAll('button[data-tab-n]')).toHaveLength(11);
    expect($('#tm-cen').querySelectorAll('button[data-cen]')).toHaveLength(2);
    expect($('#tm-fr').querySelectorAll('button[data-fnot]')).toHaveLength(5);
  });

  it('cada submenu tem um caminho de volta — ninguém fica preso', () => {
    const { ctx } = makeCtx();
    initActivitiesMenu(ctx);
    expect($('#tm-alf [data-tm-back]').dataset.tmBack).toBe('tm-main');
    expect($('#tm-mat [data-tm-back]').dataset.tmBack).toBe('tm-main');
    expect($('#tm-fr [data-tm-back]').dataset.tmBack).toBe('tm-mat');
    expect($('#tm-tab [data-tm-back]').dataset.tmBack).toBe('tm-mat');
    expect($('#tm-cen [data-cen-back]')).not.toBeNull();
  });

  it('a atividade escolhida no submenu real leva ao seletor de cenário', () => {
    const { ctx, calls } = makeCtx();
    initActivitiesMenu(ctx);
    clickAndSettle($('#tm-alf button[data-act-id="alf2"]'));
    expect(calls.shown).toEqual(['tm-cen']);
  });

  it('o percurso inteiro — matemática → fração → atividade → cenário → jogo — chega ao "playing"', () => {
    const { ctx, calls } = makeCtx();
    initActivitiesMenu(ctx);
    clickAndSettle($('#tm-main button[data-tm="mat"]'));
    clickAndSettle($('#tm-mat button[data-tm-fr]'));
    clickAndSettle($('#tm-fr button[data-act-id="fr3"]'));
    clickAndSettle($('#tm-cen button[data-cen="floresta"]'));
    expect(calls.shown).toEqual(['tm-mat', 'tm-fr', 'tm-cen']);
    expect(calls.cenario).toEqual(['floresta']);
    // O menu não escreve mais o modo (ADR-0040) — ele grava a atividade e o modo DERIVA. O percurso
    // inteiro terminou numa fração, que é matemática, logo o motor está em soma-sub.
    expect(modeForActivity(ACTIVITY)).toBe('somasub');
    expect(calls.phase).toEqual(['playing']);
    expect(players[0].alfWins).toBe(0);
  });

  it('o "Voltar" do cenário devolve ao submenu de onde a atividade veio', () => {
    const { ctx, calls } = makeCtx();
    initActivitiesMenu(ctx);
    clickAndSettle($('#tm-alf button[data-act-id="alf4"]'));
    clickAndSettle($('#tm-cen button[data-cen-back]'));
    expect(calls.shown).toEqual(['tm-cen', 'tm-alf']);
    expect(calls.phase).toEqual([]); // voltar NÃO começa o jogo
  });

  it('tabuada e divisão dividem a MESMA tela de números, e o título diz qual delas é', () => {
    const { ctx } = makeCtx();
    initActivitiesMenu(ctx);
    clickAndSettle($('#tm-mat button[data-act-id="mat5"]'));
    expect($('#tm-tab .tm-title').textContent).toBe('Tabuada');
    clickAndSettle($('#tm-mat button[data-act-id="mat6"]'));
    expect($('#tm-tab .tm-title').textContent).toBe('Divisão');
  });
});

describe('rodapé de descrição (foco e hover)', () => {
  it('focar um minigame escreve a descrição no rodapé do PRÓPRIO submenu, não no do vizinho', () => {
    const { ctx } = makeCtx();
    initActivitiesMenu(ctx);
    $('#tm-alf').hidden = false;
    $('#tm-alf button[data-act-id="alf5"]').focus();
    expect($('#tm-alf .tm-desc').textContent).toContain('Braille');
    expect($('#tm-mat .tm-desc').textContent).toBe('');
  });

  it('passar o mouse por uma notação escreve a descrição dela', () => {
    const { ctx } = makeCtx();
    initActivitiesMenu(ctx);
    $('#tm-fr button[data-fnot="pct"]').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect($('#tm-fr .tm-desc').textContent).toBe('Liga números percentuais.');
  });

  it('botão sem descrição (o "Voltar") não apaga nem sobrescreve o rodapé', () => {
    const { ctx } = makeCtx();
    initActivitiesMenu(ctx);
    $('#tm-mat').hidden = false;
    $('#tm-mat button[data-act-id="mat1"]').focus();
    const antes = $('#tm-mat .tm-desc').textContent;
    $('#tm-mat [data-tm-back]').focus();
    expect($('#tm-mat .tm-desc').textContent).toBe(antes);
  });
});

describe('seleção persistida sobrevive à reconstrução do menu', () => {
  it('o número desligado continua desligado quando o menu é reescrito (divisão reusa a tela)', () => {
    const { ctx } = makeCtx();
    initActivitiesMenu(ctx);
    const b3 = $('#tm-tab button[data-tab-n="3"]');
    expect(b3.getAttribute('aria-pressed')).toBe('true'); // padrão 2,3,4,5
    b3.click(); // toggle imediato, sem animação
    expect($('#tm-tab button[data-tab-n="3"]').getAttribute('aria-pressed')).toBe('false');
    clickAndSettle($('#tm-mat button[data-act-id="mat6"]')); // rebuild do submenu
    expect($('#tm-tab button[data-tab-n="3"]').getAttribute('aria-pressed')).toBe('false');
    expect(store.getJSON(store.KEYS.tabsel)).not.toContain(3);
  });

  it('a notação ligada aparece realçada no markup reconstruído', () => {
    store.setJSON(store.KEYS.fracnot, { v: 0, d: 0, dec: 1, pct: 0, mix: 0 });
    const { ctx } = makeCtx();
    initActivitiesMenu(ctx);
    // O estado deixou de ser SÓ cor de fundo (`.tab-on`) e passou a ter marca visível e `aria-checked` —
    // cor sozinha reprova a WCAG 1.4.1 e deixava o menu mudo para quem tem baixa visão ou daltonismo.
    expect($('#tm-fr button[data-fnot="dec"]').getAttribute('aria-checked')).toBe('true');
    expect($('#tm-fr button[data-fnot="v"]').getAttribute('aria-checked')).toBe('false');
    expect($('#tm-fr button[data-fnot="dec"] .fnot-marca').textContent).toBe('☑');
    expect($('#tm-fr button[data-fnot="v"] .fnot-marca').textContent).toBe('☐');
  });

  it('[Right] CLICAR na notação atualiza a marca e o `aria-checked`, não só o estado guardado', () => {
    // O buraco que este caso fecha era meu: eu gateei o MARKUP INICIAL (`fracNotsHtml`) e não a ALTERNÂNCIA.
    // O handler continuou escrevendo `tab-on`/`aria-pressed` — os atributos de antes —, então o estado mudava
    // por dentro e a tela não dizia nada. MEDIDO no navegador: clicar não mexia em marca nenhuma.
    store.setJSON(store.KEYS.fracnot, { v: 1, d: 1, dec: 1, pct: 0, mix: 0 });
    const { ctx } = makeCtx();
    initActivitiesMenu(ctx);
    const pct = $('#tm-fr button[data-fnot="pct"]');
    clickAndSettle(pct);
    expect(pct.getAttribute('aria-checked'), 'o aria-checked não acompanhou o clique').toBe('true');
    expect(pct.querySelector('.fnot-marca').textContent, 'a marca visível não acompanhou o clique').toBe('☑');
    clickAndSettle(pct);
    expect(pct.getAttribute('aria-checked')).toBe('false');
    expect(pct.querySelector('.fnot-marca').textContent).toBe('☐');
  });
});

describe('navegação por setas no DOM real', () => {
  it('a seta move o document.activeElement pelos botões do submenu visível e circula no fim', () => {
    const { ctx } = makeCtx();
    const api = initActivitiesMenu(ctx);
    const bs = api.titleButtons();
    expect(bs).toHaveLength(4); // os 4 botões do tm-main
    api.navTitle({ down: true });
    expect(document.activeElement).toBe(bs[0]);
    api.navTitle({ down: true });
    expect(document.activeElement).toBe(bs[1]);
    api.navTitle({ up: true });
    expect(document.activeElement).toBe(bs[0]);
    api.navTitle({ up: true });
    expect(document.activeElement).toBe(bs[3]); // circulou para o último
  });

  it('confirmar na seta aciona o botão focado de verdade', () => {
    const { ctx, calls } = makeCtx();
    const api = initActivitiesMenu(ctx);
    api.navTitle({ down: true }); api.navTitle({ down: true }); // 2º botão: Alfabetização
    api.navTitle({ yes: true });
    vi.advanceTimersByTime(230);
    expect(calls.shown).toEqual(['tm-alf']);
  });

  it('voltar (o "não") aciona o "Voltar" do submenu visível', () => {
    const { ctx, calls } = makeCtx();
    const api = initActivitiesMenu(ctx);
    ctx.titleShow('tm-alf');
    api.navTitle({ no: true });
    vi.advanceTimersByTime(230);
    expect(calls.shown).toEqual(['tm-alf', 'tm-main']);
  });

  // REGRESSÃO — GAG A1. Este caso faltava, e por isso o defeito passou: o "voltar" só era exercitado na
  // tm-alf. Cinco das seis telas marcam o botão com `data-tm-back` e a de CENÁRIO com `data-cen-back` (o alvo
  // dela é dinâmico, calculado por cenBackMenuFor), e o navTitle só conhecia o primeiro atributo. Efeito no
  // jogo: na última tela antes da partida — por onde passa TODA partida — o botão Voltar do controle não
  // fazia nada, enquanto o "Voltar" visível continuava clicável com mouse ou toque. Quem depende do controle
  // só conseguia ir para a frente.
  it('[Regressão] voltar funciona também na tela de CENÁRIO, que marca o botão com outro atributo', () => {
    const { ctx, calls } = makeCtx();
    const api = initActivitiesMenu(ctx);
    api.buildTitleMenus();          // escreve o #tm-cen (é ele que traz o data-cen-back)
    api.startActivity('ludico');    // trava o cenBack e mostra a tela de cenário
    expect(calls.shown.at(-1)).toBe('tm-cen');
    const alvos = [...$('#tm-cen').querySelectorAll('button')].filter((b) => b.dataset.cenBack != null);
    expect(alvos.length, 'a tela de cenário precisa ter um botão Voltar para o teste dizer algo').toBe(1);
    api.navTitle({ no: true });
    vi.advanceTimersByTime(230);
    expect(calls.shown.at(-1)).toBe('tm-main');
  });
});

describe('nº de jogadores com geometria real', () => {
  it('clicar na metade direita sobe e na esquerda desce, atualizando o número visível', () => {
    const { ctx } = makeCtx();
    const api = initActivitiesMenu(ctx);
    const b = $('#np-btn');
    const r = b.getBoundingClientRect();
    b.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width * 0.9 }));
    expect(api.getPendingPlayers()).toBe(2);
    expect(b.textContent).toContain('2'); // o rótulo inteiro vem de t(); o span #np-n não existe mais
    b.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width * 0.1 }));
    expect(api.getPendingPlayers()).toBe(1);
    expect(b.textContent).toContain('1');
  });

  it('a seta do teclado no botão também muda o número (e cancela o comportamento padrão)', () => {
    const { ctx } = makeCtx();
    const api = initActivitiesMenu(ctx);
    const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    $('#np-btn').dispatchEvent(ev);
    expect(api.getPendingPlayers()).toBe(2);
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe('rótulo abreviado num botão real', () => {
  it('o hover descompacta o número em letras e o mouse saindo recompacta', () => {
    document.body.insertAdjacentHTML('beforeend', '<button id="ab" class="mode-btn" type="button">🦻 A12e auditiva</button>');
    const b = $('#ab');
    attachAbbr(b);
    expect(b.textContent).toBe('🦻 A12e auditiva');
    b.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(16 * 12);
    expect(b.textContent).toBe('🦻 Acessibilidade auditiva');
    b.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(16 * 12);
    expect(b.textContent).toBe('🦻 A12e auditiva');
  });

  it('CÓDIGO MORTO PORTADO: nenhum botão real do jogo casa com os tokens hoje', () => {
    // Os rótulos foram escritos por extenso ("Acessibilidade auditiva"), então a varredura
    // .mode-btn/.pm-btn não encontra token nenhum. Preservado verbatim; ver o relatório da extração.
    document.body.insertAdjacentHTML('beforeend', '<button id="pm" class="pm-btn" type="button">🦻 Acessibilidade auditiva</button>');
    const b = $('#pm');
    attachAbbr(b);
    expect(b.dataset.abbrDone).toBeUndefined();
    expect(b.textContent).toBe('🦻 Acessibilidade auditiva');
  });
});
