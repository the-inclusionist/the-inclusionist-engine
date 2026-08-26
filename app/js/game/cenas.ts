// SPDX-License-Identifier: AGPL-3.0-or-later
// game/cenas — AS TRÊS CENAS DESTE JOGO, e as regras de ir de uma para a outra (ADR-0030 C3).
//
// ========================= POR QUE ELAS MORAM EM `game/` =========================
// `title`/`playing`/`paused` é o vocabulário DESTE jogo, não da engine. O ADR-0030 registra alargar aquela
// união como NÃO-OPÇÃO justamente porque um segundo jogo continuaria amarrado a ela: um jogo com mapa de
// fases ou tela de resultados teria de pedir uma constante nova à engine para existir.
//
// `core/scenes` sabe que há cenas EMPILHADAS e nada sobre o que cada uma significa. Este arquivo é a metade
// que sabe — e por isso está do lado do jogo, e vai junto com o cartucho quando ele mudar de repositório
// (ADR-0036). O que atravessa a fronteira de volta são os três booleanos de `FatosDaCena`.
//
// ========================= POR QUE NÃO FICOU NO `main.ts` =========================
// Ficou, por umas horas. O problema apareceu ao mover o `togglePause` para lá: a raiz de composição não é
// importável, e três regras que o teste do `ui/shell` cobria — alternar pausa, e o que NÃO acontece no
// título — teriam ficado sem caso nenhum. Uma regra que sai de um módulo testável para a raiz é uma regra
// que perde o teste em silêncio.
//
// ========================= A REGRA QUE VALE A PENA LER =========================
// PAUSAR EMPILHA. Não substitui. `phase === 'paused'` apagava a informação de que há um jogo por baixo, e a
// pilha a mantém — é dela que sai, sem ninguém escrever, "o mundo continua desenhado mas não recebe tempo".
// `irPara('playing')` a partir da pausa DESEMPILHA em vez de trocar, para que o jogo de baixo seja o mesmo
// objeto de antes, e não um recomeço.
import { criarPilha, type SceneStack, type FatosDaCena } from '../core/scenes.js';

/** As três cenas que este jogo vive, com os nomes que o resto do código sempre usou. */
export type Fase = 'title' | 'playing' | 'paused';

/** O nome que cada fase tem DENTRO da pilha. A pilha fala português; a fronteira antiga, inglês. */
const NOME: Record<Fase, string> = { title: 'titulo', playing: 'jogo', paused: 'pausa' };

export interface CenasDoJogo {
  /** Vai para a cena `p`. Pausar EMPILHA sobre o jogo; sair da pausa DESEMPILHA. */
  irPara(p: Fase): void;
  /** jogando ⇄ pausado. Em qualquer outra cena, NÃO faz nada — nem no título, nem numa cena futura. */
  alternarPausa(): void;
  /** Os três fatos, para quem é engine e não conhece os nomes. */
  fatos(): FatosDaCena;
  /** A fase como string, para quem ainda fala esse idioma — hoje só o `window.__incl` do protocolo. */
  fase(): Fase;
  /** A pilha crua, da base ao topo. Existe para o teste afirmar o que `fatos()` esconde: o que há POR BAIXO. */
  nomes(): string[];
  /** A pilha, para quem for encaminhar quadro e entrada por ela (ainda ninguém — ver o ADR-0030). */
  pilha: SceneStack;
}

/**
 * Cria as cenas deste jogo, já com o título no topo — que é onde o jogo começa.
 *
 * `aoTrocar` é chamado DEPOIS de cada mudança, e existe para a raiz mandar a casca reprojetar o documento.
 * Opcional: as regras de transição são conferíveis sem casca nenhuma, que é o motivo deste arquivo.
 */
export function criarCenasDoJogo(aoTrocar?: () => void): CenasDoJogo {
  const pilha = criarPilha();
  pilha.push({ nome: NOME.title });

  const fatos = (): FatosDaCena => {
    const topo = pilha.top()?.nome;
    return {
      telaDeTitulo: topo === NOME.title,
      mundoRodando: topo === NOME.playing,
      menuDePausa: topo === NOME.paused,
    };
  };

  const cenas: CenasDoJogo = {
    pilha,
    fatos,
    fase(): Fase {
      const f = fatos();
      return f.mundoRodando ? 'playing' : f.menuDePausa ? 'paused' : 'title';
    },
    nomes: () => pilha.nomes(),

    irPara(p: Fase): void {
      const topo = pilha.top()?.nome;
      if (p === 'paused') {
        if (topo !== NOME.paused) pilha.push({ nome: NOME.paused }); // EMPILHA: o jogo continua embaixo
      } else {
        if (topo === NOME.paused) pilha.pop();                        // sair da pausa DESEMPILHA
        if (pilha.top()?.nome !== NOME[p]) pilha.replace({ nome: NOME[p] });
      }
      aoTrocar?.();
    },

    alternarPausa(): void {
      const f = fatos();
      if (f.mundoRodando) cenas.irPara('paused');
      else if (f.menuDePausa) cenas.irPara('playing');
      // Fora dos dois, nada — verbatim do `else if` sem `else` do original. E vale para uma cena futura
      // também: um mapa de fases não deve pausar por acidente.
    },
  };
  return cenas;
}
