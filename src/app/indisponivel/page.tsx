import Link from "next/link";
import { DatabaseZap } from "lucide-react";

export const dynamic = "force-dynamic";

export default function IndisponivelPage() {
  return (
    <section className="card w-full max-w-[720px]">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[10px] bg-amber-50 text-amber-600">
        <DatabaseZap size={20} strokeWidth={2.25} />
      </div>
      <h1 className="mb-1 text-xl font-bold">Banco temporariamente indisponível</h1>
      <p className="muted">
        O aplicativo está no ar, mas a conexão com o banco de dados está indisponível no momento.
        Isso normalmente ocorre por allow-list/rede/SSL do provedor PostgreSQL.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/api/health" className="btn btn-secondary">Ver health check</Link>
        <Link href="/login" className="btn btn-primary">Tentar login novamente</Link>
      </div>
    </section>
  );
}
