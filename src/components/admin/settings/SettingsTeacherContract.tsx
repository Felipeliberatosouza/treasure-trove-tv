import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileSignature } from "lucide-react";

interface ContractTemplate {
  contract_title: string;
  contract_body: string;
  platform_percentage: number;
}

const SettingsTeacherContract = () => {
  const [data, setData] = useState<ContractTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      const { data: row } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "teacher_contract_template")
        .maybeSingle();
      if (row) setData(row.value as unknown as ContractTemplate);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({ value: JSON.parse(JSON.stringify(data)) })
      .eq("key", "teacher_contract_template");

    if (error) {
      toast({ title: "Erro", description: "Falha ao salvar.", variant: "destructive" });
    } else {
      toast({ title: "Salvo", description: "Template do contrato atualizado." });
    }
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Template não encontrado.</p>;

  return (
    <div className="space-y-4">
      <h3 className="font-display font-semibold flex items-center gap-2">
        <FileSignature className="h-4 w-4" /> Contrato do Professor
      </h3>
      <p className="text-xs text-muted-foreground">
        Variáveis disponíveis: {"{{platform_name}}"}, {"{{teacher_name}}"}, {"{{teacher_cpf}}"}, {"{{teacher_percentage}}"}, {"{{teacher_percentage_text}}"}, {"{{platform_percentage}}"}, {"{{platform_percentage_text}}"}, {"{{data}}"}, {"{{hora}}"}
      </p>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Título do Contrato</label>
        <Input
          value={data.contract_title}
          onChange={(e) => setData({ ...data, contract_title: e.target.value })}
          className="bg-secondary"
        />
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Percentual da Plataforma (%)</label>
        <Input
          type="number"
          min={0}
          max={100}
          value={data.platform_percentage}
          onChange={(e) => setData({ ...data, platform_percentage: Number(e.target.value) })}
          className="bg-secondary w-32"
        />
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Texto do Contrato</label>
        <Textarea
          value={data.contract_body}
          onChange={(e) => setData({ ...data, contract_body: e.target.value })}
          className="bg-secondary min-h-[400px] font-mono text-xs"
          rows={20}
        />
      </div>

      <Button onClick={handleSave} disabled={saving} className="font-display">
        {saving ? "Salvando..." : "Salvar Template"}
      </Button>
    </div>
  );
};

export default SettingsTeacherContract;
