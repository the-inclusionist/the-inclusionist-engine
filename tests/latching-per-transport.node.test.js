// SPDX-License-Identifier: AGPL-3.0-or-later
// A ALTERNÂNCIA MIGRA PARA A CHAVE POR TRANSPORTE — o inventário que o ADR-0113 deve, nos dois sentidos.
//
// ========================= O QUE O REGISTO DECIDIU, E O QUE O CÓDIGO AINDA FAZ =========================
// O ADR-0113 decidiu que a alternância de marcha é um CAPS-LOCK guardado **com o mapeamento do controle**:
// o valor pertence ao TRANSPORTE, e trocar de controle troca o valor como troca o mapa de teclas.
//
// 📏 MEDIDO EM 2026-09-08, e o estado é «decidido e não entregue», que é o que este ficheiro afirma:
//
//   · A CHAVE POR JOGADOR — `KEYS.toggleMoveP(i)`, o modelo antigo — tem **exactamente UM escritor** em toda
//     a engine: `ui/settings-mobility.setToggleMove`. Ela é tocada por DOIS ficheiros ao todo.
//   · O MODELO NOVO tem **DOIS** participantes: `input/latch-store` (o adaptador) e `ui/settings-mobility` (o
//     painel, que escreve através dele). Era zero quando este ficheiro nasceu, no mesmo dia.
//
// ========================= POR QUE DUAS METADES, E NÃO UMA PROIBIÇÃO =========================
// ⚠️ Uma proibição («ninguém escreve a chave antiga») nasceria VERMELHA e ficaria vermelha até a fiação
// existir, o que não é gate, é lembrete a travar a suíte. E um inventário sozinho só olha para o passado: ele
// diria que a dívida não cresceu sem nunca dizer se o trabalho começou.
//
// Então são duas afirmações opostas e complementares — o TECTO que só desce (quem toca no modelo antigo) e o
// PISO que só sobe (quantos chamam o novo). É a forma que o `tests/fontes-empacotadas.node.test.js` já usou
// para as oito Playwrite, e pela mesma razão: dizer a verdade sobre o estado em vez de a esconder atrás de um
// visto.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { latchNow } from '../app/js/input/transport-in-use.js';
import { latchOf } from '../app/js/input/latch-scope.js';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));

/**
 * OS FICHEIROS DA ENGINE QUE AINDA TOCAM NA CHAVE POR JOGADOR, e por que cada um ainda a toca.
 *
 * ⚠️ ESTA LISTA SÓ PODE ENCOLHER. Uma entrada nova é o modelo que o ADR-0113 retirou a ganhar um consumidor
 * novo — e a ganhá-lo em silêncio, que é como ele se entrincheirou da primeira vez (ADR-0106 etapa 1b deu-lhe
 * padrão da engine no mesmo dia em que o ADR-0109 o aposentava).
 */
const AINDA_NA_CHAVE_ANTIGA = {
  'platform/storage.ts':
    'declara `toggleMoveP(i)` e `toggleMoveLegacy`. ⚠️ O legado NÃO sai com a migração: o `latch-scope` lê-o ' +
    'de propósito, para que nenhuma criança perca o ajuste que já tem. O que sai é `toggleMoveP`',
  'ui/settings-mobility.ts':
    'o ÚNICO escritor — `setToggleMove` grava `toggleMoveKey(i)`, que é a chave por JOGADOR. É este ponto ' +
    'que passa a escrever `chaveDaAlternancia(base, jogador, transporte)`, e é por isso que o inventário ' +
    'tem um alvo e não uma intenção',
};

