import { describe, expect, it } from "vitest";
import { aideAction } from "@/src/lib/ui/actions";

describe("aide économie d'action (combat)", () => {
  it("explique A, M, L, G et l'absence d'action", () => {
    expect(aideAction("attaque")).toContain("mouvement");
    expect(aideAction("mouvement")).toContain("action");
    expect(aideAction("limitee")).toContain("remplace");
    expect(aideAction("gratuite")).toContain("ne consomme");
    expect(aideAction()).toContain("MJ");
  });
});
