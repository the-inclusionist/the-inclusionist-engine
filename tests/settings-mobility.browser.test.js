// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-mobility — render/reflect/setEasy (project BROWSER: usa document). Contrato: DI por
// closure (ctx.$/srSay/store/players/getNumPlayers/setToggleMove/rebuildCoins), nenhum acesso a globais fora
// do ctx. A lógica pura (clamp/predicado/anúncio/HTML das abas) está coberta em settings-mobility.node.test.js.
// Modelo: tests/a11y-sr.browser.test.js, tests/settings-typo.browser.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // os anúncios vêm do dicionário desde o item 14
import { initSettingsMobility } from '../app/js/ui/settings-mobility.js';

const $ = (sel) => document.querySelector(sel);

function fullCtx(over = {}) {
  const said = [];
  const storeMap = new Map();
  const toggleMoveCalls = [];
  const toggleRunCalls = [];
  const escolhido = new Set(); // chaves que a criança de fato mexeu (o que o `store.get` devolveria não-nulo)
  let rebuildCoinsCalls = 0;
  const players = over.players ?? [{ easy: false, toggleMove: false }];
  return {
    $,
    srSay: (msg) => said.push(msg),
    store: { setBool: (k, on) => storeMap.set(k, on ? '1' : '0'), get: (k) => (escolhido.has(k) ? '1' : null) },
    players,
    getNumPlayers: () => (over.numPlayers ?? players.length),
    setToggleMove: (i, on) => { toggleMoveCalls.push([i, on]); players[i].toggleMove = on; },
  // ⚠️ EXPLÍCITO, e a razão é que a ausência dele MUDA todos os casos deste ficheiro. Desde o ADR-0115 um
  // ctx sem este campo esconde a linha da alternância — e trinta casos passariam na mesma, a exercitar uma
  // linha invisível sem nada o dizer. Este fixture é de um jogo que SEGURA, que é a premissa de todos eles.
  seguraTeclas: true,
    setToggleRun: (i, on) => { toggleRunCalls.push([i, on]); players[i].toggleRun = on; escolhido.add('incl_togglerun_p' + i); },
    rebuildCoins: () => { rebuildCoinsCalls++; },
    said,
    storeMap,
    toggleMoveCalls,
    toggleRunCalls,
    escolhido,
    get rebuildCoinsCalls() { return rebuildCoinsCalls; },
    ...over,
  };
}

function mountDom() {
  document.body.innerHTML =
    '<div id="opt-movement" class="mode-btn"></div>' +
    '<div id="movement-players"></div>' +
    '<div class="ctrl-row"><span>Modo Fácil</span><button id="opt-facil" class="mode-btn" type="button" aria-pressed="false">▶ Desligado</button></div>' +
    '<div class="ctrl-row"><span>Alternância</span><span class="opt-hint">Anda sem segurar.</span>'
    + '<button id="opt-altmove" class="mode-btn" type="button" aria-pressed="false">▶ Desligado</button></div>' +
    '<div class="ctrl-row"><span>Alternância do correr</span><button id="opt-togglerun" class="mode-btn" type="button" aria-pressed="false">▶ Desligado</button></div>' +
    '<button id="movement-reset" class="mode-btn" type="button">Restaurar</button>' +
    '<button data-act="motora" class="pm-btn" type="button">Acessibilidade motora</button>' +
    '<button id="opt-eyes" class="mode-btn" type="button" aria-pressed="false">▶ Desligado</button>';
}

