import { cn } from "@/lib/utils";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pipette, RectangleHorizontal, Eraser } from "lucide-react";

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
  isMultiSelectActive?: boolean;
  onMultiSelectToggle?: () => void;
}

export const ColorPicker = ({ 
  selectedColor, 
  onColorChange, 
  isEyedropperActive = false,
  onEyedropperToggle,
  isMultiSelectActive = false,
  onMultiSelectToggle
}: ColorPickerProps) => {
  const [customColor, setCustomColor] = useState("#000000");

  return (
    <div className="flex justify-center">
      <div className="flex gap-4 items-start">
        {/* Left: Tools Section */}
        <div className="flex flex-col gap-2">
          <Input
            type="color"
            value={customColor}
            onChange={(e) => {
              setCustomColor(e.target.value);
              onColorChange(e.target.value);
            }}
            className="cursor-pointer w-8 h-8"
          />
          
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

          {onMultiSelectToggle && (
            <Button
              variant="outline"
              size="icon"
              onClick={onMultiSelectToggle}
              className={cn(
                "w-8 h-8",
                isMultiSelectActive && "ring-2 ring-primary bg-primary/10"
              )}
            >
              <RectangleHorizontal className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {/* Right: Color Grid */}
        <div className="grid grid-cols-8 gap-2">
          {PRESET_COLORS.map((color) => (
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
      </div>
    </div>
  );
};
