import { describe, expect, it } from "vitest";
import { pvBarreColor, pvRatio, pvTexteColor } from "@/src/lib/ui/pv";

describe("pv colors", () => {
  it("ratio nul si max 0", () => {
    expect(pvRatio(5, 0)).toBe(0);
    expect(pvTexteColor(0, 0)).toBe("text-red-400");
    expect(pvBarreColor(0, 0)).toBe("bg-red-500");
  });

  it("texte : vert >50%, ambre >25%, rouge sinon", () => {
    expect(pvTexteColor(8, 10)).toBe("text-green-400");
    expect(pvTexteColor(4, 10)).toBe("text-amber-400");
    expect(pvTexteColor(2, 10)).toBe("text-red-400");
  });

  it("barre : mêmes seuils", () => {
    expect(pvBarreColor(8, 10)).toBe("bg-green-500");
    expect(pvBarreColor(4, 10)).toBe("bg-amber-400");
    expect(pvBarreColor(2, 10)).toBe("bg-red-500");
  });
});
