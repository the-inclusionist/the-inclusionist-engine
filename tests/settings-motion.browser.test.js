// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/settings-motion — render/DOM real (project BROWSER: usa document + querySelector). Injeção por
// closure (mesmo padrão de ui/debug-panel): ctx com $/srSay/store/frontOverlay/toggleBtn/rm/saveRM/rmKeys/rmChar
// FALSOS (spies), mas `players`/`numPlayers` (core/state.ts) e `CRT`/`applyCrt` (render/crt.ts) são os módulos
// REAIS — mesmos que initSettingsMotion importa direto. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initSettingsMotion, getSelectedPlayer, setSelectedPlayer, motionOpen,
} from '../app/js/ui/settings-motion.js';
import { players, setNumPlayersValue } from '../app/js/core/state.js';
import { CRT, applyCrt } from '../app/js/render/crt.js';

const $ = (sel) => document.querySelector(sel);

const RM_KEYS = ['parallax', 'decor', 'items', 'particles'];
const RM_CHAR = [
  { prop: 'rmWalk', lbl: 'Personagem em movimento (andar, escalar, nadar, pular)' },
  { prop: 'rmBreath', lbl: 'Respiração (parado)' },
  { prop: 'rmFlavor', lbl: 'Gracinhas (animações de descanso)' },
];

function markup() {
  // motion-master carrega o texto padrão ESTÁTICO do index.html (só updateMotionMaster()/render() o corrige
  // depois) e #game-region é o alvo que applyCrt() precisa — igual ao boot real (inCanvasMenus reparenta pra lá).
  document.body.innerHTML = `
    <div id="game-region">
      <button id="opt-animation" type="button"></button>
      <div id="animation" hidden>
        <div id="animation-players"></div>
        <button id="motion-master" type="button">⏸ Parar todas as animações</button>
        <div id="motion-list"></div>
      </div>
    </div>`;
}

function makeCtx(over = {}) {
  const calls = { srSay: [], setBool: [], frontOverlay: [], toggleBtn: [], saveRM: 0 };
  const rm = { parallax: false, decor: false, items: false, particles: false };
  const ctx = {
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

  it('[Boundary] select de cantos muda CRT.round e anuncia o nível por extenso', () => {
    const { ctx, calls } = makeCtx();
    initSettingsMotion(ctx).render();
    const sel = $('#motion-list').querySelector('select[data-crt="round"]');
    sel.value = '2';
    sel.dispatchEvent(new Event('change'));
    expect(CRT.round).toBe(2);
    expect(calls.srSay.at(-1)).toBe('Cantos arredondados: grande.');
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
  it('[Interface] open(): renderiza, mostra o overlay, chama frontOverlay, liga motionOpen e foca um botão', () => {
    const { ctx, calls } = makeCtx();
    const api = initSettingsMotion(ctx);
    api.open();
    expect($('#animation').hidden).toBe(false);
    expect(calls.frontOverlay.length).toBe(1);
    expect(motionOpen).toBe(true);
    expect(document.activeElement.tagName).toBe('BUTTON');
  });

  it('[Interface] close(): esconde o overlay, desliga motionOpen e devolve o foco ao botão que abriu', () => {
    const { ctx } = makeCtx();
    const api = initSettingsMotion(ctx);
    api.open();
    api.close();
    expect($('#animation').hidden).toBe(true);
    expect(motionOpen).toBe(false);
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
