// SPDX-License-Identifier: AGPL-3.0-or-later
// A PROVA DE COMPILAÇÃO do barramento tipado (Fase C do plano).
//
// O barramento era `emit(evt: string, val: unknown)`, e as duas frouxidões custavam a mesma coisa: SILÊNCIO.
// Um `emit('viz', …)` em vez de `'vizMode'` não é erro em lugar nenhum — o assinante certo simplesmente
// nunca é chamado, nada fica vermelho, e a única pista é um painel que parou de se atualizar.
//
// Este arquivo trava as duas garantias onde elas valem: no `tsc`, que o gate `check:types` roda com ZERO
// tolerância fora do `main.ts`. A metade de execução mora em `tests/state.node.test.js`.
//
// MUTAÇÕES CONFERIDAS antes de este arquivo valer:
//   · `emit('viz', mode)` no lugar de `'vizMode'`  →  "Argument of type '"viz"' is not assignable to
//     parameter of type 'keyof EventoDoJogo'".
//   · `emit('numPlayers', String(n))`              →  "Argument of type 'string' is not assignable to
//     parameter of type 'number'".
import { describe, it, expect } from 'vitest';
import { on, emit, off, type EventoDoJogo } from '../app/js/core/state.js';
import '../app/js/game/state.js'; // o aumento de módulo com os eventos do JOGO mora lá

/** `true` só quando A é atribuível a B. Mesma ferramenta do teste de supertipo do quiz. */
type Estende<A, B> = A extends B ? true : false;

// A ENGINE declara os seus eventos, e cada carga tem o tipo certo.
const _phase: Estende<EventoDoJogo['phase'], 'title' | 'playing' | 'paused'> = true;
const _numPlayers: Estende<EventoDoJogo['numPlayers'], number> = true;
const _modoCego: Estende<EventoDoJogo['modoCego'], boolean> = true;
const _contorno: Estende<EventoDoJogo['hcOutlineFg'], 0 | 1 | 2> = true;

// E o JOGO AUMENTA a interface com os dele. Se o `declare module` de `game/state` sumir, estas quatro caem —
// e caem AQUI, com nome, em vez de virarem um `emit` que ninguém recebe.
const _cenario: Estende<EventoDoJogo['cenario'], string> = true;
const _activity: Estende<EventoDoJogo['activity'], string> = true;
const _quizLevel: Estende<EventoDoJogo['quizLevel'], number> = true;
const _coins: Estende<EventoDoJogo['coins'], unknown[]> = true;

void [_phase, _numPlayers, _modoCego, _contorno, _cenario, _activity, _quizLevel, _coins];

describe('barramento tipado — o que só o compilador podia garantir', () => {
  it('o nome do evento é uma CHAVE do mapa, não uma string qualquer', () => {
    // Em execução isto é trivial; o valor está em não compilar com um nome inventado. O caso existe para que
    // o arquivo apareça na suíte e alguém o abra quando o `tsc` reclamar daqui.
    const nomes: (keyof EventoDoJogo)[] = ['phase', 'numPlayers', 'vizMode', 'cenario', 'coins'];
    expect(nomes).toHaveLength(5);
  });

  it('a carga chega com o TIPO declarado, não como `unknown` para o assinante converter', () => {
    let visto = -1;
    const cancelar = on('numPlayers', (n) => { visto = n + 1; }); // `n` é `number` sem conversão nenhuma
    emit('numPlayers', 3);
    cancelar();
    expect(visto).toBe(4);
  });

  it('assinante que estoura não impede os outros de receber', () => {
    // Um painel quebrado derruba o painel; não derruba o jogo. É a razão do `try` em volta de cada ouvinte.
    const recebidos: boolean[] = [];
    const explode = (): void => { throw new Error('painel'); };
    const anota = (v: boolean): void => { recebidos.push(v); };
    on('modoCego', explode);
    on('modoCego', anota);
    emit('modoCego', true);
    off('modoCego', explode);
    off('modoCego', anota);
    expect(recebidos).toEqual([true]);
  });
});