describe('ui/settings-mobility', () => {
  beforeEach(() => {
    mountDom();
  });

  /* ===================== ADR-0115 · O JOGO QUE NÃO SEGURA NADA NÃO OFERECE A LINHA =====================
   *
   * 🔴 A alternância existe para quem não consegue MANTER uma tecla premida. Num quiz não há nada a travar, e
   * a linha oferecida na mesma é uma opção que não faz nada: a criança liga o ajuste de que depende e não
   * acontece nada.
   *
   * ⚠️ E É O CONTRÁRIO DO BLOCO LOGO ABAIXO, de propósito. Ali o aparelho EXIGE a alternância e o controle
   * fica `aria-disabled` COM o motivo, alcançável para ela poder lê-lo. Aqui não há motivo que ajude, porque
   * não há nada que o controle pudesse fazer — e um lugar a mais na navegação por teclado, entre dois que
   * funcionam, é custo sem contrapartida. */
  describe('a linha da alternância num jogo que não segura teclas', () => {
    it('🎯 [Zero] com `seguraTeclas: false`, a linha fica AUSENTE — não desabilitada', () => {
      const ctx = fullCtx();
      ctx.seguraTeclas = false;
      initSettingsMobility(ctx);

      const linha = document.querySelector('#opt-altmove')?.closest('.ctrl-row');
      expect(linha, 'a linha do `#opt-altmove` desapareceu do fixture').not.toBeNull();
      expect(linha.hidden, 'a linha ficou visível num jogo que não segura nada').toBe(true);
      // ⚠️ E NÃO `aria-disabled`: essa é a resposta da cláusula 3 do ADR-0113, e usá-la aqui deixaria na tela
      // um controle que explica por que não faz nada — que continua a ser um controle que não faz nada.
      expect(document.querySelector('#opt-altmove').getAttribute('aria-disabled'),
        'a ausência do ADR-0115 foi confundida com a recusa do ADR-0113').toBeNull();
    });

    it('⚠️ [Right] e o PAR: com `seguraTeclas: true` a linha FICA — senão «ausente» passaria por esconder tudo', () => {
      const ctx = fullCtx();
      initSettingsMobility(ctx);
      const linha = document.querySelector('#opt-altmove').closest('.ctrl-row');
      expect(linha.hidden, 'a linha sumiu num jogo que segura teclas').toBe(false);
    });

    it('📌 [Boundary] a ausência é do JOGO e não do aparelho — as duas regras não se confundem', () => {
      // Com o olhar em uso (que EXIGE alternância) mas num jogo que não segura nada, a ausência ganha: não há
      // o que exigir. Uma implementação que lesse só o transporte deixaria a linha desabilitada e visível.
      const ctx = fullCtx();
      ctx.seguraTeclas = false;
      ctx.transporteEmUso = () => 'olhos';
      initSettingsMobility(ctx);

      expect(document.querySelector('#opt-altmove').closest('.ctrl-row').hidden).toBe(true);
    });
  });

  // ========================= A CLÁUSULA 3 DO ADR-0113, NA TELA =========================
  // «É impossível desligá-la em modos que não tem como funcionar sem ela (voz e câmera)» — a frase do Dev.
  // O modelo puro vive em `ui/latch-refusal`; aqui afirma-se o que a criança encontra.
  describe('a alternância exigida pelo aparelho', () => {
    it('🔴 [Right] com o olhar em uso, o controle fica `aria-disabled` e a dica diz POR QUÊ', () => {
      const ctx = fullCtx();
      ctx.transporteEmUso = () => 'olhos';
      initSettingsMobility(ctx);

      expect($('#opt-altmove').getAttribute('aria-disabled'), 'o controle continua a parecer accionável').toBe('true');
      const dica = document.querySelector('#opt-altmove').closest('.ctrl-row').querySelector('.opt-hint');
      expect(dica.textContent, 'a dica não diz por que o botão não responde')
        .toContain('precisa das teclas de alternância');
      // 📌 E a dica ORIGINAL não se perde: a explicação da linha continua lá, com o motivo a seguir.
      expect(dica.textContent).toContain('Anda sem segurar.');
    });

    // ⚠️ «Aceitar o clique e ignorá-lo» é a outra metade do que o ADR-0076 proíbe. Aqui o ouvinte é ligado
    // uma vez e não pode ser omitido como no `render/viz-setters`, então a recusa FALA.
    it('🔴 [Zero] clicar não liga nada, e a recusa é DITA em vez de silenciosa', () => {
      const ctx = fullCtx();
      ctx.transporteEmUso = () => 'olhos';
      initSettingsMobility(ctx);
      $('#opt-altmove').click();

      expect(ctx.players[0].toggleMove, 'o clique mexeu num ajuste que este aparelho exige').toBe(false);
      expect(ctx.said.join(' '), 'o botão não respondeu e não disse nada — a criança fica sem saber')
        .toContain('precisa das teclas de alternância');
    });

    // 🎯 O CASO QUE O PRECEDENTE NÃO PRECISOU DE TER, e é a diferença de forma entre os dois: o
    // `render/viz-setters` reconstrói a lista a cada render, então acrescentar o motivo à dica basta. Este
    // botão é persistente e a criança larga a webcam e volta ao teclado — sem restaurar, o motivo
    // acumular-se-ia na linha a cada troca de aparelho.
    it('🎯 [Boundary] ao voltar para o teclado, a recusa sai e a dica volta ao que era', () => {
      const ctx = fullCtx();
      let aparelho = 'olhos';
      ctx.transporteEmUso = () => aparelho;
      const api = initSettingsMobility(ctx);

      aparelho = 'teclado';
      api.reflectAltMove();

      expect($('#opt-altmove').getAttribute('aria-disabled'), 'ficou desabilitado depois de o aparelho mudar')
        .toBe(null);
      const dica = document.querySelector('#opt-altmove').closest('.ctrl-row').querySelector('.opt-hint');
      expect(dica.textContent, 'o motivo ficou colado na dica').toBe('Anda sem segurar.');
    });

    // 📌 SEM A RAIZ A RESPONDER, nada disto acontece — o campo é opcional e o painel comporta-se como antes.
    it('📌 [Zero] sem `transporteEmUso`, o controle continua accionável', () => {
      const ctx = fullCtx();
      initSettingsMobility(ctx);
      expect($('#opt-altmove').getAttribute('aria-disabled')).toBe(null);
      $('#opt-altmove').click();
      expect(ctx.players[0].toggleMove).toBe(true);
    });
  });

  it('[Zero] initSettingsMotor reflete o estado inicial (tudo desligado) sem anunciar', () => {
    const ctx = fullCtx();
    initSettingsMobility(ctx);
    expect($('#opt-facil').classList.contains('is-on')).toBe(false);
    expect($('#opt-altmove').classList.contains('is-on')).toBe(false);
    expect($('#opt-movement').classList.contains('is-on')).toBe(false);
    expect(ctx.said).toHaveLength(0); // boot não fala
  });

  it('[Interface] initSettingsMotor reflete Fácil já ligado no jogador 0 ao montar', () => {
    const ctx = fullCtx({ players: [{ easy: true, toggleMove: false }] });
    initSettingsMobility(ctx);
    expect($('#opt-facil').classList.contains('is-on')).toBe(true);
    expect($('#opt-facil').getAttribute('aria-pressed')).toBe('true');
    expect($('#opt-facil').textContent).toBe('Ligado');
    expect($('#opt-movement').classList.contains('is-on')).toBe(true); // barra acende
  });

  it('[Right] clicar em #opt-facil chama setEasy, persiste, reflete e anuncia', () => {
    const ctx = fullCtx();
    initSettingsMobility(ctx);
    $('#opt-facil').click();
    expect(ctx.players[0].easy).toBe(true);
    expect(ctx.storeMap.get('incl_easy_p0')).toBe('1');
    expect($('#opt-facil').classList.contains('is-on')).toBe(true);
    expect(ctx.rebuildCoinsCalls).toBe(1);
    // Contra `t()` e não contra a frase: fixar o português aqui devolveria ao teste o texto que o item 14
    // tirou do código. O caso continua pegando chave trocada — `easyOn` e `easyOff` dão frases diferentes.
    expect(ctx.said).toEqual([t('sr.motor.easyOn')]);
  });

  it('[Right] clicar de novo em #opt-facil desliga e anuncia a versão curta', () => {
    const ctx = fullCtx({ players: [{ easy: true, toggleMove: false }] });
    initSettingsMobility(ctx);
    $('#opt-facil').click();
    expect(ctx.players[0].easy).toBe(false);
    expect(ctx.said.at(-1)).toBe('Modo Fácil desligado.');
  });

  it('[Right] a marca do ADR-0029 acompanha a alternância do correr quando ela foi ESCOLHIDA', () => {
    // A marca existe para a criança achar o que ela mudou e poder desfazer. O ajuste novo nascia sem padrão
    // declarado e sem marca — falha minha ao entregá-lo.
    const ctx = fullCtx({ players: [{ easy: false, toggleMove: false, toggleRun: true }] });
    ctx.escolhido.add('incl_togglerun_p0'); // a criança mexeu neste controle
    initSettingsMobility(ctx);
    expect($('#opt-togglerun').closest('.ctrl-row').classList.contains('is-changed')).toBe(true);
    expect($('[data-act="motora"]').classList.contains('is-changed'), 'a marca do MENU também acende').toBe(true);
  });

  it('[Boundary] ligada SOZINHA no toque, ela NÃO é marcada — a criança não mexeu em nada', () => {
    // A sutileza que só existe neste ajuste: ele liga sozinho no controle de tela. Marcar ali acenderia a
    // marca para 100% de quem joga em tablet, sem ninguém ter tocado — e uma marca sempre acesa não significa
    // nada. Pior: o comentário do reset deste menu já diz que "uma marca errada manda a criança desfazer o
    // que ela nunca mexeu". O que marca é a ESCOLHA guardada, não o estado.
    const ctx = fullCtx({ players: [{ easy: false, toggleMove: false, toggleRun: true }] });
    initSettingsMobility(ctx); // sem valor guardado: foi o toque que ligou
    expect($('#opt-togglerun').closest('.ctrl-row').classList.contains('is-changed')).toBe(false);
    expect($('[data-act="motora"]').classList.contains('is-changed')).toBe(false);
  });

  it('[Right] clicar em #opt-togglerun delega no setToggleRun INJETADO e reflete', () => {
    // A alternância do CORRER é irmã da de movimento e segue a mesma forma: quem persiste e anuncia é a raiz
    // (ela conhece `players` e o armazenamento); o painel só delega e reflete. O ajuste existe porque a
    // alternância de movimento resolvia METADE — quem toca com um dedo andava sem segurar e continuava sem
    // conseguir CORRER, que ainda exigia manter pressionado.
    const ctx = fullCtx();
    const api = initSettingsMobility(ctx);
    $('#opt-togglerun').click();
    expect(ctx.toggleRunCalls).toEqual([[0, true]]);
    expect($('#opt-togglerun').getAttribute('aria-pressed')).toBe('true');
    expect($('#opt-togglerun').classList.contains('is-on')).toBe(true);
    $('#opt-togglerun').click();
    expect(ctx.toggleRunCalls.at(-1)).toEqual([0, false]);
    expect(api.reflectToggleRun, 'o painel tem de expor o reflexo — a raiz o chama ao ligar no toque').toBeTypeOf('function');
  });

  it('[Right] clicar em #opt-altmove delega no setToggleMove INJETADO (compartilhado) e reflete', () => {
    const ctx = fullCtx();
    initSettingsMobility(ctx);
    $('#opt-altmove').click();
    expect(ctx.toggleMoveCalls).toEqual([[0, true]]);
    expect($('#opt-altmove').classList.contains('is-on')).toBe(true);
    expect($('#opt-altmove').getAttribute('aria-pressed')).toBe('true');
  });

  it('[Interface] renderMovPlayers mantém #movement-players hidden mesmo com >1 jogador (decisão E3)', () => {
    const ctx = fullCtx({ players: [{ easy: false, toggleMove: false }, { easy: false, toggleMove: false }] });
    const api = initSettingsMobility(ctx);
    api.renderMovPlayers();
    const tabs = $('#movement-players');
    expect(tabs.hidden).toBe(true);
    expect(tabs.querySelectorAll('button[data-mp]')).toHaveLength(2);
  });

  it('[Right] clicar numa aba de jogador troca a seleção e re-reflete Fácil/alternância desse jogador', () => {
    const ctx = fullCtx({
      players: [{ easy: false, toggleMove: false }, { easy: true, toggleMove: true }],
    });
    const api = initSettingsMobility(ctx);
    api.renderMovPlayers();
    $('#movement-players').querySelector('button[data-mp="1"]').click();
    expect(api.getSelPlayer()).toBe(1);
    expect($('#opt-facil').classList.contains('is-on')).toBe(true);
    expect($('#opt-altmove').classList.contains('is-on')).toBe(true);
  });

  it('[Boundary/Edge-case] jogador selecionado >= numPlayers clampa para 0 (o clamp do código atual)', () => {
    const ctx = fullCtx({
      players: [{ easy: true, toggleMove: false }, { easy: false, toggleMove: false }],
      numPlayers: 1, // encolheu de 2 para 1 jogador
    });
    const api = initSettingsMobility(ctx);
    api.setSelPlayer(1); // seleção antiga, agora fora do intervalo
    api.renderMovPlayers();
    expect(api.getSelPlayer()).toBe(0); // clampou de volta
  });

  it('[Right] setSelPlayer troca a seleção (mirrors `selMovPlayer = pauseActor` do game.js)', () => {
    const ctx = fullCtx({
      players: [{ easy: false, toggleMove: false }, { easy: true, toggleMove: false }],
    });
    const api = initSettingsMobility(ctx);
    api.setSelPlayer(1);
    api.reflectFacil();
    expect($('#opt-facil').classList.contains('is-on')).toBe(true);
  });

  it('[Error] setEasy com índice fora do array não lança (mirrors o guard `if(!p)return`)', () => {
    const ctx = fullCtx();
    const api = initSettingsMobility(ctx);
    expect(() => api.setEasy(5, true)).not.toThrow();
    expect(ctx.said).toHaveLength(0); // no-op: não anunciou
  });

  it('[Zero] sem os elementos no DOM, render/reflect não lançam (só não desenham)', () => {
    document.body.innerHTML = '';
    const ctx = fullCtx();
    const api = initSettingsMobility(ctx);
    expect(() => { api.renderMovPlayers(); api.reflectFacil(); api.reflectAltMove(); }).not.toThrow();
  });
});

