import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Pipette, Eraser, Palette } from "lucide-react";

const STATIC_COLORS = [
  "#000000", // Black
  "#FFFFFF", // White
  "#FF0000", // Red
  "#FF6600", // Orange
  "#FFFF00", // Yellow
  "#00FF00", // Green
  "#4169E1", // Royal Blue
  "#00FFFF", // Cyan Blue
  "#9900FF", // Purple
];

export const DEFAULT_CUSTOM_COLORS: string[] = [];

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  customColors: string[];
  onCustomColorsChange: (colors: string[] | ((prev: string[]) => string[])) => void;
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
          {/* Row 1: Eraser + Static colors */}
          <div 
            className="grid grid-cols-10 gap-2 w-full"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', width: '100%' }}
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

            {/* Remaining 9 boxes: Static colors */}
            {STATIC_COLORS.map((color) => (
              <button
                key={color}
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
          </div>
          
          {/* Row 2: Eyedropper + Color Picker + Recent/Custom colors */}
          <div 
            className="grid grid-cols-10 gap-2 w-full"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', width: '100%' }}
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
                  const newColor = e.target.value;
                  onColorChange(newColor);
                  
                  // Add to custom colors FIFO style using functional update
                  onCustomColorsChange((prevColors) => {
                    if (!prevColors.includes(newColor)) {
                      return [newColor, ...prevColors].slice(0, 8);
                    }
                    return prevColors; // Color already exists, no change
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

            {/* Remaining 8 boxes: Recent custom colors */}
            {Array.from({ length: 8 }).map((_, index) => {
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
