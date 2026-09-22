// SPDX-License-Identifier: AGPL-3.0-or-later
// UM REGISTO QUE APONTA PARA UM GATE MORTO — o inventário, e a razão de cada entrada.
//
// ========================= O QUE ISTO GUARDA =========================
// O `scripts/validate-adr.py` já confere que todo caminho listado em `confirmed-by` EXISTE, e o cabeçalho dele
// diz porquê: «apontavam para ficheiros que tinham saído com o cartucho, e nada dizia». Mas só SETE dos 112
// registos usam essa chave. Os outros nomeiam os seus gates em PROSA, e a prosa ninguém confere.
//
// 📏 MEDIDO EM 2026-09-08: 35 registos nomeiam um caminho (`tests/…` ou `scripts/…`) sem terem `confirmed-by`,
// e SETE desses caminhos já não existem em lado nenhum desta árvore.
//
// ⚠️ E A PROSA NÃO SE CONSERTA, que é a decisão do ADR-0057 e do próprio validador: «A PROSA DA `confirmation`
// NÃO SE REESCREVE. Ela é histórica e fica como estava; `confirmed-by` é o facto de hoje». Um registo de
// Agosto que nomeia um teste que depois saiu não estava errado — envelheceu. O defeito não é a frase antiga; é
// não haver, ao lado dela, uma linha que diga o que confirma o registo AGORA.
//
// 📌 POR ISSO ISTO É INVENTÁRIO E NÃO PROIBIÇÃO, na forma do `POR_MIGRAR` e do `fontes-empacotadas`: uma
// proibição nasceria vermelha com sete entradas e seria desligada na primeira pressa. A lista congela o que já
// aconteceu, obriga uma razão escrita à mão por entrada, e ENCOLHE à medida que os registos ganham
// `confirmed-by`. Uma lista que encolhe reporta o estado real; um visto reporta a intenção de quem o pôs.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ONDE A ÁRVORE DOS REGISTOS VIVE DESDE O ADR-0123 — noutro repositório, `the-inclusionist-docs`.
 *
 * ⚠️ E ESTE GATE FICA AQUI, do lado do CÓDIGO, de propósito. O que ele apanha é um registo a nomear um
 * ficheiro **desta** árvore que já não existe — e isso é quebra da ENGINE, que tem de avermelhar onde alguém
 * a conserta. Levá-lo para junto dos registos punha o vermelho no repositório errado (ADR-0123 §5).
 *
 * 📌 A árvore chega por `ADR_TREE` (é o que a CI passa, depois de a fazer checkout) ou, para quem trabalha
 * com os dois repositórios lado a lado, pelo clone irmão. Sem nenhuma das duas, os casos abaixo SALTAM — e
 * saltar aparece na saída do Vitest, ao contrário de passar por não ter o que ler.
 */
const CANDIDATAS = [
  process.env.ADR_TREE,
  fileURLToPath(new URL('../../the-inclusionist-docs/docs/2-Architecture/adr/', import.meta.url)),
].filter(Boolean);
const ADR = CANDIDATAS.find((p) => existsSync(p)) ?? CANDIDATAS[CANDIDATAS.length - 1];
const TEM_ARVORE = existsSync(ADR);
const RAIZ = process.cwd();
/** A raiz do repositório onde os registos vivem: `<docs>/docs/2-Architecture/adr/` → `<docs>`. */
const RAIZ_DOS_REGISTOS = resolve(ADR, '..', '..', '..');

/**
 * O caminho citado existe NALGUM dos dois repositórios?
 *
 * 🔴 A PERGUNTA GANHOU UM SEGUNDO SÍTIO NO DIA DA MUDANÇA DE CASA, e o gate apanhou-o sozinho: o ADR-0123
 * cita `scripts/test-validate-adr.py`, que é o gate do próprio validador e vive COM os registos. Contra a
 * engine sozinha ele parecia um ponteiro morto — e não é: está vivo, do outro lado. A pergunta que este
 * ficheiro faz é «este gate existe?», não «existe aqui».
 */
const existeAlgures = (c) => existsSync(join(RAIZ, c)) || existsSync(join(RAIZ_DOS_REGISTOS, c));

