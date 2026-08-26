// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-motion — render/DOM real (project BROWSER: usa document + querySelector). Injeção por
// closure (mesmo padrão de ui/debug-panel): ctx com $/srSay/store/frontOverlay/toggleBtn/rm/saveRM/rmKeys/rmChar
// FALSOS (spies), mas `players`/`numPlayers` (core/state.ts) e `CRT`/`applyCrt` (render/crt.ts) são os módulos
// REAIS — mesmos que initSettingsMotion importa direto. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initSettingsMotion, getSelectedPlayer, setSelectedPlayer,
} from '../app/js/ui/settings-motion.js';
import { createRunState } from '../app/js/core/run-state.js';
// A RODADA é local a este arquivo desde 2026-08-26 (ADR-0038, Fase B): `players`/`numPlayers` deixaram de
// ser `let` de `core/state` e passaram a viver na instância que a raiz de composição possui. Aqui o teste
// cria a sua, e os apelidos abaixo mantêm o corpo dos casos escrito como sempre esteve.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);

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
  // O padrão deste menu é o ÚNICO que não é constante: é `prefers-reduced-motion`. No ambiente de teste a
  // consulta responde `false`, então "padrão" aqui é animado — e é contra ISSO que os casos comparam, nunca
  // contra um `false` escrito à mão, que é justamente o erro que este menu convida a cometer.
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
    // O caso que este menu existe para não errar, e que os outros quatro casos não conseguiam pegar: com
    // `defaultReducedMotion()` respondendo false no ambiente de teste, "ler o padrão" e "escrever false" dão
    // o mesmo resultado, e uma mutação trocando um pelo outro passava despercebida. Aqui o sistema diz
    // `reduce`, e aí os dois deixam de ser a mesma coisa: escrever false RELIGARIA a animação na tela de
    // quem já pediu para não ter — o reset fazendo, sozinho, o que a WCAG 2.3.3 existe para impedir.
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
      // E nada disso conta como "alterado": é o padrão desta máquina, não escolha da criança.
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
