// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/motion-scene — O MOVIMENTO REDUZIDO DE CENA VOLTA PARA A ENGINE (ADR-0106 §4, etapa 1).
//
// ========================= O QUE ESTAVA ERRADO, MEDIDO E NÃO SUPOSTO =========================
// O `PauseIconsCtx` e o `SettingsMotionCtx` pediam ao JOGO quatro coisas — `rm`, `rmKeys`, `rmChar`,
// `saveRM` — e o ADR-0106 chamou-lhes «do jogo POR ACIDENTE». A medição de 2026-09-08 no `game-platformer`
// mostra que a palavra é exacta, porque nenhuma das quatro contém uma escolha do jogo:
//
//   · `RM_KEYS` era `['parallax','decor','items','particles']` escrito à mão — que é a união `MotionSceneKey`
//     INTEIRA, declarada na engine. Não é «quais destes este jogo tem»: são os quatro, sempre;
//   · `RM_CHAR` era as três propriedades de `MotionCharProp` com as chaves i18n `rm.walk`/`rm.breath`/
//     `rm.flavor` — e o `RM_LABEL` da engine já traduz essas mesmas chaves;
//   · `rm` era lido de `store.KEYS.reducedMotion` (chave da engine) com `defaultReducedMotion()` (padrão da
//     engine);
//   · `saveRM` era `store.setJSON` para a mesma chave da engine.
//
// ⚠️ ERA UMA CÓPIA, NÃO UMA DECISÃO. E o custo não é elegância: **cinco jogos não têm nada disto**, porque
// cada cartucho tinha de se lembrar de escrever as quatro linhas. Uma criança que precisa de parar o
// movimento da cena abre esses cinco e não tem por onde.
//
// ⚠️ O QUE CONTINUA A SER DO JOGO, e por natureza: o EFEITO. Quem lê `rm.decor` para congelar as nuvens é o
// jogo — a engine possui o interruptor, não o que ele apaga. É a mesma divisão do ADR-0106: o valor é da
// engine, o efeito colateral é do cartucho.
//
// ⚠️ E O OBJECTO É PARTILHADO POR REFERÊNCIA, de propósito. No cartucho ele entra em oito módulos
// (`weather`, `life`, `fx`, …) que leem `rm.decor`/`rm.particles` a cada quadro. Devolver uma cópia faria
// cada leitor ver um valor congelado no arranque, e o interruptor deixaria de fazer nada — em silêncio.
// ⚠️ O VOCABULÁRIO DESCEU PARA CÁ, e foi um gate que o mandou. Escrito ao contrário — os tipos no
// `settings-motion` e este módulo a importá-los —, o `tests/lotes-passo5` reprovou por CICLO: o painel importa
// os valores daqui e este importava os tipos de lá. O analisador conta o `import type` como aresta, e tem
// razão para o que mede (ordem de extração). A saída certa não era calar o gate: o vocabulário pertence a quem
// possui os VALORES, e o painel é consumidor dele. O `settings-motion` mantém os nomes publicados por alias,
// então nenhuma linha de importação de nenhum consumidor muda.
import * as store from '../platform/storage.js';
import { defaultReducedMotion } from '../core/state.js';
import type { PlayerView } from '../core/entity.js';

/** As quatro animações de CENA, como vocabulário fechado. */
export type MotionSceneKey = 'parallax' | 'decor' | 'items' | 'particles';
/** As três do PERSONAGEM, que são campos do jogador. */
export type MotionCharProp = 'rmWalk' | 'rmBreath' | 'rmFlavor';
/** Uma animação do personagem e a chave i18n do seu rótulo. */
export interface MotionCharDef {
  readonly prop: MotionCharProp;
  readonly lbl: string;
}
/** ⚠️ `PlayerView` e não `Record`: um `Record` aceita qualquer objecto com essas chaves, jogador ou não. */
export type MotionPlayer = PlayerView<'rmWalk' | 'rmBreath' | 'rmFlavor'>;
/** Os quatro interruptores de cena. Objecto VIVO — ver a nota sobre partilha por referência no topo. */
export type MotionSceneFlags = Record<MotionSceneKey, boolean>;

/** As quatro animações de CENA. São a união inteira, e o compilador prova-o logo abaixo. */
export const SCENE_KEYS = ['parallax', 'decor', 'items', 'particles'] as const;

/**
 * ⚠️ A PROVA DE QUE A LISTA COBRE A UNIÃO, feita pelo COMPILADOR e não por um teste.
 *
 * Uma lista escrita à mão ao lado de uma união é a forma de defeito que este ficheiro existe para desfazer —
 * seria trocar a cópia do cartucho por uma cópia da engine. Se alguém acrescentar uma quinta chave a
 * `MotionSceneKey` e esquecer a lista, `_Faltou` deixa de ser `never` e esta linha não compila.
 *
 * `[X] extends [never]` e não `X extends never`: o condicional distribui sobre `never` e daria `never` em vez
 * de `true`, o que faria a guarda passar sempre — uma guarda que não pode falhar não é uma guarda.
 */
type _Missing = Exclude<MotionSceneKey, (typeof SCENE_KEYS)[number]>;
const _COVERS_THE_UNION: [_Missing] extends [never] ? true : false = true;
void _COVERS_THE_UNION;

/** As três animações do PERSONAGEM, com as chaves que o `RM_LABEL` desta mesma camada já traduz. */
export const CHARACTER_ANIMATIONS = Object.freeze([
  { prop: 'rmWalk', lbl: 'rm.walk' },
  { prop: 'rmBreath', lbl: 'rm.breath' },
  { prop: 'rmFlavor', lbl: 'rm.flavor' },
] as const) satisfies readonly MotionCharDef[];

/** A mesma prova, para as três do personagem: falta uma na lista e isto deixa de compilar. */
type _MissingChar = Exclude<MotionCharProp, (typeof CHARACTER_ANIMATIONS)[number]['prop']>;
const _COVERS_THE_CHARACTER: [_MissingChar] extends [never] ? true : false = true;
void _COVERS_THE_CHARACTER;

/** Os quatro interruptores no padrão do sistema — `prefers-reduced-motion`, por `defaultReducedMotion()`. */
export function sceneDefault(): MotionSceneFlags {
  const o = {} as MotionSceneFlags;
  const byDefault = defaultReducedMotion();
  for (const k of SCENE_KEYS) o[k] = byDefault;
  return o;
}

/**
 * O estado guardado, ou o padrão do sistema quando não há nada guardado.
 *
 * ⚠️ CADA CHAVE É LIDA UMA A UMA, e não `{...guardado}`. O que está no armazenamento veio do navegador de uma
 * criança e pode estar truncado ou de uma versão anterior: espalhar o objecto traria chaves a mais e deixaria
 * chaves a menos por preencher, e uma chave em falta lê-se como `undefined` — que é «não reduzido» para quem
 * pediu redução. O laço garante exactamente as quatro.
 */
export function readStoredScene(): MotionSceneFlags {
  const stored = store.getJSON<Record<string, unknown> | null>(store.KEYS.reducedMotion, null);
  if (!stored || typeof stored !== 'object') return sceneDefault();
  const o = {} as MotionSceneFlags;
  for (const k of SCENE_KEYS) o[k] = !!stored[k];
  return o;
}

/** Guarda os quatro interruptores. Chamada depois de cada mudança, como o `saveRM` do cartucho fazia. */
export function storeScene(rm: MotionSceneFlags): void {
  store.setJSON(store.KEYS.reducedMotion, rm);
}
