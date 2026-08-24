import { Empresa } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type UsuarioEmpresaDb = Pick<typeof prisma, "usuarioEmpresa">;

export function isEmpresaValue(value: unknown): value is Empresa {
  return typeof value === "string" && Object.values(Empresa).includes(value as Empresa);
}

/**
 * Merges the legacy single empresaVinculada field with the newer
 * empresasVinculadas array into one deduplicated list — the source of truth
 * for "which companies is this user allowed on" wherever a user is created
 * or edited.
 */
export function normalizeEmpresas(payload: { empresaVinculada?: unknown; empresasVinculadas?: unknown }): Empresa[] {
  const empresas = new Set<Empresa>();

  if (Array.isArray(payload.empresasVinculadas)) {
    for (const empresa of payload.empresasVinculadas) {
      if (isEmpresaValue(empresa)) {
        empresas.add(empresa);
      }
    }
  }

  if (isEmpresaValue(payload.empresaVinculada)) {
    empresas.add(payload.empresaVinculada);
  }

  return Array.from(empresas);
}

export async function getUsuarioEmpresas(db: UsuarioEmpresaDb, usuarioIds: string[]) {
  if (usuarioIds.length === 0) {
    return [];
  }

  return db.usuarioEmpresa.findMany({
    where: { usuarioId: { in: usuarioIds } },
    orderBy: { createdAt: "asc" }
  });
}

export async function replaceUsuarioEmpresas(db: UsuarioEmpresaDb, usuarioId: string, empresas: Empresa[]) {
  await db.usuarioEmpresa.deleteMany({ where: { usuarioId } });

  if (empresas.length === 0) return;

  await db.usuarioEmpresa.createMany({
    data: empresas.map((empresa) => ({ usuarioId, empresa, role: "MEMBER" })),
    skipDuplicates: true
  });
}

export function attachEmpresasToUsuarios<T extends { id: string; empresaVinculada?: Empresa | null }>(
  usuarios: T[],
  vinculos: Array<{ usuarioId: string; empresa: Empresa }>
) {
  const vinculosPorUsuario = new Map<string, Array<{ usuarioId: string; empresa: Empresa }>>();

  for (const vinculo of vinculos) {
    const atuais = vinculosPorUsuario.get(vinculo.usuarioId) ?? [];
    atuais.push(vinculo);
    vinculosPorUsuario.set(vinculo.usuarioId, atuais);
  }

  return usuarios.map((usuario) => {
    const usuarioEmpresas = vinculosPorUsuario.get(usuario.id) ?? [];

    const empresasVinculadas =
      usuarioEmpresas.length > 0
        ? usuarioEmpresas.map((item) => item.empresa)
        : usuario.empresaVinculada
          ? [usuario.empresaVinculada]
          : [];

    return {
      ...usuario,
      usuarioEmpresas,
      empresasVinculadas
    };
  });
}

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
