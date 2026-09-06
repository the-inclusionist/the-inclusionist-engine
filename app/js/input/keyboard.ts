// SPDX-License-Identifier: AGPL-3.0-or-later
// input/keyboard.ts — esquemas de teclado (config) + persistência. Módulo-folha (só depende de storage).
// ⚠️ AS AÇÕES SÃO POSIÇÕES, NÃO VERBOS, desde 2026-09-06: `up`, `down`, `left`, `right` e `action1`..`action4`.
// A linha anterior listava «run(corre/interage), jump, swap(troca poder), especial» — vocabulário de PLATAFORMA
// dentro da engine, que é exatamente o que o ADR-0074 tirou daqui. Qual verbo mora em qual posição é do JOGO,
// e o ADR-0086 §2 diz qual é para a plataforma. Esquemas por contagem de jogadores (solo/p2/p3/p4).
// A INSTÂNCIA atual (KB) e o remap ficam no composition root — aqui só config/load/save/reset.
import * as store from '../platform/storage.js';
import type { KeyScheme } from '../core/entity.js';

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

// 4 esquemas base p/ 3–4 jogadores (modos 3 e 4 têm esquemas SEPARADOS, p3 e p4, editáveis por jogador)
export const KB_SCHEMES4: KeyScheme[] = [
  { left:['KeyA'],right:['KeyD'],up:['KeyW'],down:['KeyS'], action1:['KeyZ'],action2:['KeyX'],action4:['KeyC'],action3:['KeyV'] },
  { left:['KeyJ'],right:['KeyL'],up:['KeyI'],down:['KeyK'], action1:['KeyM'],action2:['Comma'],action4:['Period'],action3:['Semicolon','Slash'] },
  { left:['ArrowLeft'],right:['ArrowRight'],up:['ArrowUp'],down:['ArrowDown'], action1:['Home'],action2:['End'],action4:['PageUp'],action3:['PageDown'] },
  { left:['Numpad4'],right:['Numpad6'],up:['Numpad8'],down:['Numpad5'], action1:['Numpad2'],action2:['Numpad0'],action4:['Numpad3'],action3:['NumpadDecimal'] },
];
export const KB_DEFAULTS: KBDefaults = {
  // 1 jogador: WASD + setas; pulo J/Espaço; UJIK como na mão pequena do DOS. Sem Alt/AltGr/Ctrl/Shift.
  solo:{ left:['KeyA','ArrowLeft'], right:['KeyD','ArrowRight'], up:['KeyW','ArrowUp'], down:['KeyS','ArrowDown'],
         action1:['KeyU'], action2:['KeyJ','Space'], action4:['KeyI'], action3:['KeyK'] },
  p2:[ { left:['KeyA'],right:['KeyD'],up:['KeyW'],down:['KeyS'], action1:['KeyU'],action2:['KeyJ'],action4:['KeyI'],action3:['KeyK'] },
       { left:['ArrowLeft'],right:['ArrowRight'],up:['ArrowUp'],down:['ArrowDown'], action1:['Numpad8'],action2:['Numpad5'],action4:['Numpad9'],action3:['Numpad6'] } ],
  p3: JSON.parse(JSON.stringify(KB_SCHEMES4.slice(0, 3))), // modo 3 jogadores (independente do 4)
  p4: JSON.parse(JSON.stringify(KB_SCHEMES4)),             // modo 4 jogadores
};

// dado salvo (parcial): sobrepõe os defaults; p34 é o formato ANTIGO (migra p/ p3+p4).
// A FORMA vem de `vocabulary-migration`, que é quem a traduz — declarar aqui outra vez seria a
// cópia que o `core/entity` passou o mês a eliminar.
import { migrarSalvo, type SavedKB } from './vocabulary-migration.js';

// ⚠️ A MIGRAÇÃO DE VOCABULÁRIO MORA NOUTRO FICHEIRO, e a separação é deliberada:
// `input/vocabulary-migration.ts` é o ÚNICO sítio da engine autorizado a dizer `jump`, porque traduzir o
// nome antigo é a função dele. Deixá-la aqui punha o acoplamento num módulo que não é histórico, e o gate
// `action-vocabulary-boundary` reprovou — corretamente. Ver o cabeçalho de lá para saber quando se apaga.

// carrega os esquemas salvos SOBRE os defaults (com migração do dado antigo p34 → p3+p4)
export function loadKB(): KBDefaults {
  const d: KBDefaults = JSON.parse(JSON.stringify(KB_DEFAULTS));
  // ⚠️ O DADO SALVO ATRAVESSA O TRADUTOR ANTES DE TOCAR NOS PADRÕES. Sem esta linha, um esquema gravado com
  // as chaves antigas (`run`, `jump`, `swap`, `especial`) seria fundido sobre defaults que já usam
  // `action1`..`action4`: o objeto ficaria com AS DUAS famílias de chaves, os transportes leriam só as novas,
  // e o remapeamento da criança viraria dado morto no navegador dela. Nada erraria em voz alta — as teclas
  // dela simplesmente parariam de responder. Ver `input/vocabulary-migration.ts`.
  const s = migrarSalvo(store.getJSON<SavedKB>(CKEY, null));
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
export function resetKB(): KBDefaults { store.remove(CKEY); return JSON.parse(JSON.stringify(KB_DEFAULTS)); }
