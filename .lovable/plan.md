## Switch emoji generation to the newer image model

Today the app uses **Gemini 2.5 Flash Image** ("Nano Banana"), the original fast image model. The newer **Gemini 3.1 Flash Image** ("Nano Banana 2") is about as fast and cheap, but follows instructions better. That matters a lot here: the prompt asks for no background, 32x32 framing, and few colors, which the older model sometimes ignores.

The premium option, **Gemini 3 Pro Image**, gives the best quality but is slower and costs more per emoji. Since the output gets squeezed down to 32x32 pixels anyway, that extra detail mostly gets thrown away.

### What about an OpenAI model with your own key?
I don't know of an OpenAI image model called "Luna." OpenAI's image models are the "GPT Image" family. We could use one with your own key, but there are downsides:
- You'd get a separate OpenAI bill on top of Lovable.
- We'd have to write a second connection to OpenAI instead of using the one the app already has.
- GPT Image tends to be slower, and it's no better at strict, flat pixel-art output.

My recommendation is to try Nano Banana 2 first, since it needs no new key. If its results disappoint, we can test GPT Image next.

### Steps
1. In the emoji generation function, change the model from `google/gemini-2.5-flash-image` to `google/gemini-3.1-flash-image-preview`.
2. Generate a few test emojis (e.g. "cat", "fire", "pizza") and check that they come back without backgrounds and fill the grid.
3. If the results look worse, switch back to the old model. It's a one-line change.
