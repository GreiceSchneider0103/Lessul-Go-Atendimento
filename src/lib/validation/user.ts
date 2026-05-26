import { z } from "zod";
import { Empresa, Perfil } from "@prisma/client";

const perfilSchema = z.nativeEnum(Perfil);

export const createUserSchema = z
  .object({
    nome: z.string().min(2, "Nome inválido"),
    email: z.string().email("E-mail inválido"),
    perfil: perfilSchema,
    empresaVinculada: z.nativeEnum(Empresa).optional().nullable(),
    senhaTemporaria: z.string().min(8, "Senha temporária deve ter ao menos 8 caracteres").optional(),
    enviarConvite: z.boolean().optional(),
    ativo: z.boolean().optional()
  })
  .superRefine((payload, ctx) => {
    if (payload.perfil === "LOJA" && !payload.empresaVinculada) {
      ctx.addIssue({ code: "custom", message: "Empresa vinculada é obrigatória para perfil LOJA", path: ["empresaVinculada"] });
    }

    if (!payload.enviarConvite && !payload.senhaTemporaria) {
      ctx.addIssue({ code: "custom", message: "Informe senha temporária ou marque envio de convite", path: ["senhaTemporaria"] });
    }
  });

export const updateUserSchema = z
  .object({
    nome: z.string().min(2, "Nome inválido").optional(),
    perfil: perfilSchema.optional(),
    empresaVinculada: z.nativeEnum(Empresa).optional().nullable(),
    ativo: z.boolean().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Informe ao menos um campo para atualização"
  });
