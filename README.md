# Flexy Mini — Refine pilot

Standalone Refine + React + Vite application, designed for Supabase and GitHub Pages.

## Status
Scaffold only. **No authentication, CRUD resources, financial execution, or Station Connect integration is implemented yet.** No production data is modified.

## Local
```bash
npm install
cp .env.example .env.local
npm run dev
npm run build
```

Fill in only Supabase project URL and **publishable** key in `.env.local`. Never use a service-role or secret key in browser code. Before accessing real data, implement Supabase Auth and verify table-level RLS.

## Deployment
Vite base defaults to `/flexy-mini/`. GitHub Pages deployment can use GitHub Actions after build validation. Do not enable commercial transactions from this scaffold.

## Architecture
Refine (business UI) -> Supabase (auth/data/authorization) -> Station Connect (station jobs) -> Station Services (local hardware).

MyTool remains separate. Refer to `amordz72/developer/projects/flexy/FLEXY-FAST-LAUNCH-STARTER-DECISION-2026-10-10.md`.
