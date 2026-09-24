// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/audio-earcons — earcons (ícones sonoros) do jogo + a ponte com as LEGENDAS visuais (a11y surdez).
// Tier 2 do áudio, rodada 2. Depende das primitivas de platform/audio (SFX/ensureAC/catNode/audioOut/noiseHit) e,
// por injeção, do estado de legenda que VIVE no game.js (captionsOn é alternado pela UI; showCaption toca o #caption
// e é reusado por win()). Injeção por closure (padrão Tier 1).
//   sfx(name)      — toca o earcon da tabela SFX (oscilador) E, se as legendas estão ON e o earcon tem `.cap`, mostra a
//                    legenda ANTES de checar o som → um jogador surdo "vê" o som mesmo com o áudio desligado.
//   doorSound(mat) — porta: rangido (madeira, sawtooth) ou clangor (ferro, square) + baque de ruído (noiseHit).
// Extraído do game.js. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Tier 2, áudio rodada 2).

/**
 * A definição de UM earcon. A tabela é do JOGO (item 19); esta é a forma que a engine sabe tocar.
 *
 * ⚠️ EXPORTADA DESDE 2026-09-07 (#124), e a falta era um defeito de interface: o `game-platformer` declarava
 * a sua própria cópia deste tipo, palavra por palavra, porque não tinha como o nomear. Uma forma que cada
 * consumidor redescobre por cópia é uma forma que diverge — foi assim que cinco cópias de `Gfx` divergiram
 * nesta árvore, e está escrito noutro módulo.
 */
export interface SfxDef {
  /** O timbre. */
  t: OscillatorType;
  /** A frequência inicial, em hertz. */
  f: number;
  /** A duração, em segundos. */
  d: number;
  /** A CHAVE de i18n da legenda (a11y surdez). Quem exibe resolve. */
  cap?: string;
  /**
   * A frequência FINAL, em hertz. Ausente = nota parada, que é o que sempre houve.
   *
   * ⚠️ ELE EXISTE PORQUE UM EARCON PRECISA DE PODER IR PARA ALGUM LADO (#124). Medido ao construir o
   * `game-soccer`: marcar e sofrer golo têm de ser distinguíveis **só de ouvido** — uma criança cega ouve a
   * sala reagir e precisa de saber para que lado antes de a narração chegar. O desenho óbvio é uma figura
   * que SOBE para o golo dela e DESCE para o do outro, e a tabela não o sabia dizer. O que sobrava era
   * agudo-e-longo contra grave-e-curto: distinguível, e menos informação do que o momento carrega.
   *
   * ⚠️ E A CAPACIDADE JÁ ESTAVA NESTE FICHEIRO, sem ser alcançável da tabela: o `doorSound` faz exatamente
   * isto, com `frequency.exponentialRampToValueAtTime`. O conserto não é síntese nova — é abrir a porta.
   *
   * A rampa é EXPONENCIAL e não linear porque a altura é percebida em razão e não em diferença: uma rampa
   * linear de 200 a 800 sobe depressa no início e devagar no fim, e ouve-se torta.
   */
  f2?: number;
}
import { t } from '../core/i18n.js'; // item 19: `cap` guarda CHAVE, e quem exibe resolve

export interface AudioEarconsCtx {
  SFX: Record<string, SfxDef | undefined>;      // tabela de earcons (de platform/audio)
  ensureAC: () => AudioContext | null;
  catNode: (cat: string) => AudioNode | null;   // barramento por categoria (earcons/interact)
  audioOut: () => AudioNode | null;             // nó mestre (fallback)
  noiseHit: (mat: string) => void;              // synth de ruído por material (baque da porta)
  getSoundOn: () => boolean;                     // bindings vivos (o mixer os reatribui)
  getVolume: () => number;
  getCaptionsOn: () => boolean;                  // legenda ligada? (a UI alterna no game.js)
  showCaption: (txt: string) => void;            // desenha a legenda no #caption (DOM, vive no game.js)
}

export interface AudioEarcons {
  sfx: (name: string) => void;
  doorSound: (mat: string) => void;
}

export function createAudioEarcons(ctx: AudioEarconsCtx): AudioEarcons {
  /** Whether a sound may play at all: the game's sound on, and a volume above zero. */
  const audible = (): boolean => ctx.getSoundOn() && ctx.getVolume() > 0;
  /** A category's bus; without one, the master; without that, the device itself. */
  const busFor = (cat: string, ac: AudioContext): AudioNode => ctx.catNode(cat) || ctx.audioOut() || ac.destination;

  function sfx(name: string): void {
    const c = ctx.SFX[name]; if (!c) return;
    // LEGENDA primeiro (visual + aria-live via role=status) — e RESOLVIDA no ponto de uso: `cap` guarda a
    // CHAVE desde o item 19, porque a tabela vive no jogo e uma tabela de `const` com texto congelaria no
    // idioma do boot. Quem exibe resolve; é a mesma regra de `render/viz-modes`.
    if (ctx.getCaptionsOn() && c.cap) ctx.showCaption(t(c.cap));
    if (!audible()) return;    // ...só então o som — surdez: a legenda já saiu
    try { play(c); } catch (e) { /* Web Audio indisponível */ }
  }

  /** One earcon: its timbre, its figure when the table asks for one, a peak that follows the master volume, and its length. */
  function play(c: SfxDef): void {
    const ac = ctx.ensureAC(); if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = c.t; o.frequency.value = c.f; g.gain.value = 0.0001;
    o.connect(g).connect(busFor('earcons', ac));
    const now = ac.currentTime, vol = ctx.getVolume();
    glide(o, c, now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.02, 0.25 * vol), now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + c.d);
    o.start(now); o.stop(now + c.d + 0.02);
  }

  /**
   * A FIGURA, quando a tabela pede uma (#124). `setValueAtTime` antes da rampa como no `doorSound`: sem ele o ponto de
   * partida da curva fica por conta da implementação, e o glissando começa onde calhar.
   *
   * ⚠️ AS DUAS GUARDAS SÃO NECESSÁRIAS E NÃO ZELO. `exponentialRampToValueAtTime` LANÇA com alvo zero ou negativo — uma
   * tabela com `f2: 0` mataria o earcon inteiro pelo `catch`, em silêncio. E `f2 === f` não é rampa nenhuma: pedi-la ao
   * navegador seria trabalho para produzir a nota parada que já havia.
   */
  function glide(o: OscillatorNode, c: SfxDef, now: number): void {
    if (typeof c.f2 !== 'number' || c.f2 <= 0 || c.f2 === c.f) return;
    o.frequency.setValueAtTime(c.f, now);
    o.frequency.exponentialRampToValueAtTime(c.f2, now + c.d);
  }

  function doorSound(mat: string): void {
    if (!audible()) return;
    const ac = ctx.ensureAC(); if (!ac) return;
    try { // porta: rangido (madeira) ou clangor (ferro) + baque
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime, vol = ctx.getVolume();
      o.type = mat === 'ferro' ? 'square' : 'sawtooth';
      o.frequency.setValueAtTime(mat === 'ferro' ? 520 : 200, t);
      o.frequency.exponentialRampToValueAtTime(mat === 'ferro' ? 300 : 110, t + 0.3);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14 * vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(busFor('interact', ac));
      o.start(t); o.stop(t + 0.4); ctx.noiseHit(mat === 'ferro' ? 'ferro' : 'madeira');
    } catch (e) { /* Web Audio indisponível */ }
  }

  return { sfx, doorSound };
}
