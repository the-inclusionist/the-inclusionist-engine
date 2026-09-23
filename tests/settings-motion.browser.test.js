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
import { t } from '../app/js/core/i18n.js';
import { RM_LABEL } from '../app/js/ui/settings-motion.js';

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

  it('🔴 [Right] os cantos são PASSOS ⯇ ⯈: um passo muda CRT.round, anuncia, e o controle fica no sítio (ADR-0151)', () => {
    const { ctx, calls } = makeCtx();
    CRT.round = 1;
    initSettingsMotion(ctx).render();
    const passos = $('#motion-list').querySelector('[data-crt="round"][data-passos]');
    expect(passos, 'os cantos não viraram passos').not.toBeNull();
    expect($('#motion-list').querySelector('select[data-crt]'), 'sobrou o <select> antigo').toBeNull();
    // 🔴 UMA LINHA SÓ, «◀ Cantos arredondados: pequeno ▶» (errata do ADR-0130): nada de rótulo à esquerda da caixa.
    expect(passos.closest('.ctrl-row').children.length, 'sobrou o rótulo à parte, ao lado dos passos').toBe(1);
    expect(passos.querySelector('.passo-valor').textContent).toBe('Cantos arredondados: pequeno');
    passos.querySelector('[data-passo="1"]').click();
    expect(CRT.round).toBe(2);
    expect(calls.srSay.at(-1)).toBe('Cantos arredondados: grande.');
    // ⚠️ O MESMO NÓ, e não um redesenho: redesenhar a lista tirava o foco a quem está a ajustar.
    expect(passos.isConnected, 'o passo redesenhou a lista e o controle focado saiu do documento').toBe(true);
    expect(passos.getAttribute('aria-valuetext')).toBe('grande');
  });

  it('🔴 [Right] e sobrevive ao clique da linha AO LADO — o caso acima só media o próprio passo', () => {
    // 📏 Medido no `dist` em 2026-09-23, com o SW morto: focar os cantos e clicar no interruptor de scanlines
    // destruía o controle e atirava o foco para o `BODY` — a criança que navega por teclado perdia o lugar no painel
    // inteiro, e não só na linha. 🎯 E a intenção estava ESCRITA ao lado: o tratador do passo evita redesenhar
    // «porque redesenhar tirava o foco de quem ajusta». O que a desfazia era a linha vizinha, que redesenha.
    const { ctx } = makeCtx();
    CRT.round = 1;
    CRT.scan = 1;
    initSettingsMotion(ctx).render();
    // ⚠️ O painel do fixture nasce `hidden`, e um descendente de um elemento escondido NÃO aceita foco: sem esta
    // linha o caso ficava vermelho por não conseguir focar, que é um vermelho pela razão errada.
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
    // ⚠️ COM BOLHA, como os DOIS produtores reais deste evento o despacham — a seta tocada
    // (`ui/panel-widgets`) e a esquerda/direita do teclado e do controle (`ui/menu-nav`). A escuta passou do
    // controle para a lista quando este painel virou nós, porque as linhas vêm e vão com o cartucho; um
    // despacho sem bolha era uma forma que nenhum caminho real usa.
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


// ==========================================================================================================
// AS LINHAS DESTE PAINEL, AGORA EM NÓS (ADR-0129; ADR-0221 passo 7c)
//
// 📌 OITO CASOS MUDARAM DE PROJECTO, e não de exigência. Mediam as CADEIAS que o `motionRowHtml`, o
// `buildCharRowsHtml`, o `buildSceneRowsHtml`, o `crtToggleRowHtml` e o `crtRoundRowHtml` devolviam; o painel
// passou a construir NÓS com o kit, logo as cadeias deixaram de existir e o que eles afirmam passou a ser
// observável só num documento.
//
// ⚠️ DOIS NÃO VIERAM, e é o certo: mediam o mecanismo «em breve», que saiu com a conversão por não ter assunto
// — `RM_SOON` era um conjunto vazio desde que o cartucho deixou o repositório, e os únicos que lhe davam um
// valor eram esses dois casos. Um mecanismo cujo único utilizador é um teste não é um mecanismo.
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
    // 🔴 E JÁ NÃO HÁ LUGAR VAZIO: a cadeia deixava um `<span data-passos-lugar>` que o render trocava pelo
    // controle a cada passagem, e era essa troca que tirava o foco de quem ajustava.
    expect(lista().querySelector('[data-passos-lugar]'), 'sobrou o lugar que a cadeia deixava').toBeNull();
  });

  it('🔴 [Right] uma linha que perde o assunto é REMOVIDA, e as outras não são refeitas (ADR-0153)', () => {
    // 📌 O par do caso do foco: montar uma vez só é honesto se o que deixa de ter assunto sair mesmo. Aqui o
    // cartucho passa a dizer que não tem personagem, e as três linhas dele têm de desaparecer — enquanto as da
    // cena, que continuam a ter assunto, têm de ser os MESMOS nós.
    let temPersonagem = true;
    const { ctx } = makeCtx({ comPersonagem: () => temPersonagem });
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
