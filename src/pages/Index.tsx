import { useState, useRef, useEffect } from "react";
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
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const preview32Ref = useRef<HTMLCanvasElement>(null);
  const preview48Ref = useRef<HTMLCanvasElement>(null);
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

  const updatePreviews = () => {
    const mainCanvas = mainCanvasRef.current;
    const preview32 = preview32Ref.current;
    const preview48 = preview48Ref.current;
    
    if (!mainCanvas || !preview32 || !preview48) return;

    const ctx32 = preview32.getContext("2d");
    const ctx48 = preview48.getContext("2d");
    
    if (!ctx32 || !ctx48) return;

    ctx32.imageSmoothingEnabled = false;
    ctx48.imageSmoothingEnabled = false;

    ctx32.clearRect(0, 0, 32, 32);
    ctx48.clearRect(0, 0, 48, 48);

    ctx32.drawImage(mainCanvas, 0, 0, 32, 32);
    ctx48.drawImage(mainCanvas, 0, 0, 48, 48);
  };

  const handlePixelChange = (x: number, y: number, color: string) => {
    // Update previews immediately when pixels change
    setTimeout(updatePreviews, 0);
  };

  const handleEyedropperToggle = () => {
    setIsEyedropperActive(!isEyedropperActive);
  };

  const handleColorPick = (color: string) => {
    setSelectedColor(color);
    setIsEyedropperActive(false);
    toast({
      title: "Color picked!",
      description: "Selected color from canvas",
    });
  };

  useEffect(() => {
    if (!imageData) return;
    
    // Small delay to ensure main canvas has rendered the new image
    setTimeout(updatePreviews, 100);
  }, [imageData]);

  const handleDownload = () => {
    const canvas = mainCanvasRef.current;
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
                isEyedropperActive={isEyedropperActive}
                onEyedropperToggle={handleEyedropperToggle}
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

          </div>

          {/* Right Panel - Canvas & Previews */}
          <div className="space-y-6">
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
                    canvasRef={mainCanvasRef}
                    isEyedropperActive={isEyedropperActive}
                    onColorPick={handleColorPick}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="space-y-4">
                <label className="text-sm font-medium">Size Previews</label>
                <div className="flex gap-8 justify-center items-end">
                  <div className="space-y-2 text-center">
                    <canvas
                      ref={preview32Ref}
                      width={32}
                      height={32}
                      className="border-2 border-border rounded pixelated mx-auto"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <p className="text-xs text-muted-foreground">32×32 (Actual)</p>
                  </div>
                  <div className="space-y-2 text-center">
                    <canvas
                      ref={preview48Ref}
                      width={48}
                      height={48}
                      className="border-2 border-border rounded pixelated mx-auto"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <p className="text-xs text-muted-foreground">48×48 (1.5× Scale)</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
