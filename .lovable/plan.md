## Switch emoji generation to GPT-Image 2.6 Flare

### What changes for users
- Generated emojis come back with a truly empty background instead of white or a fake checkerboard, so they look like stickers on the grid.
- Results follow prompts more closely and stay bolder at 32x32, matching the side-by-side test.
- Each generation takes a bit longer, about 8-11 seconds instead of about 6.
- The error messages stay the same: rate limit, out of credits, and "try a different prompt" when the model refuses.

### Steps
1. Rewrite the emoji generation function on the server to use Flare's request format, with transparent background turned on, a square image, and PNG output. The current instructions to the model stay the same, except the "no background" lecture gets shorter because transparency now comes from a setting.
2. Return the image to the app in the same shape it gets today, so the app's grid conversion code doesn't change.
3. Keep the existing handling for rate limits (429), credits (402) and refusals. Pass the model's own denial message through for 403 instead of a generic failure.
4. Test it with the live function on "cat", "woman laughing with salad" and "ghost wearing sunglasses". Then generate one emoji in the app itself to confirm it lands on the grid with an empty background.
5. Update the AI generation project note to record that the app now uses Flare.

### Technical details
- File: `supabase/functions/generate-emoji/index.ts`. Switch from `/v1/chat/completions` with `google/gemini-2.5-flash-image` to the gateway's OpenAI images endpoint, using the exact Flare model ID from the live model list and `background: "transparent"`.
- Convert the returned base64 image to a `data:image/png;base64,...` URL and return it as `{ imageUrl }`, so `Index.tsx` stays unchanged.
- No new secrets are needed. It uses the existing built-in AI key, not your separate ChatGPT key.
