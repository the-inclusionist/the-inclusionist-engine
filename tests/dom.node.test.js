// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/dom — as duas metades do botão de alternância (project node: sem DOM, só as funções puras).
//
// ESTES CASOS VIERAM DE `settings-empathy.node.test.js`, e a mudança de arquivo é o registro: `toggleLabel`
// estava lá, declarado como "compartilhado", servindo UM chamador — enquanto as mesmas duas palavras apareciam
// copiadas em treze lugares de nove arquivos. A função foi para junto do `toggleBtn`, que é a outra metade do
// mesmo gesto, e o teste foi junto (a regra do item 19: o teste viaja com o módulo).
//
// Por que isto é teste de ACESSIBILIDADE e não de formatação: um botão de alternância diz o seu estado DUAS
// vezes — no texto, para quem vê, e no `aria-pressed`/`aria-label`, para quem ouve. Se as duas metades
// discordarem, a tela mostra "Ligado" e o leitor anuncia "desligado", e quem depende do leitor não tem como
// desempatar. É por isso que elas moram no mesmo arquivo, e é isso que estes casos guardam.
import { describe, it, expect } from 'vitest';
import { toggleBtn, toggleLabel, toggleAria } from '../app/js/ui/dom.js';
import { t } from '../app/js/core/i18n.js';

describe('toggleLabel — o texto visível', () => {
  it('[Right] ligado e desligado saem do DICIONÁRIO, não do código', () => {
    // Comparado contra `t()` e não contra a string literal: se um dia o rótulo mudar no dicionário, este caso
    // continua verdadeiro. Comparar com '❚❚ Ligado' cru voltaria a fixar o texto em português no teste, que é
    // exatamente o que a mudança tirou do código.
    expect(toggleLabel(true)).toBe(t('ui.toggle.on'));
    expect(toggleLabel(false)).toBe(t('ui.toggle.off'));
    expect(toggleLabel(true)).not.toBe(toggleLabel(false));
  });

  it('[Zero] a chave NUNCA vaza: o que sai é texto, não `ui.toggle.on`', () => {
    // O modo de falhar da i18n por chave é este, e é silencioso: um `t()` esquecido põe a chave na tela.
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
    // Na tela, o nome do alvo está na linha ao lado do botão e o olho junta os dois. No leitor, o botão é
    // anunciado sozinho — sem o nome, a pessoa ouve "ligado" e não sabe ligado o quê.
    expect(toggleAria('Scanlines', true)).toContain('Scanlines');
    expect(toggleAria('Scanlines', false)).toContain('Scanlines');
    expect(toggleAria('Scanlines', true)).not.toBe(toggleAria('Scanlines', false));
  });

  it('[Zero] parâmetro vazio não deixa `{alvo}` cru no anúncio', () => {
    expect(toggleAria('', true)).not.toContain('{alvo}');
  });
});

describe('as duas metades não se separam', () => {
  /** Botão de mentira: só o que `toggleBtn` toca. */
  function botao() {
    const attrs = {}, classes = new Set();
    return {
      attrs, classes,
      classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) },
      setAttribute: (k, v) => { attrs[k] = v; },
    };
  }

  it('[Interface] o estado que o `aria-pressed` declara é o mesmo que o rótulo mostra', () => {
    // O caso central deste arquivo. As duas funções são independentes — nada no tipo as obriga a concordar —
    // e é por isso que a concordância precisa ser cobrada em algum lugar.
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
