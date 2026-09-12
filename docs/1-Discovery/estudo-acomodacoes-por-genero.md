# As acomodações por gênero — o estudo que o ADR-0145 §3 pediu

**Medido em 2026-09-12** cruzando as **35 categorias** e os **380 jogos** do
`minigames-catalog-v2.html` com cada acomodação que a engine tem ou poderia ter. A pergunta, célula a
célula, é a do Dev — **«isto tem ASSUNTO aqui?»** — e não «a engine consegue escrever o valor». Foi a
confusão entre as duas que gerou o ADR-0145, e este documento é a metade que aquele registo deixou por fazer.

> ⚠️ **A classificação é JUÍZO, e o número é que é medição.** Cada célula é uma decisão minha sobre se a
> acomodação tem sujeito naquele gênero; o que a máquina faz é contar. Onde eu errar uma célula, o erro
> propaga-se para a percentagem — então as células estão todas escritas em
> `scripts/`-adjacente (ver «Como refazer», no fim) em vez de só o resultado.

---

## 0 · 🔴 A CHAVE DESTE ESTUDO ESTAVA ERRADA, e a correcção é do Dev

> «Você está tomando uma lista de pesquisa rápida feita em uma tarde como a lista canônica de gênero para uma
> engine que será usada por milhões de pessoas.» — o Dev, 2026-09-12

As 35 categorias do catálogo são um **backlog de produção**, não uma taxonomia. As secções 1–9 abaixo
usaram-nas como chave de género, e isso tem uma consequência técnica e não só de nome: a mesma acomodação
ficava espalhada por várias chaves quando o que a governa é **um eixo só**. `balancoDaCamara` aparecia sob
*Corrida*, *Pseudo-3D* e *Isométrico* — e o que a governa é a **perspectiva**. `saidaDeAudio` aparecia sob seis
— e o que a governa é o **modo de jogadores**.

### A taxonomia passa a vir da Wikipédia, fixada numa revisão

<https://en.wikipedia.org/wiki/List_of_video_game_genres>, **revisão 1367745358 de 2026-08-04**. Fixada porque
uma taxonomia tirada de uma wiki que muda todos os dias, sem dizer de que dia é, é uma lista que um dia deixa de
concordar consigo mesma sem nada que o diga.

📌 **E a própria página confirma o corte que o Dev pediu:** a secção 11 é «*Video game genres by purpose*»
(educativo, sério, arte…) — um EIXO, separado dos géneros pela mesma página que os lista.

### As 35 categorias passam a ser a PROVA DE COBERTURA, e cabem

📏 `node scripts/taxonomia-de-generos.mjs` — **35 de 35 mapeadas, 380 jogos**:

| género de topo (Wikipédia) | categorias | jogos* |
|---|---|---|
| 1 · Action | 10 | 108 |
| 2 · Action-adventure | 1 | 8 |
| 3 · Adventure | 3 | 34 |
| 4 · Puzzle | 6 | 71 |
| 5 · Role-playing | 2 | 16 |
| 6 · Simulation | 2 | 23 |
| 7 · Strategy | 2 | 16 |
| 8 · Sports | 2 | 25 |
| 10 · Other notable genres | 8 | 84 |
| 12 · Sandbox / open world | 2 | 20 |

\* ⚠️ **A coluna não é partição**: uma categoria de dois géneros conta nos dois (RPG / Aventura cai em 5 e em 3).

### 🔴 Oito categorias cujo NOME não é um género — exactamente as que o Dev apontou

| categoria | o que é, de facto |
|---|---|
| Arcade Clássico | uma **época** |
| Pseudo-3D / Raycasting | uma **técnica de render** → eixo *perspectiva* (1.ª pessoa) |
| Isométrico | uma **perspectiva** |
| Multiplayer Local | um **modo de jogadores** |
| Reação / Reflexo | uma **mecânica** |
| Labirinto Exploração | uma **mecânica** (a página não lista «maze» como género) |
| Experimentais / Arte | um **propósito** — a própria página põe «art game» em «por propósito» |
| Híbridos / Mashups | **multi-género** por definição |

📌 **E há uma nona que é metade de cada:** *Educativo / Quiz* é género (trivia, 10.11) **e** propósito
(educativo, 11.5), e é assim que o script a regista.

