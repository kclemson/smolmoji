import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [pixels, setPixels] = useState<string[][]>([]);
  const [backgroundColor, setBackgroundColor] = useState<"transparent" | "white" | "black">("transparent");
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const preview32Ref = useRef<HTMLCanvasElement>(null);
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
    const preview32 = preview32Ref.current;
    if (!preview32) return;

    const ctx = preview32.getContext("2d");
    if (!ctx) return;
    
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    
    pixels.forEach((row, y) => {
      row.forEach((color, x) => {
        if (color !== "transparent") {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      });
    });
  };

  const handlePixelChange = () => {
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
    // Update previews whenever pixels change
    updatePreviews();
  }, [pixels]);

  const handleDownload = () => {
    // Create a temporary canvas for the final image
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 128; // Discord emoji size
    tempCanvas.height = 128;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Fill background based on selection
    if (backgroundColor === "white") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, 128, 128);
    } else if (backgroundColor === "black") {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, 128, 128);
    }

    // Render pixels
    const pixelSize = 128 / 32;
    
    pixels.forEach((row, y) => {
      row.forEach((color, x) => {
        if (color !== "transparent") {
          ctx.fillStyle = color;
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      });
    });

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
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Discord Emoji Maker
          </h1>
          <p className="text-lg text-muted-foreground">
            Create custom pixel art emojis with AI and export for Discord
          </p>
        </div>

        {/* Single Column Layout */}
        <div className="space-y-6">
          {/* Row 1: Design Direction + Generate */}
          <Card className="p-6">
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
          </Card>

          {/* Row 2: Background Selection + Download */}
          <Card className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium">Background</label>
                <div className="flex gap-2">
                  <Button
                    variant={backgroundColor === "transparent" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBackgroundColor("transparent")}
                    className="flex-1"
                  >
                    Transparent
                  </Button>
                  <Button
                    variant={backgroundColor === "white" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBackgroundColor("white")}
                    className="flex-1"
                  >
                    White
                  </Button>
                  <Button
                    variant={backgroundColor === "black" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBackgroundColor("black")}
                    className="flex-1"
                  >
                    Black
                  </Button>
                </div>
              </div>
              <Button 
                onClick={handleDownload} 
                className="gap-2"
                disabled={!imageData}
                variant="default"
              >
                <Download className="w-4 h-4" />
                Download PNG (128x128)
              </Button>
            </div>
          </Card>

          {/* Row 3: Pixel Editor */}
          <Card className="p-6">
            <div className="space-y-4">
              <label className="text-sm font-medium">Pixel Editor (32x32)</label>
              
              {/* 32x32 Preview */}
              <div className="flex justify-center">
                <canvas
                  ref={preview32Ref}
                  width={32}
                  height={32}
                  className="border-2 border-border rounded pixelated"
                  style={{ 
                    imageRendering: "pixelated",
                    width: "32px",
                    height: "32px"
                  }}
                />
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
                  pixels={pixels}
                  setPixels={setPixels}
                />
              </div>
              
              {/* Color Palette */}
              <ColorPicker 
                selectedColor={selectedColor}
                onColorChange={setSelectedColor}
                isEyedropperActive={isEyedropperActive}
                onEyedropperToggle={handleEyedropperToggle}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
