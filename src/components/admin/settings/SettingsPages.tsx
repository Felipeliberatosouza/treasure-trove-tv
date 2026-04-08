import { useEffect, useState } from "react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PageEditor = ({ settingsKey, label }: { settingsKey: "about_us" | "terms_of_use" | "privacy_policy"; label: string }) => {
  const { data, loading, update } = usePlatformSettings(settingsKey);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setContent(data.content || ""); }, [data]);

  const handleSave = async () => {
    setSaving(true);
    await update({ content });
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">Use o texto abaixo para editar o conteúdo da página. Suporta parágrafos separados por linhas em branco.</p>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={15}
        className="font-mono text-sm"
        placeholder={`Conteúdo da página ${label}...`}
      />
      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
};

const SettingsPages = () => {
  return (
    <Tabs defaultValue="about" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="about">Sobre Nós</TabsTrigger>
        <TabsTrigger value="terms">Termos de Uso</TabsTrigger>
        <TabsTrigger value="privacy">Política de Privacidade</TabsTrigger>
      </TabsList>
      <TabsContent value="about">
        <PageEditor settingsKey="about_us" label="Sobre Nós" />
      </TabsContent>
      <TabsContent value="terms">
        <PageEditor settingsKey="terms_of_use" label="Termos de Uso" />
      </TabsContent>
      <TabsContent value="privacy">
        <PageEditor settingsKey="privacy_policy" label="Política de Privacidade" />
      </TabsContent>
    </Tabs>
  );
};

export default SettingsPages;