⚠️ **Três não têm género nenhum a atribuir** — Multiplayer Local, Experimentais/Arte e Híbridos, **33 jogos**
— e isso não é lacuna: são exactamente as que atravessam géneros. Uma acomodação que dependa do género não
tem sujeito nelas **pelo género**, e terá de o ter pelo eixo.

### O que fica por fazer nesta fase (2a)

1. ✅ **Re-chavear as acomodações pelos eixos certos** — feito, secção 0.1 abaixo.
2. ✅ **Semear o catálogo de acomodações pela GAG** — feito, secção 0.2 abaixo.

---

## 0.1 · As acomodações re-chaveadas — UMA chave cada

📏 `node scripts/acomodacoes-por-genero.mjs`. A primeira versão guardava **35 listas escritas à mão**, uma por
categoria, e por isso a mesma pergunta era respondida muitas vezes e podia sê-lo de formas diferentes. Agora
**cada acomodação tem uma chave — um eixo e os valores onde tem assunto —, e cada categoria declara uma vez os
valores que os jogos dela cobrem.** A divergência deixa de ser possível por construção: não há segunda célula
onde escrever outra resposta. Sete guardas; **catorze mutações distintas, catorze vermelhas** — quatro delas nas guardas novas da taxonomia.

### 🎯 O achado: metade das chaves o contrato JÁ PERGUNTA

O plano previa quatro eixos (género, perspectiva, modo de jogadores, propósito). Chaveadas uma a uma, as
acomodações caíram em **três espécies**, e a do meio é a que muda a fase 2c:

| espécie | eixos | acomodações |
|---|---|---|
| **taxonomia** — o que o jogo É | `generos` · `perspectiva` · `jogadores` | saída de áudio, balanço da câmara, Modo Fácil, cadeira de rodas, detecção, intensidade, dica |
| 🎯 **declaração que o contrato já tem** | `tick` · `seguraTeclas()` · `needsPointer()` · `world()` · `topology()` | velocidade do jogo, as duas alternâncias, controle virtual, um botão só, estabilizar ponteiro, simulação visual, modo cego, navegação sonora |
| ⚠️ **declaração que o contrato ainda não pede** | `avatar` · `texto` · `pecas` · `precisao` | redução do personagem, bengala, velocidade do texto, dificuldade lexical, peças, naipes, janela de acerto |

🔴 **Nove acomodações não precisam de género nenhum**: a engine pode filtrá-las pelo que o jogo já declarou, e
seis dessas nove a engine já tem. É a regra do ADR-0145 a funcionar sem o campo `genero` — o que a fase 1h
já tinha visto no ☝️, que some num quiz porque `seguraTeclas()` é `false`.

📌 **E um eixo teve de ser DERIVADO**, e é a mesma regra que a engine aplica: o sonar precisa de mundo
(`world: none` ⇒ «empatia e sonar NÃO são oferecidos», `core/contract.ts` bloco 8) **e** de direcção
(`bearing` devolve `{ kind: 'none' }` em `hotspots`, `contract.ts:610`). Chaveado só pela topologia, o modo
cego foi dado ao Desenho, que declara `none` — medido, e corrigido antes de escrever isto.

### O que mudou, por acomodação

