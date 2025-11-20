import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PixelCanvasProps {
  imageData: string | null;
  onPixelChange: () => void;
  selectedColor: string;
  gridSize?: number;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  isEyedropperActive?: boolean;
  isMultiSelectActive?: boolean;
  onColorPick?: (color: string) => void;
  pixels: string[][];
  setPixels: (pixels: string[][]) => void;
  onEditComplete?: (pixels: string[][]) => void;
}

export const PixelCanvas = ({ 
  imageData, 
  onPixelChange, 
  selectedColor,
  gridSize = 32,
  canvasRef: externalCanvasRef,
  isEyedropperActive = false,
  isMultiSelectActive = false,
  onColorPick,
  pixels,
  setPixels,
  onEditComplete
}: PixelCanvasProps) => {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{x: number, y: number} | null>(null);
  const pixelSize = 320 / gridSize;

  useEffect(() => {
    // Initialize empty grid
    const emptyGrid = Array(gridSize).fill(null).map(() => 
      Array(gridSize).fill("transparent")
    );
    setPixels(emptyGrid);
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
        
        setPixels(newPixels);
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

    // Draw selection rectangle
    if (selectionStart && selectionEnd) {
      const minX = Math.min(selectionStart.x, selectionEnd.x);
      const minY = Math.min(selectionStart.y, selectionEnd.y);
      const maxX = Math.max(selectionStart.x, selectionEnd.x);
      const maxY = Math.max(selectionStart.y, selectionEnd.y);
      
      ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
      ctx.fillRect(
        minX * pixelSize, 
        minY * pixelSize, 
        (maxX - minX + 1) * pixelSize, 
        (maxY - minY + 1) * pixelSize
      );
      
      ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        minX * pixelSize, 
        minY * pixelSize, 
        (maxX - minX + 1) * pixelSize, 
        (maxY - minY + 1) * pixelSize
      );
    }
  }, [pixels, gridSize, pixelSize, selectionStart, selectionEnd]);

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

    // If multi-select mode, don't paint individual pixels on click
    if (isMultiSelectActive) return;

    // Normal drawing mode
    const newPixels = [...pixels];
    newPixels[coords.y][coords.x] = selectedColor === "transparent" ? "transparent" : selectedColor;
    setPixels(newPixels);
    onPixelChange();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getPixelCoords(e);
    if (!coords) return;

    setIsDrawing(true);

    if (isMultiSelectActive) {
      setSelectionStart(coords);
      setSelectionEnd(coords);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getPixelCoords(e);
    if (!coords || !isDrawing) return;

    if (isMultiSelectActive && selectionStart) {
      setSelectionEnd(coords);
      return;
    }

    if (!isEyedropperActive) {
      handleCanvasClick(e);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);

    if (isMultiSelectActive && selectionStart && selectionEnd) {
      const minX = Math.min(selectionStart.x, selectionEnd.x);
      const minY = Math.min(selectionStart.y, selectionEnd.y);
      const maxX = Math.max(selectionStart.x, selectionEnd.x);
      const maxY = Math.max(selectionStart.y, selectionEnd.y);

      const newPixels = pixels.map(row => [...row]);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          newPixels[y][x] = selectedColor === "transparent" ? "transparent" : selectedColor;
        }
      }
      setPixels(newPixels);
      onPixelChange();
      onEditComplete?.(newPixels);

      setSelectionStart(null);
      setSelectionEnd(null);
    } else if (!isMultiSelectActive) {
      onEditComplete?.(pixels);
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
          isEyedropperActive ? "cursor-crosshair" : 
          isMultiSelectActive ? "cursor-cell" : "cursor-pointer"
        )}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
      />
    </div>
  );
};