describe('ui/settings-mobility — restaurar padrões DESTE menu (ADR-0028)', () => {
  beforeEach(() => { mountDom(); });

  it('[Right] devolve Modo Fácil e alternância de TODOS os jogadores, não só o selecionado', () => {
    // O painel edita um jogador por vez, mas o reset é do MENU: deixar o jogador 2 em Modo Fácil porque a aba
    // aberta era a do jogador 1 daria dois estados diferentes com um só nome.
    const players = [{ easy: true, toggleMove: true }, { easy: true, toggleMove: false }];
    const ctx = fullCtx({ players });
    initSettingsMobility(ctx);
    $('#movement-reset').click();
    expect(players).toEqual([{ easy: false, toggleMove: false }, { easy: false, toggleMove: false }]);
  });

  it('[Interface] NÃO desliga o controle pelos olhos — um reset não pode tirar o ponteiro de quem clica com ele', () => {
    // A criança que joga com os olhos aponta com os olhos. Desligar a webcam a deixaria sem como clicar o
    // botão de volta: o reset teria criado a armadilha que existe para desfazer.
    const ctx = fullCtx();
    initSettingsMobility(ctx);
    $('#opt-eyes').setAttribute('aria-pressed', 'true');
    $('#movement-reset').click();
    expect($('#opt-eyes').getAttribute('aria-pressed')).toBe('true');
  });

  it('[Interface] o anúncio DIZ o que ficou de fora — senão a criança conclui que o botão não funcionou', () => {
    const ctx = fullCtx({ players: [{ easy: true, toggleMove: false }] });
    initSettingsMobility(ctx);
    $('#movement-reset').click();
    expect(ctx.said.at(-1)).toContain('olhos');
    expect(ctx.said.at(-1)).toContain('mapeamento');
  });

  it('🔴 [Right] and the run toggle comes back too — the three preferences, not two', () => {
    const players = [{ easy: false, toggleMove: false, toggleRun: true }];
    const ctx = fullCtx({ players });
    initSettingsMobility(ctx);
    $('#movement-reset').click();
    expect(players[0].toggleRun, 'the run toggle survived the reset').toBe(false);
    expect(ctx.toggleRunCalls.at(-1)).toEqual([0, false]);
  });

  it('[Zero] com tudo já no padrão, não escreve nem chama setToggleMove', () => {
    const ctx = fullCtx();
    initSettingsMobility(ctx);
    ctx.storeMap.clear();
    $('#movement-reset').click();
    expect(ctx.toggleMoveCalls).toEqual([]);
    expect(ctx.storeMap.size).toBe(0);
  });
});

