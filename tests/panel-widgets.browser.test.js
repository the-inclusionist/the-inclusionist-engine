// SPDX-License-Identifier: AGPL-3.0-or-later
// A MENU ROW, AND THE MOTOR PANEL'S INSIDE — the invisible contract one level below `panel-shell`.
//
// ========================= WHY THESE CASES ARE BROWSER ONES =========================
// The rule inherited from `boot-create-game.browser.test.js`: **a case only enters here if the fake DOM could not do
// it.** What is asked is whether the created control really is a `<select>` and not a `<button>`, whether the
// `.opt-hint` is INSIDE the `<span>` where `fillExplain` will look for it, and whether mounting twice leaves one row. A
// double answers «sim» to all three without any being true.
//
// MUTAÇÕES CONFERIDAS no fim do ficheiro.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { controlRow, labelRow } from '../app/js/ui/panel-widgets.js';
import { mountMobilityInside } from '../app/js/ui/settings-mobility.js';
import { mountAudioInside, mountSoundInside } from '../app/js/ui/settings-audio.js';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import { mountShell } from '../app/js/ui/panel-shell.js';

const ctx = {
  find: (s) => document.querySelector(s),
  create: (t) => document.createElement(t),
};

let hospedeiro;
beforeEach(() => {
  hospedeiro = document.createElement('div');
  document.body.appendChild(hospedeiro);
});
afterEach(() => { hospedeiro.remove(); });

describe('linhaDeControle — a regra de menu do CLAUDE.md §4, por construção', () => {
  it('🎯 [Right] o rótulo curto fica à vista e a prosa vai num `.opt-hint` DENTRO do `<span>`', () => {
    // It is where `ui/settings-panel.fillExplain` looks for it to move it to the footer. Outside the `<span>` it never
    // leaves the row, and the menu becomes a manual again — the result the Dev has already seen and named.
    const { row: linha } = controlRow(ctx, { id: 'x', label: 'Modo Fácil', hint: 'Gravidade menor.' });
    hospedeiro.appendChild(linha);
    expect(linha.className).toBe('ctrl-row');
    expect(linha.querySelector('strong').textContent).toBe('Modo Fácil');
    const dica = linha.querySelector('.opt-hint');
    expect(dica, 'a dica não foi criada').not.toBeNull();
    expect(dica.parentElement.tagName, 'a dica ficou fora do `<span>` onde o fillExplain a procura').toBe('SPAN');
    expect(dica.parentElement.contains(linha.querySelector('strong')), 'a dica não está no mesmo `<span>` do rótulo')
      .toBe(true);
  });

  it('⚠️ [Zero] UMA dica só — duas descrições do mesmo controle deixam sempre uma para trás', () => {
    const { row: linha } = controlRow(ctx, { id: 'x', label: 'Rótulo', hint: 'Uma explicação.' });
    expect(linha.querySelectorAll('.opt-hint')).toHaveLength(1);
  });

  it('[Zero] sem dica, não nasce `.opt-hint` vazio — o rodapé descansa no texto do painel', () => {
    const { row: linha } = controlRow(ctx, { id: 'x', label: 'Rótulo' });
    expect(linha.querySelector('.opt-hint')).toBeNull();
  });

  it('🔴 [Interface] a FORMA decide a tag — um `<select>` pedido não pode nascer `<button>`', () => {
    // ⚠️ IT IS THE DEFECT THAT RAISES NO ERROR. `voice-settings` writes `.value` into the `<select>` it finds as `#tts-ppm`;
    // on a `<button>` that writes a property nobody reads, and the child's choice vanishes silently.
    expect(controlRow(ctx, { id: 'a', label: 'A' }).control.tagName).toBe('BUTTON');
    expect(controlRow(ctx, { id: 'b', label: 'B', shape: 'escolha' }).control.tagName).toBe('SELECT');
    const cursor = controlRow(ctx, { id: 'c', label: 'C', shape: 'cursor' }).control;
    expect(cursor.tagName).toBe('INPUT');
    expect(cursor.type).toBe('range');
    // ⚠️ AND WITH BOUNDS: a `range` without `min`/`max` assumes 0..100, and this project's volume is 0..1 — without this
    // the slider's first step jumps the whole interval.
    expect(cursor.min).toBe('0');
    expect(cursor.max).toBe('100');
  });

  it('🔴 [Right] o interruptor anuncia o NOME, não só o estado', () => {
    // A switch's `textContent` in this project is «▶ Desligado». Without `aria-label`, whoever navigates control by
    // control hears «Desligado, botão» and does not know WHAT is off — the `<strong>` beside it only serves whoever sees
    // the whole row.
    const { control } = controlRow(ctx, { id: 'x', label: 'Modo Fácil' });
    expect(control.getAttribute('aria-label')).toBe('Modo Fácil');
    expect(control.getAttribute('aria-pressed'), 'nasce sem estado dito, e um estado por dizer é um estado errado')
      .toBe('false');
  });

  it('🔴 [Boundary] `labelRow` ERASES a hint that is gone — it does not leave it in the previous language', () => {
    // ⚠️ A hint that exists in one dictionary and not another must DISAPPEAR on retranslation. Not writing it is not
    // enough: the old text survives and the footer rests in the language the child just left. It is the same rule
    // `applyLabels` follows for the frame's `data-explain-idle`.
    const { row: linha, control } = controlRow(ctx, { id: 'x', label: 'Antes', hint: 'Explicação antiga.' });
    hospedeiro.appendChild(linha);
    labelRow(linha, { id: 'x', label: 'Depois' });
    expect(linha.querySelector('strong').textContent).toBe('Depois');
    expect(linha.querySelector('.opt-hint').textContent, 'a dica do idioma anterior sobreviveu').toBe('');
    expect(control.getAttribute('aria-label'), 'o nome falado ficou no idioma anterior').toBe('Depois');
  });

  it('🔴 [Right] relabelling names THE control with that id — not the first element of the row that has an id', () => {
    // Found by the probe of 2026-09-24: every kit row has one id, the control's, so «the first element with an id» and «the
    // element with this id» were the same answer. `labelRow` is published and takes any row, and a row built by hand — the
    // four colour swatches of the visual panel — carries several.
    const { row: linha, control } = controlRow(ctx, { id: 'x', label: 'Antes' });
    const outro = document.createElement('span');
    outro.id = 'outro';
    linha.prepend(outro);
    hospedeiro.appendChild(linha);
    labelRow(linha, { id: 'x', label: 'Depois' });
    expect(control.getAttribute('aria-label')).toBe('Depois');
    expect(outro.hasAttribute('aria-label'), 'another element of the row got the control\'s name').toBe(false);
  });

  it('[Right] `rotuloAria` ganha ao rótulo, para quando o nome falado não é o escrito', () => {
    const { control } = controlRow(ctx, { id: 'x', label: '↺', ariaLabel: 'Restaurar cores padrão' });
    expect(control.getAttribute('aria-label')).toBe('Restaurar cores padrão');
  });
});

