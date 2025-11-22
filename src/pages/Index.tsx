import { useState, useRef, useEffect, useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { PixelCanvas, PixelCanvasRef } from "@/components/PixelCanvas";
import { ColorPicker, DEFAULT_CUSTOM_COLORS } from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { Download, Sparkles, Loader2, Undo2, Redo2, Pipette, Eraser, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Maximize2, Scissors, Wand2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

const Index = () => {
  const ERROR_MESSAGE = "hrm, the model didn't like that - it does that sometimes. try something else.";
  
  const [prompt, setPrompt] = useLocalStorage<string>("emoji-prompt", "");
  const [imageData, setImageData] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useLocalStorage<string>("emoji-selectedColor", "#000000");
  const [customColors, setCustomColors] = useLocalStorage<string[]>("emoji-customColors", DEFAULT_CUSTOM_COLORS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const [backgroundColor, setBackgroundColor] = useLocalStorage<"transparent" | "white" | "black">("emoji-backgroundColor", "transparent");
  const [backgroundRemoved, setBackgroundRemoved] = useLocalStorage<boolean>("emoji-backgroundRemoved", false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMagicWandActive, setIsMagicWandActive] = useState(false);
  const [selectedPixels, setSelectedPixels] = useState<Set<string>>(new Set());
  const [magicWandTolerance, setMagicWandTolerance] = useLocalStorage<number>("emoji-magicWandTolerance", 25);
  const [backgroundRemovalTolerance, setBackgroundRemovalTolerance] = useLocalStorage<number>("emoji-backgroundRemovalTolerance", 20);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Refs for canvases
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const preview32Ref = useRef<HTMLCanvasElement>(null);
  const pixelCanvasRef = useRef<PixelCanvasRef>(null);
  
  // Undo/Redo state
  const [historyStack, setHistoryStack] = useState<string[][][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(historyIndex);
  const MAX_HISTORY = 50;
  const hasLoadedPixels = useRef(false);

  // Computed state: are we in "virgin" state (generating or no pixels)?
  const isVirginState = isGenerating || !pixelCanvasRef.current?.getPixels().length;

  // Load persisted pixels when canvas is ready (ref callback pattern - no useEffect!)
  const handleCanvasReady = useCallback(() => {
    if (!hasLoadedPixels.current && pixelCanvasRef.current) {
      try {
        const savedPixels = localStorage.getItem("emoji-pixels");
        if (savedPixels) {
          const pixels = JSON.parse(savedPixels);
          pixelCanvasRef.current.setPixels(pixels);
          console.log("Loaded persisted pixels from localStorage");
        }
        hasLoadedPixels.current = true;
      } catch (error) {
        console.error("Error loading pixels from localStorage:", error);
        hasLoadedPixels.current = true; // Prevent retry on error
      }
    }
  }, []);

  const floodFillSelect = (
    pixels: string[][],
    startX: number,
    startY: number
  ): Set<string> => {
    const targetColor = pixels[startY]?.[startX] || 'transparent';
    const selected = new Set<string>();
    const queue: Array<{x: number, y: number}> = [{x: startX, y: startY}];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const {x, y} = queue.shift()!;
      const key = `${x},${y}`;
      
      if (visited.has(key) || x < 0 || x >= 32 || y < 0 || y >= 32) continue;
      visited.add(key);
      
      const pixelColor = pixels[y]?.[x] || 'transparent';
      if (!colorsAreSimilar(pixelColor, targetColor, magicWandTolerance)) continue;
      
      selected.add(key);
      
      // Add 4-directional neighbors
      queue.push({x: x - 1, y}, {x: x + 1, y}, {x, y: y - 1}, {x, y: y + 1});
    }
    
    return selected;
  };

  const generateFilename = (prompt: string): string => {
    if (!prompt || !prompt.trim()) {
      return `smolmoji-${Date.now()}.png`;
    }

    // Extract meaningful words from the prompt
    const words = prompt
      .trim()
      .toLowerCase()
      // Remove common filler words
      .replace(/\b(with|and|the|a|an|in|on|at|for|to|of|as|emoji|pixel|art)\b/gi, ' ')
      // Remove special characters and punctuation
      .replace(/[^a-z0-9\s]/gi, '')
      // Split into words and filter empty
      .split(/\s+/)
      .filter(word => word.length > 0);

    // Take first 1-2 meaningful words
    const filenameWords = words.slice(0, 2);
    
    if (filenameWords.length === 0) {
      // Fallback if no meaningful words found
      return `smolmoji-${Date.now()}.png`;
    }

    // Join words with dash
    const slug = filenameWords.join('-');
    
    return `smolmoji-${slug}.png`;
  };

  const hexToRgb = (color: string): { r: number; g: number; b: number } | null => {
    // Handle rgba format: rgba(r,g,b,a)
    const rgbaMatch = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/i.exec(color);
    if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1]),
        g: parseInt(rgbaMatch[2]),
        b: parseInt(rgbaMatch[3])
      };
    }
    
    // Handle hex format: #rrggbb
    const hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    if (hexMatch) {
      return {
        r: parseInt(hexMatch[1], 16),
        g: parseInt(hexMatch[2], 16),
        b: parseInt(hexMatch[3], 16)
      };
    }
    
    return null;
  };

  const colorDistance = (color1: string, color2: string): number => {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    
    if (!rgb1 || !rgb2) return Infinity;
    
    // Euclidean distance in RGB space
    return Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) +
      Math.pow(rgb1.g - rgb2.g, 2) +
      Math.pow(rgb1.b - rgb2.b, 2)
    );
  };

  const colorsAreSimilar = (
    color1: string, 
    color2: string, 
    threshold: number = 20
  ): boolean => {
    // For selection purposes, always treat transparent as white
    // This ensures consistent magic wand behavior
    const normalizedColor1 = color1 === 'transparent' ? '#ffffff' : color1;
    const normalizedColor2 = color2 === 'transparent' ? '#ffffff' : color2;
    
    if (normalizedColor1 === normalizedColor2) return true;
    return colorDistance(normalizedColor1, normalizedColor2) <= threshold;
  };

  const extractColorsFromImage = useCallback((imageUrl: string): Promise<string[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d');
        
        if (!ctx) {
          resolve([]);
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const pixels = imageData.data;
        
        // Count color frequencies
        const colorCounts = new Map<string, number>();
        
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          
          // Skip transparent/near-transparent pixels
          if (a < 128) continue;
          
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
          colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
        }
        
        // Sort by frequency
        const sortedColors = Array.from(colorCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([color]) => color);
        
        // Deduplicate similar colors
        const distinctColors: string[] = [];
        const SIMILARITY_THRESHOLD = 20;
        
        for (const color of sortedColors) {
          const rgb = hexToRgb(color);
          if (!rgb) continue;
          
          // Skip white and near-white colors
          if (rgb.r > 240 && rgb.g > 240 && rgb.b > 240) continue;
          
          const isSimilar = distinctColors.some(existingColor => {
            const existingRgb = hexToRgb(existingColor);
            if (!existingRgb) return false;
            
            const distance = Math.sqrt(
              Math.pow(rgb.r - existingRgb.r, 2) +
              Math.pow(rgb.g - existingRgb.g, 2) +
              Math.pow(rgb.b - existingRgb.b, 2)
            );
            
            return distance < SIMILARITY_THRESHOLD;
          });
          
          if (!isSimilar) {
            distinctColors.push(color);
            if (distinctColors.length >= 5) break;
          }
        }
        
        resolve(distinctColors.slice(0, 5));
      };
      
      img.onerror = () => resolve([]);
      img.src = imageUrl;
    });
  }, []);

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
      setIsMagicWandActive(false);
      setSelectedPixels(new Set());
      setHistoryStack([]);
      setHistoryIndex(-1);
      historyIndexRef.current = -1;
      
      // Clear persisted pixels from localStorage
      try {
        localStorage.removeItem("emoji-pixels");
      } catch (error) {
        console.error("Error clearing pixels from localStorage:", error);
      }
      
      // Reset the loaded flag so new emoji can be persisted
      hasLoadedPixels.current = false;
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
        
        // Extract and set colors as initial customColors
        const colors = await extractColorsFromImage(data.imageUrl);
        setCustomColors(colors);
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
    
    // Save pixels to localStorage synchronously (no useEffect!)
    try {
      localStorage.setItem("emoji-pixels", JSON.stringify(newPixels));
    } catch (error) {
      console.error("Error saving pixels to localStorage:", error);
    }
  }, []);

  const handleMagicWandClick = useCallback((x: number, y: number) => {
    if (!pixelCanvasRef.current) return;
    
    const pixels = pixelCanvasRef.current.getPixels();
    const selection = floodFillSelect(pixels, x, y);
    setSelectedPixels(selection);
    // Magic wand stays active - user can make multiple selections
  }, []);

  const applyActionToSelection = useCallback((action: 'fill' | 'erase') => {
    if (!pixelCanvasRef.current || selectedPixels.size === 0) return;
    
    const pixels = pixelCanvasRef.current.getPixels();
    const newPixels = pixels.map((row, y) =>
      row.map((color, x) => {
        const key = `${x},${y}`;
        if (selectedPixels.has(key)) {
          return action === 'erase' ? 'transparent' : selectedColor;
        }
        return color;
      })
    );
    
    pixelCanvasRef.current.setPixels(newPixels);
    setSelectedPixels(new Set()); // Clear selection after action
  }, [selectedPixels, selectedColor]);

  const handleEyedropperToggle = () => {
    const newEyedropperState = !isEyedropperActive;
    setIsEyedropperActive(newEyedropperState);
    
    // If activating eyedropper while eraser is selected, switch to a visible color
    if (newEyedropperState && selectedColor === "transparent") {
      setSelectedColor("#000000");
    }
    
    setIsMagicWandActive(false); // Deactivate magic wand
    setSelectedPixels(new Set()); // Clear selection
  };

  const handleColorPick = (color: string) => {
    setSelectedColor(color);
    setIsEyedropperActive(false);
    
    // Add to custom colors FIFO style using functional update
    setCustomColors((prevColors) => {
      const filtered = prevColors.filter(c => c !== color);
      return [color, ...filtered].slice(0, 5);
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
      a.download = generateFilename(prompt);
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-4">
      <div 
        className="w-full flex flex-col items-center gap-2 sm:gap-3" 
        style={{ maxWidth: '448px', width: '100%' }}
      >
        {/* Header */}
        <div className="w-full flex items-center justify-center relative">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-cyan-400 to-teal-300 bg-clip-text text-transparent">
            smolmoji.com
          </h1>
          
          {!isVirginState && (
            <div className="absolute right-0">
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    {/* Magic Wand Tolerance */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Magic Wand Tolerance: {magicWandTolerance}</Label>
                      </div>
                      <Slider
                        min={10}
                        max={50}
                        step={5}
                        value={[magicWandTolerance]}
                        onValueChange={(value) => setMagicWandTolerance(value[0])}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">Lower = more selective</p>
                    </div>
                    
                    {/* Background Removal Tolerance */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Background Removal Tolerance: {backgroundRemovalTolerance}</Label>
                      </div>
                      <Slider
                        min={5}
                        max={40}
                        step={5}
                        value={[backgroundRemovalTolerance]}
                        onValueChange={(value) => setBackgroundRemovalTolerance(value[0])}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">Higher = more aggressive</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Single Column Layout */}
        <div className="space-y-2 sm:space-y-3">
          {/* Row 1: Design Direction with integrated generate button */}
          <div className="relative w-[320px] mx-auto">
            <Textarea
              placeholder={errorMessage || "Describe your emoji idea: chicken nugget with wizard hat, woman laughing with salad, etc..."}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setErrorMessage(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && prompt.trim()) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              rows={2}
              className="w-full text-xs resize-none pr-28"
            />
            
            {/* Generate button - bottom right */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="absolute bottom-1 right-2 h-6 px-2 rounded-full text-xs"
              variant={prompt.trim() ? "default" : "ghost"}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  {(pixelCanvasRef.current?.getPixels() || []).length > 0 || imageData !== null ? "Re-generate" : "Generate"}
                </>
              )}
            </Button>
          </div>
          </div>

          {/* Pixel Editor */}
          <div className="space-y-2 sm:space-y-3">
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
                  disabled={!imageData || isVirginState}
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
                  onReady={handleCanvasReady}
                  isMagicWandActive={isMagicWandActive}
                  onMagicWandClick={handleMagicWandClick}
                  selectedPixels={selectedPixels}
                  isVirginState={isVirginState}
                />
              </div>

        {/* Color Palette - hidden in virgin state */}
        {!isVirginState && (
          <div className="w-[320px] mx-auto">
            <ColorPicker
              selectedColor={selectedColor}
              onColorChange={(color) => {
                if (selectedPixels.size > 0) {
                  setSelectedColor(color); // Update color first
                  applyActionToSelection('fill'); // Apply to selection
                } else {
                  setSelectedColor(color); // Normal color selection
                }
              }}
              customColors={customColors}
              onCustomColorsChange={setCustomColors}
              isEyedropperActive={isEyedropperActive}
              onEyedropperToggle={handleEyedropperToggle}
              isEraserActive={selectedColor === "transparent"}
              onEraserToggle={() => {
                if (selectedPixels.size > 0) {
                  applyActionToSelection('erase'); // Apply erase to selection
                } else {
                  setSelectedColor("transparent"); // Normal eraser mode
                  setIsEyedropperActive(false);
                  setIsMagicWandActive(false);
                }
              }}
            />
          </div>
        )}
            
            {/* Compact Tools Row: Undo, Redo, Auto-fit, Remove Background, Shift Controls */}
            {!isVirginState && (
              <div className="w-[320px] mx-auto">
                <div className="flex justify-between items-center w-full">
                {/* Left Section: Undo/Redo */}
                <div className="flex gap-2 items-center">
                  {/* Undo */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={undo}
                    disabled={historyIndex <= 0 || isVirginState}
                    className="w-10 h-10 p-0"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 className="h-5 w-5" />
                  </Button>
                  
                  {/* Redo */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={redo}
                    disabled={historyIndex >= historyStack.length - 1 || isVirginState}
                    className="w-10 h-10 p-0"
                    title="Redo (Ctrl+Y)"
                  >
                    <Redo2 className="h-5 w-5" />
                  </Button>
                </div>

                {/* Center Section: Magic Wand, Scissors/Autofit */}
                <div className="flex flex-col gap-2 items-center">
                  <div className="flex gap-2 items-center">
                    {/* Magic Wand Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newState = !isMagicWandActive;
                        setIsMagicWandActive(newState);
                        if (!newState) {
                          setSelectedPixels(new Set()); // Clear selection when manually deactivating
                        }
                      }}
                      disabled={!pixelCanvasRef.current?.getPixels().length || isVirginState}
                      title="Magic wand: Select contiguous pixels"
                      className={cn(
                        "w-10 h-10 p-0",
                        isMagicWandActive && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                      )}
                    >
                      <Wand2 className="h-5 w-5" />
                    </Button>

                    {/* Remove Background Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveBackground}
                      disabled={!pixelCanvasRef.current?.getPixels().length || backgroundRemoved || isVirginState}
                      title="Remove background from edges"
                      className="w-10 h-10 p-0"
                    >
                      <Scissors className="h-5 w-5" />
                    </Button>
                    
                    {/* Auto-Fit Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={autoFitEmoji}
                      disabled={!pixelCanvasRef.current?.getPixels().length || !backgroundRemoved || isVirginState}
                      title="Auto-fit (remove padding and maximize emoji)"
                      className="w-10 h-10 p-0"
                    >
                      <Maximize2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Right Section: D-Pad Shift Controls */}
                <div className="flex items-center">
                  <div className="grid grid-cols-3 grid-rows-3 gap-0 w-fit">
                  {/* Up button - centered in top row */}
                  <div className="col-start-2 row-start-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shiftPixels('up')}
                      disabled={!pixelCanvasRef.current?.getPixels().length || isVirginState}
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
                      disabled={!pixelCanvasRef.current?.getPixels().length || isVirginState}
                      title="Shift pixels left"
                      className="w-6 h-6 p-0"
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {/* Down button - centered in bottom row */}
                  <div className="col-start-2 row-start-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shiftPixels('down')}
                      disabled={!pixelCanvasRef.current?.getPixels().length || isVirginState}
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
                      disabled={!pixelCanvasRef.current?.getPixels().length || isVirginState}
                      title="Shift pixels right"
                      className="w-6 h-6 p-0"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Background Selection Row - appears as its own section when background is removed */}
            {backgroundRemoved && !isVirginState && (
              <div className="flex justify-center mt-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Background:</Label>
                  <RadioGroup 
                    value={backgroundColor} 
                    onValueChange={(value) => {
                      const newBg = value as "transparent" | "white" | "black";
                      setBackgroundColor(newBg);
                      const currentPixels = pixelCanvasRef.current?.getPixels();
                      if (currentPixels) updatePreviews(currentPixels);
                    }}
                    className="flex flex-col gap-1.5"
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
        </div>
      </div>
    </div>
  );
};

export default Index;
