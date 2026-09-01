import { describe, expect, it } from "vitest";
import { addBusinessDays } from "@/lib/utils/business-days";

describe("addBusinessDays", () => {
  it("adds business days without crossing a weekend", () => {
    // Tuesday
    const result = addBusinessDays(new Date("2026-09-01T12:00:00"), 2);
    expect(result.toISOString().slice(0, 10)).toBe("2026-09-03");
  });

  it("skips the weekend when the count crosses it", () => {
    // Friday
    const result = addBusinessDays(new Date("2026-09-04T12:00:00"), 2);
    expect(result.toISOString().slice(0, 10)).toBe("2026-09-08");
  });
});
