// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/interruptible-speech — FALAR O ÚLTIMO PEDIDO, E CALAR O ANTERIOR NA HORA (ADR-0044, item 2).
//
// ========================= O DEFEITO QUE ISTO SUBSTITUI =========================
// O motor neural falava assim:
//
//     speak: (text) => { if (busy) next = text; else speakNow(text); }   // fila de 1
//
// Uma FILA, e de tamanho um. Varrendo cinco itens de menu, a criança ouvia o PRIMEIRO inteiro e depois o
// ÚLTIMO — os três do meio sumiam em silêncio, porque cada novo pedido sobrescrevia o `next`. É lento E
// perde informação, e as duas coisas doem no mesmo lugar: a pessoa que não enxerga navega POR ESCUTA, e a
// escuta estava vários itens atrás do foco.
//
// A XAG 106 diz o que fazer, e diz por quê: se a narração do item em foco ainda está sendo lida e o foco
// muda, "a narração do elemento original deve PARAR IMEDIATAMENTE, e a do novo elemento começar".
//
// ========================= AS DUAS COISAS QUE ISTO GARANTE =========================
//
//   1. CALA ANTES DE SINTETIZAR, não depois. Síntese neural leva tempo; parar só quando o áudio novo fica
//      pronto deixaria a voz velha falando durante a espera — o item errado, com convicção. Silêncio é a
//      resposta certa: a criança sabe que se moveu, e o silêncio confirma.
//
//   2. GERAÇÃO, e é o que impede a corrida. `sintetizar` é assíncrono, e dois pedidos podem terminar fora
//      de ordem: o segundo fica pronto primeiro, começa a tocar, e o primeiro chega depois e o atropela —
//      a criança ouviria o item que ela JÁ passou, por cima do atual. Cada pedido carrega o seu número; o
//      que voltar com número velho é descartado, em cada um dos dois `await`.
//
// ========================= POR QUE É UM MÓDULO, E NÃO UMA LINHA NO `tts` =========================
// Porque assim se pode PROVAR. O bloco neural vive dentro de um `import()` dinâmico que só resolve com o
// runtime de 25,6 MB presente; testá-lo lá dentro exigiria o motor de verdade. Aqui a política é pura —
// recebe "como sintetizar", "como tocar" e "como parar" — e o teste de node exercita a corrida e a
// interrupção com falsos, em milissegundos.

/** O que o chamador precisa fornecer. Nada aqui conhece PIPER, Web Audio ou o navegador. */
export interface MotorDeFala<Audio, Fonte> {
  /** Texto → áudio. ASSÍNCRONO de propósito: é onde a síntese neural gasta o tempo dela. */
  sintetizar(texto: string): Promise<Audio>;
  /** Começa a tocar e devolve a fonte, para que ela possa ser parada. `null` = não deu para tocar agora. */
  tocar(audio: Audio, aoTerminar: () => void): Fonte | null;
  /** Cala a fonte. Chamado com o que `tocar` devolveu, e nunca com `null`. */
  parar(fonte: Fonte): void;
}

export interface FalaInterrompivel {
  /** Fala `texto`, CALANDO na hora o que estiver falando. Não enfileira: o último pedido é o que vale. */
  falar(texto: string): void;
  /** Cala e esquece. Usado ao fechar um menu ou ao desligar a narração. */
  calar(): void;
  /** Está tocando alguma coisa? Só para teste e depuração — a política não depende disto. */
  falando(): boolean;
}

export function criarFalaInterrompivel<Audio, Fonte>(motor: MotorDeFala<Audio, Fonte>): FalaInterrompivel {
  let tocando: Fonte | null = null;
  let geracao = 0;

  /** Cala o que estiver tocando. O `try` existe porque parar uma fonte já terminada lança em alguns motores. */
  function pararTudo(): void {
    if (tocando !== null) {
      try { motor.parar(tocando); } catch (e) { /* fonte já encerrada — parar de novo não é erro */ }
      tocando = null;
    }
  }

  async function falar(texto: string): Promise<void> {
    const minha = ++geracao; // reivindica a vez ANTES de qualquer espera
    pararTudo();             // garantia 1: silêncio imediato, não ao fim da síntese
    if (!texto) return;
    try {
      const audio = await motor.sintetizar(texto);
      if (minha !== geracao) return; // garantia 2: chegou tarde — outro pedido já assumiu
      pararTudo();                   // de novo: alguém pode ter começado a tocar durante a espera
      const fonte = motor.tocar(audio, () => { if (tocando === fonte) tocando = null; });
      if (minha !== geracao) { if (fonte !== null) { try { motor.parar(fonte); } catch (e) { /* noop */ } } return; }
      tocando = fonte;
    } catch (e) {
      // Síntese falhou para ESTE texto. Não é motivo para derrubar a narração inteira: o próximo pedido
      // tenta de novo, e o silêncio de um item é melhor que um motor morto.
    }
  }

  return {
    falar: (texto) => { void falar(texto); },
    calar: () => { geracao++; pararTudo(); }, // o `++` invalida o que estiver sintetizando agora
    falando: () => tocando !== null,
  };
}
