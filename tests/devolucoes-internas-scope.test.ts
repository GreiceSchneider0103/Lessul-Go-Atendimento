import { describe, expect, it } from "vitest";
import { shouldIncludeDevolucoesInternas } from "@/lib/services/dashboard-service";

describe("shouldIncludeDevolucoesInternas", () => {
  it("excludes ATENDENTE's own-tickets-only dashboard view", () => {
    expect(shouldIncludeDevolucoesInternas({}, { perfil: "ATENDENTE" })).toBe(false);
  });

  it("includes SUPERVISOR/ADMIN/MASTER's company-wide view by default", () => {
    expect(shouldIncludeDevolucoesInternas({}, { perfil: "SUPERVISOR" })).toBe(true);
    expect(shouldIncludeDevolucoesInternas({}, { perfil: "ADMIN" })).toBe(true);
    expect(shouldIncludeDevolucoesInternas({}, { perfil: "MASTER" })).toBe(true);
  });

  it("excludes when a company filter is set to something other than Lessul", () => {
    expect(shouldIncludeDevolucoesInternas({ empresa: "MS_DECOR" }, { perfil: "ADMIN" })).toBe(false);
  });

  it("includes when a company filter is explicitly Lessul", () => {
    expect(shouldIncludeDevolucoesInternas({ empresa: "LESSUL" }, { perfil: "ADMIN" })).toBe(true);
  });

  it("includes a LOJA user linked to Lessul, excludes one that isn't", () => {
    expect(shouldIncludeDevolucoesInternas({}, { perfil: "LOJA", empresasVinculadas: ["LESSUL"] })).toBe(true);
    expect(shouldIncludeDevolucoesInternas({}, { perfil: "LOJA", empresasVinculadas: ["MS_DECOR"] })).toBe(false);
    expect(shouldIncludeDevolucoesInternas({}, { perfil: "LOJA" })).toBe(false);
  });
});
