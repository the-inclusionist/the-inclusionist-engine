// SPDX-License-Identifier: AGPL-3.0-or-later
// NENHUMA BUSCA EXTERNA ESCRITA À MÃO — o inventário que estrangula por onde a engine toca na rede.
//
// ========================= A REGRA, REESCRITA EM 2026-09-09 =========================
// 🔴 A REGRA QUE ESTAVA AQUI FOI REVOGADA PELO ADR-0116, e deixá-la seria o defeito que este repositório
// persegue: um gate a argumentar por uma decisão que já não existe. Ela dizia — «um `<script src="https://…">`
// é uma dependência de rede NO PRIMEIRO USO, e a escola sem rede não recebe nada». O Dev derrubou a premissa:
// «NÃO FAZ SENTIDO BAIXAR ALGO VIA PWA, E CONSIDERAR QUE SE É PRA USAR VIA PWA OFFLINE NÃO É PRA BAIXAR NADA
// NO PRIMEIRO USO!» Um PWA chega pela rede; isso É a instalação. O pilar 8 passou a dizer o que mede:
// **PWA no primeiro dia ONLINE, depois OFFLINE-FIRST.**
//
// 📌 A REGRA NOVA É SOBRE TEMPO E NÃO SOBRE ORIGEM: **pré-cacheado na instalação, nunca buscado com preguiça
// no primeiro uso.** Um runtime de CDN fixada por versão, listado no manifesto de precache, é admissível — foi
// o que o Dev pediu desde o início («se conseguir usar cdnjs/jsdelivr é ótimo»). O que continua proibido é o
// endereço que só é buscado quando a criança carrega no botão, porque esse não estava lá no dia da instalação.
//
// ⚠️ E O VEREDICTO SOBRE O `ui/webcam.ts` NÃO MUDOU — mudou a razão. Aquele `<script src>` dispara no primeiro
// uso do controle por olhar, logo é busca preguiçosa, com CDN ou sem CDN. A regra velha condenava-o pelo host;
// a nova condena-o pelo MOMENTO, que é o que sempre esteve errado nele.
//
// 📌 ESTE CRIVO É A METADE DA FONTE. A outra metade — «e está mesmo no manifesto?» — só se afere depois de um
// build, e vive no `scripts/check-precache.mjs`, que desde `af35a7d` exige que uma entrada externa seja
// FIXADA e tenha peso declarado. Nenhum dos dois responde sozinho: aqui vê-se quem escreve um endereço, lá
// vê-se se ele chegou à instalação.
//
// 📏 MEDIDO EM 2026-09-08: a engine tem exactamente TRÊS URLs absolutas em código, e só UMA delas é uma busca.
// As outras duas são o espaço de nomes do SVG (`http://www.w3.org/2000/svg`), que o `createElementNS` exige e
// que **nunca toca na rede**. Excluí-las é a diferença entre um crivo e um alarme que alguém desliga — e a
// exclusão é uma REGRA escrita, não um silêncio.
//
// ========================= ⚠️ O DETECTOR QUASE MENTIU, E O ERRO ERA MEU =========================
// 🔴 A primeira varredura devolveu **ZERO** e eu quase reportei «não há CDN escrito à mão». O tira-comentários
// era `replace(/\/\/[^\n\r]*/g, '')` — e **toda URL tem `//` dentro**. Ele via `https:` e apagava
// `//webgazer.cs.brown.edu/webgazer.js'; s.async = true;` como se fosse comentário. O crivo comia exactamente
// aquilo que existe para caçar.
//
// 📌 É a segunda vez que um tira-comentários engana este repositório (a primeira deixava passar comentário no
// fim da linha), e a lição é a mesma dos resultados vazios: **uma varredura que devolve zero prova o detector,
// não a árvore.** O caso do vácuo aqui embaixo é o que impede a repetição — ele exige que a varredura ache as
// três, incluindo os dois espaços de nomes que ela depois recusa.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));

