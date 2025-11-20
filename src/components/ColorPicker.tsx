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
}

export const ColorPicker = ({ 
  selectedColor, 
  onColorChange, 
  isEyedropperActive = false,
  onEyedropperToggle 
}: ColorPickerProps) => {
  const [customColor, setCustomColor] = useState("#000000");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            type="color"
            value={customColor}
            onChange={(e) => {
              setCustomColor(e.target.value);
              onColorChange(e.target.value);
            }}
            className="h-12 cursor-pointer"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onColorChange("transparent")}
          className={cn(
            "h-12 px-4",
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
              "h-12 px-4",
              isEyedropperActive && "ring-2 ring-primary bg-primary/10"
            )}
          >
            <Pipette className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-8 gap-2">
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
