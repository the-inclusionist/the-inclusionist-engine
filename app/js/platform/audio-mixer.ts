// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/audio-mixer.ts — categorias do mixer de áudio (dados) + carga/persistência. Módulo-folha (storage).
// O grafo de áudio (catNode/setCatGain/_catNodes/audioCtx) e o objeto audioCat VIVO ficam no game.js — aqui só
// a lista das categorias, o estado inicial (com o default TTS-off) e o save por categoria. (Fase 2, áudio)
import * as store from './storage.js';

type AudioCat = { k: string; lbl: string; dica?: string };
type AudioCatState = { on: boolean; vol: number };

// 🔴 `other` SAIU em 2026-09-12 (ADR-0151, errata): «O que esta categoria controla? Nada. Então pra que?» (Dev).
// 📏 Medido: nenhum som da engine nem dos repositórios dos jogos era encaminhado por ela — era um volume sem nada
// por baixo, o botão morto do ADR-0106 §5.
// 🔴 `lbl` and `dica` are i18n KEYS since 2026-09-12 (ADR-0158). The labels were raw Portuguese with their explanation
// in parentheses — «Sons ambiente (água, rua, trânsito, folhas, chuva)» — and a page in English showed them as they
// were (measured in dist). The short word stays in the row; what the parentheses held is the hint the footer shows.
export const AUDIO_CATS: AudioCat[] = [
  {k:'music',   lbl:'audio.cat.music'},
  {k:'ambient', lbl:'audio.cat.ambient',  dica:'audio.cat.ambient.dica'},
  {k:'interact',lbl:'audio.cat.interact', dica:'audio.cat.interact.dica'},
  {k:'earcons', lbl:'audio.cat.earcons',  dica:'audio.cat.earcons.dica'},
  {k:'tts',     lbl:'audio.cat.tts'},
  {k:'sonar',   lbl:'audio.cat.sonar'},
  {k:'guard',   lbl:'audio.cat.guard'},
  {k:'guide',   lbl:'audio.cat.guide'},
];

// Estado inicial por categoria. O que estiver SALVO sobrepõe o default — e isso é deliberado: um valor salvo
// significa que alguém MEXEU naquele controle, e a escolha da criança não é minha para desfazer. Quem já
// tinha ligado o guia continua com ele ligado.
/**
 * O estado de FÁBRICA de uma categoria. Existe com nome porque dois lugares precisam dele: a leitura do boot
 * (quando nada foi salvo) e o "restaurar padrões" do menu auditivo (ADR-0028). Escrever `k !== 'tts'` e `0.8`
 * nos dois seria a mesma cópia sem dono que este repositório já viu divergir — e aqui a divergência colocaria
 * a criança num terceiro estado, nem o dela nem o de fábrica.
 */
/**
 * As categorias que nascem DESLIGADAS, e o motivo de cada uma. Lista com razão escrita, e não um `k !== 'x'`
 * pendurado numa expressão — a próxima que entrar precisa dizer por quê.
 *
 *  · `tts` — voz robótica irrita e sobrecarrega pessoas com TEA. Quem precisa liga no menu. (O TTS do
 *    letramento é o `gameSay()`, independente disto e sempre ativo.)
 *
 *  · `guide` — o BEACON do guia auditivo, DESLIGADO desde 2026-08-26 por decisão do Dev, e é uma medida
 *    PROVISÓRIA que não deve virar permanente sem alguém a rever.
 *
 *    O que ele faz hoje: um `triangle` de 0,12 s apontado para o alvo mais próximo, a cada 0,8 s, PARA
 *    SEMPRE — sem depender de movimento, de tecla ou de nada ter mudado. No modo cego `needsAudioCues` é
 *    sempre verdadeiro, então a criança que mais precisa de pistas é a que ouve o bipe a partida inteira.
 *
 *    O veredito do Dev: "um ping é a pior escolha possível, tenebroso para quem tem TEA". Não é a FREQUÊNCIA
 *    que está errada — é o bipe. Reduzi-lo a "só andando" deixaria a mesma coisa doendo menos vezes.
 *
 *    O substituto que ele descreveu é maior que uma troca de som e por isso não entra junto: uma música que
 *    fica mais intensa conforme se aproxima, e ANTES dela é preciso MAPEAR A ROTA — preencher o mapa com as
 *    direções por onde há ar ou água, para que a pista siga um caminho navegável em vez de apontar em linha
 *    reta para dentro de uma parede. Está registrado como issue; até ela existir, o silêncio é melhor que o
 *    bipe, e a criança que quiser o bipe continua podendo ligá-lo no menu auditivo.
 */
const NASCEM_DESLIGADAS = new Set(['tts', 'guide']);

export function defaultAudioCat(k: string): AudioCatState {
  return { on: !NASCEM_DESLIGADAS.has(k), vol: 0.8 };
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
