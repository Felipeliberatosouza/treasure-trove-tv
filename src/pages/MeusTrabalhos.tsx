import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Sparkles } from "lucide-react";

interface Row {
  id: string;
  titulo: string;
  tema: string;
  created_at: string;
}

const MeusTrabalhos = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("work_documents")
        .select("id, titulo, tema, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as Row[]);
      setLoading(false);
    };
    void run();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 pt-24 pb-16">
        <h1 className="mb-1 font-display text-2xl font-bold">Meus trabalhos</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Documentos Word e slides gerados com IA. Só você vê os seus trabalhos.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-8 text-center">
              <Sparkles className="mx-auto h-7 w-7 text-primary" />
              <p className="text-sm text-muted-foreground">Você ainda não criou nenhum trabalho.</p>
              <Button asChild><Link to="/">Criar Word e slides de trabalho</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <Link key={r.id} to={`/trabalho/${r.id}`} className="block">
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="flex items-center gap-3 p-4">
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.tema} • {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeusTrabalhos;
