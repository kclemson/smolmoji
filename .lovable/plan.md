

## Recreate Smolmoji Mascot as Importable File

I'll create a `smolmoji-mascot.smolmoji` file in the `public/` directory containing a pixel-by-pixel recreation of the blue blob character from the screenshot. You can then download it (or import it directly).

### What the file will contain

The original mascot: a round light-blue blob creature with:
- Light cyan body (#7DD3FC / #67C8F2 tones)
- Darker blue outline (#1E3A5F)
- Large black eyes with white reflection dots
- White highlight on the top of the head
- Small flipper/feet at the bottom
- Transparent background

### Approach

I'll hand-map each row of the 32x32 grid based on the screenshot, using these approximate colors:
- Transparent for background
- `#1a3a5c` for the dark outline
- `#5ec4f0` for the main body blue
- `#7dd8fc` for lighter blue highlights
- `#a8e8ff` for the lightest blue areas
- `#ffffff` for white highlights (eyes, head shine)
- `#000000` / `#111111` for eye pupils
- `#3a9fd4` for shadow/darker body areas

The file will be placed at `public/smolmoji-mascot.smolmoji` so you can grab it easily, or I can wire it up so it loads automatically.

### Technical details

- Create `public/smolmoji-mascot.smolmoji` with the JSON structure: `{ version: 1, gridSize: 32, prompt: "smolmoji", pixels: [...] }`
- Each row is an array of 32 color strings (hex or "transparent")
- The pixel mapping will be my best approximation from the screenshot -- you can then import it and tweak individual pixels in the editor
