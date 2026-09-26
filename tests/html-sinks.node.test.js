// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CENSUS OF MARKUP SINKS (issue #106) — and what it can and cannot prove.
//
// ========================= WHY A TEST AND NOT A SEMGREP RULE =========================
// The issue asks for a rule that really covers this, or the equivalent lint. It is a test, for three reasons:
//
//   · ⚠️ SEMGREP DOES NOT KNOW WHERE THE DATA COMES FROM. The question that matters — «isto interpola texto que uma pessoa
//     escreveu?» — is about provenance, and syntactically `el.innerHTML = f(x)` is the same whether `f` pastes a literal
//     or what a teacher typed. A syntactic rule either accuses every sink (and is switched off on day one) or none.
//   · The gate this house already uses for the same subject is a test: `i18n-without-markup.node.test.js`.
//   · A semgrep rule cannot be proven RED from here — there is no semgrep on this machine — and the house rule is that
//     every gate is born red with a confirmed mutation. A gate that could not be seen failing is a habit.
//
// ========================= WHAT THIS GATE PROVES, AND WHAT IT DOES NOT =========================
// ⚠️ IT DOES NOT PROVE THE SINKS ARE SAFE. It proves something more modest that nothing else proves: that **no NEW sink
// appeared without someone looking at it**. It is exactly the gap the `i18n-without-markup` header names: *"any new
// `innerHTML` that interpolates something other than i18n, a number or an enumerated key"*.
//
// THAT FILE'S CENSUS STILL HOLDS, done the right way — by DATA SOURCE, not by call site (see its header): audio device
// name, voice name and wizard progress go through `textContent`; a gamepad id is only a lookup key; no stored value
// reaches markup. i18n was the open vector, and that gate closes it.
//
// ⚠️ AND A GAME LIVES IN ANOTHER REPOSITORY and consumes the engine as a package (ADR-0083) — so the text IT declares
// (`Objective.name`, an action's label) is text this tree does not review. That is why each sink below carries the
// reason it is safe from that text.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'app', 'js');
const SINK = /innerHTML\s*=|insertAdjacentHTML/;

/** Every `.ts` of `app/js`, recursively. */
function ficheiros(dir = RAIZ, base = '') {
  const saida = [];
  for (const nome of readdirSync(dir).sort()) {
    const cheio = join(dir, nome);
    if (statSync(cheio).isDirectory()) saida.push(...ficheiros(cheio, base ? `${base}/${nome}` : nome));
    else if (nome.endsWith('.ts')) saida.push({ rel: base ? `${base}/${nome}` : nome, cheio });
  }
  return saida;
}

/** Today's sinks: `file` + the start of the CODE line (comments do not count). */
function sinksDeHoje() {
  const achados = [];
  for (const f of ficheiros()) {
    for (const bruta of readFileSync(f.cheio, 'utf8').split('\n')) {
      const linha = bruta.trim();
      if (!linha || linha.startsWith('//') || linha.startsWith('*')) continue;
      if (SINK.test(linha)) achados.push({ onde: f.rel, trecho: linha.slice(0, 52) });
    }
  }
  return achados;
}

/**
 * THE CLASSIFIED SINKS. The key is `file :: start of line` — a line that MOVES still matches, a line that CHANGES stops
 * matching, and changing the line is exactly when it needs reviewing again.
 *
 * `porque` is not decoration: it is the only thing that distinguishes this file from a suppression list.
 */
