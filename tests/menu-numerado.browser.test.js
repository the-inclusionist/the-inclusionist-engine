// SPDX-License-Identifier: AGPL-3.0-or-later
// EVERY ITEM OF THE PAUSE CARD SHOWS ITS NUMBER (ADR-0158, issue #152).
//
// ========================= WHY THE GATE READS COMPUTED STYLE =========================
// The number is a CSS counter, so no DOM text holds it and a test cannot read «3» back. What CAN be read is the
// three declarations that make the counter right, on the real stylesheet and the production markup:
//   · each list RESETS it — or the options submenu would continue from the root's last number;
//   · each item INCREMENTS it and draws it — or items would show nothing, or all the same number;
//   · a hidden item is `display:none` — which, by the CSS counter rules, is what keeps it from taking a number.
// And the fourth, the child who listens: the number is out of the accessible name (`/ ""`), because the engine's
// spoken index already says it (ADR-0044 item 3) and a screen reader would otherwise hear it twice.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../app/css/style.css';
import { screenPauseMarkup } from '../app/js/ui/pause-icons.js';
import { PM_BTNS, PM_OPTIONS_BTNS } from '../app/js/ui/activities-menu.js';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

let palco;

function montar(tr, largura = 640, altura = 360) {
  palco = document.createElement('div');
  palco.className = 'player-screen';
  palco.style.cssText = `position:relative;width:${largura}px;height:${altura}px`;
  const sp = document.createElement('div');
  sp.className = 'screen-pause';
  sp.innerHTML = screenPauseMarkup({
    player: 0, numPlayers: 1, pmButtons: PM_BTNS, optionsButtons: PM_OPTIONS_BTNS,
    dynLabel: () => null, t: tr,
  });
  palco.appendChild(sp);
  document.body.appendChild(palco);
  return sp;
}

const antes = (el) => getComputedStyle(el, '::before');

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { if (palco) palco.remove(); palco = null; });

describe('pause card items are numbered (ADR-0158)', () => {
  it('🔴 [Right] every list RESETS the count — the submenu starts again at 1', () => {
    const sp = montar((k) => k);
    const listas = [...sp.querySelectorAll('.pause-menu')];
    expect(listas.length, 'the case would measure no list').toBeGreaterThanOrEqual(2);
    for (const l of listas) {
      expect(getComputedStyle(l).counterReset, `list ${l.dataset.sub} continues the previous count`).toMatch(/^item-menu\b/);
    }
  });

  it('🔴 [Right] every item COUNTS and DRAWS its number', () => {
    const sp = montar((k) => k);
    const itens = [...sp.querySelectorAll('.pm-btn')];
    expect(itens.length).toBe(PM_BTNS.length + PM_OPTIONS_BTNS.length + 1);
    for (const b of itens) {
      expect(getComputedStyle(b).counterIncrement, `${b.dataset.act} takes no number`).toMatch(/^item-menu\b/);
      expect(antes(b).content, `${b.dataset.act} draws no number`).toMatch(/^counter\(item-menu\)/);
    }
  });

  it('🎯 [Boundary] a HIDDEN item takes no number — it is display:none, which the counter skips', () => {
    const sp = montar((k) => k);
    const ajuda = sp.querySelector('.pause-menu[data-sub="raiz"] .pm-btn[data-act="ajuda"]');
    ajuda.hidden = true;
    expect(getComputedStyle(ajuda).display, 'a hidden item still laid out would leave a gap in 1..n').toBe('none');
  });

  it('🔴 [Right] the number stays OUT of the accessible name — the spoken index already says it', () => {
    const sp = montar((k) => k);
    for (const b of sp.querySelectorAll('.pm-btn')) {
      expect(antes(b).content, `${b.dataset.act}: a screen reader would hear the number twice`).toMatch(/\/\s*""$/);
    }
  });

  it('⚠️ [Boundary] at 640×360, with the number, no label spills out of its item — in pt, en and es', () => {
    for (const [nome, dic] of [['pt', pt], ['en', en], ['es', es]]) {
      document.body.innerHTML = '';
      const sp = montar((k) => dic[k] ?? k);
      for (const sub of ['raiz', 'opcoes']) {
        sp.querySelectorAll('.pause-menu').forEach((m) => { m.hidden = m.dataset.sub !== sub; });
        for (const b of sp.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')) {
          expect(b.scrollWidth - b.clientWidth, `${nome} ${b.dataset.act} «${b.textContent}» spills`).toBeLessThanOrEqual(0);
        }
      }
      palco.remove(); palco = null;
    }
  });
});

// ===== MUTATIONS CHECKED (2026-09-12) =====
// 1. drop `counter-reset` on `.pause-menu`          → red (the submenu would continue the root's count)
// 2. drop `counter-increment` on `.pm-btn`          → red
// 3. drop the `content` of `.pm-btn::before`        → red, twice (no number, and nothing to keep out of the name)
// 4. `content:counter(item-menu)` without `/ ""`    → red (the number enters the accessible name)
// 5. the list at 9rem instead of 26rem              → red — proves the width case measures real overflow
