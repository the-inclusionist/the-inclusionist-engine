// SPDX-License-Identifier: AGPL-3.0-or-later
// game/earcons — a TABELA de earcons DESTE jogo (item 19).
//
// ========================= POR QUE ISTO SAIU DE `platform/audio` =========================
// A tabela morava na camada de plataforma, e o gate de vocabulário acusava UMA linha: a do `coin`. Olhando o
// resto, a linha acusada era a menos interessante — de dez earcons, sete são deste jogo:
//
//     coin · key · gate · power   → objetos DESTE mundo
//     correct · wrong · place     → eventos da ATIVIDADE (quiz/sílabas)
//     jump · hurt · win           → esses sim, quase qualquer jogo tem
//
// Ou seja: o casador notou a palavra "coin", e o que estava do lado errado era a tabela inteira. Tirar só a
// linha acusada teria deixado o gate verde e o problema no lugar — que é a forma mais comum de um gate
// treinar quem o lê a ignorá-lo.
//
// O que FICA em `platform/audio` é a SÍNTESE: oscilador, envelope, ruído, roteamento por categoria. Isso vale
// para qualquer jogo. O que é 880 Hz de onda triangular por 0,14 s ao pegar uma moeda é do jogo.
//
// ========================= AS LEGENDAS ERAM pt-BR CRU =========================
// `cap` guardava o texto exibido: `'🔊 Coletou'`, `'🔊 Ai! Dano'`, `'🔊 Portão abriu'`. Nove frases, dentro de
// um módulo de ENGINE — e o gate de i18n do item 14 vigia o `main.js`, não `platform/`. Num build em inglês, a
// criança surda que depende das legendas lia português.
//
// Agora `cap` guarda a CHAVE, e quem exibe resolve — mesma regra de `render/viz-modes` e `render/cenario-data`,
// e pelo mesmo motivo: uma tabela de `const` com texto resolve UMA vez, no import, e congela no idioma do boot.

/** Um earcon: frequência (f), duração (d), timbre (t) e a CHAVE da legenda (cap; vazia = sem legenda). */
export interface SfxDef { f: number; d: number; t: OscillatorType; cap: string }

export const SFX: Record<string, SfxDef> = {
  jump: { f: 520, d: 0.12, t: 'square', cap: 'sfx.jump' },
  coin: { f: 880, d: 0.14, t: 'triangle', cap: 'sfx.coin' },
  hurt: { f: 120, d: 0.25, t: 'sawtooth', cap: 'sfx.hurt' },
  win: { f: 700, d: 0.5, t: 'triangle', cap: 'sfx.win' },
  place: { f: 640, d: 0.08, t: 'sine', cap: '' },   // sem legenda: é o "tec" de encaixar, e legendar cada um vira ruído
  correct: { f: 990, d: 0.18, t: 'triangle', cap: 'sfx.correct' },
  wrong: { f: 180, d: 0.15, t: 'square', cap: 'sfx.wrong' },
  power: { f: 760, d: 0.18, t: 'triangle', cap: 'sfx.power' },
  key: { f: 990, d: 0.16, t: 'sine', cap: 'sfx.key' },
  gate: { f: 300, d: 0.30, t: 'sawtooth', cap: 'sfx.gate' },
};