/*
 * Caminhos de repositório que um registo cita: `tests/x.node.test.js`, `scripts/y.mjs`.
 *
 * ⚠️ A EXTENSÃO TEM DE ACABAR ALI, e sem esse fecho o crivo INVENTA ficheiros: `scripts/rename-map.json` casava como
 * `scripts/rename-map.js` (a parte gulosa recua, `.js` casa, e o `on` fica de fora), e o registo passava a ser acusado de
 * apontar para um ficheiro que nunca nomeou. 📏 Achado em 2026-09-21 pelo ADR-0219, que cita um mapa `.json`.
 */
const CAMINHO = /(?<![\w/])(?:tests|scripts)\/[A-Za-z0-9_.\-]+\.(?:m?js|py|ts)(?![\w.])/g;

/**
 * OS CAMINHOS QUE UM REGISTO CITA E QUE NÃO EXISTEM AQUI, e o porquê de cada um.
 *
 * ⚠️ «NÃO EXISTE AQUI» NÃO É O MESMO QUE «MORREU», e a distinção custou-me um erro para aparecer: um deles é
 * um teste do repositório do CONSUMIDOR, citado correctamente pelo registo que o nomeia. Um crivo só vê a
 * ausência; a causa dela não é grepável, e é por isso que cada entrada tem de trazer uma frase.
 *
 * As causas medidas, e são quatro para seis entradas: saiu com o cartucho · o sujeito foi abolido · foi
 * aposentado de propósito · nunca foi desta árvore.
 */
const MORTOS = {
  'tests/main-i18n.node.test.js': 'SAIU COM O CARTUCHO (`b55b88e`, #111): testava o `main.js`, que deixou de viver aqui',
  'tests/alternancia-do-correr.node.test.js': 'SAIU COM O CARTUCHO (`b55b88e`): mecânica de plataforma, não de engine',
  'scripts/check-types.mjs': 'APOSENTADO DE PROPÓSITO (`f622221`) quando a dívida de tipos chegou a ZERO. Era um tecto que só descia; chegado ao fundo, um tecto deixa de ter função',
  // ⚠️ DUAS DATAS NUMA FRASE SÓ, e a segunda entrou porque a ferramenta da fase 3 reescreveu a primeira: em 09/09 este ficheiro
  // virou `arte-licencas-aceites`, e foi esse o nome que ele teve. Dizer que virou o nome de HOJE é falso para aquele dia — e um
  // livro de ponteiros que mente sobre a data deixa de servir para o que existe. Ficam os dois: o que foi, e onde está.
  'tests/lcp-quarantine.node.test.js': 'MUDOU DE NOME DUAS VEZES. Em 2026-09-09 virou `tests/arte-licencas-aceites.node.test.js`, quando o ADR-0133 recusou share-alike e a quarentena deixou de ter o que segurar; em 2026-09-22 a fase 3 do ADR-0219 pô-lo em inglês, e hoje é `tests/art-licences-accepted.node.test.js`. ⚠️ O ADR-0133 nomeia o primeiro para dizer que foi APOSENTADO, e essa frase é história — o gate não morreu, virou-se do avesso',
  'scripts/medir-forma-do-menu.py': 'MUDOU DE NOME NA FASE 3 (2026-09-22, ADR-0219): é hoje `scripts/measure-menu-shape.py`, e faz exactamente o que fazia',
  'tests/barra-rapida-no-hud.node.test.js': 'MUDOU DE NOME NA FASE 3 (2026-09-22, ADR-0219): é hoje `tests/quick-bar-in-the-hud.node.test.js`',
  'tests/contract-topologia-e-funcao.node.test.js': 'MUDOU DE NOME NA FASE 3 (2026-09-22, ADR-0219): é hoje `tests/contract-topology-is-a-function.node.test.js`',
};
/*
 * 🔴 AS ENTRADAS DA FASE 3 SÃO DE UMA QUARTA CAUSA, e ela não existia quando este ficheiro nasceu: o ficheiro NÃO MORREU, mudou
 * de nome. A prosa de um registo que o cita continua certa para o dia em que foi escrita (ADR-0057), e por isso não se toca —
 * o que faltava era o sítio onde se diz para onde ele foi, e é esta lista. ⚠️ Por isso mesmo este ficheiro está FORA da
 * varredura do `scripts/apply-file-rename.mjs`: ele é dado SOBRE caminhos, e uma ferramenta que o reescrevesse transformaria
 * «X virou Y» em «Y virou Y». Aconteceu duas vezes em 22/09 antes de a exclusão entrar.
 */
