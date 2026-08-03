## Brand assets (local, no deploy yet)
- Crest: `public/tenant/125-crest.png`
- Favicon: `public/tenant/125-favicon.png`
- Apple touch: `public/tenant/125-icon-180.png`
- Palette: gold `#F5C518`, navy from crest (~`#0B2A5B`)
- Env template: `.env.school125.example`

## Site
1. Create a second Netlify site from branch `wl/125` (or main after merge) — **later**
2. Load env from `.env.school125.example`
3. Custom domain → school DNS CNAME to Netlify — **later**

## Database — **later**
Apply migrations (order):
- `20260803_school_questions.sql` (WS5)
- `20260803_proctor_events.sql` (WS6)

Same Supabase project as retail; isolate with `tenant_id='125'`.

## Local preview (no Netlify)
```bash
cp .env.school125.example .env   # plus real VITE_SUPABASE_* if needed
npm run dev
```

## Smoke (UAT) — after deploy
- [ ] Opens on school domain; BrandMark shows crest + «Школа 125»
- [ ] No retail Landing / no 2990₸ paywall for signed-in school seat
- [ ] Full ENT + subject test + AI tutor + duel work
- [ ] Teacher: Settings → teacher panel; class code; roster
- [ ] Import + assign one school pack; student runs via customQs
- [ ] Soft proctor logs tab-away; teacher sees journal

## Rollback
Point DNS back / disable Netlify site; retail `entprep.org` untouched.
