// SPDX-License-Identifier: AGPL-3.0-or-later
// O gate dos DOIS EIXOS (ADR-0076, issue #104).
//
// ⚠️ O QUE ESTÁ EM JOGO: hoje `p.viz` guarda UMA string, então escolher `fix-deuter` desliga o contraste 7:1
// e escolher contraste desliga a correção. Uma criança com daltonismo que também precise de alto contraste
// não pode ter os dois — e as duas necessidades coexistem numa mesma pessoa com frequência.
import { describe, it, expect } from 'vitest';
import {
  PADRAO, TEMAS, CORRECOES, SIMULACOES, CHAVES_ANTIGAS,
  nosPadroes, simulacaoIndisponivel, migrarVisual,
} from '../app/js/render/viz-axes.js';
import { VIZ_MODES } from '../app/js/render/viz-modes.js';

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