describe('montarInteriorDoMotor — o painel constrói o que ele próprio alcança', () => {
  function casca() {
    const c = mountShell(ctx, {
      id: 'movement', title: 'Motora', listLabel: 'Escolhas', resetLabel: 'Repor', closeLabel: 'Fechar',
    });
    hospedeiro.appendChild(c.overlay);
    return c;
  }

  it('🎯 [Right] cria os QUATRO ids que o painel alcança e nunca criava', () => {
    // 📏 `settings-mobility` looks for `#movement-players`, `#opt-facil`, `#opt-altmove` and `#opt-togglerun`. Without
    // this inside, the panel would open with the card, the title and the reset button, and NONE of the three choices.
    const c = casca();
    mountMobilityInside(translate, ctx, c.card, c.list);
    for (const id of ['movement-players', 'opt-facil', 'opt-altmove', 'opt-togglerun']) {
      expect(document.getElementById(id), `#${id} não foi criado`).not.toBeNull();
    }
  });

  it('⚠️ [Right] as três escolhas ficam DENTRO da lista, e as abas FORA dela', () => {
    // The list is the `div[role=group]` the screen reader announces as the set of choices. The tabs say WHOSE the choices
    // are: putting them inside would make the group announce the seat selector as one more setting.
    const c = casca();
    mountMobilityInside(translate, ctx, c.card, c.list);
    for (const id of ['opt-facil', 'opt-altmove', 'opt-togglerun']) {
      expect(c.list.contains(document.getElementById(id)), `#${id} ficou fora da lista`).toBe(true);
    }
    const abas = document.getElementById('movement-players');
    expect(c.list.contains(abas), 'as abas entraram no grupo das escolhas').toBe(false);
    expect(c.card.contains(abas), 'as abas ficaram fora do cartão').toBe(true);
    expect(abas.hidden, 'as abas nascem à vista e vazias — um selector que não seleciona nada').toBe(true);
  });

  it('⚠️ [Zero] montar DUAS vezes deixa UMA linha de cada', () => {
    // The root mounts more than once: the player count changes the screen grid, and ADR-0142 puts two cartridges on the
    // same page.
    const c = casca();
    mountMobilityInside(translate, ctx, c.card, c.list);
    mountMobilityInside(translate, ctx, c.card, c.list);
    for (const id of ['movement-players', 'opt-facil', 'opt-altmove', 'opt-togglerun']) {
      expect(document.querySelectorAll('#' + id), `#${id} ficou duplicado`).toHaveLength(1);
    }
  });

  it('🔴 [Right] a linha da ALTERNÂNCIA é sempre criada — quem a esconde é o painel, por `seguraTeclas`', () => {
    // ⚠️ THE RULE LIVES IN ONE PLACE. `reflectAltMove` decides whether it shows, by the declaration's `holdsKeys`
    // (ADR-0115), and its decision is `hidden` — which takes it off the screen AND out of the accessibility tree.
    // Creating it only when it applies would put the same rule in two places, and the day they diverged is the day the
    // row appears in a game where it does nothing.
    const c = casca();
    mountMobilityInside(translate, ctx, c.card, c.list);
    const alt = document.getElementById('opt-altmove');
    expect(alt, 'a linha da alternância não foi criada').not.toBeNull();
    expect(alt.closest('.ctrl-row').hidden, 'nasceu escondida: a construção assumiu uma decisão que não é dela')
      .toBe(false);
  });

  it('[Right] cada escolha tem a sua explicação, e ela vai para o rodapé pelo caminho da casca', () => {
    const c = casca();
    mountMobilityInside(translate, ctx, c.card, c.list);
    for (const id of ['opt-facil', 'opt-altmove', 'opt-togglerun']) {
      const linha = document.getElementById(id).closest('.ctrl-row');
      expect(linha.querySelector('.opt-hint'), `#${id} ficou sem explicação`).not.toBeNull();
      expect(linha.querySelector('strong').textContent.length, `#${id} ficou sem rótulo`).toBeGreaterThan(0);
    }
  });
});

