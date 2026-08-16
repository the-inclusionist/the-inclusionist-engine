# Backend & Cloud — adoption roadmap (study, !1)

The staged plan for when/if a backend is needed. It parks the deferred infra artifacts (Terraform, Platform Playbook,
OpenTelemetry, Canary/Argo) with a **home + a trigger**, and now with **concrete service choices, cost bands, and the
telemetry decision**. Cost bands are order-of-magnitude (USD/month, `sa-east-1`) — **confirm current pricing at
[aws.amazon.com/pricing](https://aws.amazon.com/pricing/)** before committing.

## Why staged (not "K8s now")

We have no backend today. Standing up Kubernetes/observability/IaC now is cost with no asset to run on it. Rule: adopt
the next step only when a concrete need crosses its threshold, and record the step as an **ADR**.

## The two-track constraint (LGPD first)

- **Sensitive track (child PII, Student Manager, telemetry):** stays **self-hosted / on-prem / LAN** (Nakama), or at
  most a **Brazilian region** (`sa-east-1`, São Paulo) for residency. Never third-party SaaS analytics.
- **Scale track (game delivery, aggregate/anonymised):** may live on managed cloud freely.

The front-end can scale on AWS while the child-data backend stays self-hosted. `DFD.md` draws the boundary; `STRIDE.md`
guards each crossing; the RN-01..04 rules are in `adr/ADR-0017`.

## Stages (concrete)

| # | Trigger | Infra | AWS services (`sa-east-1`) | ~USD/mo* | SDD docs that activate |
|---|---|---|---|---|---|
| **0** | now | static PWA | Cloudflare Pages | ~0 | — |
| **1** | first logged-in users / school pilot | single Nakama node + Postgres | **Lightsail** or **EC2 t3.small** + Postgres on-box (or **RDS t3.micro**) | **~$10–50** | ADR (Nakama) · `1-Discovery/Event-Storming.md` · `DFD.md` · `STRIDE.md` |
| **2** | data must survive / be backed up / shared across a school | managed data + storage | **RDS Postgres** (t3.micro→small) · **S3** · **CloudFront** | **~$50–120** | **Terraform** (IaC + secrets) · C4 **Level 2** |
| **3** | one node can't hold load; multiple services | containers, no orchestration | **ECS / Fargate** (+ RDS) | **~$100–250** | OpenTelemetry (app traces) · basic runbook |
| **4** | fleet + zero-downtime + multi-service ops | Kubernetes | **EKS** (control plane ~$73 + EC2 nodes) | **~$250–600+** | **Platform Playbook** · **Canary/Argo** · full OTel + dashboards · SRE runbooks |

\* Order of magnitude, `sa-east-1`, confirm current pricing. **Most projects never reach stage 3–4.**

## Concrete answers (the !1 research)

- **Nakama footprint / how many schools per node?** Dev = 1 vCPU / 1GB; production small = **2 vCPU / 2–4GB** VPS
  handles small games/prototypes; a single node serves **~700 req/s** (mean 28ms) and scales horizontally behind a load
  balancer. Educational activities are low-frequency (turn-based + store-and-forward telemetry), so **one small node +
  managed Postgres comfortably covers the first schools** — self-hostable for **~$10/mo**. Nakama needs Postgres-wire
  (Postgres or CockroachDB), run on a separate node in production. → **stage 1 is cheap; scale is a later problem.**
- **`sa-east-1` vs on-prem for LGPD?** Both keep data in Brazil (residency ✓). On-prem/LAN = maximum control + the
  offline/LAN pillar (P9); `sa-east-1` = managed durability without leaving BR. **Decision is a future compliance ADR**
  (likely: sensitive data on-prem/school-server per ADR-0005 v2.0; `sa-east-1` only if a school lacks its own server).
- **Cost curve:** see the bands above — stage 1 ~$10–50/mo, roughly doubling per stage; the EKS jump (stage 4) is the
  first big step (~$73/mo just for the control plane) and is why it's gated hard.
- **Telemetry standard (shapes the stage-1 data model):** **xAPI first.** It is offline-capable (fits the
  store-and-forward pillar P9) and pillar-committed (P6). Caliper only if tight LMS analytics interop is later needed;
  **LTI 1.3** for LMS-launch. Detail + the xAPI-vs-Caliper trade in `learning-interop.md` (ADR-0004). The xAPI statement
  schema drives the Nakama data model at stage 1; offline resend needs idempotency (`../7-Async-Systems/`).

Sources: [Nakama (Heroic Labs)](https://github.com/heroiclabs/nakama) · [Nakama benchmarks](https://heroiclabs.com/docs/nakama/getting-started/benchmarks/) · [Host Nakama for $10/mo](https://www.snopekgames.com/tutorial/2021/how-host-nakama-server-10mo/) · [AWS pricing](https://aws.amazon.com/pricing/).
