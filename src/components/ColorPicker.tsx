import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
}

export const ColorPicker = ({ 
  selectedColor, 
  onColorChange,
  customColors,
  onCustomColorsChange
}: ColorPickerProps) => {
  const [customColor, setCustomColor] = useState("#000000");
  const colorInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        {/* Color Grid */}
        <div className="flex flex-col gap-2">
          {/* Row 1: Static colors */}
          <div className="grid grid-cols-9 gap-2">
            {STATIC_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => onColorChange(color)}
                className={cn(
                  "w-8 h-8 rounded-md border-2 transition-all hover:scale-110",
                  selectedColor === color 
                    ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background" 
                    : "border-border"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          
          {/* Row 2: Color Picker + Recent/Custom colors */}
          <div className="grid grid-cols-9 gap-2">
            {/* First box: Color Picker Button */}
            <div className="relative">
              <input
                ref={colorInputRef}
                type="color"
                value={customColor}
                onChange={(e) => {
                  const newColor = e.target.value;
                  setCustomColor(newColor);
                  onColorChange(newColor);
                  
                  // Add to custom colors FIFO style using functional update
                  onCustomColorsChange((prevColors) => {
                    if (!prevColors.includes(newColor)) {
                      return [newColor, ...prevColors].slice(0, 8);
                    }
                    return prevColors; // Color already exists, no change
                  });
                }}
                className="absolute w-8 h-8 opacity-0 pointer-events-none"
              />
              <button
                onClick={() => colorInputRef.current?.click()}
                className={cn(
                  "w-8 h-8 rounded-md border-2 transition-all hover:scale-110",
                  "border-border bg-muted/20 flex items-center justify-center"
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
                    "w-8 h-8 rounded-md border-2 transition-all",
                    color ? "hover:scale-110 cursor-pointer" : "cursor-default",
                    color && selectedColor === color 
                      ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background" 
                      : "border-border",
                    !color && "bg-muted/20"
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
