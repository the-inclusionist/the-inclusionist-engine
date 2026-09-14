# Instruções de uso — `catalogo_tipografico.json`

Documento endereçado ao modelo de linguagem que for ler, consultar ou editar este catálogo.
Leia inteiro antes da primeira operação.

---

## 1. O que este arquivo é

Um catálogo de 260 famílias tipográficas para uma engine de jogos educativos com foco em
acessibilidade e inclusão, dividido em duas camadas com funções **diferentes e não
intercambiáveis**.

- **Camada A** — leitura, instrução e interface. Carrega informação necessária para jogar.
- **Camada B** — display e tema. **Nunca** carrega informação necessária para jogar.

Os campos numéricos (`traco_mediano_px`, `arquivo_kb`, `cobertura`) foram **medidos**, não
estimados: vêm do `cmap` dos arquivos TTF e de rasterização local. O método está em
`_meta.metodo_traco`. Não recalcule de cabeça, não arredonde, não "corrija" por intuição visual.

## 2. O que este arquivo não é

- Não é um guia de estilo. Ele diz o que cada fonte **é**, não onde ela **deve** aparecer em
  cada tela.
- Não é uma lista de aprovação. `status: "ativo"` significa "aprovada para o catálogo", não
  "adequada para o uso que você está considerando agora".
- Não é fonte de verdade sobre licenciamento para redistribuição. O campo `licenca` é
  informativo; o `OFL.txt` de cada família é a autoridade.

---

## 3. Contrato de leitura

1. **Leia `_meta` antes de qualquer coisa.** Ele contém as duas regras de piso de tamanho, o
   método de medição e os avisos. Responder sobre o catálogo sem ter lido `_meta` produz erro.
2. **Use `id` como chave**, nunca `familia`. Nomes de família mudam de grafia; `id` é estável.
3. **Nunca infira propriedade a partir do nome da família.** Se você precisa saber se uma fonte
   tem acentos, leia `cobertura`. Se precisa saber a origem cultural, leia `origem_cultural`.
   O nome não é dado.
4. **`null` significa "não verificado", não "não existe".** Ver seção 7.

---

## 4. Regras duras

Estas não admitem exceção sem instrução explícita do José.

**R1 — Separação de camadas.** Nenhum item de `camada: "B"` pode ser o único portador de uma
informação necessária para jogar (nome de fase, enunciado, instrução, rótulo de botão, feedback
de acerto/erro). Se um texto em camada B carrega significado, o mesmo texto precisa existir em
camada A em algum caminho acessível.

**R2 — Piso de tamanho.** Nunca proponha, gere ou aprove uso de uma fonte abaixo do seu
`piso_tamanho_px`. O piso não é sugestão estética: para camada B ele deriva da largura de traço
medida, e abaixo dele a letra desaparece em antialias ou falha em contraste.

**R3 — Cobertura antes de composição.** Antes de compor qualquer string com uma fonte, verifique
`cobertura`:
- texto em português → exige `cobertura.pt_br: true`;
- qualquer string com `º` ou `ª` (`1º ano`, `3ª série`) → exige `cobertura.ordinais_masc_fem: true`;
- localização para polonês, tcheco, croata, húngaro, turco, eslovaco → exige
  `cobertura.latin_extended: true`.

`cobertura.glifos_ausentes` lista exatamente os caracteres faltantes. Use-o para gerar teste, não
para adivinhar.

**R4 — Status governa o uso.** São três, e não há estado intermediário: ou a fonte está no
catálogo, ou saiu com motivo registrado.
`"ativo"` = pertence ao catálogo.
`"removida"` = descartada, com `motivo`; **não a ressuscite** porque ela parece resolver um
problema — o `motivo` explica por que não resolve. Permanece no arquivo como histórico de decisão.
`"referencia_externa"` = licença proprietária, não empacotável; só como fallback de sistema.

**R5 — Escrita não-latina exige par de leitura.** Se um item de camada B com
`grupo: "escrita_nao_latina"` entrar em uso, o fallback Noto correspondente da camada A
(`papel: "fallback_escrita"`) entra junto. Display de uma escrita sem fonte de leitura daquela
escrita produz caixas vazias no texto ao redor.

