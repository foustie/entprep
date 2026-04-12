#!/usr/bin/env node
/**
 * Parse textbooks (EPUB + PDF) → structured JSON for RAG.
 *
 * Usage:
 *   node scripts/parse-textbooks.mjs           # parse all
 *   node scripts/parse-textbooks.mjs --subject=chemistry  # parse one
 *
 * Output: scripts/golden/textbooks/parsed/{subject}.json
 *
 * Each JSON file: { subject, grade, source, chapters: [{ title, sections: [{ title, text }] }] }
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const TEXTBOOKS_DIR = "scripts/golden/textbooks";
const OUTPUT_DIR = path.join(TEXTBOOKS_DIR, "parsed");

// ── Textbook registry ─────────────────────────────────────────────────────
const BOOKS = [
  // Text EPUBs
  {
    subject: "chemistry",
    grade: 11,
    files: [
      "himija_11_ospanova_em_part1.epub",
      "himija_11_ospanova_em_part2.epub",
    ],
    source: "Оспанова М.К., Аухадиева К.С., Белоусова Т.Г. Химия 11 ЕМН",
  },
  {
    subject: "physics",
    grade: 11,
    files: ["fizika_11_em_tujakbaev_part1.epub"],
    source: "Тужакбаев Б.Т. Физика 11 ЕМ",
  },
  // PDFs
  {
    subject: "physics_ogn",
    grade: 11,
    files: ["fizika_11_zakirova_armanpv.pdf"],
    source: "Закирова Н.А., Аширов Р.Р. Физика 11 ОГН",
  },
  // Scan-based (OCR needed later)
  // { subject: "algebra", grade: 11, files: ["algebra_11_emn_shynybekov_part1.epub", ...], scan: true },
  // { subject: "biology", grade: 11, files: ["biologia_11_kovshar_part1.epub", ...], scan: true },
  // { subject: "history", grade: 11, files: ["historia_kz_11_kabuldinov_part1.epub", ...], scan: true },
];

// ── EPUB parser ───────────────────────────────────────────────────────────
function parseEPUB(epubPath) {
  const tmp = `/tmp/epub_parse_${Date.now()}`;
  try {
    execSync(`mkdir -p "${tmp}"`);
    execSync(`unzip -o -q "${epubPath}" -d "${tmp}" 2>/dev/null || true`);

    // Find OEBPS or root HTML dir
    let htmlDir = path.join(tmp, "OEBPS");
    if (!fs.existsSync(htmlDir)) {
      htmlDir = tmp;
    }

    // Get all HTML files sorted numerically
    const htmlFiles = fs
      .readdirSync(htmlDir)
      .filter((f) => f.endsWith(".html") || f.endsWith(".xhtml"))
      .sort((a, b) => {
        const na = parseInt(a),
          nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });

    const pages = [];
    for (const f of htmlFiles) {
      const html = fs.readFileSync(path.join(htmlDir, f), "utf8");

      // Extract headings
      const headings = [
        ...html.matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi),
      ].map((m) => m[1].replace(/<[^>]+>/g, "").trim());

      // Extract text
      let text = html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&[a-z]+;/g, " ")
        .replace(/&#\d+;/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n/g, "\n")
        .trim();

      if (text.length > 20) {
        pages.push({ file: f, headings, text });
      }
    }

    return pages;
  } finally {
    execSync(`rm -rf "${tmp}"`);
  }
}

// ── PDF parser ────────────────────────────────────────────────────────────
function parsePDF(pdfPath) {
  const text = execSync(`pdftotext "${pdfPath}" -`, {
    maxBuffer: 50 * 1024 * 1024,
  }).toString();
  return text;
}

// ── Chapter detector ──────────────────────────────────────────────────────
function splitIntoChapters(pages) {
  const chapters = [];
  let currentChapter = { title: "Введение", sections: [] };
  let currentSection = { title: "", text: "" };

  for (const page of pages) {
    // Detect chapter headings (§, Глава, ГЛАВА, Тема, numbers like "1.", "2.")
    const chapterMatch = page.text.match(
      /^(?:§\s*\d+[.\s]|Глава\s+\d+|ГЛАВА\s+\d+|Тема\s+\d+)/m
    );
    const heading = page.headings[0] || "";

    if (
      chapterMatch ||
      heading.match(/^(?:§|Глава|ГЛАВА|Тема)\s*\d+/i)
    ) {
      // Save previous section
      if (currentSection.text.trim()) {
        currentChapter.sections.push({ ...currentSection });
      }
      // Save previous chapter if has content
      if (currentChapter.sections.length > 0) {
        chapters.push({ ...currentChapter });
      }
      // Start new chapter
      const title =
        heading ||
        (chapterMatch ? chapterMatch[0].trim() : `Section ${chapters.length + 1}`);
      currentChapter = { title, sections: [] };
      currentSection = { title, text: page.text };
    } else {
      // Append to current section
      currentSection.text += "\n" + page.text;
    }
  }

  // Save last section/chapter
  if (currentSection.text.trim()) {
    currentChapter.sections.push({ ...currentSection });
  }
  if (currentChapter.sections.length > 0) {
    chapters.push({ ...currentChapter });
  }

  return chapters;
}

function splitPDFIntoChapters(fullText) {
  const lines = fullText.split("\n");
  const chapters = [];
  let currentChapter = { title: "Введение", sections: [] };
  let currentText = "";

  for (const line of lines) {
    // Detect chapter/section headers
    const isChapter = line.match(
      /^(?:§\s*\d+|Глава\s+\d+|ГЛАВА\s+\d+|Тема\s+\d+|\d+\.\s+[А-ЯA-Z])/
    );

    if (isChapter) {
      if (currentText.trim()) {
        currentChapter.sections.push({
          title: currentChapter.title,
          text: currentText.trim(),
        });
      }
      if (
        currentChapter.sections.length > 0 ||
        currentText.trim().length > 100
      ) {
        chapters.push({ ...currentChapter });
      }
      currentChapter = { title: line.trim(), sections: [] };
      currentText = "";
    } else {
      currentText += line + "\n";
    }
  }

  // Last
  if (currentText.trim()) {
    currentChapter.sections.push({
      title: currentChapter.title,
      text: currentText.trim(),
    });
  }
  if (currentChapter.sections.length > 0) {
    chapters.push({ ...currentChapter });
  }

  return chapters;
}

// ── Chunk sections for RAG ────────────────────────────────────────────────
const MAX_CHUNK = 2000; // chars per chunk for RAG

function chunkSection(text) {
  if (text.length <= MAX_CHUNK) return [text];

  const chunks = [];
  const paragraphs = text.split(/\n\s*\n|\n/);
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length > MAX_CHUNK && current.length > 200) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += "\n" + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

// ── Main ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const subjectFilter = args
  .find((a) => a.startsWith("--subject="))
  ?.split("=")[1];

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

let totalChars = 0;
let totalChunks = 0;

for (const book of BOOKS) {
  if (subjectFilter && book.subject !== subjectFilter) continue;

  console.log(`\n📚 ${book.source}`);

  let chapters = [];

  for (const file of book.files) {
    const filePath = path.join(TEXTBOOKS_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠️  File not found: ${file}`);
      continue;
    }

    if (file.endsWith(".pdf")) {
      console.log(`  📄 Parsing PDF: ${file}`);
      const text = parsePDF(filePath);
      const pdfChapters = splitPDFIntoChapters(text);
      chapters.push(...pdfChapters);
    } else {
      console.log(`  📖 Parsing EPUB: ${file}`);
      const pages = parseEPUB(filePath);
      console.log(`     ${pages.length} pages with text`);

      if (pages.length === 0) {
        console.log(`  ⚠️  No text content (scan-based). Skipping.`);
        continue;
      }

      const epubChapters = splitIntoChapters(pages);
      chapters.push(...epubChapters);
    }
  }

  if (chapters.length === 0) {
    console.log(`  ❌ No parseable content`);
    continue;
  }

  // Build RAG-ready chunks
  const ragChunks = [];
  for (const ch of chapters) {
    for (const sec of ch.sections) {
      const chunks = chunkSection(sec.text);
      for (const chunk of chunks) {
        ragChunks.push({
          chapter: ch.title,
          section: sec.title !== ch.title ? sec.title : undefined,
          text: chunk,
        });
      }
    }
  }

  const output = {
    subject: book.subject,
    grade: book.grade,
    source: book.source,
    totalChars: ragChunks.reduce((s, c) => s + c.text.length, 0),
    chunksCount: ragChunks.length,
    chapters: chapters.map((ch) => ({
      title: ch.title,
      sectionsCount: ch.sections.length,
    })),
    chunks: ragChunks,
  };

  const outPath = path.join(OUTPUT_DIR, `${book.subject}.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  totalChars += output.totalChars;
  totalChunks += ragChunks.length;

  console.log(
    `  ✅ ${chapters.length} chapters, ${ragChunks.length} chunks, ${(output.totalChars / 1000).toFixed(0)}K chars`
  );
  console.log(`  → ${outPath}`);
}

console.log(`\n━━━ Done ━━━`);
console.log(
  `Total: ${(totalChars / 1000).toFixed(0)}K chars, ${totalChunks} chunks`
);