/**
 * AS BUSCAS EXTERNAS ESCRITAS À MÃO QUE AINDA EXISTEM, e por que cada uma continua aqui.
 *
 * ⚠️ A LISTA TEM DE ENCOLHER. Uma entrada nova sem razão escrita à mão é a engine a ganhar uma dependência de
 * rede sem ninguém decidir — que é exactamente como esta chegou.
 */
/**
 * ⚠️ A DESCULPA CARREGA UMA CONTAGEM, E NÃO SÓ UMA RAZÃO — medido em 2026-09-09, e a razão é um defeito que
 * este ficheiro tinha e que a sua própria entrada descrevia.
 *
 * O ADR-0114 pede que «o host dos modelos seja nomeado NUM SÍTIO SÓ». A lista, indexada por FICHEIRO,
 * afirmava isso à granularidade errada: plantei um segundo host no `platform/voice-plan.ts` —
 * `export const ESPELHO = 'https://cdn.jsdelivr.net/gh/rhasspy/piper-voices@main/'`, que é exactamente o
 * movimento de quem constrói o buscador e quer um espelho para a escola — e os CINCO casos ficaram verdes.
 * O ficheiro já estava desculpado, então tudo o que crescesse dentro dele estava desculpado com ele.
 *
 * 📌 Com o número, «um sítio só» passa a ser afirmado como UM. Ele é um TECTO QUE SÓ DESCE: subir exige
 * mexer aqui e escrever porquê; descer exige actualizar o número, que é como o inventário encolhe.
 */
const BUSCAS_A_MAO = {
  'platform/pesados-catalogo.ts': {
    urls: 4,
    porque:
      'OS RUNTIMES QUE A ENGINE PASSOU A DESCER NA INSTALAÇÃO (ADR-0124, ADR-0127, ADR-0132, decisões do Dev ' +
      'de 2026-09-09). ⚠️ CDN FIXADA É PERMITIDA e o ADR-0116 diz porquê: o pilar 8 proíbe depender da rede ' +
      'DEPOIS do primeiro dia, e isto desce com tudo o resto na instalação. ' +
      '📌 O `5` são as CINCO ORIGENS, e cada uma tem de ser defensável sozinha: (1) `@mediapipe/tasks-vision` ' +
      'em jsDelivr — o runtime de visão; (2) `storage.googleapis.com/mediapipe-models` — os modelos `.task`, ' +
      'que vivem noutro host porque o Google os publica assim, e sem eles o runtime não reconhece nada; ' +
      'the voice runtime (`@mintplex-labs/piper-tts-web`, `onnxruntime-web`) LEFT with ADR-0184 — the game bundles it; ' +
      'and (3) `webgazer.cs.brown.edu`, que VOLTOU pelo ADR-0132 porque o MediaPipe dá a posição ' +
      'do íris e não o ponto no ecrã. ' +
      'The WebGazer lives here only since #169: `ui/webcam.ts` reads it from the checked cache instead of fetching it. ' +
      '(4) `@diffusionstudio/piper-wasm` in jsDelivr — the voice provider\'s phonemizer at its own default address (#173), ' +
      'fetched by the BUILD into the delivery; the device asks for it at `pesados/`. ' +
      'A fifth origin is a new supplier entering without a decision. Sai desta lista quando os bytes forem ' +
      'servidos de origem própria',
  },
  'platform/voice-plan.ts': {
    urls: 1,
    porque:
      'ENDEREÇO DECLARADO, e ainda não uma busca. O ADR-0114 exige que o host dos modelos seja nomeado num ' +
      'sítio só, e este módulo é PURO — sem `fetch`, sem `import()`, sem `script.src`. Fica aqui porque o ' +
      'crivo lê literais e não sabe a diferença; o `nada-vem-de-fora` faz essa distinção de forma estrutural, ' +
      'e é lá que ela é afirmada. ⚠️ O `1` é a cláusula do registo: um segundo host aqui — um espelho, um ' +
      'recuo — é a decisão da issue #129 a ser tomada em silêncio por quem estava a ligar o buscador. ' +
      '⚠️ CORRIGIDO EM 2026-09-09: esta linha dizia «sai desta lista quando o buscador existir e a busca ' +
      'passar a viver nele». O buscador existe (`platform/pesados`) e a entrada FICA — porque este crivo lê ' +
      'LITERAIS, e o literal continua aqui. O buscador não escreve endereço nenhum: importa `urlDoModelo` ' +
      'deste módulo, que é a metade que o ADR-0114 realmente pede. Deixada como estava, a frase mandaria o ' +
      'próximo leitor apagar uma entrada ainda devida — e o `1` cairia com ela. Sai daqui quando o endereço ' +
      'sair do código, não quando a busca nascer',
  },
  // `ui/webcam.ts` LEFT on 2026-09-13 (#169): it runs WebGazer from the sha256-checked cache the install filled,
  // and asks the network for nothing.
};

