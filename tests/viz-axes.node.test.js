// SPDX-License-Identifier: AGPL-3.0-or-later
// O gate dos DOIS EIXOS (ADR-0076, issue #104).
//
// ⚠️ O QUE ESTÁ EM JOGO: hoje `p.viz` guarda UMA string, então escolher `fix-deuter` desliga o contraste 7:1
// e escolher contraste desliga a correção. Uma criança com daltonismo que também precise de alto contraste
// não pode ter os dois — e as duas necessidades coexistem numa mesma pessoa com frequência.
import { describe, it, expect } from 'vitest';
import {
  PADRAO, TEMAS, CORRECOES, SIMULACOES, CHAVES_ANTIGAS,
  nosPadroes, simulacaoIndisponivel, migrarVisual, aplicacao,
  ehSimulacao, ehCego, ehBaixaVisao, temAltoContraste, proximoTema, proximaCorrecao, chaveDeTextura,
} from '../app/js/render/viz-axes.js';
import { VIZ_MODES, VIZ_FILTER } from '../app/js/render/viz-modes.js';
import { isDirectMode } from '../app/js/render/viz-setters.js';

describe('os dois eixos COMPÕEM — é a razão inteira da issue', () => {
  it('⚠️ contraste 7:1 E correção de deuteranopia ao mesmo tempo', () => {
    const v = { tema: 'hc7', correcao: 'deuter', simulacao: null };
    expect(v.tema).toBe('hc7');
    expect(v.correcao).toBe('deuter');
    // E o estado sobrevive a uma ida e volta pela migração, que é por onde ele passa ao ser lido.
    expect(migrarVisual(v)).toEqual(v);
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
    expect(nosPadroes(PADRAO)).toBe(true);
    expect(simulacaoIndisponivel(PADRAO)).toBeNull();
  });

  it('⚠️ com o TEMA fora do padrão, indisponível — e o motivo é o tema', () => {
    // Por cima de um tema de alto contraste, a simulação mostra o que o TEMA faz, não o que a
    // deuteranopia faz. Não é uma demonstração mais fraca: ensina uma coisa falsa.
    expect(simulacaoIndisponivel({ tema: 'hc7', correcao: 'tricro', simulacao: null })).toBe('tema');
  });

  it('⚠️ com a CORREÇÃO fora do padrão, indisponível — e o motivo é a correção', () => {
    // De uma tela já corrigida, a simulação não mostra nem a deficiência nem a correção.
    expect(simulacaoIndisponivel({ tema: 'padrao', correcao: 'deuter', simulacao: null })).toBe('correcao');
  });

  it('com os dois fora, o motivo diz `ambos` — não se escolhe um para culpar', () => {
    expect(simulacaoIndisponivel({ tema: 'hc45', correcao: 'protan', simulacao: null })).toBe('ambos');
  });

  it('⚠️ devolve MOTIVO e não só `false`', () => {
    // O ADR-0076 exige recusa VISÍVEL e explicada: nunca silenciosamente removida, nunca aceita e depois
    // ignorada. E o motivo é um facto sobre a demonstração, não uma repreensão — quem ligou o alto
    // contraste ligou-o porque precisa.
    const m = simulacaoIndisponivel({ tema: 'hc3', correcao: 'tricro', simulacao: null });
    expect(typeof m).toBe('string');
    expect(m).not.toBe('false');
  });
});

