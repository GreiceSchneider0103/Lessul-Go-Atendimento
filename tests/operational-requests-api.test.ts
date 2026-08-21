import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentApiUser: vi.fn(),
  updateOperationalRequest: vi.fn(),
  deleteOperationalRequest: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentApiUser: mocks.getCurrentApiUser
}));

vi.mock("@/lib/services/operational-requests-service", () => ({
  updateOperationalRequest: mocks.updateOperationalRequest,
  deleteOperationalRequest: mocks.deleteOperationalRequest,
  listOperationalRequests: vi.fn(),
  createFromTicket: vi.fn()
}));

import { PATCH, DELETE } from "@/app/api/operational-requests/[id]/route";

const params = { params: Promise.resolve({ id: "request-1" }) };

describe("operational requests API authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks a perfil without operational.update from editing a request (regression for CRIT-3)", async () => {
    mocks.getCurrentApiUser.mockResolvedValue({ id: "user-1", perfil: "ATENDENTE" });

    const response = await PATCH(
      new NextRequest("http://localhost/api/operational-requests/request-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "CONCLUIDA" })
      }),
      params
    );

    expect(response.status).toBe(403);
    expect(mocks.updateOperationalRequest).not.toHaveBeenCalled();
  });

  it("blocks a perfil without operational.update from deleting a request (regression for CRIT-3)", async () => {
    mocks.getCurrentApiUser.mockResolvedValue({ id: "user-1", perfil: "SUPERVISOR" });

    const response = await DELETE(new NextRequest("http://localhost/api/operational-requests/request-1"), params);

    expect(response.status).toBe(403);
    expect(mocks.deleteOperationalRequest).not.toHaveBeenCalled();
  });

  it("lets LOJA (which holds operational.update) update a request", async () => {
    const user = { id: "loja-1", perfil: "LOJA" };
    mocks.getCurrentApiUser.mockResolvedValue(user);
    mocks.updateOperationalRequest.mockResolvedValue({ id: "request-1", status: "COLETA_FEITA" });

    const response = await PATCH(
      new NextRequest("http://localhost/api/operational-requests/request-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "COLETA_FEITA" })
      }),
      params
    );

    expect(response.status).toBe(200);
    expect(mocks.updateOperationalRequest).toHaveBeenCalledWith("request-1", user, { status: "COLETA_FEITA" });
  });
});
