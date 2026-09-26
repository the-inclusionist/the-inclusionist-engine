# Objetivos de Aprendizagem

O alvo **mensurável** de cada atividade — o núcleo verificável da camada currículo (forma *aaa-threshold*: um objetivo
bem-formado é observável e tem critério de aprovação). Absorve o antigo `1-Discovery/SRS.md` (currículo não é software;
ver [ADR-0004](../2-Architecture/adr/ADR-0004-educational-documentation-subset.yaml)).

## Formato (Mager + BNCC)

Cada objetivo = **código BNCC** (id natural) + **comportamento** (verbo observável) + **condição** + **grau** (critério
de domínio). Padrão de domínio do projeto: **3 vitórias = 1 recompensa leve** (ADR-0006, sem picos de dopamina).

> ⚠️ **Códigos BNCC = rascunho, PARA REVISÃO DO DEV (pedagógico).** Marquei o que é plausível; confirme/corrija cada um.
> O comportamento/condição/grau é o que a atividade e a telemetria medem — esse eu rascunhei com confiança.

## Alfabetização (base psicogenética — Ferreiro & Teberosky; jogos alf1–alf6)

Progressão por hipótese da criança (ver [Pedagogical-Model.md](Pedagogical-Model.md) e
[alfabetizacao.idd.md](alfabetizacao.idd.md)).

| BNCC (confirmar) | Comportamento | Condição | Grau | Atividade |
|---|---|---|---|---|
| EF01LP02? | **distingue** a palavra escrita correta de distratores malformados | 3 palavras **soletradas** (não lidas); distratores Ferreiro (tamanho ≠ objeto, letras repetidas) | 3 vitórias | **alf1** Descobrindo palavras (pré-silábico) |
| EF01LP04? | **monta** a palavra escolhendo sílabas | sistema **lê** a sílaba sob o cursor (cego ou não) | forma a palavra (3×) | **alf2** Descobrindo sílabas (silábico c/ valor) |
| EF01LP04? / LP05? | **monta** a palavra; associa sílaba↔letras | grade de sílabas, sistema **soletra as letras** da sílaba | forma a palavra | **alf3** Montando palavras (silábico-alfabético) |
| EF01LP02? | **seleciona o grafema** ao ouvir o fonema | eSpeak modo fonema; hover diz o **nome** da letra | ≥ 80% (3×) | **alf4** Grafema e fonema (alfabético) |
| Braille grau 1 (norma própria) | **acha a letra** entre 8 e reconhece a cela | hover **soletra os pontos** da cela | acha a letra (3×) | **alf5** Malha de Braille |
| EF01LP07? / LP08? | **escreve** a palavra letra a letra | TTS diz a letra **só se ligado** | escreve certo (3×) | **alf6** Escrevendo palavras |

## Matemática (jogos já no menu)

| BNCC (confirmar) | Comportamento | Condição | Grau | Atividade |
|---|---|---|---|---|
| EF01MA06? | **resolve** adição/subtração | resposta = número **ou figura geométrica**, grade 3×3; sem negativo | 3 vitórias | **Soma-Sub** |
| EF03MA07? | **resolve** multiplicação (0–10) | toggles 0–10 (multiplicando ou multiplicador) | 3 vitórias | **Tabuada** |
| EF04MA? | **resolve** divisão exata (0–10) | divisor ≥ 1, quociente 0–10, divisão inteira | 3 vitórias | **Divisão** |
| EF05MA03? (frações) | **soma/subtrai** frações, resposta **simplificada** | 5 notações toggleáveis; denominadores ≤ 6; falada por extenso | 3 vitórias | **Frações** |

## Status

- [ ] **Dev revisa os códigos BNCC** e o mapeamento por etapa (ver [Curriculum-Map.md](Curriculum-Map.md)).
- [ ] Cada linha ganha uma `.feature` Gherkin de aceite em `../3-Sprint-Design/bdd/` (id = código BNCC).
- Alfabetização é currículo **por língua** → fica em pt; Matemática/Lúdico serão localizados (i18n, Fase 5).
