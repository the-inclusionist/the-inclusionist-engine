// SPDX-License-Identifier: AGPL-3.0-or-later
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
  // A RECICLAGEM (ADR-0049 §1: a boa ação vale um PONTO, e ponto não move barra nenhuma). As quatro cores
  // são conteúdo curricular — Resolução CONAMA 275/2001 —, então a fala DIZ a cor, e não só "certo/errado".
  'sr.lixo.soltou': 'Você soltou: {o}.',
  'sr.lixo.solta': 'Aqui não se joga lixo. Você deixou cair na placa.',
  'sr.lixo.barreira': 'A placa não deixa o lixo passar.',
  'lixo.obj.papel': 'caixa de papelão',
  'lixo.obj.plastico': 'garrafa PET',
  'lixo.obj.vidro': 'pote de vidro',
  'lixo.cor.azul': 'azul',
  'lixo.cor.vermelha': 'vermelha',
  'lixo.cor.amarela': 'amarela',
  'lixo.cor.verde': 'verde',
  'sr.print.on': 'Modo Print: veja a tela sem menus. Aperte qualquer botão para voltar.',
  'sr.player.pressToJoin': 'Jogador {n}: aperte um botão para entrar.',
  // O selo VISÍVEL da tela sem dono (`ui/hud.waitBadgeHtml`). Parece-se com a linha acima e não é a mesma: a
  // de cima é para quem ESCUTA, esta diz QUAL botão, porque quem a lê tem outras pessoas à volta.
  'hud.waitBadge': 'Jogador {n}: aperte um botão do SEU teclado ou de um controle livre para entrar',
  'sr.libras.loading': 'Intérprete de Libras ainda carregando — tente de novo em instantes.',
  'sr.eyes.loadFailed': 'WebGazer não carregou.',
  'sr.eyes.calibrate': 'Jogar com os olhos: olhe pela tela e clique em alguns pontos para calibrar. Olhar esquerda/direita anda; olhar para cima pula.',
  'sr.eyes.needsInternet': 'O controle pelo olhar ainda não chegou a este aparelho: ele desce na primeira vez que o jogo abre com internet.',
  'sr.typo.font': 'Tipografia: {fam}.',
  'sr.icon.velocidade': 'Velocidade do jogo: {pct}%.',
  'sr.visual.contrast': 'Alto contraste: {v}.',
  'sr.visual.lq': 'Realce de contraste: {v}.',


  'sr.screens.wontFitOneMore': 'Não cabe mais uma tela nesta janela — cada tela precisa de ao menos 640×360. Aumente a janela ou use tela cheia.',
  'sr.screens.maxPlayers': 'Já são 4 jogadores.',


  // Objetivo no HUD (texto em DOM, mesma árvore de decisão do anúncio de rodada)
  // A MOLDURA do contador do HUD. O nome do objetivo atravessa por `{nome}` e NÃO se traduz aqui: quem
  // o declara é o jogo (campo 5 do contrato). Sem artigo de propósito — assim a frase serve a qualquer
  // gênero gramatical, e o `gender` do Speakable fica para as frases que precisam concordar.
  'hud.contador': '{have} de {need} {nome}',
  'hud.numero': '{nome}: {valor}',
  'hud.barra': '{nome}: {azuis} de primeira, {verdes} com ajuda, {vermelhos} sem acertar',
  'hud.barra.sobe': 'o nível sobe',
  'hud.barra.desce': 'o nível desce',
  // O NOME do que este jogo junta. Currículo não se traduz (pilar 3), mas "moedas" não é currículo — é um
  // substantivo comum da interface, e a criança que joga em inglês tem de ouvir "coins". Por isso o nome
  // atravessa por `{nome}` JÁ RESOLVIDO pelo jogo, e a chave mora aqui.
  // O rótulo do botão dinâmico do menu de pausa. `{nome}` é o nome do nível, que o JOGO resolve — currículo
  // não se traduz (pilar 3); a MOLDURA, sim, e é ela que mora aqui.
  'pause.nivel': '📚 Nível {n} · {nome}',
  // LEGENDAS DOS EARCONS (item 19). Eram texto cru dentro de `platform/audio` — nove frases numa camada de
  // engine, invisíveis ao gate de i18n do `main.js`. É o que a criança SURDA lê no lugar do som: deixá-las em
  // português num build em inglês tirava dela exatamente a informação que a legenda existe para dar.

  // Chrome / navegação
  'skip.toGame': 'Pular para o jogo',

  // Tela de título

  // Vitória

  // Menu de pausa (por tela — buildScreenPause). O botão de letra (ABC/abc/Braille) é dinâmico, fica fora.
  'pause.title': 'Pausado',
  'pause.resume': 'Voltar ao jogo',
  // A palavra da PAUSA RÁPIDA, ao centro da tela congelada (ADR-0155). Curta: é para ler de relance.
  'pause.quick': 'PAUSADO',
  // A legenda do rodapé da pausa rápida (errata do ADR-0155), nas palavras do Dev.
  'pause.quick.legenda': '2: confirmar · 3: voltar · 4: menu · START: voltar ao jogo',
  'pause.card.legenda': '2: confirmar · 3: voltar',
  'pause.acessibilidade': 'Acessibilidade',
  'pause.options': 'Configurações de inclusão',
  'pause.opcoesdojogo': 'Opções do jogo',
  'pause.pmback': 'Voltar',
  'pause.cardAria': 'Menu de pausa do jogador {n}',
  // O sufixo do título do cartão, só em multijogador. Era português cru colado no markup de `ui/pause-icons`.
  'pause.cardSeat': ' · Jogador {n}',
  // A TELA DE AJUDA (ADR-0147 §4): qual botão faz o quê, neste jogo, no teclado desta criança. A moldura mora
  // aqui; as PALAVRAS de cada posição são do jogo e chegam pelo `preset` (ADR-0085).
  'menu.help': 'Ajuda',
  'help.grupo.rotulo': 'Os botões deste jogo',
  // O que a linha diz quando o teclado não alcança aquela posição. É informação e não erro: quem joga só com
  // controle ou só com o dedo tem posições sem tecla, e dizê-lo é melhor do que mostrar uma linha vazia.
  'help.noKey': 'sem tecla',
  /* --- CATÁLOGO DE ATIVIDADES: só o que NÃO é alfabetização. As cinco de alfabetização seguem cruas em
     pt-BR no `educational/activities-registry`, porque a palavra e a sílaba SÃO a matéria (pilar 3). --- */
  'act.ludico.nome': 'Coletar 10 moedas',
  'act.mat1.nome': 'Quantidade',
  'act.mat1.d': 'Conte as bolinhas e escolha o número certo (1 a 9).',
  'act.mat2.nome': 'Soma fácil',
  'act.mat2.d': 'Somas com parcelas de 0 a 5.',
  'act.mat3.nome': 'Soma e Subtração 1',
  'act.mat3.d': 'Contas que dá para fazer nos dedos (até 10).',
  'act.mat4.nome': 'Soma e Subtração 2',
  'act.mat4.d': 'Guarde um número na cabeça e opere o outro nos dedos (até 20).',
  'act.mat5.nome': 'Tabuada',
  'act.mat5.d': 'Escolha os números e treine a multiplicação.',
  'act.mat6.nome': 'Divisão',
  'act.mat6.d': 'Escolha os números e treine a divisão.',
  'act.fr2.nome': 'Soma e subtração com meios',
  'act.fr2.d': 'Some e subtraia meios.',
  'act.fr3.nome': 'Soma e subtração com terços',
  'act.fr3.d': 'Some e subtraia terços.',
  'act.fr42.nome': 'Soma e subtração com quartos e meios',
  'act.fr42.d': 'Some e subtraia quartos e meios.',
  'act.fr5.nome': 'Soma e subtração com quintos',
  'act.fr5.d': 'Some e subtraia quintos.',
  'act.fr632.nome': 'Soma e subtração com sextos, terços e meios',
  'act.fr632.d': 'Some e subtraia sextos, terços e meios.',
  'act.fr2a6.nome': 'Soma e subtração com frações de meio a sextos',
  'act.fr2a6.d': 'Some e subtraia frações de meios a sextos.',
  'pause.tipo': 'Tipografia',
  'pause.addplayer': 'Número de jogadores',
  'pause.audio': 'Acessibilidade auditiva',
  'pause.som': 'Conforto auditivo',
  'pause.motora': 'Acessibilidade motora',
  'pause.anim': 'Sensibilidade visual',
  'pause.visual': 'Acessibilidade visual',
  'pause.empatia': 'Modo empatia',
  'pause.ajuda': 'Ajuda — Como jogar',
  'pause.print': 'Print (ver a tela)',
  'pause.quit': 'Sair do jogo',
  'pause.motivo': 'Este jogo não usa esta opção.',
  'pause.motivo.ajuda': 'Este jogo ainda não disse o que cada botão faz.',
  'pause.motivo.addplayer': 'Quem decide quantos jogadores podem jogar é o jogo.',
  'pause.motivo.opcoesdojogo': 'Este jogo não tem opções próprias.',

  // Acessibilidade (leitores de tela)

  // Controles de toque — rótulos das 9 posições e das 9 ações mapeáveis (painel #touchcfg) e os anúncios.
  // Rótulo é MOLDURA inteira: em inglês "(cima)" vira "(up)" e a seta fica onde está, então a seta viaja
  // dentro da tradução em vez de ser concatenada fora dela.
  'touch.slot.up': 'Direcional ↑ (cima)',
  'touch.slot.down': 'Direcional ↓ (baixo)',
  'touch.slot.left': 'Direcional ← (esquerda)',
  'touch.slot.right': 'Direcional → (direita)',
  'touch.slot.start': 'START (enter)',
  'touch.start': 'START',
  'touch.nome.up': 'Cima',
  'touch.nome.down': 'Baixo',
  'touch.nome.left': 'Esquerda',
  'touch.nome.right': 'Direita',
  'touch.select': 'SELECT',
  'touch.slot.b0': 'Botão 0 (baixo)',
  'touch.slot.b1': 'Botão 1 (direita)',
  'touch.slot.b2': 'Botão 2 (esquerda)',
  'touch.slot.b3': 'Botão 3 (cima)',
  'touch.slot.bl2': 'L2 (gatilho esquerdo)',
  'touch.slot.bl1': 'L1 (ombro esquerdo)',
  'touch.slot.br2': 'R2 (gatilho direito)',
  'touch.slot.br1': 'R1 (ombro direito)',
  'touch.slot.fallback': 'Botão',
  'touch.act.left': 'Andar à esquerda',
  'touch.act.right': 'Andar à direita',
  'touch.act.up': 'Subir / escada',
  'touch.act.down': 'Descer / escada',
  'touch.act.jump': 'Pular',
  'touch.act.run': 'Correr / interagir',
  'touch.act.especial': 'Especial',
  'touch.act.swap': 'Trocar poder',
  'touch.dir.cross': 'cruz (D-pad)',
  'touch.dir.stick': 'analógico',
  'sr.touch.slotSet': '{slot}: {acao}.',
  // ⚠️ SEM O NOME DA POSIÇÃO, de propósito: é uma que este jogo não nomeia, e o id interno (`action3`)
  // não pode chegar a uma criança (ADR-0074). O anúncio EXISTE na mesma — quem navega por ouvido precisa de
  // saber que a escolha aterrou. Gémeo do `sr.ctrl.keyTakenHereUnnamed`, que resolveu o mesmo em `7742ac0`.
  'sr.touch.slotSetUnnamed': '{slot}: definido.',
  'sr.touch.dirSet': 'Direcional: {tipo}.',
  'sr.touch.presetChild': 'Controles no tamanho de mão de criança (6 a 12 anos).',
  'sr.touch.presetAdult': 'Controles no tamanho de mão de adulto.',

  // Ações remapeáveis (painel de controles + tela de Ajuda) e os anúncios do fluxo de captura de tecla.
  'act.left': 'Esquerda',
  'act.right': 'Direita',
  'act.up': 'Subir / escada',
  'act.down': 'Descer / escada',
  'act.run': 'Correr / interagir',
  'act.jump': 'Pular',
  'act.swap': 'Trocar poder',
  'act.especial': 'Especial',
  'key.space': 'Espaço',
  'ctrl.change': 'Alterar',
  'ctrl.pressing': 'Pressione…',
  'ctrl.editingYours': 'Editando o seu controle — modo {modo}.',
  'ctrl.mode.one': '1 jogador',
  'ctrl.mode.many': '{n} jogadores',
  'ctrl.changeKeyAria': 'Alterar tecla de {acao} do Jogador {n}',
  'sr.ctrl.pressNewKey': 'Pressione a nova tecla para {acao} do Jogador {n}, ou Esc para cancelar.',
  'sr.ctrl.keyTaken': 'Essa tecla já é do Jogador {n}. Escolha outra, ou Esc para cancelar.',
  'sr.ctrl.keyTakenHere': 'Essa tecla já é de {acao}. Escolha outra, ou Esc para cancelar.',
  // ⚠️ SEM O NOME DA POSIÇÃO, de propósito: ela é uma que este jogo não nomeia, e o id interno (`action2`)
  // não pode chegar a uma criança (ADR-0074). A frase diz a verdade que interessa — a tecla está ocupada.
  'sr.ctrl.keyTakenHereUnnamed': 'Essa tecla já está em uso neste controle. Escolha outra, ou Esc para cancelar.',
  'sr.ctrl.reset': 'Controles restaurados ao padrão.',

  // Painel de áudio (#audio) — saídas por jogador, som/narração, bengala, motores de voz.
  'audio.playerN': 'Jogador {n}',
  'audio.sinkShared': 'Padrão (compartilhado)',
  'audio.sinkFallback': 'Saída {n}',
  'audio.sinksHint': 'Clique em Detectar (pede permissão de áudio para listar os aparelhos).',
  'audio.sinksUnsupported': 'Este navegador não suporta troca de saída (ex.: Safari/iOS).',
  'audio.voiceSample': 'Olá! Esta é a voz da narração do Inclusionista. Um, dois, três, testando.',
  // Os NOMES dos motores são nomes próprios e ficam; o que traduz é a explicação entre parênteses.
  'tts.engine.webspeech': 'Voz do navegador (Web Speech)',
  'tts.engine.piper': 'Piper (neural, offline) — baixa no 1º uso',
  'tts.engine.kokoro': 'Kokoro-82M (neural) — baixa no 1º uso',
  'tts.engine.kitten': 'Kitten (neural) — baixa no 1º uso',
  'tts.engine.espeak': 'eSpeak NG (embutido)',
  'sr.audio.sinkChanged': 'Jogador {n} — saída de áudio trocada.',
  'sr.audio.sinkDefault': 'Jogador {n} — saída de áudio padrão.',
  'sr.audio.soundOn': 'Som ligado.',
  'sr.audio.soundOff': 'Som desligado.',
  'sr.audio.ttsOn': 'Narração ligada.',
  'sr.audio.ttsOff': 'Narração desligada.',
  'sr.audio.ttsOnSpoken': 'Narração por voz ligada.',
  'sr.audio.canePerBlock': 'Bengala: uma batida por bloco pisado.',
  'sr.audio.caneHalfBlock': 'Bengala: uma batida a cada meio bloco pisado.',
  'sr.audio.engineSet': 'Motor de voz: {motor}.',
  'sr.audio.voicePicked': 'Voz selecionada.',
  'sr.audio.testingVoice': 'Testando a voz selecionada.',

  // Barra de icones de acessibilidade (menu de pausa e splash) + os niveis que ela cicla.
  'icon.blind': 'Modo cego',
  'icon.tts': 'Narração por voz',
  'icon.libras': 'Modo pessoa surda',
  'icon.tea': 'Modo TEA',
  'icon.altmove': 'Teclas de alternância',
  'icon.contrast': 'Alto contraste',
  'icon.cvd': 'Correção de daltonismo',
  'icon.face': 'Webcam — rosto',
  'icon.eyes': 'Webcam — olhos',
  'icon.voice': 'Comando de voz',
  // O 11.º ícone (ADR-0149): um ciclo de tipografia — muda a CAIXA e a FACE de uma vez, sem sair da tela.
  // ADR-0151: o ciclo de «leitura e tipografia» virou o ciclo de COMUNICAÇÃO (vai ganhar ARASAAC e PCS).
  'icon.tipografia': 'Comunicação',
  'icon.velocidade': 'Velocidade do jogo',
  'icon.velocidade.valor': '{pct}%',
  'icon.blind.dica': 'Joga-se pelo som: a navegação sonora diz o que a tela mostra.',
  'icon.tts.dica': 'O jogo lê em voz alta o que está escrito na tela.',
  'icon.libras.dica': 'Um intérprete de Libras mostra em sinais o que o jogo diz.',
  'icon.tea.dica': 'Deixa o jogo mais calmo ou em silêncio, para quem se sobrecarrega com estímulos.',
  'icon.altmove.dica': 'Um toque liga a tecla e outro a desliga: não é preciso segurar.',
  'icon.contrast.dica': 'Aumenta a diferença entre o que importa e o fundo: 3:1, 4,5:1 ou 7:1.',
  'icon.cvd.dica': 'Ajusta as cores para quem confunde vermelho e verde (protan, deutan) ou azul e amarelo (tritan).',
  'icon.face.dica': 'Controlar o jogo com movimentos do rosto, pela webcam.',
  'icon.eyes.dica': 'Controlar o jogo com o olhar, pela webcam.',
  'icon.voice.dica': 'Controlar o jogo falando.',
  'icon.tipografia.dica': 'Troca a forma das letras: caixa alta, letras mais legíveis ou a letra cursiva do seu país.',
  'icon.velocidade.dica': 'Deixa o jogo inteiro mais devagar: o tempo, o mundo e o momento de agir.',
  'icon.state': '{nome}: {v}',
  'icon.soon': '{nome}, em construção',
  'ui.soon': 'em breve',
  'state.on': 'ligado',
  'state.off': 'desligado',
  'calm.off': 'desligado',
  'calm.quiet': 'calmo',
  'calm.silent': 'silencioso',
  'cvd.off': 'desligado',
  'cvd.tricro': 'visão tricromática',
  'cvd.protan': 'protanopia',
  'cvd.deuter': 'deuteranopia',
  'cvd.tritan': 'tritanopia',
  'contrast.off': 'desligado',
  'contrast.3': '3:1',
  'contrast.45': '4,5:1',
  'contrast.7': '7:1',
  'visual.lq': 'Realce de contraste',
  'visual.lq.dica': 'Curva de tom na tela inteira: linear estica o contraste, quadrático realça sombras e altas-luzes, e misto fica entre os dois. Vale para todos os jogadores.',
  'menu.visual': 'Acessibilidade visual',
  'menu.empathy': 'Modo empatia',
  'empathy.grupo.rotulo': 'Simulações',
  'empathy.simulacao.dica': 'Mostra o jogo como o vê quem tem a deficiência escolhida.',
  'empathy.hearing': 'Simular perda auditiva',
  'empathy.hearing.dica': 'Sons fracos ficam abafados e os agudos são cortados, como ouve quem tem perda auditiva.',
  'empathy.onebtn': 'Simular um botão por vez',
  'empathy.onebtn.dica': 'Enquanto um botão está apertado, o jogo não aceita um segundo, como para quem não consegue apertar dois ao mesmo tempo.',
  'empathy.semforca': 'Simular sem força para segurar',
  'empathy.semforca.dica': 'Segurar um botão vale só um toque, como para quem não tem força para manter o botão apertado.',
  'empathy.select': 'Selecionar',
  'empathy.selected': '✓ Selecionado',
  'visual.grupo.rotulo': 'Ajustes visuais',
  'visual.cbsafe': 'Paleta segura para daltonismo',
  'visual.cbsafe.dica': 'Troca as cores dos menus e do HUD por uma paleta que se distingue em qualquer tipo de daltonismo (Okabe-Ito).',
  'lq.off': 'desligado',
  'lq.linear': 'linear',
  'lq.mixed': 'misto',
  'lq.quadratic': 'quadrático',
  'sr.icon.blindOn': 'Modo cego ligado.',
  'sr.icon.blindOff': 'Modo cego desligado.',
  'sr.icon.librasOn': 'Modo pessoa surda: Libras ligado.',
  'sr.icon.librasOff': 'Modo pessoa surda: Libras desligado.',
  'sr.icon.tea': 'Modo TEA: {v}.',
  'sr.icon.cvd': 'Correção de daltonismo: {v}.',
  'sr.icon.underConstruction': '{nome}: em construção — chega com os subsistemas de webcam/fala e o filtro de daltonismo.',
  'sr.icon.needsPrivateOutput': 'Só dá para mexer em som/TTS/modo cego com uma saída de áudio SÓ sua (não compartilhada). Escolha um dispositivo próprio em A12e auditiva.',
  'icon.tea.short': 'Modo TEA',
  'icon.cvd.short': 'Correção de daltonismo',
  'pause.iconBarAria': 'Atalhos de acessibilidade',

  // Menu de atividades (splash) — escolha de atividade, cenário, nº de jogadores e notações de fração.
  'sr.menu.index': '{n} de {m}',
  'sr.papel.botao': 'botão',
  'sr.papel.interruptor': 'interruptor',
  'sr.papel.lista': 'lista',
  'sr.papel.cursor': 'controle deslizante',
  'sr.papel.passos': 'seletor',
  'sr.papel.opcao': 'opção',
  'sr.estado.selecionado': 'selecionada',
  'sr.menu.indexOn': 'Posição na lista ligada.',
  'sr.menu.indexOff': 'Posição na lista desligada.',
  'sr.a11y.barEnter': 'Jogo pausado. Barra de acessibilidade. Use as direções para escolher e confirmar para ligar. Para voltar ao jogo, aperte voltar ou START.',
  'sr.a11y.barExit': 'De volta ao jogo.',
  'sr.a11y.quickPause': 'Jogo pausado. Para voltar ao jogo, aperte START.',
  'pad.glyph.cross': 'xis',
  'pad.glyph.circle': 'bola',
  'pad.glyph.square': 'quadrado',
  'pad.glyph.triangle': 'triângulo',
  'pad.wiz.step': '{n} de {total} — aperte: {acao}',
  'pad.wiz.mapped': 'Mapeados: {lista}',
  'pad.wiz.pressAny': 'Aperte QUALQUER botão no controle que deseja mapear.',
  'pad.wiz.detected': 'Controle novo detectado: {id}. O jogo pausou para você configurá-lo. SOLTE tudo para começar.',
  'pad.wiz.releaseAll': 'Controle: {id}. Agora SOLTE tudo.',
  'menu.legendSpoken': 'Botão {sim} para confirmar, botão {nao} para voltar.',
  'fnot.desc.dec': 'Liga números que sempre aparecem com uma casa decimal.',

  // Física (lava, ventosa-aranha), navegação sonora e o modo de demonstração.
  'sr.physics.spiderOn': 'Modo aranha! Engatinha em paredes e teto; contorna quinas. {botao} solta.',
  'sr.nav.noTargetNear': 'Nada por perto.',
  // O laço parou porque um quadro lançou (ADR-0054). Criança cega não vê tela congelada: sem esta frase,
  // «travou» e «está pensando» são o mesmo silêncio.
  'sr.laco.parou': 'O jogo parou por causa de um erro. Recarregue a página para jogar de novo.',
  // ===== O AVISO DE ALCANCE (issue #112, ADR-0079 §3) =====
  // O controle de tela tem nove lugares e o vocabulário passou a catorze. Num tablet de escola pública o
  // toque não é o caminho alternativo, é o único — e a criança que descobre no meio que não alcança uma ação
  // conclui que o jogo está partido. Estas frases existem para ela saber ANTES, e o que fazer.
  'reach.titulo': 'Este jogo usa {pedidas} ações.',
  'reach.curto': 'O {transporte} tem {lugares} lugares — não chegam para todas.',
  // ⚠️ Diz os DOIS números, porque é a diferença entre eles que a criança (ou quem a acompanha) pode
  // resolver. «Falta alguma coisa» manda procurar sem dizer o quê; «segura 2 e este jogo pede 3» diz que a
  // saída é outro controle, e diz porquê.
  'reach.naoSegura': 'O {transporte} segura {segura} botões de cada vez, e este jogo pede {pedidas} ao mesmo tempo.',
  // ⚠️ A RECUSA DA SIMULAÇÃO (#104 / ADR-0076). Ela diz um FACTO SOBRE A DEMONSTRAÇÃO e o caminho de volta —
  // nunca «desligue isso». Quem ligou o alto contraste ligou-o porque precisa dele para ver.
  'eixo.tema.titulo': 'Tema (contraste)',
  'eixo.tema.padrao': 'Tema padrão',
  'eixo.correcao.titulo': 'Correção de cor',
  'eixo.correcao.tricro': 'Visão tricromática',
  'viz.escolher': 'Selecionar',
  'viz.escolhido': '✓ Selecionado',
  'sim.indisponivel.alternancia': 'Para ver a simulação sem força para segurar, as teclas de alternância precisam estar desligadas: com elas ligadas, a demonstração mostraria o ajuste e não a dificuldade.',
  'sim.indisponivel.tema': 'Para ver a simulação, o tema precisa estar no padrão: por cima do alto contraste ela mostraria o que o tema faz, e não o que a deficiência faz.',
  'sim.indisponivel.correcao': 'Para ver a simulação, a correção de cor precisa estar em visão tricromática: de uma tela já corrigida ela não mostraria nem a deficiência nem a correção.',
  'sim.indisponivel.ambos': 'Para ver a simulação, o tema e a correção de cor precisam estar no padrão: por cima de um ajuste, a demonstração mostra o ajuste e não a deficiência.',
  'reach.ligue': 'Ligue {saida} e você joga com todas.',
  // Quando NADA resolveria: mandar ligar um controle seria mandar procurar o que não conserta.
  'reach.semSaida': 'Nenhum controle deste aparelho alcança todas. Dá para jogar assim mesmo, mas algumas ações vão ficar sem lugar.',
  'reach.continuar': 'Jogar assim mesmo',
  'reach.ou': ' ou ',
  'reach.nome.gamepad': 'controle',
  'reach.nome.teclado': 'teclado',
  'reach.nome.toque': 'controle de tela',

  // Molduras dos submenus de título e os nomes dos cenários.
  'menu.back': 'Voltar',
  'menu.alf': 'Alfabetização',
  'cen.cidade': 'Cidade',
  'cen.campo': 'Dia no Campo',
  'cen.cemiterio': 'Amanhecer no Campo',
  'cen.espaco': 'Noite no Campo',
  'cen.floresta': 'Floresta',

  // Narração por voz (TTS).
  'audio.noSystemVoices': '(sem vozes do sistema)',
  'sr.tts.engineNoLanguage': 'Este motor ainda não fala este idioma — por enquanto, use Piper (neural) ou a voz do navegador.',
  'sr.tts.noNeuralForLanguage': 'Ainda não há voz neural para este idioma — seguindo com a voz do navegador, que fala a língua certa.',
  // ⚠️ NÃO diz «para este idioma» (ADR-0094): sem motor neural nesta montagem, não há voz neural em idioma
  // nenhum, e a outra frase faria a criança trocar de idioma à procura do que não está lá.
  'sr.tts.neuralNotBundled': 'Esta versão do jogo não traz voz neural — seguindo com a voz do navegador.',
  'sr.tts.downloading': 'Baixando a voz neural (precisa de internet só no 1º uso)…',
  'sr.tts.progress': 'Voz neural: {pct}%.',
  'sr.tts.ready': 'Voz neural pronta, em {s} segundos.',
  'sr.tts.loadFailed': 'Não deu para carregar a voz neural (precisa de internet no 1º uso) — seguindo com a voz do navegador.',

  // Quiz — só a MOLDURA. O currículo de alfabetização (palavra, letra, sílaba, soletração, célula Braille) NÃO
  // entra aqui: é específico da língua e pede currículo próprio por idioma, não tradução. Ver o CLAUDE.md.
  'sr.quiz.ok': 'ok',
  'sr.blind.on': 'Modo cego ligado: bengala e pistas de áudio ativas. O 1º item de poder vira a bengala de corrida.',
  'sr.blind.off': 'Modo cego desligado.',
  'sr.motor.oneButtonOn': 'Um botão por vez ligado: só uma tecla/botão de cada vez.',

  // Quiz — MATEMÁTICA: enunciado inteiro, operadores inclusive (2+3 independe de língua).
  // Quiz — ALFABETIZAÇÃO: a MOLDURA traduz; a palavra, a letra e a cela Braille atravessam por parâmetro,
  // em pt-BR, porque são a matéria de uma disciplina de idioma e não se traduzem ao trocar o idioma do jogo.
  'sr.quiz.buildWord': 'Letra {letra}. Monte a palavra: {palavra}.',
  'sr.quiz.whichSpelling': '{palavra}. Qual é a escrita certa? O jogo soletra cada opção.',
  'sr.quiz.writeWord': 'Escreva a palavra: {palavra}. {n} letras.',
  'sr.quiz.brailleDictation': '{palavra}. {celas} Pule para coletar.',
  'sr.quiz.wellDone': 'Muito bem! {palavra}. {n} de 3.',
  'menu.restoreDefaults': 'Restaurar padrões deste menu',
  'menu.close': 'Fechar',
  'menu.typo': 'Tipografia',
  // O TÍTULO do painel, sem o emoji: `pause.caa` é o rótulo do BOTÃO no cartão de pausa, onde o símbolo ajuda
  // a distinguir sete itens de relance. Dentro do painel já se sabe onde se está, e um emoji no `<h2>` é lido
  // em voz alta por quem usa leitor de tela antes do nome do que ele abriu.
  'menu.caa': 'Comunicação',
  'caa.grupo.rotulo': 'Escolhas de comunicação',
  // O nome vem do botão da pausa (`pause.anim`), sem o emoji, pela mesma razão do `menu.caa`. E o nome é
  // «Sensibilidade visual» e não «Animação» porque é o que a pessoa sente: quem precisa deste painel chega
  // por enjoo ou por crise, não por curiosidade sobre quadros por segundo.
  'menu.animation': 'Sensibilidade visual',
  'animation.grupo.rotulo': 'Movimento e animação',
  // ===================== AS LINHAS DO PAINEL MOTORA =====================
  // O rótulo é CURTO e a explicação vai numa dica só, que a casca move para o rodapé (CLAUDE.md §4). As dicas
  // são as mesmas frases que os anúncios `sr.motor.*On` já dizem, no PRESENTE em vez de no passado: duas
  // redações da mesma escolha divergem, e quem ouve o anúncio depois de ler a linha merece reconhecê-la.
  'motor.facil': 'Modo Fácil',
  'motor.facil.dica': 'Gravidade menor, pulo mais alto, coleta tolerante, moedas no chão, sem perigos e sem quedas acidentais.',
  'motor.altmove': 'Movimento por alternância',
  'motor.altmove.dica': 'Toque a direção para andar sem segurar; toque de novo para parar. O pulo não interrompe a caminhada.',
  'motor.togglerun': 'Alternância do correr',
  'motor.togglerun.dica': 'O botão de correr fica ligado num toque, em vez de precisar ser segurado.',
  'motor.grupo.rotulo': 'Escolhas de movimento',
  'menu.motora': 'Acessibilidade motora',
  // O tamanho do controle de toque, em quatro passos — um por persona (errata do ADR-0151).
  'motora.pad': 'Tamanho do controle',
  'motora.pad.dica': 'Escolha pela mão de quem joga: criança pequena até 6 anos, criança grande por volta dos 12. A criança pequena tem os botões maiores: ela ainda acerta longe do centro.',
  'motora.pad.crianca-pequena': 'criança pequena',
  'motora.pad.crianca-grande': 'criança grande',
  'motora.pad.adulto-pequeno': 'adulto pequeno',
  'motora.pad.adulto-maos-grandes': 'adulto de mãos grandes',
  // O mapeamento de teclado por modo de jogadores (ADR-0151 §2 item 5). A de 3–4 só aparece sem ombros nem gatilhos.
  'motora.teclado.1': 'Mapear teclado — 1 jogador',
  'motora.teclado.2': 'Mapear teclado — 2 jogadores',
  'motora.teclado.34': 'Mapear teclado — 3–4 jogadores',
  'motora.abrir': 'Abrir',
  'ctrl.assento': 'Teclado de',
  'ctrl.jogador': 'Jogador {n}',
  // ===================== AS LINHAS DO PAINEL AUDITIVO =====================
  // Onde já havia palavra para a coisa, ela é REUSADA — `icon.blind` e `icon.tts` nomeiam os mesmos dois
  // ajustes na barra de acessibilidade. Dois nomes para o mesmo ajuste em duas telas da mesma engine é como
  // uma criança deixa de reconhecer o que já aprendeu.
  'audio.som': 'Som',
  'audio.som.dica': 'Desliga todo o som do jogo de uma vez, sem mexer nas escolhas de cada tipo.',
  'audio.volume': 'Volume geral',
  'audio.modocego': 'Modo cego',
  'audio.narracao': 'Narração por voz',
  'audio.cat.music': 'Música',
  'audio.cat.ambient': 'Sons ambiente',
  'audio.cat.interact': 'Efeitos de interação',
  'audio.cat.earcons': 'Earcons',
  'audio.cat.tts': 'Narração',
  'audio.cat.sonar': 'Sonar',
  'audio.cat.guard': 'Guarda de beirada',
  'audio.cat.guide': 'Pista / guia auditivo',
  'audio.cat.volumeDe': 'Volume de {c}',
  'audio.navsound.grupo': 'Sons de navegação',
  'audio.cane': 'Batida da bengala',
  'audio.cane.dica': 'De quanto em quanto chão a bengala bate. Uma batida por bloco é mais calma; a cada meio bloco dá mais detalhe.',
  'audio.menuindex': 'Índice falado dos menus',
  'audio.menuindex.dica': 'O leitor de tela diz "3 de 7" ao andar num menu, para saber onde se está sem contar.',
  'audio.tts.dica': 'O jogo lê em voz alta o que está escrito na tela.',
  'audio.ttsEngine': 'Motor de voz',
  'audio.ttsEngine.dica': 'A voz do navegador funciona logo; as neurais soam melhor e baixam no primeiro uso.',
  'audio.ttsVoice': 'Voz',
  'audio.ttsVol': 'Volume da narração',
  'audio.ttsTest': 'Testar a voz',
  'audio.ttsTest.dica': 'Fala uma frase de exemplo com a voz escolhida agora.',
  'audio.sinks.grupo': 'Saída de áudio por jogador',
  'audio.detect': 'Detectar saídas',
  'menu.audio': 'Acessibilidade auditiva',
  'menu.som': 'Conforto auditivo',
  'audio.grupo.rotulo': 'Sons do jogo',
  // O texto de REPOUSO do rodapé de todo painel — o que ele diz enquanto ninguém aponta para linha nenhuma.
  // Era um literal em português dentro do `ui/settings-panel`, e até 2026-09-12 ninguém o via: nenhum painel
  // montado pela engine existia. Com quatro deles montados, ele passou a aparecer — em português, num jogo
  // em inglês.
  'menu.explainIdle': 'Passe o mouse ou navegue pelas opções para ver a explicação.',
  'sr.audio.reset': 'Acessibilidade auditiva restaurada aos padrões. Os outros menus não mudaram.',
  'sr.empathy.reset': 'Modo empatia restaurado aos padrões: simulações desligadas. Correções de daltonismo e os outros menus não mudaram.',
  'sr.motor.reset': 'Modo Fácil e movimento por alternância restaurados aos padrões. O controle pelos olhos e o mapeamento de teclas continuam como estavam.',
  'sr.typo.reset': 'Tipografia restaurada ao padrão: {fam}, desenhada para quem tem baixa visão.',
  'a11y.changed': 'alterado',
  'sr.visual.reset': 'Acessibilidade visual restaurada aos padrões: contraste, realce, cores e contornos. As legendas e os outros menus não mudaram.',
  'sr.motion.reset': 'Sensibilidade visual restaurada aos padrões: animações e estética CRT. As animações voltam ao que o seu sistema pede.',
  'caa.emPreparo': 'em preparação',
  'caa.aguardandoNegociacao': 'aguardando negociação',
  'caa.secao.agora': 'Disponível agora',
  'caa.secao.agoraTag': 'funciona sem rede',
  'caa.secao.preparo': 'Em preparação',
  'caa.secao.preparoTag': 'licença resolvida; falta o trabalho',
  'caa.secao.negociacao': 'Aguardando negociação',
  'caa.secao.negociacaoTag': 'a permissão não é nossa',
  'sr.caa.escolha': 'Comunicação: {v}.',
  'sr.caa.reset': 'Comunicação restaurada ao padrão: letras maiúsculas, como a alfabetização costuma começar.',
  'pause.caa': 'Comunicação',
  'sr.caa.caixaAltaOn': 'Letras maiúsculas ligadas: o jogo inteiro em caixa alta.',
  'sr.caa.caixaAltaOff': 'Letras maiúsculas desligadas: maiúsculas e minúsculas.',
  'sr.quiz.bemVindo': 'Quiz. Use as setas para escolher e Enter para responder.',
  'quiz.pos.up': 'Acima',
  'quiz.pos.down': 'Abaixo',
  'quiz.pos.confirm': 'Confirmar',
  'quiz.pos.back': 'Voltar',
  'quiz.menu': 'Menu',
  'quiz.resposta.certa': 'Certo! {certa}.',
  'quiz.resposta.errada': 'Ainda não. A resposta certa é {certa}.',
  'quiz.fim': 'Fim! {n} de {m}.',
  'quiz.alternativas': 'Alternativas',
  'quiz.acom.hints': 'Dicas',
  'quiz.acom.textPace': 'Ritmo do texto',
  'quiz.acom.lexicalDifficulty': 'Dificuldade das palavras',
  'quiz.acom.wordHighlight': 'Realce de palavras',
  'sr.nav.sonarFound': 'Sonar: {alvo} {lado}, {dist}.',
  // `sr.nav.coin` ficou para o JOGO nomear o alvo (item 19): o sonar recebe o nome por `nameAt`, campo 3 do
  // contrato. `sr.nav.target` e o que ele diz quando o jogo declara um alvo SEM nome — melhor uma palavra
  // generica do que uma chave crua na boca do leitor de tela.
  'sr.nav.coin': 'moeda',
  'sr.nav.target': 'alvo',
  // O RUMO, nos dois referenciais que uma topologia pode declarar (ADR-0089). Substituem `left`/`right`/
  // `ahead`, que eram três palavras onde o contrato tem oito — e misturavam referencial de TELA (esquerda,
  // direita) com referencial de CORPO (à frente), sem que quem ouvisse tivesse como saber qual era qual.
  'sr.nav.dir.n': 'ao norte', 'sr.nav.dir.ne': 'a nordeste', 'sr.nav.dir.e': 'a leste',
  'sr.nav.dir.se': 'a sudeste', 'sr.nav.dir.s': 'ao sul', 'sr.nav.dir.sw': 'a sudoeste',
  'sr.nav.dir.w': 'a oeste', 'sr.nav.dir.nw': 'a noroeste',
  // O eixo vertical do ESPAÇO. Palavras próprias porque `up`/`down` já são AÇÕES de controle.
  'sr.nav.dir.zenith': 'acima', 'sr.nav.dir.nadir': 'abaixo',
  // O relógio, para a vista lateral. Duas chaves e não doze: a hora é parâmetro. A forma do singular existe
  // porque «às 1 horas» não é português.
  'sr.nav.clock': 'às {h} horas', 'sr.nav.clockOne': 'à 1 hora',
  'sr.nav.here': 'aqui mesmo',
  'sr.nav.veryClose': 'bem perto',
  'sr.nav.close': 'perto',
  'sr.nav.far': 'longe',
  'sr.player.prefix': 'Jogador {n}: ',
  'sr.empathy.hearingOn': 'Simulação de perda auditiva ligada: sons fracos ficam abafados e os agudos são cortados; falas ficam difíceis de entender.',
  'sr.empathy.hearingOff': 'Simulação de perda auditiva desligada.',
  'sr.empathy.onebtnOn': 'Simulação de um botão por vez ligada: um segundo botão apertado junto não conta.',
  'sr.empathy.onebtnOff': 'Simulação de um botão por vez desligada.',
  'sr.empathy.semforcaOn': 'Simulação sem força para segurar ligada: segurar um botão vale só um toque.',
  'sr.empathy.semforcaOff': 'Simulação sem força para segurar desligada.',
  // ===================== PODERES =====================
  // `sr.power.*` é FALADO quando o poder muda (game/physics, game/session); `hud.power.*` é o rótulo curto do
  // HUD. Eram duas tabelas de `const` no main.js, e por isso estavam CONGELADAS no idioma do boot: um `const`
  // de módulo resolve uma vez e nunca mais. Agora a tabela guarda a CHAVE e quem exibe resolve com `t()`.
  'sr.power.superjump': 'Super-pulo! O pulo fica sempre na altura máxima.',
  'sr.power.ultrajump': 'Ultra-pulo! Pulos de distância gigante.',
  'sr.power.turbo': 'Super-corrida! Correndo você fica bem mais rápido.',
  'sr.power.fly': 'Voo! No ar, aperte Pular para começar a voar; Pular de novo encerra.',
  'sr.power.wallcling': 'Escalada (aranha)! No ar, aperte {botao} perto de uma parede/teto para grudar; engatinha e contorna quinas; {botao} de novo solta.',
  'hud.power.off': '—',
  'hud.power.superjump': '🐇 Super-pulo',
  'hud.power.ultrajump': '🦘 Ultra-pulo',
  'hud.power.turbo': '👟 Super-corrida',
  'hud.power.wallcling': '🕷️ Escalada',
  'hud.power.runcane': '👟 Bengala de corrida',
  // ===================== MOVIMENTO REDUZIDO (WCAG 2.3.3) + CRT =====================
  // Os rótulos ficavam em DUAS tabelas `const` de texto — uma em main.js e outra em ui/settings-motion — com
  // três entradas repetidas palavra por palavra e nada ligando as duas. Agora a tabela guarda a CHAVE.
  'rm.parallax': 'Parallax do fundo',
  'rm.decor': 'Decoração',
  'rm.items': 'Animação de itens',
  'rm.walk': 'Personagem em movimento',
  'rm.breath': 'Respiração',
  'rm.flavor': 'Gracinhas',
  'rm.particles': 'Partículas e cintilação',
  'rm.crt.scan': 'Scanlines',
  'rm.crt.vig': 'Vinheta',
  'rm.crt.round': 'Cantos arredondados',
  'crt.round.off': 'desligado',
  'crt.round.small': 'pequeno',
  'crt.round.large': 'grande',
  'rm.sec.all': 'todos os jogadores',
  'sr.rm.frozen': '{alvo} congelado.',
  'sr.rm.animated': '{alvo} animado.',
  'sr.rm.allStopped': 'Todas as animações paradas.',
  'sr.rm.allResumed': 'Todas as animações retomadas.',
  'sr.crt.on': '{efeito} ligada.',
  'sr.crt.off': '{efeito} desligada.',
  'sr.crt.round': '{efeito}: {nivel}.',
  // ===================== LIGADO / DESLIGADO =====================
  // Duas palavras que estavam copiadas TREZE vezes, em nove arquivos — e dois desses arquivos declaravam um
  // helper "compartilhado" que só eles usavam. Agora é um só, em ui/dom, ao lado do `toggleBtn`.
  'ui.toggle.on': 'Ligado',
  'ui.toggle.off': 'Desligado',
  'ui.toggle.ariaOn': '{alvo}: ligado',
  'ui.toggle.ariaOff': '{alvo}: desligado',
  // ===================== AS DUAS ESCOLHAS MOTORAS POR JOGADOR =====================
  // Modo Fácil e movimento por alternância. Cada estado é UMA frase inteira, e não um prefixo compartilhado
  // com um sufixo variável: é a mesma decisão que `sr.audio.*` já registra — uma língua que reordene a frase
  // só consegue se a frase inteira morar no dicionário. O 'Jogador N: ' vem de `sr.player.prefix`.
  'sr.motor.easyOn': 'Modo Fácil ligado: gravidade menor, pulo mais alto, coleta tolerante, moedas no chão, sem perigos e sem quedas acidentais (segure ↓ para descer).',
  'sr.motor.easyOff': 'Modo Fácil desligado.',
  'sr.motor.toggleMoveOn': 'Movimento por alternância ligado: toque a direção para andar sem segurar; toque de novo para parar; segure para ir mais rápido. O pulo não interrompe a caminhada.',
  'sr.motor.toggleMoveOff': 'Movimento por alternância desligado.',
  // ⚠️ O MOTIVO É UM FACTO SOBRE O APARELHO, NUNCA UMA REPREENSÃO (ADR-0113 cláusula 3). Estas frases
  // dizem por que o botão não responde; «não desligue isto» repreenderia uma criança por mexer num ajuste
  // de que ela depende. QUATRO chaves e não uma com `{aparelho}`: «os gestos» é plural e «o olhar» não.
  'alt.exigida.olhos': 'O controle por olhar precisa das teclas de alternância para funcionar.',
  'alt.exigida.rosto': 'O controle por rosto precisa das teclas de alternância para funcionar.',
  'alt.exigida.gestos': 'Os gestos precisam das teclas de alternância para funcionar.',
  'alt.exigida.fala': 'O comando de voz precisa das teclas de alternância para funcionar.',
  'sr.motor.toggleRunOn': 'Alternância do correr ligada.',
  'sr.motor.toggleRunOff': 'Alternância do correr desligada.',
  // ===================== AJUDA (menu de pausa) + rótulo de nível =====================
  // `pause.level` é MOLDURA: `{v}` é o nome do nível da psicogênese de Ferreiro e atravessa SEM TRADUÇÃO —
  // currículo de alfabetização não se traduz, reescreve-se por idioma (pilar 3 do ADR-0010). Ver `QL_NAME`.
  'pause.level': '📚 Nível {n} · {v}',
  // A legenda 'Sim'/'Não' do rodapé de cada pausa (os dois botões do controle). Achado pelo crivo LARGO do
  // item 14: o estreito não o pegou porque 'Sim' não tem acento e 'Não' tem três letras.
  'menu.yes': 'Sim',
  'menu.no': 'Não',
  // ===================== OS 16 MODOS DE VISÃO =====================
  // Eram uma tabela `const` de texto em `render/viz-modes` — congelada no idioma do boot, e é o menu que uma
  // criança de baixa visão ou daltônica lê para configurar o PRÓPRIO jogo. A tabela guarda a CHAVE; quem
  // exibe (render/viz-setters, consumer-quiz) resolve com `t()`, e o módulo continua folha.
  'viz.normal': 'Modo padrão',
  'viz.desc.normal': 'Arte original do jogo.',
  'viz.hc-direto': 'Alto contraste: Renderização Direta (3:1)',
  'viz.desc.hc-direto': 'Fundo recua + contornos + cor por papel; plataforma×fundo ~3:1 (AA gráficos), tons agradáveis.',
  'viz.hc-direto-45': 'Alto contraste: Renderização Direta (4,5:1)',
  'viz.desc.hc-direto-45': 'Mais contraste (AA texto): plataformas mais claras e fundo mais escuro.',
  'viz.hc-direto-7': 'Alto contraste: Renderização Direta (7:1)',
  'viz.desc.hc-direto-7': 'Contraste máximo (AAA texto): quase preto e branco. Menos agradável, para quem precisa do máximo.',
  'viz.sim-deuter': 'Simular Deuteranopia',
  'viz.desc.sim-deuter': 'Como vê quem não enxerga o verde (mais comum).',
  'viz.sim-protan': 'Simular Protanopia',
  'viz.desc.sim-protan': 'Como vê quem não enxerga o vermelho.',
  'viz.sim-tritan': 'Simular Tritanopia',
  'viz.desc.sim-tritan': 'Como vê quem não enxerga o azul.',
  'viz.fix-protan': 'Correção protanopia',
  'viz.desc.fix-protan': 'Daltonização: realça a distinção vermelho/verde para quem tem protanopia.',
  'viz.fix-deuter': 'Correção deuteranopia',
  'viz.desc.fix-deuter': 'Daltonização: realça a distinção vermelho/verde para quem tem deuteranopia.',
  'viz.fix-tritan': 'Correção tritanopia',
  'viz.desc.fix-tritan': 'Daltonização: realça a distinção azul/amarelo para quem tem tritanopia.',
  'viz.lv-blur': 'Baixa visão: desfoque',
  'viz.desc.lv-blur': 'Miopia severa / astigmatismo. (bolinha verde; toque 2× p/ sair)',
  'viz.lv-haze': 'Baixa visão: névoa',
  'viz.desc.lv-haze': 'Catarata — película esbranquiçada, baixo contraste.',
  'viz.lv-tunnel': 'Baixa visão: visão de túnel',
  'viz.desc.lv-tunnel': 'Glaucoma — só o centro é visível.',
  'viz.lv-macular': 'Baixa visão: mancha central',
  'viz.desc.lv-macular': 'Degeneração macular — borrão no centro.',
  'viz.lv-diabetic': 'Baixa visão: manchas dispersas',
  'viz.desc.lv-diabetic': 'Retinopatia diabética — manchas espalhadas.',
  'viz.blind': 'Simular cegueira total',
  'viz.desc.blind': 'Tela preta — jogue como uma pessoa cega (resposta tátil/sonora). (bolinha branca; toque 2× p/ sair)',
  // ===================== ARIA-LABEL DO index.html =====================
  // 41 rótulos de leitor de tela (36 distintos) estavam em português CRU no markup, e só UM dos 53 usava o
  // `data-i18n-aria` que já existia. Numa build em inglês, uma criança cega ouvia a interface inteira em
  // português — o pilar 2 falhando na superfície onde ele mais importa, e em silêncio.
  'a11y.communication': 'Comunicação: letras e símbolos',
  'a11y.pauseMenu': 'Menu de pausa',
  'a11y.stopAll': 'Parar todas as animações',
  'a11y.resumeAll': 'Retomar todas as animações',
  // O rótulo VISÍVEL do #np-btn. Estava cru no index.html e não podia levar `data-i18n`: o texto embrulha um
  // `<span id="np-n">` com o número, e o `applyDom` escreve `textContent`, o que destruiria o span. A saída é
  // o JavaScript passar a ser dono do rótulo inteiro — o número já é dinâmico, então o texto sempre foi dele.
  // ===================== A LEGENDA DE CONTROLES (fileira sob o título) =====================
  // TERCEIRA família de rótulos para as mesmas ações, e de propósito. `act.*` serve à LISTA de mapeamento
  // ("Correr / interagir") e `touch.act.*` ao painel de toque ("Pausar (START)"); os dois cabem lá porque
  // aquelas telas têm largura. A legenda é uma FILEIRA APERTADA embaixo de um glifo, e nela só cabe o registro
  // curto. Duas das seis coincidem com `act.*` palavra por palavra; reusar as outras quatro trocaria "correr"
  // por "Correr / interagir" e quebraria a linha.
  'legend.move': 'movimentar-se',
  'legend.pause': 'pausa',
  'legend.jump': 'pular',
  'legend.especial': 'especial',
  'legend.run': 'correr',
  'legend.swap': 'trocar',
  // ===================== CATÁLOGO DE FONTES =====================
  // Os NOMES das fontes (Atkinson Hyperlegible, Lexend, …) NÃO entram aqui: são nomes próprios e ficam no
  // catálogo, como os nomes dos motores de voz. O que traduz é o nome do GRUPO e a descrição — que é o texto
  // que explica à criança (ou a quem a acompanha) POR QUE aquela fonte existe na lista.
  'font.grupo.rotulo': 'Família de letra',
  // A AMOSTRA do painel: um PANGRAMA, e por isso ele muda de idioma em vez de traduzir. A frase existe para
  // pôr o alfabeto inteiro à vista — quem escolhe uma fonte está a perguntar «consigo ler isto?», e uma
  // tradução literal deixaria letras de fora justamente no idioma em que a criança vai ler.
  'font.amostra': 'Juiz foge e bota fita de cetim na xícara',
  'font.group.sans': 'Sem serifa',
  'font.group.serif': 'Serifada',
  'font.group.hand': 'Manuscrita',
  'font.group.arcade': 'Arcade',
  'font.desc.atkinson': 'feita pelo Braille Institute para pessoas com baixa visão (padrão do jogo)',
  'font.desc.lexend': 'feita para reduzir stress visual e atender pessoas disléxicas (ativa o espaçamento extra)',
  'font.desc.quattro': 'criada para diminuir a fadiga visual de quem passa muito tempo na tela',
  'font.desc.andika': 'baseada na Sassoon; fruto de pesquisa sobre como crianças leem e escrevem',
  'font.desc.opendyslexic': 'Letras com a base mais pesada, para não virarem de cabeça para baixo ao ler.',
  'font.desc.fondamento': 'Caligráfica de pena, para as atividades de escrita à mão.',
  'font.desc.pw.br': 'Cursiva escolar do Brasil.',

  'font.desc.pw.ustrad': 'Cursiva escolar dos EUA — tradicional.',

  'font.desc.pw.usmod': 'Cursiva escolar dos EUA — moderna.',

  'font.desc.pw.ca': 'Cursiva escolar do Canadá.',

  'font.desc.pw.mx': 'Cursiva escolar do México.',

  'font.desc.pw.ar': 'Cursiva escolar da Argentina.',

  'font.desc.pw.cl': 'Cursiva escolar do Chile.',

  'font.desc.pw.co': 'Cursiva escolar da Colômbia.',

  'font.desc.ronde': 'Ronde francesa, a letra de mão que se ensina na escola.',
  // ⚠️ AS TRÊS PELO NOME, e não «uma fonte ronde» (ADR-0108 §4): um adulto não consegue agir sobre uma
  // categoria. A frase existe para ser executável — abrir o navegador, procurar UM destes três nomes,
  // instalar. Nomear a categoria seria a mesma linha morta que este catálogo já removeu duas vezes.
  'font.off.ronde': 'Instale no aparelho uma destas três: Ronde Script, OPTIFrench-Script ou Merveille. '
    + 'Elas são gratuitas para uso pessoal, e por isso não podem vir dentro do jogo.',
  'font.desc.greatvibes': 'caligráfica inglesa',
  'font.desc.pinyon': 'caligráfica inglesa',
  'font.desc.ufcook': 'blackletter alemã',
  'font.desc.ufmag': 'blackletter alemã',
  'font.desc.pressstart': 'pixel de 8 bits (HUD e título do jogo)',
  'font.desc.learningcurve': 'cursiva inglesa',
  'font.desc.kindergarten': 'cursiva brasileira',
  'font.off.pending': 'licença a confirmar — ainda não embarcada',
  'font.off.negotiating': 'licença em negociação',
};
export default pt;
