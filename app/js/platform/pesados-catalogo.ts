// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/pesados-catalogo.ts — O QUE É PESADO, DE ONDE VEM, E QUANTO PESA.
//
// 📌 SEPARADO DO BUSCADOR de propósito: a lista é DADO e muda por decisão registada; o buscador é regra e
// muda por defeito encontrado. Juntos, cada correcção de uma URL mexeria no ficheiro que decide a ordem das
// descargas, e cada correcção da ordem mexeria na lista que um registo governa.
//
// 📌 Every address is written ONCE, where its module owns it: Kokoro's in `platform/kokoro`, the vision runtime's here.
import {
  VOZES_KOKORO, URL_DO_MODELO_KOKORO, URL_DO_TOKENIZADOR_KOKORO, urlDaVozKokoro, SHA256_DAS_VOZES_KOKORO, BYTES_DA_VOZ_KOKORO,
  SHA256_DO_MODELO_KOKORO, BYTES_DO_MODELO_KOKORO, SHA256_DO_TOKENIZADOR_KOKORO, BYTES_DO_TOKENIZADOR_KOKORO,
} from './kokoro.js';

/** Uma coisa pesada que a engine promete e que não cabe no pacote. */
export interface Pesado {
  readonly id: string;
  /** `null` = decidido que existe, mas ainda não há de onde vir. Ver `porQueNaoTemFonte`. */
  readonly url: string | null;
  /** Medido, não estimado — é o número que uma frase honesta usa antes de começar a descarga. */
  readonly bytes?: number;
  /**
   * The SHA-256 of the bytes, MEASURED (issue #168): what the fetcher compares before keeping anything. A pinned URL is
   * not pinned content — a CDN or a mirror can serve other bytes at the same address, and these run in the child's page.
   */
  readonly sha256?: string;
  /** Obrigatório quando `url` é `null`: uma ausência sem razão escrita vira uma ausência esquecida. */
  readonly porQueNaoTemFonte?: string;
}

/** O nome da Cache Storage. Versionado: mudar o conteúdo do catálogo não deve servir bytes velhos. */
// v2 since issue #168: what v1 kept was never checked against a hash, so it is not trusted — it is fetched again, checked.
export const CACHE_PESADOS = 'incl-pesados-v2';

/**
 * O RUNTIME DE VISÃO — **MediaPipe**, decidido pelo Dev em 2026-09-09 (ADR-0124): «… mediapipe
 * (webgazer não), e LPCP: devem acompanhar a engine».
 *
 * 🔴 ESTA ENTRADA DIZIA «a #129 ainda não escolheu o fornecedor» DEPOIS DE ELE TER ESCOLHIDO, e a linha
 * sobreviveu ao registo que a contradizia. Não era só trabalho em falta: era uma afirmação FALSA a dirigir
 * quem a lesse para uma issue já fechada. O Dev teve de perguntar três vezes.
 *
 * 📏 MEASURED 2026-09-09: the three files answer 200 on jsDelivr with
 * `Access-Control-Allow-Origin: *`, na versão FIXADA — 155 439 + 323 377 + 11 756 954 bytes.
 *
 * ⚠️ CDN FIXADA É PERMITIDA E O ADR-0116 DIZ PORQUÊ: o que o pilar 8 proíbe é depender da rede DEPOIS do
 * primeiro dia. Isto desce na INSTALAÇÃO, com o resto — e é a diferença inteira para o WebGazer, que busca
 * quando a criança liga o controle por olhar, logo a máquina que nunca o ligou fica sem ele para sempre.
 * 📌 A versão vai na URL, que é o que o `check:precache` exige de qualquer entrada externa: bytes diferentes
 * chegam por endereço diferente, e uma entrada fixada nunca congela.
 *
 * 🎯 SÃO OS TRÊS FICHEIROS E NÃO SÓ O `.wasm`: o `vision_bundle.mjs` é quem o carrega e o
 * `vision_wasm_internal.js` é a cola do Emscripten. The wasm alone is a «downloaded» thing that does not run.
 *
 * ⬜ Still to do is the WIRING (issues #11, #189): these bytes come down and the camera reader does not read them yet.
 */
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';
const MP_MODELOS = 'https://storage.googleapis.com/mediapipe-models';

/**
 * 🔴 A PRIMEIRA VERSÃO DESTA LISTA TRAZIA O RUNTIME E NENHUM MODELO, e o Dev apanhou-o ao perguntar o que
 * tinha ficado de fora. 11.7 MB of WebAssembly without a `.task` recognise nothing.
 *
 * 📏 MEDIDOS EM 2026-09-09, todos 200 com CORS aberto. `float16` e não `float32`: metade do peso, e a precisão
 * que se perde é irrelevante para dizer onde está um íris num ecrã de 320×180.
 */
