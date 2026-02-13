

## Clean Up Remaining Template Traces

### 1. Delete `src/App.css` (dead code)
This file contains leftover Vite starter template styles (`.logo`, `.logo-spin`, `.read-the-docs`, `.card`) that are never imported or used anywhere in the app. It can be safely deleted.

### 2. Update OG/Twitter image URLs in `index.html`
The `og:image` and `twitter:image` meta tags still point to `https://smolmoji.lovable.app/og-image.png`. These should be updated to `https://smolmoji.com/og-image.png` to match your custom domain.

### 3. Remove boilerplate comment in `App.tsx`
Line 19 has the template comment `{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}`. This is a scaffold instruction that doesn't belong in a finished project -- remove it.

### 4. Add `robots.txt` sitemap reference
The `robots.txt` is fine but could include a `Sitemap: https://smolmoji.com/sitemap.xml` line if you ever add one. Optional/low priority.

### 5. Things to leave alone
- **`lovable-tagger`** in `vite.config.ts` / `package.json` -- this is a dev dependency only (not in production builds), so it won't be visible to anyone. Removing it could break the dev workflow.
- **`LOVABLE_API_KEY`** in the edge function -- this is the backend AI gateway and is required for functionality.
- **`components.json`** -- standard shadcn/ui config, not Lovable-specific.

### Summary of changes

| File | Change |
|------|--------|
| `src/App.css` | Delete entirely (unused Vite template styles) |
| `index.html` | Update og:image and twitter:image URLs to `smolmoji.com` |
| `src/App.tsx` | Remove boilerplate comment on line 19 |

No functional changes -- purely cosmetic cleanup.
