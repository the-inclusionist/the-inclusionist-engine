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
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADR = fileURLToPath(new URL('../docs/2-Architecture/adr/', import.meta.url));
const RAIZ = process.cwd();

/** Caminhos de repositório que um registo cita: `tests/x.node.test.js`, `scripts/y.mjs`. */
const CAMINHO = /(?<![\w/])(?:tests|scripts)\/[A-Za-z0-9_.\-]+\.(?:m?js|py|ts)/g;

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
  'tests/carregar-e-arremessar.node.test.js': 'SAIU COM O CARTUCHO (`b55b88e`): arremesso é do jogo',
  'tests/progress.node.test.js': 'O SUJEITO DEIXOU DE EXISTIR (`809bc01`, «there is no save, and the game stores nothing about a child»). O gate não foi perdido — o que ele guardava foi abolido, e é a decisão que o ADR-0103 viria a fechar',
  'scripts/check-types.mjs': 'APOSENTADO DE PROPÓSITO (`f622221`) quando a dívida de tipos chegou a ZERO. Era um tecto que só descia; chegado ao fundo, um tecto deixa de ter função',
};
// ✅ `tests/docs.node.test.ts` SAIU DESTA LISTA NO DIA EM QUE ELA NASCEU, e a história vale mais do que a
// entrada valia.
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
    if (temChaveConferida(r)) continue;
    for (const c of r.texto.match(CAMINHO) ?? []) fora.add(c);
  }
  return [...fora];
}

describe('um registo não aponta para um gate que não existe', () => {
  it('⚠️ [Interface] nenhum ponteiro morto NOVO entrou sem ser declarado', () => {
    const novos = citados().filter((c) => !existsSync(join(RAIZ, c)) && !(c in MORTOS));
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
    const apanhados = new Set(citados().filter((c) => !existsSync(join(RAIZ, c))));
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
//      📌 Esse caso e o unico que nao olha para a divida e sim para a SAIDA dela: se a chave deixar de ser
//      conferida, esta lista deixa de ter para onde encolher, e um inventario sem saida vira um monumento.
