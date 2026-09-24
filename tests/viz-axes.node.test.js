// SPDX-License-Identifier: AGPL-3.0-or-later
// O gate dos DOIS EIXOS (ADR-0076, issue #104).
//
// ⚠️ O QUE ESTÁ EM JOGO: hoje `p.viz` guarda UMA string, então escolher `fix-deuter` desliga o contraste 7:1
// e escolher contraste desliga a correção. Uma criança com daltonismo que também precise de alto contraste
// não pode ter os dois — e as duas necessidades coexistem numa mesma pessoa com frequência.
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
    // E o estado sobrevive a uma ida e volta pela migração, que é por onde ele passa ao ser lido.
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
    // Por cima de um tema de alto contraste, a simulação mostra o que o TEMA faz, não o que a
    // deuteranopia faz. Não é uma demonstração mais fraca: ensina uma coisa falsa.
    expect(simulationUnavailable({ tema: 'hc7', correcao: 'tricro', simulacao: null })).toBe('tema');
  });

  it('⚠️ com a CORREÇÃO fora do padrão, indisponível — e o motivo é a correção', () => {
    // De uma tela já corrigida, a simulação não mostra nem a deficiência nem a correção.
    expect(simulationUnavailable({ tema: 'padrao', correcao: 'deuter', simulacao: null })).toBe('correcao');
  });

  it('com os dois fora, o motivo diz `ambos` — não se escolhe um para culpar', () => {
    expect(simulationUnavailable({ tema: 'hc45', correcao: 'protan', simulacao: null })).toBe('ambos');
  });

  it('⚠️ devolve MOTIVO e não só `false`', () => {
    // O ADR-0076 exige recusa VISÍVEL e explicada: nunca silenciosamente removida, nunca aceita e depois
    // ignorada. E o motivo é um facto sobre a demonstração, não uma repreensão — quem ligou o alto
    // contraste ligou-o porque precisa.
    const m = simulationUnavailable({ tema: 'hc3', correcao: 'tricro', simulacao: null });
    expect(typeof m).toBe('string');
    expect(m).not.toBe('false');
  });
});

describe('a migração: nenhum ajuste já escolhido se perde', () => {
  it('⚠️ TODA chave antiga tem tradução — a asserção que nomeia zero chaves', () => {
    // Percorre `VIZ_MODES`, que é a lista real do menu de hoje, e não uma lista escrita à mão neste
    // ficheiro. Um modo novo lá nasce coberto ou faz este caso reprovar.
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
    // Não é perda de informação: uma simulação só era possível a partir do padrão de qualquer forma,
    // porque ela SUBSTITUÍA tudo o resto. A forma nova diz isso em vez de o deixar implícito.
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
    // O dado vem do navegador de uma criança e pode ser de outra versão, de outra máquina, ou lixo. Um
    // `throw` aqui tiraria o jogo do ar por causa de uma preferência.
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
    // O agrupamento por MECANISMO já as fundiu duas vezes — ADR-0011 e ADR-0075. Um grupo de ajustes
    // chama-se pelo que ele SERVE, nunca pelo como é implementado.
    for (const c of CORRECTIONS) expect(SIMULATIONS).not.toContain(c);
    for (const s of SIMULATIONS) { if (s) expect(CORRECTIONS).not.toContain(s); }
  });

  it('e nenhum dos padrões diagnostica quem lê', () => {
    // `modo sem deficiência visual` foi oferecido e recusado. Os padrões chamam-se `padrao` e `tricro`.
    expect(THEMES).toContain('padrao');
    expect(CORRECTIONS).toContain('tricro');
    for (const nome of [...THEMES, ...CORRECTIONS]) {
      expect(String(nome)).not.toMatch(/defici|normal|sem-/i);
    }
  });
});

describe('⚠️ a COMPOSIÇÃO: os dois aplicados ao mesmo tempo', () => {
  it('7:1 E correção de deuteranopia produzem OS DOIS', () => {
    // A asserção que é a issue #104 inteira. Enquanto `p.viz` era um campo, aplicar um apagava o outro.
    const a = howItApplies({ tema: 'hc7', correcao: 'deuter', simulacao: null });
    expect(a.direct).toBe('hc-direto-7');
    expect(a.filter).toBe('fix-deuter');
  });

  it('⚠️ e as chaves que saem existem NAS TABELAS REAIS — senão a composição é de mentira', () => {
    // Sem isto, `howItApplies` poderia devolver duas strings bonitas que não casam com filtro nenhum, e o
    // teste acima passaria enquanto a tela não mudava. Comparo com as tabelas que a engine de facto lê.
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
    // Era isto que a string tornava impossivel: ciclar o contraste apagava a correcao.
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
    // O original tinha uma assimetria sem dono: `nextCvd` mandava desconhecido para o indice 1
    // (`fix-protan`) e `nextContrast` para o 0. Um valor desconhecido e exatamente o caso em que nao se
    // sabe o que a crianca queria, e o padrao e a unica resposta que nao escolhe por ela.
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
