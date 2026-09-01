import { Empresa, Perfil, Prisma, SupportCategoria, SupportStatus, SupportTipoAnexo } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { createSupabaseAdmin } from "@/lib/supabase/service-role";
import { logError, logInfo } from "@/lib/logger";
import { addBusinessDays } from "@/lib/utils/business-days";
import { empresasFor } from "@/lib/services/operational-requests-service";

type AppUser = {
  id: string;
  perfil: Perfil;
  empresaVinculada: Empresa | null;
  empresasVinculadas?: Empresa[];
  nome?: string;
  email?: string;
};

const SUPPORT_RESPONSE_BUSINESS_DAYS = 2;
const ATTACHMENT_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;
const BUCKET = "ticket-anexos";

function tipoAnexoFor(mimeType: string): SupportTipoAnexo {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) return "IMAGEM";
  return "OUTRO";
}

function calculateSupportSla(status: SupportStatus, prazoResposta: Date): "NO_PRAZO" | "ATRASADO" | "CONCLUIDO" {
  if (status === "CONCLUIDO") return "CONCLUIDO";
  if (new Date() > prazoResposta) return "ATRASADO";
  return "NO_PRAZO";
}

/**
 * Single extension point for future notifications: today only powers the
 * unread red dot (via updatedAt, checked separately in hasUnreadSuporte).
 * When email and the Trello-like task board exist, their dispatch goes here
 * — and only here — instead of scattered across the create/update paths.
 */
async function notifySupportTicketCreated(ticket: { id: string; titulo: string; empresa: Empresa }) {
  logInfo("Novo chamado de suporte aberto", { supportTicketId: ticket.id, empresa: ticket.empresa });
}

async function notifySupportTicketUpdated(ticket: { id: string; status: SupportStatus }) {
  logInfo("Chamado de suporte atualizado", { supportTicketId: ticket.id, status: ticket.status });
}

export async function hasUnreadSuporte(params: { perfil: Perfil; empresasVinculadas: Empresa[]; visitadoEm: Date | null }) {
  const since = params.visitadoEm ?? new Date(0);

  if (params.perfil === "LOJA") {
    if (params.empresasVinculadas.length === 0) return false;

    const count = await prisma.supportTicket.count({
      where: {
        empresa: { in: params.empresasVinculadas },
        atualizadoEm: { gt: since },
        atualizadoPor: { perfil: { not: "LOJA" } }
      }
    });

    return count > 0;
  }

  const count = await prisma.supportTicket.count({
    where: {
      atualizadoEm: { gt: since },
      atualizadoPor: { perfil: "LOJA" }
    }
  });

  return count > 0;
}

export async function markSuporteVisitado(userId: string) {
  await prisma.usuario.update({ where: { id: userId }, data: { suporteVisitadoEm: new Date() } });
}

export type CreateSupportTicketInput = {
  empresa: Empresa;
  categoria: SupportCategoria;
  titulo: string;
  descricao: string;
};