describe('ui/settings-mobility — marca o que saiu do padrão (ADR-0029)', () => {
  beforeEach(() => { mountDom(); });

  const linha = (id) => $(id).closest('.ctrl-row');

  it('[Right] Modo Fácil ligado marca a linha dele e o botão do menu', () => {
    const ctx = fullCtx({ players: [{ easy: true, toggleMove: false }] });
    initSettingsMobility(ctx);
    expect(linha('#opt-facil').classList.contains('is-changed')).toBe(true);
    expect(linha('#opt-altmove').classList.contains('is-changed')).toBe(false);
    expect($('[data-act="motora"]').classList.contains('is-changed')).toBe(true);
  });

  it('[Boundary] o menu só desmarca quando a ÚLTIMA opção volta — não quando a primeira volta', () => {
    // Se o menu limpasse a marca cedo demais, a opção ainda alterada ficaria escondida atrás de um menu que
    // diz estar intocado, e a criança procuraria em todo lugar menos onde está.
    const players = [{ easy: true, toggleMove: true }];
    const ctx = fullCtx({ players });
    const api = initSettingsMobility(ctx);
    api.setEasy(0, false);
    expect($('[data-act="motora"]').classList.contains('is-changed')).toBe(true);
    $('#movement-reset').click();
    expect($('[data-act="motora"]').classList.contains('is-changed')).toBe(false);
  });

  it('[Zero] tudo no padrão: nada marcado', () => {
    const ctx = fullCtx();
    initSettingsMobility(ctx);
    expect(document.querySelectorAll('.is-changed')).toHaveLength(0);
  });
});

