// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/shell — a CASCA de DOM (project BROWSER): foco de verdade (document.activeElement), o
// `dataset` do `#touch-controls`, o innerHTML da legenda do título e os dois ouvintes em CAPTURA do modo
// Print. A projeção pura (`phaseView`, `touchControlsPlan`, os chips) está em shell.node.test.js e NÃO é
// repetida aqui.
//
// `numPlayers`/`players` vinham de core/state.ts — os mesmos bindings vivos que o
// game.js usa; o resto do ctx é falso (spies).
import { describe, it, expect, beforeEach } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // a legenda vem do dicionário desde o item 14
import { initShell } from '../app/js/ui/shell.js';
// A CENA é DO TESTE desde 2026-08-26. `phase` saiu de `core/state` — virou a pilha de `core/scenes`, e os
// três nomes moram na raiz de composição (ADR-0030 C3). Quem é engine recebe BOOLEANOS. Este `let` faz o
// papel que o binding vivo fazia, e os casos seguem escritos como estavam.
let faseFalsa = 'playing';
const setPhaseValue = (p) => { faseFalsa = p; };
/** A casca corrente. `setPhase` abaixo faz o papel da RAIZ: troca a cena e manda a casca reprojetar. */
let shellAtual = null;
const setPhase = (p) => { faseFalsa = p; if (shellAtual) shellAtual.aplicarCena(); };
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

// Fiel ao index.html no que a casca toca: o splash, a pausa global aposentada, o botão de pausa, os controles
// de toque, a região do canvas e os menus de pausa por tela (que a casca esconde/mostra, mas NÃO constrói).
const MARKUP = `
  <div id="game-region" tabindex="-1">
    <div id="title-overlay" class="overlay">
      <div id="tm-main"><button id="tm-first" type="button">Jogar</button></div>
      <p id="title-wait" hidden>Aguarde o Jogador 1</p>
      <div class="title-legend" id="title-legend" aria-live="polite"></div>
    </div>
    <div id="pause-overlay" hidden></div>
    <div class="screen-pause" id="sp0" hidden><div class="pause-card">
      <div class="pause-menu" role="menu" data-sub="raiz">
        <button class="pm-btn" data-act="resume" type="button">Continuar</button>
        <button class="pm-btn" data-act="quit" type="button">Sair</button>
      </div>
      <div class="pause-menu" role="menu" data-sub="opcoes" hidden>
        <button class="pm-btn" data-act="caa" type="button">Comunicação</button>
      </div>
    </div></div>
    <div class="screen-pause" id="sp1" hidden><div class="pause-card">
      <div class="pause-menu" role="menu" data-sub="raiz">
        <button class="pm-btn" data-act="resume" type="button">Continuar</button>
      </div>
    </div></div>
  </div>
  <div id="touch-controls" hidden></div>
  <!-- O botão de pausa que EXISTE. O fixture declarava um id (btn-pause) que a produção nunca teve, e por
       isso o caso passava provando que o código escreve num botão que só o teste tem. Quem pausa por toque
       — e num tablet é o ÚNICO caminho, porque não há teclado — é o touch-start. -->
  <button id="touch-start" type="button" aria-label="Pausar ou iniciar (START)">START</button>
`;