describe('montarInteriorDoAudio — o maior contrato invisível dos oito', () => {
  function casca() {
    const c = mountShell(ctx, {
      id: 'audio', listId: 'navsound-list', title: 'Auditiva', listLabel: 'Sons de navegação', resetLabel: 'Repor', closeLabel: 'Fechar',
    });
    hospedeiro.appendChild(c.overlay);
    return c;
  }

  // 📏 The controls `ui/settings-audio` reaches, measured from the file itself. `#opt-sound` is NOT among them: it is this
  // setting's mirror on the quick bar, outside the panel, and is reached with a guard.
  const CONTROLES = {
    'opt-modocego': 'BUTTON',
    'cane-div': 'DIV', // a cycle row of two positions (ADR-0130 rule 3); `renderAudio` reaches it through `updateChoice`
    'opt-menuindex': 'BUTTON',
    'opt-tts': 'BUTTON',
    'tts-vol': 'INPUT',
  };

  /** What ADR-0151 took out of the panel — asserted ABSENT, not just left off the list above. */
  // The GENERAL sound and volume live in the «Áudio» panel; the navigation volume left (one place per choice).
  const SAIRAM = ['tts-engine', 'tts-voice', 'opt-tts-test', 'audio-sinks', 'audio-detect', 'audio-master', 'audio-master-vol', 'navsound-master'];

  it('🎯 [Right] cria os controles, cada um com a TAG que o painel escreve', () => {
    // ⚠️ THE TAG IS THE SILENT DEFECT. `renderAudio` does `ctx.$<HTMLSelectElement>('#cane-div').value = …`; on a
    // `<button>` that creates a property nobody reads, with no error at all, and the choice vanishes.
    const c = casca();
    mountAudioInside(translate, ctx, c.card, c.list);
    for (const [id, tag] of Object.entries(CONTROLES)) {
      const el = document.getElementById(id);
      expect(el, `#${id} não foi criado`).not.toBeNull();
      expect(el.tagName, `#${id} nasceu com a tag errada`).toBe(tag);
    }
    // 🔴 THE PAIR (ADR-0151): engine, voice, voice test and the per-player outputs are NOT in the panel. Without this, a
    // control list that grew again would pass the case above — it only checks those that MUST exist.
    for (const id of SAIRAM) {
      expect(document.getElementById(id), `#${id} continua no painel — o Dev tirou-o`).toBeNull();
    }
    // and the volume is a real slider, not a text box
    for (const id of ['tts-vol']) {
      expect(document.getElementById(id).type, `#${id} não é um cursor`).toBe('range');
    }
  });

  it('🎯 [Right] a lista da casca — a da navegação sonora — fica no cartão', () => {
    const c = casca();
    mountAudioInside(translate, ctx, c.card, c.list);
    expect(c.list.id).toBe('navsound-list');
    expect(c.card.contains(c.list), 'a lista da casca saiu do cartão').toBe(true);
  });

  it('⚠️ [Right] a ORDEM é a decisão (ADR-0151): modo cego, bengala, navegação, narração, índice falado', () => {
    // Blind mode first, because in it the other sounds become the screen; the index right after the narration, because
    // it is the narration it shortens.
    const c = casca();
    mountAudioInside(translate, ctx, c.card, c.list);
    const ordem = [...c.card.children];
    const posicao = (sel) => ordem.findIndex((n) => n.matches(sel) || n.querySelector(sel));
    const seq = ['#opt-modocego', '#cane-div', '#navsound-list', '#opt-tts', '#tts-vol', '#opt-menuindex'].map(posicao);
    expect(seq.every((p) => p >= 0), 'uma das peças não está no cartão: ' + seq.join(',')).toBe(true);
    expect([...seq].sort((a, b) => a - b), 'a ordem do painel auditivo mudou').toEqual(seq);
  });

  it('🔴 [Zero] o modo cego NÃO tem dica — «quem precisa sabe o que é» (ADR-0151)', () => {
    const c = casca();
    mountAudioInside(translate, ctx, c.card, c.list);
    expect(document.getElementById('opt-modocego').closest('.ctrl-row').querySelector('.opt-hint')).toBeNull();
  });

  it('⚠️ [Zero] montar DUAS vezes deixa UM de cada — a raiz monta mais do que uma vez', () => {
    const c = casca();
    mountAudioInside(translate, ctx, c.card, c.list);
    mountAudioInside(translate, ctx, c.card, c.list);
    for (const id of [...Object.keys(CONTROLES), 'navsound-list']) {
      expect(document.querySelectorAll('#' + id), `#${id} ficou duplicado`).toHaveLength(1);
    }
  });

  it('🔴 [Right] a LANGUAGE THAT ARRIVES AFTER BOOT reaches the ROWS, not only the frame', async () => {
    // 🔴 THIS CASE CAME FROM A DEFECT MEASURED IN A BROWSER, which no unit test caught: they all run in one language.
    // 📏 In `quiz.html` with `lang="en"`, on 2026-09-12: the title said «Hearing accessibility» and the first row said
    // «Som», on the same screen — the frame was retranslated at each opening and the INSIDE was left behind.
    //
    // 📌 What fixes it is mounting the inside again at each opening — which is why `mountAudioInside` relabels what exists
    // instead of rebuilding it: rebuilding would leave the controls with no listeners.
    // a translator of this case's own, as a root builds it: the language lives in it (`core/i18n` holds none, ADR-0232 D3)
    const { pageTranslator } = await import('./fixtures/page-locale.js');
    const tr = pageTranslator();
    const c = casca();
    mountAudioInside(tr.t, ctx, c.card, c.list);
    const antes = document.querySelector('#opt-tts').closest('.ctrl-row').querySelector('strong').textContent;

    await tr.setLocale('en');
    mountAudioInside(tr.t, ctx, c.card, c.list);
    const linha = document.querySelector('#opt-tts').closest('.ctrl-row');
    expect(linha.querySelector('strong').textContent, 'a linha ficou no idioma de recuo').not.toBe(antes);
    // «(TTS)» left the label on 2026-09-12 (ADR-0158): an explanation in parentheses goes to the footer
    expect(linha.querySelector('strong').textContent).toBe('Voice narration');
    await tr.setLocale('pt');
  });

  it('🔴 [Zero] `#opt-sound` NÃO é criado — ele mora na barra rápida, fora do painel', () => {
    // Creating it here would put TWO mirrors of the same setting in the document, and `reflectMaster` would light the one
    // inside the panel while the bar went on saying the opposite.
    const c = casca();
    mountAudioInside(translate, ctx, c.card, c.list);
    expect(document.getElementById('opt-sound')).toBeNull();
  });
});

