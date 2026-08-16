# Security Policy

*The Inclusionist* is an accessibility-first educational game **used by children** in Brazilian public
schools. We treat two classes of issue as top priority: **child-safety / privacy** (any leak or misuse of
student data — LGPD/COPPA) and classic **application security** (XSS, injection, insecure randomness, etc.).

## Reporting a vulnerability

**Please do not open a public issue for security problems.** Report it as a
**[confidential issue](https://gitlab.com/jrocha-dev/the-inclusionist/-/issues/new)** — tick
**“This issue is confidential…”** before submitting, which restricts it to project members until a fix ships.
If you cannot reach the tracker, email the maintainer instead; a report that arrives is worth more than a
report filed in the right place.

Include, when possible: affected version/commit, reproduction steps, impact, and any suggested remediation.
Reports about **exposure of children's data** are welcome even if you are unsure they qualify.

### What to expect

- **Acknowledgement:** within 5 business days.
- **Triage & severity:** we map to CVSS and to our non-negotiable pillars (child data privacy is critical
  regardless of CVSS). See `2-Architecture/adr/ADR-0017-compliance-and-data-governance.yaml`.
- **Fix window:** critical/high issues are prioritized over feature work.
- **Credit:** we credit reporters in the advisory unless you prefer to stay anonymous.

## Supported versions

This is a pre-1.0 project under active development; only the **latest `main`** (and the current Cloudflare
Pages deploy built from it) is supported. There are no back-ported security fixes for older tags.

## Scope notes

- The **VLibras** widget is a third-party gov.br embed (interim); issues in *that* widget should go to its
  upstream project, though we welcome a heads-up so we can mitigate on our side.
- Automated scanning is already in place: **CodeQL** (code scanning), **Dependabot** (dependency alerts +
  security updates), and **`npm audit`** in CI. This policy covers what those cannot catch.
