// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/hud (project NODE: só a metade PURA, sem `document`). Contrato: a GRADE de telas
// (screenGrid/screenRect/screenCount), o MARKUP estático (vphudHtml/waitBadgeHtml) e a PROJEÇÃO do HUD de um
// jogador (hudRowView) são funções de valor — não dependem de DOM nem de estado global. A casca
// (initHud/buildGameHud/updateGameHud/…) está em tests/hud.browser.test.js.
// ZOMBIES + Right-BICEP. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import {
  screenGrid, screenRect, screenCount, vphudHtml, waitBadgeHtml, hudRowView, contadorLabel, aplicarRotuloDoContador,
} from '../app/js/ui/hud.js';

// O `COIN_TARGET` SAIU DAQUI, e a ausência é o assunto do item 19. O fixture não conhece mais a constante do
// jogo de plataforma — ele DECLARA um objetivo, que é o campo 5 do contrato. Um teste que ainda precisasse
// importar a constante estaria dizendo que o módulo também precisa.
// O nome PADRÃO é 'itens', e não o do jogo de plataforma. Um teste de HUD que dissesse "moedas" a cada
// linha estaria afirmando, por hábito, o que este item acabou de tirar do módulo — e o gate de fixtures
// (engine-boundary) reprova exatamente isso. Os exemplos abaixo variam o nome de propósito.
const OBJ = (have, need, nome = 'itens', gender = 'm') =>
  ({ name: { text: nome, gender, plural: have !== 1 }, have, need });
const ICONE = '🪙';

const pct = (s) => Number.parseFloat(s); // '50%' -> 50 (as funções devolvem string de CSS)

// Tabela de poderes FALSA — de propósito diferente do POWER_SHORT real: hudRowView tem que ler a tabela
// INJETADA, não uma cópia interna.
// `powerShort`/`POWER_MSG` são FUNÇÕES desde o item 14: eram tabelas de texto em português, congeladas no
// idioma do boot. O fixture continua sendo uma tabela — é o que se lê melhor num teste — e vira função na
// injeção, o que também prova que o módulo não indexa nada: ele PERGUNTA.
const POWERS_TAB = { off: '—', superjump: '🐇 Super-pulo', fly: '🎈 Voo' };
const POWERS = (k) => POWERS_TAB[k] || '—';

// ---------------------------------------------------------------------------------------------
// screenGrid — colunas/linhas da grade de telas
// ---------------------------------------------------------------------------------------------

