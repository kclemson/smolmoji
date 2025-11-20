import { cn } from "@/lib/utils";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pipette } from "lucide-react";

const PRESET_COLORS = [
  // Row 1: Basic colors
  "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF6600", "#9900FF",
  // Row 2: Common pixel art colors
  "#808080", "#C0C0C0", "#800000", "#008000", "#000080", "#808000", "#FF1493", "#00CED1",
];

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  isEyedropperActive?: boolean;
  onEyedropperToggle?: () => void;
  compact?: boolean;
}

export const ColorPicker = ({ 
  selectedColor, 
  onColorChange, 
  isEyedropperActive = false,
  onEyedropperToggle,
  compact = false
}: ColorPickerProps) => {
  const [customColor, setCustomColor] = useState("#000000");

  return (
    <div className={cn(compact ? "space-y-2" : "space-y-4")}>
      <div className={cn("flex items-center", compact ? "gap-2" : "gap-3")}>
        <div className="flex-1">
          <Input
            type="color"
            value={customColor}
            onChange={(e) => {
              setCustomColor(e.target.value);
              onColorChange(e.target.value);
            }}
            className={cn("cursor-pointer", compact ? "h-8" : "h-12")}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onColorChange("transparent")}
          className={cn(
            compact ? "h-8 px-3" : "h-12 px-4",
            selectedColor === "transparent" && "ring-2 ring-primary"
          )}
        >
          Eraser
        </Button>
        {onEyedropperToggle && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEyedropperToggle}
            className={cn(
              compact ? "h-8 px-3" : "h-12 px-4",
              isEyedropperActive && "ring-2 ring-primary bg-primary/10"
            )}
          >
            <Pipette className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
          </Button>
        )}
      </div>
      
      <div className={cn("grid grid-cols-8", compact ? "gap-1" : "gap-2")}>
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={cn(
              "w-full aspect-square rounded-md border-2 transition-all hover:scale-110",
              selectedColor === color 
                ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background" 
                : "border-border"
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
};
