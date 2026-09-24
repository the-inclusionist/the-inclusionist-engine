// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-motion — real render/DOM (BROWSER project: uses document + querySelector). Injection by closure
// (the same pattern as ui/debug-panel): a ctx with FAKE $/srSay/store/frontOverlay/toggleBtn/rm/saveRM/rmKeys/rmChar
// (spies), a local round double for `players`/`numPlayers`, and the REAL `CRT`/`applyCrt` (render/crt.ts) — the same
// module initSettingsMotion imports directly. See docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initSettingsMotion, getSelectedPlayer, setSelectedPlayer,
} from '../app/js/ui/settings-motion.js';
/*
 * 🔴 THE ROUND IS A LOCAL DOUBLE (ADR-0228): `core/run-state` went with the tile-world stack to `game-platformer`. This
 * file never tested the round — it HANDS one to what it measures —, and the three members below are exactly the ones it
 * reads. A factory and not a literal: two rounds have to be two objects.
 */
const createRunState = () => ({ numPlayers: 1, players: [], setNumPlayers(n) { this.numPlayers = n; } });
// The round is local to this file (ADR-0038, phase B); the aliases below keep the cases' bodies written as they always were.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);

import { CRT, applyCrt } from '../app/js/render/crt.js';
import { t } from '../app/js/core/i18n.js';
import { RM_LABEL } from '../app/js/ui/motion-choices.js';

const $ = (sel) => document.querySelector(sel);

const RM_KEYS = ['parallax', 'decor', 'items', 'particles'];
const RM_CHAR = [
  { prop: 'rmWalk', lbl: 'Personagem em movimento (andar, escalar, nadar, pular)' },
  { prop: 'rmBreath', lbl: 'Respiração (parado)' },
  { prop: 'rmFlavor', lbl: 'Gracinhas (animações de descanso)' },
];

function markup() {
  // motion-master carries the STATIC default text of the page (only updateMotionMaster()/render() corrects it later),
  // and #game-region is the target applyCrt() needs — as in a real boot, where the dialogs live inside it.
  document.body.innerHTML = `
    <div id="game-region">
      <button id="opt-animation" type="button"></button>
      <div id="animation" hidden>
        <div id="animation-players"></div>
        <button id="motion-master" type="button">⏸ Parar todas as animações</button>
        <div id="motion-list"></div>
        <button id="animation-reset" type="button">Restaurar</button>
      </div>
      <button data-act="anim" class="pm-btn" type="button">Sensibilidade visual</button>
    </div>`;
}

function makeCtx(over = {}) {
  const calls = { srSay: [], setBool: [], frontOverlay: [], toggleBtn: [], saveRM: 0 };
  const rm = { parallax: false, decor: false, items: false, particles: false };
  const ctx = {
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    $,
    srSay: (t) => calls.srSay.push(t),
    store: { setBool: (k, v) => calls.setBool.push([k, v]) },
    frontOverlay: (el) => calls.frontOverlay.push(el),
    toggleBtn: (el, on) => { calls.toggleBtn.push(on); el.classList.toggle('is-on', on); el.setAttribute('aria-pressed', String(on)); },
    rm, saveRM: () => { calls.saveRM++; },
    rmKeys: RM_KEYS, rmChar: RM_CHAR,
    ...over,
  };
  return { ctx, calls };
}

beforeEach(() => {
  markup();
  players.length = 0;
  players.push({ rmWalk: false, rmBreath: false, rmFlavor: false });
  setNumPlayersValue(1);
  CRT.scan = 1; CRT.vig = 0; CRT.round = 1;
  setSelectedPlayer(0);
});

