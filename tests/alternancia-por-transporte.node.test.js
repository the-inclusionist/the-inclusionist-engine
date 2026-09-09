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
//     a engine: `ui/settings-motor.setToggleMove`. Ela é tocada por DOIS ficheiros ao todo.
//   · A CHAVE POR TRANSPORTE — `latch-scope.chaveDaAlternancia` — existe, está aferida, e tem **ZERO**
//     chamadores em `app/js`. O módulo foi escrito para o ADR-0104 §C e esperava por esta decisão.
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
  'ui/settings-motor.ts':
    'o ÚNICO escritor — `setToggleMove` grava `toggleMoveKey(i)`, que é a chave por JOGADOR. É este ponto ' +
    'que passa a escrever `chaveDaAlternancia(base, jogador, transporte)`, e é por isso que o inventário ' +
    'tem um alvo e não uma intenção',
};

/** ⚠️ O PISO. Hoje zero; quando a fiação chegar, sobe — e não pode recuar em silêncio. */
const CHAMADORES_DA_CHAVE_NOVA_HOJE = 0;

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

/** Ficheiros que CHAMAM a chave por transporte — a definição não conta como chamada. */
function chamamAChaveNova() {
  return ficheiros().filter((f) => f !== 'input/latch-scope.ts' && /chaveDaAlternancia\s*\(/.test(fonte(f)));
}

describe('a alternância migra para a chave por transporte · o tecto que só desce', () => {
  it('[Vácuo] a varredura lê a árvore e ainda acha o módulo da regra', () => {
    expect(ficheiros().length).toBeGreaterThan(100);
    expect(ficheiros()).toContain('input/latch-scope.ts');
    expect(fonte('input/latch-scope.ts')).toContain('export function chaveDaAlternancia');
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
    const motor = fonte('ui/settings-motor.ts');
    expect(motor, 'o escritor da chave por jogador mudou de forma — releia o inventário')
      .toMatch(/setBool\(\s*toggleMoveKey\(/);
  });
});

describe('a alternância migra para a chave por transporte · o piso que só sobe', () => {
  // 🎯 ESTA É A METADE QUE DIZ SE O TRABALHO COMEÇOU. Um inventário sozinho olha só para trás: ele aprovaria
  // para sempre uma migração que nunca arrancou. Enquanto este número for zero, o registo está decidido e não
  // entregue — e o ficheiro di-lo em voz alta em vez de deixar o verde sugerir o contrário.
  it('🎯 [Zero] a chave por transporte ainda não tem chamador — decidido, não entregue', () => {
    const chamadores = chamamAChaveNova();
    expect(chamadores.length, `o piso subiu para ${chamadores.length} (${chamadores.join(', ')}) — actualize `
      + 'CHAMADORES_DA_CHAVE_NOVA_HOJE e apague as entradas do inventário que já migraram')
      .toBe(CHAMADORES_DA_CHAVE_NOVA_HOJE);
  });

  it('[Interface] a regra que a fiação vai consumir continua exportada e completa', () => {
    const src = fonte('input/latch-scope.ts');
    for (const nome of ['chaveDaAlternancia', 'chaveLegadaDaAlternancia', 'alternanciaDe',
      'alternanciaSempreLigada', 'alternanciaEhEscolha']) {
      expect(src, `${nome} deixou de ser exportado e a fiação ficaria sem alvo`).toContain(`export function ${nome}`);
    }
  });
});

// ===== MUTAÇÕES CONFERIDAS (2026-09-08, por script, com contagem de ocorrências) =====
// 1. tirar `ui/settings-motor.ts` do inventário          → reprovam o [Feliz] **e** a saída (a chave renomeada
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
