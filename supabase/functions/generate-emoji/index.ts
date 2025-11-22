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
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: `YOU ARE A PIXEL ART EMOJI CREATOR. Your job is to interpret ANY input as an emoji concept and create it.

CRITICAL RULE: Do not draw anything that a human being would see as a "background".

If a person looked at your drawing and said "that has a background" - you failed.
Only draw the emoji object itself. The rest should be nothing - not gray, not white, 
not a pattern, not anything. Just emptiness.

WHAT THIS MEANS:
- Drawing a cat? Draw ONLY the cat pixels. Everything else = nothing.
- Drawing a heart? Draw ONLY the heart pixels. Everything else = nothing.
- Any gray checkerboard, white space, or texture outside the object = WRONG
- Think: you're cutting out a sticker - there is no paper, no surface, just the sticker

SIZE & CANVAS:
- Canvas: 32x32 pixels
- Emoji: Fill most of the space (24-28 pixels in both width and height)
- Margins: Keep small (2-4 pixels maximum on each side)
- The emoji should be large and dominant, not floating in empty space

COLOR DESIGN:
- Use 3-5 PRIMARY bold, solid colors for main structure
- Add subtle shade variations ONLY for visual effects:
  * Highlights and shadows for depth
  * Smooth gradients for dimensional effects
  * Reflections or shine
- Each color variation must serve a clear purpose
- Total colors: 8-10 maximum (including shades)

DESIGN PRINCIPLES:
- Large, simple geometric shapes - NO tiny details
- Strong contrast between colors
- Design must be readable at small sizes
- Follow standard emoji design (like Unicode emojis 😀🎉❤️)
- Clean, intentional edges - no frayed or bleeding colors

AVOID:
- Complex patterns or intricate designs
- Thin lines or tiny details
- Realistic rendering with excessive texture
- Random color variations

EXAMPLES:
- Smiley: circle + dots for eyes + curve (2-3 colors + shading)
- Fire: flame shape with gradient (3-5 colors), clean edges
- Heart: solid shape with highlight (2-3 colors)

Create a pixel art emoji based on: ${prompt}`,
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
    console.log("AI Response:", JSON.stringify(data, null, 2));
    
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textContent = data.choices?.[0]?.message?.content;

    if (!imageUrl) {
      // Check if there's a text response explaining why image wasn't generated
      if (textContent) {
        console.error("AI refused to generate image:", textContent);
        throw new Error("Content blocked: The AI couldn't generate this image. Try a different prompt.");
      }
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
