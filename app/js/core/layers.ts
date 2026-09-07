// SPDX-License-Identifier: AGPL-3.0-or-later
// core/layers — ORDEM-Z CANÔNICA (fonte única de verdade). Cada camada tem um Z NOMEADO; ninguém mais faz
// addChildAt(getChildIndex(...)) nem "re-adiciona ao topo" — a inserção passa a ser pelo Z (fim do acoplamento).
// Duas escalas: MUNDO (por viewport — PIXI zIndex dentro da câmera, com sortableChildren) e OVERLAY (global, tela —
// vira CSS z-index no DOM, pois menu/HUD/legenda são DOM). **Passo 1000** = folga generosa: 999 slots livres entre
// camadas nomeadas (e sub-slots dentro de cada uma) p/ inserir futuras SEM renumerar. Elementos concretos entram por
// `Z.BANDA + offset` pequeno (ex.: cane/cadeira = PLAYER+10/+20) — ver docs/5-Refactoring/plano-religacao-z-camadas.md.
//
// NATUREZA (fauna/flora) STRADDLE o jogador: há um par BACK (atrás) e FRONT (à frente) p/ cada, deixando bichos/plantas
// aparecerem dos dois lados do player (imersão — pedido do José). PIXI sortableChildren é tudo-ou-nada por container →
// o mundo inteiro migra numa rodada só (todos os filhos ganham zIndex de uma vez, reproduzindo a ordem atual = no-op).
//
// PÓS-PROCESSO ≠ camada Z: CRT/vinheta e os filtros de a11y (alto-contraste, correção de daltonismo, simulação de
// deficiência) são uma CADEIA de passes sobre o frame JÁ COMPOSTO (POST_FX_ORDER), não itens da display-list — e cobrem
// TUDO, inclusive o menu. A11Y_CORRECTION é SEMPRE o último passe; modos de a11y SUPRIMEM o CRT/efeitos decorativos; o
// overlay é palette-aware (troca p/ CB-safe). Ver ADR-0020 + ADR-0011.

