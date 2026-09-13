// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/voice-plan.ts — O PLANO DAS VOZES NEURAIS (ADR-0110), na metade PURA.
//
// ========================= O QUE ESTE MÓDULO É =========================
// O catálogo das quatro vozes que a engine GARANTE, a ordem por que se buscam, e — a parte que mais importa —
// a resposta honesta a «o que é que esta criança está a ouvir AGORA». Sem rede, sem cache, sem tempo. Quem
// busca de facto é a outra metade; quem decide O QUE buscar e o que DIZER é esta.
//
// 📌 `platform/tts` speaks from THIS catalogue (ADR-0185): the hearing panel lists the voices of the child's language, and
// the one she picks is the one the neural engine loads. The delivery carries all four (ADR-0177), and the provider the
// games bundle knows all four.
//
// ⚠️ THE ORDER OF THIS ARRAY IS NOT A PREFERENCE — it is the order the Dev named them in (ADR-0110). Without a choice the
// first voice of the language speaks because one has to; which English voice a child prefers is hers to pick.

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

/**
 * The voices a child may pick for a language (ADR-0185): matched on the LANGUAGE of the tag, not the region — a Mexican
 * voice reads Spanish from Spain, and a Brazilian game tagged `pt` is still Portuguese. A voice reading another language
 * is not offered: Portuguese text through English phonemes is noise.
 */
export function vozesDoIdioma(etiqueta: string, catalogo: readonly VozNeural[] = VOZES_NEURAIS): readonly VozNeural[] {
  const idioma = (etiqueta.split('-')[0] ?? '').toLowerCase();
  return catalogo.filter((v) => (v.locale.split('-')[0] ?? '').toLowerCase() === idioma);
}

/**
 * DE ONDE VÊM OS MODELOS (ADR-0114), num sítio só.
 *
 * 📏 MEDIDO EM 2026-09-08, e não escolhido: o `piper.ttstool.com` — que o Dev nomeou ao perguntar — serve o
 * próprio runtime da própria origem e busca os modelos aqui. As quatro vozes deste catálogo respondem 200
 * neste endereço, com `Access-Control-Allow-Origin: *`, logo um PWA pode buscá-las de outra origem.
 *
 * ⚠️ UM SÍTIO SÓ É A METADE QUE O REGISTO PEDE. Um endereço repetido no ponto de uso é como o CDN do
 * WebGazer chegou ao `ui/webcam` — escrito à mão, sem política, e sem ninguém a poder mudá-lo de uma vez.
 *
 * ========================= 🔴 MUDOU DE ESPELHO EM 2026-09-09, E A REGRA É «BUSCAR DE ONDE O LEITOR LÊ» ====
 * Era `rhasspy/piper-voices`, medido a 08/09 como o espelho que o `piper.ttstool.com` usa. Depois de o
 * `platform/pesados` passar a descer os modelos no primeiro carregamento, mediu-se o outro lado — o
 * `@mintplex-labs/piper-tts-web@1.0.4` INSTALADO, lido do bundle e não do README — e ele busca em
 * `diffusionstudio/piper-voices`, com uma guarda que recusa qualquer URL fora de `huggingface.co`.
 *
 * 🎯 ENDEREÇOS DIFERENTES SIGNIFICAM CACHE DIFERENTE: a Cache Storage é indexada pela URL do pedido, logo os
 * 241 MB que desciam no primeiro dia NÃO ERAM LIDOS POR NINGUÉM, e a biblioteca descarregava tudo outra vez
 * no dia em que a voz fosse pedida. Até 482 MB num link de escola para uma voz.
 *
 * 📏 E OS DOIS ESPELHOS SERVEM OS MESMOS BYTES — 63 201 294 para o `pt_BR-faber-medium`, caminhos idênticos,
 * `Access-Control-Allow-Origin: *` nos dois. Medido nos dois no mesmo minuto, o que torna esta troca uma
 * correcção de facto e não uma preferência entre fornecedores.
 *
 * ⚠️ A CLÁUSULA DO ADR-0114 NÃO SE MEXE: o host continua nomeado num ponto só. O que mudou foi QUAL, e a
 * regra que decide isso passa a estar escrita para não voltar a divergir — **busca-se de onde o LEITOR lê**.
 * No dia em que a engine for dona do runtime (ADR-0124 cláusula 2), o leitor passa a ser ela e é ela que
 * escolhe; até lá, o único leitor é a porta do cartucho.
 */
export const HOST_DOS_MODELOS = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/';

/**
 * O CAMINHO DO MODELO, DERIVADO DO IDENTIFICADOR — e não uma segunda tabela.
 *
 * `pt_BR-faber-medium` diz tudo o que o caminho precisa: `pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx`.
 * 🎯 DERIVAR EM VEZ DE TABELAR é a decisão inteira desta função: uma tabela de caminhos ao lado da tabela
 * de vozes seria o mesmo facto escrito duas vezes, e este repositório já pagou isso três vezes — o
 * `DomQuery`, os rótulos de movimento reduzido, as chaves de armazenamento. Duas listas divergem, e
 * divergem uma entrada de cada vez.
 *
 * ⚠️ Devolve `null` para um identificador que não tenha a forma esperada, em vez de montar um caminho
 * torto: uma URL inventada dá 404 na escola, e um `null` dá para reportar antes de sair de casa.
 */
export function caminhoDoModelo(v: VozNeural): string | null {
  const partes = v.voice.split('-');
  if (partes.length !== 3) return null;
  const [locale, nome, qualidade] = partes as [string, string, string];
  const idioma = locale.split('_')[0];
  if (!idioma || !nome || !qualidade || idioma === locale) return null;
  return `${idioma}/${locale}/${nome}/${qualidade}/${v.voice}.onnx`;
}

/** O endereço completo do modelo. `null` quando o identificador não se deixa ler. */
export function urlDoModelo(v: VozNeural): string | null {
  const caminho = caminhoDoModelo(v);
  return caminho === null ? null : HOST_DOS_MODELOS + caminho;
}

/**
 * A CONFIGURAÇÃO da voz, que o motor lê junto com o modelo.
 *
 * 📌 `.onnx.json` e não um segundo caminho: é o mesmo ficheiro com outro sufixo, medido a responder 200 no
 * mesmo sítio. Escrevê-lo como derivação mantém a regra de que o identificador é a única fonte.
 */
export function urlDaConfig(v: VozNeural): string | null {
  const url = urlDoModelo(v);
  return url === null ? null : url + '.json';
}

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
