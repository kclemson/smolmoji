

## Export and Import Pixel Art Data

Add the ability to export the current pixel grid as a small JSON file and re-import it later, so users can save multiple versions and come back to them.

### How it works

- **Export**: A new "Export" button next to the existing Download PNG / Clear buttons. Clicking it saves a `.smolmoji` JSON file containing the 32x32 pixel grid data and the prompt text.
- **Import**: A new "Import" button that opens a hidden file input. When the user selects a `.smolmoji` file, it loads the pixel data back onto the canvas and restores the prompt.

The `.smolmoji` file is just JSON with a structure like:
```json
{
  "version": 1,
  "gridSize": 32,
  "prompt": "happy cat",
  "pixels": [["transparent", "#ff0000", ...], ...]
}
```

### Technical details

**`src/pages/Index.tsx`**:

1. Add two new handler functions:
   - `handleExportProject` -- calls `pixelCanvasRef.current.getPixels()`, bundles it with the prompt into a JSON object, and triggers a file download as `smolmoji-[slug].smolmoji`
   - `handleImportProject` -- reads a `.smolmoji` file via a hidden `<input type="file">`, parses the JSON, calls `pixelCanvasRef.current.setPixels()` to load the pixels, restores the prompt, and pushes to history

2. Add a hidden `<input type="file" accept=".smolmoji">` ref

3. Add two buttons in the button row (next to Download PNG and Clear):
   - **Export** button with an upload/save icon
   - **Import** button with a folder-open icon

4. Import `Upload, FolderOpen` (or similar) from `lucide-react`

No new files or components needed -- this is self-contained in `Index.tsx` with ~40 lines of new code.
