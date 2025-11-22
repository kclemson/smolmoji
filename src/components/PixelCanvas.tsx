import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PixelCanvasProps {
  imageData: string | null;
  onPixelChange: (newPixels: string[][]) => void;
  selectedColor: string;
  gridSize?: number;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  isEyedropperActive?: boolean;
  onColorPick?: (color: string) => void;
  pixels: string[][];
  setPixels: (pixels: string[][]) => void;
  onEditComplete?: (pixels: string[][]) => void;
  backgroundColor?: "transparent" | "white" | "black";
  originalPixels: string[][];
  setOriginalPixels: (pixels: string[][]) => void;
}

export const PixelCanvas = ({ 
  imageData, 
  onPixelChange, 
  selectedColor,
  gridSize = 32,
  canvasRef: externalCanvasRef,
  isEyedropperActive = false,
  onColorPick,
  pixels,
  setPixels,
  onEditComplete,
  backgroundColor = "transparent",
  originalPixels,
  setOriginalPixels
}: PixelCanvasProps) => {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{x: number, y: number} | null>(null);
  const [isRightClickDrag, setIsRightClickDrag] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const pixelSize = 320 / gridSize;

  useEffect(() => {
    // Initialize empty grid
    const emptyGrid = Array(gridSize).fill(null).map(() => 
      Array(gridSize).fill("transparent")
    );
    setPixels(emptyGrid);
    setOriginalPixels([]);
  }, [gridSize]);

  useEffect(() => {
    if (imageData && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

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
        
      // Set pixels without automatic processing
      setOriginalPixels(newPixels.map(row => [...row]));
      setPixels(newPixels);
      onEditComplete?.(newPixels); // Save initial AI state to history
      };
      img.src = imageData;
    }
  }, [imageData, gridSize]);

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
  }, [pixels, gridSize, pixelSize, selectionStart, selectionEnd, backgroundColor, isRightClickDrag]);


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

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getPixelCoords(e);
    if (!coords) return;

    // If eyedropper mode is active, pick the color instead of drawing
    if (isEyedropperActive && onColorPick) {
      const pickedColor = pixels[coords.y][coords.x];
      if (pickedColor !== "transparent") {
        onColorPick(pickedColor);
      }
      return;
    }

    // Don't paint if we're in the middle of dragging a selection
    if (isDrawing) return;

    // Normal drawing mode - single click
    const newPixels = [...pixels];
    newPixels[coords.y][coords.x] = selectedColor === "transparent" ? "transparent" : selectedColor;
    setPixels(newPixels);
    onPixelChange(newPixels);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getPixelCoords(e);
    if (!coords) return;

    // Don't start drawing/selection if eyedropper is active
    if (isEyedropperActive) return;

    // Reset any previous drag state first
    setIsRightClickDrag(false);
    
    // Detect which mouse button was pressed
    const isRightClick = e.button === 2;
    
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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
    setIsRightClickDrag(false); // Reset immediately when mouse is released

    // Check if we dragged (start !== end) or just clicked (start === end)
    if (selectionStart && selectionEnd) {
      const isDrag = selectionStart.x !== selectionEnd.x || selectionStart.y !== selectionEnd.y;
      
      if (isDrag && !isEyedropperActive) {
        // Calculate rectangle bounds
        const minX = Math.min(selectionStart.x, selectionEnd.x);
        const minY = Math.min(selectionStart.y, selectionEnd.y);
        const maxX = Math.max(selectionStart.x, selectionEnd.x);
        const maxY = Math.max(selectionStart.y, selectionEnd.y);

        const newPixels = pixels.map(row => [...row]);
        
        if (wasRightClickDrag) {
          // Restore rectangle to original AI pixels
          if (originalPixels.length > 0) {
            for (let y = minY; y <= maxY; y++) {
              for (let x = minX; x <= maxX; x++) {
                const originalColor = originalPixels[y]?.[x];
                if (originalColor !== undefined) {
                  newPixels[y][x] = originalColor;
                }
              }
            }
          }
        } else {
          // Paint rectangle with selected color (existing behavior)
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              newPixels[y][x] = selectedColor === "transparent" ? "transparent" : selectedColor;
            }
          }
        }
        
        setPixels(newPixels);
        onPixelChange(newPixels);
        onEditComplete?.(newPixels);
      } else {
        // Single click - the onClick handler already painted it (for left-click)
        // For right-click, handleContextMenu will handle it
        onEditComplete?.(pixels);
      }

      setSelectionStart(null);
      setSelectionEnd(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const coords = getPixelCoords(e);
    if (!coords) return;
    
    if (originalPixels.length === 0) return;
    
    const originalColor = originalPixels[coords.y]?.[coords.x];
    if (originalColor !== undefined) {
      const newPixels = pixels.map(row => [...row]);
      newPixels[coords.y][coords.x] = originalColor;
      setPixels(newPixels);
      onPixelChange(newPixels);
      onEditComplete?.(newPixels);
    }
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        className={cn(
          "border-2 border-border rounded-lg",
          "bg-[hsl(var(--canvas-bg))]",
          isEyedropperActive ? "cursor-crosshair" : "cursor-cell"
        )}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
};
