// SPDX-License-Identifier: AGPL-3.0-or-later
// The gate of the TWO AXES (ADR-0076, issue #104).
//
// ⚠️ WHAT IS AT STAKE: with a single `p.viz` string, choosing `fix-deuter` turned 7:1 contrast off and choosing contrast
// turned the correction off. A child with colour blindness who also needs high contrast could not have both — and the two
// needs often coexist in the same person.
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VISUAL, THEMES, CORRECTIONS, SIMULATIONS, LEGACY_KEYS,
  bothAxesAtDefault, simulationUnavailable, migrateVisual, howItApplies,
  isSimulation, isBlind, isLowVision, hasHighContrast, nextTheme, nextCorrection, textureKey,
} from '../app/js/render/viz-axes.js';
import { VIZ_MODES, VIZ_FILTER } from '../app/js/render/viz-modes.js';
import { isDirectMode } from '../app/js/render/viz-setters.js';

describe('os dois eixos COMPÕEM — é a razão inteira da issue', () => {
  it('⚠️ contraste 7:1 E correção de deuteranopia ao mesmo tempo', () => {
    const v = { tema: 'hc7', correcao: 'deuter', simulacao: null };
    expect(v.tema).toBe('hc7');
    expect(v.correcao).toBe('deuter');
    // And the state survives a round trip through the migration, which is the way it goes when read.
    expect(migrateVisual(v)).toEqual(v);
  });

  it('mudar o tema NÃO mexe na correção', () => {
    const antes = { tema: 'padrao', correcao: 'protan', simulacao: null };
    const depois = { ...antes, tema: 'hc45' };
    expect(depois.correcao).toBe('protan');
  });

  it('mudar a correção NÃO mexe no tema', () => {
    const antes = { tema: 'hc7', correcao: 'tricro', simulacao: null };
    const depois = { ...antes, correcao: 'tritan' };
    expect(depois.tema).toBe('hc7');
  });
});

describe('a simulação é travada nos DOIS padrões, e a recusa diz por quê', () => {
  it('nos dois padrões, disponível', () => {
    expect(bothAxesAtDefault(DEFAULT_VISUAL)).toBe(true);
    expect(simulationUnavailable(DEFAULT_VISUAL)).toBeNull();
  });

  it('⚠️ com o TEMA fora do padrão, indisponível — e o motivo é o tema', () => {
    // On top of a high-contrast theme, the simulation shows what the THEME does, not what deuteranopia does. It is not a
    // weaker demonstration: it teaches something false.
    expect(simulationUnavailable({ tema: 'hc7', correcao: 'tricro', simulacao: null })).toBe('tema');
  });

  it('⚠️ com a CORREÇÃO fora do padrão, indisponível — e o motivo é a correção', () => {
    // From an already corrected screen, the simulation shows neither the disability nor the correction.
    expect(simulationUnavailable({ tema: 'padrao', correcao: 'deuter', simulacao: null })).toBe('correcao');
  });

  it('com os dois fora, o motivo diz `ambos` — não se escolhe um para culpar', () => {
    expect(simulationUnavailable({ tema: 'hc45', correcao: 'protan', simulacao: null })).toBe('ambos');
  });

  it('⚠️ devolve MOTIVO e não só `false`', () => {
    // ADR-0076 requires a VISIBLE and explained refusal: never silently removed, never accepted and then ignored. And the
    // reason is a fact about the demonstration, not a telling-off — whoever turned high contrast on did so because they
    // need it.
    const m = simulationUnavailable({ tema: 'hc3', correcao: 'tricro', simulacao: null });
    expect(typeof m).toBe('string');
    expect(m).not.toBe('false');
  });
});

