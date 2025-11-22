import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PixelCanvas, PixelCanvasRef } from "@/components/PixelCanvas";
import { ColorPicker, DEFAULT_CUSTOM_COLORS } from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { Download, Sparkles, Loader2, Undo2, Redo2, Pipette, Eraser, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Maximize2, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

const Index = () => {
  const ERROR_MESSAGE = "hrm, the model didn't like that - it does that sometimes. try something else.";
  
  const [prompt, setPrompt] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [customColors, setCustomColors] = useState<string[]>(DEFAULT_CUSTOM_COLORS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState<"transparent" | "white" | "black">("transparent");
  const [backgroundRemoved, setBackgroundRemoved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Refs for canvases
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const preview32Ref = useRef<HTMLCanvasElement>(null);
  const pixelCanvasRef = useRef<PixelCanvasRef>(null);
  
  // Undo/Redo state
  const [historyStack, setHistoryStack] = useState<string[][][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(historyIndex);
  const MAX_HISTORY = 50;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return;
    }

    // Clear error message
    setErrorMessage(null);

    // Check if regenerating (there's existing work)
    const currentPixels = pixelCanvasRef.current?.getPixels() || [];
    const isRegenerating = currentPixels.length > 0 || imageData !== null;
    
    // Clear all state on regenerate
    if (isRegenerating) {
      // Clear preview canvas IMMEDIATELY for instant visual feedback
      const preview32 = preview32Ref.current;
      if (preview32) {
        const ctx = preview32.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, 32, 32);
        }
      }
      
      // Animate pixel grid dissolve
      pixelCanvasRef.current?.animateDissolve();
      
      setImageData(null);
      setCustomColors(DEFAULT_CUSTOM_COLORS);
      setSelectedColor("#000000");
      setBackgroundColor("transparent");
      setBackgroundRemoved(false);
      setIsEyedropperActive(false);
      setHistoryStack([]);
      setHistoryIndex(-1);
      historyIndexRef.current = -1;
    }

    setIsGenerating(true);
    
    try {
      const { data } = await supabase.functions.invoke("generate-emoji", {
        body: { prompt },
      });

      // If we didn't get an image, something went wrong
      if (!data?.imageUrl) {
        setErrorMessage(ERROR_MESSAGE);
      } else {
        // We got an image, load it imperatively
        pixelCanvasRef.current?.loadImage(data.imageUrl);
        setImageData(data.imageUrl);
      }
    } catch (error) {
      // Handle any thrown errors (like 500 responses)
      setErrorMessage(ERROR_MESSAGE);
    }
    
    setIsGenerating(false);
  };


  const updatePreviews = (pixelsToRender: string[][]) => {
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
    pixelsToRender.forEach((row, y) => {
      row.forEach((color, x) => {
        if (color !== "transparent") {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      });
    });
  };

  // Handle pixels updated from PixelCanvas
  const handlePixelsUpdated = useCallback((newPixels: string[][], isInitialLoad: boolean) => {
    updatePreviews(newPixels);
    
    // Don't push initial AI load to history
    if (!isInitialLoad) {
      pushToHistory(newPixels);
    } else {
      // For initial load, set up the base history
      setHistoryStack([structuredClone(newPixels)]);
      setHistoryIndex(0);
      historyIndexRef.current = 0;
    }
  }, []);

  const handleEyedropperToggle = () => {
    const newEyedropperState = !isEyedropperActive;
    setIsEyedropperActive(newEyedropperState);
    
    // If activating eyedropper while eraser is selected, switch to a visible color
    if (newEyedropperState && selectedColor === "transparent") {
      setSelectedColor("#000000");
    }
  };

  const handleColorPick = (color: string) => {
    setSelectedColor(color);
    setIsEyedropperActive(false);
    
    // Add to custom colors FIFO style (same logic as ColorPicker)
    setCustomColors((prevColors) => {
      if (!prevColors.includes(color)) {
        return [color, ...prevColors].slice(0, 8);
      }
      return prevColors;
    });
  };


  // Sync ref with historyIndex state
  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // Undo/Redo functions
  const pushToHistory = useCallback((newPixels: string[][]) => {
    const currentIndex = historyIndexRef.current;
    
    setHistoryStack(prev => {
      const truncated = prev.slice(0, currentIndex + 1);
      const newStack = [...truncated, structuredClone(newPixels)];
      return newStack.slice(-MAX_HISTORY);
    });
    const newIndex = Math.min(currentIndex + 1, MAX_HISTORY - 1);
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;
  }, []);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const restoredPixels = structuredClone(historyStack[newIndex]);
    pixelCanvasRef.current?.setPixels(restoredPixels);
    updatePreviews(restoredPixels);
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;
  }, [historyIndex, historyStack]);

  const redo = useCallback(() => {
    if (historyIndex >= historyStack.length - 1) return;
    const newIndex = historyIndex + 1;
    const restoredPixels = structuredClone(historyStack[newIndex]);
    pixelCanvasRef.current?.setPixels(restoredPixels);
    updatePreviews(restoredPixels);
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;
  }, [historyIndex, historyStack]);

  // Simplified tool functions - delegate to PixelCanvas
  const shiftPixels = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    pixelCanvasRef.current?.shift(direction);
  }, []);

  const autoFitEmoji = useCallback(() => {
    pixelCanvasRef.current?.autoFit();
  }, []);

  const handleRemoveBackground = useCallback(() => {
    pixelCanvasRef.current?.removeBackground();
    setBackgroundRemoved(true);
  }, []);


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
    const pixels = pixelCanvasRef.current?.getPixels();
    if (!pixels || pixels.length === 0) return;

    // Create a temporary canvas for the final image
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 512;
    tempCanvas.height = 512;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Fill background based on selection
    if (backgroundColor === "white") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, 512, 512);
    } else if (backgroundColor === "black") {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, 512, 512);
    }

    // Render pixels
    const pixelSize = 512 / 32;
    
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
      <div 
        className="w-full max-w-md mx-auto space-y-8"
        style={{ maxWidth: '448px', width: '100%' }}
      >
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            smolmoji
          </h1>
        </div>

        {/* Single Column Layout */}
        <div className="space-y-3">
          {/* Row 1: Design Direction + Background + Generate */}
          <div className="space-y-3">
          <Textarea
            placeholder={errorMessage || "Describe your emoji idea... e.g., wizard cat casting spell, glitching heart, steaming ramen bowl, pixel sword with aura, ninja penguin, disco ball party"}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setErrorMessage(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
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
                  {pixelCanvasRef.current?.getPixels().length || imageData !== null ? "Re-generate" : "Generate"}
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
                  ref={pixelCanvasRef}
                  selectedColor={selectedColor}
                  gridSize={32}
                  canvasRef={mainCanvasRef}
                  isEyedropperActive={isEyedropperActive}
                  onColorPick={handleColorPick}
                  onPixelsUpdated={handlePixelsUpdated}
                  backgroundColor={backgroundColor}
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
                onClick={() => {
                  setSelectedColor("transparent");
                  setIsEyedropperActive(false);
                }}
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
              
              {/* Auto-Fit Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={autoFitEmoji}
                disabled={!pixelCanvasRef.current?.getPixels().length}
                title="Auto-fit (remove padding and maximize emoji)"
                className="w-8 h-8 p-0"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              
              {/* Separator */}
              <div className="w-px h-8 bg-border" />
              
              {/* Remove Background Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveBackground}
                disabled={!pixelCanvasRef.current?.getPixels().length || backgroundRemoved}
                title="Remove background from edges"
                className="w-8 h-8 p-0"
              >
                <Scissors className="h-3.5 w-3.5" />
              </Button>
              
              {/* Separator */}
              <div className="w-px h-8 bg-border" />
              
              {/* D-Pad Shift Controls */}
              <div className="grid grid-cols-3 grid-rows-2 gap-0.5 w-fit">
                {/* Up button - centered in top row */}
                <div className="col-start-2 row-start-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shiftPixels('up')}
                    disabled={!pixelCanvasRef.current?.getPixels().length}
                    title="Shift pixels up"
                    className="w-6 h-6 p-0"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                </div>
                
                {/* Left button */}
                <div className="col-start-1 row-start-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shiftPixels('left')}
                    disabled={!pixelCanvasRef.current?.getPixels().length}
                    title="Shift pixels left"
                    className="w-6 h-6 p-0"
                  >
                    <ArrowLeft className="h-3 w-3" />
                  </Button>
                </div>
                
                {/* Down button - centered in bottom row */}
                <div className="col-start-2 row-start-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shiftPixels('down')}
                    disabled={!pixelCanvasRef.current?.getPixels().length}
                    title="Shift pixels down"
                    className="w-6 h-6 p-0"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                
                {/* Right button */}
                <div className="col-start-3 row-start-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shiftPixels('right')}
                    disabled={!pixelCanvasRef.current?.getPixels().length}
                    title="Shift pixels right"
                    className="w-6 h-6 p-0"
                  >
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Background Selection - Shown below scissors when background is removed */}
            {backgroundRemoved && (
              <div className="flex justify-center">
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-muted-foreground">Background:</Label>
                  <RadioGroup 
                    value={backgroundColor} 
                    onValueChange={(value) => {
                      const newBg = value as "transparent" | "white" | "black";
                      setBackgroundColor(newBg);
                      const currentPixels = pixelCanvasRef.current?.getPixels();
                      if (currentPixels) updatePreviews(currentPixels);
                    }}
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
            )}
            
        {/* Color Palette */}
        <div className="flex justify-center">
          <ColorPicker
            selectedColor={selectedColor}
            onColorChange={setSelectedColor}
            customColors={customColors}
            onCustomColorsChange={setCustomColors}
          />
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
