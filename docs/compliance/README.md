<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# `docs/compliance/` — the annual reports of §51.j

This directory holds one file per year:

```
relatorio-<year>.md      e.g. relatorio-2027.md
```

`scripts/check-annual-report.mjs` runs in CI and **fails the build when a year that owed a report has
none**. The record is [ADR-0053](../2-Architecture/adr/ADR-0053-the-annual-report-is-a-ci-gate-or-it-is-nothing.yaml);
the work item was issue #95.

## Why a gate and not a reminder

§51.j of the requerimento commits the project to publishing, every year, in its own repository, a report on
the observance of the eleven child-protection principles, "acompanhado de verificação técnica dos parâmetros
efetivamente implementados no código".

Of the twenty-two divergences found between the filed document and the ADRs, this was the **only obligation
that recurs**. Every other one is done once and stays done. This one is undone by the passage of time,
quietly, and by nobody's decision — and §51.j says so itself: *"compromisso sem prestação de contas periódica
degrada silenciosamente"*.

A calendar reminder can be dismissed and leaves no trace when it is. A red pipeline is evidence, and evidence
is what the requerimento promises a third party throughout.

## What a report contains

For each of the eleven principles of Anexo III:

1. the parameter **as implemented**,
2. **where it lives** in the code,
3. **the gate that holds it**.

Many of those gates are named in other records — the forbidden mechanics (ADR-0049), the score untouched by
accessibility (ADR-0048 §8) — so the report is largely an **index of gates that already run**. ⚠️ Not all of
them: the screen-time clock and the night window of ADR-0050 are **not built yet** (issue #94), so today they
belong in the report as holes, not as gates. The WCAG half of that index is kept in
[`accessibility-gates.md`](accessibility-gates.md).

A principle with **no** gate is supposed to show up here as a hole. That is the second thing the report is
for, and it is why writing it is a free audit of the audit.

## Arming the gate

The gate is **dormant** while no first year is known, and it says so on every CI run. ADR-0053 leaves the
start open on purpose: the first report is due for the first calendar year in which the systems are **in
use**, and no file in this repository knows that date.

Two ways it becomes armed:

- **Write the year into `PRIMEIRO-ANO`** (a file in this directory holding four digits and nothing else).
  This is how to arm it *before* the first report is due — the case ADR-0053 asks for by name, so that the
  first failure is a reminder rather than a discovery.
- **Write the first report.** Absent a declaration, the earliest `relatorio-<year>.md` present arms the gate.
  This exists so the obligation cannot be started and then dropped: writing the first report is itself what
  makes the second one mandatory.

Once armed, **every year from then to the current one** must have a file. The check looks backwards, not only
at the current year — otherwise a green run in 2028 would be reporting that the commitment was kept in 2027,
when nobody wrote anything.

## ⚠️ What the gate does not do

It checks that the file **exists**. It cannot judge whether the report is any good, and an empty file
satisfies it. ADR-0053 accepts this in writing — *"the gate buys the ritual, not the quality"* — and the
script says it out loud in its own success message, so that a green run is never read as conformity.
