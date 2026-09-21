// SPDX-License-Identifier: AGPL-3.0-or-later
// A NARRAÇÃO INTERROMPÍVEL — item 2 do ADR-0044, e a corrida que ele esconde.
//
// O motor neural falava por FILA DE UM: `if (busy) next = text; else speakNow(text)`. Varrendo cinco itens
// de menu, a criança ouvia o primeiro inteiro e depois o último — os três do meio sumiam, porque cada pedido
// sobrescrevia o `next`. Lento E lacunar, e as duas coisas doem no mesmo lugar: quem não enxerga navega por
// escuta, e a escuta ficava vários itens atrás do foco.
//
// Este arquivo prova as duas garantias com falsos, em milissegundos — o bloco neural de verdade vive dentro
// de um `import()` que só resolve com 25,6 MB de runtime presente.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { createInterruptibleSpeech } from '../app/js/platform/interruptible-speech.js';

/**
 * Motor falso com síntese de duração CONTROLÁVEL — é o que permite encenar a corrida: um pedido lento
 * seguido de um rápido, terminando fora de ordem.
 */
function motorFalso() {
  const log = [];
  /** texto → ms que a "síntese" demora. O que não estiver aqui é instantâneo. */
  const demora = {};
  let n = 0;
  const motor = {
    sintetizar: (texto) => {
      log.push('sintetizar:' + texto);
      const ms = demora[texto] || 0;
      return new Promise((r) => setTimeout(() => r({ texto, id: ++n }), ms));
    },
    tocar: (audio, aoTerminar) => {
      log.push('tocar:' + audio.texto);
      return { texto: audio.texto, aoTerminar };
    },
    parar: (fonte) => { log.push('parar:' + fonte.texto); },
  };
  return { motor, log, demora };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

describe('fala interrompível — o último pedido é o que vale', () => {
  it('[Right] fala o texto pedido', async () => {
    const { motor, log } = motorFalso();
    const fala = createInterruptibleSpeech(motor);
    fala.falar('Continuar');
    await esperar(10);
    expect(log).toEqual(['sintetizar:Continuar', 'tocar:Continuar']);
    expect(fala.falando()).toBe(true);
  });

  it('[Right] pedido novo CALA o anterior antes mesmo de sintetizar', async () => {
    // A garantia 1, e é ela que dá o silêncio imediato. Parar só quando o áudio novo fica pronto deixaria a
    // voz velha falando durante a síntese — o item errado, com convicção.
    const { motor, log } = motorFalso();
    const fala = createInterruptibleSpeech(motor);
    fala.falar('Continuar');
    await esperar(10);
    log.length = 0;
    fala.falar('Sair');
    // ANTES de qualquer espera, o `parar` já tem de ter acontecido.
    expect(log[0], 'o anterior precisa calar na hora, não ao fim da síntese').toBe('parar:Continuar');
    await esperar(10);
    expect(log).toEqual(['parar:Continuar', 'sintetizar:Sair', 'tocar:Sair']);
  });

  it('[Many] varrer CINCO itens depressa toca só o último — e nenhum do meio', async () => {
    // O caso que descreve o defeito original pelo avesso. Com a fila de um, isto tocava o primeiro E o
    // último. Agora toca UM: aquele em que o dedo parou.
    const { motor, log, demora } = motorFalso();
    for (const t of ['um', 'dois', 'três', 'quatro', 'cinco']) demora[t] = 20;
    const fala = createInterruptibleSpeech(motor);
    for (const t of ['um', 'dois', 'três', 'quatro', 'cinco']) fala.falar(t);
    await esperar(80);
    expect(log.filter((l) => l.startsWith('tocar:')), 'só o último deve tocar').toEqual(['tocar:cinco']);
  });

  it('[Boundary] síntese que termina FORA DE ORDEM não atropela a mais nova', async () => {
    // A corrida que a geração existe para impedir, e ela é real: a síntese neural de um texto curto pode
    // terminar antes da de um texto longo pedido antes. Sem a geração, a criança ouviria o item que ela já
    // passou, por cima do atual.
    const { motor, log, demora } = motorFalso();
    demora['lento'] = 50; demora['rápido'] = 5;
    const fala = createInterruptibleSpeech(motor);
    fala.falar('lento');
    await esperar(1);
    fala.falar('rápido');   // pedido depois, mas termina antes
    await esperar(100);     // tempo de sobra para o 'lento' voltar da síntese
    expect(log.filter((l) => l.startsWith('tocar:')), 'o lento não pode tocar depois').toEqual(['tocar:rápido']);
  });

  it('[Inverse] `calar` silencia e invalida o que está sintetizando', async () => {
    const { motor, log, demora } = motorFalso();
    demora['longo'] = 30;
    const fala = createInterruptibleSpeech(motor);
    fala.falar('longo');
    await esperar(1);
    fala.calar();
    await esperar(60);
    expect(log.filter((l) => l.startsWith('tocar:')), 'nada deve tocar depois de calar').toEqual([]);
    expect(fala.falando()).toBe(false);
  });

  it('[Zero] texto vazio não sintetiza — mas ainda CALA o anterior', async () => {
    // Um menu que anuncia string vazia acontece (rótulo ainda não traduzido, item sem nome). Não vale
    // sintetizar silêncio, mas vale calar: o foco mudou.
    const { motor, log } = motorFalso();
    const fala = createInterruptibleSpeech(motor);
    fala.falar('Continuar');
    await esperar(10);
    log.length = 0;
    fala.falar('');
    await esperar(10);
    expect(log).toEqual(['parar:Continuar']);
  });

  it('[Error] síntese que estoura não derruba a narração seguinte', async () => {
    // O silêncio de UM item é melhor que um motor morto. Sem o `try`, uma promessa rejeitada deixaria a
    // geração travada e o menu inteiro mudo dali para a frente.
    const log = [];
    let falhar = true;
    const motor = {
      sintetizar: (texto) => { log.push('sintetizar:' + texto); return falhar ? Promise.reject(new Error('sem voz')) : Promise.resolve({ texto }); },
      tocar: (audio) => { log.push('tocar:' + audio.texto); return { texto: audio.texto }; },
      parar: (f) => { log.push('parar:' + f.texto); },
    };
    const fala = createInterruptibleSpeech(motor);
    fala.falar('quebra');
    await esperar(10);
    falhar = false;
    fala.falar('funciona');
    await esperar(10);
    expect(log).toContain('tocar:funciona');
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · tirando o `pararTudo()` do começo de `falar` → "[Right] pedido novo CALA o anterior" falha em
//     "expected 'sintetizar:Sair' to be 'parar:Continuar'".
//   · tirando o primeiro `if (minha !== geracao) return` → "[Boundary] fora de ordem" falha com
//     ['tocar:rápido', 'tocar:lento'].
//   · trocando `falar` por uma fila (`if (tocando) proximo = texto`) → "[Many] varrer cinco" falha,
//     que é exatamente o comportamento antigo reaparecendo.
