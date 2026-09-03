import { describe, expect, it } from "vitest";
import { isValidCpfOrCnpj } from "@/lib/validation/cpf-cnpj";

describe("isValidCpfOrCnpj", () => {
  it("accepts a valid CPF, with or without punctuation", () => {
    expect(isValidCpfOrCnpj("11144477735")).toBe(true);
    expect(isValidCpfOrCnpj("111.444.777-35")).toBe(true);
  });

  it("accepts a valid CNPJ (the cpf field also stores CNPJ for B2B ML sales)", () => {
    expect(isValidCpfOrCnpj("11222333000181")).toBe(true);
    expect(isValidCpfOrCnpj("11.222.333/0001-81")).toBe(true);
  });

  it("rejects a sequence that only happens to be the right length", () => {
    expect(isValidCpfOrCnpj("12345678901")).toBe(false);
  });

  it("rejects repeated-digit sequences even though their naive check digits happen to match", () => {
    expect(isValidCpfOrCnpj("00000000000")).toBe(false);
    expect(isValidCpfOrCnpj("11111111111")).toBe(false);
  });

  it("rejects the wrong length entirely", () => {
    expect(isValidCpfOrCnpj("123")).toBe(false);
    expect(isValidCpfOrCnpj("")).toBe(false);
  });
});
