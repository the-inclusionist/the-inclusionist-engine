# Teste de campo — Multilaser M7 3G Plus + uma criança

> 📌 **Em pt-BR por excepção declarada** (`CLAUDE.md` §0): é roteiro operacional lido **em campo**, e as frases
> ditas à criança são conteúdo, não artefacto. O resto da papelada de teste continua em inglês
> (`Test-Plan.md`).

**Aparelho:** Multilaser M7 3G Plus, comprado pela **Prefeitura de Monte Aprazível em 2019**.
⚠️ **Isto não é um aparelho parecido com o alvo — é o alvo.** O pilar 1 diz «hardware de escola pública BR», e
até hoje ele era uma hipótese. Passa a ser um aparelho com número de património.

**Cobre:** issue #8 (validação em hardware-alvo) e a metade da #7 que precisa de uma criança. ⚠️ **NÃO cobre a
#112** — a tela que avisa antes de começar **não existe ainda**; o que se colhe aqui é o material para
escrevê-la.

---

## PARTE 0 · Antes de ligar o aparelho (5 min)

- [ ] **Autorização de quem cuida da criança**, dita em voz alta e anotada aqui: quem autorizou, quando.
      ⚠️ **Nada de foto, vídeo ou gravação de voz.** As notas descrevem o que a criança FEZ, e não quem ela é.
      Sem nome no ficheiro — use «a criança», e a idade em anos.
- [ ] **Idade:** ______  **Já usou tablet antes?** ( ) nunca ( ) às vezes ( ) todos os dias
- [ ] **Alguma necessidade específica conhecida?** (o senhor decide se registra; se não registrar, escreva
      «não registrado» em vez de deixar em branco — em branco lê-se como «não tem»)

---

## PARTE 1 · O aparelho, sem a criança (15 min)

Isto é medição, e é o que torna a sessão com a criança interpretável depois. **Anote os valores, não «ok».**

| o que | onde | anotar |
|---|---|---|
| Versão do Android | Config → Sobre o tablet | ______ |
| Versão do **Chrome** | Chrome → ⋮ → Configurações → Sobre o Chrome | ______ |
| Resolução da tela | Config → Sobre / ou `chrome://gpu` | ______ |
| Memória RAM | Sobre o tablet | ______ |

### ⚠️ A medição que decide uma promessa da engine

O **ADR-0065** assume que a voz do sistema pode não existir em português num aparelho de escola. **Este é o
aparelho para descobrir.** No Chrome do tablet, abra `chrome://version` e depois teste a voz:

- [ ] Config → Acessibilidade → **existe TalkBack?** ( ) sim ( ) não
- [ ] Config → Idiomas → **Saída de texto para voz** → há **voz em português**? ( ) sim ( ) não
      **Qual motor?** ______________ (Google TTS? Multilaser? nenhum?)
- [ ] Se houver, toque em «Ouvir um exemplo» e anote: **dá para entender?** ( ) sim ( ) mais ou menos ( ) não

📌 **Se NÃO houver voz pt-BR neste aparelho, isso sozinho justifica os ~244 MB das quatro vozes neurais** —
que é a decisão do ADR-0110, hoje sustentada por uma suposição.

---

## PARTE 2 · Pôr o jogo no tablet

⚠️ **Não há deploy ligado** (nenhum projeto do Cloudflare Pages está conectado). O caminho é servir do seu PC
para a rede local:

```bash
npm --prefix C:\Users\candi\Claude\SP-the-inclusionist-tracer run build
```

```bash
npm --prefix C:\Users\candi\Claude\SP-the-inclusionist-tracer run preview -- --host
```

O `--host` faz o servidor aceitar a rede local. Ele imprime um endereço `http://192.168.x.x:PORTA` — **abra
esse endereço no Chrome do tablet**, com os dois na mesma Wi-Fi.

- [ ] **Abriu?** ( ) sim ( ) não → se não, anote o erro exacto: ______________
- [ ] **Quanto tempo até aparecer alguma coisa na tela?** ______ segundos (conte em voz baixa, não precisa de
      cronómetro)

### O teste do primeiro dia, se der para fazer

📌 O senhor decidiu esta madrugada: **«PWA no primeiro dia ONLINE, depois OFFLINE-FIRST»**. O M7 tem 3G, então
dá para provar:

- [ ] Com Wi-Fi, abra o jogo e deixe carregar até jogar.
- [ ] **Desligue a Wi-Fi E os dados.** Feche o Chrome. Abra outra vez no mesmo endereço.
- [ ] **Funcionou sem rede?** ( ) sim ( ) não ( ) parcialmente: ______________

