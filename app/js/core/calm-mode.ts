// SPDX-License-Identifier: AGPL-3.0-or-later
// core/calm-mode — O CONFORTO SENSORIAL EM TRÊS NÍVEIS, e o que cada um desliga (ADR-0028; issue #203).
//
// 🔴 POR QUE ISTO SAIU DO `ui/pause-icons`: aquele módulo chegou a 695 linhas de código e 127 nós de decisão (ADR-0221), e este
// grupo não é sobre ÍCONES. É sobre o que uma criança que não suporta ruído precisa que a engine cale — o ícone é só uma das
// superfícies por onde ela o pede; a linha do painel é outra. Um módulo que responde «o que o nível 2 faz ao áudio» não devia
// obrigar a ler um ficheiro sobre a barra de acessibilidade para ser encontrado.
//
// ⚠️ MÓDULO-FOLHA: zero imports, zero DOM, zero armazenamento. Tudo aqui é uma pergunta com resposta — e é por isso que se
// consegue testar o clamp destrutivo do nível 1 sem montar nada.
//
// 📌 O QUE ELE NUNCA TOCA, e é a decisão que o define: TTS, sonar, guarda de beirada e guia. O nível TEA é sobre RUÍDO, não
// sobre perder a navegação — uma criança em modo silencioso continua a precisar de ouvir onde está.

/** O ciclo TEA: 0 = normal · 1 = calmo (reduz) · 2 = silencioso (desliga). */
export const CALM_NAMES: readonly string[] = ['calm.off', 'calm.quiet', 'calm.silent'];

/** As categorias de áudio que o modo calmo governa. As outras ficam intactas de propósito (ver o cabeçalho). */
export const CALM_AUDIO_CATS: readonly string[] = ['ambient', 'music', 'earcons', 'interact'];

/** Um passo do ciclo. */
export const nextCalmMode = (cur: number): number => (cur + 1) % CALM_NAMES.length;

/**
 * O nível guardado, saneado, com o padrão para quem chama.
 *
 * ⚠️ Dado do navegador é dado DE FORA: um nível inventado escolheria `CALM_NAMES[3]`, que é `undefined`, e o anúncio ao leitor
 * de tela sairia vazio — a criança que depende dele ouviria silêncio e não saberia em que nível está.
 */
export function sanitiseTeaLevel(bruto: number, padrao: number): number {
  return Number.isInteger(bruto) && bruto >= 0 && bruto < CALM_NAMES.length ? bruto : padrao;
}

/**
 * O que o nível faz a UMA categoria de áudio.
 *
 * 📌 O clamp do nível 1 é DESTRUTIVO e está aqui à vista por isso: ele escreve 0,3 por cima do volume que a criança escolheu, e
 * voltar ao nível 0 devolve o valor guardado, não o que ela tinha antes. Extraído para que isso se possa medir num caso.
 */
export function calmAudioPlan(calmMode: number, vol: number): { on: boolean; vol: number } {
  if (calmMode === 0) return { on: true, vol };
  if (calmMode === 1) return { on: true, vol: Math.min(vol, 0.3) };
  return { on: false, vol };
}

/** O que o nível faz às duas bandeiras de movimento reduzido. */
export function calmMotionPlan(calmMode: number): { sceneReduced: boolean; charFrozen: boolean } {
  return { sceneReduced: calmMode >= 1, charFrozen: calmMode === 2 };
}