export const Z = {
  // ===== MUNDO (por viewport; PIXI zIndex dentro da câmera) =====
  SKY: 1000,                 // gradiente de céu (base)
  SKY_ANIM: 2000,            // animações do céu atrás do parallax (estrelas)
  PARALLAX_4: 3000,          // paralaxe mais distante. Nuvens de céu podem entrar em PARALLAX_*+offset (profundidades)
  PARALLAX_3: 4000,
  PARALLAX_2: 5000,
  PARALLAX_1: 6000,          // fundo próximo do jogo
  BG_DECOR: 7000,            // deco ATRÁS dos tiles: árvores, água/corais/algas, ruínas, deco de cidade, nuvens de tela
  TILES: 8000,               // tileset / plataforma (o nível)
  SCENERY_INTERACT: 9000,    // cenário interativo: porta, alavanca, interruptor, manivela, corda, portão, rampa, elevador
  VFX_BACK: 10000,           // efeitos ATRÁS dos atores: poeira de pé, god-rays, tracinhos de lava, sombras
  FLORA_BACK: 11000,         // plantas ATRÁS do player (grama, flores, arbustos de fundo)
  FAUNA_BACK: 12000,         // criaturas ATRÁS do player (bichos da cidade, animais de fundo)
  NPC: 13000,                // personagens interativos (não-jogador)
  ITEMS: 14000,              // coletáveis (moedas, poderes, chave) — ATRÁS do player (barril DK / Yoshi / chave SMW)
  PLAYER: 15000,             // jogador(es). Aparatos presos (bengala/cadeira) = PLAYER+offset
  VFX_FRONT: 16000,          // efeitos NA FRENTE do player: partículas/juice, explosão, faísca, fogos, confete
  VEHICLES: 17000,           // veículos na frente (carros/trânsito da cidade)
  FLORA_FRONT: 18000,        // plantas NA FRENTE do player (folhagem que tampa o ator — imersão)
  FAUNA_FRONT: 19000,        // criaturas NA FRENTE do player (borboletas/vagalumes/minhocas v3 passando à frente)
  FOREGROUND: 20000,         // primeiro-plano oclusivo genérico (props que tampam o ator)
  WEATHER: 21000,            // clima na frente de tudo do mundo (névoa, chuva, clarão)
  DARK_WORLD: 22000,         // escurecimento do mundo (modo cego / empatia baixa-visão)
  WORLD_A11Y: 23000,         // pistas visuais de a11y no mundo (sonar, guarda de beirada, hitbox fácil, realce)

  // ===== OVERLAY (global, tela; = CSS z-index no DOM / topo da stage PIXI) =====
  HUD: 24000,                // placar/moedas/poder/objetivo/minimapa (persistente durante o jogo)
  TOUCH_CONTROLS: 25000,     // gamepad virtual / botões de toque (mobile)
  CAPTIONS: 26000,           // legendas de som (a11y surdez) + skip-link de navegação
  DIALOGUE: 27000,           // fala/diálogo/atividade (quiz)
  GAME_MSG: 28000,           // vitória / game over / pause / faixa de fase
  MODAL_SCRIM: 29000,        // escurecimento do fundo quando abre um modal
  MENU: 30000,               // menus — RANGE reservado 30000–39999 (níveis aninhados: +1000 por nível)
  MENU_MAX: 39999,
  TRANSITION: 40000,         // fade/wipe de troca de fase (cobre tudo)
  /**
   * ⚠️ A SAÍDA DE EMERGÊNCIA, E ELA FICA ACIMA DA TRANSIÇÃO (decisão do Dev, 2026-09-07).
   *
   * Este comentário dizia que o *skip-link* mora em `CAPTIONS` (26000) — e isso deixava-o ABAIXO de
   * `MENU` (30000). Um «pular para o conteúdo» que um modal cobre não é alcançável, o que é a WCAG 2.4.1 ao
   * contrário: o mecanismo que existe para atravessar blocos repetidos passa a ser mais um bloco.
   * O gate do `z-order-css` já registava o defeito com todas as letras — «o `Z` ERRA, não o CSS» —, e ficou
   * assim durante semanas porque nada o obrigava a mudar.
   *
   * ⚠️ E É ACIMA DA `TRANSITION`, não entre o menu e ela. O Dev pediu 41000 e o motivo é o que sobra depois
   * de tudo o resto falhar: a saída não pode ficar atrás de nada que a pessoa não controla, e um fade de
   * troca de fase é precisamente isso. O custo — o link aparecer por cima de uma animação — é nulo na
   * prática, porque ele só é visível AO FOCO (`top:-60px` até `:focus`), e porque durante a transição já não
   * se tabula: o foco sai da tela antiga e só reaparece na seguinte (ver a regra de foco no ADR).
   *
   * Só o aviso de laço morto (ADR-0054) e o painel de desenvolvimento ficam acima dela.
   */
  SKIP_LINK: 41000,
  /**
   * O LAÇO MORREU (ADR-0054). Acima do `TRANSITION` de propósito: quando o quadro lança, o que estiver na
   * tela — menu aberto, fade a meio, mensagem de fase — está congelado e deixou de importar. O aviso tem de
   * ser visto por cima de tudo isso, e só o painel de desenvolvimento fica acima dele.
   */
  LOOP_CRASH: 45000,
  DEBUG: 90000,              // painel ?debug / FPS / hitboxes (dev; topo absoluto)
} as const;

export type LayerName = keyof typeof Z;

// Cadeia de PÓS-PROCESSO — passes sobre o frame COMPOSTO, do interno p/ o externo. NÃO são camadas Z.
// Modos de a11y suprimem CRT_VIGNETTE e flashes decorativos (precedência a11y > estética). Ver ADR-0020.
//
// DUAS COISAS DIFERENTES NO FIM DA FILA, e confundi-las é o que este comentário existe para impedir:
//
//  · A11Y_CORRECTION é o último passe de CORREÇÃO. Ele decide como a imagem SE PARECE, e por isso precisa ver o
//    composto final, menus inclusive — é essa a razão de ele vir depois do CRT, que senão re-tinge e desfaz a
//    correção de daltonismo.
//  · FLASH_LIMIT é o último passe, ponto. Ele decide se a imagem pode FAZER MAL. A WCAG 2.3.1 limita a variação de
//    luminância no tempo, e o único quadro cuja luminância importa é o que chega ao olho. Um limitador colocado
//    ANTES da correção limita uma imagem que já não existe, e a correção fica livre para reabrir a oscilação que
//    ele acabou de fechar — uma matriz de daltonismo redistribui luminância por definição. Segurança é o passe mais
//    externo porque é a última coisa verdadeira sobre o quadro.
//
// O ADR-0020 dizia "A11Y_CORRECTION sempre por último" sem essa distinção; foi emendado em 2026-08-24. FLASH_LIMIT
// ainda NÃO está implementado — está declarado aqui, e aferido por teste, para que quem o implementar encontre o
// lugar certo já ocupado em vez de deduzir a ordem errada a partir da redação antiga.
export const POST_FX_ORDER = ['CRT_VIGNETTE', 'EMPATHY_SIM', 'A11Y_CORRECTION', 'FLASH_LIMIT'] as const;
export type PostFx = typeof POST_FX_ORDER[number];
