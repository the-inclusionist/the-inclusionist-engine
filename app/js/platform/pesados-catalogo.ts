// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/pesados-catalogo.ts — O QUE É PESADO, DE ONDE VEM, E QUANTO PESA.
//
// 📌 SEPARADO DO BUSCADOR de propósito: a lista é DADO e muda por decisão registada; o buscador é regra e
// muda por defeito encontrado. Juntos, cada correcção de uma URL mexeria no ficheiro que decide a ordem das
// descargas, e cada correcção da ordem mexeria na lista que um registo governa.
//
// ========================= 🔴 A PRIMEIRA VERSÃO DESTE FICHEIRO COMETEU O DEFEITO QUE ELE SERVE =========================
// Ela escrevia o host à mão (`const HF = 'https://huggingface.co/…'`), a lista das quatro vozes outra vez, e
// uma segunda derivação do caminho `idioma/locale/nome/qualidade/…`. As três coisas JÁ EXISTEM no
// `platform/voice-plan.ts`, que o ADR-0114 designou como o sítio ÚNICO onde o host é nomeado — e cujo próprio
// comentário nomeia as três vezes que este repositório pagou por tabelas duplicadas (o `DomQuery`, os rótulos
// de movimento reduzido, as chaves de armazenamento).
//
// 📏 QUEM APANHOU FOI O INVENTÁRIO, e não pela duplicação: o `nada-vem-de-fora` recusou uma URL nova sem razão
// escrita. A URL era só a PROVA; declará-la teria feito o gate ficar verde com a duplicação lá dentro. ⚠️ É a
// razão de a saída ser APAGAR a cópia e não desculpá-la — declarar duas vezes o mesmo endereço é precisamente
// a cláusula que o `nada-de-cdn-a-mao` conta com um número.
import { VOZES_NEURAIS, urlDoModelo, urlDaConfig, type VozNeural } from './voice-plan.js';

/** Uma coisa pesada que a engine promete e que não cabe no pacote. */
export interface Pesado {
  readonly id: string;
  /** `null` = decidido que existe, mas ainda não há de onde vir. Ver `porQueNaoTemFonte`. */
  readonly url: string | null;
  /** Medido, não estimado — é o número que uma frase honesta usa antes de começar a descarga. */
  readonly bytes?: number;
  /** Obrigatório quando `url` é `null`: uma ausência sem razão escrita vira uma ausência esquecida. */
  readonly porQueNaoTemFonte?: string;
}

/** O nome da Cache Storage. Versionado: mudar o conteúdo do catálogo não deve servir bytes velhos. */
export const CACHE_PESADOS = 'incl-pesados-v1';

/**
 * O PESO DE CADA VOZ, MEDIDO EM 2026-09-09 e não estimado — `Content-Length` do modelo e corpo da configuração.
 *
 * 📌 O PESO MORA AQUI E O ENDEREÇO MORA NO `voice-plan`, e a divisão não é arrumação: o `voice-plan` responde
 * «que vozes a engine garante e onde estão», que é decisão do ADR-0110; isto responde «quanto custa descê-las
 * hoje», que é uma medição com data e que muda quando o fornecedor recomprime um ficheiro.
 *
 * ⚠️ UMA VOZ NOVA NO `voice-plan` SEM MEDIÇÃO AQUI FICA SEM `bytes`, e o aviso de «faltam N MB» passaria a
 * sub-reportar em silêncio. É por isso que o gate exige `bytes > 0` em toda entrada de voz COM url: o buraco
 * é pequeno e mudo, que é a forma de defeito que este repositório persegue.
 */
const PESO_MEDIDO: Readonly<Record<string, { readonly modelo: number; readonly config: number }>> = Object.freeze({
  'pt_BR-faber-medium': { modelo: 63_201_294, config: 4_855 },
  'en_US-ryan-medium': { modelo: 63_201_294, config: 4_883 },
  'en_US-amy-medium': { modelo: 63_201_294, config: 4_882 },
  'es_MX-claude-high': { modelo: 63_122_309, config: 4_963 },
});

