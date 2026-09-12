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

1. **Re-chavear as acomodações pelos eixos certos** — cada uma com UMA chave: género, perspectiva, modo de
   jogadores ou propósito. É o que faz as divergências de `balancoDaCamara` e `saidaDeAudio` desaparecerem
   antes de serem escritas.
2. **Semear o catálogo de acomodações pela GAG**, percorrendo as três camadas (Basic → Intermediate →
   Advanced) e os seis eixos — com **duas colunas de prioridade**, alcance medido e nível GAG.

> ⚠️ **As secções 1–9 abaixo continuam a valer como MEDIÇÃO** — os números por categoria são o que são. O que
> muda é que a categoria deixa de ser tratada como género, e as conclusões que dependiam disso são refeitas
> no passo 1 acima.

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
o catálogo mudar, ou para discordar de uma célula e ver o efeito, o ficheiro de classificação tem o mapa
`EXTRA` — um gênero por linha, com as acomodações que lhe **acrescem** aos onze universais — e imprime a
tabela do §1 inteira. ⚠️ Ele confere também que nenhum gênero ficou sem classificação, que nenhuma
classificação aponta para um gênero que não existe e que nenhuma lista repete um universal; sem essas três
guardas, uma célula esquecida aparece como «não se aplica» e ninguém dá por ela.