| acomodação | chave | antes | depois | porquê |
|---|---|---|---|---|
| modo cego · navegação sonora | `espaco ∈ espacial` | 18% | **78%** | a §6 dizia «mundo espacial» e contou 6 categorias; o contrato dá direcção a **toda** grelha e espaço contínuo — o Tabuleiro (xadrez às cegas) incluído |
| um botão só | `entrada ∈ acoes` | 36% | **93%** | com varredura, colapsar as acções tem assunto em qualquer jogo de acções — xadrez incluído |
| tamanho do alvo | universal | 61% | **100%** | a régua da fase 5b é da INTERFACE (menus, pad, barra), e há interface em todo jogo |
| remapear teclas | universal | 62% | **100%** | todo jogo tem confirmar e pausa, e menus navegados por tecla |
| bengala | `avatar ∈ anda` | 6% | 48% | a bengala é de quem anda a pé, e anda-se a pé em muito mais do que Platformer e Labirinto |
| alternância de marcha | `segura ∈ direcao·botao` | 34% | 65% | lido nos títulos: Tetris segura a descida, o pinball segura o flipper |
| alternância do correr | `segura ∈ botao` | 11% | 36% | ⚠️ generaliza para **qualquer botão segurado** (carregar força, bloquear), não só correr |
| janela de acerto | `precisao ∈ precisa` | 34% | 53% | Shooters, Corrida, Pseudo-3D e Cartas (Speed) tinham-na e não estavam contados |
| balanço da câmara | `perspectiva ∈ 1.ª pessoa·atrás` | 6% | 23% | ⚠️ **perdeu o Isométrico** — a câmara isométrica não balança; ganhou a câmara de perseguição |
| estabilizar ponteiro | `entrada ∈ ponteiro` | 7% | 23% | **era «assistência de traço»**: a mão trémula que desenha também mira e arrasta |
| velocidade do texto · dificuldade lexical | `texto ∈ narrativo·materia` | 18% · 11% | 25% · 25% | ⚠️ perdeu Simulação e Estratégia, onde o texto é rótulo |
| Modo Fácil | `generos ∈ 1.1` | 30% | **6%** | a física dele (gravidade, moedas no chão) é de PLATAFORMA; «mais fácil» em geral é outra acomodação, e a GAG é que a nomeia (passo 2) |
| intensidade | `generos ∈ 10.6·2.1` | 10% | 2% | ⚠️ flashes saíram: fotossensibilidade é da redução de cena, que é universal |
| simulação visual | `mundo ∈ element` | 100% | 98% | o Desenho declara `none`, e o contrato recusa-lhe a simulação |
| controle virtual | `entrada ∈ acoes` | 96% | 93% | Desenho e Sandbox são ponteiro contínuo; Palavras ganhou (a forca escolhe letras por acção) |
| velocidade do jogo | `tick ∈ clock` | 82% | 82% | **o total não mudou, e a composição sim**: entraram Platformer, Runner e Luta (que a versão anterior só pusera na janela), Sandbox e Experimentais; saíram Tabuleiro, Narrativo, Point-and-Click e Palavras, que são por turno |

⚠️ **O Modo Fácil e a cadeira de rodas caíram para 22 jogos, e isso é o estudo a funcionar**: montá-los
fora de Platformer e Runner seria o interruptor sem assunto que o ADR-0145 existe para evitar.

### O que isto pede à fase 2c

Os quatro eixos que o contrato ainda não pergunta — **`avatar`, `texto`, `pecas`, `precisao`** — chaveiam sete
acomodações, e **duas a engine tem** (a bengala e a redução do personagem, que hoje montam sem filtro). Se
entrarem como campos, entram pela rubrica do `holdsAtOnce` (sem padrão seguro ⇒ obrigatórios) ou pela do
`needsPointer` (padrão seguro ⇒ opcionais). Essa decisão é da 2c, e não é tomada aqui.

> ⚠️ **As secções 1–9 abaixo continuam a valer como MEDIÇÃO da primeira versão** — o raciocínio delas é o
> que produziu as listas. **Onde um número delas contradiz a tabela acima, vale a de cima**: a §1 inteira, a
> §2 (os universais são DOZE — entram remapear e tamanho do alvo, sai a simulação visual), a §5 (a cauda) e o
> número da §6.

---

## 0.2 · A segunda coluna: o nível da GAG