const SEGUROS = [
  // ⚠️ The census covers the ENGINE; the cartridge's sinks are the game's census, in game-platformer (issue #111). The
  // [Zero] case — the list keeps no sink that no longer exists — is what points out an entry whose code left.
  // THE HELP SCREEN LEFT THIS LIST (2026-09-13): it is a slide show built with `textContent`, so the game's words reach the
  // document as text and no longer through markup (`ui/help-panel.showSlide`).
  ['consumer-quiz/main-quiz.ts', 'app.innerHTML = startHtml(translate, ordered, locale', 'the start screen (the test bench): the codes and words of the skills go through `escapeHtml`, the stage and title through `t()`, the rest are numbers — gated hostile in `consumer-quiz.node`'],
  ['render/viz-setters.ts', "tabs.innerHTML = '';", 'string vazia: limpa o elemento, nada entra'],
  ['ui/pause-icons.ts', "if (k === 'idioma') { const flag = flagOf(ctx.transl", 'the language flag: one of three SVG constants of `ui/locale-flags`, chosen by the locale — nothing typed or fetched enters'],
  ['render/viz-setters.ts', 'el.innerHTML = vizGroupHtml(t, modes, cur)', 'modos enumerados + i18n'],
  // ⚠️ THE TWO AXES (#104). Same class as the one above and for the same reason: `axesHtml` interpolates only ENUMERATED
  // values (`THEMES`/`CORRECTIONS`, frozen in `viz-axes`) and text that went through `t()`. Nothing here comes from
  // storage, from a URL or from what a child typed — the boundary this census guards.
  ['render/viz-setters.ts', 'el.innerHTML = axesHtml(v, t);', 'eixos enumerados + i18n'],
  ['render/viz-setters.ts', 'const tabs = ctx.$(tabsSel); if (tabs) { tabs.hidden', 'string vazia: limpa o elemento, nada entra'],
  ['ui/debug-panel.ts', "p.innerHTML = '<strong>", 'literal inteiro: o titulo do painel de ?debug'],
  ['ui/hud.ts', "gameHudEl.innerHTML = '';", 'string vazia: limpa o elemento, nada entra'],
  ['ui/hud.ts', 'd.innerHTML = vphudHtml(', '⚠️ CONSERTADO 2026-09-06: o nome do jogo saiu do markup e vai por `setAttribute`'],
  ['ui/hud.ts', "if (scr && !scr.querySelector('.vp-wait'))", 'só o ÍNDICE da tela, um número'],
  // ⚠️ The engine MOUNTS the first screen's accessibility bar (ADR-0106 step 2). SAFE for the same reason as the two of
  // `ui/pause-icons` just below — what enters is `iconsMarkup`, the engine's own markup with labels resolved by `t()`; the
  // only variable data is WHICH icons, and that list is a sub-list of `PAUSE_ICONS`, a constant of
  // `core/pause-icon-catalogue` (ADR-0221). Nothing from outside the repository reaches this sink.
  // 📌 The excerpt is SHORT on purpose: the key is the start of the line cut at 52 characters (see `sinksDeHoje`), and an
  // entry LONGER than that cut never matches.
  ['boot/create-game.ts', 'a11yBar.innerHTML = iconsMarkup(translator, ', 'markup da engine + i18n'],
  ['ui/pause-icons.ts', 'sp.innerHTML = screenPauseMarkup({', 'markup da engine + i18n'],
  // ⚠️ The argument (ADR-0106 §5) does NOT change the classification: `gameIcons` is a sub-list of `PAUSE_ICONS`, a
  // constant of `core/pause-icon-catalogue` — nothing from outside the repository reaches this sink.
  ['ui/pause-icons.ts', 'bar.innerHTML = quickBarMarkup(ctx.translator, gameI', 'markup da engine + i18n'],
  // The system voice list lives with the voice section (ADR-0221, issue #203): `ui/voice-settings` clears this `<select>`.
  // What enters is an empty string.
  ['ui/voice-settings.ts', "sel.innerHTML = '';", 'string vazia: limpa o elemento, nada entra'],
  ['ui/settings-mobility.ts', 'tabs.innerHTML = playerTabsHTML(', 'números (quantos jogadores, qual selecionado)'],
  ['ui/settings-panel.ts', 'span.innerHTML = strong.outerHTML', 'DOM de volta ao DOM: nenhum texto novo entra'],
  // 🎯 `ui/settings-visual`, `ui/settings-motion` and `ui/settings-audio` build their insides as NODES with the kit
  // (ADR-0129), not through `innerHTML`. What that removes is not only the interpolation — it is the rebuilding, which
  // remade the step control on every render and threw the focus of whoever was adjusting it to the `<body>`.
  ['ui/shell.ts', 'el.innerHTML = legendHtml(l1, l2)', 'so i18n, e o dicionario tem gate proprio'],
  ['input/touch.ts', 'el.innerHTML = TOUCH_SLOTS.map((s) =>', '⚠️ CONSERTADO 2026-09-06: idem — o `<option>` nasce vazio e recebe o rótulo por texto'],
  ['consumer-quiz/main-quiz.ts', 'app.innerHTML = questionHtml(translate, view, cursor', '⚠️ CONSERTADO 2026-09-06: enunciado e alternativas passam por `escapeHtml`, com gate hostil em `consumer-quiz`'],
  ['ui/settings-controls.ts', "tabs.innerHTML = '<span class=\"opt-hint\" style=\"widt", '⚠️ CONSERTADO 2026-09-07 (#125): era um literal em português cravado COM o `<strong>` e o plural à mão. Agora o sink é só ESQUELETO — zero dado, zero interpolação — e as três partes do texto entram por `textContent`, com o molde partido no marcador `{modo}` antes da substituição. O dicionário continua sem markup, que é o que o `i18n-sem-markup` exige'],
  // (The Dev's decision «as categorias de áudio são DA ENGINE» is written in the module that builds that row, not here.)
];

