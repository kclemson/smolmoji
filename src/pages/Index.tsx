import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PixelCanvas } from "@/components/PixelCanvas";
import { ColorPicker, DEFAULT_CUSTOM_COLORS } from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { Download, Sparkles, Loader2, Undo2, Redo2 } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useDebouncedLocalStorage } from "@/hooks/useDebouncedLocalStorage";

const Index = () => {
  const [prompt, setPrompt] = useState("");
  const [imageData, setImageData] = useLocalStorage<string | null>("emoji-imageData", null);
  const [selectedColor, setSelectedColor] = useLocalStorage("emoji-selectedColor", "#000000");
  const [customColors, setCustomColors] = useLocalStorage<string[]>("emoji-customColors", DEFAULT_CUSTOM_COLORS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const [pixels, setPixels] = useDebouncedLocalStorage<string[][]>("emoji-pixels", []);
  const [originalPixels, setOriginalPixels] = useLocalStorage<string[][]>("emoji-originalPixels", []);
  const [backgroundColor, setBackgroundColor] = useLocalStorage<"transparent" | "white" | "black">("emoji-backgroundColor", "transparent");
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const preview32Ref = useRef<HTMLCanvasElement>(null);
  
  // Undo/Redo state
  const [historyStack, setHistoryStack] = useLocalStorage<string[][][]>("emoji-historyStack", []);
  const [historyIndex, setHistoryIndex] = useLocalStorage("emoji-historyIndex", -1);
  const MAX_HISTORY = 50;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
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
      }
    } catch (error: any) {
      console.error("Generation error:", error);
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
    
    // Fill background based on selection
    if (backgroundColor === "white") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, 32, 32);
    } else if (backgroundColor === "black") {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, 32, 32);
    }
    // If transparent, leave it cleared (already done by clearRect above)
    
    // Draw emoji pixels on top
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
  };

  useEffect(() => {
    // Update previews whenever pixels or background changes
    updatePreviews();
  }, [pixels, backgroundColor]);

  // Undo/Redo functions
  const pushToHistory = useCallback((newPixels: string[][]) => {
    setHistoryStack(prev => {
      const truncated = prev.slice(0, historyIndex + 1);
      const newStack = [...truncated, structuredClone(newPixels)];
      return newStack.slice(-MAX_HISTORY);
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setPixels(structuredClone(historyStack[newIndex]));
  }, [historyIndex, historyStack]);

  const redo = useCallback(() => {
    if (historyIndex >= historyStack.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setPixels(structuredClone(historyStack[newIndex]));
  }, [historyIndex, historyStack]);

  const handlePixelEditComplete = useCallback((newPixels: string[][]) => {
    pushToHistory(newPixels);
  }, [pushToHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
      
      if (mod && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (mod && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

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
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Discord Emoji Maker
          </h1>
        </div>

        {/* Single Column Layout */}
        <div className="space-y-6">
          {/* Row 1: Design Direction + Background + Generate */}
          <Card className="p-6">
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Design Direction:</Label>
              <Textarea
                placeholder="e.g., happy cat, fire symbol, laughing face..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                rows={2}
                className="w-full text-sm resize-none"
              />
              
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Background:</Label>
                <RadioGroup 
                  value={backgroundColor} 
                  onValueChange={(value) => setBackgroundColor(value as "transparent" | "white" | "black")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="transparent" id="bg-transparent" />
                    <Label htmlFor="bg-transparent" className="text-sm cursor-pointer">Transparent</Label>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="white" id="bg-white" />
                    <Label htmlFor="bg-white" className="text-sm cursor-pointer">White</Label>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="black" id="bg-black" />
                    <Label htmlFor="bg-black" className="text-sm cursor-pointer">Black</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="flex justify-center">
                <Button 
                  onClick={handleGenerate} 
                  disabled={isGenerating}
                  size="sm"
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

          {/* Pixel Editor */}
          <Card className="p-6">
            <div className="space-y-4">
              {/* 32x32 Preview + Download Button */}
              <div className="flex items-center justify-center gap-4">
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
                <Button 
                  onClick={handleDownload} 
                  size="sm"
                  className="gap-2"
                  disabled={!imageData}
                  variant="outline"
                >
                  <Download className="w-4 h-4" />
                  Download PNG
                </Button>
              </div>
              
              {/* Main Canvas */}
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
                  onEditComplete={handlePixelEditComplete}
                  backgroundColor={backgroundColor}
                  originalPixels={originalPixels}
                  setOriginalPixels={setOriginalPixels}
              />
            </div>
            
            {/* Undo/Redo Controls */}
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={historyIndex <= 0}
                className="gap-2"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
                Undo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={historyIndex >= historyStack.length - 1}
                className="gap-2"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
                Redo
              </Button>
            </div>
            
            {/* Color Palette */}
            <ColorPicker
                selectedColor={selectedColor}
                onColorChange={setSelectedColor}
                customColors={customColors}
                onCustomColorsChange={setCustomColors}
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
