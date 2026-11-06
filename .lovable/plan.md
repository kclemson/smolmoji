## Switch emoji generation to Gemini 3.1 Flash Image (Nano Banana 2)

The app currently uses Gemini 2.5 Flash Image. The newer Gemini 3.1 Flash Image is similar in speed and cost but follows instructions better. That should mean fewer backgrounds and better use of the 32x32 grid.

### Steps
1. Get the exact Gemini 3.1 Flash Image model name from the AI service's list of available models.
2. In the emoji generation function, swap the old model name for the new one. The prompt, error messages, and everything else stay the same.
3. Generate a few test emojis (e.g. "cat", "fire", "pizza") and check that each one comes back as an image.
4. If the new model fails or returns no image, report it rather than quietly switching back.
