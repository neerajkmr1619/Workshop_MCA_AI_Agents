import { describe, expect, it } from "vitest";
import { squareRoot } from "../../lessons/module-1/tools";

describe("squareRoot tool", () => {
  it("is named so the model can call it", () => {
    expect(squareRoot.name).toBe("square_root");
  });

  it("has a description", () => {
    expect(squareRoot.description).toBeTruthy();
  });

  it("computes a square root", async () => {
    await expect(squareRoot.invoke({ x: 16 })).resolves.toBe(4);
  });

  it("computes the square root of the lesson's example value", async () => {
    const result = (await squareRoot.invoke({ x: 467 })) as number;
    expect(result).toBeCloseTo(21.6102, 3);
  });
});
