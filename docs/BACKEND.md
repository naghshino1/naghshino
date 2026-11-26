# Backend foundation

The Node.js API provides persistent SQLite tasks, department role definitions, audit events, approval requests, and a CEO planning endpoint.

## Local setup
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set a long random `ADMIN_TOKEN`.
5. To enable AI planning, set `AI_API_KEY`, `AI_MODEL`, and optionally `AI_BASE_URL`.
6. Run `npm start`.

The server binds to 127.0.0.1 by default. Configure a trusted reverse proxy and HTTPS before remote access. Set `HOST=0.0.0.0` only behind an appropriately secured host/proxy.

## API
- `GET /api/health` — public health and AI configuration status.
- `GET /api/agents` — department roles (Bearer token).
- `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/:id` — task queue.
- `POST /api/ceo/plan` — ask the configured model to propose and save tasks.
- `POST /api/approvals`, `POST /api/approvals/:id/decision` — human approval queue.
- `GET /api/audit` — recent audit log.

All routes except health require `Authorization: Bearer <ADMIN_TOKEN>`. The CEO planner creates task proposals only; it does not execute external actions. Payments, publishing, account changes, customer messages, and destructive operations must remain behind explicit owner approval.

## Deployment boundary
GitHub Pages hosts only the static frontend. It cannot run this Node API. Deploy the backend separately to a trusted Node.js host with persistent disk and secret environment variables. Do not put API keys or admin tokens in the repository, frontend, or GitHub Pages.
