// SPDX-License-Identifier: AGPL-3.0-or-later
// AS CATORZE FICAM DISCRETAS — o gate que o ADR-0112 deve, e ele guarda a opção RECUSADA.
//
// ========================= O QUE ELE IMPEDE, E POR QUE É UM GATE E NÃO UMA NOTA =========================
// O ADR-0112 mediu três saídas e escolheu a terceira: o PONTEIRO como capacidade declarada ao lado das
// catorze posições, que ficam discretas. A segunda — magnitude nas catorze, cada posição a carregar 0..1 —
// foi recusada com razão medida: **não desbloqueia desenhar** (desenhar é POSIÇÃO, não magnitude) e imporia
// uma segunda gramática a toda a acessibilidade já construída — o que faz o um-botão com uma acção meio
// premida? o que a alternância guarda? o que a tela de alcance diz de uma posição meio alcançada? — a pagar
// por trezentos jogos, para servir um caso que nenhum jogo do catálogo pede.
//
// ⚠️ E UMA OPÇÃO RECUSADA NÃO CHEGA POR DECISÃO: chega por um campo conveniente de cada vez. Um `analogico`
// num sítio, um `Record<Action, number>` noutro, e seis meses depois a segunda gramática existe sem que
// ninguém a tenha escolhido. É o mesmo caminho por que o `viz` de valor único se instalou e depois custou a
// #104 inteira a desfazer.
//
// ========================= O QUE ELE NÃO PEGA, dito para ninguém confiar demais =========================
// Não é análise de tipos. Ele apanha a forma LITERAL da chegada — uma estrutura por acção com valor numérico,
// e uma acção que deixe de ser uma string — e a resposta de `held`, que é a pergunta que todo transporte faz.
// Não apanha alguém a inventar `intensidade(pl, act)` num módulo novo com outro nome. O que o apanharia é o
// crivo de inventário do `input/**` a crescer, e ele fica registado aqui como limite conhecido em vez de
// implícito.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIONS } from '../app/js/core/actions.js';
import { held, padCur } from '../app/js/input/state.js';

const RAIZ_INPUT = fileURLToPath(new URL('../app/js/input/', import.meta.url));

function ficheirosTs(dir = RAIZ_INPUT) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...ficheirosTs(p));
    else if (nome.endsWith('.ts') && !nome.endsWith('.d.ts')) saida.push(p);
  }
  return saida;
}

/** Linhas de CÓDIGO: um comentário que CITA a forma proibida para a explicar não é a forma proibida. */
const codigoDe = (p) => readFileSync(p, 'utf8').split(/\r?\n/)
  .filter((ln) => !/^\s*(\/\/|\*|\/\*)/.test(ln));

describe('ADR-0112 · as catorze posições continuam DISCRETAS', () => {
  it('⚠️ [Right] `held` responde SIM ou NÃO, e não «quanto»', () => {
    // É a pergunta que todo transporte faz, e o sítio onde a magnitude entraria primeiro. `toBe(true)` já
    // exigiria o booleano, mas o `typeof` diz a REGRA em vez de a assumir — e é ele que falha se alguém
    // devolver `1`/`0`, que é como a magnitude costuma disfarçar-se de compatível.
    const jogador = { ctrl: { action1: ['KeyZ'] }, pad: -1 };
    expect(typeof held(jogador, 'action1')).toBe('boolean');
    expect(typeof held(jogador, 'action2')).toBe('boolean');
    // e pelo caminho do gamepad, que é o transporte que TEM analógico e o deita fora na fonte
    padCur[0] = { action1: true };
    expect(typeof held({ ctrl: {}, pad: 0 }, 'action1')).toBe('boolean');
    expect(held({ ctrl: {}, pad: 0 }, 'action1')).toBe(true);
    delete padCur[0];
  });

  it('⚠️ [Interface] uma posição é um NOME e não um descritor com campos', () => {
    // A outra forma de a magnitude chegar: `ACTIONS` a passar de strings para objectos, e um deles a ganhar
    // `analog: true`. Catorze nomes, catorze strings.
    expect(ACTIONS.length, 'o tamanho do conjunto mudou — ver ADR-0085').toBe(14);
    for (const a of ACTIONS) expect(typeof a, `posição ${String(a)} deixou de ser um nome`).toBe('string');
  });

  it('🎯 [Zero] nenhuma estrutura de `input/` guarda um NÚMERO por acção', () => {
    // A forma literal da chegada. `Record<string, boolean>` é o `PadState` de hoje; trocar o `boolean` por
    // `number` seria a opção 2 do ADR-0112 a instalar-se sem registo nenhum.
    const NUMERO_POR_ACAO = /Record<\s*(?:Action|string)\s*,\s*number\s*>|Partial<\s*Record<\s*Action\s*,\s*number\s*>/;
    const presos = [];
    for (const p of ficheirosTs()) {
      codigoDe(p).forEach((ln, i) => {
        if (NUMERO_POR_ACAO.test(ln)) presos.push(`${p.split(/[\\/]/).pop()}:${i + 1}  ${ln.trim().slice(0, 60)}`);
      });
    }
    expect(
      presos,
      'magnitude por acção — é a opção 2 do ADR-0112, que foi MEDIDA E RECUSADA porque não desbloqueia '
      + 'desenhar e impõe uma segunda gramática a toda a acessibilidade. Se ela for mesmo precisa, o caminho '
      + 'é um registo que supersede o ADR-0112, não um campo.',
    ).toEqual([]);
  });

  it('⚠️ [Interface] e a varredura está VIVA: ela lê os módulos de entrada a sério', () => {
    // Sem isto uma regex morta ou um caminho errado deixariam o caso acima verde por não ter nada que
    // examinar — a forma de verde falso que este repositório já apanhou mais de uma vez.
    const ficheiros = ficheirosTs();
    expect(ficheiros.length, 'a varredura não achou módulo nenhum em `input/`').toBeGreaterThan(5);
    expect(codigoDe(join(RAIZ_INPUT, 'state.ts')).join('\n'), 'o `PadState` de hoje é BOOLEANO')
      .toMatch(/Record<string,\s*boolean>/);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Quatro, por script e com contagem de ocorrencias, todas mortas. E as quatro sao a OPCAO 2 do ADR-0112 a
// chegar por caminhos diferentes, que e o ponto: uma opcao recusada nao chega por decisao.
//
//   1. `PadState` a guardar `number` -> reprovam DOIS (o crivo e o caso de vivacidade, que ancora no
//      `Record<string, boolean>` de hoje). E a forma mais directa da chegada.
//   2. `held` a devolver `1`/`0` -> reprova o caso do `typeof`. ⚠️ E a mutacao mais realista das quatro: em
//      JavaScript `1` e `0` passam em todo `if`, entao a magnitude disfarcada de compativel nao quebraria
//      nada — passaria por refactor inofensivo e mudaria a resposta que TODO transporte faz.
//   3. uma posicao a virar descritor (`{ nome: 'up', analog: true }`) -> reprova o [Interface]. A outra porta:
//      nao mudar a resposta, mudar a PERGUNTA.
//   4. a varredura apontada para outra pasta -> reprovam DOIS. Um crivo de ausencia que le a arvore errada
//      esta verde pela pior razao possivel.
