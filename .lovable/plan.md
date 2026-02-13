

## Better matched icons for Export and Import

Replace the current `Upload` and `FolderOpen` icons with the paired `FileUp` (export) and `FileDown` (import) icons from lucide-react. These are visually related (same file shape, mirrored arrows) making it immediately clear they're complementary actions.

### Changes in `src/pages/Index.tsx`

1. **Line 14** -- Update the lucide-react import: replace `Upload, FolderOpen` with `FileUp, FileDown`
2. **Line 974** -- Export button: change `<Upload>` to `<FileUp>`
3. **Line 982** -- Import button: change `<FolderOpen>` to `<FileDown>`