// ========================= O QUE JÁ SAIU, E COMO =========================
// A lista nasceu com SETE entradas e está em TRÊS. Nenhuma foi apagada; cada uma saiu por uma via diferente, e
// as vias é que são o assunto.
//
// ✅ `tests/carregar-e-arremessar.node.test.js` — citado SÓ pelo ADR-0045, que está `superseded` (pelo 0060).
//    ⚠️ SEGUNDO FALSO POSITIVO DO MEU PRÓPRIO CRIVO: um registo que já não governa não deve um gate ACTUAL, e
//    exigir-lho seria pedir enforcement a uma decisão revogada. O filtro do `aindaGoverna` corrige-o.
//
// ✅ `tests/progress.node.test.js` — o ADR-0037 ganhou `confirmed-by` apontando para as DUAS metades que ele
//    ainda afirma: o crivo de que nada guarda o desempenho de uma criança, e a verificação exaustiva da senha
//    copiada à mão. A prosa que cita o ficheiro morto fica: ela estava certa no dia, e o commit que a matou
//    (`809bc01`) foi o que ABOLIU o save — o gate não se perdeu, o que ele guardava é que deixou de existir.
//    📌 O ADR-0034 cita o mesmo ficheiro e NÃO ganhou chave: ele está superseded, e sai pela outra via.
//
// ✅ `tests/docs.node.test.ts` — saiu no dia em que a lista nasceu, e a história vale mais do que a entrada
//    valia.
//
// ⚠️ Ela entrou com a razão ERRADA: escrevi «nunca existiu — o ADR-0093 afirma uma verificação que não foi
// construída», porque não há registo de remoção sob nenhuma extensão. A frase que o cita desmentiu-me — ela
// diz «(`tests/docs.node.test.ts`, DO LADO DELE)»: é um teste do repositório do CONSUMIDOR, citado
// correctamente. O gate deste lado é o `tests/engine-package.node.test.js`, e existe.
//
// 📌 FOI AO ESCREVER A RAZÃO QUE O ERRO APARECEU. Um crivo que contasse «sete caminhos ausentes» teria tratado
// duas causas diferentes como uma; a ausência de um ficheiro é grepável, a causa dela não é. É esse o trabalho
// que uma frase à mão faz e um número não faz.
//
// ✅ E A DÍVIDA FOI PAGA, não apagada: o ADR-0093 ganhou `confirmed-by` a apontar para o gate real, o
// `validate-adr.py` passou a conferi-lo, e a entrada saiu por ser a saída funcionar — que era exactamente o
// que faltava provar.

function registos() {
  return readdirSync(ADR).filter((n) => n.startsWith('ADR-') && n.endsWith('.yaml'))
    .map((n) => ({ id: n.replace(/^(ADR-\d+).*/, '$1'), texto: readFileSync(join(ADR, n), 'utf8') }));
}

/** O registo declara, em chave conferida, o que o confirma HOJE? */
const temChaveConferida = (r) => /^\s{2}confirmed-by:/m.test(r.texto);

/**
 * O registo ainda GOVERNA?
 *
 * ⚠️ SEGUNDO FALSO POSITIVO CORRIGIDO, e ele custou-me outro erro para aparecer: um registo `superseded` não
 * deve um gate ACTUAL, porque já não decide nada — a prosa dele é história inteira, não meia. Exigir-lhe uma
 * confirmação de hoje seria pedir enforcement a uma decisão revogada, e o `confirmed-by` que respondesse
 * apontaria para um gate que guarda a decisão do SUCESSOR.
 *
 * 📌 Medido: dos sete registos que citavam um caminho morto, DOIS estavam superados — o ADR-0034 (pelo 0037) e
 * o ADR-0045 (pelo 0060). O `carregar-e-arremessar` era citado só pelo 0045, e sai por esta regra.
 */
const aindaGoverna = (r) => !/^\s{2}status:\s*"?(superseded|deprecated)"?/m.test(r.texto);