**R6 — `uso_tecnico` é regra, não curiosidade.** Quando presente, o campo descreve comportamento
operacional obrigatório da família (ex.: a Playwrite Guides oculta as pautas no espaço e gera
folha pautada no sublinhado; a Press Start 2P não tem kerning). Leia antes de propor uso.

**R7 — Proveniência é imutável.** `origem_cultural`, `historia` e `designers` não são campos de
redação livre. Não reescreva, não resuma, não "melhore o texto", não traduza. Se achar que algum
está errado, **relate**, não corrija.

---

## 5. Procedimento de seleção

Quando precisar escolher uma fonte para um uso qualquer, execute nesta ordem. Não pule etapas e
não comece pelo gosto visual.

```
1. filtre  status == "ativo"
2. filtre  camada  == A se o texto carrega informação; B apenas se é ornamento
3. filtre  cobertura conforme o idioma e os caracteres da string real (R3)
4. filtre  piso_tamanho_px <= tamanho de renderização previsto
5. filtre  papel / grupo conforme a função pretendida
6. entre os que sobraram, desempate por arquivo_kb (menor) e por eixos_variaveis (ter é melhor)
7. se sobrar zero: relate o vazio e o filtro que zerou. Não relaxe R1–R4 para preencher.
```

O passo 7 é o mais importante. Um conjunto vazio é uma resposta legítima e informativa. Inventar
uma família fora do catálogo, ou rebaixar um piso para caber, é erro grave.

---

## 6. Antipadrões observados

Estes são os erros que modelos cometem com este arquivo. Verifique-se contra a lista antes de
responder.

| Antipadrão | Por que está errado |
|---|---|
| Usar fonte de `camada: "B"` em botão, enunciado ou rótulo | Viola R1. "Display" descreve o desenho, não autoriza o uso. |
| Deduzir a cultura de referência pelo nome da família | Foi exatamente assim que "Sankofa" virou "alien", "Ga Maamli" virou "pixação" e "Ruslan Display" virou "grafite". Leia `origem_cultural`. |
| Tratar `historia: null` como "não tem história" | É ausência de pesquisa verificada. Ver seção 7. |
| Preencher `historia` com plausibilidade | Proibido. Ver seção 7. |
| Reescrever o JSON inteiro para mudar um campo | Emita patch por `id`. Reescrita perde dados medidos. |
| Cortar uma fonte por traço fino sem checar `piso_tamanho_px` | O piso já resolve o problema. Cortar por hairline elimina Sankofa Display e Agu Display, as duas referências africanas do catálogo — a regra de acessibilidade e a meta de inclusão colidem aqui, e a resolução é o piso, não o corte. |
| Recomendar família que não está no catálogo | Proponha como adição em mensagem, com os campos medidos em branco e sinalizados como pendentes de medição. Não a escreva no arquivo por conta própria. |
| Usar display de escrita não-latina sem o Noto correspondente | Viola R5: o texto ao redor vira caixa vazia. |
| Ignorar `uso_tecnico` por parecer nota de rodapé | Viola R6. É lá que está "esta fonte não tem º e ª" e "esta não tem kerning". |
| Usar `descricao` como critério técnico | `descricao` é texto humano. Critério técnico está em `cobertura`, `traco_mediano_px`, `piso_tamanho_px`, `alertas`. |
| Assumir que `arquivo_kb` é o custo final | É o TTF completo. Após subsetar, muda. Ver `_meta.avisos`. |

---

## 7. Regra do `null` — não preencher por plausibilidade

88 entradas têm `historia: null`. Isso significa: **não foi encontrada informação verificada**.

Se você preencher esses campos, preencha **apenas** com informação que você possa atribuir a uma
fonte concreta, e registre a atribuição:

```json
"historia": "...",
"historia_fonte": "https://..."
```

Sem `historia_fonte`, o campo permanece `null`. Uma história tipográfica plausível e inventada é
pior do que campo vazio: ela é indistinguível da verdadeira depois de salva, e este catálogo
alimenta uma tela de créditos que crianças vão ler.

O mesmo vale para `origem_cultural`. Atribuir uma cultura errada a uma fonte é o dano específico
que este catálogo existe para evitar.

---

## 8. Limites de campo

Ao criar ou editar entradas, respeite:

