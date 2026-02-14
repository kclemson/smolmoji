

## Fix Default Pixels to Use the Correct Uploaded Data

The `src/data/defaultPixels.ts` file currently contains the blue mascot pixel data, but should use the yellow emoji character from the uploaded `smolmoji-smolmoji.smolmoji` file.

### Change

**`src/data/defaultPixels.ts`** -- Replace the entire pixel array with the data from the uploaded `.smolmoji` file. The uploaded file uses `rgba()` color format (e.g., `rgba(251,204,41,1)`) instead of hex codes, and depicts a yellow/gold emoji with black eyes and white highlights.

No other files need to change -- the `Index.tsx` integration is already correct.