/**
 * Todo caminho citado em PROSA por um registo que ainda NÃO tem `confirmed-by`.
 *
 * ⚠️ E O FILTRO É A SAÍDA DESTA DÍVIDA, sem a qual o ficheiro seria um monumento. A primeira versão lia a
 * prosa de TODOS os registos — e a prosa é história e não se reescreve (ADR-0057), então nenhuma entrada podia
 * sair da lista nunca. Um inventário que só cresce não reporta progresso: reporta acumulação.
 *
 * 📌 Com o filtro, o caminho de saída é o que o repositório já decidiu: o registo ganha `confirmed-by`, o
 * `validate-adr.py` passa a conferir esse caminho, e a prosa antiga deixa de precisar de vigilância — porque
 * já há, ao lado dela, uma linha conferida a dizer o que confirma o registo agora.
 */
function citados() {
  const fora = new Set();
  for (const r of registos()) {
    if (temChaveConferida(r) || !aindaGoverna(r)) continue;
    for (const c of r.texto.match(CAMINHO) ?? []) fora.add(c);
  }
  return [...fora];
}

describe('a árvore dos registos, que desde o ADR-0123 mora noutro repositório', () => {
  it('🔴 [Interface] onde ela é EXIGIDA, saltar é reprovar — um gate que salta sozinho não é um gate', () => {
    // ⚠️ SEM ESTE CASO, o dia em que o `ADR_TREE` apontasse para o sítio errado seria o dia em que este
    // ficheiro passaria a não medir nada — e a suíte diria «verde». O checkout a falhar derruba o trabalho
    // sozinho; o que ninguém apanharia é a variável com um caminho errado.
    //
    // 📌 `ADR_TREE_REQUIRED` E NÃO `CI`, e a diferença é medida: a suíte inteira corre também no trabalho
    // `gate`, que NÃO faz checkout dos registos — usar o `CI` faria esse trabalho reprovar por não ter uma
    // árvore que ele nem devia ir buscar. A exigência é do trabalho que se declara responsável por ela.
    expect(
      TEM_ARVORE || !process.env.ADR_TREE_REQUIRED,
      `a árvore dos registos não foi encontrada em ${ADR}, e este trabalho declarou-se responsável por ela `
      + '(`ADR_TREE_REQUIRED`). Ela vem por checkout do `the-inclusionist-docs`, com `ADR_TREE` a apontar '
      + 'para `docs/2-Architecture/adr`; localmente, um clone irmão serve.',
    ).toBe(true);
  });
});

