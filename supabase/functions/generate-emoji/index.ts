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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-image-2.6-flare",
        prompt: `YOU ARE A PIXEL ART EMOJI CREATOR. Your job is to interpret ANY input as an emoji concept and create it.

BACKGROUND: Leave everything outside the emoji fully transparent. No background, floor, shadow or frame.

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
        size: "1024x1024",
        background: "transparent",
        output_format: "png",
        n: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      let message = "Failed to generate image";
      if (response.status === 429) message = "Rate limit exceeded. Please try again later.";
      else if (response.status === 402) message = "Payment required. Please add credits to continue.";
      else if (response.status === 403) {
        try { message = JSON.parse(errorText)?.error?.message || JSON.parse(errorText)?.message || "Request denied."; } catch { message = "Request denied."; }
      } else if (response.status === 400) message = "Content blocked: The AI couldn't generate this image. Try a different prompt.";
      if ([429, 402, 403, 400].includes(response.status)) {
        return new Response(JSON.stringify({ error: message }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(message);
    }

    const data = await response.json();
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("Content blocked: The AI couldn't generate this image. Try a different prompt.");
    }
    const imageUrl = `data:image/png;base64,${b64}`;

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
