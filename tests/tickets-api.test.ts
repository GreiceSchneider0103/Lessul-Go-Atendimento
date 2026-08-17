import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  getCurrentApiUser: vi.fn(),
  getTicketById: vi.fn(),
  updateTicket: vi.fn(),
  uploadTicketAttachment: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentApiUser: mocks.getCurrentApiUser
}));

vi.mock("@/lib/services/tickets-service", () => ({
  getTicketById: mocks.getTicketById,
  updateTicket: mocks.updateTicket,
  softDeleteTicket: vi.fn(),
  uploadTicketAttachment: mocks.uploadTicketAttachment,
  removeTicketAttachment: vi.fn()
}));

import { GET, PATCH } from "@/app/api/tickets/[id]/route";
import { POST as POST_ATTACHMENT } from "@/app/api/tickets/[id]/attachment/route";

const params = { params: Promise.resolve({ id: "ticket-1" }) };

describe("ticket API authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks LOJA users from the general ticket detail route", async () => {
    mocks.getCurrentApiUser.mockResolvedValue({ id: "user-1", perfil: "LOJA" });

    const response = await GET(new NextRequest("http://localhost/api/tickets/ticket-1"), params);

    expect(response.status).toBe(403);
    expect(mocks.getTicketById).not.toHaveBeenCalled();
  });

  it("does not update a ticket when authentication fails", async () => {
    mocks.getCurrentApiUser.mockRejectedValue(new UnauthorizedError());
    const request = new NextRequest("http://localhost/api/tickets/ticket-1", {
      method: "PATCH",
      body: JSON.stringify({ statusTicket: "ABERTO" })
    });

    const response = await PATCH(request, params);

    expect(response.status).toBe(401);
    expect(mocks.updateTicket).not.toHaveBeenCalled();
  });

  it("authenticates attachment uploads with the API auth client", async () => {
    const user = { id: "user-1", perfil: "ATENDENTE" };
    mocks.getCurrentApiUser.mockResolvedValue(user);
    mocks.uploadTicketAttachment.mockResolvedValue({ anexoSizeBytes: null });
    const form = new FormData();
    form.set("file", new File(["photo"], "photo.jpg", { type: "image/jpeg" }));

    const response = await POST_ATTACHMENT(new NextRequest("http://localhost/api/tickets/ticket-1/attachment", {
      method: "POST",
      body: form
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.getCurrentApiUser).toHaveBeenCalledOnce();
    expect(mocks.uploadTicketAttachment).toHaveBeenCalledWith("ticket-1", user, expect.any(File));
  });
});