describe('montarInteriorDoSom — o painel «Áudio» (ADR-0151 §2 item 4)', () => {
  function casca() {
    const c = mountShell(ctx, {
      id: 'som', listId: 'audio-list', title: 'Áudio', listLabel: 'Sons do jogo', resetLabel: 'Repor', closeLabel: 'Fechar',
    });
    hospedeiro.appendChild(c.overlay);
    return c;
  }

  it('🎯 [Right] o som geral VOLTOU — interruptor e volume, com as tags que `initSettingsAudio` escreve', () => {
    // The Dev's decision: «toggle + barra para som geral voltam».
    const c = casca();
    mountSoundInside(translate, ctx, c.card, c.list);
    expect(document.getElementById('audio-master')?.tagName).toBe('BUTTON');
    expect(document.getElementById('audio-master-vol')?.type, 'o volume geral não é um cursor').toBe('range');
  });

  it('⚠️ [Right] o som geral vem ANTES da lista das categorias, e a lista fica no cartão', () => {
    const c = casca();
    mountSoundInside(translate, ctx, c.card, c.list);
    const ordem = [...c.card.children];
    const posicao = (sel) => ordem.findIndex((n) => n.matches(sel) || n.querySelector(sel));
    expect(posicao('#audio-master')).toBeGreaterThanOrEqual(0);
    expect(posicao('#audio-master')).toBeLessThan(posicao('#audio-master-vol'));
    expect(posicao('#audio-master-vol')).toBeLessThan(posicao('#audio-list'));
  });

  it('⚠️ [Zero] montar DUAS vezes deixa UM de cada', () => {
    const c = casca();
    mountSoundInside(translate, ctx, c.card, c.list);
    mountSoundInside(translate, ctx, c.card, c.list);
    for (const id of ['audio-master', 'audio-master-vol', 'audio-list']) {
      expect(document.querySelectorAll('#' + id), `#${id} ficou duplicado`).toHaveLength(1);
    }
  });

});