| Campo | Limite | Regra |
|---|---|---|
| `descricao` | 150 caracteres | Obrigatório. O que a fonte **é** e o cuidado de uso. Não vender, não adjetivar. |
| `historia` | 250 caracteres | Opcional. Origem da fonte, designer, referência formal. |
| `origem_cultural` | 250 caracteres | Opcional. Só quando há referência cultural identificável e verificada. |
| `uso_tecnico` | 250 caracteres | Opcional. Comportamento operacional obrigatório. Quando presente, tem força de regra. |
| `motivo` | livre | Obrigatório quando `status` é `"removida"` ou `"referencia_externa"`. |
| `id` | — | `slug` ASCII em minúsculas do nome da família, `_` como separador. Imutável. |

Português brasileiro. Sem emoji. Sem markdown dentro dos campos.

---

## 9. Validação obrigatória após edição

Rode antes de devolver o arquivo. Se qualquer asserção falhar, corrija ou relate — não entregue.

```python
import json
d = json.load(open("catalogo_tipografico.json"))
f = d["fontes"]

assert len({i["id"] for i in f}) == len(f)                      # ids únicos
assert all(i["descricao"] and len(i["descricao"]) <= 150 for i in f)
assert all(not i["historia"] or len(i["historia"]) <= 250 for i in f)
assert all(not i["origem_cultural"] or len(i["origem_cultural"]) <= 250 for i in f)
assert all(not i.get("uso_tecnico") or len(i["uso_tecnico"]) <= 250 for i in f)
assert all(i["camada"] in ("A", "B") for i in f)
assert all(i["status"] in ("ativo","removida","referencia_externa") for i in f)
assert all(i["motivo"] for i in f if i["status"] in ("removida","referencia_externa"))
assert all(i.get("historia_fonte") for i in f
           if i["historia"] and i["id"] in NOVAS_HISTORIAS)     # seção 7
assert d["_meta"]["total"] == len(f)                            # _meta sincronizado
```

Atualize `_meta.total`, `_meta.por_camada` e `_meta.por_status` sempre que adicionar ou remover
entradas. `_meta` dessincronizado faz a próxima leitura partir de premissa falsa.

---

## 10. Fora do seu escopo

Proponha, não execute. Estas decisões são do José:

- mudar `status` de qualquer entrada;
- alterar `piso_tamanho_px` ou as regras de piso em `_meta`;
- editar `origem_cultural`, `historia` ou `designers` de entrada existente;
- remover entrada do arquivo (removidas permanecem, com `motivo` — o histórico de decisão é parte
  do valor do catálogo);
- adicionar família nova ao conjunto ativo.

Quando propuser, entregue o patch pronto por `id` e diga o que muda e por quê. Uma recomendação
resolvida com oportunidade de veto é melhor do que devolver o raciocínio para ele refazer.

---

## 11. Prompt condensado

Para colar como system prompt quando o contexto não comportar este documento inteiro:

> Você recebeu `catalogo_tipografico.json`, catálogo tipográfico de uma engine de jogos
> educativos inclusivos. Leia `_meta` primeiro. Duas camadas: A (leitura/interface, carrega
> informação) e B (display/tema, nunca carrega informação necessária para jogar). Regras
> invioláveis: nunca use fonte abaixo de `piso_tamanho_px`; verifique `cobertura` antes de compor
> qualquer string (português exige `pt_br`, textos com `º`/`ª` exigem `ordinais_masc_fem`,
> localização do Leste Europeu exige `latin_extended`); só `status: "ativo"` vai a produção.
> Campos numéricos foram medidos — não recalcule. `null` em `historia`/`origem_cultural` significa
> "não verificado": não preencha sem `historia_fonte` com URL. Nunca deduza origem cultural pelo
> nome da família e nunca reescreva `origem_cultural`, `historia` ou `designers` de entrada
> existente — relate erro em vez de corrigir. Ao selecionar fonte: filtre por status, camada,
> cobertura, piso e papel, nesta ordem; se o conjunto ficar vazio, diga qual filtro zerou em vez
> de relaxar uma regra. Proponha mudanças de status, piso e proveniência como patch por `id`;
> não as aplique sozinho. Se um item de camada B tem `grupo: "escrita_nao_latina"`, inclua junto o
> fallback Noto correspondente da camada A. `uso_tecnico`, quando presente, é regra obrigatória.
