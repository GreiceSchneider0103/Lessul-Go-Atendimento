import { describe, expect, it } from "vitest";
import { assertSlaConsistency, calculateSla } from "../src/lib/utils/sla";
import { AppError } from "../src/lib/errors";

describe("calculateSla", () => {
  it("retorna CONCLUIDO quando ticket concluído", () => {
    expect(calculateSla("CONCLUIDO", null)).toBe("CONCLUIDO");
  });
});

describe("assertSlaConsistency", () => {
  it("lança AppError (não Error genérico) quando falta prazo em ticket não concluído", () => {
    expect(() => assertSlaConsistency("ABERTO", null)).toThrow(AppError);
  });

  it("não lança quando ticket concluído sem prazo", () => {
    expect(() => assertSlaConsistency("CONCLUIDO", null)).not.toThrow();
  });
});
