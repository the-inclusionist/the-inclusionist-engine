// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/shell — a CASCA de DOM (project BROWSER): foco de verdade (document.activeElement), o
// `dataset` do `#touch-controls`, o innerHTML da legenda do título e os dois ouvintes em CAPTURA do modo
// Print. A projeção pura (`phaseView`, `touchControlsPlan`, os chips) está em shell.node.test.js e NÃO é
// repetida aqui.
//
// `phase`/`numPlayers`/`players` são os módulos REAIS (core/state.ts) — os mesmos bindings vivos que o
// game.js usa; o resto do ctx é falso (spies).
import { describe, it, expect, beforeEach } from 'vitest';
import { initShell } from '../app/js/ui/shell.js';
import { phase, setPhaseValue, setNumPlayersValue, players } from '../app/js/core/state.js';

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
      <button class="pm-btn" data-act="resume" type="button">Continuar</button>
      <button class="pm-btn" data-act="quit" type="button">Sair</button>
    </div></div>
    <div class="screen-pause" id="sp1" hidden><div class="pause-card">
      <button class="pm-btn" data-act="resume" type="button">Continuar</button>
    </div></div>
  </div>
  <div id="touch-controls" hidden></div>
  <button id="btn-pause" type="button" aria-pressed="false">Pausa</button>
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
    kbFor: () => ({ up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], jump: ['Space'], especial: ['KeyL'], run: ['ShiftLeft'], swap: ['KeyQ'] }),
    keyName: (c) => 'K:' + c,
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
  return { shell, log, listeners, flush: () => { const f = pending; pending = null; if (f) f(); } };
}

beforeEach(() => { document.body.innerHTML = ''; setPhaseValue('title'); setNumPlayersValue(1); });

describe('setPhase — a casca inteira, no documento', () => {
  it('"playing": splash some, pausas somem, som volta e o foco vai para a região do canvas', () => {
    const { shell, log } = boot();
    shell.setPhase('playing');
    expect(phase).toBe('playing');
    expect($('#title-overlay').hidden).toBe(true);
    expect($$('.screen-pause').every((sp) => sp.hidden)).toBe(true);
    expect(log.muted.at(-1)).toBe(false);
    expect(log.hidTouch).toBe(0);
    expect($('#btn-pause').getAttribute('aria-pressed')).toBe('false');
    expect(document.activeElement.id).toBe('game-region');
  });

  it('"paused": TODAS as telas de pausa aparecem, o som cala, o toque some e os ícones se refletem', () => {
    const { shell, log } = boot();
    shell.setPhase('playing');
    shell.setPhase('paused');
    expect($$('.screen-pause').every((sp) => !sp.hidden)).toBe(true);
    expect(log.muted.at(-1)).toBe(true);
    expect(log.hidTouch).toBe(1);
    expect(log.reflect).toBe(1);
    expect($('#btn-pause').getAttribute('aria-pressed')).toBe('true');
  });

  it('"paused" selecciona Continuar em CADA tela — ninguém fica sem cursor', () => {
    const { shell } = boot();
    shell.setPhase('paused');
    for (const sp of $$('.screen-pause')) {
      const sel = sp.querySelectorAll('.pm-sel');
      expect(sel.length).toBe(1);
      expect(sel[0].dataset.act).toBe('resume');
    }
  });

  it('"title": o splash volta, a legenda é repintada e o foco vai para o 1º botão do menu', () => {
    const { shell } = boot();
    shell.setPhase('playing');
    shell.setPhase('title');
    expect($('#title-overlay').hidden).toBe(false);
    expect($('#title-legend').innerHTML).not.toBe('');
    expect(document.activeElement.id).toBe('tm-first');
  });

  it('#pause-overlay (pausa GLOBAL aposentada) fica escondido em toda fase', () => {
    const { shell } = boot();
    for (const p of ['playing', 'paused', 'title']) { shell.setPhase(p); expect($('#pause-overlay').hidden, p).toBe(true); }
  });

  it('togglePause alterna jogando⇄pausado e NÃO faz nada no título', () => {
    const { shell } = boot();
    shell.togglePause();
    expect(phase).toBe('title');
    shell.setPhase('playing'); shell.togglePause();
    expect(phase).toBe('paused');
    shell.togglePause();
    expect(phase).toBe('playing');
  });
});

