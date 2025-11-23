import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface PixelCanvasRef {
  getPixels: () => string[][];
  setPixels: (newPixels: string[][]) => void;
  shift: (direction: 'up' | 'down' | 'left' | 'right') => string[][];
  autoFit: () => string[][];
  removeBackground: (tolerance?: number) => string[][];
  animateDissolve: () => Promise<void>;
  loadImage: (imageUrl: string) => void;
}

interface PixelCanvasProps {
  selectedColor: string;
  gridSize?: number;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  isEyedropperActive?: boolean;
  onColorPick?: (color: string) => void;
  onPixelsChanged?: (pixels: string[][], isInitialImageFromAI: boolean) => void;
  backgroundColor?: "transparent" | "white" | "black" | string;
  onReady?: () => void;
  isMagicWandActive?: boolean;
  onMagicWandClick?: (x: number, y: number) => void;
  selectedPixels?: Set<string>;
  isVirginState?: boolean;
  brushSize?: number;
}

export const PixelCanvas = forwardRef<PixelCanvasRef, PixelCanvasProps>(({ 
  selectedColor,
  gridSize = 32,
  canvasRef: externalCanvasRef,
  isEyedropperActive = false,
  onColorPick,
  onPixelsChanged,
  backgroundColor = "transparent",
  isVirginState = false,
  onReady,
  isMagicWandActive = false,
  onMagicWandClick,
  selectedPixels = new Set(),
  brushSize = 1,
}, ref) => {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  
  // Internal state - PixelCanvas now owns pixel data
  const [pixels, setPixels] = useState<string[][]>(() => 
    Array(gridSize).fill(null).map(() => Array(gridSize).fill("transparent"))
  );
  const [originalPixelsFromAI, setOriginalPixelsFromAI] = useState<string[][]>([]);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{x: number, y: number} | null>(null);
  const [isRightClickDrag, setIsRightClickDrag] = useState(false);
  const buttonRef = useRef<number>(0); // Track which mouse button was used
  const cleanupRef = useRef<(() => void) | null>(null);
  const pixelSize = 320 / gridSize;

  // Helper functions for external operations
  const colorDistance = (color1: string, color2: string): number => {
    const rgba1 = color1.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    const rgba2 = color2.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    
    if (!rgba1 || !rgba2) return Infinity;
    
    const r1 = parseInt(rgba1[1]), g1 = parseInt(rgba1[2]), b1 = parseInt(rgba1[3]);
    const r2 = parseInt(rgba2[1]), g2 = parseInt(rgba2[2]), b2 = parseInt(rgba2[3]);
    
    return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));
  };

  const findBoundingBox = (pixelData: string[][]) => {
    let minX = 32, minY = 32, maxX = -1, maxY = -1;
    
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (pixelData[y][x] !== 'transparent') {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    if (maxX === -1) return null;
    return { minX, minY, maxX, maxY };
  };

  const scaleContent = (
    sourcePixels: string[][],
    sourceBounds: { minX: number; minY: number; maxX: number; maxY: number },
    targetWidth: number,
    targetHeight: number
  ) => {
    const sourceWidth = sourceBounds.maxX - sourceBounds.minX + 1;
    const sourceHeight = sourceBounds.maxY - sourceBounds.minY + 1;
    
    const newPixels: string[][] = Array(32).fill(null).map(() => 
      Array(32).fill('transparent')
    );
    
    const targetX = Math.floor((32 - targetWidth) / 2);
    const targetY = Math.floor((32 - targetHeight) / 2);
    
    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const sourceX = sourceBounds.minX + Math.floor(x * sourceWidth / targetWidth);
        const sourceY = sourceBounds.minY + Math.floor(y * sourceHeight / targetHeight);
        newPixels[targetY + y][targetX + x] = sourcePixels[sourceY][sourceX];
      }
    }
    
    return newPixels;
  };

  const removeEdgeBackground = (pixelData: string[][], tolerance: number): string[][] => {
    const COLOR_THRESHOLD = tolerance;
    const gridSize = 32;
    
    const edgeColorGroups = new Map<string, { count: number, colors: Set<string> }>();
    
    const addToGroup = (color: string) => {
      if (color === "transparent") return;
      
      let foundGroup = false;
      for (const [representative, group] of edgeColorGroups.entries()) {
        if (colorDistance(color, representative) <= COLOR_THRESHOLD) {
          group.count++;
          group.colors.add(color);
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        edgeColorGroups.set(color, { count: 1, colors: new Set([color]) });
      }
    };
    
    for (let x = 0; x < gridSize; x++) {
      addToGroup(pixelData[0][x]);
      addToGroup(pixelData[gridSize-1][x]);
    }
    for (let y = 0; y < gridSize; y++) {
      addToGroup(pixelData[y][0]);
      addToGroup(pixelData[y][gridSize-1]);
    }
    
    if (edgeColorGroups.size === 0) return pixelData;
    
    let bgColorGroup: Set<string> | null = null;
    let maxCount = 0;
    edgeColorGroups.forEach((group) => {
      if (group.count > maxCount) {
        maxCount = group.count;
        bgColorGroup = group.colors;
      }
    });
    
    if (!bgColorGroup) return pixelData;
    
    const visited = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
    const queue: [number, number][] = [];
    
    const isSimilarToBackground = (color: string): boolean => {
      if (color === "transparent") return false;
      for (const bgColor of bgColorGroup!) {
        if (colorDistance(color, bgColor) <= COLOR_THRESHOLD) {
          return true;
        }
      }
      return false;
    };
    
    for (let x = 0; x < gridSize; x++) {
      if (isSimilarToBackground(pixelData[0][x])) queue.push([0, x]);
      if (isSimilarToBackground(pixelData[gridSize-1][x])) queue.push([gridSize-1, x]);
    }
    for (let y = 0; y < gridSize; y++) {
      if (isSimilarToBackground(pixelData[y][0])) queue.push([y, 0]);
      if (isSimilarToBackground(pixelData[y][gridSize-1])) queue.push([y, gridSize-1]);
    }
    
    const result = pixelData.map(row => [...row]);
    
    while (queue.length > 0) {
      const [y, x] = queue.shift()!;
      
      if (visited[y][x]) continue;
      visited[y][x] = true;
      
      if (isSimilarToBackground(pixelData[y][x])) {
        result[y][x] = "transparent";
        
        if (y > 0 && !visited[y-1][x]) queue.push([y-1, x]);
        if (y < gridSize-1 && !visited[y+1][x]) queue.push([y+1, x]);
        if (x > 0 && !visited[y][x-1]) queue.push([y, x-1]);
        if (x < gridSize-1 && !visited[y][x+1]) queue.push([y, x+1]);
      }
    }
    
    return result;
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getPixels: () => pixels,
    setPixels: (newPixels: string[][]) => {
      setPixels(newPixels);
    },
    shift: (direction: 'up' | 'down' | 'left' | 'right') => {
      const currentPixels = pixels;
      if (currentPixels.length === 0) return currentPixels;
      
      const newPixels: string[][] = Array(32).fill(null).map(() => Array(32).fill('transparent'));
      
      currentPixels.forEach((row, y) => {
        row.forEach((color, x) => {
          if (color === 'transparent') return;
          
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
          
          if (newX >= 0 && newX < 32 && newY >= 0 && newY < 32) {
            newPixels[newY][newX] = color;
          }
        });
      });
      
      setPixels(newPixels);
      return newPixels;
    },
    autoFit: () => {
      const currentPixels = pixels;
      if (currentPixels.length === 0) return currentPixels;
      
      const bounds = findBoundingBox(currentPixels);
      if (!bounds) return currentPixels;
      
      const contentWidth = bounds.maxX - bounds.minX + 1;
      const contentHeight = bounds.maxY - bounds.minY + 1;
      
      const maxSize = 30;
      const scale = Math.min(maxSize / contentWidth, maxSize / contentHeight);
      const targetWidth = Math.round(contentWidth * scale);
      const targetHeight = Math.round(contentHeight * scale);
      
      const newPixels = scaleContent(currentPixels, bounds, targetWidth, targetHeight);
      setPixels(newPixels);
      return newPixels;
    },
    removeBackground: (tolerance: number = 20) => {
      const currentPixels = pixels;
      if (currentPixels.length === 0) return currentPixels;
      
      const cleanedPixels = removeEdgeBackground(currentPixels, tolerance);
      setPixels(cleanedPixels);
      return cleanedPixels;
    },
    animateDissolve: () => {
      return new Promise<void>((resolve) => {
        setPixels(currentPixels => {
          // Collect all non-transparent pixel coordinates
          const pixelCoords: { x: number, y: number }[] = [];
          currentPixels.forEach((row, y) => {
            row.forEach((color, x) => {
              if (color !== 'transparent') {
                pixelCoords.push({ x, y });
              }
            });
          });
          
          // Shuffle pixels randomly
          for (let i = pixelCoords.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pixelCoords[i], pixelCoords[j]] = [pixelCoords[j], pixelCoords[i]];
          }
          
          // Calculate timing
          const totalDuration = 350; // ms
          const pixelsPerFrame = Math.max(1, Math.ceil(pixelCoords.length / 20));
          const frameDelay = pixelCoords.length > 0 ? totalDuration / Math.ceil(pixelCoords.length / pixelsPerFrame) : 0;
          
          let workingPixels = currentPixels.map(row => [...row]);
          let currentIndex = 0;
          
          const dissolveFrame = () => {
            // Remove batch of pixels
            const endIndex = Math.min(currentIndex + pixelsPerFrame, pixelCoords.length);
            for (let i = currentIndex; i < endIndex; i++) {
              const { x, y } = pixelCoords[i];
              workingPixels[y][x] = 'transparent';
            }
            currentIndex = endIndex;
            
            // Update state
            setPixels([...workingPixels.map(row => [...row])]);
            
            if (currentIndex < pixelCoords.length) {
              requestAnimationFrame(() => {
                setTimeout(dissolveFrame, frameDelay);
              });
            } else {
              // Animation complete
              resolve();
            }
          };
          
          if (pixelCoords.length > 0) {
            dissolveFrame();
          } else {
            resolve();
          }
          
          return currentPixels;
        });
      });
    },
    loadImage: (imageUrl: string) => {
      const img = new Image();
      img.onload = () => {
        // Draw image to get pixel data
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = gridSize;
        tempCanvas.height = gridSize;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) return;

        tempCtx.drawImage(img, 0, 0, gridSize, gridSize);
        const imageData = tempCtx.getImageData(0, 0, gridSize, gridSize);
        
        // Convert to pixel array
        const newPixels: string[][] = Array(gridSize).fill(null).map(() => 
          Array(gridSize).fill("transparent")
        );
        
        for (let y = 0; y < gridSize; y++) {
          for (let x = 0; x < gridSize; x++) {
            const idx = (y * gridSize + x) * 4;
            const r = imageData.data[idx];
            const g = imageData.data[idx + 1];
            const b = imageData.data[idx + 2];
            const a = imageData.data[idx + 3];
            
            if (a > 0) {
              newPixels[y][x] = `rgba(${r},${g},${b},${a / 255})`;
            }
          }
        }
        
        // Update internal state
        setOriginalPixelsFromAI(newPixels.map(row => [...row]));
        setPixels(newPixels);
        
        // Notify parent AFTER state is set (but this is now an imperative call, not during render)
        onPixelsChanged?.(newPixels, true);
      };
      img.src = imageUrl;
    },
  }), [pixels, onPixelsChanged, gridSize]);

  useEffect(() => {
    // Notify parent once that canvas is ready for loading saved pixels
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = runs once on mount

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill background based on selection
    if (backgroundColor === "white") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (backgroundColor === "black") {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw pixels
    pixels.forEach((row, y) => {
      row.forEach((color, x) => {
        if (color !== "transparent") {
          ctx.fillStyle = color;
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      });
    });

    // Draw grid - resolve CSS variable to actual color
    const gridLineColor = getComputedStyle(canvas).getPropertyValue('--grid-line');
    ctx.strokeStyle = `hsl(${gridLineColor})`;
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i <= gridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * pixelSize, 0);
      ctx.lineTo(i * pixelSize, 320);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, i * pixelSize);
      ctx.lineTo(320, i * pixelSize);
      ctx.stroke();
    }

    // Draw selection rectangle with different colors based on drag type
    // Only draw if we're actively drawing and coordinates differ
    if (isDrawing && selectionStart && selectionEnd && 
        (selectionStart.x !== selectionEnd.x || selectionStart.y !== selectionEnd.y)) {
      const minX = Math.min(selectionStart.x, selectionEnd.x);
      const minY = Math.min(selectionStart.y, selectionEnd.y);
      const maxX = Math.max(selectionStart.x, selectionEnd.x);
      const maxY = Math.max(selectionStart.y, selectionEnd.y);
      
      // Different colors for paint (left) vs restore (right)
      const strokeColor = isRightClickDrag
        ? "rgba(251, 146, 60, 0.8)"   // Orange for restore
        : "rgba(59, 130, 246, 0.8)";  // Blue for paint
      
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        minX * pixelSize, 
        minY * pixelSize, 
        (maxX - minX + 1) * pixelSize, 
        (maxY - minY + 1) * pixelSize
      );
    }

    // Draw selection overlay for magic wand (marching ants style)
    if (selectedPixels.size > 0) {
      selectedPixels.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        const px = x * pixelSize;
        const py = y * pixelSize;
        
        // Draw black outer stroke (2px)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, pixelSize, pixelSize);
        
        // Draw white inner stroke (1px, inset by 1px)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, py + 1, pixelSize - 2, pixelSize - 2);
      });
    }
  }, [pixels, gridSize, pixelSize, selectionStart, selectionEnd, backgroundColor, isRightClickDrag, selectedPixels]);


  const getPixelCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / pixelSize);
    const y = Math.floor((e.clientY - rect.top) / pixelSize);

    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
      return { x, y };
    }
    return null;
  };


  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const rawX = Math.floor((e.clientX - rect.left) / pixelSize);
    const rawY = Math.floor((e.clientY - rect.top) / pixelSize);

    // Clamp coordinates to grid boundaries (same logic as handleMouseMove)
    const x = Math.max(0, Math.min(gridSize - 1, rawX));
    const y = Math.max(0, Math.min(gridSize - 1, rawY));
    const coords = { x, y };

    // Magic wand mode - select pixels, don't draw
    if (isMagicWandActive && onMagicWandClick) {
      onMagicWandClick(x, y);
      return; // Exit early, don't initialize ANY drawing state
    }

    // Eyedropper mode - only pick color, don't draw
    // (handled in handleMouseUp, but we need selection coordinates)
    
    // Now initialize drawing state for pencil/eraser modes
    const isRightClick = e.button === 2;
    buttonRef.current = e.button;
    
    setIsDrawing(true);
    setIsRightClickDrag(isRightClick);
    setSelectionStart(coords);
    setSelectionEnd(coords);

    // Attach global listeners to prevent context menu and handle mouseup outside canvas
    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    
    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };
    
    document.addEventListener('contextmenu', handleGlobalContextMenu);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    // Store cleanup function
    cleanupRef.current = () => {
      document.removeEventListener('contextmenu', handleGlobalContextMenu);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    
    // Calculate coordinates even when outside canvas
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = Math.floor((e.clientX - rect.left) / pixelSize);
    const rawY = Math.floor((e.clientY - rect.top) / pixelSize);
    
    // Clamp to grid boundaries
    const x = Math.max(0, Math.min(gridSize - 1, rawX));
    const y = Math.max(0, Math.min(gridSize - 1, rawY));
    
    // If we're dragging and not in eyedropper mode, update the selection
    if (!isEyedropperActive && selectionStart) {
      setSelectionEnd({ x, y });
    }
  };

  const handleMouseUp = () => {
    // Clean up global listeners
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    
    // Capture current drag mode before resetting state
    const wasRightClickDrag = isRightClickDrag;
    
    setIsDrawing(false);
    setIsRightClickDrag(false);

    // Check if we have a selection
    if (selectionStart && selectionEnd) {
      const isDrag = selectionStart.x !== selectionEnd.x || selectionStart.y !== selectionEnd.y;
      
      // Handle eyedropper for single clicks
      if (!isDrag && isEyedropperActive && onColorPick) {
        const pickedColor = pixels[selectionStart.y][selectionStart.x];
        if (pickedColor !== "transparent") {
          onColorPick(pickedColor);
        }
        setSelectionStart(null);
        setSelectionEnd(null);
        return;
      }
      
      // Process drawing/filling when not in eyedropper or magic wand mode
      if (!isEyedropperActive && !isMagicWandActive) {
        // Calculate rectangle bounds
        const minX = Math.min(selectionStart.x, selectionEnd.x);
        const minY = Math.min(selectionStart.y, selectionEnd.y);
        const maxX = Math.max(selectionStart.x, selectionEnd.x);
        const maxY = Math.max(selectionStart.y, selectionEnd.y);

        // Helper to expand coordinates based on brush size (only for single clicks)
        const applyBrushSize = (x: number, y: number, size: number) => {
          const offset = Math.floor(size / 2);
          return {
            minX: Math.max(0, x - offset),
            minY: Math.max(0, y - offset),
            maxX: Math.min(gridSize - 1, x + offset),
            maxY: Math.min(gridSize - 1, y + offset),
          };
        };

        // Calculate new pixels synchronously BEFORE setPixels
        const currentPixels = pixels;
        const newPixels = currentPixels.map(row => [...row]);
        
        if (isDrag) {
          // RECTANGLE: Fill exact selection (no brush size expansion)
          if (wasRightClickDrag) {
            // Restore exact rectangle from original
            if (originalPixelsFromAI.length > 0) {
              for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                  const originalColor = originalPixelsFromAI[y]?.[x];
                  if (originalColor !== undefined) {
                    newPixels[y][x] = originalColor;
                  }
                }
              }
            }
          } else {
            // Paint exact rectangle with selected color
            for (let y = minY; y <= maxY; y++) {
              for (let x = minX; x <= maxX; x++) {
                newPixels[y][x] = selectedColor === "transparent" ? "transparent" : selectedColor;
              }
            }
          }
        } else {
          // SINGLE PIXEL: Apply brush size
          const brushArea = applyBrushSize(minX, minY, brushSize);
          if (wasRightClickDrag) {
            // Restore with brush
            if (originalPixelsFromAI.length > 0) {
              for (let by = brushArea.minY; by <= brushArea.maxY; by++) {
                for (let bx = brushArea.minX; bx <= brushArea.maxX; bx++) {
                  const originalColor = originalPixelsFromAI[by]?.[bx];
                  if (originalColor !== undefined) {
                    newPixels[by][bx] = originalColor;
                  }
                }
              }
            }
          } else {
            // Paint with brush
            for (let by = brushArea.minY; by <= brushArea.maxY; by++) {
              for (let bx = brushArea.minX; bx <= brushArea.maxX; bx++) {
                newPixels[by][bx] = selectedColor === "transparent" ? "transparent" : selectedColor;
              }
            }
          }
        }
        
        // Update state with pre-calculated pixels
        setPixels(newPixels);
        
        // Notify parent callback AFTER setPixels is queued (no closure issue)
        onPixelsChanged?.(newPixels, false);
      }

      setSelectionStart(null);
      setSelectionEnd(null);
    }
  };

  // Touch event handlers for mobile support
  const touchToMouseEvent = (touch: React.Touch): React.MouseEvent<HTMLDivElement> => {
    return {
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0,
      preventDefault: () => {},
    } as React.MouseEvent<HTMLDivElement>;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const syntheticEvent = touchToMouseEvent(touch);
    handleMouseDown(syntheticEvent);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const syntheticEvent = touchToMouseEvent(touch);
    handleMouseMove(syntheticEvent);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleMouseUp();
  };

  const getBrushCursor = (size: number, color: 'black' | 'white'): string => {
    // Calculate cursor dimensions
    const sideLength = size * pixelSize;
    
    // SVG square with border
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${sideLength}" height="${sideLength}" viewBox="0 0 ${sideLength} ${sideLength}">
        <rect 
          x="0.75" 
          y="0.75" 
          width="${sideLength - 1.5}" 
          height="${sideLength - 1.5}" 
          fill="none" 
          stroke="${color}" 
          stroke-width="1.5"
          opacity="0.8"
        />
      </svg>
    `;
    
    // Convert to data URI
    const centerPoint = sideLength / 2;
    const encoded = encodeURIComponent(svg);
    return `url("data:image/svg+xml,${encoded}") ${centerPoint} ${centerPoint}, auto`;
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };

  return (
    /* 
      Interactive container with responsive padding creates a "forgiving zone" for starting rectangle selections.
      
      Architecture:
      - Mouse event handlers (onMouseDown, onMouseMove, etc.) are on this wrapper div, not the canvas
      - Padding creates invisible clickable area around the 320×320px canvas
      - Coordinate calculations in getPixelCoords() use canvas.getBoundingClientRect() and clamp to grid bounds
      - This allows clicks outside the visible canvas to still initiate selections
      
      Responsive padding strategy:
      - Mobile (p-4): 16px padding - minimal but functional
      - Tablet (md:p-12): 48px padding - more comfortable
      - Desktop (lg:p-20, xl:p-32): 80-128px padding - massive wiggle room for desktop users
    */
    <div 
      className="relative px-4 py-0 sm:py-2 md:px-12 md:py-4 lg:px-20 lg:py-6 xl:px-32 xl:py-8"
      style={{
        cursor: isEyedropperActive 
          ? 'crosshair'
          : isMagicWandActive
            ? 'cell'
            : brushSize === 1
              ? 'cell'
              : getBrushCursor(
                  brushSize, 
                  selectedColor === 'transparent' ? 'white' : 'black'
                )
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Helper text positioned right above canvas within buffer zone */}
      {!isVirginState && (
        <p className="text-xs text-muted-foreground/60 italic text-center mb-1 select-none">
          click and drag to create a rectangle | right click to revert
        </p>
      )}
      
      {/* Actual 320×320px pixel grid - rendering only, mouse events handled by parent wrapper */}
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        className={cn(
          "border-2 border-border rounded-lg",
          "bg-[hsl(var(--canvas-bg))]"
        )}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
});

PixelCanvas.displayName = "PixelCanvas";
