/**
 * Shared color utilities for pixel color comparison and parsing.
 * Used by both the pixel editor (Index.tsx) and the canvas renderer (PixelCanvas.tsx).
 */

export const hexToRgb = (color: string): { r: number; g: number; b: number } | null => {
  // Handle rgba format: rgba(r,g,b,a)
  const rgbaMatch = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/i.exec(color);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3])
    };
  }
  
  // Handle hex format: #rrggbb
  const hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16)
    };
  }
  
  return null;
};

export const colorDistance = (color1: string, color2: string): number => {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return Infinity;
  
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
};

export const colorsAreSimilar = (
  color1: string, 
  color2: string, 
  threshold: number = 20
): boolean => {
  const normalizedColor1 = color1 === 'transparent' ? '#ffffff' : color1;
  const normalizedColor2 = color2 === 'transparent' ? '#ffffff' : color2;
  
  if (normalizedColor1 === normalizedColor2) return true;
  return colorDistance(normalizedColor1, normalizedColor2) <= threshold;
};