describe('o ctx que a ENGINE consegue montar sozinha (ADR-0106 §1)', () => {
  beforeEach(() => { mountDom(); });

  it('🎯 [Zero] sem `rebuildCoins` e sem `setToggleRun`, o painel continua INTEIRO', () => {
    // ⚠️ ESTE CASO NASCEU DE UMA MUTAÇÃO SOBREVIVENTE: tirar o padrão de `rebuildCoins` não reprovava nada,
    // porque TODOS os fixtures deste ficheiro o injectam. Um campo tornado opcional sem um caso que o omita é
    // uma promessa que ninguém verifica — e a promessa aqui é a que decide se a engine pode montar o painel.
    //
    // 📌 As duas ausências significam coisas diferentes, e as duas têm de ficar bem: `setToggleRun` é uma
    // ESCRITA que a engine agora sabe fazer (`setRunLatch`); `rebuildCoins` é a REACÇÃO DO
    // MUNDO, que continua a ser do jogo — e cuja falta não pode apagar a escolha da criança.
    const players = [{ easy: false, toggleMove: false, toggleRun: false, walkDir: 0 }];
    const guardado = new Map();
    const ditos = [];
    initSettingsMobility({
      $,
      srSay: (m) => ditos.push(m),
      store: { setBool: (k, on) => guardado.set(k, on ? '1' : '0'), get: () => null },
      players,
      getNumPlayers: () => 1,
      seguraTeclas: true,
    });

    $('#opt-facil').click();
    expect(players[0].easy, 'sem `rebuildCoins` o Modo Fácil deixou de ligar').toBe(true);
    expect(guardado.get('incl_easy_p0'), 'a escolha não foi persistida').toBe('1');
    expect(ditos.at(-1), 'o Modo Fácil ligou em silêncio, para quem ouve em vez de ver')
      .toBe(t('sr.motor.easyOn'));

    $('#opt-togglerun').click();
    expect(players[0].toggleRun, 'sem `setToggleRun` a linha do correr ficou morta').toBe(true);
    expect(guardado.get('incl_togglerun_p0'), 'a escolha do correr não foi persistida').toBe('1');
    expect(ditos.at(-1)).toBe(t('sr.motor.toggleRunOn'));

    // 🔴 and the move toggle too: its writer is the engine's as well when the host does not inject one (`setMoveLatch`)
    $('#opt-altmove').click();
    expect(players[0].toggleMove, 'sem `setToggleMove` a alternância de marcha ficou morta').toBe(true);
    expect(guardado.get('incl_togglemove_p0'), 'a escolha da marcha não foi persistida').toBe('1');
  });
});
