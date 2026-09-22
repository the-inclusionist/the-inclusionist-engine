// SPDX-License-Identifier: AGPL-3.0-or-later
// input/keyboard.ts — esquemas de teclado (config) + persistência. Módulo-folha (só depende de storage).
// ⚠️ AS AÇÕES SÃO POSIÇÕES, NÃO VERBOS, desde 2026-09-06: `up`, `down`, `left`, `right` e `action1`..`action4`.
// A linha anterior listava «run(corre/interage), jump, swap(troca poder), especial» — vocabulário de PLATAFORMA
// dentro da engine, que é exatamente o que o ADR-0074 tirou daqui. Qual verbo mora em qual posição é do JOGO,
// e o ADR-0086 §2 diz qual é para a plataforma. Esquemas por contagem de jogadores (solo/p2/p3/p4).
// A INSTÂNCIA atual (KB) e o remap ficam no composition root — aqui só config/load/save/reset.
import * as store from '../platform/storage.js';
import type { KeyScheme } from '../core/entity.js';
// ⚠️ A DECLARAÇÃO DOS ESQUEMAS MORA LÁ (ADR-0096), e este ficheiro passou a derivá-los em vez de os repetir
// — é a união que a issue #118 pede. `default-bindings` é folha (só importa `core/actions`), então não há
// ciclo: quem depende é o ficheiro de persistência, e não o contrário.
import { KEYBOARD_SOLO, KEYBOARD_DUO } from './default-bindings.js';

const CKEY = 'inclusionist.kbcontrols.v3';

// `KeyScheme` mora em `core/entity` desde 2026-08-26: a entidade declara `ctrl: KeyScheme | null`, então
// ela é a dona. A mesma linha estava escrita em SEIS módulos. Reexportada para quem já a importava daqui.
export type { KeyScheme } from '../core/entity.js';
/**
 * O CONJUNTO DE ESQUEMAS de teclado — solo mais os de 2, 3 e 4 jogadores.
 *
 * Exportado desde 2026-08-26, e o motivo é que ele já era copiado: `input/keyboard-runtime` e
 * `ui/settings-controls` declaravam cada um o seu `KeyboardConfig`, e AMBOS diziam no comentário que
 * era "a forma do KBDefaults de input/keyboard". Sabiam que eram cópia e copiavam mesmo assim.
 *
 * A de `settings-controls` era `Record<string, unknown>` — pensada como opaca, para o módulo não
 * depender da forma. Mas em posição de PARÂMETRO isso se inverte: para aceitar `(next: KBDefaults)`,
 * o tipo declarado tem de ser SUBTIPO, não supertipo. A opacidade se preserva por disciplina — não
 * indexar o valor — e não por escrever um tipo mais largo (ADR-0039).
 */
export type KBDefaults = { solo: KeyScheme; p2: KeyScheme[]; p3: KeyScheme[]; p4: KeyScheme[] };

/**
 * AS SEIS POSIÇÕES QUE UM TECLADO PARTIDO NÃO ALCANÇA, declaradas como ausência (issue #118, decisão do Dev).
 *
 * ⚠️ `null` AQUI É UMA AFIRMAÇÃO, e é o que torna o `KeyScheme` fechado útil em vez de burocrático: quando o
 * teclado é repartido por três ou quatro crianças, não há lugar físico para ombros, gatilhos, start e select
 * de cada uma — o bloco de cada jogador tem oito teclas e acabou. Inventar teclas para preencher seria dar a
 * cada criança um alcance que ela não tem, e o `ui/reach-notice` (#112) diria a coisa errada.
 *
 * O que `null` compra: o aviso de alcance pode dizer, ANTES de a criança começar, quais das ações do jogo o
 * controlo dela não alcança — e o jogo pode decidir não usar essas posições no modo de quatro.
 */
const SEM_ALCANCE_NO_TECLADO_PARTIDO = Object.freeze({
  leftShoulder: null, leftTrigger: null, rightShoulder: null, rightTrigger: null, start: null, select: null,
});

// 4 esquemas base p/ 3–4 jogadores (modos 3 e 4 têm esquemas SEPARADOS, p3 e p4, editáveis por jogador)
export const KB_SCHEMES4: KeyScheme[] = [
  { left:['KeyA'],right:['KeyD'],up:['KeyW'],down:['KeyS'], action1:['KeyZ'],action2:['KeyX'],action4:['KeyC'],action3:['KeyV'], ...SEM_ALCANCE_NO_TECLADO_PARTIDO },
  { left:['KeyJ'],right:['KeyL'],up:['KeyI'],down:['KeyK'], action1:['KeyM'],action2:['Comma'],action4:['Period'],action3:['Semicolon','Slash'], ...SEM_ALCANCE_NO_TECLADO_PARTIDO },
  { left:['ArrowLeft'],right:['ArrowRight'],up:['ArrowUp'],down:['ArrowDown'], action1:['Home'],action2:['End'],action4:['PageUp'],action3:['PageDown'], ...SEM_ALCANCE_NO_TECLADO_PARTIDO },
  { left:['Numpad4'],right:['Numpad6'],up:['Numpad8'],down:['Numpad5'], action1:['Numpad2'],action2:['Numpad0'],action4:['Numpad3'],action3:['NumpadDecimal'], ...SEM_ALCANCE_NO_TECLADO_PARTIDO },
];

