// SPDX-License-Identifier: AGPL-3.0-or-later
// render/hc-role-data — os PAPÉIS SEMÂNTICOS do color-blocking, num só lugar.
//
// Existiam duas listas dos mesmos quatro papéis: `RoleKey`/`ROLE_KEYS` em ui/settings-visual (que desenha um
// seletor de cor por papel) e `PaintableRole`/`HcRoleKey` em render/high-contrast (que repinta os tiles). Nada
// ligava as duas, e a falha era silenciosa: um quinto papel adicionado ao render ganharia cor e não ganharia
// seletor, sem erro de tipo em lugar nenhum — o painel simplesmente não ofereceria como customizar.
//
// Este módulo é FOLHA de propósito: zero dependências. Ele é importado tanto pelo render quanto pela UI, e um
// arquivo de dados sem dependência nenhuma pode ser importado dos dois lados sem arrastar o pipeline de
// renderização para dentro de um painel de configuração (nem o contrário).
//
// O que NÃO mora aqui: os rótulos em pt-BR dos papéis, que são apresentação e ficam em ui/settings-visual.
// Eles são digitados por `HcRoleKey`, então continuam obrigados a cobrir exatamente estes quatro papéis.

/** Papéis que `roleOf(tile)` sabe devolver — os que o repinte do alto contraste aplica direto no tile. */
export type PaintableRole = 'hazard' | 'climb' | 'water';

/** Todos os papéis customizáveis. `gate` não vem de `roleOf()`: é usado à parte pelo desenho do portão
 *  trancado (game/level-geometry), mas o jogador escolhe a cor dele no mesmo painel. */
export type HcRoleKey = PaintableRole | 'gate';

/** Ordem canônica dos papéis — a ordem em que o painel desenha os seletores de cor. */
export const HC_ROLE_KEYS: readonly HcRoleKey[] = ['hazard', 'climb', 'water', 'gate'];

/**
 * Cores padrão por papel (RGB 0-255). Color-blocking: perigo = laranja-quente, escalável/interativo
 * (escada/trampolim) = ciano, água = azul, portão = magenta. A estrutura (pedra/parede) fica no cinza-azulado
 * do nível e por isso não é um papel. Customizável e persistido — ver `HC_ROLE` em render/high-contrast.
 */
export const HC_ROLE_DEF: Record<HcRoleKey, [number, number, number]> = {
  hazard: [255, 110, 45], climb: [55, 225, 205], water: [70, 140, 255], gate: [194, 58, 212],
};
