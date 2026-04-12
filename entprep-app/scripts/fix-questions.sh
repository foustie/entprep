#!/bin/bash
# ═══ ENTprep Question Quality Fix — run when EV $10K arrives ═══
# Total cost: ~$7-10
# Prerequisites: ANTHROPIC_API_KEY set in environment

set -e

echo "═══ Step 1: Trim 2,400 watery questions (~$4) ═══"
echo "Removes questions flagged as too easy/repetitive from Supabase"
echo "Run: node scripts/fix-distractors.mjs"
echo ""

echo "═══ Step 2: Translate English questions to English (~$2-3) ═══"
echo "Questions about English language are currently in Russian"
echo "Run: node scripts/fix-english-kk.mjs"
echo ""

echo "═══ Step 3: Re-dump CDN after fixes ═══"
echo "Run: node scripts/dump-questions.mjs"
echo ""

echo "═══ Step 4: Deploy ═══"
echo "Run: VITE_RC_API_KEY_APPLE=appl_hSiijbsNKsMxZEeQDZLYTtjSwmw npx vite build && netlify deploy --prod --dir=dist --no-build"
echo ""

echo "═══ OCR textbooks ($20-60) — separate, manual ═══"
echo "Run: node scripts/parse-textbooks.mjs"
echo "This processes 11 scanned textbooks via Claude Vision"
echo ""

echo "Ready to go. Set ANTHROPIC_API_KEY and run each step."