function boot(over = {}) {
  document.body.innerHTML = MARKUP;
  setPhaseValue('title');
  setNumPlayersValue(1);
  players.length = 0;
  players.push({ i: 0, pad: -1 });

  const log = { muted: [], hidTouch: 0, reflect: 0, said: [], alerted: [], acts: [] };
  const listeners = { keydown: [], pointerdown: [] };
  let pending = null; // o setTimeout de 80ms do modo Print, disparado à mão pelo teste

  const ctx = {
    // A casca deixou de trocar de cena: ela PROJETA a cena que a raiz já trocou (ADR-0030 C3). O falso faz o
    // papel da raiz — guarda a fase e responde os três fatos. As regras de TRANSIÇÃO (pausar empilha, o
    // título não alterna) mudaram de casa junto, para `game/cenas`, e têm caso próprio lá.
    fatosDaCena: () => ({ telaDeTitulo: faseFalsa === 'title', mundoRodando: faseFalsa === 'playing', menuDePausa: faseFalsa === 'paused' }),
    retomarJogo: () => { setPhase('playing'); },
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    $,
    win: {
      addEventListener: (t, fn) => listeners[t].push(fn),
      removeEventListener: (t, fn) => { listeners[t] = listeners[t].filter((f) => f !== fn); },
      setTimeout: (fn) => { pending = fn; },
    },
    setMasterMuted: (m) => log.muted.push(m),
    srSay: (m) => log.said.push(m),
    srAlert: (m) => log.alerted.push(m),
    getPauseScreens: () => $$('.screen-pause'),
    getPauseActor: () => 0,
    hideTouchControls: () => { log.hidTouch++; const tc = $('#touch-controls'); if (tc && !tc.hidden) tc.hidden = true; },
    reflectPauseIcons: () => { log.reflect++; },
    getGamepads: () => [],
    isTouchMode: () => false,
    padLayoutFromId: () => 'generic',
    padMapFor: () => null,
    kbFor: () => ({ up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], action2: ['Space'], action3: ['KeyL'], action1: ['ShiftLeft'], action4: ['KeyQ'] }),
    keyName: (c) => 'K:' + c,
    // A palavra CURTA vem do 'jogo' — num teste, o fixture. Uma posicao nao nomeada nao vira ficha.
    rotuloCurto: (a) => ({ action1: 'correr', action2: 'pular', action3: 'especial', action4: 'trocar' })[a] || null,
    openCaa: () => log.acts.push('caa'),
    setQuizLevel: (n, a) => log.acts.push('nivel:' + n + ':' + a),
    getQuizLevel: () => 5,
    openTypo: () => log.acts.push('typo'),
    openAudio: () => log.acts.push('audio'),
    openMovement: () => log.acts.push('movement'),
    openVisual: () => log.acts.push('visual'),
    openHelp: () => log.acts.push('help'),
    quitGame: () => log.acts.push('quit'),
    fitsN: () => true,
    joinPlayer: () => { players.push({ i: players.length, pad: -1 }); setNumPlayersValue(players.length); return true; },
    showWaitingBadge: (i) => log.acts.push('badge:' + i),
    setMotorPlayer: (i) => log.acts.push('motor:' + i),
    setMotionPlayer: (i) => log.acts.push('motionPlayer:' + i),
    openMotion: () => log.acts.push('motion'),
    openEmpathy: () => log.acts.push('empathy'),
    setSelVizPlayer: (i) => log.acts.push('selViz:' + i),
    ...over,
  };
  const shell = initShell(ctx);
  shellAtual = shell;
  return { shell, log, listeners, flush: () => { const f = pending; pending = null; if (f) f(); } };
}

beforeEach(() => { document.body.innerHTML = ''; setPhaseValue('title'); setNumPlayersValue(1); });

