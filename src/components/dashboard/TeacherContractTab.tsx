import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileSignature, Download, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Contract {
  id: string;
  contract_text: string;
  signature_name: string;
  signature_cpf: string;
  signed_at: string;
  expires_at: string;
  status: string;
  ip_address: string;
}

const TeacherContractTab = () => {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewContract, setViewContract] = useState<Contract | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("teacher_contracts" as any)
        .select("*")
        .eq("teacher_id", user.id)
        .order("signed_at", { ascending: false });
      setContracts((data as any[]) || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const downloadPdf = (contract: Contract) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    // Sanitize plain text first, then re-apply only the safe markdown-ish
    // formatting the contract template uses (line breaks and **bold**).
    const bodyHtml = esc(contract.contract_text)
      .replace(/\n/g, "<br/>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    printWindow.document.write(`
      <html>
      <head><title>Contrato - ${esc(contract.signature_name)}</title>
      <style>body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 20px; line-height: 1.6; font-size: 14px; }
      .signature { text-align: center; margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; font-style: italic; font-size: 20px; }
      .meta { font-size: 11px; color: #666; margin-top: 10px; }</style></head>
      <body>
        <div>${bodyHtml}</div>
        <div class="signature">${esc(contract.signature_name)}<br/><span class="meta">CPF: ${esc(contract.signature_cpf)}</span></div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <FileSignature className="h-5 w-5" /> Meu Contrato
      </h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum contrato assinado. O contrato será solicitado ao publicar sua primeira aula.</p>
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-secondary/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium">Contrato de Prestação de Serviços</p>
                  <p className="text-xs text-muted-foreground">
                    Assinado em {new Date(c.signed_at).toLocaleDateString("pt-BR")} — Expira em {new Date(c.expires_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge variant="outline" className={c.status === "active" ? "border-green-500/30 text-green-500" : "border-destructive/30 text-destructive"}>
                  {c.status === "active" ? "Ativo" : "Expirado"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setViewContract(c)} className="gap-1">
                  <Eye className="h-3.5 w-3.5" /> Visualizar
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadPdf(c)} className="gap-1">
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!viewContract} onOpenChange={() => setViewContract(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-display">Contrato Assinado</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] rounded-lg border border-border p-4 bg-secondary/30">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line text-sm leading-relaxed">
              {viewContract?.contract_text.split("\n").map((line, i) => {
                if (line.startsWith("**") && line.endsWith("**")) {
                  return <p key={i} className="font-bold mt-3 mb-1">{line.replace(/\*\*/g, "")}</p>;
                }
                return <p key={i} className="my-0.5">{line.replace(/\*\*/g, "")}</p>;
              })}
            </div>
            {viewContract && (
              <div className="mt-6 pt-4 border-t border-border text-center">
                <p className="text-xl italic font-serif">{viewContract.signature_name}</p>
                <p className="text-xs text-muted-foreground mt-1">CPF: {viewContract.signature_cpf}</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherContractTab;