/**
 * Cópia PROFUNDA e MUTÁVEL de uma tabela declarada. O remapeamento escreve dentro do esquema vivo, então ele
 * não pode partilhar objeto com a tabela de `input/default-bindings`, que é congelada e é a declaração.
 */
const vivo = (t: unknown): KeyScheme => JSON.parse(JSON.stringify(t)) as KeyScheme;

/**
 * ⚠️ AS DUAS TABELAS DE TECLADO PASSARAM A SER UMA (issue #118). O solo e a dupla já não são escritos aqui:
 * são CÓPIAS VIVAS do que `input/default-bindings` declara, que é onde o ADR-0096 pôs a decisão.
 *
 * Antes eram duas listas paralelas com oito posições cada, e as oito «coincidiam» — menos uma. A `Space` do
 * jogador 1 em dupla estava numa e não na outra, e o custo era concreto: a webcam de então (WebGazer, que saiu no ADR-0214)
 * sintetizava `Space` para «olhar para cima = pular», então entrar um segundo jogador tirava o PULO de quem jogava com os
 * olhos e deixava o andar. Nada errava em voz alta. Derivar em vez de repetir torna essa divergência impossível de
 * voltar a existir, em vez de a apanhar depois de acontecer.
 */
export const KB_DEFAULTS: KBDefaults = {
  solo: vivo(KEYBOARD_SOLO),
  p2: KEYBOARD_DUO.map(vivo),
  p3: KB_SCHEMES4.slice(0, 3).map(vivo), // modo 3 jogadores (independente do 4)
  p4: KB_SCHEMES4.map(vivo),             // modo 4 jogadores
};

// dado salvo (parcial): sobrepõe os defaults; p34 é o formato ANTIGO (migra p/ p3+p4).
// A FORMA vem de `vocabulary-migration`, que é quem a traduz — declarar aqui outra vez seria a
// cópia que o `core/entity` passou o mês a eliminar.
import { migrateSaved, type SavedKB } from './vocabulary-migration.js';

// ⚠️ A MIGRAÇÃO DE VOCABULÁRIO MORA NOUTRO FICHEIRO, e a separação é deliberada:
// `input/vocabulary-migration.ts` é o ÚNICO sítio da engine autorizado a dizer `jump`, porque traduzir o
// nome antigo é a função dele. Deixá-la aqui punha o acoplamento num módulo que não é histórico, e o gate
// `action-vocabulary-boundary` reprovou — corretamente. Ver o cabeçalho de lá para saber quando se apaga.

/**
 * O PADRÃO QUE O JOGO QUER, por número de jogadores e por assento (ADR-0115). Parcial: o que ele não disser
 * fica como a fábrica da engine o deixou.
 */
export type KeyboardMapping = (jogadores: number, assento: number) => Partial<KeyScheme> | null;

let mapeamentoDoJogo: KeyboardMapping | null = null;

/**
 * REGISTA O PADRÃO DO JOGO. Chamado uma vez pelo arranque (`boot/create-game`), a partir da declaração.
 *
 * 🔴 REGISTO E NÃO PARÂMETRO, e a razão é um defeito medido em vez de uma preferência. Há DOIS sítios que
 * materializam padrões — `loadKB` e `resetKB` — e o segundo é chamado pelo painel de controles, que não tem a
 * declaração do jogo à mão. Um parâmetro que o painel não passasse faria «restaurar padrões» devolver o mapa
 * da ENGINE por cima do mapa do JOGO: a criança carrega no botão esperando voltar ao que o jogo lhe deu, e
 * volta para outra coisa — num jogo cujo autor escolheu o layout por uma razão de acessibilidade, ela perde
 * essa razão e nada o diz.
 *
 * 📌 É a mesma forma que o `kb` deste ficheiro já tem, e pela mesma justificação: o dono é evidente, e as
 * funções que o gerem vivem todas aqui.
 */
export function registerKeyboardMapping(f: KeyboardMapping | null): void { mapeamentoDoJogo = f; }

/**
 * A FÁBRICA COM O PADRÃO DO JOGO POR CIMA — a **única** resolução, usada pelo `loadKB` E pelo `resetKB`.
 *
 * ⚠️ Uma função só, e é o ponto inteiro: enquanto eram duas cópias do `JSON.parse(JSON.stringify(...))`, a do
 * `resetKB` não conhecia o jogo e a diferença só aparecia quando uma criança carregava em «restaurar».
 */
