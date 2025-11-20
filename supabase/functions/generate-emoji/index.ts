import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating emoji with prompt:", prompt);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: `NO BACKGROUND: Draw ONLY the emoji itself. Do not draw any background pixels whatsoever.

Create a pixel art emoji based on this concept: ${prompt}.

CRITICAL REQUIREMENTS:
- 32x32 pixel canvas - your emoji should FILL most of this space (24-28 pixels in each dimension)
- Use standard emoji design principles (like Unicode emojis 😀🎉❤️🔥)
- Design should be instantly recognizable when scaled down
- Think minimalist for the core design - less is more
- DO NOT DRAW A BACKGROUND - leave empty space around the emoji completely empty
- NO checkerboard patterns, NO background pixels of any color
- Only draw the actual emoji pixels - everything else should be empty/no pixels

SIZE REQUIREMENTS:
- FILL MOST OF THE CANVAS - the emoji should be LARGE and dominant
- Use at least 24-28 pixels in both width and height (out of 32x32)
- Keep margins SMALL - maximum 2-4 pixels of empty space on each side
- The emoji should NOT float in the center with lots of empty space
- Think of it like this: if the canvas is a picture frame, the emoji should nearly fill that frame

COLOR GUIDANCE:
- Start with 3-5 PRIMARY bold, solid colors for the main structure and shapes
- You MAY add subtle shade variations (lighter/darker tones) for visual effects like:
  * Highlights and shadows for depth
  * Smooth gradients for dimensional effects
  * Reflections or shine effects
- Example: A tinfoil hat might use silver/gray as primary, then add lighter highlights and darker creases
- Each color variation should serve a clear visual purpose

DESIGN PRINCIPLES:
- Create large, simple geometric shapes for the base - NO tiny details
- Strong contrast between primary colors
- Shading should ENHANCE the design, not complicate it
- The design must read clearly even without the subtle shading

AVOID:
- Drawing any background whatsoever - no white, black, gray, or checkerboard patterns
- DO NOT draw a checkerboard/checker pattern to indicate emptiness
- Overly complex patterns or intricate designs
- Thin lines or tiny details that blur at small sizes
- Realistic rendering with excessive texture
- Random color variations without purpose
- More than 8-10 total colors (including shade variations)

Examples of good emoji design:
- Simple smiley: circle + dots for eyes + curve for mouth (2-3 colors + shading), no background
- Fire emoji: flame shape with red/orange/yellow gradient (3-5 colors), empty space around it
- Heart: solid shape with subtle highlight (2-3 colors), nothing else drawn

Your design should be as simple and clear as standard Unicode emojis, with purposeful shading for visual polish. Draw ONLY the emoji - do not draw any background, checkerboard patterns, or empty space indicators.`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate image");
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error("No image generated");
    }

    console.log("Successfully generated emoji");
    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to generate emoji";
    console.error("Error in generate-emoji function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
