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
const PESO_MEDIDO: Readonly<Record<string, { readonly modelo: number; readonly config: number; readonly sha256Modelo: string; readonly sha256Config: string }>> = Object.freeze({
  'pt_BR-faber-medium': { modelo: 63_201_294, config: 4_855,
    sha256Modelo: '858555e3a064209c57088fe6bd70c4c3dc54d03eaa00c45d5ecaf43a33f95aa7', sha256Config: '7e694de195ae3fc36dd732c445eb04fb49b649854893cb5506b978f0d50a1d6f' },
  'en_US-ryan-medium': { modelo: 63_201_294, config: 4_883,
    sha256Modelo: 'abf4c274862564ed647ba0d2c47f8ee7c9b717d27bdad9219100eb310db4047a', sha256Config: '44034c056cb15681b2ad494307c7f3f2e4499d1253c700c711fa0a4607ffe78d' },
  'en_US-amy-medium': { modelo: 63_201_294, config: 4_882,
    sha256Modelo: 'b3a6e47b57b8c7fbe6a0ce2518161a50f59a9cdd8a50835c02cb02bdd6206c18', sha256Config: '95a23eb4d42909d38df73bb9ac7f45f597dbfcde2d1bf9526fdeaf5466977d77' },
  'es_MX-claude-high': { modelo: 63_122_309, config: 4_963,
    sha256Modelo: '3ef40a71ea63852cd8ab7e6fa7d2ecdcfa67a0b47c9c48e3f10e02ee02083ea0', sha256Config: '1afc81f703c0e4cb3b4d7c0dca096b8b54a98806807f0170cf5eb5557723c12d' },
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
    { id: `voz:${v.voice}`, url: urlDoModelo(v), bytes: peso?.modelo, sha256: peso?.sha256Modelo, porQueNaoTemFonte: RAZAO_ID_TORTO },
    { id: `voz:${v.voice}:cfg`, url: urlDaConfig(v), bytes: peso?.config, sha256: peso?.sha256Config, porQueNaoTemFonte: RAZAO_ID_TORTO },
  ];
}

/**
 * O RUNTIME DE VISÃO — **MediaPipe**, decidido pelo Dev em 2026-09-09 (ADR-0124): «piper-tts, mediapipe
 * (webgazer não), e LPCP: devem acompanhar a engine».
 *
 * 🔴 ESTA ENTRADA DIZIA «a #129 ainda não escolheu o fornecedor» DEPOIS DE ELE TER ESCOLHIDO, e a linha
 * sobreviveu ao registo que a contradizia. Não era só trabalho em falta: era uma afirmação FALSA a dirigir
 * quem a lesse para uma issue já fechada. O Dev teve de perguntar três vezes.
 *
 * 📏 MEDIDO EM 2026-09-09, como as vozes e no mesmo minuto: os três ficheiros respondem 200 em jsDelivr com
 * `Access-Control-Allow-Origin: *`, na versão FIXADA — 155 439 + 323 377 + 11 756 954 bytes.
 *
 * ⚠️ CDN FIXADA É PERMITIDA E O ADR-0116 DIZ PORQUÊ: o que o pilar 8 proíbe é depender da rede DEPOIS do
 * primeiro dia. Isto desce na INSTALAÇÃO, com o resto — e é a diferença inteira para o WebGazer, que busca
 * quando a criança liga o controle por olhar, logo a máquina que nunca o ligou fica sem ele para sempre.
 * 📌 A versão vai na URL, que é o que o `check:precache` exige de qualquer entrada externa: bytes diferentes
 * chegam por endereço diferente, e uma entrada fixada nunca congela.
 *
 * 🎯 SÃO OS TRÊS FICHEIROS E NÃO SÓ O `.wasm`: o `vision_bundle.mjs` é quem o carrega e o
 * `vision_wasm_internal.js` é a cola do Emscripten. Baixar o wasm sozinho é a mesma armadilha do `.onnx` sem
 * o `.onnx.json` — uma coisa «baixada» que não corre.
 *
 * ⬜ O que continua por fazer é a FIAÇÃO (issue #11): estes bytes descem e ainda ninguém os lê. O
 * `tests/o-que-desce-tem-quem-leia.node.test.js` é onde essa dívida está declarada.
 */
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';
const MP_MODELOS = 'https://storage.googleapis.com/mediapipe-models';

/**
 * 🔴 A PRIMEIRA VERSÃO DESTA LISTA TRAZIA O RUNTIME E NENHUM MODELO, e o Dev apanhou-o ao perguntar o que
 * tinha ficado de fora. 11,7 MB de WebAssembly sem um `.task` não reconhecem coisa nenhuma — é o `.onnx` sem
 * o `.onnx.json` outra vez, no ficheiro que escreve essa lição doze linhas acima.
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
 * O RUNTIME DE VOZ — **piper**, decidido no ADR-0127, e o Dev disse para que serve: «PiperTTS é o que será
 * usado para ler para o usuário. Precisa ser carregado com a engine».
 *
 * 🔴 ATÉ AQUI ELE SÓ CHEGAVA PELA PORTA DO CARTUCHO (ADR-0094), e três dos seis jogos não a declaram — nesses,
 * a engine descarregava 241 MB de modelos e não tinha com que os tocar. Descer os modelos sem o motor é a
 * mesma armadilha do `.onnx` sem o `.onnx.json`, um nível acima.
 *
 * 📏 MEDIDO EM 2026-09-09 em jsDelivr, versões FIXADAS, todos 200 com `Access-Control-Allow-Origin: *`.
 * ⚠️ SÃO CINCO FICHEIROS E NÃO UM: o `piper-tts-web.js` é só a entrada (23 KB) — os dois pedaços com hash no
 * nome são o corpo e a tabela de vozes, e o `onnxruntime-web` é quem corre o modelo. Trazer só a entrada dá
 * um módulo que importa o que não está lá.
 * 📌 `ort-wasm-simd-threaded` e não o `jsep`: o jsep é o caminho WebGPU e pesa 21,7 MB contra 11,2 — e o
 * hardware do pilar 1 não é onde a WebGPU se ganha.
 */
const PP = 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/dist';
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist';
const PIPER: readonly Pesado[] = Object.freeze([
  { id: 'voz:runtime', url: `${PP}/piper-tts-web.js`, bytes: 23_646,
    sha256: '531aa8a16605c07e5d791dfea540cadee1bd457b4a75c5303f01e843722f700f' },
  { id: 'voz:runtime:corpo', url: `${PP}/piper-o91UDS6e.js`, bytes: 158_217,
    sha256: 'b5ac96981729547606fd026b8e3829aad81e9e3c22308869d50473259c563283' },
  { id: 'voz:runtime:tabela', url: `${PP}/voices_static-D_OtJDHM.js`, bytes: 147_377,
    sha256: '72cbd46fecaa067a09ed9455ca04b970d722810905d90bb2421e0911a5c4d758' },
  { id: 'voz:runtime:ort', url: `${ORT}/ort.min.js`, bytes: 446_284,
    sha256: 'be6e560b64c03c99252eedc0e1989e9e51e44d9f191e7655c9bf011bf9f576c8' },
  { id: 'voz:runtime:ort-wasm', url: `${ORT}/ort-wasm-simd-threaded.wasm`, bytes: 11_246_032,
    sha256: '207d02be4591c156b0a98f024f3d58005b5b04c92274d759fb390338c63559ea' },
]);

export const PESADOS: readonly Pesado[] = Object.freeze([
  ...VOZES_NEURAIS.flatMap(entradasDaVoz),
  ...PIPER,

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
