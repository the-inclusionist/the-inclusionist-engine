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

/** What the caller provides. Nothing here knows the neural engine, Web Audio or the browser. */
export interface SpeechEngine<Audio, Fonte> {
  /** Texto → áudio. ASSÍNCRONO de propósito: é onde a síntese neural gasta o tempo dela. */
  synthesize(text: string): Promise<Audio>;
  /** Começa a tocar e devolve a fonte, para que ela possa ser parada. `null` = não deu para tocar agora. */
  play(audio: Audio, onEnded: () => void): Fonte | null;
  /** Cala a fonte. Chamado com o que `tocar` devolveu, e nunca com `null`. */
  stop(playing: Fonte): void;
}

export interface InterruptibleSpeech {
  /** Fala `text`, CALANDO na hora o que estiver falando. Não enfileira: o último pedido é o que vale. */
  speak(text: string): void;
  /** Cala e esquece. Usado ao fechar um menu ou ao desligar a narração. */
  silence(): void;
  /** Está tocando alguma coisa? Só para teste e depuração — a política não depende disto. */
  speaking(): boolean;
}

export function createInterruptibleSpeech<Audio, Fonte>(engine: SpeechEngine<Audio, Fonte>): InterruptibleSpeech {
  let nowPlaying: Fonte | null = null;
  let currentTurn = 0;

  /** Cala o que estiver tocando. O `try` existe porque parar uma fonte já terminada lança em alguns motores. */
  function stopPlayback(): void {
    if (nowPlaying !== null) {
      try { engine.stop(nowPlaying); } catch (e) { /* fonte já encerrada — parar de novo não é erro */ }
      nowPlaying = null;
    }
  }

  async function speakNow(text: string): Promise<void> {
    const myTurn = ++currentTurn; // reivindica a vez ANTES de qualquer espera
    stopPlayback();             // garantia 1: silêncio imediato, não ao fim da síntese
    if (!text) return;
    try {
      const audio = await engine.synthesize(text);
      if (myTurn !== currentTurn) return; // garantia 2: chegou tarde — outro pedido já assumiu
      stopPlayback();                   // de novo: alguém pode ter começado a tocar durante a espera
      const playing = engine.play(audio, () => { if (nowPlaying === playing) nowPlaying = null; });
      if (myTurn !== currentTurn) { if (playing !== null) { try { engine.stop(playing); } catch (e) { /* noop */ } } return; }
      nowPlaying = playing;
    } catch (e) {
      // Síntese falhou para ESTE texto. Não é motivo para derrubar a narração inteira: o próximo pedido
      // tenta de novo, e o silêncio de um item é melhor que um motor morto.
    }
  }

  return {
    speak: (text) => { void speakNow(text); },
    silence: () => { currentTurn++; stopPlayback(); }, // o `++` invalida o que estiver sintetizando agora
    speaking: () => nowPlaying !== null,
  };
}
