// SPDX-License-Identifier: AGPL-3.0-or-later
// input/keyboard.ts — esquemas de teclado (config) + persistência. Módulo-folha (só depende de storage).
// 8 ações: up,left,down,right,run(corre/interage),jump,swap(troca poder),especial. Esquemas por contagem de
// jogadores (solo/p2/p3/p4). A INSTÂNCIA atual (KB) e o remap ficam no game.js — aqui só config/load/save/reset.
import * as store from '../platform/storage.js';

const CKEY = 'inclusionist.kbcontrols.v3';

type KeyScheme = Record<string, string[]>; // ação → lista de codes (KeyA, ArrowLeft…)
type KBDefaults = { solo: KeyScheme; p2: KeyScheme[]; p3: KeyScheme[]; p4: KeyScheme[] };

// 4 esquemas base p/ 3–4 jogadores (modos 3 e 4 têm esquemas SEPARADOS, p3 e p4, editáveis por jogador)
export const KB_SCHEMES4: KeyScheme[] = [
  { left:['KeyA'],right:['KeyD'],up:['KeyW'],down:['KeyS'], run:['KeyZ'],jump:['KeyX'],swap:['KeyC'],especial:['KeyV'] },
  { left:['KeyJ'],right:['KeyL'],up:['KeyI'],down:['KeyK'], run:['KeyM'],jump:['Comma'],swap:['Period'],especial:['Semicolon','Slash'] },
  { left:['ArrowLeft'],right:['ArrowRight'],up:['ArrowUp'],down:['ArrowDown'], run:['Home'],jump:['End'],swap:['PageUp'],especial:['PageDown'] },
  { left:['Numpad4'],right:['Numpad6'],up:['Numpad8'],down:['Numpad5'], run:['Numpad2'],jump:['Numpad0'],swap:['Numpad3'],especial:['NumpadDecimal'] },
];
export const KB_DEFAULTS: KBDefaults = {
  // 1 jogador: WASD + setas; pulo J/Espaço; UJIK como na mão pequena do DOS. Sem Alt/AltGr/Ctrl/Shift.
  solo:{ left:['KeyA','ArrowLeft'], right:['KeyD','ArrowRight'], up:['KeyW','ArrowUp'], down:['KeyS','ArrowDown'],
         run:['KeyU'], jump:['KeyJ','Space'], swap:['KeyI'], especial:['KeyK'] },
  p2:[ { left:['KeyA'],right:['KeyD'],up:['KeyW'],down:['KeyS'], run:['KeyU'],jump:['KeyJ'],swap:['KeyI'],especial:['KeyK'] },
       { left:['ArrowLeft'],right:['ArrowRight'],up:['ArrowUp'],down:['ArrowDown'], run:['Numpad8'],jump:['Numpad5'],swap:['Numpad9'],especial:['Numpad6'] } ],
  p3: JSON.parse(JSON.stringify(KB_SCHEMES4.slice(0, 3))), // modo 3 jogadores (independente do 4)
  p4: JSON.parse(JSON.stringify(KB_SCHEMES4)),             // modo 4 jogadores
};

// dado salvo (parcial): sobrepõe os defaults; p34 é o formato ANTIGO (migra p/ p3+p4).
type SavedKB = { solo?: KeyScheme; p2?: KeyScheme[]; p3?: KeyScheme[]; p4?: KeyScheme[]; p34?: (KeyScheme | null)[] };

// carrega os esquemas salvos SOBRE os defaults (com migração do dado antigo p34 → p3+p4)
export function loadKB(): KBDefaults {
  const d: KBDefaults = JSON.parse(JSON.stringify(KB_DEFAULTS));
  const s = store.getJSON<SavedKB>(CKEY, null);
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