/**
 * ⚠️ ESPAÇOS DE NOMES XML NÃO SÃO BUSCAS, e a exclusão é por PREFIXO e com razão escrita, não caso a caso.
 * `http://www.w3.org/2000/svg` é o argumento obrigatório do `createElementNS`; o navegador nunca o resolve.
 * Acusá-los faria o gate reprovar duas linhas correctas do `render/` e ser desligado antes de apanhar a real.
 */
const NAO_E_BUSCA = 'http://www.w3.org/';

function ficheiros(dir = RAIZ, pref = '') {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { out.push(...ficheiros(p, `${pref}${n}/`)); continue; }
    if (n.endsWith('.ts') && !n.endsWith('.d.ts')) out.push(`${pref}${n}`);
  }
  return out;
}

/**
 * ⚠️ O `(^|[^:])` É O CONSERTO, e sem ele este ficheiro não mede nada. Um `//` precedido de `:` é o dobro
 * da barra de um esquema (`https://`), nunca o início de um comentário.
 */
function semComentarios(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n\r]*/g, '$1');
}

const URL_EM_LITERAL = /['"`](https?:\/\/[^'"`]+)['"`]/g;

/** Toda URL absoluta que aparece num literal de string, em código — inclusive as que não são buscas. */
function urlsEmCodigo() {
  const achados = [];
  for (const f of ficheiros()) {
    const src = semComentarios(readFileSync(join(RAIZ, f), 'utf8'));
    for (const m of src.matchAll(URL_EM_LITERAL)) achados.push({ f, url: m[1] });
  }
  return achados;
}

const TODAS = urlsEmCodigo();
const BUSCAS = TODAS.filter((a) => !a.url.startsWith(NAO_E_BUSCA));

describe('nenhum CDN escrito à mão · o inventário encolhe', () => {
  // 🎯 O CASO DO VÁCUO, e ele é o primeiro porque é o que apanha o defeito que eu cometi: se o detector
  // voltar a comer as URLs, TODAS fica vazia e o caso feliz fica verde a olhar para nada.
  it('🎯 [Vácuo] a varredura acha as três URLs de código, os dois espaços de nomes incluídos', () => {
    expect(TODAS.length, 'o tira-comentários voltou a comer as URLs — ver o cabeçalho').toBeGreaterThanOrEqual(3);
    expect(TODAS.filter((a) => a.url.startsWith(NAO_E_BUSCA)).length, 'os espaços de nomes do SVG sumiram').toBe(2);
  });

  it('[Feliz] nenhuma busca externa nova, e as que há estão declaradas', () => {
    const novas = BUSCAS.filter((a) => !(a.f in BUSCAS_A_MAO));
    const desc = novas.map((a) => `${a.f} → ${a.url}`);
    expect(desc, `busca externa que ninguém declarou: ${desc.join(' · ')}`).toEqual([]);
  });

  /* 🎯 O CASO QUE FALTAVA, e o defeito que ele apanha estava DENTRO da desculpa. «Num sítio só» era afirmado
   * por FICHEIRO: com o ficheiro na lista, uma segunda URL dentro dele passava. Provado plantando um
   * `ESPELHO` jsDelivr ao lado do `HOST_DOS_MODELOS` — cinco casos verdes, e a cláusula do ADR-0114 morta.
   *
   * ⚠️ E o sítio onde ele morde é o único sítio onde isto vai acontecer: quem ligar o buscador da #129 tem
   * um problema real de escola sem rede e um espelho é a resposta óbvia. O gate não a proíbe — obriga-a a
   * passar por aqui, com o número e a razão, em vez de aparecer como uma linha a mais num ficheiro puro. */
  it('🎯 [Fronteira] um ficheiro desculpado não pode ganhar uma SEGUNDA URL', () => {
    const aMais = [];
    for (const [f, { urls }] of Object.entries(BUSCAS_A_MAO)) {
      const suas = BUSCAS.filter((a) => a.f === f).map((a) => a.url);
      if (suas.length > urls) aMais.push(`${f}: ${urls} declarada(s), ${suas.length} achada(s) → ${suas.join(' · ')}`);
    }
    expect(aMais, `URL nova dentro de um ficheiro já desculpado: ${aMais.join(' | ')}`).toEqual([]);
  });

  // ⚠️ A SAÍDA, e agora ela tem DUAS metades. Sem elas a lista vira monumento: a entrada do WebGazer
  // continuaria a dizer que existe uma dependência de rede depois de o ADR-0114 a ter retirado, e a próxima
  // pessoa leria história como estado. A segunda metade é o número: um tecto que ficou acima do real
  // desculpa por antecipação a URL que ainda não existe.
  it('[Fronteira] entrada da lista que já não busca nada sai daqui, e o número acompanha a descida', () => {
    const resolvidas = Object.keys(BUSCAS_A_MAO).filter((f) => !BUSCAS.some((a) => a.f === f));
    expect(resolvidas, `já não faz busca externa; apague a entrada: ${resolvidas.join(', ')}`).toEqual([]);

    const inchadas = Object.entries(BUSCAS_A_MAO)
      .filter(([f, { urls }]) => BUSCAS.some((a) => a.f === f) && BUSCAS.filter((a) => a.f === f).length < urls)
      .map(([f, { urls }]) => `${f}: declara ${urls}, tem ${BUSCAS.filter((a) => a.f === f).length}`);
    expect(inchadas, `o tecto ficou acima do real e desculpa por antecipação: ${inchadas.join(' | ')}`).toEqual([]);
  });

  // 📌 O PAR que prova que a exclusão é uma REGRA e não um buraco: um espaço de nomes é aceite, e uma URL
  // qualquer no MESMO ficheiro não seria.
  it('[Fronteira] o espaço de nomes do SVG é aceite; qualquer outra URL do mesmo ficheiro não seria', () => {
    const svg = TODAS.filter((a) => a.url === 'http://www.w3.org/2000/svg');
    expect(svg.length, 'o `createElementNS` deixou de usar o espaço de nomes').toBe(2);
    for (const a of svg) expect(BUSCAS.some((b) => b.f === a.f && b.url === a.url)).toBe(false);
    expect(NAO_E_BUSCA.startsWith('http://www.w3.org/'), 'a exclusão é por prefixo do W3C, não uma lista').toBe(true);
  });

  /* 🎯 A REGRA DO ADR-0116 FEITA ESTRUTURAL: um ENDEREÇO não é uma BUSCA, e é a diferença entre o que se
   * pré-cacheia e o que se busca com preguiça. `platform/voice-plan` NOMEIA o host e nunca o pede — é um
   * módulo puro, e é essa pureza que deixa o buscador escolher o momento. `ui/webcam` pede, e pede tarde.
   *
   * ⚠️ O CASO PRENDE OS DOIS LADOS, e é por isso que ele não é decorativo: se o `voice-plan` ganhar um
   * `fetch`, deixa de ser endereço declarado e passa a ser a busca preguiçosa que a desculpa dele diz que não
   * é; se o `webcam` deixar de buscar, a desculpa dele passou a descrever um ficheiro que já não faz aquilo.
   *
   * 📌 A regex é DUPLICADA do `nada-vem-de-fora` de propósito, pela razão que aquele ficheiro escreve: um
   * gate tem de poder discordar do outro. */
  const REDE = /\bfetch\s*\(|\bimport\s*\(|\.src\s*=|XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket|new\s+EventSource/;
  const pede = (f) => REDE.test(semComentarios(readFileSync(join(RAIZ, f), 'utf8')));

  it('🎯 [Fronteira] endereço DECLARADO e busca PREGUIÇOSA são coisas diferentes, e o crivo sabe qual é qual', () => {
    expect(pede('platform/voice-plan.ts'), 'o voice-plan ganhou uma busca — deixou de ser endereço declarado').toBe(false);
    // #169: the webcam stopped fetching — it runs the bytes of the checked cache. Its only `.src =` is a `blob:` it makes
    // itself; what would reopen the lazy door is a network address in its code, or a `src` that is not an object URL.
    const webcam = semComentarios(readFileSync(join(RAIZ, 'ui/webcam.ts'), 'utf8'));
    expect(webcam, 'ui/webcam names a network address again (#169)').not.toMatch(/https?:\/\//);
    expect(webcam, 'ui/webcam fetches again (#169)').not.toMatch(/\bfetch\s*\(|\bimport\s*\(|XMLHttpRequest/);
    expect(webcam, 'the script src of ui/webcam no longer comes from the checked bytes').toMatch(/URL\.createObjectURL\(/);
  });

  it('[Interface] `import()` dinâmico não traz especificador não-relativo', () => {
    const maus = [];
    for (const f of ficheiros()) {
      const src = semComentarios(readFileSync(join(RAIZ, f), 'utf8'));
      for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        if (!m[1].startsWith('.')) maus.push(`${f} → ${m[1]}`);
      }
    }
    expect(maus, `a engine passou a importar de fora por caminho dinâmico: ${maus.join(' · ')}`).toEqual([]);
  });
});

// ===== MUTAÇÕES CONFERIDAS (2026-09-08, por script, com contagem de ocorrências) =====
// 1. tirar `ui/webcam.ts` de `BUSCAS_A_MAO`            → [Feliz] reprova, nomeando a URL do WebGazer
// 2. acrescentar uma entrada já resolvida à lista      → [Fronteira] da saída reprova
// 3. `semComentarios` sem o `(^|[^:])` (o meu defeito) → reprovam o [Vácuo], a SAÍDA e o par. 🎯 E o que
//    interessa é qual NÃO reprova: o **[Feliz] fica verde**, porque uma lista vazia não tem entradas novas —
//    que é exactamente a forma como eu quase reportei «não há CDN escrito à mão». A regra sozinha não apanha
//    um crivo cego; quem o apanha é o vácuo. Medido, e diferente do que eu tinha previsto (eu escrevera que
//    só o vácuo reprovava).
// 4. `NAO_E_BUSCA` → 'http://www.w3.org/2000/svg' exacto → sobrevive: EQUIVALÊNCIA MEDIDA, porque hoje as duas
//    ocorrências são exactamente essa. Fica registada em vez de apagada — o prefixo cobre `1999/xlink` e os
//    outros namespaces do W3C no dia em que um deles aparecer, e apertá-lo agora não reprova nada.
// 5. `NAO_E_BUSCA` → 'http://'                          → [Fronteira] do par reprova, e devia: excluir todo
//    `http://` deixaria passar um CDN em texto plano, que é pior do que o que este gate caça.
