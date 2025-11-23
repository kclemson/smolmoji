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
  colorPaletteInputRef?: React.RefObject<HTMLInputElement>;
}

export const ColorPicker = ({ 
  selectedColor, 
  onColorChange,
  customColors,
  onCustomColorsChange,
  colorPaletteInputRef
}: ColorPickerProps) => {
  const [customColor, setCustomColor] = useState("#000000");
  const localInputRef = useRef<HTMLInputElement>(null);
  const inputRef = colorPaletteInputRef || localInputRef;

  return (
    <div className="flex flex-col gap-2">
      {/* Single Row: Palette + 5 color slots */}
      <div 
        className="grid grid-cols-6 gap-2 w-full"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', width: '100%' }}
      >
        {/* Color Picker (Palette) */}
        <div className="relative">
          <input
            ref={inputRef}
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
                return [newColor, ...filtered].slice(0, 5);
              });
            }}
            className="absolute inset-0 w-10 h-10 opacity-0 cursor-pointer z-10"
          />
          <button
            className={cn(
              "w-10 h-10 rounded-md border transition-all hover:scale-110",
              "border-border flex items-center justify-center pointer-events-none"
            )}
          >
            <Palette className="h-5 w-5" />
          </button>
        </div>

        {/* 5 dynamic color slots */}
        {Array.from({ length: 5 }).map((_, index) => {
          const color = customColors[index];
          return (
            <button
              key={`color-${index}`}
              onClick={() => color && onColorChange(color)}
              className={cn(
                "w-10 h-10 rounded-md transition-all",
                color && "border",
                color ? "hover:scale-110 cursor-pointer" : "cursor-default",
                color && selectedColor === color 
                  ? "border-primary"
                  : color && "border-border"
              )}
              style={color ? { backgroundColor: color } : {}}
              disabled={!color}
            />
          );
        })}
      </div>
    </div>
  );
};
