-- ============================================================
-- STANDALONE — Clear legacy auto-generated English titles
--
-- Before the fix, POST /api/toilets baked a hardcoded English title into
-- the DB whenever a user added a location without a custom title (the old
-- getDefaultTitle: "Public Toilet", "Mall Toilet", etc.). Those stored
-- strings display verbatim and never localize.
--
-- Setting them back to NULL lets the client render a localized title from
-- the type (getProperTitle in Map.tsx) according to the active language.
--
-- Only the EXACT old default strings are matched, so genuine custom titles
-- are left untouched. Reversible via the toilets backup table.
--
-- Run the whole file at once in the Supabase SQL Editor.
-- ============================================================

BEGIN;

-- The exact strings the old getDefaultTitle() produced.
-- (kept inline so the preview and the update use the same list)

-- Preview: how many rows will be cleared, by title.
SELECT title, count(*) AS n
FROM public.toilets
WHERE title IN (
  'Public Toilet', 'EKOTOI', 'Restaurant Toilet', 'Cafe Toilet',
  'Gas Station Toilet', 'Mall Toilet', 'Toilet'
)
GROUP BY title
ORDER BY n DESC;

-- Clear them.
UPDATE public.toilets
SET title = NULL
WHERE title IN (
  'Public Toilet', 'EKOTOI', 'Restaurant Toilet', 'Cafe Toilet',
  'Gas Station Toilet', 'Mall Toilet', 'Toilet'
);

-- Confirm none remain.
SELECT count(*) AS legacy_titles_remaining_EXPECT_0
FROM public.toilets
WHERE title IN (
  'Public Toilet', 'EKOTOI', 'Restaurant Toilet', 'Cafe Toilet',
  'Gas Station Toilet', 'Mall Toilet', 'Toilet'
);

-- If the preview looked right, COMMIT. Otherwise run ROLLBACK; instead.
COMMIT;
