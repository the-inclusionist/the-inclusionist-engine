// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/voice-plan.ts — O PLANO DAS VOZES NEURAIS (ADR-0110), na metade PURA.
//
// ========================= O QUE ESTE MÓDULO É =========================
// O catálogo das quatro vozes que a engine GARANTE, a ordem por que se buscam, e — a parte que mais importa —
// a resposta honesta a «o que é que esta criança está a ouvir AGORA». Sem rede, sem cache, sem tempo. Quem
// busca de facto é a outra metade; quem decide O QUE buscar e o que DIZER é esta.
//
// ⚠️ POR QUE O CATÁLOGO VIVE AQUI E NÃO NO `TTS_SOURCES`. A tabela do `platform/tts` é indexada por idioma e
// tem UMA voz por idioma; este catálogo tem QUATRO vozes para TRÊS idiomas, porque o en-US tem duas. Ligá-las
// hoje mudaria comportamento: o `loadTTS` passaria a pedir `en_US-ryan-medium` à PORTA DO CARTUCHO
// (ADR-0094), que pode não ter essa voz. A tabela liga-se a isto quando o buscador existir, e nem um dia
// antes — uma lista ligada a um fornecedor que não a conhece é pior do que uma lista à espera.
//
// ⚠️ E QUAL DAS DUAS VOZES EN-US A CRIANÇA OUVE POR PADRÃO NÃO SE DECIDE AQUI. O ADR-0110 deixa-o
// explicitamente em aberto, e a ORDEM DESTE ARRAY NÃO É UMA PREFERÊNCIA — é a ordem em que o Dev as nomeou.
// Ler ordem como escolha seria decidir por omissão, que é o defeito que este projeto persegue.

/** Uma voz do catálogo. `voice` é o identificador no fornecedor; `engine` é o motor que a lê. */
export interface VozNeural {
  readonly locale: string;
  readonly engine: string;
  readonly voice: string;
}

/**
 * AS QUATRO QUE A ENGINE GARANTE (ADR-0110), decididas pelo Dev em 2026-09-08.
 *
 * ⚠️ TODAS `vits-piper` E NENHUMA `ncnn`, que o ADR-0065 §5 já proibia: `ncnn` é outro MOTOR DE INFERÊNCIA —
 * modelos `.param`/`.bin` e não `.onnx` — e este projeto corre sherpa-onnx. Dois dos links que chegaram em
 * 2026-09-08 apontavam para os espelhos `ncnn`, e é por isso que a proibição tem gate e não só um comentário.
 * ⚠️ E NENHUMA `int8`, pela razão MEDIDA do mesmo §5: no backend WASM o int8 corre ~3× MAIS LENTO que o fp32
 * (RTF 5,6 contra 2,5, do log do próprio Dev) e produz saída incorrecta ou muda. Quantizar não encurta a
 * espera aqui — alonga-a.
 */
export const VOZES_NEURAIS: readonly VozNeural[] = Object.freeze([
  Object.freeze({ locale: 'pt-BR', engine: 'piper', voice: 'pt_BR-faber-medium' }),
  Object.freeze({ locale: 'en-US', engine: 'piper', voice: 'en_US-ryan-medium' }),
  Object.freeze({ locale: 'en-US', engine: 'piper', voice: 'en_US-amy-medium' }),
  Object.freeze({ locale: 'es-MX', engine: 'piper', voice: 'es_MX-claude-high' }),
]);

/** Em que pé está cada voz. `falhou` é um estado e não uma excepção — ver `vozEmUso`. */
export type EstadoDaVoz = 'ausente' | 'a-buscar' | 'pronta' | 'falhou';

/** O que se sabe de cada voz, por identificador. Uma voz ausente do mapa é `ausente`. */
export type EstadosDasVozes = Readonly<Record<string, EstadoDaVoz | undefined>>;

export const estadoDe = (estados: EstadosDasVozes, v: VozNeural): EstadoDaVoz => estados[v.voice] ?? 'ausente';

