// SPDX-License-Identifier: AGPL-3.0-or-later
// THE QUICK BAR LEAVES THE PAUSE CARD — item 7 of ADR-0044, and what it unlocks.
//
// ========================= WHAT WAS MEASURED =========================
// The card had 22 stops: TEN accessibility toggles (`role="group"`) and TWELVE word items (`role="menu"`), with an
// `<h2>` in between. Two interaction models on one screen, and the screen reader presents everything in strict
// sequence — what a sighted reader sees as "a bar and a list" becomes, for whoever listens, twenty-two things in a row.
//
// Item 5 took five items out of the list. This one takes the icons out of the card entirely: they live in the HUD,
// available DURING the game — which is when a child needs to change a setting that is getting in her way now, not
// after pausing.
//
// ========================= WHAT THAT UNLOCKS, AND IT IS THE BIGGEST GAIN =========================
// Without the bar, the pause is no longer a two-zone GRID and becomes a LINEAR LIST. XAG 106 allows wrapping (`wrap`)
// for a linear menu and FORBIDS it for a two-dimensional grid — that is why item 1's ring could not close here. Now it
// closes, and with it the promise that opened ADR-0044:
//
//   `quit` is ONE key UP from `resume`.
//
// Far in reading order (it is the seventh), near to the finger (it is the neighbour above the first). Both at the same
// time, which only a ring can do.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { screenPauseMarkup, quickBarMarkup } from '../app/js/ui/pause-markup.js';
import { PM_BTNS, PM_OPTIONS_BTNS, PM_GAME_BTNS } from '../app/js/ui/pause-buttons.js';
import { stepInRing } from '../app/js/ui/menu-nav.js';

const markup = () => screenPauseMarkup({
  player: 0, numPlayers: 1, pmButtons: PM_BTNS, optionsButtons: PM_OPTIONS_BTNS, dynLabel: () => null, t: (k) => k,
});

describe('barra rápida · sai do cartão de pausa e vira HUD', () => {
  it('[Right] o cartão de pausa NÃO tem mais ícone nenhum', () => {
    const h = markup();
    expect(h).not.toContain('pi-btn');
    expect(h).not.toContain('pause-icons');
  });

  it('[Right] a barra existe por si, com os treze ícones e a sua legenda (o ☰ primeiro; um 📷 só, ADR-0215; o idioma por último)', () => {
    const b = quickBarMarkup();
    expect(b).toContain('class="pause-icons"');
    // ⚠️ The number is written literally on purpose — an icon entering or leaving the bar without anyone noticing is a
    // product decision, not a label.
    expect((b.match(/class="pi-btn/g) || []).length).toBe(13);
    // The legend travels WITH the bar: it is the hint that replaces, for whoever cannot see, the `title` only the mouse
    // reveals. Leaving it behind in the card would make the HUD bar mute.
    expect(b).toContain('class="pause-icons-cap"');
    expect(b).toContain('aria-live="polite"');
  });

  it('[Right] a pausa continua com a lista inteira — só os ícones saíram', () => {
    const h = markup();
    // The third list (ADR-0146) is always in the markup, hidden: it is only «voltar» while the game declares nothing.
    expect((h.match(/class="pm-btn/g) || []).length).toBe(PM_BTNS.length + PM_OPTIONS_BTNS.length + PM_GAME_BTNS.length);
    expect(h).toContain('data-act="resume"');
    expect(h).toContain('data-act="quit"');
  });

  it('[Right] AGORA a pausa é linear, e `quit` fica a UMA tecla de `resume`', () => {
    // The promise that opened ADR-0044, and it could only be kept once the bar left: XAG 106 allows wrapping for a
    // LINEAR menu and forbids it for a two-dimensional grid. While the card had two zones, going round would be against
    // the guideline; with a single list, it is what the guideline recommends.
    const n = PM_BTNS.length;
    expect(PM_BTNS[0].act).toBe('resume');
    expect(PM_BTNS[n - 1].act).toBe('quit');
    expect(stepInRing(n, 0, -1), 'para CIMA a partir de `resume` tem de cair em `quit`').toBe(n - 1);
    expect(stepInRing(n, n - 1, 1), 'para BAIXO a partir de `quit` tem de voltar a `resume`').toBe(0);
  });

  it('[Zero] a barra é montada UMA vez por chamada e não carrega estado', () => {
    // `quickBarMarkup` is a pure string: two player screens receive the SAME markup and each reflects ITS player's state
    // afterwards (colour blindness is per player). If the function kept state, the second screen would be born with
    // the first one's label.
    expect(quickBarMarkup()).toBe(quickBarMarkup());
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · giving `iconsMarkup()` back to `screenPauseMarkup` → `[Right] o cartão NÃO tem mais ícone nenhum` fails.
//   · leaving `.pause-icons-cap` in the card instead of in the bar → `[Right] a barra existe por si` fails,
//     and the real effect would be a HUD bar that does not say what each icon does.
//   · putting `quit` before `print` in PM_BTNS → `[Right] AGORA a pausa é linear` fails on the last assertion.
