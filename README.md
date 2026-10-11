# Flexy Mini — Refine pilot

Standalone Refine + React + Vite application, designed for Supabase and GitHub Pages.

## Status
Arabic responsive Refine + Ant Design dashboard and optional read-only Supabase Auth endpoint diagnostics are implemented. **No login, CRUD resources, financial execution, or Station Connect integration is implemented yet.** No production data is modified.

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

## Supabase diagnostic (v0.3.0)

The Settings screen can check reachability of Supabase Auth's public settings endpoint, without reading any database table or writing records. It does **not** prove database connectivity, table access, RLS or authenticated sessions. The public GitHub Pages deployment requires repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to be configured before the diagnostic can contact Supabase. Do not add service-role/secret keys. The existing `amor-manager` project may contain shared business data; do not automatically connect this pilot to its production tables. Prefer an isolated project or approved RLS-protected test resource after explicit review.
