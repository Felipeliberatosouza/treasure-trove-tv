import { useEffect, useState } from "react";
import { usePlatformSettings, ContactSettings } from "@/hooks/usePlatformSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { formatCNPJ, isValidCNPJ } from "@/lib/cnpjValidator";

const SettingsContact = () => {
  const { data, loading, update } = usePlatformSettings("contact");
  const [form, setForm] = useState<ContactSettings>({
    email: "", phone: "", address: "", platform_address: "", razao_social: "", nome_fantasia: "", cnpj: "", instagram: "", youtube: "", facebook: "", twitter: "", tiktok: "", linkedin: "", whatsapp: "", whatsapp_message: "", whatsapp_hours: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setForm({ ...form, ...data }); }, [data]);

  const handleSave = async () => {
    setSaving(true);
    await update(form);
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <Label>Email de Contato</Label>
        <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div>
        <Label>Telefone</Label>
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div>
        <Label>Endereço de Contato</Label>
        <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div>
        <Label>Endereço da Empresa (para contratos)</Label>
        <Input value={form.platform_address || ""} onChange={(e) => setForm({ ...form, platform_address: e.target.value })} placeholder="Endereço completo da Revisão Fácil para uso em contratos" />
      </div>
      <div>
        <Label>Razão Social</Label>
        <Input value={form.razao_social || ""} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} placeholder="Razão social da empresa" />
      </div>
      <div>
        <Label>Nome Fantasia</Label>
        <Input value={form.nome_fantasia || ""} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} placeholder="Nome fantasia da empresa" />
      </div>
      <div>
        <Label>CNPJ</Label>
        <Input value={form.cnpj || ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="flex items-center gap-1.5">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            Instagram
          </Label>
          <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@usuario" />
        </div>
        <div>
          <Label className="flex items-center gap-1.5">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            YouTube
          </Label>
          <Input value={form.youtube} onChange={(e) => setForm({ ...form, youtube: e.target.value })} placeholder="URL do canal" />
        </div>
        <div>
          <Label className="flex items-center gap-1.5">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
          </Label>
          <Input value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} placeholder="URL da página" />
        </div>
        <div>
          <Label className="flex items-center gap-1.5">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Twitter / X
          </Label>
          <Input value={form.twitter} onChange={(e) => setForm({ ...form, twitter: e.target.value })} placeholder="@usuario" />
        </div>
        <div>
          <Label className="flex items-center gap-1.5">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61.04 3.91.18-.56.52-1.01 1.16-1.32 1.88-.65-.04-1.31-.06-1.98-.06-5.31 0-9.61 3.64-9.61 8.14 0 1.54.46 2.97 1.25 4.18L3.2 18.26l4.1-1.07c1.26.56 2.67.87 4.15.87.67 0 1.32-.06 1.95-.17.08-.58.22-1.14.42-1.67-.76.13-1.55.2-2.37.2-1.28 0-2.49-.25-3.56-.71l-.52-.24-2.73.71.72-2.64-.3-.48A6.03 6.03 0 014.34 10c0-3.81 3.69-6.9 8.24-6.9.64 0 1.27.05 1.88.14.29-.69.67-1.32 1.14-1.87-.98-.16-1.99-.25-3.02-.27zM16.8 2.4c-1.54 0-2.81 1.07-3.17 2.49-.08.33-.13.67-.13 1.03 0 .36.05.7.13 1.03.36 1.42 1.63 2.49 3.17 2.49s2.81-1.07 3.17-2.49c.08-.33.13-.67.13-1.03 0-.36-.05-.7-.13-1.03-.36-1.42-1.63-2.49-3.17-2.49zm0 1.44c.88 0 1.6.72 1.6 1.6v.48c0 .88-.72 1.6-1.6 1.6s-1.6-.72-1.6-1.6v-.48c0-.88.72-1.6 1.6-1.6z"/></svg>
            TikTok
          </Label>
          <Input value={form.tiktok || ""} onChange={(e) => setForm({ ...form, tiktok: e.target.value })} placeholder="@usuario" />
        </div>
        <div>
          <Label className="flex items-center gap-1.5">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            LinkedIn
          </Label>
          <Input value={form.linkedin || ""} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} placeholder="URL do perfil" />
        </div>
        <div className="col-span-2">
          <Label className="flex items-center gap-1.5">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </Label>
          <Input value={form.whatsapp || ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="5511999999999 (apenas números com DDD)" />
        </div>
        <div className="col-span-2">
          <Label>Mensagem Automática do WhatsApp</Label>
          <Input value={form.whatsapp_message || ""} onChange={(e) => setForm({ ...form, whatsapp_message: e.target.value })} placeholder="Olá! Gostaria de mais informações sobre os cursos." />
        </div>
        <div className="col-span-2">
          <Label>Horário de Atendimento do WhatsApp</Label>
          <Input value={form.whatsapp_hours || ""} onChange={(e) => setForm({ ...form, whatsapp_hours: e.target.value })} placeholder="Segunda a Sexta, 9h às 18h" />
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Alterações"}
      </Button>
    </div>
  );
};

export default SettingsContact;
