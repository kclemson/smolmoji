export function findBoundingBox(pixelData: string[][]) {
  let minX = 32, minY = 32, maxX = -1, maxY = -1;
  
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (pixelData[y][x] !== 'transparent') {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  if (maxX === -1) return null;
  return { minX, minY, maxX, maxY };
}

export function scaleContent(
  sourcePixels: string[][],
  sourceBounds: { minX: number; minY: number; maxX: number; maxY: number },
  targetWidth: number,
  targetHeight: number
) {
  const sourceWidth = sourceBounds.maxX - sourceBounds.minX + 1;
  const sourceHeight = sourceBounds.maxY - sourceBounds.minY + 1;
  
  const newPixels: string[][] = Array(32).fill(null).map(() => 
    Array(32).fill('transparent')
  );
  
  const targetX = Math.floor((32 - targetWidth) / 2);
  const targetY = Math.floor((32 - targetHeight) / 2);
  
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const sourceX = sourceBounds.minX + Math.floor(x * sourceWidth / targetWidth);
      const sourceY = sourceBounds.minY + Math.floor(y * sourceHeight / targetHeight);
      newPixels[targetY + y][targetX + x] = sourcePixels[sourceY][sourceX];
    }
  }
  
  return newPixels;
}

export function autoFitPixels(pixels: string[][]) {
  const bounds = findBoundingBox(pixels);
  if (!bounds) return pixels;
  
  const contentWidth = bounds.maxX - bounds.minX + 1;
  const contentHeight = bounds.maxY - bounds.minY + 1;
  
  const maxSize = 30; // 32 - 2px margin (1px per side)
  const scale = Math.min(maxSize / contentWidth, maxSize / contentHeight);
  const targetWidth = Math.round(contentWidth * scale);
  const targetHeight = Math.round(contentHeight * scale);
  
  return scaleContent(pixels, bounds, targetWidth, targetHeight);
}
