import { useEffect, useState } from "react";
import { usePlatformSettings, AboutUsSettings, TermsOfUseSettings, PrivacyPolicySettings } from "@/hooks/usePlatformSettings";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ───── About Us Editor ───── */
const defaultAboutUs: AboutUsSettings = {
  description: "",
  mission: "",
  values: "",
  how_it_works_items: [
    { title: "Conteúdo de Qualidade", description: "" },
    { title: "Professores Especializados", description: "" },
    { title: "Avaliações Reais", description: "" },
    { title: "Foco no Resultado", description: "" },
  ],
};

const AboutUsEditor = () => {
  const { data, loading, update } = usePlatformSettings("about_us");
  const [form, setForm] = useState<AboutUsSettings>(defaultAboutUs);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm({ ...defaultAboutUs, ...data });
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    await update(form);
    setSaving(false);
  };

  const updateItem = (idx: number, field: "title" | "description", value: string) => {
    const items = [...form.how_it_works_items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, how_it_works_items: items });
  };

  const addItem = () => setForm({ ...form, how_it_works_items: [...form.how_it_works_items, { title: "", description: "" }] });
  const removeItem = (idx: number) => setForm({ ...form, how_it_works_items: form.how_it_works_items.filter((_, i) => i !== idx) });

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Descrição Principal</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Texto principal da página Sobre Nós..." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Nossa Missão</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={form.mission} onChange={e => setForm({ ...form, mission: e.target.value })} rows={3} placeholder="Texto da missão..." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Nossos Valores</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={form.values} onChange={e => setForm({ ...form, values: e.target.value })} rows={3} placeholder="Texto dos valores..." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Como Funciona</CardTitle>
          <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.how_it_works_items.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-start border border-border rounded-lg p-3">
              <div className="flex-1 space-y-2">
                <Input value={item.title} onChange={e => updateItem(idx, "title", e.target.value)} placeholder="Título" />
                <Textarea value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} rows={2} placeholder="Descrição" />
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-destructive shrink-0 mt-1">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
};

/* ───── Sections Editor (Terms / Privacy) ───── */
const defaultSections = [{ title: "", content: "" }];

const SectionsEditor = ({ settingsKey, label }: { settingsKey: "terms_of_use" | "privacy_policy"; label: string }) => {
  const { data, loading, update } = usePlatformSettings(settingsKey);
  const [sections, setSections] = useState<{ title: string; content: string }[]>(defaultSections);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.sections?.length) setSections(data.sections);
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    await update({ sections });
    setSaving(false);
  };

  const updateSection = (idx: number, field: "title" | "content", value: string) => {
    const s = [...sections];
    s[idx] = { ...s[idx], [field]: value };
    setSections(s);
  };

  const addSection = () => setSections([...sections, { title: "", content: "" }]);
  const removeSection = (idx: number) => setSections(sections.filter((_, i) => i !== idx));

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Organize as seções de {label}. Cada seção terá um título e conteúdo.</p>

      {sections.map((sec, idx) => (
        <Card key={idx}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">Seção {idx + 1}</Label>
              <Input value={sec.title} onChange={e => updateSection(idx, "title", e.target.value)} placeholder="Título da seção (ex: Aceitação dos Termos)" className="flex-1" />
              <Button variant="ghost" size="icon" onClick={() => removeSection(idx)} className="text-destructive shrink-0">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Textarea value={sec.content} onChange={e => updateSection(idx, "content", e.target.value)} rows={4} placeholder="Conteúdo da seção..." />
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addSection}><Plus className="h-3 w-3 mr-1" /> Adicionar Seção</Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
};

/* ───── Main ───── */
const SettingsPages = () => {
  return (
    <Tabs defaultValue="about" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="about">Sobre Nós</TabsTrigger>
        <TabsTrigger value="terms">Termos de Uso</TabsTrigger>
        <TabsTrigger value="privacy">Política de Privacidade</TabsTrigger>
      </TabsList>
      <TabsContent value="about"><AboutUsEditor /></TabsContent>
      <TabsContent value="terms"><SectionsEditor settingsKey="terms_of_use" label="Termos de Uso" /></TabsContent>
      <TabsContent value="privacy"><SectionsEditor settingsKey="privacy_policy" label="Política de Privacidade" /></TabsContent>
    </Tabs>
  );
};

export default SettingsPages;
