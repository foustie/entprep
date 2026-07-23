/**
 * Smoke: russian_lang + literature profile pair on local Vite.
 *
 * Requires:
 *   - Vite on SMOKE_URL (default http://127.0.0.1:5173)
 *   - .env.local with VITE_SUPABASE_* + SUPABASE_SERVICE_KEY (test-start gate needs login)
 *
 * Usage: node scripts/smoke-ru-lit.mjs
 */
import { chromium } from '../../marketing/demo-day-pitch/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, '.smoke-ru-lit');
mkdirSync(OUT, { recursive: true });

const BASE = process.env.SMOKE_URL || 'http://127.0.0.1:5173';
const SMOKE_EMAIL = process.env.SMOKE_EMAIL || 'smoke-ru-lit@entprep.org';
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD || 'SmokeRuLit2026!';

const log = (...a) => console.log('[smoke]', ...a);
const report = { ok: [], fail: [], notes: [] };
function pass(msg) { report.ok.push(msg); log('OK', msg); }
function fail(msg) { report.fail.push(msg); log('FAIL', msg); }

function loadEnvLocal() {
  const p = join(ROOT, '.env.local');
  if (!existsSync(p)) return {};
  return Object.fromEntries(
    readFileSync(p, 'utf8')
      .split('\n')
      .filter(l => l && !l.startsWith('#') && l.includes('='))
      .map(l => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
}

async function ensureSmokeSession() {
  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL;
  const anon = env.VITE_SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_KEY;
  if (!url || !anon || !service) {
    throw new Error('Need VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY in .env.local');
  }
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = listed?.users?.find(u => u.email === SMOKE_EMAIL);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email: SMOKE_EMAIL,
      password: SMOKE_PASSWORD,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    user = created.data.user;
    log('created smoke user', user.id);
  } else {
    const upd = await admin.auth.admin.updateUserById(user.id, {
      password: SMOKE_PASSWORD,
      email_confirm: true,
    });
    if (upd.error) throw upd.error;
  }
  const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: SMOKE_EMAIL,
    password: SMOKE_PASSWORD,
  });
  if (error) throw error;
  return data.session;
}

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  log('shot', name);
}

async function bodyText(page) {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ');
}

async function dismissAuthIfAny(page) {
  for (let i = 0; i < 3; i++) {
    const later = page.getByText(/^Позже$/).first();
    if (await later.isVisible().catch(() => false)) {
      await later.click();
      await page.waitForTimeout(600);
      log('dismissed auth Позже');
    } else break;
  }
}

const session = await ensureSmokeSession();
log('session ok', session.user.id);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'ru-RU',
  serviceWorkers: 'block',
});
const page = await context.newPage();
page.setDefaultTimeout(25000);

