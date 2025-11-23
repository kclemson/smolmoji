import { useState, useRef, useEffect, useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useDebouncedLocalStorage } from "@/hooks/useDebouncedLocalStorage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { PixelCanvas, PixelCanvasRef } from "@/components/PixelCanvas";
import { ColorPicker, DEFAULT_CUSTOM_COLORS } from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { Download, Sparkles, Loader2, Undo2, Redo2, Pipette, Eraser, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Maximize2, Scissors, Wand2, Settings, Pencil, Move, Palette, Image } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

import { Slider } from "@/components/ui/slider";

const Index = () => {
  const ERROR_MESSAGE = "hrm, the model didn't like that - it does that sometimes. try something else.";
  
  const [prompt, setPrompt] = useLocalStorage<string>("emoji-prompt", "");
  const [imageData, setImageData] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useLocalStorage<string>("emoji-selectedColor", "#000000");
  const [customColors, setCustomColors] = useLocalStorage<string[]>("emoji-customColors", DEFAULT_CUSTOM_COLORS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const [backgroundColor, setBackgroundColor] = useLocalStorage<"transparent" | "white" | "black" | string>("emoji-backgroundColor", "transparent");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMagicWandActive, setIsMagicWandActive] = useState(false);
  const [selectedPixels, setSelectedPixels] = useState<Set<string>>(new Set());
  const [magicWandTolerance, setMagicWandTolerance] = useLocalStorage<number>("emoji-magicWandTolerance", 25);
  const [backgroundRemovalTolerance, setBackgroundRemovalTolerance] = useLocalStorage<number>("emoji-backgroundRemovalTolerance", 20);
  const [colorExtractionTolerance] = useState<number>(20);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);
  
  // Drawing mode state
  const [drawingMode, setDrawingMode] = useState<'pencil' | 'eraser' | 'wand'>('pencil');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [isDpadExpanded, setIsDpadExpanded] = useState(false);
  
  // Refs for canvases
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const preview32Ref = useRef<HTMLCanvasElement>(null);
  const pixelCanvasRef = useRef<PixelCanvasRef>(null);
  const colorPaletteInputRef = useRef<HTMLInputElement>(null);
  
  // Undo/Redo state
  const [historyStack, setHistoryStack] = useDebouncedLocalStorage<string[][][]>("emoji-history-stack", [], 500);
  const [historyIndex, setHistoryIndex] = useLocalStorage<number>("emoji-history-index", -1);
  const historyIndexRef = useRef(historyIndex);
  const lastKnownPixelsRef = useRef<string[][] | null>(null);
  const MAX_HISTORY = 50;
  const hasRestoredFromStorage = useRef(false);

  // Computed state: are we in "virgin" state (generating or no pixels)?
  const isVirginState = isGenerating || !localStorage.getItem("emoji-pixels");

  // Load persisted pixels when canvas is ready (ref callback pattern - no useEffect!)
  const handleCanvasReady = useCallback(() => {
    logger.state("handleCanvasReady called", { hasRestoredFromStorage: hasRestoredFromStorage.current, pixelCanvasRef: !!pixelCanvasRef.current });
    if (!hasRestoredFromStorage.current && pixelCanvasRef.current) {
      try {
        const savedPixels = localStorage.getItem("emoji-pixels");
        if (savedPixels) {
          const pixels = JSON.parse(savedPixels);
          pixelCanvasRef.current.setPixels(pixels);
          
          // Check if we have valid persisted history
          const savedHistoryStack = localStorage.getItem("emoji-history-stack");
          const savedHistoryIndex = localStorage.getItem("emoji-history-index");
          
          let shouldInitializeHistory = true;
          
          if (savedHistoryStack && savedHistoryIndex) {
            try {
              const stack = JSON.parse(savedHistoryStack);
              const index = JSON.parse(savedHistoryIndex);
              
              // Validate: history should have entries and index should be valid
              if (Array.isArray(stack) && stack.length > 0 && index >= 0 && index < stack.length) {
                // History looks valid, just sync refs (state is already loaded by hooks)
                lastKnownPixelsRef.current = structuredClone(pixels);
                historyIndexRef.current = index;
                shouldInitializeHistory = false;
                logger.history("restored persisted history", { entries: stack.length, index });
              }
            } catch (e) {
              logger.warn("invalid persisted history, reinitializing", e);
            }
          }
          
          if (shouldInitializeHistory) {
            // No valid history exists, initialize with loaded pixels as base state
            const initialHistory = [structuredClone(pixels)];
            setHistoryStack(initialHistory);
            setHistoryIndex(0);
            historyIndexRef.current = 0;
            lastKnownPixelsRef.current = structuredClone(pixels);
            logger.history("initialized fresh history from loaded pixels", { pixelsSize: `${pixels.length}x${pixels[0]?.length || 0}` });
          }
        }
        hasRestoredFromStorage.current = true;
      } catch (error) {
        logger.error("error loading pixels from localStorage", error);
        hasRestoredFromStorage.current = true;
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
      const img = document.createElement('img');
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
        
        // Deduplicate similar colors using user-defined tolerance
        const distinctColors: string[] = [];
        
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
            
            return distance < colorExtractionTolerance;
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
  }, [colorExtractionTolerance]);

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
      
      // Animate pixel grid dissolve and wait for it to complete
      await pixelCanvasRef.current?.animateDissolve();
      
      setImageData(null);
      setCustomColors(DEFAULT_CUSTOM_COLORS);
      setSelectedColor("#000000");
      setBackgroundColor("transparent");
      setIsEyedropperActive(false);
      setIsMagicWandActive(false);
      setSelectedPixels(new Set());
      setHistoryStack([]);
      setHistoryIndex(-1);
      historyIndexRef.current = -1;
      
      // Clear persisted pixels and history from localStorage
      try {
        localStorage.removeItem("emoji-pixels");
        localStorage.removeItem("emoji-history-stack");
        localStorage.removeItem("emoji-history-index");
      } catch (error) {
        logger.error("error clearing localStorage", error);
      }
      
      // Reset the loaded flag so new emoji can be persisted
      hasRestoredFromStorage.current = false;
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


  // Simple preview renderer - just draws pixels, CSS handles background
  const renderPreview = (pixels: string[][]) => {
    const preview32 = preview32Ref.current;
    if (!preview32) return;

    const ctx = preview32.getContext("2d");
    if (!ctx) return;
    
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    
    // Draw only non-transparent pixels
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (pixels[y][x] !== "transparent") {
          ctx.fillStyle = pixels[y][x];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  };

  // Handle pixels updated from PixelCanvas
  // Undo/Redo functions - defined BEFORE handlePixelsUpdated
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
    
    logger.history("history updated", {
      prevIndex: currentIndex,
      newIndex,
      stackLength: Math.min(currentIndex + 2, MAX_HISTORY),
    });
  }, []);

  const handlePixelsUpdated = useCallback((newPixels: string[][], isInitialImageFromAI: boolean) => {
    logger.state("handlePixelsUpdated called", { 
      source: isInitialImageFromAI ? 'AI generation' : 'user edit',
      hasLastPixels: !!lastKnownPixelsRef.current 
    });
    
    if (isInitialImageFromAI) {
      // For initial load, set up the base history
      setHistoryStack([structuredClone(newPixels)]);
      setHistoryIndex(0);
      historyIndexRef.current = 0;
      lastKnownPixelsRef.current = structuredClone(newPixels);
      const nonTransparentCount = newPixels.flat().filter(p => p !== 'transparent').length;
      logger.history("initial load processed, history initialized", { 
        nonTransparentPixels: nonTransparentCount 
      });
    } else {
      // Compare against last known pixels (not getPixels which may be stale)
      const lastPixels = lastKnownPixelsRef.current;
      
      // Check if anything actually changed
      const hasChanges = !lastPixels || lastPixels.some((row, y) =>
        row.some((color, x) => color !== newPixels[y]?.[x])
      );
      
      // Calculate pixel changes for useful logging
      let changedCount = 0;
      const sampleChanges: Array<{x: number, y: number, from: string, to: string}> = [];
      
      if (lastPixels && lastPixels.length === 32 && newPixels.length === 32) {
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            if (lastPixels[y][x] !== newPixels[y][x]) {
              changedCount++;
              if (sampleChanges.length < 3) {
                sampleChanges.push({x, y, from: lastPixels[y][x], to: newPixels[y][x]});
              }
            }
          }
        }
      }
      
      logger.state("change detection", { 
        hasChanges,
        hadPreviousState: !!lastPixels,
        changedPixelCount: lastPixels ? changedCount : 'all (1024)',
        sampleChanges: sampleChanges.length > 0 ? sampleChanges : 'none'
      });
      
      // Only push to history if pixels actually changed
      if (hasChanges) {
        pushToHistory(newPixels);
        lastKnownPixelsRef.current = structuredClone(newPixels);
      }
    }
    
    // Update preview (single source of truth)
    renderPreview(newPixels);
    
    // Save pixels to localStorage synchronously (no useEffect!)
    try {
      localStorage.setItem("emoji-pixels", JSON.stringify(newPixels));
    } catch (error) {
      console.error("Error saving pixels to localStorage:", error);
    }
  }, [pushToHistory]);

  const handleMagicWandClick = useCallback((x: number, y: number) => {
    if (!pixelCanvasRef.current) return;
    
    const pixels = pixelCanvasRef.current.getPixels();
    const selection = floodFillSelect(pixels, x, y);
    
    // Defer state update to avoid "setState during render" warning
    queueMicrotask(() => {
      setSelectedPixels(selection);
    });
    // Magic wand stays active - user can make multiple selections
  }, [magicWandTolerance]);

  const applyActionToSelection = useCallback((action: 'fill' | 'erase') => {
    if (!pixelCanvasRef.current || selectedPixels.size === 0) return;
    
    logger.tool("magic-wand action", { action, selectedPixelsCount: selectedPixels.size });
    
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
    
    // Add to history (this is an edit action)
    handlePixelsUpdated(newPixels, false);
  }, [selectedPixels, selectedColor, handlePixelsUpdated]);

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

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const restoredPixels = structuredClone(historyStack[newIndex]);
    pixelCanvasRef.current?.setPixels(restoredPixels);
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;
  }, [historyIndex, historyStack]);

  const redo = useCallback(() => {
    if (historyIndex >= historyStack.length - 1) return;
    const newIndex = historyIndex + 1;
    const restoredPixels = structuredClone(historyStack[newIndex]);
    pixelCanvasRef.current?.setPixels(restoredPixels);
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;
  }, [historyIndex, historyStack]);

  // Simplified tool functions - delegate to PixelCanvas
  const shiftPixels = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    logger.tool("shift transform", { direction });
    const updatedPixels = pixelCanvasRef.current?.shift(direction);
    if (updatedPixels) {
      handlePixelsUpdated(updatedPixels, false);
    }
  }, [handlePixelsUpdated]);

  const autoFitEmoji = useCallback(() => {
    logger.tool("autofit transform", {});
    const updatedPixels = pixelCanvasRef.current?.autoFit();
    if (updatedPixels) {
      handlePixelsUpdated(updatedPixels, false);
    }
  }, [handlePixelsUpdated]);

  const handleRemoveBackground = useCallback(() => {
    logger.tool("remove background", { tolerance: backgroundRemovalTolerance });
    const updatedPixels = pixelCanvasRef.current?.removeBackground(backgroundRemovalTolerance);
    if (updatedPixels) {
      handlePixelsUpdated(updatedPixels, false);
    }
  }, [backgroundRemovalTolerance, handlePixelsUpdated]);


  // Keyboard shortcuts
  useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't capture shortcuts when typing in textarea
    if (e.target instanceof HTMLTextAreaElement) return;
    
    const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
    
    // === UNDO/REDO ===
    if (mod && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      
      // === SELECTION MANAGEMENT ===
      if (e.key === 'Escape') {
        setSelectedPixels(new Set());
        setIsMagicWandActive(false);
        return;
      }
      
      if (mod && e.key === 'a') {
        e.preventDefault();
        // Select all pixels (32x32 grid)
        const allPixels = new Set<string>();
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            allPixels.add(`${x},${y}`);
          }
        }
        setSelectedPixels(allPixels);
        setIsMagicWandActive(true);
        return;
      }
      
      if (mod && e.key === 'd') {
        e.preventDefault();
        setSelectedPixels(new Set());
        setIsMagicWandActive(false);
        return;
      }
      
      // === DELETE SELECTED PIXELS ===
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPixels.size > 0) {
        e.preventDefault();
        applyActionToSelection('erase');
        return;
      }
      
      // === CUT SELECTED PIXELS (Ctrl+X) ===
      if (mod && e.key === 'x' && selectedPixels.size > 0) {
        e.preventDefault();
        applyActionToSelection('erase');
        return;
      }
    
    // === TOOL SELECTION ===
      if (e.key === 'p') {
        setDrawingMode('pencil');
        setIsMagicWandActive(false);
        setIsEyedropperActive(false);
        if (selectedColor === 'transparent') {
          setSelectedColor('#000000');
        }
        return;
      }
      
      if (e.key === 'e') {
        setDrawingMode('eraser');
        setSelectedColor('transparent');
        setIsMagicWandActive(false);
        setIsEyedropperActive(false);
        return;
      }
      
      if (e.key === 'w') {
        setDrawingMode('wand');
        setIsMagicWandActive(true);
        setIsEyedropperActive(false);
        return;
      }
      
      if (e.key === 'i') {
        const newEyedropperState = !isEyedropperActive;
        setIsEyedropperActive(newEyedropperState);
        setIsMagicWandActive(false);
        if (newEyedropperState && selectedColor === 'transparent') {
          setSelectedColor('#000000');
        }
        return;
      }
      
      if (e.key === 'c') {
        colorPaletteInputRef.current?.click();
        return;
      }
      
      // === COLOR SELECTION (1-5) ===
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const index = parseInt(e.key) - 1;
        const color = customColors[index];
        if (color) {
          setSelectedColor(color);
          // Switch to pencil if coming from eraser
          if (selectedColor === 'transparent') {
            setDrawingMode('pencil');
          }
        }
        return;
      }
      
      // === TRANSFORM/EDIT (only when not in virgin state) ===
      if (!isVirginState) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          shiftPixels('up');
          return;
        }
        
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          shiftPixels('down');
          return;
        }
        
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          shiftPixels('left');
          return;
        }
        
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          shiftPixels('right');
          return;
        }
        
        if (e.key === 'b') {
          handleRemoveBackground();
          return;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedPixels, applyActionToSelection, isVirginState, customColors, selectedColor, isEyedropperActive, isMagicWandActive, shiftPixels, handleRemoveBackground]);

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
    } else if (backgroundColor !== "transparent") {
      // Custom color
      ctx.fillStyle = backgroundColor;
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
        <div className="w-full flex items-center justify-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-700 via-cyan-600 to-teal-500 bg-clip-text text-transparent">
            smolmoji.com
          </h1>
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
                className="w-full text-xs resize-none pr-2"
                spellCheck={false}
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
                    height: "32px",
                    backgroundColor: backgroundColor === "transparent" 
                      ? "hsl(var(--canvas-bg))" 
                      : backgroundColor
                  }}
                />
                <Button 
                  onClick={handleDownload} 
                  size="sm"
                  className="gap-2"
                  disabled={isVirginState}
                  variant="outline"
                >
                  <Download className="w-4 h-4" />
                  Download PNG
                </Button>
              </div>
              
              {/* Main Canvas - Centered */}
              <div className={`flex justify-center ${isGenerating ? 'pointer-events-none opacity-50' : ''}`}>
                <PixelCanvas
                  ref={pixelCanvasRef}
                  selectedColor={selectedColor}
                  gridSize={32}
                  canvasRef={mainCanvasRef}
                  isEyedropperActive={isEyedropperActive}
                  onColorPick={handleColorPick}
                  onPixelsChanged={handlePixelsUpdated}
                  backgroundColor={backgroundColor}
                  onReady={handleCanvasReady}
                  isMagicWandActive={isMagicWandActive}
                  onMagicWandClick={handleMagicWandClick}
                  selectedPixels={selectedPixels}
                  isVirginState={isVirginState}
                  brushSize={brushSize}
                />
              </div>

        {/* Row 1: Palette, Eyedropper, + 5 Color Slots - hidden in virgin state */}
        {!isVirginState && (
          <div className="w-[320px] mx-auto">
            <div className="grid grid-cols-7 gap-2 w-full">
              {/* Color Picker (Palette) */}
              <div className="relative">
                <input
                  ref={colorPaletteInputRef}
                  type="color"
                  value={selectedColor === "transparent" ? "#000000" : selectedColor}
                  onChange={(e) => {
                    const newColor = e.target.value.toUpperCase();
                    setSelectedColor(newColor);
                  }}
                  onBlur={(e) => {
                    const newColor = e.target.value.toUpperCase();
                    setSelectedColor(newColor);
                    
                    // Add to custom colors FIFO style
                    setCustomColors((prevColors) => {
                      const filtered = prevColors.filter(c => c !== newColor);
                      return [newColor, ...filtered].slice(0, 5);
                    });
                  }}
                  className="absolute inset-0 w-10 h-10 opacity-0 cursor-pointer z-10"
                />
                <button
                  className={cn(
                    "w-10 h-10 rounded-md border transition-all hover:scale-110",
                    "border-border bg-muted/20 flex items-center justify-center pointer-events-none"
                  )}
                >
                  <Palette className="h-5 w-5" />
                </button>
              </div>

              {/* Eyedropper */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleEyedropperToggle}
                className={cn(
                  "w-10 h-10 p-0",
                  isEyedropperActive && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                )}
                title="Eyedropper (pick color from canvas)"
              >
                <Pipette className="h-5 w-5" />
              </Button>

              {/* 5 dynamic color slots */}
              {Array.from({ length: 5 }).map((_, index) => {
                const color = customColors[index];
                return (
                  <button
                    key={`color-${index}`}
                    onClick={() => {
                      if (color) {
                        if (selectedPixels.size > 0) {
                          setSelectedColor(color);
                          applyActionToSelection('fill');
                        } else {
                          setSelectedColor(color);
                        }
                      }
                    }}
                    className={cn(
                      "w-10 h-10 rounded-md transition-all",
                      color && "border",
                      color ? "hover:scale-110 cursor-pointer" : "cursor-default",
                      color && selectedColor === color 
                        ? "border-border ring-2 ring-primary ring-offset-1 ring-offset-background" 
                        : color && "border-border"
                    )}
                    style={color ? { backgroundColor: color } : {}}
                    disabled={!color}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Row 2: Drawing Modes (Pencil, Eraser, Magic Wand) + Brush Size - hidden in virgin state */}
        {!isVirginState && (
          <div className="w-[320px] mx-auto flex items-center justify-between gap-2">
            {/* Drawing Mode Toggle Group */}
            <ToggleGroup 
              type="single" 
              value={drawingMode} 
              onValueChange={(value) => {
                if (value) {
                  setDrawingMode(value as 'pencil' | 'eraser' | 'wand');
                  
                  // Update related state based on mode
                  if (value === 'eraser') {
                    setSelectedColor("transparent");
                    setIsEyedropperActive(false);
                    setIsMagicWandActive(false);
                    setSelectedPixels(new Set());
                  } else if (value === 'wand') {
                    setIsMagicWandActive(true);
                    setIsEyedropperActive(false);
                    if (selectedColor === "transparent") {
                      setSelectedColor("#000000");
                    }
                  } else if (value === 'pencil') {
                    setIsMagicWandActive(false);
                    setSelectedPixels(new Set());
                    setIsEyedropperActive(false);
                    if (selectedColor === "transparent") {
                      setSelectedColor("#000000");
                    }
                  }
                }
              }}
              variant="outline"
              className="flex gap-2"
            >
              <ToggleGroupItem value="pencil" aria-label="Pencil tool" className="w-10 h-10 p-0">
                <Pencil className="h-5 w-5" />
              </ToggleGroupItem>
              <ToggleGroupItem value="eraser" aria-label="Eraser tool" className="w-10 h-10 p-0">
                <Eraser className="h-5 w-5" />
              </ToggleGroupItem>
              <ToggleGroupItem value="wand" aria-label="Magic wand tool" className="w-10 h-10 p-0">
                <Wand2 className="h-5 w-5" />
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Brush Size Selector (visible when pencil or eraser active) */}
            {(drawingMode === 'pencil' || drawingMode === 'eraser') && (
              <ToggleGroup 
                type="single" 
                value={brushSize.toString()} 
                onValueChange={(value) => value && setBrushSize(parseInt(value))}
                variant="outline"
                className="flex gap-2"
              >
                <ToggleGroupItem value="1" aria-label="1x1 brush" className="w-10 h-10 p-0">
                  <div className="w-1 h-1 bg-current" />
                </ToggleGroupItem>
                <ToggleGroupItem value="3" aria-label="3x3 brush" className="w-10 h-10 p-0">
                  <div className="w-2 h-2 bg-current" />
                </ToggleGroupItem>
                <ToggleGroupItem value="5" aria-label="5x5 brush" className="w-10 h-10 p-0">
                  <div className="w-3 h-3 bg-current" />
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
        )}
            
        {/* Row 3: Edit Tools (Undo, Redo, Scissors, Autofit, Collapsible D-pad) - hidden in virgin state */}
        {!isVirginState && (
          <div className="w-[320px] mx-auto relative">
            <div className="flex justify-between items-center w-full">
              {/* Left Section: Undo/Redo */}
              <div className="flex gap-2 items-center">
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

              {/* Right Section: Scissors, Autofit, and Collapsible D-Pad */}
              <div className="relative flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveBackground}
                  disabled={!pixelCanvasRef.current?.getPixels().length || isVirginState}
                  title="Remove background from edges"
                  className="w-10 h-10 p-0"
                >
                  <Scissors className="h-5 w-5" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={autoFitEmoji}
                  disabled={!pixelCanvasRef.current?.getPixels().length || isVirginState}
                  title="Auto-fit (remove padding and maximize emoji)"
                  className="w-10 h-10 p-0"
                >
                  <Maximize2 className="h-5 w-5" />
                </Button>

                <Collapsible open={isDpadExpanded} onOpenChange={setIsDpadExpanded}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-10 h-10 p-0"
                      title="Shift pixels"
                    >
                      <Move className="h-5 w-5" />
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
                
                {/* D-pad dropdown - outside Collapsible but controlled by its state */}
                {isDpadExpanded && (
                  <div className="absolute right-0 top-full mt-1 bg-background border rounded-md p-1 shadow-lg z-10">
                    <div className="grid grid-cols-3 grid-rows-3 gap-0">
                      <div className="col-start-2 row-start-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => shiftPixels('up')}
                          disabled={!pixelCanvasRef.current?.getPixels().length || isVirginState}
                          className="w-6 h-6 p-0"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="col-start-1 row-start-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => shiftPixels('left')}
                          disabled={!pixelCanvasRef.current?.getPixels().length || isVirginState}
                          className="w-6 h-6 p-0"
                        >
                          <ArrowLeft className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="col-start-2 row-start-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => shiftPixels('down')}
                          disabled={!pixelCanvasRef.current?.getPixels().length || isVirginState}
                          className="w-6 h-6 p-0"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="col-start-3 row-start-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => shiftPixels('right')}
                          disabled={!pixelCanvasRef.current?.getPixels().length || isVirginState}
                          className="w-6 h-6 p-0"
                        >
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

            {/* Settings Section - inline collapsible at bottom */}
            {!isVirginState && (
              <div className="flex flex-col items-center gap-2 mt-4">
                {/* Settings Toggle Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="text-xs text-muted-foreground flex items-center gap-1"
                >
                  <Settings className="h-3 w-3" />
                  {isSettingsOpen ? 'Hide Settings' : 'Settings'}
                </Button>
                
                {/* Collapsible Settings Content */}
                {isSettingsOpen && (
                  <div className="w-[320px] space-y-4 pt-2">
                    {/* Magic Wand Tolerance */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                          <Wand2 className="h-3.5 w-3.5" />
                          Magic Wand Tolerance: {magicWandTolerance}
                        </Label>
                      </div>
                      <Slider
                        min={10}
                        max={50}
                        step={1}
                        value={[magicWandTolerance]}
                        onValueChange={(value) => setMagicWandTolerance(value[0])}
                        className="w-full ml-4"
                      />
                      <p className="text-xs text-muted-foreground ml-4">Lower = more selective</p>
                    </div>
                    
                    {/* Background Removal Tolerance */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                          <Scissors className="h-3.5 w-3.5" />
                          Background Removal Tolerance: {backgroundRemovalTolerance}
                        </Label>
                      </div>
                      <Slider
                        min={5}
                        max={40}
                        step={1}
                        value={[backgroundRemovalTolerance]}
                        onValueChange={(value) => setBackgroundRemovalTolerance(value[0])}
                        className="w-full ml-4"
                      />
                      <p className="text-xs text-muted-foreground ml-4">Higher = more aggressive</p>
                    </div>
                    
                    {/* Background Selection - integrated here */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <Image className="h-3.5 w-3.5" />
                        Background:
                      </Label>
                      <RadioGroup 
                        value={backgroundColor} 
                        onValueChange={(value) => {
                          const newBg = value as "transparent" | "white" | "black";
                          setBackgroundColor(newBg);
                        }}
                        className="flex flex-col gap-1.5 ml-4"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="transparent" id="bg-transparent" />
                          <Label htmlFor="bg-transparent" className="text-xs cursor-pointer">
                            Transparent
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="white" id="bg-white" />
                          <Label htmlFor="bg-white" className="text-xs cursor-pointer">
                            White
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="black" id="bg-black" />
                          <Label htmlFor="bg-black" className="text-xs cursor-pointer">
                            Black
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Keyboard Shortcuts Button - Desktop Only */}
                    <div className="hidden md:block mt-6 pt-6 border-t border-border">
                      <Dialog open={isKeyboardShortcutsOpen} onOpenChange={setIsKeyboardShortcutsOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full">
                            Keyboard Shortcuts
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Keyboard Shortcuts</DialogTitle>
                          </DialogHeader>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-muted-foreground">
                            <div className="col-span-2 font-medium text-foreground mt-2 first:mt-0">Editing</div>
                            <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">Ctrl/⌘ Z</kbd></div>
                            <div>Undo</div>
                            <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">Ctrl/⌘ Y</kbd></div>
                            <div>Redo</div>
                            
                            <div className="col-span-2 font-medium text-foreground mt-2">Tools</div>
                            <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">P</kbd></div>
                            <div>Pencil tool</div>
                            <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">E</kbd></div>
                            <div>Eraser tool</div>
                            <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">W</kbd></div>
                            <div>Magic wand tool</div>
                            <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">I</kbd></div>
                            <div>Toggle eyedropper</div>
                            <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">C</kbd></div>
                            <div>Open color picker</div>
                            <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">1-5</kbd></div>
                            <div>Select palette colors</div>
                            
                            <div className="col-span-2 font-medium text-foreground mt-2">Selection</div>
                            <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">Esc</kbd></div>
                            <div>Clear selection</div>
                            <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">Ctrl/⌘ A</kbd></div>
                            <div>Select all pixels</div>
                            <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">Ctrl/⌘ D</kbd></div>
                            <div>Deselect all</div>
                            
                            <div className="col-span-2 font-medium text-foreground mt-2">Transform</div>
                            <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">Arrow Keys</kbd></div>
                            <div>Shift pixels</div>
                            <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">B</kbd></div>
                            <div>Remove background</div>
                            <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">Del / ⌫ / Ctrl/⌘+X</kbd></div>
                            <div>Delete selected pixels</div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Index;
