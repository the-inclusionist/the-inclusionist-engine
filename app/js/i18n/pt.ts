// SPDX-License-Identifier: GPL-3.0-or-later
// Locale pt-BR — idioma base (import ESTÁTICO em core/i18n.ts → boot síncrono). Ver docs/plano-i18n.md.
// A UI em pt é extraída em lotes; en/es caem no fallback pt até serem completados (Etapa 4).
const pt: Record<string, string> = {
  // ===================== ANÚNCIOS DE LEITOR DE TELA (`sr.*`) =====================
  // A MOLDURA TRADUZ; O CONTEÚDO NÃO. Tudo o que entra por `{param}` atravessa sem tradução — nome de jogador,
  // número de telas, e sobretudo CONTEÚDO DE CURRÍCULO (palavra, sílaba, letra, cela braille). O currículo de
  // alfabetização é específico da língua: soletração, grafema↔fonema e a psicogênese de Ferreiro não se traduzem,
  // reescrevem-se por idioma (pilar 3 do ADR-0010). Chave nova que embuta conteúdo de currículo é bug.
  'sr.pad.mapSaved': 'Mapeamento salvo para: {id}.',
  'sr.pad.assigned': 'Controle associado ao Jogador {n}. O teclado continua funcionando.',
  'sr.title.waitP1': 'Aguarde o Jogador 1 escolher o jogo.',
  'sr.player.entered': 'Jogador {n} entrou!',
  'sr.print.on': 'Modo Print: veja a tela sem menus. Aperte qualquer botão para voltar.',
  'sr.player.pressToJoin': 'Jogador {n}: aperte um botão para entrar.',
  'sr.libras.loading': 'Intérprete de Libras ainda carregando — tente de novo em instantes.',
  'sr.eyes.loadFailed': 'WebGazer não carregou.',
  'sr.eyes.calibrate': 'Jogar com os olhos: olhe pela tela e clique em alguns pontos para calibrar. Olhar esquerda/direita anda; olhar para cima pula.',
  'sr.eyes.needsInternet': 'Não foi possível carregar o WebGazer (precisa de internet no 1º uso).',
  'sr.typo.font': 'Tipografia: {fam}.',
  'sr.visual.contrast': 'Alto contraste: {v}.',
  'sr.visual.lq': 'Realce de contraste: {v}.',
  'sr.gate.open': 'Portão aberto!',
  'sr.key.taken': '{who}pegou a chave. Toque no portão para abri-lo.',
  'sr.key.returned': 'A chave voltou para o lugar de origem.',
  'sr.power.swapHint': '{msg} (Trocar poder cicla entre os coletados.)',

  'sr.round.multi': '{n} jogadores, cada um na sua tela. Corram pelas moedas.',
  'sr.round.somasub': 'Modo Soma-Sub. Toque nas figuras e resolva as contas.',
  'sr.round.silabas': 'Modo Sílabas. Toque nas letras e monte as palavras.',
  'sr.round.ludico': 'Nova rodada. Colete 10 moedas.',

  'sr.screens.mobileOnly': 'No celular o jogo roda em uma tela só.',
  'sr.screens.alreadyN': '{n} telas já ativas.',
  'sr.screens.already1': '1 tela.',
  'sr.screens.wontFitN': 'Não cabem {n} telas nesta janela — cada tela precisa de ao menos 640×360. Aumente a janela ou use tela cheia.',
  'sr.screens.wontFitOneMore': 'Não cabe mais uma tela nesta janela — cada tela precisa de ao menos 640×360. Aumente a janela ou use tela cheia.',
  'sr.screens.activeN': '{n} telas ativas.',
  'sr.screens.newRoundN': '{n} telas ativas — nova rodada.',
  'sr.screens.newRound1': '1 tela — nova rodada.',
  'sr.screens.maxPlayers': 'Já são 4 jogadores.',

  'sr.player.restarted': 'Jogador {n} recomeçou nesta tela.',
  'sr.player.joined': 'Jogador {n} entrou no jogo em andamento.',
  'sr.player.quit': 'Jogador {n} abandonou o jogo.',

  // Objetivo no HUD (texto em DOM, mesma árvore de decisão do anúncio de rodada)
  'hud.objective.multi': '{n} jogadores — corrida pelas {alvo} moedas',
  'hud.objective.somasub': 'Resolva 10 contas',
  'hud.objective.silabas': 'Monte 10 palavras',
  'hud.objective.ludico': 'Colete 10 moedas',

  // Chrome / navegação
  'skip.toGame': 'Pular para o jogo',
  'menu.ludico': 'Lúdico',
  'menu.alfabetizacao': 'Alfabetização',
  'menu.matematica': 'Matemática',

  // Tela de título
  'title.byline': 'by Prof. José Rocha',
  'title.wait': 'Aguarde o Jogador 1 escolher o jogo',

  // Vitória
  'win.title': '🎉 Você coletou as 10 moedas!',
  'win.again': 'Jogar de novo',

  // Menu de pausa (por tela — buildScreenPause). O botão de letra (ABC/abc/Braille) é dinâmico, fica fora.
  'pause.title': 'Pausado',
  'pause.resume': '▶ Continuar',
  'pause.tipo': '🔤 Tipografia',
  'pause.addplayer': '👥 Adicionar jogador',
  'pause.audio': '🦻 Acessibilidade auditiva',
  'pause.motora': '♿ Acessibilidade motora',
  'pause.anim': '🎞 Sensibilidade visual',
  'pause.visual': '🎨 Acessibilidade visual',
  'pause.empatia': '🫂 Modo empatia',
  'pause.ajuda': '❓ Ajuda',
  'pause.print': '📷 Print (ver a tela)',
  'pause.quit': '🚪 Sair do jogo',

  // Acessibilidade (leitores de tela)
  'a11y.gameRegion': 'Área de jogo. Mova com A e D ou setas; pule com L ou Espaço; suba e desça escadas (e nade na água) com W e S ou setas; corra com P ou Shift. Colete 10 moedas.',
  'game.instructions': 'Mova o personagem pela caverna e colete 10 moedas. Sem limite de tempo. Controles: A e D ou setas movem; L ou Espaço pulam; W e S (ou setas cima/baixo) sobem/descem escadas e nadam; P ou Shift correm.',

  // Controles de toque — rótulos das 9 posições e das 9 ações mapeáveis (painel #touchcfg) e os anúncios.
  // Rótulo é MOLDURA inteira: em inglês "(cima)" vira "(up)" e a seta fica onde está, então a seta viaja
  // dentro da tradução em vez de ser concatenada fora dela.
  'touch.slot.up': 'Direcional ↑ (cima)',
  'touch.slot.down': 'Direcional ↓ (baixo)',
  'touch.slot.left': 'Direcional ← (esquerda)',
  'touch.slot.right': 'Direcional → (direita)',
  'touch.slot.start': 'START (enter)',
  'touch.slot.b0': 'Botão 0 (baixo)',
  'touch.slot.b1': 'Botão 1 (direita)',
  'touch.slot.b2': 'Botão 2 (esquerda)',
  'touch.slot.b3': 'Botão 3 (cima)',
  'touch.slot.fallback': 'Botão',
  'touch.act.left': 'Andar à esquerda',
  'touch.act.right': 'Andar à direita',
  'touch.act.up': 'Subir / escada',
  'touch.act.down': 'Descer / escada',
  'touch.act.jump': 'Pular',
  'touch.act.run': 'Correr / interagir',
  'touch.act.especial': 'Especial',
  'touch.act.swap': 'Trocar poder',
  'touch.act.pause': 'Pausar (START)',
  'touch.dir.cross': 'cruz (D-pad)',
  'touch.dir.stick': 'analógico',
  'sr.touch.slotSet': '{slot}: {acao}.',
  'sr.touch.dirSet': 'Direcional: {tipo}.',
  'sr.touch.presetChild': 'Controles no tamanho de mão de criança (6 a 12 anos).',
  'sr.touch.presetAdult': 'Controles no tamanho de mão de adulto.',
};
export default pt;
