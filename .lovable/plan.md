

## Show Default Pixels Only Once Per Browser

Currently, the default pixel art loads whenever there's no `emoji-pixels` in localStorage -- including after the user deliberately clears the canvas. The fix is to track whether the user has ever visited before using a separate localStorage flag.

### Change

**`src/pages/Index.tsx`** -- Update the `handleCanvasReady` else branch (around line 95):

- Instead of just checking `!savedPixels`, also check for a new localStorage key like `smolmoji-has-visited`.
- Only load `DEFAULT_PIXELS` if both conditions are true: no saved pixels AND no `has-visited` flag.
- After loading default pixels (or after any first canvas ready), set `localStorage.setItem("smolmoji-has-visited", "true")`.

```text
} else if (!localStorage.getItem("smolmoji-has-visited")) {
  // First-ever visit: load default pixel art
  const pixels = structuredClone(DEFAULT_PIXELS);
  pixelCanvasRef.current.setPixels(pixels);
  renderPreview(pixels);
  ...
  localStorage.setItem("smolmoji-has-visited", "true");
}
```

- Also set the `smolmoji-has-visited` flag in `handleCanvasReady`'s `if (savedPixels)` branch (or unconditionally after both branches) so that any user who already has saved data is also marked as "visited."

No other files need changes. The `handleClear` function already removes `emoji-pixels` without needing modification -- after clearing + refresh, the `has-visited` flag prevents the default art from reappearing.
