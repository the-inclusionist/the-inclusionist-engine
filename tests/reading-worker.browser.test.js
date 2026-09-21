// SPDX-License-Identifier: AGPL-3.0-or-later
//
// A THREAD DE VERDADE (issue #185). O ficheiro `tests/reading-in-worker.node.test.js` mede o protocolo dos dois lados com uma
// thread de mentira; o que ELE não pode medir é a única coisa que falha no dia da entrega: **o worker existe como ficheiro, o
// navegador consegue abri-lo, e o que está lá dentro responde**.
//
// 🔴 É a forma de defeito que este repositório já encontrou duas vezes esta semana: o duble tinha a forma da crença de quem o
// escreveu (`platform/vosk-runtime`, 2026-09-21), e um caminho `new URL(…, import.meta.url)` que o empacotador não reconhecesse
// resolveria contra a PÁGINA e daria 404 em todo jogo menos naquele cujas pastas por acaso casassem.
//
// ⚠️ SEM MODELO NENHUM, de propósito: pede-se uma língua que o projecto não fala, e o que se mede é que a recusa volta da
// thread pelo nome. Um caso que trouxesse os 378 MiB do português para dentro de um navegador de teste mediria a paciência da
// máquina, não o worker.
import { describe, it, expect } from 'vitest';
import { createReadingInWorker } from '../app/js/platform/reading-in-worker.js';

describe('o worker da leitura existe, abre e responde', () => {
  it('🔴 [Right] o navegador abre o ficheiro do worker e a recusa volta de lá pelo nome da língua', async () => {
    const leitura = createReadingInWorker({ base: document.baseURI, language: 'fr-FR' });
    try {
      await expect(leitura.transcribe(new Float32Array(16)), 'nada voltou da thread — o ficheiro não abriu')
        .rejects.toThrow(/fr-FR/);
    } finally {
      leitura.close();
    }
  });

  /*
   * ⚠️ O PAR DA RECUSA, e sem ele o caso acima passaria com um worker que rejeitasse TUDO: uma língua que o projecto fala
   * abre o modelo — e aqui ela vai até onde a entrega deste servidor de teste chega, que é um 404 do ficheiro do modelo. O que
   * se afirma é a DIFERENÇA entre as duas recusas: uma diz a língua, a outra diz o ficheiro.
   */
  it('⚠️ [Boundary] uma língua que o projeto fala chega ao ficheiro do modelo — e é ele que falta, não a língua', async () => {
    const leitura = createReadingInWorker({ base: document.baseURI, language: 'pt-BR' });
    try {
      await expect(leitura.transcribe(new Float32Array(16))).rejects.toThrow(/HTTP|delivery|fetch|Failed/i);
    } finally {
      leitura.close();
    }
  });
});
