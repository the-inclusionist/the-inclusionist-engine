// SPDX-License-Identifier: GPL-3.0-or-later
// platform/audio-mixer.ts — categorias do mixer de áudio (dados) + carga/persistência. Módulo-folha (storage).
// O grafo de áudio (catNode/setCatGain/_catNodes/audioCtx) e o objeto audioCat VIVO ficam no game.js — aqui só
// a lista das categorias, o estado inicial (com o default TTS-off) e o save por categoria. (Fase 2, áudio)
import * as store from './storage.js';

type AudioCat = { k: string; lbl: string };
type AudioCatState = { on: boolean; vol: number };

export const AUDIO_CATS: AudioCat[] = [
  {k:'music',   lbl:'Música'}, {k:'ambient', lbl:'Sons ambiente (água, rua, trânsito, folhas, chuva)'},
  {k:'interact',lbl:'Efeitos de interação (passos, portas, escada)'}, {k:'earcons', lbl:'Earcons (pulo, moeda, dano…)'},
  {k:'other',   lbl:'Outros efeitos'}, {k:'tts', lbl:'Narração (TTS)'}, {k:'sonar', lbl:'Sonar'},
  {k:'guard',   lbl:'Guarda de beirada'}, {k:'guide', lbl:'Pista / guia auditivo'},
];

// Estado inicial por categoria. O TTS geral nasce DESLIGADO: útil p/ cegos e alguns em alfabetização, mas voz
// (robótica) irrita/sobrecarrega pessoas com TEA — quem precisa liga no menu. As demais nascem ligadas. (O TTS
// do letramento é o gameSay(), independente disto e sempre ativo.) O que estiver salvo sobrepõe o default.
/**
 * O estado de FÁBRICA de uma categoria. Existe com nome porque dois lugares precisam dele: a leitura do boot
 * (quando nada foi salvo) e o "restaurar padrões" do menu auditivo (ADR-0028). Escrever `k !== 'tts'` e `0.8`
 * nos dois seria a mesma cópia sem dono que este repositório já viu divergir — e aqui a divergência colocaria
 * a criança num terceiro estado, nem o dela nem o de fábrica.
 */
export function defaultAudioCat(k: string): AudioCatState {
  return { on: k !== 'tts', vol: 0.8 };
}

export function loadAudioCat(): Record<string, AudioCatState> {
  const cat: Record<string, AudioCatState> = {};
  AUDIO_CATS.forEach((c) => {
    const d = defaultAudioCat(c.k);
    let on = d.on, vol = d.vol;
    const o = store.getJSON<AudioCatState>('incl_audiocat_' + c.k, null);
    if (o) { on = !!o.on; vol = +o.vol; }
    cat[c.k] = { on, vol };
  });
  return cat;
}
export function saveAudioCat(k: string, obj: AudioCatState): void { store.setJSON('incl_audiocat_' + k, obj); }