export async function createSupportTicket(input: CreateSupportTicketInput, files: File[], user: AppUser) {
  if (user.perfil !== "LOJA") {
    throw new ForbiddenError("Apenas o perfil loja pode abrir chamados de suporte");
  }

  if (!empresasFor(user).includes(input.empresa)) {
    throw new ForbiddenError("Empresa não vinculada ao usuário");
  }

  for (const file of files) {
    if (!ATTACHMENT_ALLOWED_TYPES.includes(file.type)) {
      throw new AppError("Tipo de arquivo não permitido", 400, "INVALID_FILE_TYPE");
    }
    if (file.size > ATTACHMENT_MAX_SIZE) {
      throw new AppError("Arquivo acima de 10MB", 400, "FILE_TOO_LARGE");
    }
  }

  const prazoResposta = addBusinessDays(new Date(), SUPPORT_RESPONSE_BUSINESS_DAYS);

  const ticket = await prisma.supportTicket.create({
    data: {
      empresa: input.empresa,
      categoria: input.categoria,
      titulo: input.titulo,
      descricao: input.descricao,
      prazoResposta,
      slaStatus: "NO_PRAZO",
      criadoPorId: user.id,
      atualizadoPorId: user.id
    }
  });

  if (files.length > 0) {
    const supabase = createSupabaseAdmin();

    for (const file of files) {
      const safeFileName = file.name.replace(/\s+/g, "_");
      const path = `support/${ticket.empresa}/${ticket.id}/${Date.now()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type
      });

      if (uploadError) {
        logError("Falha no upload de anexo de suporte", { supportTicketId: ticket.id, path, message: uploadError.message });
        continue;
      }

      await prisma.supportAnexo.create({
        data: {
          supportTicketId: ticket.id,
          tipoAnexo: tipoAnexoFor(file.type),
          storagePath: path,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: BigInt(file.size),
          uploadedBy: user.id
        }
      });
    }
  }

  await notifySupportTicketCreated(ticket);

  return ticket;
}

export async function listSupportTickets(user: AppUser, filters: { empresa?: Empresa; status?: SupportStatus; categoria?: SupportCategoria }) {
  const empresas = empresasFor(user);

  if (user.perfil === "LOJA" && empresas.length === 0) {
    throw new ForbiddenError("Usuário loja sem empresa vinculada");
  }

  const where: Prisma.SupportTicketWhereInput = {
    ...(user.perfil === "LOJA" ? { empresa: { in: empresas } } : filters.empresa ? { empresa: filters.empresa } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.categoria ? { categoria: filters.categoria } : {})
  };

  return prisma.supportTicket.findMany({
    where,
    include: {
      responsavel: { select: { id: true, nome: true } },
      criadoPor: { select: { id: true, nome: true } },
      anexos: true,
      comentarios: { orderBy: { criadoEm: "asc" } }
    },
    orderBy: { atualizadoEm: "desc" }
  });
}

async function findScoped(id: string, user: AppUser) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      responsavel: { select: { id: true, nome: true } },
      criadoPor: { select: { id: true, nome: true } },
      anexos: true,
      comentarios: { orderBy: { criadoEm: "asc" } }
    }
  });

  if (!ticket) throw new AppError("Chamado não encontrado", 404, "NOT_FOUND");

  if (user.perfil === "LOJA" && !empresasFor(user).includes(ticket.empresa)) {
    throw new ForbiddenError("Chamado não encontrado ou sem acesso");
  }

  return ticket;
}

export async function getSupportTicketById(id: string, user: AppUser) {
  return findScoped(id, user);
}

export type UpdateSupportTicketInput = Partial<{
  status: SupportStatus;
  responsavelId: string | null;
  comentario: string;
}>;

export async function updateSupportTicket(id: string, payload: UpdateSupportTicketInput, user: AppUser) {
  const current = await findScoped(id, user);

  if (user.perfil === "LOJA") {
    if (payload.status !== undefined) {
      throw new ForbiddenError("Perfil loja não pode alterar o status do chamado");
    }
    if (payload.responsavelId !== undefined) {
      throw new ForbiddenError("Perfil loja não pode atribuir responsável");
    }
  }

  const nextStatus = payload.status ?? current.status;
  const isConcluding = nextStatus === "CONCLUIDO" && current.status !== "CONCLUIDO";
  const isReopening = nextStatus !== "CONCLUIDO" && current.status === "CONCLUIDO";

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.responsavelId !== undefined ? { responsavelId: payload.responsavelId } : {}),
      slaStatus: calculateSupportSla(nextStatus, current.prazoResposta),
      atualizadoPorId: user.id,
      ...(isConcluding ? { concluidoEm: new Date() } : {}),
      ...(isReopening ? { concluidoEm: null } : {})
    }
  });

  if (payload.comentario?.trim()) {
    await prisma.supportComentario.create({
      data: {
        supportTicketId: id,
        autorId: user.id,
        autorNome: user.nome ?? user.email ?? "Usuário",
        autorPerfil: user.perfil,
        comentario: payload.comentario.trim()
      }
    });
  }

  await notifySupportTicketUpdated(updated);

  return findScoped(id, user);
}

export async function uploadSupportAttachment(supportTicketId: string, file: File, user: AppUser) {
  const ticket = await findScoped(supportTicketId, user);

  if (!ATTACHMENT_ALLOWED_TYPES.includes(file.type)) {
    throw new AppError("Tipo de arquivo não permitido", 400, "INVALID_FILE_TYPE");
  }
  if (file.size > ATTACHMENT_MAX_SIZE) {
    throw new AppError("Arquivo acima de 10MB", 400, "FILE_TOO_LARGE");
  }

  const supabase = createSupabaseAdmin();
  const safeFileName = file.name.replace(/\s+/g, "_");
  const path = `support/${ticket.empresa}/${ticket.id}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type
  });

  if (uploadError) {
    logError("Falha no upload de anexo de suporte", { supportTicketId, path, message: uploadError.message });
    throw new AppError("Falha no upload do anexo", 500, "UPLOAD_FAILED");
  }

  return prisma.supportAnexo.create({
    data: {
      supportTicketId,
      tipoAnexo: tipoAnexoFor(file.type),
      storagePath: path,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: BigInt(file.size),
      uploadedBy: user.id
    }
  });
}