// ========================= MUTATIONS CHECKED =========================
// Ten, each applied by script to the file with occurrence counts before applying. (`rotuloAria` and `seguraTeclas` are
// today's `ariaLabel` and `holdsKeys`.)
//
//   1. the hint leaving the `<span>` -> `fillExplain` never finds it, and the menu becomes a manual again.
//   2. the SHAPE ignored (everything a button) -> a requested `<select>` is born a `<button>`; writing `.value` on it
//      raises no error at all, and the child's choice vanishes silently.
//   3. the slider without `min`/`max` -> assumes 0..100 where the volume is 0..1, and the first step jumps the interval.
//   4. the control without `aria-label` -> TWO fail: whoever navigates control by control hears only «Desligado».
//   5. `rotuloAria` no longer winning -> a button whose label is a glyph announces the glyph.
//   6. the switch without `aria-pressed` -> born with its state unsaid, which is a wrong state.
//   7. the motor inside without a guard -> mounting twice leaves two rows of each, and the root mounts more than once
//      (the player count changes the grid; ADR-0142 puts two cartridges on the same page).
//   8. the tabs INSIDE the list -> the group announces the seat selector as one more setting.
//   9. the latch row created only when it applies -> FIVE fail. The `seguraTeclas` rule lives in `reflectAltMove`; in
//      two places they drift, and the row appears in a game where it does nothing.
//  10. the choices on the card instead of the list -> they leave the `div[role=group]` the screen reader announces.