describe('a migração: nenhum ajuste já escolhido se perde', () => {
  it('⚠️ TODA chave antiga tem tradução — a asserção que nomeia zero chaves', () => {
    // Walks `VIZ_MODES`, which is the menu's real list, and not a list written by hand in this file. A new mode there is
    // born covered or makes this case fail.
    for (const m of VIZ_MODES) {
      expect(LEGACY_KEYS, `modo "${m.key}" sem tradução`).toContain(m.key);
    }
  });

  it('os três níveis de contraste viram TEMA, com a correção no padrão', () => {
    expect(migrateVisual('hc-direto')).toEqual({ tema: 'hc3', correcao: 'tricro', simulacao: null });
    expect(migrateVisual('hc-direto-45')).toEqual({ tema: 'hc45', correcao: 'tricro', simulacao: null });
    expect(migrateVisual('hc-direto-7')).toEqual({ tema: 'hc7', correcao: 'tricro', simulacao: null });
  });

  it('as três correções viram CORREÇÃO, com o tema no padrão', () => {
    expect(migrateVisual('fix-protan').correcao).toBe('protan');
    expect(migrateVisual('fix-deuter').correcao).toBe('deuter');
    expect(migrateVisual('fix-tritan').correcao).toBe('tritan');
    expect(migrateVisual('fix-deuter').tema).toBe('padrao');
  });

  it('⚠️ as nove simulações voltam com os DOIS eixos no padrão', () => {
    // It is no loss of information: a simulation was only possible from the default anyway, because it REPLACED everything
    // else. The new shape says so instead of leaving it implicit.
    for (const k of ['sim-protan', 'sim-deuter', 'sim-tritan', 'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind']) {
      const v = migrateVisual(k);
      expect(v.simulacao, k).toBe(k);
      expect(bothAxesAtDefault(v), `${k} tinha de voltar nos padrões`).toBe(true);
    }
  });

  it('`normal` volta como o padrão dos dois eixos', () => {
    expect(migrateVisual('normal')).toEqual(DEFAULT_VISUAL);
  });

  it('é IDEMPOTENTE — o objeto já migrado atravessa igual', () => {
    const v = { tema: 'hc7', correcao: 'deuter', simulacao: null };
    expect(migrateVisual(migrateVisual(v))).toEqual(v);
  });

  it('⚠️ desconhecido cai no PADRÃO em vez de estourar', () => {
    // The data comes from a child's browser and may be from another version, another machine, or rubbish. A `throw` here
    // would take the game down because of a preference.
    expect(migrateVisual('modo-que-nunca-existiu')).toEqual(DEFAULT_VISUAL);
    expect(migrateVisual(null)).toEqual(DEFAULT_VISUAL);
    expect(migrateVisual(undefined)).toEqual(DEFAULT_VISUAL);
    expect(migrateVisual(42)).toEqual(DEFAULT_VISUAL);
    expect(migrateVisual({ tema: 'roxo', correcao: 'nada', simulacao: 'voar' })).toEqual(DEFAULT_VISUAL);
  });

  it('um objeto MEIO válido conserva a metade válida', () => {
    expect(migrateVisual({ tema: 'hc45', correcao: 'invalida', simulacao: null }))
      .toEqual({ tema: 'hc45', correcao: 'tricro', simulacao: null });
  });
});

describe('⚠️ nenhum nome agrupa correção e simulação', () => {
  it('os eixos e as simulações são listas separadas, sem interseção', () => {
    // Grouping by MECHANISM has already merged them twice — ADR-0011 and ADR-0075. A group of settings is named for what it
    // SERVES, never for how it is implemented.
    for (const c of CORRECTIONS) expect(SIMULATIONS).not.toContain(c);
    for (const s of SIMULATIONS) { if (s) expect(CORRECTIONS).not.toContain(s); }
  });

  it('e nenhum dos padrões diagnostica quem lê', () => {
    // `modo sem deficiência visual` was offered and refused. The defaults are called `padrao` and `tricro`.
    expect(THEMES).toContain('padrao');
    expect(CORRECTIONS).toContain('tricro');
    for (const nome of [...THEMES, ...CORRECTIONS]) {
      expect(String(nome)).not.toMatch(/defici|normal|sem-/i);
    }
  });
});

describe('⚠️ a COMPOSIÇÃO: os dois aplicados ao mesmo tempo', () => {
  it('7:1 E correção de deuteranopia produzem OS DOIS', () => {
    // The assertion that is the whole of issue #104. While `p.viz` was one field, applying one erased the other.
    const a = howItApplies({ tema: 'hc7', correcao: 'deuter', simulacao: null });
    expect(a.direct).toBe('hc-direto-7');
    expect(a.filter).toBe('fix-deuter');
  });

  it('⚠️ e as chaves que saem existem NAS TABELAS REAIS — senão a composição é de mentira', () => {
    // Without this, `howItApplies` could return two pretty strings that match no filter at all, and the test above would
    // pass while the screen did not change. It compares with the tables the engine actually reads.
    for (const tema of THEMES) {
      for (const correcao of CORRECTIONS) {
        const a = howItApplies({ tema, correcao, simulacao: null });
        if (a.direct) expect(isDirectMode(a.direct), `modo direto inexistente: ${a.direct}`).toBe(true);
        if (a.filter) expect(VIZ_FILTER[a.filter], `filtro inexistente: ${a.filter}`).toBeTypeOf('string');
      }
    }
  });

  it('as nove simulações também casam com a tabela de filtros', () => {
    for (const s of SIMULATIONS) {
      if (!s) continue;
      const a = howItApplies({ tema: 'padrao', correcao: 'tricro', simulacao: s });
      expect(VIZ_FILTER[a.filter], `filtro inexistente para ${s}`).toBeTypeOf('string');
      expect(a.direct, 'uma simulação corre no tema padrão').toBeNull();
    }
  });

  it('o padrão dos dois eixos não aplica nada', () => {
    expect(howItApplies(DEFAULT_VISUAL)).toEqual({ direct: null, filter: null });
  });

  it('tema sozinho não inventa filtro, e correção sozinha não inventa tema', () => {
    expect(howItApplies({ tema: 'hc45', correcao: 'tricro', simulacao: null })).toEqual({ direct: 'hc-direto-45', filter: null });
    expect(howItApplies({ tema: 'padrao', correcao: 'protan', simulacao: null })).toEqual({ direct: null, filter: 'fix-protan' });
  });
});

