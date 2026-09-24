// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/guide-intensity — QUÃO PERTO SOA, sem bipe (#84 item 2).
//
// ========================= O QUE ISTO SUBSTITUI =========================
// O guia tocava um `triangle` de 0,12 s a cada 0,8 s, PARA SEMPRE, sem depender de movimento nem de nada ter
// mudado. O veredicto do Dev: «um ping é a pior escolha possível, tenebroso para quem tem TEA». Não era a
// frequência que estava errada — era o bipe. Reduzi-lo a «só andando» deixaria a mesma coisa a doer menos
// vezes.
//
// O que entra é uma presença CONTÍNUA que fica mais intensa conforme a criança se aproxima, ao longo da rota
// mapeada (`core/route`). Nada dispara; a coisa apenas fica mais presente.
//
// ========================= O EIXO É O BRILHO, E A DECISÃO É DO DEV =========================
// Quatro eixos foram postos na mesa — volume, brilho (corte de filtro), camadas e andamento — e a escolha foi
// **brilho como principal, com uma parcela pequena de volume como secundário**. As razões, para quem reabrir:
//
//   · VOLUME SOZINHO colide com o cursor do mixer: a criança que baixou a categoria `guide` perderia o sinal
//     inteiro, e variação de volume é a mais cansativa das quatro.
//   · ANDAMENTO lê-se como PRESSA, que é o oposto do que o modo TEA existe para proteger.
//   · CAMADAS precisa de material composto, e esta engine sintetiza.
//   · BRILHO é contínuo, sai de um `BiquadFilter` que o Web Audio já tem, e não disputa o cursor.
//
// ⚠️ E A PARCELA DE VOLUME NÃO É ENFEITE: para uma criança com perda auditiva o brilho pode cair exatamente na
// banda que ela não alcança. Dois eixos redundantes significam que nenhum deles sozinho decide.
//
// ========================= O QUE ESTE MÓDULO NÃO FAZ =========================
// Não toca nada. Devolve dois números a partir de UM: quantos passos faltam ao longo da rota. Quem monta o
// grafo é o `platform/audio-sonar`, e quem calcula a rota é o `core/route` — que já sabe contornar parede, e é
// isso que torna a intensidade honesta: ela cresce com a distância que a criança REALMENTE vai andar.
//
// Módulo-folha: não importa nada.

/** O que o guia soa, para uma dada distância. */
export interface Intensity {
  /** Corte do passa-baixo, em hertz. Grave e abafado longe; aberto e brilhante perto. */
  readonly cutoff: number;
  /** Fator sobre o volume da categoria `guide`, entre `FAR_VOL` e 1. NUNCA zero. */
  readonly volume: number;
}

/**
 * A partir de quantos passos o guia deixa de escurecer mais.
 *
 * Doze, e o número não é novo: o `chaveDeDistancia` do sonar corta «muito perto» em 4 passos e «perto» em 9,
 * e o `PAN_PACES` satura o estéreo em 11. O guia satura logo depois — a informação fina serve para quem já
 * está a chegar, e mais longe do que isso «longe» basta.
 */
export const STEPS_TO_FLOOR = 12;

/** O corte no fundo da escala: abafado, presente, sem ser um som de alarme. */
export const FAR_CUT = 320;
/** O corte no alvo: aberto. Acima disto o timbre passa a sibilar, e sibilar chama atenção como um bipe. */
export const NEAR_CUT = 3200;

/**
 * O fator de volume mais baixo.
 *
 * ⚠️ NUNCA ZERO, E É A ASSERÇÃO MAIS IMPORTANTE DESTE FICHEIRO. Se o guia emudecesse ao longe, «longe» ficaria
 * indistinguível de «não há alvo» — e a criança que depende dele concluiria que não há nada para achar,
 * exatamente quando há e está distante. Silêncio é uma afirmação, e aqui seria uma afirmação falsa.
 */
export const FAR_VOL = 0.55;

/**
 * A intensidade para `passos` de distância ao longo da rota.
 *
 * ⚠️ A INTERPOLAÇÃO DO CORTE É EXPONENCIAL, e não linear, pelo mesmo motivo do earcon da #124: o ouvido
 * percebe altura e brilho em RAZÃO, não em diferença. Uma rampa linear de 320 a 3200 abriria quase tudo no
 * primeiro terço do caminho e depois pareceria parada — a criança sentiria que chegou quando ainda faltava
 * metade.
 *
 * O volume interpola LINEARMENTE, e a assimetria é deliberada: ele é o eixo secundário, e uma curva também
 * exponencial ali faria os dois acelerarem no mesmo ponto, que é o oposto de ter dois eixos.
 */
export function guideIntensity(passos: number): Intensity {
  if (!Number.isFinite(passos) || passos < 0) return { cutoff: FAR_CUT, volume: FAR_VOL };
  // 0 = em cima do alvo; 1 = no fundo da escala ou além.
  const far = Math.min(1, passos / STEPS_TO_FLOOR);
  const near = 1 - far;
  return {
    cutoff: FAR_CUT * Math.pow(NEAR_CUT / FAR_CUT, near),
    volume: FAR_VOL + (1 - FAR_VOL) * near,
  };
}
