// SPDX-License-Identifier: AGPL-3.0-or-later
// UM AJUSTE QUE MUDA SEM O DIZER É INVISÍVEL PARA QUEM USA LEITOR DE TELA.
//
// ========================= O DEFEITO QUE ISTO EXISTE PARA NÃO SE REPETIR =========================
// Em 2026-09-08 o `#opt-modocego` do painel de áudio estava MUDO. Os cinco irmãos dele anunciavam (som, TTS,
// divisor da bengala, índice de menu, saída de áudio) e ele não — ele só PARECIA anunciar porque um cartucho
// o fazia a partir do próprio `setModoCego`, e o painel herdava o efeito de graça.
//
// ⚠️ E O SILÊNCIO SÓ FICOU ALCANÇÁVEL QUANDO O CAMPO GANHOU PADRÃO DA ENGINE. Enquanto `setModoCego` era
// OBRIGATÓRIO, todo consumidor tinha de fornecer um setter, e o do jogo de plataforma falava. No instante em
// que o campo passou a opcional — com um padrão que grava, persiste e emite, mas NÃO fala —, um jogo que não
// o injecta ficou com um alternador que muda o estado e não o diz.
//
// ========================= A REGRA, E POR QUE ELA É GATEÁVEL =========================
// Foram vistos os vizinhos do módulo consertado («uma causa achada não é a causa toda») e há mais TRÊS
// ajustes na mesma forma: perda auditiva, um-botão e cadeira de rodas. O anúncio dos três mora no setter
// INJETADO — o `ui/settings-empathy` escreve a dependência sem a notar, no comentário do botão de repor:
// «Cada setter já é idempotente e ANUNCIA SOZINHO ao mudar».
//
// 📌 HOJE NÃO HÁ SILÊNCIO NENHUM: os três continuam OBRIGATÓRIOS, logo todo consumidor fornece um setter.
// O que este ficheiro afirma é a única metade que uma máquina consegue ver: **enquanto o anúncio morar no
// setter injetado, o campo não pode virar opcional**. Tornar um deles opcional exige, NO MESMO COMMIT, mover
// o anúncio para o painel — e é isso que a mensagem de reprovação diz a quem lá chegar.
//
// ⚠️ O QUE ISTO NÃO PROVA, dito à frente: que os painéis anunciam. Isso são casos de comportamento, e vivem
// nos ficheiros dos painéis (o do modo cego está em `settings-audio.browser`). Aqui só se guarda a PORTA por
// onde o defeito de hoje entrou.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formaDe } from '../scripts/shape-surface.mjs';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const forma = formaDe(join(RAIZ, 'app', 'js'));

/** Onde o anúncio de cada ajuste mora HOJE, medido nos dois lados em 2026-09-08. */
const ANUNCIO_NO_SETTER_INJETADO = [
  {
    modulo: 'ui/settings-empathy.ts', tipo: 'interface EmpathySettingsCtx', campo: 'setHearingLoss',
    onde: 'game-platformer/main.ts:568 — `sr.empathy.hearingOn/Off`',
  },
  {
    modulo: 'ui/settings-empathy.ts', tipo: 'interface EmpathySettingsCtx', campo: 'setOneButton',
    onde: 'game-platformer/main.ts:1664 — `sr.motor.oneButtonOn/Off`',
  },
  {
    modulo: 'ui/settings-empathy.ts', tipo: 'interface EmpathySettingsCtx', campo: 'setWheelchair',
    onde: 'game-platformer/main.ts:1667+ — depois dos efeitos',
  },
];

const membros = (modulo, tipo) => forma[modulo]?.[tipo] ?? [];

describe('um ajuste não pode ficar mudo ao ganhar padrão da engine', () => {
  it('⚠️ [Interface] o crivo está VIVO — lê os tipos de verdade', () => {
    // Sem isto, uma lista vazia faria os casos abaixo passarem por não terem nada que examinar.
    expect(membros('ui/settings-empathy.ts', 'interface EmpathySettingsCtx').length).toBeGreaterThan(10);
    expect(membros('ui/pause-icons.ts', 'interface PauseIconsCtx').length).toBeGreaterThan(10);
  });

  it('⚠️ [Zero] os TRÊS cujo anúncio mora no cartucho continuam OBRIGATÓRIOS', () => {
    const opcionais = ANUNCIO_NO_SETTER_INJETADO.filter(
      (a) => membros(a.modulo, a.tipo).includes(`${a.campo}?`),
    );
    expect(
      opcionais.map((a) => `${a.campo} (anúncio em ${a.onde})`),
      'ESTE CAMPO VIROU OPCIONAL E O ANÚNCIO FICOU NO CARTUCHO. Um jogo que não injecta o setter passa a ter '
      + 'um alternador que muda o estado sem o dizer — invisível para quem usa leitor de tela. Mova o `srSay` '
      + 'para o PAINEL no MESMO commit, ponha-lhe um caso, e tire a entrada da lista deste ficheiro. Foi '
      + 'exactamente isto que aconteceu ao `#opt-modocego` em 2026-09-08.',
    ).toEqual([]);
  });

  it('📌 [Right] e o modo cego é o exemplo RESOLVIDO — opcional porque o anúncio mudou de casa', () => {
    // A regra tem saída, e ela foi tomada: `setModoCego` é opcional nos três pontos que o pediam, e o painel
    // de áudio passou a anunciar (caso em `settings-audio.browser.test.js`). Sem este caso, a regra leria-se
    // como «nunca torne nada opcional», que não é o que ela diz.
    expect(membros('ui/pause-icons.ts', 'interface PauseIconsCtx')).toContain('setModoCego?');
    expect(membros('ui/settings-audio.ts', 'interface SettingsAudioCtx')).toContain('setModoCego?');
    // E o campo NÃO está na lista acima — porque o anúncio já não mora no cartucho.
    expect(ANUNCIO_NO_SETTER_INJETADO.some((a) => a.campo === 'setModoCego')).toBe(false);
  });

  it('[Interface] a lista não tem ÓRFÃOS — entrada que nomeia campo inexistente', () => {
    const orfaos = ANUNCIO_NO_SETTER_INJETADO.filter((a) => {
      const m = membros(a.modulo, a.tipo);
      return !m.includes(a.campo) && !m.includes(`${a.campo}?`);
    });
    expect(orfaos.map((a) => a.campo), 'entrada a descrever um campo que já não existe').toEqual([]);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · tornando `setHearingLoss` opcional no `EmpathySettingsCtx` (arvore REAL) -> reprova "os TRES continuam
//     OBRIGATORIOS", nomeando o campo e onde o anuncio mora. E o defeito de hoje a tentar repetir-se.
//   · tirando `setModoCego?` do `PauseIconsCtx` (voltando a obrigatorio) -> reprova o caso do exemplo
//     RESOLVIDO. Sem ele a regra leria-se como «nunca torne nada opcional», que nao e o que ela diz — e uma
//     regra sem saida e uma regra que alguem desliga.
//   · pondo na lista um campo que nao existe -> reprova o ORFAO. Sem ele a lista apodrece e passa a descrever
//     um repositorio que ja nao ha.
//   · fazendo `formaDe` devolver `{}` -> reprova o caso do VACUO, e so ele: os outros tres passariam por nao
//     terem nada que examinar.