describe('as perguntas que os leitores fazem, cada uma com nome', () => {
  const v = (o) => ({ ...DEFAULT_VISUAL, ...o });

  it('ehSimulacao / ehCego / ehBaixaVisao', () => {
    expect(isSimulation(DEFAULT_VISUAL)).toBe(false);
    expect(isSimulation(v({ simulacao: 'lv-haze' }))).toBe(true);
    expect(isBlind(v({ simulacao: 'blind' }))).toBe(true);
    expect(isBlind(v({ simulacao: 'lv-blur' }))).toBe(false);
    expect(isLowVision(v({ simulacao: 'lv-tunnel' }))).toBe(true);
    expect(isLowVision(v({ simulacao: 'blind' }))).toBe(false);
  });

  it('⚠️ ehBaixaVisao cobre as CINCO, e nao so as que este teste nomeia', () => {
    const cinco = SIMULATIONS.filter((s) => s && s.startsWith('lv-'));
    expect(cinco).toHaveLength(5);
    for (const s of cinco) expect(isLowVision(v({ simulacao: s })), s).toBe(true);
  });

  it('temAltoContraste responde pelo TEMA e ignora a correcao', () => {
    expect(hasHighContrast(DEFAULT_VISUAL)).toBe(false);
    expect(hasHighContrast(v({ correcao: 'deuter' }))).toBe(false);
    expect(hasHighContrast(v({ tema: 'hc3' }))).toBe(true);
  });
});

describe('os ciclos andam CADA UM no seu eixo', () => {
  it('⚠️ proximoTema nao toca na correcao', () => {
    // This is what the single string made impossible: cycling the contrast erased the correction.
    const antes = { tema: 'padrao', correcao: 'deuter', simulacao: null };
    const depois = nextTheme(antes);
    expect(depois.tema).toBe('hc3');
    expect(depois.correcao).toBe('deuter');
  });

  it('⚠️ proximaCorrecao nao toca no tema', () => {
    const antes = { tema: 'hc7', correcao: 'tricro', simulacao: null };
    const depois = nextCorrection(antes);
    expect(depois.correcao).toBe('protan');
    expect(depois.tema).toBe('hc7');
  });

  it('os dois ciclos DAO A VOLTA e voltam ao padrao', () => {
    let t = DEFAULT_VISUAL;
    for (let i = 0; i < THEMES.length; i++) t = nextTheme(t);
    expect(t.tema).toBe(DEFAULT_VISUAL.tema);
    let c = DEFAULT_VISUAL;
    for (let i = 0; i < CORRECTIONS.length; i++) c = nextCorrection(c);
    expect(c.correcao).toBe(DEFAULT_VISUAL.correcao);
  });

  it('⚠️ um valor desconhecido comeca no PADRAO nos DOIS ciclos', () => {
    // An unknown value is exactly the case where nobody knows what the child wanted, and the default is the only answer
    // that does not choose for her. (The old cycles disagreed with no owner: an unknown went to index 1 (`fix-protan`) in
    // one and to 0 in the other.)
    expect(nextTheme({ tema: 'inexistente', correcao: 'tricro', simulacao: null }).tema).toBe('padrao');
    expect(nextCorrection({ tema: 'padrao', correcao: 'inexistente', simulacao: null }).correcao).toBe('tricro');
  });
});

describe('textureKey', () => {
  it('a SIMULACAO vence o tema, porque e a ordem do que a crianca ve', () => {
    expect(textureKey({ tema: 'hc7', correcao: 'tricro', simulacao: 'blind' })).toBe('blind');
  });

  it('sem simulacao, o TEMA; sem nenhum dos dois, `normal`', () => {
    expect(textureKey({ tema: 'hc45', correcao: 'tricro', simulacao: null })).toBe('hc-direto-45');
    expect(textureKey(DEFAULT_VISUAL)).toBe('normal');
  });

  it('⚠️ a chave devolvida EXISTE na lista real de modos', () => {
    const chaves = VIZ_MODES.map((m) => m.key);
    for (const s of SIMULATIONS) {
      expect(chaves, `textura inexistente`).toContain(textureKey({ ...DEFAULT_VISUAL, simulacao: s }));
    }
    for (const tema of THEMES) {
      expect(chaves, `textura inexistente`).toContain(textureKey({ ...DEFAULT_VISUAL, tema }));
    }
  });
});