describe('a migração: nenhum ajuste já escolhido se perde', () => {
  it('⚠️ TODA chave antiga tem tradução — a asserção que nomeia zero chaves', () => {
    // Percorre `VIZ_MODES`, que é a lista real do menu de hoje, e não uma lista escrita à mão neste
    // ficheiro. Um modo novo lá nasce coberto ou faz este caso reprovar.
    for (const m of VIZ_MODES) {
      expect(CHAVES_ANTIGAS, `modo "${m.key}" sem tradução`).toContain(m.key);
    }
  });

  it('os três níveis de contraste viram TEMA, com a correção no padrão', () => {
    expect(migrarVisual('hc-direto')).toEqual({ tema: 'hc3', correcao: 'tricro', simulacao: null });
    expect(migrarVisual('hc-direto-45')).toEqual({ tema: 'hc45', correcao: 'tricro', simulacao: null });
    expect(migrarVisual('hc-direto-7')).toEqual({ tema: 'hc7', correcao: 'tricro', simulacao: null });
  });

  it('as três correções viram CORREÇÃO, com o tema no padrão', () => {
    expect(migrarVisual('fix-protan').correcao).toBe('protan');
    expect(migrarVisual('fix-deuter').correcao).toBe('deuter');
    expect(migrarVisual('fix-tritan').correcao).toBe('tritan');
    expect(migrarVisual('fix-deuter').tema).toBe('padrao');
  });

  it('⚠️ as nove simulações voltam com os DOIS eixos no padrão', () => {
    // Não é perda de informação: uma simulação só era possível a partir do padrão de qualquer forma,
    // porque ela SUBSTITUÍA tudo o resto. A forma nova diz isso em vez de o deixar implícito.
    for (const k of ['sim-protan', 'sim-deuter', 'sim-tritan', 'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind']) {
      const v = migrarVisual(k);
      expect(v.simulacao, k).toBe(k);
      expect(nosPadroes(v), `${k} tinha de voltar nos padrões`).toBe(true);
    }
  });

  it('`normal` volta como o padrão dos dois eixos', () => {
    expect(migrarVisual('normal')).toEqual(PADRAO);
  });

  it('é IDEMPOTENTE — o objeto já migrado atravessa igual', () => {
    const v = { tema: 'hc7', correcao: 'deuter', simulacao: null };
    expect(migrarVisual(migrarVisual(v))).toEqual(v);
  });

  it('⚠️ desconhecido cai no PADRÃO em vez de estourar', () => {
    // O dado vem do navegador de uma criança e pode ser de outra versão, de outra máquina, ou lixo. Um
    // `throw` aqui tiraria o jogo do ar por causa de uma preferência.
    expect(migrarVisual('modo-que-nunca-existiu')).toEqual(PADRAO);
    expect(migrarVisual(null)).toEqual(PADRAO);
    expect(migrarVisual(undefined)).toEqual(PADRAO);
    expect(migrarVisual(42)).toEqual(PADRAO);
    expect(migrarVisual({ tema: 'roxo', correcao: 'nada', simulacao: 'voar' })).toEqual(PADRAO);
  });

  it('um objeto MEIO válido conserva a metade válida', () => {
    expect(migrarVisual({ tema: 'hc45', correcao: 'invalida', simulacao: null }))
      .toEqual({ tema: 'hc45', correcao: 'tricro', simulacao: null });
  });
});

describe('⚠️ nenhum nome agrupa correção e simulação', () => {
  it('os eixos e as simulações são listas separadas, sem interseção', () => {
    // O agrupamento por MECANISMO já as fundiu duas vezes — ADR-0011 e ADR-0075. Um grupo de ajustes
    // chama-se pelo que ele SERVE, nunca pelo como é implementado.
    for (const c of CORRECOES) expect(SIMULACOES).not.toContain(c);
    for (const s of SIMULACOES) { if (s) expect(CORRECOES).not.toContain(s); }
  });

  it('e nenhum dos padrões diagnostica quem lê', () => {
    // `modo sem deficiência visual` foi oferecido e recusado. Os padrões chamam-se `padrao` e `tricro`.
    expect(TEMAS).toContain('padrao');
    expect(CORRECOES).toContain('tricro');
    for (const nome of [...TEMAS, ...CORRECOES]) {
      expect(String(nome)).not.toMatch(/defici|normal|sem-/i);
    }
  });
});

describe('⚠️ a COMPOSIÇÃO: os dois aplicados ao mesmo tempo', () => {
  it('7:1 E correção de deuteranopia produzem OS DOIS', () => {
    // A asserção que é a issue #104 inteira. Enquanto `p.viz` era um campo, aplicar um apagava o outro.
    const a = aplicacao({ tema: 'hc7', correcao: 'deuter', simulacao: null });
    expect(a.direto).toBe('hc-direto-7');
    expect(a.filtro).toBe('fix-deuter');
  });

  it('⚠️ e as chaves que saem existem NAS TABELAS REAIS — senão a composição é de mentira', () => {
    // Sem isto, `aplicacao` poderia devolver duas strings bonitas que não casam com filtro nenhum, e o
    // teste acima passaria enquanto a tela não mudava. Comparo com as tabelas que a engine de facto lê.
    for (const tema of TEMAS) {
      for (const correcao of CORRECOES) {
        const a = aplicacao({ tema, correcao, simulacao: null });
        if (a.direto) expect(isDirectMode(a.direto), `modo direto inexistente: ${a.direto}`).toBe(true);
        if (a.filtro) expect(VIZ_FILTER[a.filtro], `filtro inexistente: ${a.filtro}`).toBeTypeOf('string');
      }
    }
  });

  it('as nove simulações também casam com a tabela de filtros', () => {
    for (const s of SIMULACOES) {
      if (!s) continue;
      const a = aplicacao({ tema: 'padrao', correcao: 'tricro', simulacao: s });
      expect(VIZ_FILTER[a.filtro], `filtro inexistente para ${s}`).toBeTypeOf('string');
      expect(a.direto, 'uma simulação corre no tema padrão').toBeNull();
    }
  });

  it('o padrão dos dois eixos não aplica nada', () => {
    expect(aplicacao(PADRAO)).toEqual({ direto: null, filtro: null });
  });

  it('tema sozinho não inventa filtro, e correção sozinha não inventa tema', () => {
    expect(aplicacao({ tema: 'hc45', correcao: 'tricro', simulacao: null })).toEqual({ direto: 'hc-direto-45', filtro: null });
    expect(aplicacao({ tema: 'padrao', correcao: 'protan', simulacao: null })).toEqual({ direto: null, filtro: 'fix-protan' });
  });
});

