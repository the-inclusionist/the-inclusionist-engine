// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-mobility — render/reflect/setEasy (BROWSER project: uses document). Contract: DI by closure
// (ctx.$/srSay/store/players/getNumPlayers/setToggleMove/rebuildCoins), no access to globals outside the ctx. The pure
// logic (clamp/predicate/announcement/tabs HTML) is covered in settings-mobility.node.test.js.
// Model: tests/a11y-sr.browser.test.js, tests/settings-typo.browser.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // the announcements come from the dictionary (item 14)
import { initSettingsMobility } from '../app/js/ui/settings-mobility.js';

const $ = (sel) => document.querySelector(sel);

function fullCtx(over = {}) {
  const said = [];
  const storeMap = new Map();
  const toggleMoveCalls = [];
  const toggleRunCalls = [];
  const escolhido = new Set(); // keys the child actually changed (what `store.get` would return non-null)
  let rebuildCoinsCalls = 0;
  const players = over.players ?? [{ easy: false, toggleMove: false }];
  return {
    $,
    srSay: (msg) => said.push(msg),
    store: { setBool: (k, on) => storeMap.set(k, on ? '1' : '0'), get: (k) => (escolhido.has(k) ? '1' : null) },
    players,
    getNumPlayers: () => (over.numPlayers ?? players.length),
    setToggleMove: (i, on) => { toggleMoveCalls.push([i, on]); players[i].toggleMove = on; },
  // ⚠️ EXPLICIT, because its absence CHANGES every case in this file. Since ADR-0115 a ctx without this field hides the
  // latch row — and the cases would pass anyway, exercising an invisible row with nothing saying so. This fixture is a
  // game that HOLDS keys, which is the premise of all of them.
  holdsKeys: true,
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

  /* ===================== ADR-0115 · THE GAME THAT HOLDS NOTHING DOES NOT OFFER THE ROW =====================
   *
   * 🔴 The latch exists for whoever cannot HOLD a key down. In a quiz there is nothing to latch, and the row offered
   * anyway is an option that does nothing: the child turns on the setting she depends on and nothing happens.
   *
   * ⚠️ AND IT IS THE OPPOSITE OF THE BLOCK JUST BELOW, on purpose. There the device REQUIRES the latch and the control
   * is `aria-disabled` WITH the reason, reachable so she can read it. Here no reason helps, because there is nothing the
   * control could do — and one more stop in keyboard navigation, between two that work, is a cost with no return. */
  describe('a linha da alternância num jogo que não segura teclas', () => {
    it('🎯 [Zero] com `seguraTeclas: false`, a linha fica AUSENTE — não desabilitada', () => {
      const ctx = fullCtx();
      ctx.holdsKeys = false;
      initSettingsMobility(ctx);

      const linha = document.querySelector('#opt-altmove')?.closest('.ctrl-row');
      expect(linha, 'a linha do `#opt-altmove` desapareceu do fixture').not.toBeNull();
      expect(linha.hidden, 'a linha ficou visível num jogo que não segura nada').toBe(true);
      // ⚠️ AND NOT `aria-disabled`: that is the answer of clause 3 of ADR-0113, and using it here would leave on screen
      // a control that explains why it does nothing — which is still a control that does nothing.
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
      // With gaze in use (which REQUIRES the latch) but in a game that holds nothing, the absence wins: there is
      // nothing to require. An implementation reading only the transport would leave the row disabled and visible.
      const ctx = fullCtx();
      ctx.holdsKeys = false;
      ctx.transportInUse = () => 'olhos';
      initSettingsMobility(ctx);

      expect(document.querySelector('#opt-altmove').closest('.ctrl-row').hidden).toBe(true);
    });
  });

  // ========================= CLAUSE 3 OF ADR-0113, ON SCREEN =========================
  // «É impossível desligá-la em modos que não tem como funcionar sem ela (voz e câmera)» — the Dev's sentence.
  // The pure model lives in `ui/latch-refusal`; here what the child finds is asserted.
  describe('a alternância exigida pelo aparelho', () => {
    it('🔴 [Right] com o olhar em uso, o controle fica `aria-disabled` e a dica diz POR QUÊ', () => {
      const ctx = fullCtx();
      ctx.transportInUse = () => 'olhos';
      initSettingsMobility(ctx);

      expect($('#opt-altmove').getAttribute('aria-disabled'), 'o controle continua a parecer accionável').toBe('true');
      const dica = document.querySelector('#opt-altmove').closest('.ctrl-row').querySelector('.opt-hint');
      expect(dica.textContent, 'a dica não diz por que o botão não responde')
        .toContain('precisa das teclas de alternância');
      // 📌 And the ORIGINAL hint is not lost: the row's explanation is still there, with the reason after it.
      expect(dica.textContent).toContain('Anda sem segurar.');
    });

    // ⚠️ «Aceitar o clique e ignorá-lo» is the other half of what ADR-0076 forbids. Here the listener is wired once and
    // cannot be omitted as in `render/viz-setters`, so the refusal SPEAKS.
    it('🔴 [Zero] clicar não liga nada, e a recusa é DITA em vez de silenciosa', () => {
      const ctx = fullCtx();
      ctx.transportInUse = () => 'olhos';
      initSettingsMobility(ctx);
      $('#opt-altmove').click();

      expect(ctx.players[0].toggleMove, 'o clique mexeu num ajuste que este aparelho exige').toBe(false);
      expect(ctx.said.join(' '), 'o botão não respondeu e não disse nada — a criança fica sem saber')
        .toContain('precisa das teclas de alternância');
    });

    // 🎯 THE CASE THE PRECEDENT DID NOT NEED, and it is the difference in shape between the two: `render/viz-setters`
    // rebuilds the list on every render, so appending the reason to the hint is enough. This button persists and the
    // child puts the webcam down and goes back to the keyboard — without restoring, the reason would pile up on the row
    // at every device switch.
    it('🎯 [Boundary] ao voltar para o teclado, a recusa sai e a dica volta ao que era', () => {
      const ctx = fullCtx();
      let aparelho = 'olhos';
      ctx.transportInUse = () => aparelho;
      const api = initSettingsMobility(ctx);

      aparelho = 'teclado';
      api.reflectAltMove();

      expect($('#opt-altmove').getAttribute('aria-disabled'), 'ficou desabilitado depois de o aparelho mudar')
        .toBe(null);
      const dica = document.querySelector('#opt-altmove').closest('.ctrl-row').querySelector('.opt-hint');
      expect(dica.textContent, 'o motivo ficou colado na dica').toBe('Anda sem segurar.');
    });

    // 📌 WITHOUT THE ROOT ANSWERING, none of this happens — the field is optional and the panel behaves as with no device.
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
    expect(ctx.said).toHaveLength(0); // boot does not speak
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
    // Against `t()` and not against the sentence: pinning the Portuguese here would bring back into the test the text
    // item 14 took out of the code. The case still catches a swapped key — `easyOn` and `easyOff` give different sentences.
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
    // The mark exists for the child to find what she changed and be able to undo it. A setting with no declared default
    // is born with no mark — this case holds the run latch to it.
    const ctx = fullCtx({ players: [{ easy: false, toggleMove: false, toggleRun: true }] });
    ctx.escolhido.add('incl_togglerun_p0'); // the child changed this control
    initSettingsMobility(ctx);
    expect($('#opt-togglerun').closest('.ctrl-row').classList.contains('is-changed')).toBe(true);
    expect($('[data-act="motora"]').classList.contains('is-changed'), 'a marca do MENU também acende').toBe(true);
  });

  it('[Boundary] ligada SOZINHA no toque, ela NÃO é marcada — a criança não mexeu em nada', () => {
    // The subtlety that only exists in this setting: it turns on by itself on the on-screen control. Marking it there
    // would light the mark for 100% of tablet players, with nobody having touched it — and a mark always lit means
    // nothing. Worse: as this menu's reset says, a wrong mark sends the child to undo what she never changed. What marks
    // is the stored CHOICE, not the state.
    const ctx = fullCtx({ players: [{ easy: false, toggleMove: false, toggleRun: true }] });
    initSettingsMobility(ctx); // no stored value: touch turned it on
    expect($('#opt-togglerun').closest('.ctrl-row').classList.contains('is-changed')).toBe(false);
    expect($('[data-act="motora"]').classList.contains('is-changed')).toBe(false);
  });

  it('[Right] clicar em #opt-togglerun delega no setToggleRun INJETADO e reflete', () => {
    // The RUN latch is the movement latch's sibling and follows the same shape: persisting and announcing belong to the
    // root (it knows `players` and the storage); the panel only delegates and reflects. The setting exists because the
    // movement latch solved HALF — whoever taps with one finger walked without holding and still could not RUN, which
    // still required holding.
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
      numPlayers: 1, // shrank from 2 to 1 player
    });
    const api = initSettingsMobility(ctx);
    api.setSelPlayer(1); // old selection, now out of range
    api.renderMovPlayers();
    expect(api.getSelPlayer()).toBe(0); // clampou de volta
  });

  it('[Right] setSelPlayer troca a seleção (mirrors `selMovPlayer = pauseActor` do game.js)', () => {
    const ctx = fullCtx({
      players: [{ easy: false, toggleMove: false }, { easy: true, toggleMove: false }],
    });
    const api = initSettingsMobility(ctx);
    api.setSelPlayer(1);
    api.reflectEasy();
    expect($('#opt-facil').classList.contains('is-on')).toBe(true);
  });

  it('[Error] setEasy com índice fora do array não lança (mirrors o guard `if(!p)return`)', () => {
    const ctx = fullCtx();
    const api = initSettingsMobility(ctx);
    expect(() => api.setEasy(5, true)).not.toThrow();
    expect(ctx.said).toHaveLength(0); // no-op: did not announce
  });

  it('[Zero] sem os elementos no DOM, render/reflect não lançam (só não desenham)', () => {
    document.body.innerHTML = '';
    const ctx = fullCtx();
    const api = initSettingsMobility(ctx);
    expect(() => { api.renderMovPlayers(); api.reflectEasy(); api.reflectAltMove(); }).not.toThrow();
  });
});

