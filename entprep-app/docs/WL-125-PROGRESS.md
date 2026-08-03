# School-125 — local progress (no migrations / no Netlify yet)

Branch: `wl/125`  
Hosting choice: **A** (Netlify later + same Supabase, `tenant_id=125`).

## Plan tickets (code)

| Ticket | Status |
|--------|--------|
| feat(tenant): config + brand overrides + crest | Done |
| feat(auth): school seat premium + AI caps | Done |
| feat(teacher): nav + multi-class + kick/leave | Done |
| feat(school-content): import + assign | Done (needs migration to run live) |
| feat(proctor): soft events + teacher log | Done (needs migration to run live) |
| chore(deploy): domain + strip landing | Shell done; Netlify/DNS **blocked** until you say go |

## Local school preview

```bash
cd entprep-app
# Merge school vars into a local env (keep retail .env separate if needed):
cp .env.school125.example .env.school125.local
# Add VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from retail .env into that file,
# then: export $(grep -v '^#' .env.school125.local | xargs) && npm run dev
```

Brand assets: `public/tenant/125-crest.png`  
Sample import pack: `public/tenant/sample-school-pack.json` (Teacher → Свои тесты → upload)

## Still blocked (by request)

- [ ] Apply `20260803_school_questions.sql` + `20260803_proctor_events.sql`
- [ ] Netlify school site + DNS
- [ ] Real school domain in `VITE_APP_URL`
- [ ] Teacher email allowlist (optional)
- [ ] Customer’s real tests (sample pack is a stub)
- [ ] Teacher onboarding call (WS7)

## DoD stage 1 (from КП)

| Item | Local code | Live |
|------|------------|------|
| Brand, no ENTprep in school UI | Ready | Needs deploy |
| Full ENT + bank tests | Ready | Ready on shared Supabase |
| AI + duels without Premium | Ready (seats) | Ready |
| Teacher class + progress | Ready | Ready |
| Customer test imported | UI ready | Needs migration |
| Soft proctor journal | UI ready | Needs migration |
| Teacher onboarding | — | Later |