describe('setPhase e os controles de toque', () => {
  // O ciclo inteiro, que é o que a pessoa faz no celular: jogando com o direcional na tela, pausa, retoma.
  // Isto já esteve quebrado, e de um jeito que só aparecia no aparelho: `hideTouchControls()` rodava ANTES da
  // leitura, então a marca `wasOn` nunca era gravada e o direcional não voltava. O `boot()` deste arquivo tem
  // uma tela só, que é a condição em que o virtual existe.
  it('[Right] pausar com o direcional visível guarda a marca, e retomar o devolve', () => {
    const { shell } = boot();
    shell.setPhase('playing');
    const tc = $('#touch-controls');
    tc.hidden = false; // como se a pessoa estivesse jogando no toque
    shell.setPhase('paused');
    expect(tc.hidden).toBe(true);              // na pausa ele sai da frente
    expect(tc.dataset.wasOn).toBe('1');        // mas fica anotado que estava ligado
    shell.setPhase('playing');
    expect(tc.hidden).toBe(false);             // e volta ao retomar
    expect(tc.dataset.wasOn).toBe(undefined);  // a marca é consumida
  });

  it('[Inverse] quem NÃO estava com o direcional na tela não o ganha ao retomar', () => {
    const { shell } = boot();
    shell.setPhase('playing');
    const tc = $('#touch-controls');
    tc.hidden = true; // jogando no teclado
    shell.setPhase('paused');
    expect(tc.dataset.wasOn).toBe(undefined);
    shell.setPhase('playing');
    expect(tc.hidden).toBe(true);              // continua escondido: pausar não liga o toque de ninguém
  });

  it('com a marca presente na mão, retomar em tela única devolve o direcional (o ramo existe)', () => {
    const { shell } = boot();
    const tc = $('#touch-controls');
    tc.dataset.wasOn = '1';
    shell.setPhase('playing');
    expect(tc.hidden).toBe(false);
    expect(tc.dataset.wasOn).toBe(undefined); // a marca é consumida
  });

  it('em multitela a marca é descartada sem devolver o direcional (o virtual é só de tela única)', () => {
    const { shell } = boot();
    setNumPlayersValue(2);
    const tc = $('#touch-controls');
    tc.dataset.wasOn = '1';
    shell.setPhase('playing');
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
    expect(html).toContain('movimentar-se');
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
    shell.setPhase('paused');
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
    shell.setPhase('paused');
    shell.printMode();
    flush();
    listeners.keydown[0]({ preventDefault() {} });
    expect($$('.screen-pause').every((sp) => !sp.hidden)).toBe(true);
    expect($('#sp0').querySelectorAll('.pm-sel').length).toBe(1);
    expect(listeners.keydown.length + listeners.pointerdown.length).toBe(0);
  });

  it('se o jogo já saiu da pausa, o retorno NÃO reabre os menus (só desarma)', () => {
    const { shell, listeners, flush } = boot();
    shell.setPhase('paused');
    shell.printMode();
    flush();
    shell.setPhase('playing');
    listeners.pointerdown[0]({ preventDefault() {} });
    expect($$('.screen-pause').every((sp) => sp.hidden)).toBe(true);
  });
});

describe('pauseActs — a tabela do menu de pausa', () => {
  it('"Continuar" volta ao jogo', () => {
    const { shell } = boot();
    shell.setPhase('paused');
    shell.pauseActs.resume();
    expect(phase).toBe('playing');
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
    shell.setPhase('paused');
    shell.pauseActs.addplayer();
    expect(players.length).toBe(2);
    expect(players[1].waiting).toBe(true);
    expect(log.acts).toEqual(['badge:1']);
    expect(phase).toBe('playing');
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
    shell.setPhase('paused');
    const usados = new Set($$('.screen-pause .pm-btn').map((b) => b.dataset.act));
    for (const a of usados) expect(typeof shell.pauseActs[a], a).toBe('function');
    // e a tabela cobre exatamente os atos que o game.js declara (a lista viva, para o dia em que divergir)
    expect(Object.keys(shell.pauseActs).sort()).toEqual(
      ['addplayer', 'ajuda', 'anim', 'audio', 'caa', 'empatia', 'motora', 'nivel', 'print', 'quit', 'resume', 'tipo', 'visual'],
    );
  });
});
