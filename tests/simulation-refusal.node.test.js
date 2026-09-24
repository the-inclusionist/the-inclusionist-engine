// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SIMULATION'S REFUSAL, said to the child (#104, ADR-0076 §4 / definition of done, box 3).
//
// ========================= THE TWO DEFECTS THIS REFUSAL EXISTS NOT TO COMMIT =========================
// The record requires that an unavailable simulation appear «never silently removed, never accepted then ignored», and
// the two halves are different defects:
//   · REMOVING IN SILENCE teaches that the thing does not exist — an adult who showed it yesterday and cannot find it
//     today concludes it was taken away, not that they themselves turned on high contrast.
//   · ACCEPTING AND IGNORING is worse, because the demonstration SEEMS to run: on top of a setting it shows the SETTING
//     and not the disability. ⚠️ It is not a weaker demonstration — it teaches something false.
//
// MUTATIONS CHECKED (at the end of the file).
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
    // A warning that always appears stops being read — the same rule as `ui/reach-notice`.
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
    // Returning Portuguese from here would repeat the defect `PADWIZ_STEPS` no longer commits.
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
    // ⚠️ The reason must not scold whoever chose: whoever turned on high contrast did so because they need it to see.
    // The sentence has to say what the demonstration needs, and how to get there — never «desligue isso».
    for (const chave of Object.values(REASON_KEY)) {
      expect(pt[chave], `«${chave}» não diz o caminho de volta`).toMatch(/padrão|tricromática/);
      expect(pt[chave], `«${chave}» manda desligar em vez de explicar`).not.toMatch(/desligue|desative|tire/i);
    }
  });

  it('[Interface] cada motivo tem frase PRÓPRIA — três chaves e não uma com `{eixo}`', () => {
    // In Portuguese «o tema» and «a correção de cor» take different articles, and «os dois» is the plural of neither.
    // A sentence with a parameter would force each language to build agreement from a loose noun — the defect
    // `sr.nav.clockOne` already recorded for «às 1 horas».
    const frases = Object.values(REASON_KEY).map((k) => pt[k]);
    expect(new Set(frases).size, 'dois motivos partilham a mesma frase').toBe(3);
    for (const f of frases) expect(f, 'a frase ficou com um parâmetro solto').not.toMatch(/\{eixo\}/);
  });
});

describe('ui/simulation-refusal · e a linha NÃO some', () => {
  it('⚠️ [Right] indisponível continua VISÍVEL — «never silently removed»', () => {
    // The half of ADR-0076 that is easy to forget, because hiding is always simpler than explaining. Vanishing teaches
    // that the thing does not exist; what it needs is to appear and say why.
    expect(showsEvenWhenUnavailable()).toBe(true);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · `simulationRefusal` always returning `null` -> THREE fail. It is the «accepted then ignored» half: the simulation
//     would be offered on top of a setting and would show the SETTING, teaching something false.
//   · `showsEvenWhenUnavailable` returning `false` -> the visibility case fails. It is the other half, «never silently
//     removed», and it is the easiest to commit because hiding is always simpler than explaining: the row would vanish
//     and an adult would conclude the simulation was taken out of the game.
//   · pointing the `correcao` reason at the `tema` key -> fails «cada motivo tem frase PROPRIA». Two different refusals
//     would say the same thing, and one of them would be wrong.
//   · replacing the theme sentence with «Desligue o alto contraste para ver a simulacao» -> the FACT case fails. It is
//     the mutation that matters most: the sentence becomes short, clear and useful — and scolds whoever turned on high
//     contrast because they need it to see. The reason is a fact about the demonstration, not an order.
//   · deleting `sim.indisponivel.ambos` from the ES dictionary -> the three-languages case fails. Pillar 3 is a FLOOR
//     and not a goal, and a missing key silences the whole refusal in that language.
