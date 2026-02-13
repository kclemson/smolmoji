import { describe, it, expect } from "vitest";
import { hexToRgb, colorDistance, colorsAreSimilar } from "./color";

describe("hexToRgb", () => {
  it("parses hex colors", () => {
    expect(hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb("#0000FF")).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("parses rgba colors", () => {
    expect(hexToRgb("rgba(128,64,32,0.5)")).toEqual({ r: 128, g: 64, b: 32 });
    expect(hexToRgb("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30 });
  });

  it("returns null for invalid input", () => {
    expect(hexToRgb("transparent")).toBeNull();
    expect(hexToRgb("not-a-color")).toBeNull();
  });
});

describe("colorDistance", () => {
  it("returns 0 for identical colors", () => {
    expect(colorDistance("#000000", "#000000")).toBe(0);
    expect(colorDistance("#FF0000", "#FF0000")).toBe(0);
  });

  it("returns Infinity when a color is invalid", () => {
    expect(colorDistance("transparent", "#000000")).toBe(Infinity);
  });

  it("calculates Euclidean distance between colors", () => {
    // Black to white = sqrt(255^2 * 3) ≈ 441.67
    const dist = colorDistance("#000000", "#FFFFFF");
    expect(dist).toBeCloseTo(441.67, 0);
  });
});

describe("colorsAreSimilar", () => {
  it("considers identical colors similar", () => {
    expect(colorsAreSimilar("#FF0000", "#FF0000")).toBe(true);
  });

  it("considers very different colors dissimilar", () => {
    expect(colorsAreSimilar("#000000", "#FFFFFF")).toBe(false);
  });

  it("normalizes transparent to white", () => {
    expect(colorsAreSimilar("transparent", "#FFFFFF")).toBe(true);
    expect(colorsAreSimilar("transparent", "transparent")).toBe(true);
  });

  it("respects custom threshold", () => {
    // Small distance colors
    expect(colorsAreSimilar("#000000", "#0A0A0A", 30)).toBe(true);
    expect(colorsAreSimilar("#000000", "#0A0A0A", 5)).toBe(false);
  });
});
