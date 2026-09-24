// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/dom — the two halves of the toggle button (node project: no DOM, only the pure functions).
//
// `toggleLabel` sits beside `toggleBtn`, the other half of the same gesture, and its test travels with the module.
//
// Why this is an ACCESSIBILITY test and not a formatting one: a toggle states its state TWICE — in the text, for whoever
// sees, and in `aria-pressed`/`aria-label`, for whoever listens. If the halves disagree, the screen shows "On" and the
// reader announces "off", and someone who depends on the reader has no way to break the tie. That is why they live in
// the same file, and what these cases guard.
import { describe, it, expect } from 'vitest';
import { toggleBtn, toggleLabel, toggleAria } from '../app/js/ui/dom.js';
import { t } from '../app/js/core/i18n.js';

describe('toggleLabel — o texto visível', () => {
  it('[Right] ligado e desligado saem do DICIONÁRIO, não do código', () => {
    // Compared against `t()` and not a literal: if the label ever changes in the dictionary, this case stays true.
    // Comparing with a raw string would pin Portuguese text in the test, which is exactly what the dictionary took out
    // of the code.
    expect(toggleLabel(true)).toBe(t('ui.toggle.on'));
    expect(toggleLabel(false)).toBe(t('ui.toggle.off'));
    expect(toggleLabel(true)).not.toBe(toggleLabel(false));
  });

  it('[Zero] a chave NUNCA vaza: o que sai é texto, não `ui.toggle.on`', () => {
    // This is how key-based i18n fails, and it is silent: a forgotten `t()` puts the key on screen.
    expect(toggleLabel(true)).not.toMatch(/^ui\./);
    expect(toggleLabel(false)).not.toMatch(/^ui\./);
  });

  it('[Boundary] valores truthy/falsy não-booleanos seguem a mesma regra (uso defensivo)', () => {
    expect(toggleLabel(1)).toBe(toggleLabel(true));
    expect(toggleLabel(0)).toBe(toggleLabel(false));
  });
});

describe('toggleAria — o que o leitor de tela ouve', () => {
  it('[Right] carrega o NOME do alvo junto, que é o que a tela não precisa dizer', () => {
    // On screen, the target's name is on the row beside the button and the eye joins the two. In the reader the button
    // is announced alone — without the name, the person hears "on" and does not know what is on.
    expect(toggleAria('Scanlines', true)).toContain('Scanlines');
    expect(toggleAria('Scanlines', false)).toContain('Scanlines');
    expect(toggleAria('Scanlines', true)).not.toBe(toggleAria('Scanlines', false));
  });

  it('[Zero] parâmetro vazio não deixa `{alvo}` cru no anúncio', () => {
    expect(toggleAria('', true)).not.toContain('{alvo}');
  });
});

describe('as duas metades não se separam', () => {
  /** A fake button: only what `toggleBtn` touches. */
  function botao() {
    const attrs = {}, classes = new Set();
    return {
      attrs, classes,
      classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) },
      setAttribute: (k, v) => { attrs[k] = v; },
    };
  }

  it('[Interface] o estado que o `aria-pressed` declara é o mesmo que o rótulo mostra', () => {
    // This file's central case. The two functions are independent — nothing in the types makes them agree — which is
    // why agreement has to be enforced somewhere.
    for (const on of [true, false]) {
      const b = botao();
      toggleBtn(b, on);
      expect(b.attrs['aria-pressed']).toBe(String(on));
      expect(b.classes.has('is-on')).toBe(on);
      expect(toggleLabel(on)).toBe(t(on ? 'ui.toggle.on' : 'ui.toggle.off'));
    }
  });

  it('[Zero] botão nulo não quebra — os painéis chamam antes de o markup existir', () => {
    expect(() => toggleBtn(null, true)).not.toThrow();
  });
});