/**
 * ⚠️ O PISO, e ele JÁ SUBIU DUAS VEZES no mesmo dia — 0 → 1 → 2, em 2026-09-08.
 *
 * 🎯 O primeiro foi `input/latch-store`, o adaptador entre a regra e o armazenamento, e o modo como ele
 * entrou é o gate a funcionar como desenhado: o caso reprovou, nomeou o ficheiro, e exigiu a revisão.
 *
 * ⚠️ O SEGUNDO — `ui/settings-mobility`, o painel — quase NÃO foi contado, e a falha era do detector: ele
 * procurava só quem chama `latchKey(`, e o painel escreve através do `writeLatch`, que é
 * a forma certa. Um piso assim mede quem improvisa em vez de quem migra. Alargado, e dito aqui em vez de
 * corrigido em silêncio.
 *
 * Ele NÃO PODE RECUAR: recuar significaria que a fiação foi desfeita sem que o registo mudasse.
 *
 * 🎯 O TERCEIRO SUBIU EM 2026-09-09 e é de outra espécie que os dois primeiros: `input/latch-sync` é o
 * primeiro LEITOR. Os dois anteriores escrevem a chave nova; este resolve-a para o transporte em uso e põe a
 * resposta no jogador — que é a issue #127 a deixar de ser «a regra existe e ninguém a lê». 📌 O piso passou
 * a contar as duas metades porque a chave só carrega comportamento a sério quando alguém a LÊ: enquanto era
 * só escrita, um `2` honesto descrevia uma migração que não tinha chegado a lado nenhum.
 */
const CHAMADORES_DA_CHAVE_NOVA_HOJE = 3;

function ficheiros(dir = RAIZ, pref = '') {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { out.push(...ficheiros(p, `${pref}${n}/`)); continue; }
    if (n.endsWith('.ts') && !n.endsWith('.d.ts')) out.push(`${pref}${n}`);
  }
  return out;
}

// ⚠️ `(^|[^:])` no comentário de linha — um `//` precedido de `:` é o esquema de uma URL. O gate irmão
// (`nada-de-cdn-a-mao`) nasceu de eu ter partido exactamente isto e a varredura ter devolvido zero.
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n\r]*/g, '$1');

const fonte = (f) => semComentarios(readFileSync(join(RAIZ, f), 'utf8'));

/** Ficheiros que nomeiam a chave POR JOGADOR em código. Generoso de propósito: mencionar conta. */
function tocamNaChaveAntiga() {
  return ficheiros().filter((f) => /toggleMoveP|toggleMoveKey/.test(fonte(f)));
}

/**
 * Ficheiros que PARTICIPAM no modelo novo — a definição da regra não conta.
 *
 * ⚠️ O DETECTOR FOI ALARGADO EM 2026-09-08, E O MOTIVO É UM FALSO NEGATIVO MEU. Ele procurava só
 * `latchKey(`, e quando o `ui/settings-mobility` passou a escrever a chave nova — através do
 * `writeLatch`, que é a forma CERTA — o piso não subiu. Um piso que só conta quem chama o
 * construtor da chave mede a arquitectura errada: mede quem improvisa, e não quem migrou.
 *
 * 📌 Agora conta os três pontos de entrada do modelo novo. Um ficheiro que use qualquer um deles está do
 * lado novo da migração, que é o que o piso diz medir.
 */