📏 `node scripts/acomodacoes-gag.mjs` — lê a [lista completa](https://gameaccessibilityguidelines.com/full-list/)
ao vivo (ou `--gag <cópia.html>`), classifica **as 105 directrizes** (122 entradas: há directrizes listadas
em mais de um eixo, e cada uma vale pelo MELHOR nível em que aparece) e cruza cada acomodação com o alcance da 0.1.

⚠️ **O texto da GAG não entra no repositório.** A página não declara licença; ficam só os **slugs** (o
identificador de cada directriz na URL dela) e a classificação. ⚠️ **E a página não tem revisão**, então a lista
é fixada por impressão digital (sha256 dos pares eixo/nível/slug, lida em 2026-09-12): se a GAG mudar, o script
reprova em vez de classificar uma lista que já não é a que foi lida. Seis guardas; onze mutações. Duas
sobreviveram sozinhas — são as duas defesas contra a barra lateral da página, e cada uma segura a falta da
outra; tiradas juntas, reprovam. Nenhuma é inerte.

### Para onde foram as 105

| destino | directrizes |
|---|---|
| **viram acomodação** | **63** |
| autoria — regra de desenho de quem escreve o jogo | 18 |
| regra da engine — ela já o faz, sem interruptor (a nota diz onde) | 10 |
| fora do escopo — a engine não tem a coisa (conversa online, vibração, janela de PC) | 8 |
| processo — testes com pessoas, feedback, página pública | 5 |
| ⚠️ **conflito com pilar** | **1** |

🔴 **O conflito é «allow play in both landscape and portrait»** (Advanced/Motor) contra o **pilar 5**
(320×180, paisagem). Não se resolve num estudo: fica nomeado.

### 🎯 A intersecção que o plano pedia — Basic × a engine NÃO tem

| acomodação | alcance | eixos GAG | onde estava no plano |
|---|---|---|---|
| tamanho do alvo | 100% | Motor · Vision | fase 5b ✅ |
| 🔴 **dificuldade** | **100%** | Cognitive · **General Basic** | **não estava** |
| 🔴 **um botão só** | **93%** | Motor Basic | **fase 6, com 36%** |
| velocidade do jogo | 82% | Motor Basic | fase 5a ✅ |
| velocidade do texto | 25% | Cognitive Basic | fase 5c ✅ |
| dificuldade lexical | 25% | Cognitive Basic | fase 6 |
| sensibilidade do controle | 23% | Motor Basic | **não estava** |
| balanço da câmara | 23% | Vision Basic | fase 6, com 6% |
| naipes distinguíveis | 13% | Vision Basic | fase 6 |

📌 **Três leituras que mudam a ordem das fases, e nenhuma é tomada aqui:**

1. **A dificuldade é Basic e universal, e o plano não a tinha.** A GAG pede-a em três directrizes — escolher,
   mudar durante o jogo, praticar sem falhar. A engine não pode fazer um jogo mais fácil; pode **guardar,
   persistir e anunciar** a escolha, e o jogo lê-a — a mesma forma que a fase 5a propõe para a velocidade. O
   Modo Fácil de plataforma é uma instância dela, não a acomodação.
2. **O um botão só sai da cauda.** Na versão por categoria tinha 36%; chaveado e com o nível, é Basic a 93%.
3. **A cauda da fase 6 deixa de ser ordenável só por alcance**: balanço da câmara e naipes são Basic, e ficam à
   frente de acomodações Intermediate com o dobro do alcance.

### O que a GAG trouxe — dezanove acomodações: dezasseis novas, três que a engine já tinha

Por nível: **Basic** dificuldade, sensibilidade do controle · **Intermediate** lembrete do objectivo,
mono/estéreo, tamanho da interface, rearranjar a interface, saltar trecho, macros, assistência de mira e
direcção, realce de palavras, cor do ponteiro, entrada repetida · **Advanced** repetir a instrução, perfis,
audiodescrição, intervalo entre entradas. E três que **a engine já tinha e o estudo não contava**: ajuda dos
controles (`ui/help-panel.ts`, fase 1d), legendas de som (`captionsOn`) e leitor de tela (`core/a11y-sr`).

🔴 **Um achado de passagem, e é o mesmo padrão do `tick`:** o lembrete do objectivo é Intermediate e
universal, e o contrato **já pede** `objectiveOf` a todo jogo — com **zero leitores** em `app/js`. O dado está
declarado em todos os jogos; falta quem o diga.

### Fora da GAG — e isso não é defeito

Treze acomodações nenhuma directriz pede: caixa da letra, índice falado, as duas simulações de empatia,
controle virtual, redução do personagem, bengala, saída de áudio por jogador, estabilizar ponteiro, peças,
Modo Fácil, cadeira de rodas e detecção. As simulações **não são acessibilidade de quem joga** — são empatia
de quem assiste —, e as outras são formas concretas de directrizes mais gerais (a bengala é uma forma do
«sonar-style audio map»; o controle virtual, do «large and well spaced»). ⚠️ Onde a forma concreta ficou
sem directriz, é porque classifiquei a directriz na forma geral: é juízo, e está escrito linha a linha.

---

## 1 · O resultado, por alcance

| acomodação | a engine tem? | gêneros | jogos | % do catálogo |
|---|---|---|---|---|
| tipografia | ✅ | 35/35 | 380 | **100%** |
| caixa da letra (CAA) | ✅ | 35/35 | 380 | **100%** |
| narração (TTS) | ✅ | 35/35 | 380 | **100%** |
| índice falado dos menus | ✅ | 35/35 | 380 | **100%** |
| Libras | ✅ | 35/35 | 380 | **100%** |
| som (mestre + categorias) | ✅ | 35/35 | 380 | **100%** |
| simulação auditiva | ✅ | 35/35 | 380 | **100%** |
| alto contraste | ✅ | 35/35 | 380 | **100%** |
| correção de daltonismo | ✅ | 35/35 | 380 | **100%** |
| simulação visual | ✅ | 35/35 | 380 | **100%** |
| redução de movimento (cena) | ✅ | 35/35 | 380 | **100%** |
| controle virtual | ✅ | 33/35 | 363 | 96% |
| **tirar/esticar o tempo** | ❌ | **28/35** | **311** | **82%** |
| remapear teclas | ✅ | 22/35 | 236 | 62% |
| **tamanho do alvo** | ❌ | **19/35** | **231** | **61%** |
| redução de movimento (personagem) | ✅ | 14/35 | 155 | 41% |
| **um botão só** | ❌ | 12/35 | 135 | 36% |
| **dica / realce** | ❌ | 11/35 | 132 | 35% |
| **janela de acerto** | ❌ | 12/35 | 131 | 34% |
| alternância de marcha | ✅ | 12/35 | 128 | 34% |
| Modo Fácil | ✅ | 11/35 | 113 | 30% |
| **velocidade do texto** | ❌ | 6/35 | 69 | 18% |
| navegação sonora | ✅ | 6/35 | 67 | 18% |
| modo cego | ✅ | 6/35 | 67 | 18% |
| saída de áudio por jogador | ✅ | 6/35 | 66 | 17% |
| alternância do correr | ✅ | 4/35 | 42 | 11% |
| **dificuldade lexical** | ❌ | 4/35 | 41 | 11% |
| **intensidade (sustos, flashes)** | ❌ | 5/35 | 39 | 10% |
| **peças / baralhos alternativos** | ❌ | 3/35 | 39 | 10% |
| **assistência de traço** | ❌ | 3/35 | 28 | 7% |
| cadeira de rodas | ✅ | 3/35 | 27 | 7% |
| **balanço da câmara** | ❌ | 3/35 | 22 | 6% |
| **naipes distinguíveis** | ❌ | 2/35 | 24 | 6% |
| espaçamento da bengala | ✅ | 2/35 | 22 | 6% |
| **generosidade da detecção** | ❌ | 1/35 | 9 | 2% |

---

## 2 · O universal são ONZE, e a engine tem as onze

Onze acomodações têm sujeito nos trinta e cinco gêneros, e o argumento é o mesmo para todas: **há texto, há
som, há tela e há menu em qualquer jogo.** São elas que preenchem «opções gerais» do ADR-0146, e a boa
notícia deste estudo é que estão **todas construídas** — tipografia, caixa da letra, narração, índice falado,
Libras, som, simulação auditiva, alto contraste, correção de daltonismo, simulação visual e redução de
movimento de cena.

O controle virtual fica em 96% e não em 100% por uma razão que vale dizer: nos dois gêneros que sobram —
Digitação e Puzzle de Palavras — o dedo não substitui o teclado, porque **o teclado é o jogo**. Um pad de
direcionais ali seria o botão sem assunto que este estudo existe para evitar.

---

## 3 · O maior buraco da engine é o TEMPO, e não é perto

> **`semTempo` — 28 dos 35 gêneros, 311 dos 380 jogos, 82% do catálogo. A engine não tem nada.**

Oito painéis de ajustes, e **nenhum toca no tempo**. Uma criança com resposta motora mais lenta, ou que
precisa de mais um segundo para pensar, está hoje fora de quatro em cada cinco jogos do catálogo, e não há
interruptor em lado nenhum.

A família é maior do que uma entrada. Somando a **janela de acerto** (34%), o tempo aparece em três formas
diferentes que uma criança sente como a mesma coisa:

- **cronômetro** — o labirinto contra o tempo, o teste de WPM, o microgame de 5 segundos;
- **janela** — o Guitar Hero, o parry «no ms certo», o forno que queima;
- **ritmo do mundo** — a velocidade a que os inimigos, as peças ou a esteira andam.

📌 E a engine já decidiu esta pergunta uma vez, noutro eixo: o `padPxPerMm` ancora o alvo de toque em
**milímetros reais** por causa da WCAG 2.5.5. O tempo tem norma equivalente — **WCAG 2.2.1 «Timing
Adjustable»** — e nada a implementa.

---

## 4 · O segundo buraco é o TAMANHO DO ALVO, e a engine já sabe fazê-lo

> **`tamanhoDoAlvo` — 19 gêneros, 231 jogos, 61%. A engine não tem, e tem metade.**

O `input/touch` ancora os botões do pad em milímetros reais do aparelho (WCAG 2.5.5, `padPxPerMm`), com
classificação de mão e nove slots. Essa régua existe e aplica-se a **uma** superfície: o pad. As cartas, as
peças, os objetos escondidos, os alvos do aim trainer e os ladrilhos do match-3 não a conhecem.

Isso é mais barato de consertar do que parece, e é o candidato mais óbvio a **reusar** em vez de inventar.

---

## 5 · A cauda por gênero é real, e é pequena

O exemplo do Dev, quantificado: **cadeira de rodas está em 3 dos 35 gêneros — 27 jogos, 7% do catálogo**
(Platformer, Endless Runner e Isométrico, os três onde o avatar vence obstáculos verticais saltando). Montá-la
universalmente poria um interruptor sem assunto à frente de **93%** do catálogo.

E ela não está sozinha nessa cauda:

| acomodação | gêneros | onde |
|---|---|---|
| espaçamento da bengala | 2 | Platformer · Labirinto |
| naipes distinguíveis | 2 | Cartas · Cassino |
| balanço da câmara | 3 | Corrida · Pseudo-3D · Isométrico |
| peças alternativas | 3 | Cartas · Tabuleiro · Cassino |
| assistência de traço | 3 | Desenho · Sandbox · Experimentais |
| alternância do correr | 4 | Shooters · Platformer · Corrida · Pseudo-3D |
| generosidade da detecção | 1 | Stealth |

---

## 6 · ⚠️ O achado que mais me fez parar: o MODO CEGO é 6/35

E isso **não** quer dizer que uma criança cega alcança 18% do catálogo. Quer dizer que a engine tem **dois
mecanismos diferentes para a mesma pessoa**, e só um deles precisa de espaço:

- Onde há **mundo espacial** para atravessar — Platformer, Labirinto, Stealth, RPG, Terror, Arcade — ela
  navega por **bengala, sonar e guia**. São 6 gêneros e 67 jogos.
- Onde **não há espaço** — Cartas, Quiz, Digitação, Tabuleiro, Narrativo — ela joga pela **narração e pelo
  índice falado**, que são universais e já estão construídos.

🔴 **Logo o modo cego é do gênero e a narração é geral, e classificá-los juntos seria o erro simétrico ao da
cadeira de rodas:** dar bengala a um jogo de cartas é tão sem assunto quanto dar cadeira de rodas ao xadrez.
A cobertura para quem não enxerga continua a ser 100% — por dois caminhos, não por um.

---

## 7 · O que este estudo CORRIGE no ADR-0145 §4

O §4 daquele registo deu uma classificação inicial «como ponto de partida e não como resposta». O estudo
confirma-a quase toda e corrige um ponto:

| §4 dizia | o estudo mede | veredicto |
|---|---|---|
| navegação sonora é **geral** | **6/35 · 18%** | 🔴 **errado** — é do gênero, pela razão do §6 acima |
| simulação auditiva é geral | 35/35 | ✅ |
| simulação de baixa visão/daltonismo é geral | 35/35 | ✅ |
| tipografia, índice falado, narração são gerais | 35/35 | ✅ |
| cadeira de rodas é do gênero | 3/35 | ✅ |
| Modo Fácil (moedas no chão) é do gênero | 11/35 | ✅ |
| alternância de marcha e do correr são do gênero | 12/35 e 4/35 | ✅ |
| peças são do gênero (tabuleiro) | 3/35 | ✅ |
| **`umBotaoSo` ficou por classificar** | **12/35 · 36%** | **do gênero** |

📌 **O `umBotaoSo` resolve-se assim:** ele tem sujeito onde o jogo tem **mais de uma acção** *e* pressão de
tempo — Arcade, Shooters, Runner, Platformer, Esportes, Ritmo, Reação, Party, Luta, Multiplayer, Híbridos, e
os Experimentais onde «one-button games» já é um sub-gênero. Onde o jogo já é de um botão, ou é por turnos,
não há o que colapsar. E **a regra do que colapsa em quê é do gênero também**, que é a razão de ele não poder
ser geral mesmo tendo 36%.

---

## 8 · O que o Modo Fácil mostra sobre «traduzir» em vez de renomear

O Modo Fácil aparece em 11 gêneros, mas o que ele **significa** hoje é vocabulário de plataforma: «gravidade
menor, pulo mais alto, coleta tolerante, moedas no chão, sem perigos e sem quedas acidentais».

🎯 **É o caso que prova a forma que o Dev pediu.** A entrada chama-se «dificuldade» e é a mesma nos onze; o
que cada gênero declara é **o que ela faz lá dentro** — no Tower Defense é mais ouro inicial, no Tabuleiro é
uma IA mais rasa, no Runner é menos velocidade. Nada é renomeado: `easy` continua `easy` no `Player`, e o
que viaja por gênero é a tradução e o efeito.

---

## 9 · Por onde começar, se o critério for alcance

1. **`semTempo`** — 82%, e a engine não tem nada. É o maior buraco de acessibilidade do catálogo e tem norma
   própria (WCAG 2.2.1).
2. **`tamanhoDoAlvo`** — 61%, e metade já existe (`padPxPerMm`); é reuso, não invenção.
3. **`umBotaoSo`** (36%), **`dicaOuRealce`** (35%), **`janelaDeAcerto`** (34%) — o segundo grupo.
4. **`velocidadeDoTexto`** (18%) — pequena e barata, e é a única do grupo que serve quem lê devagar.
5. A cauda (2–11%), quando o gênero correspondente chegar.

⚠️ **E há uma coisa a fazer ANTES de qualquer uma delas**, que este estudo torna urgente: o
`ui/settings-motor` monta Modo Fácil, alternância de marcha e alternância do correr **para qualquer jogo**, e
os três medem 30%, 34% e 11%. Ele ainda não está ligado ao `createGame`; **ligá-lo antes da classificação
entregaria três interruptores sem assunto a dois terços do catálogo.**

---

## Como refazer

O cruzamento não é prosa: ele está escrito célula a célula, e a contagem é derivada. Para o repetir depois de
o catálogo mudar, ou para discordar de uma célula e ver o efeito, há cinco ficheiros:

- `scripts/lib/taxonomia.mjs` — o leitor do catálogo, a revisão fixada da Wikipédia e, por categoria, os
  géneros, a perspectiva, os jogadores e o propósito;
- `scripts/taxonomia-de-generos.mjs` — as guardas da taxonomia e a cobertura (secção 0);
- `scripts/lib/acomodacoes.mjs` — por categoria, os eixos da declaração (`DECL`); por acomodação, a sua
  chave (`ACOM`); as guardas e a medição do alcance;
- `scripts/acomodacoes-por-genero.mjs` — a tabela da secção 0.1;
- `scripts/acomodacoes-gag.mjs` — a classificação das directrizes da GAG por slug e a tabela da secção 0.2.

⚠️ Discordar de uma célula é editar **uma linha**: a declaração de uma categoria, ou a chave de uma
acomodação. ⚠️ **As guardas conferem FORMA, não verdade** — um eixo esquecido, um valor que casaria zero, uma
chave com dois eixos reprovam; uma categoria declarada com o valor errado passa, e é por isso que a coluna
«porquê» da 0.1 existe. A primeira versão (o mapa `EXTRA`, secções 1–9) está no histórico de `scripts/acomodacoes-por-genero.mjs` (`git log -p`).