describe('ui/hud · screenGrid', () => {
  it('[Zero] sem jogadores ainda, a grade já é 1×1 (o boot monta uma tela antes de players[] existir)', () => {
    expect(screenGrid(0)).toEqual({ cols: 1, rows: 1 });
  });

  it('[One] solo: uma coluna, uma linha', () => {
    expect(screenGrid(1)).toEqual({ cols: 1, rows: 1 });
  });

  it('[Many] 2 = lado a lado; 3 e 4 = 2×2', () => {
    expect(screenGrid(2)).toEqual({ cols: 2, rows: 1 });
    expect(screenGrid(3)).toEqual({ cols: 2, rows: 2 });
    expect(screenGrid(4)).toEqual({ cols: 2, rows: 2 });
  });

  it('[Cross-check] de 1 a 4 jogadores a grade sempre comporta todas as telas (cols×rows ≥ n)', () => {
    for (let n = 1; n <= 4; n++) {
      const { cols, rows } = screenGrid(n);
      expect(cols * rows).toBeGreaterThanOrEqual(n);
    }
  });

  it('[Boundary] 4 é o teto do jogo: a grade nunca passa de 2×2', () => {
    const { cols, rows } = screenGrid(4);
    expect(cols).toBe(2);
    expect(rows).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------
// screenRect — retângulo (em %) de cada tela
// ---------------------------------------------------------------------------------------------

describe('ui/hud · screenRect', () => {
  it('[One] solo ocupa a tela inteira', () => {
    expect(screenRect(0, 1)).toEqual({ L: '0%', T: '0%', W: '100%', H: '100%' });
  });

  it('[Many] 2 jogadores: metades esquerda e direita, altura cheia', () => {
    expect(screenRect(0, 2)).toEqual({ L: '0%', T: '0%', W: '50%', H: '100%' });
    expect(screenRect(1, 2)).toEqual({ L: '50%', T: '0%', W: '50%', H: '100%' });
  });

  it('[Many] 4 jogadores: os quatro quadrantes', () => {
    expect(screenRect(0, 4)).toEqual({ L: '0%', T: '0%', W: '50%', H: '50%' });
    expect(screenRect(1, 4)).toEqual({ L: '50%', T: '0%', W: '50%', H: '50%' });
    expect(screenRect(2, 4)).toEqual({ L: '0%', T: '50%', W: '50%', H: '50%' });
    expect(screenRect(3, 4)).toEqual({ L: '50%', T: '50%', W: '50%', H: '50%' });
  });

  it('[Boundary] 3 jogadores: a 3ª tela é CENTRALIZADA na linha de baixo (25%), não colada à esquerda', () => {
    expect(screenRect(0, 3)).toEqual({ L: '0%', T: '0%', W: '50%', H: '50%' });
    expect(screenRect(1, 3)).toEqual({ L: '50%', T: '0%', W: '50%', H: '50%' });
    expect(screenRect(2, 3)).toEqual({ L: '25%', T: '50%', W: '50%', H: '50%' });
  });

  it('[Cross-check] com 1, 2 e 4 telas a grade cobre 100% da área, sem sobra nem sobreposição', () => {
    for (const n of [1, 2, 4]) {
      let area = 0;
      for (let i = 0; i < n; i++) { const r = screenRect(i, n); area += pct(r.W) * pct(r.H); }
      expect(area).toBe(100 * 100);
    }
  });

  it('[Cross-check] com 3 telas sobra metade da linha de baixo — a área coberta é 3/4 da tela', () => {
    let area = 0;
    for (let i = 0; i < 3; i++) { const r = screenRect(i, 3); area += pct(r.W) * pct(r.H); }
    expect(area).toBe(0.75 * 100 * 100);
  });

  it('[Cross-check] nenhuma tela transborda a área visível (L+W ≤ 100 e T+H ≤ 100) em 1..4 jogadores', () => {
    for (let n = 1; n <= 4; n++) {
      for (let i = 0; i < n; i++) {
        const r = screenRect(i, n);
        expect(pct(r.L) + pct(r.W)).toBeLessThanOrEqual(100);
        expect(pct(r.T) + pct(r.H)).toBeLessThanOrEqual(100);
      }
    }
  });

  it('[Interface] os quatro campos saem prontos para o CSS (sufixo %)', () => {
    const r = screenRect(2, 4);
    for (const v of [r.L, r.T, r.W, r.H]) expect(v.endsWith('%')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// screenCount — quantas telas montar
// ---------------------------------------------------------------------------------------------

describe('ui/hud · screenCount', () => {
  it('[Zero] com 0 jogadores ainda monta 1 tela (buildGameHud roda no boot, antes de players[])', () => {
    expect(screenCount(0)).toBe(1);
  });

  it('[One/Many] a partir de 1 jogador é uma tela por jogador', () => {
    expect(screenCount(1)).toBe(1);
    expect(screenCount(4)).toBe(4);
  });

  it('[Error] valor negativo não gera laço vazio: continua sendo 1 tela', () => {
    expect(screenCount(-3)).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------
// vphudHtml — markup do contador (moedas + poder)
// ---------------------------------------------------------------------------------------------

describe('ui/hud · vphudHtml', () => {
  it('[Interface] o objetivo INTEIRO entra: numerador e denominador saem dele, não de constante nenhuma', () => {
    // Era `vphudHtml(coinTarget = COIN_TARGET)` — um padrão posto no lugar de uma fronteira, e o nome que o
    // ADR-0027 usa como veredito do passo 4. Depois virou `vphudHtml(alvo)`, que matou a DEPENDÊNCIA e
    // deixou o assunto. Agora entra um `Objective`, e o HUD não sabe mais o QUE se junta.
    expect(vphudHtml(OBJ(0, 10), ICONE)).toContain('/ 10');
    expect(vphudHtml(OBJ(4, 10), ICONE)).toContain('>4</b>');
    expect(vphudHtml(OBJ(0, 3), ICONE)).toContain('/ 3');
  });

  it('[Interface] o ÍCONE é injetado — a engine não desenha mais a moeda no markup', () => {
    // O caso que prende a metade que era só vocabulário. Um ícone cravado passaria em tudo acima.
    expect(vphudHtml(OBJ(0, 10), '🧩')).toContain('>🧩<');
    expect(vphudHtml(OBJ(0, 10), '🧩')).not.toContain(ICONE);
  });

  it('[Right] o contador tem NOME ACESSÍVEL — e ele deixou de vir por MARKUP (issue #106)', () => {
    // A exigência não mudou: antes o contador era "3 / 10" e mais nada, e quem não vê a tela não tinha o que
    // ouvir. O que mudou é a PORTA. O nome vem de `Objective.name`, que é declarado pelo JOGO — e um jogo vive
    // hoje noutro repositório (ADR-0083), então o seu texto não é revisto por esta árvore.
    //
    // ⚠️ E ELE ENTRAVA NUM ATRIBUTO, que é o pior contexto: dentro de um elemento uma aspa é inofensiva;
    // dentro de `aria-label="…"` ela FECHA o atributo e o resto vira atributo — um `onmouseover` sem precisar
    // de uma única tag. `setAttribute` escapa por construção.
    const posto = [];
    const alvo = { setAttribute: (k, v) => posto.push([k, v]) };
    const raiz = { querySelector: (sel) => (sel === '.vphud-obj' ? alvo : null) };

    aplicarRotuloDoContador(raiz, OBJ(3, 10, 'palavras'));
    expect(posto).toHaveLength(1);
    expect(posto[0][0]).toBe('aria-label');
    expect(posto[0][1]).toContain('palavras');
  });

  it('[Zero] ⚠️ e o markup NÃO carrega mais o nome do jogo — nem escapado', () => {
    // A metade negativa, e é ela que impede a volta: enquanto o nome estiver fora da string, não há escape
    // para esquecer. Um caso que só afirmasse `setAttribute` deixaria passar uma versão que fizesse as duas.
    const html = vphudHtml(OBJ(3, 10, 'palavras'), ICONE);
    expect(html).not.toContain('palavras');
    expect(html).not.toContain('aria-label');
  });

  it('[Error] ⚠️ um jogo que devolve um NÃO-NÚMERO em `have` não escreve markup', () => {
    // `Objective.have` é `number` no tipo, e o tipo não atravessa a fronteira do pacote: um jogo em JavaScript
    // puro devolve o que quiser. «É um número» estar escrito no tipo é justamente o que faz esquecer.
    const html = vphudHtml({ ...OBJ(0, 10), have: '<img src=x onerror=alert(1)>' }, ICONE);
    expect(html).not.toContain('<img');
    expect(html).toContain('<b class="vphud-n">0</b>'); // falso, mas inofensivo
  });

  it('[Zero] sem o elemento do contador, aplicar o rótulo não lança', () => {
    expect(() => aplicarRotuloDoContador(null, OBJ(1, 2))).not.toThrow();
    expect(() => aplicarRotuloDoContador({ querySelector: () => null }, OBJ(1, 2))).not.toThrow();
  });

  it('[Interface] a classe do contador é a do OBJETIVO, não a do que este jogo junta', () => {
    // A asserção NEGATIVA que estava aqui ("não contém a classe antiga") tinha de escrever a palavra que o
    // módulo acabou de largar — e o gate de fixtures a acusou, com razão. A proteção contra a volta do nome
    // antigo mora onde tem de morar: em `engine-boundary`, que reprova QUALQUER linha de código de `ui/hud`
    // que fale de moeda. Aqui basta a afirmação positiva.
    expect(vphudHtml(OBJ(0, 10), ICONE)).toContain('class="vphud-obj"');
  });

  it('[Right] o HUD nasce com o `have` declarado e sem poder', () => {
    const html = vphudHtml(OBJ(0, 10), ICONE);
    expect(html).toContain('<b class="vphud-n">0</b>');
    expect(html).toContain('<span class="vphud-pw">—</span>');
  });

  it('[Interface] carrega os TRÊS ganchos que updateGameHud consulta (.vphud-n, .vphud-pw e .vphud-obj)', () => {
    const html = vphudHtml(OBJ(0, 10), ICONE);
    expect(html).toContain('class="vphud-n"');
    expect(html).toContain('class="vphud-pw"');
    expect(html).toContain('class="vphud-obj"');
  });
});

describe('ui/hud · contadorLabel', () => {
  it('[Right] nomeia o que se junta, e o nome vem do JOGO — não de uma tabela da engine', () => {
    expect(contadorLabel(OBJ(3, 10, 'palavras'))).toContain('palavras');
    expect(contadorLabel(OBJ(3, 10, 'contas'))).toContain('contas');
    expect(contadorLabel(OBJ(3, 10, 'estrelas'))).toContain('estrelas');
  });

  it('[Right] os dois números aparecem', () => {
    const txt = contadorLabel(OBJ(3, 10));
    expect(txt).toContain('3');
    expect(txt).toContain('10');
  });

  it('[Zero] objetivo zerado ainda produz frase, e não "undefined de undefined"', () => {
    expect(contadorLabel(OBJ(0, 0, 'itens'))).toMatch(/0.*0.*itens/);
  });
});

// ---------------------------------------------------------------------------------------------
// waitBadgeHtml — selo "aperte um botão para entrar"
// ---------------------------------------------------------------------------------------------

describe('ui/hud · waitBadgeHtml', () => {
  it('[One] o índice é 0-based mas o texto fala com o jogador em 1-based', () => {
    expect(waitBadgeHtml(0)).toContain('Jogador 1:');
    expect(waitBadgeHtml(3)).toContain('Jogador 4:');
  });

  it('[Interface] carrega a classe .vp-wait, que é por onde clearWaitingBadge acha e remove o selo', () => {
    expect(waitBadgeHtml(1)).toContain('class="vphud-quit vp-wait"');
  });

  it('[Right] o convite nomeia as DUAS entradas possíveis (teclado próprio ou controle livre)', () => {
    const html = waitBadgeHtml(1);
    expect(html).toContain('teclado');
    expect(html).toContain('controle livre');
  });

  it('🔴 o selo sai do DICIONÁRIO e não de um literal — e os três casos acima não distinguem os dois', async () => {
    /*
     * 🔴 ESTE CASO EXISTE PORQUE OS TRÊS DE CIMA FICAM VERDES COM O DEFEITO DE VOLTA. O dicionário activo
     * aqui é o pt, e a frase da chave é a MESMA que estava colada no módulo — logo «contém Jogador 1» não
     * separa «lê o dicionário» de «tem um literal em português». É a armadilha do gate coberto só por
     * dourado, e ela custou-me uma suposição errada neste mesmo item.
     *
     * 🎯 O que separa os dois é SUBSTITUIR a entrada: um literal não muda, uma chave muda. `registerDict`
     * escreve em `EXTRA`, que o `resolver` consulta ANTES do dicionário da engine (é assim que um jogo
     * sobrepõe qualquer chave, ADR-0083).
     *
     * ⚠️ E REPÕE NO FIM, porque `EXTRA` é estado de módulo e não há como desregistar: sem a reposição, a
     * sobreposição vazava para todo caso deste ficheiro que corresse depois — que é a mesma classe de
     * contaminação por ordem que já apanhei no crivo do idioma do cartão de pausa.
     */
    const { registerDict } = await import('../app/js/core/i18n.js');
    const pt = (await import('../app/js/i18n/pt.js')).default;
    const original = pt['hud.waitBadge'];
    expect(original, 'a chave saiu do dicionário pt; o caso mediria o nada').toBeTruthy();

    try {
      registerDict('pt', { 'hud.waitBadge': 'ENTRADA TROCADA {n}' });
      const html = waitBadgeHtml(2);
      expect(html, 'o selo ignorou o dicionário — o texto está colado no módulo').toContain('ENTRADA TROCADA 3');
      expect(html, 'o literal antigo continua lá').not.toContain('aperte um botão do SEU teclado');
    } finally {
      registerDict('pt', { 'hud.waitBadge': original });
    }
    expect(waitBadgeHtml(0), 'a reposição falhou e a sobreposição vaza para os outros casos').toContain('Jogador 1:');
  });
});

// ---------------------------------------------------------------------------------------------
// hudRowView — projeção do HUD de UM jogador
// ---------------------------------------------------------------------------------------------

describe('ui/hud · hudRowView', () => {
  it('[Zero] jogador recém-nascido: nada juntado, sem poder, sem selo de abandono, HUD visível', () => {
    const v = hudRowView({ activePower: 'off', quit: false }, POWERS, OBJ(0, 10));
    expect(v.have).toBe('0');
    expect(v.power).toBe('—');
    expect(v.quitHidden).toBe(true);
    expect(v.visibility).toBe('visible');
    expect(v.label).toContain('itens');
  });

  it('[Interface] o PROGRESSO vem do objetivo, e não mais do jogador', () => {
    // O caso que mede a mudança de fronteira: o mesmo jogador, dois objetivos, dois contadores. Enquanto o
    // número saía de `p.collected`, o HUD sabia que jogadores JUNTAM coisas — e um jogo de perguntas não.
    const pl = { activePower: 'off', quit: false };
    expect(hudRowView(pl, POWERS, OBJ(2, 10)).have).toBe('2');
    expect(hudRowView(pl, POWERS, OBJ(9, 10)).have).toBe('9');
  });

  it('[Right] poder conhecido vira o rótulo curto da tabela injetada', () => {
    expect(hudRowView({ activePower: 'fly', quit: false }, POWERS, OBJ(3, 10)).power).toBe('🎈 Voo');
  });

  it('[Interface] o resolvedor de poderes é INJETADO: o mesmo jogador rotula diferente com outro resolvedor', () => {
    const pl = { activePower: 'fly', quit: false };
    expect(hudRowView(pl, POWERS, OBJ(3, 10)).power).toBe('🎈 Voo');
    expect(hudRowView(pl, () => 'FLY', OBJ(3, 10)).power).toBe('FLY');
  });

  it('[Error] poder fora da tabela cai no travessão em vez de vazar a chave crua', () => {
    expect(hudRowView({ activePower: 'jetpack', quit: false }, POWERS, OBJ(1, 10)).power).toBe('—');
  });

  it('[Boundary] resolvedor que devolve VAZIO ainda vira travessão (o HUD nunca fica em branco)', () => {
    // Este caso dizia "tabela vazia" e reprovou quando a tabela virou função — e ao reprovar mostrou que a
    // mudança ia CUSTAR uma garantia: com o `|| '—'` movido para o injetor, um resolvedor que devolvesse ''
    // deixaria o campo do poder em branco na tela. A guarda voltou para o `hudRowView`, onde ela não depende
    // de todo consumidor futuro se lembrar dela.
    expect(hudRowView({ activePower: 'fly', quit: false }, () => '', OBJ(1, 10)).power).toBe('—');
  });

  it('[Many] o contador NÃO é limitado ao alvo: passar de 10/10 mostra 12', () => {
    expect(hudRowView({ activePower: 'off', quit: false }, POWERS, OBJ(12, 10)).have).toBe('12');
  });

  it('[Right] quem desistiu perde o contador (visibility hidden) e ganha o selo (hidden=false)', () => {
    const v = hudRowView({ activePower: 'fly', quit: true }, POWERS, OBJ(5, 10));
    expect(v.have).toBe('5');
    expect(v.power).toBe('🎈 Voo');
    expect(v.quitHidden).toBe(false);
    expect(v.visibility).toBe('hidden');
  });

  it('[Cross-check] selo e contador são sempre opostos: quitHidden === (visibility === "visible")', () => {
    for (const quit of [false, true]) {
      const v = hudRowView({ activePower: 'off', quit }, POWERS, OBJ(0, 10));
      expect(v.quitHidden).toBe(v.visibility === 'visible');
    }
  });

  it('[Exercise] projetar não mexe no jogador (o HUD é leitor, o loop de jogo é o dono do estado)', () => {
    const pl = { activePower: 'superjump', quit: false };
    const obj = OBJ(4, 10);
    hudRowView(pl, POWERS, obj);
    expect(pl).toEqual({ activePower: 'superjump', quit: false });
    expect(obj).toEqual(OBJ(4, 10)); // nem no objetivo: projetar é LER
  });
});
