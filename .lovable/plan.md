
## Load Default Pixel Art on First Visit

When the app loads with no saved data, show the smolmoji emoji character in the grid instead of an empty canvas. The prompt input stays empty so users see the placeholder/ghost text.

### Changes

**1. Add default pixel data as a constant (`src/data/defaultPixels.ts` -- new file)**

Extract the pixel array from the uploaded `.smolmoji` file into a typed constant. This keeps the large data out of the main component.

**2. Update `src/pages/Index.tsx` -- `handleCanvasReady`**

In the existing `handleCanvasReady` callback (around line 68-101), after the check for `savedPixels` in localStorage, add an `else` branch that loads the default pixels when there's nothing saved:

```text
if (savedPixels) {
  // ... existing restore logic ...
} else {
  // First visit: load default pixel art
  const pixels = structuredClone(DEFAULT_PIXELS);
  pixelCanvasRef.current.setPixels(pixels);
  renderPreview(pixels);
  const initialHistory = [structuredClone(pixels)];
  setHistoryStack(initialHistory);
  setHistoryIndex(0);
  historyIndexRef.current = 0;
  lastKnownPixelsRef.current = structuredClone(pixels);
}
```

This ensures the cute smolmoji character appears on the grid immediately, while the prompt input remains empty (showing the ghost/placeholder text). The default pixels are also saved to history so undo/redo works from the start.

**3. No change to prompt state**

The `prompt` localStorage key (`emoji-prompt`) defaults to `""`, so the placeholder text remains visible -- no changes needed here.
