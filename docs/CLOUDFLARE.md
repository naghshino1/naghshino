# Cloudflare Pages deployment

The static site is published from the repository root. The Pages Function in `functions/api/[[path]].js` adds an API at `/api/*`; it requires a Cloudflare D1 database binding named `DB`.

## One-time Cloudflare setup

1. In Cloudflare Dashboard, open **Workers & Pages** and select the `naghshino` Pages project.
2. Create a D1 database named `naghshino-db`.
4. In the Pages project's **Settings → Functions → D1 database bindings**, bind variable name `DB` to that database.
5. Add these server-side variables under **Settings → Variables and Secrets**:
   - `ADMIN_TOKEN`: a long random secret (Secret).
   - `AI_API_KEY`: optional model-provider key (Secret; required for real AI planning).
   - `AI_MODEL`: exact model identifier supported by the provider.
   - `AI_BASE_URL`: optional OpenAI-compatible API base URL; defaults to OpenAI.
6. Open the D1 database's **Console** and run the SQL in `migrations/0001_initial.sql`.
7. Trigger a new Pages deployment.

The API health check is `/api/health`. Authenticated endpoints use `Authorization: Bearer <ADMIN_TOKEN>`: `GET /api/agents`, `GET/POST /api/tasks`, `PATCH /api/tasks/:id`, `POST /api/ceo/plan`, and `GET /api/audit`.

## Important

- The Pages Function is a server-side API; do not put `ADMIN_TOKEN` or `AI_API_KEY` in HTML, browser storage, or Git.
- A D1 database ID is specific to the Cloudflare account and must be supplied by the account owner. The placeholder in `wrangler.toml` must be replaced before Wrangler-based deployment/migrations.
- AI planning is disabled until the owner configures a supported provider key and model. Hosting may be free within Cloudflare's current limits; model inference may cost money.
- This is an MVP planning API, not a fully autonomous agent team. External actions remain out of scope and require explicit owner approval.
