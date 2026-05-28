import { z } from "zod";
import { Empresa, Perfil } from "@prisma/client";

const perfilSchema = z.nativeEnum(Perfil);
const empresaSchema = z.nativeEnum(Empresa);

function hasAnyCompany(payload: {
  empresaVinculada?: Empresa | null;
  empresasVinculadas?: Empresa[];
}) {
  return Boolean(payload.empresaVinculada) || Boolean(payload.empresasVinculadas?.length);
}

export const userCreateSchema = z
  .object({
    nome: z.string().min(2, "Nome inválido"),
    email: z.string().email("E-mail inválido"),
    perfil: perfilSchema,

    // Campo legado: mantém compatibilidade com o que já existia.
    empresaVinculada: empresaSchema.optional().nullable(),

    // Novo campo: permite vincular o usuário a mais de uma empresa.
    empresasVinculadas: z.array(empresaSchema).optional().default([]),

    senhaTemporaria: z.string().min(8, "Senha temporária deve ter ao menos 8 caracteres").optional(),
    enviarConvite: z.boolean().optional(),
    ativo: z.boolean().optional()
  })
  .superRefine((payload, ctx) => {
    if (payload.perfil === "LOJA" && !hasAnyCompany(payload)) {
      ctx.addIssue({
        code: "custom",
        message: "Ao menos uma empresa vinculada é obrigatória para perfil LOJA",
        path: ["empresasVinculadas"]
      });
    }

    if (!payload.enviarConvite && !payload.senhaTemporaria) {
      ctx.addIssue({
        code: "custom",
        message: "Informe senha temporária ou marque envio de convite",
        path: ["senhaTemporaria"]
      });
    }
  });

export const userUpdateSchema = z
  .object({
    nome: z.string().min(2, "Nome inválido").optional(),
    email: z.string().email("E-mail inválido").optional(),
    perfil: perfilSchema.optional(),

    // Campo legado: mantém compatibilidade com o que já existia.
    empresaVinculada: empresaSchema.optional().nullable(),

    // Novo campo: permite atualizar múltiplas empresas vinculadas.
    empresasVinculadas: z.array(empresaSchema).optional(),

    ativo: z.boolean().optional(),
    senhaTemporaria: z.string().min(8, "Senha temporária deve ter ao menos 8 caracteres").optional(),
    enviarConvite: z.boolean().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Informe ao menos um campo para atualização"
  })
  .superRefine((payload, ctx) => {
    if (payload.perfil === "LOJA" && !hasAnyCompany(payload)) {
      ctx.addIssue({
        code: "custom",
        message: "Ao menos uma empresa vinculada é obrigatória para perfil LOJA",
        path: ["empresasVinculadas"]
      });
    }
  });

// Aliases para manter compatibilidade com arquivos antigos que importam pelos nomes anteriores.
export const createUserSchema = userCreateSchema;
export const updateUserSchema = userUpdateSchema;

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;