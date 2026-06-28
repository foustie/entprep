# «Банк вопросов» + «Теория» panels (2026-06-28)

Owner: the "ВСЕ ПРЕДМЕТЫ" subject list is barely visible; wants prominent dedicated
**Банк вопросов** (subject → раздел → questions) + **Теория** (конспект per раздел).

**Key finding:** the content + components already exist — `SubjectDetail` lists разделы with
question counts and starts practice per section (`nav('test', sid, sectionId)`); `TheorySummary`
renders per-раздел конспекты from `/data/summaries/<sid>.json` (present for all 14 subjects).
The work is **surfacing/navigation**, not rebuilding.

## Decisions (owner-approved)
- **Two distinct destinations** «Банк» + «Теория».
- **Desktop** left sidebar: Главная · Банк · Теория · План · Профиль · Прогресс (6).
- **Mobile** bottom nav: Главная · Банк · План · Профиль · Прогресс (5); «Теория» excluded
  from the bar (reached via a Главная card + a button inside Банк).

## Build (mostly reuse)
1. `SCREENS.BANK='bank'`, `SCREENS.THEORY='theory'` (constants/screens.ts).
2. `SubjectPicker` — extract the subject list (icon + per-subject question count) out of
   `CoachHome` into one reusable component; `onPick(sid)` differs per host.
3. `QuestionBank.tsx` — picker → `nav('topics', sid)` (existing `SubjectDetail`).
4. `Theory.tsx` — picker → renders `TheorySummary(sid,'_all')` (with a back-to-picker state),
   or navigates to a theory view. Reuses existing per-section конспект browsing.
5. `NAV_ITEMS` gains bank + theory; add a `desktopOnly?` flag → theory filtered out of the
   mobile bottom nav. App.tsx renders the two new screens; sidebar shows all, bottom shows the
   non-desktopOnly set.
6. `CoachHome`: replace the faint collapsible "ВСЕ ПРЕДМЕТЫ" with two prominent lead cards
   («Банк вопросов» → bank, «Теория» → theory). One bright splash respected.
7. Locales ru+kk: nav.bank, nav.theory, bank/theory screen titles, the two Home-card titles+subs.

## Verify
typecheck + lint + tests (NAV responsive split; bank→picker→SubjectDetail; theory→picker→
TheorySummary; home cards nav). Playwright both themes @390/1440. No prod deploy without
explicit per-action authorization.

## Out of scope (YAGNI)
No new content; no desktop split-pane master-detail (screen-based like mobile); План/duel untouched.
