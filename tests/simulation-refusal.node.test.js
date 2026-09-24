// SPDX-License-Identifier: AGPL-3.0-or-later
// A RECUSA DA SIMULAÇÃO, dita à criança (#104, ADR-0076 §4 / definition of done, caixa 3).
//
// ========================= OS DOIS DEFEITOS QUE ESTA RECUSA EXISTE PARA NÃO COMETER =========================
// O registo exige que uma simulação indisponível apareça «never silently removed, never accepted then
// ignored», e as duas metades são defeitos diferentes:
//   · REMOVER EM SILÊNCIO ensina que a coisa não existe — um adulto que ontem a mostrou e hoje não a acha
//     conclui que ela foi tirada, e não que ele próprio ligou o alto contraste.
//   · ACEITAR E IGNORAR é pior, porque a demonstração PARECE correr: por cima de um ajuste ela mostra o
//     AJUSTE e não a deficiência. ⚠️ Não é uma demonstração mais fraca — ela ensina uma coisa falsa.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import {
  simulationRefusal, showsEvenWhenUnavailable, REASON_KEY,
} from '../app/js/ui/simulation-refusal.js';
import { DEFAULT_VISUAL, THEMES, CORRECTIONS } from '../app/js/render/viz-axes.js';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

const comEixos = (tema, correcao) => ({ tema, correcao, simulacao: null });

describe('ui/simulation-refusal · quando NÃO há o que dizer, não se diz nada', () => {
  it('[Zero] com os dois eixos no padrão a simulação está disponível, e a recusa é `null`', () => {
    // Um aviso que aparece sempre deixa de ser lido — a mesma regra do `ui/reach-notice`.
    expect(simulationRefusal(DEFAULT_VISUAL)).toBeNull();
    expect(simulationRefusal({ ...DEFAULT_VISUAL, simulacao: 'lv-tunnel' })).toBeNull();
  });
});

describe('ui/simulation-refusal · quando há, ela diz QUAL eixo e devolve DADO', () => {
  it('[Right] cada eixo fora do padrão dá o seu motivo, e os dois juntos dão o terceiro', () => {
    expect(simulationRefusal(comEixos('hc7', 'tricro'))?.axis).toBe('tema');
    expect(simulationRefusal(comEixos('padrao', 'deuter'))?.axis).toBe('correcao');
    expect(simulationRefusal(comEixos('hc7', 'deuter'))?.axis).toBe('ambos');
  });

  it('⚠️ [Many] TODO par de eixos fora do padrão produz recusa — nenhum escapa por não ter sido pensado', () => {
    for (const tema of THEMES) {
      for (const correcao of CORRECTIONS) {
        const v = comEixos(tema, correcao);
        const nosPadroes = tema === 'padrao' && correcao === 'tricro';
        expect(!!simulationRefusal(v), `${tema}/${correcao}`).toBe(!nosPadroes);
      }
    }
  });

  it('[Right] devolve CHAVE i18n e não texto — a frase é da interface', () => {
    // Devolver português daqui repetiria o defeito que o `PADWIZ_STEPS` deixou de cometer.
    const r = simulationRefusal(comEixos('hc7', 'tricro'));
    expect(r.key).toBe('sim.indisponivel.tema');
    expect(/[À-ÿ ]/.test(r.axis), 'o eixo virou prosa em vez de chave').toBe(false);
  });
});

describe('ui/simulation-refusal · a frase, nos três idiomas', () => {
  const DICS = { pt, en, es };

  it('⚠️ [Interface] os três motivos existem nos TRÊS idiomas — o pilar 3 é piso, não meta', () => {
    for (const [nome, dic] of Object.entries(DICS)) {
      for (const chave of Object.values(REASON_KEY)) {
        expect(dic[chave], `«${chave}» falta em ${nome}`).toBeTruthy();
      }
    }
  });

  it('⚠️ [Right] a frase é um FACTO sobre a demonstração, e diz o caminho de VOLTA', () => {
    // ⚠️ O motivo não pode repreender quem escolheu: quem ligou o alto contraste ligou-o porque precisa dele
    // para ver. A frase tem de dizer o que a demonstração precisa, e como lá chegar — nunca «desligue isso».
    for (const chave of Object.values(REASON_KEY)) {
      expect(pt[chave], `«${chave}» não diz o caminho de volta`).toMatch(/padrão|tricromática/);
      expect(pt[chave], `«${chave}» manda desligar em vez de explicar`).not.toMatch(/desligue|desative|tire/i);
    }
  });

  it('[Interface] cada motivo tem frase PRÓPRIA — três chaves e não uma com `{eixo}`', () => {
    // Em português «o tema» e «a correção de cor» levam artigos diferentes, e «os dois» não é o plural de
    // nenhum deles. Uma frase com parâmetro obrigaria cada idioma a montar concordância a partir de um
    // substantivo solto — o defeito que o `sr.nav.clockOne` já registou para «às 1 horas».
    const frases = Object.values(REASON_KEY).map((k) => pt[k]);
    expect(new Set(frases).size, 'dois motivos partilham a mesma frase').toBe(3);
    for (const f of frases) expect(f, 'a frase ficou com um parâmetro solto').not.toMatch(/\{eixo\}/);
  });
});

describe('ui/simulation-refusal · e a linha NÃO some', () => {
  it('⚠️ [Right] indisponível continua VISÍVEL — «never silently removed»', () => {
    // A metade do ADR-0076 que é fácil de esquecer, porque esconder é sempre mais simples do que explicar.
    // Sumir ensina que a coisa não existe; o que ela precisa é de aparecer e dizer porquê.
    expect(showsEvenWhenUnavailable()).toBe(true);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · `simulationRefusal` a devolver sempre `null` -> reprovam TRES. E a metade «accepted then ignored»: a
//     simulacao seria oferecida por cima de um ajuste e mostraria o AJUSTE, ensinando uma coisa falsa.
//   · `showsEvenWhenUnavailable` a devolver `false` -> reprova o caso da visibilidade. E a outra metade,
//     «never silently removed», e e a mais facil de cometer porque esconder e sempre mais simples do que
//     explicar: a linha sumiria e um adulto concluiria que a simulacao foi tirada do jogo.
//   · apontando o motivo `correcao` para a chave do `tema` -> reprova «cada motivo tem frase PROPRIA». Duas
//     recusas diferentes passariam a dizer a mesma coisa, e uma delas estaria errada.
//   · trocando a frase do tema por «Desligue o alto contraste para ver a simulacao» -> reprova o caso do
//     FACTO. E a mutacao que mais interessa: a frase fica curta, clara e util — e repreende quem ligou o alto
//     contraste porque precisa dele para ver. O motivo e' um facto sobre a demonstracao, nao uma ordem.
//   · apagando `sim.indisponivel.ambos` do dicionario ES -> reprova o caso dos tres idiomas. O pilar 3 e'
//     PISO e nao meta, e uma chave em falta cala a recusa inteira naquela lingua.