const consoleErrors = [];
page.on('pageerror', e => consoleErrors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

try {
  // Seed auth + profile before first paint so testGate sees a user.
  await page.addInitScript(({ sessionJson, profile }) => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('entprep_landing_seen', '1');
      localStorage.setItem('entprep_auth_prompted', JSON.stringify({
        count: 4,
        lastAt: Date.now(),
        histAtSkip: 0,
      }));
      localStorage.setItem('entprep-auth-v2', sessionJson);
      localStorage.setItem('entprep_data', JSON.stringify({
        hist: [],
        st: { exp: true, tmr: true, shf: true, lang: 'ru' },
        prof: profile,
        srCards: [],
        lastLogin: new Date().toISOString(),
      }));
    } catch {}
  }, {
    sessionJson: JSON.stringify(session),
    profile: ['russian_lang', 'literature'],
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  await dismissAuthIfAny(page);
  await shot(page, '20-home-authed');

  let text = await bodyText(page);
  log('home:', text.slice(0, 400));
  if (/Банк|Полный ЕНТ|Тренер|ENTprep/i.test(text) && !/Создайте аккаунт/i.test(text)) {
    pass('home loaded while signed in');
  } else {
    fail('home not ready / still on auth: ' + text.slice(0, 200));
  }

  // CDN integrity
  const fetchCheck = await page.evaluate(async () => {
    const urls = [
      '/data/literature_russian.ru.json',
      '/data/russian_lang.ru.json',
      '/data/literature_russian.meta.json',
      '/data/russian_lang.meta.json',
    ];
    const out = {};
    for (const u of urls) {
      const r = await fetch(u);
      const j = await r.json();
      out[u] = {
        status: r.status,
        len: Array.isArray(j) ? j.length : j.total,
        types: Array.isArray(j)
          ? j.reduce((a, q) => { a[q.type || 'single'] = (a[q.type || 'single'] || 0) + 1; return a; }, {})
          : j,
      };
    }
    return out;
  });
  writeFileSync(join(OUT, 'cdn-check.json'), JSON.stringify(fetchCheck, null, 2));
  const lit = fetchCheck['/data/literature_russian.ru.json'];
  const rl = fetchCheck['/data/russian_lang.ru.json'];
  if (lit?.status === 200 && lit.len >= 2000) pass(`literature_russian CDN ${lit.len}`);
  else fail(`literature_russian CDN bad: ${JSON.stringify(lit)}`);
  if (rl?.status === 200 && rl.len >= 800) pass(`russian_lang CDN ${rl.len}`);
  else fail(`russian_lang CDN bad: ${JSON.stringify(rl)}`);
  if (lit?.types?.matching >= 40 && lit?.types?.context >= 40) pass('literature type mix OK');
  else fail(`literature type mix weak: ${JSON.stringify(lit?.types)}`);
  if (rl?.types?.matching >= 40 && rl?.types?.context >= 40) pass('russian_lang type mix OK');
  else fail(`russian_lang type mix weak: ${JSON.stringify(rl?.types)}`);

  // Bank → Literature → Exam
  await page.getByText(/^Банк$/).first().click();
  await page.waitForTimeout(800);
  text = await bodyText(page);
  if (/Литература/.test(text) && /Русский язык/.test(text)) pass('Bank shows both subjects');
  else fail('Bank missing subjects: ' + text.slice(0, 300));
  await shot(page, '21-bank');

  await page.getByText(/^Литература$/).first().click();
  await page.waitForTimeout(1500);
  text = await bodyText(page);
  log('lit detail:', text.slice(0, 500));
  if (/8\s/.test(text) || /секц/i.test(text)) pass('Literature SubjectDetail open');
  await shot(page, '22-lit-detail');

  await page.getByText(/Экзамен ЕНТ/i).first().click();
  await page.waitForTimeout(3500);
  await dismissAuthIfAny(page);
  await page.waitForTimeout(500);
  text = await bodyText(page);
  await shot(page, '23-lit-exam');
  log('lit exam:', text.slice(0, 500));
  const examOk = !/Создайте аккаунт/i.test(text) && (
    /A\)|B\)|вариант|Выберите|Установите|\?|Вопрос|из\s+\d+/i.test(text)
  );
  if (examOk) pass('Literature exam started with questions');
  else fail('Literature exam did not start: ' + text.slice(0, 250));

  // Back home → Full ENT
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await dismissAuthIfAny(page);

  const fullEnt = page.getByText(/Полный ЕНТ/i).first();
  if (await fullEnt.isVisible().catch(() => false)) {
    await fullEnt.click();
  } else {
    // CoachHome may use different label — try nav / common CTAs
    const alt = page.getByText(/Полный|симуляц|ЕНТ/i).first();
    await alt.click({ timeout: 10000 });
  }
  await page.waitForTimeout(3000);
  await dismissAuthIfAny(page);
  text = await bodyText(page);
  await shot(page, '24-fullent-lobby');
  log('fullent lobby:', text.slice(0, 700));

  const onLoginWall = /Создайте аккаунт/i.test(text);
  const notEnough = /Недостаточно|not enough|мало вопрос/i.test(text);
  if (onLoginWall) fail('Full ENT blocked by login wall');
  else if (notEnough) fail('Full ENT: not enough questions');
  else if (/Русский язык/i.test(text) && /Литература/i.test(text) && /НАЧАТЬ ЕНТ/i.test(text)) {
    pass('Full ENT lobby shows RU+LIT profile sections');
  } else {
    fail('Full ENT lobby missing pair labels: ' + text.slice(0, 250));
  }

  if (/НАЧАТЬ ЕНТ/i.test(text)) {
    await page.getByText(/НАЧАТЬ ЕНТ/i).first().click();
    await page.waitForTimeout(8000);
    text = await bodyText(page);
    await shot(page, '25-fullent-q1');
    log('fullent q1:', text.slice(0, 500));
    const live = /Пауза|Завершить ЕНТ|0\/120|ВОПРОС|#\d+\/\d+/i.test(text)
      && /A\s|A\)|\bA\b/.test(text)
      && !/Создайте аккаунт/i.test(text);
    if (live) pass('Full ENT started — live question + timer');
    else fail('Full ENT start failed: ' + text.slice(0, 250));
  }

  if (consoleErrors.length) {
    report.notes.push('console errors: ' + consoleErrors.slice(0, 8).join(' | '));
  } else {
    pass('no pageerrors');
  }
} catch (e) {
  fail('uncaught: ' + (e.stack || e.message));
  await shot(page, '99-error').catch(() => {});
} finally {
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}

console.log('\n=== SMOKE SUMMARY ===');
console.log('PASS', report.ok.length);
report.ok.forEach(m => console.log('  ✓', m));
console.log('FAIL', report.fail.length);
report.fail.forEach(m => console.log('  ✗', m));
if (report.notes.length) console.log('NOTES', report.notes);
process.exit(report.fail.length ? 1 : 0);
