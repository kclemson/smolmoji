

## Code Cleanup, Deduplication, and Test Automation

This plan implements the previously approved cleanup in **separate, well-named commits** so the Git history looks intentional and professional.

---

### Step 1: Extract shared color utilities into `src/lib/color.ts`
**Commit: "refactor: extract color distance utilities into shared module"**

Create `src/lib/color.ts` with `hexToRgb`, `colorDistance`, and `colorsAreSimilar` -- currently duplicated between `Index.tsx` and `PixelCanvas.tsx`.

- Update `Index.tsx` to import from `@/lib/color` and remove the local `hexToRgb`, `colorDistance`, `colorsAreSimilar` functions (lines 181-231)
- Update `PixelCanvas.tsx` to import `colorDistance` from `@/lib/color` and remove the local copy (lines 66-76)

### Step 2: Remove dead components
**Commit: "chore: remove unused NavLink and ColorPicker components"**

- Delete `src/components/NavLink.tsx` (never imported anywhere)
- Delete `src/components/ColorPicker.tsx` (only `DEFAULT_CUSTOM_COLORS` is used)
- In `Index.tsx`, replace the import with a local `const DEFAULT_CUSTOM_COLORS: string[] = []`
- Remove unused `Separator` import from `Index.tsx` (line 9)

### Step 3: Rename `isVirginState` to `hasNoContent`
**Commit: "refactor: rename isVirginState to hasNoContent for clarity"**

- `Index.tsx`: rename variable, comment, and all ~25 usages
- `PixelCanvas.tsx`: rename prop in interface (line 29), destructured param (line 41), and any internal references

### Step 4: Add `.env` to `.gitignore`
**Commit: "chore: add .env to .gitignore"**

Append `.env` to `.gitignore`.

### Step 5: Set up test infrastructure and write tests
**Commit: "test: add vitest setup and unit/component tests"**

- Install dev dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
- Create `vitest.config.ts` with jsdom environment and path aliases
- Create `src/test/setup.ts` with `@testing-library/jest-dom` import
- Create tests:
  - `src/lib/color.test.ts` -- unit tests for `hexToRgb`, `colorDistance`, `colorsAreSimilar`
  - `src/lib/logger.test.ts` -- verify logger methods don't throw
  - `src/pages/Index.test.tsx` -- smoke test: renders key UI elements (header, textarea, generate button)
  - `src/components/PixelCanvas.test.tsx` -- smoke test: renders canvas element

---

### Summary

| File | Action |
|------|--------|
| `src/lib/color.ts` | Create (shared color utilities) |
| `src/lib/color.test.ts` | Create (unit tests) |
| `src/lib/logger.test.ts` | Create (unit tests) |
| `src/pages/Index.tsx` | Edit (remove duplication, dead imports, rename variable) |
| `src/pages/Index.test.tsx` | Create (smoke test) |
| `src/components/PixelCanvas.tsx` | Edit (import from color.ts, rename prop) |
| `src/components/PixelCanvas.test.tsx` | Create (smoke test) |
| `src/components/NavLink.tsx` | Delete |
| `src/components/ColorPicker.tsx` | Delete |
| `.gitignore` | Append `.env` |
| `vitest.config.ts` | Create |
| `src/test/setup.ts` | Create |

**Note on commits**: In Lovable, all changes in a single response go into one commit. To get separate, clean commit messages in Git, I will implement these changes across multiple responses. Alternatively, I can do all changes at once (single commit) and you can use interactive rebase (`git rebase -i`) to split them later. Which approach would you prefer, or should I just proceed with all changes in one well-described commit?

No functional changes -- purely cleanup and test infrastructure.