describe('setPhase — a casca inteira, no documento', () => {
  it('"playing": splash some, pausas somem, som volta e o foco vai para a região do canvas', () => {
    const { shell, log } = boot();
    setPhase('playing');
    expect(faseFalsa).toBe('playing');
    expect($('#title-overlay').hidden).toBe(true);
    expect($$('.screen-pause').every((sp) => sp.hidden)).toBe(true);
    expect(log.muted.at(-1)).toBe(false);
    expect(log.hidTouch).toBe(0);
    expect($('#touch-start').getAttribute('aria-pressed')).toBe('false');
    expect(document.activeElement.id).toBe('game-region');
  });

  it('"paused": TODAS as telas de pausa aparecem, o som cala, o toque some e os ícones se refletem', () => {
    const { shell, log } = boot();
    setPhase('playing');
    setPhase('paused');
    expect($$('.screen-pause').every((sp) => !sp.hidden)).toBe(true);
    expect(log.muted.at(-1)).toBe(true);
    expect(log.hidTouch).toBe(1);
    expect(log.reflect).toBe(1);
    expect($('#touch-start').getAttribute('aria-pressed')).toBe('true');
  });

  // O caso que a linha morta escondia. O reflexo caía em `#btn-pause`, id que a produção nunca teve, e o
  // fixture antigo inventava o elemento — então o teste provava que o código escreve num botão que só ele
  // tem. Agora cai no botão de verdade, que num tablet é o ÚNICO caminho de pausa (não há teclado).
  //
  // E no TÍTULO o atributo SAI, em vez de virar `false`: ali o botão significa "iniciar", e `aria-pressed`
  // num botão que não alterna nada faz o leitor de tela anunciar um estado que não existe.
  //
  // MUTAÇÃO CONFERIDA: trocando o `removeAttribute` por `setAttribute(..., 'false')` em `ui/shell`, este caso
  // falha em "expected 'false' to be null".
  it('no TÍTULO o botão não tem aria-pressed — lá ele é "iniciar", não alterna nada', () => {
    boot();
    setPhase('playing');
    expect($('#touch-start').getAttribute('aria-pressed')).toBe('false');
    setPhase('title');
    expect($('#touch-start').getAttribute('aria-pressed')).toBe(null);
  });

  it('"paused" selecciona Continuar em CADA tela — ninguém fica sem cursor', () => {
    const { shell } = boot();
    setPhase('paused');
    for (const sp of $$('.screen-pause')) {
      const sel = sp.querySelectorAll('.pm-sel');
      expect(sel.length).toBe(1);
      expect(sel[0].dataset.act).toBe('resume');
    }
  });

  it('"title": o splash volta, a legenda é repintada e o foco vai para o 1º botão do menu', () => {
    const { shell } = boot();
    setPhase('playing');
    setPhase('title');
    expect($('#title-overlay').hidden).toBe(false);
    expect($('#title-legend').innerHTML).not.toBe('');
    expect(document.activeElement.id).toBe('tm-first');
  });

  it('⚠️ um `#pause-overlay` no documento é IGNORADO — a casca não o toca (2026-09-08)', () => {
    // A afirmação virou-se do avesso, e é a nova que interessa. Ela dizia «fica escondido em toda fase», e
    // para o afirmar a casca tinha de o procurar e escondê-lo — código a segurar um elemento que a Etapa 2
    // aposentou. Agora o documento pode ter um `#pause-overlay` VISÍVEL de propósito, e a casca passa por
    // ele sem lhe tocar: é a prova de que a pausa global saiu da engine, e não de que ela a esconde bem.
    const { shell } = boot();
    const pa = $('#pause-overlay');
    pa.hidden = false;
    for (const p of ['playing', 'paused', 'title']) {
      setPhase(p);
      expect(pa.hidden, `a casca ainda mexe no #pause-overlay na fase ${p}`).toBe(false);
    }
  });

  // (`togglePause` SAIU daqui em 2026-08-26. Alternar não é projetar: é uma decisão sobre a PILHA, e a pilha
  //  é do jogo. A regra — e o "não faz nada no título" — mora agora em `game/cenas`, com caso próprio em
  //  `tests/cenas.node.test.js`, onde ela é conferível sem documento nenhum.)
});

describe('setPhase e os controles de toque', () => {
  // O ciclo inteiro, que é o que a pessoa faz no celular: jogando com o direcional na tela, pausa, retoma.
  // Isto já esteve quebrado, e de um jeito que só aparecia no aparelho: `hideTouchControls()` rodava ANTES da
  // leitura, então a marca `wasOn` nunca era gravada e o direcional não voltava. O `boot()` deste arquivo tem
  // uma tela só, que é a condição em que o virtual existe.
  it('[Right] pausar com o direcional visível guarda a marca, e retomar o devolve', () => {
    const { shell } = boot();
    setPhase('playing');
    const tc = $('#touch-controls');
    tc.hidden = false; // como se a pessoa estivesse jogando no toque
    setPhase('paused');
    expect(tc.hidden).toBe(true);              // na pausa ele sai da frente
    expect(tc.dataset.wasOn).toBe('1');        // mas fica anotado que estava ligado
    setPhase('playing');
    expect(tc.hidden).toBe(false);             // e volta ao retomar
    expect(tc.dataset.wasOn).toBe(undefined);  // a marca é consumida
  });

  it('[Inverse] quem NÃO estava com o direcional na tela não o ganha ao retomar', () => {
    const { shell } = boot();
    setPhase('playing');
    const tc = $('#touch-controls');
    tc.hidden = true; // jogando no teclado
    setPhase('paused');
    expect(tc.dataset.wasOn).toBe(undefined);
    setPhase('playing');
    expect(tc.hidden).toBe(true);              // continua escondido: pausar não liga o toque de ninguém
  });

  it('com a marca presente na mão, retomar em tela única devolve o direcional (o ramo existe)', () => {
    const { shell } = boot();
    const tc = $('#touch-controls');
    tc.dataset.wasOn = '1';
    setPhase('playing');
    expect(tc.hidden).toBe(false);
    expect(tc.dataset.wasOn).toBe(undefined); // a marca é consumida
  });

  it('em multitela a marca é descartada sem devolver o direcional (o virtual é só de tela única)', () => {
    const { shell } = boot();
    setNumPlayersValue(2);
    const tc = $('#touch-controls');
    tc.dataset.wasOn = '1';
    setPhase('playing');
    expect(tc.hidden).toBe(true);
    expect(tc.dataset.wasOn).toBe(undefined);
  });
});

