## Side-by-side test: today's model vs GPT-Image 2.6 Flare (test only, no app changes)

This step only runs the test. Nothing in the app changes. Running it needs approval because plan mode blocks even saving temporary test images.

### What gets tested
- **Today:** Gemini 2.5 Flash Image, sent the app's exact current instructions.
- **Candidate:** GPT-Image 2.6 Flare, sent the same instructions, with true transparent background turned on.
- **Prompts:**
  - Simple baselines: "cat", "fire"
  - Your examples: "woman laughing with salad", "crystal ball with a cat smiling"
  - Extra hard cases: "astronaut riding a taco", "sleepy cloud holding coffee" (several subjects in one emoji), and "ghost wearing sunglasses" (a mostly white or see-through subject, the hardest case for transparent backgrounds)

### What I'll report back
- A side-by-side image of each emoji, full size and shrunk to the app's 32x32 grid.
- Whether the background really came out empty for each model.
- How long each generation took.
- Any errors or refusals.

After that, you decide whether to switch. Switching would be a separate plan.
