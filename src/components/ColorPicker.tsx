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
  isEyedropperActive?: boolean;
  onEyedropperToggle?: () => void;
}

export const ColorPicker = ({ 
  selectedColor, 
  onColorChange,
  customColors,
  onCustomColorsChange,
  isEyedropperActive = false,
  onEyedropperToggle
}: ColorPickerProps) => {
  const [customColor, setCustomColor] = useState("#000000");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3 items-start">
        {/* Left: Tools Section */}
        <div className="grid grid-cols-2 gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn("w-8 h-8")}
                style={customColor !== "#000000" ? { backgroundColor: customColor } : {}}
              >
                {customColor === "#000000" && <Palette className="h-4 w-4" />}
              </Button>
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
                    
                    // Add to custom colors if not already present
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
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => onColorChange("transparent")}
            className={cn(
              "w-8 h-8",
              selectedColor === "transparent" && "ring-2 ring-primary"
            )}
          >
            <Eraser className="h-4 w-4" />
          </Button>
          
          {onEyedropperToggle && (
            <Button
              variant="outline"
              size="icon"
              onClick={onEyedropperToggle}
              className={cn(
                "w-8 h-8",
                isEyedropperActive && "ring-2 ring-primary bg-primary/10"
              )}
            >
              <Pipette className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <Separator orientation="vertical" className="self-stretch w-[2px] bg-gray-500" />
        
        {/* Right: Color Grid */}
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
          
          {/* Row 2: Recent/Custom colors */}
          <div className="grid grid-cols-8 gap-2">
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
      
      {/* Instructions - spans full width */}
      <p className="text-xs text-muted-foreground text-center w-full">
        click and drag to fill in a rectangle - right click to revert
      </p>
    </div>
  );
};
