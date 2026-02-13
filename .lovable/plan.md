

## Make the design direction textarea one row taller

Currently the textarea at line 857 of `src/pages/Index.tsx` has `rows={2}`. Change it to `rows={3}` so there's more room for longer prompts and the generate button is less likely to overlap the text.

### Change

**`src/pages/Index.tsx`** (line 857): Change `rows={2}` to `rows={3}`

Also update the base `min-h` in `src/components/ui/textarea.tsx` from `min-h-[60px]` back to a value that accommodates 3 rows of `text-xs` content (roughly `min-h-[64px]`), or simply leave it as-is since the `rows={3}` attribute will naturally expand the textarea beyond the minimum.

Single-line change, no other files affected.
