import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <section className="card m-6 max-w-lg">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[10px] bg-red-50 text-red-600">
        <SearchX size={20} strokeWidth={2.25} />
      </div>
      <h1 className="mb-1 text-xl font-bold">Não encontrado</h1>
      <p className="muted mb-4">O item que você tentou abrir não existe ou você não tem acesso a ele.</p>
      <Link href="/dashboard" className="btn btn-primary">Voltar ao início</Link>
    </section>
  );
}
