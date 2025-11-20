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
            content: `CANVAS SETUP - CRITICAL:
- 32x32 pixel canvas with TRANSPARENT BACKGROUND (alpha = 0)
- Empty areas must be COMPLETELY TRANSPARENT - literally nothing drawn there
- DO NOT scatter white, black, gray, or ANY colored pixels in empty areas
- Empty space = NO PIXELS AT ALL, not sparse dots, not noise, not anything

Create a pixel art emoji based on this concept: ${prompt}.

WHAT TO DRAW:
- ONLY draw the emoji subject itself (the character, object, or symbol)
- Use clean, solid edges forming a cohesive shape with defined boundaries
- Fill the emoji shape with solid colors - no scattered pixels outside its silhouette
- The emoji should FILL most of the canvas (24-28 pixels in both width and height)

WHAT NOT TO DRAW - CRITICAL:
❌ NO scattered dots or pixels in empty areas around the emoji
❌ NO checkerboard patterns to indicate transparency
❌ NO white/black/gray "noise" pixels outside the emoji shape
❌ NO partial transparency effects extending into empty space
❌ NO random pixels that aren't part of the emoji's actual design
❌ Empty background means NOTHING is drawn there - pure transparent alpha channel

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
- Use standard emoji design principles (like Unicode emojis 😀🎉❤️🔥)
- Design should be instantly recognizable when scaled down

EDGE TREATMENT:
- The emoji edge should be clean and intentional
- If a pixel is drawn, it should be part of the emoji's deliberate shape
- Do not let colors "bleed" or "scatter" beyond the emoji boundary
- Think of the emoji as a sticker - it has a clear cutout shape, not frayed edges

AVOID:
- Overly complex patterns or intricate designs
- Thin lines or tiny details that blur at small sizes
- Realistic rendering with excessive texture
- Random color variations without purpose
- More than 8-10 total colors (including shade variations)

Examples of good emoji design:
- Simple smiley: circle + dots for eyes + curve for mouth (2-3 colors + shading), nothing else
- Fire emoji: flame shape with red/orange/yellow gradient (3-5 colors), clean edges, empty space around it
- Heart: solid shape with subtle highlight (2-3 colors), well-defined boundary

FINAL CHECK BEFORE SUBMISSION:
✓ Is every single pixel you drew part of the actual emoji design? If not, DELETE IT.
✓ Are there scattered pixels that aren't part of a coherent shape? DELETE THEM.
✓ Does the emoji have clean edges, or is there pixel noise around it? CLEAN IT UP.
✓ Is the background completely empty (transparent), with zero pixels drawn? VERIFY THIS.

Your design should be as simple and clear as standard Unicode emojis, with purposeful shading for visual polish. Draw ONLY the emoji pixels that form the actual design - treat transparency as the complete absence of pixels, not something to represent visually.`,
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
