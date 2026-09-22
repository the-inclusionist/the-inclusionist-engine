// SPDX-License-Identifier: AGPL-3.0-or-later
// O QUE NASCE LIGADO E O QUE NASCE DESLIGADO — e por que um default de áudio é decisão de acessibilidade.
//
// ========================= POR QUE ISTO MERECE UM GATE =========================
// Um default de som parece detalhe e não é. Ele decide o que a criança OUVE antes de saber que existe um menu
// — e as duas categorias desligadas estão desligadas por motivos opostos e igualmente concretos:
//
//   · `tts` — voz robótica irrita e sobrecarrega pessoas com TEA. Quem precisa dela liga.
//   · `guide` — o beacon do guia auditivo, DESLIGADO em 2026-08-26. Ele tocava um `triangle` de 0,12 s a cada
//     0,8 s, para sempre, sem depender de movimento nem de nada ter mudado; e no modo cego a condição que o
//     libera é sempre verdadeira, então a criança que mais precisa de pistas era a que ouvia o bipe a partida
//     inteira. Veredito do Dev: "um ping é a pior escolha possível, tenebroso para quem tem TEA".
//
// ⚠️ O `guide` DESLIGADO É PROVISÓRIO, e este arquivo existe também para que ele não vire permanente por
// esquecimento. O substituto decidido é uma música que ganha intensidade conforme a criança se aproxima, e
// ANTES dela é preciso mapear a rota — preencher o mapa com as direções por onde há ar ou água, para que a
// pista siga um caminho navegável em vez de apontar em linha reta para dentro de uma parede. Quando essa
// rota existir, é para cá que se volta.
//
// ========================= E POR QUE O VALOR SALVO VENCE =========================
// Um valor salvo significa que alguém MEXEU naquele controle, e a escolha da criança não é nossa para
// desfazer. Quem já tinha ligado o guia continua com ele ligado — o default só alcança quem nunca escolheu.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { defaultAudioCat, AUDIO_CATS } from '../app/js/platform/audio-mixer.js';

const DESLIGADAS = ['tts', 'guide'];

describe('categorias de áudio · o estado de fábrica é decisão, não acaso', () => {
  it('[Zero] o gate está lendo o catálogo de verdade', () => {
    expect(AUDIO_CATS.length).toBeGreaterThanOrEqual(8);
    expect(AUDIO_CATS.map((c) => c.k)).toEqual(expect.arrayContaining(DESLIGADAS));
  });

  it('🔴 [Zero] `other` SAIU do mixer (ADR-0151, errata) — não controlava som nenhum', () => {
    // «O que esta categoria controla? Nada. Então pra que?» (Dev). Um volume sem nada por baixo é botão morto.
    expect(AUDIO_CATS.map((c) => c.k)).not.toContain('other');
  });

  it('[Right] EXATAMENTE `tts` e `guide` nascem desligadas', () => {
    // "Exatamente" nos dois sentidos: uma categoria nova que nasça muda sem motivo escrito reprova aqui, e
    // religar o `guide` sem passar por esta linha também.
    const desligadas = AUDIO_CATS.map((c) => c.k).filter((k) => !defaultAudioCat(k).on);
    expect(desligadas.sort(), 'mudou quem nasce em silêncio — o motivo está no cabeçalho de audio-mixer').toEqual([...DESLIGADAS].sort());
  });

  it('[Right] todas as outras nascem ligadas, e no mesmo volume', () => {
    for (const { k } of AUDIO_CATS) {
      if (DESLIGADAS.includes(k)) continue;
      expect(defaultAudioCat(k).on, k).toBe(true);
      expect(defaultAudioCat(k).vol, k).toBe(0.8);
    }
  });

  it('[Boundary] o volume de fábrica NÃO depende de estar ligada', () => {
    // Uma categoria desligada com volume 0 seria um segundo desligamento escondido: quem a ligasse no menu
    // continuaria sem ouvir nada, e procuraria o defeito no lugar errado.
    for (const k of DESLIGADAS) expect(defaultAudioCat(k).vol, k).toBe(0.8);
  });

  it('[Zero] categoria desconhecida nasce ligada — o desligamento é uma lista, não um acaso', () => {
    expect(defaultAudioCat('categoria-que-ainda-nao-existe').on).toBe(true);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · devolvendo `{ on: k !== 'tts' }` (o guia religado) → "[Right] EXATAMENTE `tts` e `guide`" reprova.
//   · pondo `'earcons'` na lista de desligadas → o mesmo caso reprova pelo outro lado.
//   · dando `vol: 0` às desligadas → "[Boundary] o volume de fábrica" reprova.