/**
 * ⚠️ O `urlDoModelo` devolve `null` para um identificador que não se deixe ler, e a razão viaja com a entrada
 * em vez de a entrada desaparecer. Uma URL inventada dá 404 na escola; um `null` COM razão dá para reportar
 * antes de sair de casa, que é a regra que o `voice-plan` já escreve na própria função.
 */
const RAZAO_ID_TORTO = 'o identificador da voz não tem a forma `locale-nome-qualidade`, então o caminho no '
  + 'fornecedor não se deixa derivar. Corrija o identificador no `platform/voice-plan.ts`.';

/**
 * AS DUAS ENTRADAS DE UMA VOZ. ⚠️ SÃO DUAS E NÃO UMA: o `.onnx` é o modelo e o `.onnx.json` é a configuração,
 * e o piper recusa-se a falar sem a segunda. Um catálogo que só trouxesse a primeira produziria uma voz
 * «baixada» que não fala — que é pior do que uma voz em falta, porque a primeira parece resolvida.
 */
function entradasDaVoz(v: VozNeural): Pesado[] {
  const peso = PESO_MEDIDO[v.voice];
  return [
    { id: `voz:${v.voice}`, url: urlDoModelo(v), bytes: peso?.modelo, porQueNaoTemFonte: RAZAO_ID_TORTO },
    { id: `voz:${v.voice}:cfg`, url: urlDaConfig(v), bytes: peso?.config, porQueNaoTemFonte: RAZAO_ID_TORTO },
  ];
}

export const PESADOS: readonly Pesado[] = Object.freeze([
  ...VOZES_NEURAIS.flatMap(entradasDaVoz),

  /*
   * 🔴 O RUNTIME DE VISÃO — decidido e SEM FONTE, e a ausência é medida.
   *
   * A issue #11 diz «MediaPipe» e o `ui/webcam.ts` faz WebGazer, buscado de `webgazer.cs.brown.edu` por um
   * `<script src>` com preguiça no PRIMEIRO USO — sem SRI, sem `crossorigin`, e a falhar em silêncio numa
   * escola sem rede. `git grep -i mediapipe` em `app/js` devolve ZERO (ADR-0119).
   *
   * ⚠️ NÃO PONHO AQUI A URL DO WEBGAZER. Trocar o fornecedor é decisão da #129, e escrevê-la aqui seria
   * decidi-la de lado — a mesma coisa que o ADR-0119 apanhou: um subsistema que a engine DECLARA possuir e
   * que na prática é outra coisa.
   */
  {
    id: 'visao:runtime',
    url: null,
    porQueNaoTemFonte: 'a #129 ainda não escolheu o fornecedor: a #11 diz MediaPipe, o código faz WebGazer '
      + 'por CDN sem SRI. Escolher aqui seria decidir de lado.',
  },

  /*
   * 🔴 A ARTE DO LCP — decidida (ADR-0107, ADR-0119) e SEM FONTE, e também medido: `art/lcp/` tem DOIS
   * ficheiros — um README e um `ATTRIBUTION.csv` de 40 bytes, só o cabeçalho. Zero arte.
   *
   * ⚠️ E ela não pode entrar por uma URL solta: é OBRA, com autoria por recurso e share-alike (CC BY-SA 3.0),
   * e o ADR-0107 pôs a quarentena precisamente para o share-alike não alcançar a arte da autora. A fonte
   * desta linha é o dia em que a quarentena tiver conteúdo e um livro de atribuição a sério.
   */
  {
    id: 'arte:lcp',
    url: null,
    porQueNaoTemFonte: 'a quarentena `art/lcp/` está vazia (README + cabeçalho do CSV). A arte é OBRA sob '
      + 'CC BY-SA 3.0 com autoria por recurso — entra com o livro de atribuição, não por uma URL solta.',
  },
]);