describe('as perguntas que os leitores fazem, cada uma com nome', () => {
  const v = (o) => ({ ...PADRAO, ...o });

  it('ehSimulacao / ehCego / ehBaixaVisao', () => {
    expect(ehSimulacao(PADRAO)).toBe(false);
    expect(ehSimulacao(v({ simulacao: 'lv-haze' }))).toBe(true);
    expect(ehCego(v({ simulacao: 'blind' }))).toBe(true);
    expect(ehCego(v({ simulacao: 'lv-blur' }))).toBe(false);
    expect(ehBaixaVisao(v({ simulacao: 'lv-tunnel' }))).toBe(true);
    expect(ehBaixaVisao(v({ simulacao: 'blind' }))).toBe(false);
  });

  it('⚠️ ehBaixaVisao cobre as CINCO, e nao so as que este teste nomeia', () => {
    const cinco = SIMULACOES.filter((s) => s && s.startsWith('lv-'));
    expect(cinco).toHaveLength(5);
    for (const s of cinco) expect(ehBaixaVisao(v({ simulacao: s })), s).toBe(true);
  });

  it('temAltoContraste responde pelo TEMA e ignora a correcao', () => {
    expect(temAltoContraste(PADRAO)).toBe(false);
    expect(temAltoContraste(v({ correcao: 'deuter' }))).toBe(false);
    expect(temAltoContraste(v({ tema: 'hc3' }))).toBe(true);
  });
});

describe('os ciclos andam CADA UM no seu eixo', () => {
  it('⚠️ proximoTema nao toca na correcao', () => {
    // Era isto que a string tornava impossivel: ciclar o contraste apagava a correcao.
    const antes = { tema: 'padrao', correcao: 'deuter', simulacao: null };
    const depois = proximoTema(antes);
    expect(depois.tema).toBe('hc3');
    expect(depois.correcao).toBe('deuter');
  });

  it('⚠️ proximaCorrecao nao toca no tema', () => {
    const antes = { tema: 'hc7', correcao: 'tricro', simulacao: null };
    const depois = proximaCorrecao(antes);
    expect(depois.correcao).toBe('protan');
    expect(depois.tema).toBe('hc7');
  });

  it('os dois ciclos DAO A VOLTA e voltam ao padrao', () => {
    let t = PADRAO;
    for (let i = 0; i < TEMAS.length; i++) t = proximoTema(t);
    expect(t.tema).toBe(PADRAO.tema);
    let c = PADRAO;
    for (let i = 0; i < CORRECOES.length; i++) c = proximaCorrecao(c);
    expect(c.correcao).toBe(PADRAO.correcao);
  });

  it('⚠️ um valor desconhecido comeca no PADRAO nos DOIS ciclos', () => {
    // O original tinha uma assimetria sem dono: `nextCvd` mandava desconhecido para o indice 1
    // (`fix-protan`) e `nextContrast` para o 0. Um valor desconhecido e exatamente o caso em que nao se
    // sabe o que a crianca queria, e o padrao e a unica resposta que nao escolhe por ela.
    expect(proximoTema({ tema: 'inexistente', correcao: 'tricro', simulacao: null }).tema).toBe('padrao');
    expect(proximaCorrecao({ tema: 'padrao', correcao: 'inexistente', simulacao: null }).correcao).toBe('tricro');
  });
});

describe('chaveDeTextura', () => {
  it('a SIMULACAO vence o tema, porque e a ordem do que a crianca ve', () => {
    expect(chaveDeTextura({ tema: 'hc7', correcao: 'tricro', simulacao: 'blind' })).toBe('blind');
  });

  it('sem simulacao, o TEMA; sem nenhum dos dois, `normal`', () => {
    expect(chaveDeTextura({ tema: 'hc45', correcao: 'tricro', simulacao: null })).toBe('hc-direto-45');
    expect(chaveDeTextura(PADRAO)).toBe('normal');
  });

  it('⚠️ a chave devolvida EXISTE na lista real de modos', () => {
    const chaves = VIZ_MODES.map((m) => m.key);
    for (const s of SIMULACOES) {
      expect(chaves, `textura inexistente`).toContain(chaveDeTextura({ ...PADRAO, simulacao: s }));
    }
    for (const tema of TEMAS) {
      expect(chaves, `textura inexistente`).toContain(chaveDeTextura({ ...PADRAO, tema }));
    }
  });
});
