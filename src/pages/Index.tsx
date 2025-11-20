import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PixelCanvas } from "@/components/PixelCanvas";
import { ColorPicker } from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Sparkles, Loader2 } from "lucide-react";

const Index = () => {
  const [prompt, setPrompt] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState("#FF6B6B");
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Enter a prompt",
        description: "Describe the emoji you want to create",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-emoji", {
        body: { prompt },
      });

      if (error) throw error;

      if (data.imageUrl) {
        setImageData(data.imageUrl);
        toast({
          title: "Emoji generated!",
          description: "You can now edit it or download as PNG",
        });
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      toast({
        title: "Generation failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePixelChange = (x: number, y: number, color: string) => {
    // Pixel changes are handled directly in the canvas component
  };

  const handleDownload = () => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement;
    if (!canvas) return;

    // Create a temporary canvas for the final image
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 128; // Discord emoji size
    tempCanvas.height = 128;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;

    // Draw the current canvas scaled to 128x128
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, 128, 128);

    // Download
    tempCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `discord-emoji-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Downloaded!",
        description: "Your emoji has been saved as PNG",
      });
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Discord Emoji Maker
          </h1>
          <p className="text-lg text-muted-foreground">
            Create custom pixel art emojis with AI and export for Discord
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            <Card className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium">Design Direction</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., happy cat, fire symbol, laughing face..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleGenerate} 
                    disabled={isGenerating}
                    className="gap-2"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Generate
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">Color Palette</label>
                <ColorPicker 
                  selectedColor={selectedColor}
                  onColorChange={setSelectedColor}
                />
              </div>

              <Button 
                onClick={handleDownload} 
                className="w-full gap-2"
                disabled={!imageData}
                variant="default"
                size="lg"
              >
                <Download className="w-4 h-4" />
                Download PNG (128x128)
              </Button>
            </Card>

            {/* Preview */}
            {imageData && (
              <Card className="p-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium">Discord Preview</label>
                  <div className="flex items-center gap-4 p-4 bg-[#36393f] rounded-lg">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-semibold">
                      U
                    </div>
                    <div className="flex-1">
                      <div className="text-white text-sm font-medium mb-1">Username</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#dcddde] text-sm">Check this out!</span>
                        <canvas
                          ref={canvasRef}
                          className="inline-block w-6 h-6 pixelated"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right Panel - Canvas */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Pixel Editor (32x32)</label>
                <span className="text-xs text-muted-foreground">Click or drag to draw</span>
              </div>
              <div className="flex justify-center">
                <PixelCanvas
                  imageData={imageData}
                  onPixelChange={handlePixelChange}
                  selectedColor={selectedColor}
                  gridSize={32}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