describe('updateTitleLegend — a legenda por dispositivo', () => {
  it('sem toque e sem controle, mostra as TECLAS CONFIGURADAS (o remap vale na legenda)', () => {
    const { shell } = boot();
    shell.updateTitleLegend();
    const html = $('#title-legend').innerHTML;
    expect(html).toContain('K:KeyW');   // veio do kbFor, não de um literal
    expect(html).toContain('K:Space');
    expect(html).toContain(t('legend.move')); // do dicionário, não do código
    expect(html).not.toMatch(/legend\./);      // e a chave nunca vaza para a tela
    expect($('#title-legend').querySelectorAll('.lg-row').length).toBe(2);
  });

  it('em modo toque, mostra o joystick virtual (✜ + START) e os 4 botões genéricos', () => {
    const { shell } = boot({ isTouchMode: () => true });
    shell.updateTitleLegend();
    const html = $('#title-legend').innerHTML;
    expect(html).toContain('✜');
    expect(html).toContain('START');
    expect(html).not.toContain('K:KeyW');
  });

  it('com um gamepad no padrão, mostra os rótulos do MODELO', () => {
    const { shell } = boot({
      getGamepads: () => [{ index: 0, id: 'Xbox', mapping: 'standard' }],
      padLayoutFromId: () => 'microsoft',
    });
    shell.updateTitleLegend();
    const html = $('#title-legend').innerHTML;
    expect(html).toContain('#2fae4e'); // a cor do A no design microsoft
    expect(html).not.toContain('K:KeyW');
  });

  it('o aviso "Aguarde o Jogador 1" só aparece em multitela', () => {
    const { shell } = boot();
    shell.updateTitleLegend();
    expect($('#title-wait').hidden).toBe(true);
    setNumPlayersValue(3);
    shell.updateTitleLegend();
    expect($('#title-wait').hidden).toBe(false);
  });
});

describe('printMode — ver a tela sem menus', () => {
  it('esconde TODAS as pausas, anuncia como voltar, e só arma os ouvintes depois do adiamento', () => {
    const { shell, log, listeners, flush } = boot();
    setPhase('paused');
    shell.printMode();
    expect($$('.screen-pause').every((sp) => sp.hidden)).toBe(true);
    expect(log.said.at(-1)).toContain('Modo Print');
    // ANTES do adiamento não há ouvinte: é o que impede o próprio evento que abriu o Print de fechá-lo.
    expect(listeners.keydown.length + listeners.pointerdown.length).toBe(0);
    flush();
    expect(listeners.keydown.length).toBe(1);
    expect(listeners.pointerdown.length).toBe(1);
  });

  it('qualquer tecla traz as pausas de volta, com Continuar selecionado, e desarma os dois ouvintes', () => {
    const { shell, listeners, flush } = boot();
    setPhase('paused');
    shell.printMode();
    flush();
    listeners.keydown[0]({ preventDefault() {} });
    expect($$('.screen-pause').every((sp) => !sp.hidden)).toBe(true);
    expect($('#sp0').querySelectorAll('.pm-sel').length).toBe(1);
    expect(listeners.keydown.length + listeners.pointerdown.length).toBe(0);
  });

  it('se o jogo já saiu da pausa, o retorno NÃO reabre os menus (só desarma)', () => {
    const { shell, listeners, flush } = boot();
    setPhase('paused');
    shell.printMode();
    flush();
    setPhase('playing');
    listeners.pointerdown[0]({ preventDefault() {} });
    expect($$('.screen-pause').every((sp) => sp.hidden)).toBe(true);
  });
});

