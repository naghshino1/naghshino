# Architecture plan

## Product
Naghshino AI Company OS: an owner-supervised multi-agent company workspace.

## Roles
- CEO orchestrator: converts owner goals into plans, delegates tasks, checks results, prepares daily reports.
- Finance agent: budgets and financial analysis; read-only by default.
- Marketing agent: audience research, campaign plans, content calendar.
- Product & Sales agent: catalog, product research, sales funnel analysis.
- Operations agent: SOPs, task tracking, quality checks.
- R&D agent: competitor and technology research.
- Customer Support agent: classifies requests and drafts replies; human approval before sending.

## Execution lifecycle
Owner goal -> CEO plan -> task records -> department agent -> review -> owner approval when required -> execution -> audit log -> CEO report.

## Required backend services
- API server with authentication and role-based access control.
- Relational database for users, tasks, agent runs, approvals, and audit events.
- Model adapter with server-side API key storage.
- Queue/worker for long-running agent jobs.
- Tool adapters with least-privilege permissions.
- Observability, retries, rate limits, and budget caps.

## Non-negotiable safeguards
- No secrets in client-side code or public repository.
- No autonomous payments, account changes, public publishing, destructive actions, or customer sends without explicit owner approval.
- Every agent action must be attributable and logged.
- The CEO may propose and delegate; it cannot grant itself new permissions.

## MVP boundary
The current `index.html` is a static browser prototype. It does not implement the backend, persistent storage, or real AI calls.