describe('initSettingsMotion — render()', () => {
  it('[Interface] popula #motion-list com as 3 seções (Personagem/Cena/Estética CRT)', () => {
    const { ctx } = makeCtx();
    initSettingsMotion(ctx).render();
    const html = $('#motion-list').innerHTML;
    expect(html).toContain('Personagem');
    expect(html).toContain('Cena');
    expect(html).toContain('Estética CRT');
    expect($('#motion-list').querySelectorAll('button[data-rmc]').length).toBe(3);
    expect($('#motion-list').querySelectorAll('button[data-rm]').length).toBe(4);
  });

  it('[Zero] sem #motion-list no DOM, render() não quebra', () => {
    document.body.innerHTML = '<div id="animation"></div>';
    const { ctx } = makeCtx();
    expect(() => initSettingsMotion(ctx).render()).not.toThrow();
  });

  it('[Boundary] com 1 jogador, o cabeçalho não mostra "· Jogador N"', () => {
    const { ctx } = makeCtx();
    initSettingsMotion(ctx).render();
    expect($('#motion-list').innerHTML).not.toContain('Jogador');
  });

  it('[Boundary] com >1 jogador, o cabeçalho mostra "· Jogador N" (1-based)', () => {
    players.push({ rmWalk: false, rmBreath: false, rmFlavor: false });
    setNumPlayersValue(2);
    const { ctx } = makeCtx();
    initSettingsMotion(ctx).render();
    expect($('#motion-list').innerHTML).toContain('Jogador 1');
  });

  it('[Boundary] selectedPlayer fora do nº de telas volta a 0 no próximo render (encolheu de 4p→1p)', () => {
    setSelectedPlayer(3);
    setNumPlayersValue(1);
    const { ctx } = makeCtx();
    initSettingsMotion(ctx).render();
    expect(getSelectedPlayer()).toBe(0);
  });
});

describe('initSettingsMotion — toggle de personagem (data-rmc)', () => {
  it('[Right] clique inverte a flag do player selecionado e persiste via ctx.store.setBool', () => {
    const { ctx, calls } = makeCtx();
    initSettingsMotion(ctx).render();
    $('#motion-list').querySelector('button[data-rmc="rmWalk"]').click();
    expect(players[0].rmWalk).toBe(true);
    expect(calls.setBool).toContainEqual(['incl_rmWalk_p0', true]);
  });
});

describe('initSettingsMotion — toggle de cena (data-rm)', () => {
  it('[Right] clique inverte rm[k], chama saveRM e anuncia via srSay', () => {
    const { ctx, calls } = makeCtx();
    initSettingsMotion(ctx).render();
    $('#motion-list').querySelector('button[data-rm="parallax"]').click();
    expect(ctx.rm.parallax).toBe(true);
    expect(calls.saveRM).toBe(1);
    expect(calls.srSay.at(-1)).toBe('Parallax do fundo congelado.');
  });
});

