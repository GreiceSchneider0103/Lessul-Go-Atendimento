import { Empresa } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function listUsuariosComEmpresas() {
  const usuarios = await prisma.usuario.findMany({ orderBy: { criadoEm: "desc" } });

  const vinculos = await prisma.usuarioEmpresa.findMany({
    where: { usuarioId: { in: usuarios.map((usuario) => usuario.id) } },
    orderBy: { createdAt: "asc" }
  });

  const empresasPorUsuario = new Map<string, Empresa[]>();

  for (const vinculo of vinculos) {
    const atuais = empresasPorUsuario.get(vinculo.usuarioId) ?? [];
    atuais.push(vinculo.empresa);
    empresasPorUsuario.set(vinculo.usuarioId, atuais);
  }

  return usuarios.map((usuario) => ({
    ...usuario,
    empresasVinculadas: empresasPorUsuario.get(usuario.id) ?? (usuario.empresaVinculada ? [usuario.empresaVinculada] : [])
  }));
}
