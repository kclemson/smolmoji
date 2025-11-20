import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PixelCanvas } from "@/components/PixelCanvas";
import { ColorPicker, DEFAULT_CUSTOM_COLORS } from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { Download, Sparkles, Loader2, Undo2, Redo2, Pipette, Eraser, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useDebouncedLocalStorage } from "@/hooks/useDebouncedLocalStorage";
import { cn } from "@/lib/utils";

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

    // Check if regenerating (there's existing work)
    const isRegenerating = pixels.length > 0 || imageData !== null;
    
    // Clear state when regenerating
    if (isRegenerating) {
      setImageData(null);
      setPixels([]);
      setOriginalPixels([]);
      setCustomColors([]);
      setHistoryStack([]);
      setHistoryIndex(-1);
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

  const shiftPixels = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (pixels.length === 0) return;
    
    const newPixels: string[][] = Array(32).fill(null).map(() => Array(32).fill('transparent'));
    
    pixels.forEach((row, y) => {
      row.forEach((color, x) => {
        if (color === 'transparent') return; // Skip background pixels
        
        let newX = x;
        let newY = y;
        
        switch (direction) {
          case 'up':
            newY = y - 1;
            break;
          case 'down':
            newY = y + 1;
            break;
          case 'left':
            newX = x - 1;
            break;
          case 'right':
            newX = x + 1;
            break;
        }
        
        // Only place pixel if it's within bounds
        if (newX >= 0 && newX < 32 && newY >= 0 && newY < 32) {
          newPixels[newY][newX] = color;
        }
        // Pixels that fall off the edge are simply discarded
      });
    });
    
    setPixels(newPixels);
    pushToHistory(newPixels);
  }, [pixels, pushToHistory]);

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
            Emoji Lab
          </h1>
        </div>

        {/* Single Column Layout */}
        <div className="space-y-6">
          {/* Row 1: Design Direction + Background + Generate */}
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
                  {pixels.length > 0 || imageData !== null ? "Re-generate" : "Generate"}
                </Button>
              </div>
            </div>
          </div>

          {/* Pixel Editor */}
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
              
              {/* Main Canvas - Centered */}
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
            
            {/* Compact Tools Row: Eyedropper, Eraser, Undo, Redo, Separator, Shift Controls */}
            <div className="flex justify-center gap-2 items-center">
              {/* Eyedropper */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleEyedropperToggle}
                className={cn(
                  "w-8 h-8 p-0",
                  isEyedropperActive && "ring-2 ring-primary bg-primary/10"
                )}
                title="Eyedropper (pick color from canvas)"
              >
                <Pipette className="h-3.5 w-3.5" />
              </Button>
              
              {/* Eraser */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedColor("transparent")}
                className={cn(
                  "w-8 h-8 p-0",
                  selectedColor === "transparent" && "ring-2 ring-primary"
                )}
                title="Eraser"
              >
                <Eraser className="h-3.5 w-3.5" />
              </Button>
              
              {/* Undo */}
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={historyIndex <= 0}
                className="w-8 h-8 p-0"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              
              {/* Redo */}
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={historyIndex >= historyStack.length - 1}
                className="w-8 h-8 p-0"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
              
              {/* Separator */}
              <div className="w-px h-8 bg-border" />
              
              {/* D-Pad Shift Controls */}
              <div className="grid grid-cols-3 grid-rows-2 gap-1 w-fit">
                {/* Up button - centered in top row */}
                <div className="col-start-2 row-start-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shiftPixels('up')}
                    disabled={pixels.length === 0}
                    title="Shift pixels up"
                    className="w-8 h-8 p-0"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                </div>
                
                {/* Left button */}
                <div className="col-start-1 row-start-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shiftPixels('left')}
                    disabled={pixels.length === 0}
                    title="Shift pixels left"
                    className="w-8 h-8 p-0"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>
                </div>
                
                {/* Down button - centered in bottom row */}
                <div className="col-start-2 row-start-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shiftPixels('down')}
                    disabled={pixels.length === 0}
                    title="Shift pixels down"
                    className="w-8 h-8 p-0"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                
                {/* Right button */}
                <div className="col-start-3 row-start-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shiftPixels('right')}
                    disabled={pixels.length === 0}
                    title="Shift pixels right"
                    className="w-8 h-8 p-0"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            
        {/* Color Palette */}
        <div className="flex justify-center">
          <ColorPicker
            selectedColor={selectedColor}
            onColorChange={setSelectedColor}
            customColors={customColors}
            onCustomColorsChange={setCustomColors}
          />
        </div>

        {/* Background Selection - Moved below color picker */}
        <div className="flex justify-center">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Background:</Label>
            <RadioGroup 
              value={backgroundColor} 
              onValueChange={(value) => setBackgroundColor(value as "transparent" | "white" | "black")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-1.5">
                <RadioGroupItem value="transparent" id="bg-transparent" />
                <Label htmlFor="bg-transparent" className="text-xs text-muted-foreground cursor-pointer">Transparent</Label>
              </div>
              <div className="flex items-center space-x-1.5">
                <RadioGroupItem value="white" id="bg-white" />
                <Label htmlFor="bg-white" className="text-xs text-muted-foreground cursor-pointer">White</Label>
              </div>
              <div className="flex items-center space-x-1.5">
                <RadioGroupItem value="black" id="bg-black" />
                <Label htmlFor="bg-black" className="text-xs text-muted-foreground cursor-pointer">Black</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {/* Instructions */}
        <p className="text-xs text-muted-foreground text-center">
          left click to color, right click to revert. click and drag to create a rectangle.
        </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