describe('initSettingsMotion — estética CRT', () => {
  it('[Right] clique no toggle de scanlines liga/desliga CRT.scan e chama applyCrt', () => {
    const { ctx, calls } = makeCtx();
    initSettingsMotion(ctx).render();
    CRT.scan = 1;
    const btn = $('#motion-list').querySelector('button[data-crt-tgl="scan"]');
    btn.click();
    expect(CRT.scan).toBe(0);
    expect(calls.srSay.at(-1)).toBe('Scanlines desligada.');
  });

  it('🔴 [Right] os cantos são PASSOS ⯇ ⯈: um passo muda CRT.round, anuncia, e o controle fica no sítio (ADR-0151)', () => {
    const { ctx, calls } = makeCtx();
    CRT.round = 1;
    initSettingsMotion(ctx).render();
    const passos = $('#motion-list').querySelector('[data-crt="round"][data-passos]');
    expect(passos, 'os cantos não viraram passos').not.toBeNull();
    expect($('#motion-list').querySelector('select[data-crt]'), 'sobrou o <select> antigo').toBeNull();
    // 🔴 ONE ROW ONLY, «◀ Cantos arredondados: pequeno ▶» (ADR-0130 erratum): no label to the left of the box.
    expect(passos.closest('.ctrl-row').children.length, 'sobrou o rótulo à parte, ao lado dos passos').toBe(1);
    expect(passos.querySelector('.passo-valor').textContent).toBe('Cantos arredondados: pequeno');
    passos.querySelector('[data-passo="1"]').click();
    expect(CRT.round).toBe(2);
    expect(calls.srSay.at(-1)).toBe('Cantos arredondados: grande.');
    // ⚠️ THE SAME NODE, not a redraw: redrawing the list took the focus away from whoever is adjusting.
    expect(passos.isConnected, 'o passo redesenhou a lista e o controle focado saiu do documento').toBe(true);
    expect(passos.getAttribute('aria-valuetext')).toBe('grande');
  });

  it('🔴 [Right] e sobrevive ao clique da linha AO LADO — o caso acima só media o próprio passo', () => {
    // 📏 Measured in `dist` on 2026-09-23, with the SW killed: focusing the corners and clicking the scanlines switch
    // destroyed the control and threw focus to the `BODY` — the child navigating by keyboard lost her place in the whole
    // panel, not just in the row. 🎯 And the intent was WRITTEN beside it: the step handler avoids redrawing because
    // redrawing took the focus from whoever adjusts. What undid it was the neighbouring row, which redraws.
    const { ctx } = makeCtx();
    CRT.round = 1;
    CRT.scan = 1;
    initSettingsMotion(ctx).render();
    // ⚠️ The fixture's panel is born `hidden`, and a descendant of a hidden element does NOT accept focus: without this
    // line the case would go red for failing to focus, which is red for the wrong reason.
    $('#animation').hidden = false;
    const antes = $('#motion-list').querySelector('[data-crt="round"][data-passos]');
    expect(antes, 'os cantos não foram montados — o caso não mediria nada').not.toBeNull();
    antes.focus();
    expect(document.activeElement, 'o controle não aceitou o foco').toBe(antes);

    $('#motion-list').querySelector('button[data-crt-tgl="scan"]').click();

    const depois = $('#motion-list').querySelector('[data-crt="round"][data-passos]');
    expect(depois, 'os cantos desapareceram depois do clique vizinho').not.toBeNull();
    expect(depois, 'a linha vizinha refez o controle dos cantos').toBe(antes);
    expect(document.activeElement, 'o foco saiu do controle quando a linha vizinha foi clicada').toBe(antes);
  });

  it('🔴 [Boundary] na PONTA o passo não anda e não anuncia — repetir «grande» soaria a um passo dado', () => {
    const { ctx, calls } = makeCtx();
    CRT.round = 2;
    initSettingsMotion(ctx).render();
    const antes = calls.srSay.length;
    const passos = $('#motion-list').querySelector('[data-crt="round"][data-passos]');
    // ⚠️ WITH BUBBLING, as BOTH real producers of this event dispatch it — the tapped arrow (`ui/panel-widgets`) and the
    // keyboard's and gamepad's left/right (`ui/menu-nav`). The listener is on the list, not the control, because the
    // rows come and go with the cartridge; a dispatch without bubbling would be a shape no real path uses.
    passos.dispatchEvent(new CustomEvent('passo', { detail: 1, bubbles: true }));
    expect(CRT.round).toBe(2);
    expect(calls.srSay.length, 'anunciou um passo que não aconteceu').toBe(antes);
    passos.dispatchEvent(new CustomEvent('passo', { detail: -1, bubbles: true }));
    expect(CRT.round).toBe(1);
  });
});

describe('initSettingsMotion — botão-mestre (#motion-master)', () => {
  it('[Right] com tudo animado, o rótulo é "Parar" e o clique congela cena + personagem', () => {
    const { ctx, calls } = makeCtx();
    initSettingsMotion(ctx);
    expect($('#motion-master').textContent).toBe('⏸ Parar todas as animações');
    $('#motion-master').click();
    expect(RM_KEYS.every((k) => ctx.rm[k])).toBe(true);
    expect(players[0].rmWalk).toBe(true);
    expect(calls.setBool).toContainEqual(['incl_rmWalk_p0', true]);
    expect(calls.srSay.at(-1)).toBe('Todas as animações paradas.');
  });

  it('[Inverse] com tudo congelado, o clique retoma tudo e anuncia "retomadas"', () => {
    const { ctx } = makeCtx();
    for (const k of RM_KEYS) ctx.rm[k] = true;
    players[0].rmWalk = players[0].rmBreath = players[0].rmFlavor = true;
    const api = initSettingsMotion(ctx);
    api.render();
    $('#motion-master').click();
    expect(RM_KEYS.every((k) => !ctx.rm[k])).toBe(true);
    expect(players[0].rmWalk).toBe(false);
  });

  it('[Zero] sem #motion-master no DOM, initSettingsMotion não quebra (não wireia o clique)', () => {
    document.body.innerHTML = '<div id="animation"><div id="motion-list"></div></div>';
    const { ctx } = makeCtx();
    expect(() => initSettingsMotion(ctx)).not.toThrow();
  });
});

