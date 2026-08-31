# Zboxy QA & Bug Fix Log

---
Task ID: 1
Agent: Main Agent
Task: Full QA pass on Zboxy - fix client-side error when creating new doc

Work Log:
- Analyzed full project structure (14 API routes, 3 editors, 5 file viewers, store, login page)
- Identified root cause: `react-syntax-highlighter` imported eagerly in drive-layout.tsx via file-viewers.tsx, causing client-side module loading crash
- Added `src/app/error.tsx` - proper error boundary for page-level errors
- Added `src/app/global-error.tsx` - catch-all for layout-level errors
- Made file viewers lazy-loaded via `next/dynamic` with `ssr: false` to prevent `react-syntax-highlighter` from loading during initial page render
- Fixed `FileThumbnail` component: replaced `useZboxyStore.getState().token` (non-hook call during render) with proper `useZboxyStore(s => s.token)` hook
- Fixed drag overlay CSS: changed `absolute inset-0` to `fixed inset-0` (parent had no `position: relative`)
- Fixed sheet editor `new Function()` CSP vulnerability: added input sanitization and safe math-only evaluation
- Fixed sheet editor TypeScript error: replace callback returning number instead of string
- Fixed doc editor TypeScript errors: useRef initial value, regex flag compatibility
- Fixed page.tsx hydration: added `hydrated` state to prevent SSR/client mismatch
- Moved session restore from drive-layout to page.tsx (proper lifecycle)
- Fixed trash DELETE route: empty trash logic was broken (deleteMany with empty array + redundant second pass)
- Added physical file cleanup in trash permanent delete
- Ran 34/34 database QA tests (all pass)
- Ran production build (clean, all routes compile)
- Ran production API tests (login, create doc/sheet/slide/folder, list all verified)

Stage Summary:
- 7 files modified, 2 files created
- All changes compile successfully
- Key fix: dynamic imports for file-viewers prevents client-side crash on doc creation
- Secondary fixes: hydration safety, TypeScript correctness, trash route logic, CSP safety
