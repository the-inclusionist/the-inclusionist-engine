// SPDX-License-Identifier: AGPL-3.0-or-later
// render/hc-role-data — the single source of the color-blocking roles.
//
// What these tests exist to catch: a role list kept apart from the panel's drifts silently — a fifth role in the
// renderer would get a colour and no picker, with no type error. Checked by adding a fake fifth role: the cases below
// turn red.
//
// Deliberately NOT here: two cases that cannot fail. `ROLE_KEYS` IS `HC_ROLE_KEYS` (the same reference) and `HC_ROLE`
// is born as a copy of `HC_ROLE_DEF`. Comparing them would assert that an object equals itself — always passes, proves
// nothing, and still looks like coverage.
import { describe, it, expect } from 'vitest';
import { HC_ROLE_KEYS, HC_ROLE_DEF } from '../app/js/render/hc-role-data.js';
import { ROLE_LABELS } from '../app/js/ui/visual-choices.js';

describe('render/hc-role-data — a lista de papéis', () => {
  it('[Right] tem exatamente os quatro papéis, na ordem em que o painel os desenha', () => {
    expect(HC_ROLE_KEYS).toEqual(['hazard', 'climb', 'water', 'gate']);
  });

  it('[Interface] a paleta padrão cobre exatamente as chaves declaradas — nem sobra, nem falta', () => {
    expect(Object.keys(HC_ROLE_DEF).sort()).toEqual([...HC_ROLE_KEYS].sort());
  });

  it('[Right] toda cor padrão é um RGB de três canais dentro de 0..255', () => {
    for (const k of HC_ROLE_KEYS) {
      const c = HC_ROLE_DEF[k];
      expect(c).toHaveLength(3);
      for (const ch of c) {
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('render/hc-role-data — o painel acompanha a lista', () => {
  // THIS is the case that discriminates: ROLE_LABELS is written by hand in ui/visual-choices and does not derive from
  // the list. It is what keeps a new role in the renderer, with no label in the panel, from going unnoticed — the colour
  // picker would exist with an empty caption, which for a screen-reader user is worse than not existing.
  it('[Interface] todo papel tem rótulo legível no painel — sem seletor anônimo', () => {
    for (const k of HC_ROLE_KEYS) {
      expect(typeof ROLE_LABELS[k]).toBe('string');
      expect(ROLE_LABELS[k].length).toBeGreaterThan(0);
    }
  });

  it('[Interface] o painel não inventa rótulo para papel que não existe', () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...HC_ROLE_KEYS].sort());
  });
});