const MEDIAPIPE: readonly Pesado[] = Object.freeze([
  { id: 'visao:runtime', url: `${MP}/vision_bundle.mjs`, bytes: 155_439,
    sha256: 'd885630c297c0b20b1fe86096cb06291c4c8080876f27852e724f24ac603713f' },
  { id: 'visao:runtime:cola', url: `${MP}/wasm/vision_wasm_internal.js`, bytes: 323_377,
    sha256: 'e170ee67dd4e16c1a6fcd8840a206687e5a59b22c20e4a902bc445b095454d73' },
  { id: 'visao:runtime:wasm', url: `${MP}/wasm/vision_wasm_internal.wasm`, bytes: 11_756_954,
    sha256: '8da277a733926eacd0474b8704b36742d6ec3231c57a860c5b889dff8f1df886' },
  { id: 'visao:modelo:rosto', url: `${MP_MODELOS}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, bytes: 3_758_596,
    sha256: '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff' },
  { id: 'visao:modelo:gestos', url: `${MP_MODELOS}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`, bytes: 8_373_440,
    sha256: '97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482' },
  { id: 'visao:modelo:maos', url: `${MP_MODELOS}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, bytes: 7_819_105,
    sha256: 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1' },
]);

/**
 * O WEBGAZER — **volta em 2026-09-09, ao lado do MediaPipe** (ADR-0132): «Traga o WebGazer de volta. Vamos
 * usar ambos.»
 *
 * 🎯 ELES NÃO SE SOBREPÕEM ONDE IMPORTA, e é essa medição que produziu a decisão: o MediaPipe diz ONDE O ÍRIS
 * ESTÁ — `FACE_LANDMARKS_LEFT_IRIS` são conjuntos de conexões sobre marcos —, e o WebGazer diz PARA ONDE A
 * CRIANÇA OLHA NO ECRÃ, que é um modelo de regressão com calibração. Nenhuma das quinze tarefas do
 * `tasks-vision` faz a segunda.
 *
 * ⚠️ E O DEFEITO DELE NUNCA FOI O FORNECEDOR: era ser PREGUIÇOSO. Buscado quando a criança liga o controle
 * por olhar, a máquina que nunca o ligou fica sem ele, e numa escola sem rede não acontece nada — sem erro e
 * sem explicação. Aqui desce na INSTALAÇÃO com tudo o resto, e o defeito desaparece com a capacidade intacta.
 * 📌 Fica a dívida que o ADR-0132 nomeia: o `<script src>` do `ui/webcam.ts` tem de sair no mesmo commit em
 * que a fiação o ler daqui, senão passam a existir dois caminhos para o mesmo ficheiro.
 */
const WEBGAZER: readonly Pesado[] = Object.freeze([
  { id: 'visao:olhar', url: 'https://webgazer.cs.brown.edu/webgazer.js', bytes: 1_895_169,
    sha256: 'e276d085eb490b5ba65481c368371be03b1a358d12d95336af0a8239f643f8e0' },
]);

/**
 * KOKORO (ADR-0186, ADR-0198; the Dev: «Faça»): the fp32 model, its tokenizer vocabulary and a style table per voice of the engine's
 * languages. The phonemizer and the runtime are the game's (ADR-0198 §5), bundled by it. Read by the port the quiz demo fills.
 */
const KOKORO: readonly Pesado[] = Object.freeze([
  { id: 'voz:kokoro:modelo', url: URL_DO_MODELO_KOKORO, bytes: BYTES_DO_MODELO_KOKORO, sha256: SHA256_DO_MODELO_KOKORO },
  { id: 'voz:kokoro:tokenizador', url: URL_DO_TOKENIZADOR_KOKORO, bytes: BYTES_DO_TOKENIZADOR_KOKORO, sha256: SHA256_DO_TOKENIZADOR_KOKORO },
  ...VOZES_KOKORO.map((v) => ({ id: `voz:kokoro:${v.voice}`, url: urlDaVozKokoro(v.voice), bytes: BYTES_DA_VOZ_KOKORO, sha256: SHA256_DAS_VOZES_KOKORO[v.voice] })),
]);

export const PESADOS: readonly Pesado[] = Object.freeze([
  ...KOKORO,

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
  ...MEDIAPIPE,
  ...WEBGAZER,

  /*
   * 🔴 O ACERVO DE ARTE — a quarta coisa pesada do ADR-0119, e a única SEM FONTE. Medido: `art/` tem DOIS
   * ficheiros — um README e um `ATTRIBUTION.csv` de 40 bytes, só o cabeçalho. Zero arte.
   *
   * ⚠️ ATÉ 2026-09-09 ESTA LINHA CULPAVA A COISA ERRADA. Dizia que a quarentena estava vazia e que a arte
   * era CC BY-SA 3.0 com autoria por recurso — descrevendo o Liberated Pixel Cup, que o ADR-0133 recusou:
   * os dois braços dele são share-alike ou GPL, e nenhum está na lista fechada de quatro licenças.
   *
   * 📌 A razão de continuar sem fonte MUDOU e é mais simples: não há acervo escolhido. A arte entra sob
   * CC0, CC BY 3.0, CC BY 4.0 ou OGA-BY, com uma linha de livro por recurso e a URL da origem — e nada
   * disso é uma URL única que um buscador possa pedir. A fonte desta linha é o dia em que houver acervo.
   */
  {
    id: 'arte:acervo',
    url: null,
    porQueNaoTemFonte: 'não há acervo escolhido: `art/` tem só README e cabeçalho do CSV. O ADR-0133 fechou '
      + 'a lista em CC0, CC BY 3.0/4.0 e OGA-BY, e a arte entra recurso a recurso com autoria e URL de '
      + 'origem — não por uma URL solta que este buscador possa pedir.',
  },
]);
