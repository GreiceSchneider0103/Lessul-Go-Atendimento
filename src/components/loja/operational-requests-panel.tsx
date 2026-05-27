"use client";
import Link from "next/link";
import { Perfil, StatusOperacional } from "@prisma/client";
import { formatDateBR, formatDateTimeBR, formatEnumLabel } from "@/lib/formatters/display";

type Row = { 
  id: string; 
  empresa: string; 
  ticketId: string; 
  tipoAcao: string; 
  status: StatusOperacional; 
  prazoOperacional: string | null; 
  updatedAt: string; 
  comentarioLoja: string | null; 
  comentarioAtendente: string | null; 
  codigoRastreio: string | null; 
  valorReembolso: number; 
  valorAssistencia?: number; 
  valorColetaEnvioPecas: number; 
  ticket: { nomeCliente: string; numeroVenda: string; linkPedido: string | null }; 
  anexo?: { fileUrl: string | null; fileName?: string; filePath?: string | null; mimeType?: string | null } 
};

const statusOptions = ["EM_ABERTO","ASSISTENCIA_ENVIADA","ASSISTENCIA_A_CAMINHO","ASSISTENCIA_ENTREGUE","COLETA_SOLICITADA","COLETA_FEITA","DEVOLUCAO_SOLICITADA","DEVOLUCAO_A_CAMINHO","DEVOLUCAO_REALIZADA","REEMBOLSO_PENDENTE","REEMBOLSO_REALIZADO","AGUARDANDO_ATENDENTE","CONCLUIDA"];
const STATUS_OPERACIONAL_LABELS: Record<string, string> = { EM_ABERTO:"Em aberto", ASSISTENCIA_ENVIADA:"Assistência enviada", ASSISTENCIA_A_CAMINHO:"Assistência a caminho", ASSISTENCIA_ENTREGUE:"Assistência entregue", COLETA_SOLICITADA:"Coleta solicitada", COLETA_FEITA:"Coleta feita", DEVOLUCAO_SOLICITADA:"Devolução solicitada", DEVOLUCAO_A_CAMINHO:"Devolução a caminho", DEVOLUCAO_REALIZADA:"Devolução realizada", REEMBOLSO_PENDENTE:"Reembolso pendente", REEMBOLSO_REALIZADO:"Reembolso realizado", AGUARDANDO_ATENDENTE:"Aguardando atendente", CONCLUIDA:"Concluída" };

