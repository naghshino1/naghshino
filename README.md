# Naghshino AI Company OS

A Persian RTL prototype for an AI-operated company control room.

## Current scope
- CEO control-room dashboard
- Six department roles: Finance, Marketing, Product & Sales, Operations, R&D, and Customer Support
- Task queue and company strategy view
- Human approval boundaries for sensitive actions
- AI provider configuration placeholder

## Important status
This repository currently contains a **front-end MVP/prototype**. The CEO and department agents are role definitions and UI demonstrations, not live autonomous AI agents. No model API is connected, no tasks are executed in the background, and task additions are session-only.

## Roadmap
1. Add a secure backend and database.
2. Add an AI provider adapter using server-side secrets (never expose API keys in browser code).
3. Implement CEO orchestration and department agent workflows.
4. Add task persistence, audit logs, budgets, and approval gates.
5. Connect approved business tools and integrations.
6. Add deployment and monitoring.

## Run locally
Open `index.html` in a browser. No build step is required.

## Safety
Require explicit owner approval before payments, publishing, deleting data, sending customer messages, or other irreversible/external actions.