describe('pauseActs — a tabela do menu de pausa', () => {
  it('"Continuar" volta ao jogo', () => {
    const { shell } = boot();
    setPhase('paused');
    shell.pauseActs.resume();
    expect(faseFalsa).toBe('playing');
  });

  it('o nível do quiz cicla 1..5 e volta ao 1 (nunca sai da faixa)', () => {
    const { shell, log } = boot({ getQuizLevel: () => 5 });
    shell.pauseActs.nivel();
    expect(log.acts).toEqual(['nivel:1:true']);
  });

  it('os quatro submenus de a11y escopam no jogador que abriu (pauseActor)', () => {
    const { shell, log } = boot({ getPauseActor: () => 2 });
    shell.pauseActs.motora(); shell.pauseActs.anim(); shell.pauseActs.visual(); shell.pauseActs.empatia();
    expect(log.acts).toEqual(['motor:2', 'movement', 'motionPlayer:2', 'motion', 'selViz:2', 'visual', 'selViz:2', 'empathy']);
  });

  it('"Mais um jogador" cria a tela, marca o novo como esperando e volta ao jogo', () => {
    const { shell, log } = boot();
    setPhase('paused');
    shell.pauseActs.addplayer();
    expect(players.length).toBe(2);
    expect(players[1].waiting).toBe(true);
    expect(log.acts).toEqual(['badge:1']);
    expect(faseFalsa).toBe('playing');
    expect(log.alerted.at(-1)).toContain('Jogador 2');
  });

  it('no 4º jogador, avisa o teto e NÃO cria tela nenhuma', () => {
    const { shell, log } = boot();
    setNumPlayersValue(4);
    shell.pauseActs.addplayer();
    // A frase mudou ao ser unificada com a de game/session: os dois anunciavam o MESMO evento com palavras
    // diferentes ('Máximo de 4 jogadores.' aqui, 'Já são 4 jogadores.' lá). Uma frase por evento.
    expect(log.alerted.at(-1)).toBe('Já são 4 jogadores.');
    expect(log.acts).toEqual([]);
  });

  it('se a tela nova não couber na janela, avisa e NÃO cria — o jogo não fica ilegível', () => {
    const { shell, log } = boot({ fitsN: () => false });
    shell.pauseActs.addplayer();
    // Unificada com a de game/session, que informava o mínimo de 640×360 que esta omitia; a metade acionável
    // ('aumente a janela') veio desta. A frase única diz as duas coisas.
    expect(log.alerted.at(-1)).toContain('cada tela precisa de ao menos 640×360');
    expect(log.alerted.at(-1)).toContain('Aumente a janela ou use tela cheia');
    expect(log.acts).toEqual([]);
  });

  it('se joinPlayer recusar, nada acontece depois dele', () => {
    const { shell, log } = boot({ joinPlayer: () => false });
    shell.pauseActs.addplayer();
    expect(log.acts).toEqual([]);
    expect(log.alerted).toEqual([]);
  });

  it('todo `data-act` do menu tem ação, e nenhuma ação é órfã', () => {
    const { shell } = boot();
    setPhase('paused');
    const usados = new Set($$('.screen-pause .pm-btn').map((b) => b.dataset.act));
    for (const a of usados) expect(typeof shell.pauseActs[a], a).toBe('function');
    // e a tabela cobre exatamente os atos que o game.js declara (a lista viva, para o dia em que divergir)
    expect(Object.keys(shell.pauseActs).sort()).toEqual(
      ['addplayer', 'ajuda', 'anim', 'audio', 'caa', 'empatia', 'motora', 'nivel', 'print', 'quit', 'resume', 'tipo', 'visual'],
    );
  });
});