export function OperationalRequestsPanel({ data, perfil }: { data: Row[]; perfil: Perfil }) {
  const renderAnexoThumbnail = (row: Row) => {
    if (!row.anexo?.fileUrl) return <span style={{ color: '#999', fontSize: '0.85rem' }}>Sem anexo</span>;

    const isImage = row.anexo.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(row.anexo.fileUrl);
    const isPDF = row.anexo.mimeType === "application/pdf" || row.anexo.fileUrl.toLowerCase().endsWith(".pdf");

    return (
      <a href={row.anexo.fileUrl} target="_blank" rel="noopener noreferrer" title={row.anexo.fileName || "Ver anexo"}>
        {isImage ? (
          <img 
            src={row.anexo.fileUrl} 
            alt={row.anexo.fileName || "Anexo"} 
            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }}
          />
        ) : (
          <div style={{ 
            width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', 
            background: '#f8f9fa', borderRadius: 4, border: '1px solid #ddd', fontSize: 10, fontWeight: 'bold', color: isPDF ? '#d32f2f' : '#666'
          }}>
            {isPDF ? "PDF" : "FILE"}
          </div>
        )}
      </a>
    );
  };

  return (
    <div className="panel table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Ticket</th>
            <th>Cliente</th>
            <th>Pedido</th>
            <th>Ação</th>
            <th>Status</th>
            <th>Prazo</th>
            <th>Anexo</th>
            <th>Atualizado</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const isAtrasado = row.prazoOperacional && new Date(row.prazoOperacional) < new Date() && row.status !== "CONCLUIDA";
            
            return (
              <tr key={row.id}>
                <td>{formatEnumLabel(row.empresa)}</td>
                <td><Link href={`/tickets/${row.ticketId}`} className="link">Ver Ticket</Link></td>
                <td>{row.ticket.nomeCliente}</td>
                <td>
                  {row.ticket.linkPedido ? (
                    <a href={row.ticket.linkPedido} target="_blank" rel="noopener noreferrer" className="link">
                      {row.ticket.numeroVenda}
                    </a>
                  ) : row.ticket.numeroVenda}
                </td>
                <td><span className="badge">{formatEnumLabel(row.tipoAcao)}</span></td>
                <td>{STATUS_OPERACIONAL_LABELS[row.status] ?? formatEnumLabel(row.status)}</td>
                <td>
                  {row.prazoOperacional ? (
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      backgroundColor: isAtrasado ? '#fff1f0' : '#f6ffed', 
                      color: isAtrasado ? '#cf1322' : '#389e0d',
                      border: `1px solid ${isAtrasado ? '#ffa39e' : '#b7eb8f'}`
                    }}>
                      {formatDateBR(new Date(row.prazoOperacional))}
                    </span>
                  ) : '-'}
                </td>
                <td>{renderAnexoThumbnail(row)}</td>
                <td style={{ fontSize: '0.85rem', color: '#666' }}>{formatDateTimeBR(new Date(row.updatedAt))}</td>
                <td>
                  <details className="dropdown-details">
                    <summary className="btn btn-sm">Ações</summary>
                    <div className="panel details-content" style={{ marginTop: 8, padding: 16, minWidth: 300, border: '1px solid #eee' }}>
                      <form onSubmit={async (e)=>{
                        e.preventDefault();
                        const fd=new FormData(e.currentTarget);
                        const payload=Object.fromEntries(fd.entries());
                        const r=await fetch(`/api/operational-requests/${row.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
                        if(!r.ok){alert("Falha ao atualizar");return;}
                        location.reload();
                      }}>
                        <div style={{ display: 'grid', gap: 12 }}>
                          <label>Status operacional
                            <select name="status" defaultValue={row.status as string}>
                              {statusOptions.map((s)=><option key={s} value={s} disabled={perfil===Perfil.LOJA && s==="CONCLUIDA"}>{STATUS_OPERACIONAL_LABELS[s] ?? s}</option>)}
                            </select>
                          </label>
                          <label>Prazo operacional
                            <input type="date" name="prazoOperacional" defaultValue={row.prazoOperacional?.slice(0,10) ?? ""}/>
                          </label>
                          <label>Código de rastreio
                            <input name="codigoRastreio" defaultValue={row.codigoRastreio ?? ""} placeholder="Código de rastreio"/>
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <label>Reembolso
                              <input name="valorReembolso" defaultValue={row.valorReembolso} placeholder="R$ 0,00"/>
                            </label>
                            <label>Assistência
                              <input name="valorAssistencia" defaultValue={row.valorAssistencia ?? 0} placeholder="R$ 0,00"/>
                            </label>
                          </div>
                          <label>Coleta/Envio/Peças
                            <input name="valorColetaEnvioPecas" defaultValue={row.valorColetaEnvioPecas} placeholder="R$ 0,00"/>
                          </label>
                          <label>Comentário da loja
                            <textarea name="comentarioLoja" defaultValue={row.comentarioLoja ?? ""} rows={3} placeholder="Observações da loja..."/>
                          </label>
                          {perfil===Perfil.ADMIN && (
                            <label>Comentário interno (Atendente)
                              <textarea name="comentarioAtendente" defaultValue={row.comentarioAtendente ?? ""} rows={2}/>
                            </label>
                          )}
                          <button className="btn btn-primary btn-block" type="submit">Salvar Alterações</button>
                        </div>
                      </form>
                      
                      <hr style={{ margin: '16px 0' }} />
                      
                      <form onSubmit={async (e)=>{
                        e.preventDefault();
                        const file=(e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement)?.files?.[0];
                        if(!file)return;
                        const fd=new FormData();
                        fd.append("file",file);
                        const r=await fetch(`/api/tickets/${row.ticketId}/attachment`,{method:"POST",body:fd});
                        if(!r.ok){alert("Falha no upload do anexo");return;}
                        location.reload();
                      }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: 4 }}>{row.anexo ? "Substituir Anexo" : "Adicionar Anexo"}</label>
                        <input type="file" accept="image/*,application/pdf" style={{ marginBottom: 8 }} />
                        <button className="btn btn-secondary btn-sm btn-block" type="submit">Fazer Upload</button>
                      </form>
                    </div>
                  </details>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
