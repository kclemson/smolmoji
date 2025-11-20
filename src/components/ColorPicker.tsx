import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pipette, Eraser, Palette } from "lucide-react";

const STATIC_COLORS = [
  "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF6600", "#9900FF",
];

export const DEFAULT_CUSTOM_COLORS = [
  "#808080", "#C0C0C0", "#800000", "#008000", "#000080", "#808000", "#FF1493", "#00CED1",
];

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
  const colorInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex gap-3 items-start">
        {/* Left: Tools Section */}
        <div className="grid grid-cols-2 gap-2">
          <input
            ref={colorInputRef}
            type="color"
            className="hidden"
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
          />
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => colorInputRef.current?.click()}
            className={cn("w-8 h-8")}
            style={customColor !== "#000000" ? { backgroundColor: customColor } : {}}
          >
            {customColor === "#000000" && <Palette className="h-4 w-4" />}
          </Button>
          
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
          <div className="grid grid-cols-8 gap-2">
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
            {customColors.map((color, index) => (
              <button
                key={`custom-${index}`}
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
        </div>
      </div>
  );
};