export function factoryWithGame(): KBDefaults {
  const d: KBDefaults = JSON.parse(JSON.stringify(KB_DEFAULTS));
  if (!mapeamentoDoJogo) return d;
  const aplicar = (alvo: KeyScheme, jogadores: number, assento: number): void => {
    const parcial = mapeamentoDoJogo!(jogadores, assento);
    if (parcial) Object.assign(alvo, parcial);
  };
  aplicar(d.solo, 1, 0);
  d.p2.forEach((esq, i) => aplicar(esq, 2, i));
  d.p3.forEach((esq, i) => aplicar(esq, 3, i));
  d.p4.forEach((esq, i) => aplicar(esq, 4, i));
  return d;
}

// carrega os esquemas salvos SOBRE os defaults (com migração do dado antigo p34 → p3+p4)
export function loadKB(): KBDefaults {
  // ⚠️ A PRECEDÊNCIA É ESTA E ESTÁ ESCRITA UMA VEZ: fábrica da engine → padrão do JOGO → remapeamento da
  // CRIANÇA. O que a criança gravou vem sempre por último, porque é a única das três que ela escolheu.
  const d: KBDefaults = factoryWithGame();
  // ⚠️ O DADO SALVO ATRAVESSA O TRADUTOR ANTES DE TOCAR NOS PADRÕES. Sem esta linha, um esquema gravado com
  // as chaves antigas (`run`, `jump`, `swap`, `especial`) seria fundido sobre defaults que já usam
  // `action1`..`action4`: o objeto ficaria com AS DUAS famílias de chaves, os transportes leriam só as novas,
  // e o remapeamento da criança viraria dado morto no navegador dela. Nada erraria em voz alta — as teclas
  // dela simplesmente parariam de responder. Ver `input/vocabulary-migration.ts`.
  const s = migrateSaved(store.getJSON<SavedKB>(CKEY, null));
  if (s) {
    if (s.solo) Object.assign(d.solo, s.solo);
    if (Array.isArray(s.p34)) { s.p34.forEach((m, i) => { if (m) { if (d.p4[i]) Object.assign(d.p4[i], m); if (i < 3 && d.p3[i]) Object.assign(d.p3[i], m); } }); }
    (['p2', 'p3', 'p4'] as const).forEach((g) => { const arr = s[g]; if (Array.isArray(arr)) arr.forEach((m, i) => { if (d[g][i] && m) Object.assign(d[g][i], m); }); });
  }
  return d;
}
export function saveKB(kb: KBDefaults): void { store.setJSON(CKEY, kb); }

/**
 * O MAPA DE TECLAS VIVO. Migrado do composition root (#50): era um `let KB` do main.js com um envoltório
 * `setKB: (k) => { KB = k; }` fabricado à mão para o painel de controles reatribuí-lo.
 *
 * Mora AQUI, e não em core/state como os outros migrados, porque o dono é evidente: `loadKB`, `saveKB` e
 * `resetKB` já viviam neste arquivo. Separar o valor das três funções que o gerenciam seria mover o problema
 * de lugar em vez de resolvê-lo.
 *
 * NASCE COM OS PADRÕES E NÃO LÊ DISCO NO IMPORT. `initKB()` é quem lê, chamado uma vez pelo boot. A regra vale
 * para todo módulo do projeto, e aqui ela tem um custo concreto se for quebrada: um teste que importe qualquer
 * coisa deste arquivo passaria a depender do localStorage do ambiente, e um mapa de teclas herdado de outro
 * caso é uma falha que aparece longe da causa.
 */
export let kb: KBDefaults = JSON.parse(JSON.stringify(KB_DEFAULTS));

/** Lê o mapa persistido para dentro de `kb`. O boot chama uma vez; devolve o valor para quem quiser encadear. */
export function initKB(): KBDefaults { kb = loadKB(); return kb; }

/** Troca o mapa inteiro. Só o "restaurar padrões" do painel de controles precisa disto — remapear uma tecla
 *  MUTA o objeto, e reatribuir por engano faria as referências vivas apontarem para o mapa antigo. */
export function setKB(next: KBDefaults): void { kb = next; }
/**
 * «RESTAURAR PADRÕES» — e o padrão para onde ela volta é o DO JOGO, não o da engine (ADR-0115).
 *
 * 🔴 Esta linha era `JSON.parse(JSON.stringify(KB_DEFAULTS))`, e com o campo do jogo a existir isso passaria
 * a apagar em silêncio o mapeamento que o jogo escolheu. A criança espera voltar ao que o jogo lhe deu.
 */
export function resetKB(): KBDefaults { store.remove(CKEY); return factoryWithGame(); }
