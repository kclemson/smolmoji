import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  onCustomColorsChange: (colors: string[]) => void;
}

export const ColorPicker = ({ 
  selectedColor, 
  onColorChange,
  customColors,
  onCustomColorsChange
}: ColorPickerProps) => {
  const [customColor, setCustomColor] = useState("#000000");

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
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "w-8 h-8 rounded-md border-2 transition-all hover:scale-110",
                    "border-border bg-muted/20 flex items-center justify-center"
                  )}
                >
                  <Palette className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-3 bg-popover" 
                align="start"
                side="top"
              >
                <div className="space-y-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      const newColor = e.target.value;
                      setCustomColor(newColor);
                      onColorChange(newColor);
                      
                      // Add to custom colors FIFO style
                      if (!customColors.includes(newColor)) {
                        const updatedColors = [newColor, ...customColors].slice(0, 8);
                        onCustomColorsChange(updatedColors);
                      }
                    }}
                    className="w-48 h-32 cursor-pointer border-0"
                  />
                  <p className="text-xs text-muted-foreground text-center">{customColor}</p>
                </div>
              </PopoverContent>
            </Popover>

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
