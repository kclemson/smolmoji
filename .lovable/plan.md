

## Fix Button Enable Delay After Default Pixels Load

### Problem

When default pixels load on first visit, the download/delete buttons stay disabled for 1-2 seconds. This happens because `hasNoContent` is computed as:

```
const hasNoContent = isGenerating || !localStorage.getItem("emoji-pixels");
```

The default pixels are rendered on the canvas but `emoji-pixels` isn't written to localStorage until the debounced save fires after a delay. During that gap, `hasNoContent` is `true` and buttons remain disabled.

### Solution

**`src/pages/Index.tsx`** -- Replace the direct `localStorage.getItem` check with a React state variable that gets set immediately when pixels are loaded:

1. Add a state variable like `const [hasPixelData, setHasPixelData] = useState(false)`.
2. Change `hasNoContent` to: `const hasNoContent = isGenerating || !hasPixelData;`
3. Set `setHasPixelData(true)` in both branches of `handleCanvasReady` (the saved-pixels branch and the default-pixels branch), and also wherever pixels are generated or loaded.
4. Set `setHasPixelData(false)` in `handleClear`.

This way, as soon as pixels are loaded onto the canvas (whether from storage or defaults), the buttons become enabled immediately -- no waiting for the debounced localStorage write.

