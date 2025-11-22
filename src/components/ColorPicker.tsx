import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Pipette, Eraser, Palette } from "lucide-react";

export const DEFAULT_CUSTOM_COLORS: string[] = [];

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  customColors: string[];
  onCustomColorsChange: (colors: string[] | ((prev: string[]) => string[])) => void;
  extractedColors: string[];
  isEyedropperActive?: boolean;
  onEyedropperToggle?: () => void;
  isEraserActive?: boolean;
  onEraserToggle?: () => void;
}

export const ColorPicker = ({ 
  selectedColor, 
  onColorChange,
  customColors,
  onCustomColorsChange,
  extractedColors,
  isEyedropperActive,
  onEyedropperToggle,
  isEraserActive,
  onEraserToggle
}: ColorPickerProps) => {
  const [customColor, setCustomColor] = useState("#000000");
  const colorInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        {/* Color Grid */}
        <div className="flex flex-col gap-2">
          {/* Row 1: Eraser + Extracted colors (7 slots) */}
          <div 
            className="grid grid-cols-8 gap-2 w-full"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', width: '100%' }}
          >
            {/* First box: Eraser */}
            <Button
              variant="outline"
              size="sm"
              onClick={onEraserToggle}
              className={cn(
                "w-8 h-8 p-0",
                isEraserActive && "ring-2 ring-primary ring-offset-1 ring-offset-background"
              )}
              title="Eraser (set pixels to transparent)"
            >
              <Eraser className="h-4 w-4" />
            </Button>

            {/* Extracted colors (black, white, + 5 from image) */}
            {extractedColors.map((color, index) => (
              <button
                key={`extracted-${color}-${index}`}
                onClick={() => onColorChange(color)}
                className={cn(
                  "w-8 h-8 rounded-md border-2 transition-all hover:scale-110",
                  selectedColor === color 
                    ? "border-border ring-2 ring-primary ring-offset-1 ring-offset-background" 
                    : "border-border"
                )}
                style={{ backgroundColor: color }}
              />
            ))}

            {/* Empty slots if fewer than 7 extracted colors */}
            {Array.from({ length: 7 - extractedColors.length }).map((_, i) => (
              <div key={`empty-extracted-${i}`} className="w-8 h-8" />
            ))}
          </div>
          
          {/* Row 2: Eyedropper + Color Picker + Custom colors (6 slots) */}
          <div 
            className="grid grid-cols-8 gap-2 w-full"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', width: '100%' }}
          >
            {/* First box: Eyedropper */}
            <Button
              variant="outline"
              size="sm"
              onClick={onEyedropperToggle}
              className={cn(
                "w-8 h-8 p-0",
                isEyedropperActive && "ring-2 ring-primary ring-offset-1 ring-offset-background"
              )}
              title="Eyedropper (pick color from canvas)"
            >
              <Pipette className="h-4 w-4" />
            </Button>

            {/* Second box: Color Picker Button */}
            <div className="relative">
              <input
                ref={colorInputRef}
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                }}
                onBlur={(e) => {
                  const newColor = e.target.value.toUpperCase();
                  onColorChange(newColor);
                  
                  // Add to custom colors FIFO style using functional update
                  onCustomColorsChange((prevColors) => {
                    const filtered = prevColors.filter(c => c !== newColor);
                    return [newColor, ...filtered].slice(0, 6);
                  });
                }}
                className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer z-10"
              />
              <button
                className={cn(
                  "w-8 h-8 rounded-md border-2 transition-all hover:scale-110",
                  "border-border bg-muted/20 flex items-center justify-center pointer-events-none"
                )}
              >
                <Palette className="h-4 w-4" />
              </button>
            </div>

            {/* Custom colors (6 slots) */}
            {Array.from({ length: 6 }).map((_, index) => {
              const color = customColors[index];
              return (
                <button
                  key={`custom-${index}`}
                  onClick={() => color && onColorChange(color)}
                  className={cn(
                    "w-8 h-8 rounded-md transition-all",
                    color && "border-2",
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
      </div>
    </div>
  );
};