function chamamAChaveNova() {
  const entradas = /latchKey\s*\(|writeLatch\s*\(|storedLatch\s*\(/;
  return ficheiros().filter((f) => f !== 'input/latch-scope.ts' && entradas.test(fonte(f)));
}

describe('a alternância migra para a chave por transporte · o tecto que só desce', () => {
  it('[Vácuo] a varredura lê a árvore e ainda acha o módulo da regra', () => {
    expect(ficheiros().length).toBeGreaterThan(100);
    expect(ficheiros()).toContain('input/latch-scope.ts');
    expect(fonte('input/latch-scope.ts')).toContain('export function latchKey');
  });

  it('[Feliz] nenhum ficheiro NOVO passou a tocar na chave por jogador', () => {
    const novos = tocamNaChaveAntiga().filter((f) => !(f in AINDA_NA_CHAVE_ANTIGA));
    expect(novos, `passou a usar o modelo que o ADR-0113 retirou: ${novos.join(', ')}`).toEqual([]);
  });

  // ⚠️ A SAÍDA. Sem ela o inventário vira monumento: um ficheiro já migrado continuaria listado como dívida.
  it('[Fronteira] ficheiro da lista que já largou a chave antiga sai daqui', () => {
    const migrados = Object.keys(AINDA_NA_CHAVE_ANTIGA).filter((f) => !tocamNaChaveAntiga().includes(f));
    expect(migrados, `já não toca na chave antiga; apague a entrada: ${migrados.join(', ')}`).toEqual([]);
  });

  // 📌 O PAR que impede o detector de aprovar por cegueira: o escritor que a lista NOMEIA tem de estar mesmo lá.
  it('[Fronteira] o único escritor continua a ser o que o inventário nomeia', () => {
    const motor = fonte('ui/settings-mobility.ts');
    expect(motor, 'o escritor da chave por jogador mudou de forma — releia o inventário')
      .toMatch(/setBool\(\s*toggleMoveKey\(/);
  });
});

describe('a alternância migra para a chave por transporte · o piso que só sobe', () => {
  // 🎯 ESTA É A METADE QUE DIZ SE O TRABALHO COMEÇOU. Um inventário sozinho olha só para trás: ele aprovaria
  // para sempre uma migração que nunca arrancou. Enquanto este número for zero, o registo está decidido e não
  // entregue — e o ficheiro di-lo em voz alta em vez de deixar o verde sugerir o contrário.
  it('🎯 [Zero] o piso dos chamadores da chave nova é EXACTAMENTE o declarado', () => {
    const chamadores = chamamAChaveNova();
    expect(chamadores.length, `o piso subiu para ${chamadores.length} (${chamadores.join(', ')}) — actualize `
      + 'CHAMADORES_DA_CHAVE_NOVA_HOJE e apague as entradas do inventário que já migraram')
      .toBe(CHAMADORES_DA_CHAVE_NOVA_HOJE);
  });

  it('[Interface] a regra que a fiação vai consumir continua exportada e completa', () => {
    const src = fonte('input/latch-scope.ts');
    for (const nome of ['latchKey', 'legacyLatchKey', 'latchOf',
      'latchAlwaysOn', 'latchIsOptional']) {
      expect(src, `${nome} deixou de ser exportado e a fiação ficaria sem alvo`).toContain(`export function ${nome}`);
    }
  });
});

describe('a alternância migra para a chave por transporte · o modelo superado não pode ser escolhido por engano', () => {
  // 🔴 O CÓDIGO TEM DUAS FUNÇÕES QUE RESPONDEM «há alternância?», E UMA DELAS É A QUE O ADR-0113 RETIROU.
  // `transport-in-use.latchNow` decide SÓ PELO APARELHO (a regra do ADR-0109);
  // `latch-scope.latchOf` lê o que a criança gravou (a regra do ADR-0113). Nenhuma tem consumidor
  // hoje, então nada está partido — mas quem for ligar a fiação escolhe uma, e escolher a primeira
  // implementa o modelo aposentado sem que nada o diga.
  //
  // ⚠️ ESTE BLOCO TORNA A SUPERSESSÃO EXECUTÁVEL. Um `@deprecated` é prosa; prosa não reprova.

  it('🔴 [Zero] a criança do TECLADO com alternância gravada: as duas funções DIVERGEM, e o registo diz qual vale', () => {
    const estado = { emUso: 'teclado', assistidaLigada: false };
    const gravado = { doTransporte: true, doLegado: null, padrao: false };

    // O modelo do ADR-0109: o teclado não tem alternância própria, logo NÃO.
    expect(latchNow(estado), 'o modelo superado deixou de dizer o que dizia').toBe(false);
    // O modelo do ADR-0113: ela gravou, logo SIM. É o controle que a leitura literal lhe tirava.
    expect(latchOf(estado.emUso, gravado), 'a regra do ADR-0113 deixou de ler o valor gravado').toBe(true);
  });

  it('⚠️ [Fronteira] e no TOQUE também divergem — a cláusula do toque caiu com a mesma frase', () => {
    const estado = { emUso: 'toque', assistidaLigada: false };
    const desligadoPelaCrianca = { doTransporte: false, doLegado: null, padrao: false };

    expect(latchNow(estado), 'o toque deixou de estar em COM_ALTERNANCIA_PROPRIA').toBe(true);
    expect(latchOf(estado.emUso, desligadoPelaCrianca), 'o toque deixou de ser escolha').toBe(false);
  });

  // 📌 E ONDE AS DUAS CONCORDAM, que é o que impede este bloco de parecer uma acusação geral: nos quatro
  // assistidos a alternância é obrigatória nos DOIS modelos, por razões diferentes e com o mesmo resultado.
  it('[Feliz] nos quatro assistidos as duas concordam — obrigatória, e ninguém a desliga', () => {
    for (const t of ['olhos', 'rosto', 'gestos', 'fala']) {
      expect(latchOf(t, { doTransporte: false, doLegado: false, padrao: false }), `${t} pôde ser desligado`)
        .toBe(true);
      expect(latchNow({ emUso: t, assistidaLigada: true }), `${t} habilitado deixou de forçar`).toBe(true);
    }
  });

  // ⚠️ A GUARDA QUE MANTÉM ISTO HONESTO: enquanto a função superada não tiver consumidor, a divergência é
  // documentação. No dia em que ganhar um, é uma DECISÃO — e este caso obriga a que seja tomada em vez de
  // acontecer.
  it('🎯 [Zero] a função superada continua SEM CONSUMIDOR na engine', () => {
    const usam = ficheiros()
      .filter((f) => f !== 'input/transport-in-use.ts')
      .filter((f) => /latchNow\s*\(/.test(fonte(f)));
    expect(usam, `alguém passou a chamar o modelo que o ADR-0113 retirou: ${usam.join(', ')}`).toEqual([]);
  });
});

// ===== MUTAÇÕES CONFERIDAS (2026-09-08, por script, com contagem de ocorrências) =====
// 1. tirar `ui/settings-mobility.ts` do inventário          → reprovam o [Feliz] **e** a saída (a chave renomeada
//    deixa de aparecer nos achados). Previ só o [Feliz]; fica o medido, como nos gates irmãos
// 2. acrescentar um ficheiro já migrado ao inventário    → [Fronteira] da saída reprova
// 3. `tocamNaChaveAntiga` a devolver `[]`                → [Fronteira] da saída reprova; o [Feliz] fica VERDE,
//    que é a razão de a saída existir — um crivo cego aprova tudo o que a regra sozinha vê
// 4. `chamamAChaveNova` a devolver um ficheiro           → 🎯 o [Zero] do PISO reprova, e é a mutação que dá
//    sentido ao ficheiro: no dia em que a fiação chegar, é ESTE caso que obriga a actualizar o inventário em
//    vez de o deixar a mentir
// 5. `semComentarios` sem o `(^|[^:])`                   → nenhuma reprova hoje: EQUIVALÊNCIA MEDIDA, porque
//    nenhum destes ficheiros tem URL numa linha com `toggleMoveP`. Fica registada e não apagada — foi
//    exactamente este defeito que fez a varredura irmã devolver zero, e ele não morde aqui por sorte
//
// ----- e as do bloco da DIVERGÊNCIA, uma por caso e sem sobreposição nenhuma -----
// 6. `latchOf` deixa de ler `doTransporte`          → o caso da criança do TECLADO reprova
// 7. `latchOf` deixa de forçar nos assistidos       → o caso do acordo nos quatro reprova
// 8. `input/keydown` passa a chamar `latchNow`    → 🎯 o [Zero] do consumidor reprova, que é a guarda
//    que transforma «documentação da divergência» em «decisão obrigatória» no dia em que alguém a ligar
// 9. o modelo superado deixa de responder pelo TOQUE      → o caso da divergência no toque reprova
//    📌 As quatro batem em casos DIFERENTES e nenhuma se sobrepõe — é a medida de que os quatro casos deste
//    bloco afirmam quatro coisas, e não a mesma escrita quatro vezes.