⚠️ Se não funcionar, **não é falha da criança nem do aparelho** — é o precache, e é exactamente o que os gates
desta madrugada existem para vigiar. Anote e siga.

---

## PARTE 3 · A sessão com a criança (20–30 min)

### As três regras, e a terceira é a difícil

1. **Não ensine.** Entregue o tablet e diga só: **«Dá uma olhada e vê o que dá pra fazer.»**
2. **Não corrija.** Se ela fizer «errado», isso É o resultado.
3. ⚠️ **Não pergunte se ela gostou.** Pergunte o que ela FEZ. *(É o Mom Test: «gostei» não é dado; «tentei
   apertar aqui três vezes» é.)*

### O que observar, sem interromper

Anote **o que aconteceu**, com o minuto aproximado:

| minuto | o que a criança fez | o que o jogo respondeu |
|---|---|---|
| | | |
| | | |
| | | |

### As cinco perguntas que este teste existe para responder

**1 · A barra de acessibilidade foi encontrada?**
- [ ] Ela tocou nos ícones do topo **sem ninguém apontar**? ( ) sim ( ) não
- [ ] Se tocou, **em qual primeiro**? ______________
- [ ] Se não tocou em nenhum em 10 minutos, anote isso — **é o resultado mais importante da sessão.**

**2 · O texto dá para ler nesse tamanho?**
- [ ] Ela aproximou o tablet do rosto? ( ) sim ( ) não
- [ ] Ela apertou os olhos? ( ) sim ( ) não
- [ ] Pergunte no fim, apontando para uma palavra: **«O que tá escrito aqui?»** — e anote se ela leu, hesitou
      ou não conseguiu: ______________

📌 Isto mede o `minPx` do #87 item 2 contra uma tela de verdade, e não contra um número numa tabela.

**3 · O toque responde?**
- [ ] Algum toque dela **não fez nada**? ( ) sim ( ) não → o quê: ______________
- [ ] Ela conseguiu usar **dois dedos ao mesmo tempo**? ( ) sim ( ) não ( ) não tentou
      *(o ADR-0104 §B fixou o piso em DOIS pontos; este aparelho é onde isso se confirma)*

**4 · A voz falou, e ela entendeu?**
- [ ] Ligue o leitor de tela pelo ícone da barra e observe: ela **parou para ouvir**? ( ) sim ( ) não
- [ ] Depois pergunte: **«O que a voz falou?»** — e anote a resposta dela **com as palavras dela**:
      ______________
      ⚠️ Se ela repetir errado, **a frase é que está errada**, não ela.

**5 · A frase da #112, que ainda não existe**
Esta é a colheita, não a verificação. Em algum momento, pergunte:

> **«Se um jogo precisasse de mais botões do que esse tablet tem, como é que ele devia te avisar?»**

Anote a resposta **em português dela, sem corrigir**: ______________

📌 É daqui que sai o texto da tela do #112 — o gate está construído há semanas e a **frase** é o que falta.

---

## PARTE 4 · Depois (5 min, antes de esquecer)

- [ ] **A coisa que mais me surpreendeu:** ______________
- [ ] **O momento em que ela travou:** ______________
- [ ] **Uma coisa que eu ia jurar que funcionava e não funcionou:** ______________
- [ ] **Duração real da sessão:** ______ min · **ela quis continuar?** ( ) sim ( ) não

⚠️ **Se a sessão acabar em 5 minutos porque ela perdeu o interesse, isso é um resultado completo.** Anote e
não repita no mesmo dia.

---

## O que fazer com estas notas

Cole a folha preenchida como comentário nas issues, dividida assim:

| parte | issue |
|---|---|
| PARTE 1 (aparelho, voz do sistema) | [#8](https://github.com/the-inclusionist/the-inclusionist-engine/issues/8) |
| PARTE 2 (primeiro dia / offline) | [#8](https://github.com/the-inclusionist/the-inclusionist-engine/issues/8) |
| PARTE 3 perguntas 1–4 | [#7](https://github.com/the-inclusionist/the-inclusionist-engine/issues/7) |
| PARTE 3 pergunta 5 (a frase) | [#112](https://github.com/the-inclusionist/the-inclusionist-engine/issues/112) |

📌 **Não precisa de organizar nem resumir.** Cole cru, com os «não sei» e os campos vazios — um campo vazio
diz que não deu para medir, e isso é informação. Eu leio e transformo em trabalho.