/**
 * A ORDEM POR QUE SE BUSCAM: primeiro as do idioma corrente, depois as outras, cada grupo na ordem do
 * catálogo. Só entram as que ainda não estão prontas nem em curso.
 *
 * ⚠️ O IDIOMA CORRENTE PRIMEIRO É A REGRA INTEIRA, e ela é sobre uma criança e não sobre eficiência: as
 * outras são para «conforme interesse do jogador», mas a dela é a que ela precisa AGORA. Buscar em ordem de
 * catálogo faria uma criança brasileira esperar por duas vozes inglesas na rede de uma escola.
 *
 * 📌 `falhou` VOLTA À FILA. Uma escola perde a rede a meio da manhã e recupera-a; uma voz marcada como
 * falhada para sempre seria uma criança sem voz até alguém recarregar a página. Quem chama decide QUANDO
 * tentar de novo — este módulo só diz que ainda há o que buscar.
 */
export function ordemDeBusca(
  estados: EstadosDasVozes,
  localeCorrente: string,
  catalogo: readonly VozNeural[] = VOZES_NEURAIS,
): VozNeural[] {
  const porBuscar = catalogo.filter((v) => {
    const e = estadoDe(estados, v);
    return e === 'ausente' || e === 'falhou';
  });
  return [
    ...porBuscar.filter((v) => v.locale === localeCorrente),
    ...porBuscar.filter((v) => v.locale !== localeCorrente),
  ];
}

/** O que a criança ouve agora. `recuo` é a voz do sistema — eSpeak ou Web Speech. */
export type VozEmUso =
  | { readonly tipo: 'neural'; readonly voice: string }
  | { readonly tipo: 'recuo'; readonly porque: 'a-buscar' | 'sem-voz-para-o-idioma' | 'falhou' | 'ausente' };

/**
 * QUEM ESTÁ A FALAR, E POR QUE — e esta função é o gate 3 do ADR-0110 em forma de código.
 *
 * ⚠️ O DEFEITO QUE ELA IMPEDE TEM NOME NESTE REPOSITÓRIO: «um recuo que se apresenta como a coisa real é a
 * família do `reflectTTS`». Uma engine que dissesse «voz neural» enquanto o modelo ainda desce faria um adulto
 * concluir que a qualidade que ouve É a qualidade final — e desistir de esperar por uma coisa que já vinha a
 * caminho. Dizer `recuo` e dizer PORQUÊ custa uma linha e é a diferença entre informar e enganar.
 *
 * 📌 A PRIMEIRA VOZ PRONTA DO IDIOMA, e nada mais: onde há duas prontas, esta função NÃO escolhe entre elas —
 * devolve a primeira do catálogo porque tem de devolver alguma, e qual delas a criança prefere é a pergunta
 * que o ADR-0110 deixou em aberto. Ver o cabeçalho.
 */
export function vozEmUso(
  estados: EstadosDasVozes,
  localeCorrente: string,
  catalogo: readonly VozNeural[] = VOZES_NEURAIS,
): VozEmUso {
  const doIdioma = catalogo.filter((v) => v.locale === localeCorrente);
  if (doIdioma.length === 0) return { tipo: 'recuo', porque: 'sem-voz-para-o-idioma' };
  const pronta = doIdioma.find((v) => estadoDe(estados, v) === 'pronta');
  if (pronta) return { tipo: 'neural', voice: pronta.voice };
  // A PRECEDÊNCIA DOS TRÊS RECUOS, e cada degrau tem a sua razão:
  //
  // ⚠️ «A BUSCAR» GANHA DE «FALHOU» quando as duas coexistem: enquanto alguma ainda vem a caminho, dizer
  //    «falhou» seria anunciar uma derrota que ainda não aconteceu, e um adulto desligaria a espera cedo.
  // ⚠️ E «AUSENTE» NÃO SE DISFARÇA DE «A BUSCAR», que era como esta função estava escrita à primeira. Nada
  //    começou é diferente de está a caminho: o primeiro é uma engine que ainda não pediu — possivelmente
  //    porque ninguém a mandou —, e chamar-lhe «a buscar» esconderia um buscador que nunca arrancou atrás de
  //    uma frase tranquilizadora. É o mesmo defeito de forma que o `neuralDisponivel` já custou à #91.
  if (doIdioma.some((v) => estadoDe(estados, v) === 'a-buscar')) return { tipo: 'recuo', porque: 'a-buscar' };
  if (doIdioma.some((v) => estadoDe(estados, v) === 'falhou')) return { tipo: 'recuo', porque: 'falhou' };
  return { tipo: 'recuo', porque: 'ausente' };
}
