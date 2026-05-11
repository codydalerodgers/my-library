<!-- Project-specific Copilot instructions for AI agents -->
# my-library — Copilot instructions

These notes give an AI coding agent the minimal, concrete context needed to make productive changes in this repo.

- Stack: React + TypeScript + Vite. See `package.json` scripts: `dev`, `build`, `preview`, and `test` (Vitest).
- Backend: Supabase (client created at `src/lib/supabaseClient.ts`). Environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required at runtime.
- Primary domain: a personal library app that scans barcodes/ISBNs, looks up metadata (Open Library → Google Books), and stores books + reading logs in Supabase.

Key files to reference
- `src/lib/bookMetadata.ts` — ISBN normalization, candidate generation, Open Library and Google Books lookups. Use this when adding or modifying metadata lookup logic.
- `src/lib/supabaseClient.ts` — Supabase client. Respect environment variable requirements and avoid leaking secrets.
- `src/components/BarcodeScanner.tsx` — Camera discovery, ZXing usage, and cleanup patterns (stop controls + stop tracks). Important when changing scanning behavior.
- `src/pages/ScanView.tsx`, `BulkScanView.tsx`, `BulkEditView.tsx`, `LibraryView.tsx` — UI flows for scanning, bulk scanning, editing, and listing books. These show how server calls and optimistic UI updates are performed.

Architecture and flow (short)
- UI is a client-only single-page app. Data persistence and auth are handled by Supabase via `supabase.auth` and `.from('books')` / `.from('reading_logs')` queries.
- Barcode → normalized ISBN → check Supabase for existing book → if missing, call `fetchBookMetadata` (Open Library then Google Books) → optionally create record in `books` table.
- Cover backfill: `LibraryView` will attempt `fetchCoverUrl` for books missing `cover_url` and update Supabase and local state.

Conventions & patterns to follow
- Keep network errors silent where the UI already handles them (see `bookMetadata` functions which return `null` on failures). Prefer returning `null` rather than throwing inside lookup helpers.
- Timeouts & user checks: many pages call `supabase.auth.getUser()` and guard on missing user — preserve that pattern when adding features that mutate user-specific data.
- Camera cleanup: always stop ZXing controls and MediaStream tracks (see `BarcodeScanner` and `ScanView` cleanup) to avoid locked cameras on Safari.
- ISBN handling: use `normalizeIsbn` and `getIsbnCandidates` from `bookMetadata.ts` when parsing input or scanner results to ensure consistent variants (ISBN-10 ↔ ISBN-13).
- Minimal optimistic updates: UI updates local state immediately (e.g., `BulkScanView` entries) but still reflect database result messages. Preserve these UX decisions.

Testing & developer workflows
- Run locally: `npm run dev` (Vite). Build: `npm run build` (runs `tsc -b && vite build`). Test: `npm run test` (Vitest). Lint: `npm run lint`.
- Environment: tests and local dev expect Vite environment variables for Supabase only at runtime; unit tests typically mock network and Supabase calls (see `test/setupTests.ts`). Avoid adding tests that require real Supabase credentials.

Integration points and external dependencies
- Supabase: used for auth and CRUD on `books` and `reading_logs`. Queries often use `.maybeSingle()` and `.select()` chained with `.single()` for inserts/updates. Respect that pattern to avoid breaking expectations.
- External metadata: `fetchBookMetadata` hits Open Library first and then Google Books. Rate limits and HEAD checks are used (Open Library covers). Be conservative with extra calls.
- ZXing (`@zxing/browser` + `@zxing/library`) is used for barcode scanning. Camera labels are inspected to prefer back camera (regex /back|rear|environment/i).

Examples to copy when implementing features
- Query current user and guard: in `ScanView.tsx` and `BulkScanView.tsx` — use `const { data: { user }, error } = await supabase.auth.getUser(); if (error || !user) ...`.
- Insert book: use `.insert(payload).select().single()` and check `error` before proceeding (used across pages).
- Stop camera: keep the two-step stop used in `BarcodeScanner` — call ZXing controls `.stop()` and then stop tracks from `video.srcObject`.

Safety and non-goals
- Do not add real Supabase keys into the repo. Use environment variables and local dev secrets only.
- Avoid changing global styling or introducing breaking ESLint/TypeScript config changes without running `npm run build` and `npm run test` locally.

If something is unclear
- Ask which workflows the user wants fixed (scanning UX, bulk-import resilience, metadata sources, or tests). Point to the files above and include a short code diff for any change.

— End of file