describe.skipIf(!TEM_ARVORE)('um registo não aponta para um gate que não existe', () => {
  it('⚠️ [Interface] nenhum ponteiro morto NOVO entrou sem ser declarado', () => {
    const novos = citados().filter((c) => !existeAlgures(c) && !(c in MORTOS));
    expect(
      novos,
      'um registo nomeia um gate que não existe nesta árvore. Se ele saiu, declare-o aqui com o motivo — e se '
      + 'o registo ainda TEM um gate, o sítio certo para o dizer é a chave `confirmed-by`, que o '
      + '`validate-adr.py` confere. A prosa é história e não se reescreve (ADR-0057).',
    ).toEqual([]);
  });

  it('⚠️ [Interface] a lista ENCOLHE: quem já não é apanhado sai dela', () => {
    // ⚠️ ESTE CASO FOI FORTALECIDO DEPOIS DE A PRIMEIRA VERSÃO NÃO SERVIR. Ele só perguntava se o ficheiro
    // voltou a existir — e uma entrada pode deixar de ser dívida por DUAS vias: o ficheiro volta, OU o registo
    // que o cita ganha `confirmed-by` e passa a declarar, em chave conferida, o que o confirma hoje. Com a
    // pergunta antiga, a segunda via não esvaziava a lista, e um inventário que não encolhe é um monumento.
    //
    // 📌 Foi assim que `tests/docs.node.test.ts` saiu daqui: o ADR-0093 ganhou a chave a apontar para o
    // `tests/engine-package.node.test.js`, que é o gate deste lado. A dívida não foi apagada — foi paga.
    const apanhados = new Set(citados().filter((c) => !existeAlgures(c)));
    expect(
      Object.keys(MORTOS).filter((c) => !apanhados.has(c)),
      'entrada que já não é dívida: ou o ficheiro voltou, ou o registo que o cita ganhou `confirmed-by`',
    ).toEqual([]);
  });

  it('⚠️ [Interface] e a varredura está VIVA: ela lê os registos e acha caminhos a sério', () => {
    // Um crivo de ausência que não lê nada está verde pela pior razão. Ancorado em dois factos: há registos, e
    // entre os caminhos citados há pelo menos um que EXISTE — senão o detector estaria a achar lixo.
    const todos = registos();
    expect(todos.length, 'a varredura não achou registo nenhum').toBeGreaterThan(100);
    const vivos = citados().filter((c) => existsSync(join(RAIZ, c)));
    expect(vivos.length, 'nenhum caminho citado existe — o detector está a casar com outra coisa').toBeGreaterThan(5);
  });

  it('🔴 [Zero] um `.json` citado NÃO é lido como um `.js` — o crivo não inventa ficheiros', () => {
    // 🔴 Foi o que aconteceu com o ADR-0219, que cita `scripts/rename-map.json`: a extensão casava até ao `.js` e o registo
    // era acusado de apontar para `scripts/rename-map.js`, um ficheiro que ninguém escreveu e que ele não nomeia. Um crivo
    // que inventa o defeito é pior do que um que o perde: quem o lê vai procurar o que não existe.
    const achados = [...'cita scripts/rename-map.json e tests/x.node.test.js e scripts/y.jsonl'.matchAll(CAMINHO)]
      .map((m) => m[0]);
    expect(achados, 'o casador leu uma extensão pela metade').toEqual(['tests/x.node.test.js']);
  });

  it('📌 [Right] e o mecanismo que resolve isto EXISTE e é conferido', () => {
    // O `confirmed-by` é a resposta decidida, e o `validate-adr.py` já reprova quando um caminho dele não
    // existe. Este caso prende o mecanismo: se ele desaparecer, esta lista deixa de ter para onde encolher.
    const validador = readFileSync(join(RAIZ, 'scripts', 'validate-adr.py'), 'utf8');
    expect(validador, 'o validador deixou de conferir os caminhos de `confirmed-by`').toMatch(/os\.path\.exists/);
    const comChave = registos().filter((r) => /^\s{2}confirmed-by:/m.test(r.texto));
    expect(comChave.length, 'nenhum registo usa a chave — o caminho de saída desta dívida fechou-se').toBeGreaterThan(0);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Quatro, todas mortas. ⚠️ E a primeira NAO E EDICAO DE CODIGO: ela ACRESCENTA a um registo real uma citacao
// de `tests/gate-que-nunca-existiu.node.test.js` e desfaz a seguir. Um inventario so se prova assim — mutar a
// regex prova que o detector esta vivo, nao que ele apanha a coisa.
//
//   1. um registo a citar um gate inexistente -> reprova o [Interface] dos declarados. E o defeito exacto:
//      um ponteiro que nasce morto e ninguem repara, porque a prosa ninguem confere.
//   2. um ORFAO na lista (nome de ficheiro que existe) -> reprova o caso dos orfaos. Sem ele a lista podia
//      guardar dividas ja pagas e parecer maior do que e — o oposto do que uma lista que ENCOLHE serve para.
//   3. a regex de caminhos morta -> reprova o caso da vivacidade, pelo piso de caminhos VIVOS. ⚠️ Repare-se
//      que ela nao reprova o caso dos declarados: sem detector, «nenhum ponteiro morto novo» fica verde por
//      nao achar nada, que e precisamente o verde falso que o caso da vivacidade existe para impedir.
//   4. o `validate-adr.py` a deixar de conferir os caminhos do `confirmed-by` -> reprova o caso do MECANISMO.
//   5. o filtro dos SUPERADOS removido -> reprova o caso do encolhimento: os dois registos revogados voltam a
//      ser cobrados por um gate actual que eles nao devem, porque ja nao decidem nada.
//      📌 Esse caso e o unico que nao olha para a divida e sim para a SAIDA dela: se a chave deixar de ser
//      conferida, esta lista deixa de ter para onde encolher, e um inventario sem saida vira um monumento.
