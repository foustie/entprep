#!/usr/bin/env node
/**
 * Split "literature" → "literature_russian" / "literature_kazakh" in Supabase.
 * Pure keyword-based — no AI needed.
 *
 * Usage:
 *   node scripts/split-literature.mjs              # dry run
 *   node scripts/split-literature.mjs --commit      # write to Supabase
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_KEY required");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const commit = process.argv.includes("--commit");

// ── Kazakh literature keywords ────────────────────────────────────────────
// If ANY of these appear in question text or options → kazakh
const KZ_AUTHORS = [
  "Абай", "Абая", "Абаю", "Абаем",
  "Кунанбаев", "Құнанбаев",
  "Ауэзов", "Әуезов", "Мұхтар",
  "Сулейменов", "Сүлейменов",
  "Байтурсынов", "Байтұрсынов", "Байтұрсын",
  "Сейфуллин", "Сәкен", "Сейфулин",
  "Мусрепов", "Мүсірепов",
  "Аймауытов", "Жүсіпбек",
  "Айтматов", // хоть киргиз, но изучается в казахской программе
  "Магжан", "Жумабаев", "Жұмабаев",
  "Шакарим", "Құдайберді",
  "Мухтар", "Шаханов",
  "Олжас", "Сүлейменов",
  "Дулат", "Бабатай",
  "Жамбыл", "Жабаев",
  "Ибрай", "Алтынсарин",
  "Шоқан", "Уәлиханов", "Валиханов",
  "Ыбырай",
  "Тоқтар", "Әуезов",
  "Нұрпейіс",
  "Қасым", "Аманжолов",
  "Сырбай", "Мәуленов",
  "Төлеген", "Айбергенов",
  "Мұқағали", "Макатаев",
  "Айманов", "Шәкен",
  "Қабдеш", "Жұмаділов",
  "Шерхан", "Мұртаза",
  "Тахауи", "Ахтанов",
  "Ғабит", "Мүсірепов",
  "Ілияс", "Жансүгіров",
  "Бейімбет", "Майлин",
  "Сәбит", "Мұқанов",
  "Ғабиден", "Мұстафин",
];

const KZ_THEMES = [
  "казахск", "қазақ",
  "жырау", "жыр", "айтыс",
  "батыр", "ертегі",
  "Қорқыт", "Коркыт",
  "кочев", "көшпелі",
  "номад", "жұмбақ",
  "степ", "дала",
  "Орда", "ханств",
  "Тюрк", "түрік",
  "эпос.*казах", "казах.*эпос",
  "Кобланды", "Қобыланды",
  "Козы-Корпеш", "Қозы Көрпеш",
  "Баян.*Сұлу", "Қыз Жібек",
  "Алпамыс", "Алпамыш",
];

const RU_AUTHORS = [
  "Пушкин", "Лермонтов", "Гоголь", "Толстой", "Достоевск",
  "Чехов", "Тургенев", "Некрасов", "Грибоедов", "Фонвизин",
  "Карамзин", "Жуковск", "Крылов", "Островск",
  "Гончаров", "Салтыков", "Щедрин",
  "Блок", "Есенин", "Маяковск", "Ахматов", "Цветаев",
  "Пастернак", "Бунин", "Куприн", "Горьк",
  "Булгаков", "Шолохов", "Солженицын", "Твардовск",
  "Распутин", "Астафьев",
  "Державин", "Ломоносов", "Радищев",
  "Тютчев", "Фет", "Баратынск",
  "Гомер", "Шекспир", "Данте", "Мольер", "Байрон",
  "Бальзак", "Диккенс", "Флобер", "Гюго",
];

const RU_THEMES = [
  "русск", "россий",
  "славян", "православ",
  "Петербург", "Москв",
  "Онегин", "Печорин", "Чацкий", "Базаров",
  "Раскольников", "Обломов", "Чичиков",
  "Мёртвые души", "Мертвые души",
  "Война и мир", "Преступление и наказание",
  "Евгений Онегин", "Герой нашего времени",
  "Вишнёвый сад", "Вишневый сад",
  "Ревизор", "Шинель", "Нос",
  "Горе от ума", "Недоросль",
  "Мцыри", "Демон",
  "серебряный век", "золотой век",
  "классицизм", "сентиментализм", "романтизм.*русск",
];

function classify(question) {
  const text = `${question.q} ${(question.o || []).join(" ")}`.toLowerCase();

  let kzScore = 0;
  let ruScore = 0;

  // Check Kazakh markers
  for (const kw of KZ_AUTHORS) {
    if (text.includes(kw.toLowerCase())) kzScore += 3;
  }
  for (const kw of KZ_THEMES) {
    if (kw.includes(".*")) {
      if (new RegExp(kw, "i").test(text)) kzScore += 2;
    } else if (text.includes(kw.toLowerCase())) {
      kzScore += 2;
    }
  }

  // Check Russian markers
  for (const kw of RU_AUTHORS) {
    if (text.includes(kw.toLowerCase())) ruScore += 3;
  }
  for (const kw of RU_THEMES) {
    if (kw.includes(".*")) {
      if (new RegExp(kw, "i").test(text)) ruScore += 2;
    } else if (text.includes(kw.toLowerCase())) {
      ruScore += 2;
    }
  }

  if (kzScore > ruScore) return "literature_kazakh";
  if (ruScore > kzScore) return "literature_russian";

  // Default: if no markers found, classify as Russian (larger corpus)
  return "literature_russian";
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📚 Literature Split [${commit ? "COMMIT" : "DRY RUN"}]\n`);

  // Fetch all literature questions
  let rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from("questions")
      .select("id, q, o, topic")
      .eq("subject", "literature")
      .order("idx", { ascending: true })
      .range(from, from + 999);
    if (error) {
      console.error("Fetch error:", error.message);
      break;
    }
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }

  console.log(`Total literature questions: ${rows.length}\n`);

  const results = { literature_russian: [], literature_kazakh: [] };
  const unclassified = [];

  for (const row of rows) {
    const cls = classify(row);
    results[cls].push(row.id);
  }

  console.log(`literature_russian: ${results.literature_russian.length}`);
  console.log(`literature_kazakh:  ${results.literature_kazakh.length}`);

  // Show some samples
  const sampleKz = rows
    .filter((r) => results.literature_kazakh.includes(r.id))
    .slice(0, 5);
  const sampleRu = rows
    .filter((r) => results.literature_russian.includes(r.id))
    .slice(0, 5);

  console.log("\n--- Sample Kazakh ---");
  for (const q of sampleKz)
    console.log(`  ${q.q.substring(0, 80)}`);

  console.log("\n--- Sample Russian ---");
  for (const q of sampleRu)
    console.log(`  ${q.q.substring(0, 80)}`);

  if (!commit) {
    console.log("\nDry run — use --commit to apply changes");
    return;
  }

  // Commit: update subject field
  for (const [newSubject, ids] of Object.entries(results)) {
    if (ids.length === 0) continue;
    let ok = 0,
      fail = 0;
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500);
      const { error } = await sb
        .from("questions")
        .update({ subject: newSubject })
        .in("id", batch);
      if (error) {
        console.error(`FAIL ${newSubject}: ${error.message}`);
        fail += batch.length;
      } else {
        ok += batch.length;
      }
    }
    console.log(`\n✅ ${newSubject}: ${ok} updated${fail ? `, ${fail} failed` : ""}`);
  }

  // Verify
  const { count: ruCount } = await sb
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("subject", "literature_russian");
  const { count: kzCount } = await sb
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("subject", "literature_kazakh");
  const { count: litCount } = await sb
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("subject", "literature");

  console.log(`\n--- Verification ---`);
  console.log(`literature (old):    ${litCount}`);
  console.log(`literature_russian:  ${ruCount}`);
  console.log(`literature_kazakh:   ${kzCount}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