describe('ui/settings-mobility — restaurar padrões DESTE menu (ADR-0028)', () => {
  beforeEach(() => { mountDom(); });

  it('[Right] devolve Modo Fácil e alternância de TODOS os jogadores, não só o selecionado', () => {
    // The panel edits one player at a time, but the reset belongs to the MENU: leaving player 2 in Easy Mode because the
    // open tab was player 1's would give two different states under one name.
    const players = [{ easy: true, toggleMove: true }, { easy: true, toggleMove: false }];
    const ctx = fullCtx({ players });
    initSettingsMobility(ctx);
    $('#movement-reset').click();
    expect(players).toEqual([{ easy: false, toggleMove: false }, { easy: false, toggleMove: false }]);
  });

  it('[Interface] NÃO desliga o controle pelos olhos — um reset não pode tirar o ponteiro de quem clica com ele', () => {
    // The child who plays with her eyes points with her eyes. Turning the webcam off would leave her no way to click the
    // button back: the reset would have created the trap it exists to undo.
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
    // If the menu cleared the mark too early, the option still changed would hide behind a menu claiming to be untouched,
    // and the child would look everywhere except where it is.
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
    // ⚠️ THIS CASE WAS BORN FROM A SURVIVING MUTATION: removing the `rebuildCoins` default failed nothing, because EVERY
    // fixture in this file injects it. A field made optional without a case that omits it is a promise nobody checks —
    // and the promise here is the one that decides whether the engine can mount the panel.
    //
    // 📌 The two absences mean different things, and both have to be fine: `setToggleRun` is a WRITE the engine knows
    // how to do (`setRunLatch`); `rebuildCoins` is the WORLD'S REACTION, which is still the game's — and whose absence
    // must not erase the child's choice.
    const players = [{ easy: false, toggleMove: false, toggleRun: false, walkDir: 0 }];
    const guardado = new Map();
    const ditos = [];
    initSettingsMobility({
      $,
      srSay: (m) => ditos.push(m),
      store: { setBool: (k, on) => guardado.set(k, on ? '1' : '0'), get: () => null },
      players,
      getNumPlayers: () => 1,
      holdsKeys: true,
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
