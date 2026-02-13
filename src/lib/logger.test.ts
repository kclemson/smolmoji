import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("does not throw when calling any log method", () => {
    expect(() => logger.pixel("test action")).not.toThrow();
    expect(() => logger.history("test action", { key: "val" })).not.toThrow();
    expect(() => logger.state("test")).not.toThrow();
    expect(() => logger.ai("test")).not.toThrow();
    expect(() => logger.tool("test")).not.toThrow();
    expect(() => logger.warn("test")).not.toThrow();
    expect(() => logger.error("test")).not.toThrow();
  });

  it("calls console.log in dev mode", () => {
    logger.pixel("draw", { x: 1, y: 2 });
    expect(console.log).toHaveBeenCalled();
  });
});
