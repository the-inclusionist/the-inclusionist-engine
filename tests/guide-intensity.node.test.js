// SPDX-License-Identifier: AGPL-3.0-or-later
// O GUIA FICA MAIS INTENSO AO APROXIMAR-SE, E NUNCA EMUDECE (#84 item 2).
//
// ========================= O QUE ISTO SUBSTITUI =========================
// Um `triangle` de 0,12 s a cada 0,8 s, para sempre. O veredicto do Dev: «um ping é a pior escolha possível,
// tenebroso para quem tem TEA». O que entra é presença contínua — nada dispara, a coisa fica mais presente.
//
// O eixo é o BRILHO, com uma parcela pequena de volume por cima, e a escolha é do Dev. A redundância não é
// enfeite: para uma criança com perda auditiva o brilho pode cair na banda que ela não alcança, e dois eixos
// significam que nenhum decide sozinho.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import {
  intensidadeDoGuia, PASSOS_ATE_O_FUNDO, CORTE_LONGE, CORTE_PERTO, VOL_LONGE,
} from '../app/js/platform/guide-intensity.js';

describe('platform/guide-intensity — a distancia vira brilho', () => {
  it('[Right] em cima do alvo abre no maximo, no fundo da escala fecha no minimo', () => {
    expect(intensidadeDoGuia(0).corte).toBeCloseTo(CORTE_PERTO, 6);
    expect(intensidadeDoGuia(0).volume).toBeCloseTo(1, 6);
    expect(intensidadeDoGuia(PASSOS_ATE_O_FUNDO).corte).toBeCloseTo(CORTE_LONGE, 6);
    expect(intensidadeDoGuia(PASSOS_ATE_O_FUNDO).volume).toBeCloseTo(VOL_LONGE, 6);
  });

  it('⚠️ [Zero] NUNCA emudece — longe ainda soa, e e a assercao que mais importa', () => {
    // Se o guia calasse ao longe, «longe» ficaria indistinguivel de «nao ha alvo», e a crianca que depende
    // dele concluiria que nao ha nada para achar exatamente quando ha e esta distante.
    for (const passos of [12, 20, 100, 5000]) {
      expect(intensidadeDoGuia(passos).volume, `${passos} passos calou o guia`).toBeGreaterThanOrEqual(VOL_LONGE);
      expect(intensidadeDoGuia(passos).corte, `${passos} passos fechou o filtro`).toBeGreaterThanOrEqual(CORTE_LONGE);
    }
    expect(VOL_LONGE, 'o piso de volume virou zero').toBeGreaterThan(0);
  });

  it('⚠️ [Right] os DOIS eixos crescem juntos ao aproximar — nenhum decide sozinho', () => {
    const passos = [12, 9, 6, 3, 0];
    const cortes = passos.map((p) => intensidadeDoGuia(p).corte);
    const vols = passos.map((p) => intensidadeDoGuia(p).volume);
    for (let i = 1; i < passos.length; i++) {
      expect(cortes[i], `o brilho nao subiu de ${passos[i - 1]} para ${passos[i]}`).toBeGreaterThan(cortes[i - 1]);
      expect(vols[i], `o volume nao subiu de ${passos[i - 1]} para ${passos[i]}`).toBeGreaterThan(vols[i - 1]);
    }
  });

  it('⚠️ [Boundary] o brilho e EXPONENCIAL: a meia distancia nao esta a meio caminho', () => {
    // Uma rampa linear abriria quase tudo no primeiro terco do caminho e depois pareceria parada — a crianca
    // sentiria que chegou quando ainda faltava metade. Com razao constante, meio caminho da a MEDIA
    // GEOMETRICA dos extremos, que e sensivelmente menor do que a aritmetica.
    const meio = intensidadeDoGuia(PASSOS_ATE_O_FUNDO / 2).corte;
    expect(meio).toBeCloseTo(Math.sqrt(CORTE_LONGE * CORTE_PERTO), 4);
    expect(meio, 'o corte virou linear').toBeLessThan((CORTE_LONGE + CORTE_PERTO) / 2);
  });

  it('[Boundary] e o VOLUME e linear — a assimetria e deliberada', () => {
    // Se os dois fossem exponenciais acelerariam no mesmo ponto, que e o oposto de ter dois eixos.
    expect(intensidadeDoGuia(PASSOS_ATE_O_FUNDO / 2).volume).toBeCloseTo((1 + VOL_LONGE) / 2, 6);
  });

  it('[Zero] entrada absurda cai no fundo da escala em vez de produzir NaN', () => {
    for (const mau of [NaN, Infinity, -1, -0.0001]) {
      const i = intensidadeDoGuia(mau);
      expect(Number.isFinite(i.corte), `${mau} produziu corte nao-finito`).toBe(true);
      expect(i.volume).toBeCloseTo(VOL_LONGE, 6);
    }
  });

  it('⚠️ [Interface] o fundo da escala e a regua que o resto do modulo ja usa', () => {
    // `chaveDeDistancia` corta «muito perto» em 4 passos e «perto» em 9; `PAN_PACES` satura o estereo em 11.
    // O guia satura logo depois — a informacao fina serve para quem ja esta a chegar. Se alguem mudar este
    // numero para dentro daquela faixa, o guia passa a estar no fundo enquanto o sonar ainda diz «perto».
    expect(PASSOS_ATE_O_FUNDO).toBeGreaterThan(9);
    expect(CORTE_PERTO, 'acima disto o timbre sibila, e sibilar chama atencao como um bipe').toBeLessThanOrEqual(4000);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · pondo `VOL_LONGE = 0` → "[Zero] NUNCA emudece" reprova nas quatro distancias e na assercao final. E o
//     defeito que faria «longe» soar como «nao ha alvo».
//   · trocando a interpolacao do corte por linear (`CORTE_LONGE + (CORTE_PERTO - CORTE_LONGE) * perto`) →
//     "[Boundary] o brilho e EXPONENCIAL" reprova nas duas assercoes, com a media aritmetica no lugar da
//     geometrica.
//   · trocando o volume para exponencial tambem → "[Boundary] e o VOLUME e linear" reprova. Os dois eixos
//     passariam a acelerar no mesmo ponto, que e o oposto de ter dois.
//   · tirando o `Math.min(1, …)` da saturacao → "[Zero] NUNCA emudece" reprova a 20, 100 e 5000 passos, com o
//     volume abaixo do piso e o corte abaixo de `CORTE_LONGE`.
//   · baixando `PASSOS_ATE_O_FUNDO` para 8 → reprovam DOIS: "[Interface] o fundo da escala e a regua" e
//     "[Right] os DOIS eixos crescem juntos", porque a 12 e a 9 passos ja se estaria saturado e os dois
//     eixos ficariam parados entre eles. O guia estaria no fundo enquanto o sonar ainda dissesse «perto».