describe('initSettingsMotion — open()/close()', () => {
  it('[Interface] open(): renderiza, mostra o overlay, chama frontOverlay, mostra o diálogo e foca um botão', () => {
    const { ctx, calls } = makeCtx();
    const api = initSettingsMotion(ctx);
    api.open();
    expect($('#animation').hidden).toBe(false);
    expect(calls.frontOverlay.length).toBe(1);
    expect(document.activeElement.tagName).toBe('BUTTON');
  });

  it('[Interface] close(): esconde o overlay e devolve o foco ao botão que abriu', () => {
    const { ctx } = makeCtx();
    const api = initSettingsMotion(ctx);
    api.open();
    api.close();
    expect($('#animation').hidden).toBe(true);
    expect(document.activeElement).toBe($('#opt-animation'));
  });
});

describe('getSelectedPlayer / setSelectedPlayer', () => {
  it('[Right] setSelectedPlayer muda o valor lido por getSelectedPlayer (usado pelo atalho "anim" do pause)', () => {
    setSelectedPlayer(2);
    expect(getSelectedPlayer()).toBe(2);
    setSelectedPlayer(0);
  });
});

describe('ui/settings-motion — restaurar padrões DESTE menu (ADR-0028) + marca (ADR-0029)', () => {
  // This menu's default is the ONLY one that is not a constant: it is `prefers-reduced-motion`. In the test environment
  // the query answers `false`, so "default" here is animated — and that is what the cases compare against, never a
  // hand-written `false`, which is precisely the mistake this menu invites.
  beforeEach(() => {
    markup();
    players.length = 0;
    players.push({ rmWalk: false, rmBreath: false, rmFlavor: false });
    setNumPlayersValue(1);
    CRT.scan = 1; CRT.vig = 0; CRT.round = 1;
    applyCrt();
  });

  const linha = (sel) => $('#motion-list').querySelector(sel).closest('.ctrl-row');

  it('[Right] descongela cena e personagem e devolve o CRT de fábrica', () => {
    const { ctx, calls } = makeCtx();
    const rm = ctx.rm;
    rm.parallax = true; rm.decor = true;
    players[0].rmWalk = true;
    CRT.scan = 0; CRT.vig = 1; CRT.round = 2;
    initSettingsMotion(ctx).render();

    $('#animation-reset').click();

    expect(rm).toEqual({ parallax: false, decor: false, items: false, particles: false });
    expect(players[0].rmWalk).toBe(false);
    expect({ ...CRT }).toEqual({ scan: 1, vig: 0, round: 1 });
    expect(calls.saveRM).toBeGreaterThan(0);
    expect(calls.srSay.at(-1)).toContain('sistema');
  });

  it('[Right] alcança TODOS os jogadores, não só o da aba aberta', () => {
    players.push({ rmWalk: true, rmBreath: true, rmFlavor: true });
    setNumPlayersValue(2);
    const { ctx } = makeCtx();
    initSettingsMotion(ctx).render();
    $('#animation-reset').click();
    expect(players[1]).toEqual({ rmWalk: false, rmBreath: false, rmFlavor: false });
  });

  it('[Right] a marca aparece só nas linhas fora do padrão, e sobe para o botão do menu', () => {
    const { ctx } = makeCtx();
    const rm = ctx.rm;
    rm.items = true;
    CRT.vig = 1;
    initSettingsMotion(ctx).render();
    expect(linha('[data-rm="items"]').classList.contains('is-changed')).toBe(true);
    expect(linha('[data-rm="parallax"]').classList.contains('is-changed')).toBe(false);
    expect(linha('[data-crt-tgl="vig"]').classList.contains('is-changed')).toBe(true);
    expect(linha('[data-crt-tgl="scan"]').classList.contains('is-changed')).toBe(false);
    expect($('[data-act="anim"]').classList.contains('is-changed')).toBe(true);
  });

  it('[Right] o reset APAGA as marcas, inclusive a do botão do menu', () => {
    const { ctx } = makeCtx();
    const rm = ctx.rm;
    rm.items = true; players[0].rmFlavor = true; CRT.round = 0;
    initSettingsMotion(ctx).render();
    expect(document.querySelectorAll('.is-changed').length).toBeGreaterThan(0);
    $('#animation-reset').click();
    expect(document.querySelectorAll('.is-changed')).toHaveLength(0);
  });

  it('[Right] numa máquina que pede MENOS movimento, o reset CONGELA em vez de religar', () => {
    // The case this menu exists not to get wrong, and that the other four cases could not catch: with
    // `defaultReducedMotion()` answering false in the test environment, "reading the default" and "writing false" give
    // the same result, and a mutation swapping one for the other would pass unnoticed. Here the system says `reduce`,
    // and then the two stop being the same thing: writing false WOULD TURN ANIMATION BACK ON for whoever already asked
    // not to have it — the reset doing, by itself, what WCAG 2.3.3 exists to prevent.
    const real = window.matchMedia;
    window.matchMedia = (q) => ({ matches: q.includes('prefers-reduced-motion'), media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    try {
      const { ctx } = makeCtx();
      const rm = ctx.rm;
      initSettingsMotion(ctx).render();

      $('#animation-reset').click();

      expect(rm).toEqual({ parallax: true, decor: true, items: true, particles: true });
      expect(players[0]).toEqual({ rmWalk: true, rmBreath: true, rmFlavor: true });
      // And none of this counts as "changed": it is this machine's default, not the child's choice.
      expect(document.querySelectorAll('.is-changed')).toHaveLength(0);
    } finally {
      window.matchMedia = real;
    }
  });

  it('[Zero] tudo no padrão: nada marcado', () => {
    const { ctx } = makeCtx();
    initSettingsMotion(ctx).render();
    expect(document.querySelectorAll('.is-changed')).toHaveLength(0);
  });
});


// ==========================================================================================================
// THIS PANEL'S ROWS, AS NODES (ADR-0129; ADR-0221 step 7c)
//
// 📌 EIGHT CASES CHANGED PROJECT, not requirement. They measured the STRINGS `motionRowHtml`, `buildCharRowsHtml`,
// `buildSceneRowsHtml`, `crtToggleRowHtml` and `crtRoundRowHtml` returned; the panel builds NODES with the kit, so the
// strings no longer exist and what they assert is observable only in a document.
//
// ⚠️ TWO DID NOT COME, and that is right: they measured the «em breve» mechanism, which left with the conversion for
// having no subject — `RM_SOON` was an empty set since the cartridge left the repository, and the only things giving it
// a value were those two cases. A mechanism whose only user is a test is not a mechanism.
// ==========================================================================================================
describe('initSettingsMotion — o interior montado em nós', () => {
  const lista = () => $('#motion-list');
  const linhaDe = (sel) => lista().querySelector(sel)?.closest('.ctrl-row') ?? null;

  it('[Right] ANIMADO: o interruptor está ligado, diz o estado e não leva glifo (ADR-0159 regras 1 e 12)', () => {
    const { ctx } = makeCtx();
    players.length = 0;
    players.push({ rmWalk: false, rmBreath: false, rmFlavor: false });
    initSettingsMotion(ctx).render();
    const b = lista().querySelector('[data-rmc="rmWalk"]');
    expect(b, 'a linha do andar não foi montada').not.toBeNull();
    expect(b.classList.contains('is-on')).toBe(true);
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.textContent).toBe('Ligado');
    expect(b.textContent, 'voltou um glifo ao texto do interruptor').not.toMatch(/[▶⏸✓✔]/);
  });

  it('[Inverse] CONGELADO: sem a classe, sem o estado, e o texto é a palavra do dicionário', () => {
    const { ctx } = makeCtx();
    players.length = 0;
    players.push({ rmWalk: true, rmBreath: false, rmFlavor: false });
    initSettingsMotion(ctx).render();
    const b = lista().querySelector('[data-rmc="rmWalk"]');
    expect(b.classList.contains('is-on')).toBe(false);
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(b.textContent).toBe('Desligado');
  });

  it('[Right] uma linha por alvo do PERSONAGEM, reflectindo o jogador escolhido', () => {
    const { ctx } = makeCtx();
    players.length = 0;
    players.push({ rmWalk: true, rmBreath: false, rmFlavor: false });
    initSettingsMotion(ctx).render();
    expect(lista().querySelectorAll('[data-rmc]')).toHaveLength(3);
    expect(lista().querySelector('[data-rmc="rmWalk"]').textContent).toBe('Desligado');
    expect(lista().querySelector('[data-rmc="rmBreath"]').textContent).toBe('Ligado');
  });

  it('[Zero] sem jogador, tudo é tratado como ANIMADO — quem não existe não congelou nada', () => {
    const { ctx } = makeCtx();
    players.length = 0;
    initSettingsMotion(ctx).render();
    const botoes = [...lista().querySelectorAll('[data-rmc]')];
    expect(botoes).toHaveLength(3);
    for (const b of botoes) expect(b.textContent, b.dataset.rmc).toBe('Ligado');
  });

  it('[Right] uma linha por chave de CENA, com o rótulo do dicionário e o estado de `rm`', () => {
    const { ctx } = makeCtx();
    ctx.rm.parallax = true;
    ctx.rm.decor = false;
    initSettingsMotion(ctx).render();
    expect(lista().querySelectorAll('[data-rm]')).toHaveLength(4);
    const linha = linhaDe('[data-rm="parallax"]');
    expect(linha.textContent, 'a chave i18n vazou para a tela').not.toContain('rm.parallax');
    expect(linha.querySelector('strong').textContent).toBe(t(RM_LABEL.parallax));
    expect(lista().querySelector('[data-rm="parallax"]').textContent).toBe('Desligado');
    expect(lista().querySelector('[data-rm="decor"]').textContent).toBe('Ligado');
  });

  it('[Right] os dois interruptores CRT levam a chave no `data-crt-tgl` e dizem o estado', () => {
    const { ctx } = makeCtx();
    CRT.scan = 1;
    CRT.vig = 0;
    initSettingsMotion(ctx).render();
    const scan = lista().querySelector('[data-crt-tgl="scan"]');
    const vig = lista().querySelector('[data-crt-tgl="vig"]');
    expect(scan, 'o interruptor das scanlines não foi montado').not.toBeNull();
    expect(scan.textContent).toBe('Ligado');
    expect(scan.classList.contains('is-on')).toBe(true);
    expect(vig.textContent).toBe('Desligado');
    expect(vig.classList.contains('is-on')).toBe(false);
  });

  it('[Boundary] os CANTOS são o controle de passos no nível de agora — e nunca voltaram a ser um `<select>`', () => {
    const { ctx } = makeCtx();
    CRT.round = 1;
    initSettingsMotion(ctx).render();
    const passos = lista().querySelector('[data-crt="round"][data-passos]');
    expect(passos, 'os cantos não são um controle de passos').not.toBeNull();
    expect(lista().querySelector('select'), 'sobrou um `<select>` no interior').toBeNull();
    expect(passos.getAttribute('aria-valuenow')).toBe('1');
    // 🔴 AND THERE IS NO EMPTY SLOT ANY MORE: the string left a `<span data-passos-lugar>` that the render swapped for the
    // control on every pass, and that swap is what took the focus from whoever was adjusting.
    expect(lista().querySelector('[data-passos-lugar]'), 'sobrou o lugar que a cadeia deixava').toBeNull();
  });

  it('🔴 [Right] uma linha que perde o assunto é REMOVIDA, e as outras não são refeitas (ADR-0153)', () => {
    // 📌 The pair of the focus case: mounting only once is honest only if what loses its subject really leaves. Here the
    // cartridge starts saying it has no character, and its three rows have to disappear — while the scene ones, which
    // still have a subject, have to be the SAME nodes.
    let temPersonagem = true;
    const { ctx } = makeCtx({ hasCharacter: () => temPersonagem });
    const api = initSettingsMotion(ctx);
    api.render();
    expect(lista().querySelectorAll('[data-rmc]')).toHaveLength(3);
    const cenaAntes = lista().querySelector('[data-rm="parallax"]');
    temPersonagem = false;
    api.render();
    expect(lista().querySelector('[data-rmc]'), 'a secção do personagem sobreviveu a um jogo que não tem um').toBeNull();
    expect(lista().querySelector('[data-rm="parallax"]'), 'a linha de cena foi refeita sem precisar').toBe(cenaAntes);
  });
});