/**
 * ⚠️ THE CEILING: sinks not yet classified by data source. The list **only shrinks** — a sink that leaves it goes to
 * `SEGUROS` with the reason written, or is fixed. It is empty.
 */
const A_REVER = [
];

const chave = (onde, trecho) => `${onde} :: ${trecho}`;
const CONHECIDOS = new Set([...SEGUROS, ...A_REVER].map(([o, t]) => chave(o, t)));
/** A sink of today matches a known one when the line STARTS with the recorded excerpt. */
const casa = (s) => [...CONHECIDOS].find((k) => k.startsWith(`${s.onde} :: `) && s.trecho.startsWith(k.split(' :: ')[1]));

describe('censo dos sinks de markup — o gate diz «ninguém acrescentou um sem olhar»', () => {
  it('[Right] ⚠️ nenhum sink NOVO — é a lacuna que o `i18n-sem-markup` nomeia desde 2026', () => {
    // A new `innerHTML` interpolating something other than i18n, a number or an enumerated key is how this stops being a
    // census and becomes an incident. The list above is what someone has looked at; a sink outside it is one nobody has,
    // and this case names it instead of letting it pass in a green.
    const novos = sinksDeHoje().filter((s) => !casa(s)).map((s) => chave(s.onde, s.trecho));
    expect(novos, 'sink de markup NOVO — classifique-o em SEGUROS ou em A_REVER antes de seguir').toEqual([]);
  });

  it('[Zero] a lista não guarda sink que já não existe', () => {
    // A dead entry is worse than none: it gives the impression of coverage over code that is gone, and the next person
    // trusts it.
    const hoje = sinksDeHoje();
    const orfas = [...CONHECIDOS].filter((k) => !hoje.some((s) => casa(s) === k));
    expect(orfas, 'entrada da lista que não corresponde a nenhum sink real').toEqual([]);
  });

  it('[Boundary] ⚠️ o TETO só encolhe — `A_REVER` não pode crescer', () => {
    // The same design as `engine-boundary`: a ceiling, not equality, because what matters to forbid is the coupling
    // GROWING. One more sink to review is new debt disguised as old debt.
    // ⚠️ The ceiling is at zero. Lowering the number is part of the work: a ceiling left where it was lets the debt fit
    // back in without anyone noticing.
    expect(A_REVER.length, 'a dívida de sinks por classificar cresceu').toBeLessThanOrEqual(0);
  });

  it('[Interface] toda entrada tem um PORQUÊ — sem isso a lista é uma tabela de supressões', () => {
    for (const [onde, trecho, porque] of [...SEGUROS, ...A_REVER]) {
      expect(porque, chave(onde, trecho)).toBeTruthy();
      expect(String(porque).length, chave(onde, trecho)).toBeGreaterThan(8);
    }
  });

  it('[Interface] ⚠️ e o gate continua honesto sobre o que NÃO prova', () => {
    // ⚠️ WHAT IT PROVES: every sink that exists is on one of the two lists, with a written reason — that is, nobody added
    // one without looking. What it does NOT prove: that the sinks are safe. Classification is RECORDED human judgement,
    // not demonstration; some are safe only because they were FIXED, and the gates of those fixes live in other files
    // (`settings-controls.browser`, `touch.browser`, `i18n-consumer-dict`, `hud`).
    expect(SEGUROS.length + A_REVER.length).toBe(sinksDeHoje().length);
    expect(SEGUROS.length, 'sink sem classificação nenhuma').toBeGreaterThan(0);
  });
});
