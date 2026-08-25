// SPDX-License-Identifier: GPL-3.0-or-later
// educational/activities-registry — the ACTIVITIES catalog: every playable activity's id → metadata
// (category, display name, sub-label, description, fraction denominators, "pick numbers" flag). This module
// owns only the CATALOG + id validation — it does NOT hold the current selection (that stays `activity` +
// `setActivityValue` in core/state.ts, per ADR/plano-modularizacao-mapa).
//
// ============================ POR QUE ISTO NÃO MORA EM `game/` (ADR-0032) ============================
// Isto é CURRÍCULO, não jogo. `alf1..alf5` são as hipóteses da psicogênese de Ferreiro; `mat1..mat6` e as
// frações são progressão de matemática. Nada disso descreve "The Inclusionist" — descreve o que uma criança
// precisa aprender, e vale igual em qualquer jogo que queira ensinar a mesma coisa. O ADR-0004 já separava
// `docs/educational/` como camada de currículo/pedagogia; esta pasta é a metade em CÓDIGO da mesma camada.
//
// O destino declarado é a PLATAFORMA EdSP: o catálogo é dela, e cada jogo puxa as atividades que lhe cabem.
// A EdSP não existe ainda, então o catálogo mora aqui — mas com a FORMA do destino (camada própria, DADOS,
// nada de `game/` entrando) em vez da forma do lugar onde estava. Ver ADR-0032.
//
// NÃO SE TRADUZ. Pilar 3 (ADR-0010): currículo de alfabetização se REESCREVE por idioma, não se traduz — a
// psicogênese de Ferreiro é sobre a escrita do PORTUGUÊS. Por isso `nome`/`sub`/`d` seguem em pt-BR e ficam
// FORA dos dicionários; o que atravessa é a moldura (". Jogo iniciado."), com o nome entrando por `{param}`.

/** One entry of the activities catalog. `cat` drives menu placement + MODE; `d` is the minigame footer text. */
export interface ActivityDef {
  /** Menu category: 'ludico' (free play), 'alf' (literacy), 'mat' (math, incl. fractions). */
  cat: 'ludico' | 'alf' | 'mat';
  /** Display name (menu button + spoken by TTS). */
  nome: string;
  /** Optional example sub-label shown under the name (literacy activities). */
  sub?: string;
  /** Optional footer description shown/spoken on menu focus. */
  d?: string;
  /** Fraction denominators this activity trains (presence marks it as a fractions activity). */
  dens?: number[];
  /** True when the activity needs a "pick numbers" sub-menu (Tabuada/Divisão) before starting. */
  pick?: true;
}

const ACTIVITIES_DATA: readonly (readonly [string, ActivityDef])[] = [
  ['ludico', { cat: 'ludico', nome: 'Coletar 10 moedas' }],
  ['alf1', { cat: 'alf', nome: 'Descobrindo palavras', sub: 'BABA • BOLA • BEBE', d: 'Elaborado para ajudar a superar as hipóteses pré-silábicas.' }],
  ['alf2', { cat: 'alf', nome: 'Descobrindo sílabas', sub: 'BA • BE • BI', d: 'Feito para ajudar a superar a hipótese silábica sem valor sonoro (uma letra errada por sílaba) e com valor sonoro (vogal ou consoante correta por sílaba), deixando claro que cada som é uma sílaba e cada sílaba tem sua forma correta de escrever.' }],
  ['alf3', { cat: 'alf', nome: 'Montando palavras', sub: 'BA+BA • BE+BE • BO+LA', d: 'Feito para superar a fase da hipótese silábico-alfabética, desafiando o aluno a encontrar as sílabas corretas para montar a palavra.' }],
  ['alf4', { cat: 'alf', nome: 'Escrevendo palavras', sub: 'B-A-B-A • B-O-L-A • B-E-B-E', d: 'Atividade com o objetivo de treinar ortografia.' }],
  ['alf5', { cat: 'alf', nome: 'Escrevendo em Braille', d: 'Escreva letra por letra; o jogo dita os pontos da cela Braille (12 letras).' }],
  ['mat1', { cat: 'mat', nome: 'Quantidade', d: 'Conte as bolinhas e escolha o número certo (1 a 9).' }],
  ['mat2', { cat: 'mat', nome: 'Soma fácil', d: 'Somas com parcelas de 0 a 5.' }],
  ['mat3', { cat: 'mat', nome: 'Soma e Subtração 1', d: 'Contas que dá para fazer nos dedos (até 10).' }],
  ['mat4', { cat: 'mat', nome: 'Soma e Subtração 2', d: 'Guarde um número na cabeça e opere o outro nos dedos (até 20).' }],
  ['mat5', { cat: 'mat', nome: 'Tabuada', pick: true, d: 'Escolha os números e treine a multiplicação.' }],
  ['mat6', { cat: 'mat', nome: 'Divisão', pick: true, d: 'Escolha os números e treine a divisão.' }],
  ['fr2', { cat: 'mat', nome: 'Soma e subtração com meios', dens: [2], d: 'Some e subtraia meios.' }],
  ['fr3', { cat: 'mat', nome: 'Soma e subtração com terços', dens: [3], d: 'Some e subtraia terços.' }],
  ['fr42', { cat: 'mat', nome: 'Soma e subtração com quartos e meios', dens: [4, 2], d: 'Some e subtraia quartos e meios.' }],
  ['fr5', { cat: 'mat', nome: 'Soma e subtração com quintos', dens: [5], d: 'Some e subtraia quintos.' }],
  ['fr632', { cat: 'mat', nome: 'Soma e subtração com sextos, terços e meios', dens: [6, 3, 2], d: 'Some e subtraia sextos, terços e meios.' }],
  ['fr2a6', { cat: 'mat', nome: 'Soma e subtração com frações de meio a sextos', dens: [2, 3, 4, 5, 6], d: 'Some e subtraia frações de meios a sextos.' }],
];

/** Lookup by id — insertion order preserved (buildTitleMenus iterates it in this fixed order). */
const ACTIVITIES: ReadonlyMap<string, ActivityDef> = new Map(ACTIVITIES_DATA);

/** Fallback activity id when a stored/requested id is missing or unknown. */
export const DEFAULT_ACTIVITY_ID = 'ludico';

/** True when `id` names a real catalog entry. */
export function isValidActivityId(id: string): boolean {
  return ACTIVITIES.has(id);
}

/** Same check, spelled as the game.js call sites read it (`ACTIVITIES[id]` truthiness). */
export function hasActivity(id: string): boolean {
  return isValidActivityId(id);
}

/** The activity definition for `id`, or `undefined` if unknown (mirrors `ACTIVITIES[id]`). */
export function getActivity(id: string): ActivityDef | undefined {
  return ACTIVITIES.get(id);
}

/** All activity ids, in catalog order. */
export function listActivityIds(): string[] {
  return [...ACTIVITIES.keys()];
}

/** All [id, def] entries, in catalog order (drives menu builders like buildTitleMenus). */
export function listActivities(): (readonly [string, ActivityDef])[] {
  return [...ACTIVITIES.entries()];
}
