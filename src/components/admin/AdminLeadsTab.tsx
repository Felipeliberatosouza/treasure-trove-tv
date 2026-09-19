import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle, Download } from "lucide-react";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  page_url: string | null;
  created_at: string;
}

function formatPhone(digits: string) {
  const d = (digits || "").replace(/\D/g, "");
  if (d.length !== 11) return digits;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const AdminLeadsTab = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("whatsapp_leads")
        .select("id, name, email, phone, source, page_url, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      setLeads((data as Lead[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = leads.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${l.name} ${l.email} ${l.phone}`.toLowerCase().includes(q);
  });

  const exportCsv = () => {
    const rows = [
      ["Nome", "E-mail", "Celular", "Origem", "Página", "Data"],
      ...filtered.map((l) => [
        l.name,
        l.email,
        formatPhone(l.phone),
        l.source,
        l.page_url || "",
        new Date(l.created_at).toLocaleString("pt-BR"),
      ]),
    ];
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-whatsapp.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Leads do WhatsApp</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Visitantes sem login que pediram atendimento pelo WhatsApp e informaram seus dados.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Buscar por nome, e-mail ou celular"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-secondary border-border"
        />
        <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lead registrado até o momento.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-4 font-medium">Nome</th>
                <th className="py-2 pr-4 font-medium">E-mail</th>
                <th className="py-2 pr-4 font-medium">Celular</th>
                <th className="py-2 pr-4 font-medium">Origem</th>
                <th className="py-2 pr-4 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-border/50">
                  <td className="py-2 pr-4">{l.name}</td>
                  <td className="py-2 pr-4">{l.email}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <a
                      href={`https://wa.me/55${l.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {formatPhone(l.phone)}
                    </a>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">{l.source}</td>
                  <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminLeadsTab;
