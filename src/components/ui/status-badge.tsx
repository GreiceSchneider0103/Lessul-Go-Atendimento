import clsx from "clsx";
import { formatEnumLabel } from "@/lib/formatters/display";

type BadgeContext = "marketplace" | "empresa" | "motivo" | "statusReclamacao";

function getTone(value: string) {
  const normalized = value.toUpperCase();
  if (["CONCLUIDO", "SYNCED", "NO_PRAZO", "ADMIN"].includes(normalized)) return "success";
  if (["FAILED", "ATRASADO", "INATIVO"].includes(normalized)) return "danger";
  if (["PENDING", "AGUARDANDO_CLIENTE", "AGUARDANDO_DEVOLUCAO", "AGUARDANDO_ASSISTENCIA", "AGUARDANDO_MARKETPLACE"].includes(normalized)) return "warning";
  return "info";
}

function getCustomClass(value: string, context?: BadgeContext) {
  const normalized = value.toUpperCase();

  if (context === "empresa") {
    if (normalized === "LESSUL") return "badge-custom-lessul";
    if (normalized === "MS_DECOR") return "badge-custom-ms-decor";
    if (normalized === "MODIFIKA") return "badge-custom-modifika";
    if (normalized === "MOVELBENTO") return "badge-custom-movelbento";
    if (normalized === "VIVA_VIDA") return "badge-custom-viva-vida";
  }

  if (context === "marketplace" && normalized === "SITE_PROPRIO") return "badge-custom-site-proprio";

  if (context === "motivo") {
    if (normalized === "PRODUTO_DANIFICADO" || normalized === "DEFEITO_FABRICACAO") return "badge-custom-motivo-amarelo";
    if (normalized === "DESISTENCIA" || normalized === "FALTANDO_ITENS") return "badge-custom-motivo-azul";
    if (normalized === "PRODUTO_INCORRETO") return "badge-custom-motivo-cinza";
    if (normalized === "PROBLEMA") return "badge-custom-motivo-vermelho";
  }

  if (context === "statusReclamacao" && normalized === "AFETANDO") return "badge-custom-status-afetando";

  return null;
}

export function StatusBadge({ value, context }: { value: string; context?: BadgeContext }) {
  const tone = getTone(value);
  const customClass = getCustomClass(value, context);

  return <span className={clsx("badge", customClass ?? `badge-${tone}`)}>{formatEnumLabel(value)}</span>;
}
