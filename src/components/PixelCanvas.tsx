import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PixelCanvasProps {
  imageData: string | null;
  onPixelChange: () => void;
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
        
        // Remove edge-connected background pixels
        const cleanedPixels = removeEdgeBackground(newPixels, gridSize);
        setOriginalPixels(cleanedPixels.map(row => [...row]));
        setPixels(cleanedPixels);
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

    // Draw grid
    ctx.strokeStyle = "hsl(var(--grid-line))";
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
    // Only draw if we've actually dragged (coordinates differ)
    if (selectionStart && selectionEnd && 
        (selectionStart.x !== selectionEnd.x || selectionStart.y !== selectionEnd.y)) {
      const minX = Math.min(selectionStart.x, selectionEnd.x);
      const minY = Math.min(selectionStart.y, selectionEnd.y);
      const maxX = Math.max(selectionStart.x, selectionEnd.x);
      const maxY = Math.max(selectionStart.y, selectionEnd.y);
      
      // Different colors for paint (left) vs restore (right)
      const fillColor = isRightClickDrag 
        ? "rgba(251, 146, 60, 0.15)"  // Orange for restore
        : "rgba(59, 130, 246, 0.15)";  // Blue for paint
      const strokeColor = isRightClickDrag
        ? "rgba(251, 146, 60, 0.8)"   // Orange for restore
        : "rgba(59, 130, 246, 0.8)";  // Blue for paint
      
      ctx.fillStyle = fillColor;
      ctx.fillRect(
        minX * pixelSize, 
        minY * pixelSize, 
        (maxX - minX + 1) * pixelSize, 
        (maxY - minY + 1) * pixelSize
      );
      
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

  const colorDistance = (color1: string, color2: string): number => {
    // Parse rgba colors
    const rgba1 = color1.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    const rgba2 = color2.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    
    if (!rgba1 || !rgba2) return Infinity;
    
    const r1 = parseInt(rgba1[1]), g1 = parseInt(rgba1[2]), b1 = parseInt(rgba1[3]);
    const r2 = parseInt(rgba2[1]), g2 = parseInt(rgba2[2]), b2 = parseInt(rgba2[3]);
    
    // Euclidean distance in RGB space
    return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));
  };

  const removeEdgeBackground = (pixels: string[][], gridSize: number): string[][] => {
    const COLOR_THRESHOLD = 30; // Colors within this distance are considered similar
    
    // Step 1: Sample edge pixels and group similar colors
    const edgeColorGroups = new Map<string, { count: number, colors: Set<string> }>();
    
    const addToGroup = (color: string) => {
      if (color === "transparent") return;
      
      // Find existing group this color belongs to
      let foundGroup = false;
      for (const [representative, group] of edgeColorGroups.entries()) {
        if (colorDistance(color, representative) <= COLOR_THRESHOLD) {
          group.count++;
          group.colors.add(color);
          foundGroup = true;
          break;
        }
      }
      
      // Create new group if no match found
      if (!foundGroup) {
        edgeColorGroups.set(color, { count: 1, colors: new Set([color]) });
      }
    };
    
    // Sample edges
    for (let x = 0; x < gridSize; x++) {
      addToGroup(pixels[0][x]);
      addToGroup(pixels[gridSize-1][x]);
    }
    for (let y = 0; y < gridSize; y++) {
      addToGroup(pixels[y][0]);
      addToGroup(pixels[y][gridSize-1]);
    }
    
    // Find most common color group
    if (edgeColorGroups.size === 0) return pixels;
    
    let bgColorGroup: Set<string> | null = null;
    let maxCount = 0;
    edgeColorGroups.forEach((group) => {
      if (group.count > maxCount) {
        maxCount = group.count;
        bgColorGroup = group.colors;
      }
    });
    
    if (!bgColorGroup) return pixels;
    
    // Step 2: Flood fill from all edges matching background color group
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
    
    // Add all edge pixels matching background color group to queue
    for (let x = 0; x < gridSize; x++) {
      if (isSimilarToBackground(pixels[0][x])) queue.push([0, x]);
      if (isSimilarToBackground(pixels[gridSize-1][x])) queue.push([gridSize-1, x]);
    }
    for (let y = 0; y < gridSize; y++) {
      if (isSimilarToBackground(pixels[y][0])) queue.push([y, 0]);
      if (isSimilarToBackground(pixels[y][gridSize-1])) queue.push([y, gridSize-1]);
    }
    
    // Flood fill with color similarity
    const result = pixels.map(row => [...row]);
    
    while (queue.length > 0) {
      const [y, x] = queue.shift()!;
      
      if (visited[y][x]) continue;
      visited[y][x] = true;
      
      if (isSimilarToBackground(pixels[y][x])) {
        result[y][x] = "transparent";
        
        // Add neighbors to queue
        if (y > 0 && !visited[y-1][x]) queue.push([y-1, x]);
        if (y < gridSize-1 && !visited[y+1][x]) queue.push([y+1, x]);
        if (x > 0 && !visited[y][x-1]) queue.push([y, x-1]);
        if (x < gridSize-1 && !visited[y][x+1]) queue.push([y, x+1]);
      }
    }
    
    return result;
  };

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
    onPixelChange();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getPixelCoords(e);
    if (!coords) return;

    // Reset any previous drag state first
    setIsRightClickDrag(false);
    
    // Detect which mouse button was pressed
    const isRightClick = e.button === 2;
    
    setIsDrawing(true);
    setIsRightClickDrag(isRightClick);
    setSelectionStart(coords);
    setSelectionEnd(coords);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getPixelCoords(e);
    if (!coords || !isDrawing) return;

    // If we're dragging and not in eyedropper mode, update the selection
    if (!isEyedropperActive && selectionStart) {
      setSelectionEnd(coords);
    }
  };

  const handleMouseUp = () => {
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
        
        if (isRightClickDrag) {
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
        onPixelChange();
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
      onPixelChange();
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
